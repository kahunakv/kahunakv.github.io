# Sequence Model and Allocation

A Kahuna sequence is a named counter. Values are monotonically increasing per sequence name, not globally across every sequence in the cluster.

## State

| Field | Description |
|-------|-------------|
| `Name` | The sequence name, such as `orders` or `tenant-a/invoices`. |
| `CurrentValue` | The highest committed value for the sequence. |
| `InitialValue` | The value used as the starting point. |
| `Increment` | The step between allocated values. |
| `MaxValue` | Optional upper bound. |
| `Revision` | Sequence metadata revision. |
| `Durability` | Currently `Persistent`. |
| `CreatedAt` | Hybrid logical timestamp when the sequence was created. |
| `UpdatedAt` | Hybrid logical timestamp when the sequence was last changed. |

Defaults:

- `InitialValue`: `0`
- `Increment`: `1`
- `MaxValue`: `null`
- `Durability`: `Persistent`

With the defaults, the first allocated value is `1`.

## Next Value

`next` allocates one value. If `orders` has `CurrentValue = 41` and `Increment = 1`, the next allocation returns `42` and commits `42` as the current value.

```text
CurrentValue = 41
Increment = 1
Next = 42
```

## Range Reservation

`reserve` allocates a contiguous range. If `orders` has `CurrentValue = 100`, `Increment = 1`, and the caller reserves `50`, Kahuna returns:

```text
Start = 101
End = 150
Count = 50
```

Range reservations for the same sequence do not overlap. After the reservation commits, the sequence current value is `150`.

## Max Value

If `MaxValue` is set and an allocation would exceed it, Kahuna returns `MaxValueExceeded` and does not partially allocate the request.

For example, if `CurrentValue = 98`, `MaxValue = 100`, and a caller reserves `5`, the request fails because it would need `99..103`.
