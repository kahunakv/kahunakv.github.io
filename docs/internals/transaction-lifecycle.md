# Transaction Lifecycle

This page explains how a Kahuna key/value transaction executes inside the system. It follows the path from API entry point, through routing and MVCC staging, into durable-intent two-phase commit, through Raft and the WAL, and finally into background settlement and recovery.

For user-facing API examples, see [Distributed Transactions](/docs/architecture/distributed-transactions/) and [Kahuna .NET Client](/docs/dotnet-client/).

## Transaction Shapes

Kahuna has two transaction shapes:

| Shape | Driven by | Entry point | Transport |
|---|---|---|---|
| Script transaction | The server runs a submitted script | `TryExecuteTransactionScript` | REST, gRPC, embedded |
| Interactive transaction | The client sends operations one by one | `StartTransaction`, operations, `CommitTransaction` | gRPC and embedded |

Both shapes converge on the same coordinator machinery. A script builds the working set while the script executor runs statements on the server. An interactive session builds the working set across several client round trips.

A bare multi-statement script is treated as one auto-commit transaction. A single-command script can be optimized into the direct command path and does not need the full transaction coordinator.

## Entry and Routing

Every external path enters the same internal contract:

```text
REST / gRPC / embedded
  -> IKahuna
  -> KahunaManager
  -> KeyValuesManager
  -> partition routing
  -> actor routing
```

`KeyValuesManager` first resolves the key space and data partition. The partition leader is the only node allowed to commit durable state for that partition. If the receiving node is not the leader, the request is forwarded over inter-node communication.

After leader routing, a consistent-hash actor router selects the local `KeyValueActor` shard that owns the key, bucket, or range state. Actors process one message at a time, so the mutable entry, lock, proposal, and MVCC maps do not need broad shared locking.

## Separate Keyspaces

Every key/value operation is either ephemeral or persistent:

| Durability | Storage | Transaction implication |
|---|---|---|
| Ephemeral | In memory only | Can participate in best-effort transactions, but cannot be part of a durable commit decision |
| Persistent | Raft plus materialized backend | Eligible for durable-intent two-phase commit |

The ephemeral and persistent keyspaces have separate actor routers. A key named `session/1` in ephemeral storage is not the same object as `session/1` in persistent storage. This separation is important under deferred settlement because persistent prepared intents must never be visible to ephemeral reads or writes for a same-named key.

## Staging Before Commit

Transactional writes do not immediately propose a user key/value record to Raft. The owning `KeyValueActor` stages:

- an MVCC entry for the transaction ID, containing the proposed value, revision, expiry, and state
- a write intent with a short lease, so other transactions can detect an in-progress writer

Reads inside the same transaction can see their own staged MVCC entries. Latest reads can also record read observations for validation. Snapshot reads are different: they read at a fixed historical HLC timestamp and do not create latest-state dependencies.

Non-transactional persistent writes skip transaction staging and go directly through the partition write aggregator.

## Server-Owned Working Set

The transaction coordinator owns the authoritative working set. Clients carry a transaction handle, but they do not provide the final list of keys to commit.

As operations complete, the coordinator records:

- modified keys and durability
- point, prefix, and range locks still held
- latest-read observations and validation policy
- transaction-wide snapshot timestamp policy
- registered operation IDs, pending operations, and completed operation responses
- timeout, locking mode, decision durability, lifecycle, and finalization state
- the durable record anchor, once a persistent modified key establishes one

Only confirmed effects are folded into this state. Failed conditional writes and failed lock acquisitions do not become modified keys or held locks.

## Operation Registration

Interactive operations use a stable operation ID and a digest of the requested work. Registration and the finalization fence share the same critical section:

```text
BeginOperation
  -> participant execution
  -> CompleteOperation with confirmed effects
  -> fold effects into TransactionContext
```

This closes two failure windows. A duplicate operation ID with the same declaration can replay the original response. The same ID with different inputs is rejected. If finalization has already closed the session, new operations cannot slip into the frozen working set.

Participants also keep a bounded in-doubt result cache. If a participant applied a mutation but the completion acknowledgement to the coordinator was lost, a retry with the same operation ID can replay completion without applying the mutation twice. This cache is a short retry aid, not durable history.

## Finalization Fence

Commit, rollback, close, and abandoned-session cleanup share one finalization slot per session.

Finalization proceeds in this order:

1. Close the session to new operations.
2. Drain operations registered before the fence.
3. Freeze an immutable copy of the server-owned working set.
4. Run commit or rollback from that snapshot.
5. Perform required cleanup.
6. Publish the same outcome to the owner and any concurrent callers.
7. Retain the terminal outcome before removing the active session.

