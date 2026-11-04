import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Key/Value API Reference

This page is the reference for the basic key/value operations. Each operation has CLI, .NET, and TypeScript tabs. The .NET tab includes a signature and a usage example; the CLI tab notes when no equivalent command exists. For an overview of the store, see [Distributed Key/Value Store](/docs/distributed-keyvalue-store/).

Use the .NET or TypeScript client from application code. Use the Kahuna CLI to inspect or change keys by hand. Use [Kahuna Script](/docs/scripts/) when several operations must run together on the server, as one transaction. The CLI examples are Kahuna Script commands, and each section links to the command page with the full syntax and modifiers.

Each operation takes a durability level, persistent or ephemeral; see [Durability Levels](/docs/architecture/durability-levels/).

For payload, batch, page, and transaction bounds, see [Key/Value Request Limits](/docs/distributed-keyvalue-store/request-limits/).

## Payload Values

Values are byte payloads. A `null` payload means the key exists without a value, while an empty byte array means the key exists with a zero-byte value. Kahuna preserves that difference over both REST and gRPC, including compare-value operations and transaction results.

In REST JSON, `null` stays `null` and any byte array is encoded as base64. That means a zero-byte payload is the empty base64 string `""`.

## Set

Creates or overwrites a key. Optional flags make the write depend on whether the key exists, its current value, or its current revision. Script syntax: [`set`](/docs/scripts/commands/set/) (persistent) and [`eset`](/docs/scripts/commands/eset/) (ephemeral).

<Tabs groupId="client-examples">
<TabItem value="cli" label="CLI">

Sets a key/value only if not exists:

```kahuna
set `my-config` "my-value" nx
```
```text
r3 set 11ms
```

Sets a key/value only if exists:

```kahuna
set `my-config` "my-value" xx
```
```text
r4 set 10ms
```

Sets a key/value:

```kahuna
set `my-config` "my-value"
```
```text
r5 set 13ms
```

Sets a key/value with an expiration of 10 sec:

```kahuna
set `my-config` "my-value" ex 10000
```
```text
r6 set 12ms
```

Sets a key/value using command line arguments:

```bash
kahuna-cli --set my-config --value my-value
```
```text
r3 set 11ms
```

```bash
kahuna-cli --set my-config --value my-value --expires 30000
```
```text
r4 set 10ms
```

</TabItem>
<TabItem value="dotnet" label=".NET">

```csharp
Task<KahunaKeyValue> SetKeyValue(
    string key,
    byte[]? value,
    int expiryTime = 0,
    KeyValueFlags flags = KeyValueFlags.Set,
    KeyValueDurability durability = KeyValueDurability.Persistent,
    CancellationToken cancellationToken = default
);
```

- **key:** A unique identifier for the key/value pair.
- **value:** The data object associated with the key. `null` is distinct from an empty byte array.
- **expiryTime:** The expiration time of the key in milliseconds.
- **flags:**
  - If `KeyValueFlags.SetIfExists` is specified, the value is set only if the key already exists.
  - If `KeyValueFlags.SetIfNotExists` is specified, the value is set only if the key does not exist.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Success:** `true` if the key's value was modified.
- **Revision:** The key's current revision after the operation.

**Example**

```csharp
// Create or update a key/value pair and set an expiration of 10 seconds:
var result = await client.SetKeyValue(
  "my-config",
  "some-value",
  10000,
  durability: KeyValueDurability.Persistent
);

if (result.Success)
  Console.WriteLine("Key/value updated successfully with revision {0}", result.Revision);

// Update a key/value pair without expiration
result = await client.SetKeyValue(
  "my-config",
  "some-value",
  0,
  durability: KeyValueDurability.Persistent
);

// Create a key/value pair only if it does not exist
result = await client.SetKeyValue(
  "my-config",
  "some-value",
  0,
  flags: KeyValueFlags.SetIfNotExists,
  durability: KeyValueDurability.Persistent
);

// Update a key/value pair only if it does exist
result = await client.SetKeyValue(
  "my-config",
  "some-value",
  0,
  flags: KeyValueFlags.SetIfExists,
  durability: KeyValueDurability.Persistent
);

// Create or update an ephemeral key/value pair
result = await client.SetKeyValue(
  "my-config",
  "some-value",
  10000,
  durability: KeyValueDurability.Ephemeral
);

```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const result = await client.set("my-config", "some-value", {
  expiry: 10_000,
  durability: "persistent"
});

if (result.success) {
  console.log(`Key/value updated with revision ${result.revision}`);
}

