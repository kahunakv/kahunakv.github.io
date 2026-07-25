import Kahuna4 from './assets/kahuna4.png';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Distributed Key/Value Store

<div style={{textAlign: 'center'}}>
<img src={Kahuna4} height="350" />
</div>

A **distributed key/value store** is a type of **database system** designed to store, retrieve, and manage data across multiple nodes in a cluster or distributed environment. It follows a simple **key-value data model**, where **keys** are unique identifiers, and **values** are arbitrary byte stream associated data objects.

## Key Characteristics

1. **Scalability**: The system distributes data across partitions and can spread partition leadership across multiple machines.
2. **Fault Tolerance**: Persistent data is replicated through Raft, so committed state can survive node failures.
3. **High Availability**: Clients can contact any node, and Kahuna routes requests to the current partition leader.
4. **Strong Consistency**: Partition leaders serialize writes through Raft-backed ordering.
5. **Low Latency**: Hot state is served from actor-owned memory, with background persistence for materialized state.
6. **Distributed Transactions**: Supports multi-node transactions with MVCC, pessimistic or optimistic locking, server-owned working sets, operation retry deduplication, two-phase commit, and optional durable commit decisions.

## Use Cases

- **Configuration Management** – Storing dynamic settings for applications (e.g., feature flags).
- **Metadata Storage** – Keeping track of distributed system metadata (e.g., leader election in Raft).
- **Session Management** – Storing user sessions across distributed servers.
- **Caching** – Speeding up data access by storing frequently used data.
- **Distributed Coordination** – Managing distributed locks and leader election.
- **Transactional Workloads** – Ensuring atomicity and consistency across distributed transactions.

## Kahuna Distributed Store

In the context of **Kahuna**, its **distributed key/value store** capability allows applications to store and retrieve data efficiently, ensuring **strong consistency, high availability, and low latency**. Additionally, **Kahuna supports distributed transactions**, enabling applications to execute atomic and isolated operations across multiple nodes. This is achieved using:

- **Multi-Version Concurrency Control (MVCC)** for snapshot reads and conflict detection.
- **Pessimistic and Optimistic Locking** for different contention profiles.
- **Server-owned transaction coordination** so commit and rollback use the working set recorded by Kahuna, not a client-built summary.
- **Two-Phase Commit (2PC)** for atomicity across modified participants.
- **Durable Commit Decisions** when an all-persistent write set needs recovery after durable finalization starts.

These features make Kahuna a great solution for small transactional workloads requiring **data integrity, consistency, and high availability**.

## Revisions

In Kahuna, a [revision](/docs/distributed-keyvalue-store/revisions) is a monotonic version number for a key. Updates advance the key's revision. Deletes mark the key as deleted and report the current revision. Revisions are useful for compare-revision updates, debugging, and historical reads.

## Routing Model

Kahuna supports two routing models for key/value data:

- **Hash routing** is the default. It spreads key spaces across partitions and is the usual choice for service configuration, metadata, caches, and general-purpose key/value state.
- **Key-range routing** is an opt-in model for ordered key spaces that need locality, ordered scans, and range-scoped concurrency.

For grouped prefixes such as `services/auth` and `services/payments`, Kahuna can keep the whole bucket on one partition and serve it with `get by bucket`. For larger ordered spaces such as `users/000001` or `orders/2026/000001`, key-range routing allows the space to split into contiguous ranges over time instead of forcing the whole prefix to stay on one partition forever.

Learn more in [Key-Range Sharding](/docs/distributed-keyvalue-store/key-range-sharding/) and [Buckets](/docs/distributed-keyvalue-store/buckets/).

## API

Kahuna provides an API for performing various operations on key/value pairs:

### Set

Sets or overwrites key/value pairs. The behavior of the API is modified based on the provided flags, which determine whether the operation occurs depending on the key's existence, current value, or current revision.

<Tabs>
<TabItem value="API">

```csharp
Task<KahunaKeyValue> SetKeyValue(
    string key,
    byte[]? value,
    int expiryTime = 0,
    KeyValueFlags flags = KeyValueFlags.Set,
    KeyValueDurability durability = KeyValueDurability.Persistent
);
```

- **key:** A unique identifier for the key/value pair.
- **value:** The data object associated with the key.
- **expiresMs:** The expiration time of the key in milliseconds.
- **flags:**
  - If `KeyValueFlags.SetIfExists` is specified, the value is set only if the key already exists.
  - If `KeyValueFlags.SetIfNotExists` is specified, the value is set only if the key does not exist.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Success:** `true` if the key's value was modified.
- **Revision:** The key's current revision after the operation.

</TabItem>
<TabItem value="CLI">

Sets a key/value only if not exists:

```kahuna
kahuna-cli> set `my-config` "my-value" nx
r3 set 11ms
```

Sets a key/value only if exists:

