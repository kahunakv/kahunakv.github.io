import Kahuna3 from './assets/kahuna3.png';

# Getting Started

<div style={{textAlign: 'center'}}>
<img src={Kahuna3} height="350" />
</div>

Kahuna is an open-source solution designed to provide robust coordination for modern 
distributed systems by integrating three critical functionalities: 
**distributed locking, a distributed key/value store and a distributed sequencer**. 

> _Kahuna_ is a Hawaiian word that refers to an expert in any field. Historically, it has been used to refer to doctors, surgeons and dentists, as well as priests, ministers, and sorcerers.

By ensuring synchronized access to shared resources, efficient data storage and retrieval, 
and globally ordered event sequencing, Kahuna offers a unified approach 
to managing distributed workloads. Built on a partitioned architecture coordinated via **Raft Groups**, 
it delivers **scalability, reliability, and simplicity**, making it an ideal choice for 
applications requiring strong consistency and high availability.

By seamlessly integrating these three functionalities, Kahuna provides a comprehensive 
foundation for building reliable and scalable distributed applications.

## Distributed Locking
Kahuna addresses the challenge of synchronizing access to shared resources across multiple 
nodes or processes, ensuring consistency and preventing race conditions. Its partitioned locking 
mechanism ensures efficient coordination for databases, files, and other shared services.

[See More](distributed-locks)

## Distributed Key/Value Store
Beyond locking, Kahuna operates as a distributed key/value store, enabling fault-tolerant, 
high-performance storage and retrieval of structured data. This makes it a powerful tool 
for managing metadata, caching, and application state in distributed environments.

[See More](distributed-keyvalue-store)

## Distributed Sequencer
Kahuna also functions as a distributed sequencer, ensuring a globally ordered execution 
of events or transactions. This capability is essential for use cases such as distributed 
databases, message queues, and event-driven systems that require precise ordering of 
operations.

[See More](distributed-sequencer)

---

## Consistency Levels

Kahuna provides different consistency levels to meet the requirements of various applications:

## License

Kahuna is licensed under the MIT License. See the [LICENSE](https://github.com/kahunakv/kahuna/blob/main/LICENSE) file for details.

---


