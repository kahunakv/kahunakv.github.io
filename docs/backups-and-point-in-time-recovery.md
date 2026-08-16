# Backups and Point-in-Time Recovery

Kahuna's backup design combines storage-engine checkpoints with the committed Raft write-ahead log (WAL). This supports full backups, incremental backups, and recovery to a selected Hybrid Logical Clock (HLC) timestamp.

:::caution Restore scope

Kahuna Server exposes backup and restore through REST, gRPC, `Kahuna.Client`, and `kahuna-cli`. Restore is offline: it writes a new storage directory and never replaces the live state of the node handling the request.

PITR restore reconstructs committed key/value state. Locks are runtime coordination leases and are not part of the restored PITR image. Range metadata is managed by the cluster and should be rebuilt or caught up through normal membership and Raft recovery. Plan recovery procedures around the data types used by the application and test them before relying on a runbook.

:::

## Backup Model

The three recovery operations use the same two artifacts:

| Operation | Artifacts | Purpose |
|-----------|-----------|---------|
| Full backup | Storage checkpoint and manifest | Creates a complete base image at a known WAL position. |
| Incremental backup | Committed WAL segments and manifest | Stores only changes since a parent backup. |
| Point-in-time restore | Full checkpoint and an incremental chain | Replays changes in order and stops at the requested HLC timestamp. |

A full backup is the root of a chain. Each incremental backup references its immediate parent and records a contiguous WAL range for every included partition.

```text
full checkpoint -> incremental -> incremental -> incremental
                    WAL delta      WAL delta      WAL delta
```

Kahuna validates the complete chain before restore. It rejects missing parents, cycles, a chain that does not begin with a full backup, unexpected full backups in the middle of a chain, and gaps between partition WAL ranges.

## Recoverable Window

Kahuna retains a sliding interval of WAL history for point-in-time recovery. The default recovery window is one hour and the maximum is six hours.

| Server option | Default | Valid range | Description |
|---------------|---------|-------------|-------------|
| `--pitr-window` | `3600` seconds | More than `0`, up to `21600` | How far back a restore target may be. Increasing it retains more WAL and consumes more disk. |
| `--base-snapshot-interval` | `1800` seconds | More than `0`, no greater than `--pitr-window` | Intended interval between base checkpoints. A shorter interval reduces WAL replay during restore but creates checkpoints more often. |
| `--pitr-backup-dir` | empty | Writable directory path used for backup manifests and artifacts. Kahuna creates it when needed. Backup APIs are disabled when this is empty. |
| `--pitr-backup-target` | `local` | Storage target name. The built-in `local` target uses `--pitr-backup-dir`; non-local targets require a host-registered backup storage provider. |
| `--pitr-backup-scratch-dir` | empty | Local staging directory required by backup targets that cannot receive storage-engine checkpoints directly. Size it for one whole full backup. |
| `--pitr-backup-cluster-id` | empty | String | Operator-assigned cluster identity stamped into backup manifests. Set the same value on every node to prevent chaining or restoring artifacts from another cluster. |
| `--pitr-backup-mac-key-file` | empty | File path | Secret key file used to authenticate manifests with HMAC-SHA-256. Set the same key file contents on every node and keep it outside the backup directory. |
| `--pitr-restore-root` | empty | Directory path | Server-owned root that remote restore targets must stay under. Setting it enables confined restore over REST/gRPC/client/CLI. |
| `--pitr-allow-unconfined-remote-restore` | `false` | Boolean | Allows remote restore without `--pitr-restore-root`. This is an administrative escape hatch and should not be enabled on shared nodes. |
| `--backup-restore-throttle-mbps` | `0` | `0` or more | Throughput cap for the bulk checkpoint copy during restore. `0` is unlimited. |

For example, retain four hours of recoverable WAL and plan hourly base checkpoints with:

```bash
kahuna-server \
  --pitr-window 14400 \
  --base-snapshot-interval 3600
```

