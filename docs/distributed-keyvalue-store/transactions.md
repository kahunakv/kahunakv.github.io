
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Transactions

## Overview

Kahuna offers **distributed transactions** to enable safe, consistent, and atomic access to keys across the cluster. Transactions ensure that multiple reads and writes either all succeed together or none take effect, making them essential for maintaining **data correctness** in concurrent and distributed environments.

Kahuna supports **snapshot isolation** and **serializable consistency** through **MVCC (Multi-Version Concurrency Control)** and **optimistic/pessimistic locking**.

For interactive transactions, Kahuna uses a server-side **transaction coordinator**. The client keeps a session handle, but the server owns the authoritative working set: confirmed reads, writes, locks, range locks, prefix locks, and cleanup state. Commit and rollback use that server-owned state instead of trusting the client to send a final list of touched keys.

## Why Transactions Matter?

In a distributed system, multiple clients might access and modify overlapping sets of keys. Without transactions, you risk:

- **Lost updates** (e.g., one client overwriting another)
- **Read skew** (inconsistent reads during writes)
- **Partial updates** (only some keys being modified)

Kahuna’s transactional engine addresses these issues by:

- Isolating reads and writes from each other using **MVCC** versions
- Detecting write conflicts during commit
- Optionally acquiring **locks** to serialize conflicting transactions
- Deduplicating retried interactive operations with stable operation IDs
- Closing the transaction to new work before commit or rollback finalizes

## Core Concepts

| Concept | Description |
|--------|-------------|
| **Transaction Coordinator** | The server component that owns the transaction lifecycle, working set, finalization, cleanup, and optional durable commit decision. |
| **Transaction Handle** | Client-side identity that routes later operations, commit, and rollback back to the correct coordinator. |
| **Snapshot Isolation** | Readers see a consistent snapshot of the data as of the transaction start. Writers commit only if no conflicting writes occurred. |
| **Serializable Transactions** | Pessimistic locking and range-aware guards let Kahuna block phantoms and conflicting writes on the working set you read. |
| **MVCC** | Each key maintains multiple versions. Reads select the correct version based on transaction timestamp. |
| **Transaction Timestamp** | A [Hybrid Logical Clock (HLC)](../architecture/hybrid-logical-clocks.md) timestamp assigned at transaction start, used for snapshot reads and version tracking. |
| **Write Set** | The keys the server has confirmed as modified by the transaction. |
| **Read Set** | The keys the server observed during latest-state reads, used for conflict detection when validation is enabled. |
| **Operation ID** | Stable identity assigned to an interactive operation so a retry can return the same result without applying the mutation twice. |
| **Locks** | Optional. Acquired for pessimistic or serialized transactions. Locks have expiration to prevent being held forever. |
| **Durable Decision** | Optional recoverable commit decision for all-persistent write sets after the decision has been installed. |

## Transaction API

All operations in a Kahuna Script are implicitly part of a transaction:

```kahuna
set "services/auth" "localhost:8081"
set "services/matchmaking" "localhost:8082"
set "services/inventory" "localhost:8083"
```

### Basic Usage

```kahuna
begin
 let current_alice = get "balance:alice"
 let current_bob = get "balance:bob"
 if current_alice >= 50 then
  set "balance:alice" current_alice - 50
  set "balance:bob" current_bob + 50
 end
 commit
end
```

### Example: Conditional Write Based on a Snapshot

```kahuna
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

```kahuna
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

1. **Begin**: Kahuna assigns an HLC transaction ID and creates a coordinator-owned session.
2. **Read/Write**: Operations run on the responsible partition leaders. Confirmed effects are folded into the server-owned working set.
3. **Retry deduplication**: Interactive operations carry stable operation IDs, so a retried request can return the original result instead of applying the same mutation twice.
4. **Validation**:
   - Optimistic transactions re-check committed read dependencies and abort if a key changed since it was read.
   - Optimistic transactions also abort if another transaction holds a concurrent write intent on a key that was read but not written, preventing write-skew anomalies.
   - Pessimistic transactions lock keys, buckets, or ranges ahead of time to avoid conflicts and phantoms.
