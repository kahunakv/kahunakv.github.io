
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

Using a pool of reachable endpoints instead of a load balancer can help reduce network latency, as the client can connect directly to healthy nodes without going through an additional proxy layer.

However, this comes at the cost of reduced flexibility when adding, removing, or reconfiguring nodes in the cluster. Without a centralized load balancer, the client must be manually updated or be able to discover and manage endpoint changes dynamically.

This trade-off is common in high-performance distributed systems that prioritize low latency and direct communication over automatic infrastructure abstraction.

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

Set `Flags = KeyValueFlags.SetNoRevision` for batch cache writes where old values are not needed. Combine it with conditional flags when the write should still be guarded by existence, value, or revision checks.

Persistent batch writes also benefit from [partition write coalescing](/docs/architecture/partition-write-coalescing/). Kahuna can combine direct writes for the same Raft partition into fewer Raft proposals, even when they come from different client requests. This improves bursts where keys share a bucket or key-space. It does not make a batch atomic; use a transaction when all items must commit or roll back together.

## Register a Key Range

For ordered key spaces, the client also exposes `RegisterKeyRange(...)`:

```csharp
bool created = await client.RegisterKeyRange("users");
```

This registers a key space for range-based sharding so the cluster routes that space through range descriptors instead of the default hash-routed model.

Use this only for key spaces that are intentionally modeled as ordered ranges. See [Key-Range Sharding](/docs/distributed-keyvalue-store/key-range-sharding/) for the routing trade-offs.

## Transport Notes

Some client features currently require the gRPC transport:

- `GetManyKeyValues(...)` is not available over the REST transport
- `ExistsManyKeyValues(...)` is not available over the REST transport
- `RegisterKeyRange(...)` is not available over the REST transport

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
| `AsyncRelease` | `false` | Allows eligible post-commit cleanup to continue in the background. Leave it off when prompt lock cleanup matters. |
| `AutoCommit` | `true` | Carried in the protocol options, but interactive sessions still require an explicit `Commit`. Disposal of a pending session rolls back. |
| `ReadValidation` | `None` | Set to `TrackAndValidate` to record latest reads and validate them against revision or write-intent changes at commit. Optimistic locking validates its read set at commit even when this value is `None`. |
| `ReadTimestamp` | `HLCTimestamp.Zero` | Uses a fixed historical HLC timestamp for transaction reads. It is a snapshot view, not read-your-own-writes, and cannot be combined with `TrackAndValidate`. |
| `DecisionDurability` | `BestEffort` | Use `Durable` when an all-persistent write set needs durable finalization through a canonical transaction record and prepared intents. |

Example with durable commit decisions:

```csharp
using Kahuna.Client;
using Kahuna.Shared.KeyValue;

KahunaTransactionOptions options = new()
{
    Locking = KeyValueTransactionLocking.Pessimistic,
    Timeout = 10_000,
    ReadValidation = ReadValidation.TrackAndValidate,
    DecisionDurability = DecisionDurability.Durable
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

When a durable commit returns `true`, Kahuna has durably recorded the transaction decision. By default, value materialization and prepared-intent settlement may continue in the background. Kahuna's read and write paths resolve committed-but-unsettled intents through the canonical record, and recovery finishes settlement if a background run is lost. If commit returns `false` or throws `MustRetry`, retry the same commit operation and treat it as uncertainty rather than a conflict.

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

Learn more about the coordinator lifecycle in [Distributed Transactions](/docs/architecture/distributed-transactions/) and [Transaction Lifecycle](/docs/internals/transaction-lifecycle/).

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

Restore through the chain's natural end with `targetTimeMs: 0`:

```csharp
KahunaRestoreResponse restored = await client.RestoreAsync(
    leafBackupId: incremental.BackupId,
    targetDir: "/var/lib/kahuna/restored",
    targetTimeMs: 0
);

Console.WriteLine($"Applied {restored.EntriesApplied} WAL entries");
Console.WriteLine($"Restored to {restored.TargetDir}");
```

For point-in-time recovery, pass the target HLC physical component as Unix epoch milliseconds. `targetDir` refers to the server filesystem. The operation does not replace live state; start a fresh node with the restored directory.

See [Backups and Point-in-Time Recovery](/docs/backups-and-point-in-time-recovery/) for server setup, node bootstrap, and current replay limitations.
