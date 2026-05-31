# Storage: Overview

Kahuna uses embedded storage engines as the durable local storage layer for each node. The distributed guarantees come from Kahuna and Kommander: commands are replicated through Raft, then committed state is written to the configured local backend.

There are two independent storage choices in a Kahuna server:

- `--wal-storage` controls the Raft write-ahead log used by Kommander.
- `--storage` controls the materialized Kahuna state used for persistent locks, key/value entries, revisions, and sequences.

Both options can use `rocksdb` or `sqlite`. The materialized state backend can also use `memory` for embedded or test deployments where restart durability is not required.

## What the Storage Backend Stores

The `IPersistenceBackend` contract stores the latest state and historical revisions needed by Kahuna's persistent objects:

- locks, including owner, fencing token, expiration, last-used time, last-modified time, and state
- key/value entries, including value, revision, expiration, last-used time, last-modified time, and state
- revision records used by compare-revision reads and revision-aware commands
- prefix and bucket reads over persistent key/value data

Kahuna's actors keep hot state in memory while the background writer batches dirty persistent objects to disk. Reads that miss memory, or that need a specific persistent revision, go through the configured backend.

## RocksDB in Kahuna

RocksDB is a high-performance embedded key-value database based on an LSM-tree architecture. Originally derived from LevelDB, it adds numerous features and optimizations for production environments, including advanced compaction strategies, compression, transactions, snapshots, and configurable durability options. RocksDB is particularly well-suited for write-intensive workloads, offering high write throughput and efficient range scans over sorted keys while maintaining good storage efficiency.

Kahuna's RocksDB adapter opens one RocksDB database under the configured storage path and revision. It uses separate column families for key/value data and lock data:

- `kv` stores persistent key/value entries and their revision records.
- `locks` stores persistent distributed lock state.

Each write is serialized as a protobuf message and appended through a RocksDB `WriteBatch` with synchronous write options enabled. For every persistent key/value write, the adapter stores two records:

- `key~CURRENT`, the latest visible state of the key
- `key~revision`, the immutable revision record for revision-aware reads

Locks follow the same pattern, with `resource~CURRENT` and `resource~fencingToken` records in the lock column family. Prefix scans use RocksDB's sorted keyspace directly: the adapter seeks to the requested prefix, iterates until the prefix range ends, and returns only records ending in `~CURRENT`.

### Where RocksDB Shines

RocksDB is the best default for production Kahuna nodes with sustained persistent traffic.

- **Write-heavy workloads**. LSM storage, memtables, WAL, and background compaction fit high insert/update rates better than page-oriented storage.
- **Large keyspaces**. Sorted SST files and iterators make prefix scans and bucket-style access natural.
- **Persistent revisions**. Kahuna writes latest-state and revision records for every persistent update; RocksDB handles that append-heavy pattern well.
- **Batched actor output**. Kahuna's background writer can hand RocksDB batches of dirty locks and key/value entries, which maps cleanly to `WriteBatch`.
- **Crash recovery**. The adapter opens RocksDB with absolute WAL recovery and uses synchronous write options for materialized-state writes.

### Where RocksDB Is Not Ideal

RocksDB is powerful, but it has a larger operational footprint.

- It adds native library dependencies and platform-specific packaging concerns.
- Compaction, block cache, file counts, and disk write amplification matter under load and need monitoring.
- Data files are not convenient to inspect manually compared with a SQL database.
- For very small deployments, local development, and simple embedded usage, RocksDB may be more machinery than needed.
- Revision-heavy workloads retain both current and historical records, so disk growth and compaction behavior should be planned.

## SQLite in Kahuna

SQLite is a lightweight, serverless, self-contained relational database engine widely used in embedded and client-side applications. It stores tables and indexes using B-Tree structures and provides full SQL support, including ACID-compliant transactions through rollback journals or write-ahead logging (WAL). SQLite is designed for simplicity, reliability, and minimal deployment overhead while delivering strong transactional guarantees.

Kahuna's SQLite adapter stores materialized state across eight shard files under the configured storage path and revision:

```text
kahuna0_<revision>.db
kahuna1_<revision>.db
...
kahuna7_<revision>.db
```

Keys are routed to a shard by hash. Each shard has its own SQLite connection and reader/writer lock. The adapter creates three tables:

- `locks`, keyed by lock resource
- `keys`, keyed by key name and storing the latest visible key/value state
- `keys_revisions`, keyed by `(key, revision)` and storing historical key/value revisions

SQLite is opened in WAL mode with `synchronous=NORMAL` and `temp_store=MEMORY`. Key/value batches are grouped per shard and committed in a SQLite transaction. Lock writes are upserted by resource.

