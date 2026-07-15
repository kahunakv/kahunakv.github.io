import Architecture2 from '../assets/architecture2.png';
import Architecture3 from '../assets/architecture3.png';

# Distributed Transactions

Kahuna transactions coordinate reads, writes, locks, retries, and finalization across partitions. A transaction can touch keys owned by different Raft groups and different nodes, but it must still produce one result: either all accepted changes become visible or none do.

The central component is the **transaction coordinator**. The coordinator is the server-side owner of the transaction lifecycle and working set. It records what the transaction has read, modified, locked, prepared, committed, or rolled back. Clients keep a transaction handle, but the server owns the authoritative transaction state.

This design matters because an interactive transaction is not just a final `commit` call. A client may lose a response, retry a request, start commit while another operation is still in flight, or disappear without rolling back. Kahuna keeps those correctness rules inside the cluster instead of depending on every client to rebuild the final working set correctly.

## Example: A Transaction Across Partitions

The following [Kahuna script](/docs/scripts/) increments robot capacity in several regions while enforcing one global cap:

```kahuna
let us1_amount = get robots_us1
let us2_amount = get robots_us2
let eu1_amount = get robots_eu1
let sa1_amount = get robots_sa1

let total = to_int(us1_amount) + to_int(us2_amount) + to_int(eu1_amount) + to_int(sa1_amount)

if (total + @amount_to_incr) > @global_cap then
    throw "global cap amount exceeded"
end

set robots_us1 us1_amount + @amount_to_incr
set robots_us2 us2_amount + @amount_to_incr
set robots_eu1 eu1_amount + @amount_to_incr
set robots_sa1 sa1_amount + @amount_to_incr
```

The coordinator uses routing metadata to find the leader partition for each key. In this example, the transaction touches four partitions distributed across three nodes:

<div style={{textAlign: 'center'}}>
<img src={Architecture2} height="350" />
</div>

The coordinator can dispatch participant operations in parallel, but it still owns the transaction-wide decision. Each partition applies local locking, MVCC, prepare, commit, rollback, and cleanup under its own Raft-backed ordering.

## Coordinator and Participants

Two roles are involved:

- **Coordinator**: Owns the transaction identity, lifecycle, working set, finalization state, read validation policy, cleanup, and optional durable commit decision.
- **Participants**: The key partitions that execute the transaction's reads, writes, lock operations, prepares, commits, and rollbacks.

The coordinator may live on a different node from some or all participants. Routing is based on transaction and key placement:

- The live transaction session is routed by a stable coordinator key.
- Point operations are routed by the target key.
- Bucket and prefix operations are routed by the bucket prefix.
- Range operations are routed by range metadata.
- Durable commit recovery, when enabled, is routed by a record anchor key.

The transaction coordinator does not ask the client to provide a final list of keys to commit. It builds that list as operations complete.

## Transaction Handle

Interactive transactions use a canonical transaction handle:

```text
TransactionHandle
  TransactionId      globally unique HLC identity
  CoordinatorKey     routes the live in-memory session
  RecordAnchorKey    optional route to a durable decision
```

`CoordinatorKey` is created when the transaction begins and routes requests back to the live coordinator session.

`RecordAnchorKey` is assigned only when the coordinator folds the first confirmed persistent modified key into the working set. It is used to find a durable commit decision after the live coordinator session is gone.

The anchor is a routing key, not a user-visible key/value record. Kahuna stores durable decision metadata internally.

## Server-Owned Working Set

The coordinator keeps the authoritative working set for the transaction. It records:

- Modified keys and their durability
- Point locks, prefix locks, and range locks still held
- Latest-read observations used for optional validation
- Snapshot-read policy and timestamps
- Pending and completed registered operations
- Transaction timeout and finalization state
- The durable record anchor, when one exists

Only confirmed effects enter the working set. A failed conditional write does not count as a modified key. A failed lock acquisition does not count as a held lock. Snapshot reads do not create live read dependencies because they read from a fixed historical timestamp.

This prevents a common failure mode in client-managed transactions: a successful operation cannot be forgotten at commit time because the server recorded it when it succeeded.

## Operation Identity and Safe Retries

Each interactive transaction operation has a stable operation ID. The client creates one ID for one logical request and reuses it when retrying that same request.

Before a participant mutates state, the operation is registered with the coordinator. After the participant finishes, it reports the confirmed effect back to the coordinator:

```text
client
  -> coordinator: begin operation
  -> participant: execute read, write, lock, or delete
  -> coordinator: complete operation with confirmed effects
```

This lets Kahuna distinguish a retry from new work:

