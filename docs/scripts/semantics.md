# Script Semantics

Kahuna Script is intentionally small, but some of its rules differ from Lua or JavaScript: conditions need real booleans, numbers compare exactly, and literals have size limits. Read this page when a script fails or returns something you did not expect; it is the exact reference that the other script pages summarize.

## Conditions

`if`, `&&`, `||`, and `!` require boolean values. Numbers, strings, arrays, and `null` are not truthy or falsy.

```kahuna
if count(items) > 0 then
  return true
end
```

Use a comparison or an explicit conversion when a value should become a condition.

`&&` and `||` short-circuit. If the left side decides the result, the right side is not evaluated:

```kahuna
if divisor != 0 && total / divisor > 10 then
  return "above threshold"
end
```

## Numbers

Division by zero is a script error for integers, floats, and numeric strings.

Numeric equality is exact. `1 == 1.0` is `true`, and `1 == 1.0009` is `false`:

```kahuna
return 1 == 1.0
```

```kahuna
return 1 == 1.0009
```

Use `nearly_equals(a, b, tolerance)` when a calculation needs a tolerance:

```kahuna
return nearly_equals(1, 1.0009, 0.001)
```

Integer literals can be decimal or hexadecimal:

```kahuna
let decimal = 42
let hex = 0x2A
```

The `0x` prefix must be lowercase; the digits can be either case. `0X2A` is a syntax error. There is no exponent notation: write `1000` or `1500.0`, not `1e3` or `1.5e3`. A float literal needs digits on both sides of the point (`0.5`, not `.5`).

A minus sign is an operator, not part of the literal:

```kahuna
let delta = -amount
let result = 5-3
```

## Ranges

`a..b` includes both bounds:

```kahuna
let ids = 1..10
```

That range contains `1` through `10`. If the start is greater than the end, the result is an empty array. Ranges are materialized when evaluated and are capped at 100000 elements.

## Array Literals

Square brackets around a comma-separated list of expressions make a new array. The elements are evaluated in source order, and each evaluation makes a new array:

```kahuna
let empty = []
let mixed = ["hello", false, 100.2, null]
let computed = [a, a * 2, upper(name)]
let nested = [[1], [2, 3]]
```

A bracket at the start of an expression is a literal. A bracket after a complete expression is an index, so `[10, 20, 30][2]` returns `30`.

A trailing comma, an empty element, and an unclosed bracket are syntax errors: `[1,]`, `[,]`, `[1, , 2]` and `[1, 2` are all refused.

Kahuna limits how deeply a parsed script can nest (`MaxScriptDepth`, 256 by default), and each element of an array literal counts as one level. A literal therefore holds at most about 250 elements. A longer literal is refused with a "nested too deeply" error. Use a range or `split` to make a long array.

A literal is capped at 100000 values in total. The count includes every value of the arrays nested in it, so `[1..100000]` is refused. This also stops a loop that puts the same array into a literal two times on each iteration, because each iteration doubles the total.

## Strings and Escapes

Double-quoted, single-quoted, and backtick identifier literals decode escapes. Common escapes include `\n`, `\t`, `\r`, `\\`, `\"`, `\'`, octal escapes, `\xHH`, `\uHHHH`, and `\UHHHHHHHH`.

Single- and double-quoted strings may also contain raw line breaks. The value preserves LF or CRLF exactly as supplied:

```kahuna
set `messages/welcome` "first line
second line"
```

Backtick identifiers must stay on one line. Other raw control characters, such as a tab inside a literal, remain invalid; use `\t`. An unclosed literal is a script error, and diagnostics after multiline literals retain their source line numbers.

Unknown escapes are script errors instead of being silently preserved or dropped.

String helper functions compare characters ordinally, not with locale-aware rules. This keeps script results stable across nodes with different operating-system locale settings. See [String Functions](/docs/scripts/functions/string/).

## Clocks

