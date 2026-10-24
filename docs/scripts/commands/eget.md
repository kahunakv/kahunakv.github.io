
# Command: EGet

Reads the current value of an ephemeral key, written with [`eset`](/docs/scripts/commands/eset/). If the key does not exist, `null` is returned. Ephemeral keys can disappear after a node restart, a leader change, or memory eviction, so treat `null` as a normal result.

Persistent and ephemeral keys are separate: to read a key written with `set`, use [`get`](/docs/scripts/commands/get/).

```kahuna
eset `config/limits/max-connections` 1000
r0 set 9ms

eget `config/limits/max-connections`
r0 1000 7ms
```

## Get Revision

Passing the `AT` modifier allows to retrieve the value of a specific revision:

```kahuna
eset `config/limits/max-connections` 1000
r0 set 9ms

eget `config/limits/max-connections`
r0 1000 7ms

eset `config/limits/max-connections` 500
r1 set 11ms

eset `config/limits/max-connections` 200
r2 set 11ms

eget `config/limits/max-connections`
r2 200 8ms

eget `config/limits/max-connections` at 0
r0 1000 9ms

eget `config/limits/max-connections` at 1
r1 500 8ms
```

> In the case of ephemeral storage, the server stores a limited number of recent revisions. If you need to store all revisions of a key, you should use persistent storage.

Check the [revisions](/docs/distributed-keyvalue-store/revisions/) section for more information about how they work.

## Get As Of Timestamp

Passing the `AS OF` modifier reads the ephemeral value that was visible at a specific **HLC snapshot timestamp**:

```kahuna
eget `config/limits/max-connections` as of 1718392012345
```

This differs from `AT`, which targets one exact revision number.