| Registration result | Meaning |
|---|---|
| `New` | The operation has not run and may execute. |
| `AlreadyPending` | The same operation is already in flight. |
| `AlreadyCompleted` | Return the cached result without applying the effect again. |
| `RejectedSessionClosed` | Finalization already closed the transaction. |
| `RejectedDuplicate` | The same operation ID was reused for different work. |
| `RejectedCapacity` | The session has too many pending operations. |

Participants also keep a bounded node-local cache of recent in-doubt operation results. If a participant applied a mutation but the completion acknowledgement was lost, retrying with the same operation ID can replay the completion without applying the mutation twice.

This cache is not durable history. It is a short-lived retry mechanism that closes the normal acknowledgement-loss window.

## Locking Modes

Kahuna supports pessimistic and optimistic transaction modes.

| Mode | Behavior | Best fit |
|---|---|---|
| `pessimistic` | Locks are acquired before or during operations. Point reads can use point locks, bucket reads can use prefix locks, and ordered range reads can use range locks. | Hot keys, workflows where retries are expensive, and reads that must block phantoms. |
| `optimistic` | Reads proceed without exclusive locks. At commit, Kahuna validates observed revisions and checks concurrent write intents on the read set. | Read-heavy workloads with low write contention. |

Pessimistic locking is the default. It is more conservative and can avoid wasted work under contention.

Optimistic locking improves concurrency, but conflicts are detected at commit. Clients should be prepared to retry aborted transactions.

## Pessimistic Transaction Flow

Using the robot capacity example, a pessimistic transaction follows this shape:

1. Acquire exclusive point locks for keys that must be protected.
2. Execute reads from the responsible partition leaders.
3. Acquire prefix locks for transactional bucket reads or range locks for bounded ordered reads when needed.
4. Run script logic or client-side application logic against the read values.
5. Create write intents for modified keys.
6. Prepare every participant through two-phase commit.
7. Commit every prepared participant.
8. Release point, prefix, and range locks.
9. Release MVCC read entries and other cleanup state.

Locks are lease-backed so they are not held forever if a caller disappears. Rollback and abandoned-session cleanup release any confirmed locks from the server-owned working set.

## Optimistic Transaction Flow

An optimistic transaction follows a different path:

1. Assign a transaction timestamp using the Hybrid Logical Clock.
2. Read keys using MVCC without acquiring exclusive locks.
3. Record the first observed revision for reads that need validation.
4. Run script logic or client-side application logic.
5. Validate that observed revisions have not changed.
6. Check for concurrent write intents over keys that were read but not written.
7. Create write intents for modified keys.
8. Prepare and commit through two-phase commit.

The concurrent write-intent check closes write-skew windows that simple revision checks can miss.

## Read Policy and Snapshot Reads

Transaction options can control read behavior:

- `ReadValidation` determines whether latest-value reads are tracked and validated before commit.
- Optimistic locking enables read validation for compatibility.
- `ReadTimestamp` gives point `Get` and `Exists` a fixed historical HLC timestamp.
- A fixed read timestamp cannot be combined with tracked read validation.

Snapshot reads are historical views, not read-your-own-writes views. A snapshot transaction can read the state visible at a specific HLC timestamp, but writes are not allowed inside that historical transaction.

For user-facing syntax and client examples, see [Transactions](/docs/distributed-keyvalue-store/transactions/) and [Revisions and Snapshot Reads](/docs/distributed-keyvalue-store/revisions/).

## Closing Before Finalization

Finalization starts by closing the transaction to new operations.

This is necessary because commit can race with in-flight work. If a write is already running while commit starts, the coordinator must not freeze the working set too early and miss that write. It also must not keep accepting new operations forever.

Kahuna solves this with a finalization fence:

1. The first close, commit, rollback, or reaper attempt moves the session out of accepting mode.
2. New operations are rejected.
3. Operations registered before the fence are allowed to finish or reach a safe retry state.
4. The coordinator freezes an immutable working-set snapshot.
5. Commit or rollback runs from that frozen snapshot.

Repeated close or finalization attempts observe the same frozen state. A late operation cannot slip into a transaction after commit has started.

## Finalization State Machine

Commit, rollback, close, and abandoned-session cleanup share one finalization slot per transaction. Exactly one caller owns the active attempt. Concurrent callers wait for that same attempt and observe the same result.

This prevents commit and rollback from running independently over the same mutable transaction.

Finalization outcomes are stable once terminal:

