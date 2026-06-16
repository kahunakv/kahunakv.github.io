# Leader Election

Use Kahuna distributed locks when one process should own a role at a time. Common examples include schedulers, background workers, compactors, importers, and cluster-wide maintenance jobs.

The lock lease prevents permanent ownership if the leader crashes. The fencing token protects downstream systems from stale leaders.

## Acquire Leadership

```csharp
await using KahunaLock leadership = await client.GetOrCreateLock(
    "leaders/billing-scheduler",
    expiry: TimeSpan.FromSeconds(15),
    wait: TimeSpan.FromSeconds(3),
    retry: TimeSpan.FromMilliseconds(200),
    durability: LockDurability.Persistent
);

if (!leadership.IsAcquired)
    return;

long fencingToken = leadership.FencingToken;

await RunScheduler(fencingToken);
```

## Renew While Healthy

Long-running leaders should extend the lease periodically:

```csharp
while (!stoppingToken.IsCancellationRequested)
{
    (bool extended, long token) = await leadership.TryExtend(TimeSpan.FromSeconds(15));

    if (!extended || token != fencingToken)
        break;

    await DoLeaderWork(stoppingToken);
    await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
}
```

## Use Fencing Tokens

Every external write made by the leader should carry the fencing token. The downstream system should reject writes with an older token than the latest committed token for that resource.

```csharp
await db.SaveCheckpoint(
    jobName: "billing-scheduler",
    checkpoint: checkpointValue,
    fencingToken: leadership.FencingToken
);
```

This matters when a leader pauses, loses the lease, and later resumes believing it still owns the role.

## Operational Notes

- Keep the lease long enough to tolerate normal GC pauses and network jitter.
- Renew at a fraction of the lease duration, for example every 5 seconds for a 15 second lease.
- Use persistent lock durability for leadership that must survive process or node failures.
- Always use the fencing token when the leader writes to external systems.
