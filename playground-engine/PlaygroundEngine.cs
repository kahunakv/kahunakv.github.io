using System.Buffers;
using System.Diagnostics;
using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using System.Text;
using System.Text.Json;

using Kahuna;
using Kahuna.Server.KeyValues;
using Kahuna.Server.KeyValues.Transactions.Data;
using Kahuna.Shared.KeyValue;
using Kommander.Time;
using Microsoft.Extensions.Logging.Abstractions;

namespace Kahuna.Playground;

/// <summary>
/// The JavaScript surface of the browser playground. It holds one embedded Kahuna node per page and
/// runs Kahuna scripts against it.
///
/// <para>The node is the real engine: the same script parser, transaction coordinator, Raft log and
/// key/value actors the server runs, on the thread-free browser build of Kahuna.Core. Storage and
/// WAL are in memory, so a reload starts empty.</para>
///
/// <para>Calls are serialized through one gate. The runtime has one thread, so they cannot run in
/// parallel, but without the gate a second call issued before the first one resolves would
/// interleave with it at every await.</para>
/// </summary>
[SupportedOSPlatform("browser")]
public static partial class PlaygroundEngine
{
    private static readonly SemaphoreSlim gate = new(1, 1);

    private static EmbeddedKahunaNode? node;

    /// <summary>Starts the node. A second call returns once the first node is up.</summary>
    [JSExport]
    public static async Task InitAsync()
    {
        await gate.WaitAsync().ConfigureAwait(false);
        try
        {
            node ??= await StartNodeAsync().ConfigureAwait(false);
        }
        finally
        {
            gate.Release();
        }
    }

    /// <summary>Discards every key by disposing the node and starting a new one.</summary>
    [JSExport]
    public static async Task ResetAsync()
    {
        await gate.WaitAsync().ConfigureAwait(false);
        try
        {
            if (node is not null)
                await node.DisposeAsync().ConfigureAwait(false);

            node = null;
            node = await StartNodeAsync().ConfigureAwait(false);
        }
        finally
        {
            gate.Release();
        }
    }

    /// <summary>
    /// Runs <paramref name="script"/> as one transaction script and returns its outcome as JSON:
    /// <c>{"ok","type","reason"?,"values":[{"key","value","revision","expires","lastModified"}],"ms"}</c>.
    /// <c>value</c> is the UTF-8 text of the stored bytes, or null. <c>expires</c> and
    /// <c>lastModified</c> are Unix milliseconds, or 0 when not set.
    ///
    /// <para><paramref name="parametersJson"/> is an optional JSON object that maps placeholder names
    /// (with or without the leading <c>@</c>) to values, for example <c>{"@limit":"10"}</c>.</para>
    /// </summary>
    [JSExport]
    public static async Task<string> ExecuteAsync(string script, string? parametersJson)
    {
        await gate.WaitAsync().ConfigureAwait(false);
        try
        {
            node ??= await StartNodeAsync().ConfigureAwait(false);

            Stopwatch stopwatch = Stopwatch.StartNew();
            KeyValueTransactionResult result;

            try
            {
                List<KeyValueParameter>? parameters = ParseParameters(parametersJson);
                result = await node.Kahuna.TryExecuteTransactionScript(Encoding.UTF8.GetBytes(script), null, parameters).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                result = new() { Type = KeyValueResponseType.Errored, Reason = ex.Message };
            }

            stopwatch.Stop();

            return WriteOutcome(result, stopwatch.Elapsed.TotalMilliseconds);
        }
        finally
        {
            gate.Release();
        }
    }

    /// <summary>
    /// Lists every live key of the store, persistent and ephemeral, as JSON:
    /// <c>[{"key","value","revision","expires","lastModified","durability"}]</c>, sorted by key.
    /// The page shows it next to the results, so a visitor sees what a script changed.
    /// </summary>
    [JSExport]
    public static async Task<string> KeysAsync()
    {
        await gate.WaitAsync().ConfigureAwait(false);
        try
        {
            node ??= await StartNodeAsync().ConfigureAwait(false);

            List<(string Key, ReadOnlyKeyValueEntry Entry, string Durability)> items = [];

            foreach ((KeyValueDurability durability, string label) in new[] { (KeyValueDurability.Persistent, "persistent"), (KeyValueDurability.Ephemeral, "ephemeral") })
            {
                KeyValueGetByBucketResult scan = await node.Kahuna.ScanAllByPrefix("", HLCTimestamp.Zero, durability, CancellationToken.None).ConfigureAwait(false);

                foreach ((string key, ReadOnlyKeyValueEntry entry) in scan.Items)
                    items.Add((key, entry, label));
            }

            items.Sort((a, b) => string.CompareOrdinal(a.Key, b.Key));

            ArrayBufferWriter<byte> buffer = new();
            using (Utf8JsonWriter writer = new(buffer))
            {
                writer.WriteStartArray();

                foreach ((string key, ReadOnlyKeyValueEntry entry, string durability) in items)
                {
                    writer.WriteStartObject();
                    writer.WriteString("key", key);
                    WriteValue(writer, entry.Value);
                    writer.WriteNumber("revision", entry.Revision);
                    writer.WriteNumber("expires", entry.Expires.L);
                    writer.WriteNumber("lastModified", entry.LastModified.L);
                    writer.WriteString("durability", durability);
                    writer.WriteEndObject();
                }

                writer.WriteEndArray();
            }

            return Encoding.UTF8.GetString(buffer.WrittenSpan);
        }
        finally
        {
            gate.Release();
        }
    }

