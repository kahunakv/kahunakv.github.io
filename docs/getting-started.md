import Kahuna3 from './assets/kahuna3.png';

# Getting Started

<div style={{textAlign: 'center'}}>
<img src={Kahuna3} height="350" />
</div>

Distributed systems can become highly complex due to the many reasons: execution may be non-deterministic,
unexpected edge cases, and specific scenarios that make it difficult to reason about solid solutions that ensure system robustness.

Kahuna is an open-source project aimed at providing out-of-the-box solutions for developers and applications that need to solve common problems related to distributed systems.

> _Kahuna_ is a Hawaiian word that refers to an expert in any field. Historically, it has been used to refer to doctors, surgeons and dentists, as well as priests, ministers, and sorcerers.

It is primarily focused on the following areas: **distributed locking, a distributed key/value store and a distributed sequencer**.

## Distributed Locking
Kahuna addresses the challenge of synchronizing access to shared resources across multiple
nodes or processes, ensuring consistency and preventing race conditions. Its locking
mechanism ensures efficient coordination for many use cases.

[See More](distributed-locks)

## Distributed Key/Value Store
Beyond locking, Kahuna operates as a distributed key/value store, enabling fault-tolerant,
high-performance storage and retrieval of structured data. This makes it a powerful tool
for managing metadata, caching, and application state in distributed environments.

[See More](distributed-keyvalue-store)

## Distributed Sequencer
Kahuna also functions as a distributed sequencer, ensuring a globally ordered execution
of events or transactions. This is essential for use cases such as sequence generation,
message queues, and event-driven systems that require precise ordering of
operations.

[See More](distributed-sequencer)

---

## License

Kahuna is licensed under the MIT License. See the [LICENSE](https://github.com/kahunakv/kahuna/blob/main/LICENSE) file for details.

---


