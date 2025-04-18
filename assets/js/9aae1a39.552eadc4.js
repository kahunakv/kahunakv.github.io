"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[8997],{8453:(n,e,a)=>{a.d(e,{R:()=>c,x:()=>r});var t=a(6540);const i={},o=t.createContext(i);function c(n){const e=t.useContext(o);return t.useMemo((function(){return"function"==typeof n?n(e):{...e,...n}}),[e,n])}function r(n){let e;return e=n.disableParentContext?"function"==typeof n.components?n.components(i):n.components||i:c(n.components),t.createElement(o.Provider,{value:e},n.children)}},9345:(n,e,a)=>{a.r(e),a.d(e,{assets:()=>s,contentTitle:()=>r,default:()=>d,frontMatter:()=>c,metadata:()=>t,toc:()=>l});const t=JSON.parse('{"id":"kahuna-cli","title":"Kahuna CLI","description":"Kahuna CLI is an interactive command-line tool that allows sending commands, executing transactions in a Kahuna cluster and viewing the results.","source":"@site/docs/kahuna-cli.md","sourceDirName":".","slug":"/kahuna-cli","permalink":"/docs/kahuna-cli","draft":false,"unlisted":false,"editUrl":"https://github.com/kahunakv/kahunakv.github.io/tree/main/docs/kahuna-cli.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Server Configuration","permalink":"/docs/server-configuration"},"next":{"title":"Client for .NET","permalink":"/docs/dotnet-client"}}');var i=a(4848),o=a(8453);const c={},r="Kahuna CLI",s={},l=[{value:"<strong>Native Client</strong>",id:"native-client",level:3},{value:"<strong>Docker</strong>",id:"docker",level:3},{value:"Interactive Mode",id:"interactive-mode",level:2},{value:"Connection String",id:"connection-string",level:2}];function h(n){const e={a:"a",code:"code",h1:"h1",h2:"h2",h3:"h3",header:"header",p:"p",pre:"pre",strong:"strong",...(0,o.R)(),...n.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(e.header,{children:(0,i.jsx)(e.h1,{id:"kahuna-cli",children:"Kahuna CLI"})}),"\n",(0,i.jsxs)(e.p,{children:[(0,i.jsx)(e.strong,{children:"Kahuna CLI"})," is an ",(0,i.jsx)(e.strong,{children:"interactive command-line tool"})," that allows sending ",(0,i.jsx)(e.strong,{children:"commands"}),", executing ",(0,i.jsx)(e.strong,{children:"transactions"})," in a ",(0,i.jsx)(e.strong,{children:"Kahuna cluster"})," and viewing the results."]}),"\n",(0,i.jsx)(e.p,{children:"It can be installed in two ways:"}),"\n",(0,i.jsx)(e.h3,{id:"native-client",children:(0,i.jsx)(e.strong,{children:"Native Client"})}),"\n",(0,i.jsxs)(e.p,{children:["If you have the ",(0,i.jsx)(e.a,{href:"https://dotnet.microsoft.com/en-us/download/dotnet/8.0",children:(0,i.jsx)(e.strong,{children:".NET runtime"})})," installed, you can globally install the ",(0,i.jsx)(e.code,{children:"kahuna-cli"})," tool with the following command:"]}),"\n",(0,i.jsx)(e.pre,{children:(0,i.jsx)(e.code,{className:"language-bash",children:"dotnet tool install -g Kahuna.Control\n"})}),"\n",(0,i.jsx)(e.p,{children:"Then you can execute the following command on your terminal:"}),"\n",(0,i.jsx)(e.pre,{children:(0,i.jsx)(e.code,{className:"language-bash",children:"~> kahuna-cli\nKahuna Shell 0.0.5 (alpha)\n\nkahuna-cli>  get my-config\nr14 my-value 18ms\n\n"})}),"\n",(0,i.jsxs)(e.p,{children:["When new versions of ",(0,i.jsx)(e.code,{children:"kahuna-cli"})," are released it can be later updated using the following command:"]}),"\n",(0,i.jsx)(e.pre,{children:(0,i.jsx)(e.code,{className:"language-bash",children:"dotnet tool update -g Kahuna.Control\n"})}),"\n",(0,i.jsx)(e.h3,{id:"docker",children:(0,i.jsx)(e.strong,{children:"Docker"})}),"\n",(0,i.jsxs)(e.p,{children:["If you have ",(0,i.jsx)(e.strong,{children:"Docker"})," you can run it on a container:"]}),"\n",(0,i.jsx)(e.pre,{children:(0,i.jsx)(e.code,{className:"language-bash",children:"docker run --name kahuna-cli --network=host -d kahunakv/kahuna-cli:latest\n"})}),"\n",(0,i.jsx)(e.p,{children:"Then you can execute the following command on your terminal:"}),"\n",(0,i.jsx)(e.pre,{children:(0,i.jsx)(e.code,{className:"language-bash",children:"~> docker exec -it kahuna-cli /app/run.sh\nKahuna Shell 0.0.5 (alpha)\n\nkahuna-cli>  get my-config\nr14 my-value 18ms\n"})}),"\n",(0,i.jsx)(e.h2,{id:"interactive-mode",children:"Interactive Mode"}),"\n",(0,i.jsx)(e.p,{children:"If no command-line parameters are provided, kahuna-cli enters interactive mode, allowing you to execute commands and view their results in real time."}),"\n",(0,i.jsxs)(e.p,{children:["If no command-line parameters are provided, ",(0,i.jsx)(e.code,{children:"kahuna-cli"})," enters ",(0,i.jsx)(e.strong,{children:"interactive mode"}),", allowing you to execute commands and view their results in real time."]}),"\n",(0,i.jsx)(e.h2,{id:"connection-string",children:"Connection String"}),"\n",(0,i.jsxs)(e.p,{children:["By default, ",(0,i.jsx)(e.code,{children:"kahuna-cli"})," attempts to connect to a cluster running on localhost on ports ",(0,i.jsx)(e.strong,{children:"8082, 8084, and 8086"}),"."]}),"\n",(0,i.jsxs)(e.p,{children:["If you want to change this, you can specify the servers explicitly using the ",(0,i.jsx)(e.code,{children:"-c"})," flag:"]}),"\n",(0,i.jsx)(e.pre,{children:(0,i.jsx)(e.code,{className:"language-bash",children:'$ kahuna-cli -c "https://kahuna-dev.company.internal:8082,https://kahuna-dev.company.internal:8084"\n'})}),"\n",(0,i.jsx)(e.p,{children:"This tells the CLI to connect to the specified Kahuna nodes, enabling interaction with a custom or remote environment."})]})}function d(n={}){const{wrapper:e}={...(0,o.R)(),...n.components};return e?(0,i.jsx)(e,{...n,children:(0,i.jsx)(h,{...n})}):h(n)}}}]);