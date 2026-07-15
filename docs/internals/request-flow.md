# Request Flow

This page follows requests through a Kahuna node. It focuses on the internal path: transport, routing, actors, Raft, transaction coordination, and background persistence.

## Entry Points

A request can enter Kahuna through:

- REST
- gRPC
- the embedded in-process API
- inter-node gRPC forwarding

The public transport layer parses the request and calls the `IKahuna` surface. From there, `KahunaManager` delegates to the subsystem that owns the operation:

| Operation family | Manager |
|------------------|---------|
| Locks | `LockManager` |
| Key/value operations | `KeyValuesManager` |
| Scripts and transactions | `KeyValuesManager` plus `TransactionCoordinator` |
| Sequences | `SequencerManager` |
| Backup and restore | `BackupService` |

Clients may contact any node. If the receiving node is not the leader for the target partition, Kahuna routes or forwards the request to the current leader.

## Routing

Routing decides which partition and actor own the operation.

- Point key/value operations route by key.
- Bucket reads route by bucket prefix.
- Ordered range reads route through range metadata.
- Lock operations route by resource name.
- Sequence operations route through the sequence's reserved key/value key.
- Live transaction sessions route by coordinator key.
- Durable transaction decisions route by record anchor key.

Routing has two layers:

1. **Partition routing** finds the Raft partition leader that is allowed to commit the operation.
2. **Actor routing** chooses the local actor worker that owns the in-memory state for that key, bucket, range, or resource.

This split lets Kahuna distribute ownership across the cluster while keeping each actor's mutable state single-threaded.

## Persistent Key/Value Write

A normal persistent key/value write follows this path:

```text
client
  -> REST, gRPC, or embedded API
  -> KahunaManager
  -> KeyValuesManager
  -> KeyValueLocator
  -> partition leader
  -> key/value actor
  -> proposal actor
  -> Raft append and commit
  -> KeyValueReplicator
  -> in-memory state
  -> BackgroundWriterActor
  -> RocksDB, SQLite, or memory backend
```

The important boundary is Raft commit. A persistent write is not durable just because the local actor accepted it. The mutation becomes committed only after the partition's Raft group commits the log entry.

After commit, Kahuna applies the log entry to the in-memory state machine and queues materialized persistence. The background writer flushes the latest state and selected revision history to the configured backend. Later checkpoints allow Raft to compact older WAL entries that are no longer needed for normal recovery or PITR.

## Ephemeral Key/Value Write

An ephemeral write still routes through the responsible partition and actor, but it does not create durable storage guarantees.

```text
client
  -> transport
  -> KeyValuesManager
  -> partition leader
  -> ephemeral key/value actor
  -> in-memory state
```

Ephemeral values are optimized for temporary data such as cache entries and sessions. They can expire or be evicted under memory pressure and should not be treated as restart-safe.

## Reads and Snapshot Reads

Latest reads route to the partition leader that owns the key, bucket, or range. The actor reads from its in-memory state first. For historical reads, Kahuna selects the newest archived revision whose commit timestamp is at or before the requested snapshot timestamp.

Historical reads use this order:

1. Try the in-memory revision archive.
2. If the required persistent revision is older than the in-memory window, fall back to persisted revision history.
3. Return only keys visible at the requested HLC timestamp.

Snapshot holds can pin a timestamp so cleanup does not remove the persistent revisions needed by a long-lived historical view.

## Script Execution

Kahuna Script runs server-side. The script executor parses the script, binds parameters, and uses the transaction coordinator for multi-statement or explicit transaction execution.

```text
client
  -> ExecuteKeyValueTransactionScript
  -> ScriptTransactionExecutor
  -> TransactionCoordinator
  -> command execution through KeyValuesManager
  -> prepare and commit or rollback
```

Simple one-command scripts may be optimized into the direct command path. Multi-statement scripts and explicit `begin` blocks use the full transaction path.

## Interactive Transaction Operation

Interactive transactions are gRPC-only at the client transport level. A session begins with a transaction handle that contains a transaction ID and coordinator key.

Each transaction-scoped operation follows a registered path:

```text
client session call
  -> operation ID and declaration
  -> route to transaction coordinator
  -> BeginOperation
  -> route to participant leader
  -> execute read, write, lock, extend, or delete
  -> CompleteOperation with confirmed effects
  -> fold effect into server-owned working set
```

The operation ID is stable for one logical SDK call. If a response is lost and the same operation is retried, the coordinator and participant cache can recognize it and avoid applying the same mutation twice.

Only confirmed effects enter the transaction working set. Failed conditional writes and failed lock acquisitions are not committed to the working set.

## Commit and Rollback

Commit, rollback, close, and abandoned-session cleanup share one finalization gate.

Finalization follows this shape:

1. Close the transaction to new operations.
2. Wait for operations registered before the close to finish or reach a safe retry state.
3. Freeze the server-owned working set.
4. Validate reads when the policy requires it.
5. Prepare modified participants through two-phase commit.
6. Commit every prepared participant or roll back before the decision becomes irreversible.
7. Release locks, write intents, and MVCC read state.
8. Retain the terminal outcome for a bounded idempotency window.

A retryable finalization failure returns `MustRetry`. The session stays closed to new operations, and the caller should retry the same commit or rollback with the same handle.

## Durable Commit Decision Flow

When `DecisionDurability.Durable` is used, the request flow adds a recoverable decision record for all-persistent write sets.

```text
freeze working set
  -> choose first persistent modified key as record anchor
  -> prepare non-anchor participants
  -> prepare anchor with embedded decision record
  -> commit anchor first
  -> commit remaining participants
  -> persist participant acknowledgements
  -> mark decision completed
```

Committing the anchor installs the durable decision. After that point, Kahuna must not report a definite abort. If a participant cannot be finished immediately, the operation remains retryable and recovery continues from the anchored decision record.

Persistent participants record completion receipts when their committed values are applied. Recovery uses those receipts to distinguish "already committed" from "unknown" after the original write intent is gone.

## Recovery and Background Work

Several background paths continue after request handling:

- `BackgroundWriterActor` flushes materialized persistent state and revision history.
- Raft restore replays committed logs after restart.
- `TransactionReaperActor` closes and rolls back abandoned sessions when possible.
- `CoordinatorDecisionRecoveryActor` finishes installed durable commit decisions.
- Backup and PITR jobs flush storage checkpoints and copy committed WAL segments.
- Range split and merge operations transfer correctness metadata before cutover.

These paths use the same routing and leadership rules as request traffic. A background actor that no longer leads the relevant partition must retry or let the new leader continue.

## Failure Boundaries

The request flow has a few important boundaries:

- A local actor accepting work is not the same as a persistent commit; Raft commit is the durable ordering point.
- The transaction coordinator owns the working set; clients do not supply it at commit time.
- `MustRetry` means the caller should retry the same operation or finalization, not start adding new work to a closed transaction.
- Durable decision mode protects an installed commit decision, not the whole active transaction from `Begin`.
- Ephemeral data can participate in transactions, but it cannot be part of a durable commit decision.
