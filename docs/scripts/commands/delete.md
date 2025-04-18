
# Command: Delete

Deletes a persistent key/value. The key is ignored if it doesn't exist.

```swift
set `services/email/instance-3` '{"ip": "10.1.1.22", "port": 9090}'
r0 set 9ms

delete `services/email/instance-3`
r0 set 12ms
```

## Notes

Keep in mind that deleting a key does not immediately remove it from disk. Instead, it is marked with a tombstone, which prevents it from being visible in future reads.

This approach is necessary to preserve the revision history of the key, allowing future modifications or writes to be correctly versioned.

Depending on the compaction policies of the underlying key/value store, these deleted keys (tombstones) may be fully removed later to reclaim disk space.