

# Command: Edelete

Deletes a ephemeral key/value. The key is ignored if it doesn't exist.

```swift
eset `cache_server_dev` '10.1.1.22:9090'
r0 set 9ms

edelete `cache_server_dev`
r0 set 12ms

eset `cache_server_dev` '10.1.1.24:9090'
r1 set 9ms
```

## Notes

Keep in mind that ephemeral keys, when removed, are only marked as deleted, but they are not immediately cleared from memory. They are fully evicted only when the eviction process runs.

This behavior allows the system to retain the revision history temporarily, which can be useful for consistency checks, conflict resolution, or short-term auditing before the memory is reclaimed.
