"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[6774],{4462:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>l,contentTitle:()=>c,default:()=>d,frontMatter:()=>o,metadata:()=>i,toc:()=>u});const i=JSON.parse('{"id":"tutorials/distributed-locking","title":"Tutorial: Distributing Locking","description":"Distributed locking is a critical pattern used to coordinate access to shared resources in distributed systems where multiple nodes, services or processes might try to modify the same resource concurrently. It ensures mutual exclusion, consistency and safe concurrent behavior.","source":"@site/docs/tutorials/distributed-locking.md","sourceDirName":"tutorials","slug":"/tutorials/distributed-locking","permalink":"/docs/tutorials/distributed-locking","draft":false,"unlisted":false,"editUrl":"https://github.com/kahunakv/kahunakv.github.io/tree/main/docs/tutorials/distributed-locking.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Tutorial: Key/Value Store","permalink":"/docs/intro"},"next":{"title":"Tutorial: Distributing Sequencer","permalink":"/docs/tutorials/distributed-sequencer"}}');var s=t(4848),a=t(8453);const r=t.p+"assets/images/kahuna2-3712013e125e8689b646357ffcc093bc.png",o={},c="Tutorial: Distributing Locking",l={},u=[{value:"Basic Example : Preventing Double Payments",id:"basic-example--preventing-double-payments",level:2},{value:"High-Volume Job Scheduling in Microservices",id:"high-volume-job-scheduling-in-microservices",level:3},{value:"Prevent double backup process",id:"prevent-double-backup-process",level:3}];function h(e){const n={a:"a",code:"code",h1:"h1",h2:"h2",h3:"h3",header:"header",p:"p",pre:"pre",strong:"strong",...(0,a.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.header,{children:(0,s.jsx)(n.h1,{id:"tutorial-distributing-locking",children:"Tutorial: Distributing Locking"})}),"\n",(0,s.jsx)("div",{style:{textAlign:"center"},children:(0,s.jsx)("img",{src:r,height:"350"})}),"\n",(0,s.jsx)(n.p,{children:"Distributed locking is a critical pattern used to coordinate access to shared resources in distributed systems where multiple nodes, services or processes might try to modify the same resource concurrently. It ensures mutual exclusion, consistency and safe concurrent behavior."}),"\n",(0,s.jsxs)(n.p,{children:["The ",(0,s.jsx)(n.strong,{children:"distributed locks"})," system can be used for ",(0,s.jsx)(n.strong,{children:"leader election, safe deployments, preventing double execution of scheduled jobs"}),". In this tutorial, you will learn how it works."]}),"\n",(0,s.jsx)(n.h2,{id:"basic-example--preventing-double-payments",children:"Basic Example : Preventing Double Payments"}),"\n",(0,s.jsx)(n.p,{children:"The general idea of a distributed lock is that only one process can acquire the lock at a time, while other processes that attempt to acquire it concurrently must either retry or give up. This condition where only one process can hold the lock at a time is what ensures the safety of executing certain critical operations without risking double processing or data duplication."}),"\n",(0,s.jsxs)(n.p,{children:["In this example, the lock key is set with a ",(0,s.jsx)(n.strong,{children:(0,s.jsx)(n.a,{href:"../distributed-locks/leases",children:"lease"})}),". If the process crashes or fails to delete the lock key, the lock will automatically expire and be cleaned up after the lease time ends (e.g., 60 seconds). This helps ensure that locks are not left dangling if something goes wrong."]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-csharp",children:'// Create a Kahuna client (it can be a global instance)\nvar client = new KahunaClient("http://localhost:8002");\n\nstring paymentLockKey = "payment_lock_" + paymentId;\n\ntry\n{\n    // Attempt to acquire the lock by setting a value with a lease\n    // if acquired then automatically release the lock after 20 seconds to prevent lock lingering\n    // it will give up immediately if the lock is not available,\n\n    await using KahunaLock paymentLease = await client.GetOrCreateLock(\n        paymentLockKey,\n        TimeSpan.FromSeconds(20)\n    );\n\n    if (paymentLease.IsAcquired)\n    {\n        // Proceed with payment processing\n        await ProcessPayment(paymentId);\n    }\n    else\n    {\n        // Payment is already in progress, abort the operation\n        Console.WriteLine("Payment is already being processed. Please try again later.");\n    }\n}\ncatch (Exception ex)\n{\n    Console.WriteLine($"Error: {ex.Message}");\n}\n'})}),"\n",(0,s.jsx)(n.p,{children:"If multiple services or workers are trying to process the same payment concurrently, Kahuna\u2019s distributed locks will serialize access to the paymentLockKey, ensuring that only one worker can process the payment at a time, preventing double payments."}),"\n",(0,s.jsx)(n.p,{children:"Even with the distributed lock in place, we might want to make the payment process idempotent. This can be done by storing the transaction status in a database and ensuring that any re-attempt to process the same payment is recognized as already completed, regardless of whether the lock was acquired."}),"\n",(0,s.jsx)(n.p,{children:"This combination of a distributed lock with a lease mechanism in Kahuna and idempotent operations should provide a reliable way to prevent double payments."}),"\n",(0,s.jsx)(n.h3,{id:"high-volume-job-scheduling-in-microservices",children:"High-Volume Job Scheduling in Microservices"}),"\n",(0,s.jsx)(n.p,{children:"Now let\u2019s imagine the following scenario, where it\u2019s necessary to retry acquiring a lock in case it\u2019s already held. A distributed job scheduler is running across several servers. Every time a new job enters a processing queue, one of the scheduler instances must acquire the lock to pick up and process the job."}),"\n",(0,s.jsx)(n.p,{children:"Why Frequent Retries? The tasks are small and executed quickly, so the lock is held only for a very short window. However, because jobs are coming in rapidly, multiple scheduler instances constantly attempt to acquire the lock as soon as it becomes available. This often results in one process grabbing the lock, completing its task, releasing it almost immediately, and then another process, which might have been waiting, seizing the opportunity."}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-csharp",children:'// Create a Kahuna client (it can be a global instance)\nvar client = new KahunaClient("http://localhost:8002");\n\ntry\n{\n    // Attempt to acquire the queue lock with a lease\n    // if acquired then automatically release the lock after 10 seconds \n    // or when the block is left.\n    // Wait to acquire the lock for a total time of 8 seconds and retry every 250 ms\n    // it will give up if the lock can\'t be acquired after retrying for 8 seconds\n\n    while (true)\n    {\n        await using KahunaLock queueLock = await client.GetOrCreateLock(\n            "job-queue-lock",\n            expiry: TimeSpan.FromSeconds(10),\n            wait: TimeSpan.FromSeconds(8),\n            retry: TimeSpan.FromMilliseconds(250)\n        );\n\n        if (queueLock.IsAcquired)\n        {\n            // Fetch a job from the queue and process it\n            await FetchFromQueueAndProcess();\n            return;\n        }\n\n        // Other worker is fetching jobs from the queue\n        Console.WriteLine("Lock was busy for 8 seconds, retry later...");\n\n        await Task.Delay(5000);\n    }\n}\ncatch (Exception ex)\n{\n    Console.WriteLine($"Error: {ex.Message}");\n}\n'})}),"\n",(0,s.jsx)(n.p,{children:"This scenario is common in systems that use distributed task queues (e.g., using RabbitMQ, Kafka, or Redis) in combination with Kahuna to ensure that only one instance processes a job at a time while maintaining high throughput."}),"\n",(0,s.jsx)(n.h3,{id:"prevent-double-backup-process",children:"Prevent double backup process"}),"\n",(0,s.jsxs)(n.p,{children:["While the locking system can generally be used from an application via a ",(0,s.jsx)(n.strong,{children:(0,s.jsx)(n.a,{href:"../dotnet-client",children:"Kahuna client"})})," for a specific programming language, it can also be used from the command line with ",(0,s.jsx)(n.strong,{children:(0,s.jsx)(n.a,{href:"../kahuna-cli",children:"kahuna-cli"})})," to assist with DevOps scripts. In the following example, we\u2019ll use a distributed lock to prevent two processes on different nodes from attempting to back up a PostgreSQL database at the same time:"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-bash",children:'#!/bin/bash\n\n# Try to lock the resource "backup-lock" for 1 min\nIS_BACKUP_RUNNING=$(kahuna-cli --lock backup-lock --expires 60000 --format json | jq .isAcquired)\n\nif [ "$IS_BACKUP_RUNNING" = "false" ]; then\n   # if the lock is already taken give up and show a message\n   echo "Backup is already running on another machine!"\n   exit 1\nfi\n\n# We acquired the lock then we can safely run the backup\npg_dump -h pgserver-dev.company.internal -U backup-user -d company -f /var/backups/company_backup.sql\n\n# Release the lock if the backup finished before 1 min\n# if the process crashes the lease will be automatically freed after 1 min\nkahuna-cli --unlock backup-lock --format json\n\n'})}),"\n",(0,s.jsxs)(n.p,{children:["Distributed locks have many more practical use cases in real-world applications. You can find more examples in the ",(0,s.jsx)(n.strong,{children:(0,s.jsx)(n.a,{href:"../distributed-locks",children:"distributed locks"})})," documentation and in the ",(0,s.jsx)(n.strong,{children:(0,s.jsx)(n.a,{href:"../dotnet-client",children:"Kahuna Client"})})," page. In the next section, we\u2019ll learn how to use the distributed sequencer."]})]})}function d(e={}){const{wrapper:n}={...(0,a.R)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(h,{...e})}):h(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>r,x:()=>o});var i=t(6540);const s={},a=i.createContext(s);function r(e){const n=i.useContext(a);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:r(e.components),i.createElement(a.Provider,{value:n},e.children)}}}]);