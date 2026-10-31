
# Command: Get

Reads a key with **persistent** durability, written with [`set`](/docs/scripts/commands/set/): its current value, a specific revision, or the value visible at a past time. Persistent keys are replicated and survive node failures. If the key does not exist, `null` is returned.

Persistent and ephemeral keys are separate: to read a key written with `eset`, use [`eget`](/docs/scripts/commands/eget/). See [Durability Levels](/docs/architecture/durability-levels/).

## Syntax

```text
get <key>
get <key> at <revision>
get <key> as of <hlc-timestamp>
let <variable> = get <key> [at <revision> | as of <hlc-timestamp>]
```

`<revision>` is an integer literal, not a placeholder or an expression (see [Parameters](/docs/scripts/basic-syntax/#parameters)). `@` is a short form of `at`: `get <key> @ 0`. Keep the space, because `@0` is read as a placeholder.

## Examples

```kahuna
set `config/limits/max-connections` 1000
```
```text
r0 set 9ms
```

```kahuna
get `config/limits/max-connections`
```
```text
r0 1000 7ms
```

## Reading Past Versions

### Get Revision

The `at` modifier reads the value of a specific [revision](/docs/glossary/#revision):

```text
kahuna-cli> set `config/limits/max-connections` 1000
r0 set 9ms

kahuna-cli> get `config/limits/max-connections`
r0 1000 7ms

kahuna-cli> set `config/limits/max-connections` 500
r1 set 11ms

kahuna-cli> set `config/limits/max-connections` 200
r2 set 11ms

kahuna-cli> get `config/limits/max-connections`
r2 200 8ms

kahuna-cli> get `config/limits/max-connections` at 0
r0 1000 9ms

kahuna-cli> get `config/limits/max-connections` at 1
r1 500 8ms
```

Check the [revisions](/docs/distributed-keyvalue-store/revisions/) section for more information about how they work.

### Get As Of Timestamp

The `as of` modifier reads the value that was visible at a past moment:

```kahuna
get `config/limits/max-connections` as of 1718392012345
```

The timestamp is Unix epoch time in milliseconds, which Kahuna reads as the physical time of its [hybrid logical clock (HLC)](/docs/glossary/#hybrid-logical-clock-hlc). Every command that accepts `as of` uses this format.

This differs from `at`, which targets one exact revision number. `as of` answers "what value was visible at time `T`?"

## Checking the Result

Use `if not found then ... end` to test whether the last read found no key. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards).

## Notes

- `as of 0` is invalid.
- `at` and `as of` cannot be combined on the same statement.
- Inside `begin (snapshot=...)`, plain `get` statements already read from that transaction snapshot unless a per-statement `as of` overrides it.
