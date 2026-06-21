---
sidebar_position: 6
---

# Server Installation

You can run Kahuna locally either as a single standalone node or as a small Docker Compose cluster.

## Standalone Development Server

For the quickest local setup, clone the repository and run the standalone script:

```bash
git clone https://github.com/kahunakv/kahuna
cd kahuna
sh ./scripts/run-standalone.sh
```

The script publishes `Kahuna.Server` into `/tmp/kahuna-standalone-bin`, starts a single node, and stores persistent RocksDB data under `/tmp/kahuna-standalone`.

Expected output:

```text
>> Publishing Kahuna.Server to /tmp/kahuna-standalone-bin
>> Storage: rocksdb (persistent) at /tmp/kahuna-standalone
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

## Docker Compose Three-Node Cluster

If you want to run a multi-node Kahuna cluster on your local machine for testing and development, you need to have [Docker](https://www.docker.com/) up and running.

To run a local cluster of Kahuna servers using Docker Compose:

```bash
git clone https://github.com/kahunakv/kahuna
cd kahuna
docker compose -f docker/local.yml up --build
```

The 3 node cluster will accept connections on the following urls: `https://localhost:8082`, `https://localhost:8084` and `https://localhost:8086`
