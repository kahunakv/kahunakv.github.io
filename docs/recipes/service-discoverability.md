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
set `services/payments/node-a` '{"host":"10.0.1.15","port":8080,"version":"1.2.3","zone":"us-east-1a"}' ex 30000
```

From the .NET client:

```csharp
await client.SetKeyValue(
    "services/payments/node-a",
    """{"host":"10.0.1.15","port":8080,"version":"1.2.3","zone":"us-east-1a"}""",
    expiryTime: 30000,
    durability: KeyValueDurability.Persistent
);
```

## Refresh the Heartbeat

Refresh the key periodically before the expiration passes:

```csharp
await client.ExtendKeyValue(
    "services/payments/node-a",
    TimeSpan.FromSeconds(30),
    KeyValueDurability.Persistent
);
```

If instance metadata can change on heartbeat, write the full value again with the same expiration:

```csharp
await client.SetKeyValue(
    "services/payments/node-a",
    currentMetadataJson,
    expiryTime: 30000,
    durability: KeyValueDurability.Persistent
);
```

## Discover Instances

Read all instances in the service bucket:

```kahuna
get by bucket `services/payments`
```

From the .NET client:

```csharp
List<KahunaKeyValue> instances = await client.GetByBucket(
    "services/payments",
    KeyValueDurability.Persistent
);

foreach (KahunaKeyValue instance in instances)
    Console.WriteLine($"{instance.Key}: {instance.ValueAsString()}");
```

## Audit Historical Membership

If you need to inspect which instances were visible at a previous point in time, use an `AS OF` read:

```kahuna
get by bucket `services/payments` as of 1718392012345
```

Or use the .NET client snapshot parameter:

```csharp
List<KahunaKeyValue> previous = await client.GetByBucket(
    "services/payments",
    KeyValueDurability.Persistent,
    snapshotMs: 1718392012345
);
```

## Choosing Durability

Use **persistent** durability when discovery state must survive node restarts and remain available during failover.

Use **ephemeral** durability when registrations are high-volume, short-lived, and safe to rebuild from running services.

```kahuna
eset `services/payments/node-a` '{"host":"10.0.1.15","port":8080}' ex 30000
eget by bucket `services/payments`
```

## Operational Notes

- Set the expiration to several heartbeat intervals, not exactly one interval.
- Store enough metadata for clients to make routing decisions without another lookup.
- Keep service membership under a shared bucket so reads are consistent and partition-local.
- For large ordered registries, use key-range sharding instead of treating one bucket as permanently single-partition.
