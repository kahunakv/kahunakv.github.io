
# Command: EExtend

Keeps a key with **ephemeral** durability alive while its owner is still active, such as a session token that stays valid while the user is active. `eextend` changes the key's expiration time without changing its value. Ephemeral keys live only in the partition leader's memory and are lost on a node restart or a leader change; see [Durability Levels](/docs/architecture/durability-levels/). For persistent keys, use [`extend`](/docs/scripts/commands/extend/).

## Syntax

```text
eextend <key> <ms>
```

`<ms>` is an integer literal: the number of milliseconds from the moment the command runs. `0` removes the expiration. A placeholder or an expression is a syntax error, so a script cannot take the duration from a parameter (see [Parameters](/docs/scripts/basic-syntax/#parameters)).

## Examples

```kahuna
eset `session_token_user1` 'a69eacd410aa'
```
```text
r0 set 4ms
```

```kahuna
eextend `session_token_user1` 3600000
```
```text
r0 extended 3ms
```

The key now expires 3,600,000 ms (1 hour) after the command runs.

An expiration value of zero means that the key never expires:

```kahuna
eextend `session_token_user1` 0
```
```text
r0 extended 7ms
```

An ephemeral key that **never expires** can still be **evicted at any time** if the server is under **memory pressure**. Ephemeral keys live only in memory, and to keep the system stable Kahuna may reclaim memory by evicting keys that are not recently used, regardless of their expiration setting.

## Checking the Result

Use `if not extended then ... end` to test whether the last extend found no key. A key that never existed counts as absent, even if the transaction locked it. `not set` is false after a successful extend, because the expiry update took effect. An extend changes expiry without advancing the key's revision. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards).

## Notes

- For keys with a long expiration time (several hours or days), such as long-term sessions, configuration data, or delayed tasks, use [persistent durability](/docs/architecture/durability-levels/) so the key survives a node failure.
- Expiration timestamps use the [Hybrid Logical Clock (HLC)](/docs/architecture/hybrid-logical-clocks/), so they stay consistent and causally ordered across nodes whose system clocks drift slightly.
