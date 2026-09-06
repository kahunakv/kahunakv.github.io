# Server Configuration

Kahuna server options are passed as command-line flags to `kahuna-server`. The table below documents the options currently exposed by `KahunaCommandLineOptions`.

See [Backend I/O Scheduler](/docs/backend-io-scheduler/) for how backend read/write pools relate to Raft WAL I/O.

## Network and TLS

| Command Line Option(s) | Description | Default Value |
|------------------------|-------------|---------------|
| `-h`, `--host` | Host option accepted by the CLI. The current Kestrel setup listens on all interfaces for configured HTTP/HTTPS ports. | `*` |
| `-p`, `--http-ports` | One or more HTTP ports for external REST traffic. If omitted, Kahuna listens on HTTP port `2070`. Use `--grpc-cleartext-ports` for cleartext gRPC. | `2070` |
| `--https-ports` | One or more HTTPS ports for external REST/gRPC traffic. HTTPS is bound only when `--https-certificate` is configured. Passing HTTPS ports without a certificate is rejected. | none unless a certificate is configured |
| `--grpc-cleartext-ports` | One or more cleartext HTTP/2 ports for gRPC without TLS. These listeners are gRPC-only and reject HTTP/1.1, so REST clients must use `--http-ports` or `--https-ports`. | none |
| `--https-certificate` | Path to the HTTPS certificate used by Kestrel and trusted for internal HTTPS communication. | empty |
| `--https-certificate-password` | Password for the HTTPS certificate. | empty |

Use `--grpc-cleartext-ports` for trusted local or private-network deployments that need h2c gRPC without TLS overhead. Do not expose cleartext gRPC on untrusted networks because client request payloads are unencrypted. If `--raft-grpc-scheme http://` points inter-node traffic at those ports, Raft and leader-forwarding payloads are also unencrypted.

## Health and Readiness

Kahuna exposes `GET /v1/cluster/health` as a readiness endpoint for load balancers and orchestrators. It returns HTTP `200` only when the node has completed cluster initialization and has a serving cluster role. It returns HTTP `503` while the node is still initializing or is not a member.

The JSON response includes:

| Field | Meaning |
|-------|---------|
| `ready` | `true` when the node can serve requests. Mirrors the HTTP status. |
| `initialized` | `true` after the node has received and applied the cluster partition map. |
| `localRole` | Local membership role, such as `Voter`, `Learner`, `Leaving`, or `NotMember`. |
| `hostedPartitions` | Number of data partitions hosted locally. Informational only; with replica placement a ready node can host zero partitions and still forward requests. |

Use readiness for traffic routing. Membership can be available before the node is initialized, so a node may answer membership queries while still refusing key/value requests.

## Operator Dashboard

Kahuna serves a read-only operator dashboard at the HTTP root by default. Open `http://host:port/` or `https://host:port/` in a browser to inspect node identity, readiness, storage, replication factor, hosted partitions, backup configuration, and selected engine metrics.

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--disable-dashboard` | Disable the browser dashboard and restore the root response to plain `Kahuna.Server`. | disabled |
| `--dashboard-refresh-seconds` | Browser polling interval in seconds. Values are clamped between `1` and `300`. | `5` |

The dashboard is intentionally read-only. It does not start backups, move replicas, split ranges, or write cluster state. The JSON endpoints behind it are:

| Endpoint | Meaning |
|----------|---------|
| `GET /v1/dashboard/summary` | Node identity, readiness, hosted partition count, cluster mode, replication factor, storage paths, backup status, version, uptime, heap bytes, thread count, and refresh interval. |
| `GET /v1/dashboard/metrics` | Curated in-process metrics from Kahuna and Kommander, capped for browser polling. |

## Client Routing Hints

Kahuna can include advisory route hints in REST and gRPC responses. The .NET client can use those hints to send repeated key/value, lock, and sequence operations directly to the node that currently owns the resource, avoiding an extra inter-node forward.

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--advertised-client-endpoint` | Base URL this node advertises to clients in routing hints, for example `https://node1:8082`. If empty, Kahuna derives it from the Raft endpoint and `--advertised-client-scheme`. Set it explicitly when the Raft address is not client-reachable. | derived |
| `--advertised-client-scheme` | URL scheme prepended to peer Raft endpoints when deriving peer client URLs. Empty follows `--raft-grpc-scheme`. | follows `--raft-grpc-scheme` |
| `--disable-peer-endpoint-advertisement` | Never name a peer in a routing hint. Use this when peer client URLs cannot be derived from peer Raft endpoints. | disabled |
| `--disable-routing-hints` | Do not return advisory routing hints. Clients then keep their configured endpoint selection. | disabled |

