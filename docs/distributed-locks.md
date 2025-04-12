
# Distributed Locks

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

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
- **Safe Deployment CI/CD Coordination**: Prevent multiple CI/CD pipelines from deploying the same environment simultaneously. Two deployment jobs could conflict and cause downtime. Use a lock to serialize deployments.
- **Database Migration Coordination**: Ensure that only one service performs schema migration at startup. If multiple services run migrate up concurrently, it may corrupt the schema. Use a lock to ensure only the first instance runs migrations.
- **Session Control / Login Exclusivity**: Allow only one active session per user. Used in banking apps, gaming, admin consoles, etc.
- **Distributed Queue Consumer Coordination**: Ensure that a message from a queue is only processed once, even with multiple consumers.
- **Throttling or Rate-Limiting Across Services**: Enforce a global rate limit across many service instances. 
- **External System Coordination**: Ensure only one node writes to an external system (e.g., shared database, billing API, payment gateway) to avoid double charges or inconsistent writes.

## API

Kahuna exposes a simple API for acquiring and releasing locks. The main functions are:

#### Lock

<Tabs>
<TabItem value="API">

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
</TabItem>
<TabItem value="CLI">

Acquire a lease on the resource `locks/tasks/123` for 10 seconds in the interactive shell:

```visual-basic
kahuna-cli>  lock locks/tasks/123 10000               
f1 acquired 786f947d8a6643f0b939865f72aa512a
```

Acquire a lease using command line arguments:

```bash
~> kahuna-cli --lock locks/tasks/123 --format console
f4 acquired 4e3c5d8ee76a4a1db268c81b048a002a
```

</TabItem>
<TabItem value="C#">

Below is a basic example to demonstrate how to acquire a distributed lock in a C# project:

```csharp
await using KahunaLock myLock = await client.GetOrCreateLock(
    "balance-" + userId, 
    TimeSpan.FromSeconds(5)
);

if (myLock.IsAcquired)
{
    Console.WriteLine("Lock acquired!");

    // implement exclusive logic here
}
```
</TabItem>

<TabItem value="Rest">

Acquiring a lock from the Rest API:

```bash
curl --location 'https://localhost:8082/v1/locks/try-lock' \
    --header 'Content-Type: application/json' \
    --data '{"resource":"locks/tasks/123", "owner":"e5943062358144b4b0bbff8868f7063d", "expiresMs":10000, "durability":0 }'
```

Response:

```json
{"type": 0, "fencingToken": 0}
```

</TabItem>

</Tabs>

---

#### Unlock

<Tabs>
<TabItem value="API">

```csharp
(bool Unlocked) Unlock(string resource, string owner);
```

- **resource:** The identifier for the resource to unlock.
- **owner:** The unique identifier for the lock previously used to acquire the lock. 

**Returns:**
- **Unlocked:** `false` if the resource was successfully unlocked.

</TabItem>
<TabItem value="CLI">

Unlock the acquired lease on the resource `locks/tasks/123` in the interactive shell:

```visual-basic
kahuna-cli> lock locks/tasks/123 10000
f1 acquired 786f947d8a6643f0b939865f72aa512a

kahuna-cli> unlock locks/tasks/123
f1 unlocked
```

Unlock the acquired lease using command line arguments:

```bash
$ kahuna-cli --lock locks/tasks/123 --expires 60000
f4 acquired 4e3c5d8ee76a4a1db268c81b048a002a

$ kahuna-cli --unlock-lock locks/tasks/123 --owner 4e3c5d8ee76a4a1db268c81b048a002a
f4 unlocked
```

</TabItem>
<TabItem value="C#">

Below is a basic example to demonstrate how to acquire a distributed lock in a C# project. 

```csharp
KahunaLock myLock = await client.GetOrCreateLock(
    "balance-" + userId, 
    TimeSpan.FromSeconds(5)
);

if (myLock.IsAcquired)
{
    Console.WriteLine("Lock acquired!");

    // implement exclusive logic here
}

// Manually release the lock
await myLock.DisposeAsync();
```
</TabItem>
<TabItem value="Rest">

```bash
curl --location 'http://localhost:8083/v1/locks/try-unlock' \
--header 'Content-Type: application/json' \
--data '{"resource": "locks/tasks/123", "owner": "e5943062358144b4b0bbff8868f7063d", "durability": 1}'
```

Response:

