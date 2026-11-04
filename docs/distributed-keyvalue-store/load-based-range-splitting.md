# Load-Based Range Splitting

With [key-range sharding](/docs/distributed-keyvalue-store/key-range-sharding/), a range splits when it holds too many keys. But a small range can receive most of the cluster's writes, and one partition [leader](/docs/glossary/#leader-follower-and-learner) orders every write to it, so that one node becomes the bottleneck. Load-based splitting detects a range that stays overloaded and splits it, so another node can lead half of its writes. It is the automatic version of splitting a hot database shard.

Kahuna has two independent reasons to split a range into two [partitions](/docs/glossary/#partition):

| Trigger | Condition | Purpose |
|---------|-----------|---------|
| Count-based | The sampled key count reaches `RangeSplitThreshold` | Prevent one range from growing indefinitely |
| Load-based | Write rate and WAL backlog remain high for a sustained window | Relieve a small but write-hot partition |

Load-based splitting is disabled by default. It applies only to [key spaces](/docs/glossary/#key-space-and-key-range-routing) registered for key-range sharding.

## Why Key Count Is Not Enough

A key-count threshold never splits a small range, however many writes its leader must order.

Load-based splitting watches replication work and the backlog of the [write-ahead log](/docs/glossary/#write-ahead-log-wal) (WAL). When a range remains overloaded, Kahuna chooses a split key near the **write centroid**, aiming to place approximately half of the observed writes on each child range.

```text
Before
[orders/0000, orders/9999) -> one hot partition

After
[orders/0000, orders/6200) -> partition A
[orders/6200, orders/9999) -> partition B
```

The split point follows where writes actually land, not the alphabetical midpoint or the median stored key.

Monotonic appends, such as keys built from increasing IDs, put the newest writes at the end of the range. A split at the median would leave the lower child with cold keys and still send every new write to the upper child. Instead, Kahuna can split near the 75th-percentile key: the new partition takes only the hot tail, and the lower child keeps most of the cold keys.

## Leader Balancing Is Required

Enable the leader balancer whenever load-based splitting is enabled.

There are two reasons:

1. Nodes share partition load reports with each other only while leader balancing is enabled
2. A split relieves a node only when one child can be led by a different, less-loaded node

Without leader balancing, remotely led partitions appear to have no load from the split coordinator's perspective. A split whose children remain on the same node can also add replication work without relieving that node's storage or CPU bottleneck.

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

## Configuration

Kahuna Server exposes the primary range split and merge knobs as command-line flags. The same settings are available on `EmbeddedKahunaOptions` using the corresponding property names.

| Server Flag | Embedded Option | Default | Description |
|-------------|-----------------|---------|-------------|
| `--range-split-load-threshold` | `RangeSplitLoadThreshold` | `0` | Minimum replicated writes per second. `0` disables load-based splitting |
| `--range-split-load-min-queue-depth` | `RangeSplitLoadMinQueueDepth` | `8` | Minimum WAL queue depth required with the rate threshold |
| `--range-split-load-window` | `RangeSplitLoadWindow` | `15 seconds` | Time all load gates must remain continuously satisfied |
| `--range-split-load-poll-interval` | `RangeSplitLoadPollInterval` | `5 seconds` | Frequency of load-gate evaluation. Keep below the load window |
| not exposed | `RangeSplitLoadMinCommitWaitMs` | `0` | Optional minimum commit-wait latency. `0` disables this additional gate |
| not exposed | `RangeSplitLoadImbalanceMax` | `0.8` | Maximum acceptable write fraction on either child after selecting a split key |
| not exposed | `RangeSplitIndivisibleCooldown` | `5 minutes` | Delay before reconsidering a range that cannot be split usefully |
| `--range-split-settle-window` | `RangeSplitSettleWindow` | `10 seconds` | Post-split delay before either child can be evaluated again |
| `--range-move-quiesce-ttl` | `RangeMoveQuiesceTtl` | `30 seconds` | Write-fence lifetime for a split or merge; exhausted windows refuse cutover with `QuiesceExpired`. Minimum 1 second |
| `--range-move-settle-timeout` | `RangeMoveSettleTimeout` | `10 seconds` | Maximum quiesce wait for in-flight transactions in the moving range before split or merge cutover |
| `--range-split-threshold` | `RangeSplitThreshold` | `1000` keys | Count-based split threshold. `0` disables count-based splitting |
| `--range-split-min-range-size` | `RangeSplitMinRangeSize` | `10` keys | Minimum number of sampled keys required in each child |
| `--range-merge-min-size` | `RangeMergeMinSize` | `10` keys | Adjacent ranges below this size can merge. `0` disables auto-merge |
| `--range-collection-interval` | `CollectionInterval` | `60 seconds` | Sampling cadence for split/merge checks and related maintenance |

`RangeSplitSettleWindow` must be at least `MinLeaderStability`. Embedded startup rejects a shorter settle window. `LeaderBalancerReportInterval` must also remain shorter than `LeaderBalancerReportTtl`.

Count- and load-based splitting both honor the [cluster partition limit and per-key-space range quota](/docs/distributed-keyvalue-store/key-range-sharding/#split-capacity-limits). A busy range does not bypass either limit. Configure `--raft-max-partitions` and `--range-max-ranges-per-key-space` to bound growth; `0` leaves each unbounded.

## Hot Keys Cannot Be Split

Splitting helps when writes can be divided across two key spans. It cannot help when nearly every write targets one key.

Kahuna evaluates the best achievable write distribution before committing a load split. If either child would retain at least `RangeSplitLoadImbalanceMax` of writes, the range is considered indivisible and the split is refused. The same refusal metric is reported when a range is hot but too small to divide and most writes are concentrated on one key.

For a persistent hot-key pattern, change the application key design or shard the value at the application level. Repeatedly lowering thresholds cannot make one key divisible.

## Metrics

The `Kahuna` meter publishes these counters with a `keyspace` tag:

| Metric | Meaning |
|--------|---------|
| `kahuna.range.splits` | Successfully committed count- or load-based splits |
| `kahuna.range.split.no_relief_skips` | Load splits skipped because no peer can host the new leadership |
| `kahuna.range.split.indivisible_refusals` | Splits refused because writes cannot be divided usefully |
| `kahuna.range.split.incomplete_source_refusals` | Splits refused because the source leader looked incomplete compared with another replica |
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
- The writes use persistent durability and therefore pass through [Raft](/docs/glossary/#raft)

Reads and ephemeral writes do not contribute to the load-split rate.

### Splits Do Not Improve Throughput

Check whether the child leadership moved to another node. Rising `kahuna.range.split.no_relief_skips` indicates that no relief target was available. Also verify the cluster has a less-loaded peer and inspect the [leader-balancer metrics](/docs/leader-balancing/#metrics).

Splitting distributes Raft leadership and write coordination. It does not reduce total stored bytes because replicas continue to hold the data.

### Ranges Merge and Split Repeatedly

The warm-range merge guard normally prevents this cycle. If it occurs, increase the settle window or adjust the load threshold so a recently active range is not immediately considered cold enough to merge.

### A Split Is Refused With `SourceStateIncomplete`

This retryable refusal increments `kahuna.range.split.incomplete_source_refusals`. Before copying keys, Kahuna compares the source leader's apply fingerprint with the other replicas; if a replica has more committed transactional heads than the source leader at the same applied log id, the leader may be missing acknowledged state. The split can be retried on a later cadence after leadership or replica state converges.
