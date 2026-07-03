# Snapshot Holds

Snapshot holds let a client keep historical key/value versions readable at a chosen timestamp while the cluster continues accepting writes.

Use them for long-lived historical views such as database branches, audit sessions, or tools that need to keep reading "as of timestamp T" for longer than normal revision cleanup might retain that history.

## Why Holds Exist

Kahuna supports historical reads with `AS OF <timestamp>` and the .NET `snapshotMs` parameter. Those reads return the newest revision whose commit timestamp is at or before the requested time.

Without a hold, old revisions are still subject to memory trimming and persistent revision retention. A snapshot hold pins the required history so cleanup does not remove the revision needed by the held timestamp.

## How It Works

A hold has:

- a `holderId`, chosen by the client
- a snapshot timestamp to protect
- a lease duration in milliseconds
- a server-generated `holdId`

The effective snapshot floor is the lowest timestamp among all live holds. While the floor is active, Kahuna preserves the revision at or before that floor, and every newer revision, even if persistent revision retention would otherwise prune it.

Holds are replicated cluster state. You can contact any node; Kahuna routes acquire, renew, and release operations to the system-partition leader.

## .NET Client

Acquire a hold before starting a long-lived historical view:

```csharp
using Kahuna.Client;
using Kahuna.Shared.KeyValue;
using Kommander.Time;

var client = new KahunaClient("https://node1:2071");

long branchTimestampMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
HLCTimestamp timestamp = new(0, branchTimestampMs, uint.MaxValue);

(KeyValueResponseType type, string holdId, HLCTimestamp leaseExpiry) =
    await client.AcquireSnapshotHold(
        holderId: "branch/customer-analytics",
        timestamp,
        leaseMs: 300_000
    );

if (type != KeyValueResponseType.Set)
    throw new InvalidOperationException($"Could not acquire snapshot hold: {type}");
```

Use the same timestamp for historical reads:

```csharp
KahunaKeyValue value = await client.GetKeyValue(
    "config/prod/search/enable-new-ranking",
    KeyValueDurability.Persistent,
    snapshotMs: branchTimestampMs
);

List<KahunaKeyValue> services = await client.GetByBucket(
    "services/payments",
    KeyValueDurability.Persistent,
    snapshotMs: branchTimestampMs
);
```

Renew the hold before the lease expires:

```csharp
(KeyValueResponseType renewType, HLCTimestamp newLeaseExpiry) =
    await client.RenewSnapshotHold(holdId, leaseMs: 300_000);
```

Release the hold when the historical view is no longer needed:

```csharp
KeyValueResponseType releaseType = await client.ReleaseSnapshotHold(holdId);
```

Inspect the current floor:

```csharp
(HLCTimestamp effectiveFloor, int liveHolds) =
    await client.GetSnapshotFloor();
```

`AcquireSnapshotHold(holderId, timestamp, leaseMs)` is idempotent for the same `(holderId, timestamp)` pair. Calling it again returns the same hold id and renews the lease.

## REST Endpoints

Kahuna also exposes the hold API over REST:

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/kv/snapshot-hold/acquire` | Acquire or renew a hold by `(holderId, timestamp)`. |
| `POST /v1/kv/snapshot-hold/renew` | Renew an existing hold by `holdId`. |
| `POST /v1/kv/snapshot-hold/release` | Release an existing hold by `holdId`. |
| `GET /v1/kv/snapshot-floor` | Return the effective floor and live hold count. |

`leaseMs` must be greater than zero. Invalid or expired holds return a key/value response type instead of pinning history.

## Operational Notes

- Renew well before the lease expires. If the holder crashes or stops renewing, the hold expires and no longer protects history.
- Choose lease durations that are coarse enough to avoid making renewals a hot path.
- Snapshot holds protect persistent historical revisions. Memory-only keys that have no durable history can still lose deep history outside the in-memory revision window.
- Holds protect history from cleanup; they do not freeze writes or make the rest of the cluster read-only.
- `SET ... NOREV` writes intentionally skip archived historical revisions, so a hold cannot make those skipped revisions readable later.

## Metrics

Snapshot holds publish metrics under the `Kahuna` meter:

| Metric | Meaning |
|--------|---------|
| `kahuna.snapshot_floor.live_holds` | Number of live, non-expired holds. |
| `kahuna.snapshot_floor.effective_floor_ms` | Physical millisecond component of the effective floor, or `0` when no hold is live. |
| `kahuna.snapshot_floor.missing_protected_version_total` | Fault counter that should remain `0`; it increments if cleanup ever tries to remove a floor-protected revision. |

Alert if `kahuna.snapshot_floor.missing_protected_version_total` becomes non-zero. Use live hold count and effective floor age to understand how much history clients are pinning.
