import Kahuna2 from '../assets/kahuna2.png';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Tutorial: Distributed Locking

Processes on different servers often compete for the same resource: two nodes run the same scheduled job, or two requests process the same payment. A **distributed lock** lets only one of them proceed at a time, like a `lock` statement shared by every server. Typical uses are **leader election, safe deployments, and preventing double execution of scheduled jobs**.

In this tutorial, you use Kahuna locks to prevent double payments, coordinate job workers, and keep two backups from running at once.

<div style={{textAlign: 'center'}}>
<img src={Kahuna2} height="250" />
</div>

## Basic Example : Preventing Double Payments

Only one process can hold a lock at a time. Other processes that try to acquire it must retry or give up, so only the lock holder runs the critical operation.

In this example, the lock has a 20-second **[lease](/docs/distributed-locks/leases/)**. If the process crashes or fails to release the lock, the lock expires when the lease ends, so it is never left dangling.

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
// Create a Kahuna client (it can be a global instance)
var client = new KahunaClient("https://localhost:8082");

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

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
import { KahunaClient } from "kahuna-client";

const client = new KahunaClient({
  endpoints: ["https://127.0.0.1:8082"],
  allowInsecureCertificateValidation: true
});

const paymentLockKey = "payment_lock_" + paymentId;

await using paymentLease = await client.acquireLock(paymentLockKey, {
  expiry: 20_000
});

if (paymentLease.acquired) {
  await processPayment(paymentId);
} else {
  console.log("Payment is already being processed. Please try again later.");
}
```

</TabItem>
</Tabs>

If several workers try to process the same payment at once, the lock on `paymentLockKey` lets only one of them proceed.

The lock does not remember that a payment already finished, so make the payment idempotent too: store its status in a database and treat any later attempt to process the same payment as already completed, whether or not that attempt acquired the lock. Together, the lock and the idempotent operation prevent double payments.

### High-Volume Job Scheduling in Microservices

Now imagine a job scheduler running on several servers. Every time a new job enters a processing queue, one scheduler instance must acquire a lock to pick up and process it.

The jobs are small and finish quickly, so each instance holds the lock only briefly. Because jobs arrive rapidly, the other instances try to acquire the lock as soon as it is free. Instead of giving up when the lock is busy, each instance waits and retries:

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
// Create a Kahuna client (it can be a global instance)
var client = new KahunaClient("https://localhost:8082");

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

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
while (true) {
  await using queueLock = await client.acquireLock("job-queue-lock", {
    expiry: 10_000,
    wait: 8000,
    retry: 250
  });

  if (queueLock.acquired) {
    await fetchFromQueueAndProcess();
    break;
  }

  console.log("Lock was busy for 8 seconds, retry later...");
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
```

</TabItem>
</Tabs>

This pattern appears in systems that combine a task queue, such as RabbitMQ, Kafka, or Redis, with Kahuna. One global lock serializes the workers: only one instance fetches and processes a job at a time, so throughput is limited by how long each worker holds the lock. To process jobs in parallel, lock each job instead, as in [Idempotent Jobs](/docs/recipes/idempotent-jobs/).

### Prevent double backup process

Locks also work from the command line with the **[Kahuna CLI](/docs/kahuna-cli/)**, which helps in operations scripts. This script uses a lock to keep two machines from backing up the same PostgreSQL database at the same time:

```bash
#!/bin/bash

# Try to lock the resource "backup-lock" for 1 min
export LOCK_DATA=$(kahuna-cli --lock backup-lock --expires 60000 --format json)

export LOCK_IS_ACQUIRED=$(echo $LOCK_DATA | jq .isAcquired)
export LOCK_OWNER=$(echo $LOCK_DATA | jq -r .owner)

if [ "$LOCK_IS_ACQUIRED" = "false" ]; then # if the lock is already taken give up and show a message
   echo "Backup is already running on another machine!"
   exit 1
fi

# We acquired the lock then we can safely run the backup
pg_dump -h pgserver-dev.company.internal -U backup-user -d company -f /var/backups/company_backup.sql

# Release the lock manually if the backup finished before 1 min
# if the process crashes the lease will be automatically freed after 1 min
kahuna-cli --unlock backup-lock --owner $LOCK_OWNER --format json

```

Find more use cases in **[Distributed Locks](/docs/distributed-locks/)** and in the [.NET](/docs/dotnet-client/) and [TypeScript/Node.js](/docs/typescript-client/) client pages. Next, learn how to use the **[distributed sequencer](/docs/tutorials/distributed-sequencer/)**.