await client.set("my-config", "some-value", { mode: "ifNotExists" });
await client.set("my-config", "some-value", { mode: "ifExists" });
await client.set("my-config", "some-value", { durability: "ephemeral" });
```

</TabItem>
</Tabs>

---

## Compare Value and Set

Sets or overwrites key/value pairs but only if the current value matches a specified comparison value. For when to use compare-and-set (CAS) and worked examples, see [Compare-and-Set (CAS)](/docs/distributed-keyvalue-store/cas/).

<Tabs groupId="client-examples">
<TabItem value="cli" label="CLI">

Sets a key/value only if the current value is "current-value":

```text
kahuna-cli> set `my-config` "current-value"
r2 set 10ms

kahuna-cli> set `my-config` "my-value" cmp "current-value"
r3 set 11ms

kahuna-cli> set `my-config` "my-value" cmp "current-value"
r3 not set 12ms
```

</TabItem>
<TabItem value="dotnet" label=".NET">

```csharp
Task<KahunaKeyValue> TryCompareValueAndSetKeyValue(
    string key,
    byte[] value,
    byte[] compareValue,
    int expiryTime = 30000,
    KeyValueDurability durability = KeyValueDurability.Persistent,
    CancellationToken cancellationToken = default
);
```

- **key:** A unique identifier for the key/value pair.
- **value:** The data object associated with the key.
- **compareValue:** The value is changed only if the current value matches the provided one.
- **expiryTime:** The expiration time of the key in milliseconds.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Success:** `true` if the comparison matched and the key was modified.
- **Revision:** The key's current revision after the operation.

The string overload used below defaults to no expiry (`0`); the byte-array overload above defaults to 30 seconds.

**Example**

```csharp
var result = await client.TryCompareValueAndSetKeyValue(
    "my-config", "my-value", "current-value");

Console.WriteLine(result.Success);
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const result = await client.compareValueAndSet(
  "my-config",
  "my-value",
  "current-value"
);

if (!result.success) {
  console.log("Current value did not match");
}
```

</TabItem>
</Tabs>

---

## Compare Revision and Set

Sets or overwrites key/value pairs but only if the current revision matches a specified comparison revision. See [Compare-and-Set (CAS)](/docs/distributed-keyvalue-store/cas/) and [Revisions](/docs/distributed-keyvalue-store/revisions/).

<Tabs groupId="client-examples">
<TabItem value="cli" label="CLI">

Sets a key/value only if its current revision is **4**:

```text
kahuna-cli> set `my-config` "my-value"
r4 set 12ms

kahuna-cli> set `my-config` "my-value" cmprev 4
r5 set 11ms

kahuna-cli> set `my-config` "other-value" cmprev 4
r5 not set 10ms
```

</TabItem>
<TabItem value="dotnet" label=".NET">

```csharp
Task<KahunaKeyValue> TryCompareRevisionAndSetKeyValue(
    string key,
    byte[]? value,
    long compareRevision,
    int expiryTime = 0,
    KeyValueDurability durability = KeyValueDurability.Persistent,
    CancellationToken cancellationToken = default
);
```

- **key:** A unique identifier for the key/value pair.
- **value:** The data object associated with the key.
- **compareRevision:** The value is changed only if the current revision matches the provided one.
- **expiryTime:** The expiration time of the key in milliseconds.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Success:** `true` if the revision matched and the key was modified.
- **Revision:** The key's current revision after the operation.

**Example**

```csharp
var current = await client.GetKeyValue("my-config");
if (current.Success)
{
    var result = await client.TryCompareRevisionAndSetKeyValue(
        "my-config", "my-value", current.Revision);
    Console.WriteLine(result.Success);
}
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const result = await client.compareRevisionAndSet(
  "my-config",
  "my-value",
  4
);

if (!result.success) {
  console.log("Revision changed before this write");
}
```

</TabItem>
</Tabs>

---

## Get

Retrieves the value of a key along with its revision. If the key does not exist, the client result has `Success = false` (.NET) or `success: false` (TypeScript). Script syntax: [`get`](/docs/scripts/commands/get/) and [`eget`](/docs/scripts/commands/eget/).

<Tabs groupId="client-examples">
<TabItem value="cli" label="CLI">

Gets key/values:

```text
kahuna-cli> get `my-config`
r-1 not found 12ms

kahuna-cli> set `my-config` "my-value"
r0 set 11ms

