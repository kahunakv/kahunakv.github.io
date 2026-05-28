# Command: Scan By Prefix

Scans persistent storage across the cluster and returns key/value pairs whose keys start with the specified prefix.

```swift
set `services/auth/instance-1` "node1"
r0 set 8ms

set `services/auth/instance-2` "node2"
r0 set 9ms

scan by prefix `services/auth`
r0 services/auth/instance-1 node1
r0 services/auth/instance-2 node2
```

## Assigning Results

Inside a script, assign the command to a variable with `let`. The variable receives an array of the returned values.

```visual-basic
let instances = scan by prefix `services/auth`
return count(instances)
```

## Notes

`scan by prefix` visits nodes and workers to find matching keys. It is broader and slower than `get by bucket`, and it is not the preferred command for transactional logic. Use `get by bucket` when the keys share a bucket and you need a consistent, partition-local read.
