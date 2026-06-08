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
| `LocksWorkers` | `Environment.ProcessorCount` | Lock worker count. |
| `KeyValueWorkers` | `Environment.ProcessorCount` | Key/value worker count. |
| `BackgroundWriterWorkers` | `1` | Background persistence worker count. |
| `DefaultTransactionTimeout` | `5000` | Default transaction timeout in milliseconds. |
| `ScriptCacheExpiration` | `1 minute` | How long parsed scripts stay cached. |
| `RevisionsToKeepCached` | `100` | Number of key revisions to keep cached in memory. |
| `CacheEntryTtl` | `5 minutes` | Maximum age of cached entries before they become eviction candidates. |
| `CacheEntriesToRemove` | `1000` | Maximum number of cache entries removed per eviction pass. |
| `CollectionInterval` | `60 seconds` | Interval for cache collection and eviction checks. |
| `MaxEntriesPerActor` | `50000` | Maximum cached entries per actor before collection pressure applies. |
| `MaxBytesPerActor` | `268435456` | Approximate maximum cached bytes per actor before collection pressure applies. |
| `CollectBatchMax` | `1000` | Maximum number of entries considered in a collection batch. |
| `RevisionRetention` | `16` | Number of revisions retained for in-memory revision history. |
| `LruSampleSize` | `5` | Number of candidates sampled for LRU-style eviction decisions. |
| `LruSampleScanMax` | `256` | Maximum number of entries scanned while building an LRU sample. |
| `MetadataTrimInterval` | `4` | Collection cycle interval for metadata trimming. `0` disables metadata trimming. |
| `DirtyObjectsWriterDelay` | `1000` | Delay between dirty object writer flush passes, in milliseconds. |
| `ReadIOThreads` | `8` | Number of Raft read I/O threads. |
| `WriteIOThreads` | `8` | Number of Raft write I/O threads. |
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

## Notes

- The embedded node uses in-memory Raft and inter-node communication.
- `StartAsync` joins the single-node cluster and waits for leaders for the configured partitions.
- `WaitForLeaderForKeyAsync` waits for the partition that owns a specific key.
- Use distinct `StoragePath` and `WalPath` values when using `sqlite` or `rocksdb`.
- Always dispose the node with `await using` or `DisposeAsync` so Raft leaves the cluster and file-backed resources are released.
