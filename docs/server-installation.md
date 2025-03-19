---
sidebar_position: 6
---

# Server Installation

## Standalone server

You can build and run the Kahuna server using the following steps (it requires .NET 9.0 installed):

```bash
git clone https://github.com/kahunakv/kahuna
cd kahuna
export ASPNETCORE_URLS='http://*:2070'
dotnet run --project Kahuna.Server
```

## Local Docker container

Alternatively, you can run the Kahuna server in a local Docker container:

```bash
git clone https://github.com/kahunakv/kahuna
cd kahuna
docker build -f Dockerfile -t kahuna .
docker run -e ASPNETCORE_URLS='http://*:2070' -p 2070:2070 kahuna
```

## Local Docker Compose Cluster

To run a local cluster of Kahuna servers using Docker Compose:

```bash
git clone https://github.com/kahunakv/kahuna
cd kahuna
docker build -f Dockerfile -t kahuna .
docker compose up
```