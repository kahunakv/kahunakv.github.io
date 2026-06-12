# Buckets

Buckets are Kahuna's simplest way to keep a related group of keys on the same partition.

If several keys share the same key space prefix, Kahuna routes them together. That is why keys such as:

```text
services/auth
services/matchmaking
services/inventory
```

can be read with one consistent `get by bucket "services"` operation.

## What a Bucket Means

For keys shaped like `bucket/item`, the **bucket** is the part before the last `/`.

Examples:

```text
services/auth         -> bucket "services"
services/payments     -> bucket "services"
tenant-a/config/api   -> bucket "tenant-a/config"
```

In the default hash-routed model, Kahuna hashes that bucket boundary so every key in the same bucket goes to the same partition.

## Why Buckets Are Useful

Buckets are a good fit when you want:

- a small related working set to stay on one partition
- consistent prefix reads with `get by bucket`
- multi-key transactions that should stay local to one partition
- simple schemas such as service discovery, tenant settings, or grouped feature flags

Example:

```ruby
set "services/auth" "localhost:8081"
set "services/matchmaking" "localhost:8082"
set "services/inventory" "localhost:8083"
```

Because those keys belong to the same bucket, Kahuna can serve them from one partition:

```ruby
let services = get by bucket "services"
```

## Buckets and Transactions

`get by bucket` is a consistent operation because the keys in that bucket are served by one partition. That makes it useful inside transactions for multi-key logic:

```ruby
begin
 let services = get by bucket "services"
 if count(services) == 3 then
  set "services/users" "localhost:8084"
 end
 commit
end
```

This pattern is ideal when the bucket is intentionally a **single-partition group**.

## When Buckets Are Not Enough

Buckets are not the same as **key-range sharding**.

Use buckets when one partition is the right home for the whole prefix. Use key-range routing when:

- keys must stay ordered
- the key space may grow beyond one partition
- you need range-scoped locality and future splits

Examples of key spaces that often want key-range routing:

- `users/0001`, `users/0002`, `users/0003`
- `orders/2026/000001`, `orders/2026/000002`
- time-ordered event or ledger keys

Learn more in [Key-Range Sharding](/docs/distributed-keyvalue-store/key-range-sharding/).

## Practical Rule

- Use **`get by bucket`** for small or moderate related prefixes that should remain single-partition.
- Use **key-range routing** for ordered key spaces that may need to split across partitions later.

Once a key-range space has split into multiple ranges, treat it as a multi-range ordered space rather than as one bucket living on one partition.
