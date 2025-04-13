"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[849],{6164:e=>{e.exports=JSON.parse('{"version":{"pluginId":"default","version":"current","label":"Next","banner":null,"badge":false,"noIndex":false,"className":"docs-version-current","isLast":true,"docsSidebars":{"tutorialSidebar":[{"type":"category","label":"Tutorials","items":[{"type":"link","label":"Tutorial: Key/Value Store","href":"/docs/intro","docId":"intro","unlisted":false},{"type":"link","label":"Tutorial: Distributing Locking","href":"/docs/tutorials/distributed-locking","docId":"tutorials/distributed-locking","unlisted":false},{"type":"link","label":"Tutorial: Distributing Sequencer","href":"/docs/tutorials/distributed-sequencer","docId":"tutorials/distributed-sequencer","unlisted":false}],"collapsed":true,"collapsible":true},{"type":"link","label":"Getting Started","href":"/docs/getting-started","docId":"getting-started","unlisted":false},{"type":"category","label":"Distributed Locks","items":[{"type":"link","label":"Distributed Locks","href":"/docs/distributed-locks","docId":"distributed-locks","unlisted":false},{"type":"link","label":"Leases","href":"/docs/distributed-locks/leases","docId":"distributed-locks/leases","unlisted":false},{"type":"link","label":"Fencing Tokens","href":"/docs/distributed-locks/fencing-tokens","docId":"distributed-locks/fencing-tokens","unlisted":false}],"collapsed":true,"collapsible":true},{"type":"category","label":"Distributed Key/Value Store","items":[{"type":"link","label":"Distributed Key/Value Store","href":"/docs/distributed-keyvalue-store","docId":"distributed-keyvalue-store","unlisted":false},{"type":"link","label":"Compare-And-Swap (CAS)","href":"/docs/distributed-keyvalue-store/cas","docId":"distributed-keyvalue-store/cas","unlisted":false},{"type":"link","label":"Revisions","href":"/docs/distributed-keyvalue-store/revisions","docId":"distributed-keyvalue-store/revisions","unlisted":false},{"type":"link","label":"Transactions","href":"/docs/distributed-keyvalue-store/transactions","docId":"distributed-keyvalue-store/transactions","unlisted":false}],"collapsed":true,"collapsible":true},{"type":"link","label":"Distributed Sequencer","href":"/docs/distributed-sequencer","docId":"distributed-sequencer","unlisted":false},{"type":"category","label":"Scripts","items":[{"type":"link","label":"Scripts","href":"/docs/scripts","docId":"scripts","unlisted":false},{"type":"link","label":"Set","href":"/docs/scripts/commands/set","docId":"scripts/commands/set","unlisted":false},{"type":"link","label":"ESet","href":"/docs/scripts/commands/eset","docId":"scripts/commands/eset","unlisted":false},{"type":"link","label":"Get","href":"/docs/scripts/commands/get","docId":"scripts/commands/get","unlisted":false}],"collapsed":true,"collapsible":true},{"type":"category","label":"Server","items":[{"type":"link","label":"Server Installation","href":"/docs/server-installation","docId":"server-installation","unlisted":false},{"type":"link","label":"Server Configuration","href":"/docs/server-configuration","docId":"server-configuration","unlisted":false}],"collapsed":true,"collapsible":true},{"type":"category","label":"Client","items":[{"type":"link","label":"Kahuna CLI","href":"/docs/kahuna-cli","docId":"kahuna-cli","unlisted":false},{"type":"link","label":"Client for .NET","href":"/docs/dotnet-client","docId":"dotnet-client","unlisted":false}],"collapsed":true,"collapsible":true},{"type":"category","label":"Architecture","items":[{"type":"link","label":"Architecture Overview","href":"/docs/architecture/overview","docId":"architecture/overview","unlisted":false},{"type":"link","label":"Distributed Transactions","href":"/docs/architecture/distributed-transactions","docId":"architecture/distributed-transactions","unlisted":false},{"type":"link","label":"Raft in Kahuna: Consensus and High Availability System","href":"/docs/architecture/raft","docId":"architecture/raft","unlisted":false},{"type":"link","label":"Hybrid-Logical Clocks (HLC)","href":"/docs/architecture/hybrid-logical-clocks","docId":"architecture/hybrid-logical-clocks","unlisted":false},{"type":"link","label":"Durability Levels","href":"/docs/architecture/durability-levels","docId":"architecture/durability-levels","unlisted":false}],"collapsed":true,"collapsible":true},{"type":"category","label":"Recipes","items":[{"type":"link","label":"Rate Limiting","href":"/docs/recipes/rate-limiting","docId":"recipes/rate-limiting","unlisted":false},{"type":"link","label":"Service Discoverability","href":"/docs/recipes/service-discoverability","docId":"recipes/service-discoverability","unlisted":false}],"collapsed":true,"collapsible":true}]},"docs":{"architecture/distributed-transactions":{"id":"architecture/distributed-transactions","title":"Distributed Transactions","description":"Kahuna implements a robust distributed transaction system that combines multi-version concurrency control (MVCC), two-phase commit protocol, and Raft consensus to ensure data consistency and high availability across its distributed key-value store infrastructure.","sidebar":"tutorialSidebar"},"architecture/durability-levels":{"id":"architecture/durability-levels","title":"Durability Levels","description":"Persistent Durability","sidebar":"tutorialSidebar"},"architecture/hybrid-logical-clocks":{"id":"architecture/hybrid-logical-clocks","title":"Hybrid-Logical Clocks (HLC)","description":"A Hybrid Logical Clock (HLC) is an algorithm used in distributed systems to track the order of events.","sidebar":"tutorialSidebar"},"architecture/overview":{"id":"architecture/overview","title":"Architecture Overview","description":"Kahuna is designed to be scalable, consistent, and easy to use. Developers might wonder how this is achieved which is why this section aims to explain the key concepts behind Kahuna\u2019s architecture.","sidebar":"tutorialSidebar"},"architecture/raft":{"id":"architecture/raft","title":"Raft in Kahuna: Consensus and High Availability System","description":"Overview","sidebar":"tutorialSidebar"},"distributed-keyvalue-store":{"id":"distributed-keyvalue-store","title":"Distributed Key/Value Store","description":"A distributed key/value store is a type of database system designed to store, retrieve, and manage data across multiple nodes in a cluster or distributed environment. It follows a simple key-value data model, where keys are unique identifiers, and values are arbitrary byte stream associated data objects.","sidebar":"tutorialSidebar"},"distributed-keyvalue-store/cas":{"id":"distributed-keyvalue-store/cas","title":"Compare-And-Swap (CAS)","description":"A Compare-And-Swap (CAS) operation is critical in a distributed key-value store like Kahuna because it ensures atomic updates and prevents race conditions in environments where multiple clients may try to modify the same key simultaneously. CAS is an atomic operation that:","sidebar":"tutorialSidebar"},"distributed-keyvalue-store/revisions":{"id":"distributed-keyvalue-store/revisions","title":"Revisions","description":"In Kahuna, a revision is a monotonic version number that tracks when a key was last modified. Every time a key is updated or deleted, its revision increments, ensuring strong consistency and strict ordering. It acts as a logical timestamp to resolve stale client operations.","sidebar":"tutorialSidebar"},"distributed-keyvalue-store/transactions":{"id":"distributed-keyvalue-store/transactions","title":"Transactions","description":"---","sidebar":"tutorialSidebar"},"distributed-locks":{"id":"distributed-locks","title":"Distributed Locks","description":"A distributed lock is a mechanism that ensures that a specific resource is accessed by only one node or process at a time in a distributed environment. This is crucial when:","sidebar":"tutorialSidebar"},"distributed-locks/fencing-tokens":{"id":"distributed-locks/fencing-tokens","title":"Fencing Tokens","description":"A fencing token is a monotonically increasing number (e.g., version number) issued every time a lock is acquired.","sidebar":"tutorialSidebar"},"distributed-locks/leases":{"id":"distributed-locks/leases","title":"Leases","description":"Distributed locks in Kahuna are based on the paper [*\\"Leases: An Efficient","sidebar":"tutorialSidebar"},"distributed-sequencer":{"id":"distributed-sequencer","title":"Distributed Sequencer","description":"Distributed systems are hard because there\u2019s no shared memory, clocks are not perfectly synchronized, and messages can arrive out of order. A distributed sequencer provides a way to enforce order despite all that chaos.","sidebar":"tutorialSidebar"},"dotnet-client":{"id":"dotnet-client","title":"Client for .NET","description":"Kahuna also provides a client tailored for .NET developers. This client simplifies the integration of distributed locking into your .NET applications by abstracting much of the underlying complexity. Documentation and samples for the client can be found in the docs/ folder or on our GitHub repository.","sidebar":"tutorialSidebar"},"getting-started":{"id":"getting-started","title":"Getting Started","description":"Kahuna is an open-source solution designed to provide robust coordination for modern","sidebar":"tutorialSidebar"},"intro":{"id":"intro","title":"Tutorial: Key/Value Store","description":"Kahuna provides building blocks to help construct distributed systems. The key/value store can be used to store configuration, service discoverability,","sidebar":"tutorialSidebar"},"kahuna-cli":{"id":"kahuna-cli","title":"Kahuna CLI","description":"Kahuna CLI is an interactive command-line tool that allows sending commands, executing transactions in a Kahuna cluster and viewing the results.","sidebar":"tutorialSidebar"},"recipes/rate-limiting":{"id":"recipes/rate-limiting","title":"Rate Limiting","description":"Rate limiting is a mechanism that many developers may have to deal with at some point in their life. It\u2019s useful for a variety of purposes like sharing access to limited resources. The Fixed Window Counter is a simple algorithm used primarily for rate limiting\u2014controlling how many requests or actions a client can perform within a given period. Here\u2019s a breakdown of how it works and its key characteristics:","sidebar":"tutorialSidebar"},"recipes/service-discoverability":{"id":"recipes/service-discoverability","title":"Service Discoverability","description":"Store metadata (IP, port, status, version, etc.) about microservices so other components can discover and interact with them:","sidebar":"tutorialSidebar"},"scripts":{"id":"scripts","title":"Scripts","description":"Kahuna offers a scripting system in its key/value store called Kahuna Script. With these scripts, it\'s possible to execute logic that consistently reads data from the key/value store and also modifies or manipulates that data in an all-or-nothing fashion\u2014that is, changes won\u2019t be partially applied in the event of an error or failure.","sidebar":"tutorialSidebar"},"scripts/commands/eget":{"id":"scripts/commands/eget","title":"Get","description":"Get the value of key from the volatile storage. If the key does not exist null is returned."},"scripts/commands/eset":{"id":"scripts/commands/eset","title":"ESet","description":"Allows to create or update a key/value in volatile storage (memory).","sidebar":"tutorialSidebar"},"scripts/commands/get":{"id":"scripts/commands/get","title":"Get","description":"Get the value of key from the persistent durable storage. If the key does not exist null is returned.","sidebar":"tutorialSidebar"},"scripts/commands/set":{"id":"scripts/commands/set","title":"Set","description":"Allows to create or update a key/value in a persistent durable way.","sidebar":"tutorialSidebar"},"server-configuration":{"id":"server-configuration","title":"Server Configuration","description":"| Command Line Option(s)                              | Description                                                                                     | Default Value   |","sidebar":"tutorialSidebar"},"server-installation":{"id":"server-installation","title":"Server Installation","description":"If you want to run a Kahuna cluster on your local machine for testing and development, you need to have Docker up and running.","sidebar":"tutorialSidebar"},"storage/overview":{"id":"storage/overview","title":"Overview","description":"RocksDB is widely used in high-performance storage and database systems, particularly where low-latency, high-throughput key-value storage is required."},"tutorials/distributed-locking":{"id":"tutorials/distributed-locking","title":"Tutorial: Distributing Locking","description":"Distributed locking is a critical pattern used to coordinate access to shared resources in distributed systems where multiple nodes, services or processes might try to modify the same resource concurrently. It ensures mutual exclusion, consistency and safe concurrent behavior.","sidebar":"tutorialSidebar"},"tutorials/distributed-sequencer":{"id":"tutorials/distributed-sequencer","title":"Tutorial: Distributing Sequencer","description":"A distributed sequencer is a component or service in a distributed system that generates a monotonically increasing, globally ordered sequence of identifiers (often called sequence numbers, version numbers, or timestamps). Its job is to ensure that operations across multiple nodes can be totally ordered even though they happen concurrently on different machines.","sidebar":"tutorialSidebar"}}}}')}}]);