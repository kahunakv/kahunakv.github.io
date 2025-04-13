
# Set

Allows to create or update a key/value in a persistent durable way.

```swift
kahuna-cli> set `services/email/instance-3` '{"ip": "10.1.1.22", "port": 9090}'
r0 set 9ms

kahuna-cli> set `services/email/instance-3` '{"ip": "10.1.1.22", "port": 9090}'
r1 set 12ms
```

## NX

If the `NX` modifier is passed the key will be only updated if the key doesn't exist.

```swift
kahuna-cli> set session_user1 "ab10a9bc1924cd" nx
r0 not set 10ms
```

## XX

If the `XX` modifier is passed the key will be only updated if the key already exists.

```swift
kahuna-cli> set config_feature_x "enabled" xx
r0 not set 5ms

kahuna-cli> set config_feature_x "enabled"
r0 set 7ms

kahuna-cli> set config_feature_x "enabled" xx
r1 set 7ms
```

## EX

The `EX` modifier allows to set the key's expiration in milliseconds (a positive integer higher than 0):

```swift
kahuna-cli> set `email/leader` "node3" EX 60000
r0 set 11ms
```

## Compare-Value-And-Swap (CVAS)

A Compare-Value-And-Swap (CAS) operation ensures atomic updates and prevents race conditions where multiple clients may try to modify the same key simultaneously:

```swift
kahuna-cli>  set `locks/tasks/123` "node1" ex 10000 nx
r0 set 14ms
```

Mark the task as completed if this node still hold the key:

```swift
kahuna-cli>  set `locks/tasks/123` "completed" cmp "node1"
r1 set 9ms
```

## Compare-Revision-And-Swap (CRAS)

A Compare-Revision-And-Swap (CRAS) does the same as CVAS but the revision is compared:

```swift
kahuna-cli>  set `locks/tasks/123` "node1" ex 10000 nx
r7 set 15ms
```

The prev `set` returned revision 7. Mark the task as completed if the revision is known by the process:

```swift
kahuna-cli>  set `locks/tasks/123` "completed" cmprev 7
r8 set 11ms
```
