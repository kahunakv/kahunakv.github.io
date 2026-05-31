# Actor Model

Kahuna uses the Nixie actor system to isolate mutable state and serialize operations that must not run concurrently. The actors are not just a concurrency convenience; they define the ownership boundaries for locks, key/value entries, proposals, and background persistence.

## Why Actors

Actors give Kahuna:

- Single-message-at-a-time execution for each worker.
- Predictable ownership of in-memory maps and B-trees.
- Backpressure through actor mailboxes and routers.
- Separate pools for ephemeral and persistent objects.
- A clean split between request routing, proposal handling, and state mutation.

## Manager Layer

`KahunaManager` creates the main subsystems:

- `LockManager`
- `KeyValuesManager`
- `SequencerManager`
- `BackgroundWriterActor`
- the selected `IPersistenceBackend`

The managers are responsible for locating partition leaders, forwarding remote requests, and choosing the right actor router.

## Lock Actors

`LockManager` starts separate routers for ephemeral and persistent lock actors:

- `ephemeral-lock-*`
- `persistent-lock-*`
- `proposal-lock-*`

`LockActor` keeps lock state in memory in a dictionary keyed by resource name. It processes operations such as acquire, extend, release, and get. Because each actor processes one message at a time, lock ownership and fencing-token updates are serialized for the resources routed to that actor.

Persistent locks queue dirty state to `BackgroundWriterActor` after committed changes.

## Key/Value Actors

`KeyValuesManager` starts separate routers for ephemeral and persistent key/value actors:

- `ephemeral-keyvalue-*`
- `persistent-keyvalue-*`
- `proposal-keyvalue-*`

`KeyValueActor` keeps an ordered in-memory B-tree of `KeyValueEntry` values. It also tracks:

- write intents for individual keys,
- prefix write intents for bucket reads,
- active proposals,
- recent revisions,
- MVCC entries.

Consistent-hash routing keeps operations for the same key or bucket stable across a worker set. This reduces locking inside the actor and keeps related state local.

## Proposal Actors

Proposal actors prepare and submit mutations that need Raft replication. A request that changes durable state is not considered committed simply because a local actor accepted it. The proposal must be replicated and committed through Raft first.

This split lets the request actor remain focused on local validation and state transitions while proposal actors coordinate with Raft.

## Background Writer

`BackgroundWriterActor` is a dedicated actor for materialized persistence. Lock and key/value actors enqueue dirty items, and the background writer flushes them in batches. This avoids blocking request actors on every backend write.

The background writer also tracks partitions that need checkpoints after dirty objects are flushed.
