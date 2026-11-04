# Key/Value Request Limits

Request limits keep one client from making a node allocate an entire dataset in one response or retain an unbounded transaction. They apply to the public REST and gRPC key/value APIs, including the client batch stream, for both persistent and ephemeral durability.

## Writes and Batches

| Server flag | Default | Applies to |
|-------------|---------|------------|
| `--max-key-bytes` | `16384` (16 KiB) | UTF-8 key bytes on set/set-many and transaction lock acquisition, including prefix and range bounds |
| `--max-value-bytes` | `4194304` (4 MiB) | Value and compare-value bytes on set/set-many |
| `--max-batch-items` | `20000` | Items in set-many, delete-many, get-many, exists-many, and many-lock acquisition |
| `--max-transaction-mutations` | `20000` | Written keys and, separately, acquired transaction locks |

`0` disables each configurable bound; negative values stop startup. Oversized keys, values, or batches return `InvalidInput`. A batch that fails these checks is refused before any item runs. This admission check does not make an accepted batch atomic; use a [transaction](/docs/distributed-keyvalue-store/transactions/) when operations must commit together.

Key length is measured after UTF-8 encoding, not in characters. Value length is the decoded byte payload, not its base64 representation in REST JSON. Delete and extend do not enforce key/value size bounds, so older oversized keys remain removable or extendable.

Transport message limits still apply. Startup requires positive `MaxValueBytes` plus `MaxKeyBytes` to stay below the Raft gRPC message limit. Leave room for request and replication metadata, and keep values well below that ceiling. Disabling the application bound does not allow an arbitrarily large value to replicate.

These size and batch checks run at client entry points, not on trusted inter-node forwarding or direct in-process `IKahuna` calls. They are not a universal storage-size limit or a per-command size check inside Kahuna Script.

## Transactions

A client-started session has separate write and lock budgets. Locking and writing N keys fits a limit of N because each budget is checked independently. Pending operations reserve capacity before execution; a batch reservation must fit in full. Confirmed written keys count once, but a session's lock count does not fall when a lock is released, so releasing and reacquiring consumes more budget. Admission can conservatively refuse another write when the write budget is full, even if it targets a key already written.

An operation that exceeds the limit returns `TransactionMutationLimitReached` without applying that operation. The session can still commit its earlier work or roll back. Repeating the same over-limit request will not help; reduce the working set or adjust the limit.

Client-submitted script transactions also enforce the limit. A script that exceeds it aborts without committing its staged changes. Direct embedded sessions and embedded script calls do not inherit this client mutation limit. Script length and depth have [separate limits](/docs/server-configuration/#workers-and-runtime).

Public key/value lock requests must identify an active transaction session using its coordinator key and nonempty operation ID. A bare transaction timestamp is insufficient and returns `InvalidInput`. These are [transaction locks](/docs/distributed-keyvalue-store/read-and-lock-semantics/#transaction-locks), separate from the [distributed lock API](/docs/distributed-locks/).

## Range Pages and History Holds

Paginated range reads cap a requested page at **4096 entries**. `0` selects that server page size; a negative limit returns `InvalidInput`. Smaller pages are valid, and inspection limits can end a page early. Follow `HasMore` and the returned cursor until the scan finishes; a short page alone does not mean completion.

Non-paginated prefix and bucket scans are also capped at 4096 results and can truncate earlier when inspection work reaches its bound. Use paginated range reads for complete iteration over large sets.

[Snapshot holds](/docs/distributed-keyvalue-store/snapshot-holds/) have separate lease and registration limits. These protect retained history rather than bounding the size of a read response.

See [Server Configuration](/docs/server-configuration/#client-request-limits) and [Embedded Kahuna Node](/docs/embedded-kahuna-node/#client-request-limits) for configuration.
