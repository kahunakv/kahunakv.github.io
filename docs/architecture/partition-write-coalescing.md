# Partition Write Coalescing

Kahuna coalesces persistent partition writes before proposing them to Raft. This reduces the number of WAL appends, quorum round trips, and synchronous disk flushes needed when many clients write to the same partition at the same time.

A direct write is a non-transactional persistent key/value mutation:

- `SET`, including conditional and `NOREV` variants
- `DELETE`
- `EXTEND`
- .NET client equivalents such as `SetKeyValue(...)`, `SetManyKeyValues(...)`, `DeleteKeyValue(...)`, `DeleteManyKeyValues(...)`, and `ExtendKeyValue(...)`
- TypeScript client equivalents such as `set(...)`, `setMany(...)`, `delete(...)`, `deleteMany(...)`, and `extend(...)`

Ephemeral writes do not use this path because they are in-memory only. In-flight transactional writes also do not enter this path while the transaction is open; they stage MVCC intents on their owning actors. When an all-persistent durable transaction finalizes, its canonical transaction record and prepared-intent deltas use the same partition scheduler as direct writes.

## How It Works

Every persistent write belongs to one Raft partition. For a direct key/value mutation, the partition leader validates the write, stages the in-memory intent, serializes the log record, and hands that record to a leader-local write aggregator.

The aggregator keeps a queue per partition. Instead of proposing each record immediately, it can send several records for the same partition in one Raft call. Writes from different clients and from batch APIs share the same partition queue, so coalescing works across requests and not only inside one `SetManyKeyValues(...)` call.

The scheduler is shared across compatible persistent log types for the same partition. A batch may contain direct key/value records plus durable transaction-record or prepared-intent entries from concurrent durable transactions. Each queued item keeps its own completion path, so a mixed batch can still resolve each caller or transaction finalizer independently.

Some transaction work intentionally stays outside this scheduler. Ephemeral transaction staging and the ephemeral subset of a mixed transaction still use the legacy in-memory prepare/commit/rollback path. The persistent durable subset enters the scheduler only when finalization writes canonical records, prepared intents, materialization records, or settlement deltas. Current servers materialize committed durable values by reference to prepared intents by default, avoiding a second value copy through Raft.

Kahuna still preserves normal consistency:

- writes for a partition remain ordered
- batches dispatch in FIFO order, with one in-flight batch per partition by default
- different partitions can commit concurrently
- each caller is resolved only after the owning key/value actor applies the committed result
- failed or stale queued writes return `MustRetry` rather than being silently dropped
- durable transaction finalization entries are applied in Raft-commit order before their finalizer is resolved

## When It Helps

Write coalescing is most useful when a workload sends many persistent writes to the same partition in a short period:

- bulk imports
- high-concurrency `SetManyKeyValues(...)` or `DeleteManyKeyValues(...)`
- cache refreshes using persistent durability
- service registry updates under one bucket
- ordered key spaces where a hot range still maps to one partition
- concurrent durable transactions that update keys on the same partition

It helps less when writes are spread thinly across many partitions or arrive one at a time with little overlap. In that case the batch size may stay close to one, and the main cost is the small aggregator hop.

Key layout matters. In the default hash-routed model, keys sharing the same bucket or key-space route to the same partition, which gives the aggregator more to combine. Key-range routing can split large ordered spaces over time, so a very large import may naturally spread across multiple partition queues after ranges split.

## Tuning

The defaults are intended to improve throughput without adding visible latency to most direct writes. Tune only after measuring with representative traffic.

| Server Flag | Default | Description |
|-------------|---------|-------------|
| `--kv-write-linger-ms` | `1` | Delay from the oldest queued persistent partition write before a partition batch is proposed. `0` dispatches an idle partition immediately. |
| `--kv-write-post-completion-hold-ms` | `0` | Optional hold after a batch completes before the next sub-threshold batch dispatches. This can increase batch density under saturated same-partition load. Full batches and queue-age releases bypass the hold. |
| `--kv-write-max-batch-items` | `512` | Maximum log entries selected for one Raft call. |
| `--kv-write-max-in-flight-batches` | `1` | Maximum batches one partition may have awaiting Raft results at once. Higher values pipeline quorum waits while preserving FIFO dispatch order. |
| `--kv-write-max-batch-bytes` | `4194304` | Target serialized bytes selected for one Raft call. A single oversized item still dispatches alone. |
| `--kv-write-max-queued-items` | `8192` | Maximum admitted persistent submissions per partition, including writes already in flight. |
| `--kv-write-max-queued-bytes` | `33554432` | Maximum admitted serialized bytes per partition, including writes already in flight. |
| `--kv-write-max-queue-delay-ms` | `1000` | Maximum pre-dispatch wait before a queued write is released as `MustRetry`. |
| `--kv-write-aggregator-inbox-size` | `16384` | Ordinary submission inbox bound per aggregator lane. Control messages are exempt. |
| `--persistence-max-unflushed-items` | `1000000` | Maximum committed key/value writes held in memory awaiting background flush before ordinary writes receive retryable backpressure. |
| `--persistence-max-unflushed-bytes` | `536870912` | Maximum value bytes held in memory awaiting background flush before ordinary writes receive retryable backpressure. |

Durable transaction decisions, materialization, settlement, recovery, and range-metadata handoff use terminal submissions. Terminal submissions have reserved headroom above the ordinary queue caps so a partition saturated with ordinary writes can still finish already-prepared transactions. The terminal reserve and node-global queue settings are `KahunaConfiguration` fields today, not public server CLI flags.

