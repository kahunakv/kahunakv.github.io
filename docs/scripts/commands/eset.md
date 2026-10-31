
# Command: ESet

Creates or updates a key with **ephemeral** durability. The value lives only in the memory of the partition [leader](/docs/glossary/#leader-follower-and-learner). Writes are faster than with [`set`](/docs/scripts/commands/set/), but the value is lost on a node restart, a leader change, or memory eviction. Use it for data you can rebuild, such as caches, sessions, and rate-limit counters.

For data you must keep, use `set`. See [Durability Levels](/docs/architecture/durability-levels/) to choose.

## Syntax

```text
eset <key> <value> [nx] [xx] [ex <ms>] [cmp <expected-value>] [cmprev <expected-revision>] [norev]
```

`<key>` is an identifier, a backtick-quoted key such as `` `config/db-connection/dev` ``, a string, or a placeholder. `<value>` is any expression. Modifiers can be combined and written in any order.

## Examples

```kahuna
eset `config/db-connection/dev` 'jdbc:mysql://localhost/test?user=mint'
```
```text
r0 set 9ms
```

```kahuna
eset `config/db-connection/staging` 'jdbc:mysql://mysql-st.company.internal/test?user=mint'
```
```text
r0 set 12ms
```

## Modifiers

`eset` accepts the same modifiers as [`set`](/docs/scripts/commands/set/#modifiers):

| Modifier | Effect |
|----------|--------|
| `nx` | Write only if the key does not exist. |
| `xx` | Write only if the key already exists. |
| `ex <ms>` | Expire the key after `<ms>` milliseconds (a positive integer higher than 0). |
| `cmp <expected-value>` | Write only if the current value equals `<expected-value>` (compare value and set). |
| `cmprev <expected-revision>` | Write only if the current revision equals `<expected-revision>` (compare revision and set). |
| `norev` | Update the current value without archiving a historical revision for this write. |

### NX

With `nx`, the write happens only if the key does not exist.

```kahuna
eset cache_user_front_page '{...}' nx
```
```text
r0 not set 5ms
```

```kahuna
eset cache_user_front_page '{...}'
```
```text
r0 set 10ms
```

### XX

With `xx`, the write happens only if the key already exists.

```kahuna
eset remaining_tickets '100' xx
```
```text
r0 not set 7ms
```

```kahuna
eset remaining_tickets '150'
```
```text
r0 set 11ms
```

```kahuna
eset remaining_tickets '200' xx
```
```text
r1 set 9ms
```

### EX

`ex` sets the key's expiration in milliseconds (a positive integer higher than 0). The key is removed automatically when it expires.

```kahuna
eset `email/leader` 'node3' ex 60000
```
```text
r0 set 11ms
```

## Checking the Result

A refused conditional write prints `not set` and does not stop the script. Use `if not set then ... end` to test whether the last write took effect; it is true when a condition (`nx`, `xx`, `cmp`, or `cmprev`) failed. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards).