Invalid values are normalized at startup: a non-positive PITR window becomes one hour, a window over six hours is capped at six hours, a non-positive snapshot interval becomes 30 minutes, and an interval longer than the window is reduced to the window.

Kahuna computes a protected WAL floor around:

```text
now - PitrWindow - BaseSnapshotInterval
```

Raft compaction must not remove entries at or above this floor. The extra snapshot interval keeps enough history to connect an available base checkpoint to the oldest recoverable timestamp.

:::note

`--base-snapshot-interval` participates in retention calculations. It does not schedule backups automatically. Trigger backups through the CLI, .NET client, REST, or gRPC API.

:::

## Create and Inspect Backups

Configure the server first:

```bash
kahuna-server \
  --pitr-backup-dir /var/lib/kahuna/backups \
  --pitr-backup-cluster-id prod-us-east-1 \
  --pitr-backup-mac-key-file /etc/kahuna/backup-mac.key \
  --pitr-restore-root /var/lib/kahuna/restores \
  --pitr-window 14400 \
  --base-snapshot-interval 3600
```

For production clusters, point every node at the same shared `--pitr-backup-dir`. Coordinated backups are accepted only by the node currently leading the meta partition. Because that coordinator can move over time, a node-local backup directory gives each node only a partial catalog.

`--pitr-backup-cluster-id` and `--pitr-backup-mac-key-file` should be identical on every node. The cluster ID prevents accidental cross-cluster chain resolution. The MAC key authenticates manifest identity, coverage, and digest metadata before restore.

The built-in backup target is `local`. The backup storage layer also supports host-registered targets for object storage or other artifact stores, but those providers live outside the default server package. When using a non-local target, configure `--pitr-backup-target` to the provider name and set `--pitr-backup-scratch-dir` if the target needs a local checkpoint staging area.

### Kahuna CLI

```bash
# Full backup
kahuna-cli -c "https://kahuna-1:8082" --backup-full

# Coordinated full backup, recommended for a multi-partition production snapshot
kahuna-cli -c "https://kahuna-1:8082" --backup-coordinated

# Incremental backup using the previous backup as its parent
kahuna-cli -c "https://kahuna-1:8082" \
  --backup-incremental \
  --parent-backup-id <backup-id>

# Inspect the local catalog and validate a chain
kahuna-cli -c "https://kahuna-1:8082" --list-backups
kahuna-cli -c "https://kahuna-1:8082" --backup-chain <leaf-backup-id>

# Reclaim backup disk or preview the GC plan
kahuna-cli -c "https://kahuna-1:8082" --backup-gc
kahuna-cli -c "https://kahuna-1:8082" --backup-gc --backup-gc-dry-run
```

Add `--format json` for machine-readable output. Interactive mode supports `backup full`, `backup coordinated`, and `list backups`.

An incremental request can fall back to a full backup when the WAL range needed for the parent has already been compacted. This is visible in the returned fields: `RequestedKind` remains `Incremental`, `ActualKind` is `Full`, and `SubstitutionReason` explains why Kahuna took a new base image instead.

### .NET Client

```csharp
using Kahuna.Client;
using Kahuna.Shared.Communication.Rest;

var client = new KahunaClient("https://kahuna-1:8082");

KahunaBackupInfo full = await client.TakeCoordinatedBackupAsync();
KahunaBackupInfo incremental =
    await client.TakeIncrementalBackupAsync(full.BackupId);

List<KahunaBackupInfo> backups = await client.ListBackupsAsync();
List<KahunaBackupInfo> chain =
    await client.GetBackupChainAsync(incremental.BackupId);

KahunaBackupGcResult preview =
    await client.RunBackupGarbageCollectionAsync(dryRun: true);
```

The client supports full, incremental, coordinated backups, catalog inspection, offline restore, and backup garbage collection over REST or gRPC communication.

## Restore to a New Directory

