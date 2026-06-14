
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Transactions

## Overview

Kahuna offers **distributed transactions** to enable safe, consistent, and atomic access to keys across the cluster. Transactions ensure that multiple reads and writes either all succeed together or none take effect, making them essential for maintaining **data correctness** in concurrent and distributed environments.

Kahuna supports **snapshot isolation** and **serializable consistency** through **MVCC (Multi-Version Concurrency Control)** and **optimistic/pessimistic locking**.

## Why Transactions Matter?

In a distributed system, multiple clients might access and modify overlapping sets of keys. Without transactions, you risk:

- **Lost updates** (e.g., one client overwriting another)
- **Read skew** (inconsistent reads during writes)
- **Partial updates** (only some keys being modified)

Kahuna’s transactional engine addresses these issues by:

- Isolating reads and writes from each other using **MVCC** versions
- Detecting write conflicts during commit
- Optionally acquiring **locks** to serialize conflicting transactions

## Core Concepts

| Concept | Description |
|--------|-------------|
| **Snapshot Isolation** | Readers see a consistent snapshot of the data as of the transaction start. Writers commit only if no conflicting writes occurred. |
| **Serializable Transactions** | Pessimistic locking and range-aware guards let Kahuna block phantoms and conflicting writes on the working set you read. |
| **MVCC** | Each key maintains multiple versions. Reads select the correct version based on transaction timestamp. |
| **Transaction Timestamp** | A [Hybrid Logical Clock (HLC)](../architecture/hybrid-logical-clocks.md) timestamp assigned at transaction start, used for snapshot reads and version tracking. |
| **Write Set** | The keys a transaction intends to modify. |
| **Read Set** | The keys a transaction read; used for conflict detection. |
| **Locks** | Optional. Acquired for pessimistic or serialized transactions. Locks have expiration to prevent being held forever.

## Transaction API

All operations in a Kahuna Script are implicitly part of a transaction:

```ruby
set "services/auth" "localhost:8081"
set "services/matchmaking" "localhost:8082"
set "services/inventory" "localhost:8083"
```

### Basic Usage

```ruby
begin
 let current_alice = get "balance:alice"
 let current_bob = get "balance:alice"
 if current_alice >= 50 then
  set "balance:alice" current - 50
  set "balance:bob" current + 50
 end
 commit
end
```

### Example: Conditional Write Based on a Snapshot

```ruby
begin
 let config = get "settings/feature-x"
 if config == "enabled" then
   set "logs/feature-x" "used"
 end
 commit
end
```

Even if `feature-x` is disabled mid-transaction by another client, the snapshot ensures this transaction still sees the older version and behaves consistently.

## Using `get by bucket` inside a Transaction

All keys in a given **bucket prefix** (e.g., `services/`) are guaranteed to be on the same partition in the default hash-routed model. This enables **bucket reads** to be consistent and transactional:

```ruby
begin
 let services = get by bucket "services"
 if count(services) == 3 then
  set "services/users" "localhost:8084"
 end
 commit
end
```

Learn more about buckets and routing in the [Buckets](/docs/distributed-keyvalue-store/buckets/) and [Key-Range Sharding](/docs/distributed-keyvalue-store/key-range-sharding/) sections.

Use `get by bucket` when the prefix is intentionally a **single-partition group**. If a key space is configured for key-range routing and later splits into multiple ranges, whole-space traversal should be treated as an ordered range-read problem rather than a single bucket read.

In a **pessimistic** transaction, `get by bucket` also acquires a **prefix lock** for that bucket. That means concurrent inserts, deletes, or updates under the same bucket are blocked or aborted while the transaction is open, repeated reads of the same bucket stay idempotent, and `commit` or `rollback` releases the lock.

## Using Ordered Range Reads inside a Transaction

For ordered key spaces, interactive transactions also support **bounded range reads**:

```csharp
await using KahunaTransactionSession session = await client.StartTransactionSession(
    new() { Locking = KeyValueTransactionLocking.Pessimistic, Timeout = 5000 }
);

KeyValueGetByRangePageResult page = await session.GetByRange(
    prefix: "users",
    startKey: "users/000100",
    startInclusive: true,
    endKey: "users/000200",
    endInclusive: false,
    limit: 100,
    durability: KeyValueDurability.Persistent
);
```

`GetByRange(...)` is the right primitive when the working set is an ordered slice rather than a whole single-partition bucket.

In a **pessimistic** transaction, `GetByRange(...)` acquires a **range lock** over the requested interval. That means inserts, deletes, and updates inside that range are blocked or aborted while the transaction is open, writes outside the requested boundary can still proceed, repeated reads of the same range stay idempotent, and `rollback` releases the range lock.

