# Command: EGet By Bucket

Returns ephemeral key/value pairs that belong to the same bucket. A bucket is the part of the key before the last `/`, so keys such as `sessions/user-1`, `sessions/user-2`, and `sessions/user-3` all belong to the `sessions` bucket.

All keys of a bucket live on one partition, so this command reads the whole group in one consistent operation. Use it for small groups of related temporary keys, such as active sessions. See [Buckets](/docs/distributed-keyvalue-store/buckets/). For persistent keys, use [`get by bucket`](/docs/scripts/commands/get-by-bucket/).

```kahuna
eset `sessions/user-1` "active"
r0 set 5ms

eset `sessions/user-2` "active"
r0 set 5ms

eget by bucket `sessions`
r0 sessions/user-1 active
r0 sessions/user-2 active
```

## Assigning Results

Inside a script, assign the command to a variable with `let`. The variable receives an array of the returned values.

```kahuna
let sessions = eget by bucket `sessions`
return count(sessions)
```

## EGet By Bucket As Of Timestamp

`eget by bucket` also supports snapshot reads:

```kahuna
eget by bucket `sessions` as of 1718392012345
```

This returns only the ephemeral members that were visible in that bucket at the requested snapshot time.

If a key already existed at that time and was updated or deleted later, the snapshot still returns the older visible value from the requested time. Keys created after that time are not returned.

## Notes

`eget by bucket` reads from ephemeral storage. Ephemeral keys can expire or be evicted under memory pressure, so this command is best suited to temporary data such as sessions, leases, and cache entries.

The command returns the matching bucket in one response and is capped at `4096` entries. Keep buckets intentionally bounded. For large ordered key spaces, use paginated range reads instead.
