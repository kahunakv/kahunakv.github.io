"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[776],{6186:(e,s,t)=>{t.r(s),t.d(s,{assets:()=>a,contentTitle:()=>c,default:()=>m,frontMatter:()=>o,metadata:()=>n,toc:()=>d});const n=JSON.parse('{"id":"scripts/commands/exists","title":"Command: Exists","description":"Checks if a key exists in the persistent storage. If the key does not exist false is returned.","source":"@site/docs/scripts/commands/exists.md","sourceDirName":"scripts/commands","slug":"/scripts/commands/exists","permalink":"/docs/scripts/commands/exists","draft":false,"unlisted":false,"editUrl":"https://github.com/kahunakv/kahunakv.github.io/tree/main/docs/scripts/commands/exists.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Command: Edelete","permalink":"/docs/scripts/commands/edelete"},"next":{"title":"Command: Eexists","permalink":"/docs/scripts/commands/eexists"}}');var i=t(4848),r=t(8453);const o={},c="Command: Exists",a={},d=[];function l(e){const s={code:"code",h1:"h1",header:"header",p:"p",pre:"pre",strong:"strong",...(0,r.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(s.header,{children:(0,i.jsx)(s.h1,{id:"command-exists",children:"Command: Exists"})}),"\n",(0,i.jsxs)(s.p,{children:["Checks if a key exists in the persistent storage. If the key does not exist ",(0,i.jsx)(s.code,{children:"false"})," is returned."]}),"\n",(0,i.jsx)(s.pre,{children:(0,i.jsx)(s.code,{className:"language-swift",children:"exists `config/limits/max-connections`\nr- not exists 9ms\n\nset `config/limits/max-connections` 1000\nr0 set 11ms\n\nexists `config/limits/max-connections`\nr0 exists 8ms\n"})}),"\n",(0,i.jsxs)(s.p,{children:[(0,i.jsx)(s.code,{children:"exists"})," is useful for checking whether a key is present in the key/value store ",(0,i.jsx)(s.strong,{children:"without incurring the cost"})," of returning the full byte stream of the associated value to the client."]}),"\n",(0,i.jsx)(s.p,{children:"This makes it an efficient way to perform presence checks, especially when working with large values or when you only need to know if a key exists before taking further action."}),"\n",(0,i.jsx)(s.p,{children:(0,i.jsx)(s.strong,{children:"Example:"})}),"\n",(0,i.jsx)(s.pre,{children:(0,i.jsx)(s.code,{className:"language-visual-basic",children:'let exists_key = exists "user:123:profile"\nif exists_key then\n  return "User found"\nelse\n  return "User not found"\nend\n'})})]})}function m(e={}){const{wrapper:s}={...(0,r.R)(),...e.components};return s?(0,i.jsx)(s,{...e,children:(0,i.jsx)(l,{...e})}):l(e)}},8453:(e,s,t)=>{t.d(s,{R:()=>o,x:()=>c});var n=t(6540);const i={},r=n.createContext(i);function o(e){const s=n.useContext(r);return n.useMemo((function(){return"function"==typeof e?e(s):{...s,...e}}),[s,e])}function c(e){let s;return s=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:o(e.components),n.createElement(r.Provider,{value:s},e.children)}}}]);