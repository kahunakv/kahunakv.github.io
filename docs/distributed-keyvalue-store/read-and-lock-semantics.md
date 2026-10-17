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
expiry, but every mutation is stamped strictly after the head it replaces. At equal revision, a head
whose `LastModified` is strictly later than the intent's commit timestamp supersedes the intent for
latest reads and snapshots at or after that later stamp. The intent remains authoritative for a
snapshot before the later head, or when the head's stamp is equal or older. `SET` and `DELETE` advance the revision.
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
of the serving node's HLC return `MustRetry`; they are never served without the clock fence.
Retry the same cluster-minted timestamp after the serving clock catches up. Arbitrary future timestamps
can remain refused. `kahuna.kv.snapshot_clock_fence_refused_total` counts these refusals. TTL filtering uses the current read time; a fixed timestamp does not freeze expiration.
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
`TestLeaderChangeLostStaging`, `TestRangeLockLeaseLapse`, and `TestRangeLockLeaseHandoff` in `Kahuna.Server.Tests`.

## Detecting Locks Lost During Failover

A lock grant now carries the partition and Raft term in which it was issued. A term identifies a leadership epoch. The coordinator keeps the first grant term for each partition; a later grant or renewal under another term records lost exclusion rather than silently replacing that evidence.

Commit checks that each recorded grant still routes to the same partition and that its confirmed leader still leads under the grant's term. This check also runs for read-only transactions. A changed term, moved range, or inability to confirm leadership after bounded attempts refuses an interactive commit with terminal `Aborted` and a `Lost lock: …` reason. A self-contained script instead returns `MustRetry` with the reason so the client can rerun it as a new transaction; real conflicts remain `Aborted`. Start a new transaction and repeat its reads and computation; reacquiring a lock cannot make the earlier computation safe.

For example:

```text
A: interactive session reads k under a Shared range lock
   partition leader changes; its actor-local locks disappear
B: acquire exclusion, change k, commit
A: renew or upgrade its range lock on the new leader
A: commit -> Aborted (Lost lock: ...)
```

The proof also rejects a transaction when the leader has recorded that one of its range locks lapsed, even if the term is unchanged. A later renewal or regrant does not erase that record. The actor records the holder in the same turn that first observes the dead lock, before permitting work that relies on its absence. This includes a session-owned range lock exceeding its configured ceiling.

Explicit range-lock leases held by an actor use the node's monotonic elapsed-time clock. A forward wall-clock or HLC jump no longer immediately expires those leases. Export for split/merge or listing converts the remaining duration into an HLC deadline; import converts that deadline back into a local monotonic lease. Transfer is therefore still sensitive to HLC differences while the lock is in transit. Write-intent expiry and the age ceiling for session-owned locks remain HLC-based.

This is an observed-lapse check, not an apply-time proof of continuous lease ownership: a lease expiring between one-phase bundle validation and apply remains outside it. Lapse records are node-local and retained for the configured session-owned ceiling, or ten minutes when that ceiling is disabled; they are not permanent revocations. Older nodes that do not report grant terms supply no evidence for their grants, so this protection is incomplete during a mixed-version rollout. Upgrade all lock-granting replicas and coordinators before relying on it. Script and interactive transaction paths carry the evidence automatically; application lock method signatures are unchanged.

With one-phase apply-time validation, the commit bundle carries the anchor partition's grant term and replicas reject a bundle proposed in another term. Without that validation, a multi-process transaction carrying lock evidence uses the two-phase path.

| Metric | Meaning |
|---|---|
| `kahuna.transactions.lock_grant_term_changes` | Later grants detected under a different term. |
| `kahuna.transactions.lost_lock_aborts` | Aborts tagged by how the failed lock proof surfaced; `detected="lease_lapsed"` identifies recorded range-lock lapses. |
| `kahuna.durable_tx.one_phase_gated_commit_leader_change_rejections` | Bundled decisions rejected for mismatched proposal/grant terms. |

## Staged Writes and Commit Probes

Every staged `SET`, `DELETE`, and `EXTEND` plants a write intent, regardless of the conflict policy. Commit checks that the exact intent the first stage used still owns the key, is live, and was never observed lapsing. Renewal cannot repair a lapse. A lost intent is a lost-exclusion refusal: interactive sessions return `Aborted`, while scripts return `MustRetry` and rerun their computation.

A successful probe claims the intent for commit. Its ordinary staged-write lease no longer expires; commit or rollback clears it, and the session-owned liveness ceiling bounds abandoned holds. This prevents a slow one-phase append from opening a snapshot-read gap merely because the original lease elapsed. The probe reports the confirmed participant term; one-phase replication checks the anchor's expected term before append, even with apply-time validation disabled. A different term refuses the bundle before durable entries exist; a missing term disables bundling and uses the standard flow.

A probe passes a key only on its clean `DoesNotExist` answer. An answer such as `MustRetry`, `WaitingForReplication`, or an unknown response proves neither cleanliness nor conflict and returns `MustRetry`. Two-phase prepares remain available for an interactive retry under the same identity. An actually detected conflict still aborts; a missing result for a requested key is treated as a broken probe contract and aborts too.

| Metric | Meaning |
|---|---|
| `kahuna.transactions.lost_staged_intent_aborts` | Commit refusals because a staged write lost its original intent. |
| `kahuna.durable_tx.commit_probes_unproven` | Retryable refusals when a returned probe answer established nothing. |
| `kahuna.durable_tx.one_phase_bundle_term_fence_refusals` | One-phase bundles refused before append because the anchor term changed. |
| `kahuna.kv.staged_chain_break_rollbacks` | Transactions with lost-staging detections rolled back or reaped before a commit attempt. |
