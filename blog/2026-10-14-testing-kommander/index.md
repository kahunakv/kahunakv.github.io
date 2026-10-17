---
slug: testing-kommander
title: "Testing Kommander: The Raft Core Behind Kahuna"
authors: [andresgutierrez]
tags: [kahuna, kommander, raft, testing, distributed-systems]
---

# Testing Kommander: The Raft Core Behind Kahuna

Every write to Kahuna passes through [Kommander](https://github.com/kahunakv/kommander). Kommander is the open-source Raft library that elects leaders, replicates the log, and decides when a write is durable. If Kommander loses a committed entry, Kahuna loses your data. If Kommander elects two leaders for one term, Kahuna can serve two different histories.

This post explains how we test a component with that much responsibility. You will learn which test suites exist, what the coverage number means, what runs on every push, what runs every night, and what deterministic simulation testing adds that normal tests cannot. If you plan to run Kahuna in production, this is the evidence behind its consistency promise.

<!-- truncate -->

## What Kommander does for Kahuna

Raft is a protocol that lets a group of servers agree on one ordered log, even when some servers crash or lose contact. Kahuna splits its key space into partitions, and each partition is its own Raft group with its own leader and its own log. Kommander runs all of them.

For each partition, Kommander provides:

- Leader election, with pre-vote and term fences to stop stale nodes from winning.
- Log replication to a quorum before a write is reported as committed.
- A write-ahead log on RocksDB or SQLite, with compaction of old entries.
- Catch-up for followers that fall behind, by log backfill or by snapshot.
- Dynamic membership, replica placement, and leader balancing.

Kahuna sits on top of this and adds keys, locks, transactions, and clients. The [Raft architecture page](/docs/architecture/raft) describes how the two layers connect. The important point is simple: Kahuna cannot be more correct than Kommander.

## The test suites

Kommander has more than 2,600 test methods in its test project. They fall into groups with different goals:

| Suite | What it checks |
| --- | --- |
| Raft safety | The five Raft safety properties in isolation: election safety, log matching, leader completeness, commit monotonicity, and the term and frontier fences that protect them. |
| Write-ahead log | RocksDB, SQLite, and in-memory logs. Restore after crash, compaction floors, stale completions, and a disk with no free space. |
| Communication | gRPC, REST, and in-memory transports. Reordered, duplicated, and blocked messages. Shared-secret and mutual TLS authentication. |
| Scheduling | The partition executors and fair I/O schedulers that decide which work runs when, including a thread-free mode for embedded hosts. |
| Cluster integration | Real clusters of one to five nodes in one process. Joins, graceful leaves, eviction and rejoin, snapshot installs, replica moves, quiescence, and leader restarts. |
| Chaos | Scripted fault scenarios with a nemesis that cuts, delays, and reorders traffic while invariants run on every step. |
| Simulation | Deterministic simulation testing. A seeded search over generated fault schedules, with replay and automatic shrinking. |

Tests carry categories such as `Stress`, `ChaosSoak`, `DSTSmoke`, and `DSTRandom`. The category decides where a test runs. Cheap tests run on every change. Expensive searches run at night.

## What 92% coverage means here

Line coverage for the Kommander library is above 92%. The number is measured with [coverlet](https://github.com/coverlet-coverage/coverlet) on every push, and it is scoped on purpose:

- Only the `Kommander` library counts. The server host, the benchmarks, and the tests themselves are out of scope.
- Generated code is excluded. Protobuf stubs and gRPC bindings do not inflate the figure.

Coverage tells you which lines ran, not whether the right thing happened. We treat it as a floor, not as a goal. The suites below exist because a line can run in every test and still be wrong under the one schedule nobody wrote.

## What runs on every push

The [pull-request job](https://github.com/kahunakv/kommander/blob/main/.github/workflows/run-tests.yml) runs on every push and pull request. It does more than `dotnet test`:

1. It checks the determinism boundary. A script fails the build if any file on the consensus path reads the wall clock directly. One such read makes a simulation run impossible to replay, and the failure is silent.
2. It builds and tests the thread-free variant, which compiles only under a separate flag.
3. It runs a single-node Kommander on the browser WebAssembly runtime under Node.js. That runtime refuses blocked waits, so it catches a class of deadlock normal .NET hides.
4. It mounts a small filesystem with a small inode count, so the RocksDB tests can observe a disk that really runs out of space.
5. It runs every test except the stress and nightly categories, with coverage and a hang detector.

## Deterministic simulation testing

Deterministic simulation testing, or DST, is the part of the suite that finds bugs nobody thought to write a test for. The idea comes from FoundationDB and Antithesis. Instead of a person who writes a scenario, a generator draws a schedule of faults from a seed, runs it against a real cluster, and checks invariants after every step.

Kommander's DST runs real three-node clusters in one process. The production code is unchanged. What changes is everything around it:

- **A simulated transport** that can block a link in one direction, delay a message, duplicate it, reorder it, or hold it until a later step.
- **A simulated write-ahead log** that can starve a node of disk, refuse writes, or stall a completion.
- **Virtual time.** Every election timeout and heartbeat reads a tick source, so a run moves through hundreds of simulated seconds in one real second.
- **A seeded generator** that crashes nodes, pauses them, restarts them with a blank disk, compacts logs, hangs snapshot exports, and drives client writes.
- **Eleven invariants** checked on every step. They include one leader per term, committed entries agree, committed prefix present, leader completeness, compaction floor respected, and the library's own term and frontier monotonicity reports.
- **One liveness rule.** While a majority is healthy and connected, a leader must appear within forty election timeouts. Every safety rule passes on a cluster with no leader, so this rule is what names a stuck election.
- **A client history checker** that records every operation and verifies the results are consistent with one linear history.

When a seed fails, the run writes the plan of actions in the order they happened. A plan can be replayed action for action, and a shrinker removes actions until only the ones the failure needs remain. A plan of forty actions becomes three. Plans whose cause is understood are promoted into a regression folder and replayed on every search.

The [simulation README](https://github.com/kahunakv/kommander/blob/main/Kommander.Tests/Simulation/README.md) records what the search found so far. Among the findings:

- A log hole below the backfill threshold that was never repaired.
- A backfill anchored exactly at the leader's compaction floor that looped forever.
- A follower below the compaction floor that a hung snapshot export left stranded.
- A paused leader whose two live peers could not elect a replacement for the whole pause.
- A running leader that answered no partition view, so a convergence check misread it as absent.

Each one is now a seed in the corpus, a promoted plan, or both. A seed in the corpus earned its line by re-finding a known defect when that defect was put back on purpose.

## The nightly search

The seeded search is too expensive for a pull request, and a seed that fails is a lead, not a verdict. So it runs as a [nightly job](https://github.com/kahunakv/kommander/blob/main/.github/workflows/nightly-dst.yml) at 03:15 UTC, off the hour on purpose so other scheduled jobs do not load the runner.

Each night the job:

- Sweeps 32 new seeds beside the corpus seeds. The seed base can be moved to explore a different region.
- Shrinks any failing plan automatically, within a budget of 40 cluster runs and 20 minutes.
- Replays every promoted regression plan 24 times. These plans reproduce intermittently, so the repeat count is derived from the measured rate. The first promoted plan reproduced about nine times in a hundred. Three replays would catch its regression one night in four. Twenty-four replays reach about ninety percent.
- Writes a summary with the signature of each failure and uploads the plans as artifacts for 30 days.

The job also enforces stall detectors. A run that stops making progress fails instead of a run that passes slowly after an hour.

## Chaos scenarios and Jepsen

Two more layers complete the picture.

The chaos suite runs real nodes over the in-memory transport with a nemesis in the middle. The state machine is a hash chain, so any divergence between nodes is trivially visible. The nine scripted scenarios cover snapshot chunks under partition, a deposed leader that still sends a snapshot, loss during leadership transfer, symmetric and asymmetric cuts in a five-node cluster, writes on the minority side, duplicated and reordered messages, and a paused leader that resumes. The [chaos spec](https://github.com/kahunakv/kommander/blob/main/specs/chaos-fault-injection-spec.md) explains why network partitions alone were enough to break four of the five Raft safety properties in other libraries, and why these scenarios target them first.

[Jepsen](https://jepsen.io) tests Kommander from the outside, on separate machines, with real network partitions, process kills, and clock skew. That suite lives in [kommander-jepsen](https://github.com/kahunakv/kommander-jepsen). We wrote about the Kahuna version in [Breaking Kahuna on Purpose with Jepsen](/blog/jepsen-testing-kahuna).

## Why go this far

A consensus library fails in the gaps between tests: a message that arrives one step late, a disk that stalls during an election, a snapshot that lands after the leader changed. None of these is exotic in production. All of them are rare in a test suite that a person wrote by hand.

Because Kommander sits under every Kahuna write, we made the effort to find every one of these gaps exhaustive. Unit tests prove each rule. Integration tests prove the rules hold together. Chaos tests prove they hold under faults a person can imagine. The simulation search proves they hold under faults nobody imagined, and when it finds one, it reduces it, replays it, and keeps it forever.

The result is not a promise that Kommander has no bugs. It is a process that finds them before you do, and a record of every one it found.
