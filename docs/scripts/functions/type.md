
# Functions: Type

Kahuna provides functions to **check the type of a variable** and to **cast values between supported types**, helping developers write safer and more predictable logic.

### Type Checking Functions

| **Function**      | **Description**                               | **Example**                        |
|-------------------|-----------------------------------------------|-------------------------------------|
| `is_null(x)`       | Returns `true` if `x` is `null`               | `is_null(null)` → `true`            |
| `is_bool(x)`       | Returns `true` if `x` is a boolean            | `is_bool(true)` → `true`            |
| `is_int(x)`        | Returns `true` if `x` is an integer           | `is_int(42)` → `true`            |
| `is_double(x)`      | Returns `true` if `x` is an double           | `is_double(42.5)` → `true`            |
| `is_string(x)`     | Returns `true` if `x` is a string             | `is_string("hello")` → `true`       |
| `is_bytes(x)`      | Returns `true` if `x` is a byte stream        | `is_bytes(some_bytes)` → `true`       |
| `is_array(x)`      | Returns `true` if `x` is an array             | `is_array([1, 2, 3])` → `true`       |

---

### Type Casting Functions

| **Function**      | **Description**                               | **Example**                          |
|-------------------|-----------------------------------------------|---------------------------------------|
| `to_bool(x)`       | Casts `x` to a boolean                        | `to_bool("true")` → `true`            |
| `to_int(x)`        | Casts `x` to a int number                      | `to_int("42")` → `42`              |
| `to_double(x)`      | Casts `x` to a double                         | `to_float("42.5")` → `42.5`          |
| `to_string(x)`     | Converts `x` to a string                      | `to_string(99)` → `"99"`              |
| `to_bytes(x)`      | Converts `x` to a byte stream                 | `to_bytes("99")` → `[57, 57]`          |
| `to_array(x)`      | Casts a value to an array (if possible)       | `to_array("a,b,c")` → `["a","b","c"]` |

---

These functions are especially useful in dynamic scripting scenarios, when working with user input, or reading heterogeneous data from the key/value store.