The route is always advisory: the receiving server re-resolves the resource and checks leadership before executing. See [Client Leader-Aware Routing](/docs/client-routing/) for client modes, endpoint mapping, metadata mode, and metrics.

## Storage and WAL

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--storage` | Materialized Kahuna state backend for persistent locks, key/value entries, revisions, and sequences. Supported values are `rocksdb`, `sqlite`, and `memory`. | `rocksdb` |
| `--storage-path` | File system path for materialized state storage. Use a durable local disk for `rocksdb` or `sqlite`. If omitted, Kahuna resolves it under `KAHUNA_HOME/data`, `$XDG_DATA_HOME/kahuna/data`, or `~/.local/share/kahuna/data` depending on the environment. | resolved user data path |
| `--storage-revision` | Revision name used to select a materialized state database or file set under `--storage-path`. If omitted, the server uses `v1` so restarts reopen the same data set. | `v1` |
| `--wal-storage` | Raft WAL backend used by Kommander. Supported values are `rocksdb`, `sqlite`, and `memory`. | `rocksdb` |
| `--wal-path` | File system path for Raft WAL storage. Use a durable local disk. If omitted, Kahuna resolves it under `KAHUNA_HOME/wal`, `$XDG_DATA_HOME/kahuna/wal`, or `~/.local/share/kahuna/wal` depending on the environment. | resolved user data path |
| `--wal-revision` | Revision name used to select the WAL database or file set under `--wal-path`. | `v1` |
| `--wal-sync-writes` | Keep synchronous durable WAL writes enabled. This is the default behavior. | enabled |
| `--disable-wal-sync-writes` | Disable synchronous durable WAL writes for faster non-critical local or test runs. | disabled |
| `--rocksdb-shared-memory` | Share one RocksDB block cache and write-buffer manager between the materialized state backend and Raft WAL. Applies only when both `--storage` and `--wal-storage` are `rocksdb`. | disabled |
| `--rocksdb-shared-memory-budget-mb` | Total shared RocksDB block-cache budget in MiB. The memtable sub-budget is charged inside this total. | `320` |
| `--rocksdb-shared-memtable-budget-mb` | Shared RocksDB memtable sub-budget in MiB. Must be less than or equal to `--rocksdb-shared-memory-budget-mb`. | `128` |
| `--disable-rocksdb-direct-reads` | Disable RocksDB direct I/O reads for the materialized state backend and use buffered reads through the operating-system page cache. Direct reads are enabled by default. Applies only when `--storage` is `rocksdb`. | disabled |
| `--rocksdb-statistics` | Enable RocksDB internal statistics collection and LOG dumps every 60 seconds for tuning or diagnosis. This adds per-operation overhead. Applies only when `--storage` is `rocksdb`. | disabled |

## Cluster Identity and Discovery

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--initial-cluster` | Static discovery list for the initial Raft cluster. Pass one or more node addresses. | none |
| `--join-existing` | Join a running cluster as a new learner using `--initial-cluster` as the seed list. | disabled |
| `--graceful-leave-on-shutdown` | Commit removal of this member during planned shutdown instead of waiting for SWIM eviction. Do not enable for rolling restarts because the node is removed from membership. | disabled |
| `--initial-cluster-partitions` | Number of Raft partitions created for the initial cluster. | `3` |
| `--raft-nodename` | Human-readable node name used by Raft. If omitted, the server uses the machine name. | machine name |
| `--raft-nodeid` | Numeric node identifier used by Raft. | `0` |
| `--raft-host` | Host advertised for Raft consensus and replication traffic. | `localhost` |
| `--raft-port` | Port advertised for Raft consensus and replication traffic. | `2070` |

## Replica Placement