kahuna-cli> get `my-config`
r0 my-value 13ms
```

</TabItem>
<TabItem value="dotnet" label=".NET">

```csharp
Task<KahunaKeyValue> GetKeyValue(
    string key,
    KeyValueDurability durability = KeyValueDurability.Persistent,
    long snapshotMs = 0,
    CancellationToken cancellationToken = default
);
```

- **key:** The key to be queried.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.
- **snapshotMs:** Optional Unix-epoch-ms snapshot timestamp. `0` means latest.

**Returns:**
- **`KahunaKeyValue`**: Result object with success state, value, revision, and `LastModified`.

**Example**

Gets key/value pair:

```csharp
var result = await client.GetKeyValue(
  "my-config",
  KeyValueDurability.Persistent
);

if (result.Success)
{
  Console.WriteLine("Value: {0}", result.ValueAsString());
  Console.WriteLine("Revision: {0}", result.Revision);
}
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

Gets key/value pair:

```ts
const result = await client.get("my-config", {
  durability: "persistent"
});

if (result.success) {
  console.log(`Value: ${result.valueAsString()}`);
  console.log(`Revision: ${result.revision}`);
}
```

</TabItem>
</Tabs>

---

## Get Revision

Retrieves the value of a key at the specific revision. If the key/revision combination is unavailable, the client result has `Success = false` (.NET) or `success: false` (TypeScript).

<Tabs groupId="client-examples">
<TabItem value="cli" label="CLI">

Gets key/values:

```text
kahuna-cli> set `my-config` "my-value"
r0 set 11ms

kahuna-cli> set `my-config` "my-value-1"
r1 set 12ms

kahuna-cli> set `my-config` "my-value-3"
r2 set 15ms

kahuna-cli> get `my-config` at 0
r0 my-value 13ms

kahuna-cli> get `my-config` at 1
r1 my-value-1 13ms
```

</TabItem>
<TabItem value="dotnet" label=".NET">

```csharp
Task<KahunaKeyValue> GetKeyValueRevision(
    string key,
    long revision,
    KeyValueDurability durability = KeyValueDurability.Persistent,
    CancellationToken cancellationToken = default
);
```

- **key:** The key to be queried.
- **revision:** The revision to be returned.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Success:** `true` if the key exists at the requested revision.
- **Value:** The value associated with the key.
- **Revision:** The queried revision.

**Example**

```csharp
var result = await client.GetKeyValueRevision("my-config", 1);
if (result.Success)
    Console.WriteLine(result.ValueAsString());
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const result = await client.getRevision("my-config", 1, {
  durability: "persistent"
});

if (result.success) {
  console.log(result.valueAsString());
}
```

</TabItem>
</Tabs>

