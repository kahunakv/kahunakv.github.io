import HLC from '../assets/hlc.png';

# Hybrid Logical Clocks (HLC)

## Overview

Kahuna integrates **Hybrid Logical Clocks (HLCs)** as a fundamental mechanism to provide **causally consistent timestamps**, ensure **transaction ordering**, detect **write-write conflicts**, and support **external consistency** without requiring tightly synchronized clocks (like Google's TrueTime).

Every write, lock, or sequence operation in Kahuna is associated with an HLC timestamp. This unified time model enables distributed coordination and conflict resolution while preserving performance and fault tolerance across nodes.

## HLC Format in Kahuna

Each node in a Kahuna cluster maintains its own HLC state. A timestamp is represented as:

```
HLC = (physicalTimeMillis, logicalCounter)
```

- **`physicalTimeMillis`**: Wall clock in milliseconds (from the system clock)
- **`logicalCounter`**: A counter to preserve causality when physical time doesn't advance

This allows timestamps to be **monotonically increasing** even under clock skew or rapid successive events.

## Use Cases in Kahuna

### Transaction Timestamps

Each transaction in Kahuna is assigned a commit timestamp using the node’s local HLC:

- **On transaction start**: An HLC is assigned and carried through the transaction
- **On commit**: The final HLC timestamp is used as the **version** for all written keys
- Kahuna ensures that timestamps respect causality: if transaction A commits before B, then `HLC(A) < HLC(B)`

This guarantees **snapshot isolation** and enables **serializable execution** when required.

### Multi-Version Concurrency Control (MVCC)

Kahuna uses HLCs as version stamps for key/value records. Each key maintains:

```json
{
  "transactionId": { "physical": 1713351023980, "logical": 3 },
  "key": "user:123",
  "value": "..."  
}
```

MVCC reads filter out versions that are **in the future** relative to the transaction's timestamp, or based on a snapshot HLC. This avoids phantom reads and preserves consistency across nodes.

### Conflict Detection

In distributed environments, concurrent writes to the same key can occur. Kahuna uses HLC to:

- **Compare write timestamps**: If two writes target the same key, the write with the **higher HLC** wins
- **Detect stale writes**: Any incoming write with `HLC < current_version` is rejected as stale

This ensures **last-write-wins semantics**, while still allowing clients to detect and resolve concurrent update scenarios explicitly if needed.

### Locking and Sequencing

Locks and sequences are tagged with HLC timestamps:

- **Leases**: Each lease has an HLC to track the moment it was granted
- **Fencing tokens**: Include HLC components to uniquely order lock ownership transitions
- **Sequences**: Issued in increasing HLC order to maintain monotonic guarantees across partitions

This enables time-based expiration and fencing guarantees without relying on synchronized clocks.

### Cluster-Wide Consistency Without TrueTime

Instead of relying on GPS or atomic clocks like **TrueTime**, Kahuna nodes:

- Advance their HLC state on each local or replicated write
- Ensure that no HLC ever goes backward (even across restarts)
- May delay reads until a **safe time** if external consistency is requested (e.g., `read-after-write` guarantees)

This means **external consistency** can be simulated by **waiting** until the system clock has moved past the latest known HLC timestamp.

## Example: HLC Write Flow in Kahuna

1. Client sends a write to node A.
2. Node A assigns an HLC timestamp using its local clock.
3. The write is replicated to other Raft followers.
4. Each replica updates its local HLC state if the incoming HLC is higher.
5. The key is stored as:

```json
{
  "transactionId": { "physical": 1713351023980, "logical": 3 },  
  "key": "config/service/timeout",
  "value": "500ms",  
}
```

6. Future writes to the same key must use a strictly greater HLC, ensuring a consistent order.

## Design Advantages

| Benefit                        | Description |
|-------------------------------|-------------|
| **Causality preservation**    | Prevents anomalies by enforcing happens-before relationships |
| **Clock skew tolerance**      | HLC logic avoids dependence on perfect clock sync |
| **Unified time model**        | Used for transactions, locks, sequences, and replication |
| **Conflict resolution**       | Enables consistent behavior across concurrent writers |
| **Time-based operations**     | TTLs, leases, and expirations are all HLC-based |
| **TrueTime alternative**      | Offers strong external consistency without external time APIs |

## HLC Timeline

<div style={{textAlign: 'center'}}>
<img src={HLC} height="350" />
</div>

## Conclusion

HLCs are a core enabler of Kahuna's **distributed consistency model**. By embedding time into every operation while preserving logical correctness, HLC allows Kahuna to offer:

- Strong consistency
- Efficient MVCC
- Reliable lock sequencing
- Deterministic conflict resolution

— all while remaining independent of external clock guarantees or centralized coordination.

