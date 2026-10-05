# Transaction reads and locks

Kahuna has two distinct read paths: latest reads under a transaction identity, and historical reads
at a fixed `ReadTimestamp`. MVCC does not make every transaction a single historical snapshot.
This guide describes their visibility and conflict rules, including the deferred-settlement window.
For finalization and retries, see the [coordinator guide](/docs/architecture/distributed-transactions/)
and [transaction lifecycle](/docs/internals/transaction-lifecycle/).

## Latest transactional reads

A first transactional `GET` or `EXISTS` with no read timestamp records an MVCC observation **per key**.
It pins a committed value or absence, including a committed prepared intent that has not yet settled.
An undecided durable intent requires decision resolution before the read can choose its base.
The routed path can consult the intent's anchor leader when the canonical decision is not local;
an unresolved decision is retryable rather than permission to serve an older value.

The transaction reads its own staged value or tombstone. Otherwise, if the committed revision moves
past its pin, a follow-up point read or write can answer `Aborted` immediately. This check uses the
whole transaction HLC identity, including a nonzero logical counter. It also detects an observed
absence followed by another transaction creating the key. Commit still validates the registered
read dependencies; early detection does not replace final validation.

For example, with optimistic locking:

```text
A: GET k       -> revision 7 (pinned)
B: SET k; COMMIT -> revision 8
A: GET k       -> Aborted
```

Reading `x` and then `y` for the first time can observe commits from different moments. The pins are
not a shared read timestamp. Transactional scans also record observations, but callers must not
infer predicate stability from per-key pins alone: range locking and finalize validation govern
scan dependencies.

## Committed intents and newer heads

A canonical commit makes a prepared value visible before background settlement installs it in the
backend. A committed delete is absent, including for conditional writes such as `SET ... NX`.
A subsequent direct mutation can move the committed head beyond that lingering intent. Latest point
reads and scans then use the **strictly newer revision**, including a newer delete or expired value;
the old intent must not resurrect the key. The same rule applies after a persistent cache miss.

Equality alone does not prove an intent is materialized. `EXTEND` keeps the revision while changing
expiry, so an equal-revision intent can remain authoritative. `SET` and `DELETE` advance the revision.
Historical reads select according to commit time, so an older intent may still be visible at a
snapshot between commits. See [durable settlement](/docs/internals/durable-settlement/) for the log encodings.

## Fixed-timestamp reads

A nonzero `ReadTimestamp` selects the revision committed at or before that HLC through the as-of
history path, rather than creating a latest-read MVCC pin. A snapshot before an intent's commit HLC
uses the earlier committed state; at or after it, the intent's canonical decision determines visibility.
A live writer that may commit at or before the snapshot causes a safe-time wait, even when another
committed intent could otherwise answer the read.

Clock and flush fences prevent answering from incomplete history. Persisted-history fallback can
answer `MustRetry` while relevant committed revisions are unflushed. Reads more than 5 seconds ahead
of the serving node's HLC skip the clock fence and can change as later commits land within that future
snapshot. TTL filtering uses the current read time; a fixed timestamp does not freeze expiration.
History suppression (`SetNoRevision`) and reclaimed revisions also limit historical reads.

A [snapshot hold](/docs/distributed-keyvalue-store/snapshot-holds/) protects retained history; it does not turn a caller's
arbitrary timestamp into a safe cluster cut or recreate already-pruned history.

## Transaction locks

These are key/value transaction locks, separate from the
[distributed lock subsystem](/docs/distributed-locks/). They are leader-local actor state,
not replicated lease records. Quorum-confirmed admission fences stale leaders, but leadership loss
purges staging and locks. Locks reduce contention; validation and staging-continuity checks remain
necessary for correctness after a leader change.

A point-lock grant first converges the committed base, including a decided but unsettled predecessor
and a parked committed head. Re-acquiring a same-owner point lock follows the same rule. The grant's
base becomes a coordinator read dependency, so losing exclusion cannot authorize a stale computation.
An unresolved predecessor requires a retry/wait; a live foreign lock can answer `AlreadyLocked`.