`RestoreAsync` and `--restore` copy the chain's full checkpoint into a target directory and replay incremental entries. A target time of `0` restores through the natural end of the selected chain. A positive target is the HLC physical component expressed as Unix epoch milliseconds.

Kahuna maps a positive `--target-time-ms` to the inclusive end of that millisecond. That prevents same-millisecond commits with a higher HLC counter from being accidentally excluded.

```bash
# Restore the complete chain
kahuna-cli -c "https://kahuna-1:8082" \
  --restore <leaf-backup-id> \
  --target-dir /var/lib/kahuna/restored

# Restore to a specific time
kahuna-cli -c "https://kahuna-1:8082" \
  --restore <leaf-backup-id> \
  --target-dir /var/lib/kahuna/restored-at-t \
  --target-time-ms 1781478000000
```

The target path is on the filesystem of the server node handling the request, not the machine running `kahuna-cli`. For remote restore, configure `--pitr-restore-root` and choose a target under that directory:

```bash
kahuna-server \
  --pitr-backup-dir /var/lib/kahuna/backups \
  --pitr-restore-root /var/lib/kahuna/restores
```

Kahuna rejects restore targets outside the restore root, targets that overlap the live storage path or backup directory, symlinked paths, and non-empty target directories. Restore builds the result in a private staging directory and publishes it with an atomic rename, so a cancelled or failed restore does not leave a partial directory at the final target path.

The equivalent .NET call is:

```csharp
KahunaRestoreResponse restored = await client.RestoreAsync(
    leafBackupId: incremental.BackupId,
    targetDir: "/var/lib/kahuna/restored",
    targetTimeMs: 0
);
```

Start a fresh node against the restored directory using the same storage adapter and storage revision as the backup source. Hot in-place restore of a running node is not supported.

The response includes `Outcome`, `EntriesApplied`, `LastAppliedPhysicalMs`, and the exact chain coverage bounds: `MinRecoverablePhysicalMs` and `MaxRecoverablePhysicalMs`. A restore target outside those chain coverage bounds is rejected even if it is still inside the wall-clock PITR window.

## Bootstrap a Joining Node

A new node can seed its persistence backend and WAL from a backup before joining an existing cluster. Normal Raft catch-up then transfers changes after the restore point.

```bash
kahuna-server \
  --join-existing \
  --initial-cluster https://kahuna-1:8082 https://kahuna-2:8082 \
  --pitr-backup-dir /var/lib/kahuna/backups \
  --pitr-bootstrap-from <leaf-backup-id> \
  --pitr-target-time-ms 1781478000000
```

Omit `--pitr-target-time-ms` or set it to `0` to bootstrap through the chain's natural end. The backup ID must resolve to a valid chain inside the configured PITR window.

## HTTP API

| Method | Path | Operation |
|--------|------|-----------|
| `POST` | `/v1/backups/full` | Create a full backup |
| `POST` | `/v1/backups/incremental` | Create an incremental backup with `{"parentBackupId":"<guid>"}` |
| `POST` | `/v1/backups/coordinated` | Create a coordinated full backup |
| `GET` | `/v1/backups` | List the local catalog |
| `GET` | `/v1/backups/{id}/chain` | Resolve and validate a chain |
| `POST` | `/v1/backups/validate-chain` | Validate the chain identified by `leafBackupId` |
| `POST` | `/v1/restore` | Restore a chain into `targetDir` through `targetTimeMs` |
| `POST` | `/v1/backups/gc` | Run backup garbage collection. Pass `?dryRun=true` to preview without deleting. |

The equivalent gRPC `Backups` service exposes `TakeFullBackup`, `TakeIncrementalBackup`, `TakeCoordinatedBackup`, `ListBackups`, `GetBackupChain`, `ValidateChain`, `Restore`, and `RunBackupGarbageCollection`. Backup endpoints return unavailable when `--pitr-backup-dir` is not configured on the target node.

