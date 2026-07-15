# MVCC and Transactions

Kahuna's key/value transaction engine combines MVCC, write intents, locks, operation registration, finalization fencing, two-phase commit, and optional durable commit decisions. This is what lets scripts and interactive transactions update multiple keys atomically across partitions.

## Transaction Coordinator

`TransactionCoordinator` owns transaction sessions and coordinates distributed reads, writes, validation, finalization, and cleanup. Kahuna Script execution uses this transaction machinery, and interactive client sessions use the same coordinator-owned lifecycle.

The important invariant is that the server owns the transaction working set. Clients may carry a transaction handle, but they do not send a final list of touched keys to commit. As commands succeed, the coordinator records confirmed effects and later commits or rolls back from that server-owned state.

It can optimize simple one-command scripts by dispatching directly to the relevant command. Multi-statement scripts, explicit transaction blocks, and interactive sessions use the full transaction path.

## Transaction IDs

Transactions use Hybrid Logical Clock timestamps as transaction IDs. HLC timestamps provide ordering that works across nodes while still preserving causal progression.

A transaction context tracks:

- Transaction ID
- Coordinator key and optional durable record anchor
- Modified keys and durability
- Point, prefix, and range locks still held
- Latest-read observations and validation policy
- Snapshot timestamp policy
- Registered operations and pending operation count
- Variables and script parameters for script execution
- Transaction status
- Locking mode
- Timeout
- Decision durability mode
- Finalization state and frozen working-set snapshot

Interactive operations also carry stable operation IDs. The operation registry lets Kahuna identify duplicate retries, reject reused IDs with different inputs, and avoid applying the same mutation twice after a lost response.

## MVCC Entries

`KeyValueEntry` stores the current value and metadata for a key. It can also hold `MvccEntries`, keyed by transaction ID. Each `KeyValueMvccEntry` contains a proposed or versioned value plus revision, expiration, state, and HLC metadata.

This lets Kahuna keep transactional state separate from the committed current value until the transaction commits.

Latest reads can record the visible revision as a read observation. During optimistic validation, the coordinator checks those observations against committed revisions and concurrent write intents before preparing mutations.

Snapshot reads are different. A read at a fixed HLC timestamp selects the newest revision whose commit timestamp is at or before that timestamp. Because it is a historical view, it does not create a live read dependency for latest-state validation.

## Write Intents

A write intent records that a transaction intends to modify a key. Kahuna uses write intents to prevent conflicting updates and to make commit/rollback deterministic.

There are two important levels:

- **Key write intent**: protects a single key.
- **Prefix write intent**: protects a bucket or prefix, which matters for operations such as `get by bucket`.
- **Range write intent or lock**: protects an ordered interval, which matters for bounded range reads.

Prefix and range protection prevent phantom inserts and conflicting writes while a transaction depends on a consistent predicate read.

## Locking Modes

Kahuna supports two transaction locking styles:

| Mode | Behavior |
|------|----------|
| Pessimistic | Acquire locks before or during operations. Point reads can use point locks, bucket reads can use prefix locks, and range reads can use range locks. |
| Optimistic | Read without exclusive locks, then validate read observations and concurrent write intents at commit time. |

Pessimistic locking reduces conflict surprises but can hold locks longer. Optimistic locking allows more read concurrency but requires conflict detection during prepare.

## Operation Registration and Working-Set Folding

Interactive transaction operations follow a registration path:

```text
BeginOperation
  -> participant execution
  -> CompleteOperation with confirmed effects
  -> fold effects into TransactionContext
```

Only confirmed effects are folded into the working set:

- Successful writes, deletes, and extends record modified keys.
- Successful point, prefix, and range lock acquisitions record held locks.
- Explicit releases remove matching lock descriptors.
- Latest point reads record read observations for cleanup and optional validation.
- Snapshot reads do not record live read dependencies.

Failed conditional writes and failed lock acquisitions do not enter the working set. This is what lets finalization avoid relying on client-side bookkeeping.

## Finalization Fence

Commit, rollback, close, and abandoned-session cleanup share one finalization slot. The first finalizer closes the transaction to new operations, waits for operations registered before the fence to drain, freezes the working set, and then runs commit or rollback from that immutable snapshot.

A retryable finalization failure can release the attempt slot for another commit or rollback call, but it never reopens the session to new reads or writes.

## Two-Phase Commit

For multi-key transactions, Kahuna uses a prepare/commit protocol:

1. Start the transaction and assign a transaction ID.
2. Read and write through participant leaders.
3. Fold confirmed effects into the coordinator working set.
4. Close the transaction to new operations before finalization.
5. Acquire locks or validate observations depending on locking mode.
6. Prepare mutations on all participant partitions.
7. Commit if every participant is ready.
8. Roll back if any participant fails before the commit decision becomes irreversible.
9. Release locks and clean up transaction state.

The transaction commits only when all participants commit. Otherwise, Kahuna rolls back prepared mutations so partial updates do not become visible.

Read-only transactions can commit without a prepare round.

## Durable Commit Decisions

Best-effort transactions keep terminal outcomes in memory for a bounded idempotency window. Durable decision mode adds recovery after a commit decision has been installed for an all-persistent write set.

The first confirmed persistent modified key becomes the record anchor. The coordinator prepares the anchor with an embedded decision record, commits the anchor first, then commits the remaining participants and advances acknowledgement progress on the anchored decision record.

Persistent participants store completion receipts when committed values are applied. Recovery uses those receipts to distinguish "already committed" from "unknown" after original intents are gone.

The ordering is:

```text
participant value and receipt committed
  -> participant acknowledgement persisted on the decision record
  -> receipt may be forgotten
```

Durable decision mode does not persist the active interactive session or participant prepare state. If the coordinator disappears before the anchor decision is installed, the session is lost like a best-effort transaction. Ephemeral modified keys are rejected because their values and receipts cannot survive process loss.

## Revisions and Snapshots

Each key tracks a revision counter. Reads can request a specific revision, and recent revisions can be cached. Transactions use revision and HLC metadata to decide which value is visible and whether a concurrent write invalidates a commit attempt.

`SET ... NOREV` still advances the current revision but intentionally skips the archived historical revision record. That reduces write amplification for cache-style values, but it also means a skipped revision cannot be served later by `GET ... AT <revision>` or by a historical snapshot read that needs that exact archived version.

## Snapshot Floor

The MVCC snapshot floor protects historical reads that must remain valid for longer than the normal revision-retention window. A client acquires a leased snapshot hold at timestamp `T`; while that hold is live, cleanup must keep the revision that was visible at or before `T`, plus every newer revision.

The effective floor is the minimum timestamp across all live holds. It is replicated through the system partition, so the floor survives restart and leader changes. Acquire, renew, and release operations can enter through any node, but they are routed to the system-partition leader before being committed.

The floor constrains both revision cleanup paths:

- In memory, Kahuna keeps the normal newest `RevisionRetention` revisions plus the boundary revision at or before the floor.
- On disk, persistent revision cleanup must not delete the boundary revision or anything newer, even when count-based or age-based retention would otherwise remove it.

Historical reads first try the in-memory archive. If the requested timestamp is older than the in-memory window, persistent read paths fall back to on-disk revision history. Point reads, range reads, bucket reads, and prefix scans all use the same rule: return the newest revision whose commit timestamp is at or before the requested snapshot timestamp.

The hold API is described in [Snapshot Holds](/docs/distributed-keyvalue-store/snapshot-holds/).
