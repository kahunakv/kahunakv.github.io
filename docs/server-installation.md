---
sidebar_position: 6
---

# Server Installation

You can run Kahuna locally as a standalone Docker container, as a standalone node from source, as a native three-node cluster, or with Docker Compose.

## Standalone Docker Server

For the quickest container-based setup, run the published Kahuna image with HTTP, HTTPS, and a named Docker volume for persistent data:

```bash
docker run --rm -p 8081:8081 -p 8082:8082 -v kahuna-data:/data --name kahuna kahunakv/kahuna:latest
```

Use `http://127.0.0.1:8081` or `https://127.0.0.1:8082` from local clients. When connecting with `kahuna-cli`, pass the HTTPS endpoint explicitly and allow the local development certificate:

```bash
kahuna-cli -c "https://127.0.0.1:8082" --insecure
```

Stop the container with `Ctrl+C`. Because the command uses `--rm`, the container is removed after it exits, but the `kahuna-data` Docker volume remains available for the next run.

## Standalone Development Server

To run Kahuna directly from a source checkout, clone the repository and run the standalone script:

```bash
git clone https://github.com/kahunakv/kahuna
cd kahuna
sh ./scripts/run-standalone.sh
```

The script publishes `Kahuna.Server` into `/tmp/kahuna-standalone-bin`, starts a single node, and stores persistent RocksDB data under `/tmp/kahuna-standalone/data` with its WAL under `/tmp/kahuna-standalone/wal`.

Expected output:

```text
>> Publishing Kahuna.Server to /tmp/kahuna-standalone-bin
>> Storage: rocksdb (persistent) at /tmp/kahuna-standalone/data
>> Starting standalone node on https://127.0.0.1:8082 (http 8081)

info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://0.0.0.0:8081
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: https://0.0.0.0:8082
info: Microsoft.Hosting.Lifetime[0]
      Application started. Press Ctrl+C to shut down.
```

Use `http://127.0.0.1:8081` or `https://127.0.0.1:8082` from local clients. When connecting with `kahuna-cli`, pass the standalone HTTPS endpoint explicitly and allow the local development certificate:

```bash
kahuna-cli -c "https://127.0.0.1:8082" --insecure
```

Press `Ctrl+C` in the terminal to stop the server.

## Native Three-Node Cluster

Run a local cluster directly on the host without Docker:

```bash
git clone https://github.com/kahunakv/kahuna
cd kahuna
./scripts/run-cluster.sh
```

The script publishes `Kahuna.Server` once into `/tmp/kahuna-cluster-bin` and starts three processes with separate ports, data directories, WAL directories, node IDs, and Raft endpoints.

| Node | HTTP | HTTPS and Raft |
|------|------|----------------|
| `kahuna1` | `http://127.0.0.1:8081` | `https://127.0.0.1:8082` |
| `kahuna2` | `http://127.0.0.1:8083` | `https://127.0.0.1:8084` |
| `kahuna3` | `http://127.0.0.1:8085` | `https://127.0.0.1:8086` |

Default RocksDB state is stored under:

```text
/tmp/kahuna-cluster/node1/data
/tmp/kahuna-cluster/node1/wal
/tmp/kahuna-cluster/node2/data
/tmp/kahuna-cluster/node2/wal
/tmp/kahuna-cluster/node3/data
/tmp/kahuna-cluster/node3/wal
```

Connect `kahuna-cli` to all three HTTPS endpoints:

```bash
kahuna-cli \
  -c "https://127.0.0.1:8082,https://127.0.0.1:8084,https://127.0.0.1:8086" \
  --insecure
```

The script accepts these environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `KAHUNA_STORAGE` | `rocksdb` | Use `rocksdb` for persistent storage or `memory` for an ephemeral cluster |
| `KAHUNA_PARTITIONS` | `3` | Initial partition count. Use `128` for a more cluster-scale topology |
| `KAHUNA_DATA_DIR` | `/tmp/kahuna-cluster` | Base directory for per-node RocksDB data and WAL files |

For example:

```bash
KAHUNA_STORAGE=memory KAHUNA_PARTITIONS=16 ./scripts/run-cluster.sh
```

Each output line is prefixed with its node name. Press `Ctrl+C` once to send a graceful shutdown to all three processes. The script force-stops any process that remains after five seconds.

## Docker Compose Three-Node Cluster

Docker Compose remains available when container isolation better matches the target environment. You need to have [Docker](https://www.docker.com/) running.

To run a local cluster of Kahuna servers using Docker Compose:

```bash
git clone https://github.com/kahunakv/kahuna
cd kahuna
docker compose -f docker/local.yml up --build
```

The three-node cluster accepts connections on `https://localhost:8082`, `https://localhost:8084`, and `https://localhost:8086`.
