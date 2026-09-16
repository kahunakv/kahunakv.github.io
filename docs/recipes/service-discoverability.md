import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Service Discovery

Kahuna can store service instance metadata so clients and workers can discover healthy endpoints without running a separate registry.

Use a bucket per service:

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

Do not use `NOREV` for registrations when historical membership is required. No-revision writes keep only the latest value and skip the archived revision records needed by historical reads.

## Choosing Durability

Use **persistent** durability when discovery state must survive node restarts and remain available during failover.

Use **ephemeral** durability when registrations are high-volume, short-lived, and safe to rebuild from running services.

```kahuna
eset `services/payments/node-a` '{"host":"10.0.1.15","port":8080}' ex 30000
eget by bucket `services/payments`
```

## Operational Notes

- Set the expiration to several heartbeat intervals, not exactly one interval.
- Use no-revision writes for high-churn persistent registrations when only the current membership matters.
- Store enough metadata for clients to make routing decisions without another lookup.
- Keep service membership under a shared bucket so reads are consistent and partition-local.
- For large ordered registries, use key-range sharding instead of treating one bucket as permanently single-partition.
