---
sidebar_position: 6
---

# Server Installation

If you want to run a Kahuna cluster on your local machine for testing and development, you need to have [Docker](https://www.docker.com/) up and running.

## Docker Compose Three-Node Cluster

To run a local cluster of Kahuna servers using Docker Compose:

```bash
git clone https://github.com/kahunakv/kahuna
cd kahuna
export COMPOSE_FILE=docker/dev.yml
docker compose up --build
```

The 3 node cluster will accept connections on the following urls: `https://localhost:8082`, `https://localhost:8084` and `https://localhost:8086`