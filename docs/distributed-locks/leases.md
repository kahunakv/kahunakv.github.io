
import LeasesImage from '../assets/leases-opt-transparent.png';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Leases

If a lock holder crashes or loses its network connection, it never releases the lock, and every other worker waits forever. A **lease** solves this: it is a lock with an expiry time. The holder extends the lease while it works, and if the holder disappears, the lock frees itself when the lease runs out.

- **Automatic expiration**: a lease expires after its duration, so a client that crashes, becomes unreachable, or is cut off from the network cannot block the lock forever. Once the lease runs out, other clients can acquire the lock and the system keeps making progress.
- **Explicit unlock is optional**: Kahuna clients release locks explicitly when they finish, but correctness does not depend on that release arriving, which simplifies handling crashes and network failures.

<div style={{textAlign: 'center'}}>
<img src={LeasesImage} alt="What are leases?" style={{maxWidth: '100%', maxHeight: 250, height: 'auto'}} />
</div>

Leases by themselves do not provide mutual exclusion. A client that pauses (for example, during a long GC pause or a network outage) can resume after its lease expired and another client acquired the lock, and both then believe they own it. [Fencing tokens](/docs/distributed-locks/fencing-tokens/) close this gap: the protected resource rejects writes that carry an older token.

Kahuna's locks are based on the paper [*"Leases: An Efficient
Fault-Tolerant Mechanism for Distributed File Cache Consistency"*](https://web.stanford.edu/class/cs240/readings/leases.pdf) by Cary G. Gray and David R. Cheriton (SOSP 1989), which introduced leases as time-bound grants that the server can safely take back once they expire, even if the holder never answers.

## Choosing a Lease Length

The lease length is the longest time other workers wait for the lock after its owner disappears. Unlocking releases the lock at once, so a long lease costs nothing when the owner finishes normally; it matters only when the owner crashes or is cut off.

| | Short lease (seconds) | Long lease (minutes) |
|---|---|---|
| Takeover after the owner crashes | Fast | Slow: other workers wait for the lease to run out |
| Extend traffic | More, because the owner must extend often | Less |
| Risk of losing the lock while still working | Higher: a GC pause, slow network, or overloaded host can outlast the lease | Lower |

Pick a lease longer than the longest pause you expect in the owner, plus a margin, and extend it well before it ends. Whatever length you choose, a pause can still outlast it, so protect writes with [fencing tokens](/docs/distributed-locks/fencing-tokens/).

## Renewing a Lease

When the work takes longer than one lease, extend the lease as you go. An extend sets the lease to end the given duration after the call, keeps the same owner, and keeps the same fencing token.

A failed extend means you no longer hold the lock: the lease already expired, or another owner acquired it. The .NET and TypeScript clients report this by throwing, not by returning `false`. Stop the work at that point, because another worker may already be doing it.

This loop processes a job in batches and extends the lease before each batch, so each batch must finish within one lease:

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
await using KahunaLock myLock = await client.GetOrCreateLock(
    "jobs/nightly-export",
    TimeSpan.FromSeconds(30)
);

if (!myLock.IsAcquired)
    return;

foreach (var batch in batches)
{
    try
    {
        // The lease now ends 30 seconds from this call.
        await myLock.TryExtend(TimeSpan.FromSeconds(30));
    }
    catch (KahunaException)
    {
        // The lease expired or another owner holds the lock. Stop the work.
        return;
    }

    await ExportBatch(batch, myLock.FencingToken);
}
```

`TryExtend` returns `(bool, long)`, the extended flag and the fencing token, when it succeeds. When the lock is lost it throws a `KahunaException` whose `LockErrorCode` is `LockDoesNotExist` (the lease expired) or `InvalidOwner` (another owner holds it).

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
await using lock = await client.acquireLock("jobs/nightly-export", {
  expiry: 30_000
});

if (!lock.acquired) return;

for (const batch of batches) {
  try {
    // The lease now ends 30 seconds from this call.
    await lock.extend(30_000);
  } catch {
    // The lease expired or another owner holds the lock. Stop the work.
    return;
  }

  await exportBatch(batch, lock.fencingToken);
}
```

`extend` resolves to `{ extended, fencingToken }` when it succeeds. When the lock is lost it rejects with a `KahunaError` whose code is `lockDoesNotExist` (the lease expired) or `invalidOwner` (another owner holds it).

</TabItem>
</Tabs>

If a single step can take longer than the lease, extend from a background timer instead, and cancel the step when an extend fails.

## Leases During a Leader Change

What happens to a held lease when a node fails depends on the lock's [durability level](/docs/architecture/durability-levels/):

- **Persistent lock:** the owner, the fencing token, and the lease's expiry time are replicated through [Raft](/docs/glossary/#raft) with every acquire and extend. After a leader change, the new [partition](/docs/glossary/#partition) leader enforces the same expiry, so the owner keeps the lock and can extend it. The lease keeps running during the election, so an owner whose lease ends meanwhile loses the lock as usual.
- **Ephemeral lock:** the lock lives only in the partition leader's memory. A node restart or a leader change loses it, so another worker can acquire it before the lease would have ended, and the fencing token count restarts at `0`. An ephemeral lock entry can also be [evicted from memory](/docs/architecture/keys-eviction/#locks-and-sequences) when it has not been used for `--cache-entry-ttl` (default 1800 seconds) and its lock actor holds 200 or more entries, even if its lease has not ended. Extend an ephemeral lock more often than that.
