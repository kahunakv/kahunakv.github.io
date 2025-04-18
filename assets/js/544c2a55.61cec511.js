"use strict";(self.webpackChunkkahunakv_docs=self.webpackChunkkahunakv_docs||[]).push([[2258],{7256:(e,i,n)=>{n.r(i),n.d(i,{assets:()=>d,contentTitle:()=>l,default:()=>h,frontMatter:()=>a,metadata:()=>s,toc:()=>o});const s=JSON.parse('{"id":"storage/overview","title":"Storage: Overview","description":"In any database, storage is one of the most important and critical components for ensuring data reliability. Kahuna acts as a high-level coordinator for the embedded databases that form the underlying storage layer of each node in the architecture.","source":"@site/docs/storage/overview.md","sourceDirName":"storage","slug":"/storage/overview","permalink":"/docs/storage/overview","draft":false,"unlisted":false,"editUrl":"https://github.com/kahunakv/kahunakv.github.io/tree/main/docs/storage/overview.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Keys Eviction","permalink":"/docs/architecture/keys-eviction"},"next":{"title":"Rate Limiting","permalink":"/docs/recipes/rate-limiting"}}');var r=n(4848),t=n(8453);const a={},l="Storage: Overview",d={},o=[{value:"RocksDb in Kahuna",id:"rocksdb-in-kahuna",level:2},{value:"Internal Architecture Overview",id:"internal-architecture-overview",level:3},{value:"Write Path:",id:"write-path",level:4},{value:"Read Path:",id:"read-path",level:4},{value:"Why RocksDB?",id:"why-rocksdb",level:3},{value:"SQLite in Kahuna",id:"sqlite-in-kahuna",level:2},{value:"Internal Architecture Overview",id:"internal-architecture-overview-1",level:3},{value:"Write Path:",id:"write-path-1",level:4},{value:"Read Path:",id:"read-path-1",level:4},{value:"Why SQLite?",id:"why-sqlite",level:3},{value:"RocksDB vs SQLite",id:"rocksdb-vs-sqlite",level:2}];function c(e){const i={code:"code",h1:"h1",h2:"h2",h3:"h3",h4:"h4",header:"header",li:"li",ol:"ol",p:"p",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...(0,t.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(i.header,{children:(0,r.jsx)(i.h1,{id:"storage-overview",children:"Storage: Overview"})}),"\n",(0,r.jsxs)(i.p,{children:["In any database, ",(0,r.jsx)(i.strong,{children:"storage"})," is one of the most important and critical components for ensuring data reliability. ",(0,r.jsx)(i.strong,{children:"Kahuna"})," acts as a ",(0,r.jsx)(i.strong,{children:"high-level coordinator"})," for the embedded databases that form the underlying storage layer of each node in the architecture."]}),"\n",(0,r.jsx)(i.p,{children:"Kahuna offers the flexibility of supporting two storage backends:"}),"\n",(0,r.jsxs)(i.ul,{children:["\n",(0,r.jsxs)(i.li,{children:[(0,r.jsx)(i.strong,{children:"RocksDB"})," (default): optimized for high-throughput, write-heavy workloads and used widely in distributed systems."]}),"\n",(0,r.jsxs)(i.li,{children:[(0,r.jsx)(i.strong,{children:"SQLite"}),": lightweight, relational, and ideal for simpler workloads or environments where SQL compatibility is desired."]}),"\n"]}),"\n",(0,r.jsx)(i.p,{children:"Each backend comes with its own strengths, allowing developers to choose the one that best fits their performance, durability, and operational requirements."}),"\n",(0,r.jsx)(i.p,{children:"Kahuna uses its storage backends primarily for:"}),"\n",(0,r.jsxs)(i.ul,{children:["\n",(0,r.jsx)(i.li,{children:"Raft Logs (Write-Ahead Log (WAL) persistence)"}),"\n",(0,r.jsx)(i.li,{children:"Durable object (locks, key/value, sequences) storage"}),"\n"]}),"\n",(0,r.jsx)(i.h2,{id:"rocksdb-in-kahuna",children:"RocksDb in Kahuna"}),"\n",(0,r.jsxs)(i.p,{children:["RocksDB is a high-performance embedded database optimized for fast, low-latency writes and efficient range queries. It\u2019s built on top of ",(0,r.jsx)(i.strong,{children:"LevelDB"}),", with significant enhancements for production workloads, especially under write-intensive conditions."]}),"\n",(0,r.jsxs)(i.p,{children:["In Kahuna, the RocksDb instance is divided into a fixed number of column families and each ",(0,r.jsx)(i.strong,{children:"partition (Raft group)"})," points to a specific column family. It provides:"]}),"\n",(0,r.jsxs)(i.ul,{children:["\n",(0,r.jsxs)(i.li,{children:[(0,r.jsx)(i.strong,{children:"Durable WAL"}),": WAL logs are used by Raft (via ",(0,r.jsx)(i.code,{children:"Kommander"}),") to persist write proposals."]}),"\n",(0,r.jsxs)(i.li,{children:[(0,r.jsx)(i.strong,{children:"Key/Value Store"}),": The K/V entries themselves (locks, user keys, sequences, metadata) are stored in RocksDB\u2019s internal SST format."]}),"\n"]}),"\n",(0,r.jsxs)(i.p,{children:["This design ensures ",(0,r.jsx)(i.strong,{children:"write throughput, crash safety"}),", and ",(0,r.jsx)(i.strong,{children:"independent compaction"})," per partition."]}),"\n",(0,r.jsx)(i.h3,{id:"internal-architecture-overview",children:"Internal Architecture Overview"}),"\n",(0,r.jsxs)(i.p,{children:["RocksDB is based on a ",(0,r.jsx)(i.strong,{children:"Log-Structured Merge Tree (LSM)"})," architecture. Writes and reads are handled as follows:"]}),"\n",(0,r.jsx)(i.h4,{id:"write-path",children:"Write Path:"}),"\n",(0,r.jsxs)(i.ul,{children:["\n",(0,r.jsxs)(i.li,{children:["MemTable + WAL: Incoming writes are first appended to an in-memory buffer (",(0,r.jsx)(i.code,{children:"MemTable"}),") and a disk-backed Write-Ahead Log (",(0,r.jsx)(i.code,{children:"WAL"}),"). This ensures durability."]}),"\n",(0,r.jsxs)(i.li,{children:["MemTable Flush: When the MemTable is full, it's flushed to disk as an ",(0,r.jsx)(i.strong,{children:"SST (Sorted String Table)"})," file in Level-0."]}),"\n",(0,r.jsx)(i.li,{children:"Compaction: RocksDB compacts SST files in the background to merge data and reduce read amplification. It uses multi-level compaction (Level-0 to Level-N), optimizing space and performance."}),"\n"]}),"\n",(0,r.jsx)(i.h4,{id:"read-path",children:"Read Path:"}),"\n",(0,r.jsxs)(i.ul,{children:["\n",(0,r.jsx)(i.li,{children:"Reads check the MemTable first, then query SST files from top to bottom."}),"\n",(0,r.jsxs)(i.li,{children:["An optional ",(0,r.jsx)(i.strong,{children:"Bloom Filter"})," and ",(0,r.jsx)(i.strong,{children:"block cache"})," are used to speed up lookups."]}),"\n"]}),"\n",(0,r.jsx)(i.h3,{id:"why-rocksdb",children:"Why RocksDB?"}),"\n",(0,r.jsx)(i.p,{children:"Kahuna favors RocksDB for persistent deployments where:"}),"\n",(0,r.jsxs)(i.ul,{children:["\n",(0,r.jsx)(i.li,{children:"High write volume and durability are critical."}),"\n",(0,r.jsx)(i.li,{children:"Fine-tuned compaction and flush control are needed."}),"\n",(0,r.jsx)(i.li,{children:"Performance at scale (many partitions, many keys) is a priority."}),"\n"]}),"\n",(0,r.jsx)(i.h2,{id:"sqlite-in-kahuna",children:"SQLite in Kahuna"}),"\n",(0,r.jsxs)(i.p,{children:["SQLite is a lightweight, self-contained SQL database engine widely used in embedded systems. It uses a ",(0,r.jsx)(i.strong,{children:"B-Tree"})," storage engine and supports ACID-compliant transactions out of the box."]}),"\n",(0,r.jsx)(i.p,{children:"Each partition (Raft group) can optionally use its own SQLite instance, backed by a file on disk. This setup:"}),"\n",(0,r.jsxs)(i.ul,{children:["\n",(0,r.jsxs)(i.li,{children:["Provides a full transactional K/V layer by mapping keys to rows in a ",(0,r.jsx)(i.code,{children:"KeyValue"})," table."]}),"\n",(0,r.jsx)(i.li,{children:"Uses WAL for fast, append-only writes (ideal for Raft log entries)."}),"\n"]}),"\n",(0,r.jsx)(i.p,{children:"Though designed for single-node usage, SQLite\u2019s simplicity and minimal overhead make it a good option for lightweight and embedded Kahuna deployments."}),"\n",(0,r.jsx)(i.h3,{id:"internal-architecture-overview-1",children:"Internal Architecture Overview"}),"\n",(0,r.jsxs)(i.p,{children:["SQLite stores all data in a single file and uses a ",(0,r.jsx)(i.strong,{children:"B-Tree"})," structure for indexing and data organization."]}),"\n",(0,r.jsx)(i.h4,{id:"write-path-1",children:"Write Path:"}),"\n",(0,r.jsxs)(i.ol,{children:["\n",(0,r.jsxs)(i.li,{children:["\n",(0,r.jsxs)(i.p,{children:[(0,r.jsx)(i.strong,{children:"WAL Mode"})," (Write-Ahead Logging):"]}),"\n",(0,r.jsxs)(i.ul,{children:["\n",(0,r.jsx)(i.li,{children:"All write operations are first appended to a WAL file instead of modifying the main database file directly."}),"\n",(0,r.jsx)(i.li,{children:"This makes writes faster and more crash-resistant."}),"\n"]}),"\n"]}),"\n",(0,r.jsxs)(i.li,{children:["\n",(0,r.jsxs)(i.p,{children:[(0,r.jsx)(i.strong,{children:"Checkpointing"}),":"]}),"\n",(0,r.jsxs)(i.ul,{children:["\n",(0,r.jsxs)(i.li,{children:["Periodically, SQLite transfers WAL contents into the main DB file via a ",(0,r.jsx)(i.strong,{children:"checkpoint"})," process."]}),"\n",(0,r.jsx)(i.li,{children:"This reconciles in-memory data with durable storage."}),"\n"]}),"\n"]}),"\n",(0,r.jsxs)(i.li,{children:["\n",(0,r.jsxs)(i.p,{children:[(0,r.jsx)(i.strong,{children:"Atomic Transactions"}),":"]}),"\n",(0,r.jsxs)(i.ul,{children:["\n",(0,r.jsx)(i.li,{children:"Multiple writes are grouped and committed atomically using journaling/WAL, maintaining consistency even in crash scenarios."}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,r.jsx)(i.h4,{id:"read-path-1",children:"Read Path:"}),"\n",(0,r.jsxs)(i.ul,{children:["\n",(0,r.jsx)(i.li,{children:"Reads access the main DB file or query the WAL if a newer version of a page exists there."}),"\n"]}),"\n",(0,r.jsx)(i.h3,{id:"why-sqlite",children:"Why SQLite?"}),"\n",(0,r.jsx)(i.p,{children:"SQLite is well-suited for:"}),"\n",(0,r.jsxs)(i.ul,{children:["\n",(0,r.jsxs)(i.li,{children:[(0,r.jsx)(i.strong,{children:"Low-resource environments"}),": Very small memory and disk footprint."]}),"\n",(0,r.jsxs)(i.li,{children:[(0,r.jsx)(i.strong,{children:"Ephemeral partitions"}),": Useful when full durability isn't critical."]}),"\n",(0,r.jsxs)(i.li,{children:[(0,r.jsx)(i.strong,{children:"Testing and simulations"}),": Quick setup, no external dependencies."]}),"\n",(0,r.jsxs)(i.li,{children:[(0,r.jsx)(i.strong,{children:"Simplicity"}),": Easy to inspect and debug data with SQL tools."]}),"\n"]}),"\n",(0,r.jsxs)(i.p,{children:["For high-volume, write-intensive production scenarios, ",(0,r.jsx)(i.strong,{children:"RocksDB"})," is preferred. But for simplicity, predictability, and ease of use, ",(0,r.jsx)(i.strong,{children:"SQLite"})," remains a valuable option in the Kahuna ecosystem."]}),"\n",(0,r.jsx)(i.h2,{id:"rocksdb-vs-sqlite",children:"RocksDB vs SQLite"}),"\n",(0,r.jsxs)(i.table,{children:[(0,r.jsx)(i.thead,{children:(0,r.jsxs)(i.tr,{children:[(0,r.jsx)(i.th,{children:"Feature"}),(0,r.jsx)(i.th,{children:(0,r.jsx)(i.strong,{children:"RocksDB"})}),(0,r.jsx)(i.th,{children:(0,r.jsx)(i.strong,{children:"SQLite"})})]})}),(0,r.jsxs)(i.tbody,{children:[(0,r.jsxs)(i.tr,{children:[(0,r.jsx)(i.td,{children:"Storage model"}),(0,r.jsx)(i.td,{children:"LSM Tree (log-structured)"}),(0,r.jsx)(i.td,{children:"B-Tree"})]}),(0,r.jsxs)(i.tr,{children:[(0,r.jsx)(i.td,{children:"Write performance"}),(0,r.jsx)(i.td,{children:"High (append-only, memtable + WAL)"}),(0,r.jsx)(i.td,{children:"Moderate (immediate page updates)"})]}),(0,r.jsxs)(i.tr,{children:[(0,r.jsx)(i.td,{children:"Read performance"}),(0,r.jsx)(i.td,{children:"Good for range queries & point lookups"}),(0,r.jsx)(i.td,{children:"Fast for small datasets"})]}),(0,r.jsxs)(i.tr,{children:[(0,r.jsx)(i.td,{children:"Concurrency"}),(0,r.jsx)(i.td,{children:"Highly concurrent (thread-safe reads)"}),(0,r.jsx)(i.td,{children:"Serialized writes (via WAL/mutex)"})]}),(0,r.jsxs)(i.tr,{children:[(0,r.jsx)(i.td,{children:"Durability"}),(0,r.jsx)(i.td,{children:"WAL + compaction"}),(0,r.jsx)(i.td,{children:"WAL-based, with journaling"})]}),(0,r.jsxs)(i.tr,{children:[(0,r.jsx)(i.td,{children:"Compaction"}),(0,r.jsx)(i.td,{children:"Automatic, multi-level"}),(0,r.jsx)(i.td,{children:"Not applicable"})]}),(0,r.jsxs)(i.tr,{children:[(0,r.jsx)(i.td,{children:"Binary size"}),(0,r.jsx)(i.td,{children:"Larger footprint"}),(0,r.jsx)(i.td,{children:"Very small (~500KB)"})]}),(0,r.jsxs)(i.tr,{children:[(0,r.jsx)(i.td,{children:"Best for"}),(0,r.jsx)(i.td,{children:"High-throughput, write-heavy workloads"}),(0,r.jsx)(i.td,{children:"Lightweight deployments, prototyping"})]})]})]})]})}function h(e={}){const{wrapper:i}={...(0,t.R)(),...e.components};return i?(0,r.jsx)(i,{...e,children:(0,r.jsx)(c,{...e})}):c(e)}},8453:(e,i,n)=>{n.d(i,{R:()=>a,x:()=>l});var s=n(6540);const r={},t=s.createContext(r);function a(e){const i=s.useContext(t);return s.useMemo((function(){return"function"==typeof e?e(i):{...i,...e}}),[i,e])}function l(e){let i;return i=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:a(e.components),s.createElement(t.Provider,{value:i},e.children)}}}]);