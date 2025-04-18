
# Command: Extends

Allows to extend a key/value expiration for persistent keys:

```swift
set `services/email/instance-3` '{"ip": "10.1.1.22", "port": 9090}'
r0 set 9ms

extend `services/email/instance-3` 10000
r0 set 7ms
```

In the previous example, the key is set to expire in 10,000 ms (10 seconds) from the moment the extend command is executed.

An expiration value of zero means that the key never expires:

```swift
extend `services/email/instance-3` 0
r0 set 7ms
```

This is useful for keys that represent long-lived or permanent data, such as configuration settings, user profiles, or static resources that should remain available indefinitely unless explicitly deleted.

## Notes

For keys with short expiration times, it is recommended to use [ephemeral durability](../../architecture/durability-levels.md) whenever possible. This reduces disk I/O and replication overhead, making it more efficient for temporary data like session tokens, short-lived locks, or transient state.

Internally, expiration timestamps are managed using the [Hybrid Logical Clock (HLC)](../../architecture/hybrid-logical-clocks.md), which helps avoid issues caused by clock drift between nodes. This ensures that expiration times are consistent and causally ordered across the cluster, even in distributed environments where system clocks may differ slightly.

