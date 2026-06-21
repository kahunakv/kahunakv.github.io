# Backups and Point-in-Time Recovery

Kahuna's backup design combines storage-engine checkpoints with the committed Raft write-ahead log (WAL). This supports full backups, incremental backups, and recovery to a selected Hybrid Logical Clock (HLC) timestamp.

:::caution Current restore scope

Kahuna Server exposes backup and restore through REST, gRPC, `Kahuna.Client`, and `kahuna-cli`. Restore is offline: it writes a new storage directory and never replaces the live state of the node handling the request.

The current incremental restore path replays key/value mutations. It does not replay incremental lock or key-range metadata changes. Plan recovery procedures around this limitation and test them with the data types used by the application.

:::

## Backup Model

The three recovery operations use the same two artifacts:

| Operation | Artifacts | Purpose |
|-----------|-----------|---------|
| Full backup | Storage checkpoint and manifest | Creates a complete base image at a known WAL position. |
| Incremental backup | Committed WAL segments and manifest | Stores only changes since a parent backup. |
| Point-in-time restore | Full checkpoint and an incremental chain | Replays changes in order and stops at the requested HLC timestamp. |

A full backup is the root of a chain. Each incremental backup references its immediate parent and records a contiguous WAL range for every included partition.

```text
full checkpoint -> incremental -> incremental -> incremental
                    WAL delta      WAL delta      WAL delta
```

Kahuna validates the complete chain before restore. It rejects missing parents, cycles, a chain that does not begin with a full backup, unexpected full backups in the middle of a chain, and gaps between partition WAL ranges.

## Recoverable Window

Kahuna retains a sliding interval of WAL history for point-in-time recovery. The default recovery window is one hour and the maximum is six hours.

| Server option | Default | Valid range | Description |
|---------------|---------|-------------|-------------|
| `--pitr-window` | `3600` seconds | More than `0`, up to `21600` | How far back a restore target may be. Increasing it retains more WAL and consumes more disk. |
| `--base-snapshot-interval` | `1800` seconds | More than `0`, no greater than `--pitr-window` | Intended interval between base checkpoints. A shorter interval reduces WAL replay during restore but creates checkpoints more often. |
| `--pitr-backup-dir` | empty | Writable directory path used for backup manifests and artifacts. Kahuna creates it when needed. Backup APIs are disabled when this is empty. |

For example, retain four hours of recoverable WAL and plan hourly base checkpoints with:

```bash
dotnet Kahuna.Server.dll \
  --pitr-window 14400 \
  --base-snapshot-interval 3600
```

Invalid values are normalized at startup: a non-positive PITR window becomes one hour, a window over six hours is capped at six hours, a non-positive snapshot interval becomes 30 minutes, and an interval longer than the window is reduced to the window.

Kahuna computes a protected WAL floor around:

```text
now - PitrWindow - BaseSnapshotInterval
```

Raft compaction must not remove entries at or above this floor. The extra snapshot interval keeps enough history to connect an available base checkpoint to the oldest recoverable timestamp.

:::note

`--base-snapshot-interval` participates in retention calculations. It does not schedule backups automatically. Trigger backups through the CLI, .NET client, REST, or gRPC API.

:::

## Create and Inspect Backups

Configure the server first:

```bash
dotnet Kahuna.Server.dll \
  --pitr-backup-dir /var/lib/kahuna/backups \
  --pitr-window 14400 \
  --base-snapshot-interval 3600
```

The backup catalog is local to the node receiving the request. Keep clients pointed at the same node when creating an incremental chain or inspecting that node's catalog.

### Kahuna CLI

```bash
# Full backup
kahuna-cli -c "https://kahuna-1:8082" --backup-full

# Coordinated full backup, recommended for a multi-partition production snapshot
kahuna-cli -c "https://kahuna-1:8082" --backup-coordinated

# Incremental backup using the previous backup as its parent
kahuna-cli -c "https://kahuna-1:8082" \
  --backup-incremental \
  --parent-backup-id <backup-id>

# Inspect the local catalog and validate a chain
kahuna-cli -c "https://kahuna-1:8082" --list-backups
kahuna-cli -c "https://kahuna-1:8082" --backup-chain <leaf-backup-id>
```

Add `--format json` for machine-readable output. Interactive mode supports `backup full`, `backup coordinated`, and `list backups`.

### .NET Client

```csharp
using Kahuna.Client;
using Kahuna.Shared.Communication.Rest;

var client = new KahunaClient("https://kahuna-1:8082");

KahunaBackupInfo full = await client.TakeCoordinatedBackupAsync();
KahunaBackupInfo incremental =
    await client.TakeIncrementalBackupAsync(full.BackupId);

List<KahunaBackupInfo> backups = await client.ListBackupsAsync();
List<KahunaBackupInfo> chain =
    await client.GetBackupChainAsync(incremental.BackupId);
```

The client supports full, incremental, and coordinated backups over REST or gRPC communication.

## Restore to a New Directory

`RestoreAsync` and `--restore` copy the chain's full checkpoint into a target directory and replay incremental entries. A target time of `0` restores through the natural end of the selected chain. A positive target is the HLC physical component expressed as Unix epoch milliseconds.

```bash
# Restore the complete chain
kahuna-cli -c "https://kahuna-1:8082" \
  --restore <leaf-backup-id> \
  --target-dir /var/lib/kahuna/restored

# Restore to a specific time
kahuna-cli -c "https://kahuna-1:8082" \
  --restore <leaf-backup-id> \
  --target-dir /var/lib/kahuna/restored-at-t \
  --target-time-ms 1781478000000
```

