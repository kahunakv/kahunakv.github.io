import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Ordered IDs

A database identity column gives each new row the next number, but only inside one database, and a retried insert can take a second number for the same record. Use Kahuna sequences when several services need to allocate unique, ordered values from one shared counter. An [idempotency key](/docs/glossary/#idempotency-key) makes a retried request return the value it already received.

Good fits include:

- invoice numbers
- ticket numbers
- customer-visible order numbers
- reservation ranges for batch imports

## Create a Sequence

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
KahunaSequence sequence = await client.CreateSequence(
    name: "invoices",
    initialValue: 1000,
    increment: 1
);
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
await client.createSequence("invoices", {
  initialValue: 1000,
  increment: 1
});
```

</TabItem>
</Tabs>

With `initialValue: 1000` and `increment: 1`, the first invoice number is `1001`.

## Allocate One Value

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
long invoiceNumber = await client.NextSequenceValue(
    "invoices",
    idempotencyKey: "invoice-request-9f8c"
);
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const invoiceNumber = await client.nextSequenceValue("invoices", {
  idempotencyKey: "invoice-request-9f8c"
});
```

</TabItem>
</Tabs>

Use an idempotency key when the caller may retry after a timeout. The same request can be retried without accidentally consuming another value.

## Reserve a Range

For batch work, reserve several values in one call:

<Tabs groupId="client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
KahunaSequenceRange range = await client.ReserveSequenceRange(
    "invoices",
    count: 100,
    idempotencyKey: "invoice-import-2026-06-15"
);

for (long value = range.Start; value <= range.End; value++)
    Console.WriteLine(value);
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
const range = await client.reserveSequenceRange("invoices", 100, {
  idempotencyKey: "invoice-import-2026-06-15"
});

for (let value = range.start; value <= range.end; value += 1) {
  console.log(value);
}
```

</TabItem>
</Tabs>

Range reservation reduces coordination overhead when a worker needs many IDs.

## Gaps in the Numbering

Values are unique and increasing, but not gap-free. By default a node reserves a block of values and serves it from memory; when the node restarts, evicts the sequence, or loses ownership of it, the unused rest of the block is skipped. A value that a caller allocates and never uses is also a gap.

If invoice numbers or similar must not skip values, reduce the gaps:

- Create the sequence with a `blockSize` of `1`, so no reserved block is abandoned. Each value then costs one replicated commit.
- Send an [idempotency key](/docs/distributed-sequencer/idempotency/) with every allocation, so a retry does not take a second number.
- Store each number with the record that used it, so you can account for any number that was skipped, for example after a caller crashed between allocating and saving.

See [Gaps](/docs/distributed-sequencer/idempotency/#gaps) for the full list of causes.

## Operational Notes

- Use one sequence per independent number line.
- Use idempotency keys for all externally retried allocation requests.
- Reserve ranges for batch imports or high-throughput producers.
- Do not assume unused values from a reserved range will be recycled.
