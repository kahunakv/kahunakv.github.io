# Server Configuration

Kahuna server options are passed as command-line flags to `Kahuna.Server`. The table below documents the options exposed by `KahunaCommandLineOptions`.

## Network and TLS

| Command Line Option(s) | Description | Default Value |
|------------------------|-------------|---------------|
| `-h`, `--host` | Host option accepted by the CLI. The current Kestrel setup listens on all interfaces for configured HTTP/HTTPS ports. | `*` |
| `-p`, `--http-ports` | One or more HTTP ports for external REST/gRPC traffic. If omitted, Kahuna listens on HTTP port `2070`. | `2070` |
| `--https-ports` | One or more HTTPS ports for external REST/gRPC traffic. If omitted, Kahuna listens on HTTPS port `2071`. | `2071` |
| `--https-certificate` | Path to the HTTPS certificate used by Kestrel and trusted for internal HTTPS communication. | empty |
| `--https-certificate-password` | Password for the HTTPS certificate. | empty |

## Storage

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--storage` | Materialized Kahuna state backend for persistent locks, key/value entries, revisions, and sequences. Supported values are `rocksdb`, `sqlite`, and `memory`. | `rocksdb` |
| `--storage-path` | File system path for materialized state storage. Use a durable local disk for `rocksdb` or `sqlite`. | empty |
| `--storage-revision` | Revision name used to select a materialized state database or file set under `--storage-path`. | empty |
| `--wal-storage` | Raft WAL backend used by Kommander. The server startup path supports `rocksdb` and `sqlite`. | `rocksdb` |
| `--wal-path` | File system path for Raft WAL storage. Use a durable local disk. | empty |
| `--wal-revision` | Revision name used to select the WAL database or file set under `--wal-path`. | `v1` |

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
| `--revisions-to-cache` | Number of key revisions intended to stay cached in memory. This flag is defined by the server CLI; the current server startup path does not pass it into `KahunaConfiguration`. | `4` |
| `--cache-entry-ttl` | Maximum in-memory cache entry age before eviction, in seconds. | `1800` |
| `--cache-entries-to-remove` | Maximum number of cache entries removed per eviction pass. Values less than or equal to `0` are normalized from the collection batch size. | `100` |
| `--dirty-objects-writer-delay` | Delay between dirty object writer flush passes, in milliseconds. | `200` |

## Raft Communication

| Command Line Option | Description | Default Value |
|---------------------|-------------|---------------|
| `--read-io-threads` | Number of Raft read I/O threads. | `8` |
| `--write-io-threads` | Number of Raft write I/O threads. | `16` |
| `--raft-http-scheme` | HTTP scheme used by Raft REST communication. | `https://` |
| `--raft-http-auth-bearer-token` | Bearer token sent with Raft REST communication. | empty |
| `--raft-http-timeout` | Raft REST request timeout in seconds. | `5` |
| `--raft-http-version` | HTTP protocol version used by Raft REST communication. | `2.0` |

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
- The embedded node exposes additional cache and eviction settings as .NET options. See [Embedded Kahuna Node](/docs/embedded-kahuna-node/) for the full embedded configuration surface.
