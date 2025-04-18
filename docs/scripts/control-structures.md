
# Control Structures

Every Kahuna script is composed of a series of statements. A statement might involve storing, reading or deleting a key/value pair, calling a function, looping through data, or making a decision with conditional logic. This section covers the different types of statements you can use.

## If/Else

The `if` construct is a fundamental feature found in most programming languages. It enables conditional execution of specific blocks of code. The basic syntax looks like this:

```ruby
if expression then
  ...
end
```

The `expression` is evaluated as a boolean (`true` or `false`). If it evaluates to `true`, the code inside the block is executed. If it evaluates to `false`, the block is skipped.

Example:

```ruby
let candidates = get by prefix `election`
if count(current_leader) == 0 then
   set `election/leader` "node-A"
end
```

Often, you may want to perform one action when a condition is true, and a different action when it's false. That’s where else comes in. The else clause extends an if statement, allowing you to specify what should happen if the condition in the if evaluates to false.

```ruby
let candidates = get by prefix `election`
if count(current_leader) == 0 then
   set `election/leader` "node-A"
   return true
else
   return false
end
```

## For

The `for` loop allows a block of code to be executed **a specific number of times** or to **iterate over an array of values one by one**.

Repeating a block a fixed number of times:

```ruby
let total = 0
for i in 1..10 do
  let total = total + i
end
```

This loop sums the numbers from 1 to 10.

Set some candidate key/values:

```ruby
set `candidates/node-a` true nx
set `candidates/node-b` true nx
```

Iterating over an array of values:

```ruby
let candidates = get by prefix "candidates"
for candidate in candidates do
  set `services/email/leader` candidate
  return true
end
throw "no candidates found"
```

In this example, the loop looks for a valid candidate. As soon as it finds one, it sets a value and exits. If no candidates are found, it throws an error.

## Begin/Commit/Rollback

All scripts are executed as a **transaction** by default, even if they are not explicitly wrapped in a `begin` / `commit` / `rollback` block.

However, if you need **finer control** over when a transaction should be committed or rolled back—or if you want to **customize the default transaction behavior**—you can use a `begin` block.

**Example:**

```ruby
begin
  let balance = get "wallet:user123"
  if balance < 100 then
    rollback # Insufficient funds
  end
  let balance = balance - 100
  set "wallet:user123" balance
  commit
end
```

Using `begin` gives you full control over **when to finalize** or **cancel** a transaction based on your logic. Check the [transactions section](../distributed-keyvalue-store/transactions.md) for more information about the customization options.

## Let

Allows assigning values to variables. If the variable does not exist, it is **automatically created** in the script's **temporary execution scope**.

**Example:**

```ruby
let score = 100 # temp score variable
let score = score + 50
```

In this example, `score` is declared and assigned a value. You can reassign it freely during the script's execution, but it will cease to exist once the script ends.

If a value needs to be **persisted beyond the script's execution**, you must use the [`set`](commands/set.md) or [`eset`](commands/eset.md) functions.

- `set(key, value)` stores the value durably (persistent mode).
- `eset(key, value)` stores the value in ephemeral mode (in-memory only).

**Example:**

```ruby
let level = 5
set `player:123:level` level  # Persist the value to disk
```

These functions ensure that the data is stored in the key/value store and available after the script completes.

## Throw

This control structure allows you to **raise an exception** that is propagated back to the client. When `throw` is called, it automatically triggers a **rollback** of the transaction, undoing any uncommitted modifications.

**Example:**

```ruby
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

This ensures that errors are clearly communicated and that no partial updates are applied when something goes wrong.

## Return

The `return` statement allows you to **send a value back to the client** or simply **stop the execution** of a script early.

**Examples:**

```ruby
return "Done"
```

```ruby
set `config/connection-info` 'mysql://localserver-internal' nx
if not set then
  return "Connection was already set"
end
```

Use `return` to control script flow and deliver results directly from within your Kahuna Script logic.

## Sleep

The `sleep` command instructs the script to **pause execution** for the specified number of **milliseconds**. This can be useful for applying **throttling**, waiting for external coordination, or introducing slight delays between operations.

**Example:**

```ruby
sleep 200  # pauses execution for 200 milliseconds
```

Use with care, as **long sleep durations can impact performance** and increase the risk of timeouts, especially in high-throughput systems.