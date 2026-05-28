
# Functions: String

Kahuna provides the following **string manipulation functions**, allowing you to work efficiently with text values within your scripts:

| **Function**               | **Description**                                                       | **Example**                                |
|----------------------------|-----------------------------------------------------------------------|---------------------------------------------|
| `len(str)`                 | Returns the length of the string `str`                                | `len("hello")` → `5`                        |
| `length(str)`              | Alias for `len(str)`                                                  | `length("hello")` → `5`                     |
| `lower(str)`               | Converts `str` to lowercase                                           | `lower("HELLO")` → `"hello"`               |
| `upper(str)`               | Converts `str` to uppercase                                           | `upper("hello")` → `"HELLO"`               |
| `concat(left, right)`      | Concatenates two strings                                              | `concat("hello ", "world")` → `"hello world"` |
| `to_json(value)`           | Serializes a value to a JSON string                                   | `to_json([1, 2])` → `"[1,2]"`               |

These functions are useful for formatting values, validating inputs, parsing data, and handling dynamic key names in **Kahuna Scripts**.
