# Ordered IDs

Use Kahuna sequences when several services need to allocate unique, ordered values without racing.

Good fits include:

- invoice numbers
- ticket numbers
- customer-visible order numbers
- reservation ranges for batch imports

## Create a Sequence

```csharp
KahunaSequence sequence = await client.CreateSequence(
    name: "invoices",
    initialValue: 1000,
    increment: 1
);
```

## Allocate One Value

```csharp
long invoiceNumber = await client.NextSequenceValue(
    "invoices",
    idempotencyKey: "invoice-request-9f8c"
);
```

Use an idempotency key when the caller may retry after a timeout. The same request can be retried without accidentally consuming another value.

## Reserve a Range

For batch work, reserve several values in one call:

```csharp
KahunaSequenceRange range = await client.ReserveSequenceRange(
    "invoices",
    count: 100,
    idempotencyKey: "invoice-import-2026-06-15"
);

for (long value = range.Start; value <= range.End; value++)
    Console.WriteLine(value);
```

Range reservation reduces coordination overhead when a worker needs many IDs.

## Operational Notes

- Use one sequence per independent number line.
- Use idempotency keys for all externally retried allocation requests.
- Reserve ranges for batch imports or high-throughput producers.
- Do not assume unused values from a reserved range will be recycled.
