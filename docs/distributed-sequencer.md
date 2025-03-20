---
sidebar_position: 5
---

# Distributed Sequencer

Kahuna's distributed sequencer enables clients to generate unique, sequential numbers. Clients can request sequences from either a single range or a pool of allowed ranges, ensuring flexibility in how numbers are allocated.

**Key Features:**

- **Strong Consistency & Durability:** Built with a focus on reliability, every generated sequence maintains strong consistency and durability. This guarantees that even in distributed environments, no sequence is ever duplicated or lost.
- **Efficient Load Distribution:** Leveraging Raft Groups, the system assigns sequences to different nodes. This strategy not only maximizes compute power across the cluster but also enhances performance and fault tolerance.
- **Seamless Integration:** The distributed sequencer is designed to be easily integrated into various applications, making it an ideal solution for systems requiring reliable, high-volume sequence generation.

In summary, this tool is a powerful asset for developers who need a highly available, fault-tolerant, and consistent sequence generation mechanism in a distributed architecture.