The target path is on the filesystem of the server node handling the request, not the machine running `kahuna-cli`.

The equivalent .NET call is:

```csharp
KahunaRestoreResponse restored = await client.RestoreAsync(
    leafBackupId: incremental.BackupId,
    targetDir: "/var/lib/kahuna/restored",
    targetTimeMs: 0
);
```

Start a fresh node against the restored directory using the same storage adapter and storage revision as the backup source. Hot in-place restore of a running node is not supported.

## Bootstrap a Joining Node

A new node can seed its persistence backend and WAL from a backup before joining an existing cluster. Normal Raft catch-up then transfers changes after the restore point.

```bash
dotnet Kahuna.Server.dll \
  --join-existing \
  --initial-cluster https://kahuna-1:8082 https://kahuna-2:8082 \
  --pitr-backup-dir /var/lib/kahuna/backups \
  --pitr-bootstrap-from <leaf-backup-id> \
  --pitr-target-time-ms 1781478000000
```

Omit `--pitr-target-time-ms` or set it to `0` to bootstrap through the chain's natural end. The backup ID must resolve to a valid chain inside the configured PITR window.

## HTTP API

| Method | Path | Operation |
|--------|------|-----------|
| `POST` | `/v1/backups/full` | Create a full backup |
| `POST` | `/v1/backups/incremental` | Create an incremental backup with `{"parentBackupId":"<guid>"}` |
| `POST` | `/v1/backups/coordinated` | Create a coordinated full backup |
| `GET` | `/v1/backups` | List the local catalog |
| `GET` | `/v1/backups/{id}/chain` | Resolve and validate a chain |
| `POST` | `/v1/backups/validate-chain` | Validate the chain identified by `leafBackupId` |
| `POST` | `/v1/restore` | Restore a chain into `targetDir` through `targetTimeMs` |

The equivalent gRPC `Backups` service exposes `TakeFullBackup`, `TakeIncrementalBackup`, `TakeCoordinatedBackup`, `ListBackups`, `GetBackupChain`, `ValidateChain`, and `Restore`. Backup endpoints return unavailable when `--pitr-backup-dir` is not configured on the target node.

## Full Backups

A full backup performs these operations in order for active partitions:

1. Record the last committed WAL position covered by the backup.
2. Flush pending persistent writes to the materialized storage backend.
3. Create a storage-engine checkpoint.
4. Write a manifest containing the backup ID, creation time, partition ranges, checksums, and optional cluster snapshot timestamp.

Recording the committed position before the flush is important. It guarantees the checkpoint contains at least every mutation promised by the manifest, including mutations that were committed but still waiting in the background persistence queue.

Checkpoint behavior depends on the storage adapter:

- RocksDB uses its checkpoint facility, which can hard-link existing database files where the filesystem permits it.
- SQLite creates a consistent copy of its sharded database files. Writes to a shard can pause while that shard is copied.
- The memory backend serializes key/value and lock state to checkpoint files. It is useful for testing, not durable production recovery.

Checkpoint directories and manifests are created through temporary paths and moved into place, preventing an interrupted write from appearing as a complete artifact.

## Incremental Backups

An incremental backup reads committed WAL entries after its parent's final index and writes one segment per partition. It pages through the WAL instead of loading an unbounded log into memory.

Incremental backups are proportional to the write volume since the parent, not the total dataset size. However, every required WAL entry must still be available. If compaction has advanced beyond the incremental's starting index, Kahuna rejects the operation and requires a new full backup.

Keep the checkpoint, every incremental artifact, and every manifest in the chain together. A missing artifact or manifest makes later descendants unusable for restore.

## Point-in-Time Restore

To reconstruct state at timestamp `T`, the restore process:

1. Selects a `T` covered by the full checkpoint and incremental chain.
2. Resolves and validates the selected backup chain.
3. Opens the root full checkpoint in the destination backend.
4. Replays incremental WAL segments in partition order.
5. Applies committed key/value entries whose HLC is less than or equal to `T` and stops before the first entry after `T`.

Restore writes are idempotent upserts keyed by key and revision. An interrupted incremental replay can be restarted without creating duplicate logical revisions.

Only committed WAL entries are included. Prepared but uncommitted transaction intents are absent, so an unfinished transaction does not become visible after restore.

## Coordinated Cluster Snapshots

Each Raft partition has its own WAL position, so a log index cannot identify one cluster-wide moment. Coordinated backups instead select one HLC timestamp and cap every partition at that timestamp.

The coordinator chooses a timestamp strictly before the earliest transaction currently preparing across the scanned partitions. This prevents a transaction that is actively committing from being split by the snapshot boundary.

This is not an unconditional guarantee for every earlier cross-partition transaction because participants currently receive partition-local commit timestamps. For the strongest operational consistency, take coordinated backups during a quiet write period until Kahuna assigns one shared commit timestamp to every participant.

## Operational Planning

- Estimate retained WAL storage as approximately `PitrWindow * WAL write rate`, plus overlapping base checkpoints.
- Use a shorter base snapshot interval when restore speed is more important than checkpoint overhead.
- Archive full backups externally when recovery beyond six hours is required. The live PITR window is intentionally bounded.
- Store backup artifacts on durable storage separate from the node's live data directories.
- Treat the manifest catalog and its referenced artifacts as one recovery set.
- Verify SHA-256 checksums and validate the chain before modifying a destination data directory.
- Perform restores offline. Restoring data does not add the restored node to cluster membership.

A restored node can seed a later cluster join, but membership and Raft catch-up are separate operations. If its restore point is still within retained history, replicas can transfer only the remaining log. Otherwise, normal cluster recovery may require a complete state transfer.
