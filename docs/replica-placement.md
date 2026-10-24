# Replication Factor and Replica Placement

A **replica** is a copy of one partition stored on one node. The **replication factor** is the number of replicas each partition has. By default, Kahuna uses full replication: every voter stores every partition and participates in every partition's Raft quorum. This is simple and remains the default behavior.

## Why It Matters

Full replication has a hard scaling ceiling: every node stores every partition, every persistent write is copied to every voter for that partition, and adding nodes can increase coordination cost instead of increasing usable storage.

Replication factor removes that ceiling. Kahuna can keep each partition replicated to a small quorum while spreading different partitions across the cluster. Adding nodes can add storage capacity, reduce per-node write amplification, and give the placement controller more room to distribute load.

This is different from coordination systems where every server must carry the full dataset. Kahuna still provides strongly consistent partitions, but the cluster does not have to make every node a replica of every partition.

It is not infinite scale by itself. Hot keys, partition count, network bandwidth, storage throughput, and transaction shape still matter. Replication factor gives Kahuna the horizontal scaling model needed to grow past the limits of full replication.

## When to Use It

Use full replication when the cluster is small or when every node must contain a complete copy of all data.

Use a positive replication factor when you want to:

- Add more nodes without copying every partition to every node
- Reduce disk usage and write amplification per node
- Keep the Raft quorum for each partition small and predictable
- Spread partitions across zones or racks

Prefer odd values. Replication factor `3` tolerates one failed replica for a partition. Replication factor `5` tolerates two. Even values usually add cost without improving failure tolerance.

If the configured replication factor is larger than the current cluster size, Kahuna uses the available voters and can place additional replicas after more nodes join.

## Enable a Replication Factor

For larger clusters, set a replication factor so each partition is stored on a smaller replica set:

```bash
kahuna-server \
  --initial-cluster https://kahuna-1:8082 https://kahuna-2:8082 https://kahuna-3:8082 \
  --raft-replication-factor 3 \
  --raft-enable-placement-rebalancer true
```

With replication factor `3`, each partition has three voter replicas. A node that does not host the target partition can still accept the client request and forward it to a hosting replica, so clients can continue to connect to any healthy node.

## Placement Rebalancer

Initial placement is applied when a new cluster is bootstrapped with `--raft-replication-factor`.

The ongoing placement rebalancer is controlled separately:

```bash
kahuna-server \
  --raft-replication-factor 3 \
  --raft-enable-placement-rebalancer true \
  --raft-max-replica-moves-per-pass 2 \
  --raft-max-concurrent-replica-repairs 3 \
  --raft-max-concurrent-replica-transfers 1
```

The rebalancer repairs under-replicated partitions, trims over-replicated partitions, and smooths replica-count skew. It has its own controller interval, `--raft-placement-pass-interval`, so it does not require the leader balancer to be enabled.

Repair and balance are budgeted separately. Repair moves restore durability after a node leaves or fails and are controlled by `--raft-max-concurrent-replica-repairs`. Balance moves smooth replica-count skew and are controlled by `--raft-max-concurrent-replica-transfers`. `--raft-max-replica-moves-per-pass` caps how many new moves can start during one pass across both priorities.

Replica moves happen in stages:

1. Add a learner replica
2. Seed it from the Raft log or a partition snapshot
3. Promote it after it catches up
4. Remove the old replica
5. Purge local data from nodes that no longer host the partition

During a move, a request can receive a retryable response if leadership or hosting changes at the same time. Retrying against the cluster is the normal client behavior.

## Decommissioning a Node

On a placed cluster, a graceful leave drains the node before removing it from the roster. Kahuna first copies the departing node's hosted replicas to survivors, then commits the membership removal.

```bash
kahuna-cli \
  -c "https://kahuna-1:8082,https://kahuna-2:8082,https://kahuna-3:8082" \
  --cluster-leave \
  --node "https://kahuna-3:8082"
```

The leave response includes:

- `left`: the node is no longer in the committed roster and can be stopped
- `drained`: the node's placed replicas were evacuated before removal
- `outcome`: `Committed`, `NotAMember`, `RefusedDrainInProgress`, `DrainTimedOut`, or another membership outcome

`--raft-decommission-drain-timeout` bounds how long the leave waits for evacuation. If it times out, the node stays in the roster, already-moved replicas stay moved, and retrying resumes the drain.

Only one drain runs at a time. A second leave can return `RefusedDrainInProgress`; remove nodes sequentially during scale-down.

## Zones

Set a zone or rack hint on each node when replicas should be spread across failure domains:

```bash
kahuna-server \
  --raft-zone rack-a \
  --raft-replication-factor 3 \
  --raft-enable-placement-rebalancer true
```

The planner prefers distinct zones when it can. Zone hints are advisory; the cluster still uses the available voters if there are not enough distinct zones.

## Inspect Placement

Use the CLI to inspect the committed placement table:

```bash
kahuna-cli -c "https://kahuna-1:8082" --cluster-placement
kahuna-cli -c "https://kahuna-1:8082" --cluster-placement --format json
```

The output shows:

- Global replication factor
- Whether the placement rebalancer is enabled
- Which partitions the contacted node hosts locally
- Each partition's lifecycle state and generation
- Each partition's effective replication factor
- Replica endpoints and roles

Replica roles are:

| Role | Meaning |
|------|---------|
| `Voter` | Stores the partition and votes in that partition's quorum. |
| `Learner` | Catching up before promotion. |
| `Removing` | Still present while the cluster completes a safe removal. |

An empty replica set means full replication for that partition: every roster voter hosts it.

The same information is available through:

```http
GET /v1/cluster/placement
```

## Override One Partition

You can override the target replication factor for one partition:

```bash
kahuna-cli \
  -c "https://kahuna-1:8082,https://kahuna-2:8082,https://kahuna-3:8082" \
  --set-replication-factor 5 \
  --partition 3
```

Use `0` to clear the override and return to the global replication factor:

```bash
kahuna-cli -c "https://kahuna-1:8082" \
  --set-replication-factor 0 \
  --partition 3
```

The override commits a new placement target. Replica movement happens later through the placement rebalancer.

The REST endpoint is:

```http
POST /v1/cluster/replication-factor
Content-Type: application/json

{"partitionId":3,"replicationFactor":5}
```

## Readiness

`GET /v1/cluster/health` includes `hostedPartitions`, the number of data partitions hosted by the node answering the request.

Treat `hostedPartitions` as informational only. With per-partition placement, a healthy node may host zero data partitions and still serve requests by forwarding them to hosting replicas.

## Backups

Use a coordinated backup for whole-cluster coverage under replica placement. Kahuna 1.12.5 and later capture one share per hosting source at a common cut and compose those shares into a complete backup. Composed incrementals preserve that coverage. Every participating node needs backup configuration and the same storage engine; shares use private scratch until merged. An unavailable or lagging source can be replaced by another voter on retry. No final artifact is published if required captures fail (`PartitionCaptureFailed`).

A plain full backup stays node-local and can omit partitions hosted elsewhere. Restore and chain validation require every stamped link to cover the cluster, not just their union. See [backup capture and retry behavior](/docs/backups-and-point-in-time-recovery/#capture-cost-and-lagging-replicas).

## Migration Notes

Current Kahuna, pinned to Kommander 1.11.3, can convert legacy full-replication partitions when a positive effective replication factor and the placement rebalancer are enabled. Each eligible active partition with an empty replica set first receives an explicit set of **all committed roster voters**. This preserves its existing quorum; it does not immediately replace that quorum with an arbitrary factor-sized subset. Normal placement trims then remove surplus replicas one step at a time toward the target. Conversion is bounded by `MaxReplicaMovesPerPass`, and a failed map commit is retried on a later pass.

With rebalancing disabled the partitions stay fully replicated and a warning explains why conversion has not begun. Growing at that point adds copies rather than distributing the data. Full replication with an effective factor of zero remains an intentional mode, not pending migration. Old server versions without conversion support still require their earlier migration procedure.

The P0 leader exposes `raft.placement.ranges_awaiting_initial` and the counter `raft.placement.initial_assignments_total` on the `Kommander` meter. Embedded hosts can inspect `node.Raft.GetPartitionsAwaitingPlacement()`. A zero pending count says assignment finished, not that all subsequent trimming and movement finished.

### Leader Removal and Rebalancing

Removing a partition's leader replica requires a confirmed handoff to another replica before marking it `Removing`. If the requesting node is not that partition's leader, it sends a transfer suggestion and polls the confirmed leader within a bound. An unconfirmed handoff returns `LeadershipNotConfirmed`, leaving removal for a later placement pass. A replica excluded by the committed map is also treated as a vacated leader for election gating, even if its process remains alive.

Trim selection prioritizes replica load and zone placement; leadership only breaks ties among equally loaded candidates. A balancing add is planned only when its predicted follow-up trim improves load distribution, avoiding repeatedly adding and removing the same replica. These are convergence safeguards, not an exact balancing deadline.

## Snapshot Receive Capacity

A learner below retained history receives a whole-partition snapshot. Pending-byte caps include memory and disk staging, so disk spill does not remove the maximum-snapshot-size limit. Current peers acknowledge staging separately from installation and poll the install outcome. While an install runs, a second snapshot of that partition is not staged. Configure a private staging directory and size acknowledgement budgets for transport/status calls and transfer-step budgets for expected progress stalls. See [Snapshot Installation and Raft Recovery](/docs/snapshot-and-raft-recovery/) for options and partial-install limitations.

## Learner Promotion Diagnostics

Placement accepts restarted nodes' fresh load-report incarnations even when their report version counters reset. If the gossiped leader hint is absent or dead, learner-lag checks can resolve a quorum-confirmed leader before deciding promotion readiness. These are recovery paths, not permission to promote an unconfirmed learner.

`--raft-learner-promotion-stall-warning-after` (30,000 ms) logs the last failed check when a placement-added learner stays unpromotable. It is diagnostic only; it does not relax the lag or stability requirements. A non-member range leader is reported as a stall condition. After a failed drain is confirmed rolled back to `Voter`, the node's departure latch is released so a later eviction can trigger automatic rejoin. A removal that may still commit keeps the latch.

For Kubernetes deployment and traffic-driven node counts, use the [Kubernetes Operator](/docs/kubernetes-operator/). It combines placement with roster-gated changes. Current servers perform eligible legacy conversion; the operator can hold growth while that placement remains pending. Automatic PITR seeding of new pods remains a separate workflow.
