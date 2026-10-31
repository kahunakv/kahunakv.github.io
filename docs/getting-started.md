import Kahuna3 from './assets/kahuna3.png';

# Getting Started

Services that run on many machines keep hitting the same coordination problems: two workers run the same job, a retried request creates a second order number, or instances disagree about a configuration value. Kahuna is an open-source, self-hosted cluster that solves them with three building blocks: **distributed locks, a distributed key/value store, and a distributed sequencer**.

<div style={{textAlign: 'center'}}>
<img src={Kahuna3} height="250" />
</div>

> _Kahuna_ is a Hawaiian word that refers to an expert in any field. Historically, it has been used to refer to doctors, surgeons and dentists, as well as priests, ministers, and sorcerers.

To get started:

1. **Run Kahuna.** Start a standalone server with Docker; see [Server Installation](/docs/server-installation/).
2. **Do a tutorial.** The [Key/Value Store](/docs/intro/), [Distributed Locking](/docs/tutorials/distributed-locking/), and [Distributed Sequencer](/docs/tutorials/distributed-sequencer/) tutorials use the [Kahuna CLI](/docs/kahuna-cli/) against your local server.
3. **Pick a building block** for your problem from the sections below. [Why Kahuna?](/docs/why-kahuna/) explains when Kahuna is a good fit and when it is not.

## Distributed Locking

Use a lock when only one process at a time may do something, such as run a scheduled job or apply a database migration. It works like a `lock` statement shared by all your servers. Each lock has a [lease](/docs/glossary/#lease), so a crashed holder cannot block it forever, and a [fencing token](/docs/glossary/#fencing-token) that lets a protected resource reject a holder whose lease already expired.

[See More](/docs/distributed-locks/)

## Distributed Key/Value Store

Store configuration, feature flags, service metadata, caches, and other small shared state that every instance must read the same way. Persistent writes are replicated before they are acknowledged, and [revisions](/docs/glossary/#revision) and compare-and-set let you update a key without overwriting another client's change.

[See More](/docs/distributed-keyvalue-store/)

## Distributed Sequencer

Allocate increasing values from named sequences, like a database identity column that several services can share. An [idempotency key](/docs/glossary/#idempotency-key) makes retries safe: a retried request gets the same value instead of a new one. Each sequence is ordered on its own; values from different sequences are not ordered relative to each other. Typical uses are order IDs, invoice numbers, message queues, and event-driven systems that need ordered identifiers.

[See More](/docs/distributed-sequencer/)

## Common Use Cases

The recipes show how to combine these building blocks into common application patterns:

- [Service discovery](/docs/recipes/service-discoverability/) for registering and reading live service instances
- [Leader election](/docs/recipes/leader-election/) for selecting one active worker from many contenders
- [Feature flags and configuration](/docs/recipes/feature-flags/) for consistent dynamic rollout state
- [Rate limiting](/docs/recipes/rate-limiting/) for fixed-window and sliding-expiration counters
- [Idempotent jobs](/docs/recipes/idempotent-jobs/) for keeping retried jobs from repeating completed work
- [Ordered IDs](/docs/recipes/ordered-ids/) for application-level identifiers backed by the sequencer
- [Inventory reservation](/docs/recipes/inventory-reservation/) for atomic stock checks and decrements
- [Distributed circuit breakers](/docs/recipes/distributed-circuit-breaker/) for sharing failure state across nodes
- [Watch key changes](/docs/recipes/watch-key-changes/) for refreshing a local copy when a persistent key changes

---

## License

Kahuna is licensed under the MIT License. See the [LICENSE](https://github.com/kahunakv/kahuna/blob/main/LICENSE) file for details.

---

