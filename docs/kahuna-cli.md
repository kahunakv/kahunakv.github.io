
# Kahuna CLI

**Kahuna CLI** is an **interactive command-line tool** that allows sending **commands**, executing **transactions** in a **Kahuna cluster** and viewing the results.

It can be installed in two ways:

### **Native Client**
If you have the [**.NET runtime**](https://dotnet.microsoft.com/en-us/download/dotnet/8.0) installed, you can globally install the `kahuna-cli` tool with the following command:

```bash
dotnet tool install -g Kahuna.Control
```

Then you can execute the following command on your terminal:

```bash
~> kahuna-cli
Kahuna Shell 0.0.5 (alpha)

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
Kahuna Shell 0.0.5 (alpha)

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

For the native cluster started by `./scripts/run-cluster.sh`, connect to all three nodes:

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

## Backup and Restore

The target server must be started with `--pitr-backup-dir`. Backups and catalog operations run against the node selected by `-c`, whose catalog is local to that node.

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
```

Use a coordinated backup when all partitions must share one cluster snapshot timestamp. Use the returned backup ID as the parent of the next incremental backup.

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

Interactive mode supports:

```text
backup full
backup coordinated
list backups
```

See [Backups and Point-in-Time Recovery](/docs/backups-and-point-in-time-recovery/) for retention, bootstrap, and current restore limitations.
