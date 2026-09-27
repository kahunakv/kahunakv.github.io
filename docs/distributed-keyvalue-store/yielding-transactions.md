# Yielding Transactions

Yielding transactions are for background maintenance work that should never make foreground writes fail. Typical examples are bulk rewrites, backfills, migrations, and compaction-like sweeps.

By default, a live transactional write intent blocks other writers until it commits, rolls back, or expires. A yielding transaction changes that rule for point-key write intents: a normal foreground writer can take the key over, and the yielding transaction aborts instead.

## When to Use It

Use yielding when the background job is optional or retryable:

- refreshing derived values
- backfilling a new key format
- compacting application records into a new shape
- reprocessing a bounded batch that can be retried later

Do not use yielding for user-visible workflows where the transaction must either commit the whole write set or report a conflict immediately. A yielding transaction is allowed to lose.

## .NET Example

`ConflictPolicy = TransactionConflictPolicy.Yield` is available on interactive transaction sessions:

```csharp
using Kahuna.Client;
using Kahuna.Shared.KeyValue;

KahunaTransactionOptions options = new()
{
    Locking = KeyValueTransactionLocking.Pessimistic,
    ConflictPolicy = TransactionConflictPolicy.Yield,
    Timeout = 10_000
};

await client.RetryableTransaction(options, async (session, cancellationToken) =>
{
    KahunaKeyValue current = await session.GetKeyValue(
        "profiles/user-42",
        KeyValueDurability.Persistent,
        cancellationToken
    );

    await session.SetKeyValue(
        "profiles/user-42",
        TransformProfile(current.ValueAsString()),
        durability: KeyValueDurability.Persistent,
        cancellationToken: cancellationToken
    );

    await session.Commit(cancellationToken);
});
```

If a normal writer updates `profiles/user-42` while this maintenance transaction is open, the normal writer wins. The yielding transaction then observes `Aborted` on a later operation against that key or when it commits.

## Rules

- `Normal` is the default conflict policy and preserves the existing transaction behavior.
- `Yield` applies only to interactive transactions.
- Kahuna Script transactions cannot set `Yield`.
- Plain non-transactional writes and normal transactions can take over point-key intents owned by a yielding transaction.
- Two yielding transactions do not take keys from each other. They conflict like two normal transactions.
- A yielding transaction cannot acquire prefix locks or range locks, because yielding only applies to point-key intents.

## Commit Safety

A yielding transaction never commits a write to a key it already lost.

Before finalization, Kahuna pins the surviving intents owned by the yielding transaction. A key that was taken over fails that pin step and aborts the whole transaction. Once an intent is pinned, foreground writers stop taking it over and receive the normal bounded wait/retry behavior because the yielding transaction is already finalizing.

This pin step runs before every finalize shape, including one-phase durable commit, two-phase durable commit, and the in-memory ephemeral path.

## Starvation

Yielding favors foreground work. A large yielding transaction over hot keys may repeatedly abort and make no progress. Keep yielding work in small batches, back off when it loses often, and retry later.

Use transaction priority for admission order and yielding for conflict behavior. They are independent: priority decides when a transaction starts under admission pressure, while yielding decides what happens when a running transaction's point-key intent meets foreground work.

## Observability

| Metric | Meaning |
|--------|---------|
| `kahuna.transactions.yielded_intents` | Yielding intents taken over by foreground writers, tagged by operation. |
| `kahuna.transactions.yield_aborts` | Yielding transactions aborted after losing a key, tagged by where the loss was caught. |
| `kahuna.transactions.pinned_waits` | Foreground requests told to wait because a yielding intent was already pinned for commit. |

Debug logs also record each takeover with the key, the yielding owner, and the foreground requester.
