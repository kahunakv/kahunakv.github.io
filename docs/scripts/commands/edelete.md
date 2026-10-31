
# Command: EDelete

Deletes a key with **ephemeral** durability, for example to drop a cache entry or end a session before it expires. Ephemeral keys live only in the partition leader's memory and are lost on a node restart or a leader change; see [Durability Levels](/docs/architecture/durability-levels/). The key is ignored if it doesn't exist. For persistent keys, use [`delete`](/docs/scripts/commands/delete/).

## Syntax

```text
edelete <key>
edel <key>
```

`edel` is a short form of `edelete`; both behave the same.

## Examples

```kahuna
eset `cache_server_dev` '10.1.1.22:9090'
```
```text
r0 set 9ms
```

```kahuna
edelete `cache_server_dev`
```
```text
r1 deleted 12ms
```

```kahuna
eset `cache_server_dev` '10.1.1.24:9090'
```
```text
r2 set 9ms
```

## Checking the Result

Use `if not deleted then ... end` to test whether the last delete found no key. `not set` also treats a successful delete as a write that took effect. Deleting a key that never existed writes no [tombstone](/docs/glossary/#tombstone), even if the transaction locked it. Within a transaction, set-then-delete deletes the staged value; deleting it again finds no key. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards).

## Notes

A deleted ephemeral key is only marked as deleted; it stays in memory until the eviction process runs.

The delete tombstone is its own revision, so the key's revision history continues: in the example above, the `eset` after the delete returns `r2`. The history is kept only until the memory is reclaimed.
