"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[833],{1412:(e,t,s)=>{s.r(t),s.d(t,{assets:()=>a,contentTitle:()=>d,default:()=>m,frontMatter:()=>r,metadata:()=>n,toc:()=>c});const n=JSON.parse('{"id":"scripts/commands/delete","title":"Command: Delete","description":"Deletes a persistent key/value. The key is ignored if it doesn\'t exist.","source":"@site/docs/scripts/commands/delete.md","sourceDirName":"scripts/commands","slug":"/scripts/commands/delete","permalink":"/docs/scripts/commands/delete","draft":false,"unlisted":false,"editUrl":"https://github.com/kahunakv/kahunakv.github.io/tree/main/docs/scripts/commands/delete.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Command: Eextends","permalink":"/docs/scripts/commands/eextend"},"next":{"title":"Command: Edelete","permalink":"/docs/scripts/commands/edelete"}}');var i=s(4848),o=s(8453);const r={},d="Command: Delete",a={},c=[{value:"Notes",id:"notes",level:2}];function l(e){const t={code:"code",h1:"h1",h2:"h2",header:"header",p:"p",pre:"pre",...(0,o.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.header,{children:(0,i.jsx)(t.h1,{id:"command-delete",children:"Command: Delete"})}),"\n",(0,i.jsx)(t.p,{children:"Deletes a persistent key/value. The key is ignored if it doesn't exist."}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-swift",children:'set `services/email/instance-3` \'{"ip": "10.1.1.22", "port": 9090}\'\nr0 set 9ms\n\ndelete `services/email/instance-3`\nr0 set 12ms\n'})}),"\n",(0,i.jsx)(t.h2,{id:"notes",children:"Notes"}),"\n",(0,i.jsx)(t.p,{children:"Keep in mind that deleting a key does not immediately remove it from disk. Instead, it is marked with a tombstone, which prevents it from being visible in future reads."}),"\n",(0,i.jsx)(t.p,{children:"This approach is necessary to preserve the revision history of the key, allowing future modifications or writes to be correctly versioned."}),"\n",(0,i.jsx)(t.p,{children:"Depending on the compaction policies of the underlying key/value store, these deleted keys (tombstones) may be fully removed later to reclaim disk space."})]})}function m(e={}){const{wrapper:t}={...(0,o.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(l,{...e})}):l(e)}},8453:(e,t,s)=>{s.d(t,{R:()=>r,x:()=>d});var n=s(6540);const i={},o=n.createContext(i);function r(e){const t=n.useContext(o);return n.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function d(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:r(e.components),n.createElement(o.Provider,{value:t},e.children)}}}]);