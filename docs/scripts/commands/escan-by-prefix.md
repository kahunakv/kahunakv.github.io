# Command: EScan By Prefix

Returns the key/value pairs with **ephemeral** durability whose keys start with a given prefix, wherever they live in the cluster. Ephemeral keys live only in the partition leader's memory and are lost on a node restart or a leader change; see [Durability Levels](/docs/architecture/durability-levels/).

Use it when the keys you want can belong to more than one [bucket](/docs/glossary/#bucket). Because a scan can visit several [partitions](/docs/glossary/#partition), it costs more than [`eget by bucket`](/docs/scripts/commands/eget-by-bucket/), which reads one. Results are capped, so use it for small, bounded prefixes. For persistent keys, use [`scan by prefix`](/docs/scripts/commands/scan-by-prefix/).

## Syntax

```text
escan by prefix <prefix>
escan by prefix <prefix> as of <hlc-timestamp>
let <variable> = escan by prefix <prefix> [as of <hlc-timestamp>]
```

## Examples

```kahuna
eset `cache/product/1` "ready"
```
```text
r0 set 4ms
```

```kahuna
eset `cache/product/2` "ready"
```
```text
r0 set 5ms
```

```kahuna
escan by prefix `cache/product`
```
```text
r0 cache/product/1 ready
r0 cache/product/2 ready
```

### Assigning Results

Inside a top-level script, assign the command to a variable with `let`. The variable receives an array of the returned values.

```kahuna
let products = escan by prefix `cache/product`
return count(products)
```

## Reading Past Versions

`escan by prefix` also supports [snapshot reads](/docs/glossary/#snapshot) with `as of` ([timestamp format](/docs/scripts/commands/get/#get-as-of-timestamp)):

```kahuna
escan by prefix `cache/product` as of 1718392012345
```

This returns only the ephemeral keys that were visible under that prefix at the requested snapshot time.

If a key already existed at that time and was updated or deleted later, the snapshot still returns the older visible value from the requested time. Keys created after that time are not returned.

Without `as of`, `escan by prefix` reads the current committed view for each page instead of pinning a historical read timestamp.

## Checking the Result

Use `if not found then ... end` to test whether the last read returned an empty collection. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards).

## Transactions

`escan by prefix` is not allowed inside `begin ... end`. It scans across the cluster and does not carry a transaction identity or prefix lock. For transactional prefix reads, use [`eget by bucket`](/docs/scripts/commands/eget-by-bucket/) so Kahuna can route the read to one partition, include the transaction's own writes, and record the read set.

## Notes

Ephemeral keys can also expire or be evicted under memory pressure. Prefer `eget by bucket` when keys share a bucket and a read from one partition is enough.

The command returns the matching set in one response and is capped at `4096` entries. Use paginated range reads from the .NET or TypeScript client for large or unbounded ordered scans.

Over a key space that uses [key-range routing](/docs/glossary/#key-space-and-key-range-routing), the scan reads one page at a time. If a page keeps hitting a range that is moving, a leadership change, or a transaction that has not finished yet, Kahuna stops after a bounded number of retries and returns a retryable error instead of scanning forever. Retry the command after a short backoff.
