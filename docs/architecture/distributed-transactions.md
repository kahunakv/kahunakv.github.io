
import Architecture2 from '../assets/architecture2.png';
import Architecture3 from '../assets/architecture3.png';

# Distributed Transactions

Kahuna implements a robust distributed transaction system that combines multi-version concurrency control (MVCC), two-phase commit protocol, and Raft consensus to ensure data consistency and high availability across its distributed key-value store infrastructure.

Let’s look at the following [Kahuna script](../scripts) example, where we increment the maximum robots capacity per region as long as it doesn’t exceed the global cap:

```visual-basic
let us1_amount = get robots_us1
let us2_amount = get robots_us2
let eu1_amount = get robots_eu1
let sa1_amount = get robots_sa1

let total = to_int(us1_amount) + to_int(us2_amount) + to_int(eu1_amount) + to_int(sa1_amount)

if (total + @amount_to_incr) > @global_cap then
    throw "global cap amount exceeded"
end

set robots_us1 us1_amount + @amount_to_incr
set robots_us2 us2_amount + @amount_to_incr
set robots_eu1 eu1_amount + @amount_to_incr
set robots_sa1 sa1_amount + @amount_to_incr
```

The transaction coordinator, which is the node that receives the request to process the transaction, uses Consistent Hashing (CH) to determine the leader partitions responsible for the key/values involved in the transaction. As shown in this example, two of the keys belong to the node `kahuna-2`, while `kahuna-1` and `kahuna-3` are leaders for one partition each:

<div style={{textAlign: 'center'}}>
<img src={Architecture2} height="350" />
</div>

The transaction operates over 4 partitions distributed across 3 nodes, which means the Transaction Coordinator must ensure it reads from and applies changes across multiple nodes and partitions. While a multi-node transaction requires greater coordination between participants, this kind of distribution allows the computational load to be spread across multiple nodes, enabling parallel execution and improving overall system efficiency.

## Types of Locking:

Kahuna supports two types of locking:

- **Pessimistic Locking**: Locks on the keys involved in the transaction are acquired **exclusively in advance**, ensuring that no other clients can read or write those keys during the execution of the transaction. This prevents external inconsistencies and is particularly useful when there’s **low contention** on the keys. It provides the **highest level of consistency and safety**. Other clients running concurrent transactions that encounter an already-acquired exclusive lock will be aborted and must retry until they can successfully perform their operations. This is the default locking method.

- **Optimistic Locking**: The keys involved are only locked **at the time of commit**. Other clients are allowed to read the data consistently. However, if a conflict is detected on any of the involved keys during the preparation phase, the transaction is **aborted**, and clients must retry. This strategy is ideal when there’s **high read concurrency** and **low write contention**.

### Pessimistic Locking

Continuing with the previous example, here are the steps performed when the transaction is executed using **pessimistic locking**:

- **Acquire exclusive locks on the keys in advance**. This prevents any reads or modifications on the keys during the transaction, ensuring consistency. If any of the keys cannot be exclusively locked, the transaction is aborted. These locks are tied to temporary **leases** to avoid being held indefinitely. In the example: **Exclusive locks** are acquired on: `robots_us1`, `robots_us2`, `robots_eu1`, and `robots_sa1`.

- **Read the keys**. `get` commands are executed. Kahuna identifies the opportunity to **parallelize** the 4 reads by batching the two that go to `kahuna-2` and dispatching individual requests to `kahuna-1` and `kahuna-3`. In the example: The keys `robots_us1`, `robots_us2`, `robots_eu1`, and `robots_sa1` are **read** from their respective leader key/value stores.

- **Execute arithmetic operations and control structures** within the **transaction coordinator**, based on the read values. Any exception thrown, issue encountered, or failed validation will cause the transaction to be aborted, and no changes will be applied. In the example: the `if` and mathematical operations are executed indicating the steps to follow.

- **Write phase**. In parallel, **write intents** are placed on the keys that were modified during the transaction. These intents represent the proposed new values but are not yet committed. In the example: The keys `robots_us1`, `robots_us2`, `robots_eu1`, and `robots_sa1` are **updated with provisional (intent) values**.

- **Prepare**. As part of the **Two-Phase Commit (2PC)** protocol, the final proposed changes are sent to the involved partitions. Each must acknowledge they are ready to apply the changes. Once the transaction coordinator receives confirmation from all nodes, it proceeds to commit. If any problem or conflict is detected during this phase, the transaction is rolled back, ensuring that no partial modifications are persisted.

- **Commit**. Once all preparations succeed, the transaction coordinator instructs the participating nodes to proceed with the commit. The nodes apply the changes to their local key/value stores. In the example: The **provisional values** of `robots_us1`, `robots_us2`, `robots_eu1`, and `robots_sa1` are **applied** to the key/value store and to **durable storage** to make them persistent.

- **Release locks**. The exclusive locks acquired in the first step are released, allowing other transactions, reads, or writes to proceed. Locks are only released **after** the commit phase completes, ensuring that the new state becomes visible **atomically** across all partitions. In the example: The **exclusive locks** acquired on `robots_us1`, `robots_us2`, `robots_eu1`, and `robots_sa1` are **released**.

### Optimistic Locking

If the example transaction were executed using **optimistic locking**, the following steps would be required:

- A **start transaction ID** is selected using the Hybrid-Logical Clock (HLC) at the transaction coordinator. This timestamp provides a globally ordered and causally consistent view of events across the cluster.

- **Read phase**:  The coordinator reads the keys `robots_us1`, `robots_us2`, `robots_eu1`, and `robots_sa1` from their respective leader partitions. These reads are consistent and versioned using Multi-Version Concurrency Control (MVCC), but **no locks are acquired** at this stage.

