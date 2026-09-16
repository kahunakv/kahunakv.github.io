import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

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

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

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
    flags: KeyValueFlags.SetNoRevision,
    durability: KeyValueDurability.Persistent
);
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const jobId = "invoice-2048";
const statusKey = `jobs/${jobId}/status`;

let existing = await client.get(statusKey);
if (existing.success && existing.valueAsString() === "completed") {
  return;
}

await using jobLock = await client.acquireLock(`jobs/${jobId}/lock`, {
  expiry: 30_000,
  wait: 5000,
  retry: 200
});

if (!jobLock.acquired) {
  return;
}

existing = await client.get(statusKey);
if (existing.success && existing.valueAsString() === "completed") {
  return;
}

await processInvoice(jobId, jobLock.fencingToken);

await client.setNoRevision(statusKey, "completed", {
  durability: "persistent"
});
```

</TabItem>
</Tabs>

## Scripted Status Transition

For state transitions that should happen atomically on the server, use a script:

```kahuna
let status = get @status_key

if status == "completed" then
  return "already-completed"
end

set @status_key "completed" norev
return "completed"
```

Run it with parameters:

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
KahunaKeyValueTransactionResult result = await client.ExecuteKeyValueTransactionScript(
    """
    let status = get @status_key

    if status == "completed" then
      return "already-completed"
    end

    set @status_key "completed" norev
    return "completed"
    """,
    parameters: [new() { Key = "@status_key", Value = statusKey }]
);
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const script = client.loadScript(`
let status = get @status_key

if status == "completed" then
  return "already-completed"
end

set @status_key "completed" norev
return "completed"
`);

const result = await script.run({
  parameters: [{ key: "@status_key", value: statusKey }]
});

const firstValue = result.values[0]?.value;
const status = firstValue ? new TextDecoder().decode(firstValue) : null;
```

</TabItem>
</Tabs>

## Operational Notes

- Make the lock lease longer than the expected processing step or extend it while processing.
- Store completion state persistently if jobs must not be repeated after restart.
- Use no-revision writes for final job status when you only care whether the job completed.
- Use fencing tokens for any side effect outside Kahuna.
- Keep job status values small and explicit, for example `pending`, `processing`, `completed`, `failed`.
