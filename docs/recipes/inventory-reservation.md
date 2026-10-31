import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Inventory Reservation

If two checkouts read the same stock count at the same time, both can see one item left and both can sell it. Use Kahuna transactions when several workers reserve limited inventory and must not oversell.

This recipe keeps the inventory count in one persistent key and checks and decrements it atomically in one Kahuna Script, much like a SQL transaction that reads and updates a row. The reserve script checks the reservation key first, so retrying it with the same reservation key does not reserve stock twice.

## Key Layout

```text
inventory/{sku}/available
inventory/{sku}/reservations/{reservation-id}
```

## Reserve Stock

```kahuna
let reservation = get @reservation_key

if reservation != null then
  return "reserved"
end

let available = get @available_key

if not found then
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

Run it from a client:

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
KahunaKeyValueTransactionResult result = await client.ExecuteKeyValueTransactionScript(
    """
    let reservation = get @reservation_key

    if reservation != null then
      return "reserved"
    end

    let available = get @available_key

    if not found then
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

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const script = client.loadScript(`
let reservation = get @reservation_key

if reservation != null then
  return "reserved"
end

let available = get @available_key

if not found then
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
`);

const result = await script.run({
  parameters: [
    { key: "@available_key", value: "inventory/sku-123/available" },
    { key: "@reservation_key", value: "inventory/sku-123/reservations/order-456" },
    { key: "@requested", value: "2" }
  ]
});

const firstValue = result.values[0]?.value;
const status = firstValue ? new TextDecoder().decode(firstValue) : null;
```

</TabItem>
</Tabs>

## Release a Reservation

```kahuna
let reserved = get @reservation_key

if not found then
  return "not-reserved"
end

let available = get @available_key
set @available_key to_int(available) + to_int(reserved)
delete @reservation_key
return "released"
```

The release script is also safe to retry. It returns the stock and deletes the reservation key in one transaction, so a second run with the same reservation key finds nothing and returns `not-reserved` instead of adding the stock back twice.

## Operational Notes

- Use persistent durability when reservations must survive restarts.
- Keep the transaction short. Do not call external systems inside the reservation flow.
- Use one inventory key per SKU or resource pool.
- Store reservation keys separately so you can release or audit them later.
- If reservation history is not needed, write reservation marker keys with [`NOREV`](/docs/scripts/commands/set/#norev) to reduce revision storage.
