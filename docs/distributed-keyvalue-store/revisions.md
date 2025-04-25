
# Revisions

In Kahuna, a `revision` is a monotonic version number that tracks when a key was last modified. Every time a key is updated or deleted, its `revision` increments, ensuring strong consistency and strict ordering. It acts as a logical timestamp to resolve stale client operations.

## Understanding revisions

Keys are always created at revision `r0`:

```ruby
set `example` 'value1'
r0 set 17ms
```

Modify the key and revision will change to `r1` and then to `r2`:

```ruby
set `example` 'value2'
r1 set 12ms

set `example` 'value3'
r2 set 9ms
```

When querying a key, you can see its current revision. The revision does not change during read operations:

```ruby
get `example`
r2 value3 10ms

get `example`
r2 value3 9ms
```

## Querying Previous Revisions

Kahuna works like a time machine, allowing you to query the value of a key at any particular point-in-time:

```ruby
get `example` at 0
r0 value1 11ms

get `example` at 1
r1 value2 13ms
```

This lets you inspect historical data, trace config or state changes historically, debug changes over time, investigate what value caused a bug or revert to stable known-good values.

## Practical Uses of Retrieving Old Revisions

While many systems only care about the latest value, Kahuna's ability to retrieve old revisions opens up some powerful, practical use cases—especially in distributed systems, debugging, auditing and observability:

- **Audit Trails and Change History:** Kahuna stores each change at a new revision, so you can inspect historical values. Useful for debugging, compliance, or postmortem analysis. With revisions we can see how a config flag looked at a specific point in time. Helps trace misconfigurations or unauthorized changes.
- **Debugging State Changes Over Time**: Understand how and why a system entered a bad state. Distributed systems can be hard to debug after the fact and Retrieving old revisions helps you reconstruct the timeline of state changes. It's useful when investigating failures that occurred hours or days ago.
- **Safe Rollbacks of Configuration or State**: Roll back to a previous known-good configuration. If a new config breaks the system, you can pull a previous value and restore it. Provides a quick and clean rollback mechanism.
- **Data Versioning for CI/CD or Experiments**: Compare previous and current values during deploys or A/B tests. You can track how configs or feature flags evolved over time. Useful for debugging failed deployments or verifying that changes had intended effects.

> **Kahuna** supports two types of durability: `ephemeral`, which uses only the volatile memory (RAM) of the leader node where the key/value is stored, and `persistent`, which uses durable disk-based storage. In case of memory pressure, ephemeral keys may be evicted if they haven’t been accessed recently. In the case of ephemeral storage, the server stores a limited number of recent revisions. If you need to store all revisions of a key, you should use persistent storage. Learn more in the [supported durabilities](/docs/architecture/durability-levels) section

## Summary

- Revision tracks when a key was last modified.
- It updates on every write but stays the same for reads.
- Used in leader election, distributed locks and race condition prevention.
- Essential for Compare-And-Swap (CAS) operations.
