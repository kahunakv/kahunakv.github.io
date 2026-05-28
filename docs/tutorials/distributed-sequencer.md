import Kahuna6 from '../assets/kahuna6.png';

# Tutorial: Distributed Sequencer

<div style={{textAlign: 'center'}}>
<img src={Kahuna6} height="350" />
</div>

This tutorial shows how to create a sequence, allocate individual values, reserve ranges, and use idempotency keys for safe retries.

## Create a Sequence

Start `kahuna-cli` and create an `orders` sequence:

```bash
kahuna-cli> create-sequence orders 0 1
r0 created orders current 0 increment 1 max -
```

The arguments are:

- `orders`: sequence name.
- `0`: initial value.
- `1`: increment.

With these defaults, the first allocated value is `1`.

## Allocate One Value

```bash
kahuna-cli> next-sequence orders create-order-1001
r1 next orders 1
```

The optional second argument is an idempotency key. If the client retries the same operation after a timeout, using `create-order-1001` again returns the same allocation instead of consuming another value.

## Reserve a Range

Reserve five IDs for a worker:

```bash
kahuna-cli> reserve-sequence orders 5 worker-a-batch-1
r2 reserved orders 2..6 count 5
```

The worker can now use `2`, `3`, `4`, `5`, and `6` locally without making another network call for each ID.

## Inspect the Sequence

```bash
kahuna-cli> get-sequence orders
r2 get orders current 6 increment 1 max -
```

`current 6` means the highest committed value is `6`. The next single allocation will return `7`.

## Use Single-Command Mode

The same workflow can be run without entering interactive mode:

```bash
kahuna-cli --create-sequence invoices --initial-value 1000 --increment 1
kahuna-cli --next-sequence invoices --idempotency-key invoice-req-1
kahuna-cli --reserve-sequence invoices --count 10 --idempotency-key invoice-batch-1
kahuna-cli --get-sequence invoices
```

## Use the .NET Client

```csharp
using Kahuna.Client;

var client = new KahunaClient("https://localhost:8082");

await client.CreateSequence("orders");

long orderId = await client.NextSequenceValue(
    "orders",
    idempotencyKey: "create-order-1001"
);

KahunaSequenceRange batch = await client.ReserveSequenceRange(
    "orders",
    count: 5,
    idempotencyKey: "worker-a-batch-1"
);

Console.WriteLine($"Next order: {orderId}");
Console.WriteLine($"Reserved: {batch.Start}..{batch.End}");
```

## Clean Up

```bash
kahuna-cli> delete-sequence orders
deleted
```

Deleting a sequence removes the named counter. Creating the same sequence again starts it from the new creation parameters.
