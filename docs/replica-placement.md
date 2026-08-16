# Replication Factor and Replica Placement

By default, Kahuna uses full replication: every voter stores every partition and participates in every partition's Raft quorum. This is simple and remains the default behavior.

For larger clusters, set a replication factor so each partition is stored on a smaller replica set:

```bash
kahuna-server \
  --initial-cluster https://kahuna-1:8082 https://kahuna-2:8082 https://kahuna-3:8082 \
  --raft-replication-factor 3 \
  --raft-enable-placement-rebalancer true
```

With replication factor `3`, each partition has three voter replicas. A node that does not host the target partition can still accept the client request and forward it to a hosting replica, so clients can continue to connect to any healthy node.

## Why It Matters

Full replication has a hard scaling ceiling: every node stores every partition, every persistent write is copied to every voter for that partition, and adding nodes can increase coordination cost instead of increasing usable storage.

Replication factor removes that ceiling. Kahuna can keep each partition replicated to a small quorum while spreading different partitions across the cluster. Adding nodes can add storage capacity, reduce per-node write amplification, and give the placement controller more room to distribute load.

This is different from coordination systems where every server must carry the full dataset. Kahuna still provides strongly consistent partitions, but the cluster does not have to make every node a replica of every partition.

It is not infinite scale by itself. Hot keys, partition count, network bandwidth, storage throughput, and transaction shape still matter. Replication factor gives Kahuna the horizontal scaling model needed to grow past the limits of full replication.

## When to Use It

Use full replication when the cluster is small or when every node must contain a complete copy of all data.

Use a positive replication factor when you want to:

- Add more nodes without copying every partition to every node
- Reduce disk usage and write amplification per node
- Keep the Raft quorum for each partition small and predictable
- Spread partitions across zones or racks

Prefer odd values. Replication factor `3` tolerates one failed replica for a partition. Replication factor `5` tolerates two. Even values usually add cost without improving failure tolerance.

If the configured replication factor is larger than the current cluster size, Kahuna uses the available voters and can place additional replicas after more nodes join.

## Placement Rebalancer

Initial placement is applied when a new cluster is bootstrapped with `--raft-replication-factor`.

The ongoing placement rebalancer is controlled separately:

```bash
kahuna-server \
  --raft-replication-factor 3 \
  --raft-enable-placement-rebalancer true \
  --raft-max-replica-moves-per-pass 2 \
  --raft-max-concurrent-replica-transfers 1
```

The rebalancer repairs under-replicated partitions, trims over-replicated partitions, and smooths replica-count skew. It moves data gradually so catch-up and snapshot transfer do not overwhelm foreground traffic.

Replica moves happen in stages:

1. Add a learner replica
2. Seed it from the Raft log or a partition snapshot
3. Promote it after it catches up
4. Remove the old replica
5. Purge local data from nodes that no longer host the partition

During a move, a request can receive a retryable response if leadership or hosting changes at the same time. Retrying against the cluster is the normal client behavior.

## Zones

Set a zone or rack hint on each node when replicas should be spread across failure domains:

```bash
kahuna-server \
  --raft-zone rack-a \
  --raft-replication-factor 3 \
  --raft-enable-placement-rebalancer true
```

The planner prefers distinct zones when it can. Zone hints are advisory; the cluster still uses the available voters if there are not enough distinct zones.

## Inspect Placement

Use the CLI to inspect the committed placement table:

```bash
kahuna-cli -c "https://kahuna-1:8082" --cluster-placement
kahuna-cli -c "https://kahuna-1:8082" --cluster-placement --format json
```

The output shows:

- Global replication factor
- Whether the placement rebalancer is enabled
- Which partitions the contacted node hosts locally
- Each partition's lifecycle state and generation
- Each partition's effective replication factor
- Replica endpoints and roles

Replica roles are:

| Role | Meaning |
|------|---------|
| `Voter` | Stores the partition and votes in that partition's quorum. |
| `Learner` | Catching up before promotion. |
| `Removing` | Still present while the cluster completes a safe removal. |

An empty replica set means full replication for that partition: every roster voter hosts it.

The same information is available through:

```http
GET /v1/cluster/placement
```

## Override One Partition

You can override the target replication factor for one partition:

```bash
kahuna-cli \
  -c "https://kahuna-1:8082,https://kahuna-2:8082,https://kahuna-3:8082" \
  --set-replication-factor 5 \
  --partition 3
```

Use `0` to clear the override and return to the global replication factor:

```bash
kahuna-cli -c "https://kahuna-1:8082" \
  --set-replication-factor 0 \
  --partition 3
```

The override commits a new placement target. Replica movement happens later through the placement rebalancer.

The REST endpoint is:

```http
POST /v1/cluster/replication-factor
Content-Type: application/json

{"partitionId":3,"replicationFactor":5}
```

## Readiness

`GET /v1/cluster/health` includes `hostedPartitions`, the number of data partitions hosted by the node answering the request.

Treat `hostedPartitions` as informational only. With per-partition placement, a healthy node may host zero data partitions and still serve requests by forwarding them to hosting replicas.

## Backups

Backup coverage follows local hosting. With full replication, any voter can take a backup covering all partitions. With a positive replication factor, a backup taken on one node covers only the partitions hosted by that node.

Kahuna validates backup chains before restore and refuses chains whose artifact set does not cover every cluster partition. Today, Kahuna does not compose a cluster-wide backup from per-node artifacts. If whole-cluster backups are required, run with full replication or with a replication factor equal to the voter count until composed backups are available.

## Migration Notes

Replication factor is meant for clusters bootstrapped with placed replicas. Existing full-replication partitions keep their legacy placement when a cluster is restarted with a positive replication factor.

For an existing production cluster, bootstrap a new cluster with the desired replication factor and move data through an application-level migration or backup/restore process that preserves the required coverage.
