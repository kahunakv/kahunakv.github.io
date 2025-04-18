
# Functions: Math

Kahuna provides the following **mathematical functions** to support arithmetic operations within scripts:

| **Function**       | **Description**                                      | **Example**                     |
|--------------------|------------------------------------------------------|----------------------------------|
| `abs(x)`           | Returns the absolute value of `x`                    | `abs(-10)` → `10`               |
| `ceil(x)`          | Rounds `x` up to the nearest whole number            | `ceil(3.2)` → `4`               |
| `floor(x)`         | Rounds `x` down to the nearest whole number          | `floor(3.8)` → `3`              |
| `round(x)`         | Rounds `x` to the nearest whole number               | `round(4.5)` → `5`              |
| `max(a, b)`        | Returns the maximum of `a` and `b`                   | `max(7, 3)` → `7`               |
| `min(a, b)`        | Returns the minimum of `a` and `b`                   | `min(7, 3)` → `3`               |
| `clamp(x, a, b)`   | Clamps `x` to be within the range `[a, b]`           | `clamp(10, 0, 5)` → `5`         |
| `sqrt(x)`          | Returns the square root of `x`                       | `sqrt(16)` → `4`                |
| `pow(x, y)`        | Returns `x` raised to the power of `y`               | `pow(2, 3)` → `8`               |

These functions are useful for implementing game logic, conditional updates, or business rules directly inside **Kahuna Scripts**.