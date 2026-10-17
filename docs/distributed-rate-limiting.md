# Distributed Rate Limiting

A rate limiter rejects or delays work once a caller exceeds an allowed budget, such as 100 requests per minute per user or 20 outbound emails per 10 seconds. It protects your services, downstream APIs, and paid quotas from overload and abuse.

.NET already includes rate limiters in `System.Threading.RateLimiting`, but they count in the memory of one process. When your application runs as several replicas behind a load balancer, each replica enforces its own copy of the limit:

```text
Limit: 100 requests/minute per user

In-memory limiter, 5 replicas:   each replica allows 100  ->  the user gets up to 500
Kahuna limiter, 5 replicas:      all replicas share 100   ->  the user gets 100
```

The effective limit also changes every time the application scales up or down. Kahuna's limiters keep the budget in one shared key, so every replica draws from the same counter and the limit holds regardless of the replica count.

**Use them when** a limit must hold across all instances of an application: per-user or per-tenant API quotas, calls to a third-party API with a hard quota, or a cap on concurrent jobs across a worker fleet. **Keep the in-memory limiters when** a per-instance limit is acceptable, because each Kahuna admission decision costs a network round trip to the cluster.

The limiters implement the standard `RateLimiter` API, so they work with the ASP.NET Core rate-limiting middleware and with code that already uses that API. For TypeScript or custom algorithms built with scripts, see the [Rate Limiting recipe](/docs/recipes/rate-limiting/).

The .NET client provides four implementations of `System.Threading.RateLimiting.RateLimiter` backed by Kahuna. Application replicas using the same Kahuna key share budget state. Each admission decision reads and updates that state in one script transaction, avoiding a separate client-side read/check/write race.

Use the same limiter type, durability, and settings on every replica sharing a key. Settings are copied when a limiter is constructed; changing the options object afterward has no effect. Reserve separate keys for unrelated policies. State is interpreted using each caller's configuration, so changing limits or sharing a key between algorithms is not a coordinated migration.

## Packages

The APIs below target .NET 10 and were added in Kahuna 1.10.11:

```bash
dotnet add package Kahuna.Client
# For ASP.NET Core middleware integration:
dotnet add package Kahuna.Client.AspNetCore
```

`Kahuna.Client.RateLimiting` contains the limiters and partition helpers. The separate ASP.NET Core package supplies extensions in `Microsoft.AspNetCore.RateLimiting`; worker applications do not need the ASP.NET Core shared framework.

## Choosing an Algorithm

| Class | State and admission rule |
|---|---|
| `KahunaFixedWindowRateLimiter` | One counter with windows aligned to `hlc()`'s physical milliseconds. Each window admits up to `PermitLimit` permits. Requests on opposite sides of a boundary can spend two windows' budgets close together. |
| `KahunaSlidingWindowRateLimiter` | One value containing segment counters. Permits are reclaimed when their segment leaves the window. This is a segmented approximation, not an exact rolling timestamp log. |
| `KahunaTokenBucketRateLimiter` | One value containing tokens and last replenishment time. A missing bucket starts at `TokenLimit`; requests add `TokensPerPeriod` for each elapsed whole `ReplenishmentPeriod`, capped at the limit. No refill timer is required. |
| `KahunaConcurrencyLimiter` | One expiring key per acquired lease directly under `<Key>/`. Admission sums live lease permits and creates a new lease if capacity remains. |

Window and token-bucket scripts use `hlc()` on the coordinating node, rather than the application's wall clock. This is the physical component of the hybrid logical clock, not a monotonic elapsed-time timer; clock advances can move window/refill boundaries. Fixed-window and replenishment durations are truncated to whole milliseconds. Sliding-window segment length is `floor(Window.TotalMilliseconds / SegmentsPerWindow)`, so its effective window can be shorter than configured. A segment's permits may return before each individual request is a full window old, by up to one segment.

## Direct Client Use

