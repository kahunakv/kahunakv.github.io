---
slug: 290k-requests-per-second
title: "290k Requests per Second on One Node, and Faster Than Valkey"
authors: [andresgutierrez]
tags: [kahuna, performance, redis, valkey, rate-limiting, benchmarks]
---

# 290k Requests per Second on One Node, and Faster Than Valkey

This week Kahuna crossed a line I did not expect to cross this year. A single node served 290k `get` requests per second for ephemeral keys. On the same machine, with the same number of clients, Valkey 9.1 served 247k plain `GET` requests per second.

The rate limiter is the number I care about more. Kahuna ran the fixed-window counter script from the [rate-limiting recipe](/docs/recipes/rate-limiting/) at about 200k requests per second. Valkey ran the same counter as a Lua script at 161k with `EVAL` and 175k with `EVALSHA`.

Before this work the same rate limiter ran at 84k. Nothing about the storage engine changed. What changed is how requests travel over the wire, and how a script that touches one key runs inside the node.

<!-- truncate -->

## The Numbers, and What They Do Not Mean

All numbers come from one 8-core Apple Silicon Mac. The Kahuna node and the benchmark client ran on the same machine and competed for the same cores. Valkey 9.1.2 and `valkey-benchmark` ran on the same machine the same way. Every run used 64 closed-loop workers, a key space of 10,000 keys, and 128-byte values. The Valkey runs used no pipelining. The machine was CPU-saturated in every run.

| Workload | Kahuna, before | Kahuna, now | Valkey, same machine |
|---|---:|---:|---:|
| Ephemeral `get` | 104k req/s | 290k req/s | 247k req/s (`GET`) |
| Rate-limit counter script | 84k req/s | 194k-203k req/s | 175k req/s (Lua `EVALSHA`) |
| Ephemeral `set` | 84k req/s | 218k req/s | |
| Mixed `get`/`set` | 104k req/s | 234k req/s | |
| Script `RETURN 1` | 105k req/s | 416k-438k req/s | |

Latency moved the same way. The rate limiter went from p50 700 µs and p99 4.0 ms to p50 284 µs and p99 0.7 ms at the same concurrency.

