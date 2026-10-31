# Command: Scan By Prefix

Returns the key/value pairs with **persistent** durability whose keys start with a given prefix, wherever they live in the cluster. Persistent keys are replicated and survive node failures.

Use it when the keys you want can belong to more than one [bucket](/docs/glossary/#bucket): for example, the prefix `services/` matches both `services/auth/instance-1` and `services/payments/instance-1`. Because a scan can visit several [partitions](/docs/glossary/#partition), it costs more than [`get by bucket`](/docs/scripts/commands/get-by-bucket/), which reads one. Results are capped, so use it for small, bounded prefixes. For ephemeral keys, use [`escan by prefix`](/docs/scripts/commands/escan-by-prefix/).

## Syntax

```text
scan by prefix <prefix>
scan by prefix <prefix> as of <hlc-timestamp>
let <variable> = scan by prefix <prefix> [as of <hlc-timestamp>]
```

## Examples

```kahuna
set `services/auth/instance-1` "node1"
```
```text
r0 set 8ms
```

```kahuna
set `services/auth/instance-2` "node2"
```
```text
r0 set 9ms
```

```kahuna
scan by prefix `services/auth`
```
```text
r0 services/auth/instance-1 node1
r0 services/auth/instance-2 node2
```

### Assigning Results

Inside a top-level script, assign the command to a variable with `let`. The variable receives an array of the returned values.

```kahuna
let instances = scan by prefix `services/auth`
return count(instances)
```

## Reading Past Versions

`scan by prefix` also supports [snapshot reads](/docs/glossary/#snapshot) with `as of` ([timestamp format](/docs/scripts/commands/get/#get-as-of-timestamp)):

```kahuna
scan by prefix `services/auth` as of 1718392012345
```

This returns only the keys that were visible under that prefix at the requested snapshot time.

If a key already existed at that time and was updated or deleted later, the snapshot still returns the older visible value from the requested time. Keys created after that time are not returned.

Without `as of`, `scan by prefix` reads the current committed view for each page instead of pinning a historical read timestamp.

## Checking the Result

Use `if not found then ... end` to test whether the last read returned an empty collection. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards).

## Transactions

`scan by prefix` is not allowed inside `begin ... end`. It scans across the cluster and does not carry a transaction identity or prefix lock. For transactional prefix reads, use [`get by bucket`](/docs/scripts/commands/get-by-bucket/) so Kahuna can route the read to one partition, include the transaction's own writes, and record the read set.

## Notes

`scan by prefix` visits nodes and workers to find matching keys. Use `get by bucket` when the keys share a bucket and you need a consistent read from one partition.

The command returns the matching set in one response and is capped at `4096` entries. Use paginated range reads from the .NET or TypeScript client for large or unbounded ordered scans.

Over a key space that uses [key-range routing](/docs/glossary/#key-space-and-key-range-routing), the scan reads one page at a time. If a page keeps hitting a range that is moving, a leadership change, or a transaction that has not finished yet, Kahuna stops after a bounded number of retries and returns a retryable error instead of scanning forever. Retry the command after a short backoff.
