# Backup, Restore, and PITR

Read this page when you need to know exactly what a backup contains, how a restore can stop at a chosen moment, or why a backup or restore was refused. Kahuna builds backup and point-in-time recovery (PITR) from two existing durability layers:

- The **materialized storage backend**, which holds the state already flushed to RocksDB, SQLite, or memory
- The **[Raft](/docs/glossary/#raft) [write-ahead log (WAL)](/docs/glossary/#write-ahead-log-wal)**, which holds ordered and timestamped committed mutations

A full backup captures the materialized state. Incremental backups preserve later WAL entries. A restore combines both and can stop at a selected [Hybrid Logical Clock (HLC)](/docs/glossary/#hybrid-logical-clock-hlc) timestamp.

```text
storage checkpoint + optional intent frontier + committed WAL segments = state at timestamp T
```

For configuration and operator-facing behavior, see [Backups and Point-in-Time Recovery](/docs/backups-and-point-in-time-recovery/).

## Main Components

| Component | Responsibility |
|-----------|----------------|
| `BackupService` | Owns the driver and catalog, then exposes backup and restore operations through `IKahuna`. |
| `BackupDriver` | Creates full checkpoints and incremental WAL segments. |
| `BackupManifest` | Records backup identity, type, parent, partition ranges, checksums, and optional cluster snapshot time. |
| `BackupManifestMac` | Signs and verifies current-format manifests when a backup MAC key is configured. |
| `BackupCatalog` | Stores manifests, resolves parent chains, and validates their structure. |
| `BackupArtifactVerifier` | Verifies manifest schema, expected file sets, sizes, checksums, and path safety before publish or restore. |
| `BackupRetention` | Plans and applies chain-aware backup retention and orphan artifact sweeps. |
| `IBackupStorageTarget` | Abstracts manifest storage. |
| `IBackupArtifactStore` | Abstracts checkpoint and WAL artifact bytes. |
| `PitrHorizon` | Converts the configured time window into a protected WAL index for each partition. |
| `LogTimeIndex` | Locates committed WAL positions by HLC timestamp. |
| `SnapshotCoordinator` | Selects one HLC boundary for a coordinated multi-partition backup. |
| `RestoreEngine` | Replays incremental key/value mutations through a selected timestamp. |
| `IPersistenceBackend.CreateCheckpoint` | Produces the storage-specific base image. |

`BackupService` owns these internal components and exposes them through `IKahuna`. Kahuna Server maps that surface to REST and gRPC, while `Kahuna.Client`, the TypeScript client, and `kahuna-cli` provide public client operations.

## Full Backup Invariant

Committed state reaches the materialized backend asynchronously:

```text
client write
    -> Raft commit
    -> in-memory state
    -> background persistence queue
    -> RocksDB or SQLite
```

This creates a short interval where a mutation is committed in the WAL but not yet present on disk. `BackupDriver` must close that gap before taking a checkpoint.

The required order is:

```text
1. copy live prepared intents and their per-partition applied positions
2. capture M, the last committed WAL index
3. wait until committed writes through M have applied and entered the persistence queue
4. flush pending persistent writes
5. create the backend checkpoint
6. fold the WAL into the prepared-intent frontier at each range end and verify that later records can be reconstructed
7. verify artifact bytes against size and digest records
8. write the backup manifest claiming coverage through M
```

Capturing `M` before the flush is essential. If the code flushed first and read `M` later, a write could commit between those operations. The manifest would claim that write even though it was not included in the checkpoint.

Writes may still commit after `M` but before the checkpoint. The checkpoint can therefore contain more state than its manifest claims. This is safe because later replay uses revision-keyed upserts and is idempotent.

The apply barrier is equally important. A committed write may still be waiting to apply to in-memory state, and the flush can only persist what has already applied. The barrier waits only for committed writes above each partition's persisted application-durability floor, which avoids waiting again for state already durably recovered after restart. `BackupApplyBarrierTimeout` (`--backup-apply-barrier-timeout-seconds`, default 30 seconds) bounds the wait. If the barrier times out, capture reports all lagging partitions as retryable `PartitionCaptureFailed`; a backend that cannot durably flush or produce an exact image fails with `ExactCheckpointUnavailable`. Neither publishes a checkpoint that might omit committed data.

Active partitions contribute a `PartitionBackupRange` from index `1` through their captured committed index. Draining and removed partitions are skipped.

## Storage Checkpoints

Each backend implements `CreateCheckpoint(destinationPath, appliedIndex, appliedTime)`:

- **RocksDB** uses the native checkpoint facility. Existing immutable files can be hard-linked when supported by the filesystem.
- **SQLite** copies each shard with `VACUUM INTO` while holding that shard's exclusive lock. Writes to the shard pause during its copy.
- **Memory** serializes key/value and lock tables to JSON files. `OpenCheckpoint` can reopen this representation for restore tests, while PITR replay still applies only key/value mutations. It is useful for testing, not durable production recovery.

Every checkpoint includes `checkpoint.manifest`, which records the applied WAL index and HLC as plain JSON. The checkpoint is first written to a temporary sibling path and then moved into place so a failed operation does not leave a partial directory that appears complete.

Current manifests record the backup ID, creation time, the artifact format version, per-file SHA-256 checksums, per-file sizes, covered partitions, and the required artifact names for the backup type. Legacy manifests are listed honestly as unsupported rather than treated as valid current artifacts.

Current manifests also record the configured backup cluster ID and the node that produced the backup. Chain validation rejects a chain that mixes different non-empty cluster IDs. When `BackupMacKeyFile` is configured, Kahuna signs manifest identity, coverage, and digest metadata with HMAC-SHA-256 and verifies it before restore.

Full backup artifacts use this shape:

```text
artifacts/
  <backup-id>/
    checkpoint/
      checkpoint.manifest
      <backend files>
catalog/
  <backup-id>.manifest
```

## Incremental Backups

An incremental backup begins at `parent.ToIndex + 1` for each partition. `BackupDriver` pages through the WAL and copies only committed entries into `partition_<id>.wal` segment files.

```text
full:         partition 7, indexes 1..100
incremental:  partition 7, indexes 101..145
incremental:  partition 7, indexes 146..190
```

Before reading a segment, the driver compares its starting index with the partition's actual WAL compaction floor, both before and after taking its retention hold. A newer application checkpoint alone does not require a full. If required entries have already been removed, the public incremental API takes a new full backup instead and marks the returned DTO with `RequestedKind = Incremental`, `ActualKind = Full`, and a `SubstitutionReason`. Direct facade failures expose `NeedsFull` instead of substituting. Missing indexes inside the claimed range fail closed rather than publishing holes.

Topology divergence from a stamped ancestor (a membership change or a partition split or merge) also requires a new full, which the backup service substitutes the same way. Ancestors without a topology stamp keep the legacy compatibility path, so the absence of a stamp is not proof that the topology matched.

Each incremental manifest points to its immediate parent. Segment files receive SHA-256 checksums, and manifest writes use a temporary file followed by an atomic move.

Incremental segment files are JSON Lines, one `WalSegmentEntry` per line. Restore streams them one record at a time instead of loading the whole segment into memory. It verifies each segment immediately before replay and stages the exact bytes that will be consumed, which reduces verify-then-use races. Older single-array segment files are still readable for compatibility, but current artifacts use the streaming format.

## Chain Validation

`BackupCatalog.ResolveAndValidate` walks parent links from the selected backup to its root, reverses the result into chronological order, and validates it before replay.

The chain must satisfy these rules:

1. It is not empty.
2. Its first entry is a full backup.
3. Every later entry is incremental.
4. Every parent ID matches the previous manifest.
5. Partition ranges are contiguous: the next `FromIndex` equals the previous `ToIndex + 1`.
6. Parent links do not contain a cycle.

A missing manifest or index gap is an error. Restore does not attempt to produce a partial result from a broken chain.

Under replica placement, a node may host only some partitions. Backup manifests record both the cluster partition set and the partitions covered by that artifact. Before restore or PITR bootstrap, Kahuna validates that every stamped manifest independently covers every cluster partition; coverage cannot be assembled from the union of different links. If not, it fails with `RestrictedCoverage` rather than producing a partial cluster image.

Artifact validation is separate from structural chain validation. Before restore trusts bytes, `BackupArtifactVerifier` checks:

- Manifest schema and supported format version
- Missing, extra, duplicated, or unsafe artifact paths
- Size and checksum key-set agreement
- File length and SHA-256 digest
- Symlinks or reparse points at the artifact root or below it
- Segment contents against the partition ranges declared in the manifest

## PITR Retention Floor

Normal Raft checkpointing allows old WAL entries to be compacted. PITR must retain them long enough to connect a base checkpoint to the oldest allowed restore time.

`PitrHorizon` computes a boundary for each partition:

```text
boundary = now - PitrWindow - BaseSnapshotInterval
```

`LogTimeIndex.LastIndexAtOrBefore` finds the largest committed index at or before that HLC boundary. The background writer supplies this protected index to Raft as the minimum retained position.

`LogTimeIndex` performs binary-search-style probes over WAL indexes. Proposed and rolled-back entries may appear between committed entries, so each probe pages forward until it finds a committed entry or reaches the tail. Its correctness depends on committed HLC timestamps being monotonically non-decreasing with WAL index.

If no retained committed entry exists at or before the boundary, the floor uses the first retained committed index; if no committed entry remains, it uses the first index the WAL can hold. It stays positive under load instead of clearing the protection immediately after compaction. Log-time searches start at the compaction floor. This protects available history going forward and cannot recover an already-removed prefix.

## Point-in-Time Replay

Restore is an offline two-part operation:

1. The caller resolves and validates the chain, then opens the root full checkpoint into the destination backend.
2. `RestoreEngine` processes incremental manifests in order and replays their partition segments.

For each segment, entries are ordered by WAL index. Replay decodes key/value entries and applies only those whose transaction commit HLC is at or before the target:

```text
entry.payload.LastModified <= targetTime
```

The commit HLC is the timestamp shared by every participant of a committed transaction. Cutting on it includes or excludes a distributed transaction as a whole. The per-partition WAL entry time is not used as the cut axis because different partitions may append the same transaction at different local times.

Commit HLC is not globally monotonic with WAL index across independent coordinators, so replay does not stop at the first entry beyond the target. It skips entries beyond the target and keeps scanning. Mutations are written in batches of 256.

Key/value messages are decoded through the same `KeyValueMessageDecoder` used by normal log restoration. Writes are upserts keyed by key and revision, making replay restartable after interruption.

Only Raft-committed WAL entries are stored in backup segments. A transaction prepare is itself a committed Raft delta and can appear before the transaction has a commit decision. Replay retains prepares for reconstruction; an unfinished or aborted transaction does not become a visible key/value mutation merely because its prepare is present.

:::caution Current PITR image scope

`RestoreEngine` replays key/value replication messages. Sequence state is stored in the key/value subsystem and is replayed. PITR does not restore lock state, including persistent locks: the as-of checkpoint behind a full backup deletes every lock record from the copy, and replay skips lock WAL entries. After a restore, clients must acquire their locks again. Range metadata is owned by cluster membership and partition-management flows and should be recovered through normal cluster catch-up.

:::

## Exact Cuts and Pruned History

Backends may prune old persisted revisions to bound storage. A point-in-time cut can be exact only if every key still has the boundary revision needed to reconstruct the value at that cut.

Kahuna persists a monotonic pruned-history floor before deleting the revisions it accounts for. A full backup whose requested cut falls below that floor fails closed with `ExactCheckpointUnavailable`. If a backend cannot read a trustworthy floor, it behaves conservatively rather than assuming all history still exists.

No-revision writes have no historical boundary to roll back through. If a no-revision key was modified after the requested cut, Kahuna refuses the exact checkpoint instead of silently including a value from after the cut.

## Restore Staging and Target Safety

Restore first validates the chain and artifacts, then copies the full checkpoint into a private staging sibling, verifies the staged checkpoint copy, opens the destination backend, and replays incrementals. Only after the replay succeeds does it atomically rename the staging directory into the final target path.

`BackupService` refuses unsafe targets:

- Existing non-empty destinations
- Symlinked destinations or symlinked descendants under a configured restore root
- Targets outside `RestoreRoot` when one is configured
- Targets that overlap the backup directory or live storage directory

Remote restore is refused by default unless `RestoreRoot` is configured or `AllowUnconfinedRemoteRestore` is explicitly enabled.

## Backup Garbage Collection

Backup GC has two planners:

- `PlanOrphanSweep` finds temporary, staging, quarantine, merge, and artifact directories that no valid manifest owns.
- `PlanRetention` keeps the newest chains that satisfy `BackupRetentionMaxChains`, `BackupRetentionMaxAge`, and `BackupRetentionMaxBytes`.

Retention works on whole chains. A retained leaf pins its full parent closure, and a deleted chain is removed descendants-first. Delete removes the manifest before artifacts, so a crash during GC cannot leave a manifest pointing at absent files.

GC runs inline after backups and on `BackupGcInterval`. The public API can run it on demand or as a dry run, returning retention deletions, orphan reclamations, reclaimed bytes, and whether the pass was applied.

## Production Hardening

`BackupDir` is validated before use. On POSIX, Kahuna refuses symlinked or group/world-writable backup roots and creates backup files with restrictive permissions. Restore target confinement remains separate and is governed by `RestoreRoot`.

Coordinated backups are owned by the current leader of [partition 0](/docs/glossary/#partition-0) (the system partition). Non-coordinator nodes reject coordinated backup requests with `NotBackupCoordinator` instead of producing partial cluster backups. If topology or membership changes while a backup is being built, the operation fails with `TopologyChanged` and publishes nothing.

Backup manifests and artifacts are stored through separate contracts. The built-in target stores both under the local backup directory. Other targets can be registered by the host so artifact bytes live in object storage or another external system, with local scratch space used when the storage engine must first create a filesystem checkpoint.

Backup and restore errors returned to remote callers are sanitized and carry an operation ID. The full path and backend exception detail stay in server logs under the same ID.

## Coordinated Cluster Timestamp

WAL indexes are local to partitions, so index `100` on one partition is unrelated to index `100` on another. A coordinated backup uses one HLC timestamp `T` and caps every partition at its last committed entry where `Time <= T`.

Durable participants share one coordinator-minted commit HLC, but their partition-local append times may differ. The risk during capture is partial materialization: one participant's row can reach the checkpoint before another's, despite sharing a commit timestamp. The cut selection and verification below prevent that.

`SnapshotCoordinator` asks [actor](/docs/glossary/#actor) shards for the earliest transaction currently preparing, across live prepared [intents](/docs/glossary/#write-intent) and prepared actor intents:

- If an in-flight commit exists at timestamp `M`, the coordinator chooses the immediate HLC predecessor of `M`.
- If the cluster is quiescent, it chooses the maximum committed HLC found across active partitions.
- If the cluster is empty, it returns `HLCTimestamp.Zero`.

Choosing a timestamp before active commits prevents the backup from cutting through a transaction currently preparing. Restore then cuts key/value replay on the shared commit HLC carried by the transaction payload, so an already committed distributed transaction is applied whole or skipped whole.

## Restore and Cluster Membership

Restore reconstructs storage state; it does not register the node with a cluster. A restored node must still join through the normal membership path and catch up through Raft.

Keeping these operations separate prevents backup artifacts from depending on node identity or the current membership roster. It also allows a recent restore to seed a node before normal replication transfers the remaining WAL entries.

## Durable Materialization Replay

PITR tracks prepared intents from committed `preparedintent` deltas. It expands by-reference `MaterializeIntent` records (including legacy logged type `30`) and opt-in materializing settlement resolves from those prepares, using the transaction's commit HLC for the target-time filter. Recent duplicate settlement is tolerated. If neither a prepare nor recognized duplicate history can reconstruct a materializing resolve, restore fails closed rather than omitting a committed value.

Readers must support these encodings before producers enable them. Disabling an option later does not make older readers safe for existing records. See [Durable Settlement](/docs/internals/durable-settlement/#rolling-upgrades).

## Durable Intents Across a Full Backup Boundary

The full's optional `intent_frontier.pb` supplies prepares whose values would otherwise be absent from incremental replay. A full writes it only when reconstruction state is nonempty, and the manifest covers its size and checksum. It carries the prepared intents live at each partition range end, including their values, plus settled identities used to recognize duplicates. An incremental may contain only a by-reference materialization or a materializing settlement for a prepare that occurred inside the full's range; the frontier supplies the value that replay would otherwise lack.

`BackupDriver` copies live intents and applied positions before recording range ends; `IntentFrontier` folds the WAL into live and settled reconstruction state at those ends and checks records already present beyond each end, including entries not yet marked committed, with restore's expansion rules. If compaction removed a necessary prepare and neither the copy nor the fold supplies it, publication is refused with retryable `CutUnverified`. The check is fail-closed, not permission to ignore missing source data.

Restore verifies and stages the artifact and seeds prepares and settled identities before segment replay. Recognized duplicate by-reference records after settlement are skipped; unknown references fail closed. Full backups without a frontier restore without frontier staging and do not gain the missing reconstruction data. Older artifact verifiers reject the additional file, so restore readers must be upgraded before producers write fulls with a frontier.

For coordinated capture, `BackupService` opens a prepared-intent observation before choosing a cut. After checkpoint creation it confirms local application on every covered partition and verifies the observation's minimum commit timestamp is strictly above the cut. A failed check discards the image; after three attempts it reports `CutUnverified`. This verifies durable prepared-intent transactions, not every participant's actor-only ticket-path staging: persistent transactions on the ticket path, such as extend-only transactions, keep pending state on participant actors, and the coordinator sees only its own actors. See [Coordinated Cut](/docs/backups-and-point-in-time-recovery/#coordinated-cut) for scope and operational behavior.

## Composed Captures

`BackupService.Composed` assigns partition shares to materialized voters, captures them at an agreed cut, and merges checkpoint images plus intent frontiers into one backup. [Learners](/docs/glossary/#leader-follower-and-learner) and removing replicas are not capture sources. Every participating node needs backup configuration and the same storage engine. Share scratch defaults to `BackupScratchDir`, otherwise system temporary storage; shares are not separately published backups. The driver reports `LaggingPartitions` when its apply barrier expires; coordinated retries can reassign those `(node, partition)` pairs to other voters. Only the affected partitions move to another source, and a preferred source is not guaranteed to be caught up. A plain full remains local, while a composed incremental continues whole-cluster coverage and falls back to a coordinated full if necessary. Coverage validation checks each stamped link, not their union.

See [Capture Cost and Lagging Replicas](/docs/backups-and-point-in-time-recovery/#capture-cost-and-lagging-replicas) for barrier timeouts, scratch placement, staging fallback, and the capture I/O budget.
