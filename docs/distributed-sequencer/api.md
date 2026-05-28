# REST and gRPC API

Kahuna exposes sequence operations through REST and gRPC.

## REST API

All sequence REST APIs use `POST`.

| Endpoint | Purpose |
|----------|---------|
| `/v1/sequences/create` | Create a persistent sequence. |
| `/v1/sequences/get` | Read sequence metadata. |
| `/v1/sequences/next` | Allocate one value. |
| `/v1/sequences/reserve` | Allocate a contiguous range. |
| `/v1/sequences/delete` | Delete a sequence. |

### Create

```bash
curl -X POST https://localhost:8082/v1/sequences/create \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "orders",
    "initialValue": 0,
    "increment": 1,
    "maxValue": null,
    "durability": "Persistent"
  }'
```

### Get

```bash
curl -X POST https://localhost:8082/v1/sequences/get \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "orders",
    "durability": "Persistent"
  }'
```

### Next

```bash
curl -X POST https://localhost:8082/v1/sequences/next \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "orders",
    "idempotencyKey": "request-123",
    "durability": "Persistent"
  }'
```

Response allocation:

```json
{
  "type": "Success",
  "allocation": {
    "name": "orders",
    "start": 1,
    "end": 1,
    "count": 1,
    "revision": 1
  },
  "revision": 1
}
```

### Reserve

```bash
curl -X POST https://localhost:8082/v1/sequences/reserve \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "orders",
    "count": 100,
    "idempotencyKey": "batch-456",
    "durability": "Persistent"
  }'
```

### Delete

```bash
curl -X POST https://localhost:8082/v1/sequences/delete \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "orders",
    "durability": "Persistent"
  }'
```

## gRPC API

The gRPC service is named `Sequencer`:

```protobuf
service Sequencer {
  rpc CreateSequence (GrpcCreateSequenceRequest) returns (GrpcSequenceResponse);
  rpc GetSequence (GrpcGetSequenceRequest) returns (GrpcSequenceResponse);
  rpc NextSequenceValue (GrpcNextSequenceRequest) returns (GrpcSequenceAllocationResponse);
  rpc ReserveSequenceRange (GrpcReserveSequenceRangeRequest) returns (GrpcSequenceAllocationResponse);
  rpc DeleteSequence (GrpcDeleteSequenceRequest) returns (GrpcSequenceResponse);
}
```

## Response Types

| Type | Meaning |
|------|---------|
| `Success` | The operation succeeded. |
| `NotFound` | The sequence does not exist. |
| `AlreadyExists` | Create was called for an existing sequence. |
| `InvalidInput` | The name or request parameters were invalid. |
| `MaxValueExceeded` | The requested allocation would exceed `MaxValue`. |
| `MustRetry` | The operation should be retried. |
| `Aborted` | The operation was aborted. |
| `Error` | An unexpected error occurred. |
