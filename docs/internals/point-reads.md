# Point Reads and Published Heads

A latest point `Get` can now read a quiet resident key without a key/value actor mailbox round trip. This is an optimization of the existing leader-confirmed read path: it does not authorize follower reads, bypass transaction registration, or provide a new consistency mode.

## Read Flow

A routed get resolves the current partition and confirms local leadership before reading. A transaction-scoped get also registers its operation on the coordinator and completes that registration with the observed value or absence. A forwarded batch read re-resolves every key on arrival; a hosting follower cannot serve its local copy on the sender's assurance. Exhausting the forwarding budget returns `MustRetry`, rather than a stale local answer.

After confirmation, the read tries an immutable `PublishedHead` belonging to the key's actor. The record contains value, revision, expiry, modification timestamp, state, and whether MVCC state exists. Entry setters retract the record before mutations; the actor publishes a new record at the end of its turn before replying. A concurrent retraction after a read has accepted a live record represents a concurrent write; it does not turn that accepted observation into a later read of the replacement.

## Eligibility and Fallback

The published path applies only to latest point gets: no requested revision, no fixed read timestamp, and no enclosing actor turn. It falls back to the actor when any guard fails:

- No resident live-value record, or the record has been retracted (including tombstone paths).
- The actor holds a prefix lock.
- A newer committed head is pending for this key on the actor mailbox.
- For persistent keys, the unflushed-write overlay has a newer head, or a durable prepared intent exists.
- The head has expired and needs the actor's expiry handling.
- A transaction-scoped read encounters a key with existing MVCC state, including a pin or staged write.

The replicator notes per-key pending applies before advancing the applied frontier. This prevents a leadership confirmation from making an older published record appear current while its replacement is still queued. Durable intent visibility, cache misses, historical reads, expiry handling, and read-your-staged-write behavior continue through the actor path.

A published transactional read sends a `RecordReadPin` control message before the session's next request for that key. The actor creates the same MVCC observation the ordinary read path would create. Subsequent operations therefore validate against the revision actually read; published reads do not turn per-key pins into a shared snapshot. See [Transaction Reads and Locks](/docs/distributed-keyvalue-store/read-and-lock-semantics/).

## Configuration and Cache Lifetime

The path is enabled by default. Set `--disable-published-head-reads` on the server, or `PublishedHeadReads = false` in `KahunaConfiguration` or `EmbeddedKahunaOptions`, to send gets through the actor for diagnosis. Disabling it also stops actors publishing records.

Published reads update the record's usage timestamp. The collector folds that timestamp into entry recency before judging a key cold, so keys read only through this path are not mistakenly treated as idle. Records remain resident cache state, not additional persistent copies. Ephemeral eviction still loses the value; persistent cache misses still reload through the backend.

## Stage Metrics

`kahuna.kv.read.stage` is a millisecond histogram on the `Kahuna` meter. Its tags have different meanings at different stages:

| `stage` | Measurement | Additional tags |
|---|---|---|
| `register` | Register a transaction-scoped operation on its coordinator. | None |
| `confirm` | Confirm leadership and application coverage before a local get. | `lease=hit` for synchronous confirmation; `lease=miss` for an asynchronous answer, including an applied-frontier wait or a read-index round. |
| `actor` | Obtain the value through a published record or actor mailbox. | `path=published` or `path=actor`. |
| `complete` | Fold a transaction-scoped read observation into its working set. | None |
| `total` | Whole get measured by the read facade. | `path=registered` for session reads, `path=direct` otherwise. |

Samples use the serving node's elapsed-time clock and include waits inside each measured step. They are not client network latency. Registration and completion are absent for direct reads; work forwarded elsewhere is measured where it is served, with coordinator registration/completion measured on their calling path. Compare stages to locate a wait rather than adding unrelated percentiles together. The dashboard includes this histogram in its curated metrics.

`TestPublishedHeadReads`, `TestPublishedHeadTable`, `TestKeyValueReadStageMetrics`, and `TestForwardedBatchReadLeadership` cover guard fallbacks, pins, publication/retraction, and forwarding on lagging followers.
