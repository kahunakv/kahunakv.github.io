# Functions: Time

Kahuna Script exposes two clock sources.

| Function | Description | Example |
|----------|-------------|---------|
| `current_time()` | Wall-clock time of the node running the script, in Unix epoch milliseconds. | `set @audit_key current_time()` |
| `hlc()` | Physical millisecond component of Kahuna's hybrid logical clock. Use for distributed deadlines and ordering. | `set @lease_key hlc() + 30000` |
| `hlc_counter()` | Logical counter for the same HLC reading observed by `hlc()`. | `set @tie_breaker hlc_counter()` |

Use `hlc()` when another node may compare the value later. Use `current_time()` when the value is only a human-readable timestamp.

```kahuna
set @lease_deadline hlc() + 30000
set @audit_timestamp current_time()
```

One script execution observes one HLC reading. Multiple calls to `hlc()` return the same physical component, and `hlc_counter()` describes that same reading.

All three functions take no arguments.
