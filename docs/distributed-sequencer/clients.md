# Clients

Kahuna exposes the distributed sequencer through the .NET client and `kahuna-cli`.

## .NET Client

```csharp
using Kahuna.Client;
using Kahuna.Shared.Sequences;

var client = new KahunaClient("https://localhost:8082");

KahunaSequence sequence = await client.CreateSequence(
    "orders",
    initialValue: 0,
    increment: 1,
    maxValue: null,
    durability: SequenceDurability.Persistent
);

long orderId = await client.NextSequenceValue(
    "orders",
    idempotencyKey: "create-order-123"
);

KahunaSequenceRange range = await client.ReserveSequenceRange(
    "orders",
    count: 100,
    idempotencyKey: "import-batch-456"
);

KahunaSequence? current = await client.GetSequence("orders");
bool deleted = await client.DeleteSequence("orders");
```

## .NET Methods

```csharp
Task<KahunaSequence> CreateSequence(
    string name,
    long initialValue = 0,
    long increment = 1,
    long? maxValue = null,
    SequenceDurability durability = SequenceDurability.Persistent,
    CancellationToken cancellationToken = default
);

Task<KahunaSequence?> GetSequence(
    string name,
    SequenceDurability durability = SequenceDurability.Persistent,
    CancellationToken cancellationToken = default
);

Task<long> NextSequenceValue(
    string name,
    string? idempotencyKey = null,
    SequenceDurability durability = SequenceDurability.Persistent,
    CancellationToken cancellationToken = default
);

Task<KahunaSequenceRange> ReserveSequenceRange(
    string name,
    int count,
    string? idempotencyKey = null,
    SequenceDurability durability = SequenceDurability.Persistent,
    CancellationToken cancellationToken = default
);

Task<bool> DeleteSequence(
    string name,
    SequenceDurability durability = SequenceDurability.Persistent,
    CancellationToken cancellationToken = default
);
```

## CLI Interactive Mode

```bash
kahuna-cli> create-sequence orders 0 1
r0 created orders current 0 increment 1 max -

kahuna-cli> next-sequence orders request-123
r1 next orders 1

kahuna-cli> reserve-sequence orders 5 batch-456
r2 reserved orders 2..6 count 5

kahuna-cli> get-sequence orders
r2 get orders current 6 increment 1 max -

kahuna-cli> delete-sequence orders
deleted
```

## CLI Single-Command Mode

```bash
kahuna-cli --create-sequence orders --initial-value 0 --increment 1
kahuna-cli --next-sequence orders --idempotency-key request-123
kahuna-cli --reserve-sequence orders --count 5 --idempotency-key batch-456
kahuna-cli --get-sequence orders
kahuna-cli --delete-sequence orders
```

Use `--format json` with single-command mode for JSON output where supported.
