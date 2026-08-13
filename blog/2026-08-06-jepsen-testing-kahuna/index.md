---
slug: jepsen-testing-kahuna
title: Breaking Kahuna on Purpose with Jepsen
authors: [andresgutierrez]
tags: [kahuna, jepsen, testing, distributed-systems]
---

# Breaking Kahuna on Purpose with Jepsen

Distributed systems usually look reliable when everything is healthy. The network is fast, every server is online, and requests arrive in a convenient order.

But what happens when a server loses contact with the rest of the cluster? What if a process stops while handling a request? What if Kahuna saves a value, but the reply never reaches the client?

We recently added a public [Jepsen test suite for Kahuna](https://github.com/kahunakv/kahuna-jepsen) to explore these difficult situations. It creates real Kahuna clusters, sends many requests at the same time, and introduces failures on purpose. It then checks whether Kahuna still keeps its promises.

Our goal is not only to see green test results. We want to find rare problems, understand them, and make sure they do not return.

<!-- truncate -->

## What Is Jepsen?

[Jepsen](https://github.com/jepsen-io/jepsen) is a testing framework for distributed systems. It records everything that happens during a test: when each request starts, when it finishes, what result it returns, and which failures happen at the same time.

Jepsen also runs a special process called a nemesis. The name sounds dramatic, but its job is simple: create trouble. It can split the network, stop servers, pause processes, and later bring everything back.

At the end, Jepsen studies the complete history and asks an important question: can all these results be explained without breaking the system's guarantees?

This is more powerful than checking HTTP status codes. Imagine that a client sends a write, Kahuna commits it, and the network loses the reply. The client sees a timeout, but the write may still exist. Jepsen keeps this uncertainty in its analysis instead of guessing that the write failed.

Our tests run against a five-node Kahuna cluster. Client requests use a different network port from the internal [Raft communication](/docs/architecture/raft). This allows us to interrupt replication between servers while clients can still send requests and observe the results.

The nightly tests use several kinds of failure:

- Network partitions separate some nodes from the others.
- Process kills stop servers immediately.
- Process pauses freeze a server without closing its connections.
- [Membership changes](/docs/server-configuration#raft-membership-and-catch-up) remove a server from the cluster and add it again as a fresh member.

These situations create the timing problems that are almost impossible to reproduce with normal tests.

## Four Workloads, Four Promises

There is no single test for all distributed-system behavior. A key/value store, a lock, a transaction, and a sequence generator each promise something different. Our suite therefore has four workloads.

### Key/value operations behave like one correct copy

The register workload sends reads, writes, and compare-and-set operations to different nodes in Kahuna's [distributed key/value store](/docs/distributed-keyvalue-store).

Compare-and-set means “change the value only if it still equals the value I expect.” For example, two clients may both try to change a value from 4 to 5. Only an operation based on the current value should succeed.

Jepsen uses a checker called Knossos to test each key for [linearizability](https://jepsen.io/consistency/models/linearizable). The word is technical, but the main idea is friendly: even though many servers and clients are involved, each successful operation should look as if it happened at one exact moment on one correct copy of the data.

Real-time order also matters. If a write finishes before a new read begins, the read must not return an older value.

This workload can catch an isolated server that still thinks it is the leader and returns stale data as if it were current.

### Locks keep owners apart and tokens moving forward

[Kahuna locks](/docs/distributed-locks) use [leases](/docs/distributed-locks/leases). A lease gives a client the lock for a limited time. If that client crashes, the lock can expire and another client can continue. Without expiration, one crashed client could block a resource forever.

Leases also create a challenge. An old client may wake up after its lease has expired and still believe it owns the lock. Kahuna uses [fencing tokens](/docs/distributed-locks/fencing-tokens) to protect other systems from this old owner. Every new owner receives a newer token, so a database or service can reject commands carrying an older one.

The lock workload checks two promises:

- Two different owners must not definitely hold the same valid lease at the same time.
- Fencing tokens must never go backwards, and a new owner must receive a higher token.

The checker understands that leases expire. It does not report a problem when an overlap can be explained by normal expiration or by a release whose reply was lost.

### Transactions behave like a safe serial order

The transaction workload runs [interactive transactions](/docs/distributed-keyvalue-store/transactions) that read lists and append unique values across several keys.

It uses a checker called Elle. Elle studies the relationships between transactions and looks for cycles that should be impossible. In simpler terms, it asks whether the completed transactions could have run one after another in some valid order, even though they actually ran at the same time.

This test can find problems that single-key checks cannot see:

- A lost update, where one successful write silently replaces another.
- An aborted read, where data from a failed transaction becomes visible.
- A dirty update, where a transaction builds on data that should never have committed.
- Write skew, where two transactions make decisions from old information and together break the expected ordering.

These bugs are difficult because each request may look correct by itself. The problem only becomes visible when we study the whole transaction history.

### Sequences never give the same value to two clients

Kahuna's [distributed sequencer](/docs/distributed-sequencer) can return one number or reserve a range of numbers. Clients can also retry a request with the same [idempotency key](/docs/distributed-sequencer/idempotency). An idempotency key tells the server, “this is the same logical request again, not a new one.”

The sequencer workload checks that:

- Two successful allocations never contain the same value.
- A reserved range has the size requested by the client.
- Retrying with the same idempotency key returns the original allocation.

The test allows gaps and values that arrive out of order. This is intentional. Kahuna gives nodes blocks of values that they can allocate quickly. A leader change may leave part of a block unused, creating a gap. That is safe because the important promise is uniqueness, not a perfect sequence with no missing numbers.

## What Does a Green Result Mean?

A green Jepsen result is strong evidence, but it is not a mathematical proof that every possible execution is correct.

It means that, for the requests, load, configuration, duration, and failures in that run, the checker found no broken guarantee. Another timing pattern may still reveal a rare bug. This is why we repeat tests with different request rates and shorter or longer periods between failures.

We also need to test the testers. During this work, our lock checker reported mutual-exclusion problems that did not really happen. It extended a client's lock period after a release reply was lost. We corrected the logic and added small test histories with known good and bad results. These negative controls prove that the checker can still detect a real violation.

An empty test is not a successful test either. If no transaction commits, there is nothing useful to analyze. If the sequencer returns too few values, its result is unknown. If the linearizability checker runs out of memory before it finishes, that result is also unknown—not green.

Being honest about these limits is an important part of reliable testing.

## The Tests Have Already Helped

The new suite started finding useful problems almost immediately.

The key/value workload found stale reads from a node that was separated from the majority. The node refused writes because it could not replicate them, which was correct. However, it still returned old values for reads as normal successful responses. Kahuna now confirms its leadership with the cluster before serving this kind of local read.

The lock workload found fencing tokens moving backwards after leader changes. One issue involved committed data during a restart. Another involved a new leader reading state before pending storage work was fully available. These failures needed a specific combination of timing and leadership changes, which made them difficult to find with ordinary tests.

The transaction workload found lost updates and data from aborted transactions becoming visible. It also found write skew in a mode where read validation should stop it. These investigations improved how Kahuna validates read-modify-write operations and how it records the final result when commit and rollback compete.

Jepsen also found less obvious problems. Some temporary network failures escaped as HTTP 500 responses instead of asking the client to retry. Some runs looked clean only because no useful operation finished. We even found a bug in our own lock checker.

Finding a checker bug is not wasted time. The test suite is software too, and we must verify its assumptions with the same care that we apply to Kahuna.

Every run keeps its history, timeline, latency charts, result details, and server logs. This gives us evidence that connects a visible failure to a particular event in the cluster. It is much more useful than a message that only says “the test failed.”

## Why It Runs Nightly

The Jepsen suite runs every night and can also be started manually against a selected version of Kahuna. Different jobs combine the four workloads with different failures. Membership testing runs for longer because removing and safely adding a cluster member can take one or two minutes.

We do not plan to make Jepsen a required check for every pull request. These tests are expensive and intentionally unpredictable. A slow shared runner can create extra timeouts and a history that is too large to analyze. A noisy required check soon becomes a check that everybody ignores.

A failed nightly run asks us to download the artifacts and investigate. A clean run adds more confidence. Neither one replaces unit tests, focused regression tests, code review, or [performance benchmarks](/docs/benchmarking).

## What Comes Next?

The next major workload will focus on [snapshot reads and snapshot holds](/docs/distributed-keyvalue-store/snapshot-holds). A snapshot lets a transaction read data as it existed at an earlier logical time, while new writes continue in the cluster. We want to verify that the old view stays stable and that snapshot holds protect the required [MVCC history](/docs/internals/mvcc) correctly.

Clock faults are another important area. Kahuna uses [hybrid logical clocks](/docs/architecture/hybrid-logical-clocks) for snapshots and lock leases. Moving time inside Docker Desktop can affect the whole virtual machine, so we will run these experiments on disposable Linux hosts where the clock changes are isolated.

We have also added a recovery checker. It measures the time between the end of a failure and the first successful request, adding another view of Kahuna's [replication and recovery behavior](/docs/internals/replication). This helps us separate two questions:

- Is the cluster returning incorrect results?
- Is the cluster correct but taking too long to become available again?

We need more recovery data from runs where transactions make no progress. This will show whether the failure schedule is faster than normal recovery or whether the cluster sometimes gets stuck while finding a leader.

Other follow-up work includes handling one remaining retryable HTTP/2 error correctly, gathering more evidence for the new sequencer workload, testing membership changes with more workloads, and trying different levels of load and fault timing.

When Jepsen discovers a bug, we also want to create a smaller and more predictable regression test whenever possible. Jepsen is excellent at finding a surprising order of events. A focused test is better for checking that the same bug never returns.

## Better Confidence Starts with Better Questions

Jepsen does not make Kahuna correct on its own. It helps us ask better questions:

- Can an isolated leader return old data as current?
- Can a fencing token move backwards after a restart?
- Can two transactions commit when no safe order can explain both?
- Can a sequence value be returned twice after a lost reply?
- How long does the cluster need to recover after a failure?

These questions tell us much more than “did the servers stay online?”

Kahuna is a coordination system, so its behavior during uncertainty is essential. By breaking the cluster on purpose and carefully checking what happened, we can turn difficult failure scenarios into useful evidence—and use that evidence to keep improving Kahuna.