Listing responses include `ClusterId` and `CoordinatorNode` when available. Use these fields to verify that a shared catalog contains backups produced by different coordinators. A listing that only shows the local node as coordinator is usually a node-local, partial view.

## Production Hardening

### Coordinator and Catalog Placement

`POST /v1/backups/coordinated` creates the cluster-wide backup. Kahuna accepts it only on the node that currently leads the meta partition. A request sent to another node is rejected with `NotBackupCoordinator`; retry against the current coordinator.

`ListBackups`, chain resolution, parent lookup, and restore read whatever is present in the receiving node's `BackupDir`. To make those operations node-independent, use shared durable storage for `BackupDir` across all nodes. With node-local directories, coordinated backups are scattered across whichever node was coordinator at the time they were taken.

### Confidentiality and Authenticity

Backup artifacts contain the physical storage checkpoint and committed WAL segments. Treat the backup directory as sensitive production data.

- Kahuna creates backup directories with restrictive permissions where the platform supports it.
- On startup, Kahuna refuses an unsafe backup root that is a symlink or group/world-writable on POSIX.
- `--pitr-backup-mac-key-file` enables HMAC-SHA-256 manifest authentication. Store the key outside `BackupDir`, restrict it to the server user, and deploy the same key contents to every node.
- Backup artifacts are not encrypted by Kahuna. Put `BackupDir` on an encrypted volume or an encrypted object-store mount when backups contain sensitive data.
- Error responses are sanitized and include an operation ID. Full paths and backend exception details stay in server logs under that ID.

Enabling a MAC key means older unsigned backups cannot be restored under that configuration. Re-take production backups after enabling the key.

### Topology Changes

A full or coordinated backup can fail with `TopologyChanged` if partition ownership, range metadata, or cluster membership changes while Kahuna is building the backup. Nothing is published in that case. Retry once the topology is stable.

### Replica Placement Coverage

With the default full-replication topology, any voter has every partition locally and can produce a backup covering the whole cluster.

With a positive [replication factor](/docs/replica-placement/), a node stores only the partitions it hosts. A backup taken on that node records both the complete cluster partition set and the subset actually covered by the artifact. Restore, chain validation, and PITR bootstrap reject a chain with `RestrictedCoverage` if the union of its artifacts does not cover every cluster partition.

Kahuna does not currently compose one cluster-wide backup from per-node artifacts. If whole-cluster backup and restore are required, keep full replication enabled or use a replication factor equal to the voter count.

### Root Safety

Restore target safety is enforced separately from backup-root safety:

- `BackupDir` must not be a symlink or broadly writable.
- Remote restore targets should be confined under `--pitr-restore-root`.
- Restore targets cannot overlap the live storage path or backup directory.
- Symlinked restore paths and non-empty target directories are rejected.

These checks make backup and restore fail closed before Kahuna writes or trusts production artifacts.

## Full Backups

A full backup performs these operations in order for active partitions:

1. Record the last committed WAL position covered by the backup.
2. Wait for the apply barrier so every covered committed write has reached the in-memory state and persistence queue.
3. Flush pending persistent writes to the materialized storage backend.
4. Create a storage-engine checkpoint.
5. Verify artifact sizes and SHA-256 checksums.
6. Write a manifest containing the backup ID, creation time, partition ranges, checksums, sizes, and optional cluster snapshot timestamp.

Recording the committed position before the flush is important. It guarantees the checkpoint contains at least every mutation promised by the manifest, including mutations that were committed but still waiting in the background persistence queue.

If Kahuna cannot prove that the checkpoint exactly covers the requested cut, the full backup fails closed with `ExactCheckpointUnavailable` and publishes no manifest. This includes an apply barrier timeout, a backend flush failure, a cut below the durable pruned-history floor, or a no-revision key modified after the requested cut.

Checkpoint behavior depends on the storage adapter:

