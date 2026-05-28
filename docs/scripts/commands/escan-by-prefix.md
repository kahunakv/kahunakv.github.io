# Command: EScan By Prefix

Scans ephemeral storage across the cluster and returns key/value pairs whose keys start with the specified prefix.

```swift
eset `cache/product/1` "ready"
r0 set 4ms

eset `cache/product/2` "ready"
r0 set 5ms

escan by prefix `cache/product`
r0 cache/product/1 ready
r0 cache/product/2 ready
```

## Assigning Results

Inside a script, assign the command to a variable with `let`. The variable receives an array of the returned values.

```visual-basic
let products = escan by prefix `cache/product`
return count(products)
```

## Notes

`escan by prefix` reads from ephemeral storage and scans across the cluster. Ephemeral keys can expire or be evicted under memory pressure, and a cluster-wide scan can be expensive. Prefer `eget by bucket` when keys share a bucket and a partition-local read is enough.
