# Leases

Distributed locks in Kahuna are based on the paper [*"Leases: An Efficient
Fault-Tolerant Mechanism for Distributed File Cache Consistency"*](https://web.stanford.edu/class/cs240/readings/leases.pdf) by Michael N. Nelson, Brent B. Welch, and John K. Ousterhout. It introduced the concept of **leases** as a way to manage distributed locks efficiently. Leases act as time-bound locks that expire after a specified duration, providing a balance between strong consistency and fault tolerance.

- **Automatic Lock Expiration**: Leases expire after a predefined time,
eliminating the need for manual lock release. This is particularly useful if a client holding a lock crashes or becomes unreachable, as the system can reclaim the resource once the lease expires.
- **No Need for Explicit Unlock**: Despite Kahuna clients sent explicit unlocks, clients
don't need to explicitly release them, which reduces the complexity of
handling failures and network partitions.
- **Reduced Lock Contention**: Since leases are time-bound, even if a client misbehaves or gets disconnected, other clients will eventually be able to acquire the lock after the lease expires.
- **Graceful Degradation**: In the event of partial failures (e.g., network partitions), the system can still make progress once the lease times out.

Do leases provide mutual exclusion? No, leases by themselves do not provide mutual exclusion.

While Kahuna leases help in expiring keys and releasing locks if a client fails, they don’t inherently protect against scenarios where:

- A client pauses (e.g., due to a long GC pause or network partition) and later resumes, believing it still holds the lock, even though the lease has expired.
- This could lead to split-brain where two clients believe they own the same lock.