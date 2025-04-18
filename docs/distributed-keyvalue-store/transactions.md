
# Transactions

## Overview

Kahuna offers **distributed transactions** to enable safe, consistent, and atomic access to keys across the cluster. Transactions ensure that multiple reads and writes either all succeed together or none take effect—making them essential for maintaining **data correctness** in concurrent and distributed environments.

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
| **Serializable Transactions** | Pessimistic locks can be used to enforce total ordering of transactions. |
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

## Using `get by prefix` inside a Transaction

All keys in a given **bucket prefix** (e.g., `services/`) are guaranteed to be on the same partition. This enables **prefix scans** to be consistent and transactional:

```ruby
begin
 let services = get by prefix "services"
 if not contains(services, "services/users") then
  set "services/users" "localhost:8084"
 end
 commit
end 
```

Learn more about buckets and keys distribution in the [previous section](buckets)

## Transaction Lifecycle

1. **Begin**: Kahuna assigns an HLC timestamp and starts tracking reads/writes. Locks are acquired in advance in pessimistic locking.
2. **Read/Write**: All operations are buffered in-memory.
3. **Validation**:
   - If optimistic: Check for conflicts with newer committed versions.
   - If pessimistic: Lock keys ahead of time to avoid conflicts.
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

- **Group keys by prefix** when designing schemas to maximize transactional locality.
- Use **ephemeral keys** for high-speed, non-critical paths.
- Consider **pessimistic locking** for highly contended keys to avoid retries.
- Monitor retries to detect **hotspots** in your workload.

## Transaction Options

You can specify **transaction options** to fine-tune how the transaction is executed:

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

- `pessimistic`: Locks keys upfront to ensure full consistency.
- `optimistic`: Locks only on write, with version validation during commit.

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

These options provide greater flexibility and control over **performance**, **consistency**, and **responsiveness** in your Kahuna transactions.
