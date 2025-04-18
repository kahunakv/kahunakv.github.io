"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[5936],{8453:(e,n,i)=>{i.d(n,{R:()=>a,x:()=>c});var t=i(6540);const s={},o=t.createContext(s);function a(e){const n=t.useContext(o);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function c(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:a(e.components),t.createElement(o.Provider,{value:n},e.children)}},9167:(e,n,i)=>{i.r(n),i.d(n,{assets:()=>r,contentTitle:()=>c,default:()=>u,frontMatter:()=>a,metadata:()=>t,toc:()=>l});const t=JSON.parse('{"id":"distributed-locks/fencing-tokens","title":"Fencing Tokens","description":"A fencing token is a monotonically increasing number (e.g., version number) issued every time a lock is acquired.","source":"@site/docs/distributed-locks/fencing-tokens.md","sourceDirName":"distributed-locks","slug":"/distributed-locks/fencing-tokens","permalink":"/docs/distributed-locks/fencing-tokens","draft":false,"unlisted":false,"editUrl":"https://github.com/kahunakv/kahunakv.github.io/tree/main/docs/distributed-locks/fencing-tokens.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Leases","permalink":"/docs/distributed-locks/leases"},"next":{"title":"Distributed Key/Value Store","permalink":"/docs/distributed-keyvalue-store"}}');var s=i(4848),o=i(8453);const a={},c="Fencing Tokens",r={},l=[{value:"Lock Acquisition:",id:"lock-acquisition",level:2},{value:"Using the Fencing Token:",id:"using-the-fencing-token",level:2},{value:"Handling Client Failures:",id:"handling-client-failures",level:2},{value:"Additional Recommendations:",id:"additional-recommendations",level:2}];function d(e){const n={h1:"h1",h2:"h2",header:"header",li:"li",p:"p",ul:"ul",...(0,o.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.header,{children:(0,s.jsx)(n.h1,{id:"fencing-tokens",children:"Fencing Tokens"})}),"\n",(0,s.jsx)(n.p,{children:"A fencing token is a monotonically increasing number (e.g., version number) issued every time a lock is acquired.\nIt acts as a logical timestamp to resolve stale client operations."}),"\n",(0,s.jsx)(n.p,{children:"How Leases + Fencing Tokens can provide Strong Mutual Exclusion:"}),"\n",(0,s.jsx)(n.h2,{id:"lock-acquisition",children:"Lock Acquisition:"}),"\n",(0,s.jsx)(n.p,{children:"A client tries to acquire a lock by creating a key in Kahuna (e.g., my-lock-resource) with a lease.\nAlong with the key, Kahuna maintains a fencing token \u2014 typically an incrementing counter."}),"\n",(0,s.jsx)(n.h2,{id:"using-the-fencing-token",children:"Using the Fencing Token:"}),"\n",(0,s.jsx)(n.p,{children:"When a client successfully acquires the lock, it receives the fencing token.\nAll downstream services that the client interacts with must validate the fencing token.\nThese services should reject any operation with a stale fencing token (i.e., a token lower than the highest one they've seen)."}),"\n",(0,s.jsx)(n.h2,{id:"handling-client-failures",children:"Handling Client Failures:"}),"\n",(0,s.jsx)(n.p,{children:"If a client pauses or crashes and its lease expires, Kahuna deletes the lock key.\nAnother client can now acquire the lock with a new lease and gets a higher fencing token.\nEven if the first client resumes and tries to perform actions, downstream systems will reject its operations because its fencing token is outdated."}),"\n",(0,s.jsx)(n.p,{children:"Example Flow:"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsx)(n.li,{children:"Client A acquires the lock with fencing token #5."}),"\n",(0,s.jsx)(n.li,{children:"Client A writes to a resource, passing #5."}),"\n",(0,s.jsx)(n.li,{children:"Client A experiences a network partition or pause."}),"\n",(0,s.jsx)(n.li,{children:"Kahuna lease expires, and Client B acquires the lock with fencing token #6."}),"\n",(0,s.jsx)(n.li,{children:"Client B writes to the same resource, passing #6."}),"\n",(0,s.jsx)(n.li,{children:"Client A comes back online and tries to write again with fencing token #5, but downstream systems reject it because they've already processed token #6."}),"\n"]}),"\n",(0,s.jsx)(n.h2,{id:"additional-recommendations",children:"Additional Recommendations:"}),"\n",(0,s.jsx)(n.p,{children:"Since long GC pauses or occasional poor network conditions can lead to situations where two processes believe they hold the same lock, it\u2019s important to follow these best practices:"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsx)(n.li,{children:"In clients built with garbage-collected languages and platforms, prioritize using concurrent or low-pause GC algorithms to avoid prolonged stop-the-world events that could delay lease renewals or lock releases."}),"\n",(0,s.jsx)(n.li,{children:"Use fencing tokens whenever possible to prevent conflicts and duplicate processing in cases where two clients mistakenly assume ownership of the same lock."}),"\n",(0,s.jsx)(n.li,{children:"Configure automatic lease expiration with a safety buffer that accounts for potential GC pauses, poor network conditions, retry delays, and temporary unavailability of external services."}),"\n"]})]})}function u(e={}){const{wrapper:n}={...(0,o.R)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(d,{...e})}):d(e)}}}]);