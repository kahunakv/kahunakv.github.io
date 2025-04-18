
# Expressions

Expressions are the fundamental building blocks of Kahuna Script—nearly everything you write is an expression. The simplest and most precise definition of an expression is: anything that represents a value.

```visual-basic
let my_var = 100 + 20.5
let is_active = true || false
let text = concat("my text", some_other_text_var)
```

Expressions can include variables, literal values, placeholders, operators, and grouping parentheses.

```visual-basic
let total = (price * quantity) + tax
```

This expression combines variables and operators with parentheses to control evaluation order, and it ultimately produces a value.

## Operators

### Arithmetic Operators

These allow you to perform basic mathematical operations:

- `+` Addition
- `-` Subtraction
- `*` Multiplication
- `/` Division
- `%` Modulo (remainder)

**Example:**

```visual-basic
let result = (10 + 5) * 2  # result is 30
let remainder = 17 % 3     # remainder is 2
```

These operators can be used with numeric values and expressions within your script logic.

### Logical Operators

These apply boolean logic to expressions within a script:

- `&&`: Returns `true` if **both** expressions are true
- `||`: Returns `true` if **at least one** expression is true
- `!` or `not`: Inverts the boolean value of an expression

**Example:**

```visual-basic
let is_valid = (age > 18) && (has_id == true)
let should_retry = (error != null) || (timeout_occurred)
let is_guest = !is_registered
```

Logical operators are essential for building conditions, control flows, and validations in Kahuna Scripts.

### Comparison Operators

These allow you to compare two values:

- `==` Equal to
- `!=` Not equal to
- `<` Less than
- `<=` Less than or equal to
- `>` Greater than
- `>=` Greater than or equal to

**Example:**

```visual-basic
let is_adult = age >= 18
let has_access = role == "admin"
let is_different = score1 != score2
```

Comparison operators return boolean values (`true` or `false`) and are commonly used in conditions, filters, and validations within Kahuna Scripts.

### Range Operators

These allow you to easily create an array of values from a minimum to a maximum:

```visual-basic
let my_range = 1..10
```

This creates an array:

```ruby
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

You can use ranges for iteration, indexing, slicing, or generating value sets dynamically in Kahuna Scripts.

## Function Calls

Kahuna Script provides many **built-in functions** to assist developers with various common tasks.

A function call uses the following syntax:

```ruby
function_name(arg1, arg2, ...)
```

**Examples:**

```ruby
let name = upper("alice")             # returns "ALICE"
let a_number = round(10.5)            # rounds a number
let json_str = to_json([10, 42, 30])  # serializes to JSON
```

These functions cover areas like string manipulation, key/value operations, math, time, JSON handling, and more—making Kahuna Script a powerful tool for writing logic close to the data.

