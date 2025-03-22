
# Overview

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

In Kahuna, a revision is a monotonic, ever-increasing number that represents the global order of modifications in the key-value store. Every time a change (write, delete, or transaction) occurs in Kahuna, the revision number increases, ensuring strong consistency and strict ordering of operations. Each revision is a 64-bit cluster-wide counter.

## API

Kahuna provides an API for performing various operations on key/value pairs.

### Set

Sets or overwrites key/value pairs. The behavior of the API is modified based on the provided flags, which determine whether the operation occurs depending on the key's existence, current value, or current revision.

```csharp
(bool Set, long Revision) TrySet(string key, byte[] value, Flags flags, Consistency consistency);
```

- **key:** A unique identifier for the key/value pair.
- **value:** The data object associated with the key.
- **expiresMs:** The expiration time of the key in milliseconds.
- **flags:**
  - If `Flags.SetIfExists` is specified, the value is set only if the key already exists.
  - If `Flags.SetIfNotExists` is specified, the value is set only if the key does not exist.
- **consistency:** Defines whether the key is **Ephemeral** or **Strongly Consistent**.

**Returns:**
- **Set:** `true` if the key's value was modified.
- **Revision:** A global counter indicating how many times the key has been modified.

### Compare-Value-And-Set (CVAS)

Sets or overwrites key/value pairs, but only if the current value matches a specified comparison value.

```csharp
(bool Set, long Revision) TryCompareValueAndSet(string key, byte[] value, byte[] compareValue, Consistency consistency);
```

- **key:** A unique identifier for the key/value pair.
- **value:** The data object associated with the key.
- **compareValue:** If specified with `Flags.SetIfEqualToValue`, the value is changed only if the current value matches the provided one.
- **expiresMs:** The expiration time of the key in milliseconds.
- **consistency:** Defines whether the key is **Ephemeral** or **Strongly Consistent**.

**Returns:**
- **Set:** `true` if the key's value was modified.
- **Revision:** A global counter indicating how many times the key has been modified.

### Compare-Revision-And-Set (CRAS)

Sets or overwrites key/value pairs, but only if the current revision matches a specified comparison revision.

```csharp
(bool Set, long Revision) TryCompareRevisionAndSet(string key, byte[] value, long compareRevision, Consistency consistency);
```

- **key:** A unique identifier for the key/value pair.
- **value:** The data object associated with the key.
- **compareRevision:** If specified with `Flags.SetIfEqualToRevision`, the value is changed only if the current revision matches the provided one.
- **expiresMs:** The expiration time of the key in milliseconds.
- **consistency:** Defines whether the key is **Ephemeral** or **Strongly Consistent**.

**Returns:**
- **Set:** `true` if the key's value was modified.
- **Revision:** A global counter indicating how many times the key has been modified.

### Get

Retrieves the value of a key along with its revision. If the key does not exist, the special value `nil` is returned.

```csharp
(bool Found, byte[] Value, long Revision) TryGet(string key);
```

- **key:** A unique identifier for the key/value pair.

**Returns:**
- **Found:** `true` if the key exists.
- **Value:** The value associated with the key.
- **Revision:** A global counter indicating how many times the key has been modified.

### Delete

Deletes a key and its associated value.

```csharp
(bool Deleted, long Revision) TryDelete(string key);
```

- **key:** A unique identifier for the key/value pair.

**Returns:**
- **Deleted:** `true` if the key/value pair was deleted.
- **Revision:** The global counter indicating how many times the key was modified at the time of deletion. Deleting a key does **not** increment the revision counter.

### Extend

Extends a key timeout. The key will be deleted after the key expires.

```csharp
(bool Extended, long Revision) TryExtend(string key, int expiresMs);
```

- **key:** A unique identifier for the key/value pair.
- **expiresMs:** The expiration time of the key in milliseconds.

**Returns:**
- **Extended:** `true` if the key/value pair was deleted.
- **Revision:** The global counter indicating how many times the key was modified at the time of deletion. Extending the key does **not** increment the revision counter.