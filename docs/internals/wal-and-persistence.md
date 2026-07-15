# WAL and Persistence

Kahuna has two durability layers that serve different purposes:

- **Raft WAL**: the authoritative replicated operation log managed by Kommander.
- **Kahuna persistence backend**: materialized lock and key/value state used for fast recovery and lookup.

Keeping these layers separate is important. The WAL records committed operations in order. The persistence backend stores the latest durable object state and selected revision data.

## Raft WAL

Every persistent mutation goes through a Raft partition. The partition leader appends a log entry and replicates it to followers. Once the entry is committed, Kahuna applies it to the in-memory state machine.

The Raft WAL is responsible for:

- Preserving committed operation order
- Allowing followers to catch up
- Restoring uncheckpointed committed logs after restart
- Supporting leader failover without losing committed operations

Kahuna uses Kommander for Raft. Depending on configuration, WAL storage can be backed by memory, RocksDB, or SQLite.

## Materialized State

Kahuna's persistence backend is represented by `IPersistenceBackend`. It stores:

- Lock entries
- Key/value entries
- Key/value revisions
- Bucket/prefix lookup data
- Checkpointed transaction recovery metadata such as completion receipts and coordinator decisions

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

Durable transaction recovery metadata participates in this ordering. Completion receipts and coordinator decision snapshots must be durable before the checkpoint allows WAL retention to move past log entries that may be needed to reconstruct them.

## PITR Retention

Point-in-time recovery intentionally keeps committed WAL entries beyond the latest materialized-state checkpoint. Kahuna derives a protected log position from `PitrWindow` and `BaseSnapshotInterval`, approximately corresponding to `now - PitrWindow - BaseSnapshotInterval`, and prevents normal compaction from crossing that position.

Full backups flush pending materialized writes before creating a backend checkpoint. Incremental backups then preserve committed WAL slices after that base image. A restore opens the checkpoint and replays the slices until the selected HLC timestamp. See [Backups and Point-in-Time Recovery](/docs/backups-and-point-in-time-recovery/) for the operational model and current public API limitations.

## Persistent vs Ephemeral

Persistent durability writes through Raft and eventually materializes to the backend. Ephemeral durability keeps state in memory and is optimized for temporary data.

Ephemeral objects may still participate in actor routing and expiration logic, but they should not be treated as restart-safe.