Replication factor controls which nodes host each partition. `0` keeps the default full-replication mode where every roster voter hosts every partition. A positive value creates explicit per-partition replica sets. See [Replication Factor and Replica Placement](/docs/replica-placement/) for rollout, placement inspection, backup behavior, and migration notes.

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--raft-replication-factor` | Desired voter replicas per partition. `0` means full replication. Prefer odd values such as `3` or `5`. | `0` |
| `--raft-enable-placement-rebalancer` | Enable ongoing replica-placement repair and balancing on the partition `0` leader. Initial placement still applies when `--raft-replication-factor` is positive. | disabled |
| `--raft-placement-pass-interval` | Interval between placement-controller passes on the partition `0` leader, in milliseconds. `0` disables the timer, but commit-triggered passes still run. | `5000` |
| `--raft-max-replica-moves-per-pass` | Maximum new replica add/remove sequences started in one placement-controller pass across repair and balance priorities. | `4` |
| `--raft-max-concurrent-replica-transfers` | Maximum partitions with an in-flight learner catch-up or replica removal caused by balance moves. Durability repair uses a separate budget. | `1` |
| `--raft-max-concurrent-replica-repairs` | Maximum in-flight repair moves for under-replicated partitions or replicas stranded on departed nodes. | `3` |
| `--raft-decommission-drain-timeout` | Graceful-leave wait time, in milliseconds, for evacuating this node's placed replicas before removal. On timeout the node stays in the roster and reports `DrainTimedOut`. | `120000` |
| `--raft-replica-count-deadband` | Replica-count imbalance tolerated before balance moves start. Under-replicated partitions bypass this deadband. | `1` |
| `--raft-zone` | Optional zone or rack hint for the local node. Placement prefers spreading replicas across distinct zones. | empty |
| `--raft-enable-load-reports` | Gossip per-partition load reports even when no other feature enabled them. Load reports are enabled automatically by leader balancing, placement rebalancing, or a positive replication factor. | disabled |

## Workers and Runtime

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--locks-workers` | Number of lock actors per durability ring. `0` auto-sizes to `max(32, CPU cores * 4)`. | `0` |
| `--keyvalue-workers` | Number of key/value actors per durability ring. `0` auto-sizes to `max(32, CPU cores * 4)`. | `0` |
| `--sequencer-workers` | Number of sequence actors. `0` auto-sizes to `max(8, CPU cores)`. | `0` |
| `--sequencer-block-size` | Values reserved per sequence compare-and-swap. Larger blocks amortize one Raft commit across more sequence values but can leave larger gaps if a block is abandoned. | `1000` |
| `--sequencer-idempotency-retention-max` | Maximum idempotency entries retained per sequence record. `0` disables the count cap. | `256` |
| `--sequencer-idempotency-retention-ttl` | Seconds within which retrying a keyed sequence reservation replays the same allocation. `0` disables age pruning. | `600` |
| `--sequencer-max-sequences-per-actor` | Maximum resident sequences per actor before least-recently-used sequence state is evicted. `0` is unbounded. | `10000` |
| `--sequencer-block-lease` | Seconds a reserved sequence block may be served from memory before revalidating against the durable record. `0` disables revalidation. | `5` |
| `--background-writer-workers` | Number of background persistence writer workers. Values less than or equal to `0` are normalized to `1`. | `1` |
| `--backend-read-io-threads` | Dedicated Kahuna backend read pool threads for point gets, existence checks, read-before-write work, and scans. Separate from the Raft WAL read pool. Values less than or equal to `0` auto-size to the processor count. | `8` |
| `--backend-write-io-threads` | Dedicated Kahuna backend writer pool threads for background batch writes and pruning. Keep this small because backend writes are fsync-heavy. Values less than or equal to `0` auto-size to the processor count. | `1` |
| `--backend-read-queue-depth` | Per-partition pending queue depth for the backend read scheduler before reads receive retryable backpressure. | `4096` |
| `--default-transaction-timeout` | Default transaction timeout in milliseconds. | `5000` |
| `--max-concurrent-transactions` | Script transactions that may execute concurrently before further ones queue and start in priority order. `0` disables the script admission gate. | `0` |
| `--max-concurrent-sessions` | Interactive transaction sessions that may be open concurrently before further ones queue and start in priority order. `0` disables the session admission gate. | `0` |
| `--transaction-priority-reserved-slots` | Slots out of each transaction concurrency ceiling that only `High` and `Critical` transactions may occupy. | `0` |
| `--transaction-priority-aging-threshold` | Milliseconds a queued transaction waits to gain one effective priority level. `0` disables aging. | `1000` |
| `--transaction-priority-max-queued` | Callers that may wait for an admission slot per gate before further ones receive `AdmissionRefused`. `0` makes the queue unbounded. | `4096` |
| `--default-admission-wait` | Milliseconds a caller waits for an admission slot when it does not request its own budget. This is separate from transaction lifetime. | `5000` |
| `--max-admission-wait` | Maximum admission wait in milliseconds. Caller-supplied waits are clamped to this value. | `30000` |
| `--script-cache-expiration` | Script parser cache expiration in seconds. | `600` |
| `--revisions-to-cache` | Number of key revisions intended to stay cached in memory. This flag is defined by the server CLI, but the current server startup path does not pass it into `KahunaConfiguration`. | `4` |
| `--cache-entry-ttl` | Age threshold used by lock cleanup and legacy cleanup paths, in seconds. Key/value LRU eviction is budget-based. | `1800` |
| `--cache-entries-to-remove` | Maximum entries removed by cleanup paths that use this cap. Values less than or equal to `0` are normalized from the key/value collection batch size. | `100` |
| `--dirty-objects-writer-delay` | Delay between dirty object writer flush passes, in milliseconds. | `200` |
| `--checkpoint-interval` | Period, in seconds, at which dirty partitions checkpoint after flushes so the Raft WAL retention floor can advance and old log entries can compact. | `30` |