- RocksDB uses its checkpoint facility, which can hard-link existing database files where the filesystem permits it.
- SQLite creates a consistent copy of its sharded database files. Writes to a shard can pause while that shard is copied.
- The memory backend serializes key/value and lock state to checkpoint files. It is useful for testing, not durable production recovery.

Checkpoint directories and manifests are created through temporary paths and moved into place, preventing an interrupted write from appearing as a complete artifact. Artifact verification rejects missing files, unexpected extra files, size mismatches, checksum mismatches, unsupported legacy manifests, unsafe relative paths, and symlinks or reparse points.

## Incremental Backups

An incremental backup reads committed WAL entries after its parent's final index and writes one segment per partition. It pages through the WAL instead of loading an unbounded log into memory.

Incremental backups are proportional to the write volume since the parent, not the total dataset size. However, every required WAL entry must still be available. If compaction has advanced beyond the incremental's starting index, Kahuna takes a new full backup instead and reports the substitution in `RequestedKind`, `ActualKind`, and `SubstitutionReason`.

Keep the checkpoint, every incremental artifact, and every manifest in the chain together. A missing artifact or manifest makes later descendants unusable for restore.

## Point-in-Time Restore

To reconstruct state at timestamp `T`, the restore process:

1. Selects a `T` covered by the full checkpoint and incremental chain.
2. Resolves and validates the selected backup chain.
3. Opens the root full checkpoint in the destination backend.
4. Replays incremental WAL segments in partition order.
5. Applies committed key/value entries whose transaction commit HLC is less than or equal to `T`.

Restore writes are idempotent upserts keyed by key and revision. An interrupted incremental replay can be restarted without creating duplicate logical revisions.

Only committed WAL entries are included. Prepared but uncommitted transaction intents are absent, so an unfinished transaction does not become visible after restore.

Restore uses the commit HLC carried by the key/value payload, not the per-partition WAL append time, as the PITR cut axis. All participants of a committed distributed transaction share that commit HLC, so restore includes or excludes the transaction as one unit instead of cutting through different partitions.

Segment replay streams one record at a time and writes batches of key/value rows to the destination backend. It verifies each incremental segment immediately before replay and stages the exact bytes that will be consumed, reducing verify-then-use races.

Keys written with no revisions cannot be rolled back across overwritten values. If such a key changed after the requested cut, Kahuna refuses an exact backup or restore path rather than silently over-including the newer value. Use no-revision writes for cache-like keys that do not require PITR.

## Coordinated Cluster Snapshots

Each Raft partition has its own WAL position, so a log index cannot identify one cluster-wide moment. Coordinated backups instead select one HLC timestamp and cap every partition at that timestamp.

The coordinator chooses a timestamp strictly before the earliest transaction currently preparing across the scanned partitions. This prevents a transaction that is actively committing from being split by the snapshot boundary.

Coordinated backup chooses a safe cluster timestamp. During restore, Kahuna cuts key/value replay on the shared transaction commit HLC carried in each payload, so a committed distributed transaction is replayed whole or skipped whole.

## Backup Retention and Garbage Collection

Kahuna has two backup cleanup mechanisms:

| Mechanism | What it deletes | Default |
|-----------|-----------------|---------|
| Orphan sweep | Leftover temporary, staging, quarantine, merge, or artifact directories that no valid manifest owns. | Always enabled. |
| Retention | Valid backup chains outside configured count, age, or byte limits. | Disabled until at least one retention bound is set. |

Retention is chain-aware. Kahuna keeps or deletes a full backup and its incrementals as a unit, so no retained incremental is left without its parent chain. The newest chain is always kept, even if it alone exceeds the byte budget.

Configure retention with:

