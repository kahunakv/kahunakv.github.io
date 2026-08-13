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

## Direct Write Coalescing

Persistent partition writes use a leader-local partition write aggregator before they enter Raft. The aggregator can combine non-transactional `SET`, `DELETE`, `EXTEND`, durable transaction-finalization records, and durable settlement records for the same partition into one `ReplicateEntries` call.

This optimization applies across requests. A `SetManyKeyValues(...)` call and independent single-key writes can land in the same partition queue if they target the same partition at the same time.

The aggregator does not coalesce ephemeral writes or open transaction staging. Ephemeral writes do not use Raft, and open transactions stage MVCC intents through the transaction coordinator. Durable transaction records enter the aggregator when finalization writes canonical records, prepared-intent deltas, materialized values, and settlement deltas.

See [Partition Write Coalescing](/docs/architecture/partition-write-coalescing/) for tuning options and metrics.

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

Durable transaction recovery metadata participates in this ordering. Transaction records, prepared-intent snapshots, and completion receipts must be durable before the checkpoint allows WAL retention to move past log entries that may be needed to reconstruct them.

## PITR Retention

Point-in-time recovery intentionally keeps committed WAL entries beyond the latest materialized-state checkpoint. Kahuna derives a protected log position from `PitrWindow` and `BaseSnapshotInterval`, approximately corresponding to `now - PitrWindow - BaseSnapshotInterval`, and prevents normal compaction from crossing that position.

Full backups wait for the apply barrier, flush pending materialized writes, create a backend checkpoint, and verify artifact sizes and checksums before publishing the manifest. Incremental backups then preserve committed WAL slices after that base image. Restore opens the checkpoint, verifies artifacts at point of use, and replays key/value mutations whose transaction commit HLC is at or before the selected timestamp. See [Backups and Point-in-Time Recovery](/docs/backups-and-point-in-time-recovery/) for the operational model, API surface, and restore constraints.

## Persistent vs Ephemeral

Persistent durability writes through Raft and eventually materializes to the backend. Ephemeral durability keeps state in memory and is optimized for temporary data.

Ephemeral objects may still participate in actor routing and expiration logic, but they should not be treated as restart-safe.
