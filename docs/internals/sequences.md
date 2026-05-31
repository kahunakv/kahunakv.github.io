# Sequences Internals

Kahuna's distributed sequencer is implemented on top of the key/value subsystem.

## Reserved Keyspace

Sequence state is stored under a reserved internal prefix:

```text
__kahuna:sequences:{sequence-name}
```

This lets sequences reuse the existing routing, Raft replication, compare-and-set, and persistence behavior of key/value entries.

## State Format

`SequencerManager` serializes sequence state as JSON. The state includes:

- sequence name,
- current value,
- initial value,
- increment,
- optional max value,
- created and updated timestamps,
- idempotency records.

Public clients see this state as `KahunaSequence` or `ReadOnlySequenceEntry`.

## Allocation Flow

For `next` and `reserve`:

1. Validate the sequence name and durability.
2. Load the sequence state from the reserved key.
3. Check the idempotency map if an idempotency key is provided.
4. Calculate the next value or range.
5. Validate against `MaxValue`.
6. Write the updated state with compare-revision semantics.
7. Retry if a concurrent update changed the source revision.

The compare-revision write is what prevents overlapping allocations when multiple clients target the same sequence.

## Per-Sequence Local Lock

`SequencerManager` keeps a local semaphore per normalized sequence name. This reduces local contention and avoids unnecessary compare-revision retries on the same node. It is not the distributed correctness mechanism; Raft-backed compare-revision writes provide the cluster-wide safety.

## Idempotency Storage

When an idempotency key is provided, the resulting allocation is stored in the sequence state. A retry with the same idempotency key returns the stored allocation instead of consuming another range.

The stored idempotency key is scoped as a reservation entry, so `next` is treated as a range reservation with `count = 1`.
