# TypeScript Client

The TypeScript client (`kahuna-client`) gives Node.js applications the same building blocks as the [.NET client](/docs/dotnet-client/), so a TypeScript service can share locks, keys, and counters with services written in C#. It covers [distributed locks](/docs/distributed-locks/), the [key/value store](/docs/distributed-keyvalue-store/) with watches, batches, and range scans, [Kahuna Script](/docs/scripts/) and interactive [transactions](/docs/distributed-keyvalue-store/transactions/), and the [distributed sequencer](/docs/distributed-sequencer/). It also handles [leader-aware routing](/docs/client-routing/), snapshot holds, backups and restore, and cluster and range administration. It is an ESM package.

## Installation

```bash
npm install kahuna-client
```

Use Node.js `20.11` or later. The package is ESM-only.

## Connect

```ts
import { KahunaClient } from "kahuna-client";

await using client = new KahunaClient({
  endpoints: ["https://127.0.0.1:8082"],
  allowInsecureCertificateValidation: true
});
```

`await using` closes the client's transport when the block exits. If your runtime does not support explicit resource management, call `await client.close()` yourself.

For a cluster, pass multiple endpoints:

```ts
const client = new KahunaClient({
  endpoints: [
    "https://node1:8082",
    "https://node2:8084",
    "https://node3:8086"
  ]
});
```

## Transport

The TypeScript client supports gRPC and REST:

```ts
new KahunaClient({ endpoints, transport: "grpc" });
new KahunaClient({ endpoints, transport: "rest" });
```

gRPC is the default and has lower per-operation overhead. REST is useful when HTTP/2 is not available or when a deployment is easier to proxy through HTTP infrastructure. The package ships Kahuna's `.proto` files and loads them at runtime, so gRPC does not require a code-generation step.

## Options

| Option | Default | Meaning |
|--------|---------|---------|
| `endpoints` | required | One node URL or several node URLs. |
| `transport` | `"grpc"` | `"grpc"`, `"rest"`, or a custom transport. |
| `routing` | `"auto"` | `"auto"`, `"roundRobin"`, `"learned"`, or `"metadata"`. |
| `routingEndpointMap` | none | Maps server-advertised URLs to URLs this client can dial. |
| `allowUnlistedRoutingEndpoints` | `false` | Allows the client to dial advertised endpoints not listed or mapped in options. |
| `routeCacheCapacity` | `4096` | Learned route entries retained in memory. |
| `routeHintLifetimeMs` | `60000` | Maximum age of a learned route hint. |
| `routingEndpointCooldownMs` | `5000` | Time a failed endpoint is skipped. |
| `routingMetadataLifetimeMs` | `60000` | Metadata map lifetime in metadata routing mode. |
| `upgradeUrls` | `false` | Keeps a lock handle on the node that served its acquisition when possible. |
| `defaultOperationTimeoutMs` | `30000` | gRPC transport only. Deadline for calls without an explicit `AbortSignal`; `0` means no deadline. REST calls without a signal wait until the server answers. |
| `allowInsecureCertificateValidation` | `false` | Skips TLS certificate validation. Use only for local development. |
| `trustedServerCertificateThumbprints` | `[]` | SHA-256 certificate pins in hexadecimal. |
| `useHttp2` | `false` | REST transport only. |
| `bearerToken` | `"xxx"` | REST transport only. Sent as `Authorization: Bearer <token>` on every REST request. The default is a placeholder, the same value the .NET REST client sends. |

## Key/Value

```ts
await client.set("config/prod/search/enabled", "true", {
  expiry: 60_000,
  durability: "persistent"
});

const flag = await client.get("config/prod/search/enabled");
if (flag.success) {
  console.log(flag.valueAsString(), flag.revision);
}

await client.set("config/prod/search/enabled", "true", {
  mode: "ifNotExists"
});

await client.compareRevisionAndSet(
  "config/prod/search/enabled",
  "false",
  flag.revision
);

await client.delete("config/prod/search/enabled");
```

Use `setNoRevision(...)` for cache-style keys where old versions are not needed:

```ts
await client.setNoRevision("cache/product/42", JSON.stringify(product), {
  expiry: 30_000
});
```

