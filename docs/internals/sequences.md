# Sequences Internals

Kahuna's distributed sequencer is implemented on top of the key/value subsystem.

## Reserved Keyspace

Sequence state is stored under a reserved internal prefix:

```text
__kahuna:sequences:{sequence-name}
```

This lets sequences reuse the existing routing, Raft replication, compare-and-set, and persistence behavior of key/value entries.

## State Format

`SequencerManager` serializes sequence state in Kahuna's binary sequence format. Older JSON and earlier binary records are still readable and migrate forward on the next write. The state includes:

- Sequence name
- Current value
- Initial value
- Increment
- Optional max value
- Optional per-sequence block size
- Incarnation
- Created and updated timestamps
- Idempotency records

Public clients see this state as `KahunaSequence` or `ReadOnlySequenceEntry`.

## Allocation Flow

For `next` and `reserve`:

1. Validate the sequence name and durability.
2. Load the sequence state from the reserved key.
3. Check the idempotency map if an idempotency key is provided.
4. Serve the allocation from the actor's resident block when one is available.
5. Reserve a new block by compare-and-swapping the durable high-water mark when the resident block is empty.
6. Validate the allocation against `MaxValue`.
7. Retry if a concurrent update changed the source revision.

The compare-revision write is what prevents overlapping allocations when multiple clients target the same sequence.

`CurrentValue` is the durable high-water mark reserved by the owner. With the default block size of `1000`, a sequence created at `0` can report `CurrentValue = 1000` after the first allocation because the actor reserved a full block and then handed out one value.

## Block Lease and Updates

`SequencerBlockLease` bounds how long an actor may serve a reserved block without revalidating the durable record. This limits the stale-owner window after a leadership change.

`UpdateSequence` rewrites sequence parameters, increments `Incarnation`, clears idempotency records, and waits one block lease before reporting success. During that same window, allocations for the updated sequence return `MustRetry`. This keeps old and new incarnations from issuing values at the same time after the update is reported complete.

A node configured with `SequencerBlockLease = 0` refuses sequence updates because stale blocks would never be forced to revalidate.

## Per-Sequence Local Lock

`SequencerManager` keeps a local semaphore per normalized sequence name. This reduces local contention and avoids unnecessary compare-revision retries on the same node. It is not the distributed correctness mechanism; Raft-backed compare-revision writes provide the cluster-wide safety.

## Idempotency Storage

When an idempotency key is provided, the resulting allocation is stored in the sequence state. A retry with the same idempotency key returns the stored allocation instead of consuming another range.

The stored idempotency key is scoped as a reservation entry, so `next` is treated as a range reservation with `count = 1`.
