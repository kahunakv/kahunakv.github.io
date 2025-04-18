"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[6345],{5103:(e,s,n)=>{n.r(s),n.d(s,{assets:()=>o,contentTitle:()=>c,default:()=>p,frontMatter:()=>i,metadata:()=>t,toc:()=>d});const t=JSON.parse('{"id":"scripts/commands/set","title":"Command: Set","description":"Allows to create or update a key/value in a persistent durable way.","source":"@site/docs/scripts/commands/set.md","sourceDirName":"scripts/commands","slug":"/scripts/commands/set","permalink":"/docs/scripts/commands/set","draft":false,"unlisted":false,"editUrl":"https://github.com/kahunakv/kahunakv.github.io/tree/main/docs/scripts/commands/set.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Control Structures","permalink":"/docs/scripts/control-structures"},"next":{"title":"Command: ESet","permalink":"/docs/scripts/commands/eset"}}');var a=n(4848),r=n(8453);const i={},c="Command: Set",o={},d=[{value:"NX",id:"nx",level:2},{value:"XX",id:"xx",level:2},{value:"EX",id:"ex",level:2},{value:"Compare-Value-And-Swap (CVAS)",id:"compare-value-and-swap-cvas",level:2},{value:"Compare-Revision-And-Swap (CRAS)",id:"compare-revision-and-swap-cras",level:2}];function l(e){const s={code:"code",h1:"h1",h2:"h2",header:"header",p:"p",pre:"pre",...(0,r.R)(),...e.components};return(0,a.jsxs)(a.Fragment,{children:[(0,a.jsx)(s.header,{children:(0,a.jsx)(s.h1,{id:"command-set",children:"Command: Set"})}),"\n",(0,a.jsx)(s.p,{children:"Allows to create or update a key/value in a persistent durable way."}),"\n",(0,a.jsx)(s.pre,{children:(0,a.jsx)(s.code,{className:"language-swift",children:'set `services/email/instance-3` \'{"ip": "10.1.1.22", "port": 9090}\'\nr0 set 9ms\n\nset `services/email/instance-3` \'{"ip": "10.1.1.22", "port": 9090}\'\nr1 set 12ms\n'})}),"\n",(0,a.jsx)(s.h2,{id:"nx",children:"NX"}),"\n",(0,a.jsxs)(s.p,{children:["If the ",(0,a.jsx)(s.code,{children:"NX"})," modifier is passed the key will be only updated if the key doesn't exist."]}),"\n",(0,a.jsx)(s.pre,{children:(0,a.jsx)(s.code,{className:"language-swift",children:'set session_user1 "ab10a9bc1924cd" nx\nr0 not set 10ms\n'})}),"\n",(0,a.jsx)(s.h2,{id:"xx",children:"XX"}),"\n",(0,a.jsxs)(s.p,{children:["If the ",(0,a.jsx)(s.code,{children:"XX"})," modifier is passed the key will be only updated if the key already exists."]}),"\n",(0,a.jsx)(s.pre,{children:(0,a.jsx)(s.code,{className:"language-swift",children:'set config_feature_x "enabled" xx\nr0 not set 5ms\n\nset config_feature_x "enabled"\nr0 set 7ms\n\nset config_feature_x "enabled" xx\nr1 set 7ms\n'})}),"\n",(0,a.jsx)(s.h2,{id:"ex",children:"EX"}),"\n",(0,a.jsxs)(s.p,{children:["The ",(0,a.jsx)(s.code,{children:"EX"})," modifier allows to set the key's expiration in milliseconds (a positive integer higher than 0):"]}),"\n",(0,a.jsx)(s.pre,{children:(0,a.jsx)(s.code,{className:"language-swift",children:'set `email/leader` "node3" EX 60000\nr0 set 11ms\n'})}),"\n",(0,a.jsx)(s.h2,{id:"compare-value-and-swap-cvas",children:"Compare-Value-And-Swap (CVAS)"}),"\n",(0,a.jsx)(s.p,{children:"A Compare-Value-And-Swap (CAS) operation ensures atomic updates and prevents race conditions where multiple clients may try to modify the same key simultaneously:"}),"\n",(0,a.jsx)(s.pre,{children:(0,a.jsx)(s.code,{className:"language-swift",children:' set `locks/tasks/123` "node1" ex 10000 nx\nr0 set 14ms\n'})}),"\n",(0,a.jsx)(s.p,{children:"Mark the task as completed if this node still hold the key:"}),"\n",(0,a.jsx)(s.pre,{children:(0,a.jsx)(s.code,{className:"language-swift",children:' set `locks/tasks/123` "completed" cmp "node1"\nr1 set 9ms\n'})}),"\n",(0,a.jsx)(s.h2,{id:"compare-revision-and-swap-cras",children:"Compare-Revision-And-Swap (CRAS)"}),"\n",(0,a.jsx)(s.p,{children:"A Compare-Revision-And-Swap (CRAS) does the same as CVAS but the revision is compared:"}),"\n",(0,a.jsx)(s.pre,{children:(0,a.jsx)(s.code,{className:"language-swift",children:' set `locks/tasks/123` "node1" ex 10000 nx\nr7 set 15ms\n'})}),"\n",(0,a.jsxs)(s.p,{children:["The prev ",(0,a.jsx)(s.code,{children:"set"})," returned revision 7. Mark the task as completed if the revision is known by the process:"]}),"\n",(0,a.jsx)(s.pre,{children:(0,a.jsx)(s.code,{className:"language-swift",children:' set `locks/tasks/123` "completed" cmprev 7\nr8 set 11ms\n'})})]})}function p(e={}){const{wrapper:s}={...(0,r.R)(),...e.components};return s?(0,a.jsx)(s,{...e,children:(0,a.jsx)(l,{...e})}):l(e)}},8453:(e,s,n)=>{n.d(s,{R:()=>i,x:()=>c});var t=n(6540);const a={},r=t.createContext(a);function i(e){const s=t.useContext(r);return t.useMemo((function(){return"function"==typeof e?e(s):{...s,...e}}),[s,e])}function c(e){let s;return s=e.disableParentContext?"function"==typeof e.components?e.components(a):e.components||a:i(e.components),t.createElement(r.Provider,{value:s},e.children)}}}]);