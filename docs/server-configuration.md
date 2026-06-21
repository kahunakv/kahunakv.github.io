# Server Configuration

Kahuna server options are passed as command-line flags to `Kahuna.Server`. The table below documents the options currently exposed by `KahunaCommandLineOptions`.

## Network and TLS

| Command Line Option(s) | Description | Default Value |
|------------------------|-------------|---------------|
| `-h`, `--host` | Host option accepted by the CLI. The current Kestrel setup listens on all interfaces for configured HTTP/HTTPS ports. | `*` |
| `-p`, `--http-ports` | One or more HTTP ports for external REST/gRPC traffic. If omitted, Kahuna listens on HTTP port `2070`. | `2070` |
| `--https-ports` | One or more HTTPS ports for external REST/gRPC traffic. If omitted, Kahuna listens on HTTPS port `2071`. | `2071` |
| `--https-certificate` | Path to the HTTPS certificate used by Kestrel and trusted for internal HTTPS communication. | empty |
| `--https-certificate-password` | Password for the HTTPS certificate. | empty |

## Storage and WAL

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--storage` | Materialized Kahuna state backend for persistent locks, key/value entries, revisions, and sequences. Supported values are `rocksdb`, `sqlite`, and `memory`. | `rocksdb` |
| `--storage-path` | File system path for materialized state storage. Use a durable local disk for `rocksdb` or `sqlite`. | empty |
| `--storage-revision` | Revision name used to select a materialized state database or file set under `--storage-path`. | empty |
| `--wal-storage` | Raft WAL backend used by Kommander. The server startup path supports `rocksdb` and `sqlite`. | `rocksdb` |
| `--wal-path` | File system path for Raft WAL storage. Use a durable local disk. | empty |
| `--wal-revision` | Revision name used to select the WAL database or file set under `--wal-path`. | `v1` |
| `--wal-sync-writes` | Keep synchronous durable WAL writes enabled. This is the default behavior. | enabled |
| `--disable-wal-sync-writes` | Disable synchronous durable WAL writes for faster non-critical local or test runs. | disabled |

## Cluster Identity and Discovery

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--initial-cluster` | Static discovery list for the initial Raft cluster. Pass one or more node addresses. | none |
| `--initial-cluster-partitions` | Number of Raft partitions created for the initial cluster. | `128` |
| `--raft-nodename` | Human-readable node name used by Raft. If omitted, the server uses the machine name. | machine name |
| `--raft-nodeid` | Numeric node identifier used by Raft. | `0` |
| `--raft-host` | Host advertised for Raft consensus and replication traffic. | `localhost` |
| `--raft-port` | Port advertised for Raft consensus and replication traffic. | `2070` |

## Workers and Runtime

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--locks-workers` | Number of lock actors/workers. Values less than or equal to `0` are normalized to at least `256` or `Environment.ProcessorCount * 4`, whichever is larger. | `128` |
| `--keyvalue-workers` | Number of key/value actors/workers. Values less than or equal to `0` are normalized to at least `256` or `Environment.ProcessorCount * 4`, whichever is larger. | `128` |
| `--background-writer-workers` | Number of background persistence writer workers. Values less than or equal to `0` are normalized to `1`. | `1` |
| `--default-transaction-timeout` | Default transaction timeout in milliseconds. | `5000` |
| `--script-cache-expiration` | Script parser cache expiration in seconds. | `600` |
| `--revisions-to-cache` | Number of key revisions intended to stay cached in memory. This flag is defined by the server CLI, but the current server startup path does not pass it into `KahunaConfiguration`. | `4` |
| `--cache-entry-ttl` | Age threshold used by lock cleanup and legacy cleanup paths, in seconds. Key/value LRU eviction is budget-based. | `1800` |
| `--cache-entries-to-remove` | Maximum entries removed by cleanup paths that use this cap. Values less than or equal to `0` are normalized from the key/value collection batch size. | `100` |
| `--dirty-objects-writer-delay` | Delay between dirty object writer flush passes, in milliseconds. | `200` |

## Backups and Point-in-Time Recovery

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--pitr-window` | Recoverable WAL history in seconds. Values are normalized to a range greater than `0` and no more than `21600` seconds (6 hours). Increasing this value increases retained WAL storage. | `3600` |
| `--base-snapshot-interval` | Intended interval between base checkpoints per partition, in seconds. It must be positive and no greater than `--pitr-window`. This setting contributes to the protected WAL floor but does not schedule backups automatically. | `1800` |
| `--pitr-backup-dir` | Root directory for backup catalog manifests and artifacts. Backup REST/gRPC, client, and CLI operations are disabled when this is empty. It is required by `--pitr-bootstrap-from`. | empty |
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

## Raft Communication

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--read-io-threads` | Number of Raft read I/O threads. | `8` |
| `--write-io-threads` | Number of Raft write I/O threads. | `16` |
| `--raft-http-scheme` | HTTP scheme used by Raft REST communication. | `https://` |
| `--raft-http-auth-bearer-token` | Bearer token sent with Raft REST communication. | empty |
| `--raft-http-timeout` | Raft REST request timeout in seconds. | `5` |
| `--raft-http-version` | HTTP protocol version used by Raft REST communication. | `2.0` |
| `--raft-transport-security` | Structured transport security JSON accepted by the CLI. The current server startup path does not parse or apply this field yet. | empty |
| `--raft-allow-insecure-certificate-validation` | Skip TLS certificate validation for inter-node Raft gRPC traffic. Use only in development or test environments. | disabled |

## Raft Timing

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--raft-heartbeat-interval` | Leader heartbeat interval in milliseconds. | `500` |
| `--raft-recent-heartbeat` | Recent-heartbeat window in milliseconds. | `100` |
| `--raft-voting-timeout` | Vote wait timeout in milliseconds. | `1500` |
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

See [Leader Balancing](/docs/leader-balancing/) for rollout, tuning, metrics, and safety behavior.

## Raft Logging and Compaction

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--raft-slow-state-machine-log` | Slow state-machine operation log threshold in milliseconds. | `50` |
| `--raft-slow-wal-machine-log` | Slow WAL state-machine operation log threshold in milliseconds. | `25` |
| `--raft-compact-every-operations` | Number of committed operations between automatic Raft WAL compaction checks. | `10000` |
| `--raft-compact-number-entries` | Number of Raft WAL entries removed per compaction batch. | `100` |
| `--raft-max-entries-per-compaction` | Maximum Raft WAL entries processed per compaction run. | `5000` |

## Configuration Notes

- `--wal-storage` and `--storage` configure different layers. WAL storage persists Raft logs; materialized storage persists Kahuna object state after committed operations are applied.
- Use stable `--storage-revision` and `--wal-revision` values for existing data directories. Changing revisions points the server at different local storage files.
- The server CLI still does **not** expose every `KahunaConfiguration` field. In-memory collector knobs, script-cache entry limits, and key-range split/merge thresholds remain code-level or embedded-node configuration today.
- The embedded node exposes the broader runtime surface, including collector and persistent-revision settings. See [Embedded Kahuna Node](/docs/embedded-kahuna-node/) for the full embedded configuration options.
