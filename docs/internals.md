# Internals

This section describes how Kahuna works inside a running node. It is intended for contributors, operators debugging behavior, and users who want to understand the tradeoffs behind durability, replication, transactions, and performance.

Kahuna is built around a few core ideas:

- **[Raft](/docs/glossary/#raft)-backed [partition](/docs/glossary/#partition) ownership** decides which node is allowed to commit mutations for a key, lock, or sequence.
- **[Actors](/docs/glossary/#actor)** serialize access to in-memory state and isolate concurrency-sensitive code.
- **[Write-ahead logs](/docs/glossary/#write-ahead-log-wal)** make committed Raft operations recoverable.
- **Materialized persistence** stores locks and key/value entries so a node can avoid replaying every log forever.
- **Transaction machinery** provides isolation for key/value scripts and interactive transactions: [MVCC](/docs/glossary/#mvcc) (several versions per key), [write intents](/docs/glossary/#write-intent) (staged, uncommitted changes), operation registration (deduplicated retries), priority admission, durable decisions, and deferred [settlement](/docs/internals/transaction-lifecycle/#basic-concepts).

## Main Components

| Component | Role |
|-----------|------|
| `KahunaManager` | Facade that wires locks, key/values, sequences, persistence, and background writing. |
| `LockManager` | Routes lock operations to lock actors and handles lock replication/restoration. |
| `KeyValuesManager` | Routes key/value operations, scripts, and transactions to key/value actors. |
| `TransactionCoordinator` | Owns transaction sessions, working sets, finalization, cleanup, and durable decision recovery metadata. |
| `SequencerManager` | Implements named sequences on top of key/value operations under a reserved internal keyspace. |
| `BackupService` | Coordinates backup manifests, checkpoints, incremental WAL segments, and restore operations. |
| `BackgroundWriterActor` | Batches dirty persistent objects and writes materialized state to storage. |
| Kommander `IRaft` | Provides partition leadership, replication, log restore, and checkpoint hooks. |

## Request Flow

A persistent write is routed to its partition leader, committed through Raft, applied to actor memory, and later flushed to storage by the background writer. [Request Flow](/docs/internals/request-flow/) follows that path step by step, and [Transaction Lifecycle](/docs/internals/transaction-lifecycle/) covers reads, scripts, interactive transactions, durable two-phase commit, and deferred settlement.

More detail:

- [Request flow](/docs/internals/request-flow/)
- [Point reads](/docs/internals/point-reads/)
- [Range-scan observations](/docs/internals/range-scan-observations/)
- [Batched point and range probes](/docs/internals/batched-probes/)
- [Transaction lifecycle](/docs/internals/transaction-lifecycle/)
- [Durable settlement](/docs/internals/durable-settlement/)
- [Actor model](/docs/internals/actor-model/)
- [WAL and persistence](/docs/internals/wal-and-persistence/)
- [Backup, restore, and PITR](/docs/internals/backups-and-pitr/)
- [Snapshot transfer](/docs/internals/snapshot-transfer/)
- [Replication and recovery](/docs/internals/replication/)
- [MVCC and transactions](/docs/internals/mvcc/)
- [Sequences](/docs/internals/sequences/)
