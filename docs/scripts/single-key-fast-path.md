# Single-Key Script Fast Path

Kahuna automatically optimizes a common script shape: a short auto-commit script that touches one ephemeral key. This is the pattern behind high-throughput counters, flags, rate limiters, and temporary coordination state.

The optimization changes cost, not behavior. The same script result, lock behavior, rollback behavior, and key state are preserved.

## When It Applies

A script can run inside one actor turn when it:

- Uses ephemeral key/value commands: `EGET`, `ESET`, `EEXISTS`, `EDELETE`, or `EEXTEND`
- Touches exactly one key after parameter resolution
- Runs as an auto-commit script, without explicit `BEGIN` options
- Uses statements such as `LET`, `IF`, `SWITCH`, `RETURN`, and `THROW`
- Runs on the node that currently leads that key's partition

Example:

```kahuna
let current = eget @counter_key

if not found then
  eset @counter_key 1 ex @expires_ms
  return 1
end

let count = to_int(current)

if count >= @limit then
  return 0
end

eset @counter_key count + 1 ex @expires_ms
return 1
```

This kind of script normally needs several internal actor messages: acquire the key lock, read, write, prepare, check range locks, commit, and release. On the fast path, the owning actor performs the same steps directly in one turn.

## When It Falls Back

Kahuna uses the general transaction path when the script:

- Touches persistent keys
- Touches more than one key
- Uses `BEGIN ... COMMIT` or any `BEGIN` option
- Uses `SLEEP`, `FOR`, bucket reads, prefix scans, or batched writes
- Uses a range-routed key space
- Is routed to a node that does not lead the key's partition

If Kahuna initially guesses that a script is eligible but later sees a different key or unsupported statement, it discards the in-turn attempt and reruns the script on the general path. Nothing from the abandoned attempt becomes visible.

## Configuration

Both optimizations are enabled by default:

| Surface | Default | Disable |
|---------|---------|---------|
| Server script actor turns | enabled | `--disable-script-actor-turns` |
| Server fused ephemeral finalize | enabled | `--disable-fused-ephemeral-finalize` |
| Embedded script actor turns | enabled | `ScriptActorTurns = false` |
| Embedded fused ephemeral finalize | enabled | `FusedEphemeralFinalize = false` |

`ScriptActorTurns` controls the full one-key script turn. `FusedEphemeralFinalize` is a smaller optimization that finalizes a transaction whose whole write set is one ephemeral key in one actor turn instead of separate prepare, range-lock probe, and commit messages. It can also help interactive transactions.

## Metrics

The `Kahuna` meter publishes:

| Metric | Meaning |
|--------|---------|
| `kahuna.transactions.script_actor_turns` | Scripts that ran start to finish inside one actor turn. |
| `kahuna.transactions.script_actor_turn_escapes` | Scripts that left the fast path and reran on the general path. |
| `kahuna.transactions.fused_ephemeral_finalizes` | Single-ephemeral-key transactions finalized in one actor turn. |

A sustained `script_actor_turn_escapes` rate usually means scripts look eligible at parse time but resolve to a different key shape at runtime.

## Measured Example

On one local 8-core Apple Silicon machine, with Kahuna server and `kahuna-bench` on the same host, memory storage, memory WAL, cleartext gRPC, request frames enabled, and concurrency 64, the fixed-window rate-limit script reached 194k-203k requests per second with p50 around 284-289 us and p99 around 0.6-0.8 ms.

The same machine measured a Valkey Lua `EVAL` counter at 169k requests per second. Treat this as a concrete local comparison, not as a substitute for benchmarking your own deployment.