```csharp
using Kahuna.Client;
using Kahuna.Client.RateLimiting;
using System.Threading.RateLimiting;

KahunaClient kahuna = new(["https://kahuna1:8082", "https://kahuna2:8084"]);

await using KahunaTokenBucketRateLimiter limiter = new(kahuna, new()
{
    Key = "rate-limit/outbound-email",
    TokenLimit = 20,
    TokensPerPeriod = 5,
    ReplenishmentPeriod = TimeSpan.FromSeconds(10)
});

using RateLimitLease lease = await limiter.AcquireAsync(1, cancellationToken);
if (!lease.IsAcquired)
{
    if (lease.TryGetMetadata(MetadataName.RetryAfter, out TimeSpan retryAfter))
        Console.WriteLine($"Retry after {retryAfter}");
    return;
}

await SendEmailAsync(cancellationToken);
```

Use `AcquireAsync`: synchronous `AttemptAcquire` always refuses because it cannot perform the required network I/O. Permit counts may range from zero to the configured limit; an oversized request throws. An asynchronous zero-permit request checks whether at least one permit is available without consuming it. It does not reserve capacity for a later call.

Disposing a window or token-bucket lease does not refund consumed permits. A concurrency lease starts background release when disposed; keep it alive for the duration of the work.

## ASP.NET Core Policies

```csharp
using Kahuna.Client;
using Kahuna.Client.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using System.Globalization;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton(new KahunaClient(
    ["https://kahuna1:8082", "https://kahuna2:8084"]));

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (context, _) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out TimeSpan retryAfter))
            context.HttpContext.Response.Headers.RetryAfter =
                Math.Ceiling(retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
        return ValueTask.CompletedTask;
    };

    options.AddKahunaFixedWindowLimiter("api", o =>
    {
        o.PermitLimit = 100;
        o.Window = TimeSpan.FromMinutes(1);
    });

    options.AddKahunaTokenBucketLimiter("per-client",
        context => context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        o =>
        {
            o.TokenLimit = 20;
            o.TokensPerPeriod = 5;
            o.ReplenishmentPeriod = TimeSpan.FromSeconds(10);
        });
});

var app = builder.Build();
app.UseRateLimiter();
app.MapGet("/status", () => "ok").RequireRateLimiting("api");
app.MapPost("/work", () => Results.Accepted()).RequireRateLimiting("per-client");
app.Run();
```

The four extensions are `AddKahunaFixedWindowLimiter`, `AddKahunaSlidingWindowLimiter`, `AddKahunaTokenBucketLimiter`, and `AddKahunaConcurrencyLimiter`. Each accepts a policy name and configuration callback, optionally a `Func<HttpContext, string>` partition selector, and optionally an explicit client as the last argument. Otherwise the client comes from request services. The middleware follows its initial synchronous refusal with asynchronous acquisition.

Without a partition selector, the default state key is `rate-limit/<policy>`. With one, it is `rate-limit/<policy>/<partition>`; an empty partition string uses the policy key. The callback receives this default in `o.Key` and can replace it. It runs once at registration to validate settings and again when each partition limiter is created. Partition strings are concatenated directly into stored keys; hash sensitive identifiers and choose names that avoid collisions.

For identity-based partition selectors, configure authentication and place its middleware before `UseRateLimiter`. Outside middleware, build partitioned limiters with `KahunaRateLimitPartition.GetFixedWindowLimiter`, `GetSlidingWindowLimiter`, `GetTokenBucketLimiter`, or `GetConcurrencyLimiter`:

```csharp
using PartitionedRateLimiter<string> tenants =
    PartitionedRateLimiter.Create<string, string>(tenant =>
        KahunaRateLimitPartition.GetFixedWindowLimiter(kahuna, tenant, key => new()
        {
            Key = KahunaRateLimitPartition.KeyFor("tenant-api", key),
            PermitLimit = 1000,
            Window = TimeSpan.FromMinutes(1)
        }));
```

