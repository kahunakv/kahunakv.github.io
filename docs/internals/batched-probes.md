# Batched Point and Range Probes

Embedding hosts and storage integrations can use `IKahuna.LocateAndTryProbeMany` and `IKahuna.LocateAndTryProbeManyRanges` to read related keys or bounded ranges with fewer actor and backend-scheduler hand-offs. These are server/embedded APIs with inter-node gRPC support, not new methods on `Kahuna.Client` or the TypeScript SDK.

A **point probe** returns the ordinary get outcome for each requested key. A **range probe** returns one ordinary bounded range page per seek. Both preserve input order and can optionally acquire Shared transaction locks as part of the read. Inspect every result: a batch can contain successful reads, missing keys, refusals, and held locks together.

## Point Reads

```csharp
using Kahuna.Server.KeyValues;
using Kahuna.Shared.KeyValue;
using Kommander.Time;

KeyValueProbeResult[] results = await kahuna.LocateAndTryProbeMany(
    transactionId: HLCTimestamp.Zero,
    readTimestamp: HLCTimestamp.Zero,
    keys: new[] { "orders/100", "orders/200" },
    lockMode: KeyValueProbeLock.None,
    expiresMs: 0,
    durability: KeyValueDurability.Persistent,
    cancellationToken: cancellationToken);

for (int i = 0; i < results.Length; i++)
    Console.WriteLine($"Item {i}: {results[i].Type}, locked={results[i].Locked}");
```

Keys must belong to one key space, determined by the portion before the last `/`. Keys without `/` are individual key spaces and can only be probed alone without locks. All items share durability and the requested read timestamp. A point result exposes `Type`, `Entry`, `HolderTransactionId`, and `Locked`.

The router groups requests by partition, retains order within each group, and combines remote work per leader. A split key space can therefore involve several actors and leaders. Point visibility and transaction pins follow the same rules as single gets; batching does not establish a cluster-wide atomic snapshot. Use the [transaction read rules](/docs/distributed-keyvalue-store/read-and-lock-semantics/) to choose latest or fixed-timestamp reads.

## Bounded Range Reads

```csharp
KeyValueProbeRangeResult[] pages = await kahuna.LocateAndTryProbeManyRanges(
    transactionId: HLCTimestamp.Zero,
    readTimestamp: HLCTimestamp.Zero,
    prefix: "orders/",
    seeks: new[]
    {
        new KeyValueProbeRange("orders/100", true, "orders/199", true, 16),
        new KeyValueProbeRange("orders/200", true, "orders/299", true, 16)
    },
    lockMode: KeyValueProbeLock.None,
    expiresMs: 0,
    durability: KeyValueDurability.Persistent,
    cancellationToken: cancellationToken);
```

Each seek has start/end keys, inclusivity flags, and a positive limit. Null bounds are open. A result exposes `Type`, ordered `Items`, `HasMore`, `ResumeKey`, `HolderTransactionId`, and `Locked`. `HasMore` is per seek: resume through the normal range-scan path after `ResumeKey`, **exclusive**, keeping the original prefix and end bound. A null resume key with `HasMore` means start again at the seek's original start bound. Use an explicit fixed read timestamp from the outset if continuation must retain that historical view.

A partition-local range-probe handler reads its seeks at one read instant. The router can split a batch across partitions; a seek spanning partition boundaries uses the ordinary range-lock/page paths instead of the single-actor optimization. That fallback does not make cross-partition work one actor turn or one global read instant. A replay of such a spanning seek returns `MustRetry` instead of taking new locks.

## Shared Locks and Partial Results

`KeyValueProbeLock.Shared` requires a nonzero transaction identity and a nonnegative lease. A point key uses Shared bounds `[key,key]`; a range seek locks its requested bounds, not just its returned rows. In the actor path the lock grant and initial read occur in the same turn. These are the usual leader-local transaction range locks, with the same renewal, compatibility, and failure limits.

Within each partition group, the first **lock-acquisition refusal** stops further work in that group. Earlier items retain their results and locks; the refused item reports the refusal and holder; later items return `MustRetry` without locks or values. Other partition groups can already have succeeded. A read refusal after a successful lock does not imply release: `Locked` can remain true even if the read returned `MustRetry`. Do not treat a partially refused batch as an automatic rollback.

Registered transaction probes use `coordinatorKey` and `operationId` as one coordinator operation. Completion records confirmed latest-read observations and acquired locks for validation and cleanup. Yielding sessions reject Shared predicate locks. If completion cannot be confirmed, results become `MustRetry` while retaining lock flags; retry the same operation identity to recover its registration.

A completed operation replay re-reads without folding a new read set. For locking probes it renews only the exact Shared bounds still owned by the transaction; it never acquires additional locks. A missing lock returns `MustRetry` and does not stop later replay items. `SharedReentryOnly` implements this internal replay mode; registered callers cannot request it directly. A replay is not a cached copy of the original values.

Lock-grant term proofs still apply. If no routing key can represent a granted range on its partition, the server logs a warning that the grant cannot supply leadership-change evidence at commit. Do not interpret `Locked=true` as a stronger guarantee than the underlying [transaction lock proof](/docs/distributed-keyvalue-store/read-and-lock-semantics/#detecting-locks-lost-during-failover).

## Limits and Execution Cost

| Core setting | Default | Limit |
|---|---|---|
| `KahunaConfiguration.MaxProbeBatchSize` | `512` | Keys in a point probe or seeks in a range probe. |
| `KahunaConfiguration.MaxProbeRangeEntries` | `65536` | Sum of requested range-seek limits. |

Oversized or mixed-key-space point requests, malformed range requests, and locking without a transaction return `InvalidInput` for the request's result slots. Split large requests to fit. These settings are core configuration fields; they have no server CLI flags or corresponding `EmbeddedKahunaOptions` fields today.

Point probes batch missing-head reads. On RocksDB/SQLite, range probes read the open seeks together in one scheduler operation and merge them in one resume turn per round; seeks needing more source rows continue in later rounds. The memory backend can read and merge inline under a shared inspection budget, then fall back to the scheduler. This reduces hand-offs rather than promising parallel disk reads or constant latency. See [Backend I/O Scheduler](/docs/backend-io-scheduler/) and [Range-Scan Observations](/docs/internals/range-scan-observations/).
