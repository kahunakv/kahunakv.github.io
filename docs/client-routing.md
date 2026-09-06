# Client Leader-Aware Routing

Kahuna accepts requests on every node. If a request lands on a node that does not lead the target partition, that node forwards the request to the current owner. Client leader-aware routing removes many of those extra hops by letting the client learn where a resource lives and send later requests there directly.

Routing is advisory. The server still re-resolves the key, lock, or sequence when the request arrives, checks live range fences, and verifies leadership. A stale route costs a forward or retry, not a wrong result.

## Modes

Set `KahunaOptions.Routing`:

| Mode | Behavior |
|------|----------|
| `Auto` | Default. Uses `Learned` when the client has several endpoints and `RoundRobin` when it has one. |
| `RoundRobin` | Rotates over configured endpoints. This is the pre-routing behavior. |
| `Learned` | Reuses the endpoint reported by a previous response for the same resource. Unknown resources fall back to rotation. |
| `Metadata` | Uses learned routes and also reads cluster routing metadata so unseen resources can route directly. |

```csharp
using Kahuna.Client;
using Kahuna.Client.Routing;

var client = new KahunaClient(
    [
        "https://node1:8082",
        "https://node2:8084",
        "https://node3:8086"
    ],
    options: new KahunaOptions
    {
        Routing = KahunaRoutingMode.Metadata
    }
);
```

`Auto` is usually the right starting point. A single-endpoint client stays on `RoundRobin` because it cannot use hints that name other nodes unless those endpoints are also configured or mapped.

## What Routes

| Operation | Routing behavior |
|-----------|------------------|
| Point key/value operations | Routed by key after a route is learned or resolved from metadata. |
| Lock operations | Routed by lock resource in a separate routing domain from key/value keys. |
| Sequence operations | Routed by the sequence storage key rule. |
| Batch point operations | Server-dispatched, while per-item routes are learned from the response. |
| Prefix, bucket, and range scans | Server-dispatched because one coordinator owns fan-out, pagination, and merge. |
| Transaction scripts and sessions | Routed by coordinator identity, not by an individual data key. |
| Cluster, range, backup, and snapshot administration | Node-scoped; explicit `nodeUrl` arguments are honored. |

Batch calls intentionally stay server-dispatched. Splitting one batch into several client requests would make transport failures ambiguous per group, while the server already returns per-item outcomes and route hints.

## Server Advertisement

Servers include advisory route hints in REST and gRPC responses by default. Configure what endpoint a node advertises with:

| Flag | Meaning |
|------|---------|
| `--advertised-client-endpoint` | Base URL this node tells clients to dial. Empty derives it from the Raft endpoint and advertised scheme. |
| `--advertised-client-scheme` | Scheme prepended to peer Raft endpoints when deriving peer client URLs. Empty follows `--raft-grpc-scheme`. |
| `--disable-peer-endpoint-advertisement` | Do not name peer nodes in hints. Use this when peer client URLs cannot be derived from Raft endpoints. |
| `--disable-routing-hints` | Return no routing hints. Clients keep their configured endpoint selection. |

The default derived endpoint is:

```text
<advertised scheme><raft host>:<raft port>
```

Set `--advertised-client-endpoint` explicitly when clients reach a node through a different host or port than the cluster uses internally, such as container port mapping or separate internal and external DNS names.

## Endpoint Mapping

A response cannot make the client dial an arbitrary address by default. A hint is accepted only when it resolves to a configured endpoint.

Use `RoutingEndpointMap` when servers advertise internal addresses but the application dials external addresses:

```csharp
var client = new KahunaClient(
    [
        "https://localhost:8082",
        "https://localhost:8084",
        "https://localhost:8086"
    ],
    options: new KahunaOptions
    {
        Routing = KahunaRoutingMode.Learned,
        RoutingEndpointMap = new Dictionary<string, string>
        {
            ["https://172.30.0.2:8082"] = "https://localhost:8082",
            ["https://172.30.0.3:8084"] = "https://localhost:8084",
            ["https://172.30.0.4:8086"] = "https://localhost:8086"
        }
    }
);
```

Set `AllowUnlistedRoutingEndpoints = true` only when every advertised node URL is trusted and client-reachable, including nodes added after the client starts.

## Metadata Mode

`Metadata` mode reads `GET /v1/cluster/routing` or the equivalent gRPC `Cluster.GetRoutingMetadata` call. The map includes:

- hash-routing rules for normal key spaces
- key-range descriptors and generations for range-routed key spaces
- sequence storage-key routing rules
- advisory partition leaders

The metadata read is not on the critical path of an operation. If no usable map is available, the operation goes out through learned routing or rotation and the refreshed map helps later operations.

Clients refuse metadata they cannot interpret exactly, including unknown schema versions, unknown hash algorithms, incoherent range snapshots, missing leaders, or key-range gaps. In those cases the client falls back instead of guessing.

## Cache and Metrics

Relevant client options:

| Option | Default | Meaning |
|--------|---------|---------|
| `RouteCacheCapacity` | `4096` | Learned route entries kept in memory. |
| `RouteHintLifetime` | `60 seconds` | Maximum age of a learned route before it must be observed again. |
| `RoutingEndpointCooldown` | `5 seconds` | Time an endpoint is skipped after a transport failure. |
| `RoutingMetadataLifetime` | `60 seconds` | Metadata map lifetime in `Metadata` mode. |

The client publishes routing counters under the `Kahuna.Client.Routing` meter:

| Counter | Meaning |
|---------|---------|
| `cache_hits` and `cache_misses` | Learned-route cache outcomes. |
| `metadata_hits` | Operations routed from the metadata map. |
| `hints_learned` | Accepted response hints. |
| `hints_rejected` | Dropped hints, tagged by reason. |
| `endpoints_suppressed` | Endpoints put into failure cooldown. |
| `suppressed_routes_skipped` | Cached routes skipped because their endpoint was cooling down. |
| `metadata_refreshes` | Metadata reads issued. |
| `metadata_refresh_failures` | Metadata reads that produced no usable map. |

If `hints_rejected` with `reason=endpoint_rejected` climbs while cache hits stay low, the server is advertising endpoints the client was not configured or mapped to dial.

## Measured Effect

On a local three-node cluster with cleartext gRPC, in-memory storage, 12 partitions, 2,000 hot keys, and 64 concurrent `get` workers, learned routing reached 116,808 requests per second. The same benchmark with round-robin endpoint selection reached 72,188 requests per second, so removing the extra forwarding hop improved this read-heavy workload by about 62%.

Treat this as a concrete example, not a guaranteed ceiling. The benefit is largest when operations repeat resources and the client can reuse learned routes. Workloads dominated by writes still pay the Raft replication cost, and very large key spaces may need `Metadata` mode or a larger `RouteCacheCapacity` to keep hit rates high.

## Rollout

1. Upgrade servers. Route hints are additive and older clients ignore them.
2. Confirm what a node advertises with `GET /v1/cluster/routing`.
3. Configure `--advertised-client-endpoint` or `RoutingEndpointMap` if advertised URLs differ from dialed URLs.
4. Upgrade clients. A multi-endpoint client in `Auto` starts using learned routing.
5. Use `Routing = RoundRobin` for clients that should keep the old endpoint-selection behavior.
