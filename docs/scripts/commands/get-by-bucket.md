# Command: Get By Bucket

Reads a group of related keys with **persistent** durability in one call. The group is a bucket: the part of the key before the last `/`, so keys such as `services/auth`, `services/payments`, and `services/search` all belong to the `services` bucket. Persistent keys are replicated and survive node failures.

All keys of a bucket live on one [partition](/docs/glossary/#partition), so this command reads the whole group in one consistent operation. Use it for small groups of related keys, such as the instances of a service or a tenant's settings. See [Buckets](/docs/distributed-keyvalue-store/buckets/). For ephemeral keys, use [`eget by bucket`](/docs/scripts/commands/eget-by-bucket/).

## Syntax

```text
get by bucket <bucket>
get by bucket <bucket> as of <hlc-timestamp>
let <variable> = get by bucket <bucket> [as of <hlc-timestamp>]
```

## Examples

```kahuna
set `services/auth` "localhost:8081"
```
```text
r0 set 9ms
```

```kahuna
set `services/payments` "localhost:8082"
```
```text
r0 set 10ms
```

```kahuna
get by bucket `services`
```
```text
r0 services/auth localhost:8081
r0 services/payments localhost:8082
```

### Assigning Results

Inside a script, assign the command to a variable with `let`. The variable receives an array of the returned values.

```kahuna
let services = get by bucket `services`
return count(services)
```

## Reading Past Versions

`get by bucket` also supports [snapshot reads](/docs/glossary/#snapshot) with `as of` ([timestamp format](/docs/scripts/commands/get/#get-as-of-timestamp)):

```kahuna
get by bucket `services` as of 1718392012345
```

This returns only the members that were visible in that bucket at the requested snapshot time.

If a key already existed at that time and was updated or deleted later, the snapshot still returns the older visible value from the requested time. Keys created after that time are not returned.

## Checking the Result

Use `if not found then ... end` to test whether the last read returned an empty collection. See [Statement-Result Guards](/docs/scripts/semantics/#statement-result-guards).

## Notes

Use this command when you deliberately group related keys under one bucket prefix, which keeps them on a single partition.

The command returns the matching bucket in one response and is capped at `4096` entries. Keep buckets intentionally bounded. For large ordered key spaces, use paginated range reads instead.

If a [key space](/docs/glossary/#key-space-and-key-range-routing) is configured for key-range routing and later splits into multiple ordered ranges, whole-space traversal should use range-oriented reads instead of assuming the entire prefix still lives on one partition.
