# Idempotent Retries

`next` and `reserve` accept an optional idempotency key. The key lets clients safely retry allocation requests when the outcome is unknown.

## Why It Matters

A client can time out after Kahuna commits an allocation but before the response reaches the caller. Without idempotency, retrying the request may allocate a new value and leave a gap.

With an idempotency key, retrying the same allocation request returns the original committed allocation.

## Example Flow

```text
1. Client sends next-sequence orders request-123.
2. Kahuna commits value 42.
3. The network drops the response.
4. Client retries next-sequence orders request-123.
5. Kahuna returns 42 again.
```

## When to Use It

Use idempotency keys for:

- HTTP clients with automatic retry policies.
- Job workers that may restart while processing.
- Message consumers that may receive duplicate messages.
- Any allocation request where duplicate consumption would be expensive or unsafe.

## Gaps

Kahuna guarantees uniqueness and monotonicity for committed allocations, not universal gaplessness.

Gaps can still happen when:

- A request commits and the caller retries without the same idempotency key.
- A caller reserves a range and does not consume every value.
- A sequence owner abandons the unused part of an in-memory block after restart, eviction, or ownership change.
- A sequence is deleted and recreated with new parameters.
- A sequence is updated, which starts a new incarnation and clears old idempotency records.

If a domain requires strict auditability, store the allocated value together with the business operation that consumed it.

## Updates and Incarnations

Idempotency records belong to the sequence incarnation that created them. When `update` changes a sequence, Kahuna increments `Incarnation` and clears the idempotency map. Retrying an old idempotency key after the update allocates from the new incarnation instead of replaying an allocation from the old one.
