
# Command: Extend

Keeps a key with **persistent** durability alive while its owner is still active, for example a service registration that a heartbeat renews. `extend` changes the key's expiration time without changing its value or revision, and can also remove the expiration. Persistent keys are replicated and survive node failures. For ephemeral keys, use [`eextend`](/docs/scripts/commands/eextend/).

## Syntax

```text
extend <key> <ms>
```

`<ms>` is an integer literal: the number of milliseconds from the moment the command runs. `0` removes the expiration. A placeholder or an expression is a syntax error, so a script cannot take the duration from a parameter (see [Parameters](/docs/scripts/basic-syntax/#parameters)).

## Examples

```kahuna
set `services/email/instance-3` '{"ip": "10.1.1.22", "port": 9090}'
```
```text
r0 set 9ms
```

```kahuna
extend `services/email/instance-3` 10000
```
```text
r0 extended 7ms
```

The key now expires 10,000 ms (10 seconds) after the command runs.

An expiration value of zero means that the key never expires:

```kahuna
extend `services/email/instance-3` 0
```
```text
r0 extended 7ms
```

Use this for long-lived data, such as configuration settings or user profiles, that should stay until it is deleted.

## Checking the Result

Use `if not extended then ... end` to test whether the last extend found no key. A key that never existed counts as absent, even if the transaction locked it. `not set` is false after a successful extend, because the expiry update took effect. An extend changes expiry without advancing the key's revision. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards).

## Notes

- For keys with short expiration times, such as session tokens, short-lived locks, or transient state, [ephemeral durability](/docs/architecture/durability-levels/) avoids disk I/O and replication overhead.
- Expiration timestamps use the [Hybrid Logical Clock (HLC)](/docs/architecture/hybrid-logical-clocks/), so they stay consistent and causally ordered across nodes whose system clocks drift slightly.
