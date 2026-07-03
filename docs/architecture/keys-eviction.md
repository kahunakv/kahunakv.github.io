import Cache from '../assets/cache.png';

# Keys Eviction

Kahuna keeps key/value state in memory inside each `KeyValueActor`. Persistent keys also have durable storage behind them, but the in-memory copy avoids disk reads for hot data. Ephemeral keys live only in memory, so eviction of an ephemeral key removes the value from the node.

<div style={{textAlign: 'center'}}>
<img src={Cache} height="350" />
</div>

The current key/value eviction algorithm is a bounded collector. It reclaims definite garbage first, then uses true least-recently-used ordering only when the actor is over its configured entry or byte budget. Revision and MVCC metadata are trimmed where they grow so hot keys with large histories do not grow without bound.

## When Collection Runs

Collection can run in three ways:

- A `KeyValueCollectorActor` periodically fans out `Collect` messages to all ephemeral and persistent key/value actors.
- The fan-out is staggered across the configured collection interval so every actor does not sweep at the same time.
- Each `KeyValueActor` checks its memory budget every few hundred non-collection operations. If the actor is over budget, it runs collection immediately.

If one collection pass reaches its batch limit and the actor is still over budget, the actor schedules a follow-up collection message for itself. This prevents one request from doing unbounded cleanup work while still draining memory pressure over multiple passes.

## Actor Budgets

Each key/value actor tracks:

- number of entries in its in-memory `BTree`
- approximate bytes held by keys, values, revision history, and MVCC metadata

Collection pressure is based on:

| Setting | Meaning | Default |
|---------|---------|---------|
| `MaxEntriesPerActor` | Maximum cached key/value entries per actor before LRU pressure applies. | `50000` |
| `MaxBytesPerActor` | Approximate maximum bytes per actor before LRU pressure applies. | `268435456` |
| `CollectBatchMax` | Maximum entries removed in one collection pass. | `1000` |

The byte estimate is intentionally approximate. It includes key text, value bytes, fixed entry overhead, revision metadata, revision value bytes, and MVCC metadata.

Memory limits are per actor. A cluster with many partitions can cache more data overall because each partition has its own entry and byte budget. If a working set repeatedly falls out of cache, raise `MaxEntriesPerActor` or `MaxBytesPerActor`, or split the workload across more partitions so each actor owns less data.

## Phase 1: Garbage Reclamation

Every collection pass first removes entries that are safe to reclaim without considering the actor budget:

- entries in `Deleted` state
- entries in `Undefined` state
- entries whose expiration timestamp is set and has passed

Entries with an active write intent or replication intent are skipped. Kahuna does not evict objects currently participating in local mutation or replication work.

Kahuna keeps auxiliary structures for this work:

- Deleted and undefined entries are tracked through a tombstone queue. The collector drains the queue and re-checks the current entry before removing it, so a key that was deleted and later recreated is not removed accidentally.
- Expiring entries are tracked in an expiry heap ordered by expiration time. The collector pops expired entries until it reaches the first future expiration, so cleanup work is proportional to the number of expired keys instead of the number of cached keys.

This phase is bounded by `CollectBatchMax`. If the actor is still over budget after the pass reaches its batch limit, the actor schedules a follow-up collection.

## Phase 2: LRU Eviction

After tombstones and expired entries are reclaimed, Kahuna projects the actor's remaining entry count and byte usage. If the actor is still over either budget, it evicts cold live entries using least-recently-used ordering.

Each cached entry participates in an intrusive LRU list:

- reads and writes move the entry to the hot end of the list
- the cold end identifies the least recently used entries without sorting or scanning the whole `BTree`
- eviction walks from the cold end until the actor is under budget or the batch limit is reached

Entries already selected for garbage eviction, entries with write intents, entries with replication intents, and dirty persistent entries are excluded from LRU eviction.

## Dirty Persistent Entries

Persistent writes become visible in memory before the background writer flushes the materialized state to RocksDB or SQLite. During that short window, the in-memory entry can be newer than disk. Evicting it would make the next read reload stale data, so Kahuna pins dirty entries until they are safe to drop.

The collector uses the entry's flushed revision and a safety window based on `DirtyObjectsWriterDelay` to avoid evicting a persistent entry whose latest change might not be on disk yet. The same rule protects deletes, so an unflushed delete cannot be evicted in a way that resurrects an older value from disk.