Prefix reads are implemented with SQL over the `keys` table using `LIKE '<prefix>%'`. Because Kahuna routes bucket-style keys by prefix, the adapter opens the shard for the prefix and scans that shard's current-key table.

### Where SQLite Shines

SQLite is a strong fit when operational simplicity matters more than maximum write throughput.

- **Local development and tests**. It needs no server process and produces ordinary database files.
- **Small persistent deployments**. It is easy to run, copy, inspect, and back up.
- **Debuggability**. Operators can use standard SQLite tools to inspect tables, values, revisions, and lock rows.
- **Predictable embedded behavior**. SQLite's single-file model is easy to reason about in constrained environments.
- **Low to moderate write volume**. Sharding across eight files gives Kahuna more concurrency than a single database file while keeping the implementation simple.

### Where SQLite Is Not Ideal

SQLite is not the best choice for the highest-throughput persistent workloads.

- Writes are serialized per shard, so high write concurrency can bottleneck.
- Prefix scans are SQL `LIKE` reads over a shard rather than native ordered-key iteration.
- `synchronous=NORMAL` is a performance-oriented durability setting; it is appropriate for many WAL-mode deployments, but it is not SQLite's strictest durability mode.
- Large values and revision-heavy workloads can grow database and WAL files quickly.
- Long-running deployments may need normal SQLite maintenance practices, such as WAL checkpointing and occasional vacuuming.

## Memory Backend

The `memory` backend is useful for embedded nodes, tests, and temporary data. It keeps state in process memory and avoids disk I/O, but it is not restart-safe and should not be used for durable production state. Persistent revision reads also require an on-disk backend.

## RocksDB vs SQLite

| Feature | RocksDB | SQLite |
|---------|---------|--------|
| Storage model | Embedded key/value store based on an LSM-tree | Embedded relational database based on B-Tree tables and indexes |
| Kahuna layout | One database under the storage revision, with `kv` and `locks` column families | Eight hash-sharded database files named `kahunaN_<revision>.db` |
| Latest state | Stored as `key~CURRENT` or `resource~CURRENT` records | Stored in `keys` and `locks` tables |
| Historical revisions | Stored as revision-suffixed records in the same column family | Stored in the `keys_revisions` table with `(key, revision)` as the primary key |
| Write path | Batched protobuf records written through RocksDB `WriteBatch` with sync writes | SQL upserts; key/value writes are grouped per shard and committed in transactions |
| Prefix scans | Native ordered-key iterator over the RocksDB keyspace | SQL `LIKE '<prefix>%'` query on the prefix shard |
| Write concurrency | Strong fit for sustained write-heavy workloads and large update volumes | Serialized per shard; suitable for low to moderate write volume |
| Operational footprint | Larger native dependency and more tuning/monitoring surface | Small, serverless, easy to package and inspect |
| Inspection and debugging | Requires RocksDB tooling or application-level inspection | Standard SQLite tools can inspect tables directly |
| Disk behavior | Compaction, SST files, and write amplification need monitoring | WAL files, checkpoints, and occasional vacuuming may need attention |
| Best fit | Production clusters, large keyspaces, high write rates, retained revisions | Development, tests, embedded deployments, small persistent clusters |
| Weak fit | Tiny deployments where operational simplicity matters most | Write-heavy production workloads or very large revision-heavy keyspaces |

## Choosing an Adapter

| Workload or constraint | Prefer RocksDB | Prefer SQLite |
|------------------------|----------------|---------------|
| Sustained write-heavy production traffic | Yes | No |
| Large keyspace with many prefix or bucket scans | Yes | Sometimes |
| Many retained revisions per key | Yes | Sometimes, with disk maintenance |
| Minimal deployment footprint | No | Yes |
| Easy manual inspection with common tools | No | Yes |
| Native dependency sensitivity | No | Yes |
| Local development and small demos | Sometimes | Yes |
| Highest operational tuning control | Yes | No |

For most production clusters, start with RocksDB for both `--wal-storage` and `--storage`. Use SQLite when the deployment benefits more from a small footprint, easy inspection, and simple file-based operation than from maximum write throughput.

## Operational Notes

- Keep `--wal-path` and `--storage-path` on reliable local disks. Network filesystems can add latency and failure modes that hurt Raft and embedded database behavior.
- Use a stable `--storage-revision` and `--wal-revision` for an existing data directory. Changing revisions points Kahuna at a different set of local files.
- Monitor disk growth when using persistent key/value revisions. Kahuna stores both latest records and revision records.
- Use ephemeral durability for data that does not need restart persistence. Ephemeral objects stay in memory and avoid the storage backend entirely.
