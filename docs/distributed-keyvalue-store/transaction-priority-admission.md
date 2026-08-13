# Transaction Priority Admission

Transaction priority admission lets Kahuna decide which transaction starts next when a node is saturated.

By default the feature is disabled. `MaxConcurrentTransactions` and `MaxConcurrentSessions` both default to `0`, which means every transaction starts immediately. In that pass-through mode, Kahuna still records priority for metrics, but priority does not queue, reorder, or throttle anything.

When an operator enables a concurrency ceiling, transactions that cannot start immediately wait in a per-node priority queue. Kahuna starts the highest-priority eligible waiter first.

Priority affects only admission:

- It governs when a transaction starts.
- It does not preempt a transaction that is already running.
- It does not change MVCC, locks, two-phase commit, durable decisions, or commit semantics.
- It is per node, so each node orders only the transactions it receives.

## Priority Levels

| Priority | Value | Use for |
|---|---:|---|
| `Background` | `0` | Bulk or deferrable work such as analytics sweeps. |
| `Low` | `1` | Work below ordinary traffic but still latency-relevant. |
| `Normal` | `2` | Default for callers that do not specify a priority. |
| `High` | `3` | Latency-critical application transactions. |
| `Critical` | `4` | Work that must not be deferred behind anything else. |

Do not mark ordinary traffic as `Critical`. If everything is critical, priority stops carrying useful information and the reserve cannot protect genuinely urgent work.

Unknown priority values are normalized to `Normal`, not clamped upward. That prevents untrusted or newer clients from accidentally claiming critical priority.

## What Is Gated

The admission gate applies to transactions:

- explicit `BEGIN ... COMMIT ... END` scripts
- multi-statement scripts that run as auto-commit transactions
- interactive transaction sessions

Single standalone script commands are not gated. A script that contains only one `SET`, `GET`, `DELETE`, `EXTEND`, bucket read, prefix scan, or ephemeral equivalent runs directly against the store. Priority can be supplied for those calls, but it is ignored because no transaction is opened.

## Setting Priority

### Interactive Sessions

```csharp
await using KahunaTransactionSession session =
    await client.StartTransactionSession(new KahunaTransactionOptions
    {
        Priority = TransactionPriority.High,
        Timeout = 30_000,
        AdmissionWaitMs = 2_000
    });
```

### Script Execution

```csharp
KahunaKeyValueTransactionResult result =
    await client.ExecuteKeyValueTransactionScript(
        script,
        hash: null,
        parameters: parameters,
        priority: TransactionPriority.Background
    );
```

Compiled scripts expose the same control:

```csharp
KahunaTransactionScript compiled = client.LoadTransactionScript(script);

KahunaKeyValueTransactionResult result =
    await compiled.Run(TransactionPriority.High, parameters);
```

### Inline Script Option

A script can set its own priority. Inline priority overrides the priority carried by the transport.

```kahuna
begin (priority="high", locking="optimistic")
  let row = get `orders/42`
  set `orders/42` row
  commit
end
```

Accepted inline priority values are `background`, `low`, `normal`, `high`, and `critical`.

Scripts can also set `admissionWait`, in milliseconds. This is how long the caller is willing to wait for a slot before the transaction starts. It is separate from `timeout`, which bounds how long the transaction may run after it has been admitted.

```kahuna
begin (priority="high", admissionWait=2000, timeout=10000)
  let row = get `orders/42`
  set `orders/42` row
  commit
end
```

## Capacity Model

Kahuna has two independent admission gates:

| Gate | Ceiling | Slot held for |
|---|---|---|
| Script | `MaxConcurrentTransactions` | The duration of the script transaction execution. |
| Session | `MaxConcurrentSessions` | As long as the interactive session remains open. |

They are separate because scripts and sessions hold capacity for very different lengths of time. A script is bounded by its execution. An interactive session is client-paced and can sit idle while it remains open.

Size `MaxConcurrentSessions` more generously than `MaxConcurrentTransactions`. It limits open sessions, not just actively running operations.

## Reserved Slots

`TransactionPriorityReservedSlots` protects capacity for `High` and `Critical` transactions.

For each gate:

```text
total in flight    <= MaxConcurrent...
ordinary in flight <= MaxConcurrent... - TransactionPriorityReservedSlots
```

