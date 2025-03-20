
# Compare-And-Swap (CAS)

A Compare-And-Swap (CAS) operation is critical in a distributed key-value store like Kahuna because it ensures atomic updates and prevents race conditions in environments where multiple clients may try to modify the same key simultaneously. CAS is an atomic operation that:

 - Compares a key’s current value (or version) against an expected value or revision
 - Only updates the key if the current value matches the expected value or revision
 - Fails safely if another process modified the key in the meantime.

| **Use Case** | **How CAS Helps** |
|-------------|------------------|
| **Leader Election** | Ensures only one node becomes leader. |
| **Distributed Locks** | Prevents multiple nodes from acquiring the same lock. |
| **Configuration Updates** | Prevents conflicting writes to shared config values. |
| **Rate Limiting** | Ensures atomic updates to request counters. |
| **Concurrent Transactions** | Avoids lost updates when multiple clients modify the same key. |

Advantages of using CAS:

- **Ensures atomic updates** in distributed stores.
- **Prevents race conditions** when multiple clients write to the same key.
- **Guarantees strong consistency** by checking versioning before updating.
- **It can be used in leader election, distributed locks, and state coordination.**
- **Prevents lost updates** and ensures correct data modifications.