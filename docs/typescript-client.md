# Client for TypeScript and Node.js

Kahuna provides an ESM TypeScript client for Node.js applications. It supports distributed locks, key/value operations, batch operations, range scans, transaction scripts, interactive transactions, distributed sequences, routing, snapshot holds, backups, restore, and cluster/range administration.

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
| `defaultOperationTimeoutMs` | `30000` | Deadline for calls without an explicit `AbortSignal`. |
| `allowInsecureCertificateValidation` | `false` | Skips TLS certificate validation. Use only for local development. |
| `trustedServerCertificateThumbprints` | `[]` | SHA-256 certificate pins in hexadecimal. |
| `useHttp2` | `false` | REST transport only. |
| `bearerToken` | `"xxx"` | REST transport only. |

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

The current revision still advances, but Kahuna skips the archived historical revision record for that write.

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

Batch results can return in partition-response order. Match rows by `key`, not by array position.

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

Pass `snapshotMs` to read as of a historical wall-clock millisecond:

```ts
const latest = await client.get("config/prod/search/enabled");

const historical = await client.get("config/prod/search/enabled", {
  snapshotMs: latest.lastModified
});
```

## Locks

```ts
await using lock = await client.acquireLock("jobs/daily-report", {
  expiry: 30_000,
  wait: 5_000,
  retry: 250
});

if (!lock.acquired) {
  throw new Error("job is already running");
}

await lock.extend(30_000);
console.log(lock.fencingToken);
```

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

`withTransaction(...)` starts a fresh transaction for retryable conflicts. If you manage a session manually, disposing a pending session rolls it back.

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

Range registration is node-local for the routing half, so apply it to every node that should serve that key space.

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
