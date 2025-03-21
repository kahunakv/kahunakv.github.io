"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[849],{6164:e=>{e.exports=JSON.parse('{"version":{"pluginId":"default","version":"current","label":"Next","banner":null,"badge":false,"noIndex":false,"className":"docs-version-current","isLast":true,"docsSidebars":{"tutorialSidebar":[{"type":"link","label":"Tutorial: Key/Value Store","href":"/docs/intro","docId":"intro","unlisted":false},{"type":"link","label":"Getting Started","href":"/docs/getting-started","docId":"getting-started","unlisted":false},{"type":"link","label":"Distributed Locks","href":"/docs/distributed-locks","docId":"distributed-locks","unlisted":false},{"type":"category","label":"Distributed Key/Value Store","items":[{"type":"link","label":"Overview","href":"/docs/distributed-keyvalue-store","docId":"distributed-keyvalue-store","unlisted":false},{"type":"link","label":"Compare-And-Swap (CAS)","href":"/docs/distributed-keyvalue-store/cas","docId":"distributed-keyvalue-store/cas","unlisted":false},{"type":"link","label":"Distributed Transactions","href":"/docs/distributed-keyvalue-store/transactions","docId":"distributed-keyvalue-store/transactions","unlisted":false}],"collapsed":true,"collapsible":true},{"type":"category","label":"Scripts","items":[{"type":"link","label":"Scripts","href":"/docs/scripts","docId":"scripts","unlisted":false},{"type":"link","label":"Set","href":"/docs/scripts/set","docId":"scripts/set","unlisted":false}],"collapsed":true,"collapsible":true},{"type":"category","label":"Tutorials","items":[{"type":"link","label":"distributed-locking","href":"/docs/tutorials/distributed-locking","docId":"tutorials/distributed-locking","unlisted":false}],"collapsed":true,"collapsible":true},{"type":"category","label":"Server","items":[{"type":"link","label":"Server Installation","href":"/docs/server-installation","docId":"server-installation","unlisted":false},{"type":"link","label":"Server Configuration","href":"/docs/configuration","docId":"configuration","unlisted":false}],"collapsed":true,"collapsible":true},{"type":"category","label":"Client","items":[{"type":"link","label":"Kahuna CLI","href":"/docs/kahuna-cli","docId":"kahuna-cli","unlisted":false},{"type":"link","label":"Client for .NET","href":"/docs/dotnet-client","docId":"dotnet-client","unlisted":false}],"collapsed":true,"collapsible":true}]},"docs":{"architecture/overview":{"id":"architecture/overview","title":"Overview","description":""},"architecture/raft":{"id":"architecture/raft","title":"Raft","description":""},"configuration":{"id":"configuration","title":"Server Configuration","description":"| Command Line Option(s)                              | Description                                                                                     | Default Value   |","sidebar":"tutorialSidebar"},"distributed-keyvalue-store":{"id":"distributed-keyvalue-store","title":"Overview","description":"A distributed key/value store is a type of database system designed to store, retrieve, and manage data across multiple nodes in a cluster or distributed environment. It follows a simple key-value data model, where keys are unique identifiers, and values are the associated data objects.","sidebar":"tutorialSidebar"},"distributed-keyvalue-store/cas":{"id":"distributed-keyvalue-store/cas","title":"Compare-And-Swap (CAS)","description":"A Compare-And-Swap (CAS) operation is critical in a distributed key-value store like Kahuna because it ensures atomic updates and prevents race conditions in environments where multiple clients may try to modify the same key simultaneously. CAS is an atomic operation that:","sidebar":"tutorialSidebar"},"distributed-keyvalue-store/transactions":{"id":"distributed-keyvalue-store/transactions","title":"Distributed Transactions","description":"What is Two-Phase Commit (2PC)?","sidebar":"tutorialSidebar"},"distributed-locks":{"id":"distributed-locks","title":"Distributed Locks","description":"A distributed lock is a mechanism that ensures that a specific resource is accessed by only one node or process at a time in a distributed environment. This is crucial when:","sidebar":"tutorialSidebar"},"distributed-sequencer":{"id":"distributed-sequencer","title":"Distributed Sequencer","description":"Kahuna\'s distributed sequencer enables clients to generate unique, sequential numbers. Clients can request sequences from either a single range or a pool of allowed ranges, ensuring flexibility in how numbers are allocated."},"dotnet-client":{"id":"dotnet-client","title":"Client for .NET","description":"Kahuna also provides a client tailored for .NET developers. This client simplifies the integration of distributed locking into your .NET applications by abstracting much of the underlying complexity. Documentation and samples for the client can be found in the docs/ folder or on our GitHub repository.","sidebar":"tutorialSidebar"},"getting-started":{"id":"getting-started","title":"Getting Started","description":"Kahuna is an open-source solution designed to provide robust coordination for modern","sidebar":"tutorialSidebar"},"intro":{"id":"intro","title":"Tutorial: Key/Value Store","description":"Kahuna provides the building blocks to construct distributed systems. The key/value store can be used to store configuration, service discoverability, metadata, caching, sessions, and more. In this tutorial, you will learn how it works.","sidebar":"tutorialSidebar"},"kahuna-cli":{"id":"kahuna-cli","title":"Kahuna CLI","description":"Kahuna CLI is an interactive command-line tool that allows sending commands, executing transactions in a Kahuna cluster and viewing the results.","sidebar":"tutorialSidebar"},"recipes/rate-limiting":{"id":"recipes/rate-limiting","title":"Rate Limiting","description":"Rate limiting is a mechanism that many developers may have to deal with at some point in their life. It\u2019s useful for a variety of purposes like sharing access to limited resources. The Fixed Window Counter is a simple algorithm used primarily for rate limiting\u2014controlling how many requests or actions a client can perform within a given period. Here\u2019s a breakdown of how it works and its key characteristics:"},"scripts":{"id":"scripts","title":"Scripts","description":"","sidebar":"tutorialSidebar"},"scripts/set":{"id":"scripts/set","title":"Set","description":"Allows to create or update a key/value in a persistent durable way.","sidebar":"tutorialSidebar"},"server-installation":{"id":"server-installation","title":"Server Installation","description":"If you want to run a Kahuna cluster on your local machine for testing and development, you need to have Docker up and running.","sidebar":"tutorialSidebar"},"storage/overview":{"id":"storage/overview","title":"Overview","description":""},"tutorials/distributed-locking":{"id":"tutorials/distributed-locking","title":"distributed-locking","description":"---","sidebar":"tutorialSidebar"}}}}')}}]);