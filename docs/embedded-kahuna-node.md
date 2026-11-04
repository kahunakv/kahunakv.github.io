# Embedded Kahuna Node

Kahuna normally runs as a separate server that applications reach over the network. An embedded node runs the same engine inside your own .NET process instead: there is no server to install, no port to open, and no network call per operation.

Embed Kahuna when only your process needs the data. Run [Kahuna Server](/docs/server-installation/) when other applications or processes must share it: an embedded node exposes no REST or external gRPC endpoint, so they cannot connect to it.

Typical uses:

- **Integration tests** that need real Kahuna behavior, such as transactions, locks, scripts, and [Raft](/docs/glossary/#raft) replication, without Docker or a running cluster. [`EmbeddedKahunaCluster`](#in-memory-embedded-cluster) runs several nodes in one process so tests can also cover elections and failover.
- **Local tools and single-process applications** that want Kahuna's transactional key/value engine as a library.
- **Browser and WebAssembly hosts**, through the [thread-free build](#thread-free-browserwasm-mode).

`EmbeddedKahunaNode` starts a single-node Kahuna engine inside the current .NET process, without the ASP.NET server or Kestrel:

```csharp
using System.Text;
using Kahuna;
using Kahuna.Shared.KeyValue;
using Kommander.Time;

await using var node = new EmbeddedKahunaNode(new()
{
    Storage = "memory",
    WalStorage = "memory",
    InitialPartitions = 1
});

await node.StartAsync();
await node.WaitForLeaderForKeyAsync("tenant/table/key-a");

byte[] value = Encoding.UTF8.GetBytes("value-a");

await node.Kahuna.LocateAndTrySetKeyValue(
    transactionId: HLCTimestamp.Zero,
    key: "tenant/table/key-a",
    value: value,
    compareValue: null,
    compareRevision: -1,
    flags: KeyValueFlags.Set,
    expiresMs: 0,
    durability: KeyValueDurability.Persistent,
    cancellationToken: CancellationToken.None
);
```

## API

```csharp
public sealed class EmbeddedKahunaNode : IAsyncDisposable
{
    public IKahuna Kahuna { get; }
    public IRaft Raft { get; }

    public EmbeddedKahunaNode(
        EmbeddedKahunaOptions options,
        ILoggerFactory? loggerFactory = null
    );

    public Task StartAsync(CancellationToken cancellationToken = default);
    public Task<string> WaitForLeaderForKeyAsync(string key, CancellationToken cancellationToken = default);
    public ValueTask DisposeAsync();
}
```

## In-Memory Embedded Cluster

`EmbeddedKahunaCluster` starts several full Kahuna nodes in one process. Each member has its own storage, Raft log, [actors](/docs/glossary/#actor), and [partition](/docs/glossary/#partition) leadership. The members communicate through in-memory Kahuna and Raft transports, so no socket is opened, but replication, elections, failover, and catch-up still run.

Use it for integration tests, demos, and deterministic failure scenarios:

```csharp
await using EmbeddedKahunaCluster cluster =
    await EmbeddedKahunaCluster.CreateInMemoryAsync(
        3,
        new EmbeddedKahunaOptions
        {
            NodeName = "demo",
            Storage = "memory",
            WalStorage = "memory",
            InitialPartitions = 2
        },
        loggerFactory,
        cancellationToken
    );

EmbeddedKahunaNode node = cluster.GetNode(1);

int leader = await cluster.GetLeaderIndexAsync(0, cancellationToken);
await cluster.StopNodeAsync(leader);
await cluster.RestartNodeAsync(leader, cancellationToken);
```

`CreateInMemoryAsync` copies the base options for each member, assigns node ids `1..N`, names them `{NodeName}-{id}`, and assigns ports from `Port + index` or `7000 + index` when `Port` is `0`. Storage and WAL must both be `memory`, because a restarted member starts empty and catches up from the others.

Useful cluster operations:

| API | Purpose |
|-----|---------|
| `GetNode(index)` | Return a running embedded node. |
| `GetLeaderIndexAsync(partitionId)` | Poll until a running member believes it leads the partition. Treat the result as a routing hint during failover. |
| `StopNodeAsync(index)` | Stop a member as if its host crashed. Other members elect new leaders. |
| `RestartNodeAsync(index)` | Recreate a stopped member under the same endpoint and let it catch up. |
| `BlockLink(from, to)` / `BlockLinkBothWays(a, b)` | Drop in-memory traffic between members for partition tests. |
| `IsolateNode(index)` | Cut one member off from every other member while it keeps running. |
| `UnblockLink`, `UnblockLinkBothWays`, `UnblockAllLinks` | Restore blocked in-memory links. |

During failover, forwarded calls can fail with `KahunaServerException` or return `MustRetry` until a new leader is elected. Retry through the normal client or test harness path.

## Thread-Free Browser/WASM Mode

Kahuna also ships a thread-free embedded build for hosts that cannot create threads, especially `browser-wasm` with `WasmEnableThreads` disabled. Target `net10.0-browser` to select that build:

```xml
<Project Sdk="Microsoft.NET.Sdk.WebAssembly">
  <PropertyGroup>
    <TargetFramework>net10.0-browser</TargetFramework>
    <RuntimeIdentifier>browser-wasm</RuntimeIdentifier>
    <WasmEnableThreads>false</WasmEnableThreads>
  </PropertyGroup>
</Project>
```

Thread-free mode uses Kommander's host-pumped scheduler and only supports in-memory storage and WAL. It does not include the ASP.NET Core server surface, external gRPC/REST listeners, RocksDB, SQLite, or socket-based inter-node communication. Use `EmbeddedKahunaNode` or `EmbeddedKahunaCluster` with `Storage = "memory"` and `WalStorage = "memory"`.

```csharp
await using EmbeddedKahunaNode node = new(new EmbeddedKahunaOptions
{
    Storage = "memory",
    WalStorage = "memory",
    InitialPartitions = 1
}, loggerFactory);

await node.StartAsync(cancellationToken);
```

Keep host code fully asynchronous. Blocking waits such as `.Result`, `.Wait()`, or `GetAwaiter().GetResult()` can stall a single-threaded WebAssembly runtime. Avoid console loggers that start their own background thread.

In a browser cluster, every node and timer shares one event loop, so keep the embedded Raft timing defaults unless you have measured the heartbeat gaps. Set `MetricsSupport = true` when you want metrics under WebAssembly, since `System.Diagnostics.Metrics` is commonly disabled by default there.

Kahuna's REST and persistence JSON paths use source-generated metadata, so trimming and reflection-disabled WebAssembly builds do not need reflection-based JSON serialization for Kahuna payloads.

## Options

Options are properties of `EmbeddedKahunaOptions`. The groups follow [Server Configuration](/docs/server-configuration/); where a server flag exists, its section explains the same setting. Embedded names, units, and some defaults differ from the server flags.

### Node Identity

Related server flags: [Cluster Identity and Discovery](/docs/server-configuration/#cluster-identity-and-discovery).

| Option | Default | Description |
|--------|---------|-------------|
| `NodeName` | `embedded-1` | Logical node name. |
| `NodeId` | `1` | Raft node identifier. |
| `Host` | `localhost` | Must be a concrete host, not `*`. |
| `Port` | `0` | Unused by in-memory communication, but still part of the Raft configuration. |
| `InitialPartitions` | `1` | Number of Raft partitions. |
| `JoinExistingSeeds` | `null` | Seed endpoints for joining an existing embedded cluster through the cluster constructor. Null or empty boots from the configured discovery roster. |

### Storage and WAL

Related server flags: [Storage and WAL](/docs/server-configuration/#storage-and-wal).

| Option | Default | Description |
|--------|---------|-------------|
| `Storage` | `memory` | Key/value storage backend: `memory`, `sqlite`, or `rocksdb`. |
| `StoragePath` | empty | Storage directory for persistent backends. |
| `StorageRevision` | generated | Storage revision name. Keep stable when reopening persisted state; it also determines the automatic receive-staging directory. |
| `WalStorage` | `memory` | Raft WAL backend: `memory`, `sqlite`, or `rocksdb`. |
| `WalPath` | empty | WAL directory for persistent backends. |
| `WalRevision` | generated | WAL revision name. |
| `WalSyncWrites` | `true` | Require synchronous durable writes for RocksDB or SQLite WAL storage. |
| `StorageProviders` | `StorageProviders.CreateDefault()` | Storage engines the node can open by type name for `Storage` and `WalStorage`. The default registers Kahuna's own engines; register other engine types here before constructing the node. |
| `ExtensionOptions` | empty map | Engine-specific settings passed to each provider's `PersistenceBackendContext` or `WalContext`. See [Custom Storage Engines](/docs/storage/custom-storage-engines/). |
| `RaftWalShardWriteBufferSizeMb` | `null` | RocksDB Raft WAL shard memtable size in MiB. Null keeps Kommander's default. Applies only when `WalStorage` is `rocksdb`. |
| `RaftWalShardMinWriteBufferNumberToMerge` | `null` | Immutable memtables merged into one RocksDB WAL shard flush. Null keeps Kommander's default. |
| `RaftWalShardMaxWriteBufferNumber` | `null` | Maximum mutable plus immutable memtables per RocksDB WAL shard. Null keeps Kommander's default. |
| `RaftWalShardLevel0FileNumCompactionTrigger` | `null` | Level-0 file count that triggers compaction for RocksDB WAL shard column families. Null keeps Kommander's default. |
| `RaftWalShardLevel0SlowdownWritesTrigger` | `null` | Level-0 file count at which RocksDB starts slowing WAL writers. Null keeps Kommander's default. |
| `RaftWalShardLevel0StopWritesTrigger` | `null` | Level-0 file count at which RocksDB stops WAL writers. Null keeps Kommander's default. |
| `RaftWalShardMaxBytesForLevelBaseMb` | `null` | RocksDB `max_bytes_for_level_base` for WAL shard column families, in MiB. Null keeps Kommander or RocksDB defaults. |
| `RaftWalShardUniversalCompaction` | `null` | Selects universal compaction for RocksDB WAL shard column families when set to `true`; null keeps Kommander's default. |
| `RocksDbSharedMemoryEnabled` | `false` | Share one RocksDB block cache and write-buffer manager between the key/value backend and Raft WAL when both use RocksDB. |
| `StorageSharedCacheMb` | `0` | Cache budget in MiB shared by the store and WAL. Required above 0 for shared RocksDB memory. |
| `StorageSharedMemtableBudgetMb` | `0` | Shared memtable budget in MiB, charged inside the shared cache when present. Required above 0 for shared RocksDB memory. |
| `StorageCompactionRateBytesPerSec` | `0` | Throughput budget for materialized store flush and compaction writes; 0 is unlimited. |
| `StorageMaxBackgroundCompactions` | `0` | Maximum concurrent materialized store compactions; 0 keeps the backend default. |
| `RocksDbDirectReads` | `true` | Read RocksDB SST files with direct I/O so the RocksDB block cache is the primary read cache. Applies only when `Storage` is `rocksdb`. |
| `RocksDbStatistics` | `false` | Enable RocksDB internal statistics collection and LOG dumps every 60 seconds. Useful for tuning or diagnosis, but it adds per-operation overhead. Applies only when `Storage` is `rocksdb`. |

To bound RocksDB memory across both the embedded key/value backend and Raft WAL, enable shared RocksDB memory with both storage layers set to RocksDB:

```csharp
EmbeddedKahunaOptions options = new()
{
    Storage = "rocksdb",
    WalStorage = "rocksdb",
    RocksDbSharedMemoryEnabled = true,
    StorageSharedCacheMb = 512,
    StorageSharedMemtableBudgetMb = 128,
    RocksDbDirectReads = true,
    RocksDbStatistics = false
};
```

RocksDB uses these shared budgets only when both storage layers are `rocksdb` and `RocksDbSharedMemoryEnabled` is true. Custom providers can read the shared budgets and compaction settings from their context. The older `RocksDbSharedMemoryBudgetMb` and `RocksDbSharedMemtableBudgetMb` properties remain as obsolete aliases.

### Workers and Runtime

Related server flags: [Workers and Runtime](/docs/server-configuration/#workers-and-runtime).

| Option | Default | Description |
|--------|---------|-------------|
| `LocksWorkers` | `0` | Lock actors per durability ring. `0` auto-sizes to `max(32, CPU cores * 4)`. |
| `KeyValueWorkers` | `0` | Key/value actors per durability ring. `0` auto-sizes to `max(32, CPU cores * 4)`. |
| `BackgroundWriterWorkers` | `1` | Background persistence worker count. |
| `SequencerWorkers` | `0` | Sequence actors. `0` auto-sizes to `max(8, CPU cores)`. |
| `SequencerBlockSize` | `1000` | Values reserved from one durable sequence record per compare-and-set (CAS) for sequences without their own block size. Larger blocks reduce storage traffic but can leave larger gaps if an abandoned block is not fully issued. |
| `SequencerIdempotencyRetentionMax` | `256` | Maximum keyed sequence-reservation idempotency entries retained per sequence record. A non-positive value disables the count cap. |
| `SequencerIdempotencyRetentionTtl` | `10 minutes` | Window in which retrying a keyed sequence reservation replays the same allocation. `TimeSpan.Zero` disables age pruning. |
| `SequencerMaxSequencesPerActor` | `10000` | Maximum sequence records one sequence actor keeps resident before evicting least-recently-used records and abandoning their reserved blocks. A non-positive value leaves residency unbounded. |
| `SequencerBlockLease` | `5 seconds` | Maximum time a reserved sequence block can be served from memory before revalidation against the durable record. Safe sequence updates wait this long and refuse allocations during the wait. A non-positive value disables revalidation and sequence updates. |
| `BackendReadIOThreads` | `4` | Dedicated Kahuna backend read pool size for point gets, existence checks, read-before-write work, and scans. Separate from the Raft WAL read pool. |
| `BackendWriteIOThreads` | `1` | Dedicated Kahuna backend writer pool size for background batch writes and pruning. |
| `BackendReadQueueDepth` | `4096` | Per-partition pending queue depth for the backend read scheduler. |
| `ScanPageRetryBudgetMs` | `5000` | Maximum retry window for one range-scan page that keeps returning retryable state before the scan fails loudly with a retryable server error. |
| `Functions` | empty registry | User-defined script functions callable by this embedded node. Register functions before constructing the node. |
| `FunctionSlowWarnMs` | `50` | Logs a warning when a user-defined function takes longer than this many milliseconds. `0` disables the warning. |
| `FailFastOnOutOfMemory` | `true` | Fail fast on `OutOfMemoryException` so an orchestrator can restart the embedded process. When disabled, Kahuna records the fatal fault and reports unhealthy through health surfaces that expose the core state. |

### Transactions, Admission, and Scripts

Related server flags: [Workers and Runtime](/docs/server-configuration/#workers-and-runtime).

| Option | Default | Description |
|--------|---------|-------------|
| `SessionOwnedIntentCeilingMs` | `0` | Maximum age for session-owned write intents and no-expiry range locks after their owner disappears. `0` derives the ceiling from the transaction timeout, reaper grace, and participant-effect TTL. Prepared durable intents are exempt. |
| `StagedBaseFenceRetentionMs` | `600000` | How long the prepared-intent store remembers recently committed heads for validated-base fencing. Keep this above the longest transaction lifetime allowed by the deployment. Use the same value on every node when `OnePhaseApplyTimeValidation` is enabled. |
| `OnePhaseApplyTimeValidation` | `false` | Allows eligible read-modify-write and read-carrying durable transactions to use the one-phase fast path in multi-process Raft groups by validating their reads and bases at apply time against the replicated committed-head ledger. Enable only after every node in the group supports the ledger and gate. |
| `DefaultTransactionTimeout` | `5000` | Default transaction timeout in milliseconds. |
| `MaxTransactionTimeout` | `300000` | Maximum admitted interactive transaction timeout in milliseconds. Caller-provided timeouts are clamped to this bound. |
| `MaxConcurrentTransactions` | `0` | Script transactions that may execute concurrently before further ones queue and start in priority order. `0` disables the script admission gate. |
| `MaxConcurrentSessions` | `0` | Interactive transaction sessions that may be open concurrently before further ones queue and start in priority order. `0` disables the session admission gate. |
| `TransactionPriorityReservedSlots` | `0` | Slots out of each transaction concurrency ceiling that only `High` and `Critical` transactions may occupy. |
| `TransactionPriorityAgingThreshold` | `1000` | Milliseconds a queued transaction waits to gain one effective priority level. `0` disables aging. |
| `TransactionPriorityMaxQueued` | `4096` | Callers that may wait for an admission slot per gate before further ones receive `AdmissionRefused`. `0` makes the queue unbounded. |
| `DefaultAdmissionWaitMs` | `5000` | Admission wait used when the caller does not specify one. |
| `MaxAdmissionWaitMs` | `30000` | Maximum admission wait allowed by the embedded node. Caller-supplied waits are clamped to this value. |
| `StagedWriteIntentLeaseMs` | `15000` | Lease for staged writes before the commit probe. A successful probe holds the original intent through commit; cleanup or the session-owned ceiling bounds the hold. |
| `ScriptActorTurns` | `true` | Let eligible auto-commit scripts over one ephemeral key run inside one actor turn. |
| `FusedEphemeralFinalize` | `true` | Let a transaction whose whole write set is one ephemeral key finalize in one actor turn. |
| `ScriptCacheExpiration` | `1 minute` | How long parsed scripts stay cached. |
| `MaxScriptLength` | `65536` | Largest transaction script accepted, in bytes. Oversized scripts are refused before parsing. |
| `MaxScriptDepth` | `256` | Deepest transaction script syntax tree accepted. This bounds parser and evaluator stack use. |
| `TransactionOutcomeRetentionMax` | `10000` | Strict maximum retained terminal transaction outcomes. A non-positive value disables best-effort outcome retention. |
| `TransactionOutcomeRetentionTtl` | `5 minutes` | Age window for retained terminal transaction outcomes. A non-positive value disables age-based removal. |

### Client Request Limits

These options configure public REST/gRPC entry points; direct embedded operations do not inherit the key/value size, batch, or transaction mutation limits. Snapshot-hold bounds also apply to in-process hold calls. See [Key/Value Request Limits](/docs/distributed-keyvalue-store/request-limits/). `0` disables each bound.

| Option | Default | Description |
|--------|---------|-------------|
| `MaxKeyBytes` | `16384` | Maximum UTF-8 key bytes on client writes and transaction lock acquisition. |
| `MaxValueBytes` | `4194304` | Maximum value or compare-value bytes on client writes. |
| `MaxBatchItems` | `20000` | Maximum items in a client batch call. |
| `MaxTransactionMutations` | `20000` | Separate written-key and acquired-lock limits in client-started transactions. |
| `SnapshotHoldMaxLeaseMs` | `86400000` | Maximum requested lease on snapshot-hold acquire and renew. |
| `SnapshotHoldMaxPerHolder` | `4096` | Maximum registered snapshot holds per holder. |
| `SnapshotHoldMaxTotal` | `65536` | Maximum registered snapshot holds cluster-wide. |
| `AdminApiKeyFile` | `""` | Admin key file path. A custom HTTP/gRPC host must also [register the gate](/docs/admin-operations-authorization/#custom-hosts). |

### Caching and Collection

Related server flags: [Workers and Runtime](/docs/server-configuration/#workers-and-runtime).

| Option | Default | Description |
|--------|---------|-------------|
| `RevisionsToKeepCached` | `4` | Number of key revisions to keep cached in memory. |
| `TrimFlushedRevisions` | `false` | Trim persistent archived revisions after backend flush, retaining unflushed revisions and the snapshot-hold boundary. Historical reads may fall back to disk more often. |
| `PinnedValuePayloads` | `false` | Copy qualifying committed payloads to the pinned object heap; trades allocation/copy work for less GC relocation. |
| `PinnedValuePayloadMinBytes` | `256` | Minimum payload size for pinned allocation when enabled. |
| `CacheEntryTtl` | `5 minutes` | Age threshold used by lock cleanup and legacy cleanup paths. Key/value LRU eviction is budget-based. |
| `CacheEntriesToRemove` | `1000` | Maximum entries removed by cleanup paths that use this cap. Key/value collection uses `CollectBatchMax`. |
| `CollectionInterval` | `60 seconds` | Interval for cache collection and eviction checks. |
| `MaxEntriesPerActor` | `50000` | Maximum cached entries per actor before collection pressure applies. |
| `MaxBytesPerActor` | `268435456` | Approximate maximum cached bytes per actor before collection pressure applies. |
| `CollectBatchMax` | `1000` | Maximum number of entries evicted in one collection pass. |
| `RevisionRetention` | `4` | Recent revisions per key in memory. Persistent history can fall back to disk; ephemeral history older than this has no disk copy. |
| `DirtyObjectsWriterDelay` | `1000` | Delay between dirty object writer flush passes, in milliseconds. Longer values can increase batching but keep dirty persistent entries pinned in memory longer. |
| `CheckpointInterval` | `30 seconds` | Minimum checkpoint cadence for dirty partitions after flushes. Shorter intervals advance WAL compaction sooner; longer intervals reduce checkpoint churn. |

### Durable Transactions

Related server flags: [Durable Transaction Retention](/docs/server-configuration/#durable-transaction-retention).

| Option | Default | Description |
|--------|---------|-------------|
| `CompletionReceiptRetentionTtl` | `10 minutes` | Age after which orphaned durable completion receipts can be dropped once their transaction record has already been reclaimed. |
| `DurableDecisionOutstandingMax` | `100000` | Maximum outstanding undecided canonical durable transaction records admitted by this node. Completed records do not count against this budget. |
| `DurableDecisionDeadlineFloorMs` | `5000` | Lower clamp for the durable transaction decision-deadline margin. |
| `DurableDecisionDeadlineCeilingMs` | `60000` | Upper clamp for the durable transaction decision-deadline margin. |
| `DurableDecisionDeadlineMaxExtensions` | `8` | How many times one finalize attempt may renew its decision-deadline lease while it waits productively, for example on settlement of a decided predecessor, so slow settlement does not turn a healthy commit into a presumed abort. `0` disables renewal. |
| `DurableRecordRetentionMax` | `200000` | Maximum retained terminal durable transaction records per node before older records are reclaimed early. A non-positive value disables the count budget. |
| `DurableRecordRetentionMaxBytes` | `268435456` | Estimated heap-byte budget for terminal durable transaction records plus completion receipts. A non-positive value disables the byte budget. |
| `DurableRecordRetentionHeapPressure` | `0.85` | Managed-heap load ratio above which terminal records older than the retention floor are reclaimed aggressively. A non-positive value disables this pressure valve. |
| `DurableRecordRetentionFloor` | `90 seconds` | Minimum age below which terminal durable records are not reclaimed early by count, byte, or heap-pressure budgets. |
| `DurableMaintenanceInterval` | `5 seconds` | Tick interval for prepared-intent recovery and durable record-retention sweeps. `TimeSpan.Zero` uses `CollectionInterval`. |
| `DurableRecordGcMaxPerPass` | `4096` | Maximum terminal transaction records reclaimed in one retention sweep batch. |
| `DurableDeferredSettlement` | `true` | Return from durable commit once the canonical decision record is durable, then materialize values and settle intents in the background. Set `false` to await settlement inline. |
| `DurableMaterializeOnResolve` | `false` | Install values from local prepared intents during settlement apply, before removing them. Overrides by-reference materialization; enable only after every replica supports this encoding. See [Durable Settlement](/docs/internals/durable-settlement/). |
| `DurableMaterializeByReference` | `true` | Materialize committed durable transactions with a value-free record that references the prepared intent already held by each replica. Set `false` only during mixed-version rollouts from builds that cannot apply `MaterializeIntent`. |
| `DurablePreparedIntentMaxCount` | `500000` | Resident prepared-intent count bound for durable transactions. A non-positive value disables the count bound. |
| `DurablePreparedIntentMaxBytes` | `1073741824` | Resident prepared-intent value-byte bound for durable transactions. A non-positive value disables the byte bound. |

### Key/Value Watch and History

Related server flags: [Key/Value Watch and History](/docs/server-configuration/#keyvalue-watch-and-history). See [Watch Persistent Key Changes](/docs/distributed-keyvalue-store/watches/).

| Option | Default | Description |
|--------|---------|-------------|
| `CommitAdmissionLagMs` | `0` | Milliseconds a commit timestamp may trail the log entry that carries it. A positive value enables watch progress watermarks and resume; `0` keeps live watches only. Use the same value on every node, and only when every node understands it. |
| `HistoryHoldMaxLeaseMs` | `86400000` (one day) | Longest lease a history hold may request. `0` removes the bound. |
| `HistoryHoldMaxPerHolder` | `4096` | Maximum history holds one holder may register. `0` removes the bound. |
| `HistoryHoldMaxTotal` | `65536` | Maximum history holds in the registry. `0` removes the bound. |
| `WatchMaxCapacity` | `65536` | Largest frame capacity a watch may request. |
| `WatchMaxBufferedBytes` | `67108864` (64 MiB) | Bytes one watch may buffer for a slow reader before it ends with an overflow. |
| `WatchMaxPerNode` | `65536` | Most watches open on the node at once. `0` removes the bound. |
| `WatchMaxPerCall` | `1024` | Most watches one gRPC watch call may hold open. `0` removes the bound. |
| `WatchMaxConcurrentReplays` | `64` | Most watch replays (one per resumed partition) the node runs at once. `0` removes the bound. |
| `TransactionOriginTags` | `false` | Keep a transaction's origin label in its prepared intents so watch events carry it. Enable only when every node understands it. |

### Key/Value Write Coalescing

Related server flags: [Key/Value Write Coalescing](/docs/server-configuration/#keyvalue-write-coalescing).

| Option | Default | Description |
|--------|---------|-------------|
| `KeyValueWriteLingerMs` | `1` | Delay from the oldest queued persistent partition write before a partition batch is proposed. `0` dispatches an idle partition immediately. |
| `KeyValueWritePostCompletionHoldMs` | `0` | Optional hold after a partition batch completes before the next sub-threshold batch is dispatched. This can improve batch density under saturated same-partition write load. |
| `KeyValueWriteMaxBatchItems` | `512` | Maximum log entries selected for one partition write coalescing Raft call. |
| `KeyValueWriteMaxInFlightBatchesPerPartition` | `1` | Maximum coalesced batches a partition may have awaiting Raft results at once. Higher values pipeline quorum waits while preserving FIFO dispatch order. |
| `KeyValueWriteMaxBatchBytes` | `4194304` | Target serialized bytes selected for one partition write coalescing Raft call. |
| `KeyValueWritePreciseWake` | `false` | Use one dedicated timer thread per node for linger, hold, and queue-age wakes; sleeps whole milliseconds and spins the remainder. |
| `KeyValueWriteFillTargetTrigger` | `false` | Dispatch held/lingering buffers early at the learned submission-count target, with periodic timed probes. |
| `PublishedHeadReads` | `true` | Serve quiet resident latest point gets from immutable published heads after leadership confirmation; fall back to actors whenever guards fail. |
| `KeyValueWriteMaxQueuedItemsPerPartition` | `8192` | Maximum admitted persistent submissions per partition, including writes already in flight. |
| `KeyValueWriteMaxQueuedBytesPerPartition` | `33554432` | Maximum admitted serialized bytes per partition, including writes already in flight. |
| `KeyValueWriteMaxQueueDelayMs` | `1000` | Maximum pre-dispatch wait before a queued write is released as `MustRetry`. |
| `MaxKeyValueWriteAggregatorInboxSize` | `16384` | Ordinary-submission inbox bound per aggregator lane. Control messages are exempt. |
| `PersistenceMaxUnflushedItems` | `1000000` | Maximum committed key/value writes held in memory awaiting background flush before ordinary writes receive retryable backpressure. `0` disables the bound. |
| `PersistenceMaxUnflushedBytes` | `536870912` | Maximum value bytes held in memory awaiting background flush before ordinary writes receive retryable backpressure. `0` disables the bound. |
| `PersistenceWriteStallWarnMs` | `500` | Milliseconds an in-flight backend store write may stay unacknowledged before the node logs a stall warning. `0` disables the log lines; the stall gauge and store-write histogram are always published. |

### Persistent Revision Retention

Related server flags: [Persistent Revision Retention](/docs/server-configuration/#persistent-revision-retention).

| Option | Default | Description |
|--------|---------|-------------|
| `PersistentRevisionRetentionCount` | `0` | Maximum persisted revisions retained per key. `0` keeps every revision. |
| `PersistentRevisionRetentionAge` | `0` | Maximum persisted revision age. `TimeSpan.Zero` disables age-based retention. |
| `PersistentRevisionCleanupInterval` | `5 minutes` | Minimum interval between full persistent-revision cleanup sweeps. |
| `PersistentRevisionCleanupBatchSize` | `10000` | Maximum revision records deleted per cleanup pass. |
| `PersistentRevisionCleanupOnWrite` | `true` | Queue keys touched by writes for targeted revision cleanup. |
| `PersistentRevisionCleanupTimeBudget` | `250 ms` | Wall-clock budget for one targeted persistent revision cleanup pass during a flush cycle. |

Live [snapshot holds](/docs/distributed-keyvalue-store/snapshot-holds/) clamp persistent revision cleanup. While a hold is active, the boundary revision needed by the held timestamp and every newer revision are kept even if `PersistentRevisionRetentionCount` or `PersistentRevisionRetentionAge` would otherwise remove them.

### Backups and Point-in-Time Recovery

Related server flags: [Backups and Point-in-Time Recovery](/docs/server-configuration/#backups-and-point-in-time-recovery).

| Option | Default | Description |
|--------|---------|-------------|
| `PitrWindow` | `1 hour` | Recoverable WAL history. Values are normalized to more than zero and at most 6 hours. |
| `BaseSnapshotInterval` | `30 minutes` | Intended interval between base checkpoints. It must be positive and no greater than `PitrWindow`. It also contributes to the protected WAL floor. |
| `BackupDir` | empty | Root directory for backup manifests and artifacts. Backup methods on `node.Kahuna` are disabled when empty. |
| `BackupTarget` | `local` | Backup storage target. `local` uses `BackupDir`; other target names require `BackupStorageProvider`. |
| `BackupScratchDir` | empty | Local staging directory for backup targets that cannot receive checkpoints directly. Size it for one full backup. |
| `BackupStorageProvider` | `null` | Host-supplied factory for object storage or another non-local backup target. Null uses the local directory implementation. |
| `BackupClusterId` | empty | Operator-assigned cluster identity stamped into backup manifests. Use the same value on every node. |
| `BackupMacKeyFile` | empty | Path to the HMAC-SHA-256 key file used to authenticate backup manifests. Keep it outside `BackupDir`. |
| `RestoreRoot` | empty | Server-owned root directory that restore targets must be contained within. Setting it enables confined remote restore. |
| `AllowUnconfinedRemoteRestore` | `false` | Allows remote restore without `RestoreRoot`. Use only in trusted administrative environments. |
| `BackupRetentionMaxChains` | `0` | Keep at most this many most-recent backup chains. `0` is unbounded. Retention is off unless at least one retention bound is set. |
| `BackupRetentionMaxAge` | `0` | Delete backup chains whose newest backup is older than this age. `TimeSpan.Zero` is unbounded. |
| `BackupRetentionMaxBytes` | `0` | Keep the most-recent backup chains within this artifact byte budget. The newest chain is always kept. `0` is unbounded. |
| `BackupGcInterval` | `1 hour` | Periodic backup garbage-collection cadence. `TimeSpan.Zero` disables the periodic pass, but GC still runs after backups. |
| `BackupCaptureThrottleBytesPerSec` | `0` | Per-capture byte budget for RocksDB image trim/compaction, hash/verify, and staged copy. Non-positive is unlimited. |
| `BackupApplyBarrierTimeout` | `30 seconds` | Full-capture apply wait; a lagging replica refuses with `PartitionCaptureFailed`. Non-positive uses the default. |
| `BackupRestoreThrottleBytesPerSec` | `0` | Throughput budget for a restore checkpoint copy. `0` is unlimited. |

### Key-Range Split and Merge

Related server flags: [Key-Range Split and Merge](/docs/server-configuration/#key-range-split-and-merge).

| Option | Default | Description |
|--------|---------|-------------|
| `RangeSplitThreshold` | `1000` | Sampled key count that triggers count-based range splitting. `0` disables this trigger. |
| `RangeSplitMinRangeSize` | `10` | Minimum sampled keys required in each child range. |
| `RangeMergeMinSize` | `10` | Adjacent key ranges smaller than this value can be considered for automatic merging. `0` disables automatic merge. |
| `RangeSplitLoadThreshold` | `0` | Replicated writes per second required for load-based splitting. `0` disables this trigger. |
| `RangeSplitLoadMinQueueDepth` | `8` | WAL backlog required alongside the load threshold. |
| `RangeSplitLoadMinCommitWaitMs` | `0` | Optional commit-wait gate in milliseconds. `0` disables it. |
| `RangeSplitLoadWindow` | `15 seconds` | Time the complete load predicate must remain satisfied. |
| `RangeSplitLoadPollInterval` | `5 seconds` | Frequency of load-based split checks. |
| `RangeSplitLoadImbalanceMax` | `0.8` | Maximum acceptable write fraction assigned to either child. |
| `RangeSplitIndivisibleCooldown` | `5 minutes` | Delay before reconsidering an indivisible range. |
| `RangeSplitSettleWindow` | `10 seconds` | Post-split delay before evaluating either child again. |
| `RangeMoveSettleTimeout` | `10 seconds` | Maximum quiesce wait for in-flight transactions in a moving range before split or merge cutover. |
| `RangeMoveQuiesceTtl` | `30 seconds` | Lifetime of a split/merge write fence. An exhausted window refuses cutover. Minimum 1 second. |
| `RangeMaxRangesPerKeySpace` | `0` | Per-key-space range quota; `0` is unbounded. |

### Leader Balancing

Related server flags: [Raft Leader Balancing](/docs/server-configuration/#raft-leader-balancing).

| Option | Default | Description |
|--------|---------|-------------|
| `EnableLeaderBalancer` | `false` | Enable cross-node load reports and leader redistribution. Required with load splitting. |
| `LeaderBalancerReportInterval` | `5 seconds` | Interval between node load reports. |
| `LeaderBalancerInterval` | `30 seconds` | Interval between balancing passes. |
| `LeaderBalancerReportTtl` | `20 seconds` | Maximum accepted load-report age. |
| `MinLeaderStability` | `5 seconds` | Minimum leadership age before transfer. |
| `LeaderBalancerOpsWeight` | `1.0` | Operations-per-second weight in the balancer load score. |
| `LeaderBalancerQueueWeight` | `0.5` | Queue-depth weight in the balancer load score. |

### Replica Placement and Membership

Related server flags: [Replica Placement](/docs/server-configuration/#replica-placement).

| Option | Default | Description |
|--------|---------|-------------|
| `MaxPartitions` | `0` | Maximum data partitions cluster-wide; `0` is unbounded. A positive value must be at least `InitialPartitions`. Set identically on all nodes. |
| `ReplicationFactor` | `0` | Desired voter replicas per partition. `0` keeps full replication. Prefer odd values such as `3` or `5` in multi-node deployments. |
| `EnablePlacementRebalancer` | `false` | Enable ongoing replica-placement repair and balancing. Initial placement still applies when `ReplicationFactor` is positive. |
| `JoinTimeout` | `60 seconds` | Join admission/initialization ceiling; does not bound the learner promotion wait. |
| `JoinPromotionStallTimeout` | `5 minutes` | No-progress ceiling during learner promotion, not total catch-up duration. |
| `StartupLeaderWait` | `Timeout.InfiniteTimeSpan` | How long `StartAsync` waits for a partition to elect a leader before the start fails. The default waits until the start is cancelled or the node is disposed, so a node that restarts during a leaderless moment keeps its vote available. Set a finite value only when a supervisor restarts the process instead. |
| `PlacementPassInterval` | `5 seconds` | Cadence for placement-controller passes. Commit-triggered passes can still run immediately. |
| `MaxReplicaMovesPerPass` | `4` | Maximum new replica add/remove sequences started in one placement pass across repair and balance priorities. |
| `MaxConcurrentReplicaTransfers` | `1` | Maximum partitions with an in-flight learner catch-up or replica removal caused by balance moves. |
| `MaxConcurrentReplicaRepairs` | `3` | Maximum in-flight repair moves for under-replicated ranges or replicas stranded on departed nodes. |
| `DecommissionDrainTimeout` | `2 minutes` | Graceful leave wait for evacuating this node's hosted replicas before removal. |
| `ReplicaCountDeadband` | `1` | Replica-count imbalance tolerated before balance moves start. |
| `Zone` | `null` | Optional zone or rack hint used to spread replicas across failure domains. |
| `EnableLoadReports` | `false` | Gossip per-partition load reports even when leader balancing, placement rebalancing, or replication factor did not already enable them. |

### Raft Communication

Related server flags: [Raft Communication](/docs/server-configuration/#raft-communication).

| Option | Default | Description |
|--------|---------|-------------|
| `ReadIOThreads` | `4` | Number of Raft read I/O threads. |
| `WriteIOThreads` | `8` | Number of Raft write I/O threads. |
| `EnableSharedExecutorPool` | `true` | Share a bounded worker pool across Raft partitions instead of using one OS thread per partition. |
| `PartitionExecutorPoolSize` | `0` | Shared Raft executor worker count. `0` auto-sizes to the processor count. |
| `EnableHostPumpedScheduling` | `true` | Thread-free build (`net10.0-browser`) only. Runs Kommander's scheduling work as async continuations on the host's scheduler, such as the browser event loop, instead of on worker threads. Requires `EnableSharedExecutorPool` and `memory` storage and WAL. Set it to `false` only when something else pumps the node. |
| `HttpScheme` | `https://` | HTTP scheme used by Raft REST communication. |
| `HttpAuthBearerToken` | empty | Bearer token sent with Raft REST communication. |
| `TransportSecurity` | `null` | Optional node-to-node transport security options passed to Kommander. Embedded in-memory peers do not need it, but custom hosts that expose Kahuna gRPC services on a real transport use it for node-only trust checks. |
| `HttpTimeout` | `5` | Raft REST request timeout in seconds. |
| `HttpVersion` | `2.0` | HTTP protocol version used by Raft REST communication. |

Snapshot receive staging and deadline options (`RaftSnapshotMaxPendingBytes`, `RaftSnapshotMaxPendingSessions`, `RaftSnapshotStagingDirectory`, `RaftSnapshotStagingMemoryBytes`, `RaftSnapshotChunkAckTimeout`, and `RaftSnapshotTransferStepTimeout`) are nullable and keep Kommander defaults unless set. Their defaults, validation rules, automatic staging directory, and an embedded example are in [Snapshot Options](/docs/snapshot-and-raft-recovery/#snapshot-options). Server follower-apply scheduling and live-replica lag-window/cap flags have no matching embedded options.

### Raft Timing

Related server flags: [Raft Timing](/docs/server-configuration/#raft-timing).

| Option | Default | Description |
|--------|---------|-------------|
| `HeartbeatInterval` | `100 ms` | Leader heartbeat interval. |
| `RecentHeartbeat` | `HeartbeatInterval / 4` | Recent-heartbeat de-duplication window. Leave unset to track the heartbeat cadence safely; set explicitly only when it remains below `HeartbeatInterval`. |
| `VotingTimeout` | `1500 ms` | Vote wait timeout. |
| `EnableCheckQuorum` | `true` | Clustered embedded nodes honor this option. The standalone node constructor forces it off, along with backfill, because its phantom witnesses are not real replicas. |
| `CheckQuorumIntervalMultiplier` | `0` | Heartbeat intervals without majority acknowledgement before check-quorum steps down a leader. `0` derives the window from `StartElectionTimeout`. |
| `CheckLeaderInterval` | `250 ms` | Leader check interval. |
| `TimerInitialDelay` | `2500 ms` | Initial delay before Raft timers start. |
| `UpdateNodesInterval` | `5000 ms` | Node registry update interval. |
| `StartElectionTimeout` | `500` | Minimum election timeout in milliseconds. |
| `EndElectionTimeout` | `1500` | Maximum election timeout in milliseconds. |
| `StartElectionTimeoutIncrement` | `100` | Minimum election timeout increment in milliseconds. |
| `EndElectionTimeoutIncrement` | `200` | Maximum election timeout increment in milliseconds. |

### Raft Logging, Batching, and Compaction

Related server flags: [Raft Logging and Compaction](/docs/server-configuration/#raft-logging-and-compaction).

| Option | Default | Description |
|--------|---------|-------------|
| `SlowRaftStateMachineLog` | `50` | Slow state-machine operation log threshold in milliseconds. |
| `SlowRaftWALMachineLog` | `25` | Slow WAL state-machine operation log threshold in milliseconds. |
| `RaftMaxWalGroupBatchPartitions` | `64` | Maximum partitions coalesced into one cross-partition WAL group-commit batch. |
| `RaftWalGroupCommitLingerMs` | `0` | Optional group-commit linger window in milliseconds. `0` disables linger. |
| `RaftWalSingleFsyncCommit` | `false` | Enables Kommander's single-fsync commit fast path for embedded nodes. Server defaults differ; embedded hosts opt in explicitly. |
| `CompactEveryOperations` | `1000` | Number of committed operations between automatic Raft WAL compaction checks. |
| `CompactNumberEntries` | `50` | Number of Raft WAL entries removed per compaction batch. |
| `MaxEntriesPerCompaction` | `5000` | Maximum Raft WAL entries processed per compaction run. |

## Notes

- The embedded node uses in-memory Raft and inter-node communication.
- `StartAsync` joins the single-node cluster and waits for leaders for the configured partitions.
- `WaitForLeaderForKeyAsync` waits for the partition that owns a specific key.
- Use distinct `StoragePath` and `WalPath` values when using `sqlite` or `rocksdb`.
- Set `BackupDir` to enable backup, catalog, and offline restore methods through `node.Kahuna`. See [Backups and Point-in-Time Recovery](/docs/backups-and-point-in-time-recovery/).
- Load-based splitting requires a multi-node embedded deployment, key-range-routed spaces, and `EnableLeaderBalancer = true`. See [Load-Based Range Splitting](/docs/distributed-keyvalue-store/load-based-range-splitting/).
- Positive `ReplicationFactor` values are intended for multi-node embedded deployments. `0` keeps the single-node/full-replication default. See [Replication Factor and Replica Placement](/docs/replica-placement/).
- Use `EmbeddedKahunaCluster.CreateInMemoryAsync` when tests need leader election, failover, restart, or network-partition behavior without Docker or sockets.
- Always dispose the node with `await using` or `DisposeAsync` to stop local Raft/actors and release resources. Disposal is not an operator membership-removal guarantee; explicitly decommission clustered nodes when removing them from the roster.

## Disposal and In-Flight Work

`DisposeAsync` first signals background maintenance to stop, then drains the partition write aggregator while Raft and replication callbacks are still attached. Queued writes are released retryably; in-flight durable batches can still obtain ordered apply results. The write drain has a five-second budget. After callbacks detach, parked durable completions are released as unobserved rather than waiting for an apply that can no longer arrive.

Raft is then disposed and actors receive a separate five-second graceful-stop budget. These are per-stage limits, not a guarantee that the entire dispose takes five seconds or that every pending transaction and backend row is flushed. A shutdown result can remain uncertain; do not infer rollback from an unobserved completion. Logs report drain, Raft-dispose, and actor-stop durations for diagnosing slow teardown.

## Internal Defaults

These `KahunaConfiguration` fields keep their internal defaults: neither `Kahuna.Server` command-line flags nor `EmbeddedKahunaOptions` expose them. They are listed for reference:

| Option | Default | Description |
|--------|---------|-------------|
| `ScriptCacheMaxEntries` | `1000` | Maximum parsed scripts retained in the server-side script cache. New entries are dropped when the limit is reached. |
| `MaxKeyValueActorInboxSize` | `16384` | Maximum ordinary user messages queued in one key/value actor before new ordinary messages receive retryable backpressure. Control messages such as completions, cache-coherence updates, and maintenance are exempt. `0` disables the bound. |
| `KeyValueWriteTerminalReserveItemsPerPartition` | `256` | Extra per-partition item headroom reserved for terminal durable transaction work such as decision, materialization, settlement, recovery, and metadata handoff. |
| `KeyValueWriteTerminalReserveBytesPerPartition` | `4194304` | Extra per-partition byte headroom reserved for terminal durable transaction work. |
| `KeyValueWriteMaxQueuedItemsGlobal` | `131072` | Node-wide ordinary submission item cap across all partitions. |
| `KeyValueWriteMaxQueuedBytesGlobal` | `536870912` | Node-wide ordinary submission byte cap across all partitions. |
| `KeyValueWriteTerminalReserveItemsGlobal` | `8192` | Node-wide item headroom reserved for terminal durable transaction work. |
| `KeyValueWriteTerminalReserveBytesGlobal` | `67108864` | Node-wide byte headroom reserved for terminal durable transaction work. |
| `KeyValueWriteMaxOperationBytes` | `67108864` | Hard ceiling for one admitted serialized partition write. Values above the ceiling are rejected retryably. |
| `KeyValueWriteBatchExecutionTimeoutMs` | `30000` | Maximum Raft round-trip time for one aggregator batch before the batch is released retryably. |
| `DurableRecoveryMaxPartitionsPerPass` | `64` | Maximum partitions driven by prepared-intent recovery in one sweep. |
| `DurableDecisionDeadlineMultiplier` | `4` | Multiplier applied to the larger of total finalize p99 and per-intent p99 × manifest size, before clamping the decision-deadline margin. |
| `SnapshotHoldStartupGraceWindow` | `5 minutes` | Grace window for durable snapshot holds loaded after restart. Expired holds restored from disk are protected briefly so holders can renew before cleanup advances the snapshot floor. |

`HttpsTrustedThumbprint` also exists on `KahunaConfiguration`, but it is derived from `HttpsCertificate` by configuration validation rather than being an independent operator setting.
