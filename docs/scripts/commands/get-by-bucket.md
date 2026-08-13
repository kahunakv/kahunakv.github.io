# Command: Get By Bucket

Returns persistent key/value pairs that belong to the same bucket. A bucket is the first path segment before `/`, so keys such as `services/auth`, `services/payments`, and `services/search` all belong to the `services` bucket.

```kahuna
set `services/auth` "localhost:8081"
r0 set 9ms

set `services/payments` "localhost:8082"
r0 set 10ms

get by bucket `services`
r0 services/auth localhost:8081
r0 services/payments localhost:8082
```

## Assigning Results

Inside a script, assign the command to a variable with `let`. The variable receives an array of the returned values.

```kahuna
let services = get by bucket `services`
return count(services)
```

## Get By Bucket As Of Timestamp

`get by bucket` also supports snapshot reads:

```kahuna
get by bucket `services` as of 1718392012345
```

This returns only the members that were visible in that bucket at the requested snapshot time.

If a key already existed at that time and was updated or deleted later, the snapshot still returns the older visible value from the requested time. Keys created after that time are not returned.

## Notes

`get by bucket` is a consistent operation because all keys in the same bucket are routed to the same partition. Use this command when your schema intentionally groups related keys under a shared single-partition bucket prefix.

The command returns the matching bucket in one response and is capped at `4096` entries. Keep buckets intentionally bounded. For large ordered key spaces, use paginated range reads instead.

If a key space is configured for key-range routing and later splits into multiple ordered ranges, whole-space traversal should use range-oriented reads instead of assuming the entire prefix still lives on one partition.
