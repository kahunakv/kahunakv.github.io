
# Functions: Type

Values read from the key/value store or passed as placeholders may not have the type your logic needs. Use these functions to **check a value's type** and to **cast it** before you compare or calculate with it, for example `to_int(@amount)`.

### Type Checking Functions

| **Function**      | **Description**                               | **Example**                        |
|-------------------|-----------------------------------------------|-------------------------------------|
| `is_null(x)`       | Returns `true` if `x` is `null`               | `is_null(null)` → `true`            |
| `is_bool(x)` / `is_boolean(x)` | Returns `true` if `x` is a boolean | `is_bool(true)` → `true` |
| `is_int(x)` / `is_integer(x)` / `is_long(x)` | Returns `true` if `x` is an integer | `is_int(42)` → `true` |
| `is_float(x)` / `is_double(x)` | Returns `true` if `x` is a floating-point number | `is_double(42.5)` → `true` |
| `is_str(x)` / `is_string(x)` | Returns `true` if `x` is a string | `is_string("hello")` → `true` |
| `is_array(x)`      | Returns `true` if `x` is an array             | `is_array([1, 2, 3])` → `true`       |

---

### Type Casting Functions

| **Function**      | **Description**                               | **Example**                          |
|-------------------|-----------------------------------------------|---------------------------------------|
| `to_bool(x)` / `to_boolean(x)` | Casts `x` to a boolean | `to_bool("true")` → `true` |
| `to_int(x)` / `to_integer(x)` / `to_long(x)` / `to_number(x)` | Casts `x` to an integer | `to_int("42")` → `42` |
| `to_float(x)` / `to_double(x)` | Casts `x` to a floating-point number | `to_double("42.5")` → `42.5` |
| `to_str(x)` / `to_string(x)` | Converts `x` to a string | `to_string(99)` → `"99"` |

### Conversion Rules

| Input | `to_int` | `to_double` | `to_bool` | `to_str` |
|-------|----------|-------------|-----------|----------|
| integer | unchanged | same value as a float | `true` unless `0` | `"42"` |
| float | truncated toward zero: `to_int(3.9)` → `3`, `to_int(-3.9)` → `-3` | unchanged | `true` unless `0.0` | `"1.5"` |
| bool | `true` → `1`, `false` → `0` | `true` → `1`, `false` → `0` | unchanged | `"true"` / `"false"` |
| string | parsed as an integer | parsed as a number | `true` only for `"true"` in any case | unchanged |
| `""` (empty string) | `0` | `0` | `false` | `""` |
| `null` | error | error | error | `""` |
| array | error | error | error | error |

- A string that does not parse is a script error, not `0`: `to_int("abc")`, `to_int("4.2")`, and `to_int("0x10")` all fail. Use `to_double` for strings with a decimal point.
- `to_bool` never fails on a string. Every string other than `"true"` (compared case-insensitively) becomes `false`, including `"yes"`, `"1"`, and `"TRUE "` with a trailing space.
- `to_str(null)` returns an empty string, not `null`.

Values read with `get` and the other read commands, and every placeholder value, are strings. Cast them before you use a function that requires a number, such as [`min`](/docs/scripts/functions/math/). Arithmetic and comparison operators convert numeric strings on their own.