```
{"type": 0, "fencingToken": 0}
```

</TabItem>
</Tabs>

---

#### Extend

<Tabs>
<TabItem value="API">

```csharp
(bool Extended, long FencingToken) Extend(string resource, string owner, int expiresMs);
```

- **resource:** The identifier for the resource you want to extend.
- **owner:** A unique identifier for the lock, usually associated with the client or process requesting the lock. It must be the current owner of the lock.
- **expiresMs:** The expiration time for the lock in milliseconds.

**Returns:**
- **Extended:** `true` if the lock was successfully extended.
- **FencingToken:** A global counter indicating the number of times the lock has been acquired. 

</TabItem>
<TabItem value="CLI">

Extends the acquired lease on the resource `locks/tasks/123` in the interactive shell:

```visual-basic
kahuna-cli> lock locks/tasks/123 10000
f1 acquired 449941a969f74f8eb3d81cc70e5ab2ae

kahuna-cli> extend-lock locks/tasks/123 60000
f1 extended 449941a969f74f8eb3d81cc70e5ab2ae
```

Extend the acquired lease using command line arguments:

```bash
$ kahuna-cli --lock locks/tasks/123 --expires 60000
f4 acquired 4e3c5d8ee76a4a1db268c81b048a002a

$ kahuna-cli --extend-lock locks/tasks/123 --owner 4e3c5d8ee76a4a1db268c81b048a002a --expires 60000 
f4 extended 
```
</TabItem>
<TabItem value="C#">

How to acquire a distributed lock and then extend it in a c# project:

```csharp
await using KahunaLock myLock = await client.GetOrCreateLock(
    "balance-" + userId, 
    TimeSpan.FromSeconds(5)
);

if (myLock.IsAcquired)
{
    Console.WriteLine("Lock acquired!");

    // implement exclusive logic here

    // Extend the lock
    await myLock.TryExtend(TimeSpan.FromSeconds(60));
}

```
</TabItem>
<TabItem value="Rest">

```bash
curl --location 'http://localhost:8083/v1/locks/try-extend' \
--header 'Content-Type: application/json' \
--data '{"resource": "locks/tasks/123", "owner": "e5943062358144b4b0bbff8868f7063d", "expiresMs": 60000, "durability": 0}'
```

Response:

```json
{"type": 0, "fencingToken": 0}
```

</TabItem>

</Tabs>

---

#### Get

<Tabs>
<TabItem value="API">

```csharp
(string Owner, long FencingToken) Get(string resource);
```

- **resource:** The identifier for the resource you want to get information.

**Returns:**
- **Owner:** The current owner of the lock.
- **FencingToken:** A global counter indicating the number of times the lock has been acquired. 

</TabItem>
<TabItem value="CLI">

Obtains information about the lock `locks/tasks/123` in the interactive shell:

```visual-basic
kahuna-cli> lock locks/tasks/123 10000
f1 acquired 449941a969f74f8eb3d81cc70e5ab2ae

kahuna-cli> get-lock locks/tasks/123
f9 fa020530242546798d7c349437665071
```

Obtain information about the lock using command line arguments:

```bash
$ kahuna-cli --lock locks/tasks/123 --expires 60000
f4 acquired 4e3c5d8ee76a4a1db268c81b048a002a

$ kahuna-cli --get-lock locks/tasks/123
f4 4e3c5d8ee76a4a1db268c81b048a002a
```
</TabItem>
<TabItem value="C#">

Obtain information about a lock in a c# project:

```csharp
await using KahunaLock myLock = await client.GetOrCreateLock(
    "group-leader-" + groupId,
    expiry: TimeSpan.FromSeconds(5)
);

if (!myLock.IsAcquired)
{
    Console.WriteLine("Lock not acquired!");

    var lockInfo = await myLock.GetInfo();

    Console.WriteLine($"Lock owner: {lockInfo.Owner}");
    Console.WriteLine($"Expires: {lockInfo.Expires}");
}

```
</TabItem>
<TabItem value="Rest">

```bash
curl --location 'http://localhost:8083/v1/locks/get-info' \
--header 'Content-Type: application/json' \
--data '{"resource": "locks/tasks/123", "durability": 0}'
```

Response:

```json
{"type": 0, "owner": "4e3c5d8ee76a4a1db268c81b048a002a", "fencingToken": 4}
```

</TabItem>

</Tabs>