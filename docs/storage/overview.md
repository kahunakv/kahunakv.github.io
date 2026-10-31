# Storage Engines

Each Kahuna node stores its data with an embedded storage engine on the node itself, so you do not run a separate database server. The engine you choose affects write throughput, how easily you can inspect data, and how much there is to operate. The distributed guarantees come from Kahuna and Kommander, not from the engine: commands are replicated through [Raft](/docs/glossary/#raft), then committed state is written to the configured local backend.

There are two independent storage choices in a Kahuna server:

- `--wal-storage` controls the Raft [write-ahead log (WAL)](/docs/glossary/#write-ahead-log-wal) used by Kommander.
- `--storage` controls the materialized Kahuna state used for persistent locks, key/value entries, revisions, and sequences.

Both options accept `rocksdb`, `sqlite`, or `memory`. RocksDB is Kahuna's default backend for both Raft WAL storage and materialized persistent state.

If you are unsure, keep the default: RocksDB for both. Choose SQLite for small deployments, development, or when you want to inspect data with standard SQLite tools. Choose `memory` only for tests and embedded nodes where losing persistent state on restart is acceptable. See [Choosing an Adapter](#choosing-an-adapter) for a full comparison.

## What the Storage Backend Stores

The `IPersistenceBackend` contract stores the latest state and historical revisions needed by Kahuna's persistent objects:

- locks, including owner, [fencing token](/docs/glossary/#fencing-token), expiration, last-used time, last-modified time, and state
- key/value entries, including value, revision, expiration, last-used time, last-modified time, and state
- revision records used by compare-revision reads and revision-aware commands
- prefix and bucket reads over persistent key/value data

Kahuna's [actors](/docs/glossary/#actor) keep hot state in memory while the background writer batches dirty persistent objects to disk. Reads that miss memory, or that need a specific persistent revision, go through the configured backend.

## RocksDB in Kahuna

RocksDB is an embedded key/value database from Meta, built on an LSM tree (log-structured merge tree), that favors high write throughput and efficient scans over sorted keys. When you select it, the engine runs as native C++ code inside the Kahuna process.

### How an LSM Tree Works

An LSM tree turns many small writes into larger sequential disk writes. New writes land in a sorted in-memory memtable, protected by RocksDB's own WAL. A full memtable is flushed to disk as an immutable sorted file (an SST file). A read checks memory first, then searches SST files across levels; the block cache keeps recently read blocks in memory, and Bloom filters skip SST files that cannot contain the key. Background compaction merges SST files, drops overwritten values and [tombstones](/docs/glossary/#tombstone) when safe, and moves data through levels to keep reads efficient.

This fits Kahuna's persistent path: Kahuna batches committed actor output, RocksDB absorbs those writes efficiently, and compaction later reorganizes the data for long-running read and scan performance.

Kahuna's RocksDB adapter opens one RocksDB database under the configured storage path and revision. It uses separate column families for key/value data and lock data:

- `kv` stores persistent key/value entries and their revision records.
- `locks` stores persistent distributed lock state.

Each write is serialized as a protobuf message and appended through a RocksDB `WriteBatch` with synchronous write options enabled. The adapter opens RocksDB with absolute WAL recovery. For a normal persistent key/value write, the adapter stores two records:

- `key~CURRENT`, the latest visible state of the key
- `key~revision`, the immutable revision record for revision-aware reads

When a write uses `SET ... NOREV` or `KeyValueFlags.SetNoRevision`, Kahuna updates `key~CURRENT` but skips the `key~revision` record for that write. The current revision number still advances, but historical reads cannot retrieve the skipped revision. This reduces memory and disk write amplification for cache-style workloads that only need the latest value.

Locks follow the same pattern, with `resource~CURRENT` and `resource~fencingToken` records in the lock column family. Prefix scans use RocksDB's sorted keyspace directly: the adapter seeks to the requested prefix, iterates until the prefix range ends, and returns only records ending in `~CURRENT`.

RocksDB scans skip long runs of historical `key~revision` records once the visible current row or requested snapshot row is known. This keeps scans over revision-heavy stores closer to the number of logical keys than to the number of archived revisions. Kahuna also tracks keys that contain `~` so the optimization stays correct for escaped or unusual key names; older stores without that registry still read correctly, using the slower step-over path where needed.

### Storage Failure Recovery

If RocksDB latches a storage error after a failed append, for example after a temporary full-disk condition, Kahuna keeps the failed background-write batch instead of dropping it. After repeated failed flush cycles, the background writer asks the backend to recover. RocksDB recovery closes and reopens the native engine behind a swap fence, then retries the retained batch when the backend is writable again.

This path is for transient storage failures. Operators still need to fix the underlying disk or filesystem problem. While the backend remains unavailable, affected partitions keep unflushed writes resident and checkpoints cannot advance for those writes.

### Shared RocksDB Memory

When Kahuna uses RocksDB for both `--storage` and `--wal-storage`, one node opens two separate RocksDB databases:

- the materialized key/value and lock backend
- the Kommander Raft WAL

They stay separate on disk so the consensus log and the data path keep independent files, recovery, and column families. Shared RocksDB memory only shares in-process memory objects: one block cache and one write-buffer manager.

Enable it with:

```bash
kahuna-server \
  --storage rocksdb --wal-storage rocksdb \
  --rocksdb-shared-memory \
  --storage-shared-cache-mb 512 \
  --storage-shared-memtable-budget-mb 128
```

The total budget controls the shared block cache. The memtable budget is charged inside that same total, so cached SST blocks and in-memory write buffers draw from one budget across both RocksDB databases.

| Setting | Default | Meaning |
|---------|---------|---------|
| `--rocksdb-shared-memory` | disabled | Enables one shared block cache and write-buffer manager. |
| `--storage-shared-cache-mb` | `0` | Total shared cache budget in MiB; must be positive for shared RocksDB memory. |
| `--storage-shared-memtable-budget-mb` | `0` | Memtable sub-budget in MiB, charged into the shared cache; must be positive and no larger than the cache. |

The shared budgets are engine-neutral settings that a custom storage provider can also use. RocksDB applies them when both storage layers use RocksDB and `--rocksdb-shared-memory` is set. That mode now requires both budgets explicitly; the former 320 MiB and 128 MiB defaults no longer apply. The old `--rocksdb-shared-memory-budget-mb` and `--rocksdb-shared-memtable-budget-mb` names remain accepted as aliases.

Use this feature when process memory is constrained and RocksDB is used for both durable state and WAL. Measure before and after enabling it: watch process RSS, RocksDB block-cache usage, write-buffer manager memtable usage, and Raft commit or WAL append latency under representative load.

Operational caveats:

- The feature is opt-in and reversible; it does not change on-disk format, WAL semantics, recovery, or wire behavior.
- A write burst in one RocksDB database can cause more frequent flushing that affects the shared memory budget for the other database.
- Kahuna uses a soft cache and a non-stalling write-buffer manager for this mode, so sizing should be conservative rather than relying on RocksDB stalls for back-pressure.

### Limit Compaction Work

On a busy RocksDB store, flushes and compactions can compete with synchronized writes for disk throughput. Two optional settings bound that background work on the **materialized store**, not the Raft WAL:

| Setting | Default | Effect |
|---------|---------|--------|
| `--storage-compaction-rate-mbps` | `0` (unlimited) | Limits store flush and compaction writes in MB/s. |
| `--storage-max-background-compactions` | `0` (RocksDB default) | Caps concurrent store compactions. |

Set these only after measuring disk contention. A rate below the incoming write load can let RocksDB level-0 files accumulate and eventually slow writes. SQLite and memory ignore these settings; a custom engine may choose to honor them.

### Direct Reads and Statistics

Kahuna enables RocksDB direct reads by default for the materialized state backend. Direct reads bypass the operating-system page cache for SST reads, so RocksDB's block cache becomes the main read cache. This avoids double-caching the same data in both RocksDB and the OS page cache and makes the process memory budget easier to reason about, especially when shared RocksDB memory is enabled.

Disable direct reads when the operating-system page cache is intentionally part of the deployment's read strategy, or when a small local installation benefits more from buffered filesystem reads than from a strictly RocksDB-managed cache:

```bash
kahuna-server \
  --storage rocksdb \
  --disable-rocksdb-direct-reads
```

RocksDB statistics are disabled by default because they add per-operation accounting overhead. Enable them while tuning or diagnosing storage behavior:

```bash
kahuna-server \
  --storage rocksdb \
  --rocksdb-statistics
```

When enabled, RocksDB records internal counters such as block-cache activity, compaction work, write stalls, and per-level file state, then dumps them every 60 seconds to the RocksDB `LOG` file under the configured storage path.

| Setting | Default | Use when | Trade-off |
|---------|---------|----------|-----------|
| `--disable-rocksdb-direct-reads` | disabled | You want buffered reads through the OS page cache instead of direct I/O. | Can reintroduce double caching and less predictable read-memory accounting. |
| `--rocksdb-statistics` | disabled | You are investigating block-cache efficiency, compaction behavior, write stalls, or file-level state. | Adds per-operation overhead and more LOG output. |

### RocksDB WAL Tuning

When `--wal-storage rocksdb` is used, Kahuna exposes Kommander's RocksDB WAL shard tuning knobs. These affect the Raft log layout, not the materialized key/value backend. Leave them at `0` unless you are measuring WAL compaction, write amplification, or write stalls under production-like load.

| Setting | Default | Meaning |
|---------|---------|---------|
| `--raft-wal-shard-write-buffer-size-mb` | `0` | Keep Kommander's default memtable size, currently 64 MiB. |
| `--raft-wal-shard-min-write-buffer-number-to-merge` | `0` | Keep Kommander's default immutable memtables merged per flush, currently `2`. |
| `--raft-wal-shard-max-write-buffer-number` | `0` | Keep Kommander's default maximum memtables per shard, currently `4`. |
| `--raft-wal-shard-level0-file-num-compaction-trigger` | `0` | Keep Kommander's default level-0 compaction trigger, currently `8` files. |
| `--raft-wal-shard-level0-slowdown-writes-trigger` | `0` | Keep Kommander's default level-0 slowdown trigger, currently `28` files. |
| `--raft-wal-shard-level0-stop-writes-trigger` | `0` | Keep Kommander's default level-0 stop trigger, currently `44` files. |
| `--raft-wal-shard-max-bytes-for-level-base-mb` | `0` | Keep RocksDB's level-base sizing, currently 256 MiB unless overridden by Kommander. |
| `--raft-wal-shard-universal-compaction` | disabled | Use universal compaction for WAL shard column families instead of leveled compaction. |

Larger flush units can let a log row and the range tombstone that later removes it meet earlier, reducing WAL rewrite work. The trade-off is memory use and restart replay size. Universal compaction can reduce leveled compaction churn for log-shaped data, but it should be enabled only after benchmarking your workload.

## SQLite in Kahuna

SQLite is a serverless, self-contained relational database that stores tables and indexes in B-trees and supports ACID transactions through rollback journals or write-ahead logging.

Kahuna's SQLite adapter stores materialized state across eight shard files under the configured storage path and revision:

```text
kahuna0_<revision>.db
kahuna1_<revision>.db
...
kahuna7_<revision>.db
```

Keys are routed to a shard by hash. Each shard has its own SQLite connection and reader/writer lock; sharding across eight files gives Kahuna more concurrency than a single database file while keeping the implementation simple. The adapter creates three tables:

- `locks`, keyed by lock resource
- `keys`, keyed by key name and storing the latest visible key/value state
- `keys_revisions`, keyed by `(key, revision)` and storing historical key/value revisions

SQLite is opened in WAL mode with `synchronous=NORMAL` and `temp_store=MEMORY`. `synchronous=NORMAL` is a performance-oriented durability setting: it is appropriate for many WAL-mode deployments, but it is not SQLite's strictest durability mode. Key/value batches are grouped per shard and committed in a SQLite transaction. Lock writes are upserted by resource.

Prefix reads are implemented with SQL over the `keys` table using `LIKE '<prefix>%'`. Because Kahuna routes bucket-style keys by prefix, the adapter opens the shard for the prefix and scans that shard's current-key table.

## Memory Backend

The `memory` backend is useful for embedded nodes, tests, and temporary data. It keeps state in process memory and avoids disk I/O, but it is not restart-safe and should not be used for durable production state. Persistent revision reads also require an on-disk backend.

## Choosing an Adapter

| | RocksDB | SQLite |
|---------|---------|--------|
| Storage model | Embedded C++ key/value store based on an LSM tree | Embedded relational database based on B-tree tables and indexes |
| Kahuna layout | One database under the storage revision, with `kv` and `locks` column families | Eight hash-sharded database files named `kahunaN_<revision>.db` |
| Latest state | Stored as `key~CURRENT` or `resource~CURRENT` records | Stored in `keys` and `locks` tables |
| Historical revisions | Stored as revision-suffixed records in the same column family; handles the append-heavy pattern of a latest-state plus a revision record per persistent update well | Stored in the `keys_revisions` table with `(key, revision)` as the primary key; works for many retained revisions with disk maintenance |
| Write path | Batched protobuf records written through `WriteBatch` with sync writes; the background writer's batches of dirty locks and key/value entries map cleanly to it | SQL upserts; key/value writes are grouped per shard and committed in transactions |
| Write concurrency | Strong fit for sustained write-heavy workloads: memtables, WAL, and background compaction suit high insert/update rates better than page-oriented storage | Writes are serialized per shard, so high write concurrency can bottleneck; suitable for low to moderate write volume |
| Prefix scans | Native ordered-key iterator over sorted SST files, which makes prefix and bucket scans over large keyspaces natural | SQL `LIKE '<prefix>%'` query on the prefix shard rather than native ordered-key iteration |
| Operational footprint | Larger: native library dependencies, platform-specific packaging, and more tuning and monitoring surface, with the most tuning control | Small: no server process, ordinary database files that are easy to package, run, copy, and back up |
| Inspection and debugging | Data files are not convenient to inspect manually; needs RocksDB tooling or application-level inspection | Standard SQLite tools can inspect tables, values, revisions, and lock rows directly |
| Disk behavior | Compaction, block cache, file counts, and write amplification matter under load and need monitoring; revision-heavy workloads keep current and historical records, so plan disk growth and compaction | Large values and revision-heavy workloads can grow database and WAL files quickly; long-running deployments may need WAL checkpointing and occasional vacuuming |
| Best fit | Production clusters with sustained persistent traffic, large keyspaces, high write rates, and retained revisions | Local development, tests, small demos, embedded deployments in constrained environments, where its file model is easy to reason about, and small persistent clusters |
| Weak fit | Very small deployments, local development, and simple embedded usage, where it may be more machinery than needed | The highest-throughput or write-heavy production workloads, and very large revision-heavy keyspaces |

For most production clusters, start with RocksDB for both `--wal-storage` and `--storage`. Use SQLite when the deployment benefits more from a small footprint, easy inspection, and simple file-based operation than from maximum write throughput.

## Operational Notes

- Keep `--wal-path` and `--storage-path` on reliable local disks. Network filesystems can add latency and failure modes that hurt Raft and embedded database behavior.
- Use a stable `--storage-revision` and `--wal-revision` for an existing data directory. Changing revisions points Kahuna at a different set of local files.
- Monitor disk growth when using persistent key/value revisions. Kahuna stores both latest records and revision records.
- Ephemeral objects stay in memory and avoid the storage backend entirely; use them for data that does not need restart persistence (see [Durability Levels](/docs/architecture/durability-levels/)).
