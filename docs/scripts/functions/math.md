
# Functions: Math

Kahuna provides the following **mathematical functions** to support arithmetic operations within scripts:

| **Function**       | **Description**                                      | **Example**                     |
|--------------------|------------------------------------------------------|----------------------------------|
| `abs(x)`           | Returns the absolute value of `x`                    | `abs(-10)` → `10`               |
| `ceil(x)`          | Rounds `x` up to the nearest whole number            | `ceil(3.2)` → `4`               |
| `floor(x)`         | Rounds `x` down to the nearest whole number          | `floor(3.8)` → `3`              |
| `round(x, digits)` | Rounds `x` to the given number of decimal places     | `round(2.551, 1)` → `2.6`       |
| `nearly_equals(a, b, tolerance)` | Returns `true` when two numbers differ by no more than the non-negative tolerance | `nearly_equals(1, 1.0009, 0.001)` → `true` |
| `max(a, b)`        | Returns the maximum of `a` and `b`                   | `max(7, 3)` → `7`               |
| `min(a, b)`        | Returns the minimum of `a` and `b`                   | `min(7, 3)` → `3`               |
| `pow(x, y)`        | Returns `x` raised to the power of `y`               | `pow(2, 3)` → `8`               |

These functions are useful for implementing game logic, conditional updates, or business rules directly inside **Kahuna Scripts**.
