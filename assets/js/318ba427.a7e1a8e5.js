"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[5843],{1469:(e,n,s)=>{s.r(n),s.d(n,{assets:()=>d,contentTitle:()=>a,default:()=>u,frontMatter:()=>o,metadata:()=>i,toc:()=>c});const i=JSON.parse('{"id":"distributed-keyvalue-store","title":"Distributed Key/Value Store","description":"A distributed key/value store is a type of database system designed to store, retrieve, and manage data across multiple nodes in a cluster or distributed environment. It follows a simple key-value data model, where keys are unique identifiers, and values are arbitrary byte stream associated data objects.","source":"@site/docs/distributed-keyvalue-store.md","sourceDirName":".","slug":"/distributed-keyvalue-store","permalink":"/docs/distributed-keyvalue-store","draft":false,"unlisted":false,"editUrl":"https://github.com/kahunakv/kahunakv.github.io/tree/main/docs/docs/distributed-keyvalue-store.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Fencing Tokens","permalink":"/docs/distributed-locks/fencing-tokens"},"next":{"title":"Compare-And-Swap (CAS)","permalink":"/docs/distributed-keyvalue-store/cas"}}');var t=s(4848),r=s(8453);const l=s.p+"assets/images/kahuna4-de7b70f462d6aa2e3f9acfb8bc785b3c.png",o={},a="Distributed Key/Value Store",d={},c=[{value:"Key Characteristics",id:"key-characteristics",level:2},{value:"Use Cases",id:"use-cases",level:2},{value:"Kahuna Distributed Store",id:"kahuna-distributed-store",level:2},{value:"Revisions",id:"revisions",level:2},{value:"API",id:"api",level:2},{value:"Set",id:"set",level:3},{value:"Compare-Value-And-Set (CVAS)",id:"compare-value-and-set-cvas",level:3},{value:"Compare-Revision-And-Set (CRAS)",id:"compare-revision-and-set-cras",level:3},{value:"Get",id:"get",level:3},{value:"Delete",id:"delete",level:3},{value:"Extend",id:"extend",level:3}];function h(e){const n={code:"code",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",ol:"ol",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,r.R)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.header,{children:(0,t.jsx)(n.h1,{id:"distributed-keyvalue-store",children:"Distributed Key/Value Store"})}),"\n",(0,t.jsx)("div",{style:{textAlign:"center"},children:(0,t.jsx)("img",{src:l,height:"350"})}),"\n",(0,t.jsxs)(n.p,{children:["A ",(0,t.jsx)(n.strong,{children:"distributed key/value store"})," is a type of ",(0,t.jsx)(n.strong,{children:"database system"})," designed to store, retrieve, and manage data across multiple nodes in a cluster or distributed environment. It follows a simple ",(0,t.jsx)(n.strong,{children:"key-value data model"}),", where ",(0,t.jsx)(n.strong,{children:"keys"})," are unique identifiers, and ",(0,t.jsx)(n.strong,{children:"values"})," are arbitrary byte stream associated data objects."]}),"\n",(0,t.jsx)(n.h2,{id:"key-characteristics",children:"Key Characteristics"}),"\n",(0,t.jsxs)(n.ol,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Scalability"})," \u2013 The system distributes data across multiple machines, allowing it to scale horizontally as demand increases. If the nodes are multi-processor, Kahuna can process multiple requests in parallel."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Fault Tolerance"})," \u2013 By replicating data across multiple nodes, it ensures resilience against failures."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"High Availability"})," \u2013 Data is accessible even if some nodes go offline, minimizing downtime."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Strong Consistency"})," \u2013 Ensures reliable data integrity using the ",(0,t.jsx)(n.strong,{children:"Raft consensus protocol"}),"."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Low Latency"})," \u2013 Optimized for fast read/write operations, making it ideal for caching, real-time applications and distributed computing."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Distributed Transactions"})," \u2013 Supports multi-node transactions with ",(0,t.jsx)(n.strong,{children:"Multi-Version Concurrency Control (MVCC)"}),", ",(0,t.jsx)(n.strong,{children:"Pessimistic/Optimistic Locking"}),", and ",(0,t.jsx)(n.strong,{children:"Two-Phase Commit (2PC)"})," for consistency across distributed operations."]}),"\n"]}),"\n",(0,t.jsx)(n.h2,{id:"use-cases",children:"Use Cases"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Configuration Management"})," \u2013 Storing dynamic settings for applications (e.g., feature flags)."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Metadata Storage"})," \u2013 Keeping track of distributed system metadata (e.g., leader election in Raft)."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Session Management"})," \u2013 Storing user sessions across distributed servers."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Caching"})," \u2013 Speeding up data access by storing frequently used data."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Distributed Coordination"})," \u2013 Managing distributed locks and leader election."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Transactional Workloads"})," \u2013 Ensuring atomicity and consistency across distributed transactions."]}),"\n"]}),"\n",(0,t.jsx)(n.h2,{id:"kahuna-distributed-store",children:"Kahuna Distributed Store"}),"\n",(0,t.jsxs)(n.p,{children:["In the context of ",(0,t.jsx)(n.strong,{children:"Kahuna"}),", its ",(0,t.jsx)(n.strong,{children:"distributed key/value store"})," capability allows applications to store and retrieve data efficiently, ensuring ",(0,t.jsx)(n.strong,{children:"strong consistency, high availability, and low latency"}),". Additionally, ",(0,t.jsx)(n.strong,{children:"Kahuna supports distributed transactions"}),", enabling applications to execute ",(0,t.jsx)(n.strong,{children:"atomic, consistent, isolated, and durable (ACID) operations"})," across multiple nodes. This is achieved using:"]}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Multi-Version Concurrency Control (MVCC)"})," \u2013 Allowing non-blocking reads and improved concurrency."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Pessimistic and Optimistic Locking"})," \u2013 Supporting different locking mechanisms to prevent conflicts in concurrent transactions."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Two-Phase Commit (2PC)"})," \u2013 Ensuring atomicity in distributed transactions across multiple nodes."]}),"\n"]}),"\n",(0,t.jsxs)(n.p,{children:["These features make Kahuna a great solution for small transactional workloads requiring ",(0,t.jsx)(n.strong,{children:"data integrity, consistency, and high availability"}),"."]}),"\n",(0,t.jsx)(n.h2,{id:"revisions",children:"Revisions"}),"\n",(0,t.jsx)(n.p,{children:"In Kahuna, a revision is a monotonic, ever-increasing number that represents the global order of modifications in the key-value store. Every time a change (write, delete, or transaction) occurs in Kahuna, the revision number increases, ensuring strong consistency and strict ordering of operations. Each revision is a 64-bit cluster-wide counter."}),"\n",(0,t.jsx)(n.h2,{id:"api",children:"API"}),"\n",(0,t.jsx)(n.p,{children:"Kahuna provides an API for performing various operations on key/value pairs."}),"\n",(0,t.jsx)(n.h3,{id:"set",children:"Set"}),"\n",(0,t.jsx)(n.p,{children:"Sets or overwrites key/value pairs. The behavior of the API is modified based on the provided flags, which determine whether the operation occurs depending on the key's existence, current value, or current revision."}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-csharp",children:"(bool Set, long Revision) TrySet(string key, byte[] value, Flags flags, Consistency consistency);\n"})}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"key:"})," A unique identifier for the key/value pair."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"value:"})," The data object associated with the key."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"expiresMs:"})," The expiration time of the key in milliseconds."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"flags:"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:["If ",(0,t.jsx)(n.code,{children:"Flags.SetIfExists"})," is specified, the value is set only if the key already exists."]}),"\n",(0,t.jsxs)(n.li,{children:["If ",(0,t.jsx)(n.code,{children:"Flags.SetIfNotExists"})," is specified, the value is set only if the key does not exist."]}),"\n"]}),"\n"]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"consistency:"})," Defines whether the key is ",(0,t.jsx)(n.strong,{children:"Ephemeral"})," or ",(0,t.jsx)(n.strong,{children:"Strongly Consistent"}),"."]}),"\n"]}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.strong,{children:"Returns:"})}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Set:"})," ",(0,t.jsx)(n.code,{children:"true"})," if the key's value was modified."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Revision:"})," A global counter indicating how many times the key has been modified."]}),"\n"]}),"\n",(0,t.jsx)(n.h3,{id:"compare-value-and-set-cvas",children:"Compare-Value-And-Set (CVAS)"}),"\n",(0,t.jsx)(n.p,{children:"Sets or overwrites key/value pairs, but only if the current value matches a specified comparison value."}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-csharp",children:"(bool Set, long Revision) TryCompareValueAndSet(string key, byte[] value, byte[] compareValue, Consistency consistency);\n"})}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"key:"})," A unique identifier for the key/value pair."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"value:"})," The data object associated with the key."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"compareValue:"})," If specified with ",(0,t.jsx)(n.code,{children:"Flags.SetIfEqualToValue"}),", the value is changed only if the current value matches the provided one."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"expiresMs:"})," The expiration time of the key in milliseconds."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"consistency:"})," Defines whether the key is ",(0,t.jsx)(n.strong,{children:"Ephemeral"})," or ",(0,t.jsx)(n.strong,{children:"Strongly Consistent"}),"."]}),"\n"]}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.strong,{children:"Returns:"})}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Set:"})," ",(0,t.jsx)(n.code,{children:"true"})," if the key's value was modified."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Revision:"})," A global counter indicating how many times the key has been modified."]}),"\n"]}),"\n",(0,t.jsx)(n.h3,{id:"compare-revision-and-set-cras",children:"Compare-Revision-And-Set (CRAS)"}),"\n",(0,t.jsx)(n.p,{children:"Sets or overwrites key/value pairs, but only if the current revision matches a specified comparison revision."}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-csharp",children:"(bool Set, long Revision) TryCompareRevisionAndSet(string key, byte[] value, long compareRevision, Consistency consistency);\n"})}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"key:"})," A unique identifier for the key/value pair."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"value:"})," The data object associated with the key."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"compareRevision:"})," If specified with ",(0,t.jsx)(n.code,{children:"Flags.SetIfEqualToRevision"}),", the value is changed only if the current revision matches the provided one."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"expiresMs:"})," The expiration time of the key in milliseconds."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"consistency:"})," Defines whether the key is ",(0,t.jsx)(n.strong,{children:"Ephemeral"})," or ",(0,t.jsx)(n.strong,{children:"Strongly Consistent"}),"."]}),"\n"]}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.strong,{children:"Returns:"})}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Set:"})," ",(0,t.jsx)(n.code,{children:"true"})," if the key's value was modified."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Revision:"})," A global counter indicating how many times the key has been modified."]}),"\n"]}),"\n",(0,t.jsx)(n.h3,{id:"get",children:"Get"}),"\n",(0,t.jsxs)(n.p,{children:["Retrieves the value of a key along with its revision. If the key does not exist, the special value ",(0,t.jsx)(n.code,{children:"nil"})," is returned."]}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-csharp",children:"(bool Found, byte[] Value, long Revision) TryGet(string key);\n"})}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"key:"})," A unique identifier for the key/value pair."]}),"\n"]}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.strong,{children:"Returns:"})}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Found:"})," ",(0,t.jsx)(n.code,{children:"true"})," if the key exists."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Value:"})," The value associated with the key."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Revision:"})," A global counter indicating how many times the key has been modified."]}),"\n"]}),"\n",(0,t.jsx)(n.h3,{id:"delete",children:"Delete"}),"\n",(0,t.jsx)(n.p,{children:"Deletes a key and its associated value."}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-csharp",children:"(bool Deleted, long Revision) TryDelete(string key);\n"})}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"key:"})," A unique identifier for the key/value pair."]}),"\n"]}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.strong,{children:"Returns:"})}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Deleted:"})," ",(0,t.jsx)(n.code,{children:"true"})," if the key/value pair was deleted."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Revision:"})," The global counter indicating how many times the key was modified at the time of deletion. Deleting a key does ",(0,t.jsx)(n.strong,{children:"not"})," increment the revision counter."]}),"\n"]}),"\n",(0,t.jsx)(n.h3,{id:"extend",children:"Extend"}),"\n",(0,t.jsx)(n.p,{children:"Extends a key timeout. The key will be deleted after the key expires."}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-csharp",children:"(bool Extended, long Revision) TryExtend(string key, int expiresMs);\n"})}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"key:"})," A unique identifier for the key/value pair."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"expiresMs:"})," The expiration time of the key in milliseconds."]}),"\n"]}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.strong,{children:"Returns:"})}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Extended:"})," ",(0,t.jsx)(n.code,{children:"true"})," if the key/value pair was deleted."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Revision:"})," The global counter indicating how many times the key was modified at the time of deletion. Extending the key does ",(0,t.jsx)(n.strong,{children:"not"})," increment the revision counter."]}),"\n"]})]})}function u(e={}){const{wrapper:n}={...(0,r.R)(),...e.components};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(h,{...e})}):h(e)}},8453:(e,n,s)=>{s.d(n,{R:()=>l,x:()=>o});var i=s(6540);const t={},r=i.createContext(t);function l(e){const n=i.useContext(r);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(t):e.components||t:l(e.components),i.createElement(r.Provider,{value:n},e.children)}}}]);