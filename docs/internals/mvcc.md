# MVCC and Transactions

Kahuna's key/value transaction engine combines MVCC, write intents, exclusive locks, and two-phase commit. This is what lets scripts and interactive transactions update multiple keys atomically.

## Transaction Coordinator

`KeyValueTransactionCoordinator` parses scripts, starts transaction sessions, tracks transaction context, and coordinates distributed reads and writes.

It can optimize simple one-command scripts by dispatching directly to the relevant command. Multi-statement scripts and explicit transaction blocks use the full transaction path.

## Transaction IDs

Transactions use Hybrid Logical Clock timestamps as transaction IDs. HLC timestamps provide ordering that works across nodes while still preserving causal progression.

A transaction context tracks:

- Transaction ID
- Modified keys
- Acquired locks
- Variables and script parameters
- Transaction status
- Locking mode
- Timeout

## MVCC Entries

`KeyValueEntry` stores the current value and metadata for a key. It can also hold `MvccEntries`, keyed by transaction ID. Each `KeyValueMvccEntry` contains a proposed or versioned value plus revision, expiration, state, and HLC metadata.

This lets Kahuna keep transactional state separate from the committed current value until the transaction commits.

## Write Intents

A write intent records that a transaction intends to modify a key. Kahuna uses write intents to prevent conflicting updates and to make commit/rollback deterministic.

There are two important levels:

- **Key write intent**: protects a single key.
- **Prefix write intent**: protects a bucket or prefix, which matters for operations such as `get by bucket`.

Prefix intents prevent new keys from appearing under a bucket while a transaction depends on a consistent bucket read.

## Locking Modes

Kahuna supports two transaction locking styles:

| Mode | Behavior |
|------|----------|
| Pessimistic | Acquire exclusive locks before mutating keys. Conflicting transactions abort and retry. |
| Optimistic | Read without locks, then validate and prepare mutations at commit time. |

Pessimistic locking reduces conflict surprises but can hold locks longer. Optimistic locking allows more read concurrency but requires conflict detection during prepare.

## Two-Phase Commit

For multi-key transactions, Kahuna uses a prepare/commit protocol:

1. Start the transaction and assign a transaction ID.
2. Read keys from their leader partitions.
3. Execute script or client-side transaction logic.
4. Acquire locks or validate versions depending on locking mode.
5. Prepare mutations on all participant partitions.
6. Commit if every participant is ready.
7. Roll back if any participant fails.
8. Release locks and clean up transaction state.

The transaction commits only when all participants commit. Otherwise, Kahuna rolls back prepared mutations so partial updates do not become visible.

## Revisions and Snapshots

Each key tracks a revision counter. Reads can request a specific revision, and recent revisions can be cached. Transactions use revision and HLC metadata to decide which value is visible and whether a concurrent write invalidates a commit attempt.

## Snapshot Floor

The MVCC snapshot floor protects historical reads that must remain valid for longer than the normal revision-retention window. A client acquires a leased snapshot hold at timestamp `T`; while that hold is live, cleanup must keep the revision that was visible at or before `T`, plus every newer revision.

The effective floor is the minimum timestamp across all live holds. It is replicated through the system partition, so the floor survives restart and leader changes. Acquire, renew, and release operations can enter through any node, but they are routed to the system-partition leader before being committed.

The floor constrains both revision cleanup paths:

- In memory, Kahuna keeps the normal newest `RevisionRetention` revisions plus the boundary revision at or before the floor.
- On disk, persistent revision cleanup must not delete the boundary revision or anything newer, even when count-based or age-based retention would otherwise remove it.

Historical reads first try the in-memory archive. If the requested timestamp is older than the in-memory window, persistent read paths fall back to on-disk revision history. Point reads, range reads, bucket reads, and prefix scans all use the same rule: return the newest revision whose commit timestamp is at or before the requested snapshot timestamp.

The hold API is described in [Snapshot Holds](/docs/distributed-keyvalue-store/snapshot-holds/).
