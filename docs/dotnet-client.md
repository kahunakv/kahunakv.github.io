
# Client for .NET

Kahuna also provides a client tailored for .NET developers. This client simplifies the integration of distributed locking into your .NET applications by abstracting much of the underlying complexity. Documentation and samples for the client can be found in the `docs/` folder or on our [GitHub repository](https://github.com/kahunakv/kahuna).

## Client Installation

Kahuna Client for .NET is available as a NuGet package. You can install it via the .NET CLI:

```bash
dotnet add package Kahuna.Client
```

Or via the NuGet Package Manager:

```powershell
Install-Package Kahuna.Client
```

## Locks: Usage & Examples

### Single attempt to acquire a lock

Below is a basic example to demonstrate how to use Kahuna Distributed Locks in a C# project:

```csharp
using Kahuna.Client;

// Create a Kahuna client (it can be a global instance)
var client = new KahunaClient("https://localhost:8082");

// ...

public async Task UpdateBalance(KahunaClient client, string userId)
{
    // try to lock on a resource using a keyName composed of a prefix and the user's id,
    // if acquired then automatically release the lock after 5 seconds (if not extended),
    // it will give up immediately if the lock is not available,
    // if the lock is acquired it will prevent the same user from changing the same data concurrently

    await using KahunaLock myLock = await client.GetOrCreateLock(
        "balance-" + userId,
        TimeSpan.FromSeconds(5)
    );

    if (myLock.IsAcquired)
    {
        Console.WriteLine("Lock acquired!");

        // implement exclusive logic here
    }
    else
    {
        Console.WriteLine("Someone else has the lock!");
    }

    // myLock is automatically released after leaving the method
}
```

### Multiple attempts to acquire a lock

The following example shows how to make multiple attempts to acquire a lock (lease) for 10 seconds, retrying every 150 ms.

Why Frequent Retries? Given that inventory updates are very short operations (typically milliseconds to a few seconds),
each update releases the lock quickly. Still, with a massive volume of concurrent purchase attempts, the lock is rapidly cycled through many clients.
As a result, individual servers might find that the lock is released often, but due to high contention,
they need to retry multiple times until one of them succeeds.

```csharp
using Kahuna.Client;

public async Task UpdateBalance(KahunaClient client, string userId)
{
    // try to lock on a resource using a keyName composed of a prefix (balance) and the user's id,
    // if acquired then automatically release the lock after 5 seconds or when leaving the method (if not extended),
    // if not acquired retry to acquire the lock every 150 milliseconds for 10 seconds,
    // it will give up after 10 seconds if the lock is not available,
    // if the lock is acquired it will prevent the same user from changing the balance concurrently

    await using KahunaLock myLock = await client.GetOrCreateLock(
        "balance-" + userId,
        expiry: TimeSpan.FromSeconds(5),
        wait: TimeSpan.FromSeconds(10),
        retry: TimeSpan.FromMilliseconds(150)
    );

    if (myLock.IsAcquired)
    {
        Console.WriteLine("Lock acquired!");

        // implement exclusive logic here
    }
    else
    {
        Console.WriteLine("Someone else has the lock!");
    }

    // myLock is automatically released after leaving the method
}
```

### Fencing Tokens

Whenever possible, it is also important to use the fencing tokens.
Even if a client thinks it holds the lock post-lease expiration, fencing tokens prevent stale writes.
In this example, the fencing token is used to perform optimistic locking:

```csharp
using Kahuna.Client;

public async Task IncreaseBalance(KahunaClient client, string userId, long amount)
{
    // try to lock on a resource holding the lease for 5 seconds
    // and prevent stale clients from modifying data after losing their lock.

    await using KahunaLock myLock = await client.GetOrCreateLock(
        "balance-" + userId,
        expiry: TimeSpan.FromSeconds(5)
    );

    if (myLock.IsAcquired)
    {
        Console.WriteLine("Lock acquired!");

        BalanceAccount account = await db.GetBalance(userId);

        if (account.FencingToken > myLock.FencingToken)
        {
            // Write rejected: Stale fencing token

            Console.WriteLine("Someone else had the lock!");
            return;
        }

        // Write successful: New balance saved with new fencing token

        account.Balance += amount;
        account.FencingToken = myLock.FencingToken;

        await db.Save(account);
    }
    else
    {
        Console.WriteLine("Someone else has the lock!");
    }

    // myLock is automatically released after leaving the method
}
```

### Periodically extend a lock

At times, it is useful to periodically extend the lock's expiration time while a client holds it, for example, in a leader election scenario.
As long as the leader node is alive and healthy, it can extend the lock duration to signal that it can continue acting as the leader:

```csharp
using Kahuna.Client;

public async Task TryChooseLeader(KahunaClient client, string groupId)
{
    await using KahunaLock myLock = await client.GetOrCreateLock(
        "group-leader-" + groupId,
        expiry: TimeSpan.FromSeconds(10)
    );

    if (!myLock.IsAcquired)
    {
        Console.WriteLine("Lock not acquired!");
        return;
    }

    long acquireFencingToken = myLock.FencingToken;

    while (true)
    {
        (bool isExtended, long fencingToken) = await myLock.TryExtend(TimeSpan.FromSeconds(10));
        if (!isExtended)
        {
            Console.WriteLine("Lock extension failed!");
            break;
        }

        if (fencingToken != acquireFencingToken)
        {
            Console.WriteLine("Lock fencing token changed! Someone else took the lock");
            break;
        }

        // wait 5 seconds to extend the lock
        await Task.Delay(5000);
    }
}
```

### Retrieve information about a lock

You can also retrieve information about a lock, such as the current lock's owner and remaining time for the lock to expire:

```csharp
using Kahuna.Client;

public async Task TryChooseLeader(KahunaClient client, string groupId)
{
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
}
```

### Configure a pool of endpoints

If you want to configure a pool of Kahuna endpoints belonging to the same cluster so that traffic is distributed in a round-robin manner:

```csharp
using Kahuna.Client;

// Create a Kahuna client with a pool of endpoints
var client = new KahunaClient([
    "https://localhost:8082",
    "https://localhost:8084",
    "https://localhost:8086"
]);

// ...
```

Using a pool of reachable endpoints instead of a load balancer can help reduce network latency, as the client can connect directly to healthy nodes without going through an additional proxy layer.

However, this comes at the cost of reduced flexibility when adding, removing, or reconfiguring nodes in the cluster. Without a centralized load balancer, the client must be manually updated or be able to discover and manage endpoint changes dynamically.

This trade-off is common in high-performance distributed systems that prioritize low latency and direct communication over automatic infrastructure abstraction.

### Specify durability type

You can also specify the desired durability type when acquiring a lock:

```csharp
using Kahuna.Client;

public async Task UpdateBalance(KahunaClient client, string userId)
{
    // acquire a lock with persistent durability, ensuring that the lock state is
    // replicated across all nodes in the Kahuna cluster
    // in case of failure or network partition, the lock state is guaranteed to be durable

    await using KahunaLock myLock = await client.GetOrCreateLock(
        "balance-" + userId,
        TimeSpan.FromSeconds(300), // lock for 5 mins
        durability: LockDurability.Persistent
    );

    if (myLock.IsAcquired)
    {
        Console.WriteLine("Lock acquired with strong consistency!");

        // implement exclusive logic here
    }
    else
    {
        Console.WriteLine("Someone else has the lock!");
    }

    // myLock is automatically released after leaving the method
}
```

Learn more about the supported [durabilities](/docs/architecture/durability-levels.md).

## Key/Values: Usage & Examples

## Basic Usage

...

## Transactions

Using the **C# client**, developers can execute both **Kahuna Scripts** and **interactive transactions**, depending on what best suits their use case.

This flexibility allows for choosing between:

- **Kahuna Scripts** for atomic, server-side logic with minimal latency.
- **Interactive transactions** for full control using C# code and external libraries.

Developers can switch between both approaches as needed to balance performance, maintainability, and complexity.

### Scripts

Kahuna Scripts can be loaded from their string representation and executed in C# like this:

```csharp
const string script = """
let inventory_key = get @inventory_key
let requested_amount = get @requested_amount

let inventory = to_int(inventory_key)
let requested = to_int(requested_amount)

if current >= requested then
  set inventory_key inventory - requested
  return 1
else
  return 0
end
""";

var result = await client.ExecuteKeyValueTransactionScript(
    script,
    null, 
    [
        new() { Key = "@inventory_key", Value = userInventoryKey },
        new() { Key = "@requested_amount", Value = "100" }        
    ]
);

Console.WriteLine("Result={0}", result.FirstValueAsString);

```

The recommended way to execute scripts is to pass all dynamic values as parameters, rather than embedding them directly in the script. This allows the server to reuse the execution plan across different calls with different inputs, improving performance and preventing security issues such as script injection.

Avoid this:

```csharp
await client.ExecuteKeyValueTransactionScript("SET " + key + " " + value);
```

Prefer this:

```csharp
await client.ExecuteKeyValueTransactionScript(
    "SET @key @value", 
    null, 
    [
        new() { Key = "@key", Value = key },
        new() { Key = "@value", Value = value }        
    ]
);
```

This pattern leads to safer, faster, and more maintainable use of Kahuna Scripts.

Another good practice is to load scripts during an initialization process so they can be reused many times later. This reduces memory usage and helps the server reuse the execution plan, improving performance and lowering overhead:

```csharp
public class SessionChecker
{
    private readonly KahunaTransactionScript kahunaScript;
    
    public SessionChecker(KahunaClient client)
    {
        const string myScript = """
        let exists_key = exists @session_key
        if exists_key then
         extend @session_key @ttl_in_seconds
         return 1
        end
        return 0
        """;
        
        kahunaScript = client.LoadTransactionScript(myScript);
    }
    
    public async Task<bool> CheckSession(string sessionKey, string ttlInSeconds)
    {
        var result = await kahunaScript.Run([
            new() { Key = sessionKey, Value = ttlInSeconds }
        ]);

        var extended = result.FirstValueAsString ?? "0";

        return extended == "1";
    }
}
```

By avoiding re-parsing and re-planning on every call, this approach makes script execution more efficient, especially in high-throughput scenarios. It also makes code easier to maintain by separating logic from runtime logic injection.

### Interactive Transactions

With interactive transactions, developers can execute transactional flows directly from C# without the need to use Kahuna Scripts.

This gives programmers full control over the transaction logic using familiar language constructs, while still benefiting from Kahuna’s consistency guarantees, distributed coordination, and support for multi-key operations:

```csharp
await using var session = await client.StartTransactionSession(
    new() {
      Locking = KeyValueTransactionLocking.Optimistic,
      Timeout = 5000
    }
);

var balance1 = await session.GetKeyValue(userA);
var balance2 = await session.GetKeyValue(userB);

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
var txOptions = new KahunaTransactionOptions()
{ 
    Locking = KeyValueTransactionLocking.Pessimistic,
    Timeout = 5000
};

await client.RetryableTransaction(txOptions, async (session, cancellationToken) =>
{
    var balance1 = await session.GetKeyValue(userA);
    var balance2 = await session.GetKeyValue(userB);

    if (balance1.ValueAsLong() >= 50)
    {
        await session.SetKeyValue(userA, balance1.ValueAsLong() - 50);
        await session.SetKeyValue(userB, balance2.ValueAsLong() + 50);
    }

    await session.Commit();
});

```
