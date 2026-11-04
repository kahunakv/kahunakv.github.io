import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Admin Operations Authorization

Keep application clients from changing cluster membership, repartitioning data, or starting backups and restores. Configure an admin key on each node, then give it only to the tools that perform those operations. Ordinary data access does not require this key.

## Enable the Admin Key

Create a file readable only by the server user:

```bash
openssl rand -base64 32 > /etc/kahuna/admin-keys
chmod 600 /etc/kahuna/admin-keys
```

Add this flag to each node's existing startup command:

```bash
--admin-api-key-file /etc/kahuna/admin-keys
```

The file accepts one key per line. Blank lines and lines beginning with `#` are ignored; surrounding whitespace is trimmed. Every key must contain at least 32 characters. An unreadable file, an empty key list, or a short key stops startup. Keys are loaded at startup, so editing the file requires a restart.

Without this flag, admin operations remain open to callers of the client port, and the server logs a startup warning.

## Send the Key

<Tabs groupId="client-examples">
<TabItem value="cli" label="CLI">

`kahuna-control` reads the first key from the file and sends it only with admin commands:

```bash
kahuna-control -c "https://kahuna-1:8082" \
  --admin-key-file /etc/kahuna/admin-keys \
  --backup-full
```

</TabItem>
<TabItem value="dotnet" label=".NET">

```csharp
using Kahuna.Client;

var client = new KahunaClient(
    "https://kahuna-1:8082",
    new KahunaOptions
    {
        AdminApiKey = Environment.GetEnvironmentVariable("KAHUNA_ADMIN_KEY")
    });

await client.TakeFullBackupAsync();
```

`KahunaOptions.AdminApiKey` is sent only with admin calls, over either REST or gRPC.

</TabItem>
</Tabs>

Other REST callers send `X-Kahuna-Admin-Key`; gRPC callers send the metadata entry `x-kahuna-admin-key`. Use TLS to protect the credential in transit.

A missing or invalid key returns HTTP `401 Unauthorized` or gRPC `Unauthenticated` before the operation runs. The refusal log includes the operation and caller address, but never the key.

## Protected Operations

| Operation | REST routes |
|-----------|-------------|
| Remove a node | `POST /v1/cluster/leave` |
| Change replication factor | `POST /v1/cluster/replication-factor` |
| Register or unregister a key-range space | `POST /v1/ranges/register`, `/v1/ranges/unregister` |
| Split or merge ranges | `POST /v1/ranges/split`, `/v1/ranges/merge` |
| Create backups | `POST /v1/backups/full`, `/v1/backups/incremental`, `/v1/backups/coordinated` |
| Backup garbage collection and chain validation | `POST /v1/backups/gc`, `/v1/backups/validate-chain` |
| Restore | `POST /v1/restore` |

The corresponding gRPC methods require the same key. Data operations, transactions, watches, and read-only views remain ungated. This includes membership, placement, routing, range maps, backup listings and chain reads, the dashboard, and health endpoints. Continue to restrict network access to those surfaces.

Internal backup capture and inter-node forwarding do not use this key; use [node mTLS](/docs/node-transport-security/) to authenticate peers. The admin key is shared authorization for the operations above, not per-user access control for data.

## Rotate Keys

1. Add the new key as a second line on every node and restart nodes one at a time. Both keys work during the transition.
2. Switch admin callers to the new key. For `kahuna-control`, make it the first key in the caller's file.
3. Remove the old key from each server's file and roll the nodes again.

## Custom Hosts

`EmbeddedKahunaOptions.AdminApiKeyFile` carries the path, but an ASP.NET host serving Kahuna's REST and gRPC endpoints must also register the gate with `services.AddAdminGate(AdminGate.LoadKeys(path))`. A custom host that omits this registration leaves admin operations open. In-process `IKahuna` calls do not pass through the HTTP/gRPC gate.
