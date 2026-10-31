# Glossary

Short, plain-language definitions of the terms used across the Kahuna documentation. Each entry links to the page that explains the topic in full. Transaction internals have their own glossary in [Transaction Lifecycle](/docs/internals/transaction-lifecycle/#basic-concepts).

### Actor

A worker inside a Kahuna node that processes one message at a time and owns the in-memory state for its keys, like a single-threaded event loop per group of keys. Actors serialize work on one node; Raft orders work across nodes. See [Actor Model](/docs/internals/actor-model/).

### Bucket

The part of a key before its last `/`. In `services/auth`, the bucket is `services`. Keys in the same bucket are routed to the same partition, so you can read them together with `get by bucket`. See [Buckets](/docs/distributed-keyvalue-store/buckets/).

### Compare-and-Set (CAS)

A write that succeeds only if the key still has the value or revision you expect. If another client changed the key first, the write fails instead of overwriting that change. See [Compare-and-Set](/docs/distributed-keyvalue-store/cas/).

### Durability

Each key and lock is either **persistent** or **ephemeral**. See [Durability Levels](/docs/architecture/durability-levels/).

- **Persistent:** replicated to the partition's replicas, committed by a quorum, and stored on disk. It survives the loss of a minority of replicas and node restarts.
- **Ephemeral:** kept only in the memory of the partition leader. It is faster, but it is lost on a node restart or a leader change.

### Fencing Token

A number that Kahuna returns with every lock grant and that increases each time the lock changes hands. A shared resource that remembers the highest token it has seen can reject writes from a holder whose lease already expired. For persistent locks the token always increases; for ephemeral locks the count restarts when the lock entry leaves the leader's memory. See [Fencing Tokens](/docs/distributed-locks/fencing-tokens/).

### Hybrid Logical Clock (HLC)

A timestamp that combines wall-clock time in milliseconds with a logical counter. It lets Kahuna order events across nodes even when their clocks differ slightly. Historical reads such as `get ... as of` use HLC time. See [Hybrid Logical Clocks](/docs/architecture/hybrid-logical-clocks/).

### Idempotency Key

A caller-chosen key sent with a sequencer allocation. If the request is retried with the same key, Kahuna returns the same values instead of allocating new ones, within a retention limit. See [Idempotency](/docs/distributed-sequencer/idempotency/).

### Key Space and Key-Range Routing

A **key space** is the same boundary as a bucket: the part of a key before its last `/`. By default, Kahuna routes a key space to a partition by hashing it. If you register a key space for **key-range routing**, its keys are kept instead in sorted ranges that can split as they grow, so ordered range scans stay efficient. See [Key-Range Sharding](/docs/distributed-keyvalue-store/key-range-sharding/).

### Kommander

The Raft library that Kahuna uses for replication, leader election, and log storage. Many server flags that start with `--raft-` tune it.

### Leader, Follower, and Learner

Each partition has one **leader**, which orders its writes, and several **followers**, which hold copies. A **learner** is a new replica that receives data but does not vote until it has caught up. If the leader fails, the remaining replicas elect a new one. See [Raft Consensus](/docs/architecture/raft/).

### Lease

A lock with an expiry time. The holder must extend the lease before it expires; if the holder crashes or loses its network connection, the lock frees itself when the lease runs out. See [Leases](/docs/distributed-locks/leases/).

### MVCC

Multi-version concurrency control. Kahuna keeps older revisions of a key next to the current one, so readers can see a consistent past state while writers continue. See [MVCC](/docs/internals/mvcc/).

### Partition

A slice of the keys, with its own leader and replicas. Spreading keys over partitions spreads load over nodes. Each partition is replicated independently with Raft. See [Architecture Overview](/docs/architecture/overview/).

### Partition 0

The system partition. It holds cluster-wide metadata such as the key-range map, and its leader coordinates work that spans the cluster, such as coordinated backups. See [Backups and Point-in-Time Recovery](/docs/backups-and-point-in-time-recovery/).

### Placement Group

The part of a key before the first `|`. In `orders|rows/1001` and `orders|by_customer/customer-7/1001`, the group is `orders`. Hash routing places every key of a group on the same partition, so a transaction over rows and their indexes can stay on one partition. See [Placement Groups](/docs/distributed-keyvalue-store/buckets/#placement-groups).

### Point-in-Time Recovery (PITR)

Restoring the data as it was at a chosen moment, from a full backup plus the incremental log segments recorded after it. See [Backups and Point-in-Time Recovery](/docs/backups-and-point-in-time-recovery/).

### Quorum

A **voter** is a replica that counts toward agreement; a learner does not. A **quorum** is a majority of a partition's voters, for example two out of three. A persistent write is committed only after a quorum stores it, so the cluster keeps working when a minority of replicas is down.

### Raft

The consensus protocol that keeps a partition's replicas in agreement. The leader appends each write to a log, copies it to the followers, and commits it after a quorum confirms it. See [Raft Consensus](/docs/architecture/raft/).

### Replica and Replication Factor

A **replica** is one copy of a partition on one node. The **replication factor** is the number of replicas each partition has. See [Replica Placement](/docs/replica-placement/).

### Revision

A per-key version number. A new key starts at revision `0`, and every write increases it. Revisions let you make conditional writes and read older versions. See [Revisions](/docs/distributed-keyvalue-store/revisions/).

### Snapshot

Two different things share this name:

- **Raft snapshot:** a copy of a partition's state that a leader sends to a replica that is too far behind to catch up from the log. See [Snapshots and Raft Recovery](/docs/snapshot-and-raft-recovery/).
- **Snapshot read:** a read of the data as it was at a fixed HLC timestamp. See [Revisions](/docs/distributed-keyvalue-store/revisions/).

### Term (Raft)

A leadership epoch of a partition. Each time a new leader is elected, the term increases. Kahuna uses the term to detect work that a former leader started, such as locks granted before a leader change.

### Tombstone

A marker that records a delete. It keeps the key's revision history consistent, so a later write continues from the deleted revision and historical reads see the delete.

### Two-Phase Commit (2PC)

The protocol Kahuna uses when a transaction changes keys on several partitions. First every partition prepares its changes, then one decision (commit or abort) applies to all of them. See [Distributed Transactions](/docs/architecture/distributed-transactions/).

### Write-Ahead Log (WAL)

The ordered log of replicated entries that a node writes before it applies them. After a crash, the node rebuilds its state from the log. See [WAL and Persistence](/docs/internals/wal-and-persistence/).

### Write Intent

A change staged by a transaction that has not finished yet. Other operations see the intent and wait, retry, or resolve it once the transaction's decision is known. See [Transaction Lifecycle](/docs/internals/transaction-lifecycle/).
