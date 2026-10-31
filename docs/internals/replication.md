# Replication and Recovery

Read this page when you diagnose lagging followers, retries during failover, or replica moves. It explains how a persistent write becomes committed, how a restarted node rebuilds its state, how requests reach the right node, and what happens when leadership or placement changes.

Kahuna uses [Raft](/docs/glossary/#raft) replication to make persistent mutations durable and ordered. The server wires Raft events to Kahuna through `ReplicationService`.

## Startup Wiring

On startup, `ReplicationService` subscribes Kahuna to Raft events:

- `OnLogRestored`
- `OnReplicationReceived`
- `OnReplicationError`

Then it joins the Raft cluster. Embedded nodes perform equivalent wiring in `EmbeddedKahunaNode`.

## Commit Path

For a persistent mutation:

1. The leader actor validates the request.
2. A proposal is created for the mutation.
3. The proposal is serialized as a Raft log entry.
4. Raft replicates the entry to the partition group.
5. Once committed, Raft raises `OnReplicationReceived`.
6. Kahuna's replicator applies the committed entry to the in-memory state.
7. The materialized state is queued for background persistence.

[Request Flow](/docs/internals/request-flow/) shows this path as a sequence diagram, from the receiving node through [quorum](/docs/glossary/#quorum) commit to background persistence.

This is why a local actor accepting a request is not enough. The committed Raft log is the source of truth for ordering and durability.

## Log Types

Kahuna categorizes replicated logs with simple type names:

| Type | Meaning |
|------|---------|
| `lock` | Lock state mutation. |
| `kv` | Key/value state mutation. |
| `rangemap` | Key-range descriptor map, replicated on [partition 0](/docs/glossary/#partition-0) (the system partition). |
| `snapshotfloor` | Snapshot-hold floor registry, replicated on partition 0. |
| `coorddecision` | Legacy coordinator-decision delta. |
| `txnrecord` | Canonical transaction-record delta on the anchor partition. |
| `preparedintent` | Participant prepared-intent and settlement delta. |
| `receipt` | Completion receipt handoff for range split/merge movement. In steady state, receipts ride key/value commits. |

`ReplicationSerializer` serializes these messages with protobuf. Larger values use recyclable memory streams to reduce allocation pressure.

## Restore Path

During recovery, Raft replays committed logs that are newer than the latest checkpoint. Kahuna receives those logs through `OnLogRestored`.

The restore path:

1. Raft loads logs from its [write-ahead log (WAL)](/docs/glossary/#write-ahead-log-wal).
2. Kahuna routes each log by replication type.
3. Lock, key/value, range-map, snapshot-floor, transaction-record, prepared-intent, legacy decision, and receipt handlers rebuild state.
4. Materialized persistence provides checkpointed baseline data.
5. New committed logs continue through the normal replication path.

## Inter-Node Forwarding

Clients may contact any node. If the receiving node is not the leader for a resource's partition, Kahuna forwards the operation through `IInterNodeCommunication`.

The production implementation uses gRPC and shared batchers. This lets Kahuna combine related inter-node requests and reduce per-operation network overhead.

The gRPC batchers can coalesce independent server-to-server envelopes onto one stream message while keeping each inner request's own ID, type, hop count, and response. Order-sensitive maintenance and placement operations are serialized per stream so a later maintenance request cannot overtake an earlier one from the same peer.

Forwarded key/value and lock requests include a hop count. If leadership or placement metadata is briefly inconsistent, the hop budget turns a potential forwarding loop into `MustRetry`, letting the client retry after the cluster view converges.

With [replica placement](/docs/replica-placement/), the receiving node may also be a non-host for the target partition. It still accepts the client request, resolves the partition's hosting replicas, and forwards to a node that can serve the partition. Hosting changes can race with requests, so callers may see retryable responses while a partition is moving.

## Replica Placement

Kahuna's default placement is full replication: every voter hosts every partition. A positive replication factor stores each data partition on an explicit replica set.

The partition map records:

- The partition lifecycle state
- The partition generation
- The effective replication factor
- Replica endpoints
- Replica roles such as `Voter`, `Learner`, and `Removing`

Replica changes are committed through partition 0 before data movement proceeds. A new replica starts as a [learner](/docs/glossary/#leader-follower-and-learner), which receives data but does not vote. It catches up from the log or a partition [snapshot](/docs/glossary/#snapshot), and is promoted only after it is close enough to the leader for the configured stable window. Removals are staged so a partition keeps a safe voter set while the old host is drained and purged.

Catch-up is bounded on both the streaming and buffering paths. Leaders cap outbound bytes per peer, cap backfill (resending missed log entries to a lagging follower) by entry count and bytes, and retry lagging followers through heartbeat/backfill. Snapshot rescue has a convergence breaker: if repeated rescue cycles still leave a follower below the compaction floor (the oldest log entry the leader still keeps), the leader pauses aggressive rescue for that peer while allowing periodic probes so a recovered follower can be seeded later. Small snapshot exports can be cached for retry so a failed transfer does not immediately rebuild the same snapshot.

Compaction also accounts for peers that go silent. A live follower that recently needed snapshot rescue can hold the compaction floor within a configured lag budget so normal compaction does not immediately put it below the floor again. A peer that stops answering holds compaction only for the silent-peer retention window; after that, it no longer prevents compaction and must restart from a snapshot when it comes back.

The placement controller runs on the partition 0 leader. It repairs under-replicated partitions first, then removes extra replicas, then balances replica counts across nodes. Per-partition overrides change the target; the controller performs the actual movement on later passes.

Useful placement metrics include:

| Metric | Meaning |
|--------|---------|
| `kahuna.placement.replicas_gained` | Replica records added to the local node. |
| `kahuna.placement.replicas_lost` | Replica records removed from the local node. |
| `kahuna.placement.forwards_resolved` | Requests forwarded successfully using placement information. |
| `kahuna.placement.forwards_unresolved` | Forwarding attempts that could not resolve a valid host. |
| `kahuna.placement.leader_hint_hits` | Forwarding used a known partition leader hint. |
| `kahuna.placement.leader_hint_misses` | Forwarding had to proceed without a usable leader hint. |

## Replica Placement Internals

These details explain how the placement controller converges. The operator procedure is in [Replication Factor and Replica Placement](/docs/replica-placement/).

### Legacy Full-Replication Conversion

Kahuna, pinned to Kommander 1.11.3, can convert legacy full-replication partitions when a positive effective replication factor and the placement rebalancer are enabled. Each eligible active partition with an empty replica set first receives an explicit set of **all committed roster voters**. This preserves its existing quorum; it does not immediately replace that quorum with an arbitrary factor-sized subset. Normal placement trims then remove surplus replicas one step at a time toward the target. Conversion is bounded by `MaxReplicaMovesPerPass` (`--raft-max-replica-moves-per-pass`), and a failed map commit is retried on a later pass.

With rebalancing disabled the partitions stay fully replicated and a warning explains why conversion has not begun. Full replication with an effective factor of zero remains an intentional mode, not pending migration.

The leader of partition 0 exposes `raft.placement.ranges_awaiting_initial` and the counter `raft.placement.initial_assignments_total` on the `Kommander` meter. Embedded hosts can inspect `node.Raft.GetPartitionsAwaitingPlacement()`. A zero pending count says assignment finished, not that all subsequent trimming and movement finished.

### Leader Removal and Rebalancing

Removing a partition's leader replica requires a confirmed handoff to another replica before marking it `Removing`. If the requesting node is not that partition's leader, it sends a transfer suggestion and polls the confirmed leader within a bound. An unconfirmed handoff returns `LeadershipNotConfirmed`, leaving removal for a later placement pass. A replica excluded by the committed map is also treated as a vacated leader for election gating, even if its process remains alive.

Trim selection prioritizes replica load and zone placement; leadership only breaks ties among equally loaded candidates. A balancing add is planned only when its predicted follow-up trim improves load distribution, avoiding repeatedly adding and removing the same replica. These are convergence safeguards, not an exact balancing deadline.

### Learner Promotion Diagnostics

Placement accepts restarted nodes' fresh load-report incarnations even when their report version counters reset. If the gossiped leader hint is absent or dead, learner-lag checks can resolve a quorum-confirmed leader before deciding promotion readiness. These are recovery paths, not permission to promote an unconfirmed learner.

`--raft-learner-promotion-stall-warning-after` (30,000 ms) logs the last failed check when a placement-added learner stays unpromotable. It is diagnostic only; it does not relax the lag or stability requirements. A non-member range leader is reported as a stall condition. After a failed drain is confirmed rolled back to `Voter`, the node's departure latch is released so a later eviction can trigger automatic rejoin. A removal that may still commit keeps the latch.

### Leave Requests and Elections

Requesting leave does not immediately stop the node from participating in elections: it remains eligible while membership removal is being committed, so it can help elect the partition 0 leader needed to finish that removal. A refused or failed API leave leaves the node campaigning while it remains a member. After removal commits, candidacy is suppressed.

Automatic rejoin is suppressed while departure remains in force. A refusal that committed nothing, or a confirmed rollback of a decommission drain to `Voter`, releases that suppression. A newer committed roster naming the node `Voter` also confirms rollback when its acknowledgement was lost. A timed-out removal without such proof can still commit later, so suppression remains. Verify committed membership after an uncertain response and finish decommissioning explicitly. Process shutdown follows its own teardown path and suppresses candidacy after its removal attempt ends; disposal alone is not evidence that membership removal committed.

## Leader Changes

Raft handles leader election per partition. When a leader changes:

- Only the current leader can commit new writes for that partition
- Followers catch up from the leader's log
- Committed entries remain ordered
- Uncommitted proposals may need to be retried
- Staged transactional writes, unprepared [write intents](/docs/glossary/#write-intent), and point, prefix, or range locks in every mode from the old leadership term are discarded on the node that lost leadership

Clients can see retry or abort responses when leadership changes race with an operation.

For durable transaction decisions, the node that becomes leader for the anchor partition is responsible for continuing recovery of any outstanding decision records it now owns.

### Leadership Transfer

A leadership transfer, such as one suggested by the [leader balancer](/docs/leader-balancing/), is best-effort. Winning an election is not enough for the target to serve: it must drain committed log entries and pass the leadership barrier, and a contained or incomplete target can relinquish immediately. Kommander (since 1.9.7; Kahuna pins 1.11.3) reads the WAL on each promotion-drain attempt, so a readable entry is not held up solely by its completion callback being queued behind promotion. Entries that remain unreadable still prevent promotion.

## Apply Fingerprints

Each node keeps a small apply fingerprint per partition:

| Field | Meaning |
|-------|---------|
| Applied key/value log id | Highest key/value Raft log id applied on this node for the partition. |
| Committed-head ledger entries | Number of committed key heads tracked for transactional read validation on this partition. |
| Live intents | Prepared intents currently held by the node. |

At leadership changes, Kahuna logs the local fingerprint. It also exposes gauges tagged by `partition`:

| Metric | Meaning |
|--------|---------|
| `kahuna.keyvalues.applied_log_id` | Highest key/value log id applied on this node for the partition. |
| `kahuna.durable_tx.committed_head_ledger_entries` | Committed-head ledger entries held on this node for the partition. |

Every replica schedules peer comparisons on leadership changes, retrying while fingerprints are not comparable. Equal applied log ids with different committed-head or intent counts indicate apply drift. Kahuna logs this and increments `kahuna.keyvalues.apply_divergence_detected`. These are count-based fingerprints, not value hashes: equal counts do not prove equal values or detect every divergence.

Range splitting performs the same check before copying from the source partition. If another replica has more committed heads than the source leader at the same applied log id, the split is refused with `SourceStateIncomplete` and `kahuna.range.split.incomplete_source_refusals` increments. The trigger can retry on a later pass after leadership or replica state converges.

## Containment

A conclusive comparison showing local incompleteness is checked again before containment. The node gates local partition reads and mutations with `MustRetry`, relinquishes leadership to the fullest peer or steps down, withholds candidacy, and requests reseeding. Repair requests repeat on a one-minute cadence. Successful whole-partition installation clears containment. The gate is in memory; this is not a subsecond recovery guarantee or proof of correctness for undetected equal-count divergence.

See [Snapshot Installation and Raft Recovery](/docs/snapshot-and-raft-recovery/) for transfer contents, verification, staging budgets, and partial-install behavior.

## Missing By-Reference Values

Containment also follows verified missing reconstruction sources. Live apply checks a missing prepared intent against queued writes and backend rows before concluding that a by-reference value is missing. The first proven live miss gates the partition and withholds candidacy immediately; relinquish/reseed work continues asynchronously. Restart replay similarly gates unresolved results before campaigning. Benign duplicates with sufficient local state and keys now owned by another partition do not imply a missing value.

See [restart replay and missing-value alarms](/docs/internals/durable-settlement/#restart-replay-and-missing-value-alarms) for source selection, metrics, and Warning-level restore summaries.
