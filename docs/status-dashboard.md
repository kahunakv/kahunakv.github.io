---
sidebar_position: 3
---

import StatusDashboardImage from './assets/status-dashboard.png';

# Status Dashboard

The Status Dashboard gives you a quick health check of one node in a browser, without setting up a metrics stack. Kahuna serves it, read-only, at the HTTP root by default:

```text
http://127.0.0.1:8081/
https://127.0.0.1:8082/
```

It shows the node's readiness, local role, hosted [partitions](/docs/glossary/#partition), total partitions, replication factor, storage backend, [WAL](/docs/glossary/#write-ahead-log-wal) backend, backup status, process version, uptime, heap size, thread count, persistence backlog, and selected engine metrics.

<div style={{textAlign: 'center', margin: '2rem 0'}}>
  <img src={StatusDashboardImage} alt="Kahuna status dashboard" style={{maxWidth: '100%', height: 'auto'}} />
</div>

The dashboard does not mutate cluster state. It never starts backups, restores data, changes placement, moves leaders, splits ranges, or opens transactions.

:::caution
The dashboard page and its [JSON endpoints](#json-endpoints) require no authentication. Anyone who can reach the node's HTTP or HTTPS port can read them, including the node's storage paths. Serve them only on a trusted network and protect the ports with your normal network controls.
:::

## Configuration

```bash
kahuna-server \
  --dashboard-refresh-seconds 10 \
  <other-server-options>
```

`--dashboard-refresh-seconds` sets the browser polling interval (default `5` seconds, clamped from `1` to `300`). `--disable-dashboard` turns the dashboard off: the root path then returns plain `Kahuna.Server`, and the `/v1/dashboard/summary` and `/v1/dashboard/metrics` endpoints are not served. Tools that poll those endpoints, such as the [Kubernetes Operator](/docs/kubernetes-operator/) autoscaler, stop working. See [Server Configuration](/docs/server-configuration/#status-dashboard).

## JSON Endpoints

Automation can read the same node-local data without scraping the page:

```bash
curl http://127.0.0.1:8081/v1/dashboard/summary
curl http://127.0.0.1:8081/v1/dashboard/metrics
```

`/v1/dashboard/summary` reports node identity, readiness, role, partition counts, membership version, replication factor, storage paths, backup status, version, uptime, heap bytes, thread count, and refresh interval.

`/v1/dashboard/metrics` reports a curated subset of Kahuna and Kommander metrics for browser display, including the persistence backlog gauges used by the write backpressure gate. For production telemetry, configure [server OTLP export](/docs/server-configuration/#opentelemetry-export) to collect engine/runtime metrics, request spans, and logs.
