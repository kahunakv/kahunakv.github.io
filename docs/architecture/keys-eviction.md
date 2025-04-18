import Cache from '../assets/cache.png';

# Keys Eviction

Kahuna supports two types of durability: ephemeral and persistent. In the case of persistent keys/locks/sequences, when they are manipulated, a copy is stored in memory and any changes are written to disk as needed. This in-memory copy or cache allows retrieving the latest value without incurring disk I/O operations, improving performance. For ephemeral keys/locks/sequences, all state and history are stored in volatile memory, making operations extremely fast.

<div style={{textAlign: 'center'}}>
<img src={Cache} height="350" />
</div>

However, memory may not be able to retain all keys/locks/sequences for long if there is memory pressure and space is needed for other operations.

For this reason, an object eviction process runs periodically on the workers based on their activity level, looking for opportunities to free up unused memory. The algorithm selects objects to remove from the cache in the following order:

- Expired objects  
- Objects marked as deleted or partially created to support an operation  
- A sample of Keys/Locks/Sequences that haven't been used recently (LRU)

The algorithm runs until a certain number of objects are removed per round to avoid causing high contention on the worker.

Since the algorithm runs independently on each worker, it enables concurrent memory reclamation without a global pause, allowing other workers and partitions to continue handling requests.

## Log Compactation

Each Raft Group (via [Kommander](https://github.com/kahunakv/kommander)) also runs a similar process on the WAL logs of each partition, removing old entries that already have a checkpoint. A checkpoint is a marker in the WAL log sequence that indicates an entry has been successfully persisted to the Key/Value store. This mechanism helps free up disk space.
