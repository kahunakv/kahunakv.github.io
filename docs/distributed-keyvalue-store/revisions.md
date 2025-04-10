
# Revisions

In Kahuna, a `revision` is a monotonic version number that tracks when a key was last modified. Every time a key is updated or deleted, its `revision` increments, ensuring strong consistency and strict ordering. It acts as a logical timestamp to resolve stale client operations.

## Understanding revisions

Keys are always created at revision `r0`:

```visual-basic
kahuna-cli>  set `example` 'value1'
r0 set 17ms
```

Modify the key and revision will change to `r1` and then to `r2`:

```visual-basic
kahuna-cli>  set `example` 'value2'
r1 set 12ms

kahuna-cli>  set `example` 'value3'
r2 set 9ms
```

When querying a key, you can see its current revision. The revision does not change during read operations:

```visual-basic
kahuna-cli>  get `example`
r2 value3 10ms

kahuna-cli>  get `example`
r2 value3 9ms
```

## Querying Previous Revisions

Kahuna works like a time machine, allowing you to query the value of a key at any particular point-in-time:

```visual-basic
kahuna-cli>  get `example` at 0
r0 value1 11ms

kahuna-cli>  get `example` at 1
r1 value2 13ms
```

This lets you inspect historical data, trace config or state changes historically, debug changes over time, investigate what value caused a bug or revert to stable known-good values.

## Summary

- Revision tracks when a key was last modified.
- It updates on every write but stays the same for reads.
- Used in leader election, distributed locks and race condition prevention.
- Essential for Compare-And-Swap (CAS) operations.