`Background`, `Low`, and `Normal` are ordinary priorities. They cannot occupy reserved slots. `High` and `Critical` can use both ordinary capacity and the reserve.

This prevents bulk traffic from filling every slot on a saturated node.

## Aging

Strict priority can starve low-priority work. Kahuna avoids that with aging.

For every `TransactionPriorityAgingThreshold` milliseconds spent waiting, a queued transaction gains one effective priority level for dispatch ordering. Aging is capped at `High`; `Critical` is never aged because it is already at the top.

Aging changes position in line, not eligibility for reserved capacity. An aged `Background` transaction can overtake newer ordinary work, but it still cannot consume a reserved slot.

Set `TransactionPriorityAgingThreshold` to `0` to disable aging.

## Queue Backpressure

`TransactionPriorityMaxQueued` bounds how many callers may wait per gate. When the queue is full, Kahuna refuses admission immediately and returns `AdmissionRefused`.

No transaction has started in that case, so retrying is safe. Clients should back off and retry rather than treating it as a conflict.

Admission wait is budgeted separately from transaction lifetime:

- `AdmissionWaitMs` on `KahunaTransactionOptions` controls how long an interactive session waits to start.
- `admissionWait` in a script `begin (...)` block controls how long that script waits to start.
- `timeout` still controls the admitted transaction lifetime or script execution time.

If the caller's admission budget expires before a slot opens, Kahuna returns `AdmissionRefused`.

`AdmissionRefused` and `MustRetry` are both retryable, but they mean different things. Use backoff for `AdmissionRefused` because the node is shedding load. Retry `MustRetry` promptly because it usually means a transient routing, leadership, or replication condition.

## Configuration

| Setting | CLI flag | Default | Meaning |
|---|---|---:|---|
| `MaxConcurrentTransactions` | `--max-concurrent-transactions` | `0` | Script transactions running at once. `0` disables the script gate. |
| `MaxConcurrentSessions` | `--max-concurrent-sessions` | `0` | Interactive sessions open at once. `0` disables the session gate. |
| `TransactionPriorityReservedSlots` | `--transaction-priority-reserved-slots` | `0` | Slots only `High` and `Critical` transactions may occupy. |
| `TransactionPriorityAgingThreshold` | `--transaction-priority-aging-threshold` | `1000` | Milliseconds of waiting per effective priority promotion. `0` disables aging. |
| `TransactionPriorityMaxQueued` | `--transaction-priority-max-queued` | `4096` | Waiting callers per gate before new arrivals receive `AdmissionRefused`. `0` makes the wait queue unbounded. |
| `DefaultAdmissionWaitMs` | `--default-admission-wait` | `5000` | Admission wait used when the caller does not specify one. |
| `MaxAdmissionWaitMs` | `--max-admission-wait` | `30000` | Maximum admission wait allowed by the server. Caller-supplied waits are clamped to this value. |

Start with pass-through mode and observe the metrics before setting a ceiling. Set ceilings near healthy observed concurrency, then add a small reserve only if high-priority work queues behind bulk work.

## Metrics

Transaction admission metrics are published on the `Kahuna` meter. Each instrument is tagged by `gate` (`script` or `session`) and `priority`.

| Instrument | Meaning |
|---|---|
| `kahuna.tx_admission.in_flight` | Transactions currently holding an admission slot. |
| `kahuna.tx_admission.queued` | Transactions currently waiting for a slot. Non-zero means the gate is active. |
| `kahuna.tx_admission.max_queue_depth` | High-water mark of simultaneous waiters. |
| `kahuna.tx_admission.admitted` | Transactions admitted since startup. |
| `kahuna.tx_admission.aged_promotions` | Waiters promoted by aging at least once. |
| `kahuna.tx_admission.abandoned_while_waiting` | Waiters whose admission budget expired before they started. |
| `kahuna.tx_admission.rejected_queue_full` | Requests refused because the wait queue was full. |

Watch `queued` first. If it stays zero, the gate is transparent. If `queued` is sustained for `High` or `Critical`, the ceiling may be too low or a reserve may be needed. If `rejected_queue_full` rises, the node is shedding transaction starts and callers should be backing off.
