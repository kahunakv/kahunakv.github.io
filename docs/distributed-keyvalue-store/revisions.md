# Revisions

A **revision** is a key's version number. Every write increases it, so you can answer two questions about a key: *has it changed since I read it?* and *what did it look like before?* It plays the same role as a version column that a SQL application checks for optimistic concurrency, except that Kahuna maintains it for every key and can also return older values. Use revisions to:

- **Update safely under concurrency.** Write only if the key is still at the revision you read ([compare-and-set](/docs/distributed-keyvalue-store/cas/)), so two clients cannot silently overwrite each other's changes.
- **Detect changes cheaply.** Compare a stored revision number with the current one instead of comparing whole values.
- **Look back in time.** Read earlier values of a key for audits, compliance, and postmortems, for debugging how a system reached a bad state, for comparing values across deploys or A/B tests, and for rolling back a bad configuration change.

`SET` and `DELETE` advance the revision, including writes staged inside a transaction. `EXTEND` changes the expiry without advancing it, and reads never change it. The counter is per key: it does not order writes across keys, it does not replace the commit timestamp ([HLC](/docs/glossary/#hybrid-logical-clock-hlc)), and it is separate from [Raft](/docs/glossary/#raft) leader terms and from [fencing tokens](/docs/distributed-locks/fencing-tokens/).

## Understanding revisions

Keys are always created at revision `r0`:

```kahuna
set `example` 'value1'
```
```text
r0 set 17ms
```

Modify the key and revision will change to `r1` and then to `r2`:

```kahuna
set `example` 'value2'
```
```text
r1 set 12ms
```

```kahuna
set `example` 'value3'
```
```text
r2 set 9ms
```

Deletes also allocate a revision. The delete writes a [tombstone](/docs/glossary/#tombstone) (a marker that records the delete), so historical reads before the delete, and [point-in-time recovery](/docs/glossary/#point-in-time-recovery-pitr), can still find the previous value:

```kahuna
delete `example`
```
```text
r3 deleted 8ms
```

```kahuna
set `example` 'value4'
```
```text
r4 set 10ms
```

When querying a key, you can see its current revision. The revision does not change during read operations:

```kahuna
get `example`
```
```text
r4 value4 10ms
```

```kahuna
get `example`
```
```text
r4 value4 9ms
```

## Skipping Historical Revisions

Some workloads only need the latest value. For example, a cache may overwrite the same key often and never read older versions. In that case, use `SET ... NOREV` to skip the historical revision record for that write:

```kahuna
set `cache/user/1001` '{"name":"Ada"}' ex 60000 norev
```
```text
r0 set 8ms
```

```kahuna
set `cache/user/1001` '{"name":"Ada Lovelace"}' ex 60000 norev
```
```text
r1 set 7ms
```

`NOREV` does not freeze the revision counter. The current revision still advances, latest reads still return the new value, and compare-revision operations can still protect conditional updates. What changes is the history: the revision produced by a `NOREV` write is not archived for `GET ... AT <revision>` or historical snapshot reads.

Use normal `SET` when you need audit history, debugging timelines, rollbacks, or point-in-time reads. Use `SET ... NOREV` when reducing memory and disk write amplification matters more than retaining old values.

## Querying Previous Revisions

Kahuna can query an archived revision while that revision remains retained:

```kahuna
get `example` at 0
```
```text
r0 value1 11ms
```

```kahuna
get `example` at 1
```
```text
r1 value2 13ms
```

## `AT` Revision vs `AS OF` Timestamp

Kahuna has two kinds of historical read:

- **`AT <revision>`** reads one exact archived revision for a key.
- **`AS OF <timestamp>`** reads the value that was visible at a specific **HLC snapshot time**.

Use `AT` when you already know the precise revision you want. Use `AS OF` to select revisions committed at or before `T`, subject to retained history, safe-time fences, and current TTL filtering.

In Kahuna Script, `AS OF` works with `GET`, `EXISTS`, `GET BY BUCKET`, and `SCAN BY PREFIX`. The .NET and TypeScript clients take the snapshot time as `snapshotMs` on point, bucket, prefix, and range reads (see the [Key/Value API Reference](/docs/distributed-keyvalue-store/api/)). Prefix and range scans without an explicit timestamp read the current committed view page by page.

Examples:

```kahuna
get `example` at 1
get `example` as of 1718392012345
exists `example` as of 1718392012345
get by bucket `services` as of 1718392012345
scan by prefix `services/auth` as of 1718392012345
```

`AS OF` is especially useful for debugging incidents, reconstructing historical state, and running consistent read-only scripts against an older snapshot.

Snapshot timestamps must be non-zero. `AT` and `AS OF` cannot be combined on the same statement.

For long-lived historical views, use [snapshot holds](/docs/distributed-keyvalue-store/snapshot-holds/) to keep the required persistent revisions from being pruned while the view remains active.

## Retention

Old revisions are not kept forever, and retention depends on the key's durability:

- **Ephemeral** keys live only in the memory of the partition leader. The server keeps a limited number of recent revisions, and under memory pressure an ephemeral key that has not been accessed recently may be evicted.
- **Persistent** keys are stored on disk. History is retained according to the configured count and age limits and any [snapshot holds](/docs/distributed-keyvalue-store/snapshot-holds/); not every revision is kept unconditionally.

Learn more in [Durability Levels](/docs/architecture/durability-levels/).

## Historical Read Limits

A historical read can wait for a live writer or return a retryable `MustRetry` instead of answering from incomplete history, and `AS OF` does not freeze expiration. The exact rules are in [fixed-timestamp reads](/docs/distributed-keyvalue-store/read-and-lock-semantics/#fixed-timestamp-reads). How `EXTEND` and other mutations at the same revision are ordered is described in [committed intents and newer heads](/docs/distributed-keyvalue-store/read-and-lock-semantics/#committed-intents-and-newer-heads).
