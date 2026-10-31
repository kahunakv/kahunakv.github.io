
# Command: EExists

Checks whether a key with **ephemeral** durability exists. Like [`exists`](/docs/scripts/commands/exists/), it does not return the value to the client, so it is cheaper than `eget` when you only need to know whether the key is there.

Ephemeral keys live only in the partition leader's memory and are lost on a node restart or a leader change; see [Durability Levels](/docs/architecture/durability-levels/). If the key does not exist, `false` is returned. For keys written with `set`, use [`exists`](/docs/scripts/commands/exists/).

## Syntax

```text
eexists <key>
eexists <key> at <revision>
eexists <key> as of <hlc-timestamp>
let <variable> = eexists <key> [at <revision> | as of <hlc-timestamp>]
```

`<revision>` is an integer literal, and `@` is a short form of `at`. See [Get Revision](/docs/scripts/commands/get/#get-revision).

## Examples

```kahuna
eexists `config/limits/max-connections`
```
```text
r- not exists 9ms
```

```kahuna
eset `config/limits/max-connections` 1000
```
```text
r0 set 11ms
```

```kahuna
eexists `config/limits/max-connections`
```
```text
r0 exists 8ms
```

Inside a script, assign the result to a variable:

```kahuna
let exists_key = eexists "user:123:profile"
if exists_key then
  return "User found"
else
  return "User not found"
end
```

## Reading Past Versions

`eexists` also supports [snapshot reads](/docs/glossary/#snapshot) with `as of` ([timestamp format](/docs/scripts/commands/get/#get-as-of-timestamp)):

```kahuna
eexists `config/limits/max-connections` as of 1718392012345
```

This checks whether the ephemeral key existed at that snapshot time, not whether it exists now. `at <revision>` checks one exact revision instead.

## Checking the Result

A successful existence check counts as found for `not found`, just as a successful `get` does. The guard remembers the last read even when a `let` or a write runs between that read and the guard. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards).
