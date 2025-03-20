---
sidebar_position: 1
---

# Tutorial: Key/Value Store

Kahuna provides the building blocks to construct distributed systems. The **key/value store** can be used to store **configuration, service discoverability, metadata, caching, sessions, and more**. In this tutorial, you will learn how it works.

## Starting Kahuna

Before you proceed, make sure that Kahuna is running on your system. Refer to the [Server Installation](server-installation) section for instructions. You will also need the [Kahuna CLI](kahuna-cli) to execute commands on the server.

After installing the necessary components, run the following command:

```bash
~> kahuna-cli --version
```

## Setting and Retrieving Keys

Within the Kahuna CLI, you can execute commands, transactions, and scripts. Use the following format to set and retrieve key/value pairs:

```bash
~> kahuna-cli
Kahuna Shell 0.0.1 (alpha)

kahuna-cli> set myconfig "my-value"                 
r0 set 9ms

kahuna-cli> get myconfig                          
r0 my-value 7ms

kahuna-cli> set myconfig "my-value-2"                 
r1 set 7ms

kahuna-cli> get myconfig                          
r1 my-value-2 6ms
```

The `set` command stores key/value pairs durably in the cluster. Internally, the system uses consistent hashing to redirect the request to the leader node of the corresponding Raft group, which coordinates the operation, achieves consensus, and ensures durable storage and replication. The `get` command retrieves the most recent value consistently from the appropriate leader node.

## Expiration

By default, keys persisted to disk do not expire. However, you can specify an expiration time so that keys are removed after a defined period. You can set an expiration when creating a key or modify it later using the `extend` command:

```bash
kahuna-cli> set myconfig "my-value" ex 30000
r2 set 181ms

kahuna-cli> set myconfig "my-value"                 
r3 set 40ms

kahuna-cli> extend myconfig 30000              
r3 extended 36ms
```

Expiration times are specified in milliseconds.

## Durability

By default, Kahuna ensures strong consistency for durability, meaning that all values are replicated, and the client is notified of a successful operation only after receiving confirmation from the majority of nodes in the cluster.

In high-performance scenarios or when working with ephemeral data, on-disk durability may not be necessary or practical. For these cases, Kahuna offers an "ephemeral" durability mode, in which data is stored only in the leader node's volatile memory.

Commands using ephemeral durability are prefixed with an "e". For example:

```bash
kahuna-cli> eset tempconfig "my-value"              
r0 set 97ms

kahuna-cli> eget tempconfig                         
r0 my-value 32ms
```

Keep in mind that ephemeral data will be lost if the node crashes or if memory pressure forces the system to free up space by removing the least-used keys. You can also specify an explicit expiration time for ephemeral keys. Ephemeral storage provides faster operations without the overhead of replication and persistence.

## Revisions

Each time a key is updated, you will notice an incrementing revision number (e.g., r0, r1, etc.). This value, known as the revision, is a monotonic version number that tracks when a key was last modified. Every time a key is updated or deleted, its revision increments, ensuring strong consistency and strict ordering.

```bash
kahuna-cli> set myconf "some config"             
r0 set 108ms

kahuna-cli> set myconf "some other config"       
r1 set 30ms

kahuna-cli> set myconf "another config"          
r2 set 50ms

kahuna-cli> get myconf
r2 another config 65ms
```

## Compare And Swap (CAS)

The Compare-And-Swap (CAS) operation ensures atomic updates and prevents race conditions in environments where multiple clients may attempt to modify the same key simultaneously.


## Scripts



---