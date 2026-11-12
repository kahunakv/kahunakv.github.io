# Hybrid Logical Clocks (HLC)

Every node has its own clock, and clocks drift apart. If Kahuna ordered events by each node's wall clock alone, a later write on a node with a slow clock could look older than an earlier write on another node. **Hybrid Logical Clocks (HLCs)** solve this: their timestamps stay close to real time, but they always move forward and respect cause and effect, so Kahuna can order events across nodes safely.

An HLC combines physical time with a logical counter. Timestamps keep moving forward even when several events happen in the same millisecond or when clocks are slightly skewed.

You meet HLC timestamps directly when you use historical `AS OF` reads, snapshot holds, point-in-time restore targets, and the `hlc()` script function. Their physical part is Unix epoch milliseconds, so you can use a wall-clock time as a target.

HLCs are used for:

- transaction IDs
- [MVCC](/docs/glossary/#mvcc) visibility (which stored version of a key a read sees)
- historical `AS OF` reads
- snapshot holds
- leases and expiration metadata
- replication and restore metadata
- durable transaction decision records and completion receipts

[Raft](/docs/glossary/#raft) remains the source of truth for committed ordering inside each partition, and actors serialize local state on each node. HLCs provide the time model used by MVCC and cross-partition coordination.

## HLC Format in Kahuna

A Kahuna HLC carries three components:

```text
HLC = (nodeId, physicalTimeMillis, logicalCounter)
```

- **`nodeId`**: Node component used to keep generated timestamps unique across nodes.
- **`physicalTimeMillis`**: Wall-clock time in milliseconds.
- **`logicalCounter`**: Counter used when physical time does not advance between events.

This lets timestamps remain monotonic for a node even under rapid successive events or modest clock skew.

## Transaction Timestamps

Each transaction receives an HLC transaction ID. That ID is carried through the transaction and appears in transaction context, MVCC entries, durable decision records, completion receipts, and diagnostics.

HLCs support transaction behavior in several places:

- **On begin**: The transaction receives an HLC identity.
- **On reads**: MVCC chooses the version visible to the transaction or requested snapshot timestamp.
- **On commit**: Participant writes receive committed HLC metadata through the partition commit path.
- **On recovery**: Durable decision records and completion receipts are keyed by transaction HLC.

Transaction isolation comes from the combination of HLCs, MVCC, locks, read validation, [write intents](/docs/glossary/#write-intent), [two-phase commit](/docs/glossary/#two-phase-commit-2pc), and Raft ordering. Which guarantee you get depends on the locking mode and read options; see [Transaction Reads and Locks](/docs/distributed-keyvalue-store/read-and-lock-semantics/).

## MVCC Visibility

Kahuna uses HLC metadata as version timestamps for key/value records. A simplified record looks like this:

```json
{
  "transactionId": { "node": 1, "physical": 1713351023980, "logical": 3 },
  "key": "user:123",
  "value": "..."
}
```

MVCC reads filter out versions that are in the future relative to the transaction timestamp or requested snapshot HLC. Historical reads such as `GET key AS OF <timestamp>` return the newest revision whose commit timestamp is at or before the requested time.

On the write path, the leader applies a committed mutation with its HLC metadata, followers apply the same committed operation from the Raft log, and later MVCC and snapshot reads use that metadata to decide visibility.

HLC visibility alone does not prevent phantoms: keys that another transaction adds to a bucket or range after you read it. Preventing them depends on prefix/range locks under pessimistic transactions or validation under optimistic transactions.

## Conflict Detection

Kahuna does not use last-write-wins semantics for committed key/value state.

Instead:

- Raft orders committed mutations per partition.
- Compare-value and compare-revision operations reject stale updates explicitly.
- Pessimistic transactions use locks and write intents to block conflicts.
- Optimistic transactions validate read observations and concurrent write intents at commit.
- HLC metadata determines MVCC visibility and historical snapshots.

This gives applications explicit conflict behavior rather than silently choosing the write with the largest timestamp.

## Locks, Expiration, and Sequencing

HLCs also appear in coordination metadata, so time-based behavior does not depend on perfectly synchronized clocks:

- **Leases** use HLC-based expiration metadata.
- **Sequences** store update metadata and idempotency records through the key/value subsystem.

[Fencing tokens](/docs/glossary/#fencing-token) are not HLC timestamps. They are per-lock counters that increase each time the lock changes hands, so protected resources can reject stale lock holders.

## HLC Timeline

The example below shows why a receiving node does not simply use its own wall clock. Node 2's clock runs 2 ms behind Node 1. Timestamps are shown as `(physical, logical)`; the node component is omitted.

```mermaid
sequenceDiagram
    participant N1 as Node 1 (wall clock 1000)
    participant N2 as Node 2 (wall clock 998)
    Note over N2: Last local event (995, 0)
    Note over N1: Local write gets (1000, 0)
    N1->>N2: Replicate with (1000, 0)
    Note over N2: Receive takes the max of own (995), message (1000)<br/>and wall clock (998), then bumps the counter. Result (1000, 1)
    Note over N2: Next local event at wall clock 999 gets (1000, 2)
    Note over N2: Wall clock reaches 1001. Next event gets (1001, 0)
```

Node 2 never issues a timestamp lower than one it has already seen, so the replicated write stays ordered before everything Node 2 does next, even though Node 2's wall clock is behind.
