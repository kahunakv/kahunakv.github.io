# Partition Write Coalescing

Kahuna coalesces persistent partition writes before proposing them to Raft. This reduces the number of WAL appends, quorum round trips, and synchronous disk flushes needed when many clients write to the same partition at the same time.

A direct write is a non-transactional persistent key/value mutation:

- `SET`, including conditional and `NOREV` variants
- `DELETE`
- `EXTEND`
- .NET client equivalents such as `SetKeyValue(...)`, `SetManyKeyValues(...)`, `DeleteKeyValue(...)`, `DeleteManyKeyValues(...)`, and `ExtendKeyValue(...)`

Ephemeral writes do not use this path because they are in-memory only. In-flight transactional writes also do not enter this path while the transaction is open; they stage MVCC intents on their owning actors. When an all-persistent durable transaction finalizes, its canonical transaction record and prepared-intent deltas use the same partition scheduler as direct writes.

## How It Works

Every persistent write belongs to one Raft partition. For a direct key/value mutation, the partition leader validates the write, stages the in-memory intent, serializes the log record, and hands that record to a leader-local write aggregator.

The aggregator keeps a queue per partition. Instead of proposing each record immediately, it can send several records for the same partition in one Raft call. Writes from different clients and from batch APIs share the same partition queue, so coalescing works across requests and not only inside one `SetManyKeyValues(...)` call.

The scheduler is shared across compatible persistent log types for the same partition. A batch may contain direct key/value records plus durable transaction-record or prepared-intent entries from concurrent durable transactions. Each queued item keeps its own completion path, so a mixed batch can still resolve each caller or transaction finalizer independently.

Some transaction work intentionally stays outside this scheduler. Ephemeral transaction staging and the ephemeral subset of a mixed transaction still use the legacy in-memory prepare/commit/rollback path. The persistent durable subset enters the scheduler only when finalization writes canonical records, prepared intents, materialized values, or settlement deltas.

Kahuna still preserves normal consistency:

- writes for a partition remain ordered
- at most one batch is in flight per partition
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
| `--kv-write-max-batch-items` | `512` | Maximum log entries selected for one Raft call. |
| `--kv-write-max-batch-bytes` | `4194304` | Target serialized bytes selected for one Raft call. A single oversized item still dispatches alone. |
| `--kv-write-max-queued-items` | `8192` | Maximum admitted persistent submissions per partition, including writes already in flight. |
| `--kv-write-max-queued-bytes` | `33554432` | Maximum admitted serialized bytes per partition, including writes already in flight. |
| `--kv-write-max-queue-delay-ms` | `1000` | Maximum pre-dispatch wait before a queued write is released as `MustRetry`. |
| `--kv-write-aggregator-inbox-size` | `16384` | Ordinary submission inbox bound per aggregator lane. Control messages are exempt. |

Durable transaction decisions, materialization, settlement, recovery, and range-metadata handoff use terminal submissions. Terminal submissions have reserved headroom above the ordinary queue caps so a partition saturated with ordinary writes can still finish already-prepared transactions. The terminal reserve and node-global queue settings are `KahunaConfiguration` fields today, not public server CLI flags.

Use `--kv-write-linger-ms 0` when uncontended single-write latency matters more than coalescing. Keep a small positive linger, such as the default `1`, when same-partition bursts are expected.

Increasing `--kv-write-max-batch-items` or `--kv-write-max-batch-bytes` can improve throughput for large bursts, but it can also make one partition's committed batch larger. If tail latency rises, reduce the batch caps or the linger window.

Queue limits are backpressure controls. If a partition queue fills, Kahuna returns `MustRetry` so clients can retry through the normal routing path. Do not raise queue limits just to hide sustained overload; first check whether the partition is hot, whether key-range splitting applies, and whether leader balancing can move work to another node.

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
| `kahuna.kv.write.rejections` | Counter | Rejected or released submissions, tagged by reason such as `queue_full`, `inbox_full`, `stopping`, `fence_stale`, or `queue_expired`. |
| `kahuna.kv.write.batches` | Counter | Raft batches dispatched by the aggregator. |
| `kahuna.kv.write.entries` | Counter | Log entries dispatched across all aggregator batches. |
| `kahuna.kv.write.outcomes` | Counter | Batch outcomes tagged as `success`, `transient`, or `permanent`. |
| `kahuna.kv.write.batch_items` | Histogram | Entries per dispatched batch. |
| `kahuna.kv.write.batch_bytes` | Histogram | Serialized bytes per dispatched batch. |
| `kahuna.kv.write.queue_age` | Histogram | Age of the oldest item in a dispatched batch, in milliseconds. |
| `kahuna.kv.write.raft_duration` | Histogram | Raft-call duration for aggregator batches, in milliseconds. |
| `kahuna.kv.write.queued_items` | Gauge | Admitted writes not yet completed. |
| `kahuna.kv.write.queued_bytes` | Gauge | Serialized bytes admitted but not yet completed. |
| `kahuna.kv.write.in_flight_partitions` | Gauge | Partitions with a batch awaiting a Raft result. |

The main effectiveness signal is:

```text
kahuna.kv.write.entries / kahuna.kv.write.batches
```

During a healthy coalescing burst, this ratio should move above one and may approach the configured item cap. If it stays near one under heavy write load, writes may be too spread out across partitions, the linger may be too low for the arrival pattern, or the bottleneck may be somewhere else.
