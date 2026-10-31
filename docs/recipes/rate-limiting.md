import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Rate Limiting

Rate limiting protects shared resources by rejecting or delaying work once a caller crosses an allowed request budget. When many service instances enforce one limit, they must share the counter. Kahuna runs the read, check, and increment as one atomic script on the server, much like a Redis Lua script, instead of several client round-trips.

For the built-in limiters in the .NET and TypeScript clients, and their ASP.NET Core and Node.js middleware, see [Distributed Rate Limiting](/docs/distributed-rate-limiting/). They provide fixed windows, segmented sliding windows, token buckets, and lease-based concurrency limits.

This recipe uses an **[ephemeral](/docs/glossary/#durability)** key because rate-limit counters are temporary state. The key expires automatically when the window ends.

An ephemeral counter lives only in the memory of the [partition](/docs/glossary/#partition) leader. A Kahuna node restart, a leader change, or [memory eviction](/docs/architecture/keys-eviction/) drops it, and the window starts again from zero, so callers can briefly exceed the limit. That is acceptable for most throttling. When a reset could cause real harm, for example a cap on paid API calls or on password attempts, use persistent keys (`get` and `set` instead of `eget` and `eset`): the counter then survives restarts and leader changes, but every admitted request becomes a replicated [Raft](/docs/glossary/#raft) write, and the script no longer takes the single-key fast path. See [Durability Levels](/docs/architecture/durability-levels/).

The examples below match Kahuna's [single-key script fast path](/docs/scripts/single-key-fast-path/): one auto-commit script, one ephemeral key, no blocking statements. That keeps rate-limit checks atomic without paying the full multi-key transaction cost.

## Fixed Window Counter

Use one key per subject and time window:

```text
rate-limit/{scope}/{subject}/{window-start}
```

Examples:

```text
rate-limit/login/203.0.113.10/1718391900
rate-limit/api/user-42/1718391900
```

This recipe derives window keys from the application clock. Clock skew between application instances can put their requests in different windows, so it is not an exact shared time boundary; the built-in .NET fixed-window limiter computes boundaries with the cluster's [hybrid logical clock](/docs/glossary/#hybrid-logical-clock-hlc) (`hlc()`) inside its decision script.

The script below creates the counter if it does not exist, increments it if it does, and rejects the request once the limit has been reached. Pass `@expires_ms` as the remaining time in the current window, optionally with a small grace period. Do not pass the full window length on every request, because that turns the counter into a sliding-expiration counter.

```kahuna
let current = eget @counter_key

if not found then
  eset @counter_key 1 ex to_int(@expires_ms)
  return 1
end

let count = to_int(current)

if count >= to_int(@limit) then
  return 0
end

eset @counter_key count + 1 ex to_int(@expires_ms)
return 1
```

Script parameters arrive as strings, so the script converts them with `to_int` before it compares or passes them to `ex`.

Run it from a client with parameters:

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
long nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
long windowMs = 60_000;
long windowStartMs = nowMs - (nowMs % windowMs);
long windowEndMs = windowStartMs + windowMs;
long expiresMs = Math.Max(1, windowEndMs - nowMs + 1_000);

KahunaKeyValueTransactionResult result = await client.ExecuteKeyValueTransactionScript(
    """
    let current = eget @counter_key

    if not found then
      eset @counter_key 1 ex to_int(@expires_ms)
      return 1
    end

    let count = to_int(current)

    if count >= to_int(@limit) then
      return 0
    end

    eset @counter_key count + 1 ex to_int(@expires_ms)
    return 1
    """,
    parameters:
    [
        new() { Key = "@counter_key", Value = $"rate-limit/login/203.0.113.10/{windowStartMs}" },
        new() { Key = "@limit", Value = "10" },
        new() { Key = "@expires_ms", Value = expiresMs.ToString() }
    ]
);

bool allowed = result.FirstValueAsString == "1";
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const nowMs = Date.now();
const windowMs = 60_000;
const windowStartMs = nowMs - (nowMs % windowMs);
const windowEndMs = windowStartMs + windowMs;
const expiresMs = Math.max(1, windowEndMs - nowMs + 1000);

const script = client.loadScript(`
let current = eget @counter_key

if not found then
  eset @counter_key 1 ex to_int(@expires_ms)
  return 1
end

let count = to_int(current)

if count >= to_int(@limit) then
  return 0
end

eset @counter_key count + 1 ex to_int(@expires_ms)
return 1
`);

const result = await script.run({
  parameters: [
    { key: "@counter_key", value: `rate-limit/login/203.0.113.10/${windowStartMs}` },
    { key: "@limit", value: "10" },
    { key: "@expires_ms", value: String(expiresMs) }
  ]
});

const firstValue = result.values[0]?.value;
const allowed = firstValue ? new TextDecoder().decode(firstValue) === "1" : false;
```

</TabItem>
</Tabs>

## Sliding Expiration Counter

For a simpler throttle, keep one counter per subject and refresh the expiration on every accepted request. Here `@ttl_ms` is intentionally the full TTL on every accepted request.

```kahuna
let current = eget @counter_key

if not found then
  eset @counter_key 1 ex to_int(@ttl_ms)
  return 1
end

let count = to_int(current)

if count >= to_int(@limit) then
  return 0
end

eset @counter_key count + 1 ex to_int(@ttl_ms)
return 1
```

This is stricter than a fixed window when a caller sends requests continuously because the key keeps extending while the caller remains active.

## Operational Notes

- Use ephemeral durability for short-lived counters.
- Keep the script small. Rate limiting sits on a hot path.
- Use a bucketed key format if you need to inspect counters with `eget by bucket`.
- Use persistent durability only when the limit must survive Kahuna node restarts and leader changes.
- For very high-cardinality traffic, choose a TTL that is short enough to avoid unbounded memory growth.
