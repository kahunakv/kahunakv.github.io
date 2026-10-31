
# Functions: Values and Collections

A value that a script reads from a key carries more than its data: it also carries the key's [revision](/docs/glossary/#revision) and expiration. Use these functions to read that metadata, for example to build a compare-and-set update with `cmprev rev(x)` or to check how long a lease has left, and to count the elements of an array, such as the keys a bucket read returned.

| **Function** | **Description** | **Example** |
|--------------|-----------------|-------------|
| `count(array)` | Returns the number of elements in an array. | `count([1, 2, 3])` → `3` |
| `rev(x)` / `revision(x)` | Returns the revision of the key that `x` was read from, or `-1`. | `rev(config)` → `4` |
| `expires(x)` | Returns the expiration of the key that `x` was read from, in [HLC](/docs/glossary/#hybrid-logical-clock-hlc) milliseconds, or `0`. | `expires(lease) - hlc()` → `29951` |

To check whether a value is an array, use [`is_array`](/docs/scripts/functions/type/). To serialize an array to JSON, use [`to_json`](/docs/scripts/functions/string/).

## Compare and Set With `rev`

Read the key, compute the new value, and write it only if nobody changed the key in between:

```kahuna
let config = get @config_key
set @config_key @new_value cmprev rev(config)
if not set then
  throw "config changed concurrently, retry"
end
return rev(config)
```

## Time Left on a Lease

`expires` uses the same clock as [`hlc()`](/docs/scripts/functions/time/), so the difference is the time left in milliseconds:

```kahuna
let lease = eget `leases/report-job`
if is_null(lease) then
  return 0
end
return expires(lease) - hlc()
```

## Behavior

- `count` accepts only arrays. A string, a number, or `null` is a script error. Get the length of a string with [`len`](/docs/scripts/functions/string/).
- `rev` and `expires` return `-1` and `0` when the key does not exist. A missing key reads as `null`, and `null` carries no revision.
- On a key that never existed, `cmprev -1` matches, so the compare-and-set example above also creates the key. On a key that was deleted or has expired, `rev` also returns `-1`, but the key keeps its last revision, so `cmprev -1` is refused. Use `nx` to recreate such a key.
- The metadata stays with the value when you copy it (`let copy = config`), and with each element of a [`get by bucket`](/docs/scripts/commands/get-by-bucket/) result. A value computed from it, such as `concat(config, "x")`, or a literal, has revision `-1` and expiration `0`.
- `expires` returns `0` for a key without an expiration.
- Each function takes exactly one argument.
