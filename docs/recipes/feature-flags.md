import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Feature Flags and Configuration

Kahuna can store feature flags and runtime configuration with strong consistency, revisions, compare-and-set updates, and historical snapshot reads.

Use a predictable key layout:

```text
config/{environment}/{service}/{name}
```

Examples:

```text
config/prod/payments/max-refund-amount
config/prod/search/enable-new-ranking
```

## Read a Flag

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
KahunaKeyValue flag = await client.GetKeyValue(
    "config/prod/search/enable-new-ranking",
    KeyValueDurability.Persistent
);

bool enabled = flag.Success && flag.ValueAsString() == "true";
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const flag = await client.get("config/prod/search/enable-new-ranking", {
  durability: "persistent"
});

const enabled = flag.success && flag.valueAsString() === "true";
```

</TabItem>
</Tabs>

## Update Safely With Compare Revision

Read the current revision, then update only if nobody changed it first:

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
KahunaKeyValue current = await client.GetKeyValue(
    "config/prod/search/enable-new-ranking",
    KeyValueDurability.Persistent
);

KahunaKeyValue updated = await client.TryCompareRevisionAndSetKeyValue(
    "config/prod/search/enable-new-ranking",
    "true",
    compareRevision: current.Revision,
    durability: KeyValueDurability.Persistent
);

if (!updated.Success)
    Console.WriteLine("Flag changed before this update was applied.");
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const current = await client.get("config/prod/search/enable-new-ranking", {
  durability: "persistent"
});

const updated = await client.compareRevisionAndSet(
  "config/prod/search/enable-new-ranking",
  "true",
  current.revision,
  { durability: "persistent" }
);

if (!updated.success) {
  console.log("Flag changed before this update was applied.");
}
```

</TabItem>
</Tabs>

## Read Historical Configuration

Use `LastModified` from one read as a snapshot anchor:

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
KahunaKeyValue anchor = await client.GetKeyValue(
    "config/prod/search/enable-new-ranking",
    KeyValueDurability.Persistent
);

List<KahunaKeyValue> configAtAnchor = await client.ScanAllByPrefix(
    "config/prod/search",
    KeyValueDurability.Persistent,
    snapshotMs: anchor.LastModified
);
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const anchor = await client.get("config/prod/search/enable-new-ranking", {
  durability: "persistent"
});

const configAtAnchor = await client.scanAllByPrefix("config/prod/search", {
  durability: "persistent",
  snapshotMs: anchor.lastModified
});
```

</TabItem>
</Tabs>

This is useful during incident review when you need to know which flags and settings were visible at one point in time.

## Group Related Settings

For settings that should be read together, use one bucket:

```kahuna
get by bucket `config/prod/search`
```

From a client:

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
List<KahunaKeyValue> settings = await client.GetByBucket(
    "config/prod/search",
    KeyValueDurability.Persistent
);
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const settings = await client.getByBucket("config/prod/search", {
  durability: "persistent"
});
```

</TabItem>
</Tabs>

## Operational Notes

- Use persistent durability for production configuration.
- Use compare-revision updates in admin tools to avoid lost updates.
- Keep values compact and parseable, for example JSON for structured settings.
- Use snapshot reads during postmortems to reconstruct the exact configuration that was visible at the time.
