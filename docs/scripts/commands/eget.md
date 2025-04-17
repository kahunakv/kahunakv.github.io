
# Command: Get

Get the value of key from the volatile storage. If the key does not exist `null` is returned.

```swift
kahuna-cli> eset `config/limits/max-connections` 1000
r0 set 9ms

kahuna-cli> eget `config/limits/max-connections`
r0 1000 7ms
```

## Get Revision

Passing the `AT` modifier allows to retrieve the value of a specific revision:

```swift
kahuna-cli> eset `config/limits/max-connections` 1000
r0 set 9ms

kahuna-cli> eget `config/limits/max-connections`
r0 1000 7ms

kahuna-cli> eset `config/limits/max-connections` 500
r1 set 11ms

kahuna-cli> eset `config/limits/max-connections` 200
r2 set 11ms

kahuna-cli> eget `config/limits/max-connections`
r2 200 8ms

kahuna-cli> eget `config/limits/max-connections` at 0
r0 1000 9ms

kahuna-cli> eget `config/limits/max-connections` at 1
r1 500 8ms
```

> In the case of ephemeral storage, the server stores a limited number of recent revisions. If you need to store all revisions of a key, you should use persistent storage.

Check the [revisions](../../distributed-keyvalue-store/revisions) section for more information about how they work.