# Sequences Internals

A sequence works like a database identity column shared by every node: each allocation returns values no other caller receives, even across retries and leader changes. Read this page to see how Kahuna builds that on the key/value subsystem, and why unused values become gaps rather than duplicates.

## Reserved Keyspace

Sequence state is stored under a reserved internal prefix:

```text
__kahuna:sequences:{sequence-name}
```

This lets sequences reuse the existing routing, [Raft](/docs/glossary/#raft) replication, compare-and-set, and persistence behavior of key/value entries.

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
3. Check the idempotency map if an [idempotency key](/docs/glossary/#idempotency-key) is provided.
4. Serve the allocation from the [actor](/docs/glossary/#actor)'s resident block when one is available.
5. Reserve a new block with a compare-and-set (CAS) on the durable high-water mark when the resident block is empty.
6. Validate the allocation against `MaxValue`.
7. Retry if a concurrent update changed the source revision.

The compare-revision write is what prevents overlapping allocations when multiple clients target the same sequence.

`CurrentValue` is the durable high-water mark reserved by the owner. With the default block size of `1000`, a sequence created at `0` can report `CurrentValue = 1000` after the first allocation because the actor reserved a full block and then handed out one value.

## Block Lease and Updates

`SequencerBlockLease` bounds how long an actor may serve a reserved block without revalidating the durable record. This limits the stale-owner window after a leadership change.

`UpdateSequence` rewrites sequence parameters, increments `Incarnation`, clears idempotency records, and waits one block lease before reporting success. During that same window, allocations for the updated sequence return `MustRetry`. This keeps old and new incarnations from issuing values at the same time after the update is reported complete.

A node configured with `SequencerBlockLease = 0` refuses sequence updates because stale blocks would never be forced to revalidate.

## One Request at a Time

Each sequence is owned by one `SequenceActor` on the leader of its [partition](/docs/glossary/#partition). The actor processes requests one at a time, so it can hand out values from its resident block without a lock. This is not the distributed correctness mechanism: a block reservation lands only if the durable record still carries the revision the actor read, so even a former leader that has not yet learned it lost the partition cannot reserve a range that overlaps the new leader's.

Unused values in an abandoned block, after a restart, an eviction, or an ownership change, become gaps, never duplicates. This holds within one incarnation of the sequence; the block lease above bounds the window across incarnations.

## Idempotency Storage

When an idempotency key is provided, the resulting allocation is stored in the sequence state. A retry with the same idempotency key returns the stored allocation instead of consuming another range.

The stored idempotency key is scoped as a reservation entry, so `next` is treated as a range reservation with `count = 1`.
