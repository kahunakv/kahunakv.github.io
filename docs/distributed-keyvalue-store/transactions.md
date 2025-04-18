
# Transactions


## Transaction Options

You can specify **transaction options** to fine-tune how the script is executed:

### Timeout

Specifies the **maximum duration (in milliseconds)** that the transaction is allowed to run.
If the transaction does not complete within this time, it will be **automatically rolled back**.

- Kahuna Scripts are designed for **short executions**, so increasing this value significantly is **not recommended**.
- **Default value:** `5000ms`

```ruby
begin (timeout=3000)
  set `config1` 'some value 1'
  set `config2` 'some value 2'
  set `config3` 'some value 3'
  commit
end
```

### Locking

Defines the **locking strategy** used by the transaction.

- `pessimistic`: Locks keys upfront to ensure full consistency.
- `optimistic`: Locks only on write, with version validation during commit.

- **Default value:** `pessimistic`

```ruby
begin (locking="optimistic")
  set `config1` 'some value 1'
  set `config2` 'some value 2'
  set `config3` 'some value 3'
  commit
end
```

---

### asyncRelease

Indicates whether acquired locks should be **released asynchronously** (in the background) or **synchronously** (blocking the client until fully released).

- `true`: Faster response to the client, locks released in background.
- `false`: Locks must be released before returning to the client.

- **Default value:** `false`

```ruby
begin (asyncRelease="true")
  set `config1` 'some value 1'
  set `config2` 'some value 2'
  set `config3` 'some value 3'
  commit
end
```

### autoCommit

Specifies whether an **implicit `commit`** should be executed automatically if all operations in the transaction succeed, or if an **explicit `commit`** is required to finalize the transaction.

- `true`: The transaction will **automatically commit** if no errors occur.
- `false`: A manual `commit()` is required to indicate when the transaction should be finalized.

- **Default behavior:**
  - `false` when using a `begin` block
  - `true` when no `begin` block is used

**Example:**

```ruby
begin (autoCommit=false)
  ...
  commit
end
```

This option is useful when you want full control over **when** and **under what conditions** the transaction is committed.

---

These options provide greater flexibility and control over **performance**, **consistency**, and **responsiveness** in your Kahuna transactions.