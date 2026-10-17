# Seed a Joining Node from a PITR Backup

When a new node joins a cluster, it starts empty. Normally each partition leader sends it a complete copy of the partition (a Raft snapshot) over the network, and then the log entries that follow. With large partitions, this full transfer takes time, uses network bandwidth, and adds memory and I/O load to the leaders while they also serve traffic.

**PITR bootstrap** lets the new node load most of that data from an existing [backup](/docs/backups-and-point-in-time-recovery/) instead. The node restores the backup locally, and then asks the leaders only for the changes committed after the backup point. Use it when:

- You add nodes to a cluster with a large data set, and a full snapshot transfer per partition is slow or expensive.
- You replace a failed node and want it to serve again sooner.
- You already take regular backups to storage the new node can read.

You do not need it for small clusters or small data sets: the normal join path works without any extra configuration. The backup must also be recent enough: a chain older than the PITR retention window stops startup, unless `--pitr-bootstrap-fallback-to-join` is set, in which case the seed is skipped and the node joins through the normal path.

In detail, PITR bootstrap initializes an empty node from a backup chain, then joins the existing cluster and catches up through Raft. It restores data and establishes the WAL snapshot boundaries that tell the leader where catch-up should start. Opening a restored data directory with an empty WAL alone does not establish those boundaries; the node can still present at index zero and receive a replacement snapshot.

This is a **server/embedded-host** facility. The [Kubernetes operator](/docs/kubernetes-operator/) does not automatically provision backup access or invoke it for scale-up nodes. A seed also does not recover cluster membership by itself or turn a partial backup into a cluster-wide image.

## Startup Configuration

On a joining server, add these options alongside its normal identity, listener, TLS, storage, and WAL configuration:

```bash
kahuna-server \
  --join-existing \
  --initial-cluster https://kahuna-1:8082 https://kahuna-2:8082 \
  --storage rocksdb --storage-path /var/lib/kahuna/data --storage-revision v1 \
  --wal-storage rocksdb --wal-path /var/lib/kahuna/wal \
  --pitr-backup-dir /var/lib/kahuna/backups \
  --pitr-backup-cluster-id production \
  --pitr-bootstrap-from latest \
  --pitr-bootstrap-fallback-to-join
```

`--pitr-bootstrap-from` accepts a leaf backup GUID or `latest`. It requires `--join-existing`, seed peers, and a backup directory. RocksDB and SQLite are supported for the base-image step; memory storage is refused. Storage engine and storage revision must match the full backup.

Omit `--pitr-target-time-ms` or set it to zero to use the chain's natural end. A nonzero value selects an inclusive end-of-millisecond HLC target within chain coverage. An embedded host can call `IKahuna.BootstrapFromPitrBackupAsync` before joining; that already-open-backend API expects the full checkpoint to have been loaded separately. The server startup path performs the pre-open base-image copy described below.

## What Startup Does

1. Resolve and validate the chain through the configured backup target. Enforce backup-root permissions, manifest authentication when a MAC key is configured, cluster identity checks, partition coverage, storage compatibility, and retention-window checks.
2. Before opening the backend, copy the full's `checkpoint/` objects to staging inside the storage path. Verify file sizes and digests against the manifest, then publish them under `kahuna-pitr-seed.json`.
3. Open the backend and replay incremental records, using the full's prepared-intent frontier where necessary.
4. Install each restored partition's checkpoint as a certified WAL **snapshot boundary**, retaining its range HLC, and raise the application-durability floor to that index without lowering an existing floor.
5. Mark the seed complete, then join. Normal Raft replication supplies the subsequent state; the backup is not assumed current indefinitely.

RocksDB's base image goes under `<storage-path>/<storage-revision>/`; SQLite uses the storage root. Registered backup storage providers can supply the objects through the same abstraction as restore. The stock server does not register a GCS provider merely because `--pitr-backup-target` names one; deploy a host/provider that supports it or make a local catalog and artifacts available.

A configured `--pitr-backup-mac-key-file` requires authenticated manifests just as restore does. For an explicitly selected chain, a manifest cluster ID differing from this node's nonempty configured backup cluster ID is refused; legacy manifests without an ID remain accepted. With no configured cluster ID that extra identity guard is disabled. Configure a stable cluster ID and a MAC key for stronger provenance checks. Checksums alone detect corruption, not malicious replacement of both a manifest and its artifacts.

## `latest` and Fallback

`latest` considers structurally valid manifests matching the configured backup cluster ID exactly; when that ID is empty it considers all IDs. It orders candidates by the leaf's maximum covered commit HLC, breaking ties by creation time, and selects the newest chain that passes seed-chain and storage compatibility checks. Invalid candidates are skipped, not selected as usable data. This differs from explicitly naming a legacy unstamped chain, which may be accepted.

The retention guard requires the target not precede `now − PitrWindow − BaseSnapshotInterval`. By default an old chain, or no valid chain for `latest`, stops startup. `--pitr-bootstrap-fallback-to-join` permits those cases to log a skipped seed and join through normal catch-up with the empty store. It is not a repair mechanism: explicit-chain corruption, foreign identity, or failed authentication still fails. With `latest`, invalid candidates can leave no selectable chain, which is the no-chain fallback case; no invalid candidate is restored. Staged checkpoint-copy verification failures also stop startup.

## Restart and Crash Behavior

The marker makes leaving the flag configured across restarts safe for the implemented cases:

| Storage state | Action |
|---|---|
| No marker and no data for this backend/revision | Seed. Unrelated contents such as `lost+found` or another revision directory are preserved. |
| No marker but existing backend data | Skip. Existing node data is not overwritten. |
| Marker `Publishing` | Remove the names recorded by the interrupted publish, then retry the base-image step. |
| Marker `Materialized` | Resume replay and WAL seeding from the recorded chain. An explicit different backup ID is refused because the WAL may already contain part of the first seed. |
| Marker `Seeded` | Skip. Completed seeding is not repeated on that storage path. |

The marker is recovery state, not a request to overwrite an existing cluster. Keep it with the storage path. A partial replay/seed is idempotent under the same chain. Inspect failures before changing backup IDs or paths; mixing an old WAL with a different base image is not a supported reseed workflow. Bootstrap failures are exposed as typed `KahunaBackupException` outcomes at the node API and detailed startup logs.

## Operational Limits

- Restore/seed chains must cover the complete recorded cluster partition set. With replica placement, a node-local backup may return `RestrictedCoverage`; scheduling backups on one arbitrary pod is not sufficient for a complete seed.
- Membership changes and partition split/merge can invalidate incremental ancestry. The backup service substitutes a new full when topology has diverged; inspect `RequestedKind`, `ActualKind`, and `SubstitutionReason` rather than assuming every incremental request produced a segment.
- Retention protects available WAL going forward; it cannot recreate already-compacted entries. Missing indexes in a claimed incremental range fail closed instead of publishing holes.
- Join admission and initialization use `--raft-join-timeout`. Learner promotion has a separate no-progress timeout and may take longer while catch-up advances. See [join controls](/docs/server-configuration/#raft-membership-and-catch-up).
