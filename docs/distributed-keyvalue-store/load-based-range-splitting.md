# Load-Based Range Splitting

Key-range sharding can split one ordered range into two partitions. Kahuna supports two independent reasons to split:

| Trigger | Condition | Purpose |
|---------|-----------|---------|
| Count-based | The sampled key count reaches `RangeSplitThreshold` | Prevent one range from growing indefinitely |
| Load-based | Write rate and WAL backlog remain high for a sustained window | Relieve a small but write-hot partition |

Load-based splitting is disabled by default. It applies only to key spaces registered for [key-range sharding](/docs/distributed-keyvalue-store/key-range-sharding/).

:::caution Current configuration surface

Load-splitting options are currently exposed by `EmbeddedKahunaOptions` and `KahunaConfiguration`. `Kahuna.Server` does not yet expose equivalent command-line flags.

:::

## Why Key Count Is Not Enough

A partition can contain relatively few keys but receive most of the cluster's writes. A key-count threshold never splits it because the range is small, even though its single Raft leader has become a throughput bottleneck.

Load-based splitting watches replication work and backlog. When a range remains overloaded, Kahuna chooses a split key near the **write centroid**, aiming to place approximately half of the observed writes on each child range.

```text
Before
[orders/0000, orders/9999) -> one hot partition

After
[orders/0000, orders/6200) -> partition A
[orders/6200, orders/9999) -> partition B
```

The split point follows observed write distribution, not the alphabetical midpoint or median stored key.

## Leader Balancing Is Required

Enable the leader balancer whenever load-based splitting is enabled.

There are two reasons:

1. Cross-node partition load reports are gossiped only while leader balancing is enabled
2. A split relieves a node only when one child can be led by a different, less-loaded node

Without leader balancing, remotely led partitions appear to have no load from the split coordinator's perspective. A split whose children remain on the same node can also add consensus work without relieving that node's storage or CPU bottleneck.

For embedded multi-node deployments, set both options:

```csharp
var options = new EmbeddedKahunaOptions
{
    RangeSplitLoadThreshold = 2_000,
    EnableLeaderBalancer = true
};
```

See [Leader Balancing](/docs/leader-balancing/) for rollout, tuning, and balancer metrics.

## Split Decision

All enabled gates must remain satisfied for `RangeSplitLoadWindow` before Kahuna splits a range:

1. **Write rate:** replicated log operations per second must reach `RangeSplitLoadThreshold`
2. **WAL queue depth:** pending WAL work must reach `RangeSplitLoadMinQueueDepth`
3. **Commit wait:** when configured above zero, commit-wait latency must reach `RangeSplitLoadMinCommitWaitMs`

The queue-depth gate distinguishes a healthy busy partition from one that cannot keep up. High throughput with an empty queue does not trigger a split.

The sustained window filters short bursts and delayed gossip reports. Keep the window near or above 10 seconds; the default is 15 seconds with a 5-second polling interval.

After splitting, both children enter `RangeSplitSettleWindow`. This gives leadership time to stabilize and the balancer time to relocate a child before either range is evaluated again.

## Embedded Options

| Option | Default | Description |
|--------|---------|-------------|
| `RangeSplitLoadThreshold` | `0` | Minimum replicated writes per second. `0` disables load-based splitting |
| `RangeSplitLoadMinQueueDepth` | `8` | Minimum WAL queue depth required with the rate threshold |
| `RangeSplitLoadMinCommitWaitMs` | `0` | Optional minimum commit-wait latency. `0` disables this additional gate |
| `RangeSplitLoadWindow` | `15 seconds` | Time all load gates must remain continuously satisfied |
| `RangeSplitLoadPollInterval` | `5 seconds` | Frequency of load-gate evaluation. Keep below the load window |
| `RangeSplitLoadImbalanceMax` | `0.8` | Maximum acceptable write fraction on either child after selecting a split key |
| `RangeSplitIndivisibleCooldown` | `5 minutes` | Delay before reconsidering a range that cannot be split usefully |
| `RangeSplitSettleWindow` | `10 seconds` | Post-split delay before either child can be evaluated again |
| `RangeSplitThreshold` | `1000` keys | Count-based split threshold. `0` disables count-based splitting |
| `RangeSplitMinRangeSize` | `10` keys | Minimum number of sampled keys required in each child |

`RangeSplitSettleWindow` must be at least `MinLeaderStability`. Embedded startup rejects a shorter settle window. `LeaderBalancerReportInterval` must also remain shorter than `LeaderBalancerReportTtl`.

## Hot Keys Cannot Be Split

Splitting helps when writes can be divided across two key spans. It cannot help when nearly every write targets one key.

Kahuna evaluates the best achievable write distribution before committing a load split. If either child would retain at least `RangeSplitLoadImbalanceMax` of writes, the range is considered indivisible and the split is refused.

For a persistent hot-key pattern, change the application key design or shard the value at the application level. Repeatedly lowering thresholds cannot make one key divisible.

## Metrics

The `Kahuna` meter publishes these counters with a `keyspace` tag:

| Metric | Meaning |
|--------|---------|
| `kahuna.range.splits` | Successfully committed count- or load-based splits |
| `kahuna.range.split.no_relief_skips` | Load splits skipped because no peer can host the new leadership |
| `kahuna.range.split.indivisible_refusals` | Splits refused because writes cannot be divided usefully |
| `kahuna.range.split.settle_skips` | Checks skipped while a range is inside its settle window |
| `kahuna.range.merge.warm_skips` | Merges refused because at least one range remains warm |

The deployment must export the `Kahuna` meter through its telemetry pipeline before these instruments are visible externally.

## Troubleshooting

### A Hot Range Never Splits

Confirm all of the following:

- The key space is registered for key-range routing
- `RangeSplitLoadThreshold` is greater than zero
- Leader balancing is enabled on every participating node
- Both write rate and queue depth remain above their thresholds for the complete load window
- The writes use persistent durability and therefore pass through Raft

Reads and ephemeral writes do not contribute to the load-split rate.

### Splits Do Not Improve Throughput

Check whether the child leadership moved to another node. Rising `kahuna.range.split.no_relief_skips` indicates that no relief target was available. Also verify the cluster has a less-loaded peer and inspect the [leader-balancer metrics](/docs/leader-balancing/#metrics).

Splitting distributes Raft leadership and write coordination. It does not reduce total stored bytes because replicas continue to hold the data.

### Ranges Merge and Split Repeatedly

The warm-range merge guard normally prevents this cycle. If it occurs, increase the settle window or adjust the load threshold so a recently active range is not immediately considered cold enough to merge.

