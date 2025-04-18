"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[8850],{661:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>o,contentTitle:()=>c,default:()=>a,frontMatter:()=>d,metadata:()=>n,toc:()=>l});const n=JSON.parse('{"id":"server-configuration","title":"Server Configuration","description":"| Command Line Option(s)                              | Description                                                                                     | Default Value   |","source":"@site/docs/server-configuration.md","sourceDirName":".","slug":"/server-configuration","permalink":"/docs/server-configuration","draft":false,"unlisted":false,"editUrl":"https://github.com/kahunakv/kahunakv.github.io/tree/main/docs/server-configuration.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Server Installation","permalink":"/docs/server-installation"},"next":{"title":"Kahuna CLI","permalink":"/docs/kahuna-cli"}}');var i=r(4848),s=r(8453);const d={},c="Server Configuration",o={},l=[];function h(e){const t={code:"code",em:"em",h1:"h1",header:"header",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",...(0,s.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.header,{children:(0,i.jsx)(t.h1,{id:"server-configuration",children:"Server Configuration"})}),"\n",(0,i.jsxs)(t.table,{children:[(0,i.jsx)(t.thead,{children:(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.th,{children:"Command Line Option(s)"}),(0,i.jsx)(t.th,{children:"Description"}),(0,i.jsx)(t.th,{children:"Default Value"})]})}),(0,i.jsxs)(t.tbody,{children:[(0,i.jsxs)(t.tr,{children:[(0,i.jsxs)(t.td,{children:[(0,i.jsx)(t.code,{children:"-h"}),", ",(0,i.jsx)(t.code,{children:"--host"})]}),(0,i.jsx)(t.td,{children:"Host to bind incoming connections to"}),(0,i.jsx)(t.td,{children:'"*"'})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsxs)(t.td,{children:[(0,i.jsx)(t.code,{children:"-p"}),", ",(0,i.jsx)(t.code,{children:"--http-ports"})]}),(0,i.jsx)(t.td,{children:"Ports to bind incoming HTTP connections to"}),(0,i.jsx)(t.td,{children:(0,i.jsx)(t.em,{children:"None provided"})})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--https-ports"})}),(0,i.jsx)(t.td,{children:"Ports to bind incoming HTTPS connections to"}),(0,i.jsx)(t.td,{children:(0,i.jsx)(t.em,{children:"None provided"})})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--https-certificate"})}),(0,i.jsx)(t.td,{children:"Path to the HTTPS certificate"}),(0,i.jsx)(t.td,{children:'"" (empty)'})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--https-certificate-password"})}),(0,i.jsx)(t.td,{children:"Password for the HTTPS certificate"}),(0,i.jsx)(t.td,{children:'"" (empty)'})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--storage"})}),(0,i.jsx)(t.td,{children:"Storage engine type (e.g., rocksdb, sqlite)"}),(0,i.jsx)(t.td,{children:'"rocksdb"'})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--storage-path"})}),(0,i.jsx)(t.td,{children:"File system path for storage"}),(0,i.jsx)(t.td,{children:'"" (empty)'})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--storage-revision"})}),(0,i.jsx)(t.td,{children:"Revision identifier for the storage configuration"}),(0,i.jsx)(t.td,{children:'"" (empty)'})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--wal-storage"})}),(0,i.jsx)(t.td,{children:"WAL (Write-Ahead Logging) storage engine (e.g., rocksdb, sqlite)"}),(0,i.jsx)(t.td,{children:'"rocksdb"'})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--wal-path"})}),(0,i.jsx)(t.td,{children:"File system path for the WAL storage"}),(0,i.jsx)(t.td,{children:'"" (empty)'})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--wal-revision"})}),(0,i.jsx)(t.td,{children:"Revision identifier for the WAL configuration"}),(0,i.jsx)(t.td,{children:'"v1"'})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--initial-cluster"})}),(0,i.jsx)(t.td,{children:"Initial cluster configuration for static discovery"}),(0,i.jsx)(t.td,{children:(0,i.jsx)(t.em,{children:"None provided"})})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--initial-cluster-partitions"})}),(0,i.jsx)(t.td,{children:"Number of partitions for the initial cluster"}),(0,i.jsx)(t.td,{children:"8"})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--raft-nodeid"})}),(0,i.jsx)(t.td,{children:"Unique identifier to identify the node in the Raft cluster"}),(0,i.jsx)(t.td,{children:'"" (empty)'})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--raft-host"})}),(0,i.jsx)(t.td,{children:"Host to listen for Raft consensus and replication requests"}),(0,i.jsx)(t.td,{children:'"localhost"'})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--raft-port"})}),(0,i.jsx)(t.td,{children:"Port to bind incoming Raft consensus and replication requests"}),(0,i.jsx)(t.td,{children:"2070"})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--locks-workers"})}),(0,i.jsx)(t.td,{children:"Number of ephemeral/consistent workers dedicated to lock management"}),(0,i.jsx)(t.td,{children:"0"})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--persistence-workers"})}),(0,i.jsx)(t.td,{children:"Number of workers dedicated to persistence operations"}),(0,i.jsx)(t.td,{children:"0"})]}),(0,i.jsxs)(t.tr,{children:[(0,i.jsx)(t.td,{children:(0,i.jsx)(t.code,{children:"--background-writer-workers"})}),(0,i.jsx)(t.td,{children:"Number of workers dedicated to background writing operations"}),(0,i.jsx)(t.td,{children:"0"})]})]})]})]})}function a(e={}){const{wrapper:t}={...(0,s.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(h,{...e})}):h(e)}},8453:(e,t,r)=>{r.d(t,{R:()=>d,x:()=>c});var n=r(6540);const i={},s=n.createContext(i);function d(e){const t=n.useContext(s);return n.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function c(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:d(e.components),n.createElement(s.Provider,{value:t},e.children)}}}]);