A retryable finalization failure releases the attempt slot, but it does not reopen the session to new reads or writes. The caller should retry commit or rollback with the same handle.

## Commit Paths

`TransactionCoordinator.TwoPhaseCommit` splits the frozen working set by durability:

| Working set | Commit path |
|---|---|
| Read-only | Commit succeeds without prepare |
| All ephemeral | In-memory prepare and commit |
| All persistent | Durable-intent two-phase commit |
| Mixed | Ephemeral subset prepares first, then persistent durable finalization decides the outcome that drives ephemeral commit or rollback |

The persistent path now uses durable-intent two-phase commit. The retired manual-ticket persistent path is no longer the normal persistent commit path.

## Durable-Intent Two-Phase Commit

Durable mode uses two replicated stores:

| Store | Scope | Role |
|---|---|---|
| `TransactionRecordStore` | Anchor key partition | Canonical record keyed by `(TransactionId, Epoch)`. It moves once from `Undecided` to `Commit` or `Abort`. |
| `PreparedIntentStore` | Modified key partition | One live intent per modified key, carrying the staged committed value. |

The first confirmed persistent modified key becomes the record anchor. The anchor is a routing key for internal metadata, not a user key/value record.

The durable finalizer runs this sequence:

1. Build an immutable finalize input with transaction identity, manifest hash, record anchor, commit timestamp, decision deadline, participant manifest, and exact prepared intents.
2. Initialize the canonical record as `Undecided` and prepare the anchor partition's intents in one atomic ordered proposal when the anchor is also a participant.
3. Prepare every other participant partition concurrently.
4. Retry a prepare in place when it is blocked only by a predecessor's committed-but-unsettled intent.
5. Validate the read set after every prepare is durable.
6. Compare-and-set the canonical record to `Commit` only when every prepare succeeded and validation passed. Otherwise compare-and-set it to `Abort`.
7. Resolve prepared intents from the record outcome.

The decision record is the point of no return. Once it commits as `Commit`, Kahuna must not later report a definite abort for that transaction. If a concurrent recovery pass wins the record as `Abort`, the finalizer reports the record's actual outcome, not the outcome it hoped to write.

## Decision Deadlines

Each durable finalize freezes a decision deadline:

```text
commit timestamp + clamp(multiplier x observed finalize p99, floor, ceiling)
```

The p99 is a local duration estimate. It gives healthy coordinators enough time to finish under current load, while bounding how long recovery waits before presuming an undecided transaction was abandoned.

A late commit attempt does not force the record to `Commit`; the record remains `Undecided` and recovery may presume-abort it. A rising `kahuna.durable_tx.late_commit_rejections` or `kahuna.durable_tx.deadline_expiry_aborts` rate usually means the deadline margin is too tight for current latency.

## Aggregator Role

Durable record, prepared-intent, materialization, and settlement records enter Raft through the partition write aggregator. This lets concurrent durable transactions targeting the same partition share one `ReplicateEntries` call.

Aggregator submissions have an admission class:

| Class | Used for | Purpose |
|---|---|---|
| Ordinary | Direct persistent writes, record init, prepare | Normal partition write admission |
| Terminal | Decision, materialize, settle, recovery, metadata handoff | Reserved headroom so ordinary-write bursts cannot starve already-prepared transactions |

The anchor partition can submit `[TransactionRecord init, PreparedIntent prepare]` as one ordered bundle. A batch can mix direct key/value records and durable transaction records, but every submission keeps its own apply-on-commit callback and completion path.

## Deferred Settlement

`DurableDeferredSettlement` defaults to `true`. With the default:

1. The finalizer returns `Committed` as soon as the canonical decision record is durable.
2. Materialization and intent settlement run on a background task.
3. Recovery finishes settlement if that background task is lost.

This moves settlement off the commit critical path. The tradeoff is a short window where a committed value may still live as a prepared intent with resolution `Pending`.

Kahuna handles that window through intent-aware visibility:

| Operation | Behavior in the deferred window |
|---|---|
| Point read or exists | Looks up the canonical decision and serves the committed intent, ignores an aborted one, or waits/retries on undecided |
| Bucket, prefix, or range scan | Overlays visible prepared intents on the scan result and resolves foreign decisions when needed |
| New write | Materializes a committed predecessor intent before deriving revision, existence, and conditional checks |
| New transaction prepare | Waits or retries while a predecessor still owns the live intent |

When the canonical record is not local, the read or write path can route a lookup to the anchor-partition leader and retry with the terminal decision. It does not serve the stale pre-transaction value just because settlement has not materialized yet.

Setting `DurableDeferredSettlement` to `false` restores synchronous settlement: the finalizer waits for materialization and settlement before returning success.

## Recovery

