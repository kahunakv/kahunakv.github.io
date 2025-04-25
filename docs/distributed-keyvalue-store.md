import Kahuna4 from './assets/kahuna4.png';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Distributed Key/Value Store

<div style={{textAlign: 'center'}}>
<img src={Kahuna4} height="350" />
</div>

A **distributed key/value store** is a type of **database system** designed to store, retrieve, and manage data across multiple nodes in a cluster or distributed environment. It follows a simple **key-value data model**, where **keys** are unique identifiers, and **values** are arbitrary byte stream associated data objects.

## Key Characteristics

1. **Scalability** – The system distributes data across multiple machines, allowing it to scale horizontally as demand increases. If the nodes are multi-processor, Kahuna can process multiple requests in parallel.
2. **Fault Tolerance** – By replicating data across multiple nodes, it ensures resilience against failures.
3. **High Availability** – Data is accessible even if some nodes go offline, minimizing downtime.
4. **Strong Consistency** – Ensures reliable data integrity using the **Raft consensus protocol**.
5. **Low Latency** – Optimized for fast read/write operations, making it ideal for caching, real-time applications and distributed computing.
6. **Distributed Transactions** – Supports multi-node transactions with **Multi-Version Concurrency Control (MVCC)**, **Pessimistic/Optimistic Locking**, and **Two-Phase Commit (2PC)** for consistency across distributed operations.

## Use Cases

- **Configuration Management** – Storing dynamic settings for applications (e.g., feature flags).
- **Metadata Storage** – Keeping track of distributed system metadata (e.g., leader election in Raft).
- **Session Management** – Storing user sessions across distributed servers.
- **Caching** – Speeding up data access by storing frequently used data.
- **Distributed Coordination** – Managing distributed locks and leader election.
- **Transactional Workloads** – Ensuring atomicity and consistency across distributed transactions.

## Kahuna Distributed Store

In the context of **Kahuna**, its **distributed key/value store** capability allows applications to store and retrieve data efficiently, ensuring **strong consistency, high availability, and low latency**. Additionally, **Kahuna supports distributed transactions**, enabling applications to execute **atomic, consistent, isolated, and durable (ACID) operations** across multiple nodes. This is achieved using:

- **Multi-Version Concurrency Control (MVCC)** – Allowing non-blocking reads and improved concurrency.
- **Pessimistic and Optimistic Locking** – Supporting different locking mechanisms to prevent conflicts in concurrent transactions.
- **Two-Phase Commit (2PC)** – Ensuring atomicity in distributed transactions across multiple nodes.

These features make Kahuna a great solution for small transactional workloads requiring **data integrity, consistency, and high availability**.

## Revisions

In Kahuna, a [revision](/docs/distributed-keyvalue-store/revisions) is a monotonic, ever-increasing number that represents the global order of modifications in the key-value store. Every time a change (write, delete, or transaction) occurs in Kahuna, the revision number increases, ensuring strong consistency and strict ordering of operations. Each revision is a 64-bit cluster-wide counter.

## API

Kahuna provides an API for performing various operations on key/value pairs:

### Set

Sets or overwrites key/value pairs. The behavior of the API is modified based on the provided flags, which determine whether the operation occurs depending on the key's existence, current value, or current revision.

<Tabs>
<TabItem value="API">

```csharp
(bool Set, long Revision) TrySet(string key, byte[] value, Flags flags, Consistency consistency);
```

- **key:** A unique identifier for the key/value pair.
- **value:** The data object associated with the key.
- **expiresMs:** The expiration time of the key in milliseconds.
- **flags:**
  - If `Flags.SetIfExists` is specified, the value is set only if the key already exists.
  - If `Flags.SetIfNotExists` is specified, the value is set only if the key does not exist.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Set:** `true` if the key's value was modified.
- **Revision:** A global counter indicating how many times the key has been modified.

</TabItem>
<TabItem value="CLI">

Sets a key/value only if not exists:

```visual-basic
kahuna-cli> set `my-config` "my-value" nx
r3 set 11ms
```

Sets a key/value only if exists:

```visual-basic
kahuna-cli> set `my-config` "my-value" xx
r4 set 10ms
```

Sets a key/value:

```visual-basic
kahuna-cli> set `my-config` "my-value"
r5 set 13ms
```

Sets a key/value with an expiration of 10 sec:

```visual-basic
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
  flags: SetIfNotExists,
  durability: KeyValueDurability.Persistent
);

// Update a key/value pair only if it does exist
result = await client.SetKeyValue(
  "my-config",
  "some-value",
  0,
  flags: SetIfExists,
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
(bool Set, long Revision) TryCompareValueAndSet(string key, byte[] value, byte[] compareValue, Durability durability);
```

