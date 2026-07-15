import Kahuna8 from '../assets/kahuna8.png';

# Durability Levels

<div style={{textAlign: 'center'}}>
<img src={Kahuna8} height="350" />
</div>

## Persistent Durability

Kahuna prioritizes the durable storage of data (locks, keys, and sequences) through Raft replication and materialized local storage. This design ensures high availability and recovery in case of node crashes or failures. Each time a persistent write operation occurs, the following process is executed:

- **Storing the Key-Value Pair:**  Suppose we want to store a key named `my-config` with the value `'my-value'`.
- **Partition Determination:**  A consistent hash is computed for `my-config` to determine its partition. For example, **CH(`my-config`) = 42**.
- **Leader Identification:**  The node designated as the leader for Raft partition 42 is identified. The leader may differ from the node that initially received the request, so Kahuna forwards the request when needed.
- **Proposal and Consensus:**  The leader proposes the mutation as a Raft log entry. A quorum must replicate and commit the entry before the write is considered committed.
- **Apply to Memory:**  Once Raft commits the entry, Kahuna applies it to the actor-owned in-memory state machine.
- **Background Materialization:**  The dirty key/value entry is queued to `BackgroundWriterActor`, which flushes materialized state and selected revision history to RocksDB, SQLite, or the configured backend.
- **Visibility:**  The committed value becomes visible through the partition leader. If the write is part of a transaction, visibility is controlled by the transaction coordinator, write intents, MVCC metadata, and two-phase commit.

This orchestration ensures that persistent data is ordered and replicated by Raft, while materialized storage lets a node recover efficiently without replaying the entire WAL.

For read operations, the following process is executed:

- **Read Request:**  Suppose we want to read the key `my-config`.
- **Partition Determination:**  A consistent hash is computed for `my-config` to determine its partition. For example, **CH(`my-config`) = 42**.
- **Leader Identification:**  The node designated as the leader for Raft partition 42 is identified. If the node receiving the request is not the leader, the request is forwarded accordingly.
- **Retrieval from Memory or Durable Storage:**  The leader usually serves the latest value from actor-owned memory. If a persistent entry was evicted from memory, it can be reloaded from durable storage.
- **Returning the Value:**  The key’s value is returned to the client.

## Ephemeral Durability

Not all operations require long-term durability. In scenarios where keys, locks, and sequences are short-lived, Kahuna offers Ephemeral durability, which limits storage to the volatile memory (RAM) of the leader server for the partition.

For ephemeral keys, each time a write operation occurs, the following process is executed:

- **Storing the Ephemeral Key-Value Pair:**  Suppose we want to store an ephemeral key named `my-config` with the value `'my-value'`.
- **Partition Determination:**  A consistent hash is computed for `my-config` to determine its partition. For example, **CH(`my-config`) = 42**.
- **Leader Identification:**  The node designated as the leader for partition 42 is identified. Similar to persistent durability, if the initial node is not the leader, the request is forwarded.
- **In-Memory Handling:**  The leader creates or retrieves the in-memory entry for `my-config` and applies the change.
- **Visibility:**  The updated value is made visible through the leader. If the write is part of a transaction, visibility is controlled by the transaction coordinator and MVCC state.
- **Concurrency Control:**  Conflicting operations are serialized through actor ownership, locks, write intents, or transaction validation.

This process ensures that all read and write operations maintain consistency even under concurrent access.

## Cache Entries

Both **Ephemeral** and **Persistent** durability modes maintain in-memory key/value entries to accelerate reads. Persistent entries can be reloaded from durable storage after eviction, while ephemeral entries are removed permanently because they have no durable backing store.

Kahuna runs a bounded key/value collector independently on each actor. The collector first removes definite garbage such as deleted, undefined, and expired entries using tombstone and expiration indexes. If the actor is still above its entry or byte budget, it evicts cold live entries from an intrusive LRU list. Persistent entries whose latest change may not be flushed to disk are pinned until they are safe to reload from storage. Revision and MVCC metadata are trimmed inline where they grow.

See [Keys Eviction](/docs/architecture/keys-eviction/) for the full algorithm and configuration details.

## Summary of Durability Modes: Advantages and Disadvantages

### Persistent Durability

**Advantages:**

- **High Availability and Resilience:**  Data is replicated through Raft and materialized to disk, ensuring recovery in the event of node crashes or failures.
- **Consistency:**  The use of replication and consensus mechanisms (via Raft) ensures that all read and write operations remain consistent.
  
**Disadvantages:**

- **Increased Latency:**  Writing to disk and coordinating with multiple nodes introduces higher latency, which may impact performance.
- **Resource Intensive:**  The replication and consensus processes require additional computational and storage resources.
- **Higher Write Coordination Cost:**  Writes wait for Raft commit before they are considered durable, which can add latency under heavy load.

### Ephemeral Durability

**Advantages:**

- **Speed and Low Latency:**  Operations are performed in memory, offering faster read and write responses.
- **Lower Resource Overhead:**  By avoiding disk writes, system resource demands and replication overhead are minimized.
- **Efficiency for Short-Lived Data:**  Ideal for use cases where data does not need long-term storage such as caches, short-lived locks, sessions, etc.

**Disadvantages:**

- **Lack of Persistence:**  Data is volatile; in the event of a node failure, data stored only in memory is lost.
- **Limited Use Cases:**  Best suited for temporary data such as caches, short-lived locks, and sessions, making it less appropriate for scenarios requiring long-term durability.
- **No Restart Recovery:**  With data not being stored to disk, ephemeral values cannot be reconstructed after unexpected shutdowns or crashes.

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
