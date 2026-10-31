
# .NET Client

The .NET client (`Kahuna.Client`) gives a C# application one typed API for the coordination work you would otherwise build yourself on Redis or a SQL table: [distributed locks](/docs/distributed-locks/), the [key/value store](/docs/distributed-keyvalue-store/), [Kahuna Script](/docs/scripts/) and multi-key [transactions](/docs/distributed-keyvalue-store/transactions/), and the [distributed sequencer](/docs/distributed-sequencer/). It also covers [cluster administration](/docs/dotnet-client/administration/), including backups and [point-in-time restore](/docs/glossary/#point-in-time-recovery-pitr).

The client talks to the cluster over gRPC by default, packs waiting key/value requests together under load, and can route point operations straight to the node that owns them. It hides most routing and coordination details while exposing the controls you need for consistency, durability, and retries. It works with ASP.NET Core: the [distributed rate limiters](/docs/distributed-rate-limiting/) plug into its rate-limiting middleware and share fixed-window, sliding-window, token-bucket, and concurrency budgets across application replicas. Documentation and samples are in the `docs/` folder and the [GitHub repository](https://github.com/kahunakv/kahuna).

For change notifications on persistent keys, see [Watch Persistent Key Changes](/docs/distributed-keyvalue-store/watches/). For Node.js applications, see the [TypeScript Client](/docs/typescript-client/).

## Client Installation

Install the NuGet package with the .NET CLI:

```bash
dotnet add package Kahuna.Client
```

Or via the NuGet Package Manager:

```powershell
Install-Package Kahuna.Client
```

## Connect

Create one client and reuse it (it can be a global instance):

```csharp
using Kahuna.Client;

var client = new KahunaClient("https://localhost:8082");
```

To configure a pool of Kahuna endpoints belonging to the same cluster, pass several URLs:

```csharp
var client = new KahunaClient([
    "https://localhost:8082",
    "https://localhost:8084",
    "https://localhost:8086"
]);
```

Using a pool of reachable endpoints lets the client avoid a load balancer and also enables leader-aware routing. With the default `KahunaRoutingMode.Auto`, a client configured with several endpoints learns route hints from responses and sends later point key/value, lock, and sequence operations directly to the node that owns the resource.

Route hints are advisory. If leadership or placement changes, the receiving server re-resolves the resource and forwards or returns retryable state as needed.

See [Client Leader-Aware Routing](/docs/client-routing/) for routing modes, endpoint mapping, server advertisement flags, metadata mode, and the routing counters published under the `Kahuna.Client.Routing` meter.

## Client Options

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
        GrpcRequestFrames = true,
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

`GrpcRequestFrames` is enabled by default. Under load, the client can send several already-waiting key/value requests in one gRPC stream message to nodes that announce support for request frames. A single quiet request still travels alone, so the option does not add a coalescing delay. Leave it enabled unless you are doing an A/B benchmark or diagnosing transport behavior during a rolling upgrade.

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
| `MinConnections` | `1` | Currently unused: the client does not read this option. |
| `MaxConnections` | `1` | Currently unused: the client does not read this option. |
| `DefaultOperationTimeout` | `30 seconds` | Timeout used when a call has no cancellation token deadline. |
| `GrpcChannelPoolSize` | `2` | gRPC channels opened per configured endpoint. |
| `GrpcRequestFrames` | `true` | Pack already-waiting key/value requests into one gRPC stream message when the server supports it. |
| `BatchCoalescingThreshold` | `10` | Minimum batch size before immediate dispatch; smaller batches may wait briefly. |
| `BatchCoalescingDelayMs` | `2` | Maximum batch coalescing wait in milliseconds. |
| `AllowInsecureCertificateValidation` | `false` | Skip TLS server certificate validation for local or test environments. |
| `TrustedServerCertificateThumbprints` | empty | SHA-256 certificate thumbprints accepted for production pinning. |

## Transport

The client uses gRPC by default. To use the REST API instead, pass a `RestCommunication` instance:

```csharp
using Kahuna.Client;
using Kahuna.Client.Communication;

KahunaOptions options = new();
ILogger<KahunaClient>? logger = null; // or a logger from your DI container

var client = new KahunaClient(
    "https://localhost:8082",
    logger,
    communication: new RestCommunication(logger, options),
    options: options
);
```

`RestCommunication` reads the TLS options (`AllowInsecureCertificateValidation`, `TrustedServerCertificateThumbprints`) from the options you pass to it. Those REST TLS settings are process-wide: the first non-default configuration wins.

Both transports support key/value operations, scripts, interactive transaction sessions, watches, and key-range administration, and they return the same per-value script result shape. Differences to know:

- `GetManyKeyValues(...)` and `ExistsManyKeyValues(...)` work over both REST and gRPC. Over REST, the server rejects a batch read that carries a transaction ID with `InvalidInput`, because that transport cannot register the batch in the transaction's read set.
- REST encodes the difference between a `null` payload and a zero-byte payload as JSON `null` versus an empty base64 string. gRPC uses bytes-field presence.
- `GrpcChannelPoolSize`, `GrpcRequestFrames`, `DefaultOperationTimeout`, and the batch coalescing options apply to the gRPC transport.

## Errors and Cancellation

Protocol failures throw `KahunaException`. Read `ErrorDomain` first, then the code for that domain: `LockErrorCode`, `KeyValueErrorCode`, or `SequenceErrorCode`. `ErrorCodeName` gives the code's name for logs. Inspect the codes instead of matching exception text.

```csharp
using Kahuna.Client;
using Kahuna.Shared.KeyValue;

try
{
    await using KahunaTransactionSession session = await client.StartTransactionSession(
        new KahunaTransactionOptions { AdmissionWaitMs = 2_000 }
    );
    // ...
}
catch (KahunaException ex) when (ex.ErrorDomain == KahunaErrorDomain.KeyValue
                                  && ex.KeyValueErrorCode == KeyValueResponseType.AdmissionRefused)
{
    // No transaction was started: back off and retry.
}
```

Client methods accept a `CancellationToken`. On the gRPC transport, a batched call with no token deadline uses `DefaultOperationTimeout` and surfaces an `OperationCanceledException` when it expires. A timeout does not tell you whether the server applied the operation.

## Locks

`GetOrCreateLock` acquires a [lease](/docs/glossary/#lease) on a resource name and returns a `KahunaLock`. Dispose it with `await using` to release the lock when the method ends. Pass `wait` and `retry` to keep trying while the lock is held by someone else; frequent retries suit short critical sections under heavy contention, where the lock changes hands quickly:

```csharp
using Kahuna.Client;

public async Task UpdateBalance(KahunaClient client, string userId)
{
    // hold the lease for 5 seconds (unless extended),
    // retry every 150 milliseconds for up to 10 seconds if the lock is not available

    await using KahunaLock myLock = await client.GetOrCreateLock(
        "balance-" + userId,
        expiry: TimeSpan.FromSeconds(5),
        wait: TimeSpan.FromSeconds(10),
        retry: TimeSpan.FromMilliseconds(150),
        durability: LockDurability.Persistent
    );

    if (myLock.IsAcquired)
    {
        // implement exclusive logic here
    }
    else
    {
        Console.WriteLine("Someone else has the lock!");
    }

    // myLock is automatically released after leaving the method
}
```

Without `wait` and `retry`, the call makes a single attempt and gives up immediately. `durability` defaults to `LockDurability.Persistent`: the lock state is committed by a [quorum](/docs/glossary/#quorum) (a majority) of the [partition](/docs/glossary/#partition)'s replicas, so it survives the loss of a minority of those replicas. See [durability levels](/docs/architecture/durability-levels/).

Use `myLock.FencingToken` so that a client that lost its lease cannot overwrite newer work. The protected record stores the highest token it accepted, and the check and the write must happen in one step: reading the stored token in application code and saving afterwards leaves a gap in which another holder can write. When the protected record lives in Kahuna, pass the token to a [Kahuna Script](/docs/scripts/) that compares and writes in one transaction:

```csharp
KahunaTransactionScript fencedWrite = client.LoadTransactionScript("""
begin
  let fence = get @fence_key
  if fence != null then
    if to_int(@token) < to_int(fence) then
      throw "stale token"
    end
  end
  set @fence_key @token
  set @data_key @value
  commit
end
""");

await fencedWrite.Run([
    new() { Key = "@fence_key", Value = $"balance-{userId}/fence" },
    new() { Key = "@data_key", Value = $"balance-{userId}" },
    new() { Key = "@token", Value = myLock.FencingToken.ToString() },
    new() { Key = "@value", Value = newBalance.ToString() }
]);
```

A stale token makes `Run` throw a `KahunaException` (`KeyValueErrorCode == KeyValueResponseType.Errored`, message `stale token at line 5`), and neither key changes. See [Fencing Tokens](/docs/distributed-locks/fencing-tokens/) for when a resource outside Kahuna must do this check itself.

`myLock.TryExtend(TimeSpan)` returns `(true, fencingToken)` when the lease was extended. The server extends only for the current owner and keeps the token unchanged, so a lost lock shows up as a failed extend: a `KahunaException` with a `LockErrorCode` such as `InvalidOwner` or `LockDoesNotExist`. Stop the protected work when it happens. `myLock.GetInfo()` returns the current owner and expiry. See [Distributed Locks](/docs/distributed-locks/) for the full API and the [leader election recipe](/docs/recipes/leader-election/) for a renewal loop.

## Key/Value

### Snapshot Reads

Top-level read methods take a `snapshotMs` parameter for as-of snapshot reads:

```csharp
using Kahuna.Client;
using Kahuna.Shared.KeyValue;

KahunaKeyValue latest = await client.GetKeyValue("users/000100", KeyValueDurability.Persistent);

KahunaKeyValue sameSnapshot = await client.GetKeyValue(
    "users/000100",
    KeyValueDurability.Persistent,
    snapshotMs: latest.LastModified
);
```

`LastModified` is the Unix-epoch millisecond timestamp at which that [revision](/docs/glossary/#revision) was committed. It can be reused as a snapshot anchor for later reads. The same parameter is available on `ExistsKeyValue(...)`, `GetByBucket(...)`, `ScanAllByPrefix(...)`, `GetByRange(...)`, and `ScanByRange(...)`.

For exact archived revisions, use `GetKeyValueRevision(...)` when you know the precise revision number; use `snapshotMs` when you want the value visible at a specific historical time. When a historical view needs to stay readable for a long time, acquire a [snapshot hold](#snapshot-holds).

### No-Revision Writes

For cache-style keys that only need the latest value, set a key without archiving a historical revision entry:

```csharp
KahunaKeyValue result = await client.SetKeyValueNoRevision(
    "cache/user/1001",
    System.Text.Encoding.UTF8.GetBytes("""{"name":"Ada"}"""),
    expiryTime: 60000,
    durability: KeyValueDurability.Persistent
);
```

To compose it with other options, pass `flags: KeyValueFlags.SetIfNotExists | KeyValueFlags.SetNoRevision` to `SetKeyValue(...)`.

The current revision still advances and latest reads still work. What changes is the historical record: the revision created by this write is not available through `GetKeyValueRevision(...)` or snapshot reads that need that archived version. Use no-revision writes to reduce memory and disk write amplification when Kahuna is acting as a pure distributed key/value cache. Use normal writes for audit history, `GetKeyValueRevision(...)`, and point-in-time reads.

### Null and Empty Values

Kahuna preserves the difference between a key with no payload and a key whose payload is zero bytes. In .NET, pass `null` for no payload and `Array.Empty<byte>()` for an empty byte array:

```csharp
await client.SetKeyValue("profile/empty-payload", (byte[]?)null);
await client.SetKeyValue("profile/zero-bytes", Array.Empty<byte>());
```

This matters for compare-value operations and for applications that use a present-but-empty payload as a meaningful value.

### Ordered Range Reads

For ordered key spaces such as `users/000001` through `users/999999`, `GetByRange(...)` reads one bounded page and `ScanByRange(...)` streams a larger range:

```csharp
List<KahunaKeyValue> page = await client.GetByRange(
    prefix: "users",
    startKey: "users/000100",
    startInclusive: true,
    endKey: "users/000200",
    endInclusive: false,
    limit: 100,
    durability: KeyValueDurability.Persistent
);

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

`ScanByRange(...)` keeps fetching server-side pages behind the async sequence while preserving one historical snapshot when `snapshotMs` is non-zero. Large range scans can read keys that currently live only on disk without forcing every scanned key back into the in-memory cache. If a page keeps returning retryable state (a moving range, a leadership change, a restore, or an undecided transaction [write intent](/docs/glossary/#write-intent)), the scan fails with a retryable error instead of scanning forever. Back off briefly and retry.

A transaction session also exposes `GetByRange(...)`, which returns a `KeyValueGetByRangePageResult` and can take a range lock; see [ordered range reads inside a transaction](/docs/distributed-keyvalue-store/transactions/#using-ordered-range-reads-inside-a-transaction) and [Key-Range Sharding](/docs/distributed-keyvalue-store/key-range-sharding/).

### Batch Operations

The client exposes `SetManyKeyValues(...)`, `DeleteManyKeyValues(...)`, `GetManyKeyValues(...)`, and `ExistsManyKeyValues(...)`:

```csharp
List<KahunaKeyValue> setResults = await client.SetManyKeyValues([
    new()
    {
        Key = "services/auth",
        Value = System.Text.Encoding.UTF8.GetBytes("node1"),
        ExpiresMs = 30000,
        Flags = KeyValueFlags.SetNoRevision,
        Durability = KeyValueDurability.Persistent
    }
]);
```

- `KahunaSetKeyValueRequestItem` supports `Key`, `Value`, `ExpiresMs`, `Flags`, `CompareValue`, `CompareRevision`, and `Durability`.
- `KahunaDeleteKeyValueRequestItem` supports `Key` and `Durability`.
- `KahunaGetManyKeyValuesRequestItem` supports `Key`, optional `Revision`, and `Durability`.

`DeleteKeyValue(...)` and `DeleteManyKeyValues(...)` return the revision of the [tombstone](/docs/glossary/#tombstone) (delete marker) created by the delete. For a key at revision `0`, a successful delete returns revision `1`, and a later set returns revision `2`.

Set `Flags = KeyValueFlags.SetNoRevision` for batch cache writes where old values are not needed. Combine it with conditional flags when the write should still be guarded by existence, value, or revision checks.

Persistent batch writes benefit from [partition write coalescing](/docs/architecture/partition-write-coalescing/): Kahuna can combine direct writes for the same [Raft](/docs/glossary/#raft) partition into fewer Raft proposals, even when they come from different client requests. A batch is not atomic; use a transaction when all items must commit or roll back together.

## Watches

`WatchKeyValues` streams committed sets, deletes, and expiry extensions for a persistent key, prefix, or range:

```csharp
await using KahunaWatch watch = await client.WatchKeyValues(
    new KeyValueWatchRequest(
        KeyValueWatchScope.ForPrefix("config/prod/search/"),
        KeysOnly: true),
    cancellationToken);

await foreach (KeyValueWatchFrame frame in watch.ReadAllAsync(cancellationToken))
{
    if (frame.Event is { } change)
        Console.WriteLine($"Refresh {change.Key} ({change.Kind})");
    else if (frame.IsTerminal)
        Console.WriteLine($"Watch ended: {frame.Type}");
}
```

Open the watch before reading the initial state, and treat a terminal frame as a possible gap. `WatchKeyValues(request, autoResume: true)` can resume some interrupted streams from progress watermarks when every server runs with a positive `--commit-admission-lag-ms`. See [Watch Persistent Key Changes](/docs/distributed-keyvalue-store/watches/) for delivery rules and history holds, and the [watch recipe](/docs/recipes/watch-key-changes/) for a refresh loop.

## Scripts

`ExecuteKeyValueTransactionScript` runs a [Kahuna Script](/docs/scripts/) on the server. Pass dynamic values as parameters instead of concatenating them into the script text. The server can then reuse the execution plan across calls, and the script is safe from injection:

```csharp
const string script = """
let inventory = get @inventory_key
let available = to_int(inventory)
let requested = to_int(@requested_amount)
if available >= requested then
  set @inventory_key available - requested
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

Avoid `ExecuteKeyValueTransactionScript("SET " + key + " " + value)`; prefer `"SET @key @value"` with `@key` and `@value` parameters.

Script results expose `Values`, where each item carries the key, value, revision, expiration, and last-modified timestamp returned by the script. `FirstValue`, `FirstValueAsString`, and `FirstRevision` are convenience accessors for the first returned item.

For scripts that run often, load them once during initialization with `client.LoadTransactionScript(script)` and call `Run(parameters)` on the returned `KahunaTransactionScript`. This avoids re-parsing and re-planning on every call:

```csharp
KahunaTransactionScript checkSession = client.LoadTransactionScript("""
    let session = get @session_key
    if not found then
     return 0
    end
    set @session_key session ex to_int(@ttl_ms)
    return 1
    """);

var result = await checkSession.Run([
    new() { Key = "@session_key", Value = sessionKey },
    new() { Key = "@ttl_ms", Value = ttlMs }
]);
```

The script rewrites the session value to apply the new TTL, so the key's revision advances. To change only the expiry, use `extend @session_key 1800000`; `extend` takes an integer literal, not a placeholder.

Both `ExecuteKeyValueTransactionScript(..., priority: TransactionPriority.Background)` and `Run(TransactionPriority.High, parameters)` accept an admission priority. Priority matters only when the server has enabled transaction admission ceilings; otherwise it is recorded for metrics and the script starts immediately. See [Transaction Priority Admission](/docs/distributed-keyvalue-store/transaction-priority-admission/).

## Interactive Transactions

`StartTransactionSession` opens a `KahunaTransactionSession` for multi-key work written in C#, over gRPC or REST. `RetryableTransaction` starts a fresh transaction for each attempt and retries `Aborted`, `MustRetry`, and `AlreadyLocked` with a short jittered backoff:

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
        await session.SetKeyValue(userA, (balance1.ValueAsLong() - 50).ToString());
        await session.SetKeyValue(userB, (balance2.ValueAsLong() + 50).ToString());
    }

    await session.Commit();
});
```

Because `MustRetry` can represent an unknown commit outcome, use `RetryableTransaction` only for business operations safe to repeat. Retry an unresolved durable finalize with the same session identity.

Call `Commit` explicitly. Disposing a still-pending session rolls it back, so `await using` is a safety net for exceptions and early returns. After `Commit` or `Rollback` starts, do not issue more reads or writes through the same session. The session exposes `Status`, `TransactionId`, `Handle`, and `RecordAnchorKey` for diagnostics.

`KahunaTransactionOptions`:

| Option | Default | Description |
|--------|---------|-------------|
| `Locking` | `Pessimistic` | Chooses pessimistic or optimistic concurrency behavior. Pessimistic sessions acquire locks before or during operations. Optimistic sessions validate reads and write intents at commit. |
| `Timeout` | server default when `0` | Maximum transaction duration in milliseconds. Use short timeouts for interactive work so abandoned sessions are cleaned up quickly. |
| `AdmissionWaitMs` | server default when `0` | Maximum time to wait for an admission slot before the transaction starts. The server clamps it to `MaxAdmissionWaitMs`. |
| `AsyncRelease` | `false` | Allows eligible post-commit cleanup to continue in the background. Leave it off when prompt lock cleanup matters. |
| `AutoCommit` | `true` | Carried in the protocol options, but interactive sessions still require an explicit `Commit`. Disposal of a pending session rolls back. |
| `ReadValidation` | `None` | Set to `TrackAndValidate` to record latest reads and validate them against revision or write-intent changes at commit. Optimistic locking validates its read set at commit even when this value is `None`. |
| `ReadTimestamp` | `HLCTimestamp.Zero` | Uses a fixed historical [HLC](/docs/glossary/#hybrid-logical-clock-hlc) timestamp for transaction reads. It is a snapshot view, not read-your-own-writes, and cannot be combined with `TrackAndValidate`. |
| `DecisionDurability` | `BestEffort` | Under either policy, persistent modifications use a [canonical transaction record](/docs/internals/transaction-lifecycle/#basic-concepts) (the authoritative commit or abort decision) and durable prepared intents. Explicit `Durable` rejects ephemeral modified keys. |
| `Priority` | `Normal` | Admission priority used when the server has enabled `MaxConcurrentSessions`. It affects when the session starts, not how it commits. |
| `ConflictPolicy` | `Normal` | Set to `Yield` for retryable maintenance work that should let foreground writers take over point-key intents instead of failing. |

`Commit(...)` and `Rollback(...)` return `true` when the server reaches the requested terminal outcome. A `false` result means the final outcome is not known yet: retry the same finalize action with the same session handle and treat it as uncertainty rather than a conflict. Other terminal outcomes are reported as `KahunaException`; inspect `KeyValueErrorCode`:

| Result | Meaning |
|--------|---------|
| `Committed` | The transaction committed and the session is complete. |
| `RolledBack` | Rollback cleanup was acknowledged and the session is complete. |
| `MustRetry` | Retry commit or rollback with the same session. Do not add more operations. |
| `Aborted` | Start a new transaction if the business operation should be retried. |
| `AlreadyLocked` | Another transaction holds a conflicting lock. Retry through `RetryableTransaction(...)` or back off manually. |
| `Errored` | The handle is unknown, expired, or the outcome is unavailable. Treat it as an application-level uncertainty. |

The SDK assigns a stable operation ID to each transaction-scoped call, so a retried operation is not applied twice. Pessimistic point-key operations retry transient lock-acquire refusals inside the session for a short bounded window before returning `MustRetry`. The active interactive session is memory-resident: if it disappears before a canonical record is installed, retry the business operation from a new transaction.

See [Transactions](/docs/distributed-keyvalue-store/transactions/) for locking modes, prefix and range locks, durable decisions, and snapshot sessions; [Transaction Reads and Locks](/docs/distributed-keyvalue-store/read-and-lock-semantics/) for visibility and locks lost during failover; [Yielding Transactions](/docs/distributed-keyvalue-store/yielding-transactions/); and [Distributed Transactions](/docs/architecture/distributed-transactions/) for the coordinator lifecycle.

## Sequences

The client exposes Kahuna's [distributed sequencer](/docs/distributed-sequencer/) for named, monotonically increasing values:

```csharp
using Kahuna.Shared.Sequences;

KahunaSequence sequence = await client.CreateSequence(
    "orders",
    initialValue: 0,
    increment: 1,
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
```

Use idempotency keys when retrying allocation requests after a timeout: a committed request retried with the same key returns the original allocation. `UpdateSequence`, `GetSequence`, and `DeleteSequence` complete the API; an update waits about one server `SequencerBlockLease` before returning. See [Sequencer Clients](/docs/distributed-sequencer/clients/) for every method and [Sequence Model](/docs/distributed-sequencer/model/) for update and retry behavior.

## Snapshot Holds

`AcquireSnapshotHold`, `RenewSnapshotHold`, `ReleaseSnapshotHold`, and `GetSnapshotFloor` keep the revisions needed by a historical timestamp from being pruned while you read them. These calls take no `nodeUrl` and rotate through the configured endpoints. See [Snapshot Holds](/docs/distributed-keyvalue-store/snapshot-holds/) for a full .NET example.

## Cluster Administration

Cluster membership, replica placement, leaving the cluster, key-range administration, and backup and point-in-time restore have their own page: [.NET Client: Cluster Administration](/docs/dotnet-client/administration/).