Range-lock compatibility for overlapping ranges owned by different transactions is:

| Requested / held | Shared | Exclusive | WriteFence |
|---|---|---|---|
| Shared | compatible | conflict | compatible |
| Exclusive | conflict | conflict | conflict |
| WriteFence | compatible | conflict | conflict |

`Shared` and `Exclusive` acquisition also check covered foreign write intents. An undecided live
writer blocks acquisition; an in-flight direct replication or unresolved durable decision requires
waiting. A **decided** intent is different:

- `Shared` can be granted without waiting for background settlement; reads resolve the decision.
- `Exclusive` waits for predecessor intent slots to clear. The acquire loop helps settle the named
  decided keys and retries, reporting at most 4,096 blocking keys per response.
- `WriteFence`, used by split/merge quiesce, skips the per-key intent probe and places no per-key
  intents. It prevents new writes through the write-path range check while allowing Shared readers.

The session's renewal sweep re-acquires range locks through current routing, with bounded concurrency
and a deadline. Renewal is best-effort: failures, scheduling delays and failover can leave gaps.
It continues through finalize drain until cleanup owns the lock set, and stops after session loss
or the reap deadline. Durable prepares and the canonical decision, once replicated, are recovered
separately from these in-memory locks.

## Failure and regression coverage

`Aborted` is terminal for that transaction and requires a new transaction. `MustRetry` is an
unestablished outcome, not proof of rollback. Retry an unresolved durable finalize with the same
identity; see the coordinator guide for session and operation deduplication limits.

The edge cases above are exercised by `TestEarlyWriteConflictAbort`, `TestSupersededIntentReads`,
`TestSnapshotReadRepeatability`, `TestSnapshotCommitClockFence`,
`TestPointLockOverCommittedUnsettledWrite`, `TestRangeLockOverDecidedIntent`,
`TestLeaderChangeLostStaging`, and `TestRangeLockLeaseHandoff` in `Kahuna.Server.Tests`.

## Detecting Locks Lost During Failover

A lock grant now carries the partition and Raft term in which it was issued. A term identifies a leadership epoch. The coordinator keeps the first grant term for each partition; a later grant or renewal under another term records lost exclusion rather than silently replacing that evidence.

Commit checks that each recorded grant still routes to the same partition and that its confirmed leader still leads under the grant's term. This check also runs for read-only transactions. A changed term, moved range, or inability to confirm leadership after bounded attempts refuses commit with terminal `Aborted` and a `Lost lock: …` reason. Start a new transaction and repeat its reads and computation; reacquiring a lock cannot make the earlier computation safe.

For example:

```text
A: read k under a Shared range lock
   partition leader changes; its actor-local locks disappear
B: acquire exclusion, change k, commit
A: renew or upgrade its range lock on the new leader
A: commit -> Aborted (Lost lock: ...)
```

The proof detects leadership continuity, not every possible lease gap: a lease expiring without a leader change is outside this check. Older nodes that do not report grant terms supply no evidence for their grants, so this protection is incomplete during a mixed-version rollout. Upgrade all lock-granting replicas and coordinators before relying on it. Script and interactive transaction paths carry the evidence automatically; application lock method signatures are unchanged.

With one-phase apply-time validation, the commit bundle carries the anchor partition's grant term and replicas reject a bundle proposed in another term. Without that validation, a multi-process transaction carrying lock evidence uses the two-phase path.

| Metric | Meaning |
|---|---|
| `kahuna.transactions.lock_grant_term_changes` | Later grants detected under a different term. |
| `kahuna.transactions.lost_lock_aborts` | Aborts tagged by how the failed lock proof surfaced. |
| `kahuna.durable_tx.one_phase_gated_commit_leader_change_rejections` | Bundled decisions rejected for mismatched proposal/grant terms. |
