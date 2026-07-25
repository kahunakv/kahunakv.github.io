---
slug: reusable-transaction-coordinator
title: Making Distributed Transactions Easier to Trust
authors: [andresgutierrez]
tags: [kahuna, transactions, distributed-systems]
---

# Making Distributed Transactions Easier to Trust

Distributed transactions rarely fail in dramatic ways. They fail in boring ways.

A client writes key `account:alice`, the response gets lost, the client retries, another request starts commit, and now the system has to answer a simple question: did that write count?

That is the kind of question Kahuna should answer on the server, not push onto every client library and application.

The next step for Kahuna transactions is a reusable transaction coordinator: one server-owned place that tracks what a transaction has read, written, locked, retried, committed, or rolled back.

<!-- truncate -->

## The Problem With "Just Send the List"

Interactive transactions are tempting to implement like this:

1. The client reads and writes keys.
2. The client remembers every key it touched.
3. At commit time, the client sends the final list to the server.

That works until it doesn’t.

If the client forgets one modified key, commit can look valid while leaving part of the transaction outside the decision. If the client misses a lock, cleanup can leak. If the client loses a response, it may not know whether an operation happened.

That is too much trust in the least reliable part of the system: the caller sitting on the other side of a network.

The coordinator changes the rule. The client keeps an opaque transaction handle. The server keeps the transaction truth.

When a write succeeds, the coordinator records it. When a lock is acquired, the coordinator records it. When a read needs validation, the coordinator records the dependency. Commit uses the server-owned working set, not a last-minute summary from the client.

For developers, the API gets smaller. For Kahuna, the protocol gets harder to misuse.

## Commit Starts by Closing the Door

The nastiest transaction bug is the one that arrives half a millisecond late.

Imagine this:

1. Request A starts writing `cart:123`.
2. Request B starts committing the transaction.
3. Request A finishes after commit already captured the working set.

If `cart:123` is missing from commit, the transaction is wrong. If commit keeps waiting for more requests forever, the transaction is stuck.

The coordinator will make finalization explicit. The first close, commit, or rollback request closes the transaction to new operations. Operations that were already registered are allowed to finish. Then the coordinator freezes the working set.

That frozen view is the one every later commit or rollback attempt must use.

The useful mental model is simple: close the door, wait for everyone already inside, then make the decision.

## Safe Retries for Every Operation

Distributed systems force clients to ask uncomfortable questions:

- Did the server never receive my write?
- Did it receive it and fail?
- Did it apply it, then lose the response?

Those cases look identical from the client when the connection drops.

Each transaction operation will therefore have a stable operation ID. One logical request gets one ID. If the client retries, it reuses the same ID.

That lets Kahuna recognize a retry instead of treating it as a fresh command. If the first response was lost, the participant can return the previous result without applying the write again. If the same ID is reused for a different command, Kahuna rejects it.

There is an important trade-off here. If the coordinator knows an operation may still be running but cannot confirm the outcome, commit should wait or ask the caller to retry. A transaction that pauses is annoying. A transaction that silently drops a write is much worse.

## A Reusable Core, Not a Second Script Engine

Kahuna already has serious transaction machinery inside its scripting path: read validation, two-phase commit, lock cleanup, rollback behavior, and conflict handling.

The problem is that some of this logic is too close to the script executor.

Scripts should handle scripts: parsing, variables, expressions, and script-specific execution.

The reusable coordinator should handle transactions: identity, lifecycle, working sets, operation registration, finalization, retries, and cleanup.

Once those responsibilities are separated, the script engine becomes one user of the coordinator. The .NET client becomes another. Future clients can follow the same protocol without copying script-specific behavior.

## Finalization Is a State Machine

Commit and rollback are not buttons. They are state transitions under pressure.

The coordinator has to handle duplicate commits, commit racing rollback, retries arriving late, and automatic cleanup for expired sessions.

The rule should be boring and strict:

- If finalization is already running, duplicate requests wait for the same result.
- If the transaction commits, it stays committed.
- If the transaction rolls back, it stays rolled back.
- If the failure is retryable, the finalization slot opens again for a later attempt.

That last point matters. A temporary routing error should not permanently consume the one chance to commit.

## Concurrency Choices Should Be Explicit

Not every application wants the same transaction behavior.

Some workloads want pessimistic locking because conflicts are expensive. Others prefer optimistic concurrency because most transactions do not collide. Some systems already have a snapshot timestamp and do not need Kahuna to repeat the same read validation.

So a transaction should begin with an explicit policy:

- How reads are validated
- Whether locks are pessimistic or optimistic
- How long the transaction may live
- When locks are released
- Whether the commit decision must be durable

Invalid combinations should fail early. Guessing is not a transaction feature.

## Durable Commit Decisions, with Honest Limits

The hardest moment is not commit. It is commit after the decision was made, before every participant heard it.

For persistent data, Kahuna can offer an opt-in durable decision mode.

Before resolving participant writes, the coordinator initializes a canonical transaction record, replicates prepared intents for each persistent key, validates the read set, and then decides the record as `Commit` or `Abort`. Recovery can later resolve unfinished intents from that record after a restart or leadership change.

The order is the guarantee:

1. The canonical transaction record is initialized as `Undecided`.
2. Prepared intents are replicated on participant partitions.
3. The canonical record is decided as `Commit` or `Abort`.
4. Participants materialize committed values with completion receipts, or discard aborted intents.

That prevents an old retry from turning “already committed” into “unknown.”

This mode costs more coordination, so it should not be the default for every workload. It also cannot cover ephemeral values. If data only lives in memory, a durable commit decision cannot make that memory survive a process loss.

It also does not make every intermediate state durable. The interactive session before durable finalization still lives in memory. Once prepared persistent intents exist, participant leader changes do not lose staged values; recovery can resolve them from the canonical record. If the coordinator disappears before the record exists, the honest answer may still be “retry,” not “we know exactly what happened.”

That honesty is part of the design.

## What This Means for Clients

Client-side transaction code should become lighter.

The client still keeps a handle, a policy, operation IDs, and local status. It no longer needs to be the authority for keys, locks, or read dependencies.

Other systems built on Kahuna can remove duplicate coordination state too. They may still own their schemas, isolation rules, cache protocols, and application timeouts. Kahuna should own the mechanics that are easy to get wrong:

- Operation fencing
- Working-set tracking
- Commit and rollback serialization
- Retry handling
- Lock cleanup
- Expiration cleanup

There is a cost. Registering and confirming operations adds coordinator traffic. The first target is correctness. Then we can measure point operations, batches, validated reads, and snapshot reads to decide where batching or locality should reduce overhead.

## The Payoff

The goal is not to make failures disappear. That is not how distributed systems work.

The goal is to make every failure land in one of a few understandable boxes:

- Already applied, here is the same result
- Still running, retry the same operation
- Closed, no new operations accepted
- Committed, and that decision will not change
- Rolled back, and that decision will not change
- Unknown within this mode, retry at the application boundary

That is the kind of simplicity Kahuna should provide: fewer ways for users to make a distributed transaction unsafe, and one reusable coordinator where the hard rules can be tested under concurrency, retries, leadership changes, and process failures.
