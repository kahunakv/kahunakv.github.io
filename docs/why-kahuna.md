# Why Kahuna?

Kahuna gives distributed applications three building blocks in one self-hosted cluster:

| Solution | What it provides | Common uses |
|----------|------------------|-------------|
| [Distributed key/value store](/docs/distributed-keyvalue-store/) | Replicated shared state with conditional writes and transactions | Configuration, service metadata, feature flags, reservations |
| [Distributed locks](/docs/distributed-locks/) | One active owner, expiring leases, and fencing tokens | Scheduled jobs, leader election, exclusive resource access |
| [Distributed sequencer](/docs/distributed-sequencer/) | Retry-safe allocation of ordered values or ranges | Invoice numbers, tickets, order IDs, offsets |

Use Kahuna when several application instances must agree on **state**, **ownership**, or **ordering**, especially when a wrong answer is worse than a temporary error.

## Why Distribution Changes the Problem

Commands such as `GET`, `SET`, expiration, and increment look sufficient until a server fails, a request times out, or the network splits.

### Shared State Needs an Authority

Replicas do not automatically agree on which node may accept writes. During a network failure, different clients may reach different nodes and observe conflicting values.

Kahuna uses Raft consensus. Each partition has one leader, and persistent writes are committed by a quorum before they succeed. If the cluster cannot agree, Kahuna rejects or delays the operation instead of accepting two histories.

You also get revisions, compare-and-set updates, expiration, historical reads, and atomic transactions across several keys.

### Expiration Alone Does Not Make a Safe Lock

Consider an expiring key used as a lock:

1. Worker A acquires it and then pauses.
2. Its lease expires.
3. Worker B acquires the same lock.
4. Worker A resumes and continues working.

Both workers now believe they own the resource.

Kahuna issues a **fencing token** with every lock acquisition. The token always increases, allowing the protected resource to reject late operations from an older owner.

```text
Worker A -> token 41
lease expires
Worker B -> token 42
resource rejects later writes using token 41
```

### Atomic Counters Are Not Retry-Safe

Suppose a server allocates invoice number `501`, but the response is lost. The client cannot know whether it should retry. A second increment may allocate `502` for the same request.

Kahuna sequences accept an **idempotency key**. Retrying the same request returns the same allocation. They can also reserve non-overlapping ranges to reduce network calls.

## One System for Coordination

These features share the same replication, persistence, routing, and client model. Teams do not need to create their own lock format, renewal loop, counter retry rules, or multi-key commit protocol.

| Kahuna advantage | Practical benefit |
|------------------|-------------------|
| First-class locks, key/value state, and sequences | Use documented operations instead of application-specific recipes. |
| Distributed transactions and scripts | Several keys can change together or roll back together. |
| Native .NET client | Async APIs, cancellation, transactions, and multiple endpoints fit normal .NET services. |
| REST, gRPC, CLI, and scripts | Applications and operators can choose the appropriate interface. |
| Hash and key-range routing | Support both general coordination keys and ordered, scan-heavy key spaces. |
| MIT license | Use, modify, and redistribute Kahuna without proprietary runtime fees. |

## Replacing a Cache and Database for Small State

Applications often keep durable state in a database and copy hot values into a cache. The application must then coordinate both copies:

1. Write the database.
2. Update or invalidate the cache.
3. Handle a failure between those operations.
4. Decide which value is correct when they disagree.

For coordination and small shared state, Kahuna combines those roles:

- Hot values remain in memory
- Persistent values are replicated and stored in RocksDB or SQLite
- Evicted persistent values are loaded from storage when needed
- One write path updates the accepted cluster state
- Ephemeral values use the same API when durability is unnecessary

Configuration, service metadata, locks, reservations, rate limits, and sequences often do not need a separate cache in front of a separate database.

Kahuna does **not** replace a primary business database. Relational queries, document storage, analytics, large records, and bulk data belong in systems designed for those workloads.

## When to Choose Kahuna

Use a simple cache when data can be lost, rebuilt, or briefly inconsistent.

Choose Kahuna when any of these would cause incorrect behavior:

- Two workers owning the same job
- An acknowledged update disappearing after failover
- Several nodes accepting conflicting values
- A retried request allocating a second ID
- A multi-key update becoming partially visible

Consensus adds network communication and operational cost, so Kahuna is intentionally focused on coordination and small strongly consistent state.

Follow the [Tutorial](/docs/intro/) to start a standalone node and execute your first commands.
