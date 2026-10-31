
# Command: Delete

Deletes a key with **persistent** durability, for example when a service instance deregisters or a job record is no longer needed. Persistent keys are replicated and survive node failures. The key is ignored if it doesn't exist. The delete is recorded as a new [revision](/docs/distributed-keyvalue-store/revisions/), so historical reads from before the delete can still find the old value. For ephemeral keys, use [`edelete`](/docs/scripts/commands/edelete/).

## Syntax

```text
delete <key>
del <key>
```

`del` is a short form of `delete`; both behave the same.

## Examples

```kahuna
set `services/email/instance-3` '{"ip": "10.1.1.22", "port": 9090}'
```
```text
r0 set 9ms
```

```kahuna
delete `services/email/instance-3`
```
```text
r1 deleted 12ms
```

## Checking the Result

Use `if not deleted then ... end` to test whether the last delete found no key. `not set` also treats a successful delete as a write that took effect. Deleting a key that never existed writes no [tombstone](/docs/glossary/#tombstone), even if the transaction locked it. Within a transaction, set-then-delete deletes the staged value; deleting it again finds no key. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards).

## Notes

Deleting a key does not immediately remove it from disk. Kahuna writes a tombstone, which hides the key from future reads.

The tombstone is its own revision. If the live value is at `r0`, the delete returns `r1`, and a later set returns `r2`. This preserves the pre-delete value for historical `as of` reads and [point-in-time recovery](/docs/glossary/#point-in-time-recovery-pitr).

Depending on the compaction policies of the underlying key/value store, these deleted keys (tombstones) may be fully removed later to reclaim disk space.