## Key/Value Write Coalescing

These options tune persistent partition writes before they are proposed to Raft. Kahuna can combine `SET`, `DELETE`, `EXTEND`, and durable transaction-finalization records for the same partition into one Raft call. See [Partition Write Coalescing](/docs/architecture/partition-write-coalescing/) for behavior, retry semantics, and metrics.

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--kv-write-linger-ms` | Delay from the oldest queued persistent partition write before its partition batch is proposed. `0` dispatches an idle partition immediately. | `1` |
| `--kv-write-max-batch-items` | Maximum log entries selected for one aggregator Raft call. | `512` |
| `--kv-write-max-batch-bytes` | Target serialized bytes selected for one aggregator Raft call. An oversized single item dispatches alone. | `4194304` |
| `--kv-write-max-queued-items` | Maximum admitted persistent submissions per partition, including writes already in flight. | `8192` |
| `--kv-write-max-queued-bytes` | Maximum admitted serialized bytes per partition, including writes already in flight. | `33554432` |
| `--kv-write-max-queue-delay-ms` | Maximum pre-dispatch wait before a queued write is released as `MustRetry`. | `1000` |
| `--kv-write-aggregator-inbox-size` | Ordinary-submission inbox bound per aggregator lane. Control messages are exempt. Values less than or equal to `0` disable the bound. | `16384` |

Durable transaction decision, materialization, settlement, recovery, and range-metadata handoff records use terminal scheduler admission with reserved headroom. The terminal reserve and node-global queue settings are `KahunaConfiguration` fields today and are not exposed as server command-line flags.

## Key-Range Split and Merge

These options tune automatic splitting and merging for key spaces registered with [key-range sharding](/docs/distributed-keyvalue-store/key-range-sharding/). `0` disables the corresponding automatic trigger where noted.

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--range-split-threshold` | Sampled key count above which a key range is split automatically. `0` disables count-based auto-split. | `1000` |
| `--range-split-min-range-size` | Minimum number of keys each half must hold for an automatic split to proceed. | `10` |
| `--range-split-settle-window` | Seconds a freshly split range must settle before it can split again. Must be at least `--raft-min-leader-stability-ms`. | `10` |
| `--range-move-settle-timeout` | Maximum seconds a split or merge waits under quiesce for in-flight transactions in the moving range to decide and settle before cutover. Writes into the moving range are refused retryably during this window. `0` disables the wait. | `10` |
| `--range-merge-min-size` | Key count below which adjacent ranges become eligible for automatic merge. `0` disables auto-merge. | `10` |
| `--range-collection-interval` | Seconds between range split/merge sampling passes. Also affects key/value collection, prepared-intent recovery, and session range-lock renewal. | `60` |
| `--range-split-load-threshold` | Sustained replicated write operations per second required before a range becomes a load-split candidate. `0` disables load-based auto-split. | `0` |
| `--range-split-load-min-queue-depth` | Minimum WAL queue depth required alongside the load threshold. | `8` |
| `--range-split-load-window` | Seconds the load predicate must hold continuously before a load split is triggered. | `15` |
| `--range-split-load-poll-interval` | Seconds between load-signal polls. Keep below `--range-split-load-window`. | `5` |