- **key:** A unique identifier for the key/value pair.
- **value:** The data object associated with the key.
- **compareValue:** The value is changed only if the current value matches the provided one.
- **expiresMs:** The expiration time of the key in milliseconds.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Set:** `true` if the key's value was modified.
- **Revision:** A global counter indicating how many times the key has been modified.

</TabItem>
<TabItem value="CLI">

Sets a key/value only if the current value is "current-value":

```visual-basic
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
(bool Set, long Revision) TryCompareRevisionAndSet(string key, byte[] value, long compareRevision, Durability durability);
```

- **key:** A unique identifier for the key/value pair.
- **value:** The data object associated with the key.
- **compareRevision:** The value is changed only if the current revision matches the provided one.
- **expiresMs:** The expiration time of the key in milliseconds.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Set:** `true` if the key's value was modified.
- **Revision:** A global counter indicating how many times the key has been modified.

</TabItem>
<TabItem value="CLI">

Sets a key/value only if the current value is the current revision is **4**:

```visual-basic
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
(bool Found, byte[] Value, long Revision) TryGet(string key, Durability durability);
```

- **key:** The key to be queried.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Found:** `true` if the key exists.
- **Value:** The value associated with the key.
- **Revision:** A global counter indicating how many times the key has been modified.

</TabItem>
<TabItem value="CLI">

Gets key/values:

```visual-basic
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
(bool Found, byte[] Value, long Revision) TryGetRevision(string key, long revision, Durability durability);
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

```visual-basic
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

---

### Get By Prefix

Retrieves the key/value pairs that share the same prefix. The key/value pairs are returned in a consistent way if a common bucket is passed as prefix.

<Tabs>
<TabItem value="API">

```csharp
(KeyValuePair[]) GetByPrefix(string prefix, Durability durability);
```

- **key:** The key to be queried.
- **revision:** The revision to be returned.
- **durability:** Defines whether the keys durability is **Ephemeral** or **Persistent**.

**Returns:**
**KeyValuePair:**
 - **Key:** The key found.
 - **Value:** The value associated with the key.
 - **Revision:** The current revision of the key.
 - **Expires:** The unix timestamp in milliseconds when the key will expire.

 </TabItem>
<TabItem value="CLI">

Get key/values by prefix:

```visual-basic
$ kahuna-cli --set services/auth/instance-1 --value node1
r0 set 11ms

$ kahuna-cli --set services/auth/instance-2 --value node2
r0 set 10ms

$ kahuna-cli --get-by-prefix services/auth
r0 services/auth/instance-1 node1
r0 services/auth/instance-2 node2
```

</TabItem>
</Tabs>

---

### Scan By Prefix

Scan all nodes in the cluster searching for key/value pairs where the key start with the specified prefix. The key/value pairs data are taken from the moment
the node is visited. It can contain stale data. This API is slow because it scans all nodes and internal workers for keys.

<Tabs>
<TabItem value="API">

```csharp
(KeyValuePair[]) ScanByPrefix(string prefix, Durability durability);
```

- **key:** The key to be queried.
- **revision:** The revision to be returned.
- **durability:** Defines whether the keys durability is **Ephemeral** or **Persistent**.

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
(bool Deleted, long Revision) TryDelete(string key, Durability durability);
```

- **key:** The key to be deleted.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Deleted:** `true` if the key/value pair was deleted.
- **Revision:** The global counter indicating how many times the key was modified at the time of deletion. Deleting a key does **not** increment the revision counter.

</TabItem>
</Tabs>

---

### Extend

Extends a key timeout. The key will be deleted after the key expires. If the expiration is 0 the key will not be expired or removed.

<Tabs>
<TabItem value="API">

```csharp
(bool Extended, long Revision) TryExtend(string key, int expiresMs, Durability durability);
```

- **key:** The key to be extended.
- **expiresMs:** The expiration time of the key in milliseconds.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Extended:** `true` if the key/value pair was extended.
- **Revision:** The global counter indicating how many times the key was modified at the time of deletion. Extending the key does **not** increment the revision counter.

</TabItem>
<TabItem value="CLI">

Exists key/values:

```visual-basic
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
(bool Exists, long Revision) Exists(string key, Durability durability);
```

- **key:** The key to be checked if exists.
- **durability:** Defines whether the key durability is **Ephemeral** or **Persistent**.

**Returns:**
- **Exists:** `true` if the key/value pair exists.
- **Revision:** The global counter indicating how many times the key was modified at the time of the query.

</TabItem>
<TabItem value="CLI">

Exists key/values:

```visual-basic
kahuna-cli> exists `my-config`
r-1 not found 12ms

kahuna-cli> set `my-config` "my-value"
r0 set 11ms

kahuna-cli> exists `my-config`
r0 exists 13ms
```

</TabItem>
</Tabs>