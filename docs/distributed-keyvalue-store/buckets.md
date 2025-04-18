
# Key Distribution and Buckets

## Regular Key Distribution

Keys, when stored, are distributed across the various nodes over all available partitions. A Kahuna cluster can have dozens, hundreds, or even thousands of partitions spread across active nodes. This ensures that each node acts as a **leader for multiple partitions** and a **follower for others**.  

The ability of a node to be both a leader and a follower simultaneously allows responsibilities to be distributed, enables read and write operations to be accepted from any node, and maximizes the use of the **full compute capacity** available in the cluster.

The algorithm used to decide which partition a key is assigned to is a **range-based consistent hashing** strategy. The entire keyspace is divided into ranges according to the number of active partitions.  

For example, if the keyspace spans from `0` to `1024` and there are **8 partitions**, the distribution would look like this:

| **Partition** | **Range**     |
|---------------|---------------|
| Partition 0   | 0–127         |
| Partition 1   | 128–255       |
| Partition 2   | 256–383       |
| Partition 3   | 384–511       |
| Partition 4   | 512–639       |
| Partition 5   | 640–767       |
| Partition 6   | 768–895       |
| Partition 7   | 896–1024      |

Each key is hashed into this keyspace, and the resulting hash determines which partition it falls into. This approach provides **balanced distribution**, supports **scalability**, and simplifies **rebalancing** when partitions are added or removed.

Now, based on the distribution above, let’s say we want to store the key named `my-config`:

```swift
set `my-config` "ab10a9bc1924cd"
r0 set 10ms
```

By computing the consistent hash: `CH("my-config") = 471`,  
we determine that it falls within the range `384–511`,  
which means its **assigned partition is partition 3**.  

This allows Kahuna to **route the key to the correct leader node** for partition 3 and ensure all operations on `my-config` are handled consistently and efficiently.

## Bucket Distribution

Kahuna provides a way to force a group of different keys to be stored in the same partition. By prefixing the keys with a common bucket, you indicate to the hashing algorithm that this bucket should be used to determine the partition associated with the key.

This means that all keys sharing the same bucket prefix—such as `services/auth`, `services/matchmaking` and `services/inventory` be routed to the same partition, allowing for more efficient transaction execution and reduced cross-partition communication.

In the following example, all keys share a common bucket prefix `services`, and therefore they are hashed to the **same partition**:

```ruby
set "services/auth" "localhost:8081"
set "services/matchmaking" "localhost:8082"
set "services/inventory" "localhost:8083"
```

Because they all begin with the `services/` bucket, the consistent hashing algorithm treats them as part of the **same logical group**, ensuring that they reside in the **same partition**:

```txt
services/auth  
-------- ----
^ bucket ^ key

services/matchmaking  
-------- -----------
^ bucket    ^ key

services/inventory
-------- ---------
^ bucket   ^ key

CH("services") -> 5
```

## Get by Prefix

The fact that all keys are in the same **bucket** and **partition** allows the use of the `get by prefix` operation, which **consistently returns all keys** belonging to the specified bucket.

**Example:**

```ruby
let configs = get by prefix "services"
```

This retrieves all keys that start with `services/`, such as:

- `services/auth`
- `services/matchmaking`
- `services/inventory`

Because they reside in the **same partition**, this operation is efficient, strongly consistent, and avoids the complexity of querying across multiple partitions and nodes.

Since `get by prefix` is a **consistent operation**, it can also be part of a **transaction**. When used within a transaction, it generates **MVCC (Multi-Version Concurrency Control) entries**, providing **snapshot isolation**. The keys read and modified during the transaction will only be committed if the transaction completes successfully—otherwise, the changes will be discarded.

### Example:

```ruby
# Initial setup
set "services/auth" "localhost:8081"
set "services/matchmaking" "localhost:8082"
set "services/inventory" "localhost:8083"
```

Later, inside a transaction:

```ruby
let all_services = get by prefix "services"
if contains(all_services, "services/users") then
  set "services/users" "localhost:8084"
end

let all_services = get by prefix "services"
if contains(all_services, "services/users") then
  return true
end

return false
```

In this example:

- The first `get by prefix` reads a **consistent snapshot** of all keys under `services/`.
- The logic conditionally adds a new service only if `"services/users"` doesn’t already exist.
- The second `get by prefix` confirms whether the new key is present **within the same transactional snapshot**.
- If the transaction commits, all changes become visible atomically; if it fails, none are applied.

This showcases how `get by prefix` can be safely used for **multi-key logic** inside transactional flows.