Use `--kv-write-linger-ms 0` when uncontended single-write latency matters more than coalescing. Keep a small positive linger, such as the default `1`, when same-partition bursts are expected.

Under sustained load, a completed batch can immediately free the next batch before the linger window has time to collect more arrivals. `--kv-write-post-completion-hold-ms` adds a small wait after completion so sub-threshold batches can grow denser. Keep it at `0` unless metrics show a saturated partition dispatching batches that stay far below the item and byte caps.

`--kv-write-max-in-flight-batches` can help when one partition has enough buffered work that Raft round-trip latency is the bottleneck. Raising it allows multiple batches for that partition to wait on Raft concurrently. Dispatch remains FIFO, but higher values can increase tail latency and retry fan-out during leadership changes, so increase it gradually and measure.

Increasing `--kv-write-max-batch-items` or `--kv-write-max-batch-bytes` can improve throughput for large bursts, but it can also make one partition's committed batch larger. If tail latency rises, reduce the batch caps or the linger window.

Queue limits are backpressure controls. If a partition queue fills, Kahuna returns `MustRetry` so clients can retry through the normal routing path. Do not raise queue limits just to hide sustained overload; first check whether the partition is hot, whether key-range splitting applies, and whether leader balancing can move work to another node.

The persistence backlog limits protect the post-Raft side of the pipeline. Once writes are committed but not yet flushed to the materialized backend, Kahuna keeps them resident so checkpoints cannot move the WAL floor past the only durable copy. If the unflushed item or byte budget is exceeded, ordinary writes receive retryable backpressure with reason `unflushed_backlog`. Terminal durable transaction work keeps reserved headroom so prepared transactions can still finish.

The backlog monitor warns before the gate closes. It logs when the backlog reaches 75% of either budget, logs again when ordinary write backpressure starts, repeats reminders while the gate remains closed, and logs when the backlog drops below the reopen threshold.

The number of aggregator lanes is derived from the key/value worker count. There is no separate lane-count flag; Raft work is detached per partition, so lane count is not the same as Raft concurrency.

## Retry Semantics

A write released from the aggregator returns `MustRetry`. This can happen during leadership changes, moved ranges, restore-in-progress windows, full queues, proposal timeouts, or shutdown.

For direct non-transactional writes, retrying is at-least-once behavior. A timeout near the Raft round trip does not always prove whether the original write committed. If an application needs exactly-once business semantics, use a transaction, a compare condition, or an application-level idempotency key.

For durable transaction finalization, a rejected prepare or decision entry is reported back to the transaction coordinator. The coordinator then returns the correct transaction-level outcome, commonly `MustRetry` for uncertain infrastructure conditions or `Aborted` for real conflicts.

For the full transaction path that uses the aggregator, see [Transaction Lifecycle](/docs/internals/transaction-lifecycle/).

## Metrics

Write-coalescing metrics are published on the `Kahuna` meter:

| Metric | Type | Meaning |
|--------|------|---------|
| `kahuna.kv.write.admitted` | Counter | Persistent submissions admitted to the aggregator. |
| `kahuna.kv.write.rejections` | Counter | Rejected or released submissions, tagged by reason such as `queue_full`, `inbox_full`, `stopping`, `fence_stale`, `queue_expired`, or `unflushed_backlog`. |
| `kahuna.kv.write.batches` | Counter | Raft batches dispatched by the aggregator. |
| `kahuna.kv.write.entries` | Counter | Log entries dispatched across all aggregator batches. |
| `kahuna.kv.write.outcomes` | Counter | Batch outcomes tagged as `success`, `transient`, or `permanent`. |
| `kahuna.kv.write.batch_items` | Histogram | Entries per dispatched batch. |
| `kahuna.kv.write.batch_bytes` | Histogram | Serialized bytes per dispatched batch. |
| `kahuna.kv.write.queue_age` | Histogram | Age of the oldest item in a dispatched batch, in milliseconds. |
| `kahuna.kv.write.submission_queue_delay` | Histogram | Per-submission admission-to-dispatch delay, tagged by admission class, log type, and producer stage such as `prepare`, `decision`, `materialize`, `settle`, or `one_phase`. |
| `kahuna.kv.write.raft_duration` | Histogram | Raft-call duration for aggregator batches, in milliseconds. |
| `kahuna.kv.write.completion_delay` | Histogram | Time from Raft returning to the end of the aggregator completion turn. High values with low Raft duration point at completion handling rather than consensus. |
| `kahuna.kv.write.queued_items` | Gauge | Admitted writes not yet completed. |
| `kahuna.kv.write.queued_bytes` | Gauge | Serialized bytes admitted but not yet completed. |
| `kahuna.kv.write.in_flight_partitions` | Gauge | Partitions with a batch awaiting a Raft result. |
| `kahuna.persistence.unflushed_items` | Gauge | Committed key/value writes still resident because the background writer has not flushed them. |
| `kahuna.persistence.unflushed_bytes` | Gauge | Approximate value bytes still waiting for background flush. |
| `kahuna.persistence.writer_inbox_items` | Gauge | Pending messages in the background writer inbox. |
| `kahuna.persistence.unflushed_budget_fraction` | Gauge | Highest used fraction of the configured item or byte backlog budget. |
| `kahuna.persistence.backlog_gate_closed` | Gauge | `1` while ordinary persistent writes are being refused with retryable backlog backpressure. |

The main effectiveness signal is:

```text
kahuna.kv.write.entries / kahuna.kv.write.batches
```

During a healthy coalescing burst, this ratio should move above one and may approach the configured item cap. If it stays near one under heavy write load, writes may be too spread out across partitions, the linger may be too low for the arrival pattern, or the bottleneck may be somewhere else.
