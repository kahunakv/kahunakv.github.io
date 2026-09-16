
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

String comparisons are ordinal and culture-invariant. Every argument to the string-specific functions must be a string.

Positions are zero-based. `substring` accepts a start equal to the string length and returns an empty string. Negative, fractional, or out-of-range positions are script errors.

`split` keeps empty parts so field positions stay stable:

```kahuna
let parts = split("tenant::orders:", ":")
return count(parts)
```

An empty separator is a script error.