Within the same transaction session, range reads also follow **read-your-own-writes** semantics: uncommitted inserts and updates made by the session are visible to later reads from that session, and uncommitted deletes stay hidden from that session's later reads.

## Transaction Lifecycle

1. **Begin**: Kahuna assigns an HLC timestamp and starts tracking reads/writes. Locks are acquired in advance in pessimistic locking.
2. **Read/Write**: All operations are buffered in-memory.
3. **Validation**:
   - If optimistic: Re-check committed read dependencies and abort if a key changed since it was read.
   - If optimistic: Also abort if another transaction holds a concurrent write intent on a key that was read but not written, preventing write-skew anomalies.
   - If pessimistic: Lock keys, buckets, or ranges ahead of time to avoid conflicts and phantoms.
4. **Commit**:
   - If successful, MVCC versions are written and optionally replicated (persistent mode).
   - If failed, changes are discarded and client is notified.

Learn more about transaction lifecycle in the [architecture](../architecture/distributed-transactions.md) section.

## Durability Modes in Transactions

| Mode | Behavior |
|------|----------|
| **Persistent** | Commits are replicated and flushed to disk using Raft. Strong durability guarantees. |
| **Ephemeral** | For lightweight, non-persistent use cases (e.g., caching, temporary locks). Faster but not durable. |

Example:

```ruby
begin
 eset "session:abc" "active" # session is stored in ephemeral durability (in-memory)
 set "session:xyz" "active" # session is stored in persistent durability (disk)
 commit
end
```

Learn more about durabilities in the [dedicated section](../architecture/durability-levels.md)

## Best Practices

- **Group keys by prefix** when you want a single-partition transactional working set.
- Use **key-range routing** for large ordered spaces that may need to split over time.
- Use **ephemeral keys** for high-speed, non-critical paths.
- Consider **pessimistic locking** for highly contended keys to avoid retries.
- Monitor retries to detect **hotspots** in your workload.

## Transaction Options

You can specify **transaction options** to fine-tune how the transaction is executed. These options provide greater flexibility and control over **performance**, **consistency**, and **responsiveness**:

### Timeout

Specifies the **maximum duration (in milliseconds)** that the transaction is allowed to run.
If the transaction does not complete within this time, it will be **automatically rolled back**.

- Kahuna Scripts are designed for **short executions**, so increasing this value significantly is **not recommended**.
- **Default value:** `5000ms`

```ruby
begin (timeout=3000)
  set `config1` 'some value 1'
  set `config2` 'some value 2'
  set `config3` 'some value 3'
  commit
end
```

### Locking

Defines the **locking strategy** used by the transaction.

- `pessimistic`: Locks keys upfront and can also acquire prefix or range locks during transactional reads.
- `optimistic`: Locks only on write, revalidates read dependencies during commit, and aborts on concurrent write intents over the read set.

- **Default value:** `pessimistic`

```ruby
begin (locking="optimistic")
  set `config1` 'some value 1'
  set `config2` 'some value 2'
  set `config3` 'some value 3'
  commit
end
```

---

### Snapshot

Specifies that every read inside the transaction should be served **as of one fixed HLC timestamp**.

- `snapshot=<timestamp>` makes the whole transaction **read-only**.
- Plain reads inside the transaction use that snapshot automatically.
- A per-statement `AS OF <other timestamp>` overrides the transaction-level snapshot for that statement.

```ruby
begin (snapshot=1718392012345)
  let old_config = get `config/feature-x`
  let old_services = get by bucket `services`
  commit
end
```

Snapshot transactions are useful for audits, debugging, and historical queries where you need several reads to line up against the same past instant.

---

### AsyncRelease

Indicates whether acquired locks should be **released asynchronously** (in the background) or **synchronously** (blocking the client until fully released).

- `true`: Faster response to the client, locks released in background.
- `false`: Locks must be released before returning to the client.

- **Default value:** `false`

```ruby
begin (asyncRelease="true")
  set `config1` 'some value 1'
  set `config2` 'some value 2'
  set `config3` 'some value 3'
  commit
end
```

### AutoCommit

Specifies whether an **implicit `commit`** should be executed automatically if all operations in the transaction succeed, or if an **explicit `commit`** is required to finalize the transaction.

- `true`: The transaction will **automatically commit** if no errors occur.
- `false`: A manual `commit()` is required to indicate when the transaction should be finalized.

- **Default behavior:**
  - `false` when using a `begin` block
  - `true` when no `begin` block is used

**Example:**

