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
| `LocksWorkers` | `Environment.ProcessorCount` | Lock worker count. |
| `KeyValueWorkers` | `Environment.ProcessorCount` | Key/value worker count. |
| `BackgroundWriterWorkers` | `1` | Background persistence worker count. |
| `DefaultTransactionTimeout` | `5000` | Default transaction timeout in milliseconds. |
| `ScriptCacheExpiration` | `1 minute` | How long parsed scripts stay cached. |
| `RevisionsToKeepCached` | `100` | Number of key revisions to keep cached in memory. |
| `CacheEntryTtl` | `5 minutes` | Age threshold used by lock cleanup and legacy cleanup paths. Key/value LRU eviction is budget-based. |
| `CacheEntriesToRemove` | `1000` | Maximum entries removed by cleanup paths that use this cap. Key/value collection uses `CollectBatchMax`. |
| `CollectionInterval` | `60 seconds` | Interval for cache collection and eviction checks. |
| `MaxEntriesPerActor` | `50000` | Maximum cached entries per actor before collection pressure applies. |
| `MaxBytesPerActor` | `268435456` | Approximate maximum cached bytes per actor before collection pressure applies. |
| `CollectBatchMax` | `1000` | Maximum number of entries evicted in one collection pass. |
| `RevisionRetention` | `16` | Number of revisions retained for in-memory revision history. |
| `DirtyObjectsWriterDelay` | `1000` | Delay between dirty object writer flush passes, in milliseconds. Longer values can increase batching but keep dirty persistent entries pinned in memory longer. |
| `PersistentRevisionRetentionCount` | `0` | Maximum persisted revisions retained per key. `0` keeps every revision. |
| `PersistentRevisionRetentionAge` | `0` | Maximum persisted revision age. `TimeSpan.Zero` disables age-based retention. |
| `PersistentRevisionCleanupInterval` | `5 minutes` | Minimum interval between full persistent-revision cleanup sweeps. |
| `PersistentRevisionCleanupBatchSize` | `1000` | Maximum revision records deleted per cleanup pass. |
| `PersistentRevisionCleanupOnWrite` | `true` | Queue keys touched by writes for targeted revision cleanup. |
| `PitrWindow` | `1 hour` | Recoverable WAL history. Values are normalized to more than zero and at most 6 hours. |
| `BaseSnapshotInterval` | `30 minutes` | Intended interval between base checkpoints. It must be positive and no greater than `PitrWindow`. It also contributes to the protected WAL floor. |
| `BackupDir` | empty | Root directory for backup manifests and artifacts. Backup methods on `node.Kahuna` are disabled when empty. |
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

## Code-Level Configuration

Two `KahunaConfiguration` options are not currently exposed by either `Kahuna.Server` command-line flags or `EmbeddedKahunaOptions`:

| Option | Default | Description |
|--------|---------|-------------|
| `ScriptCacheMaxEntries` | `1000` | Maximum parsed scripts retained in the server-side script cache. New entries are dropped when the limit is reached. |
| `RangeMergeMinSize` | `10` | Adjacent key ranges smaller than this value can be considered for automatic merging. `0` disables automatic merge. |

`HttpsTrustedThumbprint` also exists on `KahunaConfiguration`, but it is derived from `HttpsCertificate` by configuration validation rather than being an independent operator setting.

## Notes

- The embedded node uses in-memory Raft and inter-node communication.
- `StartAsync` joins the single-node cluster and waits for leaders for the configured partitions.
- `WaitForLeaderForKeyAsync` waits for the partition that owns a specific key.
- Use distinct `StoragePath` and `WalPath` values when using `sqlite` or `rocksdb`.
- Set `BackupDir` to enable backup, catalog, and offline restore methods through `node.Kahuna`. See [Backups and Point-in-Time Recovery](/docs/backups-and-point-in-time-recovery/).
- Load-based splitting requires a multi-node embedded deployment, key-range-routed spaces, and `EnableLeaderBalancer = true`. See [Load-Based Range Splitting](/docs/distributed-keyvalue-store/load-based-range-splitting/).
- Always dispose the node with `await using` or `DisposeAsync` so Raft leaves the cluster and file-backed resources are released.
