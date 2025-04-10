
# Overview

RocksDB is widely used in high-performance storage and database systems, particularly where low-latency, high-throughput key-value storage is required.

### **Why Do These Systems Use RocksDB?**
- **High-performance key-value storage** – Optimized for SSDs with low-latency reads and writes.
- **Embedded & lightweight** – Can be used as an embedded database with a simple API.
- **Write-heavy workload support** – Log-structured merge-tree (LSM) storage design handles fast writes efficiently.
- **Efficient compaction and compression** – Reduces storage costs and improves performance.
- **Atomic writes and transactions** – Supports ACID transactions for consistency.
