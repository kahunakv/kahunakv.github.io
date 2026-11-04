
# Functions: Math

Use these functions for calculations inside a script, such as refilling a rate-limit bucket with `floor` and `min`:

| **Function**       | **Description**                                      | **Example**                     |
|--------------------|------------------------------------------------------|----------------------------------|
| `abs(x)`           | Returns the absolute value of `x`                    | `abs(-10)` → `10`               |
| `ceil(x)`          | Rounds `x` up to the nearest whole number            | `ceil(3.2)` → `4`               |
| `floor(x)`         | Rounds `x` down to the nearest whole number          | `floor(3.8)` → `3`              |
| `round(x, digits)` | Rounds `x` to the given number of decimal places     | `round(2.551, 1)` → `2.6`       |
| `nearly_equals(a, b, tolerance)` | Returns `true` when two numbers differ by no more than the non-negative tolerance | `nearly_equals(1, 1.0009, 0.001)` → `true` |
| `max(a, b)`        | Returns the maximum of `a` and `b`                   | `max(7, 3)` → `7`               |
| `min(a, b)`        | Returns the minimum of `a` and `b`                   | `min(7, 3)` → `3`               |
| `max_int()` | Largest int64: `9223372036854775807` | `max_int() - 1` |
| `min_int()` | Smallest int64: `-9223372036854775808` | `min_int() + 1` |
| `max_double()` | Largest finite float: approximately `1.7976931348623157E+308` | `max_double()` |
| `min_double()` | Most negative finite float: approximately `-1.7976931348623157E+308` | `min_double()` |
| `pow(x, y)`        | Returns `x` raised to the power of `y`               | `pow(2, 3)` → `8`               |

## Example: Clamp a Token Count

This script adds 5 tokens to an ephemeral counter but never lets it pass a capacity of 100. `min` caps the count, and `to_int` converts the stored value, which a script reads as a string:

```kahuna
let tokens_value = eget @bucket_key
let tokens = 0
if not is_null(tokens_value) then
  let tokens = to_int(tokens_value)
end
let refilled = min(tokens + 5, 100)
eset @bucket_key refilled
return refilled
```

## Argument and Result Types

- Functions with numeric arguments require an integer or a float. A string is a script error, including a numeric string read from a key or passed as a parameter, so convert it first with [`to_int` or `to_double`](/docs/scripts/functions/type/).
- `abs` keeps the input type: `abs(-3)` is an integer and `abs(-3.5)` is a float.
- `ceil`, `floor`, `round`, and `pow` always return a float, even for integer input: `is_float(ceil(3))` and `is_float(pow(2, 3))` are `true`. A whole-number result prints without a decimal point, as in `pow(2, 3)` → `8`. Wrap the call in `to_int` when you need an integer.
- `min` and `max` compare exact values and return the chosen argument with its own type: `max(3, 2.5)` is integer `3`, while `min(3, 2.5)` is float `2.5`. Ties return the first argument.
- `round` takes exactly two arguments; `digits` must be an integer from `0` to `15`. A value exactly halfway rounds to the nearest even digit: `round(2.5, 0)` is `2` and `round(3.5, 0)` is `4`.
- `min` and `max` take exactly two arguments. Nest calls to compare more values: `max(a, max(b, c))`.

Integer `abs` fails for `min_int()` because its positive counterpart is outside int64 range. `pow` and other float-producing operations fail when their result would be NaN or infinity. See [numeric error behavior](/docs/scripts/semantics/#overflow-and-finite-values).

## Numeric Limits

The four limit functions take no arguments and are available in Kahuna 1.15.0 and later. `min_double()` means the most negative finite float, not the smallest positive float. These names are reserved built-ins and cannot be used by extensions.

Check headroom before arithmetic when you want a specific outcome instead of an overflow error. This script refuses to increment a counter already at its maximum:

```kahuna
let value = get `counters/orders`
let current = 0
if found then
  let current = to_int(value)
end
if current == max_int() then
  throw "Counter exhausted"
end
set `counters/orders` current + 1
```
