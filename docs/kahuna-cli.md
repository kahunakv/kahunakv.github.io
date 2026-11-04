
# Kahuna CLI

The Kahuna CLI (`kahuna-cli`) lets you work with a Kahuna cluster from a terminal, much as `redis-cli` or `psql` do for Redis and PostgreSQL. You type commands or [Kahuna Script](/docs/scripts/) and see the results immediately, without writing application code. Use it to:

- Explore Kahuna and try commands while you learn, as the tutorials do.
- Inspect data during development or an incident: read a key and its revision, scan a bucket, or acquire and release a lock by hand.
- Test a script before you put it in an application.
- Administer a cluster: membership, replica placement, key ranges, backups, and restore.
- Watch persistent key changes while testing configuration or service behavior. See [Watch Key Changes](/docs/recipes/watch-key-changes/).
- Automate operational tasks from shell scripts with [single-command mode](#single-command-mode).

For application code, use the [.NET](/docs/dotnet-client/) or [TypeScript](/docs/typescript-client/) client instead.

Install it in one of two ways:

### **Native Client**
With the [.NET SDK](https://dotnet.microsoft.com/download) installed, install `kahuna-cli` as a global tool:

```bash
dotnet tool install -g Kahuna.Control
```

Then start it:

```bash
kahuna-cli
```

```text
Kahuna Shell 1.0.0

kahuna-cli>  get my-config
r14 my-value 18ms
```

To update to a new release:

```bash
dotnet tool update -g Kahuna.Control
```

### **Docker**

With Docker, run it in a container:

```bash
docker run --name kahuna-cli --network=host -d kahunakv/kahuna-cli:latest
```

Then open an interactive shell in it. `/app/run.sh` starts the CLI with no arguments, so it connects to the default endpoint `http://127.0.0.1:8083`:

```bash
docker exec -it kahuna-cli /app/run.sh
```

```text
Kahuna Shell 1.0.0

kahuna-cli>  get my-config
r14 my-value 18ms
```

To pass a connection string or run a single command, call the CLI directly:

```bash
docker exec -it kahuna-cli dotnet /app/Kahuna.Control.dll -c "https://kahuna-1:8082" --insecure
docker exec kahuna-cli dotnet /app/Kahuna.Control.dll -c "http://127.0.0.1:8083" --get my-config
```

## Interactive Mode

If no command-line parameters are provided, `kahuna-cli` enters **interactive mode**, allowing you to execute commands and view their results in real time. Anything that is not one of the shell commands below runs as a [Kahuna Script](/docs/scripts/), such as `get my-config` or `set my-config "value"`.

| Command | What it does |
|---------|--------------|
| `lock <name> <expiry-ms>` | Acquires a persistent lock and prints `f<fencing-token> acquired <owner>`. The shell keeps the handle. |
| `elock <name> <expiry-ms>` | Same, with an ephemeral lock. |
| `extend-lock <name> <expiry-ms>` / `eextend-lock ...` | Extends a lock this shell acquired. |
| `get-lock <name>` / `eget-lock <name>` | Prints the fencing token and owner of a lock this shell acquired. |
| `unlock <name>` / `eunlock <name>` | Releases a lock this shell acquired. |
| `create-sequence`, `get-sequence`, `next-sequence`, `reserve-sequence`, `update-sequence`, `delete-sequence` | Sequencer commands. See [CLI interactive mode](/docs/distributed-sequencer/clients/#cli-interactive-mode) for their arguments. |
| `watch <prefix> [keys-only]` | Streams committed changes to persistent keys. See [Watch Key Changes](#watch-key-changes). |
| `cluster members` | Prints the cluster roster. |
| `cluster leave <node-endpoint>` | Asks that node to leave the cluster. The endpoint is required. |
| `backup full`, `backup coordinated`, `list backups` | Backup commands. See [Backup and Restore](#backup-and-restore). |
| `run <file>` | Reads a script file, prints it, and runs it. |
| `clear` | Clears the screen. |
| `exit` or `quit` | Leaves the shell. Ctrl+C on an empty prompt does the same. |

The lock commands work only on locks acquired in the current session: `unlock`, `extend-lock`, and `get-lock` on a name this shell did not lock print `not acquired` or `not found`. On exit, the shell releases every lock it still holds. To work with a lock from another process, use the single-command flags with `--owner`.

Scripts typed at the prompt or loaded with `run` are cancelled on the client after `-t`/`--default-timeout` seconds (default `10`). A cancelled call does not tell you whether the server applied it.

### Multiline Scripts

Pressing Enter inside an open `IF`, `FOR`, `SWITCH`, or `BEGIN` block, or an unfinished single- or double-quoted string, continues input at the `...>` prompt. Closing the blocks and quotes submits the script on Enter:

```text
kahuna-cli> begin
       ...>   set `messages/welcome` "first line
       ...> second line"
       ...>   commit
       ...> end
```

Two trailing blank lines force submission of the current input, even if unfinished; the server then reports syntax errors. The continuation check is a lightweight block/quote check, not a full parser. Malformed input that appears complete is submitted for server validation. CLI commands such as `lock`, `cluster`, and `run` submit immediately rather than treating words in their arguments as block openers.

## Connection String

By default, `kahuna-cli` connects to the local cleartext gRPC endpoint on port `8083`, which the local Docker standalone server exposes:

```bash
kahuna-cli
```

That is equivalent to:

```bash
kahuna-cli -c "http://127.0.0.1:8083"
```

To connect to other servers, list them with the `-c` flag:

```bash
kahuna-cli -c "https://kahuna-dev.company.internal:8082,https://kahuna-dev.company.internal:8084"
```

You can also connect to the HTTPS endpoint and allow the local development certificate:

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
kahuna-cli --get-by-prefix services
kahuna-cli --scan-by-prefix services
kahuna-cli --lock jobs/email --expires 30000
kahuna-cli --extend-lock jobs/email --owner <owner> --expires 30000
kahuna-cli --unlock jobs/email --owner <owner>
```

`--lock` acquires a persistent lock and exits without releasing it, so the lock lasts until `--expires` milliseconds pass or you release it. `--expires` is required: without it the acquisition fails. The output names the owner you need for `--extend-lock` and `--unlock`:

```bash
$ kahuna-cli --lock jobs/email --expires 30000
f0 acquired b6be30d1dbba430697d27f66cf80669c

$ kahuna-cli --extend-lock jobs/email --owner b6be30d1dbba430697d27f66cf80669c --expires 60000
f0 extended

$ kahuna-cli --unlock jobs/email --owner b6be30d1dbba430697d27f66cf80669c
unlocked
```

If someone else holds the lock, `--lock` prints `f-1 not acquired <owner>` and does not wait. The owner in that line is the one the failed attempt generated, not the current holder. A wrong owner makes `--unlock` print `not unlocked` and `--extend-lock` print `KahunaException: Failed to extend: LockResponseTypeInvalidOwner`. These three flags always use persistent durability.

Distributed sequencer commands:

```bash
kahuna-cli --create-sequence orders --initial-value 0 --increment 1
kahuna-cli --get-sequence orders
kahuna-cli --next-sequence orders --idempotency-key request-123
kahuna-cli --reserve-sequence orders --count 100 --idempotency-key batch-456
kahuna-cli --delete-sequence orders
```

`--update-sequence` with `--current-value`, `--block-size`, `--remove-max-value`, and `--remove-block-size` rewrites a sequence; see [CLI single-command mode](/docs/distributed-sequencer/clients/#cli-single-command-mode) and [Updating a Sequence](/docs/distributed-sequencer/model/#updating-a-sequence) before you use it.

Every single-command operation accepts `--format json` and prints JSON instead of text. `--unlock` and `--extend-lock` print only `True` or `False`. Interactive mode always prints text.

`-t`/`--default-timeout` applies only to scripts in interactive mode; single-command operations do not read it.

## Watch Key Changes

Use `watch` in interactive mode to see committed changes to persistent keys under a prefix:

```text
kahuna-cli> watch config/prod/search/
kahuna-cli> watch config/prod/search/ keys-only
```

The first command prints the new value for a `set` event. `keys-only` leaves out value bytes when you only need the key and revision. Press Ctrl+C or Esc to stop the watch and return to the prompt.

Run the same watch directly from a terminal:

```bash
kahuna-cli --watch config/prod/search/ --watch-keys-only
kahuna-cli --watch config/prod/search/ --format json
```

The command runs until Ctrl+C or the stream ends. It prints progress watermarks when the cluster enables `--commit-admission-lag-ms`. To replay retained changes above a watermark, pass the timestamp printed in a progress line to `--watch-from`:

```bash
kahuna-cli --watch config/prod/search/ --watch-from 1:1792504674003:0
```

Resume requires the commit admission window on every node and enough retained log history. A watch never takes a history hold automatically; take one with the history-hold flags:

```bash
# Keep partitions 1 and 2's log from a timestamp for 10 minutes (the default --lease-ms)
kahuna-cli --history-hold-acquire config-consumer --partitions 1,2 --history-from 1:1792504674003:0

# Renew holds, moving them forward to a newer timestamp when --history-from is given
kahuna-cli --history-hold-renew <hold-id>,<hold-id> --history-from 1:1792504680000:0 --lease-ms 600000

kahuna-cli --history-hold-list --holder config-consumer
kahuna-cli --history-hold-release <hold-id>,<hold-id>
```

`--history-from` takes `node:physical:counter` or physical milliseconds alone. Acquire prints one line per hold with its ID; pass those IDs to renew and release. If the stream reports `lagged` or `history unavailable`, do not assume every change was printed. See [Watch Persistent Key Changes](/docs/distributed-keyvalue-store/watches/) for recovery behavior and the [watch recipe](/docs/recipes/watch-key-changes/) for an application example.

## Cluster Membership

Use `--cluster-members` to inspect the live cluster roster:

```bash
kahuna-cli -c "https://kahuna-1:8082" --cluster-members
```

The output includes membership version, local role, and an `Initialized` flag. `Initialized` tells you whether the contacted node has completed cluster initialization. A node can appear in membership before it is ready to serve key/value traffic, so use the server readiness endpoint `GET /v1/cluster/health` for load balancer or orchestrator probes.

When servers require an admin key, add `--admin-key-file /path/to/admin-keys` to `kahuna-control` admin commands. See [Admin Operations Authorization](/docs/admin-operations-authorization/).

Use `--cluster-leave` to decommission a node by committing its removal from the cluster roster:

```bash
kahuna-cli \
  -c "https://kahuna-1:8082,https://kahuna-2:8082,https://kahuna-3:8082" \
  --cluster-leave \
  --node "https://kahuna-3:8082"
```

Stop the process only after the response reports that the node left. Kahuna refuses a leave that would remove the last voter (a member that counts toward the [quorum](/docs/glossary/#quorum)) needed to keep the cluster available.

`Evicted` means the node was evicted while leave was in progress, without evacuating its replicas. Keep the process running until it rejoins, then retry the leave.

On a cluster using replica placement, leave drains the node first. The response includes `drained` when the [replicas](/docs/glossary/#replica-and-replication-factor) it hosted were moved to other nodes before removal. `DrainTimedOut` means the node stayed in the roster; retry later or raise `--raft-decommission-drain-timeout`.

## Replica Placement

Use `--cluster-placement` to inspect replica placement for each [partition](/docs/glossary/#partition):

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

## Key-Range Administration

Key-range administration is available in single-command mode for operators and tests:

```bash
# Inspect the range map
kahuna-cli -c "https://kahuna-1:8082" --ranges
kahuna-cli -c "https://kahuna-1:8082" --ranges --key-space users

# Register or unregister a key space
kahuna-cli \
  -c "https://kahuna-1:8082,https://kahuna-2:8082,https://kahuna-3:8082" \
  --register-key-range users

kahuna-cli \
  -c "https://kahuna-1:8082,https://kahuna-2:8082,https://kahuna-3:8082" \
  --unregister-key-range users

# Force a split at an exact key
kahuna-cli \
  -c "https://kahuna-1:8082,https://kahuna-2:8082,https://kahuna-3:8082" \
  --split-range users \
  --split-key users/0500

# Run the merge pass on demand
kahuna-cli -c "https://kahuna-1:8082" --merge-ranges
```

`--register-key-range` and `--unregister-key-range` are sent to every endpoint in the connection string. Each node keeps its own copy of the routing mode, so this switches every listed node right away; other nodes pick up the mode when they apply the replicated range map. Use `--node` only when you intentionally want to target one node, and accept that the other nodes switch later.

`--split-range` and `--merge-ranges` run only on the [leader](/docs/glossary/#leader-follower-and-learner) of [partition 0](/docs/glossary/#partition-0) (the system partition), which holds the range map. The CLI tries connected endpoints until one accepts. For split responses, branch on `determinate`: an indeterminate response means the map may still change, so re-read `--ranges` before deciding what happened.

See [Key-Range Sharding](/docs/distributed-keyvalue-store/key-range-sharding/) for routing behavior, API endpoints, and split/merge outcomes.

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

Coordinated backups are accepted only by the current backup coordinator, the node leading partition 0 (the system partition). If the command reports `NotBackupCoordinator`, retry against the current coordinator or another endpoint that routes to it.

If an incremental backup cannot be built because the [write-ahead log (WAL)](/docs/glossary/#write-ahead-log-wal) entries after its parent backup have already been compacted, Kahuna takes a full backup instead and reports the substitution in the command output or JSON fields.

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
kahuna-cli> backup full
kahuna-cli> backup coordinated
kahuna-cli> list backups
```

See [Backups and Point-in-Time Recovery](/docs/backups-and-point-in-time-recovery/) for retention, bootstrap, and restore constraints.

## Leave Requests and Elections

A node that requested leave keeps taking part in elections until its removal commits, and a timed-out removal can still commit later. After an uncertain leave response, check `--cluster-members` before stopping the node, then finish decommissioning explicitly. See [Leave Requests and Elections](/docs/internals/replication/#leave-requests-and-elections) for how candidacy and automatic rejoin are suppressed.
