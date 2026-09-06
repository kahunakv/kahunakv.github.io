# Benchmarking Kahuna

`kahuna-bench` sends sustained traffic through the normal `Kahuna.Client` network path and reports client-observed throughput and latency percentiles from p50 through p99.9.

Use it to:

- Measure an installation before production rollout
- Find the throughput limit of a cluster
- Verify tail latency at a required request rate
- Compare server versions, storage adapters, configurations, or hardware
- Store repeatable performance results in CI

It is a load generator, not a correctness test or server profiler. For distributed correctness testing, see the public [Kahuna Jepsen suite](https://github.com/kahunakv/kahuna-jepsen), which covers key/value registers, distributed locks, interactive transactions, sequencer allocation, and membership churn under fault injection.

:::warning Use a dedicated test environment

Benchmark workloads create or update keys under `bench:`, acquire locks, and may create the persistent sequence `bench:seq:0`. The `get` and `mixed` workloads also seed data before measurement. A script workload executes the supplied script without modification.

Do not point the tool at a production cluster unless this traffic and data are explicitly acceptable.

:::

## Install

Install the .NET global tool:

```bash
dotnet tool install --global Kahuna.Benchmark
```

Update an existing installation with:

```bash
dotnet tool update --global Kahuna.Benchmark
```

## Quick Start

Run a 50% read and 50% write workload for 60 measured seconds with 128 concurrent workers:

```bash
kahuna-bench \
  -c "https://kahuna-1:8082,https://kahuna-2:8082,https://kahuna-3:8082" \
  --workload mixed \
  --duration 60 \
  --concurrency 128
```

For the standalone development server:

```bash
kahuna-bench \
  -c https://127.0.0.1:8082 \
  --insecure \
  --workload mixed \
  --duration 30
```

When the server exposes a cleartext gRPC port with `--grpc-cleartext-ports`, point the benchmark at that h2c endpoint and omit `--insecure`:

```bash
kahuna-bench \
  -c http://127.0.0.1:8083 \
  --workload mixed \
  --duration 30
```

A run has three phases:

1. **Seed:** create keys needed by `get` or `mixed`, or create the shared sequence
2. **Warmup:** generate load for `--warmup` seconds and discard its samples
3. **Measurement:** record operations for `--duration` seconds and produce the report

Seeding is capped at 100,000 keys and uses at most 64 concurrent writers.

## Three-Node Cluster Example

Start a cluster with the Docker image or the `Kahuna.Server` .NET global tool on each node.

Pass every cluster endpoint in one comma-separated connection source:

```bash
kahuna-bench \
  -c "https://127.0.0.1:8082,https://127.0.0.1:8084,https://127.0.0.1:8086" \
  --insecure \
  --duration 30
```

Example output from a three-node cluster using the default mixed workload and persistent durability:

```text
Kahuna Benchmark — mixed, 30s + 5s warmup, concurrency=64, target=unbounded
  endpoints : https://127.0.0.1:8082, https://127.0.0.1:8084, https://127.0.0.1:8086
  tls       : disabled (--insecure)
  routing   : Learned (auto)
  key-space : 10000   value-size : 128B   durability : persistent
Seeding key-space…
  Seeding 10,000 keys (parallelism=64)…
Warming up for 5s…
Running measurement for 30s…

Operation     Count   req/s      p50      p90      p95      p99    p99.9       max     mean   errors   misses
get         118,219   3,940    1.5ms    2.6ms    2.7ms    2.9ms    4.5ms   134.4ms    1.7ms        0        0
set         118,152   3,938   14.0ms   20.4ms   23.0ms   26.7ms   74.2ms   146.9ms   14.6ms        0        0
TOTAL       236,371   7,879    6.2ms   17.8ms   20.4ms   24.8ms   34.0ms   146.9ms    8.1ms        0        0
```

This persistent run completed 236,371 successful operations at 7,879 requests per second without errors or misses. Reads reached a 2.9 ms p99, while persistent writes reached a 26.7 ms p99 because they include the replicated consensus path before success is returned.

Use a longer measurement, such as `--warmup 10 --duration 60`, when establishing a performance baseline or comparing deployments.

## Workloads

| Workload | Operation |
|----------|-----------|
| `set` | Write a random payload using `SetKeyValue` |
| `get` | Read keys using `GetKeyValue` |
| `mixed` | Select reads and writes using `--read-pct` |
| `delete` | Delete one generated key per operation |
| `set-many` | Write `--batch-size` generated keys per operation |
| `delete-many` | Delete `--batch-size` generated keys per operation |
| `txn` | Open an interactive transaction, write `--keys-per-txn` keys, and commit |
| `bank` | Run contended transactional transfers between seeded account keys |
| `lock` | Acquire and release one lock per operation |
| `sequence` | Allocate the next value from the shared `bench:seq:0` sequence |
| `script` | Execute the transaction script supplied with `--script` |

All generated key/value and lock names use `bench:{n}` over the configured key space. A small key space increases contention and cache reuse. A large key space distributes operations more broadly.

Example workloads:

```bash
# Read workload over one million possible keys; expect misses above the seed cap
kahuna-bench -c https://kahuna-1:8082 \
  --workload get --key-space 1000000 --duration 60

# Persistent lock acquisition and release
kahuna-bench -c https://kahuna-1:8082 \
  --workload lock --concurrency 64 --duration 60

# Server-side transaction script
kahuna-bench -c https://kahuna-1:8082 \
  --workload script --script ./transfer.4gl --duration 60

# Bank-style read-modify-write transfers
kahuna-bench -c https://kahuna-1:8082 \
  --workload bank --txn-locking optimistic --duration 60

# Ephemeral writes with 1 KiB values
kahuna-bench -c https://kahuna-1:8082 \
  --workload set --durability ephemeral --value-size 1024
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `-c`, `--connection-source` | required | Comma-separated Kahuna endpoints |
| `--workload` | `mixed` | `set`, `get`, `mixed`, `delete`, `set-many`, `delete-many`, `txn`, `bank`, `lock`, `sequence`, or `script` |
| `--duration` | `30` | Measured duration in seconds, excluding warmup |
| `--warmup` | `5` | Warmup duration in seconds whose samples are discarded |
| `--concurrency` | `64` | Closed-loop workers or open-loop consumers |
| `--rate` | `0` | Target requests per second. `0` selects unbounded closed-loop mode |
| `--key-space` | `10000` | Number of distinct `bench:{n}` keys |
| `--key-prefix` | `bench:` | Prefix for generated keys. End it with `/` to keep a `set-many` or `delete-many` batch in one hash key space |
| `--value-size` | `128` | Write payload size in bytes |
| `--read-pct` | `50` | Read percentage for `mixed`; the remainder are writes |
| `--batch-size` | `100` | Keys mutated per `set-many` or `delete-many` request |
| `--keys-per-txn` | `4` | Keys written inside each `txn` workload transaction |
| `--txn-locking` | `pessimistic` | Transaction locking mode for `txn`: `pessimistic` or `optimistic` |
| `--durability` | `persistent` | `persistent` or `ephemeral` for key/value and lock workloads |
| `--script` | none | Path to the `.4gl` file required by the `script` workload |
| `--timeout` | `10` | Per-request timeout in seconds |
| `--format` | `console` | `console`, `json`, or `csv` |
| `--output` | stdout | Output file for JSON or CSV |
| `--insecure` | `false` | Skip TLS certificate validation |
| `--grpc-channels` | `2` | HTTP/2 connections opened per endpoint. Raise this when one client process needs more parallel streams per node |
| `--batch-coalescing-threshold` | `10` | Batch size below which the client may wait briefly to gather more work before dispatch. Set to `1` to disable coalescing. |
| `--batch-coalescing-delay` | `2` | Maximum client batch coalescing wait in milliseconds. `0` disables the wait. |
| `--seed` | time-based | Random seed; use a nonzero value for repeatability |
| `--routing` | `auto` | Client endpoint selection: `auto`, `roundrobin`, `learned`, or `metadata` |
| `--routing-endpoint-map` | none | Comma-separated `advertised=dialed` endpoint pairs for mapped deployments |
| `--allow-unlisted-routing-endpoints` | `false` | Allow route hints to dial endpoints that were not configured or mapped |
| `--routing-counters` | `false` | Print totals from the `Kahuna.Client.Routing` meter after the run |

Localhost endpoints automatically disable certificate validation. Use `--insecure` explicitly for other development endpoints with self-signed certificates.

## Routing Measurements

`kahuna-bench` uses the same leader-aware routing modes as `Kahuna.Client`. The console header prints the effective mode, so an `auto` run with several endpoints reports `Learned (auto)` while a single-endpoint run reports `RoundRobin (auto)`.

In one local three-node read benchmark, learned routing reached 116,808 requests per second versus 72,188 requests per second with round-robin endpoint selection. See [Client Leader-Aware Routing](/docs/client-routing/#measured-effect) for context and caveats.

Use explicit routing modes when comparing the cost of forwarded requests:

```bash
kahuna-bench -c "$ENDPOINTS" --workload get --routing roundrobin --duration 60
kahuna-bench -c "$ENDPOINTS" --workload get --routing learned --routing-counters --duration 60
kahuna-bench -c "$ENDPOINTS" --workload get --routing metadata --routing-counters --duration 60
```

Enable `--routing-counters` when you need to prove the selected mode is actually being used. For example, a `learned` run with a working set larger than `RouteCacheCapacity` may show few cache hits and behave like endpoint rotation. A rising `hints_rejected[endpoint_rejected]` counter usually means servers advertise endpoints the benchmark process cannot dial; use `--routing-endpoint-map` to map advertised URLs to dialed URLs.

## Closed-Loop and Open-Loop Tests

The two load modes answer different questions.

### Find Maximum Throughput

Closed-loop mode is the default. Every worker sends a request, waits for its response, and then sends the next request.

```bash
kahuna-bench -c "$ENDPOINTS" \
  --workload mixed \
  --rate 0 \
  --concurrency 128 \
  --duration 60
```

Increase concurrency across separate runs until throughput stops improving. This estimates how much load that client population can extract.

Closed-loop testing can understate tail latency during saturation because slow responses also reduce the rate at which clients submit new work. This effect is called coordinated omission.

### Verify an SLA Rate

Open-loop mode schedules requests at a fixed aggregate rate and measures latency from each intended start time:

```bash
kahuna-bench -c "$ENDPOINTS" \
  --workload mixed \
  --rate 20000 \
  --concurrency 128 \
  --duration 60
```

Use this mode to answer questions such as, "What p99 latency does the cluster deliver at 20,000 requests per second?"

If achieved throughput remains below the target while p99 grows rapidly, the installation cannot sustain that rate. High-rate open-loop pacing uses a dedicated spinning thread, so reserve one CPU core for the load generator.

## Read the Report

The console report contains one row per operation and one aggregate row:

```bash
kahuna-bench -c "https://127.0.0.1:8082" --insecure --duration 240 --durability ephemeral --concurrency 256
```

```text
Kahuna Benchmark — mixed, 240s + 5s warmup, concurrency=256, target=unbounded
  endpoints : https://127.0.0.1:8082
  tls       : disabled (--insecure)
  routing   : RoundRobin (auto)
  key-space : 10000   value-size : 128B   durability : ephemeral
Seeding key-space…
  Seeding 10,000 keys (parallelism=64)…
Warming up for 5s…
Running measurement for 240s…

Operation        Count    req/s     p50     p90     p95     p99   p99.9      max    mean   errors   misses
get          6,767,821   28,199   4.6ms   5.3ms   5.4ms   5.8ms   7.7ms   98.2ms   4.5ms        0        0
set          6,771,788   28,216   4.6ms   5.3ms   5.3ms   5.7ms   7.6ms   98.2ms   4.5ms        0        0
TOTAL       13,539,609   56,415   4.6ms   5.3ms   5.4ms   5.8ms   7.6ms   98.2ms   4.5ms        0        0
```

This run completed 13,539,609 successful operations at 56,415 requests per second. The default mixed workload produced an approximately even split between reads and writes. Its p99 was 5.8 ms and p99.9 was 7.6 ms, with no errors or misses.

The 98.2 ms maximum shows why a single worst request should not be treated as representative latency. Use p99 or p99.9 for a stable tail-latency objective, while still investigating repeated or unusually large maximums.

| Field | Meaning |
|-------|---------|
| `Count` | Successful measured operations |
| `req/s` | Successful operations divided by measured time |
| `p50` through `p99.9` | Successful-request latency percentiles |
| `max` | Highest recorded successful-request latency |
| `mean` | Average successful-request latency |
| `errors` | Errors plus timeouts in console output |
| `misses` | Reads that did not find a value, or lock acquisitions that found the lock busy |

Errors, timeouts, and misses do not contribute to successful `req/s`. JSON and CSV separate `errors` from `timeouts`, while the console combines them in its `errors` column.

Focus on p99 and p99.9 for user-facing latency. A low p50 with a high p99 indicates occasional stalls hidden by the median.

For `get` and `mixed`, a key space above 100,000 produces some misses because seeding stops at 100,000 keys. Use `--key-space 100000` or lower for an all-seeded read test. For `delete`, misses mean the generated key was already absent.

## JSON and CSV Output

Machine-readable output sends progress to stderr and keeps stdout clean:

```bash
kahuna-bench -c "$ENDPOINTS" \
  --workload mixed \
  --duration 60 \
  --format json | jq '.aggregate.p99Ms'

kahuna-bench -c "$ENDPOINTS" \
  --workload get \
  --duration 60 \
  --format csv \
  --output benchmark.csv
```

JSON includes the complete run parameters, per-operation statistics, and aggregate statistics. Stable fields include `rps`, `p50Ms`, `p99Ms`, `p999Ms`, `errors`, `timeouts`, and `misses`.

## Reproducible Comparisons

Keep endpoints, server data, duration, concurrency, key space, payload size, durability, and random seed identical when comparing two installations:

```bash
kahuna-bench -c "$ENDPOINTS" \
  --workload mixed \
  --read-pct 50 \
  --duration 60 \
  --warmup 10 \
  --concurrency 128 \
  --key-space 100000 \
  --value-size 256 \
  --seed 42 \
  --format json \
  --output build-a.json
```

Run the load generator on a separate machine so it does not compete with Kahuna for CPU, memory, network bandwidth, or storage I/O. Use at least 10 seconds of warmup and 60 seconds of measurement when comparing tail latency.
