# Embedded Kahuna Node

`EmbeddedKahunaNode` starts a single-node Kahuna engine inside the current .NET process. It is useful for integration tests, local tools, and applications that need Kahuna's transaction engine without running the ASP.NET server, Kestrel, REST, or external gRPC endpoints.

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

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `NodeName` | `embedded-1` | Logical node name. |
| `NodeId` | `1` | Raft node identifier. |
| `Host` | `localhost` | Must be a concrete host, not `*`. |
| `Port` | `0` | Unused by in-memory communication, but still part of the Raft configuration. |
| `InitialPartitions` | `1` | Number of Raft partitions. |
| `Storage` | `memory` | Key/value storage backend: `memory`, `sqlite`, or `rocksdb`. |
| `StoragePath` | empty | Storage directory for persistent backends. |
| `StorageRevision` | generated | Storage revision name. |
| `WalStorage` | `memory` | Raft WAL backend: `memory`, `sqlite`, or `rocksdb`. |
| `WalPath` | empty | WAL directory for persistent backends. |
| `WalRevision` | generated | WAL revision name. |
| `WalSyncWrites` | `true` | Require synchronous durable writes for RocksDB or SQLite WAL storage. |
| `RocksDbSharedMemoryEnabled` | `false` | Share one RocksDB block cache and write-buffer manager between the key/value backend and Raft WAL when both use RocksDB. |
| `RocksDbSharedMemoryBudgetMb` | `320` | Total shared RocksDB block-cache budget in MiB. The memtable sub-budget is charged inside this total. |
| `RocksDbSharedMemtableBudgetMb` | `128` | Shared RocksDB memtable sub-budget in MiB. Must be less than or equal to `RocksDbSharedMemoryBudgetMb`. |
| `RocksDbDirectReads` | `true` | Read RocksDB SST files with direct I/O so the RocksDB block cache is the primary read cache. Applies only when `Storage` is `rocksdb`. |
| `RocksDbStatistics` | `false` | Enable RocksDB internal statistics collection and LOG dumps every 60 seconds. Useful for tuning or diagnosis, but it adds per-operation overhead. Applies only when `Storage` is `rocksdb`. |
| `LocksWorkers` | `Environment.ProcessorCount` | Lock worker count. |
| `KeyValueWorkers` | `Environment.ProcessorCount` | Key/value worker count. |
| `BackgroundWriterWorkers` | `1` | Background persistence worker count. |
| `BackendReadIOThreads` | `4` | Dedicated Kahuna backend read pool size for point gets, existence checks, read-before-write work, and scans. Separate from the Raft WAL read pool. |
| `BackendWriteIOThreads` | `1` | Dedicated Kahuna backend writer pool size for background batch writes and pruning. |
| `BackendReadQueueDepth` | `4096` | Per-partition pending queue depth for the backend read scheduler. |
| `DefaultTransactionTimeout` | `5000` | Default transaction timeout in milliseconds. |
| `MaxTransactionTimeout` | `300000` | Maximum admitted interactive transaction timeout in milliseconds. Caller-provided timeouts are clamped to this bound. |
| `MaxConcurrentTransactions` | `0` | Script transactions that may execute concurrently before further ones queue and start in priority order. `0` disables the script admission gate. |
| `MaxConcurrentSessions` | `0` | Interactive transaction sessions that may be open concurrently before further ones queue and start in priority order. `0` disables the session admission gate. |
| `TransactionPriorityReservedSlots` | `0` | Slots out of each transaction concurrency ceiling that only `High` and `Critical` transactions may occupy. |
| `TransactionPriorityAgingThreshold` | `1000` | Milliseconds a queued transaction waits to gain one effective priority level. `0` disables aging. |
| `TransactionPriorityMaxQueued` | `4096` | Callers that may wait for an admission slot per gate before further ones receive `AdmissionRefused`. `0` makes the queue unbounded. |
| `DefaultAdmissionWaitMs` | `5000` | Admission wait used when the caller does not specify one. |
| `MaxAdmissionWaitMs` | `30000` | Maximum admission wait allowed by the embedded node. Caller-supplied waits are clamped to this value. |
| `ScriptCacheExpiration` | `1 minute` | How long parsed scripts stay cached. |
| `RevisionsToKeepCached` | `100` | Number of key revisions to keep cached in memory. |
| `CacheEntryTtl` | `5 minutes` | Age threshold used by lock cleanup and legacy cleanup paths. Key/value LRU eviction is budget-based. |
| `CacheEntriesToRemove` | `1000` | Maximum entries removed by cleanup paths that use this cap. Key/value collection uses `CollectBatchMax`. |
| `CollectionInterval` | `60 seconds` | Interval for cache collection and eviction checks. |
| `TransactionOutcomeRetentionMax` | `10000` | Strict maximum retained terminal transaction outcomes. A non-positive value disables best-effort outcome retention. |
| `TransactionOutcomeRetentionTtl` | `5 minutes` | Age window for retained terminal transaction outcomes. A non-positive value disables age-based removal. |
| `DurableDecisionOutstandingMax` | `100000` | Maximum outstanding undecided canonical durable transaction records admitted by this node. Completed records do not count against this budget. |
| `DurableDeferredSettlement` | `true` | Return from durable commit once the canonical decision record is durable, then materialize values and settle intents in the background. Set `false` to await settlement inline. |
| `DurablePreparedIntentMaxCount` | `500000` | Resident prepared-intent count bound for durable transactions. A non-positive value disables the count bound. |
| `DurablePreparedIntentMaxBytes` | `1073741824` | Resident prepared-intent value-byte bound for durable transactions. A non-positive value disables the byte bound. |
| `MaxEntriesPerActor` | `50000` | Maximum cached entries per actor before collection pressure applies. |
| `MaxBytesPerActor` | `268435456` | Approximate maximum cached bytes per actor before collection pressure applies. |
| `CollectBatchMax` | `1000` | Maximum number of entries evicted in one collection pass. |
| `RevisionRetention` | `16` | Number of revisions retained for in-memory revision history. |
| `DirtyObjectsWriterDelay` | `1000` | Delay between dirty object writer flush passes, in milliseconds. Longer values can increase batching but keep dirty persistent entries pinned in memory longer. |
| `KeyValueWriteLingerMs` | `1` | Delay from the oldest queued persistent partition write before a partition batch is proposed. `0` dispatches an idle partition immediately. |
| `KeyValueWriteMaxBatchItems` | `512` | Maximum log entries selected for one partition write coalescing Raft call. |
| `KeyValueWriteMaxBatchBytes` | `4194304` | Target serialized bytes selected for one partition write coalescing Raft call. |
| `KeyValueWriteMaxQueuedItemsPerPartition` | `8192` | Maximum admitted persistent submissions per partition, including writes already in flight. |
| `KeyValueWriteMaxQueuedBytesPerPartition` | `33554432` | Maximum admitted serialized bytes per partition, including writes already in flight. |
| `KeyValueWriteMaxQueueDelayMs` | `1000` | Maximum pre-dispatch wait before a queued write is released as `MustRetry`. |
| `MaxKeyValueWriteAggregatorInboxSize` | `16384` | Ordinary-submission inbox bound per aggregator lane. Control messages are exempt. |
| `PersistentRevisionRetentionCount` | `0` | Maximum persisted revisions retained per key. `0` keeps every revision. |
| `PersistentRevisionRetentionAge` | `0` | Maximum persisted revision age. `TimeSpan.Zero` disables age-based retention. |
| `PersistentRevisionCleanupInterval` | `5 minutes` | Minimum interval between full persistent-revision cleanup sweeps. |
| `PersistentRevisionCleanupBatchSize` | `1000` | Maximum revision records deleted per cleanup pass. |
| `PersistentRevisionCleanupOnWrite` | `true` | Queue keys touched by writes for targeted revision cleanup. |
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
| `BackupRestoreThrottleBytesPerSec` | `0` | Throughput budget for a restore checkpoint copy. `0` is unlimited. |
| `RangeSplitThreshold` | `1000` | Sampled key count that triggers count-based range splitting. `0` disables this trigger. |
| `RangeSplitMinRangeSize` | `10` | Minimum sampled keys required in each child range. |
| `RangeSplitLoadThreshold` | `0` | Replicated writes per second required for load-based splitting. `0` disables this trigger. |
| `RangeSplitLoadMinQueueDepth` | `8` | WAL backlog required alongside the load threshold. |
| `RangeSplitLoadMinCommitWaitMs` | `0` | Optional commit-wait gate in milliseconds. `0` disables it. |
| `RangeSplitLoadWindow` | `15 seconds` | Time the complete load predicate must remain satisfied. |
| `RangeSplitLoadPollInterval` | `5 seconds` | Frequency of load-based split checks. |
| `RangeSplitLoadImbalanceMax` | `0.8` | Maximum acceptable write fraction assigned to either child. |
| `RangeSplitIndivisibleCooldown` | `5 minutes` | Delay before reconsidering an indivisible range. |
| `RangeSplitSettleWindow` | `10 seconds` | Post-split delay before evaluating either child again. |
| `EnableLeaderBalancer` | `false` | Enable cross-node load reports and leader redistribution. Required with load splitting. |
| `LeaderBalancerReportInterval` | `5 seconds` | Interval between node load reports. |
| `LeaderBalancerInterval` | `30 seconds` | Interval between balancing passes. |
| `LeaderBalancerReportTtl` | `20 seconds` | Maximum accepted load-report age. |
| `MinLeaderStability` | `5 seconds` | Minimum leadership age before transfer. |
| `LeaderBalancerOpsWeight` | `1.0` | Operations-per-second weight in the balancer load score. |
| `LeaderBalancerQueueWeight` | `0.5` | Queue-depth weight in the balancer load score. |
| `ReplicationFactor` | `0` | Desired voter replicas per partition. `0` keeps full replication. Prefer odd values such as `3` or `5` in multi-node deployments. |
| `EnablePlacementRebalancer` | `false` | Enable ongoing replica-placement repair and balancing. Initial placement still applies when `ReplicationFactor` is positive. |
| `MaxReplicaMovesPerPass` | `2` | Maximum new replica add/remove sequences started in one placement pass. |
| `MaxConcurrentReplicaTransfers` | `1` | Maximum partitions with an in-flight learner catch-up or replica removal. |
| `ReplicaCountDeadband` | `1` | Replica-count imbalance tolerated before balance moves start. |
| `Zone` | `null` | Optional zone or rack hint used to spread replicas across failure domains. |
| `EnableLoadReports` | `false` | Gossip per-partition load reports even when leader balancing, placement rebalancing, or replication factor did not already enable them. |
| `ReadIOThreads` | `8` | Number of Raft read I/O threads. |
| `WriteIOThreads` | `8` | Number of Raft write I/O threads. |
| `EnableSharedExecutorPool` | `true` | Share a bounded worker pool across Raft partitions instead of using one OS thread per partition. |
| `PartitionExecutorPoolSize` | `0` | Shared Raft executor worker count. `0` auto-sizes to the processor count. |
| `HttpScheme` | `https://` | HTTP scheme used by Raft REST communication. |
| `HttpAuthBearerToken` | empty | Bearer token sent with Raft REST communication. |
| `HttpTimeout` | `5` | Raft REST request timeout in seconds. |
| `HttpVersion` | `2.0` | HTTP protocol version used by Raft REST communication. |
| `HeartbeatInterval` | `500 ms` | Leader heartbeat interval. |
| `RecentHeartbeat` | `100 ms` | Recent-heartbeat window. |
| `VotingTimeout` | `1500 ms` | Vote wait timeout. |
| `CheckLeaderInterval` | `250 ms` | Leader check interval. |
| `TimerInitialDelay` | `2500 ms` | Initial delay before Raft timers start. |
| `UpdateNodesInterval` | `5000 ms` | Node registry update interval. |
| `StartElectionTimeout` | `500` | Minimum election timeout in milliseconds. |
| `EndElectionTimeout` | `1500` | Maximum election timeout in milliseconds. |
| `StartElectionTimeoutIncrement` | `100` | Minimum election timeout increment in milliseconds. |
| `EndElectionTimeoutIncrement` | `200` | Maximum election timeout increment in milliseconds. |
| `SlowRaftStateMachineLog` | `50` | Slow state-machine operation log threshold in milliseconds. |
| `SlowRaftWALMachineLog` | `25` | Slow WAL state-machine operation log threshold in milliseconds. |
| `CompactEveryOperations` | `1000` | Number of committed operations between automatic Raft WAL compaction checks. |
| `CompactNumberEntries` | `50` | Number of Raft WAL entries removed per compaction batch. |
| `MaxEntriesPerCompaction` | `5000` | Maximum Raft WAL entries processed per compaction run. |

