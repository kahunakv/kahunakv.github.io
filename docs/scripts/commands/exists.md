
# Command: Exists

Checks whether a key with **persistent** durability exists. Use it instead of [`get`](/docs/scripts/commands/get/) when you only need to know whether the key is there: it does not return the value to the client, so it is cheaper, especially for large values.

Persistent keys are replicated and survive node failures. If the key does not exist, `false` is returned. For keys written with `eset`, use [`eexists`](/docs/scripts/commands/eexists/).

## Syntax

```text
exists <key>
exists <key> at <revision>
exists <key> as of <hlc-timestamp>
let <variable> = exists <key> [at <revision> | as of <hlc-timestamp>]
```

`<revision>` is an integer literal, and `@` is a short form of `at`. See [Get Revision](/docs/scripts/commands/get/#get-revision).

## Examples

```kahuna
exists `config/limits/max-connections`
```
```text
r- not exists 9ms
```

```kahuna
set `config/limits/max-connections` 1000
```
```text
r0 set 11ms
```

```kahuna
exists `config/limits/max-connections`
```
```text
r0 exists 8ms
```

Inside a script, assign the result to a variable:

```kahuna
let exists_key = exists "user:123:profile"
if exists_key then
  return "User found"
else
  return "User not found"
end
```

## Reading Past Versions

`exists` also supports [snapshot reads](/docs/glossary/#snapshot) with `as of` ([timestamp format](/docs/scripts/commands/get/#get-as-of-timestamp)):

```kahuna
exists `config/limits/max-connections` as of 1718392012345
```

This checks whether the key existed at that snapshot time, not whether it exists now. `at <revision>` checks one exact revision instead.

## Checking the Result

A successful existence check counts as found for `not found`, just as a successful `get` does. The guard remembers the last read even when a `let` or a write runs between that read and the guard. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards).
