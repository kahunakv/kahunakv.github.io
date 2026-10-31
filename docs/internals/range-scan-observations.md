# Range-Scan Observations

A range scan that returns a hundred rows may have to look at thousands of entries to find them. Deleted keys ([tombstones](/docs/glossary/#tombstone)), expired keys, old revisions for historical reads, and committed transaction writes not yet [settled](/docs/internals/transaction-lifecycle/#basic-concepts) all cost work, but they never appear in the result. When a scan is slower than its result size suggests, this hidden work is usually the cause.

Range-scan observations report that hidden work for each page. They show why a scan is slow: for example, many dead entries in the scanned range, deep revision history, retries, or pages served from disk or from another node. They are diagnostic data for operators and embedding hosts.

Each page of a paginated range scan can carry a `KeyValueScanObservation`, exposed as `KeyValueGetByRangeResult.Observation` in the server/embedded API and `GrpcScanObservation` on the range-scan gRPC responses.

These are advisory measurements. They do not change visibility, cursor progression, retry decisions, or returned rows. They are not a new high-level .NET or TypeScript client scan API.

## Fields

| Field | Meaning |
|---|---|
| `EntriesInspected` | Resident entries, disk heads, and disk rows dropped by as-of projection that the walk touched, including entries it did not return. |
| `DeadEntriesSkipped` | Touched entries omitted because of tombstones, expiry, or no committed version at the requested timestamp. A key present in memory and on disk can contribute from both sources. |
| `RevisionRowsExamined` | Revision-history rows traversed or read to resolve as-of values. RocksDB stores a revision row even for a key written once; backends without row-level accounting report one per as-of lookup. |
| `RevisionRunSeeks` | Seeks skipping the rest of a key's revision run; also counted by `kahuna.scan.revision_run_seeks_total`. |
| `IntentsMerged` | Committed prepared-intent overrides, injected keys, or removed keys applied to the page. |
| `PageRetries` | Transient retries before serving this page, including work from earlier attempts. |
| `ServedRemotely` | A peer served the page or part of it. |
| `DiskFallback` | The page merged a disk read rather than using only the resident walk. |

A nonterminal page examines an extra key beyond the returned limit to determine whether more data exists. The next page can examine that key again. Counts are therefore work performed, not unique keys. A retried page reports accumulated work, not just the successful attempt. Adding observations sums counts and ORs the boolean flags.

A null/absent observation means **unknown**, not zero: an older peer may not provide it, or a refusal may occur before a handler runs. Keep that distinction when comparing nodes during a rolling upgrade.

## Total a Streamed Scan

An embedding host can supply a sink to `IKahuna.LocateAndScanRange` and read it after enumeration:

```csharp
using Kahuna.Server.KeyValues;
using Kahuna.Shared.KeyValue;
using Kommander.Time;

KeyValueScanObservationSink observations = new();
await foreach (var item in kahuna.LocateAndScanRange(
    txId: HLCTimestamp.Zero,
    prefix: "orders/",
    startKey: null, startInclusive: true,
    endKey: null, endInclusive: false,
    pageSize: 256,
    readTimestamp: HLCTimestamp.Zero,
    durability: KeyValueDurability.Persistent,
    ct: cancellationToken,
    observations: observations))
{
    Process(item.Key, item.Entry);
}

Console.WriteLine($"Pages: {observations.Pages}, unknown: {observations.PagesUnobserved}");
Console.WriteLine($"Inspected: {observations.Total.EntriesInspected}");
```

The sink records served pages and retry counts. `Total` is complete only when `PagesUnobserved == 0`; early termination also leaves only the work accumulated so far. Use inspected/returned-row ratios to investigate read amplification, with backend, timestamp, retries, and unknown-page counts held in view. Per-page observations complement process-wide metrics; they do not establish a latency guarantee.

Bounded range reads pass inclusive/exclusive end keys into the backend and pending-write overlay, avoiding reads past the requested interval. The extra sentinel row is merged with the page rather than forcing a separate look-ahead disk read. Memory-backed pages can execute inline within an inspection budget; use `kahuna.scan.pages_read_on_actor_total` and `kahuna.scan.pages_read_on_scheduler_total` to distinguish execution paths. For many bounded seeks, see [Batched Probes](/docs/internals/batched-probes/).
