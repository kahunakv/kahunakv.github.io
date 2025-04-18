
# Functions: String

Kahuna provides the following **string manipulation functions**, allowing you to work efficiently with text values within your scripts:

| **Function**               | **Description**                                                       | **Example**                                |
|----------------------------|-----------------------------------------------------------------------|---------------------------------------------|
| `len(str)`                 | Returns the length of the string `str`                                | `len("hello")` → `5`                        |
| `lower(str)`               | Converts `str` to lowercase                                           | `lower("HELLO")` → `"hello"`               |
| `upper(str)`               | Converts `str` to uppercase                                           | `upper("hello")` → `"HELLO"`               |
| `trim(str)`                | Removes leading and trailing whitespace from `str`                    | `trim(" hello ")` → `"hello"`              |
| `startsWith(str, prefix)` | Returns `true` if `str` starts with the given `prefix`                | `startsWith("abc123", "abc")` → `true`     |
| `endsWith(str, suffix)`   | Returns `true` if `str` ends with the given `suffix`                  | `endsWith("file.txt", ".txt")` → `true`    |
| `contains(str, substr)`   | Returns `true` if `substr` is found within `str`                      | `contains("hello world", "world")` → `true`|
| `replace(str, from, to)`  | Replaces all occurrences of `from` with `to` in `str`                 | `replace("a-b-c", "-", "_")` → `"a_b_c"`   |
| `split(str, delimiter)`   | Splits `str` into an array using `delimiter`                          | `split("a,b,c", ",")` → `["a", "b", "c"]`   |
| `join(array, delimiter)`  | Joins array elements into a string separated by `delimiter`           | `join(["a", "b"], "-")` → `"a-b"`           |
| `substring(str, start, end)` | Returns a substring from `start` to `end` (exclusive)               | `substring("abcdef", 1, 4)` → `"bcd"`       |

These functions are useful for formatting values, validating inputs, parsing data, and handling dynamic key names in **Kahuna Scripts**.