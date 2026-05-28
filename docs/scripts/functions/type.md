
# Functions: Type

Kahuna provides functions to **check the type of a variable** and to **cast values between supported types**, helping developers write safer and more predictable logic.

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

---

These functions are especially useful in dynamic scripting scenarios, when working with user input, or reading heterogeneous data from the key/value store.
