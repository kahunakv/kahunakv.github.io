
# Types

Kahuna Script is a dynamically typed language, which means that by default there is no need to specify the type of a variable, as this will be determined at runtime.

Every single expression in **Kahuna Script** has one of the following built-in types depending on its value:

- null
- bool
- int64
- float64
- string
- array

These data types can be used in scripts or key/value pairs as needed.

## Int64

Represents an integer in the range of -9,223,372,036,854,775,808 to 9,223,372,036,854,775,808.

This corresponds to a 64-bit signed integer, commonly used for IDs, counters, timestamps, and arithmetic operations in Kahuna Script.

```visual-basic
let year = 2050
let remaining_tokens = 50
```

## Float64

Represents a floating-point number in the range of approximately ±5.0 × 10⁻³²⁴ to ±1.7 × 10³⁰⁸.

This corresponds to a 64-bit IEEE 754 double-precision float, allowing for very large or very small real numbers with decimal precision—useful for calculations, measurements, percentages and scientific data in Kahuna Script.

```visual-basic
let threshold = 0.5
let weighted_load = 1.25
```

## String

Strings are immutable and use UTF-8 encoding. Used for text values, e.g., "hello" or 'user123':

```visual-basic
let name = "Andres"
let robot = "Voltron"
```

## Booleans

Represent a `true` or `false` value:

```visual-basic
let is_active = false
```

## Null

Represents the absence of a value, e.g., null

```visual-basic
let last_leader = null
```

## Arrays

An array can contain elements of a single type or a mix of any supported types in Kahuna, e.g., [1, 2, 3], ["a", "b", "c"] or ["hello", false, 100.2]

Arrays are useful for grouping values, iterating over elements, or returning structured data from a script.

```visual-basic
let statuses = ["active", "inactive"]
```