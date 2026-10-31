# Single-Key Script Fast Path

Counters, flags, rate limiters, and temporary coordination state usually come down to the same short script: read one [ephemeral](/docs/glossary/#durability) key, decide, and write it back, the kind of job you might give a Redis Lua script. Kahuna recognizes this shape automatically and runs it with fewer internal steps than a general transaction. You write the script as usual; there is nothing to enable.

The optimization changes cost, not behavior. The same script result, lock behavior, rollback behavior, and key state are preserved.

## When It Applies

Inside a node, each key is owned by an [actor](/docs/glossary/#actor), a worker that processes one message at a time. A *turn* is one uninterrupted step of that actor. A script can run entirely inside one actor turn when it:

- Uses ephemeral key/value commands: `eget`, `eset`, `eexists`, `edelete`, or `eextend`
- Touches exactly one key after parameter resolution
- Runs as an auto-commit script, without explicit `begin` options
- Uses statements such as `let`, `if`, `switch`, `return`, and `throw`
- Runs on the node that currently leads that key's [partition](/docs/glossary/#partition)

Example:

```kahuna
let current = eget @counter_key

if not found then
  eset @counter_key 1 ex to_int(@expires_ms)
  return 1
end

let count = to_int(current)

if count >= @limit then
  return 0
end

eset @counter_key count + 1 ex to_int(@expires_ms)
return 1
```

This kind of script normally needs several internal actor messages: acquire the key lock, read, write, prepare, check range locks, commit, and release. On the fast path, the owning actor performs the same steps directly in one turn.

## When It Falls Back

Kahuna uses the general transaction path when the script:

- Touches persistent keys
- Touches more than one key
- Uses `begin ... commit` or any `begin` option
- Uses `sleep`, `for`, bucket reads, prefix scans, or batched writes
- Uses a range-routed [key space](/docs/glossary/#key-space-and-key-range-routing)
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

`ScriptActorTurns` controls the full one-key script turn. `FusedEphemeralFinalize` is a smaller optimization that finalizes a transaction whose whole write set is one ephemeral key in one actor turn instead of separate prepare, range-lock probe (a check that no transaction holds a range lock covering the key), and commit messages. It can also help interactive transactions.

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
