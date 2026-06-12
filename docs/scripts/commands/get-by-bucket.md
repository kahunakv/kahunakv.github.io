# Command: Get By Bucket

Returns persistent key/value pairs that belong to the same bucket. A bucket is the first path segment before `/`, so keys such as `services/auth`, `services/payments`, and `services/search` all belong to the `services` bucket.

```swift
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

```visual-basic
let services = get by bucket `services`
return count(services)
```

## Notes

`get by bucket` is a consistent operation because all keys in the same bucket are routed to the same partition. Use this command when your schema intentionally groups related keys under a shared single-partition bucket prefix.

If a key space is configured for key-range routing and later splits into multiple ordered ranges, whole-space traversal should use range-oriented reads instead of assuming the entire prefix still lives on one partition.
