import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Service Discovery

Clients need to know which instances of a service are running right now. In this recipe, each instance registers itself under a key that expires unless the instance keeps refreshing it, like a Redis key with a TTL, so crashed instances disappear on their own. Clients and workers then discover healthy endpoints with one read, without running a separate registry.

Use a [bucket](/docs/glossary/#bucket) per service:

```text
services/{service-name}/{instance-id}
```

Examples:

```text
services/payments/node-a
services/payments/node-b
services/search/node-c
```

## Register an Instance

Use an expiration so the instance disappears if the process dies or stops refreshing its heartbeat.

```kahuna
set `services/payments/node-a` '{"host":"10.0.1.15","port":8080,"version":"1.2.3","zone":"us-east-1a"}' ex 30000 norev
```

[`NOREV`](/docs/scripts/commands/set/#norev) keeps only the current registration. Leave it off if you need [historical membership](#audit-historical-membership) reads.

From a client:

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
await client.SetKeyValue(
    "services/payments/node-a",
    """{"host":"10.0.1.15","port":8080,"version":"1.2.3","zone":"us-east-1a"}""",
    expiryTime: 30000,
    flags: KeyValueFlags.SetNoRevision,
    durability: KeyValueDurability.Persistent
);
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
await client.setNoRevision(
  "services/payments/node-a",
  '{"host":"10.0.1.15","port":8080,"version":"1.2.3","zone":"us-east-1a"}',
  {
    expiry: 30_000,
    durability: "persistent"
  }
);
```

</TabItem>
</Tabs>

## Refresh the Heartbeat

Refresh the key periodically before the expiration passes:

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
await client.ExtendKeyValue(
    "services/payments/node-a",
    TimeSpan.FromSeconds(30),
    KeyValueDurability.Persistent
);
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
await client.extend("services/payments/node-a", 30_000, {
  durability: "persistent"
});
```

</TabItem>
</Tabs>

If instance metadata can change on heartbeat, write the full value again with the same expiration:

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
await client.SetKeyValue(
    "services/payments/node-a",
    currentMetadataJson,
    expiryTime: 30000,
    flags: KeyValueFlags.SetNoRevision,
    durability: KeyValueDurability.Persistent
);
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
await client.setNoRevision("services/payments/node-a", currentMetadataJson, {
  expiry: 30_000,
  durability: "persistent"
});
```

</TabItem>
</Tabs>

## Discover Instances

Read all instances in the service bucket:

```kahuna
get by bucket `services/payments`
```

From a client:

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
List<KahunaKeyValue> instances = await client.GetByBucket(
    "services/payments",
    KeyValueDurability.Persistent
);

foreach (KahunaKeyValue instance in instances)
    Console.WriteLine($"{instance.Key}: {instance.ValueAsString()}");
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const instances = await client.getByBucket("services/payments", {
  durability: "persistent"
});

for (const instance of instances) {
  console.log(`${instance.key}: ${instance.valueAsString()}`);
}
```

</TabItem>
</Tabs>

## Audit Historical Membership

If you need to inspect which instances were visible at a previous point in time, use an `AS OF` read:

```kahuna
get by bucket `services/payments` as of 1718392012345
```

Or use a client snapshot parameter:

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
List<KahunaKeyValue> previous = await client.GetByBucket(
    "services/payments",
    KeyValueDurability.Persistent,
    snapshotMs: 1718392012345
);
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const previous = await client.getByBucket("services/payments", {
  durability: "persistent",
  snapshotMs: 1718392012345
});
```

</TabItem>
</Tabs>

Do not use [`NOREV`](/docs/scripts/commands/set/#norev) for registrations when historical membership is required. No-revision writes keep only the latest value and skip the archived revision records needed by historical reads.

## Choosing Durability

Use **persistent** durability when discovery state must survive node restarts and remain available during failover.

Each persistent registration and each persistent heartbeat, whether `set` or `extend`, is a [Raft](/docs/glossary/#raft)-replicated write. With many instances and short heartbeat intervals, that write load adds up.

Use **ephemeral** durability when registrations are high-volume, short-lived, and safe to rebuild from running services. Ephemeral heartbeats stay in the partition leader's memory and are not replicated, so they are cheaper. In exchange, a Kahuna node restart, a leader change, or [memory eviction](/docs/architecture/keys-eviction/) drops every registration on that partition, and instances disappear from discovery until they write their registration again. Refresh ephemeral registrations with a full `eset`, not only an extend, so a dropped key comes back on the next heartbeat. Ephemeral keys also cannot be [watched](/docs/recipes/watch-key-changes/). See [Durability Levels](/docs/architecture/durability-levels/).

```kahuna
eset `services/payments/node-a` '{"host":"10.0.1.15","port":8080}' ex 30000
eget by bucket `services/payments`
```

## Operational Notes

- Set the expiration to several heartbeat intervals, not exactly one interval.
- Use no-revision writes for high-churn persistent registrations when only the current membership matters.
- Store enough metadata for clients to make routing decisions without another lookup.
- Keep service membership under a shared bucket so reads are consistent and partition-local.
- For large ordered registries, use [key-range sharding](/docs/distributed-keyvalue-store/key-range-sharding/) instead of treating one bucket as permanently single-partition.
