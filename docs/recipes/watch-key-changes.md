import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Watch Key Changes

When a service caches a feature flag, polling Kahuna adds read traffic and delays updates. A watch tells the service when a persistent key changes, so it can read the current value and refresh its local copy. You can watch one key, a prefix, or a key range.

## Try a Watch

In one `kahuna-cli` session, watch the configuration prefix:

```text
kahuna-cli> watch config/prod/search/ keys-only
```

In another session, change a flag:

```kahuna
set `config/prod/search/enable-new-ranking` "true"
```

The first session prints a `set` event with the key and revision. `keys-only` omits value bytes; leave it off when your consumer needs the new value. The shell command watches a **prefix**, so it also reports changes to other keys under `config/prod/search/`.

For a terminal command, use `kahuna-cli --watch config/prod/search/ --watch-keys-only`. Press Ctrl+C to close the watch.

## Keep One Flag Current

Open the watch **before** reading the initial value. Once the opening call returns, it has registered the scope on every relevant partition. A write during the first read will also be queued as an event. Re-reading on each event makes duplicate deliveries harmless.

<Tabs groupId="watch-client-examples">
<TabItem value="dotnet" label=".NET">

```csharp
using Kahuna.Client;
using Kahuna.Shared.KeyValue;

const string key = "config/prod/search/enable-new-ranking";

async Task WatchFlag(KahunaClient client, CancellationToken ct)
{
    async Task Refresh()
    {
        KahunaKeyValue flag = await client.GetKeyValue(
            key, KeyValueDurability.Persistent, cancellationToken: ct);

        bool enabled = flag.Success && flag.ValueAsString() == "true";
        Console.WriteLine($"New ranking enabled: {enabled}");
    }

    while (true)
    {
        await using KahunaWatch watch = await client.WatchKeyValues(
            new KeyValueWatchRequest(KeyValueWatchScope.ForKey(key), KeysOnly: true),
            ct);

        await Refresh();

        await foreach (KeyValueWatchFrame frame in watch.ReadAllAsync(ct))
        {
            if (frame.Event is not null)
                await Refresh();
            else if (frame.IsTerminal)
                break;
        }

        // The stream may have missed changes. Register again, then refresh.
        await Task.Delay(250, ct);
    }
}
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```ts
import { isTerminalWatchFrame, watchKey, type KahunaClient } from "kahuna-client";
import { setTimeout as sleep } from "node:timers/promises";

const key = "config/prod/search/enable-new-ranking";

async function watchFlag(client: KahunaClient, signal: AbortSignal): Promise<void> {
  async function refresh(): Promise<void> {
    const flag = await client.get(key, { durability: "persistent", signal });
    const enabled = flag.success && flag.valueAsString() === "true";
    console.log(`New ranking enabled: ${enabled}`);
  }

  while (!signal.aborted) {
    await using watch = await client.watchKeyValues(
      { scope: watchKey(key), keysOnly: true },
      { signal }
    );

    await refresh();

    for await (const frame of watch.frames(signal)) {
      if (frame.type === "event") await refresh();
      else if (isTerminalWatchFrame(frame)) break;
    }

    // The stream may have missed changes. Register again, then refresh.
    await sleep(250, undefined, { signal });
  }
}
```

</TabItem>
</Tabs>

Replace the log statement with an update to your application's local configuration. The loop registers a new watch and refreshes after a terminal frame, including buffer overflow, disconnection, or a partition move. Add retry and backoff around the watch opening call for transient failures in a long-running service.

## Why Refresh After Reopening?

A terminal frame means the stream may have missed changes. The loop opens another watch before re-reading the flag, so changes during that read are queued for the new watch. Re-reading after every event also handles duplicate deliveries. This pattern keeps a local copy current; a consumer that must process every mutation needs resume cursors and retained history.

See [Watch Persistent Key Changes](/docs/distributed-keyvalue-store/watches/) for scopes, event fields, delivery, resume, and limits. See [Feature Flags and Configuration](/docs/recipes/feature-flags/) for safely updating flags.
