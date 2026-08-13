import Architecture1 from '../assets/architecture.png';

# Architecture Overview

Kahuna is a partitioned cluster for [distributed locks](/docs/distributed-locks), [key/value storage](/docs/distributed-keyvalue-store), and [sequences](/docs/distributed-sequencer). Each partition is a Raft group with one leader and multiple replicas. Clients can talk to any node; Kahuna routes each request to the leader that owns the target key, lock, or sequence.

<div style={{textAlign: 'center'}}>
<img src={Architecture1} height="350" />
</div>

The diagram shows three nodes and four partitions. A node can lead some partitions while replicating others, so leadership and work are spread across the cluster.

## Partitions

Kahuna routes data by partition:

- Point key/value operations route by key.
- Locks route by resource name.
- Sequences route through reserved key/value entries.
- Registered key ranges can use range routing instead of hash routing.

The leader for a partition serializes operations for that partition. Persistent mutations are replicated through Raft before they are acknowledged. If the leader fails, another replica can be elected and continue from the committed log.

## Consensus

Kahuna uses [Kommander](https://github.com/kahunakv/kommander) for Raft. Each partition has its own Raft log, leader, and replication group.

For persistent data, the normal path is:

1. The receiving node finds the partition leader.
2. The leader validates and orders the operation.
3. Raft replicates the log entry to a quorum.
4. The committed entry is applied to actor-owned memory.
5. Background writers materialize state to RocksDB, SQLite, or memory.

This keeps the client API simple while preserving one committed history per partition.

## Correctness Testing

Kahuna has a public [Jepsen test suite](https://github.com/kahunakv/kahuna-jepsen) for distributed correctness testing. The suite runs against a multi-node cluster with network partitions, process kills, process pauses, and membership changes. It currently covers:

- `register`: linearizable CAS-register behavior over the key/value store
- `lock`: lease-aware mutual exclusion and fencing-token monotonicity
- `append`: Elle list-append histories over interactive transactions, checking serializability
- `sequencer`: duplicate-free allocation, allocation-range integrity, and idempotent replay
- `membership`: leave and rejoin fault injection around the Raft roster while workloads continue

These tests complement unit, integration, and benchmark tests. They are intentionally scoped to the workloads they model, so a passing Jepsen run should be read as evidence for the covered key/value, lock, transaction, sequencer, and membership-change properties rather than a blanket proof of every Kahuna feature.

## Scaling and Membership

Kahuna scales by adding partitions and distributing partition leadership:

- New nodes can join an existing cluster, catch up, and become eligible to lead partitions.
- Nodes can leave for maintenance or decommissioning.
- The opt-in [leader balancer](/docs/leader-balancing/) can gradually redistribute partition leadership.
- Key-range spaces can split when a range becomes too large or too hot.

Membership changes are separate from request routing. Clients can still use multiple endpoints and let Kahuna locate the current leader for each operation.

## Storage and Runtime

Kahuna separates the replicated log from materialized state:

- Kommander stores the Raft WAL.
- Kahuna stores materialized locks, key/value entries, revisions, and sequence state.
- RocksDB is the default persistent storage engine.
- SQLite is available for smaller deployments and easier inspection.
- Memory storage is available for tests, embedded usage, and temporary state.

Actors keep hot state in memory. Background writers flush committed persistent state to the configured backend. Eviction, WAL checkpointing, backup/PITR retention, and revision cleanup run as maintenance paths around the same committed state model.

## Performance Paths

Kahuna keeps the strongly consistent path practical with:

- Actor-local state for hot reads and mutation staging
- Direct leader routing after the target partition is known
- Partition write coalescing for persistent key/value writes
- Dedicated backend read and write schedulers
- Background materialization, eviction, and checkpointing

These optimizations do not replace Raft. They reduce avoidable work around the replicated path.

## When to Use Kahuna

Use Kahuna when several services must agree on ownership, small shared state, or ordered allocation:

- Distributed locks with leases and fencing tokens
- Configuration, metadata, sessions, reservations, and feature flags
- Retry-safe sequence allocation
- Multi-key transactions and scripts
- Persistent or ephemeral coordination state

Use a simpler cache or local store when data can be lost, rebuilt, or briefly inconsistent.
