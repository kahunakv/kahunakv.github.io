# Buckets

A **bucket** is a group of keys that share a prefix, such as:

```text
services/auth
services/matchmaking
services/inventory
```

Kahuna stores all keys of one bucket on the same [partition](/docs/glossary/#partition). Keys spread across different partitions cannot give you the following two things, but a bucket does:

- **One consistent read of the whole group.** `get by bucket "services"` returns every key in the bucket from one partition in one operation, instead of several separate reads that can each see a different moment.
- **Local multi-key transactions.** A transaction that only touches keys in one bucket stays on one partition instead of spanning several.

You get buckets automatically from how you name keys; there is nothing to configure. If you know Redis Cluster, a bucket plays the role of a hash tag such as `{services}`, except that Kahuna takes it from the key name itself. They are Kahuna's simplest way to group related keys, and they fit small, related sets such as service discovery entries, a tenant's settings, or a group of feature flags. For large or growing key spaces, see [Buckets or key ranges?](/docs/distributed-keyvalue-store/key-range-sharding/#buckets-or-key-ranges)

## What a Bucket Means

For keys shaped like `bucket/item`, the **bucket** is the part before the last `/`.

Examples:

```text
services/auth         -> bucket "services"
services/payments     -> bucket "services"
users/0001            -> bucket "users"
orders/2026/0001      -> bucket "orders/2026"
tenant-a/config/api   -> bucket "tenant-a/config"
```

In the default hash-routed model, Kahuna hashes that bucket boundary so every key in the same bucket goes to the same partition. [Key-range sharding](/docs/distributed-keyvalue-store/key-range-sharding/) calls the same boundary a **key space**.

Bucket prefixes are normalized for routing and locking. `services` and `services/` name the same bucket, so scans, prefix locks, range locks, deletes, and writes do not accidentally split across different [actors](/docs/glossary/#actor) because of a trailing slash.

## Why Buckets Are Useful

For example, store service discovery entries under one bucket:

```kahuna
set "services/auth" "localhost:8081"
set "services/matchmaking" "localhost:8082"
set "services/inventory" "localhost:8083"
```

Because those keys belong to the same bucket, Kahuna can serve them from one partition:

```kahuna
let services = get by bucket "services"
```

## Buckets and Transactions

`get by bucket` is a consistent operation because the keys in that bucket are served by one partition. That makes it useful inside transactions for multi-key logic:

```kahuna
begin
 let services = get by bucket "services"
 if count(services) == 3 then
  set "services/users" "localhost:8084"
 end
 commit
end
```

Use this pattern when the bucket is intentionally a **single-partition group**.

## Placement Groups

Hash routing can also co-locate related buckets with a placement group. The group is the part of a key space before the first `|`.

| Key | Key space | Placement group |
|-----|-----------|-----------------|
| `orders|rows/1001` | `orders|rows` | `orders` |
| `orders|by_customer/customer-7/1001` | `orders|by_customer/customer-7` | `orders` |
| `sessions/user-42` | `sessions` | `sessions` |

Keys in `orders|rows/...` and `orders|by_customer/...` remain separate key spaces for bucket reads, prefix locks, and range registration, but hash routing places both under the `orders` group. This is useful when an application keeps rows and secondary indexes in separate prefixes but wants most transactions over them to stay single-partition.

Add the group marker when the key space is created. Changing it later changes placement for new requests, while existing keys remain stored under their old names.

For how hash routing works, see [Hash Routing](/docs/distributed-keyvalue-store/key-range-sharding/#hash-routing).

## When Buckets Are Not Enough

A bucket always lives on one partition. When keys must stay ordered or the key space may grow beyond one partition, use key-range routing instead. See [Buckets or key ranges?](/docs/distributed-keyvalue-store/key-range-sharding/#buckets-or-key-ranges) for the comparison and examples.