```ruby
begin (autoCommit=false)
  ...
  commit
end
```

## Interactive Transactions

Interactive transactions are an option for developers who prefer not to use Kahuna Scripts and instead want access to the libraries and functions of their favorite programming language.

These transactions work similarly to traditional database transactions, where the client must manually start a transaction and then commit or rollback it as needed, depending on the outcome:

<Tabs>
<TabItem value="C#">

The Kahuna client for C# offers full support for interactive transactions.

This allows developers to start, manage, and complete transactions directly from their C# applications, giving them fine-grained control over the flow of operations while maintaining strong consistency guarantees provided by Kahuna:

```csharp
await using KahunaTransactionSession session = await client.StartTransactionSession(
    new() {
      Locking = KeyValueTransactionLocking.Optimistic,
      Timeout = 5000
    }
);

KahunaKeyValue balance1 = await session.GetKeyValue(userA);
KahunaKeyValue balance2 = await session.GetKeyValue(userB);

if (balance1.ValueAsLong() >= 50)
{
    await session.SetKeyValue(userA, balance1.ValueAsLong() - 50);
    await session.SetKeyValue(userB, balance2.ValueAsLong() + 50);
}

await session.Commit();
```

In case of conflicts or encountering exclusive locks (under pessimistic locking), transactions will be aborted 
so they can be retried on the client side.

The recommended approach is to use the built-in retry mechanism provided by Kahuna clients, which automatically 
retries aborted transactions using a short backoff interval, helping reduce contention while ensuring consistency 
and forward progress:

```csharp

KahunaTransactionOptions txOptions = new() { 
    Locking = KeyValueTransactionLocking.Pessimistic,
    Timeout = 5000
};

await client.RetryableTransaction(txOptions, async (session, cancellationToken) =>
{
    KahunaKeyValue balance1 = await session.GetKeyValue(userA);
    KahunaKeyValue balance2 = await session.GetKeyValue(userB);

    if (balance1.ValueAsLong() >= 50)
    {
        await session.SetKeyValue(userA, balance1.ValueAsLong() - 50);
        await session.SetKeyValue(userB, balance2.ValueAsLong() + 50);
    }

    await session.Commit();
});

```

</TabItem>
</Tabs>

This approach gives developers more flexibility to build complex logic in the application layer while still benefiting from Kahuna’s consistency and durability guarantees.

## Interactive Transactions vs Kahuna Scripts

Both Interactive Transactions and Kahuna Scripts offer powerful ways to work with Kahuna’s distributed system, each with distinct trade-offs.
Interactive Transactions provide greater flexibility and ease of integration with application code but at the cost of higher network latency and complexity in failure scenarios.

Kahuna Scripts, on the other hand, deliver atomicity, reduced latency, and automatic lock management, making them ideal for critical operations that need to execute entirely on the server, although they require familiarity with a specialized scripting environment.

Choosing between the two approaches depends on the specific needs of your application, the complexity of your logic, and your tolerance for latency versus maintenance effort:

### Interactive Transactions

**Advantages**
- **Familiarity and Easier Debugging**: You write the logic in your primary programming language (C#, JavaScript, etc.), making it easier to debug, maintain, and integrate with your development tools.
- **Better Integration**: Interactive transactions work seamlessly with application-level logic, error handling, and native data structures.

**Disadvantages**
- **Increased Latency**: Requires multiple round-trips between the client and server, which can introduce additional delays.
- **Graceful Degradation Challenges**: In the event of partial failures (e.g., network partitions), the client may be unable to manually commit or roll back transactions. Locks could be held until the transaction times out. This can be mitigated by setting short transaction timeouts (a few seconds).

### Kahuna Scripts

**Advantages**
- **Atomic Execution**: The entire script executes atomically on the server (transaction coordinator), as long as there are no node failures or abnormal inter-node network conditions.
- **Automatic Lock Management**: Kahuna Scripts automatically release acquired locks in the presence of conflicts, reducing complexity and avoiding unwanted delays or retries.
- **Supports Complex Logic**: Scripts can include conditionals (`if`, `while`, etc.), loops, functions, and branching logic directly on the server.
- **Shared and Portable Logic**: The same Kahuna Script can be executed from multiple programming languages without modification or extra maintenance.
- **Reduced Round-Trips**: Operations are fully executed server-side, minimizing network latency between client and server.

**Disadvantages**
- **Potentially Harder to Maintain**: Kahuna Script syntax may be less familiar and harder to debug or test compared to your main programming language.
- **Script Size Limitations**: Large or complex business logic may be difficult to express and maintain within Kahuna Scripts.