5. **Close before finalization**: The first commit, rollback, close, or cleanup attempt stops the transaction from accepting new operations, waits for already registered operations, and freezes the working set.
6. **Commit or rollback**:
   - Commit prepares and applies the confirmed write set through two-phase commit.
   - Rollback releases staged writes, locks, and MVCC read entries from the frozen working set.
   - Retryable finalization failures return `MustRetry` and should be retried with the same handle, without adding more operations.

Learn more about transaction lifecycle in the [architecture](../architecture/distributed-transactions.md) section.

## Durability Modes in Transactions

| Mode | Behavior |
|------|----------|
| **Persistent** | Commits are replicated and flushed to disk using Raft. Strong durability guarantees. |
| **Ephemeral** | For lightweight, non-persistent use cases (e.g., caching, temporary locks). Faster but not durable. |

Example:

```kahuna
begin
 eset "session:abc" "active" # session is stored in ephemeral durability (in-memory)
 set "session:xyz" "active" # session is stored in persistent durability (disk)
 commit
end
```

Learn more about durabilities in the [dedicated section](../architecture/durability-levels.md)

Key durability is separate from transaction **decision durability**. `KeyValueDurability.Persistent` controls whether a value is replicated and stored. `DecisionDurability.Durable` controls whether an installed commit decision can be recovered if the live coordinator disappears before every participant acknowledges the commit.

Durable decision mode is useful for all-persistent write sets that need post-decision recovery. It rejects transactions that confirmed ephemeral modifications because ephemeral values and participant receipts cannot survive process loss.

## Best Practices

- **Group keys by prefix** when you want a single-partition transactional working set.
- Use **key-range routing** for large ordered spaces that may need to split over time.
- Use **ephemeral keys** for high-speed, non-critical paths.
- Consider **pessimistic locking** for highly contended keys to avoid retries.
- Use **durable decisions** only when all modified keys are persistent and recovering an installed commit decision matters.
- Retry `MustRetry` with the same transaction/session handle and do not add new operations after finalization starts.
- Monitor retries to detect **hotspots** in your workload.

## Transaction Options

You can specify **transaction options** to fine-tune how the transaction is executed. These options provide greater flexibility and control over **performance**, **consistency**, and **responsiveness**:

Kahuna Script `begin (...)` options are listed below. .NET interactive sessions expose additional options in `KahunaTransactionOptions`.

### Timeout

Specifies the **maximum duration (in milliseconds)** that the transaction is allowed to run.
If the transaction does not complete within this time, it will be **automatically rolled back**.

- Kahuna Scripts are designed for **short executions**, so increasing this value significantly is **not recommended**.
- **Default value:** `5000ms`

```kahuna
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

```kahuna
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

```kahuna
begin (snapshot=1718392012345)
  let old_config = get `config/feature-x`
  let old_services = get by bucket `services`
  commit
end
```

Snapshot transactions are useful for audits, debugging, and historical queries where you need several reads to line up against the same past instant.

Even though snapshot transactions are read-only, the `begin ... end` block still requires an explicit `commit`.

Important behavior:

- snapshot reads are **historical views**, not read-your-own-writes views
- if a key existed at the snapshot time and was updated later, the snapshot read returns the older visible value
- keys created after the snapshot time stay hidden from that snapshot
- writes are not allowed inside a snapshot transaction

---

### AsyncRelease

Indicates whether acquired locks should be **released asynchronously** (in the background) or **synchronously** (blocking the client until fully released).

- `true`: Faster response to the client, locks released in background.
- `false`: Locks must be released before returning to the client.

- **Default value:** `false`

```kahuna
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

```kahuna
begin (autoCommit=false)
  ...
  commit
