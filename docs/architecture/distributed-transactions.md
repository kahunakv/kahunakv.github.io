# Distributed Transactions

Kahuna implements a robust distributed transaction system that combines multi-version concurrency control (MVCC), two-phase commit protocol, and Raft consensus to ensure data consistency and high availability across its distributed key-value store infrastructure.

## Concurrency Control and Versioning

The system employs Multi-Version Concurrency Control as a foundational mechanism for transaction management. Through MVCC, Kahuna maintains multiple versions of each data item simultaneously, allowing transactions to access consistent snapshots of the database while concurrent write operations proceed independently. This versioning approach effectively ensures transaction isolation without requiring extensive locking that would otherwise diminish performance.

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

## Transaction Flow

A typical distributed transaction in Kahuna progresses through the following stages:

The client initiates a transaction, which receives a timestamp from the accepting Kahuna node. As the transaction executes, it reads from a consistent MVCC-provided snapshot of the data. For write operations, the coordinator implements the two-phase commit protocol, first prewriting changes with appropriate locks, then committing these modifications across all participating nodes. Throughout this process, the Raft protocol ensures agreement among distributed replicas, preserving transaction durability and consistency.

## Two-Phase Commit Implementation

The two-phase commit protocol serves as a critical component in Kahuna's distributed transaction system. This protocol ensures atomicity across multiple independent nodes through a structured approach:

In the first phase (Prepare or Pre-Commit), the node that receives the transaction request becomes the transaction coordinator. This coordinator dispatches prepare requests to all nodes participating in the transaction. Each Kahuna node responds by locking the necessary resources, often implementing this as a temporary key with an associated lease. Nodes that successfully prepare these resources respond with "Ready to Commit" confirmation.

During the second phase (Commit or Rollback), the coordinator evaluates the responses. If all nodes respond successfully, the coordinator issues commit requests to finalize the transaction. However, if any cluster reports a failure, the coordinator sends rollback instructions to all participants. This binary outcome ensures that either all updates succeed completely or none take effect, maintaining transaction atomicity across the distributed system.