Use `AT <revision>` or a client revision-read method when you know the exact revision number. For the value visible at a point in time, use `AS OF <timestamp>` in Kahuna Script or `snapshotMs` in the clients; see [`AT` Revision vs `AS OF` Timestamp](/docs/distributed-keyvalue-store/revisions/#at-revision-vs-as-of-timestamp).

---

## Get By Bucket

Retrieves key/value pairs that share the same [bucket](/docs/distributed-keyvalue-store/buckets/). The operation is consistent when the prefix identifies a single-partition bucket, because all keys in that bucket are routed to the same partition. Script syntax: [`get by bucket`](/docs/scripts/commands/get-by-bucket/) and [`eget by bucket`](/docs/scripts/commands/eget-by-bucket/).

<Tabs groupId="client-examples">
<TabItem value="cli" label="CLI">

Get key/values by bucket prefix:

```bash
kahuna-cli --set services/auth/instance-1 --value node1
```
```text
r0 set 11ms
```

```bash
kahuna-cli --set services/auth/instance-2 --value node2
```
```text
r0 set 10ms
```

```bash
kahuna-cli --get-by-prefix services/auth
```
```text
r0 services/auth/instance-1 node1
r0 services/auth/instance-2 node2
```

</TabItem>
<TabItem value="dotnet" label=".NET">

```csharp
Task<List<KahunaKeyValue>> GetByBucket(
    string prefixKey,
    KeyValueDurability durability,
    long snapshotMs = 0,
    CancellationToken cancellationToken = default
);
```

- **prefixKey:** The bucket prefix to query.
- **durability:** Defines whether key durability is **Ephemeral** or **Persistent**.
- **snapshotMs:** Optional Unix-epoch-ms snapshot timestamp. `0` means latest.

**Returns:**
**`List<KahunaKeyValue>`**, one item per key found:
 - **Key:** The key found.
 - **Value:** The value associated with the key.
 - **Revision:** The current revision of the key.
 - **LastModified:** The Unix timestamp in milliseconds of the key's last modification.

**Example**

```csharp
var instances = await client.GetByBucket(
    "services/auth", KeyValueDurability.Persistent);

foreach (var instance in instances)
    Console.WriteLine($"{instance.Key}: {instance.ValueAsString()}");
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const instances = await client.getByBucket("services/auth", {
  durability: "persistent"
});

for (const instance of instances) {
  console.log(`${instance.key}: ${instance.valueAsString()}`);
}
```

</TabItem>
</Tabs>

Use `get by bucket` for grouped prefixes that are intentionally single-partition. For large ordered key spaces that may split over time, see [Key-Range Sharding](/docs/distributed-keyvalue-store/key-range-sharding/).

---

## Get By Range

Retrieves key/value pairs inside an ordered interval under one prefix. This is the right abstraction for ordered key spaces and bounded range reads.

<Tabs groupId="client-examples">
<TabItem value="cli" label="CLI">

The Kahuna CLI and Kahuna Script do not expose a bounded range-read command. Use the .NET or TypeScript examples for start/end bounds and pagination. `get by bucket` and `scan by prefix` read matching prefixes; they do not accept these range bounds.

</TabItem>
<TabItem value="dotnet" label=".NET">

```csharp
Task<List<KahunaKeyValue>> GetByRange(
    string prefix,
    string? startKey = null,
    bool startInclusive = true,
    string? endKey = null,
    bool endInclusive = false,
    int limit = 100,
    KeyValueDurability durability = KeyValueDurability.Persistent,
    long snapshotMs = 0,
    CancellationToken cancellationToken = default
);
```

- **prefix:** Logical key space prefix being scanned.
- **startKey / endKey:** Optional ordered bounds.
- **startInclusive / endInclusive:** Whether each bound is inclusive.
- **limit:** Maximum number of items returned in this page.
- **durability:** Defines whether key durability is **Ephemeral** or **Persistent**.
- **snapshotMs:** Optional Unix-epoch-ms snapshot timestamp. `0` means latest.

**Returns:**
- **`List<KahunaKeyValue>`**: Ordered keys in the requested interval.

**Example**

```csharp
var users = await client.GetByRange(
    prefix: "users",
    startKey: "users/000100",
    startInclusive: true,
    endKey: "users/000200",
    endInclusive: false,
    limit: 100);

foreach (var user in users)
    Console.WriteLine($"{user.Key}: {user.ValueAsString()}");
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const users = await client.getByRange(
  {
    prefix: "users",
    startKey: "users/000100",
    startInclusive: true,
    endKey: "users/000200",
    endInclusive: false
  },
  {
    limit: 100,
    durability: "persistent"
  }
);
```

</TabItem>
</Tabs>

The top-level clients also expose streaming range scans when you want paged traversal over the latest state or over one stable historical snapshot. In TypeScript, use `scanByRange(...)` as an async iterable.

Range-backed reads are internally paged. If a page repeatedly hits retryable state because a range is moving, leadership is changing, restore is in progress, or an undecided transaction intent blocks visibility, Kahuna returns a retryable error instead of scanning forever. Retry the range read after a short backoff.

In interactive transactions, `GetByRange(...)` is especially useful for ordered key spaces. Under pessimistic locking it can also protect the requested interval with a range lock, preventing phantom inserts and conflicting writes inside that range until the transaction completes.

---

## Scan By Prefix

Scans every node in the cluster for keys that start with the prefix. Each node returns its keys as they are at the moment it is visited, so the result can contain stale data. This operation is slow because it visits every node and every internal worker. Script syntax: [`scan by prefix`](/docs/scripts/commands/scan-by-prefix/) and [`escan by prefix`](/docs/scripts/commands/escan-by-prefix/).

<Tabs groupId="client-examples">
<TabItem value="cli" label="CLI">

Run this command in the Kahuna shell:

```kahuna
scan by prefix `services/auth`
```

Or use a command-line flag:

```bash
kahuna-cli --scan-by-prefix services/auth
```

</TabItem>
<TabItem value="dotnet" label=".NET">

```csharp
Task<List<KahunaKeyValue>> ScanAllByPrefix(
    string prefixKey,
    KeyValueDurability durability,
    long snapshotMs = 0,
    CancellationToken cancellationToken = default
);
```

- **prefixKey:** The prefix to scan for.
- **durability:** Defines whether key durability is **Ephemeral** or **Persistent**.
- **snapshotMs:** Optional Unix-epoch-ms snapshot timestamp. `0` means latest.

**Returns:**
**`List<KahunaKeyValue>`**, one item per key found:
 - **Key:** The key found.
 - **Value:** The value associated with the key.
 - **Revision:** The current revision of the key.
 - **LastModified:** The Unix timestamp in milliseconds of the key's last modification.

**Example**

```csharp
var rows = await client.ScanAllByPrefix(
    "services/auth", KeyValueDurability.Persistent);

foreach (var row in rows)
    Console.WriteLine($"{row.Key}: {row.ValueAsString()}");
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const rows = await client.scanAllByPrefix("services/auth", {
  durability: "persistent",
  snapshotMs: 1718392012345
});
```

</TabItem>
</Tabs>

---

## Delete

Deletes a key and its associated value. Deleting a key does not remove the key history. Script syntax: [`delete`](/docs/scripts/commands/delete/) and [`edelete`](/docs/scripts/commands/edelete/).

<Tabs groupId="client-examples">
<TabItem value="cli" label="CLI">

Run this command in the Kahuna shell:

```kahuna
delete `my-config`
```

Use `edelete` for an ephemeral key.

</TabItem>
<TabItem value="dotnet" label=".NET">

```csharp
Task<KahunaKeyValue> DeleteKeyValue(
    string key,
    KeyValueDurability durability = KeyValueDurability.Persistent,
    CancellationToken cancellationToken = default
);
```

- **key:** The key to be deleted.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Success:** `true` if the key/value pair was deleted.
- **Revision:** The tombstone revision created by the delete. For example, deleting a key at revision `0` returns revision `1`, and the next successful set returns revision `2`.

**Example**

```csharp
var deleted = await client.DeleteKeyValue("my-config");
Console.WriteLine(deleted.Success);
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const deleted = await client.delete("my-config", {
  durability: "persistent"
});

console.log(deleted.success, deleted.revision);
```

</TabItem>
</Tabs>

---

## Extend

Sets a new expiration time on a key. The key is deleted when it expires. An expiration of `0` means the key does not expire. Script syntax: [`extend`](/docs/scripts/commands/extend/) and [`eextend`](/docs/scripts/commands/eextend/).

<Tabs groupId="client-examples">
<TabItem value="cli" label="CLI">

Extend a key/value:

```kahuna
set `my-config` "my-value" ex 10000
```
```text
r0 set 11ms
```

```kahuna
extend `my-config` 30000
```
```text
r0 extended 13ms
```

</TabItem>
<TabItem value="dotnet" label=".NET">

```csharp
Task<KahunaKeyValue> ExtendKeyValue(
    string key,
    int expiresMs,
    KeyValueDurability durability = KeyValueDurability.Persistent,
    CancellationToken cancellationToken = default
);
```

- **key:** The key to be extended.
- **expiresMs:** The expiration time of the key in milliseconds.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Success:** `true` if the key/value pair was extended.
- **Revision:** The key's current revision. Extending the key does **not** increment the revision counter.

**Example**

```csharp
var extended = await client.ExtendKeyValue("my-config", 30_000);
Console.WriteLine(extended.Success);
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const extended = await client.extend("my-config", 30_000, {
  durability: "persistent"
});

console.log(extended.success, extended.revision);
```

</TabItem>
</Tabs>

---

## Exists

Checks whether a key exists. Script syntax: [`exists`](/docs/scripts/commands/exists/) and [`eexists`](/docs/scripts/commands/eexists/).

<Tabs groupId="client-examples">
<TabItem value="cli" label="CLI">

Exists key/values:

```text
kahuna-cli> exists `my-config`
r-1 not found 12ms

kahuna-cli> set `my-config` "my-value"
r0 set 11ms

kahuna-cli> exists `my-config`
r0 exists 13ms
```

</TabItem>
<TabItem value="dotnet" label=".NET">

```csharp
Task<KahunaKeyValue> ExistsKeyValue(
    string key,
    KeyValueDurability durability = KeyValueDurability.Persistent,
    long snapshotMs = 0,
    CancellationToken cancellationToken = default
);
```

- **key:** The key to be checked if exists.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Success:** `true` if the key/value pair exists.
- **Revision:** The key's current revision at the time of the query.

**Example**

```csharp
var result = await client.ExistsKeyValue("my-config");
Console.WriteLine(result.Success);
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const exists = await client.exists("my-config", {
  durability: "persistent"
});

console.log(exists.success, exists.revision);
```

</TabItem>
</Tabs>
