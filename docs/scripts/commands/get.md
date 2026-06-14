
# Command: Get

Get the value of key from the persistent durable storage. If the key does not exist `null` is returned.

```swift
set `config/limits/max-connections` 1000
r0 set 9ms

get `config/limits/max-connections`
r0 1000 7ms
```

## Get Revision

Passing the `AT` modifier allows to retrieve the value of a specific revision:

```swift
set `config/limits/max-connections` 1000
r0 set 9ms

get `config/limits/max-connections`
r0 1000 7ms

set `config/limits/max-connections` 500
r1 set 11ms

set `config/limits/max-connections` 200
r2 set 11ms

get `config/limits/max-connections`
r2 200 8ms

get `config/limits/max-connections` at 0
r0 1000 9ms

get `config/limits/max-connections` at 1
r1 500 8ms
```

Check the [revisions](/docs/distributed-keyvalue-store/revisions/) section for more information about how they work.

## Get As Of Timestamp

Passing the `AS OF` modifier reads the value that was visible at a specific **HLC snapshot timestamp**:

```swift
get `config/limits/max-connections` as of 1718392012345
```

This differs from `AT`, which targets one exact revision number. `AS OF` answers "what value was visible at time `T`?"

Notes:

- `AS OF 0` is invalid.
- `AT` and `AS OF` cannot be combined on the same statement.
- Inside `begin (snapshot=...)`, plain `get` statements already read from that transaction snapshot unless a per-statement `AS OF` overrides it.
