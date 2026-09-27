import Kahuna3 from './assets/kahuna3.png';

# Getting Started

<div style={{textAlign: 'center'}}>
<img src={Kahuna3} height="350" />
</div>

Distributed systems can become highly complex due to the many reasons: execution may be non-deterministic,
unexpected edge cases, and specific scenarios that make it difficult to reason about solid solutions that ensure system robustness.

Kahuna is an open-source project aimed at providing out-of-the-box solutions for developers and applications that need to solve common problems related to distributed systems.

> _Kahuna_ is a Hawaiian word that refers to an expert in any field. Historically, it has been used to refer to doctors, surgeons and dentists, as well as priests, ministers, and sorcerers.

Kahuna is built around three core distributed systems primitives: **distributed locking, a distributed key/value store, and a distributed sequencer**. Those primitives can also be combined into higher-level patterns such as service discovery, leader election, feature flags, rate limiting, idempotent job execution, inventory reservation, and circuit breakers.

## Distributed Locking
Kahuna addresses the challenge of synchronizing access to shared resources across multiple
nodes or processes, ensuring consistency and preventing race conditions. Its locking
mechanism ensures efficient coordination for many use cases.

[See More](/docs/distributed-locks)

## Distributed Key/Value Store
Beyond locking, Kahuna operates as a distributed key/value store, enabling fault-tolerant,
high-performance storage and retrieval of structured data. This makes it a powerful tool
for managing metadata, caching, and application state in distributed environments.

[See More](/docs/distributed-keyvalue-store)

## Distributed Sequencer
Kahuna also functions as a distributed sequencer, ensuring a globally ordered execution
of events or transactions. This is essential for use cases such as sequence generation,
message queues, and event-driven systems that require precise ordering of
operations.

[See More](/docs/distributed-sequencer)

## Common Use Cases

The recipes section shows how to compose Kahuna's primitives into practical application workflows:

- [Service discovery](/docs/recipes/service-discoverability/) for registering and reading live service instances
- [Leader election](/docs/recipes/leader-election/) for selecting one active worker from many contenders
- [Feature flags and configuration](/docs/recipes/feature-flags/) for consistent dynamic rollout state
- [Rate limiting](/docs/recipes/rate-limiting/) for fixed-window and sliding-expiration counters
- [Idempotent jobs](/docs/recipes/idempotent-jobs/) for making retried work execute once
- [Ordered IDs](/docs/recipes/ordered-ids/) for application-level identifiers backed by the sequencer
- [Inventory reservation](/docs/recipes/inventory-reservation/) for atomic stock checks and decrements
- [Distributed circuit breakers](/docs/recipes/distributed-circuit-breaker/) for sharing failure state across nodes

[Browse Recipes](/docs/recipes/rate-limiting/)

---

## License

Kahuna is licensed under the MIT License. See the [LICENSE](https://github.com/kahunakv/kahuna/blob/main/LICENSE) file for details.

---

