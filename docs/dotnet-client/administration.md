# .NET Client: Cluster Administration

Use these APIs when you operate a cluster from code instead of a terminal: an internal admin tool, a runbook script, a deployment pipeline, or a scheduled backup job. The [.NET client](/docs/dotnet-client/) exposes the same operator tasks as the [Kahuna CLI](/docs/kahuna-cli/): cluster membership and [replica](/docs/glossary/#replica-and-replication-factor) placement, key-range administration, and backups with [point-in-time restore](/docs/glossary/#point-in-time-recovery-pitr). These calls are not routed by key. Keep them out of request paths.

## Choosing the Target Node

Range administration, cluster placement, and leave calls accept an optional `nodeUrl` argument. Pass it when the call must reach one specific node.

Cluster membership, backup, restore, snapshot-hold, and history-hold calls take no `nodeUrl` and rotate through the configured endpoints. A backup catalog belongs to the node that serves the call, so create a client with a single endpoint for backup and restore work. See [Client Leader-Aware Routing](/docs/client-routing/#what-routes) for how each call family is routed.

## Cluster Membership

`GetClusterMembership()` returns the current roster, membership version, the contacted node's local role, and whether that node has completed cluster initialization:

```csharp
KahunaClusterMembershipResponse membership =
    await client.GetClusterMembership();

Console.WriteLine($"Initialized={membership.Initialized}");
Console.WriteLine($"LocalRole={membership.LocalRole}");
```

Use the server readiness endpoint `GET /v1/cluster/health` for load balancer and orchestrator probes. Membership can be available before a node is initialized enough to serve key/value traffic.

## Replica Placement

`GetClusterPlacement()` returns the committed per-partition replica map:

```csharp
KahunaClusterPlacementResponse placement =
    await client.GetClusterPlacement();

Console.WriteLine($"RF={placement.ReplicationFactor}");
Console.WriteLine($"HostedHere={placement.HostedPartitionCount}");
```

When you need to inspect one node's local hosting view, pass that endpoint explicitly:

```csharp
KahunaClusterPlacementResponse nodePlacement =
    await client.GetClusterPlacement("https://kahuna-2:8082");
```

`SetReplicationFactor(...)` commits a per-partition replication-factor override. `0` clears the override so the partition inherits the server-wide replication factor:

```csharp
KahunaSetReplicationFactorResponse response =
    await client.SetReplicationFactor(
        partitionId: 3,
        replicationFactor: 5
    );

if (!response.Success)
    Console.WriteLine(response.Reason);
```

The change adjusts the placement target. Replica movement happens later through the placement rebalancer.

## Leaving the Cluster

`LeaveCluster(...)` asks a running node to decommission itself by committing its removal from the roster:

```csharp
KahunaClusterLeaveResponse left =
    await client.LeaveCluster("https://kahuna-3:8082");

if (left.Left)
    Console.WriteLine("Node can be stopped");

if (left.Drained)
    Console.WriteLine("Placed replicas were evacuated first");
```

When the client was created with multiple endpoints, `nodeUrl` is required so the call does not decommission an arbitrary round-robin target.

See [Replication Factor and Replica Placement](/docs/replica-placement/) for the server-side behavior behind these APIs.

## Key-Range Administration

For ordered key spaces, the client exposes key-range administration over both REST and gRPC transports.

```csharp
KahunaRegisterKeyRangeResponse registered =
    await client.RegisterKeyRange("users");

Console.WriteLine($"{registered.Status} {registered.RoutingMode}");
```

Registration switches the key space to range routing and, if needed, seeds the first replicated range descriptor, which covers the whole key space. You register once: other nodes pick up the routing mode from the committed range map. The CLI also contacts every endpoint you pass to verify their local routing views. See [How a Key Space Becomes Range-Routed](/docs/distributed-keyvalue-store/key-range-sharding/#how-a-key-space-becomes-range-routed).

Inspect the range map:

```csharp
KahunaRangeMapResponse ranges = await client.GetRanges("users");

foreach (var keySpace in ranges.KeySpaces)
{
    Console.WriteLine($"{keySpace.KeySpace}: {keySpace.RoutingMode}");
    foreach (var range in keySpace.Descriptors)
        Console.WriteLine($"{range.StartKey ?? "-inf"}..{range.EndKey ?? "+inf"} -> {range.PartitionId}");
}
```

Force a split at an exact key:

```csharp
KahunaSplitRangeResponse split =
    await client.SplitRange("users", "users/0500");

if (!split.Determinate)
{
    KahunaRangeMapResponse refreshed = await client.GetRanges("users");
    // Inspect refreshed before deciding whether the split happened.
}
```

Run the merge pass on demand:

```csharp
KahunaMergeRangesResponse merged = await client.MergeRanges();
Console.WriteLine($"{merged.Status}: {merged.Merges}");
```

Remove a key space from range routing:

```csharp
KahunaRemoveKeyRangeResponse removed =
    await client.RemoveKeyRange("users");
```

Use key-range administration only for key spaces intentionally modeled as ordered ranges. See [Key-Range Sharding](/docs/distributed-keyvalue-store/key-range-sharding/) for routing behavior, split/merge outcomes, and trade-offs.

## Backup and Point-in-Time Restore

Start the target Kahuna server with `--pitr-backup-dir` before using backup operations. The catalog belongs to the node selected by the client, so use a stable endpoint when building or inspecting an incremental chain.

```csharp
using Kahuna.Client;
using Kahuna.Shared.Communication.Rest;

var client = new KahunaClient("https://kahuna-1:8082");

KahunaBackupInfo full = await client.TakeCoordinatedBackupAsync();

KahunaBackupInfo incremental = await client.TakeIncrementalBackupAsync(
    full.BackupId
);

List<KahunaBackupInfo> backups = await client.ListBackupsAsync();
List<KahunaBackupInfo> chain = await client.GetBackupChainAsync(
    incremental.BackupId
);
```

Available methods:

| Method | Purpose |
|--------|---------|
| `TakeFullBackupAsync()` | Create a full backup on the selected node |
| `TakeCoordinatedBackupAsync()` | Create a full backup capped at a cluster-wide safe [HLC](/docs/glossary/#hybrid-logical-clock-hlc) timestamp |
| `TakeIncrementalBackupAsync(parentBackupId)` | Append committed [WAL](/docs/glossary/#write-ahead-log-wal) changes to a backup chain |
| `ListBackupsAsync()` | List manifests in the selected node's local catalog |
| `GetBackupChainAsync(leafBackupId)` | Resolve and validate a chain from its full root through the selected leaf |
| `RestoreAsync(leafBackupId, targetDir, targetTimeMs)` | Restore into a new directory on the selected server node |
| `RunBackupGarbageCollectionAsync(dryRun)` | Sweep orphaned artifacts and enforce backup retention on the selected server node |

Restore through the chain's natural end with `targetTimeMs: 0`:

```csharp
KahunaRestoreResponse restored = await client.RestoreAsync(
    leafBackupId: incremental.BackupId,
    targetDir: "/var/lib/kahuna/restored",
    targetTimeMs: 0
);

Console.WriteLine($"Applied {restored.EntriesApplied} WAL entries");
Console.WriteLine($"Restored to {restored.TargetDir}");
Console.WriteLine($"Coverage: {restored.MinRecoverablePhysicalMs}..{restored.MaxRecoverablePhysicalMs}");
```

For point-in-time recovery, pass the target HLC physical component as Unix epoch milliseconds. The server treats the value as the inclusive end of that millisecond. `targetDir` refers to the server filesystem. The operation does not replace live state; start a fresh node with the restored directory.

Run backup garbage collection directly, or preview it first:

```csharp
KahunaBackupGcResult preview =
    await client.RunBackupGarbageCollectionAsync(dryRun: true);

KahunaBackupGcResult applied =
    await client.RunBackupGarbageCollectionAsync();

Console.WriteLine($"Reclaimed {applied.BytesReclaimed} bytes");
```

Backup responses expose `RequestedKind`, `ActualKind`, and `SubstitutionReason` so callers can detect when an incremental request had to be replaced by a new full backup. Restore responses expose `Outcome`, `MinRecoverablePhysicalMs`, and `MaxRecoverablePhysicalMs` for typed handling and exact coverage checks.

Backup listing entries also expose `ClusterId` and `CoordinatorNode` when the server wrote current-format manifests. In production, use these fields to confirm that all nodes are pointed at the same shared backup catalog and that coordinated backups are not scattered across node-local directories.

See [Backups and Point-in-Time Recovery](/docs/backups-and-point-in-time-recovery/) for server setup, node bootstrap, and restore constraints.
