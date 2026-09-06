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

Automatic splitting has two independent triggers. The count trigger splits a range after it reaches a configured number of keys. The opt-in load trigger splits a range whose persistent write rate and WAL backlog remain high, even when the range contains relatively few keys. Load-based splitting selects a split key from observed write distribution and requires [leader balancing](/docs/leader-balancing/) to relocate work across nodes.

See [Load-Based Range Splitting](/docs/distributed-keyvalue-store/load-based-range-splitting/) for configuration, metrics, and limitations.

Range moves are protected by a **generation fence**:

- the client or coordinator routes a write using the current range descriptor generation
- if the range split or moved before the write is replicated, the write is rejected with `MustRetry`
- the caller resolves the key again and retries against the new range owner

This prevents writes from silently landing on stale partitions after a split or merge.

Splits and merges also quiesce the moving key interval during the copy and cutover window. Kahuna combines a range lock on the source partition with a replicated descriptor deadline, so writes that race with movement are refused retryably instead of being acknowledged on the old partition and lost after routing changes.

## Meta Partition

The range-descriptor map is replicated on the **meta partition** so every node can resolve key-range ownership consistently.

At a high level:

- partition `0` is the system and meta partition
- the range map is committed on partition `0` beside the cluster partition-map coordinator
- data ranges live on data partitions starting at partition `1`

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

Registration has two parts:

- the routing-mode flag is node-local and must be set on every node
- the initial whole-space descriptor is replicated once through the meta partition

Use the CLI to register on every endpoint in the connection string:

```bash
kahuna-cli \
  -c "https://kahuna-1:8082,https://kahuna-2:8082,https://kahuna-3:8082" \
  --register-key-range users
```

The CLI fans out because registering only one node leaves a mixed cluster: that node routes `users/*` by key range while the others still hash it. Use `--node` only when you intentionally want to target one node and accept that intermediate state.

The registration response reports:

| Field | Meaning |
|-------|---------|
| `success` | The answering node routes the space by key range and sees at least one descriptor. |
| `status` | `Seeded`, `AlreadySeeded`, `Indeterminate`, `InvalidInput`, or `KeyRangeDisabled`. |
| `seeded` | This request committed the initial descriptor. False can still be success if another request already seeded it. |
| `routingMode` | The answering node's local routing mode for the key space. |
| `descriptorCount` | Descriptors visible to the answering node. |

`Indeterminate` means the node-local mode changed but the descriptor is not visible on that node yet. Re-read the range map before writing to the space.

Unregister a key space with:

```bash
kahuna-cli \
  -c "https://kahuna-1:8082,https://kahuna-2:8082,https://kahuna-3:8082" \
  --unregister-key-range users
```

## Inspect and Administer Ranges

Read the applied range map from any node:

```bash
kahuna-cli -c "https://kahuna-1:8082" --ranges
kahuna-cli -c "https://kahuna-1:8082" --ranges --key-space users
```

REST exposes the same map:

```http
GET /v1/ranges
GET /v1/ranges?keySpace=users
```

The response includes `initialized`, the answering node's `localEndpoint`, and one entry per key space. Each key-space entry includes its node-local `routingMode` plus ordered descriptors with `startKey`, `endKey`, `partitionId`, and `generation`.

Force a split at an exact key:

```bash
kahuna-cli \
  -c "https://kahuna-1:8082,https://kahuna-2:8082,https://kahuna-3:8082" \
  --split-range users \
  --split-key users/0500
```

REST:

```http
POST /v1/ranges/split
Content-Type: application/json

{"keySpace":"users","splitKey":"users/0500"}
```

Split is leader-only for the partition that owns the range map. A non-leader refuses with `NotLeader` and may include `leaderHint`.

The split response includes `determinate`. Use it before taking action:

| `status` | `determinate` | Meaning |
|----------|---------------|---------|
| `Succeeded` | `true` | The range split and `newPartitionId` serves the upper half. |
| `NotLeader` | `true` | Nothing was attempted. Retry against the hinted leader or another endpoint. |
| `NoRange` | `true` | The key space is unregistered or no descriptor covers the split key. |
| `InvalidSplitKey` | `true` | The key would create an empty range or is outside the covering range. |
| `BelowMinRangeSize` | `true` | The policy refused the split because one half would be too small. |
| `PartitionCreationFailed` | `true` | The map did not change, though an unused partition may have been created. Retry allocates a fresh partition ID. |
| `TransferFailed`, `QuiesceFailed`, `CutoverFailed`, `ConcurrentSplit`, `Indeterminate` | `false` | The map may still change. Re-read `GET /v1/ranges`. |

Run the merge pass on demand:

```bash
kahuna-cli -c "https://kahuna-1:8082" --merge-ranges
```

REST:

```http
POST /v1/ranges/merge
```

Merge scans every key-range space and folds adjacent ranges that are below the configured minimum. There is no per-key-space merge API and no request-level size override. A non-leader returns `NotLeader` instead of reporting `0` merges, so `0` means a leader actually ran the pass and found nothing eligible.

Range admin is also available through gRPC and `Kahuna.Client`.
