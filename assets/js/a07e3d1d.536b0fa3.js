"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[2386],{1007:(e,n,s)=>{s.r(n),s.d(n,{assets:()=>c,contentTitle:()=>l,default:()=>h,frontMatter:()=>o,metadata:()=>i,toc:()=>d});const i=JSON.parse('{"id":"distributed-locks","title":"Distributed Locks","description":"A distributed lock is a mechanism that ensures that a specific resource is accessed by only one node or process at a time in a distributed environment. This is crucial when:","source":"@site/docs/distributed-locks.md","sourceDirName":".","slug":"/distributed-locks","permalink":"/docs/distributed-locks","draft":false,"unlisted":false,"editUrl":"https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/docs/distributed-locks.md","tags":[],"version":"current","sidebarPosition":3,"frontMatter":{"sidebar_position":3},"sidebar":"tutorialSidebar","previous":{"title":"Getting Started","permalink":"/docs/getting-started"},"next":{"title":"Leases","permalink":"/docs/distributed-locks/leases"}}');var r=s(4848),t=s(8453);const o={sidebar_position:3},l="Distributed Locks",c={},d=[{value:"Use Cases",id:"use-cases",level:2},{value:"API",id:"api",level:3},{value:"Lock",id:"lock",level:4},{value:"Unlock",id:"unlock",level:4},{value:"Extend",id:"extend",level:4}];function a(e){const n={code:"code",h1:"h1",h2:"h2",h3:"h3",h4:"h4",header:"header",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,t.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(n.header,{children:(0,r.jsx)(n.h1,{id:"distributed-locks",children:"Distributed Locks"})}),"\n",(0,r.jsx)(n.p,{children:"A distributed lock is a mechanism that ensures that a specific resource is accessed by only one node or process at a time in a distributed environment. This is crucial when:"}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Preventing race conditions:"})," Ensuring that multiple processes do not modify shared resources simultaneously."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Coordinating tasks:"})," Managing access to shared databases, files, or services across different nodes."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Maintaining data durability:"})," Guaranteeing that concurrent operations do not result in inconsistent states."]}),"\n"]}),"\n",(0,r.jsx)(n.p,{children:"By partitioning locks among nodes controlled by Raft Groups, Kahuna offers:"}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Reliability:"})," Raft consensus ensures that partition data remains consistent even in the face of network failures."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Simplicity:"})," A straightforward API based on leases makes it easy to integrate distributed locking into your applications."]}),"\n"]}),"\n",(0,r.jsx)(n.h2,{id:"use-cases",children:"Use Cases"}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Leader Election"}),': Elect a single leader in a cluster of services. Only one node should act as the leader at any time (e.g., for scheduling, replication). A distributed lock ensures only one process "wins" and holds the leadership.']}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Preventing Double Execution of Scheduled Jobs"}),": Ensure a cron job or background worker is executed only once across multiple nodes. In a horizontally scaled system, multiple nodes might try to run the same job. A distributed lock prevents multiple executions of the same scheduled task."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Safe Deployment / CI/CD Coordination"}),": Prevent multiple CI/CD pipelines from deploying the same environment simultaneously. Two deployment jobs could conflict and cause downtime. Use a lock to serialize deployments."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Database Migration Coordination"}),": Ensure that only one service performs schema migration at startup. If multiple services run migrate up concurrently, it may corrupt the schema. Use a lock to ensure only the first instance runs migrations."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Session Control / Login Exclusivity"}),": Allow only one active session per user. Used in banking apps, gaming, admin consoles, etc."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Distributed Queue Consumer Coordination"}),": Ensure that a message from a queue is only processed once, even with multiple consumers."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Throttling or Rate-Limiting Across Services"}),": Enforce a global rate limit across many service instances."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"External System Coordination"}),": Ensure only one node writes to an external system (e.g., shared database, billing API, payment gateway) to avoid double charges or inconsistent writes."]}),"\n"]}),"\n",(0,r.jsx)(n.h3,{id:"api",children:"API"}),"\n",(0,r.jsx)(n.p,{children:"Kahuna exposes a simple API for acquiring and releasing locks. The main functions are:"}),"\n",(0,r.jsx)(n.h4,{id:"lock",children:"Lock"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-csharp",children:"(bool Locked, long FencingToken) TryLock(string resource, string owner, int expiresMs, Durability durability);\n"})}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"resource:"})," The identifier for the resource you want to lock."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"owner:"})," A unique identifier for the lock, usually associated with the client or process requesting the lock."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"expiresMs:"})," The expiration time for the lock in milliseconds."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"durability:"})," Persistent or Ephemeral."]}),"\n"]}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Returns:"})}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Locked:"})," ",(0,r.jsx)(n.code,{children:"true"})," if the lock was successfully acquired."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"FencingToken:"})," A global counter indicating the number of times the lock has been acquired."]}),"\n"]}),"\n",(0,r.jsx)(n.h4,{id:"unlock",children:"Unlock"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-csharp",children:"(bool Unlocked) Unlock(string resource, string owner);\n"})}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"resource:"})," The identifier for the resource to unlock."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"owner:"})," The unique identifier for the lock previously used to acquire the lock."]}),"\n"]}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Returns:"})}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Unlocked:"})," ",(0,r.jsx)(n.code,{children:"false"})," if the resource was successfully unlocked."]}),"\n"]}),"\n",(0,r.jsx)(n.h4,{id:"extend",children:"Extend"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-csharp",children:"(bool Extended, long FencingToken) Extend(string resource, string owner, int expiresMs);\n"})}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"resource:"})," The identifier for the resource you want to extend."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"owner:"})," A unique identifier for the lock, usually associated with the client or process requesting the lock. It must be the current owner of the lock."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"expiresMs:"})," The expiration time for the lock in milliseconds."]}),"\n"]}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Returns:"})}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"Extended:"})," ",(0,r.jsx)(n.code,{children:"true"})," if the lock was successfully extended."]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"FencingToken:"})," A global counter indicating the number of times the lock has been acquired."]}),"\n"]})]})}function h(e={}){const{wrapper:n}={...(0,t.R)(),...e.components};return n?(0,r.jsx)(n,{...e,children:(0,r.jsx)(a,{...e})}):a(e)}},8453:(e,n,s)=>{s.d(n,{R:()=>o,x:()=>l});var i=s(6540);const r={},t=i.createContext(r);function o(e){const n=i.useContext(t);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function l(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:o(e.components),i.createElement(t.Provider,{value:n},e.children)}}}]);