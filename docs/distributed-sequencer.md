import Kahuna6 from './assets/kahuna6.png';

# Distributed Sequencer

<div style={{textAlign: 'center'}}>
<img src={Kahuna6} height="350" />
</div>

Distributed systems are hard because there’s no shared memory, clocks are not perfectly synchronized, and messages can arrive out of order. A distributed sequencer provides a way to enforce order despite all that chaos.

The **Kahuna's distributed sequencer** generates monotonically increasing, globally ordered sequence of identifiers (often called sequence numbers, version numbers, or timestamps). Its job is to ensure that operations across multiple nodes can be totally ordered even though they happen concurrently on different machines.

It can be used to answer the question: What happened first? By assigning each operation a unique, increasing number (or timestamp), you can impose order on a system that is otherwise full of race conditions, concurrent updates, and network delays.

## What It Enables

- **External Global Sequences**: In an environment with multiple hybrid systems, Kahuna serves as a central point for obtaining global sequences: invoice numbers, NFT numbering, assigning the next number in an artifact or mobile build machine, unique IDs for customers in a sharded database, and more.

- **Total Ordering:** Ensures that every node sees changes in the same order. Crucial for logs, ledgers, replicated state machines.

- **Conflict Resolution:** Helps detect and resolve write-write or read-write conflicts. For example, last-writer-wins or fencing token semantics.

- **Replication & Recovery**: Ensures all replicas apply updates in the same sequence. Makes log-based recovery deterministic and safe.

- **Leader Election / Locking**: Fencing tokens generated by a sequencer prevent stale leaders from performing dangerous operations.

## Key Features:

- **Strong Consistency & Durability:** Built with a focus on reliability, every generated sequence maintains strong consistency and durability. This guarantees that even in distributed environments, no sequence is ever duplicated or lost.
- **Efficient Load Distribution:** Leveraging Raft Groups, the system assigns sequences to different nodes. This strategy not only maximizes compute power across the cluster but also enhances performance and fault tolerance.
- **Seamless Integration:** The distributed sequencer is designed to be easily integrated into various applications, making it an ideal solution for systems requiring reliable, high-volume sequence generation.

In summary, a **distributed sequencer** is what keeps order in a world full of distributed chaos. It’s a foundational building block that makes strong consistency, safe concurrency and ordered replication possible.

