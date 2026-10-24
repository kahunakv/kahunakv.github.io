# Backend I/O Scheduler

Kahuna runs storage-engine reads and background writes on dedicated backend I/O schedulers. These pools are separate from Kommander's Raft WAL I/O pools, so user-facing scans and backend flushes do not compete with the WAL reads used by consensus, catch-up, and recovery.

This separates application-read queues from consensus-read queues. They still share CPU and storage bandwidth, so scan-heavy workloads and backup capture can affect replication or foreground latency. The isolation is on by default and most deployments never change it. Read on if persistent reads or scans queue under load, or if you size nodes for a scan-heavy workload; see [Tuning](#tuning).

## Why It Matters

Storage backends such as RocksDB and SQLite perform synchronous work for point reads, scans, read-before-write checks, and batched persistence. Running that work on actor threads would block partition progress, and running it on the Raft WAL read pool would let application traffic interfere with replication and recovery.

The dedicated pools isolate those concerns:

| Pool | Used for | Default |
|------|----------|---------|
| Backend read | Persistent point gets, `EXISTS`, read-before-write checks, lock loads, bucket scans, prefix scans, and range scans. | `8` threads |
| Backend write | Background `StoreKeyValues`, `StoreLocks`, and revision-pruning batches. | `2` threads |
| Raft WAL read | Consensus log reads, catch-up, compaction, and recovery metadata. | `4` threads |

## Configuration

| Server flag | Default | Description |
|-------------|---------|-------------|
| `--backend-read-io-threads` | `8` | Dedicated Kahuna backend read threads. Values less than or equal to `0` auto-size to the processor count. |
| `--backend-write-io-threads` | `2` | Dedicated Kahuna backend writer threads. Keep this small because backend writes are fsync-heavy. Values less than or equal to `0` auto-size to the processor count. |
| `--backend-read-queue-depth` | `4096` | Per-partition pending queue depth before backend reads receive retryable backpressure. |
| `--read-io-threads` | `4` | Kommander WAL read threads. This pool no longer carries Kahuna storage-engine reads. |

Embedded nodes expose the same knobs as `BackendReadIOThreads`, `BackendWriteIOThreads`, and `BackendReadQueueDepth`.

## Tuning

- Increase `--backend-read-io-threads` when persistent point reads or scans queue while CPU and storage still have headroom.
- Keep `--backend-write-io-threads` modest. More writer threads can increase fsync contention without improving throughput.
- Increase `--backend-read-queue-depth` only when short bursts are rejected too aggressively. Sustained rejections usually mean the node is storage-bound.
- Size the Raft WAL read pool for replication and catch-up, not application scans.

When the backend read queue is full, Kahuna returns retryable backpressure instead of blocking actor progress. Background writer backpressure feeds into the existing retry loop and keeps the dirty batch queued.

## Shutdown

Backend schedulers are owned by `KahunaManager` and stop after the actor system drains. That ordering lets in-flight backend I/O finish cleanly during shutdown instead of failing because the shared Raft scheduler already stopped.

## Inline Memory Pages and Batched Probes

Persistent range pages on the `memory` backend can read and merge on the key/value actor thread while within the scan inspection budget. Work beyond that budget resumes through the read scheduler, releasing the actor between rounds. RocksDB and SQLite pages continue on the read pool. `kahuna.scan.pages_read_on_actor_total` and `kahuna.scan.pages_read_on_scheduler_total` distinguish those backend page paths.

[Batched point and range probes](/docs/internals/batched-probes/) combine related reads into fewer hand-offs. A disk range probe submits its open seeks in one scheduler operation and merges them in one actor resume per round; this does not parallelize reads within the partition. Memory range probes share one inspection budget across seeks. Explicit end bounds also reach the storage backends and unflushed overlay, so bounded seeks need not read a full page beyond their requested key interval.
