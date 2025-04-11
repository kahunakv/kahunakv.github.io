"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[6903],{1120:(e,n,a)=>{a.r(n),a.d(n,{assets:()=>l,contentTitle:()=>c,default:()=>u,frontMatter:()=>o,metadata:()=>s,toc:()=>d});const s=JSON.parse('{"id":"intro","title":"Tutorial: Key/Value Store","description":"Kahuna provides building blocks to help construct distributed systems. The key/value store can be used to store configuration, service discoverability,","source":"@site/docs/intro.mdx","sourceDirName":".","slug":"/intro","permalink":"/docs/intro","draft":false,"unlisted":false,"editUrl":"https://github.com/kahunakv/kahunakv.github.io/tree/main/docs/docs/intro.mdx","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","next":{"title":"Tutorial: Distributing Locking","permalink":"/docs/tutorials/distributed-locking"}}');var t=a(4848),i=a(8453);const r=a.p+"assets/images/kahuna1-0ec800e36b72ba8f30d7446f5c9ea974.png",o={},c="Tutorial: Key/Value Store",l={},d=[{value:"Starting Kahuna",id:"starting-kahuna",level:2},{value:"Setting and Retrieving Keys",id:"setting-and-retrieving-keys",level:2},{value:"Expiration",id:"expiration",level:2},{value:"Durability",id:"durability",level:2},{value:"Revisions",id:"revisions",level:2},{value:"Compare And Swap (CAS)",id:"compare-and-swap-cas",level:2},{value:"Scripts and Transactions",id:"scripts-and-transactions",level:2}];function h(e){const n={a:"a",code:"code",h1:"h1",h2:"h2",header:"header",p:"p",pre:"pre",strong:"strong",...(0,i.R)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.header,{children:(0,t.jsx)(n.h1,{id:"tutorial-keyvalue-store",children:"Tutorial: Key/Value Store"})}),"\n",(0,t.jsx)("div",{style:{textAlign:"center"},children:(0,t.jsx)("img",{src:r,height:"350"})}),"\n",(0,t.jsxs)(n.p,{children:["Kahuna provides building blocks to help construct distributed systems. The ",(0,t.jsx)(n.strong,{children:"key/value store"})," can be used to store ",(0,t.jsx)(n.strong,{children:"configuration, service discoverability,\nmetadata, caching, sessions, and more"}),". In this tutorial, you will learn how it works."]}),"\n",(0,t.jsx)(n.h2,{id:"starting-kahuna",children:"Starting Kahuna"}),"\n",(0,t.jsxs)(n.p,{children:["Before you proceed, make sure that Kahuna is running on your system. Refer to the ",(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:"server-installation",children:"Server Installation"})})," section for instructions.\nYou will also need the ",(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:"kahuna-cli",children:"Kahuna CLI"})})," to execute commands on the server."]}),"\n",(0,t.jsx)(n.p,{children:"After installing the necessary components, run the following command:"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-bash",children:"~> kahuna-cli --version\n"})}),"\n",(0,t.jsx)(n.h2,{id:"setting-and-retrieving-keys",children:"Setting and Retrieving Keys"}),"\n",(0,t.jsx)(n.p,{children:"Within the Kahuna CLI, you can execute commands, transactions, and scripts. Use the following format to set and retrieve key/value pairs:"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-visual-basic",children:'~> kahuna-cli\nKahuna Shell 0.0.1 (alpha)\n\nkahuna-cli> set myconfig "my-value"\nr0 set 9ms\n\nkahuna-cli> get myconfig\nr0 my-value 7ms\n\nkahuna-cli> set myconfig "my-value-2"\nr1 set 7ms\n\nkahuna-cli> get myconfig\nr1 my-value-2 6ms\n'})}),"\n",(0,t.jsxs)(n.p,{children:["The ",(0,t.jsx)(n.code,{children:"set"})," command stores key/value pairs durably in the cluster. Internally, the system uses consistent hashing to redirect the request to the leader\nnode of the corresponding Raft group, which coordinates the operation, achieves consensus, and ensures durable storage and replication. The ",(0,t.jsx)(n.code,{children:"get"}),"\ncommand retrieves the most recent value consistently from the appropriate leader node."]}),"\n",(0,t.jsx)(n.h2,{id:"expiration",children:"Expiration"}),"\n",(0,t.jsxs)(n.p,{children:["By default, keys persisted to disk do not expire. However, you can specify an expiration time so that keys are removed after a defined period.\nThe time-to-live of the key can set an expiration when creating a key with the ",(0,t.jsx)(n.code,{children:"EX"})," parameter:"]}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli> set myconfig "my-value" ex 30000\nr2 set 18ms\n'})}),"\n",(0,t.jsxs)(n.p,{children:["or modify it later using the ",(0,t.jsx)(n.code,{children:"extend"})," command:"]}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli> set myconfig "my-value"\nr3 set 12ms\n\nkahuna-cli> extend myconfig 30000\nr3 extended 16ms\n'})}),"\n",(0,t.jsx)(n.p,{children:"Expiration times are specified in milliseconds."}),"\n",(0,t.jsx)(n.h2,{id:"durability",children:"Durability"}),"\n",(0,t.jsx)(n.p,{children:"By default, Kahuna ensures strong durability by replicating the key/value pairs across many instances. The client is notified of a successful operation\nonly after receiving confirmation from the majority of nodes in the cluster."}),"\n",(0,t.jsx)(n.p,{children:'In high-performance scenarios or when working with ephemeral data, on-disk durability may not be necessary or practical. For these cases, Kahuna offers\nan "ephemeral" durability mode, in which data is stored only in the leader node\'s volatile memory.'}),"\n",(0,t.jsx)(n.p,{children:'Commands using ephemeral durability are prefixed with an "e". For example:'}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli> eset tempconfig "my-value"\nr0 set 47ms\n\nkahuna-cli> eget tempconfig\nr0 my-value 32ms\n'})}),"\n",(0,t.jsx)(n.p,{children:"Keep in mind that ephemeral data will be lost if the node crashes or if memory pressure forces the system to free up space by removing the least-used keys. You can also specify an explicit expiration time for ephemeral keys. Ephemeral storage provides faster operations without the overhead of replication and persistence."}),"\n",(0,t.jsx)(n.h2,{id:"revisions",children:"Revisions"}),"\n",(0,t.jsxs)(n.p,{children:["Each time a key is updated, you will notice an incrementing ",(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:"distributed-keyvalue-store/revisions",children:"revision number"})})," (e.g., r0, r1, etc.). This value, known as the revision, is a monotonic version number that tracks when a key was last modified. Every time a key is updated or deleted, its revision increments, ensuring strong consistency and strict ordering."]}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli> set myconf "some config"\nr0 set 20ms\n\nkahuna-cli> set myconf "some other config"\nr1 set 10ms\n\nkahuna-cli> set myconf "another config"\nr2 set 15ms\n\nkahuna-cli> get myconf\nr2 another config 13ms\n'})}),"\n",(0,t.jsx)(n.h2,{id:"compare-and-swap-cas",children:"Compare And Swap (CAS)"}),"\n",(0,t.jsxs)(n.p,{children:["The ",(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:"distributed-keyvalue-store/cas",children:"Compare-And-Swap (CAS)"})})," operation ensures atomic updates and prevents race conditions in environments where multiple clients may attempt to modify the same key simultaneously."]}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli> set myconf "prev config"\nr0 set 14ms\n\nkahuna-cli> set myconf "new config" cmp "prev config"\nr1 set 18ms\n\nkahuna-cli> set myconf "some config" cmp "prev config"\nr1 not set 13ms\n'})}),"\n",(0,t.jsxs)(n.p,{children:["In the previous example, the CAS (Compare-And-Swap) operation is used to ensure that the value is only changed if its current value matches the one specified in the ",(0,t.jsx)(n.code,{children:'"cmp"'})," parameter."]}),"\n",(0,t.jsx)(n.h2,{id:"scripts-and-transactions",children:"Scripts and Transactions"}),"\n",(0,t.jsxs)(n.p,{children:["Kahuna offers a scripting system that allows executing distributed transactions on the key/value store. Scripts can be run from an application using\nthe appropriate connector for a programming language/platform or directly from ",(0,t.jsx)(n.code,{children:"kahuna-cli"}),". Transactions allow executing multiple operations\n(such as modifying or consistently reading keys across multiple nodes) and are applied in an ",(0,t.jsx)(n.strong,{children:"all-or-nothing"})," manner."]}),"\n",(0,t.jsx)(n.p,{children:"For example, if we wanted to decrement the value of one key based on the limit configured in another key, we could do the following:"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-visual-basic",children:'kahuna-cli>  set max_rate_limit 100\nr0 set 13ms\n\nkahuna-cli> let limit = get max_rate_limit\n       ...> let current_rate = get rate_limit_user1\n       ...>\n       ...> if current_rate <= 0 then\n       ...>  throw "Rate limit exceeded. Please try again later."\n       ...> end\n       ...>\n       ...> let new_current_rate = current_rate - 1\n       ...> set current_rate new_current_rate ex 60000\n       ...>\n       ...> return new_current_rate\nr1 99 18ms\n\nkahuna-cli> get rate_limit_user1\nr1 99 4ms\n'})}),"\n",(0,t.jsx)(n.p,{children:"In this other example, we\u2019re going to make a transfer between two keys. The keys may or may not be led by the same node, but the transaction\ncoordinator ensures that changes are applied across all participating nodes. If an error occurs, the transaction will abort and no changes will be applied:"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-visual-basic",children:"kahuna-cli>  set balance_user1 1000 nx\nr0 set 14ms\n\nkahuna-cli>  set balance_user2 1000 nx\nr0 set 12ms\n\nkahuna-cli> begin\n       ...>  let balance_user1_value = get balance_user1\n       ...>  let balance_user2_value = get balance_user2\n       ...>\n       ...>  let balance_user1_num = to_int(balance_user1_value)\n       ...>  let balance_user2_num = to_int(balance_user2_value)\n       ...>\n       ...>  if balance_user1_num > 0 then\n       ...>     set balance_user1 balance_user1_num - 50\n       ...>     set balance_user2 balance_user2_num + 50\n       ...>     commit\n       ...>  end\n       ...> end\n\nr1 set 24ms\n"})}),"\n",(0,t.jsxs)(n.p,{children:["This ensures ",(0,t.jsx)(n.strong,{children:"atomicity and consistency"})," across distributed nodes. In the next section, we\u2019ll learn how to use ",(0,t.jsx)(n.strong,{children:"Distributed Locks"})," with Kahuna."]})]})}function u(e={}){const{wrapper:n}={...(0,i.R)(),...e.components};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(h,{...e})}):h(e)}},8453:(e,n,a)=>{a.d(n,{R:()=>r,x:()=>o});var s=a(6540);const t={},i=s.createContext(t);function r(e){const n=s.useContext(i);return s.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(t):e.components||t:r(e.components),s.createElement(i.Provider,{value:n},e.children)}}}]);