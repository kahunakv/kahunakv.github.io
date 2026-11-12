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

## .NET Aspire

**Aspire is an easy way to run a local Kahuna cluster alongside your application.** The [Kahuna Aspire integration](https://github.com/kahunakv/kahuna-aspire) creates the node containers, connects them as peers, supplies client endpoints to your services, and waits for readiness. You can try replication and node failures without hand-writing container commands, node identities, or seed lists.

| Project / package | Add it to | Purpose |
|-------------------|-----------|---------|
| `Kahuna.Aspire.Hosting` | Aspire AppHost | Standalone or cluster resources, readiness checks, per-node storage options, and OTLP configuration |
| `Kahuna.Aspire.Client` | Each consuming service | Singleton client, connection-string binding, membership health check, and client trace/metric registration |

### Install the Packages

The integration targets .NET 10 and uses Aspire 13.6.4. Install [Kahuna.Aspire.Hosting](https://www.nuget.org/packages/Kahuna.Aspire.Hosting) in the AppHost and [Kahuna.Aspire.Client](https://www.nuget.org/packages/Kahuna.Aspire.Client) in each consuming service:

```bash
dotnet add MyApp.AppHost/MyApp.AppHost.csproj package Kahuna.Aspire.Hosting
dotnet add MyApp.ApiService/MyApp.ApiService.csproj package Kahuna.Aspire.Client
```

Replace the project paths with your own. The client integration brings in `Kahuna.Client`; published packages do not require a Kahuna source checkout.

:::note Cluster API availability

The currently published **1.15.0** packages provide standalone hosting. `AddKahunaCluster` and the updated client health check described below are in the latest source and require a build containing those changes. Until a newer package is published, replace the package references with project references to the [integration checkout](https://github.com/kahunakv/kahuna-aspire):

```xml title="AppHost project (inside an ItemGroup)"
<ProjectReference Include="../../kahuna-aspire/src/Kahuna.Aspire.Hosting/Kahuna.Aspire.Hosting.csproj"
                  IsAspireProjectResource="false" />
```

```xml title="Consuming service project (inside an ItemGroup)"
<ProjectReference Include="../../kahuna-aspire/src/Kahuna.Aspire.Client/Kahuna.Aspire.Client.csproj" />
```

Adjust paths for your solution layout. The integration uses the adjacent `kahuna` checkout when present; `-p:UseLocalKahuna=false` selects released Kahuna dependencies instead.

:::

### Start a Three-Node Cluster

In your AppHost, register the cluster and reference it from the API project:

```csharp
var builder = DistributedApplication.CreateBuilder(args);

var kahuna = builder.AddKahunaCluster("kahuna", nodes: 3)
    .WithDataVolume();

builder.AddProject<Projects.MyApp_ApiService>("api")
    .WithReference(kahuna)
    .WaitFor(kahuna);

builder.Build().Run();
```

Replace `Projects.MyApp_ApiService` with your AppHost's generated project type. The dashboard groups `kahuna-1`, `kahuna-2`, and `kahuna-3` under `kahuna`; the parent has no container of its own. Each node has its own ID, storage, HTTP dashboard/readiness endpoint, and gRPC endpoint. Container ports are 8081 for HTTP, 8083 for cleartext gRPC, and 8082 for HTTPS peer traffic; client-facing host ports are assigned dynamically.

`WithReference(kahuna)` supplies a comma-separated list of every node's gRPC URL as `ConnectionStrings:kahuna`. The consuming service still calls `builder.AddKahunaClient("kahuna")`; see [Aspire client setup](/docs/dotnet-client/#net-aspire). The same service code works against a standalone resource or a cluster.

Use an odd node count for quorum-based replication: three replicas can continue with one unavailable, and five with two, once leadership and quorum are established. Adding more API replicas does not add Kahuna nodes. The cluster node count is an AppHost declaration, not load-based autoscaling or a decommissioning workflow.

| Cluster option | Behavior |
|----------------|----------|
| `AddKahunaCluster("kahuna", nodes: 3)` | Create the cluster and its node containers; 3 is the default, and the count must be positive. |
| `.WithDataVolume("kahuna-data")` | Mount a separate volume per node at `/data`, named `kahuna-data-1`, `kahuna-data-2`, and so on. Omit the prefix to generate names. No persistent mount is added unless requested. |
| `.WithDataBindMount("/absolute/path/to/data")` | Give each node its own subdirectory, such as `kahuna-1`, under the host directory. |
| `.WithPartitions(8)` | Set the initial partition count on every node. The default is 3; existing storage keeps its partition map. |
| `.ConfigureNodes(node => node.WithImageTag("local"))` | Apply configuration to every node. Keep image and relevant cluster settings consistent across nodes. |

For a single standalone node, use `builder.AddKahuna("kahuna").WithDataVolume()` instead. Its optional `grpcPort` and `httpPort` parameters set fixed host ports. Its data bind mount targets one host directory, rather than one subdirectory per cluster node.

### Startup, Health, and Node Failures

Each node is probed through `GET /v1/cluster/health`. Before the first healthy start, the cluster requires **all nodes** to be running and healthy, so `WaitFor(kahuna)` starts dependent services only after the complete cluster is ready. Afterwards it reports healthy while a majority of nodes is healthy, with a description such as `2 of 3 nodes are healthy`. Losing the majority makes it unhealthy. If all node containers stop, the all-nodes requirement applies on the next start. The aggregate check counts node readiness; it is not a read/write probe or proof that every request will succeed.

The cluster disables routing hints because peer addresses on the container network are not generally reachable by host applications. Clients use the supplied endpoint list, and a contacted node forwards operations to the owner. A stopped node's Aspire proxy can accept a connection without answering: an individual call may time out even while a quorum remains available. Bound calls and implement [retry handling](/docs/dotnet-client/#errors-and-cancellation) appropriate to the operation; cluster health does not automatically retry application writes.

The [client health check](/docs/dotnet-client/#health-check-scope) is deliberately weaker: it succeeds if any endpoint returns initialized membership, even when too few replicas remain for reads or writes.

### Development Profile and Telemetry

The cluster profile is for **local development**: nodes use the image's public development certificate, skip peer certificate validation, have no node authentication, and expose cleartext client endpoints. Its generated command keeps synchronous WAL writes enabled, unlike the standalone image entrypoint, which disables them. For production deployment, use explicit [server/TLS configuration](/docs/server-configuration/) or the [Kubernetes operator](/docs/kubernetes-operator/).

The current source pins `kahunakv/kahuna:1.15.6` and configures OTLP export on each node. Server metrics, request spans, and logs can appear alongside client telemetry in the Aspire dashboard; keep your application's service-defaults/OTLP exporter configured. The published integration 1.15.0 pins server image 1.15.0, which predates server OTLP export; an image built from Kahuna 1.15.1 or later is needed for those server signals.

To use a locally built server image, run this in the Kahuna checkout:

```bash
docker build -f docker/Dockerfile.standalone -t kahunakv/kahuna:local .
```

Then use `.ConfigureNodes(node => node.WithImageTag("local"))` on a cluster, or `.WithImageTag("local")` on a standalone resource. See [server telemetry](/docs/server-configuration/#opentelemetry-export).

### Try the Cluster Example

The [cluster example](https://github.com/kahunakv/kahuna-aspire/tree/main/examples/ClusterExample) runs three nodes with separate data volumes and a Notes application. From the integration checkout, with Docker and .NET 10 available, run:

```bash
dotnet run --project examples/ClusterExample/ClusterExample.AppHost --launch-profile http
```

Open the API's **Notes** URL from the Aspire dashboard. Add a note, stop `kahuna-3`, and add another while two replicas remain. Restart the node to observe catch-up. Stop two nodes to observe quorum loss. The page's per-node counts are reads routed through each node, not inspections of each node's local replica. The example uses bounded retries and the same note key across retries to avoid duplicate notes.

The [standalone sample](https://github.com/kahunakv/kahuna-aspire/tree/main/samples) remains available with one Kahuna node and two API replicas, demonstrating key/value operations, job locking, sequences, and a shared rate-limit budget.

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

### Process Exit Codes

Use the exit status to distinguish a normal stop from a failed deployment:

| Code | Meaning |
|---|---|
| `0` | Graceful shutdown, including `Ctrl+C` or `SIGTERM`, or a help/version request. |
| `1` | Startup or server failure, including invalid configuration, extension loading, or backup-target initialization. The terminal error on stderr begins with `Kahuna stopped because`. |
| `2` | Command-line parsing failure. |

Startup failures exit normally with status `1`, rather than aborting the runtime to produce a crash dump. Inspect stderr and the preceding logs for the cause.

## Running a Cluster

For local development, [Aspire starts a cluster from one AppHost declaration](#start-a-three-node-cluster), including peer discovery, per-node volumes, and readiness. The manual setup below is useful when you need control over the individual server commands.

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
