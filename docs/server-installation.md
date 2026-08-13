---
sidebar_position: 6
---

# Server Installation

Kahuna is distributed in two supported ways:

- Docker image: `kahunakv/kahuna:latest`
- .NET global tool: `Kahuna.Server`, which installs the `kahuna-server` command

No repository files are required to run a server.

## Docker

For the quickest container-based setup, run the published Kahuna image with HTTP, HTTPS, and a named Docker volume for persistent data:

```bash
docker run --rm -p 8081:8081 -p 8082:8082 -v kahuna-data:/data --name kahuna kahunakv/kahuna:latest
```

Use `http://127.0.0.1:8081` or `https://127.0.0.1:8082` from local clients. When connecting with `kahuna-cli` to the local HTTPS endpoint, allow the development certificate:

```bash
kahuna-cli -c "https://127.0.0.1:8082" --insecure
```

Stop the container with `Ctrl+C`. Because the command uses `--rm`, the container is removed after it exits, but the `kahuna-data` Docker volume remains available for the next run.

## .NET Global Tool

Install the server tool from NuGet:

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
  --storage rocksdb \
  --wal-storage rocksdb \
  --storage-path ~/.kahuna/data \
  --wal-path ~/.kahuna/wal \
  --storage-revision v1 \
  --wal-revision v1
```

The server listens on `http://127.0.0.1:8081`. Connect with:

```bash
kahuna-cli -c "http://127.0.0.1:8081"
```

Press `Ctrl+C` in the terminal to stop the server.

## Running a Cluster

Run production or staging clusters with the same `kahuna-server` tool or the Docker image on each node. Each node needs its own identity, storage paths, Raft endpoint, TLS configuration, and `--initial-cluster` seed list.

The important server flags are documented in [Server Configuration](/docs/server-configuration/), especially:

- `--raft-nodename`
- `--raft-nodeid`
- `--raft-host`
- `--raft-port`
- `--initial-cluster`
- `--join-existing`
- `--storage-path`
- `--wal-path`
- `--https-certificate`

For local single-node development, prefer the standalone Docker or NuGet examples above.
