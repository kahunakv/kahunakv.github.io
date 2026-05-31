# Internals

This section describes how Kahuna works inside a running node. It is intended for contributors, operators debugging behavior, and users who want to understand the tradeoffs behind durability, replication, transactions, and performance.

Kahuna is built around a few core ideas:

- **Raft-backed partition ownership** decides which node is allowed to commit mutations for a key, lock, or sequence.
- **Actors** serialize access to in-memory state and isolate concurrency-sensitive code.
- **Write-ahead logs** make committed Raft operations recoverable.
- **Materialized persistence** stores locks and key/value entries so a node can avoid replaying every log forever.
- **MVCC and write intents** provide transactional isolation for key/value scripts and interactive transactions.

## Main Components

| Component | Role |
|-----------|------|
| `KahunaManager` | Facade that wires locks, key/values, sequences, persistence, and background writing. |
| `LockManager` | Routes lock operations to lock actors and handles lock replication/restoration. |
| `KeyValuesManager` | Routes key/value operations, scripts, and transactions to key/value actors. |
| `SequencerManager` | Implements named sequences on top of key/value operations under a reserved internal keyspace. |
| `BackgroundWriterActor` | Batches dirty persistent objects and writes materialized state to storage. |
| Kommander `IRaft` | Provides partition leadership, replication, log restore, and checkpoint hooks. |

## Request Flow

For a typical persistent key/value write:

1. A client sends a REST, gRPC, or in-process request.
2. `KahunaManager` delegates to `KeyValuesManager`.
3. The locator determines the partition leader for the key.
4. If the current node is not the leader, the request is forwarded through inter-node communication.
5. The leader routes the request to a consistent-hash actor for that key.
6. The actor validates state, creates a proposal, and submits the mutation through Raft.
7. Once Raft commits the log entry, the replicator applies it to the in-memory state machine.
8. The background writer eventually flushes the materialized entry to the persistence backend.

More detail:

- [Actor model](internals/actor-model.md)
- [WAL and persistence](internals/wal-and-persistence.md)
- [Replication and recovery](internals/replication.md)
- [MVCC and transactions](internals/mvcc.md)
- [Sequences](internals/sequences.md)
