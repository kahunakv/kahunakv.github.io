
# Control Structures

A Kahuna script is a series of statements: reading, writing, or deleting keys, calling functions, looping over data, and branching on conditions. This page covers each kind of statement.

## If/Else

`if` runs a block only when a condition is true:

```kahuna
if expression then
  ...
end
```

The `expression` is evaluated as a boolean (`true` or `false`). If it evaluates to `true`, the code inside the block is executed. If it evaluates to `false`, the block is skipped.

Example:

```kahuna
let candidates = get by bucket `election`
if count(candidates) == 0 then
   set `election/leader` "node-A"
end
```

Add `else` to run a different block when the condition is false:

```kahuna
let candidates = get by bucket `election`
if count(candidates) == 0 then
   set `election/leader` "node-A"
   return true
else
   return false
end
```

## Switch/Case

Use `switch` to choose a branch by comparing one value with several alternatives:

```kahuna
switch @status
  case "pending" then
    return "wait"
  case "paid", "shipped" then
    return "accepted"
  else
    return "unknown status"
end
```

The subject (`@status` here) is evaluated once. Case values are expressions, evaluated in source order using the same comparison rules as `==`. The first match runs its body; there is **no fall-through**, and no `break` statement is needed. Evaluation stops at the match, including later alternatives in that same case.

`else` is optional. With no match and no `else`, the switch does nothing and execution continues after `end`. A switch requires at least one case; each case requires `then` and a nonempty body. Switches can be nested and used inside loops or transaction blocks. Keywords are case-insensitive.

Equality retains its usual conversions and errors: numeric strings can match numeric cases (`"2.0"` matches `2`), string-to-string comparisons are ordinal and case-sensitive, and incompatible operands cause a script error rather than silently failing to match. See [Script Semantics](/docs/scripts/semantics/#switch-comparisons).

In pessimistic scripts, lock discovery includes keys in **every** case body and the `else` body, even branches that will not run, as it does for both branches of `if`. Only the selected body executes. Eligible scripts using `switch` can also use the [single-key fast path](/docs/scripts/single-key-fast-path/).

`switch` and `case` are reserved words. Do not use them as bare variable or key names; rename the variable or quote the key name, for example ``get `case` ``.

## For

`for` repeats a block **a fixed number of times** or **once for each element of an array**.

Repeating a block a fixed number of times:

```kahuna
let total = 0
for i in 1..10 do
  let total = total + i
end
```

This loop sums the numbers from 1 to 10.

Set some candidate key/values:

```kahuna
set `candidates/node-a` "node-a" nx
set `candidates/node-b` "node-b" nx
```

Iterating over an array of values:

```kahuna
let candidates = get by bucket "candidates"
for candidate in candidates do
  set `services/email/leader` candidate
  return true
end
throw "no candidates found"
```

In this example, the loop looks for a valid candidate. As soon as it finds one, it sets a value and exits. If no candidates are found, it throws an error.

## Begin/Commit/Rollback

Multi-statement scripts normally use an auto-commit transaction even without an explicit `begin` block. Eligible single-command scripts can run as one direct key/value command without opening a transaction, and eligible single-key ephemeral scripts can run in one uninterrupted step on the node that owns the key (see [Single-Key Script Fast Path](/docs/scripts/single-key-fast-path/)).

Use a `begin` block when you need to decide **when to commit or roll back**, or to **customize the default transaction behavior**.

**Example:**

```kahuna
begin
  let balance = get "wallet:user123"
  if balance < 100 then
    rollback
  end
  let balance = balance - 100
  set "wallet:user123" balance
  commit
end
```

The script rolls back when the balance is less than 100.

How `commit` and `rollback` end a script:

- `commit` commits the transaction and **stops the script**. Statements after it do not run.
- `rollback` discards every write and stops the script. The script result is `Aborted`, the same type a conflict returns.
- Inside `begin`, nothing commits without an explicit `commit`. A block that reaches `end`, or runs `return`, before `commit` is rolled back and returns `Aborted`. To return a value from a block, use `begin (autoCommit=true)`: the block then commits when it ends or returns, as a script without `begin` does.
- Without `begin`, the script commits automatically when it ends. `commit` and `rollback` still work there, but a script that consists only of `commit` or `rollback` is refused with `Invalid transaction`.
- A `begin` block must be the whole script. A statement before or after the block is refused with `Nested transactions are not supported`.

`begin (...)` also takes options such as `locking`, `timeout`, `priority`, and `admissionWait`. See [BEGIN Options](/docs/scripts/semantics/#begin-options) for the full list, and [Transactions](/docs/distributed-keyvalue-store/transactions/) for how transactions behave.

## Let

`let` assigns a value to a variable. If the variable does not exist, it is **created automatically** and lives only while the script runs.

**Example:**

```kahuna
let score = 100
let score = score + 50
```

In this example, `score` is declared and assigned a value. You can reassign it freely during the script's execution, but it will cease to exist once the script ends.

If a value needs to be **persisted beyond the script's execution**, you must use the [`set`](/docs/scripts/commands/set/) or [`eset`](/docs/scripts/commands/eset/) commands.

- `set key value` stores the value durably (persistent mode).
- `eset key value` stores the value in ephemeral mode: it lives only in the partition leader's memory and is lost on a node restart or a leader change.

**Example:**

```kahuna
let level = 5
set `player:123:level` level
```

`set` persists the value to disk.

## Throw

`throw` **raises an error** that is returned to the client. It also **rolls back** the transaction, so no uncommitted change is applied.

**Example:**

```kahuna
begin
  let balance = get "wallet:user123"
  if balance < 100 then
    throw "Insufficient funds"
  end
  let balance = balance - 100
  set "wallet:user123" balance
  commit
end
```

## Return

`return` **sends a value back to the client** or **stops the script** early.

**Examples:**

```kahuna
return "Done"
```

```kahuna
set `config/connection-info` 'mysql://localserver-internal' nx
if not set then
  return "Connection was already set"
end
```

## Sleep

`sleep` **pauses the script** for the given number of **milliseconds**, for example to throttle work or wait briefly for external coordination. The duration is an integer literal from `0` to `300000` (five minutes); a placeholder, an expression, or a float is a syntax error, and a value out of range fails with `Invalid SLEEP duration`.

**Example:**

```kahuna
sleep 200
```

This pauses execution for 200 milliseconds.

Use it with care: **long sleeps can hurt performance** and increase the risk of timeouts, especially in high-throughput systems.
