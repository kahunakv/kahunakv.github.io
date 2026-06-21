# Backup, Restore, and PITR

Kahuna builds backup and point-in-time recovery (PITR) from two existing durability layers:

- The **materialized storage backend**, which holds the state already flushed to RocksDB, SQLite, or memory
- The **Raft write-ahead log (WAL)**, which holds ordered and timestamped committed mutations

A full backup captures the materialized state. Incremental backups preserve later WAL entries. A restore combines both and can stop at a selected Hybrid Logical Clock (HLC) timestamp.

```text
storage checkpoint + committed WAL segments = state at timestamp T
```

For configuration and operator-facing behavior, see [Backups and Point-in-Time Recovery](/docs/backups-and-point-in-time-recovery/).

## Main Components

| Component | Responsibility |
|-----------|----------------|
| `BackupService` | Owns the driver and catalog, then exposes backup and restore operations through `IKahuna`. |
| `BackupDriver` | Creates full checkpoints and incremental WAL segments. |
| `BackupManifest` | Records backup identity, type, parent, partition ranges, checksums, and optional cluster snapshot time. |
| `BackupCatalog` | Stores manifests, resolves parent chains, and validates their structure. |
| `IBackupStorageTarget` | Abstracts manifest storage. The current implementation writes manifests to a local directory. |
| `PitrHorizon` | Converts the configured time window into a protected WAL index for each partition. |
| `LogTimeIndex` | Locates committed WAL positions by HLC timestamp. |
| `SnapshotCoordinator` | Selects one HLC boundary for a coordinated multi-partition backup. |
| `RestoreEngine` | Replays incremental key/value mutations through a selected timestamp. |
| `IPersistenceBackend.CreateCheckpoint` | Produces the storage-specific base image. |

`BackupService` owns these internal components and exposes them through `IKahuna`. Kahuna Server maps that surface to REST and gRPC, while `Kahuna.Client` and `kahuna-cli` provide public client operations.

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
1. capture M, the last committed WAL index
2. flush pending persistent writes
3. create the backend checkpoint
4. write the backup manifest claiming coverage through M
```

Capturing `M` before the flush is essential. If the code flushed first and read `M` later, a write could commit between those operations. The manifest would claim that write even though it was not included in the checkpoint.

Writes may still commit after `M` but before the checkpoint. The checkpoint can therefore contain more state than its manifest claims. This is safe because later replay uses revision-keyed upserts and is idempotent.

Active partitions contribute a `PartitionBackupRange` from index `1` through their captured committed index. Draining and removed partitions are skipped.

## Storage Checkpoints

Each backend implements `CreateCheckpoint(destinationPath, appliedIndex, appliedTime)`:

- **RocksDB** uses the native checkpoint facility. Existing immutable files can be hard-linked when supported by the filesystem.
- **SQLite** copies each shard with `VACUUM INTO` while holding that shard's exclusive lock. Writes to the shard pause during its copy.
- **Memory** serializes key/value and lock tables to JSON files. `OpenCheckpoint` can reopen this representation for restore tests.

Every checkpoint includes `checkpoint.manifest`, which records the applied WAL index and HLC as plain JSON. The checkpoint is first written to a temporary sibling path and then moved into place so a failed operation does not leave a partial directory that appears complete.

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

Before reading a segment, the driver compares its starting index with the partition's compaction floor. If required entries have already been removed, it refuses the incremental and requires a new full backup.

Each incremental manifest points to its immediate parent. Segment files receive SHA-256 checksums, and manifest writes use a temporary file followed by an atomic move.

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

## PITR Retention Floor

Normal Raft checkpointing allows old WAL entries to be compacted. PITR must retain them long enough to connect a base checkpoint to the oldest allowed restore time.

`PitrHorizon` computes a boundary for each partition:

```text
boundary = now - PitrWindow - BaseSnapshotInterval
```

`LogTimeIndex.LastIndexAtOrBefore` finds the largest committed index at or before that HLC boundary. The background writer supplies this protected index to Raft as the minimum retained position.

`LogTimeIndex` performs binary-search-style probes over WAL indexes. Proposed and rolled-back entries may appear between committed entries, so each probe pages forward until it finds a committed entry or reaches the tail. Its correctness depends on committed HLC timestamps being monotonically non-decreasing with WAL index.

If no committed entry exists at or before the boundary, the floor remains unknown and no positive retention index is applied.

## Point-in-Time Replay

Restore is an offline two-part operation:

1. The caller resolves and validates the chain, then opens the root full checkpoint into the destination backend.
2. `RestoreEngine` processes incremental manifests in order and replays their partition segments.

For each segment, entries are ordered by WAL index and therefore by HLC. Replay applies an entry only while:

```text
entry.Time <= targetTime
```

The first entry after the target stops replay for that partition. Mutations are written in batches of 256.

Key/value messages are decoded through the same `KeyValueMessageDecoder` used by normal log restoration. Writes are upserts keyed by key and revision, making replay restartable after interruption.

Only committed WAL entries are stored in backup segments. Prepared transaction intents and rolled-back entries are absent, so an unfinished transaction does not become visible during restore.

:::caution Current replay scope

The full checkpoint contains the backend's key/value and lock state at its base position. Incremental `RestoreEngine` replay currently converts only key/value replication messages. Sequence state is stored in the key/value subsystem and is replayed, but lock changes and key-range metadata after the full checkpoint are not applied by this restore path yet.

:::

## Coordinated Cluster Timestamp

WAL indexes are local to partitions, so index `100` on one partition is unrelated to index `100` on another. A coordinated backup uses one HLC timestamp `T` and caps every partition at its last committed entry where `Time <= T`.

`SnapshotCoordinator` asks actor shards for the earliest transaction currently preparing:

- If an in-flight commit exists at timestamp `M`, the coordinator chooses the immediate HLC predecessor of `M`.
- If the cluster is quiescent, it chooses the maximum committed HLC found across active partitions.
- If the cluster is empty, it returns `HLCTimestamp.Zero`.

Choosing a timestamp before active commits prevents the backup from cutting through a transaction currently preparing.

It does not provide an unconditional guarantee for a transaction that committed earlier with different partition-local commit timestamps on each participant. Those timestamps could straddle `T` after the live intents are gone. A complete fix requires one shared commit HLC across every participant. Until then, a quiescent cluster provides the strongest coordinated snapshot boundary.

## Restore and Cluster Membership

Restore reconstructs storage state; it does not register the node with a cluster. A restored node must still join through the normal membership path and catch up through Raft.

Keeping these operations separate prevents backup artifacts from depending on node identity or the current membership roster. It also allows a recent restore to seed a node before normal replication transfers the remaining WAL entries.
