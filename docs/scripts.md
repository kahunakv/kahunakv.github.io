
# Scripts: Overview

**Kahuna Script** runs short pieces of logic inside the cluster, next to the data, much like a Lua script in Redis or a stored procedure in a relational database. A script can read values, make decisions, write updates, and acquire transactional locks, and it finishes as one all-or-nothing operation.

A multi-step workflow, such as "read the stock, check it, decrement it", runs as a single server-side transaction. The client sends one script invocation instead of coordinating many round trips and recovering partial work itself.

## Key Advantages

- **Atomicity & Transaction Safety**: All Kahuna scripts execute inside a transaction. The accepted changes commit together or roll back together.
- **No Client-Side Coordination**: The server records the script's confirmed reads, writes, locks, and cleanup state while it runs, so the client has nothing to track or undo.
- **Multi-Key Operations**: Scripts can read and modify key/value pairs across [partitions](/docs/glossary/#partition) without exposing routing details to the caller.
- **Performance**: Multiple operations run from one request, reducing client/server round trips.
- **Single-Key Fast Path**: Short auto-commit scripts over one [ephemeral](/docs/glossary/#durability) key can run in one uninterrupted step on the node that owns the key, making counters, rate limiters, and flags much cheaper.
- **Custom Logic on the Key/Value Store**: Scripts embed decision logic directly on the server side.
- **User-Defined Functions**: Deployments can add trusted C# functions and call them from scripts like built-ins.
- **Safe Error Handling**: If a script throws or fails validation, the transaction rolls back instead of leaving a partial update.
- **Historical Snapshot Reads**: Scripts can read keys, buckets, and prefix scans **as of a past [HLC](/docs/glossary/#hybrid-logical-clock-hlc) timestamp**, which is useful for audits, debugging, and incident reconstruction.

## How Script Transactions Work

Every script runs through Kahuna's transaction coordinator. The coordinator records the script's [working set](/docs/internals/transaction-lifecycle/#basic-concepts) (its confirmed reads, modified keys, and acquired locks) as commands succeed, then commits or rolls back from that record.

What this means when you write a script:

- Plain scripts are transactional even without an explicit `begin` block.
- `begin (...)` customizes the transaction. See [BEGIN Options](/docs/scripts/semantics/#begin-options) for every option, value, and default.
- `commit` makes accepted changes visible.
- `rollback` cancels the transaction and releases transactional state.
- `throw` aborts the script and rolls back the transaction.
- Snapshot scripts created with `begin (snapshot=...)` are read-only historical views.
- When a statement fails for a retryable reason, the script returns that outcome instead of one generic abort, so your client can tell a conflict (`Aborted`) from a transient condition worth retrying (`MustRetry`).

See [Transactions](/docs/distributed-keyvalue-store/transactions/) for how transactions behave and how to handle retries.

For hot counters and temporary coordination state, see [Single-Key Script Fast Path](/docs/scripts/single-key-fast-path/) for the exact script shapes Kahuna optimizes automatically.

## Script Results

Script execution returns a result type plus the values produced by the script. Each returned value includes the key, value bytes, revision, expiration, and last-modified timestamp. The .NET client exposes these through `KahunaKeyValueTransactionResult.Values`, plus `FirstValue`, `FirstValueAsString`, and `FirstRevision` helpers for scripts that return one value. The TypeScript client returns the same shape as `result.values`; decode `values[0].value` when a script returns one value.

REST and gRPC expose the same per-value result shape, so scripts return the same revision and timestamp metadata regardless of transport.

## When to Use Scripts

- When you need to apply **short-lived logic** to read or modify values **consistently and atomically** within the key/value store.
- To **manipulate multiple keys** and apply business logic **without risking data inconsistency**.
- To **avoid multiple network calls** when executing logic that involves or depends on several keys.
- To let the server **batch and pipeline** the steps of a **multi-node or multi-key transaction**, instead of sending each step from the client.

## Examples

A script can be as simple as a single command that sets a value:

```kahuna
set `services/email/instance-3` '{"ip": "10.1.1.22", "port": 9090}'
```
```text
r0 set 19ms
```

or a longer program that solves a real problem. In the examples below, names that start with `@`, such as `@inventory_key`, are placeholders: parameters that your client passes with the script (see the [.NET client](/docs/dotnet-client/) and [TypeScript client](/docs/typescript-client/)).

### Atomic Compare-and-Set (CAS)

Update a value only if it still matches what you expect (optimistic concurrency control). This prevents race conditions when several clients update shared state such as a leader election key, a balance, or a session record.

It can be done with the built-in `cmprev` modifier on `set`. For example, only update the value if the key exists and its current revision is `0` (on a missing key, `cmprev 0` is refused; use `nx` to create a key only if it is absent):

```kahuna
set `election/leader` "node-A" cmprev 0
```

A refused `set` does not stop the script. To return a custom value according to the result of the operation, check it with the [`not set`](/docs/scripts/semantics/#statement-result-guards) guard:

```kahuna
set `election/leader` "node-A" cmprev 0
if not set then
  return false
end
return true
```

or throw an exception if the value can't be changed:

```kahuna
set `election/leader` "node-A" cmprev 0
if not set then
  throw "election failed"
end
return true
```

Basic commands and control structures can also express a create-if-absent claim, the same check that the `nx` modifier performs:

```kahuna
let current_leader = get `election/leader`
if not found then
  set `election/leader` "node-A"
else
  throw "election failed"
end
```

### Token Bucket Rate Limiter

Limit how many actions a user or IP address can take over time, such as login attempts or API calls, to throttle traffic and slow brute-force attacks.

The bucket holds up to `@capacity_param` tokens and gains one token every `@refill_interval_param` milliseconds. Each allowed call spends one token. The script returns `1` when the call is allowed and `0` when it is throttled.

```kahuna
let rate_limit = get @rate_limit_param
let last_refill = get @last_refill_param

let capacity = to_int(@capacity_param)
let refill_interval = to_int(@refill_interval_param)
let current_time = current_time()

let tokens = capacity
let last_refill_time = current_time
if not is_null(rate_limit) then
  let tokens = to_int(rate_limit)
  let last_refill_time = to_int(last_refill)
end

let refill = floor((current_time - last_refill_time) / refill_interval)
let tokens = min(tokens + refill, capacity)
let last_refill_time = last_refill_time + refill * refill_interval

if tokens <= 0 then
  return 0
end

set @rate_limit_param tokens - 1
set @last_refill_param last_refill_time
return 1
```

### Atomic Inventory Reservation

Reserve stock only if enough is available, so flash sales and ticketing systems do not oversell under high load.

```kahuna
let inventory_value = get @inventory_key

let inventory = to_int(inventory_value)
let requested = to_int(@requested_amount)

if inventory >= requested then
  set @inventory_key inventory - requested
  return 1
else
  return 0
end
```

### Expiring Counter

Count events (like logins or API hits) and auto-expire the counter after some time.

```kahuna
let current_value = get @counter_key
let current_count = 0
if not is_null(current_value) then
  let current_count = to_int(current_value)
end

let expected_increment = to_int(@expected_increment)
let expected_limit = to_int(@expected_limit)

let new_count = current_count + expected_increment

if new_count >= expected_limit then
  set @counter_key new_count ex to_int(@expiration_ms)
else
  set @counter_key new_count
end

return new_count
```

### Session Refresh (Sliding Expiration)

Extend a user session's expiration only if the session exists, so active users are not logged out.

```kahuna
let exists_key = exists @session_key
if exists_key then
 extend @session_key 1800000
 return 1
end
return 0
```

`extend` takes the new expiration as an integer literal in milliseconds (here 30 minutes). It changes the expiry without changing the value or revision.
