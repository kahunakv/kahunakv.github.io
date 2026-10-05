
# Command: Delete

Deletes a persistent key/value. The key is ignored if it doesn't exist.

```kahuna
set `services/email/instance-3` '{"ip": "10.1.1.22", "port": 9090}'
r0 set 9ms

delete `services/email/instance-3`
r1 deleted 12ms
```

## Notes

Keep in mind that deleting a key does not immediately remove it from disk. Instead, it is marked with a tombstone, which prevents it from being visible in future reads.

The tombstone is its own revision. If the live value is at `r0`, the delete returns `r1`, and a later set returns `r2`. This preserves the pre-delete value for historical `AS OF` reads and point-in-time recovery.

Depending on the compaction policies of the underlying key/value store, these deleted keys (tombstones) may be fully removed later to reclaim disk space.

## Checking the Result

Use `if not deleted then ... end` to test whether the last delete found no key. `not set` also treats a successful delete as a write that took effect. A transaction lock's undefined placeholder is absent, so deleting a key that never existed does not create a tombstone. Within a transaction, set-then-delete deletes the staged value; deleting it again finds no key. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards).
