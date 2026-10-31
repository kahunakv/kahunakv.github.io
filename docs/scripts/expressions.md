
# Expressions

An expression is anything that produces a value: a literal, a variable, a calculation, or a function call. You use expressions to compute what a script stores, compares, and returns.

```kahuna
let my_var = 100 + 20.5
let is_active = true || false
let text = concat("my text", some_other_text_var)
```

Expressions can include variables, literal values, placeholders, operators, and parentheses that control evaluation order.

```kahuna
let total = (price * quantity) + tax
```

Commands such as `get` and `set` are statements, not expressions, so you cannot nest them inside an expression: `to_int(get k)` is a syntax error. Read the value into a variable first with `let v = get k`, then use `to_int(v)`.

## Operators

### Arithmetic Operators

Basic arithmetic:

- `+` Addition
- `-` Subtraction
- `*` Multiplication
- `/` Division

**Example:**

```kahuna
let result = (10 + 5) * 2
```

The value of `result` is `30`.

Dividing two integers gives an integer, truncated toward zero: `7 / 2` is `3` and `-7 / 2` is `-3`. Make one operand a float to keep the fraction: `7 / 2.0` is `3.5`.

Division by zero is a script error. Numeric equality is exact; use [`nearly_equals`](/docs/scripts/functions/math/) when a floating-point calculation should compare with a tolerance.

### Logical Operators

Combine boolean conditions:

- `&&`: Returns `true` if **both** expressions are true
- `||`: Returns `true` if **at least one** expression is true
- `!` or `not`: Inverts the boolean value of an expression

**Example:**

```kahuna
let is_valid = (age > 18) && (has_id == true)
let should_retry = (error != null) || (timeout_occurred)
let is_guest = !is_registered
```

Logical operators require boolean operands and short-circuit when the left side determines the result. This makes guard expressions safe:

```kahuna
let safe = divisor != 0 && total / divisor > 10
```

### Comparison Operators

Compare two values:

- `==` Equal to (`=` also works inside an expression)
- `!=` Not equal to (`<>` also works)
- `<` Less than
- `<=` Less than or equal to
- `>` Greater than
- `>=` Greater than or equal to

**Example:**

```kahuna
let is_adult = age >= 18
let has_access = role == "admin"
let is_different = score1 != score2
```

Comparison operators return `true` or `false`.

### Operator Precedence

Operators higher in this table bind tighter. Operators on the same row are evaluated left to right; unary `-` and `not` apply to the operand on their right.

| Precedence | Operators |
|------------|-----------|
| 1 (highest) | `[ ]` array index |
| 2 | `!`, `not` |
| 3 | unary `-` |
| 4 | `*`, `/` |
| 5 | `+`, `-` |
| 6 | `<`, `>`, `<=`, `>=` |
| 7 | `==`, `=`, `!=`, `<>` |
| 8 | `&&` |
| 9 | `\|\|` |
| 10 (lowest) | `..` range |

So `2 + 3 * 4` is `14`, `a || b && c` is `a || (b && c)`, and `0..n + 1` is `0..(n + 1)`.

`not` binds tighter than a comparison, unlike in Python or SQL: `not x == 5` parses as `(not x) == 5`. When `x` is a number, that is a script error, because `not` requires a boolean. Write `not (x == 5)` or `x != 5` instead.

### Range Operators

Create an array of integers from a minimum to a maximum:

```kahuna
let my_range = 1..10
```

This creates an array:

```text
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

Use ranges for iteration, indexing, or generating value sets. Ranges include both bounds. A range with a start greater than its end is empty, and a single evaluated range is capped at `100000` elements.

For detailed edge-case behavior, see [Script Semantics](/docs/scripts/semantics/).

## Function Calls

Kahuna Script has built-in functions for [strings](/docs/scripts/functions/string/) (including `to_json`), [math](/docs/scripts/functions/math/), [time](/docs/scripts/functions/time/), [type checks and casts](/docs/scripts/functions/type/), and [values and collections](/docs/scripts/functions/values-and-collections/) (`count`, `rev`, `expires`). Deployments can add their own [user-defined functions](/docs/scripts/user-defined-functions/).

A function call uses the following syntax:

```kahuna
function_name(arg1, arg2, ...)
```

**Examples:**

```kahuna
let name = upper("alice")
let a_number = round(10.55, 1)
let json_str = to_json([10, 42, 30])
```

`upper` returns `"ALICE"`, `round` returns `10.6`, and `to_json` serializes the array to JSON.

## Statement-Result Guards

`not found`, `not set`, `not deleted`, and `not extended` return booleans based on the last completed read, write, delete, or extend respectively. They preserve that result across unrelated statements and require an earlier operation of the relevant kind. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards) for exact scope, successful delete/extend handling, and batched statement order.
