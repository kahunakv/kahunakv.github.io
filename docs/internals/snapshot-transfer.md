# Snapshot Transfer Internals

When a replica falls too far behind to catch up from the log, for example a new replica or one that was offline for a long time, Kahuna copies the whole [partition](/docs/glossary/#partition) to it. Read this page when you investigate a slow or failed snapshot install, or the memory and disk it uses.

Kahuna registers whole-partition state transfer with Kommander, its [Raft](/docs/glossary/#raft) library. A replica that needs history older than the leader's Raft log floor (the oldest entry the leader still keeps) is seeded from the leader's snapshot and then replays the retained tail. This page describes how that snapshot is exported, verified, and installed. For when snapshots happen, their options, and their outcomes, see [Snapshot Installation and Raft Recovery](/docs/snapshot-and-raft-recovery/).

## What a Data-Partition Snapshot Carries

`PartitionStateTransfer` exports key/value rows, persistent lock state, completion receipts, transaction records, prepared [intents](/docs/glossary/#write-intent), and the committed-head/settled-transaction ledger for the partition. Ownership is derived from the range map or hash routing over the node-global backend.

Export uses a state-transfer-only writer flush: it drains queued backend writes and persists durability floors, without running revision pruning or waiting for its partition 0 catch-up confirmation. It then reads backend rows so the rows include state applied through the requested boundary. This is an **at-least boundary**, not an exact point-in-time image: pages and store slices can include later applies, and the receiver replays the retained tail idempotently. It is unsuitable as an operator backup cut.

Export writes paged, checksummed rows and store payloads into separate spillable buffers. Each buffer stays in memory up to 64 MiB, then uses a file under `{StoragePath}/snapshot-export_{StorageRevision}`. The complete export is still assembled before sending; this bounds individual buffer residency, not decoded state or total heap. Without a usable spill directory the buffers remain in memory. See [snapshot sizing and defaults](/docs/snapshot-and-raft-recovery/#snapshot-options).

Exports include revisions at registered holds and a recent continuous history window. Installation records its coverage before reporting success; older timestamps outside that coverage return `MustRetry`. A pin covers its exact timestamp only. See [historical coverage](/docs/distributed-keyvalue-store/snapshot-holds/#history-across-replica-and-range-moves).

[Partition 0](/docs/glossary/#partition-0) (the system partition) uses `MetaSystemStateTransfer` instead: it transfers the range map and snapshot-floor hold registry together. The data-partition streaming-install description below does not apply to that separate metadata decoder.

## Export Ordering

Whole-partition export captures prepared intents and the committed-head ledger before draining persistence, then scans rows and locks. This order ensures a captured head without its intent has its materialized row flushed before the scan. A by-reference replay already reflected by an installed snapshot verifies persisted row coverage; a ledger entry alone is not proof that the value exists. Missing reconstruction remains a [containment](/docs/internals/replication/#containment) condition (the node stops serving the partition and requests reseeding), not a silently skipped write.

## Verification and Installation

The receiver stages the complete transfer before installing it. Data-partition import makes two passes through the seekable staged stream:

1. **Verify before changing state.** Check the partition id, every page/store checksum, and decoding of receipts, records, and intents. Truncation, checksum failure, or undecodable store entries leave the prior state untouched. When `OnePhaseApplyTimeValidation` is enabled, a snapshot lacking the committed-head ledger is refused.
2. **Replace the owned state.** Mark the install incomplete; run the same state-transfer-only persistence drain; purge the old owned rows and store slices; stream in the replacement state. Release the old intent/ledger slice before building its replacement. Persist store snapshots, invalidate resident key/value and lock state, and record the install for watch resume. After every fallible hook, persist the application-durability floor at the installed boundary, never below an existing higher floor, then clear the incomplete marker and notify the live durability tracker. Reporting success before this floor is durable would let a restart request the snapshot it just installed, or let compaction use an obsolete floor.

## Batching and Memory

Backend batches flush at 4,096 rows or after accumulated value bytes reach 16 MiB. The byte threshold can be exceeded by the final row; it is not a maximum value size. Records and receipts are decoded one entry at a time. The intent/ledger section is still decoded as a whole for replacement, and the final installed state must fit the node. Streaming reduces temporary working memory; it does not make total memory independent of partition size.

A non-seekable input is copied once into pooled memory segments. Kommander's staged receive streams are seekable, including disk-backed streams.

## Partial Installs and Concurrency

Installation is **recoverable replacement, not a backend transaction over the entire partition**. A storage or invalidation-hook failure after mutation starts can leave partial rows. The incomplete marker remains; a retry purges that attempt's owned state before installing again. The marker records the interruption on disk, but there is no production caller of `IsInstallIncomplete`; the marker alone does not establish a startup serving fence. Automatic crash recovery from that marker must not be assumed.

A second import of the same partition while one runs is refused, rather than queued. The in-process install flag is released on success or failure; other partitions have independent install gates. Install and un-host purge of one partition cannot interleave. Cancellation or loss of a sender acknowledgement does not roll back an install already running through Kommander's installer.

## Install Timing

`kahuna.partition_install.phase_duration` records milliseconds tagged by `phase`: `verify`, `gate`, `drain`, `purge_rows`, `purge_stores`, `rows`, `stores`, `snapshots`, `floor`, `hooks`, and `total`. Every install logs a breakdown at Information; an install taking at least 10 seconds also logs at Warning and increments `kahuna.partition_install.slow_total`.

The purge log includes owned pages deleted, backend pages scanned, and rows in those pages. A purge can scan substantial node-wide storage while deleting little: its cost depends on the backend family, not only the installed partition's size. Use the dominant phase to distinguish writer drain, backend scanning, metadata decoding, and actor invalidation delays. An import holds the partition executor, so normal apply waits until it finishes.

## Startup Decoding

Transaction-record and receipt snapshot files are also decoded entry by entry at startup. Prepared intent snapshots are parsed directly from a file stream but still retain the decoded intent state.
