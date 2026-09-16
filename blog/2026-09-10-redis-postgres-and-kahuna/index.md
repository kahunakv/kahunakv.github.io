---
slug: redis-postgres-and-kahuna
title: "Couldn't You Just Use Redis and Postgres?"
authors: [andresgutierrez]
tags: [kahuna, camusdb, redis, postgres, distributed-systems]
---

# Couldn't You Just Use Redis and Postgres?

Last Sunday, I was having lunch with a friend and talking about Kahuna, [CamusDB](https://camusdb.github.io/), and all the time I've been putting into these projects lately. He didn't really understand why I would build Kahuna when most of what it does could probably be achieved with some combination of Redis and Postgres.

My explanation may not have been very convincing, and I understand why. Every business has a different tolerance for durability, availability, and consistency. Not every business operates 24/7, and not every business suffers significantly if its systems are down for a few minutes or even a few hours. In many operations, problems and mistakes can be fixed manually by people, or sometimes with an apology to the customer.

My story is very different. For some reason, I've spent almost my entire career working in industries that operate 24/7: airline reservations, hospitality, and video games. There is always a customer or user somewhere interacting with the system, whether it's just a few people or hundreds of thousands at the same time. That changed the way my brain works and the kinds of failure modes I instinctively try to avoid.

Building systems where performance is high and consistency is non-negotiable gradually became part of my DNA.

<!-- truncate -->

This post is the answer I wish I had given at lunch. It is not an attack on Redis or Postgres. I use both, I like both, and I will keep recommending them. It is about the space between them, and why I built Kahuna to fill it.

## The Space Between Them

Redis is fast, simple, and a pleasure to use. Postgres is the database I trust with real money. But in every 24/7 system I worked on, there was a type of state that was too important for the cache and too hot for the database.

Which worker owns this job? Which node is the leader? What is the next reservation number? Is this seat still free? Did we already process this webhook?

This state is small, it changes all the time, and every service reads it. A wrong answer is not a small inconvenience. It is a double charge, a double booking, or a leader that does not know it stopped being the leader.

The usual solution is to keep the hot part in Redis and the durable part in Postgres, and write application code to keep both copies in agreement. Then you handle the case where the database write succeeds and the cache update fails, the opposite case, and the case where the two disagree. Every team writes its own version of that code, and every version has its own bugs.

Kahuna exists because I wanted one place for that type of state, with the guarantees built in instead of rebuilt in every service.

## Distributed Locks

The classic Redis lock is `SET key value NX PX 30000`. It works very well, until it doesn't. Redis replication is asynchronous, so a failover can forget a lock that was confirmed a moment ago, and a second client happily takes it. Redlock tries to fix that with several servers, but it still has the same missing piece: when a lock expires while its owner is paused, you have two owners, and nothing tells the protected resource which one is old.

Postgres advisory locks live inside a real transactional system, but they belong to a session. If the connection drops or the primary fails over, the lock is gone. If the holder pauses for a long garbage collection, it still believes it owns the lock.

Kahuna locks are designed around the failure cases:

- Lock state is replicated through Raft, so a leader change does not forget who owns what.
- Every lock is a lease with an expiration, so a crashed owner cannot hold a resource forever.
- Every acquisition returns a **fencing token** that only grows. A database row, a payment API, or a file can reject any operation with an older token. Two owners after a pause is still possible in any lease-based system. Two owners *causing damage* is not.

A lock without a fencing token is a suggestion. A lock with one is a guarantee you can enforce. The [Jepsen suite](/blog/jepsen-testing-kahuna) checks every night that fencing tokens never move backwards, even during partitions, process kills, and leader elections.

## Key/Value Store

"That is just Redis, or a table with two columns." It is, until you need several things at the same time.

You need durability, so a failover does not lose a confirmed value. Redis gives you speed and asynchronous replication. Postgres gives you durability, but every hot read now goes through a connection pool and a buffer cache to fetch a 40-byte value.

You need volume. Sending thousands of small key/value operations per second to Postgres is not a good idea. Each one takes a connection, a parse, a plan, and a lock, and all of that competes with the real business queries. The whole reason a cache exists is to take that load *away* from the database.

You need conditional and multi-key writes, because the seat map, the hold, and the reservation counter must change together or not at all. Redis has `WATCH` and Lua on one node. Postgres has real transactions, but then the reads are back on the slow path.

Kahuna brings those properties together:

- Persistent keys are replicated through Raft and stored on disk. Ephemeral keys skip the disk. Same API, and you decide per key.
- Hot state is served from memory on the partition leader, so reads do not pay a database round trip.
- Every key has a revision, so compare-and-set is the default tool, not a script you maintain.
- Transactions cover several keys and partitions, with snapshot isolation or serializable consistency. The [transaction coordinator](/blog/reusable-transaction-coordinator) tracks the working set on the server, so a retried request cannot lose a write or apply it twice.

## Sequencer

Postgres has `SEQUENCE`. Redis has `INCR`. Both are correct on a healthy network.

Now imagine a lost reply. The server allocated 501, and the client never received it. If the client retries, it receives 502, and 501 is wasted or, worse, already used. If it does not retry, it has no number. Neither system can say "you already asked for this one, here it is again", because neither one remembers the request, only the counter.

Kahuna sequences accept an **idempotency key**. Retry the same request and you receive the same allocation. Sequences are replicated through Raft, so a leader change does not rewind them, and workers can reserve a range of numbers in one call. Invoice numbers, ticket numbers, and order IDs are the places where a duplicate found a week later is not an acceptable answer.

## Scaling Without a Maintenance Window

Redis scales in a fairly static way. Redis Cluster spreads keys over fixed hash slots, but adding a node moves no data by itself. Somebody has to run a resharding command and watch it. Nothing rebalances on its own. Postgres can add read replicas, but writes still go to one primary.

Kahuna can change shape while it keeps serving traffic:

- **Add nodes** to a running cluster. A new node joins as a learner, catches up, and takes its share of partitions.
- **Remove nodes.** A graceful leave copies the departing node's replicas to the survivors before it leaves.
- **Self-balance.** The placement rebalancer and the leader balancer move replicas and leadership away from busy nodes, in small steps, in the background.
- **Add partitions for hot data.** With key-range routing, a range that grows too large or receives too many writes is split automatically.

Scaling stops being an event you plan for a Sunday night and becomes a change the cluster absorbs while customers keep booking seats.

## It Sounds Complicated. The API Is Not.

All of this lives on the server. The surface you use every day is the same small set of verbs you already know from Redis: `set`, `get`, `delete`, `lock`, `unlock`, `extend`.

```kahuna
kahuna-cli> set flags/checkout-v2 "enabled"
r0 set 9ms

kahuna-cli> get flags/checkout-v2
r0 enabled 7ms

kahuna-cli> lock jobs/nightly-invoices 30000
f1 acquired 786f947d8a6643f0b939865f72aa512a

kahuna-cli> unlock jobs/nightly-invoices
f1 unlocked
```

If you have written code against Redis, you can write code against Kahuna in an afternoon. The complexity is real, but it is tested with Jepsen once on the server, instead of in every application in production.

## Where Kahuna Does Not Belong

My friend was partly right. Kahuna is not a replacement for Postgres as your main database. Relational queries, reports, and bulk data belong there. It is not a replacement for Redis as a cache for data you can rebuild. Consensus is not free, and you should only pay for it where a wrong answer is worse than a slow answer.

The rule is simple. If any of these would be a real incident for you, the state belongs in Kahuna:

- Two workers owning the same job.
- A confirmed write disappearing after a failover.
- A retried request allocating a second ID.
- A multi-key update becoming half visible.

## Where CamusDB Fits

Kahuna did not start as a standalone product. It started as the piece that [CamusDB](https://camusdb.github.io/), a distributed SQL database, needed underneath it: replication, consensus, multi-key transactions with real isolation, and a reliable place for metadata. I built that piece as Kahuna, and CamusDB became its first serious user.

That relationship is the main reason Kahuna keeps improving. Every CamusDB write is a Kahuna transaction. Every CamusDB replica is a Kahuna partition. When CamusDB needed ordered scans, Kahuna got key-range routing. When it needed stable reads while writes continued, Kahuna got snapshot holds. When it needed to recover unfinished transactions after a crash, Kahuna got durable commit decisions.

A coordination service that only stores feature flags is never pushed that hard. A SQL database on top of it pushes every day. That pressure turned Kahuna into something I was comfortable calling [1.0](/blog/kahuna-1-0-stable). The [CamusDB documentation](https://camusdb.github.io/) and [source code](https://github.com/camusdb) are both public.

## The Answer I Should Have Given

Could you do all of this with Redis and Postgres? Most of it, yes, if you write the glue code carefully, test it under failures, and keep it correct while different teams change it for years. I have done that. It works until the one night when it doesn't.

Kahuna is that glue code, written once, replicated, tested with Jepsen, and given a simple API. It is not a bigger Redis or a smaller Postgres. It is the layer in between, the one that every 24/7 system builds sooner or later.

I still think Redis and Postgres are great. I just don't want to write that glue code again.

Kahuna is [open source](https://github.com/kahunakv/kahuna) under the MIT license. If you have your own version of that glue code somewhere, I would love to hear how it broke.
