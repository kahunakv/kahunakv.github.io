
# Storage: Overview

In any database, **storage** is one of the most important and critical components for ensuring data reliability. **Kahuna** acts as a **high-level coordinator** for the embedded databases that form the underlying storage layer of each node in the architecture.

Kahuna offers the flexibility of supporting two storage backends:

- **RocksDB** (default): optimized for high-throughput, write-heavy workloads and used widely in distributed systems.
- **SQLite**: lightweight, relational, and ideal for simpler workloads or environments where SQL compatibility is desired.

Each backend comes with its own strengths, allowing developers to choose the one that best fits their performance, durability, and operational requirements.

Kahuna uses its storage backends primarily for:

- Raft Logs (Write-Ahead Log (WAL) persistence)
- Durable object (locks, key/value, sequences) storage

## RocksDb in Kahuna

RocksDB is a high-performance embedded database optimized for fast, low-latency writes and efficient range queries. It’s built on top of **LevelDB**, with significant enhancements for production workloads, especially under write-intensive conditions.

In Kahuna, the RocksDb instance is divided into a fixed number of column families and each **partition (Raft group)** points to a specific column family. It provides:

- **Durable WAL**: WAL logs are used by Raft (via `Kommander`) to persist write proposals.
- **Key/Value Store**: The K/V entries themselves (locks, user keys, sequences, metadata) are stored in RocksDB’s internal SST format.

This design ensures **write throughput, crash safety**, and **independent compaction** per partition.

### Internal Architecture Overview

RocksDB is based on a **Log-Structured Merge Tree (LSM)** architecture. Writes and reads are handled as follows:

#### Write Path:
- MemTable + WAL: Incoming writes are first appended to an in-memory buffer (`MemTable`) and a disk-backed Write-Ahead Log (`WAL`). This ensures durability.
- MemTable Flush: When the MemTable is full, it's flushed to disk as an **SST (Sorted String Table)** file in Level-0.
- Compaction: RocksDB compacts SST files in the background to merge data and reduce read amplification. It uses multi-level compaction (Level-0 to Level-N), optimizing space and performance.

#### Read Path:
- Reads check the MemTable first, then query SST files from top to bottom.
- An optional **Bloom Filter** and **block cache** are used to speed up lookups.

### Why RocksDB?

Kahuna favors RocksDB for persistent deployments where:

- High write volume and durability are critical.
- Fine-tuned compaction and flush control are needed.
- Performance at scale (many partitions, many keys) is a priority.

## SQLite in Kahuna

SQLite is a lightweight, self-contained SQL database engine widely used in embedded systems. It uses a **B-Tree** storage engine and supports ACID-compliant transactions out of the box.

Each partition (Raft group) can optionally use its own SQLite instance, backed by a file on disk. This setup:

- Provides a full transactional K/V layer by mapping keys to rows in a `KeyValue` table.
- Uses WAL for fast, append-only writes (ideal for Raft log entries).

Though designed for single-node usage, SQLite’s simplicity and minimal overhead make it a good option for lightweight and embedded Kahuna deployments.

### Internal Architecture Overview

SQLite stores all data in a single file and uses a **B-Tree** structure for indexing and data organization.

#### Write Path:
1. **WAL Mode** (Write-Ahead Logging):
   - All write operations are first appended to a WAL file instead of modifying the main database file directly.
   - This makes writes faster and more crash-resistant.

2. **Checkpointing**:
   - Periodically, SQLite transfers WAL contents into the main DB file via a **checkpoint** process.
   - This reconciles in-memory data with durable storage.

3. **Atomic Transactions**:
   - Multiple writes are grouped and committed atomically using journaling/WAL, maintaining consistency even in crash scenarios.

#### Read Path:
- Reads access the main DB file or query the WAL if a newer version of a page exists there.

### Why SQLite?

SQLite is well-suited for:

- **Low-resource environments**: Very small memory and disk footprint.
- **Ephemeral partitions**: Useful when full durability isn't critical.
- **Testing and simulations**: Quick setup, no external dependencies.
- **Simplicity**: Easy to inspect and debug data with SQL tools.

For high-volume, write-intensive production scenarios, **RocksDB** is preferred. But for simplicity, predictability, and ease of use, **SQLite** remains a valuable option in the Kahuna ecosystem.

## RocksDB vs SQLite

| Feature                     | **RocksDB**                              | **SQLite**                             |
|----------------------------|------------------------------------------|----------------------------------------|
| Storage model              | LSM Tree (log-structured)                | B-Tree                                 |
| Write performance          | High (append-only, memtable + WAL)      | Moderate (immediate page updates)      |
| Read performance           | Good for range queries & point lookups   | Fast for small datasets                |
| Concurrency                | Highly concurrent (thread-safe reads)    | Serialized writes (via WAL/mutex)      |
| Durability                 | WAL + compaction                         | WAL-based, with journaling             |
| Compaction                 | Automatic, multi-level                   | Not applicable                         |
| Binary size                | Larger footprint                         | Very small (~500KB)                    |
| Best for                   | High-throughput, write-heavy workloads   | Lightweight deployments, prototyping   |