| Server option | Default | Description |
|---------------|---------|-------------|
| `--backup-retention-max-chains` | `0` | Keep at most this many most-recent backup chains. `0` is unbounded. |
| `--backup-retention-max-age` | `0` seconds | Delete chains whose newest backup is older than this. `0` is unbounded. |
| `--backup-retention-max-bytes` | `0` | Keep the most-recent chains whose artifact bytes fit this budget. `0` is unbounded. |
| `--backup-gc-interval` | `3600` seconds | Periodic GC cadence. `0` disables the periodic pass, but inline GC still runs after backups. |

GC runs inline after backup creation and periodically in the background. Use `--backup-gc --backup-gc-dry-run` to inspect the plan before deleting anything.

GC removes manifests before artifacts and deletes descendants before ancestors. If a process stops mid-delete, the remaining artifact directory becomes an orphan and the next sweep can reclaim it. Symlinked top-level artifact entries are unlinked, not followed.

The result reports `RetentionDeletions`, `OrphanReclamations`, `BytesReclaimed`, and whether the pass was actually `Applied`.

## Outcomes and Observability

Backup and restore failures expose stable outcome names so automation does not need to match exception text:

| Outcome | Meaning |
|---------|---------|
| `NotConfigured` | Backup APIs are disabled because no backup directory is configured. |
| `ParentMissing` | The requested incremental parent does not exist. |
| `NeedsFull` | An incremental cannot be produced from the requested parent. |
| `CorruptChain` | Parent links, ordering, or partition ranges are invalid. |
| `CorruptArtifact` | Files are missing, extra, truncated, modified, duplicated, or unsafe. |
| `TargetConflict` | Restore target already exists, escapes the restore root, or overlaps a protected path. |
| `TargetOutsideCoverage` | Requested restore time is outside the selected chain coverage. |
| `RetryableLeadershipLoss` | Leadership changed during the operation; retry on the current leader. |
| `ExactCheckpointUnavailable` | Kahuna cannot prove the base checkpoint exactly represents the requested cut. |
| `UnsupportedFormat` | A legacy or unsupported manifest was found. |
| `TopologyChanged` | Partition topology or membership changed during backup. Retry after the cluster is stable. |
| `NotBackupCoordinator` | The node is not the current coordinated-backup owner. Retry against the meta-partition leader. |
| `InsecureRoot` | The configured backup or restore root is unsafe. Fix permissions or path layout before retrying. |
| `RestrictedCoverage` | The selected chain does not cover every cluster partition, commonly because it was taken on a node that hosted only some partitions under replica placement. |

Metrics are emitted on the `Kahuna` meter. Backup and restore operations report operation counts, failures, bytes, duration, and restored entry counts. Backup GC reports runs, orphan reclamations, retention deletions, and reclaimed bytes.

## Operational Planning

- Estimate retained WAL storage as approximately `PitrWindow * WAL write rate`, plus overlapping base checkpoints.
- Use a shorter base snapshot interval when restore speed is more important than checkpoint overhead.
- Archive full backups externally when recovery beyond six hours is required. The live PITR window is intentionally bounded.
- Store backup artifacts on durable storage separate from the node's live data directories.
- Treat the manifest catalog and its referenced artifacts as one recovery set.
- Validate the chain and artifact checksums before modifying a destination data directory. Kahuna does this automatically before restore, but external archivers should preserve manifests and artifact files together.
- Perform restores offline. Restoring data does not add the restored node to cluster membership.
- Use shared durable storage for `--pitr-backup-dir` when coordinated backups may be requested from different coordinator nodes over time.
- Set `--pitr-backup-cluster-id` and `--pitr-backup-mac-key-file` consistently on every production node.
- Configure `--pitr-restore-root` on any node that accepts remote restore requests.
- Use `--backup-restore-throttle-mbps` when restore I/O competes with foreground traffic.
- Plan backup coverage before enabling a positive replication factor. A one-node backup may no longer cover the whole cluster.

A restored node can seed a later cluster join, but membership and Raft catch-up are separate operations. If its restore point is still within retained history, replicas can transfer only the remaining log. Otherwise, normal cluster recovery may require a complete state transfer.
