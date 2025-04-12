"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[5863],{8453:(e,i,t)=>{t.d(i,{R:()=>r,x:()=>o});var n=t(6540);const s={},a=n.createContext(s);function r(e){const i=n.useContext(a);return n.useMemo((function(){return"function"==typeof e?e(i):{...i,...e}}),[i,e])}function o(e){let i;return i=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:r(e.components),n.createElement(a.Provider,{value:i},e.children)}},9433:(e,i,t)=>{t.r(i),t.d(i,{assets:()=>c,contentTitle:()=>l,default:()=>u,frontMatter:()=>o,metadata:()=>n,toc:()=>d});const n=JSON.parse('{"id":"architecture/overview","title":"Architecture Overview","description":"Kahuna is designed to be scalable, consistent, and easy to use. Developers might wonder how this is achieved which is why this section aims to explain the key concepts behind Kahuna\u2019s architecture.","source":"@site/docs/architecture/overview.md","sourceDirName":"architecture","slug":"/architecture/overview","permalink":"/docs/architecture/overview","draft":false,"unlisted":false,"editUrl":"https://github.com/kahunakv/kahunakv.github.io/tree/main/docs/docs/architecture/overview.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Client for .NET","permalink":"/docs/dotnet-client"},"next":{"title":"Distributed Transactions","permalink":"/docs/architecture/distributed-transactions"}}');var s=t(4848),a=t(8453);const r=t.p+"assets/images/architecture-67fce41a232a20405e86ab14f385c7dd.png",o={},l="Architecture Overview",c={},d=[{value:"Goals of Kahuna",id:"goals-of-kahuna",level:2},{value:"Raft-Based Consensus",id:"raft-based-consensus",level:2},{value:"Scalability and Fault Tolerance",id:"scalability-and-fault-tolerance",level:2},{value:"Performance Optimizations",id:"performance-optimizations",level:2}];function h(e){const i={a:"a",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...(0,a.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(i.header,{children:(0,s.jsx)(i.h1,{id:"architecture-overview",children:"Architecture Overview"})}),"\n",(0,s.jsxs)(i.p,{children:["Kahuna is designed to be ",(0,s.jsx)(i.strong,{children:"scalable, consistent, and easy to use"}),". Developers might wonder how this is achieved which is why this section aims to explain the key concepts behind Kahuna\u2019s architecture."]}),"\n",(0,s.jsxs)(i.p,{children:["Kahuna's architecture operates as a highly scalable, fault-tolerant distributed system that combines ",(0,s.jsx)(i.a,{href:"../distributed-locks",children:"lock management"}),", ",(0,s.jsx)(i.a,{href:"../distributed-keyvalue-store",children:"key-value storage"}),", and ",(0,s.jsx)(i.a,{href:"../distributed-sequencer",children:"sequencing"})," capabilities. At its foundation lies a distributed key-value storage model where data is organized into discrete partitions similar to sharding mechanisms in other distributed systems. These ",(0,s.jsx)(i.strong,{children:"partitions function as independent units that can be distributed and managed"})," across the entire node cluster."]}),"\n",(0,s.jsx)("div",{style:{textAlign:"center"},children:(0,s.jsx)("img",{src:r,height:"350"})}),"\n",(0,s.jsxs)(i.p,{children:["In the previous diagram, we can see a cluster of three nodes named ",(0,s.jsx)(i.strong,{children:"Kahuna 1, 2, and 3."})," Each of these nodes shows the initial partitions available\u2014labeled ",(0,s.jsx)(i.strong,{children:"partition A, B, C, and D"}),". The leader of each partition is highlighted in dark gray. A ",(0,s.jsx)(i.strong,{children:"leader is responsible for processing reads and writes consistently"})," for its assigned partition."]}),"\n",(0,s.jsx)(i.p,{children:"With this small example, we can already observe some of the key characteristics of Kahuna's architecture:"}),"\n",(0,s.jsxs)(i.ul,{children:["\n",(0,s.jsxs)(i.li,{children:["\n",(0,s.jsxs)(i.p,{children:["It\u2019s possible to have multiple nodes (Kahuna 1, 2, and 3) in a cluster, each replicating the full database state. ",(0,s.jsx)(i.strong,{children:"Replication is synchronous via Raft, ensuring that any node can become the leader of a partition"})," if another node fails or becomes unavailable."]}),"\n"]}),"\n",(0,s.jsxs)(i.li,{children:["\n",(0,s.jsxs)(i.p,{children:["The ",(0,s.jsx)(i.strong,{children:"leader nodes for specific partitions are responsible for serving reads and writes in a serialized manner"}),", offering strong consistency. This guarantees that the value read by a client is the most recent and committed version."]}),"\n"]}),"\n",(0,s.jsxs)(i.li,{children:["\n",(0,s.jsxs)(i.p,{children:["With multiple partitions and distributed leadership across the cluster nodes, ",(0,s.jsx)(i.strong,{children:"Kahuna promotes optimal use of computing resources"}),". In other words, all nodes act as both primaries and secondaries at the same time."]}),"\n"]}),"\n",(0,s.jsxs)(i.li,{children:["\n",(0,s.jsxs)(i.p,{children:[(0,s.jsx)(i.strong,{children:"A client can contact any node for a read or write operation"}),". Internally, Kahuna nodes locate the leader of the appropriate partition transparently, so the client doesn\u2019t need to know where the leader is."]}),"\n"]}),"\n",(0,s.jsxs)(i.li,{children:["\n",(0,s.jsxs)(i.p,{children:["For on-disk storage, Kahuna leverages battle-tested embedded databases like RocksDB and SQLite, each with their own strengths. ",(0,s.jsx)(i.strong,{children:"Kahuna then acts as a distributed replication and high-level coordination layer built on top of these solid embedded storage engines"}),"."]}),"\n"]}),"\n"]}),"\n",(0,s.jsx)(i.p,{children:"Additionally, to make the system more scalable and optimize compute resource usage:"}),"\n",(0,s.jsxs)(i.ul,{children:["\n",(0,s.jsxs)(i.li,{children:[(0,s.jsx)(i.strong,{children:"New nodes"})," can be added to the cluster ",(0,s.jsx)(i.strong,{children:"on the fly"}),". These new nodes can eventually become leaders of partitions once they are caught up with the latest activity."]}),"\n",(0,s.jsxs)(i.li,{children:[(0,s.jsx)(i.strong,{children:"Nodes can be removed"})," from the cluster for maintenance or decommissioning. Leadership distribution is automatically rebalanced while maintaining consistency."]}),"\n",(0,s.jsxs)(i.li,{children:["A ",(0,s.jsx)(i.strong,{children:"general monitoring algorithm"})," tracks partition activity to determine if a partition is too large (based on a configured threshold) or experiencing too much activity (becoming a hotspot). When this happens, the partition is ",(0,s.jsx)(i.strong,{children:"split"})," into two, distributing its size and load across two available nodes in the cluster."]}),"\n"]}),"\n",(0,s.jsx)(i.h2,{id:"goals-of-kahuna",children:"Goals of Kahuna"}),"\n",(0,s.jsx)(i.p,{children:"Building distributed systems is hard, and many problems can involve edge cases that are extremely difficult to solve. Solutions are not always perfect for every scenario. Kahuna is designed to abstract much of this complexity by offering a simple and intuitive API, making it easier for developers to build and manage distributed applications."}),"\n",(0,s.jsx)(i.p,{children:"Kahuna is designed to address the following challenges:"}),"\n",(0,s.jsxs)(i.ul,{children:["\n",(0,s.jsxs)(i.li,{children:[(0,s.jsx)(i.strong,{children:"Offer a predictable and easy-to-use API for distributed locks"}),", including leases and fencing tokens, along with practical guidance for implementing mutual exclusion in distributed systems."]}),"\n",(0,s.jsxs)(i.li,{children:[(0,s.jsx)(i.strong,{children:"Provide a robust key/value system that prioritizes usability, data durability and consistency"}),". Additionally, it should offer a simple yet powerful interface for multi-key distributed transactions, while recognizing that some scenarios don\u2019t require durability and instead benefit from a high-performance ephemeral mode."]}),"\n",(0,s.jsxs)(i.li,{children:[(0,s.jsx)(i.strong,{children:"Propose a pragmatic distributed sequencing system"})," that gives developers a ready-made solution for generating unique, ordered values in a distributed environment."]}),"\n",(0,s.jsxs)(i.li,{children:[(0,s.jsx)(i.strong,{children:"Ensure strong data consistency, even in multi-node, multi-partition clusters"}),". Kahuna abstracts away the complexity of distributed key/value transactions and shields developers from issues like stale reads or inconsistent state."]}),"\n",(0,s.jsxs)(i.li,{children:[(0,s.jsx)(i.strong,{children:"Enable high availability, allowing any node in the cluster to accept reads and writes"}),". It also distributes load intelligently and minimizes downtime due to cluster topology changes."]}),"\n",(0,s.jsxs)(i.li,{children:["Developed in the C# programming language and the modern .NET platform, ",(0,s.jsx)(i.strong,{children:"Kahuna empowers developers to hack, extend, and customize the database to fit their specific needs"})," \u2014whether through configuration or plugin-based extensions. Additionally, it\u2019s built to run in a robust, multi-threaded environment that leverages all available CPU cores and computing power."]}),"\n",(0,s.jsxs)(i.li,{children:[(0,s.jsx)(i.strong,{children:"Reduce vendor lock-in"})," by being deployable in any environment or cloud provider."]}),"\n"]}),"\n",(0,s.jsx)(i.h2,{id:"raft-based-consensus",children:"Raft-Based Consensus"}),"\n",(0,s.jsxs)(i.p,{children:["Consensus across the distributed system is achieved through the ",(0,s.jsx)(i.strong,{children:"Raft"})," protocol, with ",(0,s.jsx)(i.strong,{children:"each partition in Kahuna being governed by its own Raft group"}),". This protocol ensures consistent replication of all changes across multiple nodes, thereby establishing the foundation for Kahuna's fault tolerance and high availability characteristics."]}),"\n",(0,s.jsx)(i.p,{children:"Within each Raft group, the consensus mechanism designates one node as the leader through an election process. This leader node coordinates all write operations for its assigned partition. To maintain consistency, all operations are recorded as log entries which are systematically replicated to follower nodes. This replication process ensures that data remains consistent across all nodes responsible for a particular partition."}),"\n",(0,s.jsx)(i.h2,{id:"scalability-and-fault-tolerance",children:"Scalability and Fault Tolerance"}),"\n",(0,s.jsx)(i.p,{children:"Horizontal scalability is achieved through dynamic partition management. Partitions can be automatically split and redistributed across nodes to achieve optimal load balancing. This architecture supports linear scalability as additional nodes are integrated into the cluster, allowing Kahuna to expand its capacity proportionally with infrastructure growth."}),"\n",(0,s.jsx)(i.p,{children:"High availability is ensured through Raft-based replication mechanisms. The system maintains operation even when individual nodes fail, as data remains accessible through replicas. Kahuna's recovery processes are designed to restore system integrity after failures without compromising committed transactions, maintaining both data consistency and service availability."}),"\n",(0,s.jsx)(i.h2,{id:"performance-optimizations",children:"Performance Optimizations"}),"\n",(0,s.jsx)(i.p,{children:"While Kahuna maintains strong consistency guarantees through the Raft protocol, it also incorporates various performance optimizations. Asynchronous replication techniques are employed where appropriate to enhance data replication efficiency and minimize read operation latency without sacrificing consistency requirements."}),"\n",(0,s.jsx)(i.p,{children:"Background maintenance processes continuously perform compaction and garbage collection operations to reclaim storage space and memory resources. These automated maintenance routines help preserve system performance by systematically removing obsolete data versions that are no longer needed for transaction isolation or recovery purposes."})]})}function u(e={}){const{wrapper:i}={...(0,a.R)(),...e.components};return i?(0,s.jsx)(i,{...e,children:(0,s.jsx)(h,{...e})}):h(e)}}}]);