| Outcome | Meaning | Caller action |
|---|---|---|
| `Committed` | The transaction reached terminal commit. | Stop using the session. |
| `RolledBack` | Required rollback cleanup was acknowledged. | Stop using the session. |
| `MustRetry` | The final outcome is not known yet or transient work remains. | Retry commit or rollback with the same handle. Do not add operations. |
| `Aborted` | The session reached a definite non-committing outcome. | Start a new transaction if the business operation should be retried. |
| `Errored` | The handle is unknown, expired, or the outcome is unavailable. | Resolve at the application boundary. |
| `InvalidInput` | The request or policy combination is invalid. | Fix the request. |

A retryable failure releases the finalization slot for a later attempt, but it does not reopen the transaction to new data operations.

## Two-Phase Commit

Kahuna uses two-phase commit across the modified participants.

During **prepare**, each participant checks that it can commit the proposed mutation and records enough local state to move to commit or rollback while the transaction remains active.

During **commit**, the coordinator instructs prepared participants to make the mutations visible. Persistent values are replicated through the partition's Raft log and written to the configured storage engine. Ephemeral values are applied in memory.

During **rollback**, the coordinator releases staged writes, locks, and MVCC read entries from the frozen working set. Rollback attempts every cleanup item even if another cleanup item fails. Kahuna reports `RolledBack` only after mandatory cleanup receives positive acknowledgement.

Read-only transactions are valid. They can commit without a prepare round.

## Durable Commit Decisions

By default, transaction finalization is best-effort: the live coordinator session owns the outcome, and terminal results are retained in memory for a bounded idempotency window.

For persistent write sets that need recovery after the commit decision is installed, Kahuna supports durable commit decisions through `DecisionDurability.Durable`.

Durable decision mode is different from key durability:

- `KeyValueDurability.Persistent` means the value is replicated and stored persistently.
- `DecisionDurability.Durable` means the commit decision can be recovered after it has been installed.

Durable mode works by anchoring the decision to the first confirmed persistent modified key:

1. Prepare all non-anchor participants.
2. Prepare the anchor participant last with an initial commit decision record.
3. Commit the anchor first.
4. Commit the remaining participants.
5. Persist participant acknowledgement progress on the anchored decision record.
6. Mark the decision completed after every participant is acknowledged.

Committing the anchor is the point of no return. After that, the system must not report a definite abort. If a participant cannot be finished immediately, the transaction remains retryable and recovery continues driving the decision.

### Completion Receipts

Persistent participants record completion receipts when committed values are applied. A receipt lets recovery distinguish "already committed" from "unknown" after the original write intent is gone.

The ordering is important:

```text
participant value and receipt committed
  -> participant acknowledgement persisted on the decision record
  -> receipt may be forgotten
```

Receipts are restored from the committed key/value log and included in snapshots before WAL retention advances.

### Durable Mode Boundaries

Durable decision mode has specific limits:

- If the coordinator disappears before the anchor decision is installed, the active session is lost like a best-effort session.
- Prepared participant state is not made durable by this mode.
- If a participant changes leader after prepare but before commit, recovery may need the caller to retry.
- Ephemeral modified keys are rejected because neither the value nor a participant receipt can survive process loss.
- Read-only transactions and ephemeral-only modifications do not create a durable decision anchor.

Durable mode protects an installed commit decision. It does not make the whole interactive session durable from `Begin`.

## Durable Decision Recovery

Every node runs recovery for durable decisions whose anchor partition it currently leads. Recovery wakes periodically and when leadership changes.

For each outstanding decision, recovery can:

- Re-commit participants that are not acknowledged
- Use completion receipts to recognize already committed participants
- Advance acknowledgement progress
- Release receipts that are no longer needed
- Mark fully acknowledged decisions as completed
- Remove completed records after retention allows it

Decision records store logical participant keys rather than fixed partition IDs. If key ranges split, merge, or move, recovery uses current routing metadata to find the correct participant leaders.

Range split and merge operations transfer durable decision records and completion receipts before cutover. If that correctness metadata cannot be made durable on the destination partition, cutover is aborted instead of risking loss of the only recovery record.

## Abandoned Sessions and Reaping

If a caller starts a transaction and never commits or rolls back, the transaction reaper eventually closes and cleans it up.

The reaper uses HLC time. It waits for the transaction timeout plus a grace period, then claims the same finalization slot used by explicit commit and rollback.

Reaper behavior follows the same safety rules:

- A session with no unresolved operation is rolled back from its confirmed working set.
- If mandatory cleanup sees a transient failure, the session remains available for a later cleanup attempt.
- If an operation is still unresolved after the extended deadline, the session expires with an unknown error rather than falsely claiming rollback.
- A durable session with an installed commit decision is not rolled back. Recovery finishes the decision.

## Retention and Bounds

Several bounds keep transaction coordination predictable:

