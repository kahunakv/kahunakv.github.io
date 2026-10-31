
# Command: EGet

Reads a key with **ephemeral** durability, written with [`eset`](/docs/scripts/commands/eset/): its current value, a recent revision, or the value visible at a past time. If the key does not exist, `null` is returned. Ephemeral keys live only in the partition leader's memory and are lost on a node restart, a leader change, or memory eviction, so treat `null` as a normal result.

Persistent and ephemeral keys are separate: to read a key written with `set`, use [`get`](/docs/scripts/commands/get/). See [Durability Levels](/docs/architecture/durability-levels/).

## Syntax

```text
eget <key>
eget <key> at <revision>
eget <key> as of <hlc-timestamp>
let <variable> = eget <key> [at <revision> | as of <hlc-timestamp>]
```

`<revision>` is an integer literal, and `@` is a short form of `at`. See [Get Revision](/docs/scripts/commands/get/#get-revision).

## Examples

```kahuna
eset `config/limits/max-connections` 1000
```
```text
r0 set 9ms
```

```kahuna
eget `config/limits/max-connections`
```
```text
r0 1000 7ms
```

## Reading Past Versions

### Get Revision

The `at` modifier reads the value of a specific revision:

```text
kahuna-cli> eset `config/limits/max-connections` 1000
r0 set 9ms

kahuna-cli> eget `config/limits/max-connections`
r0 1000 7ms

kahuna-cli> eset `config/limits/max-connections` 500
r1 set 11ms

kahuna-cli> eset `config/limits/max-connections` 200
r2 set 11ms

kahuna-cli> eget `config/limits/max-connections`
r2 200 8ms

kahuna-cli> eget `config/limits/max-connections` at 0
r0 1000 9ms

kahuna-cli> eget `config/limits/max-connections` at 1
r1 500 8ms
```

> For ephemeral keys, the server keeps only a limited number of recent revisions. If you need every revision of a key, use persistent durability.

Check the [revisions](/docs/distributed-keyvalue-store/revisions/) section for more information about how they work.

### Get As Of Timestamp

The `as of` modifier reads the ephemeral value that was visible at a past moment ([timestamp format](/docs/scripts/commands/get/#get-as-of-timestamp)):

```kahuna
eget `config/limits/max-connections` as of 1718392012345
```

This differs from `at`, which targets one exact revision number.

## Checking the Result

Use `if not found then ... end` to test whether the last read found no key. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards).

## Notes

- `as of 0` is invalid.
- `at` and `as of` cannot be combined on the same statement.