Use `hlc()`, which reads the [hybrid logical clock](/docs/glossary/#hybrid-logical-clock-hlc), for distributed deadlines and ordering values that another node may compare later. Use `current_time()` for human-readable timestamps.

```kahuna
set @lease_deadline hlc() + 30000
set @audit_timestamp current_time()
```

`hlc_counter()` returns the logical counter for the same HLC reading. See [Time Functions](/docs/scripts/functions/time/).

## BEGIN Options

`begin (...)` accepts a comma-separated option list and every option applies:

```kahuna
begin (locking="optimistic", priority="high", admissionWait=2000, timeout=10000)
  let row = get `orders/42`
  set `orders/42` row
  commit
end
```

This is the full list of script transaction options. Values can be quoted or bare (`locking="optimistic"` or `locking=optimistic`). The last column names the matching option for [interactive sessions](/docs/distributed-keyvalue-store/transactions/#transaction-options) in the .NET client (`KahunaTransactionOptions`) and the TypeScript client (`TransactionOptions`).

| Option | Values | Default | What it does | .NET / TypeScript option |
|---|---|---|---|---|
| `locking` | `pessimistic`, `optimistic` | `pessimistic` | `pessimistic` locks keys up front and can also acquire prefix or range locks during transactional reads. `optimistic` locks only on write, revalidates read dependencies during commit, and aborts on concurrent write intents over the read set. See [Locking Modes](/docs/distributed-keyvalue-store/transactions/#locking-modes). | `Locking` / `locking` |
| `timeout` | Milliseconds, greater than zero (`timeout=3000`) | Server `DefaultTransactionTimeout` (`5000` ms) | Maximum time the transaction may run. A transaction that does not complete in time is rolled back automatically. The server clamps the value to its maximum transaction timeout. Scripts are designed for short executions, so raising this value significantly is not recommended. | `Timeout` / `timeout` |
| `admissionWait` | Milliseconds, `0` or more (`admissionWait=2000`) | Server `DefaultAdmissionWaitMs` | How long the script waits for a transaction admission slot before it starts. Separate from `timeout`, which bounds the run after admission. The server clamps the value to `MaxAdmissionWaitMs`. `admissionWait=0` means "start only if a slot is free right now". If the wait expires, Kahuna returns `AdmissionRefused` and no transaction was started. | `AdmissionWaitMs` / `admissionWaitMs` |
| `priority` | `background`, `low`, `normal`, `high`, `critical` | `normal` | Admission priority when the node is at its transaction concurrency ceiling. Overrides the priority carried by the transport. It changes only when the transaction starts, not locking, MVCC, two-phase commit, or commit semantics. See [Transaction Priority Admission](/docs/distributed-keyvalue-store/transaction-priority-admission/). | `Priority` / `priority` |
| `snapshot` | Non-zero Unix epoch milliseconds (`snapshot=1718392012345`) | None (latest reads) | Serves every read as of one fixed past timestamp and makes the transaction read-only. See [Snapshot Transactions](#snapshot-transactions). | `ReadTimestamp` / `readTimestamp` |
| `readValidation` | `none`, `trackAndValidate` | `none` | `trackAndValidate` records latest reads and validates them at commit. If another transaction changed a key that was read, the transaction aborts instead of committing against a stale read set. Optimistic locking validates reads automatically; this option adds the same validation to pessimistic transactions. | `ReadValidation` / `readValidation` |
| `decisionDurability` | `bestEffort`, `durable` | `bestEffort` | Persistent modifications use durable-intent finalization under either value. `durable` also rejects ephemeral modifications: an `eset`, `edelete`, or `eextend` inside a durable transaction aborts it. See [Durable Commit Decisions](/docs/architecture/distributed-transactions/#durable-commit-decisions). | `DecisionDurability` / `decisionDurability` |
| `asyncRelease` | `true`, `false` (also `yes`, `no`) | `false` | `true` releases acquired locks in the background for a faster response. `false` releases them before returning to the client. | `AsyncRelease` / `asyncRelease` |
| `autoCommit` | `true`, `false` (also `yes`, `no`) | `false` in a `begin` block; `true` for a script without one | `true` commits automatically if every operation succeeds. `false` requires an explicit `commit`. | `AutoCommit` / `autoCommit` |

Unknown option names, unknown values, and repeated options are script errors. `snapshot` cannot be combined with `readValidation="trackAndValidate"` because a historical view cannot validate against later writes.

Two examples with options that change how the transaction behaves:

```kahuna
begin (locking="pessimistic", readValidation="trackAndValidate")
  let current = get `inventory/item-42`
  set `inventory/item-42` current - 1
  commit
end
```

```kahuna
begin (decisionDurability="durable")
  set `accounts/alice` "90"
  set `accounts/bob` "110"
  commit
end
```

### Snapshot Transactions

`snapshot=<timestamp>` serves every read inside the transaction as of one fixed timestamp. Use it for audits, debugging, and historical queries where several reads must line up against the same past instant.

```kahuna
begin (snapshot=1718392012345)
  let old_config = get `config/feature-x`
  let old_services = get by bucket `services`
  commit
end
```

- The whole transaction is **read-only**. Writes are not allowed.
- Plain reads use the snapshot automatically. A per-statement `as of <other timestamp>` overrides it for that statement.
- Snapshot reads are **historical views**, not read-your-own-writes views.
- A key that existed at the snapshot time and was updated later returns the older visible value.
- Keys created after the snapshot time stay hidden.
- The `begin ... end` block still requires an explicit `commit`.

See [Revisions](/docs/distributed-keyvalue-store/revisions/) for historical reads and their retention limits.

## Array Indexing

Array indexes must resolve to whole numbers. Integers, whole-number floats, and numeric strings are accepted. Fractional values and empty strings are script errors.

```kahuna
let items = ["a", "b", "c"]
return items["1"]
```

The script returns `b`.

## Prefix Scans

`scan by prefix` and `escan by prefix` run outside transaction blocks only. Inside `begin ... end`, use `get by bucket` or `eget by bucket` for transactional prefix reads within one [partition](/docs/glossary/#partition).

```kahuna
begin
  let members = get by bucket `team/blue`
  commit
end
```

## User-Defined Functions

Deployments can add C# functions and call them like built-ins:

```kahuna
let checksum = acme_crc32(@payload)
set @checksum_key checksum
```

Built-in names are reserved, unknown functions return `Errored`, and user-defined functions cannot appear in key position. See [User-Defined Functions](/docs/scripts/user-defined-functions/).

## Statement-Result Guards

These boolean expressions inspect the last completed operation of a particular kind, not whichever statement ran most recently:

| Guard | Operation it remembers | When it is true |
|---|---|---|
| `not found` | Last `get`, `exists`, `get by bucket`, or `scan by prefix`, including ephemeral forms. | The read did not find its key or returned an empty collection. Successful `exists` counts as found. |
| `not set` | Last `set`, `delete`, or `extend`, including ephemeral forms. | The write did not take effect: a condition failed or a delete/extend found no key. Successful deletes and extends count as writes that took effect. |
| `not deleted` | Last `delete` or `edelete`. | No key was deleted. |
| `not extended` | Last `extend` or `eextend`. | No key's expiry was changed. |

A `let`, expression, or an operation of another kind does not overwrite the remembered result. For example, this guard still checks the read even though a write ran after it:

```kahuna
let profile = get `users/42`
set `audit/last-lookup` "42"
if not found then
  return "profile missing"
end
return profile
```

A newer write of any kind changes `not set`; only a delete changes `not deleted`, and only an extend changes `not extended`. If no earlier operation of the required kind ran, evaluating the guard is a script error. The guards describe an operation's result, **not whether the enclosing transaction has committed**. They do not replace handling transaction aborts or unknown commit outcomes.

When leading writes are optimized into set-many or delete-many, the remembered result is that of the **last statement in script order**, regardless of response arrival order. A conditional set that fails contributes no modified key; it does not by itself prevent other successful writes in that batch from committing.

`not deleted` and `not extended` are compound tokens; `deleted` and `extended` alone remain valid names.

## Switch Comparisons

`switch` evaluates its subject once and compares case values in source order through the same implementation as `==`. The first matching body runs. Later alternatives and cases are not evaluated:

```kahuna
switch 1
  case 1, 1 / 0 then return "matched"
  case 1 / 0 then return "unreachable"
end
```

This returns `"matched"` without dividing by zero. Numeric strings can compare with numbers, bytes compare with strings through UTF-8 encoding, and `null` matches only `null`. Incompatible comparisons are script errors: `switch 1 case "abc" then return true end` cannot parse `"abc"` as a number. String comparisons remain ordinal and case-sensitive. See [Switch/Case](/docs/scripts/control-structures/#switchcase) for syntax and locking behavior.

## Array JSON Encoding

`to_json`, and the conversion of nested arrays in a script result, write `NaN`, `Infinity`, and `-Infinity` as the JSON strings `"NaN"`, `"Infinity"`, and `"-Infinity"`. Top-level returned arrays still become a list of result values, with any nested array represented by its JSON text.

:::note
The encoder is iterative, so deeply nested arrays do not depend on recursive serialization. Unpaired UTF-16 surrogates become U+FFFD. The encoder does not make a scalar arithmetic error valid or remove the array and depth limits.
:::
