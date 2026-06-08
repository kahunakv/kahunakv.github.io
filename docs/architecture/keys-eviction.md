import Cache from '../assets/cache.png';

# Keys Eviction

Kahuna keeps key/value state in memory inside each `KeyValueActor`. Persistent keys also have durable storage behind them, but the in-memory copy avoids disk reads for hot data. Ephemeral keys live only in memory, so eviction of an ephemeral key removes the value from the node.

<div style={{textAlign: 'center'}}>
<img src={Cache} height="350" />
</div>

The current key/value eviction algorithm is a bounded collector. It reclaims definite garbage first, then uses an approximate LRU pass only when the actor is over its configured entry or byte budget. It also trims retained revision and MVCC metadata so hot keys with large histories do not grow without bound.

## When Collection Runs

Collection can run in three ways:

- A `KeyValueCollectorActor` periodically fans out `Collect` messages to all ephemeral and persistent key/value actors.
- The fan-out is staggered across the configured collection interval so every actor does not sweep at the same time.
- Each `KeyValueActor` also checks its memory budget every 500 non-collection operations. If the actor is over budget, it runs collection immediately.

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

## Phase 1: Garbage Reclamation

Every collection pass first scans for entries that are safe to remove without considering the actor budget. This pass removes:

- entries in `Deleted` state
- entries in `Undefined` state
- entries whose expiration timestamp is set and has passed

Entries with an active write intent or replication intent are skipped. Kahuna does not evict objects currently participating in local mutation or replication work.

This phase is bounded by `CollectBatchMax`. If metadata trimming is enabled for the current cycle, the scan can continue collecting metadata-trim candidates even after the eviction batch is full.

## Phase 2: Approximate LRU

After garbage reclamation, Kahuna projects the actor's remaining entry count and byte usage. If the actor is still over either budget, it runs a bounded approximate LRU pass.

The LRU pass does not sort the whole store. Instead it:

- walks the actor's ordered `BTree` from a persistent cursor
- adds random jitter so each pass does not inspect the same key range
- scans at most `LruSampleScanMax` eligible entries
- keeps a candidate pool of the oldest `LastUsed` entries up to `LruSampleSize`
- evicts the oldest sampled keys until the actor is under budget or the batch limit is reached

The sampler walks the tree as a ring. When it reaches the end, it wraps to the beginning. This keeps collection bounded while avoiding a permanent bias toward lexicographically small keys.

Entries already selected for garbage eviction, entries with write intents, and entries with replication intents are excluded from the LRU candidate pool.

| Setting | Meaning | Default |
|---------|---------|---------|
| `LruSampleSize` | Number of oldest sampled candidates retained per sampler call. | `5` |
| `LruSampleScanMax` | Maximum eligible entries inspected per sampler call. | `256` |

## Phase 3: Metadata Trimming

Eviction is not the only way Kahuna reduces memory. On configurable collection cycles, the collector trims metadata from entries that remain in memory.

Metadata trimming does two things:

- Keeps only the newest `RevisionRetention` cached revisions for a key.
- Removes expired MVCC entries.

This is important for hot keys. A hot key may never be selected by LRU, but its revision or transaction metadata can still grow. Metadata trimming lets Kahuna reduce memory without evicting the current value.

| Setting | Meaning | Default |
|---------|---------|---------|
| `RevisionRetention` | Number of latest revisions retained in memory per key. | `16` |
| `MetadataTrimInterval` | Run metadata trimming every N collection cycles. `0` disables metadata trimming. | `4` |

## Persistent vs Ephemeral Keys

Persistent and ephemeral keys use the same in-memory key/value collector, but eviction has different consequences:

- **Persistent keys** can be reloaded from durable storage if needed. Eviction removes the memory copy, not the persisted value.
- **Ephemeral keys** are stored only in memory. Eviction removes the value because there is no durable backing store.

For this reason, ephemeral durability is best for temporary state such as caches, sessions, and short-lived coordination data. Persistent durability should be used when data must survive eviction or restart.

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

Embedded nodes expose the full collector configuration as .NET options. See [Embedded Kahuna Node](/docs/embedded-kahuna-node/) for the full option table.

## Log Compaction

Key eviction is separate from Raft WAL compaction. Each Raft group also compacts its WAL through [Kommander](https://github.com/kahunakv/kommander), removing old log entries that are no longer needed after checkpointing. WAL compaction reduces disk usage; key/value eviction reduces in-memory cache usage.
