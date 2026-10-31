---
sidebar_position: 6
---

# Server Installation

Kahuna Server is one self-hosted process that provides the key/value store, distributed locks, and the sequencer. You can run it in two supported ways, and neither needs a copy of the source repository:

- Docker image: `kahunakv/kahuna:latest`
- .NET global tool: `Kahuna.Server`, which installs the `kahuna-server` command

Which one to choose:

- **Docker** is the fastest way to try Kahuna and the usual choice for container-based deployments. It does not need .NET on the host.
- **The .NET global tool** runs the server directly on a machine with the .NET SDK, without containers. Choose it if you already use .NET tooling or deploy to virtual machines without Docker.
- **On Kubernetes**, use the [Kubernetes Operator](/docs/kubernetes-operator/), which also manages cluster membership when you scale.

## Docker

For the quickest container-based setup, run the published Kahuna image with HTTP, HTTPS, cleartext gRPC, and a named Docker volume for persistent data:

```bash
docker run --rm -p 8081:8081 -p 8082:8082 -p 8083:8083 -v kahuna-data:/data --name kahuna kahunakv/kahuna:latest
```

Use `http://127.0.0.1:8081` for REST, `https://127.0.0.1:8082` for HTTPS REST/gRPC, or `http://127.0.0.1:8083` for cleartext gRPC from local clients. When connecting with `kahuna-cli` to the local HTTPS endpoint, allow the development certificate:

```bash
kahuna-cli -c "https://127.0.0.1:8082" --insecure
```

For local cleartext gRPC, use:

```bash
kahuna-cli -c "http://127.0.0.1:8083"
```

Stop the container with `Ctrl+C`. Because the command uses `--rm`, the container is removed after it exits, but the `kahuna-data` Docker volume remains available for the next run.

:::caution The image is a development profile

The published image starts one standalone node with settings meant for local development:

- Synchronous WAL writes are off (`--disable-wal-sync-writes`), so writes acknowledged shortly before a machine crash or power loss may not be on disk.
- HTTPS uses a development certificate bundled in the image.
- Inter-node certificate validation is skipped (`--raft-allow-insecure-certificate-validation`).
- The cleartext HTTP and gRPC listeners stay open beside HTTPS (`--allow-plaintext-listener`).

The entrypoint does not take extra flags. For production, run `kahuna-server` with your own settings, or override the image entrypoint (`--entrypoint dotnet`, then `/app/Kahuna.Server.dll` and your flags). See [Server Configuration](/docs/server-configuration/) and [Node Transport Security](/docs/node-transport-security/).

:::

The entrypoint reads these environment variables:

| Variable | Default | Sets |
|----------|---------|------|
| `KAHUNA_HTTP_PORT` | `8081` | REST over HTTP (`--http-ports`). |
| `KAHUNA_HTTPS_PORT` | `8082` | HTTPS REST and gRPC (`--https-ports`), also used as the Raft port (`--raft-port`). |
| `KAHUNA_GRPC_CLEARTEXT_PORT` | `8083` | Cleartext gRPC over HTTP/2 (`--grpc-cleartext-ports`). An empty value omits the flag; a standalone node then still binds its default `8083`. |
| `KAHUNA_DATA_DIR` | `/data` | Root of the `data` and `wal` directories (`--storage-path`, `--wal-path`). |
| `KAHUNA_PARTITIONS` | `3` | Number of partitions (`--initial-cluster-partitions`). |

For example, to start with eight partitions:

```bash
docker run --rm -p 8081:8081 -p 8082:8082 -p 8083:8083 -v kahuna-data:/data \
  -e KAHUNA_PARTITIONS=8 --name kahuna kahunakv/kahuna:latest
```

If you change a port variable, change the matching `-p` mapping too.

## .NET Global Tool

The tool targets .NET 10 (`net10.0`), so install the [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) first. Then install the server tool from NuGet:

```bash
dotnet tool install --global Kahuna.Server
```

Update an existing installation with:

```bash
dotnet tool update --global Kahuna.Server
```

Start a standalone server:

```bash
kahuna-server \
  --http-ports 8081 \
  --grpc-cleartext-ports 8083 \
  --storage rocksdb \
  --wal-storage rocksdb \
  --storage-path ~/.kahuna/data \
  --wal-path ~/.kahuna/wal \
  --storage-revision v1 \
  --wal-revision v1
```

The server listens on `http://127.0.0.1:8081` for REST and `http://127.0.0.1:8083` for cleartext gRPC. Connect local gRPC clients with:

```bash
kahuna-cli -c "http://127.0.0.1:8083"
```

Press `Ctrl+C` in the terminal to stop the server.

## Running a Cluster

Run production or staging clusters with the same `kahuna-server` tool or the Docker image on each node. Each node needs its own identity, storage paths, [Raft](/docs/glossary/#raft) endpoint, TLS configuration, and `--initial-cluster` seed list.

The important server flags are documented in [Server Configuration](/docs/server-configuration/), especially:

- `--raft-nodename`
- `--raft-nodeid`
- `--raft-host`
- `--raft-port`
- `--initial-cluster`
- `--join-existing`
- `--storage-path`
- `--wal-path`
- `--grpc-cleartext-ports`
- `--https-certificate`

For local single-node development, prefer the standalone Docker or NuGet examples above.

### Local Three-Node Cluster

To try replication on one machine, start three nodes in three terminals. Each node has its own name, ID, Raft port, and data directories, and lists the other two nodes in `--initial-cluster`:

```bash
# Terminal 1
kahuna-server \
  --raft-nodename kahuna1 --raft-nodeid 1 \
  --raft-host 127.0.0.1 --raft-port 8281 \
  --raft-grpc-scheme http:// \
  --http-ports 8181 --grpc-cleartext-ports 8281 \
  --initial-cluster 127.0.0.1:8282 127.0.0.1:8283 \
  --storage-path ~/.kahuna/node1/data --wal-path ~/.kahuna/node1/wal

# Terminal 2
kahuna-server \
  --raft-nodename kahuna2 --raft-nodeid 2 \
  --raft-host 127.0.0.1 --raft-port 8282 \
  --raft-grpc-scheme http:// \
  --http-ports 8182 --grpc-cleartext-ports 8282 \
  --initial-cluster 127.0.0.1:8281 127.0.0.1:8283 \
  --storage-path ~/.kahuna/node2/data --wal-path ~/.kahuna/node2/wal

# Terminal 3
kahuna-server \
  --raft-nodename kahuna3 --raft-nodeid 3 \
  --raft-host 127.0.0.1 --raft-port 8283 \
  --raft-grpc-scheme http:// \
  --http-ports 8183 --grpc-cleartext-ports 8283 \
  --initial-cluster 127.0.0.1:8281 127.0.0.1:8282 \
  --storage-path ~/.kahuna/node3/data --wal-path ~/.kahuna/node3/wal
```

Storage defaults to RocksDB. When all three nodes report `"ready":true`, write through one node and read through another:

```bash
curl http://127.0.0.1:8181/v1/cluster/health
kahuna-cli -c "http://127.0.0.1:8281" --set greeting --value hello
kahuna-cli -c "http://127.0.0.1:8283" --get greeting
```

The Raft port is each node's cleartext gRPC port, and `--raft-grpc-scheme http://` makes the nodes dial each other without TLS, so no certificate is needed. That traffic is unencrypted: use this layout only for local testing. In production, configure `--https-certificate` and `--https-ports`, put `--raft-port` on an HTTPS port, and keep the default `https://` scheme. See [Node Transport Security](/docs/node-transport-security/).

## Kubernetes

To run Kahuna on Kubernetes, use the [Kahuna Kubernetes Operator](/docs/kubernetes-operator/).