| Setting or limit | Default | Purpose |
|---|---:|---|
| `TransactionOutcomeRetentionMax` | `10000` | Maximum retained terminal outcomes. A non-positive value disables best-effort outcome retention and removes the durable-decision admission cap. |
| `TransactionOutcomeRetentionTtl` | `5 minutes` | Age window for terminal outcomes and completed durable decisions. A non-positive value disables age-based removal. |
| `CollectionInterval` | `60 seconds` | Tick interval for the transaction reaper and durable-decision recovery actor. |
| Pending operations per session | `4096` | Safety bound for registered operations in one transaction. Additional registrations are rejected. |
| Participant in-doubt results | `8192 per node` | Bounded cache for acknowledgement-loss recovery. |
| Participant finalize retries | `20 retries, 250 ms apart` | Retry window used while committing or rolling back prepared participants. |

Outstanding durable decision records count toward `TransactionOutcomeRetentionMax` when that cap is positive. Kahuna rejects a new durable transaction with modifications instead of evicting recovery state that may still be needed.

## Key Buckets and Locality

Hash-routed keys can spread one transaction across several partitions. That improves distribution, but it also adds participant fan-out.

When related keys should stay together, use a common bucket prefix:

```kahuna
let us1_amount = get `data-centers/robots_us1`
let us2_amount = get `data-centers/robots_us2`
let eu1_amount = get `data-centers/robots_eu1`
let sa1_amount = get `data-centers/robots_sa1`

let total = to_int(us1_amount) + to_int(us2_amount) + to_int(eu1_amount) + to_int(sa1_amount)

if (total + @amount_to_incr) > @global_cap then
    throw "global cap amount exceeded"
end

set `data-centers/robots_us1` us1_amount + @amount_to_incr
set `data-centers/robots_us2` us2_amount + @amount_to_incr
set `data-centers/robots_eu1` eu1_amount + @amount_to_incr
set `data-centers/robots_sa1` sa1_amount + @amount_to_incr
```

The shared `data-centers/` bucket routes those keys as one single-partition group:

<div style={{textAlign: 'center'}}>
<img src={Architecture3} height="350" />
</div>

This reduces cross-partition coordination and can improve transaction latency. For large ordered key spaces that may need to split over time, use [key-range sharding](/docs/distributed-keyvalue-store/key-range-sharding/) instead.

## Scripts and Interactive Transactions

Kahuna exposes transactions through scripts and through interactive client sessions.

Scripts execute on the server coordinator and reduce client/server round trips. They are a good fit when the transaction logic can be expressed in Kahuna Script.

Interactive transactions let application code drive the workflow from a client SDK. They are available through gRPC. The REST transport does not expose session start, commit, or rollback.

A typical interactive transaction chooses its policy at begin time:

```csharp
KahunaTransactionOptions options = new()
{
    Locking = KeyValueTransactionLocking.Pessimistic,
    Timeout = 10_000,
    DecisionDurability = DecisionDurability.Durable
};

await using KahunaTransactionSession session =
    await client.StartTransactionSession(options, cancellationToken);

await session.SetKeyValue(
    "accounts/alice",
    "90",
    durability: KeyValueDurability.Persistent,
    cancellationToken: cancellationToken);

await session.SetKeyValue(
    "accounts/bob",
    "110",
    durability: KeyValueDurability.Persistent,
    cancellationToken: cancellationToken);

bool committed = await session.Commit(cancellationToken);
```

Call `Commit` explicitly when the work should become visible. Disposing a still-pending session rolls it back, which makes `await using` a safety net for exceptions and early returns.

The session exposes diagnostic values such as `Status`, `TransactionId`, `Handle`, and `RecordAnchorKey`. Most applications should keep the session object and let the SDK carry the routing identity.

## Practical Guidance

- Use pessimistic locking for hot keys, inventory reservations, counters with business rules, and reads that must block phantoms.
- Use optimistic locking for mostly-read workflows where retries are acceptable.
- Use bucket prefixes when a transactional working set should stay on one partition.
- Use range reads and range locks for ordered key spaces that can split over time.
- Use durable commit decisions only for all-persistent write sets that need recovery after the commit decision exists.
- Keep transaction timeouts short enough that abandoned sessions are cleaned up quickly.
- Retry `MustRetry` with the same transaction handle and do not add more operations after finalization begins.
- Treat `Aborted` as a business-level retry from a new transaction.
- Treat `Errored` as an unknown or expired outcome that needs application-level handling.

The mental model is: the client owns the business workflow, while Kahuna owns transaction correctness. The coordinator records confirmed work, deduplicates retries, closes the session before finalization, commits or rolls back from a frozen working set, and recovers installed durable decisions when configured to do so.
