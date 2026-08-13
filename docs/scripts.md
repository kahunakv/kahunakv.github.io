
# Scripts: Overview

Kahuna offers a scripting system in its key/value store called **Kahuna Script**. Scripts execute short pieces of logic inside the cluster, close to the data. They can read values, make decisions, write updates, acquire transactional locks, and finish as one all-or-nothing operation.

The main advantage of Kahuna Script is that a multi-step workflow can run as a single server-side transaction. The client sends one script invocation instead of coordinating many round trips and trying to recover partial work itself.

## Key Advantages

- **Atomicity & Transaction Safety**: All Kahuna scripts execute inside a transaction. The accepted changes commit together or roll back together.
- **Server-Owned Coordination**: The transaction coordinator records confirmed reads, writes, locks, and cleanup state while the script runs.
- **Multi-Key Operations**: Scripts can read and modify key/value pairs across partitions without exposing routing details to the caller.
- **Performance**: Multiple operations run from one request, reducing client/server round trips.
- **Custom Logic on the Key/Value Store**: Scripts embed decision logic directly on the server side.
- **Safe Error Handling**: If a script throws or fails validation, the transaction rolls back instead of leaving a partial update.
- **Historical Snapshot Reads**: Scripts can read keys, buckets, and prefix scans **as of a past HLC timestamp**, which is useful for audits, debugging, and incident reconstruction.

## How Script Transactions Work

Every script runs through Kahuna's transaction coordinator. The coordinator tracks the script's working set as commands succeed, then finalizes the transaction from that server-owned state.

For a script author, the important behavior is:

- Plain scripts are transactional even without an explicit `begin` block.
- `begin (...)` lets you customize options such as `timeout`, `admissionWait`, `locking`, `snapshot`, `priority`, `asyncRelease`, and `autoCommit`.
- `commit` makes accepted changes visible.
- `rollback` cancels the transaction and releases transactional state.
- `throw` aborts the script and rolls back the transaction.
- Snapshot scripts created with `begin (snapshot=...)` are read-only historical views.

See [Transactions](/docs/distributed-keyvalue-store/transactions/) for the full transaction lifecycle and option reference.

## Script Results

Script execution returns a result type plus the values produced by the script. Each returned value includes the key, value bytes, revision, expiration, and last-modified timestamp. The .NET client exposes these through `KahunaKeyValueTransactionResult.Values`, plus `FirstValue`, `FirstValueAsString`, and `FirstRevision` helpers for scripts that return one value.

REST and gRPC expose the same per-value result shape, so scripts return the same revision and timestamp metadata regardless of transport.

## When to Use Scripts

- When you need to apply **short-lived logic** to read or modify values **consistently and atomically** within the key/value store.
- To **manipulate multiple keys** and apply business logic **without risking data inconsistency**.
- To **avoid multiple network calls** when executing logic that involves or depends on several keys.
- To **leverage batching and pipelining** for executing **multi-node or multi-key transactions**, improving overall performance and responsiveness.

## Examples

A script can be something as simple as a single command to set a value on the key/value store:

```kahuna
kahuna-cli> set `services/email/instance-3` '{"ip": "10.1.1.22", "port": 9090}'
r0 set 19ms
```

or more elaborate examples that solve real-world problems:

### Atomic Check-and-Set (CAS)

Use case: only update a value if it matches the expected current value, which is useful for optimistic concurrency control. This prevents race conditions when multiple clients try to update shared state such as a leader election key, balance, or session record.

It can be done with the built-in `cmprev` modifier on `set`. For example, only update the value if the current revision is `0`:

```kahuna
set `election/leader` "node-A" cmprev 0
```

we can return a custom value according to the result of the operation:

```kahuna
let elected = set `election/leader` "node-A" cmprev 0
if not elected then
  return false
end
return true
```

or throw an exception if the value can't be changed:

```kahuna
let elected = set `election/leader` "node-A" cmprev 0
if not elected then
  throw "election failed"
end
return true
```

the CAS operation can be completely implemented using basic building blocks and control structures:

```kahuna
let current_leader = get `election/leader`
if rev(current_leader) == 0 then
  set `election/leader` "node-A"
else
  throw "election failed"
end
```

### Leaky Bucket Rate Limiter

Limit how many actions a user/IP can do over time (e.g., login attempts or API calls). Throttle traffic, avoid brute-force attacks.

```kahuna
let rate_limit = get @rate_limit_param
let last_refill = get @last_refill_param

let tokens = to_int(rate_limit)
let last_refill = to_int(last_refill)

let current_time = current_time()
let elapsed = current_time - last_refill
let refill = floor(elapsed / @refill_interval_param)

let tokens = min(tokens + refill, tokens)

if tokens <= 0 then
  return 0
end

set @rate_limit_param tokens - 1
set @last_refill_param current_time
return 1
```

### Atomic Inventory Reservation

Reserve stock if available; useful for flash sales or ticketing systems.
Prevent overselling in e-commerce under high load.

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
let current_count = to_int(get @counter_key)
let expected_increment = to_int(@expected_increment)
let expected_limit = to_int(@expected_limit)

let new_count = current_count + expected_increment
set @counter_key new_count

if new_count >= expected_limit then
  extend @counter_key @expiration_seconds
end

return new_count
```

## Session Refresh (Sliding Expiration)

Refresh TTL on user session only if it exists. Prevent user sessions from expiring while they're still active.

```kahuna
let exists_key = exists @session_key
if exists_key then
 extend @session_key @ttl_in_seconds
 return 1
end
return 0
```

As we can see, there are many use cases where **Kahuna Scripts** can be applied to solve specific problems across a wide range of needs in distributed applications. In the following sections, we’ll learn more about the **syntax**, **control structures**, **commands**, and **available functions** in Kahuna Script.