This safety rule affects memory behavior: under heavy write load, recently modified persistent keys may remain in memory longer than cold clean keys.

## Metadata Trimming

Eviction is not the only way Kahuna reduces memory. Revision and transaction metadata are bounded inline, where they grow:

- Each new archived revision trims in-memory revision history back to `RevisionRetention`.
- If an MVCC snapshot hold is active, trimming also keeps the boundary revision at or before the effective snapshot floor.
- When a transaction commits, rolls back, or releases a lock, its MVCC snapshot is removed and expired sibling snapshots are cleaned up.

This is important for hot keys. A hot key may never be selected by LRU, but its revision or transaction metadata can still grow. Inline trimming lets Kahuna reduce memory without scanning the entire store or evicting the current value. Snapshot holds add one protected boundary revision per affected key, so long-lived historical readers can keep reading at their pinned timestamp without keeping unbounded history in memory.

| Setting | Meaning | Default |
|---------|---------|---------|
| `RevisionRetention` | Number of latest revisions retained in memory per key. | `16` |

Persistent revision cleanup is also clamped by the effective snapshot floor. While a hold is live, the persistent backend must keep the boundary revision and all newer revisions, even if `PersistentRevisionRetentionCount` or `PersistentRevisionRetentionAge` would otherwise prune them.

## Persistent vs Ephemeral Keys

Persistent and ephemeral keys use the same in-memory key/value collector, but eviction has different consequences:

- **Persistent keys** can be reloaded from durable storage if needed. Eviction removes the memory copy, not the persisted value.
- **Ephemeral keys** are stored only in memory. Eviction removes the value because there is no durable backing store.

For this reason, ephemeral durability is best for temporary state such as caches, sessions, and short-lived coordination data. Persistent durability should be used when data must survive eviction or restart.

## Reads, Scans, and Cache Reloads

Single-key reads check the actor cache first. If a persistent key is missing from memory, Kahuna loads it from the configured backend and usually caches it again. Ephemeral keys cannot be reloaded after eviction because memory was the only copy.

Large ordered scans use paginated range reads. They merge in-memory and on-disk state while carrying a consistent snapshot across pages. Keys that are read from disk during a large scan are not forced back into the cache, so full-table or large-prefix iteration does not flood the cache or disturb hot-key recency.

Non-paginated prefix and bucket scans return the matching set in one call and are capped. They are intended for small, known-bounded prefixes. Use paginated range scans for large or unbounded iteration.

## Locks and Sequences

The algorithm above applies to key/value actors. Lock actors currently use a simpler cleanup path:

- cleanup is checked every 500 lock operations
- cleanup starts only when the actor has at least 200 lock entries
- entries whose `LastUsed` age exceeds `CacheEntryTtl` are removed
- each cleanup pass is capped by `CacheEntriesToRemove`

Sequences are not managed by the key/value collector.

## Configuration Surface

The server command line currently exposes:

| Command Line Option | Meaning | Default |
|---------------------|---------|---------|
| `--cache-entry-ttl` | Age threshold used by cache cleanup paths, in seconds. | `1800` |
| `--cache-entries-to-remove` | Maximum number of entries removed by cleanup passes that use this cap. | `100` |
| `--dirty-objects-writer-delay` | Delay between dirty object writer flush passes, in milliseconds. Longer delays can increase batching but keep dirty entries pinned longer. | `200` |

Embedded nodes expose the full collector configuration as .NET options. See [Embedded Kahuna Node](/docs/embedded-kahuna-node/) for the full option table.

## Observability

When a key/value collector pass evicts entries, Kahuna logs a summary with the number of reclaimed entries, the source breakdown (`tombstone`, `expired`, and `lru`), the resulting store size, byte estimate, elapsed time, and whether a follow-up pass is queued. Frequent backlog or high `lru` counts indicate sustained memory pressure on that actor.

## Log Compaction

Key eviction is separate from Raft WAL compaction. Each Raft group also compacts its WAL through [Kommander](https://github.com/kahunakv/kommander), removing old log entries that are no longer needed after checkpointing. WAL compaction reduces disk usage; key/value eviction reduces in-memory cache usage.
