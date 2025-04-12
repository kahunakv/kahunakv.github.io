import Kahuna8 from '../assets/kahuna8.png';

# Durability Levels

<div style={{textAlign: 'center'}}>
<img src={Kahuna8} height="350" />
</div>

## Persistent Durability

Kahuna prioritizes the durable storage of data (locks, keys, and sequences) on disk across multiple nodes in the cluster. This design ensures high availability and recovery in case of node crashes or failures. Each time a write operation occurs, the following process is executed:

- **Storing the Key-Value Pair:**  Suppose we want to store a key named `my-config` with the value `'my-value'`.
- **Partition Determination:**  A consistent hash is computed for `my-config` to determine its partition. For example, **CH(`my-config`) = 42**.
- **Leader Identification:**  The node designated as the leader for the Raft group (or partition) 42 is identified. Note that the leader node may differ from the node that initially accepts the transaction, so the request is redirected to the leader node.
- **Proposal and Consensus:**  The leader node then proposes the write operation (`set my-config 'my-value'`) to the other nodes in the cluster. The proposal must be accepted by the follower nodes if no conflicts arise.
- **Temporary Write:**  After receiving confirmation from a majority of the follower nodes, the leader temporarily writes the new key-value pair to its own disk.
- **Commit Phase:**  The leader then instructs the followers to persist the key-value pair on their disks.
- **Visibility:**  Finally, the leader makes the change visible, so that `my-config` now holds the value `'my-value'`. If the read is part of a transaction, an additional MVCC (Multi-Version Concurrency Control) entry is created to provide snapshot isolation and ensure consistent reads within the transaction.
- **Concurrency Control:**  During this process, any reader clients attempting to access the key or other clients trying to modify it are blocked until the operation is fully completed and confirmed.

This orchestration ensures that data is durably replicated across multiple nodes, maintaining consistency for all read and write operations.

For read operations, the following process is executed:

- **Read Request:**  Suppose we want to read the key `my-config`.
- **Partition Determination:**  A consistent hash is computed for `my-config` to determine its partition. For example, **CH(`my-config`) = 42**.
- **Leader Identification:**  The node designated as the leader for the Raft group (or partition) 42 is identified. If the node receiving the request is not the leader, the request is redirected accordingly.
- **Retrieval from Durable Storage:**  The leader reads the latest version of the key from its durable storage. A cache entry is created in memory to avoid repeated disk access for subsequent operations.
- **Returning the Value:**  The key’s value is returned to the client.

## Ephemeral Durability

Not all operations require long-term durability. In scenarios where keys, locks, and sequences are short-lived, Kahuna offers Ephemeral durability, which limits storage to the volatile memory (RAM) of the leader server for the partition.

For ephemeral keys, each time a write operation occurs, the following process is executed:

- **Storing the Ephemeral Key-Value Pair:**  Suppose we want to store an ephemeral key named `my-config` with the value `'my-value'`.
- **Partition Determination:**  A consistent hash is computed for `my-config` to determine its partition. For example, **CH(`my-config`) = 42**.
- **Leader Identification:**  The node designated as the leader for the Raft group (or partition) 42 is identified. Similar to persistent durability, if the initial node is not the leader, the request is redirected.
- **In-Memory Cache Handling:**  The leader creates or retrieves the in-memory cache entry for the key `my-config` and applies the change.
- **Visibility:**  The updated value is made visible immediately, so that `my-config` now holds the value `'my-value'`. If the read is part of a transaction, an additional MVCC (Multi-Version Concurrency Control) entry is created to provide snapshot isolation and ensure consistent reads within the transaction.
- **Concurrency Control:**  As with persistent operations, any reader or modifying client is blocked until the operation is fully completed and confirmed.

This process ensures that all read and write operations maintain consistency even under concurrent access.

## Cache Entries

Both **Ephemeral** and **Persistent** durability modes maintain an in-memory cache entry to accelerate read operations. These cache entries allow for thousands of reads per second, regardless of whether the key is persisted to disk. When memory capacity is reached, cache entries may be evicted based on an LRU (Least Recently Used) algorithm.

Key eviction occurs based on the following criteria:

- Expired keys.
- Keys that have not been recently used, as determined by a configurable time window.
- A sample of keys, with the persistent key's on-disk representation remaining intact.

The eviction algorithm is executed independently for each partition, so that memory can be freed concurrently without impacting incoming read or write operations.

## Summary of Durability Modes: Advantages and Disadvantages

### Persistent Durability

**Advantages:**

- **High Availability and Resilience:**  Data is stored on disk across multiple nodes, ensuring recovery in the event of node crashes or failures.  
- **Consistency:**  The use of replication and consensus mechanisms (via Raft) ensures that all read and write operations remain consistent.
  
**Disadvantages:**

- **Increased Latency:**  Writing to disk and coordinating with multiple nodes introduces higher latency, which may impact performance.
- **Resource Intensive:**  The replication and consensus processes require additional computational and storage resources.  
- **Blocking Operations:**  Read and Write operations are blocked until the write operations achieve quorum in the cluster, which can delay processing under heavy load.

### Ephemeral Durability

**Advantages:**

- **Speed and Low Latency:**  Operations are performed in memory, offering faster read and write responses.
- **Lower Resource Overhead:**  By avoiding disk writes, system resource demands and replication overhead are minimized.
- **Efficiency for Short-Lived Data:**  Ideal for use cases where data does not need long-term storage such as caches, short-lived locks, sessions, etc.

**Disadvantages:**

- **Lack of Persistence:**  Data is volatile; in the event of a node failure, data stored only in memory is lost.
- **Limited Use Cases:**  Best suited for temporary data such as caches, short-lived locks, sessions, etc, making it less appropriate for scenarios requiring long-term durability.  
- **Potential Data Inconsistency on Failures:**  With data not being stored to disk, recovery mechanisms may be limited during unexpected shutdowns or crashes.

## Use Cases

### Persistent Durability Use Cases

- **Configuration Management:** Systems that manage configuration data for applications often require high reliability and consistency. Using persistent durability ensures that changes are recorded and can be recovered in case of system failures.
- **Financial Transactions:** Applications handling financial transactions must not lose any critical information. Persistent durability guarantees that transaction logs and critical data remain intact despite crashes.
- **Audit Logs and Compliance:** For systems needing to maintain detailed records for regulatory or auditing purposes, persistent durability preserves historical data over the long term.
- **Critical State Management:**  Any service that requires its operational state to be maintained across reboots or failures, such as coordination services or distributed locks, benefits from persistent durability.

### Ephemeral Durability Use Cases

- **Session Management:**  Applications that maintain user sessions or temporary state information can use ephemeral durability. This mode is effective because session data is transient and does not require long-term storage.
- **Caching Frequently Accessed Data:**  When performance is critical and data is frequently requested, storing it in memory using ephemeral durability can significantly reduce access latency.
- **Short-Lived Data for Real-Time Processing:**  Real-time analytics or streaming applications that process transient data can leverage ephemeral durability to achieve faster read/write cycles without the overhead of disk persistence.
- **Testing and Development Environments:**  In scenarios where temporary data storage is acceptable, such as during development or testing, ephemeral durability provides a high-speed, low-resource option without the need for long-term data retention.

This balanced overview helps in choosing the right durability mode based on the specific operational needs and performance considerations of your use case.