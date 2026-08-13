# Leader Balancing

Each Kahuna partition is an independent Raft group with one leader. The leader processes requests, replicates writes, and sends heartbeats for that partition.

Leaders are elected independently. Over time, one node can end up leading many more partitions, or several high-traffic partitions, while other nodes have spare capacity.

The leader balancer gradually redistributes leadership using two signals:

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

:::

## When to Enable It

Enable leader balancing when both conditions apply:

- The deployment has multiple Kahuna nodes and many partitions
- Leader counts or hot partitions are unevenly concentrated across nodes

Leave it disabled for standalone and embedded deployments. A single node has nowhere to transfer leadership. It can also remain disabled for a small cluster whose leaders are already distributed acceptably.

Leader balancing is a performance optimization, not a correctness requirement. It is disabled by default and adds no reporting or planning overhead while disabled.

It is also a prerequisite for [load-based range splitting](/docs/distributed-keyvalue-store/load-based-range-splitting/), which depends on cross-node load reports and leadership relocation to relieve a hot partition.

## Enable the Balancer

Enable it on every cluster node and perform a rolling restart:

```bash
kahuna-server \
  --raft-enable-leader-balancer true \
  <other-server-options>
```

Every node must participate because each node publishes local load reports and receives transfer suggestions. Planning runs only on the current leader of system partition `0`, which can change at any time.

A partial rollout produces incomplete reports. The planner responds by skipping passes rather than making decisions from an incomplete cluster view.

## How a Balancing Pass Works

1. Every enabled node periodically publishes the partitions it leads and their load
2. The partition `0` leader collects reports from active nodes
3. The planner first corrects leader-count imbalance
4. When counts are balanced, it can swap leaders to reduce load imbalance
5. Busy nodes receive advisory transfer suggestions
6. Each current partition leader validates and performs its own Raft handoff
7. Later reports confirm the new leadership distribution

Suggestions and planner state are held in memory. If the partition `0` leader changes, the new leader rebuilds its view from subsequent reports.

## Configuration

Start with the defaults. They intentionally move leadership slowly to limit churn.

| Server option | Default | Description |
|---------------|---------|-------------|
| `--raft-enable-leader-balancer` | `false` | Enables reports, planning passes, and transfer suggestions |
| `--raft-leader-balancer-interval` | `30000` ms | Interval between planning passes on the partition `0` leader |
| `--raft-leader-balancer-report-interval` | `5000` ms | Interval between load reports from each node |
| `--raft-leader-balancer-report-ttl` | `20000` ms | Maximum report age accepted by the planner. Must exceed the report interval |
| `--raft-count-deadband` | `1` | Allowed leader-count deviation before count balancing starts |
| `--raft-load-imbalance-threshold` | `0.25` | Fractional load skew required for load-based swaps after counts are balanced |
| `--raft-min-leader-stability-ms` | `5000` ms | Minimum leadership age before a partition can move |
| `--raft-move-cooldown` | `60000` ms | Minimum delay before the same partition can move again |
| `--raft-max-moves-per-pass` | `4` | Maximum suggestions created by one planning pass |
| `--raft-max-concurrent-transfers` | `2` | Maximum transfer suggestions tracked at the same time |
| `--raft-suggestion-timeout` | `15000` ms | Time allowed for a suggested transfer to appear in reports |
| `--raft-leader-balancer-ops-weight` | `1.0` | Weight assigned to operations per second in the load score |
| `--raft-leader-balancer-queue-weight` | `0.5` | Weight assigned to pending queue depth in the load score |

The partition load score is approximately:

```text
load = ops weight * operations per second
     + queue weight * pending queue depth
```

## Tuning

Change settings only for an observed problem:

- **Convergence is too slow:** lower `--raft-leader-balancer-interval` or raise the move and concurrency limits
- **Leadership moves too often:** raise `--raft-count-deadband`, `--raft-load-imbalance-threshold`, or `--raft-move-cooldown`
- **Hot partitions remain together:** increase the operations or queue weight that best represents the workload bottleneck
- **Successful transfers time out:** increase `--raft-suggestion-timeout` so the new leader report has time to reach the planner
- **Planning passes are skipped:** verify every node has balancing enabled and keep the report TTL comfortably above the report interval

Faster convergence creates more leadership changes. Prefer gradual movement unless a measured bottleneck justifies more aggressive settings.

## Metrics

Kommander emits leader-balancer instruments through the `Kommander` meter:

| Metric | Type | Meaning |
|--------|------|---------|
| `raft.balancer.moves_total` | Counter | Transfer suggestions by `planned`, `succeeded`, or `timed_out` outcome |
| `raft.balancer.skipped_passes_total` | Counter | Passes skipped because the report view was incomplete |
| `raft.balancer.count_imbalance` | Gauge | Distance between the most-loaded node and the ideal leader count |
| `raft.balancer.load_imbalance` | Gauge | Fractional load skew between nodes |

The two imbalance gauges are meaningful only on the current partition `0` leader. Other nodes report zero, and the node producing meaningful values changes when partition `0` leadership changes.

The metrics exist inside Kommander, but the deployment must export the `Kommander` meter through its configured telemetry pipeline before an operator can query them.

## Reading the Metrics

- **Healthy convergence:** planned moves are followed by succeeded moves, then both imbalance gauges trend toward zero
- **Many timed-out moves:** suggestions are not reaching recipients or the suggestion timeout is shorter than report propagation
- **Many skipped passes:** at least one active node has missing or stale reports
- **No moves:** the cluster may already be inside the configured count deadband and load threshold

## Safety and Failure Behavior

The partition leader, not the planner, has final authority over every transfer. A suggestion is ignored when its term, source leader, destination, or partition state is no longer valid.

Other safety properties include:

- Only the partition `0` leader creates plans
- An incomplete report view causes the planner to wait
- Recently elected and recently moved partitions are temporarily ineligible
- Per-pass and concurrent-transfer limits bound the amount of movement
- A node failure or election does not get accelerated by the balancer

The expected failure modes are a skipped transfer or an unnecessary transfer. Normal Raft validation prevents the balancer from creating conflicting leaders or losing committed data.
