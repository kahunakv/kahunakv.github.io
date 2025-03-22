---
sidebar_position: 3
---

# Distributed Locks

A distributed lock is a mechanism that ensures that a specific resource is accessed by only one node or process at a time in a distributed environment. This is crucial when:

- **Preventing race conditions:** Ensuring that multiple processes do not modify shared resources simultaneously.
- **Coordinating tasks:** Managing access to shared databases, files, or services across different nodes.
- **Maintaining data durability:** Guaranteeing that concurrent operations do not result in inconsistent states.

By partitioning locks among nodes controlled by Raft Groups, Kahuna offers:

- **Reliability:** Raft consensus ensures that partition data remains consistent even in the face of network failures.
- **Simplicity:** A straightforward API based on leases makes it easy to integrate distributed locking into your applications.

## Use Cases 

- **Leader Election**: Elect a single leader in a cluster of services. Only one node should act as the leader at any time (e.g., for scheduling, replication). A distributed lock ensures only one process "wins" and holds the leadership.
- **Preventing Double Execution of Scheduled Jobs**: Ensure a cron job or background worker is executed only once across multiple nodes. In a horizontally scaled system, multiple nodes might try to run the same job. A distributed lock prevents multiple executions of the same scheduled task.
- **Safe Deployment / CI/CD Coordination**: Prevent multiple CI/CD pipelines from deploying the same environment simultaneously. Two deployment jobs could conflict and cause downtime. Use a lock to serialize deployments.
- **Database Migration Coordination**: Ensure that only one service performs schema migration at startup. If multiple services run migrate up concurrently, it may corrupt the schema. Use a lock to ensure only the first instance runs migrations.
- **Session Control / Login Exclusivity**: Allow only one active session per user. Used in banking apps, gaming, admin consoles, etc.
- **Distributed Queue Consumer Coordination**: Ensure that a message from a queue is only processed once, even with multiple consumers.
- **Throttling or Rate-Limiting Across Services**: Enforce a global rate limit across many service instances. 
- **External System Coordination**: Ensure only one node writes to an external system (e.g., shared database, billing API, payment gateway) to avoid double charges or inconsistent writes.


### API

Kahuna exposes a simple API for acquiring and releasing locks. The main functions are:

#### Lock

```csharp
(bool Locked, long FencingToken) TryLock(string resource, string owner, int expiresMs, Durability durability);
```

- **resource:** The identifier for the resource you want to lock.
- **owner:** A unique identifier for the lock, usually associated with the client or process requesting the lock.
- **expiresMs:** The expiration time for the lock in milliseconds.
- **durability:** Persistent or Ephemeral.

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
