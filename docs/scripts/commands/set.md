
# Command: Set

Allows to create or update a key/value in a persistent durable way.

```kahuna
set `services/email/instance-3` '{"ip": "10.1.1.22", "port": 9090}'
r0 set 9ms

set `services/email/instance-3` '{"ip": "10.1.1.22", "port": 9090}'
r1 set 12ms
```

## NX

If the `NX` modifier is passed the key will be only updated if the key doesn't exist.

```kahuna
set session_user1 "ab10a9bc1924cd" nx
r0 not set 10ms
```

## XX

If the `XX` modifier is passed the key will be only updated if the key already exists.

```kahuna
set config_feature_x "enabled" xx
r0 not set 5ms

set config_feature_x "enabled"
r0 set 7ms

set config_feature_x "enabled" xx
r1 set 7ms
```

## EX

The `EX` modifier allows to set the key's expiration in milliseconds (a positive integer higher than 0):

```kahuna
set `email/leader` "node3" EX 60000
r0 set 11ms
```

## NOREV

The `NOREV` modifier updates the current value without archiving a historical revision row for that write. The key's current revision still advances, latest `GET` reads still return the new value, and conditional modifiers such as `CMP` and `CMPREV` still work.

Use `NOREV` for cache-style keys or high-churn values where old versions are not useful. It reduces write amplification because Kahuna writes the latest value but skips the extra revision record used by `GET ... AT` and historical snapshot reads.

```kahuna
set `cache/user/1001` '{"name":"Ada"}' ex 60000 norev
r0 set 8ms

set `cache/user/1001` '{"name":"Ada Lovelace"}' ex 60000 norev
r1 set 7ms

get `cache/user/1001`
r1 {"name":"Ada Lovelace"} 5ms
```

`NOREV` can be combined with the other `SET` modifiers:

```kahuna
set `cache/session/abc` "active" ex 300000 nx norev
r0 set 9ms

set `cache/session/abc` "refreshed" norev cmprev 0
r1 set 8ms
```

By-revision reads only work for revisions that were archived by normal writes. A revision produced by a `NOREV` write is not available through `GET ... AT <revision>`.

## Compare-Value-And-Swap (CVAS)

A Compare-Value-And-Swap (CAS) operation ensures atomic updates and prevents race conditions where multiple clients may try to modify the same key simultaneously:

```kahuna
set `locks/tasks/123` "node1" ex 10000 nx
r0 set 14ms
```

Mark the task as completed if this node still holds the key:

```kahuna
set `locks/tasks/123` "completed" cmp "node1"
r1 set 9ms
```

## Compare-Revision-And-Swap (CRAS)

A Compare-Revision-And-Swap (CRAS) does the same as CVAS but the revision is compared:

```kahuna
set `locks/tasks/123` "node1" ex 10000 nx
r7 set 15ms
```

The prev `set` returned revision 7. Mark the task as completed if the revision is known by the process:

```kahuna
set `locks/tasks/123` "completed" cmprev 7
r8 set 11ms
```
