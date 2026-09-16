# Command: EScan By Prefix

Scans ephemeral storage across the cluster and returns key/value pairs whose keys start with the specified prefix.

```kahuna
eset `cache/product/1` "ready"
r0 set 4ms

eset `cache/product/2` "ready"
r0 set 5ms

escan by prefix `cache/product`
r0 cache/product/1 ready
r0 cache/product/2 ready
```

## Assigning Results

Inside a top-level script, assign the command to a variable with `let`. The variable receives an array of the returned values.

```kahuna
let products = escan by prefix `cache/product`
return count(products)
```

## EScan By Prefix As Of Timestamp

`escan by prefix` also supports snapshot reads:

```kahuna
escan by prefix `cache/product` as of 1718392012345
```

This returns only the ephemeral keys that were visible under that prefix at the requested snapshot time.

If a key already existed at that time and was updated or deleted later, the snapshot still returns the older visible value from the requested time. Keys created after that time are not returned.

Without `as of`, `escan by prefix` reads the current committed view for each page instead of pinning a historical read timestamp.

## Transactions

`escan by prefix` is not allowed inside `begin ... end`. It scans across the cluster and does not carry a transaction identity or prefix lock. For transactional prefix reads, use [`eget by bucket`](eget-by-bucket.md) so Kahuna can route the read to one partition, include the transaction's own writes, and record the read set.

## Notes

`escan by prefix` reads from ephemeral storage and scans across the cluster. Ephemeral keys can expire or be evicted under memory pressure, and a cluster-wide scan can be expensive. Prefer `eget by bucket` when keys share a bucket and a partition-local read is enough.

The command returns the matching set in one response and is capped at `4096` entries. Use paginated range reads from the .NET or TypeScript client for large or unbounded ordered scans.

Range-backed scans are internally paged. If one page keeps returning retryable state because a range is moving, leadership is changing, or an undecided transaction intent blocks the page, Kahuna bounds the retry loop and returns a retryable server error instead of scanning forever. Retry the command after a short backoff.
