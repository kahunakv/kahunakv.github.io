# Command: EGet By Bucket

Returns ephemeral key/value pairs that belong to the same bucket. A bucket is the first path segment before `/`, so keys such as `sessions/user-1`, `sessions/user-2`, and `sessions/user-3` all belong to the `sessions` bucket.

```swift
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

```visual-basic
let sessions = eget by bucket `sessions`
return count(sessions)
```

## EGet By Bucket As Of Timestamp

`eget by bucket` also supports snapshot reads:

```swift
eget by bucket `sessions` as of 1718392012345
```

This returns only the ephemeral members that were visible in that bucket at the requested snapshot time.

## Notes

`eget by bucket` reads from ephemeral storage. Ephemeral keys can expire or be evicted under memory pressure, so this command is best suited to temporary data such as sessions, leases, and cache entries.
