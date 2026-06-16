# Idempotent Jobs

Use Kahuna when a distributed worker pool must process each logical job once, or at least prevent duplicate side effects from concurrent workers.

This recipe combines:

- a lock to claim active processing
- a persistent key to record completion
- compare-and-set behavior to avoid overwriting another worker's result

## Key Layout

```text
jobs/{job-id}/lock
jobs/{job-id}/status
```

Example:

```text
jobs/invoice-2048/lock
jobs/invoice-2048/status
```

## Claim and Complete

```csharp
string jobId = "invoice-2048";
string statusKey = $"jobs/{jobId}/status";

KahunaKeyValue existing = await client.GetKeyValue(statusKey);
if (existing.Success && existing.ValueAsString() == "completed")
    return;

await using KahunaLock jobLock = await client.GetOrCreateLock(
    $"jobs/{jobId}/lock",
    expiry: TimeSpan.FromSeconds(30),
    wait: TimeSpan.FromSeconds(5),
    retry: TimeSpan.FromMilliseconds(200)
);

if (!jobLock.IsAcquired)
    return;

existing = await client.GetKeyValue(statusKey);
if (existing.Success && existing.ValueAsString() == "completed")
    return;

await ProcessInvoice(jobId, jobLock.FencingToken);

await client.SetKeyValue(
    statusKey,
    "completed",
    expiryTime: 0,
    flags: KeyValueFlags.Set,
    durability: KeyValueDurability.Persistent
);
```

## Scripted Status Transition

For state transitions that should happen atomically on the server, use a script:

```kahuna
let status = get @status_key

if status == "completed" then
  return "already-completed"
end

set @status_key "completed"
return "completed"
```

Run it with parameters:

```csharp
KahunaKeyValueTransactionResult result = await client.ExecuteKeyValueTransactionScript(
    """
    let status = get @status_key

    if status == "completed" then
      return "already-completed"
    end

    set @status_key "completed"
    return "completed"
    """,
    parameters: [new() { Key = "@status_key", Value = statusKey }]
);
```

## Operational Notes

- Make the lock lease longer than the expected processing step or extend it while processing.
- Store completion state persistently if jobs must not be repeated after restart.
- Use fencing tokens for any side effect outside Kahuna.
- Keep job status values small and explicit, for example `pending`, `processing`, `completed`, `failed`.
