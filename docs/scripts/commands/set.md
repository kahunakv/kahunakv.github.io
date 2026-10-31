
# Command: Set

Creates or updates a key with **persistent** durability. The value is replicated through [Raft](/docs/glossary/#raft) and stored on disk, so it survives node restarts, node failures, and leader changes. Use it for data you cannot lose, such as configuration, job state, or balances. Like Redis `SET`, it supports `nx`, `xx`, and an expiration, but `ex` takes milliseconds, not seconds.

For temporary data such as caches, sessions, or counters, [`eset`](/docs/scripts/commands/eset/) is faster. See [Durability Levels](/docs/architecture/durability-levels/) to choose.

## Syntax

```text
set <key> <value> [nx] [xx] [ex <ms>] [cmp <expected-value>] [cmprev <expected-revision>] [norev]
```

`<key>` is an identifier, a backtick-quoted key such as `` `services/email` ``, a string, or a placeholder. `<value>` is any expression. Modifiers can be combined and written in any order.

## Examples

```kahuna
set `services/email/instance-3` '{"ip": "10.1.1.22", "port": 9090}'
```
```text
r0 set 9ms
```

```kahuna
set `services/email/instance-3` '{"ip": "10.1.1.22", "port": 9090}'
```
```text
r1 set 12ms
```

## Modifiers

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
set session_user1 "ab10a9bc1924cd" nx
```
```text
r0 not set 10ms
```

### XX

With `xx`, the write happens only if the key already exists.

```kahuna
set config_feature_x "enabled" xx
```
```text
r0 not set 5ms
```

```kahuna
set config_feature_x "enabled"
```
```text
r0 set 7ms
```

```kahuna
set config_feature_x "enabled" xx
```
```text
r1 set 7ms
```

### EX

`ex` sets the key's expiration in milliseconds (a positive integer higher than 0):

```kahuna
set `email/leader` "node3" EX 60000
```
```text
r0 set 11ms
```

The value after `ex` can be an expression, but it must be an integer. A placeholder arrives as a string, so convert it: `ex to_int(@ttl_ms)`. `ex @ttl_ms` fails with `Invalid SET EX expression`. The same applies to [`eset`](/docs/scripts/commands/eset/).

### NOREV

`norev` updates the current value without archiving a historical [revision](/docs/glossary/#revision) row for that write. The key's current revision still advances, latest `get` reads still return the new value, and conditional modifiers such as `cmp` and `cmprev` still work.

Use `norev` for cache-style keys or high-churn values where old versions are not useful. It reduces write amplification because Kahuna writes the latest value but skips the extra revision record used by `get ... at` and historical snapshot reads.

```kahuna
set `cache/user/1001` '{"name":"Ada"}' ex 60000 norev
```
```text
r0 set 8ms
```

```kahuna
set `cache/user/1001` '{"name":"Ada Lovelace"}' ex 60000 norev
```
```text
r1 set 7ms
```

```kahuna
get `cache/user/1001`
```
```text
r1 {"name":"Ada Lovelace"} 5ms
```

`norev` can be combined with the other `set` modifiers:

```kahuna
set `cache/session/abc` "active" ex 300000 nx norev
```
```text
r0 set 9ms
```

```kahuna
set `cache/session/abc` "refreshed" norev cmprev 0
```
```text
r1 set 8ms
```

By-revision reads only work for revisions that were archived by normal writes. A revision produced by a `norev` write is not available through `get ... at <revision>`.

### Compare Value and Set

Compare value and set is a form of [compare-and-set (CAS)](/docs/glossary/#compare-and-set-cas): the write succeeds only if the current value matches, so two clients cannot overwrite each other's changes. First, claim the task:

```kahuna
set `locks/tasks/123` "node1" ex 10000 nx
```
```text
r0 set 14ms
```

Mark the task as completed if this node still holds the key:

```kahuna
set `locks/tasks/123` "completed" cmp "node1"
```
```text
r1 set 9ms
```

### Compare Revision and Set

Compare revision and set does the same, but compares the revision instead of the value:

```kahuna
set `locks/tasks/123` "node1" ex 10000 nx
```
```text
r7 set 15ms
```

The previous `set` returned revision 7. Mark the task as completed only if the key is still at that revision:

```kahuna
set `locks/tasks/123` "completed" cmprev 7
```
```text
r8 set 11ms
```

## Checking the Result

A refused conditional write prints `not set` and does not stop the script. Use `if not set then ... end` to test whether the last write took effect; it is true when a condition (`nx`, `xx`, `cmp`, or `cmprev`) failed. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards).
