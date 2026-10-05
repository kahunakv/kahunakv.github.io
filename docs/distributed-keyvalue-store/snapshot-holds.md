# Snapshot Holds

Snapshot holds let a client keep historical key/value versions readable at a chosen timestamp while the cluster continues accepting writes.

Use them for long-lived historical views such as database branches, audit sessions, or tools that need to keep reading "as of timestamp T" for longer than normal revision cleanup might retain that history.

## Why Holds Exist

Kahuna supports historical reads with `AS OF <timestamp>` and the `snapshotMs` parameter in the .NET and TypeScript clients. Those reads return the newest revision whose commit timestamp is at or before the requested time.

Without a hold, old revisions are still subject to memory trimming and persistent revision retention. A snapshot hold pins the required history so cleanup does not remove the revision needed by the held timestamp.

## How It Works

A hold has:

- a `holderId`, chosen by the client
- a snapshot timestamp to protect
- a lease duration in milliseconds
- a server-generated `holdId`

`GetSnapshotFloor` reports the minimum timestamp of live, non-expired holds and their live count. Pruning uses a different protective floor: the minimum timestamp of **all registered holds**, including expired leases, until a replicated release or purge removes them. Persistent cleanup preserves the boundary revision at or before that protective floor and every newer revision.

Holds are replicated cluster state. You can contact any node; Kahuna routes acquire, renew, and release operations to the system-partition leader.

Durable holds are also recovered after restart. On startup, Kahuna gives restored holds a short grace window before treating leases that expired during downtime as purge-eligible. The default internal grace is five minutes. Renew the hold during that window to keep the protected timestamp active; otherwise the reaper can advance the snapshot floor after the grace expires.

## .NET Client

Acquire a hold before starting a long-lived historical view:

```csharp
using Kahuna.Client;
using Kahuna.Shared.KeyValue;
using Kommander.Time;

var client = new KahunaClient("https://node1:8082");

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

`GetSnapshotFloor()` only returns an authoritative floor. If the node cannot confirm the system-partition leader, the client receives a `KahunaException` with `KeyValueErrorCode == KeyValueResponseType.MustRetry` instead of a misleading zero-floor response.

`AcquireSnapshotHold(holderId, timestamp, leaseMs)` is idempotent for the same `(holderId, timestamp)` pair. Calling it again returns the same hold id and renews the lease.

## TypeScript Client

Acquire a hold before starting a long-lived historical view:

```ts
import { KahunaClient, snapshotAt } from "kahuna-client";

const client = new KahunaClient({
  endpoints: ["https://node1:8082"]
});

const branchTimestampMs = Date.now();
const timestamp = snapshotAt(branchTimestampMs);

const hold = await client.acquireSnapshotHold(
  "branch/customer-analytics",
  timestamp,
  300_000
);
```

Use the same timestamp for historical reads:

```ts
const value = await client.get("config/prod/search/enable-new-ranking", {
  durability: "persistent",
  snapshotMs: branchTimestampMs
});

const services = await client.getByBucket("services/payments", {
  durability: "persistent",
  snapshotMs: branchTimestampMs
});
```

Renew or release the hold by `holdId`:

```ts
await client.renewSnapshotHold(hold.holdId, 300_000);
await client.releaseSnapshotHold(hold.holdId);

const floor = await client.getSnapshotFloor();
console.log(floor.effectiveFloor.physical, floor.liveHolds);
```

## REST Endpoints

Kahuna also exposes the hold API over REST:

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/kv/snapshot-hold/acquire` | Acquire or renew a hold by `(holderId, timestamp)`. |
| `POST /v1/kv/snapshot-hold/renew` | Renew an existing hold by `holdId`. |
| `POST /v1/kv/snapshot-hold/release` | Release an existing hold by `holdId`. |
| `GET /v1/kv/snapshot-floor` | Return the authoritative effective floor and live hold count, or a retryable response when leadership cannot be confirmed. |

`leaseMs` must be greater than zero. Renew can revive an expired hold while it remains registered; after release or purge it returns `DoesNotExist`. Revival confirms system-partition application before proving registration.

## Operational Notes

- Renew well before the lease expires. If the holder stops renewing, the hold becomes purge-eligible. Protection ends when replicated removal commits; do not depend on a delay between expiry and purge.
- After a full-cluster restart, renew important holds promptly so they survive the startup grace window.
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
| `kahuna.snapshot_floor.prune_skipped_unconfirmed_total` | Prune cycles skipped because local system-partition catch-up could not be confirmed. |
| `kahuna.snapshot_floor.missing_protected_version_total` | Fault counter that should remain `0`; it increments if cleanup ever tries to remove a floor-protected revision. |

Alert if `kahuna.snapshot_floor.missing_protected_version_total` becomes non-zero. Use live hold count and effective floor age to understand how much history clients are pinning.

## Acquire and Prune Races

Acquire/renew/release replication uses keyed deltas; the full local snapshot and system-partition transfer still scale with registered hold count. Destructive pruning first confirms local application of partition 0; failure skips that prune cycle. A local prune-generation guard detects acquire overlapping a deletion pass and returns `MustRetry`, even if the hold was replicated. Retry the same `(holderId, timestamp)`.

This guard does not recreate history already deleted. Catch-up confirmation followed by sampling the protective floor is not a cluster-wide atomic acquire/prune barrier; a residual cross-node window remains. Holds protect retention, not an arbitrary timestamp's clock safety or cluster-wide snapshot consistency. See [historical read semantics](/docs/distributed-keyvalue-store/read-and-lock-semantics/#fixed-timestamp-reads).