## Backups and Point-in-Time Recovery

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--pitr-window` | Recoverable WAL history in seconds. Values are normalized to a range greater than `0` and no more than `21600` seconds (6 hours). Increasing this value increases retained WAL storage. | `3600` |
| `--base-snapshot-interval` | Intended interval between base checkpoints per partition, in seconds. It must be positive and no greater than `--pitr-window`. This setting contributes to the protected WAL floor but does not schedule backups automatically. | `1800` |
| `--pitr-backup-dir` | Root directory for backup catalog manifests and artifacts. Backup REST/gRPC, client, and CLI operations are disabled when this is empty. It is required by `--pitr-bootstrap-from`. | empty |
| `--pitr-backup-target` | Backup storage target. `local` stores manifests and artifacts under `--pitr-backup-dir`. Other values require a host-registered backup storage provider. | `local` |
| `--pitr-backup-scratch-dir` | Local staging directory used when the selected backup target cannot be written to directly by the storage engine. Size it for one full backup. | empty |
| `--pitr-backup-cluster-id` | Operator-assigned cluster identity stamped into backup manifests. Set the same value on every node to prevent cross-cluster chain resolution. | empty |
| `--pitr-backup-mac-key-file` | Path to the HMAC-SHA-256 key file used to authenticate backup manifests. Keep it outside `--pitr-backup-dir` and readable only by the server user. | empty |
| `--pitr-restore-root` | Server-owned root directory that restore targets must be contained within. Setting this enables confined remote restore. | empty |
| `--pitr-allow-unconfined-remote-restore` | Allows remote restore requests without `--pitr-restore-root`. Use only for trusted administrative environments. | `false` |
| `--backup-retention-max-chains` | Keep at most this many most-recent backup chains. `0` is unbounded and retention remains off unless at least one retention bound is set. | `0` |
| `--backup-retention-max-age` | Delete chains whose newest backup is older than this many seconds. `0` is unbounded. | `0` |
| `--backup-retention-max-bytes` | Keep the most-recent backup chains whose artifact bytes fit this budget. The newest chain is always kept. `0` is unbounded. | `0` |
| `--backup-gc-interval` | Periodic backup GC cadence in seconds. A pass also runs after each backup. `0` disables the periodic pass only. | `3600` |
| `--backup-restore-throttle-mbps` | Throughput budget for the restore checkpoint copy in MB/s. `0` is unlimited. | `0` |
| `--pitr-bootstrap-from` | Leaf backup ID restored into local persistence and WAL before the node joins an existing cluster. Requires `--join-existing`, `--initial-cluster`, and `--pitr-backup-dir`. | none |
| `--pitr-target-time-ms` | PITR target using the physical HLC component in Unix epoch milliseconds. `0` restores through the selected chain's natural end. | `0` |

See [Backups and Point-in-Time Recovery](/docs/backups-and-point-in-time-recovery/) for setup, client and CLI usage, the backup-chain model, and recovery constraints.

## Persistent Revision Retention

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--persistent-revision-retention-count` | Maximum persisted key/value revisions to keep per key. `0` keeps revisions forever. | `0` |
| `--persistent-revision-retention-age` | Maximum age of persisted key/value revisions in seconds. `0` disables age-based retention. | `0` |
| `--persistent-revision-cleanup-interval` | Minimum interval between full persistent revision cleanup sweeps, in seconds. | `300` |
| `--persistent-revision-cleanup-batch-size` | Maximum revision records deleted per cleanup pass. | `1000` |
| `--persistent-revision-cleanup-on-write` | Keep targeted persistent revision cleanup after writes enabled. This is the default behavior. | enabled |
| `--disable-persistent-revision-cleanup-on-write` | Disable targeted persistent revision cleanup after writes. | disabled |

Persistent revision cleanup is clamped by live [snapshot holds](/docs/distributed-keyvalue-store/snapshot-holds/). A held snapshot timestamp keeps the boundary revision needed by that timestamp, and every newer revision, even if the count or age retention settings would otherwise prune them.