```kahuna
kahuna-cli> set `my-config` "my-value" xx
r4 set 10ms
```

Sets a key/value:

```kahuna
kahuna-cli> set `my-config` "my-value"
r5 set 13ms
```

Sets a key/value with an expiration of 10 sec:

```kahuna
kahuna-cli> set `my-config` "my-value" ex 10000
r6 set 12ms
```

Sets a key/value using command line arguments:

```bash
~> kahuna-cli --set my-config --value my-value
r3 set 11ms

~> kahuna-cli --set my-config --value my-value --expires 30000
r4 set 10ms
```

</TabItem>
<TabItem value="C#">

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
</Tabs>

---

### Compare-Value-And-Swap (CVAS)

Sets or overwrites key/value pairs but only if the current value matches a specified comparison value.

<Tabs>
<TabItem value="API">

```csharp
Task<KahunaKeyValue> TryCompareValueAndSetKeyValue(
    string key,
    byte[] value,
    byte[] compareValue,
    int expiryTime = 0,
    KeyValueDurability durability = KeyValueDurability.Persistent
);
```

- **key:** A unique identifier for the key/value pair.
- **value:** The data object associated with the key.
- **compareValue:** The value is changed only if the current value matches the provided one.
- **expiresMs:** The expiration time of the key in milliseconds.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Success:** `true` if the comparison matched and the key was modified.
- **Revision:** The key's current revision after the operation.

</TabItem>
<TabItem value="CLI">

Sets a key/value only if the current value is "current-value":

```kahuna
kahuna-cli> set `my-config` "current-value"
r2 set 10ms

kahuna-cli> set `my-config` "my-value" cmp "current-value"
r3 set 11ms

kahuna-cli> set `my-config` "my-value" cmp "current-value"
r3 not set 12ms
```

</TabItem>
</Tabs>

---

### Compare-Revision-And-Swap (CRAS)

Sets or overwrites key/value pairs but only if the current revision matches a specified comparison revision.

<Tabs>
<TabItem value="API">

```csharp
Task<KahunaKeyValue> TryCompareRevisionAndSetKeyValue(
    string key,
    byte[]? value,
    long compareRevision,
    int expiryTime = 0,
    KeyValueDurability durability = KeyValueDurability.Persistent
);
```

- **key:** A unique identifier for the key/value pair.
- **value:** The data object associated with the key.
- **compareRevision:** The value is changed only if the current revision matches the provided one.
- **expiresMs:** The expiration time of the key in milliseconds.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Success:** `true` if the revision matched and the key was modified.
- **Revision:** The key's current revision after the operation.

</TabItem>
<TabItem value="CLI">

Sets a key/value only if the current value is the current revision is **4**:

```kahuna
kahuna-cli> set `my-config` "my-value"
r4 set 12ms

kahuna-cli> set `my-config` "my-value" cmprev 4
r5 set 11ms

kahuna-cli> set `my-config` "other-value" cmprev 4
r5 not set 10ms
```

</TabItem>
</Tabs>

---

### Get

Retrieves the value of a key along with its revision. If the key does not exist, the special value `nil` is returned.

<Tabs>
<TabItem value="API">

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

</TabItem>
<TabItem value="CLI">

Gets key/values:

```kahuna
kahuna-cli> get `my-config`
r-1 not found 12ms

kahuna-cli> set `my-config` "my-value"
r0 set 11ms

kahuna-cli> get `my-config`
r0 my-value 13ms
```

</TabItem>
<TabItem value="C#">

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
</Tabs>

---

### Get Revision

Retrieves the value of a key at the specific revision. If the key/revision combination does not exist in the key/value store, the special value `nil` is returned.

<Tabs>
<TabItem value="API">

```csharp
Task<KahunaKeyValue> GetKeyValueRevision(
    string key,
    long revision,
    KeyValueDurability durability = KeyValueDurability.Persistent
);
```

- **key:** The key to be queried.
- **revision:** The revision to be returned.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Found:** `true` if the key exists.
- **Value:** The value associated with the key.
- **Revision:** The queried revision.

</TabItem>
<TabItem value="CLI">

Gets key/values:

```kahuna
kahuna-cli> set `my-config` "my-value"
r0 set 11ms

kahuna-cli> set `my-config` "my-value-1"
r1 set 12ms

kahuna-cli> set `my-config` "my-value-3"
r2 set 15ms

kahuna-cli> get `my-config` at 0
r0 my-value 13ms

kahuna-cli> get `my-config` at 1
r0 my-value-1 13ms
```

</TabItem>
</Tabs>

