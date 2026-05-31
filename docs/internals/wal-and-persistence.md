# WAL and Persistence

Kahuna has two durability layers that serve different purposes:

- **Raft WAL**: the authoritative replicated operation log managed by Kommander.
- **Kahuna persistence backend**: materialized lock and key/value state used for fast recovery and lookup.

Keeping these layers separate is important. The WAL records committed operations in order. The persistence backend stores the latest durable object state and selected revision data.

## Raft WAL

Every persistent mutation goes through a Raft partition. The partition leader appends a log entry and replicates it to followers. Once the entry is committed, Kahuna applies it to the in-memory state machine.

The Raft WAL is responsible for:

- preserving committed operation order,
- allowing followers to catch up,
- restoring uncheckpointed committed logs after restart,
- supporting leader failover without losing committed operations.

Kahuna uses Kommander for Raft. Depending on configuration, WAL storage can be backed by memory, RocksDB, or SQLite.

## Materialized State

Kahuna's persistence backend is represented by `IPersistenceBackend`. It stores:

- lock entries,
- key/value entries,
- key/value revisions,
- bucket/prefix lookup data.

Implementations include:

- `MemoryPersistenceBackend`
- `RocksDbPersistenceBackend`
- `SqlitePersistenceBackend`

Persistent lock and key/value actors keep hot state in memory. Dirty entries are queued to `BackgroundWriterActor`, which writes batches to the backend.

## Background Flush

`BackgroundWriterActor` batches writes with limits on item count and packet size. It retries failed backend writes with jittered backoff. Successfully flushed batches mark their partitions as needing a checkpoint.

The flush path is:

1. A committed mutation changes actor state.
2. The actor queues a `QueueStoreLock` or `QueueStoreKeyValue` request.
3. `BackgroundWriterActor` groups dirty items.
4. The backend stores the batch.
5. The partition is marked for checkpoint.
6. A later checkpoint tells Raft that older logs can be compacted.

## Checkpoints

Checkpoints connect materialized persistence with Raft log compaction. Once dirty state for a partition has been written, the background writer can ask Raft to replicate a checkpoint for that partition. After checkpointing, the system does not need to replay all older logs to reconstruct the same state.

## Persistent vs Ephemeral

Persistent durability writes through Raft and eventually materializes to the backend. Ephemeral durability keeps state in memory and is optimized for temporary data.

Ephemeral objects may still participate in actor routing and expiration logic, but they should not be treated as restart-safe.