end
```

### .NET Interactive Session Options

The .NET client exposes these options on `KahunaTransactionOptions`:

| Option | Default | Description |
|--------|---------|-------------|
| `Locking` | `Pessimistic` | Chooses pessimistic or optimistic concurrency behavior. |
| `Timeout` | server default when `0` | Maximum transaction duration in milliseconds. |
| `AsyncRelease` | `false` | Allows eligible post-commit cleanup to continue in the background. |
| `AutoCommit` | `true` | Carried in the protocol options, but interactive sessions still require an explicit `Commit`. Disposal of a pending session rolls back. |
| `ReadValidation` | `None` | Set to `TrackAndValidate` to record latest reads and validate them against revision or write-intent changes at commit. |
| `ReadTimestamp` | `HLCTimestamp.Zero` | Uses a fixed historical HLC timestamp for transaction point reads. Do not combine it with `ReadValidation.TrackAndValidate`. |
| `DecisionDurability` | `BestEffort` | Use `Durable` when an all-persistent write set needs recovery after the commit decision has been installed. |

## Interactive Transactions

Interactive transactions are an option for developers who prefer not to use Kahuna Scripts and instead want access to the libraries and functions of their favorite programming language.

These transactions work similarly to traditional database transactions, where the client manually starts a transaction and then commits or rolls it back as needed. The difference is that Kahuna's server-side coordinator owns the confirmed working set and finalization state.

Interactive transaction sessions are available through the gRPC transport. The REST transport does not expose session start, commit, or rollback.

<Tabs>
<TabItem value="C#">

The Kahuna client for C# offers full support for interactive transactions.

This allows developers to start, manage, and complete transactions directly from their C# applications, giving them fine-grained control over the flow of operations while maintaining strong consistency guarantees provided by Kahuna:

```csharp
await using KahunaTransactionSession session = await client.StartTransactionSession(
    new KahunaTransactionOptions
    {
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

Call `Commit` explicitly when the work should become visible. Disposing a still-pending session rolls it back, which makes `await using` a safety net for exceptions and early returns.

The session exposes `Status`, `TransactionId`, `Handle`, and `RecordAnchorKey` for diagnostics and advanced integrations. Most applications should keep using the session object and let the SDK carry the routing identity.

In case of conflicts or encountering exclusive locks under pessimistic locking, transactions can be aborted so they can be retried on the client side.

The recommended approach is to use the built-in retry mechanism provided by Kahuna clients, which automatically retries aborted or retryable transactions using a short jittered backoff interval:

```csharp
KahunaTransactionOptions txOptions = new()
{
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

`RetryableTransaction(...)` starts a fresh transaction for each attempt. It retries conflict-style outcomes such as `Aborted`, `MustRetry`, and `AlreadyLocked`, then gives up with a `KahunaException` if the retry budget is exhausted.

Durable commit decisions can be requested when every modified key is persistent:

```csharp
KahunaTransactionOptions options = new()
{
    Locking = KeyValueTransactionLocking.Pessimistic,
    Timeout = 10_000,
    ReadValidation = ReadValidation.TrackAndValidate,
    DecisionDurability = DecisionDurability.Durable
};

await using KahunaTransactionSession session =
    await client.StartTransactionSession(options, cancellationToken);

await session.SetKeyValue(
    "accounts/alice",
    "90",
    durability: KeyValueDurability.Persistent,
    cancellationToken: cancellationToken
);

await session.SetKeyValue(
    "accounts/bob",
    "110",
    durability: KeyValueDurability.Persistent,
    cancellationToken: cancellationToken
);

bool committed = await session.Commit(cancellationToken);

if (!committed)
    throw new KahunaException("Commit must be retried", KeyValueResponseType.MustRetry);
```

`Commit(...)` and `Rollback(...)` return `true` when the requested terminal outcome is reached. A `false` result means the outcome is not known yet and the same finalization action should be retried with the same session handle. After commit or rollback starts, do not add new operations to the session.

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
- **More Retry Handling**: Network interruptions can leave commit or rollback temporarily retryable. The client must retry `MustRetry` with the same session handle or use `RetryableTransaction(...)`.
- **Graceful Degradation Challenges**: In the event of partial failures (e.g., network partitions), locks can be held until the transaction times out. This can be mitigated by setting short transaction timeouts.

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
