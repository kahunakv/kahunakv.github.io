# REST and gRPC API

Use the REST or gRPC API to call the sequencer from a language that has no Kahuna client, or from tools such as `curl`.

## REST API

All sequence REST APIs use `POST`. Enum fields are JSON numbers: send `"durability": 1` (persistent, the only sequence durability). A string such as `"Persistent"` is rejected with HTTP 400. The response `type` is also numeric; see [Response Types](#response-types).

| Endpoint | Purpose |
|----------|---------|
| `/v1/sequences/create` | Create a persistent sequence. |
| `/v1/sequences/update` | Rewrite sequence parameters and start a new incarnation. |
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
    "blockSize": null,
    "durability": 1
  }'
```

### Update

```bash
curl -X POST https://localhost:8082/v1/sequences/update \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "orders",
    "currentValue": 5000,
    "increment": 1,
    "blockSize": 100,
    "durability": 1
  }'
```

Use `removeMaxValue: true` or `removeBlockSize: true` to clear those optional settings. Omitting a field leaves the existing value unchanged.

### Get

```bash
curl -X POST https://localhost:8082/v1/sequences/get \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "orders",
    "durability": 1
  }'
```

### Next

```bash
curl -X POST https://localhost:8082/v1/sequences/next \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "orders",
    "idempotencyKey": "request-123",
    "durability": 1
  }'
```

Response allocation:

```json
{
  "servedFrom": null,
  "type": 0,
  "sequence": null,
  "allocation": {
    "name": "orders",
    "start": 1,
    "end": 1,
    "count": 1,
    "revision": 0
  },
  "revision": 0,
  "route": {
    "partitionId": 1,
    "endpoint": "https://localhost:8082",
    "provenance": 2,
    "generation": 0
  }
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
    "durability": 1
  }'
```

### Delete

```bash
curl -X POST https://localhost:8082/v1/sequences/delete \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "orders",
    "durability": 1
  }'
```

## gRPC API

The gRPC service is named `Sequencer`:

```protobuf
service Sequencer {
  rpc CreateSequence (GrpcCreateSequenceRequest) returns (GrpcSequenceResponse);
  rpc UpdateSequence (GrpcUpdateSequenceRequest) returns (GrpcSequenceResponse);
  rpc GetSequence (GrpcGetSequenceRequest) returns (GrpcSequenceResponse);
  rpc NextSequenceValue (GrpcNextSequenceRequest) returns (GrpcSequenceAllocationResponse);
  rpc ReserveSequenceRange (GrpcReserveSequenceRangeRequest) returns (GrpcSequenceAllocationResponse);
  rpc DeleteSequence (GrpcDeleteSequenceRequest) returns (GrpcSequenceResponse);
}
```

## Response Types

| REST `type` | Type | Meaning |
|-------------|------|---------|
| `0` | `Success` | The operation succeeded. |
| `1` | `NotFound` | The sequence does not exist. |
| `2` | `AlreadyExists` | Create was called for an existing sequence. |
| `3` | `InvalidInput` | The name or request parameters were invalid. |
| `4` | `MaxValueExceeded` | The requested allocation would exceed `MaxValue`. |
| `5` | `MustRetry` | The operation should be retried. Allocations also return this while a sequence update is waiting out the block lease. |
| `6` | `Aborted` | The operation was aborted. |
| `99` | `Error` | An unexpected error occurred. |
