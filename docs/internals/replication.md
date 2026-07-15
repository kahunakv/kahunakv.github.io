# Replication and Recovery

Kahuna uses Raft replication to make persistent mutations durable and ordered. The server wires Raft events to Kahuna through `ReplicationService`.

## Startup Wiring

On startup, `ReplicationService` subscribes Kahuna to Raft events:

- `OnLogRestored`
- `OnReplicationReceived`
- `OnReplicationError`

Then it joins the Raft cluster. Embedded nodes perform equivalent wiring in `EmbeddedKahunaNode`.

## Commit Path

For a persistent mutation:

1. The leader actor validates the request.
2. A proposal is created for the mutation.
3. The proposal is serialized as a Raft log entry.
4. Raft replicates the entry to the partition group.
5. Once committed, Raft raises `OnReplicationReceived`.
6. Kahuna's replicator applies the committed entry to the in-memory state.
7. The materialized state is queued for background persistence.

This is why a local actor accepting a request is not enough. The committed Raft log is the source of truth for ordering and durability.

## Log Types

Kahuna categorizes replicated logs with simple type names:

| Type | Meaning |
|------|---------|
| `lock` | Lock state mutation. |
| `kv` | Key/value state mutation. |
| `rangemap` | Key-range descriptor map, replicated on the meta partition. |
| `snapshotfloor` | Snapshot-hold floor registry, replicated on the meta partition. |
| `coorddecision` | Durable transaction decision delta, replicated on the data partition that owns the record anchor key. |
| `receipt` | Completion receipt handoff for range split/merge movement. In steady state, receipts ride key/value commits. |

`ReplicationSerializer` serializes these messages with protobuf. Larger values use recyclable memory streams to reduce allocation pressure.

## Restore Path

During recovery, Raft replays committed logs that are newer than the latest checkpoint. Kahuna receives those logs through `OnLogRestored`.

The restore path:

1. Raft loads logs from its WAL.
2. Kahuna routes each log by replication type.
3. Lock, key/value, range-map, snapshot-floor, decision, and receipt handlers rebuild in-memory state.
4. Materialized persistence provides checkpointed baseline data.
5. New committed logs continue through the normal replication path.

## Inter-Node Forwarding

Clients may contact any node. If the receiving node is not the leader for a resource's partition, Kahuna forwards the operation through `IInterNodeCommunication`.

The production implementation uses gRPC and shared batchers. This lets Kahuna combine related inter-node requests and reduce per-operation network overhead.

## Leader Changes

Raft handles leader election per partition. When a leader changes:

- Only the current leader can commit new writes for that partition
- Followers catch up from the leader's log
- Committed entries remain ordered
- Uncommitted proposals may need to be retried

Clients can see retry or abort responses when leadership changes race with an operation.

For durable transaction decisions, the node that becomes leader for the anchor partition is responsible for continuing recovery of any outstanding decision records it now owns.
