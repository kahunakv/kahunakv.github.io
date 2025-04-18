"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[5843],{1469:(e,n,s)=>{s.r(n),s.d(n,{assets:()=>h,contentTitle:()=>d,default:()=>j,frontMatter:()=>o,metadata:()=>i,toc:()=>u});const i=JSON.parse('{"id":"distributed-keyvalue-store","title":"Distributed Key/Value Store","description":"A distributed key/value store is a type of database system designed to store, retrieve, and manage data across multiple nodes in a cluster or distributed environment. It follows a simple key-value data model, where keys are unique identifiers, and values are arbitrary byte stream associated data objects.","source":"@site/docs/distributed-keyvalue-store.md","sourceDirName":".","slug":"/distributed-keyvalue-store","permalink":"/docs/distributed-keyvalue-store","draft":false,"unlisted":false,"editUrl":"https://github.com/kahunakv/kahunakv.github.io/tree/main/docs/docs/distributed-keyvalue-store.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Fencing Tokens","permalink":"/docs/distributed-locks/fencing-tokens"},"next":{"title":"Compare-And-Swap (CAS)","permalink":"/docs/distributed-keyvalue-store/cas"}}');var r=s(4848),t=s(8453);const l=s.p+"assets/images/kahuna4-8d2c753219d601728d105c299240e3af.png";var a=s(5537),c=s(9329);const o={},d="Distributed Key/Value Store",h={},u=[{value:"Key Characteristics",id:"key-characteristics",level:2},{value:"Use Cases",id:"use-cases",level:2},{value:"Kahuna Distributed Store",id:"kahuna-distributed-store",level:2},{value:"Revisions",id:"revisions",level:2},{value:"API",id:"api",level:2},{value:"Set",id:"set",level:3},{value:"Compare-Value-And-Swap (CVAS)",id:"compare-value-and-swap-cvas",level:3},{value:"Compare-Revision-And-Swap (CRAS)",id:"compare-revision-and-swap-cras",level:3},{value:"Get",id:"get",level:3},{value:"Get Revision",id:"get-revision",level:3},{value:"Get By Prefix",id:"get-by-prefix",level:3},{value:"Scan By Prefix",id:"scan-by-prefix",level:3},{value:"Delete",id:"delete",level:3},{value:"Extend",id:"extend",level:3},{value:"Exists",id:"exists",level:3}];function x(e){const n={a:"a",code:"code",h1:"h1",h2:"h2",h3:"h3",header:"header",hr:"hr",li:"li",ol:"ol",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,t.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(n.header,{children:(0,r.jsx)(n.h1,{id:"distributed-keyvalue-store",children:"Distributed Key/Value Store"})}),"\n",(0,r.jsx)("div",{style:{textAlign:"center"},children:(0,r.jsx)("img",{src:l,height:"350"})}),"\n",(0,r.jsxs)(n.p,{children:["A ",(0,r.jsx)(n.strong,{children:"distributed key/value store"})," is a type of ",(0,r.jsx)(n.strong,{children:"database system"})," designed to store, retrieve, and manage data across multiple nodes in a cluster or distributed environment. It follows a simple ",(0,r.jsx)(n.strong,{children:"key-value data model"}),", where ",(0,r.jsx)(n.strong,{children:"keys"})," are unique identifiers, and ",(0,r.jsx)(n.strong,{children:"values"})," are arbitrary byte stream associated data objects."]}),"\n",(0,r.jsx)(n.h2,{id:"key-characteristics",children:"Key Characteristics"}),"\n",(0,r.jsxs)(n.ol,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Scalability"})," \u2013 The system distributes data across multiple machines, allowing it to scale horizontally as demand increases. If the nodes are multi-processor, Kahuna can process multiple requests in parallel."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Fault Tolerance"})," \u2013 By replicating data across multiple nodes, it ensures resilience against failures."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"High Availability"})," \u2013 Data is accessible even if some nodes go offline, minimizing downtime."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Strong Consistency"})," \u2013 Ensures reliable data integrity using the ",(0,r.jsx)(n.strong,{children:"Raft consensus protocol"}),"."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Low Latency"})," \u2013 Optimized for fast read/write operations, making it ideal for caching, real-time applications and distributed computing."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Distributed Transactions"})," \u2013 Supports multi-node transactions with ",(0,r.jsx)(n.strong,{children:"Multi-Version Concurrency Control (MVCC)"}),", ",(0,r.jsx)(n.strong,{children:"Pessimistic/Optimistic Locking"}),", and ",(0,r.jsx)(n.strong,{children:"Two-Phase Commit (2PC)"})," for consistency across distributed operations."]}),"\n"]}),"\n",(0,r.jsx)(n.h2,{id:"use-cases",children:"Use Cases"}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Configuration Management"})," \u2013 Storing dynamic settings for applications (e.g., feature flags)."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Metadata Storage"})," \u2013 Keeping track of distributed system metadata (e.g., leader election in Raft)."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Session Management"})," \u2013 Storing user sessions across distributed servers."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Caching"})," \u2013 Speeding up data access by storing frequently used data."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Distributed Coordination"})," \u2013 Managing distributed locks and leader election."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Transactional Workloads"})," \u2013 Ensuring atomicity and consistency across distributed transactions."]}),"\n"]}),"\n",(0,r.jsx)(n.h2,{id:"kahuna-distributed-store",children:"Kahuna Distributed Store"}),"\n",(0,r.jsxs)(n.p,{children:["In the context of ",(0,r.jsx)(n.strong,{children:"Kahuna"}),", its ",(0,r.jsx)(n.strong,{children:"distributed key/value store"})," capability allows applications to store and retrieve data efficiently, ensuring ",(0,r.jsx)(n.strong,{children:"strong consistency, high availability, and low latency"}),". Additionally, ",(0,r.jsx)(n.strong,{children:"Kahuna supports distributed transactions"}),", enabling applications to execute ",(0,r.jsx)(n.strong,{children:"atomic, consistent, isolated, and durable (ACID) operations"})," across multiple nodes. This is achieved using:"]}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Multi-Version Concurrency Control (MVCC)"})," \u2013 Allowing non-blocking reads and improved concurrency."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Pessimistic and Optimistic Locking"})," \u2013 Supporting different locking mechanisms to prevent conflicts in concurrent transactions."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Two-Phase Commit (2PC)"})," \u2013 Ensuring atomicity in distributed transactions across multiple nodes."]}),"\n"]}),"\n",(0,r.jsxs)(n.p,{children:["These features make Kahuna a great solution for small transactional workloads requiring ",(0,r.jsx)(n.strong,{children:"data integrity, consistency, and high availability"}),"."]}),"\n",(0,r.jsx)(n.h2,{id:"revisions",children:"Revisions"}),"\n",(0,r.jsxs)(n.p,{children:["In Kahuna, a ",(0,r.jsx)(n.a,{href:"distributed-keyvalue-store/revisions",children:"revision"})," is a monotonic, ever-increasing number that represents the global order of modifications in the key-value store. Every time a change (write, delete, or transaction) occurs in Kahuna, the revision number increases, ensuring strong consistency and strict ordering of operations. Each revision is a 64-bit cluster-wide counter."]}),"\n",(0,r.jsx)(n.h2,{id:"api",children:"API"}),"\n",(0,r.jsx)(n.p,{children:"Kahuna provides an API for performing various operations on key/value pairs:"}),"\n",(0,r.jsx)(n.h3,{id:"set",children:"Set"}),"\n",(0,r.jsx)(n.p,{children:"Sets or overwrites key/value pairs. The behavior of the API is modified based on the provided flags, which determine whether the operation occurs depending on the key's existence, current value, or current revision."}),"\n",(0,r.jsxs)(a.A,{children:[(0,r.jsxs)(c.A,{value:"API",children:[(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-csharp",children:"(bool Set, long Revision) TrySet(string key, byte[] value, Flags flags, Consistency consistency);\n"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"key:"})," A unique identifier for the key/value pair."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"value:"})," The data object associated with the key."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"expiresMs:"})," The expiration time of the key in milliseconds."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"flags:"}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:["If ",(0,r.jsx)(n.code,{children:"Flags.SetIfExists"})," is specified, the value is set only if the key already exists."]}),"\n",(0,r.jsxs)(n.li,{children:["If ",(0,r.jsx)(n.code,{children:"Flags.SetIfNotExists"})," is specified, the value is set only if the key does not exist."]}),"\n"]}),"\n"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"durability:"})," Defines whether the key durability is ",(0,r.jsx)(n.strong,{children:"Ephemeral"})," or ",(0,r.jsx)(n.strong,{children:"Persistent"}),"."]}),"\n"]}),(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Returns:"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Set:"})," ",(0,r.jsx)(n.code,{children:"true"})," if the key's value was modified."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Revision:"})," A global counter indicating how many times the key has been modified."]}),"\n"]})]}),(0,r.jsxs)(c.A,{value:"CLI",children:[(0,r.jsx)(n.p,{children:"Sets a key/value only if not exists:"}),(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli> set `my-config` "my-value" nx            \nr3 set 11ms\n'})}),(0,r.jsx)(n.p,{children:"Sets a key/value only if exists:"}),(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli> set `my-config` "my-value" xx      \nr4 set 10ms\n'})}),(0,r.jsx)(n.p,{children:"Sets a key/value:"}),(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli> set `my-config` "my-value"    \nr5 set 13ms\n'})}),(0,r.jsx)(n.p,{children:"Sets a key/value with an expiration of 10 sec:"}),(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli> set `my-config` "my-value" ex 10000\nr6 set 12ms\n'})}),(0,r.jsx)(n.p,{children:"Sets a key/value using command line arguments:"}),(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"~> kahuna-cli --set my-config --value my-value\nr3 set 11ms\n\n~> kahuna-cli --set my-config --value my-value --expires 30000\nr4 set 10ms\n"})})]}),(0,r.jsx)(c.A,{value:"C#",children:(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-csharp",children:'// Create or update a key/value pair and set an expiration of 10 seconds:\nvar result = await client.SetKeyValue(\n  "my-config", \n  "some-value", \n  10000, \n  durability: KeyValueDurability.Persistent \n);\n\nif (result.Success)\n  Console.WriteLine("Key/value updated successfully with revision {0}", result.Revision);\n\n// Update a key/value pair without expiration\nresult = await client.SetKeyValue(\n  "my-config", \n  "some-value", \n  0,   \n  durability: KeyValueDurability.Persistent \n);\n\n// Create a key/value pair only if it does not exist\nresult = await client.SetKeyValue(\n  "my-config", \n  "some-value", \n  0,   \n  flags: SetIfNotExists,\n  durability: KeyValueDurability.Persistent \n);\n\n// Update a key/value pair only if it does exist\nresult = await client.SetKeyValue(\n  "my-config", \n  "some-value", \n  0,   \n  flags: SetIfExists,\n  durability: KeyValueDurability.Persistent \n);\n\n// Create or update an ephemeral key/value pair\nresult = await client.SetKeyValue(\n  "my-config", \n  "some-value", \n  10000, \n  durability: KeyValueDurability.Ephemeral \n);\n\n'})})})]}),"\n",(0,r.jsx)(n.hr,{}),"\n",(0,r.jsx)(n.h3,{id:"compare-value-and-swap-cvas",children:"Compare-Value-And-Swap (CVAS)"}),"\n",(0,r.jsx)(n.p,{children:"Sets or overwrites key/value pairs but only if the current value matches a specified comparison value."}),"\n",(0,r.jsxs)(a.A,{children:[(0,r.jsxs)(c.A,{value:"API",children:[(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-csharp",children:"(bool Set, long Revision) TryCompareValueAndSet(string key, byte[] value, byte[] compareValue, Durability durability);\n"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"key:"})," A unique identifier for the key/value pair."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"value:"})," The data object associated with the key."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"compareValue:"})," The value is changed only if the current value matches the provided one."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"expiresMs:"})," The expiration time of the key in milliseconds."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"durability:"})," Defines whether the key durability is ",(0,r.jsx)(n.strong,{children:"Ephemeral"})," or ",(0,r.jsx)(n.strong,{children:"Persistent"}),"."]}),"\n"]}),(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Returns:"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Set:"})," ",(0,r.jsx)(n.code,{children:"true"})," if the key's value was modified."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Revision:"})," A global counter indicating how many times the key has been modified."]}),"\n"]})]}),(0,r.jsxs)(c.A,{value:"CLI",children:[(0,r.jsx)(n.p,{children:'Sets a key/value only if the current value is "current-value":'}),(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli> set `my-config` "current-value"\nr2 set 10ms\n\nkahuna-cli> set `my-config` "my-value" cmp "current-value"\nr3 set 11ms\n\nkahuna-cli> set `my-config` "my-value" cmp "current-value"\nr3 not set 12ms\n'})})]})]}),"\n",(0,r.jsx)(n.hr,{}),"\n",(0,r.jsx)(n.h3,{id:"compare-revision-and-swap-cras",children:"Compare-Revision-And-Swap (CRAS)"}),"\n",(0,r.jsx)(n.p,{children:"Sets or overwrites key/value pairs but only if the current revision matches a specified comparison revision."}),"\n",(0,r.jsxs)(a.A,{children:[(0,r.jsxs)(c.A,{value:"API",children:[(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-csharp",children:"(bool Set, long Revision) TryCompareRevisionAndSet(string key, byte[] value, long compareRevision, Durability durability);\n"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"key:"})," A unique identifier for the key/value pair."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"value:"})," The data object associated with the key."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"compareRevision:"})," The value is changed only if the current revision matches the provided one."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"expiresMs:"})," The expiration time of the key in milliseconds."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"durability:"})," Defines whether the key durability is ",(0,r.jsx)(n.strong,{children:"Ephemeral"})," or ",(0,r.jsx)(n.strong,{children:"Persistent"}),"."]}),"\n"]}),(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Returns:"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Set:"})," ",(0,r.jsx)(n.code,{children:"true"})," if the key's value was modified."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Revision:"})," A global counter indicating how many times the key has been modified."]}),"\n"]})]}),(0,r.jsxs)(c.A,{value:"CLI",children:[(0,r.jsxs)(n.p,{children:["Sets a key/value only if the current value is the current revision is ",(0,r.jsx)(n.strong,{children:"4"}),":"]}),(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli> set `my-config` "my-value"\nr4 set 12ms\n\nkahuna-cli> set `my-config` "my-value" cmprev 4\nr5 set 11ms\n\nkahuna-cli> set `my-config` "other-value" cmprev 4\nr5 not set 10ms\n'})})]})]}),"\n",(0,r.jsx)(n.hr,{}),"\n",(0,r.jsx)(n.h3,{id:"get",children:"Get"}),"\n",(0,r.jsxs)(n.p,{children:["Retrieves the value of a key along with its revision. If the key does not exist, the special value ",(0,r.jsx)(n.code,{children:"nil"})," is returned."]}),"\n",(0,r.jsxs)(a.A,{children:[(0,r.jsxs)(c.A,{value:"API",children:[(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-csharp",children:"(bool Found, byte[] Value, long Revision) TryGet(string key, Durability durability);\n"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"key:"})," The key to be queried."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"durability:"})," Defines whether the key durability is ",(0,r.jsx)(n.strong,{children:"Ephemeral"})," or ",(0,r.jsx)(n.strong,{children:"Persistent"}),"."]}),"\n"]}),(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Returns:"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Found:"})," ",(0,r.jsx)(n.code,{children:"true"})," if the key exists."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Value:"})," The value associated with the key."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Revision:"})," A global counter indicating how many times the key has been modified."]}),"\n"]})]}),(0,r.jsxs)(c.A,{value:"CLI",children:[(0,r.jsx)(n.p,{children:"Gets key/values:"}),(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli> get `my-config`\nr-1 not found 12ms\n\nkahuna-cli> set `my-config` "my-value"\nr0 set 11ms\n\nkahuna-cli> get `my-config`\nr0 my-value 13ms\n'})})]}),(0,r.jsxs)(c.A,{value:"C#",children:[(0,r.jsx)(n.p,{children:"Gets key/value pair:"}),(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-csharp",children:'var result = await client.GetKeyValue(\n  "my-config",   \n  KeyValueDurability.Persistent \n);\n\nif (result.Success)\n{\n  Console.WriteLine("Value: {0}", result.ValueAsString());\n  Console.WriteLine("Revision: {0}", result.Revision);\n}\n'})})]})]}),"\n",(0,r.jsx)(n.hr,{}),"\n",(0,r.jsx)(n.h3,{id:"get-revision",children:"Get Revision"}),"\n",(0,r.jsxs)(n.p,{children:["Retrieves the value of a key at the specific revision. If the key/revision combination does not exist in the key/value store, the special value ",(0,r.jsx)(n.code,{children:"nil"})," is returned."]}),"\n",(0,r.jsxs)(a.A,{children:[(0,r.jsxs)(c.A,{value:"API",children:[(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-csharp",children:"(bool Found, byte[] Value, long Revision) TryGetRevision(string key, long revision, Durability durability);\n"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"key:"})," The key to be queried."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"revision:"})," The revision to be returned."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"durability:"})," Defines whether the key durability is ",(0,r.jsx)(n.strong,{children:"Ephemeral"})," or ",(0,r.jsx)(n.strong,{children:"Persistent"}),"."]}),"\n"]}),(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Returns:"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Found:"})," ",(0,r.jsx)(n.code,{children:"true"})," if the key exists."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Value:"})," The value associated with the key."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Revision:"})," The queried revision."]}),"\n"]})]}),(0,r.jsxs)(c.A,{value:"CLI",children:[(0,r.jsx)(n.p,{children:"Gets key/values:"}),(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli> set `my-config` "my-value"\nr0 set 11ms\n\nkahuna-cli> set `my-config` "my-value-1"\nr1 set 12ms\n\nkahuna-cli> set `my-config` "my-value-3"\nr2 set 15ms\n\nkahuna-cli> get `my-config` at 0\nr0 my-value 13ms\n\nkahuna-cli> get `my-config` at 1\nr0 my-value-1 13ms\n'})})]})]}),"\n",(0,r.jsx)(n.hr,{}),"\n",(0,r.jsx)(n.h3,{id:"get-by-prefix",children:"Get By Prefix"}),"\n",(0,r.jsx)(n.p,{children:"Retrieves the key/value pairs that share the same prefix. The key/value pairs are returned in a consistent way if a common bucket is passed as prefix."}),"\n",(0,r.jsxs)(a.A,{children:[(0,r.jsxs)(c.A,{value:"API",children:[(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-csharp",children:"(KeyValuePair[]) GetByPrefix(string prefix, Durability durability);\n"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"key:"})," The key to be queried."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"revision:"})," The revision to be returned."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"durability:"})," Defines whether the keys durability is ",(0,r.jsx)(n.strong,{children:"Ephemeral"})," or ",(0,r.jsx)(n.strong,{children:"Persistent"}),"."]}),"\n"]}),(0,r.jsxs)(n.p,{children:[(0,r.jsx)(n.strong,{children:"Returns:"}),"\n",(0,r.jsx)(n.strong,{children:"KeyValuePair:"})]}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Key:"})," The key found."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Value:"})," The value associated with the key."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Revision:"})," The current revision of the key."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Expires:"})," The unix timestamp in milliseconds when the key will expire."]}),"\n"]})]}),(0,r.jsxs)(c.A,{value:"CLI",children:[(0,r.jsx)(n.p,{children:"Get key/values by prefix:"}),(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-visual-basic",children:"$ kahuna-cli --set services/auth/instance-1 --value node1\nr0 set 11ms\n\n$ kahuna-cli --set services/auth/instance-2 --value node2\nr0 set 10ms\n\n$ kahuna-cli --get-by-prefix services/auth\nr0 services/auth/instance-1 node1\nr0 services/auth/instance-2 node2\n"})})]})]}),"\n",(0,r.jsx)(n.hr,{}),"\n",(0,r.jsx)(n.h3,{id:"scan-by-prefix",children:"Scan By Prefix"}),"\n",(0,r.jsx)(n.p,{children:"Scan all nodes in the cluster searching for key/value pairs where the key start with the specified prefix. The key/value pairs data are taken from the moment\nthe node is visited. It can contain stale data. This API is slow because it scans all nodes and internal workers for keys."}),"\n",(0,r.jsx)(a.A,{children:(0,r.jsxs)(c.A,{value:"API",children:[(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-csharp",children:"(KeyValuePair[]) ScanByPrefix(string prefix, Durability durability);\n"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"key:"})," The key to be queried."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"revision:"})," The revision to be returned."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"durability:"})," Defines whether the keys durability is ",(0,r.jsx)(n.strong,{children:"Ephemeral"})," or ",(0,r.jsx)(n.strong,{children:"Persistent"}),"."]}),"\n"]}),(0,r.jsxs)(n.p,{children:[(0,r.jsx)(n.strong,{children:"Returns:"}),"\n",(0,r.jsx)(n.strong,{children:"KeyValuePair:"})]}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Key:"})," The key found."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Value:"})," The value associated with the key."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Revision:"})," The current revision of the key."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Expires:"})," The unix timestamp in milliseconds when the key will expire."]}),"\n"]})]})}),"\n",(0,r.jsx)(n.hr,{}),"\n",(0,r.jsx)(n.h3,{id:"delete",children:"Delete"}),"\n",(0,r.jsx)(n.p,{children:"Deletes a key and its associated value. Deleting a key does not remove the key history."}),"\n",(0,r.jsx)(a.A,{children:(0,r.jsxs)(c.A,{value:"API",children:[(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-csharp",children:"(bool Deleted, long Revision) TryDelete(string key, Durability durability);\n"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"key:"})," The key to be deleted."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"durability:"})," Defines whether the key durability is ",(0,r.jsx)(n.strong,{children:"Ephemeral"})," or ",(0,r.jsx)(n.strong,{children:"Persistent"}),"."]}),"\n"]}),(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Returns:"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Deleted:"})," ",(0,r.jsx)(n.code,{children:"true"})," if the key/value pair was deleted."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Revision:"})," The global counter indicating how many times the key was modified at the time of deletion. Deleting a key does ",(0,r.jsx)(n.strong,{children:"not"})," increment the revision counter."]}),"\n"]})]})}),"\n",(0,r.jsx)(n.hr,{}),"\n",(0,r.jsx)(n.h3,{id:"extend",children:"Extend"}),"\n",(0,r.jsx)(n.p,{children:"Extends a key timeout. The key will be deleted after the key expires. If the expiration is 0 the key will not be expired or removed."}),"\n",(0,r.jsxs)(a.A,{children:[(0,r.jsxs)(c.A,{value:"API",children:[(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-csharp",children:"(bool Extended, long Revision) TryExtend(string key, int expiresMs, Durability durability);\n"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"key:"})," The key to be extended."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"expiresMs:"})," The expiration time of the key in milliseconds."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"durability:"})," Defines whether the key durability is ",(0,r.jsx)(n.strong,{children:"Ephemeral"})," or ",(0,r.jsx)(n.strong,{children:"Persistent"}),"."]}),"\n"]}),(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Returns:"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Extended:"})," ",(0,r.jsx)(n.code,{children:"true"})," if the key/value pair was extended."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Revision:"})," The global counter indicating how many times the key was modified at the time of deletion. Extending the key does ",(0,r.jsx)(n.strong,{children:"not"})," increment the revision counter."]}),"\n"]})]}),(0,r.jsxs)(c.A,{value:"CLI",children:[(0,r.jsx)(n.p,{children:"Exists key/values:"}),(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli> set `my-config` "my-value" ex 10000\nr0 set 11ms\n\nkahuna-cli> extend `my-config` 30000\nr0 exteded 13ms\n'})})]})]}),"\n",(0,r.jsx)(n.hr,{}),"\n",(0,r.jsx)(n.h3,{id:"exists",children:"Exists"}),"\n",(0,r.jsx)(n.p,{children:"Returns if a key exists."}),"\n",(0,r.jsxs)(a.A,{children:[(0,r.jsxs)(c.A,{value:"API",children:[(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-csharp",children:"(bool Exists, long Revision) Exists(string key, Durability durability);\n"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"key:"})," The key to be checked if exists."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"durability:"})," Defines whether the key durability is ",(0,r.jsx)(n.strong,{children:"Ephemeral"})," or ",(0,r.jsx)(n.strong,{children:"Persistent"}),"."]}),"\n"]}),(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Returns:"})}),(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Exists:"})," ",(0,r.jsx)(n.code,{children:"true"})," if the key/value pair exists."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Revision:"})," The global counter indicating how many times the key was modified at the time of the query."]}),"\n"]})]}),(0,r.jsxs)(c.A,{value:"CLI",children:[(0,r.jsx)(n.p,{children:"Exists key/values:"}),(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli> exists `my-config`\nr-1 not found 12ms\n\nkahuna-cli> set `my-config` "my-value"\nr0 set 11ms\n\nkahuna-cli> exists `my-config`\nr0 exists 13ms\n'})})]})]})]})}function j(e={}){const{wrapper:n}={...(0,t.R)(),...e.components};return n?(0,r.jsx)(n,{...e,children:(0,r.jsx)(x,{...e})}):x(e)}},5537:(e,n,s)=>{s.d(n,{A:()=>k});var i=s(6540),r=s(4164),t=s(5627),l=s(6347),a=s(372),c=s(604),o=s(1861),d=s(8749);function h(e){return i.Children.toArray(e).filter((e=>"\n"!==e)).map((e=>{if(!e||(0,i.isValidElement)(e)&&function(e){const{props:n}=e;return!!n&&"object"==typeof n&&"value"in n}(e))return e;throw new Error(`Docusaurus error: Bad <Tabs> child <${"string"==typeof e.type?e.type:e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`)}))?.filter(Boolean)??[]}function u(e){const{values:n,children:s}=e;return(0,i.useMemo)((()=>{const e=n??function(e){return h(e).map((e=>{let{props:{value:n,label:s,attributes:i,default:r}}=e;return{value:n,label:s,attributes:i,default:r}}))}(s);return function(e){const n=(0,o.XI)(e,((e,n)=>e.value===n.value));if(n.length>0)throw new Error(`Docusaurus error: Duplicate values "${n.map((e=>e.value)).join(", ")}" found in <Tabs>. Every value needs to be unique.`)}(e),e}),[n,s])}function x(e){let{value:n,tabValues:s}=e;return s.some((e=>e.value===n))}function j(e){let{queryString:n=!1,groupId:s}=e;const r=(0,l.W6)(),t=function(e){let{queryString:n=!1,groupId:s}=e;if("string"==typeof n)return n;if(!1===n)return null;if(!0===n&&!s)throw new Error('Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".');return s??null}({queryString:n,groupId:s});return[(0,c.aZ)(t),(0,i.useCallback)((e=>{if(!t)return;const n=new URLSearchParams(r.location.search);n.set(t,e),r.replace({...r.location,search:n.toString()})}),[t,r])]}function y(e){const{defaultValue:n,queryString:s=!1,groupId:r}=e,t=u(e),[l,c]=(0,i.useState)((()=>function(e){let{defaultValue:n,tabValues:s}=e;if(0===s.length)throw new Error("Docusaurus error: the <Tabs> component requires at least one <TabItem> children component");if(n){if(!x({value:n,tabValues:s}))throw new Error(`Docusaurus error: The <Tabs> has a defaultValue "${n}" but none of its children has the corresponding value. Available values are: ${s.map((e=>e.value)).join(", ")}. If you intend to show no default tab, use defaultValue={null} instead.`);return n}const i=s.find((e=>e.default))??s[0];if(!i)throw new Error("Unexpected error: 0 tabValues");return i.value}({defaultValue:n,tabValues:t}))),[o,h]=j({queryString:s,groupId:r}),[y,g]=function(e){let{groupId:n}=e;const s=function(e){return e?`docusaurus.tab.${e}`:null}(n),[r,t]=(0,d.Dv)(s);return[r,(0,i.useCallback)((e=>{s&&t.set(e)}),[s,t])]}({groupId:r}),v=(()=>{const e=o??y;return x({value:e,tabValues:t})?e:null})();(0,a.A)((()=>{v&&c(v)}),[v]);return{selectedValue:l,selectValue:(0,i.useCallback)((e=>{if(!x({value:e,tabValues:t}))throw new Error(`Can't select invalid tab value=${e}`);c(e),h(e),g(e)}),[h,g,t]),tabValues:t}}var g=s(9136);const v={tabList:"tabList__CuJ",tabItem:"tabItem_LNqP"};var m=s(4848);function p(e){let{className:n,block:s,selectedValue:i,selectValue:l,tabValues:a}=e;const c=[],{blockElementScrollPositionUntilNextRender:o}=(0,t.a_)(),d=e=>{const n=e.currentTarget,s=c.indexOf(n),r=a[s].value;r!==i&&(o(n),l(r))},h=e=>{let n=null;switch(e.key){case"Enter":d(e);break;case"ArrowRight":{const s=c.indexOf(e.currentTarget)+1;n=c[s]??c[0];break}case"ArrowLeft":{const s=c.indexOf(e.currentTarget)-1;n=c[s]??c[c.length-1];break}}n?.focus()};return(0,m.jsx)("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,r.A)("tabs",{"tabs--block":s},n),children:a.map((e=>{let{value:n,label:s,attributes:t}=e;return(0,m.jsx)("li",{role:"tab",tabIndex:i===n?0:-1,"aria-selected":i===n,ref:e=>{c.push(e)},onKeyDown:h,onClick:d,...t,className:(0,r.A)("tabs__item",v.tabItem,t?.className,{"tabs__item--active":i===n}),children:s??n},n)}))})}function f(e){let{lazy:n,children:s,selectedValue:t}=e;const l=(Array.isArray(s)?s:[s]).filter(Boolean);if(n){const e=l.find((e=>e.props.value===t));return e?(0,i.cloneElement)(e,{className:(0,r.A)("margin-top--md",e.props.className)}):null}return(0,m.jsx)("div",{className:"margin-top--md",children:l.map(((e,n)=>(0,i.cloneElement)(e,{key:n,hidden:e.props.value!==t})))})}function b(e){const n=y(e);return(0,m.jsxs)("div",{className:(0,r.A)("tabs-container",v.tabList),children:[(0,m.jsx)(p,{...n,...e}),(0,m.jsx)(f,{...n,...e})]})}function k(e){const n=(0,g.A)();return(0,m.jsx)(b,{...e,children:h(e.children)},String(n))}},8453:(e,n,s)=>{s.d(n,{R:()=>l,x:()=>a});var i=s(6540);const r={},t=i.createContext(r);function l(e){const n=i.useContext(t);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function a(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:l(e.components),i.createElement(t.Provider,{value:n},e.children)}},9329:(e,n,s)=>{s.d(n,{A:()=>l});s(6540);var i=s(4164);const r={tabItem:"tabItem_Ymn6"};var t=s(4848);function l(e){let{children:n,hidden:s,className:l}=e;return(0,t.jsx)("div",{role:"tabpanel",className:(0,i.A)(r.tabItem,l),hidden:s,children:n})}}}]);