# Distributed Circuit Breaker

A circuit breaker stops callers from sending traffic to a dependency that is already failing. A local breaker works inside one process. A distributed breaker gives a whole fleet one shared window, one state, and one probe budget.

Kahuna is a good fit because a script transaction can read the current window, decide, and mutate the breaker state atomically.

## State

Use three states:

| State | Meaning |
|-------|---------|
| `closed` | Calls are allowed and outcomes are recorded. |
| `open` | Calls are rejected immediately. |
| `half` | A small number of probe calls are allowed. |

Move from `open` to `half` lazily. The first caller that sees the open period has elapsed claims a probe slot in the same transaction.

## Key Layout

Put one breaker scope on one placement group:

| Key | Holds |
|-----|-------|
| `&lt;scope&gt;|cb/state` | `closed`, `open`, or `half` |
| `&lt;scope&gt;|cb/gen` | Epoch number for the active observation window |
| `&lt;scope&gt;|cb/openedat` | Millisecond timestamp of the last open transition |
| `&lt;scope&gt;|cb/probeok` | Successful probes in the current recovery |
| `&lt;scope&gt;|cb.obs/&lt;uuid&gt;` | One observation, such as `42:f` or `42:s` |
| `&lt;scope&gt;|cb.probe/&lt;uuid&gt;` | One leased probe claim |

The placement group is the part before the first `|`, so every key above routes to the same partition. That lets the scripts use the one-phase transaction path and one partition leader.

## Record an Outcome

This script records success or failure while the breaker is closed. It opens the breaker when at least four observations exist and failures reach 50%.

```kahuna
begin (locking=pessimistic, timeout=20000)
  let st = get @state
  let g = get @gen
  let gen = 0
  if g != null then
    let gen = to_int(g)
  end

  let state = "closed"
  if st != null then
    let state = to_string(st)
  end

  let verdict = "ignored"
  if state == "closed" then
    let fmark = concat(to_string(gen), ":f")
    let smark = concat(to_string(gen), ":s")
    let mark = smark
    if @outcome == "f" then
      let mark = fmark
    end

    let window = get by bucket @obs
    let total = 1
    let fails = 0
    if @outcome == "f" then
      let fails = 1
    end

    set @obskey mark ex 60000

    for v in window do
      if v == fmark then
        let fails = fails + 1
        let total = total + 1
      end
      if v == smark then
        let total = total + 1
      end
    end

    let verdict = concat("recorded:", concat(to_string(fails), concat("/", to_string(total))))
    if total >= 4 && fails * 1000 >= 500 * total then
      set @state "open"
      set @gen to_string(gen + 1)
      set @openedat to_string(hlc())
      let verdict = "opened"
    end
  end

  let answer = verdict
  commit
end
```

Use integer math for ratios. `fails * 1000 >= threshold * total` avoids floating-point edge cases at the boundary.

## Admit a Call

This script returns `closed`, `probe`, or `rejected`.

```kahuna
begin (locking=pessimistic, timeout=20000)
  let st = get @state
  let state = "closed"
  if st != null then
    let state = to_string(st)
  end

  let verdict = "closed"
  if state == "open" then
    let opened = get @openedat
    let openedAt = 0
    if opened != null then
      let openedAt = to_int(opened)
    end

    if hlc() - openedAt >= 500 then
      set @state "half"
      set @probeok "0"
      let state = "half"
    else
      let verdict = "rejected"
    end
  end

  if state == "half" then
    let probes = get by bucket @probes
    if count(probes) < 2 then
      set @probekey "1" ex 5000
      let verdict = "probe"
    else
      let verdict = "rejected"
    end
  end

  let answer = verdict
  commit
end
```

A probe slot is a leased key, not a counter. If a caller dies after claiming a slot, the key expires and the budget recovers.

## Settle a Probe

```kahuna
begin (locking=pessimistic, timeout=20000)
  let st = get @state
  let state = "closed"
  if st != null then
    let state = to_string(st)
  end

  let verdict = "ignored"
  if state == "half" then
    let claim = get @probekey
    if claim == null then
      let verdict = "stale"
    else
      delete @probekey

      if @outcome == "f" then
        let g = get @gen
        let gen = 0
        if g != null then
          let gen = to_int(g)
        end
        set @state "open"
        set @gen to_string(gen + 1)
        set @openedat to_string(hlc())
        let verdict = "reopened"
      else
        let ok = get @probeok
        let successes = 1
        if ok != null then
          let successes = to_int(ok) + 1
        end
        if successes >= 2 then
          set @state "closed"
          set @probeok "0"
          let verdict = "recovered"
        else
          set @probeok to_string(successes)
          let verdict = "progress"
        end
      end
    end
  end

  let answer = verdict
  commit
end
```

## Client Wiring

- Load each script once with `LoadTransactionScript` or the TypeScript `loadScript(...)` helper.
- Generate fresh UUIDs for observation and probe keys in the client.
- Retry `MustRetry` with the same probe key so one logical admission cannot claim multiple slots.
- Put the wrapped dependency call under a timeout shorter than the probe lease.
- Keep observation retention long enough to hold the minimum sample count for low-volume scopes.

## When Kahuna Is Unreachable

Decide this explicitly in the client. A scope last seen as `open` or `half` should usually reject because nothing confirmed recovery. A scope last seen as `closed`, or never seen, is policy-dependent. Do not silently fall back to one local breaker per process because that recreates the failure mode this recipe avoids.