`PreparedIntentRecoveryActor` periodically drives `DurableTransactionRecovery` for partitions the node currently leads.

For each unresolved intent whose recovery deadline is due:

- record says `Commit`: materialize the value and settle the intent
- record says `Abort`: discard and settle the intent
- record is `Undecided` inside its deadline: leave it for the live coordinator
- record is missing or `Undecided` after its deadline: drive an idempotent presumed abort, then resolve from the record that actually won

Recovery and request-path finalization can race safely because initialize, prepare, decide, materialize, and settle are idempotent. Recovery never guesses a terminal decision while the canonical record is still undecided inside its deadline.

## Completion Receipts and Range Movement

When a committed intent materializes, Kahuna records a completion receipt with the key/value commit. A duplicate commit or recovery re-drive can use the receipt to prove that the participant already applied the transaction after the original MVCC state is gone.

The receipt identity includes transaction, key, and durability, so a persistent receipt cannot satisfy an ephemeral operation for the same logical key.

Range split and merge transfer durable transaction records, prepared intents, and completion receipts to the destination partition before cutover. The transfer is replicated on the destination partition's Raft log and gates cutover. Range-lock transfer is separate and best-effort because range locks are in-memory leader state.

## WAL and Persistence

The Raft WAL is the durability authority:

1. The partition leader proposes an ordered batch.
2. A quorum persists it.
3. The committed entries apply to the in-memory state machines.
4. The background writer later flushes materialized state to RocksDB, SQLite, or memory.

Backend persistence is not the commit point. It is the materialized store that lets a node avoid replaying every log forever and serve evicted persistent entries after reload.

Two WAL optimizations matter for durable transaction latency:

- Group commit can coalesce several partitions into one storage flush.
- Single-fsync commit can acknowledge an auto-commit proposal after the propose quorum is durable and write the committed marker lazily.

## Outcome Contract

The transaction result intentionally separates conflicts from uncertainty:

| Outcome | Meaning |
|---|---|
| `Committed` | The transaction's durable decision is commit, or the best-effort commit completed |
| `RolledBack` | Mandatory rollback cleanup was acknowledged |
| `Aborted` | A real conflict, such as stale read validation or a concurrent writer |
| `MustRetry` | The outcome is uncertain or transient work remains; retry the same finalization |
| `Errored` | The handle is unknown, expired, or the outcome is unavailable |

Only conflict aborts are reported as `Aborted`. Prepare failures, admission rejection, deadline expiry, presumed abort, leader change, restore-in-progress, and infrastructure failure surface as `MustRetry` whenever retrying the same finalization is the honest answer.

## Bounds and Backpressure

Important transaction bounds:

| Setting or limit | Purpose |
|---|---|
| `DurableDecisionOutstandingMax` | Hard cap on outstanding undecided canonical records admitted by a node |
| `DurablePreparedIntentMaxCount` | Resident prepared-intent count bound |
| `DurablePreparedIntentMaxBytes` | Resident prepared-intent value-byte bound |
| `TransactionOutcomeRetentionMax` | Retained terminal outcome count for duplicate finalize idempotency |
| `TransactionOutcomeRetentionTtl` | Retained terminal outcome age window |
| `MaxTransactionTimeout` | Upper bound for admitted interactive session lifetime |
| Pending operations per session | In-flight operation bound |
| Total operations per session | Retained operation-record bound |

Important aggregator bounds:

| Setting or limit | Purpose |
|---|---|
| `KeyValueWriteMaxBatchItems` / `KeyValueWriteMaxBatchBytes` | Entries and payload selected for one partition Raft call |
| `KeyValueWriteMaxQueuedItemsPerPartition` / `KeyValueWriteMaxQueuedBytesPerPartition` | Per-partition admitted work |
| `KeyValueWriteMaxQueuedItemsGlobal` / `KeyValueWriteMaxQueuedBytesGlobal` | Node-wide ordinary admitted work |
| `KeyValueWriteTerminalReserveItemsPerPartition` / `KeyValueWriteTerminalReserveBytesPerPartition` | Per-partition terminal reserve |
| `KeyValueWriteTerminalReserveItemsGlobal` / `KeyValueWriteTerminalReserveBytesGlobal` | Node-wide terminal reserve |
| `KeyValueWriteMaxOperationBytes` | Hard ceiling for one admitted serialized write |
| `KeyValueWriteBatchExecutionTimeoutMs` | Maximum Raft round-trip time for one aggregator batch |

The core mental model is simple: a transaction stages writes under MVCC without Raft, then commit freezes the exact work and writes a durable decision through Raft. With deferred settlement, the durable decision is the client-visible commit point, while materialization can finish later without allowing stale reads.