## Raft Communication

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--read-io-threads` | Number of Raft WAL read I/O threads. Kahuna backend reads use the separate backend read pool. | `4` |
| `--write-io-threads` | Number of Raft write I/O threads. | `16` |
| `--raft-enable-shared-executor-pool` | Share a bounded worker pool across Raft partitions instead of using one OS thread per partition. Useful for very high partition counts. | enabled |
| `--raft-executor-pool-size` | Number of shared Raft executor workers. `0` auto-sizes to the processor count. | `0` |
| `--raft-http-scheme` | HTTP scheme used by Raft REST communication. | `https://` |
| `--raft-http-auth-bearer-token` | Bearer token sent with Raft REST communication. | empty |
| `--raft-http-timeout` | Raft REST request timeout in seconds. | `5` |
| `--raft-http-version` | HTTP protocol version used by Raft REST communication. | `2.0` |
| `--raft-grpc-scheme` | URL scheme prepended to bare peer endpoints when opening Raft gRPC channels. Kahuna inter-node gRPC forwarding uses the same scheme so Raft traffic and leader-forwarded key/value, lock, and sequence calls dial peers consistently. Use `http://` only when peers advertise cleartext HTTP/2 ports. | `https://` |
| `--raft-grpc-channels-per-node` | Pooled gRPC channels opened per peer. Values are clamped between `1` and `64`; each channel holds a connection and handler for the process lifetime. | `4` |
| `--raft-grpc-enable-multiple-http2-connections` | Allow each pooled gRPC channel to open multiple HTTP/2 connections for additional concurrent streams. | disabled |
| `--raft-grpc-enable-snapshot-compression` | Compress Raft snapshot transfers sent over gRPC. | disabled |
| `--raft-snapshot-receive-session-ttl` | Idle snapshot-receive session lifetime in milliseconds before the receiver drops buffered bytes. | `30000` |
| `--raft-snapshot-max-pending-sessions` | Maximum concurrent snapshot-receive sessions across all partitions. Older inactive sessions can be evicted after the cap. | `8` |
| `--raft-snapshot-max-pending-bytes` | Maximum buffered bytes across in-progress snapshot-receive sessions. | `536870912` |
| `--raft-allow-legacy-snapshot-senders` | Accept snapshot chunks from older senders that omit session metadata. Use only for temporary mixed-version upgrades. | disabled |
| `--raft-snapshot-transfer-step-timeout` | Maximum time, in milliseconds, allowed for one outbound snapshot-transfer step to stall before failing that transfer. A step that makes progress resets the clock. | `120000` |
| `--raft-grpc-enable-append-logs-coalescing` | Coalesce multiple AppendLogs calls into one gRPC frame per write cycle for write-heavy multi-partition workloads. | disabled |
| `--raft-grpc-append-logs-max-coalesce-batch` | Maximum AppendLogs items drained into one coalesced gRPC frame when coalescing is enabled. | `256` |
| `--raft-transport-security` | Structured transport security JSON accepted by the CLI. The current server startup path does not parse or apply this field yet. | empty |
| `--raft-allow-insecure-certificate-validation` | Skip TLS certificate validation for inter-node Raft gRPC traffic. Use only in development or test environments. | disabled |
| `--raft-max-pre-auth-request-body-bytes` | Maximum Raft REST request body buffered before authentication, in bytes. Bounds unauthenticated memory use independently of host limits. | `33554432` |
| `--raft-max-outbound-queue-bytes-per-peer` | Maximum buffered outbound bytes queued per peer before excess AppendLogs entries are dropped and later resent by heartbeat or backfill retry. `0` disables the cap. | `67108864` |
| `--raft-snapshot-rescue-max-consecutive-cycles` | Consecutive snapshot-rescue cycles that can still leave a follower below the compaction floor before the convergence breaker pauses that peer. Values less than or equal to `0` disable the breaker. | `3` |
| `--raft-snapshot-rescue-probe-interval` | Probe interval, in milliseconds, while the snapshot-rescue breaker is open. A probe lets a recovered follower be reseeded eventually. Values less than or equal to `0` disable probing. | `300000` |
| `--raft-snapshot-export-retry-cache-max-bytes` | Maximum bytes cached for one produced snapshot export on the leader so retries can resend the same export instead of rebuilding it. Values less than or equal to `0` disable the cache. | `67108864` |
| `--raft-compaction-live-replica-lag-budget` | Entry-count lag budget that protects a live follower after snapshot rescue so normal compaction does not immediately put it below the floor again. Values less than or equal to `0` disable the hold. | `100000` |