The current [revision](/docs/glossary/#revision) still advances, but Kahuna skips the archived historical revision record for that write.

## Watch Key Changes

Use a watch to refresh local state when persistent keys change. It can cover one key, a prefix, or a range. Open it before reading the current value so later changes are queued while that read runs:

```ts
import { watchPrefix, isTerminalWatchFrame } from "kahuna-client";

await using watch = await client.watchKeyValues({
  scope: watchPrefix("config/prod/search/"),
  keysOnly: true
});

for await (const frame of watch) {
  if (frame.type === "event") {
    console.log(`Refresh ${frame.event!.key} (${frame.event!.kind})`);
  } else if (isTerminalWatchFrame(frame)) {
    console.log(`Watch ended: ${frame.type}`);
  }
}
```

`keysOnly: true` omits value bytes. The watch is an async iterable; `await using` closes its server streams, or you can call `await watch.close()` yourself. A terminal frame can mean missed changes. Reopen the watch and refresh its covered state. For a complete change feed, `client.watchKeyValues(request, { autoResume: true })` can replay from progress watermarks when the cluster enables the commit admission window and retains the needed log. See [Watch Persistent Key Changes](/docs/distributed-keyvalue-store/watches/) for its delivery contract and the [watch recipe](/docs/recipes/watch-key-changes/) for a refresh loop.

## Batch Operations

```ts
await client.setMany([
  { key: "a", value: "1" },
  { key: "b", value: "2" }
]);

const rows = await client.getMany([{ key: "a" }, { key: "b" }]);
const byKey = new Map(rows.map((row) => [row.key, row]));

console.log(byKey.get("a")?.valueAsString());
```

Batch results can return in the order the [partitions](/docs/glossary/#partition) respond. Match rows by `key`, not by array position.

A batch is not atomic. Each item succeeds or fails on its own, so check `success` on every row. Use a [transaction](#transactions) when all items must commit or roll back together.

## Scans and Historical Reads

```ts
const services = await client.getByBucket("services/payments");
const allSearchConfig = await client.scanAllByPrefix("config/prod/search");

const page = await client.getByRange(
  {
    prefix: "users",
    startKey: "users/000100",
    endKey: "users/000200",
    endInclusive: false
  },
  { limit: 100 }
);

for await (const row of client.scanByRange({ prefix: "users" }, { limit: 500 })) {
  console.log(row.key, row.valueAsString());
}
```

`limit` is the page size, not a cap on the total. It defaults to `100`. `getByRange` returns one page; `scanByRange` walks the whole range and fetches `limit` rows per request.

Pass `snapshotMs` to read as of a historical wall-clock millisecond:

```ts
const latest = await client.get("config/prod/search/enabled");

const historical = await client.get("config/prod/search/enabled", {
  snapshotMs: latest.lastModified
});
```

## Locks

```ts
import { isLockCode, type KahunaLock } from "kahuna-client";

await using lock = await client.acquireLock("jobs/daily-report", {
  expiry: 30_000,
  wait: 5_000,
  retry: 250
});

if (!lock.acquired) {
  throw new Error("job is already running");
}

console.log(lock.fencingToken);

async function stillOwned(lock: KahunaLock): Promise<boolean> {
  try {
    const outcome = await lock.extend(30_000);
    return outcome.extended; // true; the fencing token is unchanged
  } catch (error) {
    if (isLockCode(error, "invalidOwner") || isLockCode(error, "lockDoesNotExist")) {
      return false; // the lease expired; another worker may hold the lock
    }
    throw error;
  }
}

if (!(await stillOwned(lock))) {
  throw new Error("lost the lock, stopping the job");
}
```

`lock.extend()` resolves to `{ extended: true, fencingToken }` when the lease was extended; the token does not change. When this handle no longer owns the lock, it throws a `KahunaError` with a lock code such as `invalidOwner` or `lockDoesNotExist`. Treat that as losing the lock. `lock.info()` (or `client.getLockInfo(resource)`) reads the current owner, expiry, and fencing token.

Disposing an acquired `KahunaLock` releases it. If your runtime does not support `await using`, call `await lock.release()`.

## Transactions

Run a script on the server:

```ts
const script = client.loadScript(`
begin (locking="optimistic")
  let balance = get @account
  if to_int(balance) >= to_int(@amount) then
    set @account to_int(balance) - to_int(@amount)
  end
  commit
end
`);

const result = await script.run({
  parameters: [
    { key: "@account", value: "accounts/17" },
    { key: "@amount", value: "25" }
  ],
  priority: "high"
});
```

Use an interactive transaction when the logic belongs in application code:

```ts
await client.withTransaction(
  {
    locking: "optimistic",
    readValidation: "trackAndValidate",
    decisionDurability: "durable",
    timeout: 10_000
  },
  async (session) => {
    const alice = await session.get("accounts/alice");
    const bob = await session.get("accounts/bob");

    if (alice.valueAsNumber() >= 50) {
      await session.set("accounts/alice", String(alice.valueAsNumber() - 50));
      await session.set("accounts/bob", String(bob.valueAsNumber() + 50));
    }

    await session.commit();
  }
);
```

`withTransaction(...)` starts a fresh transaction when the callback throws a `KahunaError` with `aborted`, `mustRetry`, or `alreadyLocked`. It makes up to 10 attempts with a jittered backoff capped at 500 ms, then throws `aborted`. Any other error is raised at once. Because `mustRetry` can mean the commit outcome is unknown, the operation may run more than once: use `withTransaction` only for work that is safe to repeat.

To control finalization yourself, open a session with `beginTransaction`:

```ts
import { isKeyValueCode } from "kahuna-client";

await using session = await client.beginTransaction({
  locking: "pessimistic",
  timeout: 5_000
});

const stock = await session.get("inventory/sku-42");
if (stock.valueAsNumber() > 0) {
  await session.set("inventory/sku-42", String(stock.valueAsNumber() - 1));
}

try {
  await session.commit();
} catch (error) {
  if (!isKeyValueCode(error, "mustRetry")) throw error;
  // The outcome is not known yet: retry the same commit on the same session.
  await session.commit();
}
```

`commit()` resolves to `true` when the transaction committed. With the built-in transports, a refusal throws a `KahunaError` instead of returning `false`. The client already retries a transient `mustRetry` a few times on the same session; if it still throws `mustRetry`, the transaction may have committed, and the session stays pending so you can call `commit()` again. After `aborted`, start a new transaction. Disposing a pending session rolls it back. See [Retry Outcomes](/docs/distributed-keyvalue-store/transactions/#retry-outcomes).

`commitWithTimestamp()` commits the same way and also returns `{ committed, commitTimestamp }`. Every write of the transaction and its watch events carry that timestamp, so a change-feed consumer can line up a snapshot with a watch cursor. The timestamp is zero when the commit wrote no persistent key through the durable path.

Set `origin` in the transaction options to label maintenance writes, such as `origin: "nightly-cleanup"` (at most 64 characters). Prepared intents and watch events carry the label only when the cluster runs with `--transaction-origin-tags`.

## Sequences

```ts
await client.createSequence("orders", {
  initialValue: 1000,
  increment: 1
});

const orderId = await client.nextSequenceValue("orders", {
  idempotencyKey: "create-order-1001"
});

const batch = await client.reserveSequenceRange("orders", 100, {
  idempotencyKey: "import-batch-456"
});

console.log(orderId, batch.start, batch.end);
```

## Snapshot Holds

Snapshot-hold calls take no `nodeUrl` and rotate through the configured endpoints. Holds are replicated cluster state, so any node can serve them. `renewSnapshotHold(holdId, leaseMs)` extends a hold, and `getSnapshotFloor()` reports the current floor; see [Snapshot Holds](/docs/distributed-keyvalue-store/snapshot-holds/#typescript-client).

```ts
import { snapshotAt } from "kahuna-client";

const timestamp = snapshotAt(Date.now());

const hold = await client.acquireSnapshotHold(
  "branch/customer-analytics",
  timestamp,
  300_000
);

try {
  const value = await client.get("config/prod/search/enabled", {
    snapshotMs: timestamp.physical
  });
  console.log(value.valueAsString());
} finally {
  await client.releaseSnapshotHold(hold.holdId);
}
```

## Backups and Restore

Backup and restore calls take no `nodeUrl` and rotate through the configured endpoints. A backup catalog belongs to the node that serves the call, so use a client with a single endpoint for backup and restore work:

```ts
await using admin = new KahunaClient({ endpoints: "https://node1:8082" });
```

```ts
const full = await client.takeCoordinatedBackup();
const incremental = await client.takeIncrementalBackup(full.backupId);

const backups = await client.listBackups();
const chain = await client.getBackupChain(incremental.backupId);

const preview = await client.collectBackupGarbage({ dryRun: true });

const restored = await client.restore(
  incremental.backupId,
  "/var/lib/kahuna/restored",
  { targetTimeMs: 0 }
);
```

Restore target paths are server-side paths, matching the CLI and .NET client behavior.

## Rate Limiting

The rate limiters keep their budget in Kahuna, so every replica of an application draws from one shared limit. They run the same scripts and name the same keys as the .NET limiters, so .NET and TypeScript replicas that use the same key and settings share one budget.

- Limiters: `KahunaFixedWindowRateLimiter`, `KahunaSlidingWindowRateLimiter`, `KahunaTokenBucketRateLimiter`, and `KahunaConcurrencyLimiter`. `KahunaPartitionedRateLimiter` keeps one limiter per partition key, such as a user or tenant.
- `rateLimitKeyFor(policy, partition)` names the key `rate-limit/<policy>/<partition>`, or `rate-limit/<policy>` without a partition.
- `kahuna-client/middleware` provides `kahunaRateLimit` for Express, Connect, and `node:http`, and `withKahunaRateLimit` for Fetch-style handlers that take a `Request` and return a `Response`. A refused request gets status 429 and, when known, a `Retry-After` header.

```ts
import express from "express";
import { kahunaRateLimit } from "kahuna-client/middleware";

const app = express();

// 5 login attempts per email, then 1 more every 5 minutes, across every replica.
app.post("/login", kahunaRateLimit<express.Request>({
  client,
  policy: "login_attempts",
  partitionBy: (req) => String(req.query.email ?? "unknown"),
  tokenBucket: { tokenLimit: 5, replenishmentPeriodMs: 5 * 60_000, tokensPerPeriod: 1 }
}), login);
```

Limiter state is ephemeral by default. See [Distributed Rate Limiting](/docs/distributed-rate-limiting/) for the algorithms, options, durability trade-off, and failure modes.

## Cluster and Range Administration

```ts
const membership = await client.getClusterMembership();
const placement = await client.getClusterPlacement();

await client.setReplicationFactor(0, 3);
await client.leaveCluster({ nodeUrl: "https://node3:8086" });

await client.registerKeyRange("orders");
await client.splitRange("orders", "orders/50000");
await client.mergeRanges();
```

Range registration seeds the descriptor through the leader of partition 0 (the system partition) and waits for local visibility. Other nodes update their local routing when they apply the committed range map, after a restore, and when they install a Raft [snapshot](/docs/glossary/#snapshot). An `Indeterminate` result does not mean the change rolled back: the proposal may have committed. Verify or retry instead of assuming a rollback. See [Key-Range Sharding](/docs/distributed-keyvalue-store/key-range-sharding/#how-a-key-space-becomes-range-routed).

## Errors and Cancellation

Protocol failures throw `KahunaError`:

```ts
import { KahunaError, isKeyValueCode } from "kahuna-client";

try {
  await client.set("", "value");
} catch (error) {
  if (error instanceof KahunaError) {
    console.log(error.domain, error.code);
  }

  if (isKeyValueCode(error, "admissionRefused")) {
    await backoff();
  }
}
```

Every operation accepts an `AbortSignal`:

```ts
await client.get("key", { signal: AbortSignal.timeout(2_000) });
```

JavaScript numbers are safe up to `Number.MAX_SAFE_INTEGER`. Revisions, fencing tokens, and sequence values cross the wire as 64-bit integers, so avoid sequence ranges above that JavaScript precision limit.

## Other APIs

The client has more methods than this page shows. Each is documented on its feature page:

- Locks: `client.getLockInfo`, `client.extendLock`, `client.releaseLock`, and `lock.info()`. See [Distributed Locks](/docs/distributed-locks/#api).
- Key/value: `compareValueAndSet` ([Compare Value and Set](/docs/distributed-keyvalue-store/api/#compare-value-and-set)), `extend` ([Extend](/docs/distributed-keyvalue-store/api/#extend)), `getRevision` ([Revisions](/docs/distributed-keyvalue-store/revisions/#querying-previous-revisions)), `exists` ([Exists](/docs/distributed-keyvalue-store/api/#exists)), and the batch forms `deleteMany` and `existsMany`.
- Scripts: `client.executeScript(script, { parameters })` runs a script without loading it first. See [Kahuna Script](/docs/scripts/).
- Sequences: `updateSequence`, `getSequence`, and `deleteSequence`. See [Sequencer Clients](/docs/distributed-sequencer/clients/#typescript-methods).
- Snapshot and history holds: `renewSnapshotHold`, `getSnapshotFloor`, `acquireHistoryHolds`, `renewHistoryHolds`, `releaseHistoryHolds`, and `listHistoryHolds`. See [Snapshot Holds](/docs/distributed-keyvalue-store/snapshot-holds/) and [Resume a Complete Change Feed](/docs/distributed-keyvalue-store/watches/#resume-a-complete-change-feed).
- Ranges: `getRanges` and `removeKeyRange`. See [Inspect and Administer Ranges](/docs/distributed-keyvalue-store/key-range-sharding/#inspect-and-administer-ranges).
- Routing: `client.routing` returns the routing mode in force, with `"auto"` resolved. See [Client Leader-Aware Routing](/docs/client-routing/).
