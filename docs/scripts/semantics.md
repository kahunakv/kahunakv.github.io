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

Numeric equality is exact:

```kahuna
return 1 == 1.0      # true
return 1 == 1.0009   # false
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

## Strings and Escapes

Double-quoted, single-quoted, and backtick identifier literals decode escapes. Common escapes include `\n`, `\t`, `\r`, `\\`, `\"`, `\'`, octal escapes, `\xHH`, `\uHHHH`, and `\UHHHHHHHH`.

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

Repeating an option is a script error. `timeout` must be greater than zero.

`admissionWait` is separate from transaction lifetime. It controls how long a script waits for a transaction admission slot before it starts. `admissionWait=0` means "start only if a slot is free right now"; otherwise Kahuna returns `AdmissionRefused`.

## Array Indexing

Array indexes must resolve to whole numbers. Integers, whole-number floats, and numeric strings are accepted. Fractional values and empty strings are script errors.

```kahuna
let items = ["a", "b", "c"]
return items["1"]  # b
```

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
