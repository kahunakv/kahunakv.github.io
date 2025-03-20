---
sidebar_position: 3
---

# Distributed Locks

A distributed lock is a mechanism that ensures that a specific resource is accessed by only one node or process at a time in a distributed environment. This is crucial when:

- **Preventing race conditions:** Ensuring that multiple processes do not modify shared resources simultaneously.
- **Coordinating tasks:** Managing access to shared databases, files, or services across different nodes.
- **Maintaining data consistency:** Guaranteeing that concurrent operations do not result in inconsistent states.

By partitioning locks among nodes controlled by Raft Groups, Kahuna offers:

- **Consistency:** Data is replicated to 
- **Reliability:** Raft consensus ensures that partition data remains consistent even in the face of network failures.
- **Simplicity:** A straightforward API based on leases makes it easy to integrate distributed locking into your applications.

### API

Kahuna exposes a simple API for acquiring and releasing locks. The main functions are:

#### Lock

```csharp
(bool Locked, long FencingToken) TryLock(string resource, string owner, int expiresMs, Consistency consistency);
```

- **resource:** The identifier for the resource you want to lock.
- **owner:** A unique identifier for the lock, usually associated with the client or process requesting the lock.
- **expiresMs:** The expiration time for the lock in milliseconds.
- **consistency:** Linearizable (strong) or Ephemeral.

**Returns:**
- **Locked:** `true` if the lock was successfully acquired.
- **FencingToken:** A global counter indicating the number of times the lock has been acquired. 

#### Unlock

```csharp
(bool Unlocked) Unlock(string resource, string owner);
```

- **resource:** The identifier for the resource to unlock.
- **owner:** The unique identifier for the lock previously used to acquire the lock. 

**Returns:**
- **Unlocked:** `false` if the resource was successfully unlocked.

#### Extend

```csharp
(bool Extended, long FencingToken) Extend(string resource, string owner, int expiresMs);
```

- **resource:** The identifier for the resource you want to extend.
- **owner:** A unique identifier for the lock, usually associated with the client or process requesting the lock. It must be the current owner of the lock.
- **expiresMs:** The expiration time for the lock in milliseconds.

**Returns:**
- **Extended:** `true` if the lock was successfully extended.
- **FencingToken:** A global counter indicating the number of times the lock has been acquired. 

### Leases

Distributed locks in Kahuna are based on the paper [*"Leases: An Efficient
Fault-Tolerant Mechanism for Distributed File Cache Consistency"*](https://web.stanford.edu/class/cs240/readings/leases.pdf) by Michael N. Nelson, Brent B. Welch, and John K. Ousterhout.
It introduced the concept of **leases** as a way to manage distributed locks efficiently.
Leases act as time-bound locks that expire after a specified duration,
providing a balance between strong consistency and fault tolerance.

- **Automatic Lock Expiration**: Leases expire after a predefined time,
eliminating the need for manual lock release. This is particularly useful if a client holding a lock crashes or becomes unreachable, as the system can reclaim the resource once the lease expires.
- **No Need for Explicit Unlock**: Despite Kahuna clients sent explicit unlocks, clients
don't need to explicitly release them, which reduces the complexity of
handling failures and network partitions.
- **Reduced Lock Contention**: Since leases are time-bound, even if a client misbehaves or gets disconnected, other clients will eventually be able to acquire the lock after the lease expires.
- **Graceful Degradation**: In the event of partial failures (e.g., network partitions), the system can still make progress once the lease times out.

Do leases provide mutual exclusion? No, leases by themselves do not provide mutual exclusion.

While Kahuna leases help in expiring keys and releasing locks if a client fails, they don’t inherently protect against scenarios where:

- A client pauses (e.g., due to a long GC pause or network partition) and later resumes, believing it still holds the lock, even though the lease has expired.
- This could lead to split-brain where two clients believe they own the same lock.

### Fencing Tokens

A fencing token is a monotonically increasing number (e.g., version number) issued every time a lock is acquired.
It acts as a logical timestamp to resolve stale client operations.

How Leases + Fencing Tokens can provide Strong Mutual Exclusion:

#### Lock Acquisition:

A client tries to acquire a lock by creating a key in Kahuna (e.g., my-lock-resource) with a lease.
Along with the key, Kahuna maintains a fencing token — typically an incrementing counter.

#### Using the Fencing Token:

When a client successfully acquires the lock, it receives the fencing token.
All downstream services that the client interacts with must validate the fencing token.
These services should reject any operation with a stale fencing token (i.e., a token lower than the highest one they've seen).

#### Handling Client Failures:

If a client pauses or crashes and its lease expires, Kahuna deletes the lock key.
Another client can now acquire the lock with a new lease and gets a higher fencing token.
Even if the first client resumes and tries to perform actions, downstream systems will reject its operations because its fencing token is outdated.

Example Flow:

- Client A acquires the lock with fencing token #5.
- Client A writes to a resource, passing #5.
- Client A experiences a network partition or pause.
- Kahuna lease expires, and Client B acquires the lock with fencing token #6.
- Client B writes to the same resource, passing #6.
- Client A comes back online and tries to write again with fencing token #5, but downstream systems reject it because they've already processed token #6.