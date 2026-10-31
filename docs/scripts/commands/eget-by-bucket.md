# Command: EGet By Bucket

Reads a group of related keys with **ephemeral** durability in one call. The group is a bucket: the part of the key before the last `/`, so keys such as `sessions/user-1`, `sessions/user-2`, and `sessions/user-3` all belong to the `sessions` bucket. Ephemeral keys live only in the partition leader's memory and are lost on a node restart or a leader change; see [Durability Levels](/docs/architecture/durability-levels/).

All keys of a bucket live on one [partition](/docs/glossary/#partition), so this command reads the whole group in one consistent operation. Use it for small groups of related temporary keys, such as active sessions. See [Buckets](/docs/distributed-keyvalue-store/buckets/). For persistent keys, use [`get by bucket`](/docs/scripts/commands/get-by-bucket/).

## Syntax

```text
eget by bucket <bucket>
eget by bucket <bucket> as of <hlc-timestamp>
let <variable> = eget by bucket <bucket> [as of <hlc-timestamp>]
```

## Examples

```kahuna
eset `sessions/user-1` "active"
```
```text
r0 set 5ms
```

```kahuna
eset `sessions/user-2` "active"
```
```text
r0 set 5ms
```

```kahuna
eget by bucket `sessions`
```
```text
r0 sessions/user-1 active
r0 sessions/user-2 active
```

### Assigning Results

Inside a script, assign the command to a variable with `let`. The variable receives an array of the returned values.

```kahuna
let sessions = eget by bucket `sessions`
return count(sessions)
```

## Reading Past Versions

`eget by bucket` also supports [snapshot reads](/docs/glossary/#snapshot) with `as of` ([timestamp format](/docs/scripts/commands/get/#get-as-of-timestamp)):

```kahuna
eget by bucket `sessions` as of 1718392012345
```

This returns only the ephemeral members that were visible in that bucket at the requested snapshot time.

If a key already existed at that time and was updated or deleted later, the snapshot still returns the older visible value from the requested time. Keys created after that time are not returned.

## Checking the Result

Use `if not found then ... end` to test whether the last read returned an empty collection. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards).

## Notes

Ephemeral keys can also expire or be evicted under memory pressure, so this command is best suited to temporary data such as sessions, leases, and cache entries.

The command returns the matching bucket in one response and is capped at `4096` entries. Keep buckets intentionally bounded. For large ordered key spaces, use paginated range reads instead.
