# Inventory Reservation

Use Kahuna transactions when multiple workers need to reserve limited inventory without overselling.

This recipe keeps the inventory count in one persistent key and applies the reservation atomically with a script.

## Key Layout

```text
inventory/{sku}/available
inventory/{sku}/reservations/{reservation-id}
```

## Reserve Stock

```kahuna
let available = get @available_key

if not available then
  throw "inventory key does not exist"
end

let current = to_int(available)
let requested = to_int(@requested)

if current < requested then
  return "insufficient"
end

set @available_key current - requested
set @reservation_key @requested
return "reserved"
```

Run it from the .NET client:

```csharp
KahunaKeyValueTransactionResult result = await client.ExecuteKeyValueTransactionScript(
    """
    let available = get @available_key

    if not available then
      throw "inventory key does not exist"
    end

    let current = to_int(available)
    let requested = to_int(@requested)

    if current < requested then
      return "insufficient"
    end

    set @available_key current - requested
    set @reservation_key @requested
    return "reserved"
    """,
    parameters:
    [
        new() { Key = "@available_key", Value = "inventory/sku-123/available" },
        new() { Key = "@reservation_key", Value = "inventory/sku-123/reservations/order-456" },
        new() { Key = "@requested", Value = "2" }
    ]
);
```

## Release a Reservation

```kahuna
let reserved = get @reservation_key

if not reserved then
  return "not-reserved"
end

let available = get @available_key
set @available_key to_int(available) + to_int(reserved)
delete @reservation_key
return "released"
```

## Operational Notes

- Use persistent durability when reservations must survive restarts.
- Keep the transaction short. Do not call external systems inside the reservation flow.
- Use one inventory key per SKU or resource pool.
- Store reservation keys separately so you can release or audit them later.
- If reservation history is not needed, write reservation marker keys with `NOREV` to reduce revision storage.
