import Kahuna2 from '../assets/kahuna2.png';

# Tutorial: Distributing Locking

<div style={{textAlign: 'center'}}>
<img src={Kahuna2} height="350" />
</div>

Distributed locking is a critical pattern used to coordinate access to shared resources in distributed systems where multiple nodes, services or processes might try to modify the same resource concurrently. It ensures mutual exclusion, consistency and safe concurrent behavior.

The **distributed locks** system can be used for **leader election, safe deployments, preventing double execution of scheduled jobs**. In this tutorial, you will learn how it works.

## Basic Example : Preventing Double Payments

The general idea of a distributed lock is that only one process can acquire the lock at a time, while other processes that attempt to acquire it concurrently must either retry or give up. This condition where only one process can hold the lock at a time is what ensures the safety of executing certain critical operations without risking double processing or data duplication.

In this example, the lock key is set with a **[lease](../distributed-locks/leases)**. If the process crashes or fails to delete the lock key, the lock will automatically expire and be cleaned up after the lease time ends (e.g., 60 seconds). This helps ensure that locks are not left dangling if something goes wrong.

```csharp
// Create a Kahuna client (it can be a global instance)
var client = new KahunaClient("http://localhost:8002");

string paymentLockKey = "payment_lock_" + paymentId;

try
{
    // Attempt to acquire the lock by setting a value with a lease
    // if acquired then automatically release the lock after 20 seconds to prevent lock lingering
    // it will give up immediately if the lock is not available,

    await using KahunaLock paymentLease = await client.GetOrCreateLock(
        paymentLockKey,
        TimeSpan.FromSeconds(20)
    );

    if (paymentLease.IsAcquired)
    {
        // Proceed with payment processing
        await ProcessPayment(paymentId);
    }
    else
    {
        // Payment is already in progress, abort the operation
        Console.WriteLine("Payment is already being processed. Please try again later.");
    }
}
catch (Exception ex)
{
    Console.WriteLine($"Error: {ex.Message}");
}
```

If multiple services or workers are trying to process the same payment concurrently, Kahuna’s distributed locks will serialize access to the paymentLockKey, ensuring that only one worker can process the payment at a time, preventing double payments.

Even with the distributed lock in place, we might want to make the payment process idempotent. This can be done by storing the transaction status in a database and ensuring that any re-attempt to process the same payment is recognized as already completed, regardless of whether the lock was acquired.

This combination of a distributed lock with a lease mechanism in etcd and idempotent operations should provide a reliable way to prevent double payments.

### High-Volume Job Scheduling in Microservices

Now let’s imagine the following scenario, where it’s necessary to retry acquiring a lock in case it’s already held. A distributed job scheduler is running across several servers. Every time a new job enters a processing queue, one of the scheduler instances must acquire the lock to pick up and process the job.

Why Frequent Retries? The tasks are small and executed quickly, so the lock is held only for a very short window. However, because jobs are coming in rapidly, multiple scheduler instances constantly attempt to acquire the lock as soon as it becomes available. This often results in one process grabbing the lock, completing its task, releasing it almost immediately, and then another process, which might have been waiting, seizing the opportunity.

```csharp
// Create a Kahuna client (it can be a global instance)
var client = new KahunaClient("http://localhost:8002");

try
{
    // Attempt to acquire the queue lock with a lease
    // if acquired then automatically release the lock after 10 seconds 
    // or when the block is left.
    // Wait to acquire the lock for a total time of 8 seconds and retry every 250 ms
    // it will give up if the lock can't be acquired after retrying for 8 seconds

    while (true)
    {
        await using KahunaLock queueLock = await client.GetOrCreateLock(
            "job-queue-lock",
            expiry: TimeSpan.FromSeconds(10),
            wait: TimeSpan.FromSeconds(8),
            retry: TimeSpan.FromMilliseconds(250)
        );

        if (queueLock.IsAcquired)
        {
            // Fetch a job from the queue and process it
            await FetchFromQueueAndProcess();
            return;
        }

        // Other worker is fetching jobs from the queue
        Console.WriteLine("Lock was busy for 8 seconds, retry later...");

        await Task.Delay(5000);
    }
}
catch (Exception ex)
{
    Console.WriteLine($"Error: {ex.Message}");
}
```

This scenario is common in systems that use distributed task queues (e.g., using RabbitMQ, Kafka, or Redis) in combination with Kahuna to ensure that only one instance processes a job at a time while maintaining high throughput.

### Prevent double backup process

While the locking system can generally be used from an application via a **[Kahuna client](../dotnet-client)** for a specific programming language, it can also be used from the command line with **[kahuna-cli](../kahuna-cli)** to assist with DevOps scripts. In the following example, we’ll use a distributed lock to prevent two processes on different nodes from attempting to back up a PostgreSQL database at the same time:

```bash
#!/bin/bash

# Try to lock the resource "backup-lock" for 1 min
IS_BACKUP_RUNNING=$(kahuna-cli --lock backup-lock --expires 60000 --format json | jq .isAcquired)

if [ "$IS_BACKUP_RUNNING" = "false" ]; then
   # if the lock is already taken give up and show a message
   echo "Backup is already running on another machine!"
   exit 1
fi

# We acquired the lock then we can safely run the backup
pg_dump -h pgserver-dev.company.internal -U backup-user -d company -f /var/backups/company_backup.sql

# Release the lock if the backup finished before 1 min
# if the process crashes the lease will be automatically freed after 1 min
kahuna-cli --unlock backup-lock --format json

```

Distributed locks have many more practical use cases in real-world applications. You can find more examples in the **[distributed locks](../distributed-locks)** documentation and in the **[Kahuna Client](../dotnet-client)** page. In the next section, we’ll learn how to use the distributed sequencer.