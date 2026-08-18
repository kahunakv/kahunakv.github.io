---
slug: kahuna-1-0-stable
title: "Kahuna 1.0: From Coordination Library to Distributed Database"
authors: [andresgutierrez]
tags: [kahuna, release, distributed-systems]
---

# Kahuna 1.0: From Coordination Library to Distributed Database

Kahuna started as a simple idea: build a lightweight tool that centralizes the distributed concerns every team eventually runs into. Locks, leader election, configuration, sequences. Things that are easy to get wrong and painful to debug when they break at 3 a.m.

Somewhere along the way, it became something else entirely.

Today I am releasing Kahuna 1.0, and the system that ships is far more than the coordination library I set out to build. Kahuna is a distributed key/value database with transactions, a scripting engine, horizontal scalability, and enough correctness testing to bet real workloads on it.

<!-- truncate -->

## The Road Here

When I wrote the [first post on this blog](/blog/welcome), I described three pillars: a distributed key/value store, distributed locks, and a distributed sequencer. Those pillars are still here. But the foundation underneath them grew organically, each layer reinforcing the next.

The key/value store gained MVCC, snapshot isolation, serializable transactions, and a transaction coordinator that tracks reads, writes, and locks on the server instead of trusting the client. The lock system gained Jepsen-verified fencing tokens and lease semantics that survive leader changes. The sequencer gained retry-safe idempotency and range allocation.

Each of those features was built because a real problem demanded it, and each one made the next possible.

That is the thing about building infrastructure for distributed systems. You start solving one problem and discover that the solution is foundational for problems you had not considered yet.

## More Than Coordination

The turning point was realizing that Kahuna's storage engine, consensus layer, and transaction machinery were general enough to support a distributed SQL database on top.

[CamusDB](https://github.com/camusdb) is a distributed SQL database that uses Kahuna as its storage and coordination layer. It does not implement its own replication, its own consensus, or its own transaction protocol. It uses Kahuna's. Every CamusDB write is a Kahuna transaction. Every CamusDB replica is a Kahuna partition.

What started as a coordination tool, something closer to etcd or ZooKeeper with better ergonomics, had organically evolved into something with broader ambitions. The architecture that makes coordination correct, Raft consensus per partition, MVCC, distributed transactions with proper isolation, naturally extends into a solid foundation for a database.

A coordination system that can run a SQL database underneath it is a different kind of tool than one that only stores configuration keys. It means the transaction engine is real. It means the replication is not a toy. It means the consistency guarantees hold under workloads far heavier than lock renewals and feature flags.

## Scalability Through Replication Factor

Full replication is simple: every node stores every partition. It works well for small clusters. It does not work when you want to add nodes to increase capacity instead of just increasing redundancy.

Kahuna 1.0 ships with configurable replication factor and a placement rebalancer. Set a replication factor of 3 on a 9-node cluster and each partition lives on 3 nodes instead of 9. Different partitions land on different subsets of the cluster. Adding nodes adds capacity. The rebalancer moves replicas gradually so catch-up traffic does not overwhelm foreground requests.

```bash
kahuna-server \
  --initial-cluster https://kahuna-1:8082 https://kahuna-2:8082 https://kahuna-3:8082 \
  --raft-replication-factor 3 \
  --raft-enable-placement-rebalancer true
```

Zone-aware placement spreads replicas across racks or availability zones. Per-partition overrides let you increase the replication factor for critical data without changing the cluster default.

When your system manages hundreds of thousands of key/value entries and locks, full replication means every node carries the entire keyspace, every write fans out to every server. Replication factor lets Kahuna distribute that keyspace across many servers, so each node is responsible for a fraction of the data while the cluster as a whole absorbs the full workload. Adding servers increases both storage capacity and throughput.

This is the scaling model that makes Kahuna viable for production workloads beyond coordination. A system that forces every node to store everything hits a ceiling. Replication factor removes that ceiling.

## Correctness You Can Verify

Distributed systems fail in boring ways. A leader that does not know it lost leadership serves stale reads. A fencing token goes backwards after a restart. Two transactions commit when no valid serial order can explain both.

Kahuna has a public [Jepsen test suite](https://github.com/kahunakv/kahuna-jepsen) that runs nightly against a five-node cluster. It exercises four workloads under network partitions, process kills, process pauses, and membership changes:

- Linearizable key/value registers
- Lease-aware mutual exclusion with fencing token monotonicity
- Serializable interactive transactions checked by Elle
- Duplicate-free sequence allocation with idempotent replay

The suite has already caught real bugs: stale reads from partitioned leaders, fencing tokens moving backwards after leader changes, lost updates in transactions, and write skew in modes where read validation should prevent it. Every one of those bugs is now fixed and covered by regression tests.

A green Jepsen run is evidence, not proof. But it is the kind of evidence that matters: adversarial testing under the failures that actually happen in production.

## What Ships in 1.0

This release is the line where Kahuna moves from "interesting project" to "you can build on this":

- **Distributed key/value store** with persistent and ephemeral durability, revisions, compare-and-swap, expiration, and key-range routing
- **Distributed transactions** with snapshot isolation or serializable consistency, optimistic or pessimistic locking, and a server-side transaction coordinator
- **Distributed locks** with leases, fencing tokens, and replicated lock state
- **Distributed sequencer** with retry-safe allocation, range reservation, and idempotency keys
- **Scripting engine** for transactional logic that runs inside the cluster
- **Replication factor** with zone-aware placement, per-partition overrides, and automatic rebalancing
- **Backups and point-in-time recovery**
- **Embedded node** for integration tests and applications that need the transaction engine without the server
- **Jepsen-tested** across key/value, lock, transaction, sequencer, and membership workloads
- **.NET client**, REST, gRPC, and CLI interfaces
- **MIT license**

## What Comes Next

1.0 is stable, not finished.

The transaction coordinator will gain durable commit decisions for persistent workloads, so recovery after a crash can resolve in-flight transactions from the canonical record instead of asking the client to retry. Snapshot reads and snapshot holds need Jepsen coverage. Clock fault testing will move to isolated Linux hosts where time manipulation does not leak across containers.

There is also work to do on composed backups for clusters with per-partition placement, richer key-range operations, and continued performance tuning of the write coalescing and backend I/O scheduler.

## A Different Kind of Tool

I started building Kahuna because my team needed a single place for locks, configuration, and sequences. Something simpler than running Redis for one thing, ZooKeeper for another, and a database table for a third.

What emerged is a distributed database engine that happens to be exceptionally good at coordination. The same Raft consensus, the same MVCC, and the same transaction protocol that make locks and sequences correct also make it possible to run a SQL database on top.

That organic evolution, from coordination library to database engine, turned out to be the best outcome.

Kahuna is [open source](https://github.com/kahunakv/kahuna) and ready for production use. If you are building distributed systems and tired of stitching together coordination from three different tools, give it a try.
