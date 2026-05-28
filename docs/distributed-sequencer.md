import Kahuna6 from './assets/kahuna6.png';

# Distributed Sequencer

<div style={{textAlign: 'center'}}>
<img src={Kahuna6} height="350" />
</div>

Kahuna's distributed sequencer provides named, monotonically increasing integer sequences backed by the same Raft coordination model used by locks and key/value operations. It is useful when multiple processes need one authoritative source for IDs, version numbers, ordering tokens, or contiguous batches of numbers.

## What It Provides

- **Per-sequence monotonicity**: values increase for a single sequence name.
- **Uniqueness**: committed allocations for the same sequence are never duplicated.
- **Range reservations**: callers can reserve contiguous batches such as `101..200`.
- **Idempotent retries**: allocation requests can include an idempotency key so retried requests return the original allocation.
- **Persistent durability**: sequence state is replicated through Raft and survives leader changes.

Kahuna does not provide a single global order across all sequence names. Ordering is scoped to each sequence.

## Common Use Cases

- Invoice, order, ticket, and customer IDs.
- Build numbers and artifact versions.
- Monotonic event offsets for a tenant or stream.
- External fencing or version tokens for systems that need stale-writer protection.
- Batch allocation for workers that need a local block of unique IDs.

## Best Practices

- Use one sequence per ordering domain, such as `orders`, `tenant-a/orders`, or `tenant-a/invoices`.
- Use idempotency keys for retried allocation requests.
- Reserve ranges for high-throughput workers that can consume a local block of IDs.
- Set `MaxValue` only when the domain has a real upper bound.
- Do not depend on gapless behavior unless every allocated value is consumed and every retried request uses the same idempotency key.

## Next Steps

- [Sequence model and allocation](distributed-sequencer/model.md)
- [Idempotent retries](distributed-sequencer/idempotency.md)
- [CLI and .NET client](distributed-sequencer/clients.md)
- [REST and gRPC API](distributed-sequencer/api.md)