    private static async Task<EmbeddedKahunaNode> StartNodeAsync()
    {
        // Single-node timings: a lone node wins its own election uncontested, so a short election
        // timeout is safe and keeps the first load and every reset well under a second. Kommander
        // requires the heartbeat and the leader check to stay at most a fifth of the election timeout.
        EmbeddedKahunaNode started = new(new()
        {
            NodeName = "kahuna-playground",
            Storage = "memory",
            WalStorage = "memory",
            InitialPartitions = 1,
            HeartbeatInterval = TimeSpan.FromMilliseconds(20),
            RecentHeartbeat = TimeSpan.FromMilliseconds(10),
            VotingTimeout = TimeSpan.FromMilliseconds(300),
            CheckLeaderInterval = TimeSpan.FromMilliseconds(25),
            UpdateNodesInterval = TimeSpan.FromMilliseconds(250),
            TimerInitialDelay = TimeSpan.FromMilliseconds(25),
            StartElectionTimeout = 150,
            EndElectionTimeout = 300,
        }, NullLoggerFactory.Instance);

        await started.StartAsync(CancellationToken.None).ConfigureAwait(false);
        await started.WaitForLeaderForKeyAsync("playground", CancellationToken.None).ConfigureAwait(false);

        return started;
    }

    private static List<KeyValueParameter>? ParseParameters(string? parametersJson)
    {
        if (string.IsNullOrWhiteSpace(parametersJson))
            return null;

        using JsonDocument document = JsonDocument.Parse(parametersJson);
        if (document.RootElement.ValueKind != JsonValueKind.Object)
            throw new ArgumentException("Parameters must be a JSON object.");

        List<KeyValueParameter> parameters = [];

        foreach (JsonProperty property in document.RootElement.EnumerateObject())
        {
            string name = property.Name.StartsWith('@') ? property.Name : "@" + property.Name;
            string? value = property.Value.ValueKind switch
            {
                JsonValueKind.String => property.Value.GetString(),
                JsonValueKind.Null => null,
                _ => property.Value.GetRawText()
            };

            parameters.Add(new() { Key = name, Value = value });
        }

        return parameters.Count == 0 ? null : parameters;
    }

    private static string WriteOutcome(KeyValueTransactionResult result, double ms)
    {
        ArrayBufferWriter<byte> buffer = new();
        using (Utf8JsonWriter writer = new(buffer))
        {
            writer.WriteStartObject();
            writer.WriteBoolean("ok", IsSuccess(result.Type));
            writer.WriteString("type", result.Type.ToString());

            if (!string.IsNullOrEmpty(result.Reason))
                writer.WriteString("reason", result.Reason);

            writer.WriteStartArray("values");

            if (result.Values is not null)
            {
                foreach (KeyValueTransactionResultValue value in result.Values)
                {
                    writer.WriteStartObject();

                    if (value.Key is null)
                        writer.WriteNull("key");
                    else
                        writer.WriteString("key", value.Key);

                    WriteValue(writer, value.Value);
                    writer.WriteNumber("revision", value.Revision);
                    writer.WriteNumber("expires", value.Expires.L);
                    writer.WriteNumber("lastModified", value.LastModified.L);
                    writer.WriteEndObject();
                }
            }

            writer.WriteEndArray();
            writer.WriteNumber("ms", Math.Round(ms, 2));
            writer.WriteEndObject();
        }

        return Encoding.UTF8.GetString(buffer.WrittenSpan);
    }

    private static void WriteValue(Utf8JsonWriter writer, byte[]? value)
    {
        if (value is null)
            writer.WriteNull("value");
        else
            writer.WriteString("value", Encoding.UTF8.GetString(value));
    }

    private static bool IsSuccess(KeyValueResponseType type)
        => type is not (KeyValueResponseType.Errored or KeyValueResponseType.InvalidInput or KeyValueResponseType.Aborted
            or KeyValueResponseType.MustRetry or KeyValueResponseType.AdmissionRefused or KeyValueResponseType.AlreadyLocked);
}
