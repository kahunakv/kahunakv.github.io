
# Functions: String

Kahuna provides string helpers for formatting, validation, and parsing inside scripts.

| Function | Description | Example |
|----------|-------------|---------|
| `len(str)` | Returns the length of `str`. | `len("hello")` returns `5` |
| `length(str)` | Alias for `len(str)`. | `length("hello")` returns `5` |
| `lower(str)` | Converts `str` to lowercase. | `lower("HELLO")` returns `"hello"` |
| `upper(str)` | Converts `str` to uppercase. | `upper("hello")` returns `"HELLO"` |
| `concat(left, right)` | Concatenates two strings. | `concat("hello ", "world")` returns `"hello world"` |
| `substring(str, start)` | Returns the rest of `str` from `start`. | `substring("hello", 1)` returns `"ello"` |
| `substring(str, start, length)` | Returns `length` characters from `start`. | `substring("hello", 1, 3)` returns `"ell"` |
| `starts_with(str, prefix)` | Returns `true` when `str` starts with `prefix`. | `starts_with("orders/42", "orders/")` |
| `ends_with(str, suffix)` | Returns `true` when `str` ends with `suffix`. | `ends_with("file.json", ".json")` |
| `index_of(str, needle)` | Returns the first zero-based index of `needle`, or `-1`. | `index_of("a:b", ":")` returns `1` |
| `split(str, separator)` | Returns an array of every part between separators. | `split("a:b:", ":")` returns `["a", "b", ""]` |
| `trim(str)` | Removes leading and trailing whitespace. | `trim(" hello ")` returns `"hello"` |
| `to_json(value)` | Serializes a value to JSON. | `to_json([1, 2])` returns `"[1,2]"` |

`to_json` accepts an integer, a float, a string, or an array. A boolean or `null` on its own is a script error (`to_json(true)` and `to_json(null)` fail), but inside an array they are written as JSON values. `to_json` writes each element of an array as its JSON value: numbers, strings, `true`, `false`, `null`, and nested arrays. For example, `to_json(["a", true, null, [1]])` returns `"[\"a\",true,null,[1]]"`. A byte value inside an array is written as a string, decoded as UTF-8.

`len` and `length` accept only strings; for an array, use [`count`](/docs/scripts/functions/values-and-collections/). `concat` takes exactly two strings. Join more parts with nested calls, such as `concat(concat(a, ":"), b)`, and convert numbers first with [`to_str`](/docs/scripts/functions/type/). The `+` operator does not join strings.

String comparisons are ordinal and culture-invariant. Every argument to the string-specific functions must be a string.

Positions are zero-based. `substring` accepts a start equal to the string length and returns an empty string. Negative, fractional, or out-of-range positions are script errors.

`split` keeps empty parts so field positions stay stable:

```kahuna
let parts = split("tenant::orders:", ":")
return count(parts)
```

An empty separator is a script error.