For **timestamp-based** historical reads, Kahuna Script supports `GET key AS OF <hlc-timestamp>`, `EXISTS ... AS OF`, `GET BY BUCKET ... AS OF`, and `SCAN BY PREFIX ... AS OF`. The .NET client also supports snapshot reads directly through `snapshotMs` on `GetKeyValue(...)`, `ExistsKeyValue(...)`, `GetByBucket(...)`, `ScanAllByPrefix(...)`, `GetByRange(...)`, and `ScanByRange(...)`. Use `AT <revision>` or `GetKeyValueRevision(...)` when you know the exact revision number; use `AS OF` or `snapshotMs` when you want the value that was visible at a specific snapshot time.

---

### Get By Bucket

Retrieves key/value pairs that share the same bucket. The operation is consistent when the prefix identifies a single-partition bucket, because all keys in that bucket are routed to the same partition.

<Tabs>
<TabItem value="API">

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
**KeyValuePair:**
 - **Key:** The key found.
 - **Value:** The value associated with the key.
 - **Revision:** The current revision of the key.
 - **Expires:** The unix timestamp in milliseconds when the key will expire.

 </TabItem>
<TabItem value="CLI">

Get key/values by bucket prefix:

```kahuna
$ kahuna-cli --set services/auth/instance-1 --value node1
r0 set 11ms

$ kahuna-cli --set services/auth/instance-2 --value node2
r0 set 10ms

$ kahuna-cli --get-by-bucket services/auth
r0 services/auth/instance-1 node1
r0 services/auth/instance-2 node2
```

</TabItem>
</Tabs>

Use `get by bucket` for grouped prefixes that are intentionally single-partition. For large ordered key spaces that may split over time, see [Key-Range Sharding](/docs/distributed-keyvalue-store/key-range-sharding/).

---

### Get By Range

Retrieves key/value pairs inside an ordered interval under one prefix. This is the right abstraction for ordered key spaces and bounded range reads.

<Tabs>
<TabItem value="API">

```csharp
Task<List<KahunaKeyValue>> GetByRange(
    string prefix,
    string? startKey,
    bool startInclusive,
    string? endKey,
    bool endInclusive,
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

</TabItem>
</Tabs>

The top-level client also exposes `ScanByRange(...)` as an async sequence when you want paged streaming over the latest state or over one stable historical snapshot.

In interactive transactions, `GetByRange(...)` is especially useful for ordered key spaces. Under pessimistic locking it can also protect the requested interval with a range lock, preventing phantom inserts and conflicting writes inside that range until the transaction completes.

---

### Scan By Prefix

Scan all nodes in the cluster searching for key/value pairs where the key starts with the specified prefix. The key/value pairs data are taken from the moment
the node is visited. It can contain stale data. This API is slow because it scans all nodes and internal workers for keys.

<Tabs>
<TabItem value="API">

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
**KeyValuePair:**
 - **Key:** The key found.
 - **Value:** The value associated with the key.
 - **Revision:** The current revision of the key.
 - **Expires:** The unix timestamp in milliseconds when the key will expire.

 </TabItem>
</Tabs>

---

### Delete

Deletes a key and its associated value. Deleting a key does not remove the key history.

<Tabs>
<TabItem value="API">

```csharp
Task<KahunaKeyValue> DeleteKeyValue(
    string key,
    KeyValueDurability durability = KeyValueDurability.Persistent
);
```

- **key:** The key to be deleted.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Success:** `true` if the key/value pair was deleted.
- **Revision:** The key's current revision at the time of deletion. Deleting a key does **not** increment the revision counter.

</TabItem>
</Tabs>

---

### Extend

Extends a key timeout. The key will be deleted after the key expires. If the expiration is 0 the key will not be expired or removed.

<Tabs>
<TabItem value="API">

```csharp
Task<KahunaKeyValue> ExtendKeyValue(
    string key,
    int expiresMs,
    KeyValueDurability durability = KeyValueDurability.Persistent
);
```

- **key:** The key to be extended.
- **expiresMs:** The expiration time of the key in milliseconds.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Success:** `true` if the key/value pair was extended.
- **Revision:** The key's current revision. Extending the key does **not** increment the revision counter.

</TabItem>
<TabItem value="CLI">

Exists key/values:

```kahuna
kahuna-cli> set `my-config` "my-value" ex 10000
r0 set 11ms

kahuna-cli> extend `my-config` 30000
r0 exteded 13ms
```

</TabItem>
</Tabs>

---

### Exists

Returns if a key exists.

<Tabs>
<TabItem value="API">

```csharp
Task<KahunaKeyValue> ExistsKeyValue(
    string key,
    KeyValueDurability durability = KeyValueDurability.Persistent
);
```

- **key:** The key to be checked if exists.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Success:** `true` if the key/value pair exists.
- **Revision:** The key's current revision at the time of the query.

</TabItem>
<TabItem value="CLI">

Exists key/values:

```kahuna
kahuna-cli> exists `my-config`
r-1 not found 12ms

kahuna-cli> set `my-config` "my-value"
r0 set 11ms

kahuna-cli> exists `my-config`
r0 exists 13ms
```

</TabItem>
</Tabs>
