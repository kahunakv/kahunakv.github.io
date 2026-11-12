using System.Buffers;
using System.Diagnostics;
using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using System.Text;
using System.Text.Json;

using Kahuna.Server.KeyValues;
using Kahuna.Server.KeyValues.Transactions.Data;
using Kahuna.Shared.KeyValue;

namespace Kahuna.Playground;

/// <summary>
/// The JavaScript surface of the browser playground. It holds one in-tab Kahuna cluster per page
/// (see <see cref="ClusterSession"/>) and runs Kahuna scripts on its servers.
///
/// <para>Every server is the real engine: the same script parser, transaction coordinator, Raft log,
/// placement rebalancer and key/value actors the server runs, on the thread-free browser build of
/// Kahuna.Core. Storage and WAL are in memory, so a reload starts empty.</para>
///
/// <para>Calls are serialized through one gate. The runtime has one thread, so they cannot run in
/// parallel, but without the gate a second call issued before the first one resolves would
/// interleave with it at every await.</para>
/// </summary>
[SupportedOSPlatform("browser")]
public static partial class PlaygroundEngine
{
    private static readonly SemaphoreSlim gate = new(1, 1);

    private static ClusterSession? cluster;

    /// <summary>
    /// Starts a cluster of <paramref name="nodeCount"/> servers, replacing any running one, and
    /// returns its status (see <see cref="ClusterStatusAsync"/>). It takes several seconds: every
    /// server elects partition leaders with production-like Raft timings on one event loop.
    /// </summary>
    [JSExport]
    public static Task<string> StartClusterAsync(int nodeCount) => Gated(async () =>
    {
        if (cluster is not null)
            await cluster.DisposeAsync().ConfigureAwait(false);

        cluster = null;
        cluster = await ClusterSession.StartAsync(nodeCount).ConfigureAwait(false);

        return await cluster.StatusJsonAsync().ConfigureAwait(false);
    });

    /// <summary>Stops every server of the cluster. Doing it twice is not an error.</summary>
    [JSExport]
    public static Task StopClusterAsync() => Gated(async () =>
    {
        if (cluster is not null)
            await cluster.DisposeAsync().ConfigureAwait(false);

        cluster = null;
        return "";
    });

    /// <summary>
    /// The state of the cluster as JSON:
    /// <c>{"replicationFactor","minNodes","maxNodes","membershipVersion","members":[…],
    /// "partitions":[{"id","state","generation","replicas":[{"index","role"}]}],
    /// "nodes":[{"index","name","endpoint","running","role","hosts":[…],"leads":[…]}]}</c>.
    /// </summary>
    [JSExport]
    public static Task<string> ClusterStatusAsync() => Gated(() => RequireCluster().StatusJsonAsync());

    /// <summary>Stops one server as if its host had crashed, including when fewer than a majority remain.</summary>
    [JSExport]
    public static Task<string> StopNodeAsync(int nodeIndex) => Gated(async () =>
    {
        ClusterSession running = RequireCluster();
        await running.StopNodeAsync(nodeIndex).ConfigureAwait(false);
        return await running.StatusJsonAsync().ConfigureAwait(false);
    });

    /// <summary>Starts a stopped server again. It comes back empty and catches up from the others.</summary>
    [JSExport]
    public static Task<string> StartNodeAsync(int nodeIndex) => Gated(async () =>
    {
        ClusterSession running = RequireCluster();
        await running.StartNodeAsync(nodeIndex).ConfigureAwait(false);
        return await running.StatusJsonAsync().ConfigureAwait(false);
    });

    /// <summary>Adds one voter. The placement rebalancer then moves replicas to it.</summary>
    [JSExport]
    public static Task<string> AddClusterNodeAsync() => Gated(async () =>
    {
        ClusterSession running = RequireCluster();
        await running.AddNodeAsync().ConfigureAwait(false);
        return await running.StatusJsonAsync().ConfigureAwait(false);
    });

    /// <summary>Drains the last server, removes it from the roster, and stops it.</summary>
    [JSExport]
    public static Task<string> RemoveClusterNodeAsync() => Gated(async () =>
    {
        ClusterSession running = RequireCluster();
        await running.RemoveNodeAsync().ConfigureAwait(false);
        return await running.StatusJsonAsync().ConfigureAwait(false);
    });

    /// <summary>
    /// Runs <paramref name="script"/> as one transaction script on server <paramref name="nodeIndex"/>
    /// and returns its outcome as JSON:
    /// <c>{"ok","type","reason"?,"values":[{"key","partition","value","revision","expires","lastModified"}],"ms"}</c>.
    /// <c>value</c> is the UTF-8 text of the stored bytes, or null. <c>partition</c> is the partition
    /// that holds the key, or -1. <c>expires</c> and <c>lastModified</c> are Unix milliseconds, or 0.
    ///
    /// <para><paramref name="parametersJson"/> is an optional JSON object that maps placeholder names
    /// (with or without the leading <c>@</c>) to values, for example <c>{"@limit":"10"}</c>.</para>
    /// </summary>
    [JSExport]
    public static Task<string> ExecuteOnNodeAsync(int nodeIndex, string script, string? parametersJson) => Gated(async () =>
    {
        ClusterSession running = RequireCluster();
        Stopwatch stopwatch = Stopwatch.StartNew();
        KeyValueTransactionResult result;

        try
        {
            result = await running.ExecuteAsync(nodeIndex, script, ParseParameters(parametersJson)).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            result = new() { Type = KeyValueResponseType.Errored, Reason = ex.Message };
        }

        stopwatch.Stop();

        return WriteOutcome(running, result, stopwatch.Elapsed.TotalMilliseconds);
    });

    private static async Task<string> Gated(Func<Task<string>> work)
    {
        await gate.WaitAsync().ConfigureAwait(false);
        try
        {
            return await work().ConfigureAwait(false);
        }
        finally
        {
            gate.Release();
        }
    }

    private static ClusterSession RequireCluster()
        => cluster ?? throw new InvalidOperationException("No cluster is running. Call StartClusterAsync first.");

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

    private static string WriteOutcome(ClusterSession running, KeyValueTransactionResult result, double ms)
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
                    {
                        writer.WriteNull("key");
                        writer.WriteNumber("partition", -1);
                    }
                    else
                    {
                        writer.WriteString("key", value.Key);
                        writer.WriteNumber("partition", running.PartitionOf(value.Key));
                    }

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
