"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[6406],{2236:(e,n,s)=>{s.r(n),s.d(n,{assets:()=>l,contentTitle:()=>c,default:()=>h,frontMatter:()=>t,metadata:()=>i,toc:()=>d});const i=JSON.parse('{"id":"scripts/basic-syntax","title":"Basic Syntax","description":"Kahuna Script is inspired by Lua, Ruby, Bash and PL/pgSQL. Its syntax is easy to understand because of its similarity to widely used languages, making it accessible for developers familiar with scripting or database logic.","source":"@site/docs/scripts/basic-syntax.md","sourceDirName":"scripts","slug":"/scripts/basic-syntax","permalink":"/docs/scripts/basic-syntax","draft":false,"unlisted":false,"editUrl":"https://github.com/kahunakv/kahunakv.github.io/tree/main/docs/scripts/basic-syntax.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Scripts : Overview","permalink":"/docs/scripts"},"next":{"title":"Types","permalink":"/docs/scripts/types"}}');var r=s(4848),a=s(8453);const t={},c="Basic Syntax",l={},d=[{value:"Variables",id:"variables",level:2},{value:"Reserved Words and Escaping Identifiers",id:"reserved-words-and-escaping-identifiers",level:2},{value:"Whitespace and Line Endings",id:"whitespace-and-line-endings",level:2}];function o(e){const n={code:"code",h1:"h1",h2:"h2",header:"header",p:"p",pre:"pre",strong:"strong",...(0,a.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(n.header,{children:(0,r.jsx)(n.h1,{id:"basic-syntax",children:"Basic Syntax"})}),"\n",(0,r.jsxs)(n.p,{children:["Kahuna Script is inspired by ",(0,r.jsx)(n.strong,{children:"Lua"}),", ",(0,r.jsx)(n.strong,{children:"Ruby"}),", ",(0,r.jsx)(n.strong,{children:"Bash"})," and ",(0,r.jsx)(n.strong,{children:"PL/pgSQL"}),". Its syntax is easy to understand ",(0,r.jsx)(n.strong,{children:"because of its similarity to widely used languages"}),", making it accessible for developers familiar with scripting or database logic."]}),"\n",(0,r.jsx)(n.p,{children:'A "Hello World" in Kahuna Script would look like this:'}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-ruby",children:"return 'Hello World'\n"})}),"\n",(0,r.jsx)(n.p,{children:"A slightly more useful example:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-ruby",children:'begin\n let current_leader = get `election/leader`\n if rev(current_leader) == 0 then\n   set `election/leader` "node-A"\n else\n   throw "election failed"\n end\n commit\nend\n'})}),"\n",(0,r.jsx)(n.h2,{id:"variables",children:"Variables"}),"\n",(0,r.jsxs)(n.p,{children:["In scripts, variables have ",(0,r.jsx)(n.strong,{children:"local and temporary scope"}),", meaning they exist only for the ",(0,r.jsx)(n.strong,{children:"duration of the script\u2019s execution"}),"."]}),"\n",(0,r.jsxs)(n.p,{children:["Variables can be used to ",(0,r.jsx)(n.strong,{children:"retrieve values"})," from the key/value store and also to ",(0,r.jsx)(n.strong,{children:"hold modified values"})," that can later be written back."]}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Example:"})}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-visual-basic",children:'let current_limits = get "user:123:limits"\nlet current_limits = current_limits - 1\nset "user:123:limits" current_limits\n'})}),"\n",(0,r.jsx)(n.p,{children:"This pattern\u2014read, modify, write\u2014is common in Kahuna Script and helps encapsulate logic close to the data while avoiding multiple round-trips."}),"\n",(0,r.jsx)(n.h2,{id:"reserved-words-and-escaping-identifiers",children:"Reserved Words and Escaping Identifiers"}),"\n",(0,r.jsx)(n.p,{children:"Some identifiers are reserved words and cannot be used as constant or variable names. It\u2019s recommended to escape key names using backticks ` or quotes ' ' or \" \" to avoid conflicts. For example:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-ruby",children:'set election_leader "node-A"\nset `election_leader` "node-A"\nset "election_leader" "node-A"\n'})}),"\n",(0,r.jsx)(n.p,{children:"By escaping keys, you can use all kinds of characters and symbols that might not otherwise be allowed. For example:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-ruby",children:'set `end` "some value" # reserved word end\nset `user@domain.com` "active" # symbols\nset "config:env/prod#1" true # symbols\nset "\ud83d\udd25special-key$" 123 # emojis\n'})}),"\n",(0,r.jsx)(n.p,{children:"This allows for greater flexibility in naming keys, especially when working with external systems, user-generated IDs, or complex naming conventions."}),"\n",(0,r.jsx)(n.h2,{id:"whitespace-and-line-endings",children:"Whitespace and Line Endings"}),"\n",(0,r.jsx)(n.p,{children:"Whitespace characters such as spaces and tabs are generally ignored in Kahuna Script code, except when they appear in strings:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-ruby",children:'let my_range = 1..10 for i in my_range do if i == 5 then return i end end throw "needle wasn\'t found"\n'})}),"\n",(0,r.jsx)(n.p,{children:"The previous script is equivalent to:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-visual-basic",children:'let my_range = 1..10\nfor i in my_range do\n    if i == 5 then\n        return i\n    end\nend\n\nthrow "needle wasn\'t found"\n'})})]})}function h(e={}){const{wrapper:n}={...(0,a.R)(),...e.components};return n?(0,r.jsx)(n,{...e,children:(0,r.jsx)(o,{...e})}):o(e)}},8453:(e,n,s)=>{s.d(n,{R:()=>t,x:()=>c});var i=s(6540);const r={},a=i.createContext(r);function t(e){const n=i.useContext(a);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function c(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:t(e.components),i.createElement(a.Provider,{value:n},e.children)}}}]);