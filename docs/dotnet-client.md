
# Client for .NET

Kahuna provides a .NET client for distributed key/value operations, locks, sequencers, transactions, backups, and point-in-time restore. The client hides most routing and coordination details while still exposing the controls needed for consistency, durability, and retry behavior. Documentation and samples for the client can be found in the `docs/` folder or on our [GitHub repository](https://github.com/kahunakv/kahuna).

## Client Installation

Kahuna Client for .NET is available as a NuGet package. You can install it via the .NET CLI:

```bash
dotnet add package Kahuna.Client
```

Or via the NuGet Package Manager:

```powershell
Install-Package Kahuna.Client
```

## Locks: Usage & Examples

### Single attempt to acquire a lock

Below is a basic example to demonstrate how to use Kahuna Distributed Locks in a C# project:

```csharp
using Kahuna.Client;

// Create a Kahuna client (it can be a global instance)
var client = new KahunaClient("https://localhost:8082");

// ...

public async Task UpdateBalance(KahunaClient client, string userId)
{
    // try to lock on a resource using a keyName composed of a prefix and the user's id,
    // if acquired then automatically release the lock after 5 seconds (if not extended),
    // it will give up immediately if the lock is not available,
    // if the lock is acquired it will prevent the same user from changing the same data concurrently

    await using KahunaLock myLock = await client.GetOrCreateLock(
        "balance-" + userId,
        TimeSpan.FromSeconds(5)
    );

    if (myLock.IsAcquired)
    {
        Console.WriteLine("Lock acquired!");

        // implement exclusive logic here
    }
    else
    {
        Console.WriteLine("Someone else has the lock!");
    }

    // myLock is automatically released after leaving the method
}
```

### Multiple attempts to acquire a lock

The following example shows how to make multiple attempts to acquire a lock (lease) for 10 seconds, retrying every 150 ms.

Why Frequent Retries? Given that inventory updates are very short operations (typically milliseconds to a few seconds),
each update releases the lock quickly. Still, with a massive volume of concurrent purchase attempts, the lock is rapidly cycled through many clients.
As a result, individual servers might find that the lock is released often, but due to high contention,
they need to retry multiple times until one of them succeeds.

```csharp
using Kahuna.Client;

public async Task UpdateBalance(KahunaClient client, string userId)
{
    // try to lock on a resource using a keyName composed of a prefix (balance) and the user's id,
    // if acquired then automatically release the lock after 5 seconds or when leaving the method (if not extended),
    // if not acquired retry to acquire the lock every 150 milliseconds for 10 seconds,
    // it will give up after 10 seconds if the lock is not available,
    // if the lock is acquired it will prevent the same user from changing the balance concurrently

    await using KahunaLock myLock = await client.GetOrCreateLock(
        "balance-" + userId,
        expiry: TimeSpan.FromSeconds(5),
        wait: TimeSpan.FromSeconds(10),
        retry: TimeSpan.FromMilliseconds(150)
    );

    if (myLock.IsAcquired)
    {
        Console.WriteLine("Lock acquired!");

        // implement exclusive logic here
    }
    else
    {
        Console.WriteLine("Someone else has the lock!");
    }

    // myLock is automatically released after leaving the method
}
```

### Fencing Tokens

Whenever possible, it is also important to use the fencing tokens.
Even if a client thinks it holds the lock post-lease expiration, fencing tokens prevent stale writes.
In this example, the fencing token is used to perform optimistic locking:

```csharp
using Kahuna.Client;

public async Task IncreaseBalance(KahunaClient client, string userId, long amount)
{
    // try to lock on a resource holding the lease for 5 seconds
    // and prevent stale clients from modifying data after losing their lock.

    await using KahunaLock myLock = await client.GetOrCreateLock(
        "balance-" + userId,
        expiry: TimeSpan.FromSeconds(5)
    );

    if (myLock.IsAcquired)
    {
        Console.WriteLine("Lock acquired!");

        BalanceAccount account = await db.GetBalance(userId);

        if (account.FencingToken > myLock.FencingToken)
        {
            // Write rejected: Stale fencing token

            Console.WriteLine("Someone else had the lock!");
            return;
        }

        // Write successful: New balance saved with new fencing token

        account.Balance += amount;
        account.FencingToken = myLock.FencingToken;

        await db.Save(account);
    }
    else
    {
        Console.WriteLine("Someone else has the lock!");
    }

    // myLock is automatically released after leaving the method
}
```

### Periodically extend a lock

At times, it is useful to periodically extend the lock's expiration time while a client holds it, for example, in a leader election scenario.
As long as the leader node is alive and healthy, it can extend the lock duration to signal that it can continue acting as the leader:

```csharp
using Kahuna.Client;

public async Task TryChooseLeader(KahunaClient client, string groupId)
{
    await using KahunaLock myLock = await client.GetOrCreateLock(
        "group-leader-" + groupId,
        expiry: TimeSpan.FromSeconds(10)
    );

    if (!myLock.IsAcquired)
    {
        Console.WriteLine("Lock not acquired!");
        return;
    }

    long acquireFencingToken = myLock.FencingToken;

    while (true)
    {
        (bool isExtended, long fencingToken) = await myLock.TryExtend(TimeSpan.FromSeconds(10));
        if (!isExtended)
        {
            Console.WriteLine("Lock extension failed!");
            break;
        }

        if (fencingToken != acquireFencingToken)
        {
            Console.WriteLine("Lock fencing token changed! Someone else took the lock");
            break;
        }

        // wait 5 seconds to extend the lock
        await Task.Delay(5000);
    }
}
```

### Retrieve information about a lock

You can also retrieve information about a lock, such as the current lock's owner and remaining time for the lock to expire:

```csharp
using Kahuna.Client;

public async Task TryChooseLeader(KahunaClient client, string groupId)
{
    await using KahunaLock myLock = await client.GetOrCreateLock(
        "group-leader-" + groupId,
        expiry: TimeSpan.FromSeconds(5)
    );

    if (!myLock.IsAcquired)
    {
        Console.WriteLine("Lock not acquired!");

        var lockInfo = await myLock.GetInfo();

        Console.WriteLine($"Lock owner: {lockInfo.Owner}");
        Console.WriteLine($"Expires: {lockInfo.Expires}");
    }
}
```

### Configure a pool of endpoints

If you want to configure a pool of Kahuna endpoints belonging to the same cluster so that traffic is distributed in a round-robin manner:

```csharp
using Kahuna.Client;

// Create a Kahuna client with a pool of endpoints
var client = new KahunaClient([
    "https://localhost:8082",
    "https://localhost:8084",
    "https://localhost:8086"
]);

// ...
```

Using a pool of reachable endpoints lets the client avoid a load balancer and also enables leader-aware routing. With the default `KahunaRoutingMode.Auto`, a client configured with several endpoints learns route hints from responses and sends later point key/value, lock, and sequence operations directly to the node that owns the resource.

Route hints are advisory. If leadership or placement changes, the receiving server re-resolves the resource and forwards or returns retryable state as needed.

See [Client Leader-Aware Routing](/docs/client-routing/) for routing modes, endpoint mapping, server advertisement flags, metadata mode, and metrics.

### Configure client options

Pass `KahunaOptions` when you need to tune transport behavior:

```csharp
using Kahuna.Client;
using Kahuna.Client.Routing;

var client = new KahunaClient(
    [
        "https://localhost:8082",
        "https://localhost:8084",
        "https://localhost:8086"
    ],
    options: new KahunaOptions
    {
        GrpcChannelPoolSize = 4,
        DefaultOperationTimeout = TimeSpan.FromSeconds(10),
        BatchCoalescingThreshold = 10,
        BatchCoalescingDelayMs = 2,
        Routing = KahunaRoutingMode.Metadata,
        RouteCacheCapacity = 8192,
        RoutingEndpointMap = new Dictionary<string, string>
        {
            ["https://172.30.0.2:8082"] = "https://localhost:8082"
        }
    }
);
```

`GrpcChannelPoolSize` controls how many HTTP/2 channels the client opens per endpoint. The default is `2`. Raise it when one client process is driving high concurrency and a single endpoint needs more parallel streams. Each extra channel is an additional connection, so keep it small unless measurement shows the client is the bottleneck.

Routing options control how the client chooses the first node for an operation. `Learned` reuses route hints from previous responses. `Metadata` also reads the cluster routing map so new resources can go directly to their owner. `RoutingEndpointMap` is needed when servers advertise internal addresses but the application dials mapped or public addresses.

For local HTTPS endpoints with a development certificate, set `AllowInsecureCertificateValidation = true`. For production certificate pinning, set `TrustedServerCertificateThumbprints` instead.

Key `KahunaOptions` fields:

| Option | Default | Purpose |
|--------|---------|---------|
| `UpgradeUrls` | `false` | Let the client update lock-handle affinity from the server endpoint that served a lock response. |
| `Routing` | `Auto` | Select endpoint routing mode: automatic, round-robin, learned hints, or metadata. |
| `RouteCacheCapacity` | `4096` | Maximum learned routes kept by the client. |
| `RouteHintLifetime` | `60 seconds` | How long a learned route can be reused before it must be observed again. |
| `RoutingEndpointCooldown` | `5 seconds` | How long an endpoint is skipped after a transport failure. |
| `RoutingMetadataLifetime` | `60 seconds` | How long metadata-mode routing maps are cached. |
| `RoutingEndpointMap` | `null` | Maps server-advertised endpoints to URLs this client actually dials. |
| `AllowUnlistedRoutingEndpoints` | `false` | Allows dialing advertised endpoints that were not configured or mapped. |
| `MinConnections` | `1` | Lower bound for connection-related client setup. |
| `MaxConnections` | `1` | Upper bound for connection-related client setup. |
| `DefaultOperationTimeout` | `30 seconds` | Timeout used when a call has no cancellation token deadline. |
| `GrpcChannelPoolSize` | `2` | gRPC channels opened per configured endpoint. |
| `BatchCoalescingThreshold` | `10` | Minimum batch size before immediate dispatch; smaller batches may wait briefly. |
| `BatchCoalescingDelayMs` | `2` | Maximum batch coalescing wait in milliseconds. |
| `AllowInsecureCertificateValidation` | `false` | Skip TLS server certificate validation for local or test environments. |
| `TrustedServerCertificateThumbprints` | empty | SHA-256 certificate thumbprints accepted for production pinning. |

## Cluster Membership

`GetClusterMembership()` returns the current roster, membership version, the contacted node's local role, and whether that node has completed cluster initialization:

```csharp
KahunaClusterMembershipResponse membership =
    await client.GetClusterMembership();

Console.WriteLine($"Initialized={membership.Initialized}");
Console.WriteLine($"LocalRole={membership.LocalRole}");
```

Use the server readiness endpoint `GET /v1/cluster/health` for load balancer and orchestrator probes. Membership can be available before a node is initialized enough to serve key/value traffic.

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

## Snapshot Reads

The .NET client supports **as-of snapshot reads** directly on top-level client methods through a `snapshotMs` parameter.

For point reads:

```csharp
using Kahuna.Client;
using Kahuna.Shared.KeyValue;

var client = new KahunaClient("https://node1:2071");

KahunaKeyValue latest = await client.GetKeyValue(
    "users/000100",
    KeyValueDurability.Persistent
);

KahunaKeyValue sameSnapshot = await client.GetKeyValue(
    "users/000100",
    KeyValueDurability.Persistent,
    snapshotMs: latest.LastModified
);
```

`LastModified` is the Unix-epoch millisecond timestamp at which that revision was committed. It can be reused as a snapshot anchor for later reads.

The same snapshot parameter is also available on:

- `ExistsKeyValue(...)`
- `GetByBucket(...)`
- `ScanAllByPrefix(...)`
- `GetByRange(...)`
- `ScanByRange(...)`

When a historical view needs to stay readable for a long time, acquire a [snapshot hold](/docs/distributed-keyvalue-store/snapshot-holds/) so persistent revision cleanup does not prune the versions needed by that timestamp.

```csharp
using Kommander.Time;

long snapshotMs = latest.LastModified;
HLCTimestamp timestamp = new(0, snapshotMs, uint.MaxValue);

(KeyValueResponseType type, string holdId, HLCTimestamp leaseExpiry) =
    await client.AcquireSnapshotHold(
        holderId: "analytics-branch",
        timestamp,
        leaseMs: 300_000
    );

if (type != KeyValueResponseType.Set)
    throw new InvalidOperationException($"Could not acquire snapshot hold: {type}");

try
{
    KahunaKeyValue historical = await client.GetKeyValue(
        "users/000100",
        KeyValueDurability.Persistent,
        snapshotMs: snapshotMs
    );
}
finally
{
    await client.ReleaseSnapshotHold(holdId);
}
```

## No-Revision Writes

For cache-style keys that only need the latest value, the client can set a key without archiving a historical revision entry:

```csharp
using Kahuna.Client;
using Kahuna.Shared.KeyValue;

var client = new KahunaClient("https://node1:2071");

KahunaKeyValue result = await client.SetKeyValueNoRevision(
    "cache/user/1001",
    System.Text.Encoding.UTF8.GetBytes("""{"name":"Ada"}"""),
    expiryTime: 60000,
    durability: KeyValueDurability.Persistent
);
```

The current revision still advances and latest reads still work. What changes is the historical record: the revision created by this write is not available through `GetKeyValueRevision(...)` or snapshot reads that need that archived version.

You can also use the flag directly when you need to compose options:

```csharp
KahunaKeyValue refreshed = await client.SetKeyValue(
    "cache/session/abc",
    "active",
    expiryTime: 300000,
    flags: KeyValueFlags.SetIfNotExists | KeyValueFlags.SetNoRevision,
    durability: KeyValueDurability.Persistent
);
```

Use no-revision writes to reduce memory and disk write amplification when Kahuna is acting as a pure distributed key/value cache. Use normal writes for audit history, `GetKeyValueRevision(...)`, and point-in-time reads.

## Null and Empty Values

Kahuna preserves the difference between a key with no payload and a key whose payload is zero bytes. In .NET, pass `null` for no payload and `Array.Empty<byte>()` for an empty byte array:

```csharp
await client.SetKeyValue("profile/empty-payload", null);
await client.SetKeyValue("profile/zero-bytes", Array.Empty<byte>());
```

REST encodes that distinction as JSON `null` versus an empty base64 string. gRPC uses bytes-field presence. This matters for compare-value operations and for applications that use a present-but-empty payload as a meaningful value.

## Ordered Range Reads

For ordered key spaces such as `users/000001` through `users/999999`, you can now use the top-level client directly to read a bounded ordered slice:

```csharp
using Kahuna.Client;
using Kahuna.Shared.KeyValue;

var client = new KahunaClient([
    "https://node1:2071",
    "https://node2:2071",
    "https://node3:2071"
]);

List<KahunaKeyValue> page = await client.GetByRange(
    prefix: "users",
    startKey: "users/000100",
    startInclusive: true,
    endKey: "users/000200",
    endInclusive: false,
    limit: 100,
    durability: KeyValueDurability.Persistent
);

foreach (KahunaKeyValue item in page)
    Console.WriteLine($"{item.Key} -> {item.ValueAsString()}");
```

If you need transactional locking or interactive read/write behavior around the range read, use a transaction session:

```csharp
using System.Text;
using Kahuna.Client;
using Kahuna.Shared.KeyValue;

var client = new KahunaClient([
    "https://node1:2071",
    "https://node2:2071",
    "https://node3:2071"
]);

await using KahunaTransactionSession session = await client.StartTransactionSession(
    new KahunaTransactionOptions
    {
        Locking = KeyValueTransactionLocking.Optimistic,
        Timeout = 5000
    }
);

KeyValueGetByRangePageResult page = await session.GetByRange(
    prefix: "users",
    startKey: "users/000100",
    startInclusive: true,
    endKey: "users/000200",
    endInclusive: false,
    limit: 100,
    durability: KeyValueDurability.Persistent
);

foreach (KeyValueGetByBucketItem item in page.Items)
    Console.WriteLine($"{item.Key} -> {Encoding.UTF8.GetString(item.Value)}");
```

This is the right read pattern when a key space is modeled as an ordered range instead of a single bucket. See [Key-Range Sharding](/docs/distributed-keyvalue-store/key-range-sharding/) for the routing model and trade-offs.

For top-level client reads, `snapshotMs` pins the read to one historical snapshot. For transaction-session range reads, `readTimestamp` does the same thing at the session API boundary.

When `readTimestamp` is set, the range read behaves as a **historical snapshot**. It does not switch into read-your-own-writes mode just because the session has a transaction ID. If a key existed at `T` and was updated later, the read returns the version visible at `T`; keys inserted after `T` stay hidden.

For exact archived revisions, the client still exposes `GetKeyValueRevision(...)`. Use that when you know the precise revision number; use `snapshotMs` when you want the value visible at a specific historical time.

## Streaming Range Reads

When you want to stream a larger ordered range instead of materializing one bounded page, use `ScanByRange(...)`:

```csharp
await foreach (KahunaKeyValue item in client.ScanByRange(
    prefix: "users",
    startKey: "users/000100",
    startInclusive: true,
    endKey: "users/001000",
    endInclusive: false,
    pageSize: 128,
    durability: KeyValueDurability.Persistent,
    snapshotMs: 1718392012345
))
{
    Console.WriteLine($"{item.Key} -> {item.ValueAsString()}");
}
```

This keeps fetching server-side pages behind the async sequence while preserving one historical snapshot when `snapshotMs` is non-zero. Large range scans can read keys that currently live only on disk without forcing every scanned key back into the in-memory cache.

## Batch Key/Value Operations

The client also exposes batch methods for common key/value work:

- `SetManyKeyValues(...)`
- `DeleteManyKeyValues(...)`
- `GetManyKeyValues(...)`
- `ExistsManyKeyValues(...)`

Example:

```csharp
using Kahuna.Client;
using Kahuna.Shared.KeyValue;

List<KahunaKeyValue> setResults = await client.SetManyKeyValues([
    new()
    {
        Key = "services/auth",
        Value = System.Text.Encoding.UTF8.GetBytes("node1"),
        ExpiresMs = 30000,
        Flags = KeyValueFlags.SetNoRevision,
        Durability = KeyValueDurability.Persistent
    },
    new()
    {
        Key = "services/payments",
        Value = System.Text.Encoding.UTF8.GetBytes("node2"),
        ExpiresMs = 30000,
        Flags = KeyValueFlags.SetNoRevision,
        Durability = KeyValueDurability.Persistent
    }
]);

List<KahunaKeyValue> getResults = await client.GetManyKeyValues([
    new() { Key = "services/auth", Durability = KeyValueDurability.Persistent },
    new() { Key = "services/payments", Durability = KeyValueDurability.Persistent }
]);
```

Request item notes:

- `KahunaSetKeyValueRequestItem` supports `Key`, `Value`, `ExpiresMs`, `Flags`, `CompareValue`, `CompareRevision`, and `Durability`
- `KahunaDeleteKeyValueRequestItem` supports `Key` and `Durability`
- `KahunaGetManyKeyValuesRequestItem` supports `Key`, optional `Revision`, and `Durability`

`DeleteKeyValue(...)` and `DeleteManyKeyValues(...)` return the tombstone revision created by the delete. For a key at revision `0`, a successful delete returns revision `1`, and a later set returns revision `2`.

Set `Flags = KeyValueFlags.SetNoRevision` for batch cache writes where old values are not needed. Combine it with conditional flags when the write should still be guarded by existence, value, or revision checks.

Persistent batch writes also benefit from [partition write coalescing](/docs/architecture/partition-write-coalescing/). Kahuna can combine direct writes for the same Raft partition into fewer Raft proposals, even when they come from different client requests. This improves bursts where keys share a bucket or key-space. It does not make a batch atomic; use a transaction when all items must commit or roll back together.

## Key-Range Administration

For ordered key spaces, the client exposes key-range administration over both REST and gRPC transports.

```csharp
KahunaRegisterKeyRangeResponse registered =
    await client.RegisterKeyRange("users");

Console.WriteLine($"{registered.Status} {registered.RoutingMode}");
```

Registration changes routing mode on the node that receives the call and seeds the replicated whole-space descriptor if needed. In a multi-node cluster, register the key space on every node. The CLI does this fan-out automatically when you pass multiple endpoints.

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

## Transport Notes

Some client features currently require the gRPC transport:

- `GetManyKeyValues(...)` is not available over the REST transport
- `ExistsManyKeyValues(...)` is not available over the REST transport

If you call those APIs through the REST transport, the client throws `NotSupportedException`.

### Specify durability type

You can also specify the desired durability type when acquiring a lock:

```csharp
using Kahuna.Client;

public async Task UpdateBalance(KahunaClient client, string userId)
{
    // acquire a lock with persistent durability, ensuring that the lock state is
    // replicated across all nodes in the Kahuna cluster
    // in case of failure or network partition, the lock state is guaranteed to be durable

    await using KahunaLock myLock = await client.GetOrCreateLock(
        "balance-" + userId,
        TimeSpan.FromSeconds(300), // lock for 5 mins
        durability: LockDurability.Persistent
    );

    if (myLock.IsAcquired)
    {
        Console.WriteLine("Lock acquired with strong consistency!");

        // implement exclusive logic here
    }
    else
    {
        Console.WriteLine("Someone else has the lock!");
    }

    // myLock is automatically released after leaving the method
}
```

Learn more about the supported [durabilities](/docs/architecture/durability-levels.md).

## Sequences: Usage & Examples

The .NET client exposes Kahuna's distributed sequencer for named, monotonically increasing values.

```csharp
using Kahuna.Client;
using Kahuna.Shared.Sequences;

var client = new KahunaClient("https://localhost:8082");

KahunaSequence sequence = await client.CreateSequence(
    "orders",
    initialValue: 0,
    increment: 1,
    maxValue: null,
    durability: SequenceDurability.Persistent
);

long orderId = await client.NextSequenceValue(
    "orders",
    idempotencyKey: "create-order-123"
);

KahunaSequenceRange range = await client.ReserveSequenceRange(
    "orders",
    count: 100,
    idempotencyKey: "import-batch-456"
);

KahunaSequence? current = await client.GetSequence("orders");
bool deleted = await client.DeleteSequence("orders");
```

Use idempotency keys when retrying allocation requests after a timeout. If the original request was committed, retrying with the same idempotency key returns the original allocation instead of consuming a new value.

## Key/Values: Usage & Examples

## Basic Usage

...

## Transactions

Using the **C# client**, developers can execute both **Kahuna Scripts** and **interactive transactions**, depending on what best suits their use case.

This flexibility allows for choosing between:

- **Kahuna Scripts** for atomic, server-side logic with minimal latency.
- **Interactive transactions** for full control using C# code and external libraries.

Developers can switch between both approaches as needed to balance performance, maintainability, and complexity.

### Scripts

Kahuna Scripts can be loaded from their string representation and executed in C# like this:

```csharp
const string script = """
let inventory_key = get @inventory_key
let requested_amount = get @requested_amount

let inventory = to_int(inventory_key)
let requested = to_int(requested_amount)

if current >= requested then
  set inventory_key inventory - requested
  return 1
else
  return 0
end
""";

var result = await client.ExecuteKeyValueTransactionScript(
    script,
    null, 
    [
        new() { Key = "@inventory_key", Value = userInventoryKey },
        new() { Key = "@requested_amount", Value = "100" }        
    ]
);

Console.WriteLine("Result={0}", result.FirstValueAsString);

```

The recommended way to execute scripts is to pass all dynamic values as parameters, rather than embedding them directly in the script. This allows the server to reuse the execution plan across different calls with different inputs, improving performance and preventing security issues such as script injection.

Scripts can also carry an admission priority. Priority matters only when the server has enabled transaction admission ceilings; otherwise it is recorded for metrics and the script starts immediately.

```csharp
var result = await client.ExecuteKeyValueTransactionScript(
    script,
    hash: null,
    parameters: parameters,
    priority: TransactionPriority.Background
);
```

If you need a per-script admission wait, set it in the script's `begin (...)` options:

```kahuna
begin (priority="high", admissionWait=2000, timeout=10000)
  set `orders/42/status` "processing"
  commit
end
```

Script results expose `Values`, where each item carries the key, value, revision, expiration, and last-modified timestamp returned by the script. `FirstValue`, `FirstValueAsString`, and `FirstRevision` are convenience accessors for the first returned item. REST and gRPC now return the same per-value result shape.

Avoid this:

```csharp
await client.ExecuteKeyValueTransactionScript("SET " + key + " " + value);
```

Prefer this:

```csharp
await client.ExecuteKeyValueTransactionScript(
    "SET @key @value", 
    null, 
    [
        new() { Key = "@key", Value = key },
        new() { Key = "@value", Value = value }        
    ]
);
```

This pattern leads to safer, faster, and more maintainable use of Kahuna Scripts.

Another good practice is to load scripts during an initialization process so they can be reused many times later. This reduces memory usage and helps the server reuse the execution plan, improving performance and lowering overhead:

```csharp
public class SessionChecker
{
    private readonly KahunaTransactionScript kahunaScript;
    
    public SessionChecker(KahunaClient client)
    {
        const string myScript = """
        let exists_key = exists @session_key
        if exists_key then
         extend @session_key @ttl_in_seconds
         return 1
        end
        return 0
        """;
        
        kahunaScript = client.LoadTransactionScript(myScript);
    }
    
    public async Task<bool> CheckSession(string sessionKey, string ttlInSeconds)
    {
        var result = await kahunaScript.Run([
            new() { Key = sessionKey, Value = ttlInSeconds }
        ]);

        var extended = result.FirstValueAsString ?? "0";

        return extended == "1";
    }
}
```

By avoiding re-parsing and re-planning on every call, this approach makes script execution more efficient, especially in high-throughput scenarios. It also makes code easier to maintain by separating logic from runtime logic injection.

Compiled scripts expose the same priority control:

```csharp
var result = await kahunaScript.Run(
    TransactionPriority.High,
    [
        new() { Key = "@session_key", Value = sessionKey },
        new() { Key = "@ttl_in_seconds", Value = ttlInSeconds }
    ]
);
```

### Interactive Transactions

With interactive transactions, developers can execute transactional flows directly from C# without the need to use Kahuna Scripts.

This gives programmers full control over the transaction logic using familiar language constructs, while still benefiting from Kahuna’s consistency guarantees, distributed coordination, and support for multi-key operations.

Interactive sessions are available through the gRPC transport. The REST transport supports ordinary key/value operations, but it does not expose session start, commit, or rollback.

Kahuna’s server-side transaction coordinator owns the transaction working set. The client keeps a session handle and sends operations through it, but commit and rollback do not rely on the client rebuilding a final list of touched keys. As each operation succeeds, the coordinator records confirmed reads, writes, locks, and cleanup state.

That means the client code can stay focused on business logic:

```csharp
using Kahuna.Client;
using Kahuna.Shared.KeyValue;

await using KahunaTransactionSession session = await client.StartTransactionSession(
    new KahunaTransactionOptions
    {
        Locking = KeyValueTransactionLocking.Optimistic,
        Timeout = 5000
    }
);

KahunaKeyValue balance1 = await session.GetKeyValue(userA);
KahunaKeyValue balance2 = await session.GetKeyValue(userB);

if (balance1.ValueAsLong() >= 50)
{
    await session.SetKeyValue(userA, balance1.ValueAsLong() - 50);
    await session.SetKeyValue(userB, balance2.ValueAsLong() + 50);
}

await session.Commit();
```

Call `Commit` explicitly when the work should become visible. Disposing a still-pending session rolls it back, so `await using` is a safety net for exceptions and early returns. `AutoCommit` is carried on the transaction options for protocol compatibility, but interactive sessions still require an explicit `Commit`.

The session exposes `Status`, `TransactionId`, `Handle`, and `RecordAnchorKey` for diagnostics and advanced integrations. Most applications should keep using the session object and let the SDK carry the routing identity.

After `Commit` or `Rollback` starts, do not issue more reads or writes through the same session. Finalization closes the session to new operations, drains work already registered on the server, and then commits or rolls back from a frozen server-owned working set.

In case of conflicts or encountering exclusive locks under pessimistic locking, transactions can be aborted so they can be retried on the client side.

Two user-facing behaviors are worth knowing:

- `GetByBucket(...)` inside a **pessimistic** session protects the whole bucket with a prefix lock, which blocks phantom inserts and conflicting writes under that prefix until the transaction finishes.
- `GetByRange(...)` inside a **pessimistic** session protects only the requested interval with a range lock, which is the better fit for large ordered key spaces.

The recommended approach is to use the built-in retry mechanism provided by Kahuna clients, which automatically retries aborted or retryable transactions using a short jittered backoff interval:

```csharp
KahunaTransactionOptions txOptions = new()
{ 
    Locking = KeyValueTransactionLocking.Pessimistic,
    Timeout = 5000
};

await client.RetryableTransaction(txOptions, async (session, cancellationToken) =>
{
    KahunaKeyValue balance1 = await session.GetKeyValue(userA);
    KahunaKeyValue balance2 = await session.GetKeyValue(userB);

    if (balance1.ValueAsLong() >= 50)
    {
        await session.SetKeyValue(userA, balance1.ValueAsLong() - 50);
        await session.SetKeyValue(userB, balance2.ValueAsLong() + 50);
    }

    await session.Commit();
});
```

`RetryableTransaction(...)` starts a fresh transaction for each attempt. It retries conflict-style outcomes such as `Aborted`, `MustRetry`, and `AlreadyLocked`, then gives up with a `KahunaException` if the retry budget is exhausted.

#### Transaction Options

`KahunaTransactionOptions` controls concurrency, timeout, read behavior, cleanup, and decision durability:

| Option | Default | Description |
|--------|---------|-------------|
| `Locking` | `Pessimistic` | Chooses pessimistic or optimistic concurrency behavior. Pessimistic sessions acquire locks before or during operations. Optimistic sessions validate reads and write intents at commit. |
| `Timeout` | server default when `0` | Maximum transaction duration in milliseconds. Use short timeouts for interactive work so abandoned sessions are cleaned up quickly. |
| `AdmissionWaitMs` | server default when `0` | Maximum time to wait for an admission slot before the transaction starts. The server clamps it to `MaxAdmissionWaitMs`. |
| `AsyncRelease` | `false` | Allows eligible post-commit cleanup to continue in the background. Leave it off when prompt lock cleanup matters. |
| `AutoCommit` | `true` | Carried in the protocol options, but interactive sessions still require an explicit `Commit`. Disposal of a pending session rolls back. |
| `ReadValidation` | `None` | Set to `TrackAndValidate` to record latest reads and validate them against revision or write-intent changes at commit. Optimistic locking validates its read set at commit even when this value is `None`. |
| `ReadTimestamp` | `HLCTimestamp.Zero` | Uses a fixed historical HLC timestamp for transaction reads. It is a snapshot view, not read-your-own-writes, and cannot be combined with `TrackAndValidate`. |
| `DecisionDurability` | `BestEffort` | Use `Durable` when an all-persistent write set needs durable finalization through a canonical transaction record and prepared intents. |
| `Priority` | `Normal` | Admission priority used when the server has enabled `MaxConcurrentSessions`. It affects when the session starts, not how it commits. |

Example with durable commit decisions:

```csharp
using Kahuna.Client;
using Kahuna.Shared.KeyValue;

KahunaTransactionOptions options = new()
{
    Locking = KeyValueTransactionLocking.Pessimistic,
    Timeout = 10_000,
    ReadValidation = ReadValidation.TrackAndValidate,
    DecisionDurability = DecisionDurability.Durable,
    Priority = TransactionPriority.High
};

await using KahunaTransactionSession session =
    await client.StartTransactionSession(options, cancellationToken);

await session.SetKeyValue(
    "accounts/alice",
    "90",
    durability: KeyValueDurability.Persistent,
    cancellationToken: cancellationToken
);

await session.SetKeyValue(
    "accounts/bob",
    "110",
    durability: KeyValueDurability.Persistent,
    cancellationToken: cancellationToken
);

bool committed = await session.Commit(cancellationToken);

if (!committed)
    throw new KahunaException("Commit must be retried", KeyValueResponseType.MustRetry);
```

Durable decision mode is different from persistent key durability:

- `KeyValueDurability.Persistent` controls whether a value is replicated and stored persistently.
- `DecisionDurability.Durable` controls whether finalization records and prepared persistent intents can be recovered after durable finalization starts.

Durable decision mode rejects transactions that confirmed ephemeral modifications, because ephemeral values, prepared intents, and receipts cannot survive process loss. The active interactive session is still memory-resident; if it disappears before a canonical record is installed, retry the business operation from a new transaction.

When a durable commit returns `true`, Kahuna has durably recorded the transaction decision. By default, value materialization and prepared-intent settlement may continue in the background. Kahuna's read and write paths resolve committed-but-unsettled intents through the canonical record, and recovery finishes settlement if a background run is lost. Recent servers materialize committed durable values by reference to prepared intents, so this behavior requires no client-side value replay. If commit returns `false` or throws `MustRetry`, retry the same commit operation and treat it as uncertainty rather than a conflict.

#### Snapshot Reads in a Transaction Session

`ReadTimestamp` gives the session a transaction-wide historical read timestamp for point, bucket, prefix, and range reads:

```csharp
using Kommander.Time;
using Kahuna.Client;

HLCTimestamp readTimestamp = new(0, 1718392012345, uint.MaxValue);

await using KahunaTransactionSession session = await client.StartTransactionSession(
    new KahunaTransactionOptions
    {
        ReadTimestamp = readTimestamp,
        Timeout = 5000
    }
);

KahunaKeyValue historical = await session.GetKeyValue(
    "config/feature-x",
    KeyValueDurability.Persistent
);
```

When `ReadTimestamp` is set, reads behave as historical snapshot reads. Keys created after the timestamp are hidden, and keys updated after the timestamp return the older visible value. Do not combine a fixed `ReadTimestamp` with `ReadValidation.TrackAndValidate`, because a historical snapshot is not a latest-state read set.

#### Operation Retries and Finalization Results

The SDK assigns a stable operation ID to each transaction-scoped call. If the communication layer retries the same logical operation, Kahuna can recognize the retry and avoid applying the same mutation twice.

`Commit(...)` and `Rollback(...)` return `true` when the server reaches the requested terminal outcome. A `false` result means the final outcome is not known yet and the same finalize action should be retried with the same session handle. Certain terminal outcomes are reported as `KahunaException`; inspect `KahunaException.KeyValueErrorCode` instead of matching exception text.

Common result meanings:

| Result | Meaning |
|--------|---------|
| `Committed` | The transaction committed and the session is complete. |
| `RolledBack` | Rollback cleanup was acknowledged and the session is complete. |
| `MustRetry` | Retry commit or rollback with the same session. Do not add more operations. |
| `Aborted` | Start a new transaction if the business operation should be retried. |
| `AlreadyLocked` | Another transaction holds a conflicting lock. Retry through `RetryableTransaction(...)` or back off manually. |
| `Errored` | The handle is unknown, expired, or the outcome is unavailable. Treat it as an application-level uncertainty. |

Pessimistic point-key operations retry transient lock-acquire refusals inside the session for a short bounded window before returning `MustRetry`. This reduces immediate retries during brief contention while still avoiding long waits inside a transaction timeout.

Learn more about the coordinator lifecycle in [Distributed Transactions](/docs/architecture/distributed-transactions/) and [Transaction Lifecycle](/docs/internals/transaction-lifecycle/).

#### Transaction Priority Admission

`TransactionPriority` lets a client label latency-sensitive transaction work when a node is saturated:

```csharp
await using KahunaTransactionSession session =
    await client.StartTransactionSession(new KahunaTransactionOptions
    {
        Priority = TransactionPriority.High,
        Timeout = 10_000,
        AdmissionWaitMs = 2_000
    });
```

Available priorities are `Background`, `Low`, `Normal`, `High`, and `Critical`. `Normal` is the default. Priority is honored only when the server enables transaction admission ceilings. It does not preempt a running transaction or change consistency semantics.

If the admission queue is full, or the caller's admission wait expires before a slot opens, the server returns `AdmissionRefused`. Retry with backoff; no transaction was started.

See [Transaction Priority Admission](/docs/distributed-keyvalue-store/transaction-priority-admission/) for tuning and metrics.

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
| `TakeCoordinatedBackupAsync()` | Create a full backup capped at a cluster-wide safe HLC timestamp |
| `TakeIncrementalBackupAsync(parentBackupId)` | Append committed WAL changes to a backup chain |
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
