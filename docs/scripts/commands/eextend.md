
# Command: Eextends

Allows to extend a key/value expiration for ephemeral keys:

```swift
eset `session_token_user1` 'a69eacd410aa'
r0 set 4ms

eextend `session_token_user1` 3600000
r0 set 3ms
```

In the previous example, the key is set to expire in 3'600.000 ms (1 hour) from the moment the extend command is executed.

An expiration value of zero means that the key never expires:

```swift
eextend `session_token_user1` 0
r0 set 7ms
```

For **ephemeral keys**, even if they are set to **never expire**, they can still be **evicted at any time** if the server is under **memory pressure**.

This is because ephemeral durability relies solely on **in-memory storage**, and to ensure system stability, Kahuna may reclaim memory by evicting keys that are not recently used—regardless of their expiration setting.

## Notes

For keys with a long expiration time (several hours or days), it's recommended to use [persistent durability](../../architecture/durability-levels.md). This ensures that the key is not lost in the event of a node failure, as the data is safely stored on disk and replicated across the cluster.

Persistent durability provides high availability and fault tolerance, making it ideal for use cases such as long-term sessions, configuration data, or delayed tasks.

Internally, expiration timestamps are managed using the [Hybrid Logical Clock (HLC)](../../architecture/hybrid-logical-clocks.md), which helps avoid issues caused by clock drift between nodes. This ensures that expiration times are consistent and causally ordered across the cluster, even in distributed environments where system clocks may differ slightly.

