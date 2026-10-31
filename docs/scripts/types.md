
# Types

Kahuna Script is dynamically typed: you never declare a variable's type, and each value has one of these built-in types at runtime:

- null
- bool
- int64
- float64
- string
- array
- bytes (only from user-defined functions)

## Int64

Represents an integer in the range of -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807.

This is a 64-bit signed integer, suited to IDs, counters, timestamps, and arithmetic.

```kahuna
let year = 2050
let remaining_tokens = 50
```

## Float64

Represents a floating-point number in the range of approximately ±5.0 × 10⁻³²⁴ to ±1.7 × 10³⁰⁸.

This is a 64-bit IEEE 754 double-precision float, suited to measurements, percentages, and other fractional values.

```kahuna
let threshold = 0.5
let weighted_load = 1.25
```

## String

Strings hold text, such as "hello" or 'user123'. They are immutable and use UTF-8 encoding:

```kahuna
let name = "Andres"
let robot = "Voltron"
```

Single- and double-quoted strings can span lines; raw line endings are preserved in the value. Use escapes for other control characters. See [Strings and Escapes](/docs/scripts/semantics/#strings-and-escapes).

## Booleans

Represent a `true` or `false` value:

```kahuna
let is_active = false
```

## Null

Represents the absence of a value:

```kahuna
let last_leader = null
```

## Arrays

An array groups values for iteration or for returning several results from a script. Its elements can share one type or mix any supported types, for example `[1, 2, 3]` or `["hello", false, 100.2]`:

```kahuna
let statuses = ["active", "inactive"]
```

Write an array literal with square brackets: `[]` is an empty array, and each element can be any expression, including another array. A trailing comma is a syntax error. Commands and operators also make arrays: `get by bucket`, `scan by prefix`, the range operator (`1..10`), and `split`.

When a script returns an array, each element is one value in the result. An array inside the returned array is sent as its JSON text, so `return [[1], [2, 3]]` returns the two values `[1]` and `[2,3]`. See [Script Semantics](/docs/scripts/semantics/) for the limits on array literals.

## Bytes

There is no bytes literal, and no command produces one. A bytes value appears only when a [user-defined function](/docs/scripts/user-defined-functions/) returns a byte array. `set` and `eset` store it unchanged, and `==` with a string compares the string's UTF-8 encoding byte for byte. When the script reads that key back, the value arrives as a string, like any other stored value.

## Values Read From Keys

Kahuna stores every value as bytes. `get`, `eget`, `get by bucket`, `scan by prefix`, and their ephemeral forms decode what they read as a UTF-8 **string**, whatever type the script wrote. After `set k 42`, `get k` returns the string `"42"`, and after `set k true`, `is_bool(v)` is `false`. Placeholder values are strings too. Arithmetic and comparison operators convert numeric strings on their own; functions such as `min` or `abs` do not, so convert with the [casting functions](/docs/scripts/functions/type/) first:

```kahuna
let stock_value = get `inventory/item-42`
let stock = to_int(stock_value)
```

A read value also carries the key's revision and expiration, which [`rev` and `expires`](/docs/scripts/functions/values-and-collections/) return.
