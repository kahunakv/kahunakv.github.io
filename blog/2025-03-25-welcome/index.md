---
slug: welcome
title: Why I Built Kahuna - A New Take on Distributed Key/Value Storage 
authors: [andresgutierrez]
tags: [kahuna]
---

# Why I Built Kahuna: A New Take on Distributed System Tooling

About eight years ago, I had the opportunity to build systems for my company using **[Erlang](https://www.erlang.org/)**. Discovering the actor model was a turning point in how I designed systems from that moment on. However, for strategic reasons, we had to move away from Erlang and focus on the .NET ecosystem. While robust and well-established actor model libraries for C# exist, they included many features we didn’t need, and their performance wasn’t entirely satisfactory for our use cases. 
This led me to the idea of building a lightweight library.

<!-- truncate -->

The goal of creating a simple library led me to develop **[Nixie](https://github.com/andresgutierrez/nixie)**. By leveraging **[lock-free structures](https://learn.microsoft.com/en-us/dotnet/standard/collections/thread-safe/)**, strongly typed actors, low-level programming, and the **[Task Processing Library (TPL)](https://learn.microsoft.com/en-us/dotnet/standard/parallel-programming/task-parallel-library-tpl)**, I built a powerful foundation for application development. It immediately delivered the results we expected: fewer errors and higher performance.

Later, the need arose to develop a leader election library for one of our critical systems, one that wouldn’t rely on an external system, would offer fault tolerance (electing a new leader if the current one failed or went down), and could be integrated into our .NET projects. It was also essential to support multiple partitions (sometimes called regions, groups, or tablets) to effectively utilize computing power without sacrificing consistency. The learning experience and hands-on work with Raft led me to open-source Kommander.

**[Kommander](https://github.com/andresgutierrez/kommander)** is a distributed consensus library for C#/.NET based on **[Raft](https://raft.github.io/)**. It supports multiple Raft groups, each with its own leader, followers, and replication log. It enables node communication via **[gRPC](https://grpc.io/)** (by default) or **REST/JSON** (for those who want or need to use any HTTP protocol 1.1/2/3 or require easy debugging). For the persistent write-ahead log (storage), it leverages the robust and battle-tested **[RocksDB](https://rocksdb.org/)** (created by Meta) as an embedded database, with **SQLite** also available as an option.

Kommander is built on Nixie, meaning processes like leader election, replication, compaction, and membership changes are handled using lightweight actors (state machines) and asynchronous communication. This approach enables hundreds or even thousands of partitions (groups), leveraging multi-core servers efficiently. Additionally, the actor model helps avoid multithreading concurrency issues, reducing the risk of hard-to-reproduce errors and lock contention.

With Kommander and Nixie providing a solid foundation, I recognized additional needs that could be addressed with a new tool based on this technology. This led to the idea of building an auxiliary tool to centralize distributed concerns such as locks, leader election, configuration management, sessions, caching, sequencing, and more.

In the past, we relied on various tools like Redis, Zookeeper, and even database tables to solve these challenges. However, it was easy to misuse a tool or assume it provided guarantees or performance levels that it actually didn’t.

Taking all of this into account, I created Kahuna.

## Why the Name?

The name "Kahuna" comes from a Hawaiian word traditionally used to describe an expert in a field—a fitting metaphor for a tool that aims to be the expert all services consult for coordination and operation. Inspired by battle-tested systems like Redis, etcd, Zookeeper, and Google Spanner, Kahuna is more than just another key/value store.

## Why .NET? Breaking the Language Paradigm

One of my primary motivations for building Kahuna was to demonstrate that powerful, low-level systems infrastructure isn’t limited to C++, Rust, Java, or Go. By implementing Kahuna in modern C# and .NET technologies, I wanted to challenge the prevailing notion that high-performance distributed systems can only be built with traditional systems programming languages. This isn’t a hard rule—there are great tools like Garnet, recently led by Microsoft. Similarly, in Java (a language with a garbage collector), you can find powerful distributed systems like Kafka, Cassandra, and Spark. This choice reflects not just a technical preference but a broader vision of expanding the distributed systems development ecosystem.

## The Three Pillars of Kahuna

Kahuna brings together three critical distributed system primitives in one platform:  

1. **A Distributed Key/Value Store** – for metadata storage, configuration, caching, sessions, and more.  
2. **A Distributed Locking System** – for coordinating access to shared resources in a cluster.  
3. **A Distributed Sequencer** – for generating globally ordered events, crucial for ensuring consistency in distributed workflows.  

Many systems provide these functionalities separately, but I wanted **a single, unified solution** that integrates all three while maintaining strong consistency, high availability, simplicity, and efficient scalability.

## Why Kahuna?  

### **Distributed Transactions with Snapshot Isolation or Serializable Consistency**  
Kahuna supports multi-node **distributed transactions** with **optimistic or pessimistic locking**, allowing developers to balance performance and strict consistency. Transactions can achieve either:  
- **Snapshot Isolation** (MVCC-based) for high-performance reads without conflicts.  
- **Serializable Consistency** for the strongest level of isolation.  

This makes Kahuna ideal for applications requiring strict data integrity guarantees in highly concurrent environments.

### **Two Durability Modes: Persistent & Ephemeral**  
Not all data needs permanent storage. Kahuna supports **two durability modes** to optimize storage and performance:  

- **Persistent Mode**: Data is replicated across nodes for **durability and fault tolerance**, ensuring high availability even during failures.  
- **Ephemeral Mode**: Designed for **short-lived objects** such as **caching, short sessions, and temporary leases/locks**, ensuring lightweight storage without unnecessary replication overhead.  

This flexibility allows developers to use Kahuna for both **long-term state storage and temporary coordination needs.**

### **A More Powerful Approach to Distributed Locking**  
Distributed locking is **notoriously difficult** to get right, and perfect distributed locks are nearly impossible. Kahuna provides **tools to help developers mitigate edge cases**, including:  

- **Persisted Lock State**: Ensuring another node can maintain the lock state if the leader fails.  
- **Leases with Expiration**: Preventing locks from persisting indefinitely if the holder crashes.  
- **Fencing Tokens**: Preventing stale lock holders from causing race conditions.  

These mechanisms **greatly reduce** the risk of deadlocks, split-brain scenarios, and other failure conditions common in distributed environments.

## **Scripting Language Integration**  
A unique feature of Kahuna is its built-in scripting language, allowing developers to create consistent, transactional code that interacts directly with the key/value store.

### **Strong Consistency with Raft-Based Consensus**  
Kahuna ensures **strong consistency** using the **Raft consensus algorithm**, with each partition managed by its own **Raft group**. This design provides:  

- **Fault tolerance**: Automatic leader election and replication ensure high availability.  
- **Consistency guarantees**: Every write is **strongly consistent** across multiple replicas.  

### **Scalability Through Dynamic Partitioning**  
Kahuna is **horizontally scalable**, meaning it expands with infrastructure growth. It supports:  

- **Dynamic partitioning** (similar to sharding), allowing for **load balancing across nodes**.  
- **Automatic rebalancing**, ensuring even workload distribution.  

## Kahuna: A Unified Solution for Modern Distributed Applications  

Kahuna provides a **powerful yet flexible** foundation for building **reliable, scalable, and highly available** distributed applications. By integrating **storage, coordination, and sequencing** into one system, it reduces complexity and offers developers a **consistent, battle-tested approach to managing distributed workloads.**

Kahuna is now **open-source**, and I’d love to hear your thoughts! Whether you need a **transactional key/value store, a robust distributed lock system, or a global event sequencer**, **Kahuna is built to handle it all.**

