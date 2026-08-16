
# Kahuna CLI

**Kahuna CLI** is an **interactive command-line tool** that allows sending **commands**, executing **transactions** in a **Kahuna cluster** and viewing the results.

It can be installed in two ways:

### **Native Client**
If you have the [.NET SDK](https://dotnet.microsoft.com/download) installed, you can globally install the `kahuna-cli` tool with the following command:

```bash
dotnet tool install -g Kahuna.Control
```

Then you can execute the following command on your terminal:

```bash
~> kahuna-cli
Kahuna Shell 1.0.0

kahuna-cli>  get my-config
r14 my-value 18ms

```

When new versions of `kahuna-cli` are released it can be later updated using the following command:

```bash
dotnet tool update -g Kahuna.Control
```

### **Docker**

If you have **Docker** you can run it on a container:

```bash
docker run --name kahuna-cli --network=host -d kahunakv/kahuna-cli:latest
```

Then you can execute the following command on your terminal:

```bash
~> docker exec -it kahuna-cli /app/run.sh
Kahuna Shell 1.0.0

kahuna-cli>  get my-config
r14 my-value 18ms
```

## Interactive Mode

If no command-line parameters are provided, kahuna-cli enters interactive mode, allowing you to execute commands and view their results in real time.

If no command-line parameters are provided, `kahuna-cli` enters **interactive mode**, allowing you to execute commands and view their results in real time.

## Connection String

By default, `kahuna-cli` attempts to connect to a cluster running on localhost on ports **8082, 8084, and 8086**.  

If you want to change this, you can specify the servers explicitly using the `-c` flag:

```bash
$ kahuna-cli -c "https://kahuna-dev.company.internal:8082,https://kahuna-dev.company.internal:8084"
```

This tells the CLI to connect to the specified Kahuna nodes, enabling interaction with a custom or remote environment.

For the local standalone development server, connect to the HTTPS endpoint and allow the local development certificate:

```bash
kahuna-cli -c "https://127.0.0.1:8082" --insecure
```

For a three-node cluster, pass every reachable endpoint in one comma-separated connection string:

```bash
kahuna-cli \
  -c "https://127.0.0.1:8082,https://127.0.0.1:8084,https://127.0.0.1:8086" \
  --insecure
```

## Single-Command Mode

The CLI can also execute one operation and exit. Common options include:

```bash
kahuna-cli --set my-config --value my-value
kahuna-cli --get my-config
kahuna-cli --get-by-bucket services
kahuna-cli --scan-by-prefix services
kahuna-cli --lock jobs/email --expires 30000
kahuna-cli --extend-lock jobs/email --owner <owner> --expires 30000
kahuna-cli --unlock jobs/email --owner <owner>
```

Distributed sequencer commands:

```bash
kahuna-cli --create-sequence orders --initial-value 0 --increment 1
kahuna-cli --get-sequence orders
kahuna-cli --next-sequence orders --idempotency-key request-123
kahuna-cli --reserve-sequence orders --count 100 --idempotency-key batch-456
kahuna-cli --delete-sequence orders
```

Use `--format json` to request JSON output for commands that support it.

## Cluster Membership

Use `--cluster-members` to inspect the live cluster roster:

```bash
kahuna-cli -c "https://kahuna-1:8082" --cluster-members
```

The output includes membership version, local role, and an `Initialized` flag. `Initialized` tells you whether the contacted node has completed cluster initialization. A node can appear in membership before it is ready to serve key/value traffic, so use the server readiness endpoint `GET /v1/cluster/health` for load balancer or orchestrator probes.

Use `--cluster-leave` to decommission a node by committing its removal from the cluster roster:

```bash
kahuna-cli \
  -c "https://kahuna-1:8082,https://kahuna-2:8082,https://kahuna-3:8082" \
  --cluster-leave \
  --node "https://kahuna-3:8082"
```

Stop the process only after the response reports that the node left. Kahuna refuses a leave that would remove the last voter needed to keep the cluster available.

## Replica Placement

Use `--cluster-placement` to inspect per-partition replica placement:

```bash
kahuna-cli -c "https://kahuna-1:8082" --cluster-placement
kahuna-cli -c "https://kahuna-1:8082" --cluster-placement --format json
```

The output includes the global replication factor, whether the placement rebalancer is enabled, each partition's effective replication factor, the replica endpoints, replica roles, and which partitions the contacted node hosts locally.

Set a per-partition replication factor override with `--set-replication-factor` and `--partition`:

```bash
kahuna-cli \
  -c "https://kahuna-1:8082,https://kahuna-2:8082,https://kahuna-3:8082" \
  --set-replication-factor 5 \
  --partition 3
```

Use `0` to clear the override so the partition inherits the server-wide replication factor:

```bash
kahuna-cli -c "https://kahuna-1:8082" \
  --set-replication-factor 0 \
  --partition 3
```

See [Replication Factor and Replica Placement](/docs/replica-placement/) for the server flags and operational behavior.

## Backup and Restore

The target server must be started with `--pitr-backup-dir`. For production clusters, point every node at the same shared backup directory and set the same `--pitr-backup-cluster-id`. Backups and catalog operations run against the node selected by `-c`, whose visible catalog is whatever that node sees at `--pitr-backup-dir`.

```bash
# Create backups
kahuna-cli -c "https://kahuna-1:8082" --backup-full
kahuna-cli -c "https://kahuna-1:8082" --backup-coordinated
kahuna-cli -c "https://kahuna-1:8082" \
  --backup-incremental \
  --parent-backup-id <backup-id>

# Inspect and validate
kahuna-cli -c "https://kahuna-1:8082" --list-backups
kahuna-cli -c "https://kahuna-1:8082" --backup-chain <leaf-backup-id>

# Reclaim backup disk or preview what would be deleted
kahuna-cli -c "https://kahuna-1:8082" --backup-gc
kahuna-cli -c "https://kahuna-1:8082" --backup-gc --backup-gc-dry-run
```

Use a coordinated backup when all partitions must share one cluster snapshot timestamp. Use the returned backup ID as the parent of the next incremental backup.

Coordinated backups are accepted only by the current backup coordinator, the node leading the meta partition. If the command reports `NotBackupCoordinator`, retry against the current coordinator or another endpoint that routes to it.

If an incremental backup cannot be built because the parent WAL range has already been compacted, Kahuna takes a full backup instead and reports the substitution in the command output or JSON fields.

Restore writes a new storage directory on the server handling the request:

```bash
# Restore through the end of the selected chain
kahuna-cli -c "https://kahuna-1:8082" \
  --restore <leaf-backup-id> \
  --target-dir /var/lib/kahuna/restored

# Restore through a specific Unix timestamp in milliseconds
kahuna-cli -c "https://kahuna-1:8082" \
  --restore <leaf-backup-id> \
  --target-dir /var/lib/kahuna/restored-at-t \
  --target-time-ms 1781478000000
```

`--target-dir` is a path on the server, not the computer running the CLI. Restore does not modify the running node. Start a fresh node with the restored path and the same storage adapter and revision.

For remote restore, start the server with `--pitr-restore-root` and choose a target directory below that root. Kahuna rejects targets outside the root, symlinked paths, protected-path overlaps, and non-empty destinations.

Interactive mode supports:

```text
backup full
backup coordinated
list backups
```

See [Backups and Point-in-Time Recovery](/docs/backups-and-point-in-time-recovery/) for retention, bootstrap, and restore constraints.