- **Execution phase**: All computations, validations, and control logic are performed at the **transaction coordinator**, based on the read values. The coordinator keeps track of the **versions** of each key at the time of reading.

- **Validation phase**: Before applying any changes, the coordinator checks that the versions of all involved keys have **not changed** since the initial read. A **commit transaction ID** is then generated to help detect conflicts with other transactions running in parallel. This commit ID is compared against the versions of the keys read during the transaction to ensure that no concurrent modifications have occurred before finalizing the commit. If any version mismatch is detected, the transaction is **aborted** and the client must **retry**. This step ensures that no other transaction has modified those keys in the meantime.

- **Write intents**: If all versions are validated successfully, **write intents** (proposed new values) are created for the modified keys. This step may involve contacting multiple partitions in parallel.

- **Prepare & Commit (2PC)**:
  Similar to pessimistic locking, the coordinator initiates the **Two-Phase Commit** protocol:
  - First, it sends the **prepare** command to all involved partitions.
  - If all nodes confirm they are ready, the **commit** command is issued and values are applied durably to each key/value store.

- **No explicit lock release is needed**, since no exclusive locks were acquired. Consistency is guaranteed through **version validation** before commit.

This approach improves concurrency for **read-heavy workloads** but requires conflict detection and retry logic in the presence of contention.

## Key Buckets

In the previous example, we saw how a semi-random distribution of keys across different partitions—based on consistent hashing helps distribute processing across multiple nodes, workers and partitions **to potentially take full advantage of the compute capacity** in the Kahuna cluster. However, a multi-node key distribution can increase the number of network round-trips required to complete the transaction. While Kahuna performs optimizations like batching and pipelining to reduce the impact of this, using Key Buckets can help enforce that all keys reside in the same partition and worker:

```visual-basic
let us1_amount = get `data-centers/robots_us1`
let us2_amount = get `data-centers/robots_us2`
let eu1_amount = get `data-centers/robots_eu1`
let sa1_amount = get `data-centers/robots_sa1`

let total = to_int(us1_amount) + to_int(us2_amount) + to_int(eu1_amount) + to_int(sa1_amount)

if (total + @amount_to_incr) > @global_cap then
    throw "global cap amount exceeded"
end

set `data-centers/robots_us1` us1_amount + @amount_to_incr
set `data-centers/robots_us2` us2_amount + @amount_to_incr
set `data-centers/robots_eu1` eu1_amount + @amount_to_incr
set `data-centers/robots_sa1` sa1_amount + @amount_to_incr
```

By using a common key bucket like `data-centers/`, you’re telling Kahuna that **consistent hashing should be limited to the bucket rather than the full key**. This causes all keys under that bucket to be hashed together and routed to the same partition.

The new partition distribution would look like this:

<div style={{textAlign: 'center'}}>
<img src={Architecture3} height="350" />
</div>

This approach helps **ensure that related keys are co-located, reducing cross-partition communication and improving transaction performance**.

## Concurrency Control and Versioning

Kahuna employs Multi-Version Concurrency Control (MVCC) as a foundational mechanism for optimistic transaction management. Through MVCC, Kahuna maintains multiple versions of each data item simultaneously, allowing transactions to access consistent snapshots of the database while concurrent write operations can proceed independently. This versioning approach effectively ensures transaction isolation without requiring extensive locking that would otherwise diminish performance.

## Transaction Execution Protocol

Kahuna's transaction protocol follows a structured two-phase commit (2PC) approach:

- During the prewrite phase, the transaction coordinator assigns a unique timestamp to identify the transaction. This coordinator then orchestrates the prewrite process across all affected nodes. The system establishes locks on all keys involved in the transaction and creates tentative data versions reflecting the proposed changes. This preliminary stage ensures that all components are prepared for an atomic commit operation.

- Once all prewrite operations complete successfully, the coordinator initiates the commit phase. The process begins by committing changes on leader nodes before propagating commit instructions to replica nodes. This ordered approach ensures consistency across the distributed system. If any node reports an issue during the prewrite phase, the coordinator initiates a comprehensive rollback to preserve transaction atomicity and system integrity.

## Consensus and Replication Framework

Raft consensus provides the foundation for Kahuna's replication and fault tolerance capabilities. Each node in the Kahuna cluster belongs to a Raft group that replicates data across multiple physical machines. This replication strategy preserves transaction state and data modifications even when individual nodes experience failures. The Raft protocol establishes agreement on operation ordering among all nodes, which is essential for maintaining consistent state across the distributed environment.

## Conflict Resolution and Failure Management

Kahuna implements sophisticated mechanisms for handling concurrency issues and system failures:

The lock management system prevents conflicting operations by ensuring exclusive access to data items during transaction processing. Only one transaction can modify a particular data element at any given time, preventing write conflicts.

When transactions cannot proceed due to conflicts or node failures, Kahuna's rollback mechanisms systematically reverse any prewritten changes. This cleanup process ensures the system remains in a consistent state despite interruptions or failures.

## Two-Phase Commit Implementation

The two-phase commit protocol serves as a critical component in Kahuna's distributed transaction system. This protocol ensures atomicity across multiple independent nodes through a structured approach:

In the first phase (Prepare or Pre-Commit), the node that receives the transaction request becomes the transaction coordinator. This coordinator dispatches prepare requests to all nodes participating in the transaction. Each Kahuna node responds by locking the necessary resources, often implementing this as a temporary key with an associated lease. Nodes that successfully prepare these resources respond with "Ready to Commit" confirmation.

During the second phase (Commit or Rollback), the coordinator evaluates the responses. If all nodes respond successfully, the coordinator issues commit requests to finalize the transaction. However, if any cluster reports a failure, the coordinator sends rollback instructions to all participants. This binary outcome ensures that either all updates succeed completely or none take effect, maintaining transaction atomicity across the distributed system.