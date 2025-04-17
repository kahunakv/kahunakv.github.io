"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[9322],{8453:(e,t,n)=>{n.d(t,{R:()=>r,x:()=>a});var s=n(6540);const i={},o=s.createContext(i);function r(e){const t=s.useContext(o);return s.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function a(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:r(e.components),s.createElement(o.Provider,{value:t},e.children)}},8463:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>c,default:()=>u,frontMatter:()=>a,metadata:()=>s,toc:()=>d});const s=JSON.parse('{"id":"architecture/distributed-transactions","title":"Distributed Transactions","description":"Kahuna implements a robust distributed transaction system that combines multi-version concurrency control (MVCC), two-phase commit protocol, and Raft consensus to ensure data consistency and high availability across its distributed key-value store infrastructure.","source":"@site/docs/architecture/distributed-transactions.md","sourceDirName":"architecture","slug":"/architecture/distributed-transactions","permalink":"/docs/architecture/distributed-transactions","draft":false,"unlisted":false,"editUrl":"https://github.com/kahunakv/kahunakv.github.io/tree/main/docs/docs/architecture/distributed-transactions.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Architecture Overview","permalink":"/docs/architecture/overview"},"next":{"title":"Raft in Kahuna: Consensus and High Availability System","permalink":"/docs/architecture/raft"}}');var i=n(4848),o=n(8453);const r=n.p+"assets/images/architecture2-5359df06641ad3986dcb4fb11639bd36.png",a=(n.p,{}),c="Distributed Transactions",l={},d=[{value:"Types of Locking:",id:"types-of-locking",level:2},{value:"Pessimistic Locking",id:"pessimistic-locking",level:3},{value:"Optimistic Locking",id:"optimistic-locking",level:3},{value:"Key Buckets",id:"key-buckets",level:2},{value:"Concurrency Control and Versioning",id:"concurrency-control-and-versioning",level:2},{value:"Transaction Execution Protocol",id:"transaction-execution-protocol",level:2},{value:"Consensus and Replication Framework",id:"consensus-and-replication-framework",level:2},{value:"Conflict Resolution and Failure Management",id:"conflict-resolution-and-failure-management",level:2},{value:"Two-Phase Commit Implementation",id:"two-phase-commit-implementation",level:2}];function h(e){const t={a:"a",code:"code",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,o.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.header,{children:(0,i.jsx)(t.h1,{id:"distributed-transactions",children:"Distributed Transactions"})}),"\n",(0,i.jsx)(t.p,{children:"Kahuna implements a robust distributed transaction system that combines multi-version concurrency control (MVCC), two-phase commit protocol, and Raft consensus to ensure data consistency and high availability across its distributed key-value store infrastructure."}),"\n",(0,i.jsxs)(t.p,{children:["Let\u2019s look at the following ",(0,i.jsx)(t.a,{href:"../scripts",children:"Kahuna script"})," example, where we increment the maximum robots capacity per region as long as it doesn\u2019t exceed the global cap:"]}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-visual-basic",children:'let us1_amount = get robots_us1\nlet us2_amount = get robots_us2\nlet eu1_amount = get robots_eu1\nlet sa1_amount = get robots_sa1\n\nlet total = to_int(us1_amount) + to_int(us2_amount) + to_int(eu1_amount) + to_int(sa1_amount)\n\nif (total + @amount_to_incr) > @global_cap then\n    throw "global cap amount exceeded"\nend\n\nset robots_us1 us1_amount + @amount_to_incr\nset robots_us2 us2_amount + @amount_to_incr\nset robots_eu1 eu1_amount + @amount_to_incr\nset robots_sa1 sa1_amount + @amount_to_incr\n'})}),"\n",(0,i.jsxs)(t.p,{children:["The transaction coordinator, which is the node that receives the request to process the transaction, uses Consistent Hashing (CH) to determine the leader partitions responsible for the key/values involved in the transaction. As shown in this example, two of the keys belong to the node ",(0,i.jsx)(t.code,{children:"kahuna-2"}),", while ",(0,i.jsx)(t.code,{children:"kahuna-1"})," and ",(0,i.jsx)(t.code,{children:"kahuna-3"})," are leaders for one partition each:"]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)("img",{src:r,height:"350"})}),"\n",(0,i.jsx)(t.p,{children:"The transaction operates over 4 partitions distributed across 3 nodes, which means the Transaction Coordinator must ensure it reads from and applies changes across multiple nodes and partitions. While a multi-node transaction requires greater coordination between participants, this kind of distribution allows the computational load to be spread across multiple nodes, enabling parallel execution and improving overall system efficiency."}),"\n",(0,i.jsx)(t.h2,{id:"types-of-locking",children:"Types of Locking:"}),"\n",(0,i.jsx)(t.p,{children:"Kahuna supports two types of locking:"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.strong,{children:"Pessimistic Locking"}),": Locks on the keys involved in the transaction are acquired ",(0,i.jsx)(t.strong,{children:"exclusively in advance"}),", ensuring that no other clients can read or write those keys during the execution of the transaction. This prevents external inconsistencies and is particularly useful when there\u2019s ",(0,i.jsx)(t.strong,{children:"low contention"})," on the keys. It provides the ",(0,i.jsx)(t.strong,{children:"highest level of consistency and safety"}),". Other clients running concurrent transactions that encounter an already-acquired exclusive lock will be aborted and must retry until they can successfully perform their operations. This is the default locking method."]}),"\n"]}),"\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.strong,{children:"Optimistic Locking"}),": The keys involved are only locked ",(0,i.jsx)(t.strong,{children:"at the time of commit"}),". Other clients are allowed to read the data consistently. However, if a conflict is detected on any of the involved keys during the preparation phase, the transaction is ",(0,i.jsx)(t.strong,{children:"aborted"}),", and clients must retry. This strategy is ideal when there\u2019s ",(0,i.jsx)(t.strong,{children:"high read concurrency"})," and ",(0,i.jsx)(t.strong,{children:"low write contention"}),"."]}),"\n"]}),"\n"]}),"\n",(0,i.jsx)(t.h3,{id:"pessimistic-locking",children:"Pessimistic Locking"}),"\n",(0,i.jsxs)(t.p,{children:["Continuing with the previous example, here are the steps performed when the transaction is executed using ",(0,i.jsx)(t.strong,{children:"pessimistic locking"}),":"]}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.strong,{children:"Acquire exclusive locks on the keys in advance"}),". This prevents any reads or modifications on the keys during the transaction, ensuring consistency. If any of the keys cannot be exclusively locked, the transaction is aborted. These locks are tied to temporary ",(0,i.jsx)(t.strong,{children:"leases"})," to avoid being held indefinitely. In the example: ",(0,i.jsx)(t.strong,{children:"Exclusive locks"})," are acquired on: ",(0,i.jsx)(t.code,{children:"robots_us1"}),", ",(0,i.jsx)(t.code,{children:"robots_us2"}),", ",(0,i.jsx)(t.code,{children:"robots_eu1"}),", and ",(0,i.jsx)(t.code,{children:"robots_sa1"}),"."]}),"\n"]}),"\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.strong,{children:"Read the keys"}),". ",(0,i.jsx)(t.code,{children:"get"})," commands are executed. Kahuna identifies the opportunity to ",(0,i.jsx)(t.strong,{children:"parallelize"})," the 4 reads by batching the two that go to ",(0,i.jsx)(t.code,{children:"kahuna-2"})," and dispatching individual requests to ",(0,i.jsx)(t.code,{children:"kahuna-1"})," and ",(0,i.jsx)(t.code,{children:"kahuna-3"}),". In the example: The keys ",(0,i.jsx)(t.code,{children:"robots_us1"}),", ",(0,i.jsx)(t.code,{children:"robots_us2"}),", ",(0,i.jsx)(t.code,{children:"robots_eu1"}),", and ",(0,i.jsx)(t.code,{children:"robots_sa1"})," are ",(0,i.jsx)(t.strong,{children:"read"})," from their respective leader key/value stores."]}),"\n"]}),"\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.strong,{children:"Execute arithmetic operations and control structures"})," within the ",(0,i.jsx)(t.strong,{children:"transaction coordinator"}),", based on the read values. Any exception thrown, issue encountered, or failed validation will cause the transaction to be aborted, and no changes will be applied. In the example: the ",(0,i.jsx)(t.code,{children:"if"})," and mathematical operations are executed indicating the steps to follow."]}),"\n"]}),"\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.strong,{children:"Write phase"}),". In parallel, ",(0,i.jsx)(t.strong,{children:"write intents"})," are placed on the keys that were modified during the transaction. These intents represent the proposed new values but are not yet committed. In the example: The keys ",(0,i.jsx)(t.code,{children:"robots_us1"}),", ",(0,i.jsx)(t.code,{children:"robots_us2"}),", ",(0,i.jsx)(t.code,{children:"robots_eu1"}),", and ",(0,i.jsx)(t.code,{children:"robots_sa1"})," are ",(0,i.jsx)(t.strong,{children:"updated with provisional (intent) values"}),"."]}),"\n"]}),"\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.strong,{children:"Prepare"}),". As part of the ",(0,i.jsx)(t.strong,{children:"Two-Phase Commit (2PC)"})," protocol, the final proposed changes are sent to the involved partitions. Each must acknowledge they are ready to apply the changes. Once the transaction coordinator receives confirmation from all nodes, it proceeds to commit. If any problem or conflict is detected during this phase, the transaction is rolled back, ensuring that no partial modifications are persisted."]}),"\n"]}),"\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.strong,{children:"Commit"}),". Once all preparations succeed, the transaction coordinator instructs the participating nodes to proceed with the commit. The nodes apply the changes to their local key/value stores. In the example: The ",(0,i.jsx)(t.strong,{children:"provisional values"})," of ",(0,i.jsx)(t.code,{children:"robots_us1"}),", ",(0,i.jsx)(t.code,{children:"robots_us2"}),", ",(0,i.jsx)(t.code,{children:"robots_eu1"}),", and ",(0,i.jsx)(t.code,{children:"robots_sa1"})," are ",(0,i.jsx)(t.strong,{children:"applied"})," to the key/value store and to ",(0,i.jsx)(t.strong,{children:"durable storage"})," to make them persistent."]}),"\n"]}),"\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.strong,{children:"Release locks"}),". The exclusive locks acquired in the first step are released, allowing other transactions, reads, or writes to proceed. Locks are only released ",(0,i.jsx)(t.strong,{children:"after"})," the commit phase completes, ensuring that the new state becomes visible ",(0,i.jsx)(t.strong,{children:"atomically"})," across all partitions. In the example: The ",(0,i.jsx)(t.strong,{children:"exclusive locks"})," acquired on ",(0,i.jsx)(t.code,{children:"robots_us1"}),", ",(0,i.jsx)(t.code,{children:"robots_us2"}),", ",(0,i.jsx)(t.code,{children:"robots_eu1"}),", and ",(0,i.jsx)(t.code,{children:"robots_sa1"})," are ",(0,i.jsx)(t.strong,{children:"released"}),"."]}),"\n"]}),"\n"]}),"\n",(0,i.jsx)(t.h3,{id:"optimistic-locking",children:"Optimistic Locking"}),"\n",(0,i.jsxs)(t.p,{children:["If the example transaction were executed using ",(0,i.jsx)(t.strong,{children:"optimistic locking"}),", the following steps would be required:"]}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:["A ",(0,i.jsx)(t.strong,{children:"start transaction ID"})," is selected using the Hybrid-Logical Clock (HLC) at the transaction coordinator. This timestamp provides a globally ordered and causally consistent view of events across the cluster."]}),"\n"]}),"\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.strong,{children:"Read phase"}),":  The coordinator reads the keys ",(0,i.jsx)(t.code,{children:"robots_us1"}),", ",(0,i.jsx)(t.code,{children:"robots_us2"}),", ",(0,i.jsx)(t.code,{children:"robots_eu1"}),", and ",(0,i.jsx)(t.code,{children:"robots_sa1"})," from their respective leader partitions. These reads are consistent and versioned using Multi-Version Concurrency Control (MVCC), but ",(0,i.jsx)(t.strong,{children:"no locks are acquired"})," at this stage."]}),"\n"]}),"\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.strong,{children:"Execution phase"}),": All computations, validations, and control logic are performed at the ",(0,i.jsx)(t.strong,{children:"transaction coordinator"}),", based on the read values. The coordinator keeps track of the ",(0,i.jsx)(t.strong,{children:"versions"})," of each key at the time of reading."]}),"\n"]}),"\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.strong,{children:"Validation phase"}),": Before applying any changes, the coordinator checks that the versions of all involved keys have ",(0,i.jsx)(t.strong,{children:"not changed"})," since the initial read. A ",(0,i.jsx)(t.strong,{children:"commit transaction ID"})," is then generated to help detect conflicts with other transactions running in parallel. This commit ID is compared against the versions of the keys read during the transaction to ensure that no concurrent modifications have occurred before finalizing the commit. If any version mismatch is detected, the transaction is ",(0,i.jsx)(t.strong,{children:"aborted"})," and the client must ",(0,i.jsx)(t.strong,{children:"retry"}),". This step ensures that no other transaction has modified those keys in the meantime."]}),"\n"]}),"\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.strong,{children:"Write intents"}),": If all versions are validated successfully, ",(0,i.jsx)(t.strong,{children:"write intents"})," (proposed new values) are created for the modified keys. This step may involve contacting multiple partitions in parallel."]}),"\n"]}),"\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.strong,{children:"Prepare & Commit (2PC)"}),":\nSimilar to pessimistic locking, the coordinator initiates the ",(0,i.jsx)(t.strong,{children:"Two-Phase Commit"})," protocol:"]}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:["First, it sends the ",(0,i.jsx)(t.strong,{children:"prepare"})," command to all involved partitions."]}),"\n",(0,i.jsxs)(t.li,{children:["If all nodes confirm they are ready, the ",(0,i.jsx)(t.strong,{children:"commit"})," command is issued and values are applied durably to each key/value store."]}),"\n"]}),"\n"]}),"\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.strong,{children:"No explicit lock release is needed"}),", since no exclusive locks were acquired. Consistency is guaranteed through ",(0,i.jsx)(t.strong,{children:"version validation"})," before commit."]}),"\n"]}),"\n"]}),"\n",(0,i.jsxs)(t.p,{children:["This approach improves concurrency for ",(0,i.jsx)(t.strong,{children:"read-heavy workloads"})," but requires conflict detection and retry logic in the presence of contention."]}),"\n",(0,i.jsx)(t.h2,{id:"key-buckets",children:"Key Buckets"}),"\n",(0,i.jsxs)(t.p,{children:["In the previous example, we saw how a semi-random distribution of keys across different partitions\u2014based on consistent hashing helps distribute processing across multiple nodes, workers and partitions ",(0,i.jsx)(t.strong,{children:"to potentially take full advantage of the compute capacity"})," in the Kahuna cluster. However, a multi-node key distribution can increase the number of network round-trips required to complete the transaction. While Kahuna performs optimizations like batching and pipelining to reduce the impact of this, using Key Buckets can help enforce that all keys reside in the same partition and worker:"]}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-visual-basic",children:'let us1_amount = get `data-centers/robots_us1`\nlet us2_amount = get `data-centers/robots_us2`\nlet eu1_amount = get `data-centers/robots_eu1`\nlet sa1_amount = get `data-centers/robots_sa1`\n\nlet total = to_int(us1_amount) + to_int(us2_amount) + to_int(eu1_amount) + to_int(sa1_amount)\n\nif (total + @amount_to_incr) > @global_cap then\n    throw "global cap amount exceeded"\nend\n\nset `data-centers/robots_us1` us1_amount + @amount_to_incr\nset `data-centers/robots_us2` us2_amount + @amount_to_incr\nset `data-centers/robots_eu1` eu1_amount + @amount_to_incr\nset `data-centers/robots_sa1` sa1_amount + @amount_to_incr\n'})}),"\n",(0,i.jsxs)(t.p,{children:["By using a common key bucket like ",(0,i.jsx)(t.code,{children:"data-centers/"}),", you\u2019re telling Kahuna that ",(0,i.jsx)(t.strong,{children:"consistent hashing should be limited to the bucket rather than the full key"}),". This causes all keys under that bucket to be hashed together and routed to the same partition."]}),"\n",(0,i.jsx)(t.p,{children:"The new partition distribution would look like this:"}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)("img",{src:r,height:"350"})}),"\n",(0,i.jsxs)(t.p,{children:["This approach helps ",(0,i.jsx)(t.strong,{children:"ensure that related keys are co-located, reducing cross-partition communication and improving transaction performance"}),"."]}),"\n",(0,i.jsx)(t.h2,{id:"concurrency-control-and-versioning",children:"Concurrency Control and Versioning"}),"\n",(0,i.jsx)(t.p,{children:"Kahuna employs Multi-Version Concurrency Control (MVCC) as a foundational mechanism for optimistic transaction management. Through MVCC, Kahuna maintains multiple versions of each data item simultaneously, allowing transactions to access consistent snapshots of the database while concurrent write operations can proceed independently. This versioning approach effectively ensures transaction isolation without requiring extensive locking that would otherwise diminish performance."}),"\n",(0,i.jsx)(t.h2,{id:"transaction-execution-protocol",children:"Transaction Execution Protocol"}),"\n",(0,i.jsx)(t.p,{children:"Kahuna's transaction protocol follows a structured two-phase commit (2PC) approach:"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsx)(t.p,{children:"During the prewrite phase, the transaction coordinator assigns a unique timestamp to identify the transaction. This coordinator then orchestrates the prewrite process across all affected nodes. The system establishes locks on all keys involved in the transaction and creates tentative data versions reflecting the proposed changes. This preliminary stage ensures that all components are prepared for an atomic commit operation."}),"\n"]}),"\n",(0,i.jsxs)(t.li,{children:["\n",(0,i.jsx)(t.p,{children:"Once all prewrite operations complete successfully, the coordinator initiates the commit phase. The process begins by committing changes on leader nodes before propagating commit instructions to replica nodes. This ordered approach ensures consistency across the distributed system. If any node reports an issue during the prewrite phase, the coordinator initiates a comprehensive rollback to preserve transaction atomicity and system integrity."}),"\n"]}),"\n"]}),"\n",(0,i.jsx)(t.h2,{id:"consensus-and-replication-framework",children:"Consensus and Replication Framework"}),"\n",(0,i.jsx)(t.p,{children:"Raft consensus provides the foundation for Kahuna's replication and fault tolerance capabilities. Each node in the Kahuna cluster belongs to a Raft group that replicates data across multiple physical machines. This replication strategy preserves transaction state and data modifications even when individual nodes experience failures. The Raft protocol establishes agreement on operation ordering among all nodes, which is essential for maintaining consistent state across the distributed environment."}),"\n",(0,i.jsx)(t.h2,{id:"conflict-resolution-and-failure-management",children:"Conflict Resolution and Failure Management"}),"\n",(0,i.jsx)(t.p,{children:"Kahuna implements sophisticated mechanisms for handling concurrency issues and system failures:"}),"\n",(0,i.jsx)(t.p,{children:"The lock management system prevents conflicting operations by ensuring exclusive access to data items during transaction processing. Only one transaction can modify a particular data element at any given time, preventing write conflicts."}),"\n",(0,i.jsx)(t.p,{children:"When transactions cannot proceed due to conflicts or node failures, Kahuna's rollback mechanisms systematically reverse any prewritten changes. This cleanup process ensures the system remains in a consistent state despite interruptions or failures."}),"\n",(0,i.jsx)(t.h2,{id:"two-phase-commit-implementation",children:"Two-Phase Commit Implementation"}),"\n",(0,i.jsx)(t.p,{children:"The two-phase commit protocol serves as a critical component in Kahuna's distributed transaction system. This protocol ensures atomicity across multiple independent nodes through a structured approach:"}),"\n",(0,i.jsx)(t.p,{children:'In the first phase (Prepare or Pre-Commit), the node that receives the transaction request becomes the transaction coordinator. This coordinator dispatches prepare requests to all nodes participating in the transaction. Each Kahuna node responds by locking the necessary resources, often implementing this as a temporary key with an associated lease. Nodes that successfully prepare these resources respond with "Ready to Commit" confirmation.'}),"\n",(0,i.jsx)(t.p,{children:"During the second phase (Commit or Rollback), the coordinator evaluates the responses. If all nodes respond successfully, the coordinator issues commit requests to finalize the transaction. However, if any cluster reports a failure, the coordinator sends rollback instructions to all participants. This binary outcome ensures that either all updates succeed completely or none take effect, maintaining transaction atomicity across the distributed system."})]})}function u(e={}){const{wrapper:t}={...(0,o.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(h,{...e})}):h(e)}}}]);