## Raft Timing

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--raft-heartbeat-interval` | Leader heartbeat interval in milliseconds. | `500` |
| `--raft-recent-heartbeat` | Recent-heartbeat window in milliseconds. | `100` |
| `--raft-voting-timeout` | Vote wait timeout in milliseconds. | `1500` |
| `--raft-leadership-barrier-timeout` | Milliseconds a newly elected leader waits for its promotion barrier entry to commit before stepping down. Raising it tolerates a slower quorum at the cost of failover latency. | `10000` |
| `--raft-leadership-confirmation-timeout` | Maximum milliseconds a read-index leadership confirmation may wait for quorum acknowledgement and applied-frontier catch-up. | `2000` |
| `--raft-enable-check-quorum` | Make a leader step down when it has not heard same-term acknowledgement from a majority for the check-quorum window. | disabled |
| `--raft-check-quorum-interval-multiplier` | Heartbeat intervals without majority acknowledgement before check-quorum steps down a leader. | `8` |
| `--raft-self-repair-peer-down-grace` | How long promotion-gate self-repair waits while a voter peer is not alive before gap-skipping committed drain or orphaned-tail truncation proceeds, in milliseconds. `0` disables the grace. | `30000` |
| `--raft-check-leader-interval` | Leader check interval in milliseconds. | `250` |
| `--raft-timer-initial-delay` | Initial delay before Raft timers start, in milliseconds. | `2500` |
| `--raft-update-nodes-interval` | Node registry update interval in milliseconds. | `5000` |
| `--raft-start-election-timeout` | Minimum election timeout in milliseconds. | `2000` |
| `--raft-end-election-timeout` | Maximum election timeout in milliseconds. | `4000` |
| `--raft-start-election-timeout-increment` | Minimum election timeout increment in milliseconds. | `100` |
| `--raft-end-election-timeout-increment` | Maximum election timeout increment in milliseconds. | `200` |
| `--raft-election-timeout-seed` | Seed for deterministic election timeouts. `0` means random timing. Intended for testing and reproducibility. | `0` |

## Raft Queueing and Batching

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--raft-max-queued-client-proposals` | Maximum queued client proposals per partition before backpressure applies. | `2048` |
| `--raft-max-wal-queue-depth-per-partition` | Per-partition WAL write queue depth limit. | `4096` |
| `--raft-max-global-wal-queue-depth` | Global WAL write queue depth limit across all partitions. `0` means unlimited. | `0` |
| `--raft-max-wal-batch-size` | Maximum WAL writes grouped into one storage flush. | `256` |
| `--raft-max-wal-group-batch-partitions` | Maximum partitions coalesced into one cross-partition WAL group-commit batch. | `64` |
| `--raft-wal-group-commit-linger-ms` | Optional group-commit linger window in milliseconds. `0` disables linger. | `0` |
| `--raft-wal-single-fsync-commit` | Enable the single-fsync fast path that acknowledges after propose-quorum durability and writes the commit marker lazily. | enabled |
| `--raft-sqlite-wal-shard-count` | SQLite WAL shard databases used to distribute partitions. `0` resolves to the processor count when storage is first initialized. | `0` |
| `--raft-max-drain-quantum-control` | Maximum control-plane operations drained per executor wake cycle. | `8` |
| `--raft-max-drain-quantum-replication` | Maximum replication operations drained per executor wake cycle. | `4` |
| `--raft-max-drain-quantum-client` | Maximum client operations drained per executor wake cycle. | `2` |
| `--raft-max-drain-quantum-maintenance` | Maximum maintenance operations drained per executor wake cycle. | `1` |

## Raft Leader Balancing

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--raft-enable-leader-balancer` | Enable advisory leader balancing. Configure it consistently on every cluster node. | disabled |
| `--raft-leader-balancer-report-interval` | Interval between node load reports, in milliseconds. | `5000` |
| `--raft-leader-balancer-interval` | Interval between planning passes on the partition `0` leader, in milliseconds. | `30000` |
| `--raft-leader-balancer-report-ttl` | Maximum accepted load-report age, in milliseconds. Must exceed the report interval. | `20000` |
| `--raft-count-deadband` | Allowed leader-count deviation from the ideal before count balancing starts. | `1` |
| `--raft-load-imbalance-threshold` | Fractional load skew that triggers load-based swaps after counts are balanced. | `0.25` |
| `--raft-min-leader-stability-ms` | Minimum leadership age before a partition is eligible to move, in milliseconds. | `5000` |
| `--raft-move-cooldown` | Delay before the same partition can move again, in milliseconds. | `60000` |
| `--raft-max-moves-per-pass` | Maximum transfer suggestions created in one planning pass. | `4` |
| `--raft-max-concurrent-transfers` | Maximum transfer suggestions tracked concurrently. | `2` |
| `--raft-suggestion-timeout` | Time allowed for a suggested transfer to be confirmed by load reports, in milliseconds. | `15000` |
| `--raft-leader-balancer-ops-weight` | Operations-per-second weight in the partition load score. | `1.0` |
| `--raft-leader-balancer-queue-weight` | Queue-depth weight in the partition load score. | `0.5` |
| `--raft-enable-slow-node-avoidance` | When enabled with the leader balancer, nodes whose WAL commit wait is far above the cluster median are avoided as transfer targets and can have existing leadership drained. | disabled |
| `--raft-slow-node-multiplier` | Ratio above the cluster median commit wait required before a node can be considered slow. | `3.0` |
| `--raft-slow-node-floor-ms` | Absolute commit-wait floor below which a node is never considered slow. | `10.0` |
| `--raft-slow-node-min-samples` | Minimum number of WAL group batches required before slow-node classification is evaluated. | `20` |
| `--raft-slow-node-observation-ttl` | Maximum age, in milliseconds, of a node's last commit-wait observation before it is treated as unknown. | `30000` |
| `--raft-slow-node-enter-passes` | Consecutive balancer passes a node must look slow before being classified slow. | `3` |
| `--raft-slow-node-exit-passes` | Consecutive clean passes before a classified slow node is released. | `6` |

See [Leader Balancing](/docs/leader-balancing/) for rollout, tuning, metrics, and safety behavior.

## Raft Membership and Catch-Up

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--raft-backfill-threshold` | Committed-entry lag that triggers active follower backfill. | `10` |
| `--raft-backfill-enabled` | Enable leader catch-up batches and snapshot fallback for lagging followers. Disable only when another deployment layer owns follower catch-up. | enabled |
| `--raft-max-backfill-entries-per-round` | Maximum committed entries sent to one stale follower per heartbeat interval. | `128` |
| `--raft-max-backfill-bytes-per-round` | Maximum serialized bytes sent to one stale follower per backfill round, in addition to the entry limit. | `4194304` |
| `--raft-follower-saturation-backoff` | Milliseconds a leader waits before retrying backfill to a peer that reported a saturated WAL queue. | `1000` |
| `--raft-backfill-no-progress-pause-cap` | Maximum exponential pause, in milliseconds, between backfill batches to a follower whose reported commit frontier is not advancing. | `30000` |
| `--raft-backfill-no-progress-anchor-fallback-ships` | Consecutive fruitless backfill shipments before the leader re-anchors the next batch at the follower's reported commit frontier. Values less than or equal to `0` disable this fallback. | `2` |
| `--raft-learner-promotion-lag` | Maximum entries a learner may trail the leader while remaining eligible for voter promotion. | `10` |
| `--raft-learner-promotion-stable-window` | Time a learner must remain within the promotion lag on all partitions, in milliseconds. | `3000` |

