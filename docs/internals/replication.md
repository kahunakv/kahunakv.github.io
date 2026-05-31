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

`ReplicationSerializer` serializes lock and key/value messages with protobuf. Larger values use recyclable memory streams to reduce allocation pressure.

## Restore Path

During recovery, Raft replays committed logs that are newer than the latest checkpoint. Kahuna receives those logs through `OnLogRestored`.

The restore path:

1. Raft loads logs from its WAL.
2. Kahuna routes each log to the lock or key/value restorer.
3. The restorer rebuilds in-memory state.
4. Materialized persistence provides checkpointed baseline data.
5. New committed logs continue through the normal replication path.

## Inter-Node Forwarding

Clients may contact any node. If the receiving node is not the leader for a resource's partition, Kahuna forwards the operation through `IInterNodeCommunication`.

The production implementation uses gRPC and shared batchers. This lets Kahuna combine related inter-node requests and reduce per-operation network overhead.

## Leader Changes

Raft handles leader election per partition. When a leader changes:

- only the current leader can commit new writes for that partition,
- followers catch up from the leader's log,
- committed entries remain ordered,
- uncommitted proposals may need to be retried.

Clients can see retry or abort responses when leadership changes race with an operation.