Live [snapshot holds](/docs/distributed-keyvalue-store/snapshot-holds/) clamp persistent revision cleanup. While a hold is active, the boundary revision needed by the held timestamp and every newer revision are kept even if `PersistentRevisionRetentionCount` or `PersistentRevisionRetentionAge` would otherwise remove them.

To bound RocksDB memory across both the embedded key/value backend and Raft WAL, enable shared RocksDB memory with both storage layers set to RocksDB:

```csharp
EmbeddedKahunaOptions options = new()
{
    Storage = "rocksdb",
    WalStorage = "rocksdb",
    RocksDbSharedMemoryEnabled = true,
    RocksDbSharedMemoryBudgetMb = 512,
    RocksDbSharedMemtableBudgetMb = 128,
    RocksDbDirectReads = true,
    RocksDbStatistics = false
};
```

If either `Storage` or `WalStorage` is not `rocksdb`, these shared-memory options are ignored.

## Code-Level Configuration

Some `KahunaConfiguration` options are not currently exposed by either `Kahuna.Server` command-line flags or `EmbeddedKahunaOptions`:

| Option | Default | Description |
|--------|---------|-------------|
| `ScriptCacheMaxEntries` | `1000` | Maximum parsed scripts retained in the server-side script cache. New entries are dropped when the limit is reached. |
| `RangeMergeMinSize` | `10` | Adjacent key ranges smaller than this value can be considered for automatic merging. `0` disables automatic merge. |
| `KeyValueWriteTerminalReserveItemsPerPartition` | `256` | Extra per-partition item headroom reserved for terminal durable transaction work such as decision, materialization, settlement, recovery, and metadata handoff. |
| `KeyValueWriteTerminalReserveBytesPerPartition` | `4194304` | Extra per-partition byte headroom reserved for terminal durable transaction work. |
| `KeyValueWriteMaxQueuedItemsGlobal` | `131072` | Node-wide ordinary submission item cap across all partitions. |
| `KeyValueWriteMaxQueuedBytesGlobal` | `536870912` | Node-wide ordinary submission byte cap across all partitions. |
| `KeyValueWriteTerminalReserveItemsGlobal` | `8192` | Node-wide item headroom reserved for terminal durable transaction work. |
| `KeyValueWriteTerminalReserveBytesGlobal` | `67108864` | Node-wide byte headroom reserved for terminal durable transaction work. |
| `KeyValueWriteMaxOperationBytes` | `67108864` | Hard ceiling for one admitted serialized partition write. Values above the ceiling are rejected retryably. |
| `KeyValueWriteBatchExecutionTimeoutMs` | `30000` | Maximum Raft round-trip time for one aggregator batch before the batch is released retryably. |
| `DurableRecordGcMaxPerPass` | `4096` | Maximum terminal transaction records reclaimed in one retention sweep. |
| `DurableRecoveryMaxPartitionsPerPass` | `64` | Maximum partitions driven by prepared-intent recovery in one sweep. |
| `DurableDecisionDeadlineFloorMs` | `5000` | Lower clamp for the durable decision-deadline margin. |
| `DurableDecisionDeadlineCeilingMs` | `60000` | Upper clamp for the durable decision-deadline margin. |
| `DurableDecisionDeadlineMultiplier` | `4` | Multiplier applied to observed finalize p99 before clamping the decision-deadline margin. |

`HttpsTrustedThumbprint` also exists on `KahunaConfiguration`, but it is derived from `HttpsCertificate` by configuration validation rather than being an independent operator setting.

## Notes

- The embedded node uses in-memory Raft and inter-node communication.
- `StartAsync` joins the single-node cluster and waits for leaders for the configured partitions.
- `WaitForLeaderForKeyAsync` waits for the partition that owns a specific key.
- Use distinct `StoragePath` and `WalPath` values when using `sqlite` or `rocksdb`.
- Set `BackupDir` to enable backup, catalog, and offline restore methods through `node.Kahuna`. See [Backups and Point-in-Time Recovery](/docs/backups-and-point-in-time-recovery/).
- Load-based splitting requires a multi-node embedded deployment, key-range-routed spaces, and `EnableLeaderBalancer = true`. See [Load-Based Range Splitting](/docs/distributed-keyvalue-store/load-based-range-splitting/).
- Positive `ReplicationFactor` values are intended for multi-node embedded deployments. `0` keeps the single-node/full-replication default. See [Replication Factor and Replica Placement](/docs/replica-placement/).
- Always dispose the node with `await using` or `DisposeAsync` so Raft leaves the cluster and file-backed resources are released.
