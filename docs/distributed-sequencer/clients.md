# Clients

Kahuna exposes the distributed sequencer through the .NET client, the TypeScript client, and `kahuna-cli`.

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
    blockSize: null,
    durability: SequenceDurability.Persistent
);

KahunaSequence updated = await client.UpdateSequence(
    "orders",
    new SequenceUpdate(CurrentValue: 5000, BlockSize: 100)
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

## TypeScript Client

```ts
import { KahunaClient } from "kahuna-client";

const client = new KahunaClient({
  endpoints: ["https://localhost:8082"]
});

const sequence = await client.createSequence("orders", {
  initialValue: 0,
  increment: 1,
  maxValue: null
});

const orderId = await client.nextSequenceValue("orders", {
  idempotencyKey: "create-order-123"
});

const range = await client.reserveSequenceRange("orders", 100, {
  idempotencyKey: "import-batch-456"
});

const current = await client.getSequence("orders");
const deleted = await client.deleteSequence("orders");
```

## .NET Methods

```csharp
Task<KahunaSequence> CreateSequence(
    string name,
    long initialValue = 0,
    long increment = 1,
    long? maxValue = null,
    int? blockSize = null,
    SequenceDurability durability = SequenceDurability.Persistent,
    CancellationToken cancellationToken = default
);

Task<KahunaSequence> UpdateSequence(
    string name,
    SequenceUpdate update,
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

## TypeScript Methods

```ts
createSequence(
  name: string,
  options?: {
    initialValue?: number;
    increment?: number;
    maxValue?: number | null;
    signal?: AbortSignal;
  }
): Promise<SequenceEntry>;

getSequence(name: string, options?: { signal?: AbortSignal }): Promise<SequenceEntry | null>;

nextSequenceValue(
  name: string,
  options?: { idempotencyKey?: string | null; signal?: AbortSignal }
): Promise<number>;

reserveSequenceRange(
  name: string,
  count: number,
  options?: { idempotencyKey?: string | null; signal?: AbortSignal }
): Promise<SequenceRange>;

deleteSequence(name: string, options?: { signal?: AbortSignal }): Promise<boolean>;
```

## CLI Interactive Mode

```bash
kahuna-cli> create-sequence orders 0 1
r0 created orders current 0 increment 1 max - block default incarnation 0

kahuna-cli> next-sequence orders request-123
r1 next orders 1

kahuna-cli> reserve-sequence orders 5 batch-456
r1 reserved orders 2..6 count 5

kahuna-cli> get-sequence orders
r1 get orders current 1000 increment 1 max - block default incarnation 0

kahuna-cli> update-sequence orders 5000 1 1000000 100
r2 updated orders current 5000 increment 1 max 1000000 block 100 incarnation 1

kahuna-cli> delete-sequence orders
deleted
```

## CLI Single-Command Mode

```bash
kahuna-cli --create-sequence orders --initial-value 0 --increment 1
kahuna-cli --create-sequence invoices --block-size 1
kahuna-cli --update-sequence orders --current-value 5000 --block-size 100
kahuna-cli --update-sequence orders --remove-block-size
kahuna-cli --next-sequence orders --idempotency-key request-123
kahuna-cli --reserve-sequence orders --count 5 --idempotency-key batch-456
kahuna-cli --get-sequence orders
kahuna-cli --delete-sequence orders
```

Use `--format json` with single-command mode for JSON output where supported.

Sequence updates are exposed by the .NET client, REST, gRPC, and `kahuna-cli`. They take about one server `SequencerBlockLease` to complete, and allocations return `MustRetry` during that window.
