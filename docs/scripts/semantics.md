# Script Semantics

Kahuna Script is intentionally small, but a few rules matter for correctness and predictable failure handling.

## Conditions

`if`, `&&`, `||`, and `!` require boolean values. Numbers, strings, arrays, objects, and `null` are not truthy or falsy.

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

Each element is one level in the parsed script, so a literal holds at most about 250 elements with the default `MaxScriptDepth` of 256. A longer literal is refused with a "nested too deeply" error. Use a range or `split` to make a long array.

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

Use `hlc()` for distributed deadlines and ordering values that another node may compare later. Use `current_time()` for human-readable timestamps.

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

Unknown option names, unknown values, and repeated options are script errors. `timeout` must be greater than zero and is clamped by the server's maximum transaction timeout.

`admissionWait` is separate from transaction lifetime. It controls how long a script waits for a transaction admission slot before it starts. `admissionWait=0` means "start only if a slot is free right now"; otherwise Kahuna returns `AdmissionRefused`.

`readValidation=trackAndValidate` tracks latest reads and validates them at commit. Optimistic locking does this automatically. Persistent modifications use durable-intent finalization under either policy; `decisionDurability=durable` rejects ephemeral modified keys. `snapshot` cannot be combined with read validation because a historical view cannot validate against later writes.

## Array Indexing

Array indexes must resolve to whole numbers. Integers, whole-number floats, and numeric strings are accepted. Fractional values and empty strings are script errors.

```kahuna
let items = ["a", "b", "c"]
return items["1"]
```

The script returns `b`.

## Prefix Scans

`scan by prefix` and `escan by prefix` run outside transaction blocks only. Inside `begin ... end`, use `get by bucket` or `eget by bucket` for partition-local transactional prefix reads.

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

This returns `"matched"` without dividing by zero. Numeric strings can compare with numbers, bytes compare with strings through UTF-8 encoding, and `null` matches only `null`. Incompatible comparisons are script errors: `switch 1 case "abc" then return true end` cannot parse `"abc"` as a number. String comparisons remain ordinal and case-sensitive. See [Switch/Case](control-structures.md#switchcase) for syntax and locking behavior.

## Array JSON Encoding

`to_json` and nested-array result conversion use an iterative array encoder, so deeply nested arrays do not depend on recursive serialization. Non-finite numeric values are encoded as the JSON strings `"NaN"`, `"Infinity"`, or `"-Infinity"`; unpaired UTF-16 surrogates become U+FFFD. This does not make a scalar arithmetic error valid or remove array/depth limits. Top-level returned arrays still become a list of result values, with any nested array represented by its JSON text.
