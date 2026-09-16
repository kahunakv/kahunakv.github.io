# User-Defined Functions

Kahuna Script can call deployment-specific functions written in C#. Use this when small domain logic should run inside the transaction, next to the data.

```kahuna
let total = acme_price_with_tax(@amount, "ES")
set @checksum_key acme_crc32(@payload)
```

Good candidates are hashing, validation, encoding, formatting, and pure business predicates. A function should not perform I/O or call back into Kahuna.

## Write a Function

User functions use the `Kahuna.Extensibility` API:

```csharp
using Kahuna.Extensibility;

static KahunaValue Double(in KahunaFunctionContext context, ReadOnlySpan<KahunaValue> args)
{
    return KahunaValue.From(args[0].AsLong() * 2);
}
```

`KahunaValue` supports the same value kinds as the script language:

| Kind | Build | Read |
|------|-------|------|
| `Null` | `KahunaValue.Null` | `IsNull` |
| `Bool` | `KahunaValue.From(bool)` | `AsBool()` |
| `Long` | `KahunaValue.From(long)` | `AsLong()` |
| `Double` | `KahunaValue.From(double)` | `AsDouble()` |
| `String` | `KahunaValue.From(string)` | `AsString()` |
| `Bytes` | `KahunaValue.From(byte[])` | `AsBytes()` |
| `Array` | `KahunaValue.FromArray(values)` | `AsArray()` |

The `As*` methods throw `KahunaFunctionException` when the kind does not match. Use `TryGet*` methods when a script can pass more than one kind.

`KahunaFunctionContext` exposes the function name, script line, transaction id, read timestamp, node name, logger, and `Fail(message)`. It does not expose key/value APIs.

## Register Functions

For an embedded node, register before constructing the node:

```csharp
EmbeddedKahunaOptions options = new();

options.Functions
    .Register("acme_double", Double, minArgs: 1, maxArgs: 1);

await using EmbeddedKahunaNode node = new(options, loggerFactory);
await node.StartAsync(cancellationToken);
```

For `kahuna-server`, publish a provider in an extension assembly:

```csharp
using Kahuna.Extensibility;

public sealed class AcmeFunctions : IKahunaFunctionProvider
{
    public void Register(KahunaFunctionRegistry registry)
    {
        registry.Register("acme_double", Double, 1, 1);
    }
}
```

Then load it at startup:

```bash
kahuna-server \
  --extension-assembly /opt/acme/Acme.KahunaFunctions.dll
```

`--extension-assembly` is repeatable. Without it, the server loads no extension functions.

## Registration Rules

- Names must match `[a-zA-Z_][a-zA-Z0-9_]*`.
- Names are case-sensitive.
- Built-in function names and aliases are reserved.
- Duplicate names are rejected.
- `maxArgs` must be `-1` for variadic functions or greater than or equal to `minArgs`.
- Registration must finish before the node is built.

Prefix names with an application tag, such as `acme_crc32`, so a future built-in function does not collide with your scripts.

## Cluster Rules

Function registrations are not replicated. Every node that may coordinate scripts must load the same function set.

A node without a function can still apply Raft entries, replay WAL, restore snapshots, serve values produced by another node, and receive backups or state transfer. It only fails when it coordinates a script that calls the missing function.

Each node reports a fingerprint of its registered function names and argument counts. The fingerprint appears in startup logs, metrics, and undefined-function errors:

```text
Undefined function 'acme_crc32' on node kahuna-2 (functions 3f2a91c0d4e17b55)
```

Different fingerprints mean the nodes loaded different extension builds.

## Runtime Rules

- Keep functions synchronous and fast.
- Do not perform network or disk I/O.
- Do not call `IKahuna`, `KahunaClient`, or other Kahuna APIs from inside a function.
- Keep captured state immutable and thread-safe.
- Make functions idempotent because transactions can be retried.
- Prefer deterministic results. Use `context.ReadTimestamp` or `hlc()` instead of wall-clock reads when ordering matters.
- Bound returned strings and byte arrays because returned values can travel through Raft.

Functions cannot appear in key position. Build or choose key names in the client and pass them as placeholders.

## Failures

Function failures roll back the transaction and return `Errored`.

| Cause | Result |
|-------|--------|
| Wrong argument count | `Invalid number of arguments for 'name' function` |
| `context.Fail(...)` or `KahunaFunctionException` | `Function 'name' failed: reason` |
| Other exception | The exception type is included and logged. |
| Function missing on this node | The error names the node and function fingerprint. |

Slow functions are not aborted by the function dispatcher. The transaction timeout is the backstop.

## Observability

| Instrument | Meaning |
|------------|---------|
| `kahuna.script_functions.registered` | Registered function count, tagged with node and fingerprint. |
| `kahuna.script_functions.calls` | Calls per function since process start. |
| `kahuna.script_functions.elapsed_ms` | Total time spent inside each function. |

`--function-slow-warn-ms` logs a warning when a user-defined function takes longer than the threshold. The default is `50` ms. Set it to `0` to disable the slow-call warning.

## Security

Extension assemblies run inside the server process with the server's privileges. They are not sandboxed. Treat them like server binaries: build, sign, distribute, and roll them out through the same production process.

Startup fails if an extension assembly is missing, has no provider, throws during registration, or registers an invalid name.