Disposal of an idle partition does not delete its budget state. A later limiter using the same key resumes whatever state remains in Kahuna.

## Settings and Queueing

| Common option | Default | Meaning |
|---|---|---|
| `Key` | empty; required | Shared state key or concurrency bucket. |
| `Durability` | `Ephemeral` | Memory state; lost state resets counters or releases concurrency capacity. `Persistent` uses persistent script commands and durable transaction finalization. |
| `QueueLimit` | `0` | Maximum **permits**, not requests, waiting in this process. Zero refuses without queueing. |
| `QueueProcessingOrder` | `OldestFirst` | Local queue order. `NewestFirst` can refuse oldest waiters to make room. |
| `FailureMode` | `Throw` | Behavior when a decision cannot be obtained: propagate, admit (`Allow`), or refuse (`Deny`). |
| `MaxRetries` | `8` | Additional attempts for `Aborted` or `MustRetry`, with randomized bounded backoff. Other failures are not retried by the limiter. |

Fixed/sliding windows require a positive `PermitLimit` and window. Sliding windows additionally require `SegmentsPerWindow` between 1 and 1000 and at least one millisecond per segment. Token buckets require positive `TokenLimit`, `TokensPerPeriod`, and a replenishment period of at least one millisecond. Concurrency requires positive `PermitLimit`, `LeaseDuration` of at least 30 ms (default 30 seconds), and `QueuePollInterval` of at least 1 ms (default 50 ms).

Queues and fairness are local, even though the budget is shared. Window and bucket refusals normally carry `RetryAfter`; it is a computed wait, not a reservation or guarantee of admission. Concurrency refusals have no retry time. Queued requests retry after that metadata delay, or poll every 50 ms when none is available; concurrency uses its configured poll interval. A local concurrency release wakes the queue after its release attempt completes. Cancellation removes a waiting request. `Deny` with a queue enabled can keep a caller waiting through cluster failures; use cancellation to bound the wait.

`GetStatistics()` reports this limiter's successful/failed lease counts and local queued permit count. Available permits reflect its last observation, potentially already spent by another replica; these are not cluster-wide authoritative statistics.

## Guarantees and Failure Limits

Successful decisions use transaction conflict handling to serialize competing admissions. This does not make a request and its external work one transaction, or provide exactly-once admission across a lost response. Do not assume a transport failure means no state was consumed. See [transaction outcome handling](/docs/architecture/distributed-transactions/).

`FailureMode.Allow` grants a lease without recording a cluster permit when acquisition fails, so it deliberately stops enforcing the limit. `Deny` refuses instead; `Throw` exposes the error. Caller cancellation remains cancellation under all three modes.

Ephemeral state can disappear after restart, failover, or eviction, resetting budgets. Persistent durability preserves state through the persistent recovery path, but does not eliminate clock effects, TTL expiry, uncertain responses, or lease renewal failures. Fixed-window and token-bucket ephemeral scripts can use the [single-key fast path](/docs/scripts/single-key-fast-path/). Sliding-window scripts and concurrency bucket scans use the general transaction path.

Concurrency leases renew approximately every `LeaseDuration / 3` with a conditional write that only updates an existing key. An expired lease is not recreated. When a renewal returns `NotSet`, the limiter removes its local held-lease entry and wakes its queue; network failures alone leave renewal eligible for another round. Renewal is best-effort: if the key expires while its holder continues working, another caller can acquire the capacity. The returned lease does not signal that loss or cancel the work. This bounds live permit keys, not the number of operations still executing after pauses or connectivity loss; there is no fencing token protecting external work.

Lease disposal deletes the key in the background. A failed deletion leaves it to expire. Limiter disposal stops renewal and refuses queued waiters; it does not immediately delete outstanding leases. Async limiter disposal waits for already-pending release tasks, so dispose held leases before the limiter when prompt release matters. Do not store unrelated keys directly under a concurrency limiter's bucket: its admission script interprets every live value there as a permit count.