## Raft Gossip, Failure Detection, and Quiescence

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--raft-gossip-interval` | Interval between membership anti-entropy gossip rounds, in milliseconds. | `5000` |
| `--raft-gossip-fanout` | Random peers contacted per gossip round. `0` disables gossip. | `2` |
| `--raft-ping-interval` | Interval between SWIM node probes, in milliseconds. `0` disables failure detection, which is invalid while quiescence is enabled. | `1000` |
| `--raft-ping-timeout` | Direct SWIM probe timeout, in milliseconds. | `500` |
| `--raft-indirect-ping-fanout` | Intermediary nodes used for indirect probing after a direct ping timeout. | `2` |
| `--raft-suspicion-timeout` | Time a node may remain `Suspect` before becoming `Dead`, in milliseconds. | `5000` |
| `--raft-dead-member-eviction-grace` | Time a dead node remains in the roster before partition `0` commits its removal, in milliseconds. | `30000` |
| `--raft-enable-auto-rejoin` | Let a restarted node that finds itself removed from the roster re-run join against the remaining members. Disable only when removed live nodes must stay out. | enabled |
| `--raft-enable-quiescence` | Stop per-partition heartbeats after an idle period and rely on SWIM for node liveness. Requires `0 < --raft-ping-interval < --raft-start-election-timeout`. | enabled |
| `--raft-quiesce-after` | Required partition idle time before heartbeat quiescence, in milliseconds. | `1500` |

## Raft Logging and Compaction

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--raft-slow-state-machine-log` | Slow state-machine operation log threshold in milliseconds. | `50` |
| `--raft-slow-wal-machine-log` | Slow WAL state-machine operation log threshold in milliseconds. | `25` |
| `--raft-invariant-checks` | Reaction when a Raft invariant check fails: `Off`, `Log`, or `Throw`. This is diagnostic only and does not change protocol behavior. Release builds default to logging; debug builds default to throwing. | build-dependent |
| `--raft-compact-every-operations` | Number of committed operations between automatic Raft WAL compaction checks. | `10000` |
| `--raft-compact-number-entries` | Number of Raft WAL entries removed per compaction batch. | `100` |
| `--raft-max-entries-per-compaction` | Maximum Raft WAL entries processed per compaction run. | `5000` |

## Configuration Notes

- `--wal-storage` and `--storage` configure different layers. WAL storage persists Raft logs; materialized storage persists Kahuna object state after committed operations are applied.
- Use stable `--storage-revision` and `--wal-revision` values for existing data directories. Changing revisions points the server at different local storage files.
- The server CLI still does **not** expose every `KahunaConfiguration` field. In-memory collector knobs, script-cache entry limits, durable-decision deadline/admission knobs, durable deferred-settlement and prepared-intent bounds, terminal write-aggregator reserve knobs, and some advanced range-split policy internals remain code-level or embedded-node configuration today. Transaction priority admission and the primary key-range split/merge knobs are exposed as server flags.
- The embedded node exposes the broader runtime surface, including collector and persistent-revision settings. See [Embedded Kahuna Node](/docs/embedded-kahuna-node/) for the full embedded configuration options.