Read these as a comparison, not as a capacity claim. Run-to-run noise on this machine is about ±15%. A client on a second machine would give higher numbers for the node alone. A three-node cluster with persistent, replicated writes is a different benchmark, and the [benchmarking page](/docs/benchmarking#recent-local-results) keeps those separate on purpose.

The Kahuna side is also a memory node with an ephemeral durability level. That is the fair comparison with Valkey. It is the same class of state: short-lived, in memory, rebuildable. It is not the state you put behind Raft.

## Where the Time Went

Before this work, a script that did nothing at all cost the node about 40 µs of CPU per request. `RETURN 1` touches no key. It runs no transaction. It still topped out near 105k requests per second, and the node was busy the whole time.

That cost was not in Kahuna's storage or its actors. It was in the transport. The .NET client sends every key/value request over one long-lived bidirectional gRPC stream per connection. Each request was its own stream message, and each response was its own stream message.

A stream message has a fixed price that does not depend on what the request does: a gRPC frame, an HTTP/2 DATA frame, the transport's pipe locks, the protobuf envelope, and five or six thread hops on each side. For a small request that fixed price is most of the total.

The rate limiter had a second problem, inside the node. An admitted request is a pessimistic single-key transaction. On the general path it sends six messages to the actor that owns the key: lock, read, write, prepare, a range-lock probe, and commit. Each message is routed, queued on the actor's mailbox, and awaited. All six go to the same single-threaded actor.

Two changes removed most of both costs.

## Change One: Request Frames

A **frame** is one gRPC stream message that carries several independent requests, or several independent responses. The fixed cost of the message is paid once per frame instead of once per request.

The rule that makes frames safe is that a frame never waits. The client packs only the requests that are already waiting when it writes. The node packs only the responses that are already ready. No request is held back to make a frame fuller. At low load a request travels alone, as the plain message it always was, and a quiet connection is byte-identical to a connection without frames.

Each item in a frame is a complete request with its own type and its own id. The node runs every item through the same code path as a lone request. An item that fails does not affect the others. A frame does not make its items atomic, and it does not order them. It is a transport optimization only. Atomicity still comes from a script or a transaction.

Frames are negotiated per stream, and never by probing. A node that reads frames says so in a response header when the stream opens. The client sends a frame only after it sees that header on that stream. The node sends response frames only on a stream that already carried a request frame. A new client works with an old node, an old client works with a new node, and a rolling upgrade is safe in either order.

A frame holds at most 256 items or 1 MiB of serialized items. The byte budget sits far below the 4 MB gRPC message limit on purpose. A message over that limit resets the stream that every other request shares.

The effect on the empty script shows what the transport was costing:

| `RETURN 1` | One request per message | Frames |
|---|---:|---:|
| Throughput | 105k req/s | 416k-438k req/s |
| Node CPU per request | 39.9 µs | 9.2 µs |
| Client CPU per request | 25 µs | 6.6 µs |
| p50 / p99 at c=64 | 601 µs / 805 µs | 140 µs / 317 µs |

For `get` the same change took the node from 104k to 290k requests per second. That is the headline number, and it is a transport win. The storage path for an ephemeral `get` did not change.

If you have used Redis pipelining, frames are the same idea. The difference is that the client does it for you, on every connection, and only when there is something waiting.

## Change Two: One Actor Turn per Script

Frames took the rate limiter from 84k to about 138k requests per second. Then the node sat at about 610% CPU while the client used about 110%. The transport was no longer the limit. The six actor messages were.

The insight is that all six messages go to the same single-threaded actor. Most of what the protocol between them protects against, another transaction interleaving between two steps, cannot happen inside one actor turn.

The fix has two parts, and both apply only to the ephemeral key space on the node that leads the key's partition.

**Fused finalize.** A transaction whose whole write set is one ephemeral key finalizes with one actor message instead of three. That message runs the existing prepare handler, the existing range-lock check, and the existing commit handler, in that order, in a single actor turn. Six messages become four. This applies to interactive transactions as well as scripts.

**Script actor turns.** An auto-commit script whose lock analysis names exactly one ephemeral key runs start to finish inside one turn of the actor that owns the key. The turn issues the same requests to the same handlers in the same order as the general path. Each request is a direct call served by the actor that is already running, not a routed mailbox round trip. Six messages become one.

A script takes a turn only when every statement is one a turn can run: expressions, `LET`, `IF`, `RETURN`, `THROW`, and the ephemeral point operations. A script that sleeps, loops, scans a prefix, touches a persistent key, or opens an explicit `BEGIN` stays on the general path. The shape check is a filter, not a proof. If a turn finds a statement it cannot run, it releases the key, discards what it staged, and the script runs again from the start on the general path. Nothing from the first attempt is observable.

Nothing about the answer changes. The result, the revision, the reason text, and the state left on the key are the same on either path. The turn takes the same exclusive lock. Foreign locks and write intents are honoured by the same handler checks. The test suites run every scenario with the mechanisms on and off and compare. The [single-key fast path](/docs/scripts/single-key-fast-path/) page lists the exact rules and the switches to turn each part off.

| Rate limiter, frames on | req/s | p50 | p99 |
|---|---:|---:|---:|
| Neither mechanism | 127k-136k | 410-420 µs | 2.4-3.8 ms |
| Fused finalize only | 140k-160k | 357-384 µs | 0.8-1.4 ms |
| Script actor turns (default) | 194k-203k | 284-289 µs | 0.6-0.8 ms |

## Why This Changes What Kahuna Is For

Until now I described Kahuna as the layer between Redis and Postgres. It held the state that was too important for a cache and too hot for a database. I said in [an earlier post](/blog/redis-postgres-and-kahuna) that consensus is not free, and that you should pay for it only where a wrong answer is worse than a slow answer.

That advice still holds for persistent, replicated keys. For ephemeral keys it no longer describes the cost. A single Kahuna node now serves counters, flags, and point reads at the speed people choose Redis or Valkey for. That puts a set of workloads on the table that I used to send elsewhere:

- **Rate limiting.** One script, one ephemeral key, atomic check and increment, about 200k decisions per second on one node. The [recipe](/docs/recipes/rate-limiting/) is written to take the fast path.
- **Counters, quotas, and feature flags.** The same shape as the rate limiter: read, compare, write, one key.
- **Idempotency keys and deduplication.** `EEXISTS` and `ESET` with an expiry, in one atomic script.
- **Session and presence state.** Point `get` and `set` on keys with a TTL.
- **Server-side logic.** Kahuna Script runs where the data is, like Lua in Redis, but with the same transaction semantics as the rest of the system.

The difference from running these on Redis or Valkey is that the same node, with the same client and the same verbs, also holds the state you cannot lose. A lock, a leader lease, a sequence, or a multi-key transaction lives in the persistent key space, replicated with Raft and tested with Jepsen. You do not run one system for the fast state and another for the correct state. You choose the durability level per key.

I want to be careful about the claim. Valkey is a mature project with years of tuning, and it executes commands on one main thread by design, while Kahuna used every core on the machine. The comparison is fair on the workload and the machine, not on the engineering budget. And these are single-node memory numbers. Replicated, persistent writes cost what they cost.

## What Is Still Slow

Frames cover the key/value stream: get, set, delete, exists, scripts, bucket reads, prefix scans, and interactive transaction calls. The lock stream and the sequence calls still carry one request per message. Locks ran at 49k requests per second before and after, and sequences at 114k. Both still pay the full per-message cost.

The fast path is deliberately narrow. Multi-key scripts, scripts that scan, and anything on the persistent key space run through the general path with all six messages. An interactive transaction over two ephemeral keys still does two-phase commit and ran at 19k requests per second with frames.

One more thing frames do not fix. A node under sustained fixed-window rate-limit load slows over time, because fixed windows create one new short-lived key per subject per window. The cost of those keys is not a transport cost, and frames do not change it.

## Reproduce It

Both changes are on by default in the current build. The benchmark tool has switches to turn each one off, so one build runs both arms of the comparison:

```bash
# Frames on (default)
kahuna-bench -c http://localhost:8083 --workload rate-limit --durability ephemeral \
  --key-space 10000 --rate-limit-budget 1000000 --duration 10

# Frames off
kahuna-bench -c http://localhost:8083 --workload rate-limit --durability ephemeral \
  --key-space 10000 --rate-limit-budget 1000000 --duration 10 --no-request-frames
```

Start the node with `--disable-script-actor-turns` or `--disable-fused-ephemeral-finalize` to measure the fast path on its own. Restart the node between arms, alternate them, and run the client on a second machine if you want numbers that describe the node rather than the pair. The [benchmarking page](/docs/benchmarking) has the full node command line.

Kahuna is [open source](https://github.com/kahunakv/kahuna) under the MIT license. If your rate limiter, counter, or session store runs on Redis today, I would like to know how the same script does on Kahuna on your hardware.
