---
sidebar_position: 7
---

# Configuration

| Command Line Option(s)                              | Description                                                                                     | Default Value   |
|-----------------------------------------------------|-------------------------------------------------------------------------------------------------|-----------------|
| `-h`, `--host`                                      | Host to bind incoming connections to                                                          | "*"             |
| `-p`, `--http-ports`                                | Ports to bind incoming HTTP connections to                                                    | *None provided* |
| `--https-ports`                                     | Ports to bind incoming HTTPS connections to                                                   | *None provided* |
| `--https-certificate`                               | Path to the HTTPS certificate                                                                   | "" (empty)      |
| `--https-certificate-password`                      | Password for the HTTPS certificate                                                              | "" (empty)      |
| `--storage`                                         | Storage engine type (e.g., rocksdb, sqlite)                                                     | "rocksdb"       |
| `--storage-path`                                    | File system path for storage                                                                    | "" (empty)      |
| `--storage-revision`                                | Revision identifier for the storage configuration                                               | "" (empty)      |
| `--wal-storage`                                     | WAL (Write-Ahead Logging) storage engine (e.g., rocksdb, sqlite)                                | "rocksdb"       |
| `--wal-path`                                        | File system path for the WAL storage                                                            | "" (empty)      |
| `--wal-revision`                                    | Revision identifier for the WAL configuration                                                   | "v1"            |
| `--initial-cluster`                                 | Initial cluster configuration for static discovery                                              | *None provided* |
| `--initial-cluster-partitions`                      | Number of partitions for the initial cluster                                                    | 8               |
| `--raft-nodeid`                                     | Unique identifier to identify the node in the Raft cluster                                      | "" (empty)      |
| `--raft-host`                                       | Host to listen for Raft consensus and replication requests                                      | "localhost"     |
| `--raft-port`                                       | Port to bind incoming Raft consensus and replication requests                                   | 2070            |
| `--locks-workers`                                   | Number of ephemeral/consistent workers dedicated to lock management                             | 0               |
| `--persistence-workers`                             | Number of workers dedicated to persistence operations                                           | 0               |
| `--background-writer-workers`                       | Number of workers dedicated to background writing operations                                    | 0               |
