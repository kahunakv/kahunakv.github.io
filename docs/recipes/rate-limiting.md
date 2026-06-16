# Rate Limiting

Rate limiting protects shared resources by rejecting or delaying work once a caller crosses an allowed request budget. Kahuna is useful here because the counter update can run atomically near the data instead of requiring several client round-trips.

This recipe uses an **ephemeral** key because rate-limit counters are temporary state. The key expires automatically when the window ends.

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

The script below creates the counter if it does not exist, increments it if it does, and rejects the request once the limit has been reached. Pass `@expires_ms` as the remaining time in the current window, optionally with a small grace period. Do not pass the full window length on every request, because that turns the counter into a sliding-expiration counter.

```kahuna
let current = eget @counter_key

if not current then
  eset @counter_key 1 ex @expires_ms
  return 1
end

let count = to_int(current)

if count >= @limit then
  return 0
end

eset @counter_key count + 1 ex @expires_ms
return 1
```

Run it from the .NET client with parameters:

```csharp
long nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
long windowMs = 60_000;
long windowStartMs = nowMs - (nowMs % windowMs);
long windowEndMs = windowStartMs + windowMs;
long expiresMs = Math.Max(1, windowEndMs - nowMs + 1_000);

KahunaKeyValueTransactionResult result = await client.ExecuteKeyValueTransactionScript(
    """
    let current = eget @counter_key

    if not current then
      eset @counter_key 1 ex @expires_ms
      return 1
    end

    let count = to_int(current)

    if count >= @limit then
      return 0
    end

    eset @counter_key count + 1 ex @expires_ms
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

## Sliding Expiration Counter

For a simpler throttle, keep one counter per subject and refresh the expiration on every accepted request. Here `@ttl_ms` is intentionally the full TTL on every accepted request.

```kahuna
let current = eget @counter_key

if not current then
  eset @counter_key 1 ex @ttl_ms
  return 1
end

let count = to_int(current)

if count >= @limit then
  return 0
end

eset @counter_key count + 1 ex @ttl_ms
return 1
```

This is stricter than a fixed window when a caller sends requests continuously because the key keeps extending while the caller remains active.

## Operational Notes

- Use ephemeral durability for short-lived counters.
- Keep the script small. Rate limiting sits on a hot path.
- Use a bucketed key format if you need to inspect counters with `eget by bucket`.
- Use persistent durability only when the limit must survive process restarts.
- For very high-cardinality traffic, choose a TTL that is short enough to avoid unbounded memory growth.
