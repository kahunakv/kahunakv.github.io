# Backend I/O Scheduler

A burst of application scans should not hold up the log reads that keep replicas in sync. Kahuna runs storage-engine reads and background writes on dedicated backend I/O thread pools, the way you might give reporting queries their own database connection pool. These pools are separate from the I/O pools that Kommander, Kahuna's [Raft](/docs/glossary/#raft) library, uses for its [write-ahead log (WAL)](/docs/glossary/#write-ahead-log-wal), so user-facing scans and backend flushes do not compete with the WAL reads used by consensus, catch-up, and recovery.

The pools separate queues, not hardware: they still share CPU and storage bandwidth, so scan-heavy workloads and backup capture can affect replication or foreground latency. The isolation is on by default and most deployments never change it. Read on if persistent reads or scans queue under load, or if you size nodes for a scan-heavy workload; see [Tuning](#tuning).

## Backend Pools

Storage backends such as RocksDB and SQLite perform synchronous work for point reads, scans, read-before-write checks, and batched persistence. Running that work on [actor](/docs/glossary/#actor) threads would block [partition](/docs/glossary/#partition) progress, and running it on the Raft WAL read pool would let application traffic interfere with replication and recovery.

The dedicated pools isolate those concerns:

| Pool | Used for | Default |
|------|----------|---------|
| Backend read | Persistent point gets, `EXISTS`, read-before-write checks, lock loads, bucket scans, prefix scans, and range scans. | `8` threads |
| Backend write | Background `StoreKeyValues`, `StoreLocks`, and revision-pruning batches. | `1` thread |
| Raft WAL read | Consensus log reads, catch-up, compaction, and recovery metadata. | `4` threads |

## Configuration

`--backend-read-io-threads` and `--backend-write-io-threads` size the two backend pools, and `--backend-read-queue-depth` (default `4096`) sets the per-partition pending read depth before backend reads receive retryable backpressure. Both thread counts must be positive; the node refuses to start with `0` or a negative value. `--read-io-threads` sizes the Kommander WAL read pool, which Kahuna storage-engine reads do not use. See [Workers and Runtime](/docs/server-configuration/#workers-and-runtime) and [Raft Communication](/docs/server-configuration/#raft-communication) for the flag reference.

Embedded nodes expose the same knobs as `BackendReadIOThreads`, `BackendWriteIOThreads`, and `BackendReadQueueDepth`. The embedded default for `BackendReadIOThreads` is `4`, not the server's `8`.

## Tuning

- Increase `--backend-read-io-threads` when persistent point reads or scans queue while CPU and storage still have headroom.
- Leave `--backend-write-io-threads` at `1`. Background write batches share one queue and run one at a time, so extra writer threads stay idle.
- Increase `--backend-read-queue-depth` only when short bursts are rejected too aggressively. Sustained rejections usually mean the node is storage-bound.
- Size the Raft WAL read pool for replication and catch-up, not application scans.

When the backend read queue is full, Kahuna returns retryable backpressure instead of blocking actor progress. Background writer backpressure feeds into the existing retry loop and keeps the dirty batch queued.

Shutdown ordering, inline memory-backend pages, and batched probes on these schedulers are described in [Batched Point and Range Probes](/docs/internals/batched-probes/#scheduler-execution).
