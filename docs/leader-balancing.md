# Leader Balancing

When one node leads most partitions, or the busiest ones, it carries most of the cluster's request and replication work while other nodes have spare capacity. The leader balancer gradually moves leadership to those other nodes, so the work spreads more evenly.

Each Kahuna [partition](/docs/glossary/#partition) is an independent [Raft](/docs/glossary/#raft) group with one [leader](/docs/glossary/#leader-follower-and-learner), which processes requests, replicates writes, and sends heartbeats for that partition. Leaders are elected independently, so over time one node can end up leading many more partitions, or several high-traffic partitions, than the others.

The balancer uses two signals:

1. **Leader count** spreads partition leaders more evenly across nodes
2. **Partition load** separates hot leaders using operation throughput and queue depth

```text
Before                         After

node-a: 12 leaders             node-a: 4 leaders
node-b:  2 leaders             node-b: 4 leaders
node-c:  2 leaders             node-c: 4 leaders
```

:::info Leadership moves, data does not

The balancer never moves partition data. It suggests normal Raft leadership transfers between existing replicas. The current leader validates its term and ownership before performing a handoff.

[Replication factor and replica placement](/docs/replica-placement/) is the separate feature that changes which nodes store and vote for a partition.

:::

## When to Enable It

Enable leader balancing when both conditions apply:

- The deployment has multiple Kahuna nodes and many partitions
- Leader counts or hot partitions are unevenly concentrated across nodes

Leave it disabled for single-node deployments, whether a standalone server or a single embedded node: one node has nowhere to transfer leadership. It can also remain disabled for a small cluster whose leaders are already distributed acceptably.

Leader balancing is a performance optimization, not a correctness requirement. It is disabled by default and adds no reporting or planning overhead while disabled.

It is also a prerequisite for [load-based range splitting](/docs/distributed-keyvalue-store/load-based-range-splitting/), which depends on cross-node load reports and leadership relocation to relieve a hot partition.

## Enable the Balancer

Enable it on every cluster node and perform a rolling restart:

```bash
kahuna-server \
  --raft-enable-leader-balancer \
  <other-server-options>
```

Every node must participate because each node publishes local load reports and receives transfer suggestions. Planning runs only on the current leader of [partition 0](/docs/glossary/#partition-0) (the system partition), which can change at any time.

A partial rollout produces incomplete reports. The planner responds by skipping passes rather than making decisions from an incomplete cluster view.

## How a Balancing Pass Works

1. Every enabled node periodically publishes the partitions it leads and their load
2. The partition 0 leader collects reports from active nodes
3. The planner first corrects leader-count imbalance
4. When counts are balanced, it can swap leaders to reduce load imbalance
5. Busy nodes receive advisory transfer suggestions
6. Each current partition leader validates and performs its own Raft handoff
7. Later reports confirm the new leadership distribution

Suggestions and planner state are held in memory. If the partition 0 leader changes, the new leader rebuilds its view from subsequent reports.

## Configuration

Start with the defaults. They intentionally move leadership slowly to limit churn: the partition 0 leader plans every 30 seconds, creates at most 4 suggestions per pass, tracks at most 2 transfers at once, and waits 60 seconds before moving the same partition again. Every flag and default, including slow-node avoidance, is listed in [Server Configuration: Raft Leader Balancing](/docs/server-configuration/#raft-leader-balancing).

The partition load score is approximately:

```text
load = ops weight * operations per second
     + queue weight * pending queue depth
```

The weights are `--raft-leader-balancer-ops-weight` (default `1.0`) and `--raft-leader-balancer-queue-weight` (default `0.5`).

## Tuning

Change settings only for an observed problem:

- **Convergence is too slow:** lower `--raft-leader-balancer-interval` or raise the move and concurrency limits
- **Leadership moves too often:** raise `--raft-count-deadband`, `--raft-load-imbalance-threshold`, or `--raft-move-cooldown`
- **Hot partitions remain together:** increase the operations or queue weight that best represents the workload bottleneck
- **Successful transfers time out:** increase `--raft-suggestion-timeout` so the new leader report has time to reach the planner
- **Planning passes are skipped:** verify every node has balancing enabled and keep the report TTL comfortably above the report interval
- **One node has much slower storage:** enable slow-node avoidance so the balancer stops sending it new leaders and gradually drains the leaders it already has

Faster convergence creates more leadership changes. Prefer gradual movement unless a measured bottleneck justifies more aggressive settings.

## Metrics

Kommander emits leader-balancer instruments through the `Kommander` meter:

| Metric | Type | Meaning |
|--------|------|---------|
| `raft.balancer.moves_total` | Counter | Transfer suggestions by `planned`, `succeeded`, or `timed_out` outcome |
| `raft.balancer.skipped_passes_total` | Counter | Passes skipped because the report view was incomplete |
| `raft.balancer.count_imbalance` | Gauge | Distance between the most-loaded node and the ideal leader count |
| `raft.balancer.load_imbalance` | Gauge | Fractional load skew between nodes |

The two imbalance gauges are meaningful only on the current partition 0 leader. Other nodes report zero, and the node producing meaningful values changes when partition 0 leadership changes.

The metrics exist inside Kommander, but the deployment must export the `Kommander` meter through its configured telemetry pipeline before an operator can query them.

## Reading the Metrics

- **Healthy convergence:** planned moves are followed by succeeded moves, then both imbalance gauges trend toward zero
- **Many timed-out moves:** suggestions are not reaching recipients or the suggestion timeout is shorter than report propagation
- **Many skipped passes:** at least one active node has missing or stale reports
- **No moves:** the cluster may already be inside the configured count deadband and load threshold

## Safety and Failure Behavior

A transfer remains best-effort: winning an election is not enough for the target to serve. It must drain committed log entries and pass the leadership barrier; a contained or incomplete target can relinquish immediately. Check the resulting confirmed leader rather than treating a transfer request as a guarantee of a lasting handoff. See [Leadership Transfer](/docs/internals/replication/#leadership-transfer) for the promotion drain.

The partition leader, not the planner, has final authority over every transfer. A suggestion is ignored when its term, source leader, destination, or partition state is no longer valid.

Other safety properties include:

- Only the partition 0 leader creates plans
- An incomplete report view causes the planner to wait
- Recently elected and recently moved partitions are temporarily ineligible
- Per-pass and concurrent-transfer limits bound the amount of movement
- The balancer does not trigger or speed up failover; Raft elections handle that

The expected failure modes are a skipped transfer or an unnecessary transfer. Normal Raft validation prevents the balancer from creating conflicting leaders or losing committed data.
