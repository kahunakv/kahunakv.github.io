# Key-Range Sharding

Kahuna supports two routing models for key/value data:

- **Hash routing**: the default. A key space is mapped to a partition by hash.
- **Key-range routing**: opt-in for key spaces that need locality, ordered reads, and range-scoped concurrency.

The two models coexist in the same cluster.

## Key Spaces

A **key space** is the part of a key before the last `/`.

Examples:

- `services/auth` belongs to key space `services`
- `users/0001` belongs to key space `users`
- `orders/2026/0001` belongs to key space `orders/2026`

Kahuna decides the routing mode per key space, not per individual key.

## Hash Routing

Hash routing is the default because it spreads unrelated workloads across partitions with very little planning.

That works well for:

- caches
- service configuration
- metadata that is read and written by many nodes
- key spaces where locality does not matter

In hash mode, all keys in the same key space route to the same partition because Kahuna hashes the key space boundary, not the full leaf key. That is what makes `get by bucket` possible for prefixes such as `services/`.

## Key-Range Routing

Key-range routing is for key spaces where **adjacent keys should stay adjacent**.

Instead of hashing the key space to one partition forever, Kahuna stores a set of **range descriptors** for that key space. Each descriptor maps a contiguous half-open interval of keys to one partition:

```text
[-inf, users/0250)      -> partition A
[users/0250, users/0700) -> partition B
[users/0700, +inf)      -> partition C
```

This gives Kahuna three things hash routing cannot provide:

- **ordered locality** for keys such as `users/0001`, `users/0002`, `users/0003`
- **range-scoped reads** that only touch the ranges they overlap
- **range-scoped locking and contention**, so unrelated slices of a large key space do not block each other

## Why It Matters

With plain hash routing, a large ordered space such as `users/*` or `orders/*` scatters across partitions. That makes whole-space ordered scans and range-level coordination expensive or impossible.

With key-range routing, those keys stay in contiguous slices. Kahuna can then split a hot or large slice into two smaller slices and move the upper half to a different partition while preserving key order.

This is the model used by systems such as Spanner and CockroachDB.

## Splits, Merges, and Fencing

When a key-range space grows, Kahuna can split one range into two smaller ranges. When two neighboring ranges become too small, Kahuna can merge them.

Range moves are protected by a **generation fence**:

- the client or coordinator routes a write using the current range descriptor generation
- if the range split or moved before the write is replicated, the write is rejected with `MustRetry`
- the caller resolves the key again and retries against the new range owner

This prevents writes from silently landing on stale partitions after a split or merge.

## Meta Partition

The range-descriptor map is replicated on a dedicated **meta partition** so every node can resolve key-range ownership consistently.

At a high level:

- partition `0` is reserved by Kommander
- partition `1` stores the replicated range map
- data ranges live on later partitions

That detail matters for maintainers and operators because the descriptor map is itself durable cluster state, not a local cache.

## Buckets vs Key Ranges

These features are related, but they are not the same thing:

- **Buckets** are a single-partition grouping technique. They are ideal when a prefix such as `services/` should stay together and be read with `get by bucket`.
- **Key ranges** are a scalable locality technique. They are ideal when a key space may grow large enough that one partition should eventually split into several ordered ranges.

Use buckets when you want a small related working set on one partition. Use key-range routing when you want ordered locality that can scale out over time.

## Current User-Facing Caveat

`get by bucket` is a **single-partition** operation. It remains the right tool for hash-routed bucket prefixes and for small unsplit key spaces.

Once a key-range space has actually split, you should think in terms of **ordered range reads**, not "fetch the whole bucket from one partition". The cluster can still serve the data consistently, but the request may span multiple ranges.

## How a Key Space Becomes Range-Routed

Key-range routing is an explicit opt-in. The key space must be registered so Kahuna flips that space from hash mode to key-range mode and seeds its initial whole-space descriptor.

That registration is currently a **server-side startup concern**, not a `kahuna-cli` flag:

- the routing-mode registry is node-local, so each node must register the key space
- the initial descriptor is replicated once through the meta partition leader

In practice, this is an advanced configuration path used by applications that need ordered key spaces, large table-like prefixes, or range-scoped coordination.
