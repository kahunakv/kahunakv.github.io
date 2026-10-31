import SequencerImage from './assets/sequencer-opt-transparent.png';

# Distributed Sequencer

A database identity column hands out unique, increasing numbers, but only inside one database. It cannot number orders created by several services that write to different stores, and a client that retries an insert after a timeout can end up with a second row and a second number for the same order.

Kahuna's distributed sequencer provides named sequences of increasing integers that any service can call. An [idempotency key](/docs/glossary/#idempotency-key) makes a retried request return the original value instead of a new one. Sequences are replicated with [Raft](/docs/glossary/#raft), like persistent locks and keys. Use them when several processes need one authoritative source for IDs, version numbers, ordering tokens, or contiguous batches of numbers.

<div style={{textAlign: 'center'}}>
<img src={SequencerImage} alt="Distributed sequencer" style={{maxWidth: '100%', maxHeight: 250, height: 'auto'}} />
</div>

## What It Provides

- **Per-sequence monotonicity**: values increase for a single sequence name.
- **Uniqueness**: committed allocations for the same sequence are never duplicated within one incarnation. An update starts a new incarnation and can reissue numbers if it lowers the current value; see [Sequence model and allocation](/docs/distributed-sequencer/model/).
- **Gaps, not duplicates**: values are unique and increasing, but not gap-free. A node reserves a block of values (1000 by default) and serves it from memory; when the node restarts, evicts the sequence, or loses ownership of it, the unused rest of the block is skipped. This matters for invoice numbers and other domains that must not skip numbers; see [Gaps](/docs/distributed-sequencer/idempotency/#gaps).
- **Range reservations**: callers can reserve contiguous batches such as `101..200`.
- **Idempotent retries**: allocation requests can include an idempotency key so retried requests return the original allocation.
- **Safe updates**: callers can change the current value, increment, max value, or per-sequence block size (how many values a node reserves in one durable commit and then serves from memory). Before it reports the update, Kahuna waits until no node can still hand out values from a block reserved under the old settings.
- **Persistent durability**: sequence state is replicated through Raft and survives [leader](/docs/glossary/#leader-follower-and-learner) changes.

Kahuna does not provide a single global order across all sequence names. Ordering is scoped to each sequence.

## Common Use Cases

- Invoice, order, ticket, and customer IDs.
- Build numbers and artifact versions.
- Monotonic event offsets for a tenant or stream.
- Version tokens that an external system uses to reject writes from a stale writer. These are values you allocate yourself; they are separate from the [fencing token](/docs/distributed-locks/fencing-tokens/) that Kahuna returns with each lock.
- Batch allocation for workers that need a local block of unique IDs.

## Best Practices

- Use one sequence per ordering domain, such as `orders`, `tenant-a/orders`, or `tenant-a/invoices`.
- Use idempotency keys for retried allocation requests.
- Reserve ranges for high-throughput workers that can consume a local block of IDs.
- Use a per-sequence `blockSize` of `1` only for numbering domains that need one durable commit per value.
- Set `MaxValue` only when the domain has a real upper bound.
- Do not depend on gapless behavior unless the sequence uses a `blockSize` of `1`, every allocated value is consumed, and every retried request uses the same idempotency key.

## Next Steps

- [Sequence model and allocation](/docs/distributed-sequencer/model/)
- [Idempotent retries](/docs/distributed-sequencer/idempotency/)
- [CLI, .NET client, and TypeScript client](/docs/distributed-sequencer/clients/)
- [REST and gRPC API](/docs/distributed-sequencer/api/)
