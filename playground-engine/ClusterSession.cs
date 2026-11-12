using System.Buffers;
using System.Text;
using System.Text.Json;

using Kahuna;
using Kahuna.Server.Communication.Internode;
using Kahuna.Server.KeyValues;
using Kahuna.Server.KeyValues.Transactions.Data;
using Kahuna.Shared.KeyValue;
using Kommander;
using Kommander.Communication.Memory;
using Kommander.Data;
using Kommander.Discovery;
using Kommander.System;
using Kommander.Time;
using Microsoft.Extensions.Logging.Abstractions;

namespace Kahuna.Playground;

/// <summary>
/// Several Kahuna nodes in one browser tab, wired into one cluster over Kahuna's and Kommander's
/// in-memory transports. Every member is a full node: its own Raft log, its own key/value store and
/// its own placement view. The cluster elects partition leaders, replicates writes and fails over
/// the way a networked one does. Only the transport is in memory, because a tab cannot open a socket.
///
/// <para>Everything runs on the page's one event loop, so the Raft timings must leave room for
/// every node and every partition. A short election timeout would start elections that no fault
/// caused.</para>
///
/// <para>The members are not safe against one another's lifecycle. The caller serializes every
/// call through the playground's gate, so a start or a stop never overlaps a script.</para>
/// </summary>
internal sealed class ClusterSession : IAsyncDisposable
{
    /// <summary>The page offers at most this many nodes, so one visitor cannot exhaust the tab.</summary>
    public const int MaxNodeCount = 9;

    /// <summary>
    /// The fewest nodes the cluster keeps. With a replication factor of 3, a fourth node gives the
    /// placement rebalancer a place to move replicas when one node fails or leaves.
    /// </summary>
    public const int MinNodeCount = 4;

    public const int DataPartitions = 8;

    public const int ReplicationFactor = 3;

    /// <summary>The first member's port. The others count up from it; nothing binds it.</summary>
    private const int BasePort = 2070;

    /// <summary>
    /// How long a leader poll waits before it gives up. Generous next to an election timeout of
    /// 1.5 to 3 s, and short enough that a wedged cluster reports an error instead of holding the
    /// playground's gate for ever.
    /// </summary>
    private static readonly TimeSpan LeaderWaitBudget = TimeSpan.FromSeconds(60);

    /// <summary>
    /// How long a visitor's script may run. The page can stop enough members that a partition has no
    /// majority, and a script that needs that partition would otherwise wait for a long time.
    /// </summary>
    private static readonly TimeSpan ScriptBudget = TimeSpan.FromSeconds(15);

    private readonly MemoryInterNodeCommmunication interNode = new();

    private readonly InMemoryCommunication raftTransport = new();

    private EmbeddedKahunaOptions[] nodeOptions;

    private string[] endpoints;

    private EmbeddedKahunaNode?[] members;

    private ClusterSession(EmbeddedKahunaOptions[] nodeOptions, string[] endpoints)
    {
        this.nodeOptions = nodeOptions;
        this.endpoints = endpoints;
        members = new EmbeddedKahunaNode?[nodeOptions.Length];
    }

    /// <summary>Members, running or stopped.</summary>
    public int NodeCount => members.Length;

    /// <summary>
    /// Builds <paramref name="nodeCount"/> nodes, starts them together, and waits until every
    /// partition has a leader.
    /// </summary>
    public static async Task<ClusterSession> StartAsync(int nodeCount, CancellationToken cancellationToken = default)
    {
        if (nodeCount < MinNodeCount || nodeCount > MaxNodeCount)
            throw new ArgumentOutOfRangeException(nameof(nodeCount), nodeCount, $"The playground cluster runs {MinNodeCount} to {MaxNodeCount} nodes.");

        EmbeddedKahunaOptions[] nodeOptions = new EmbeddedKahunaOptions[nodeCount];
        string[] endpoints = new string[nodeCount];

        for (int i = 0; i < nodeCount; i++)
        {
            nodeOptions[i] = CreateOptions(i, joinSeeds: null);
            endpoints[i] = EndpointOf(i);
        }

        ClusterSession cluster = new(nodeOptions, endpoints);

        try
        {
            for (int i = 0; i < nodeCount; i++)
                cluster.members[i] = cluster.BuildNode(i);

            cluster.PublishRoutes();

            Task[] starts = new Task[nodeCount];
            for (int i = 0; i < nodeCount; i++)
                starts[i] = cluster.StartMemberAsync(i, cancellationToken);

            await Task.WhenAll(starts).ConfigureAwait(false);

            foreach (int partitionId in cluster.PartitionIds())
                await cluster.LeaderIndexAsync(partitionId, cancellationToken).ConfigureAwait(false);

            return cluster;
        }
        catch
        {
            await cluster.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    /// <summary>
    /// Runs <paramref name="script"/> as one transaction script on the member at
    /// <paramref name="index"/>. A member that does not lead a key's partition forwards the work to
    /// the member that does.
    /// </summary>
    public async Task<KeyValueTransactionResult> ExecuteAsync(int index, string script, List<KeyValueParameter>? parameters)
    {
        EmbeddedKahunaNode node = MemberAt(index);

        Task<KeyValueTransactionResult> run = node.Kahuna.TryExecuteTransactionScript(Encoding.UTF8.GetBytes(script), null, parameters);

        if (await Task.WhenAny(run, Task.Delay(ScriptBudget)).ConfigureAwait(false) != run)
        {
            // The script keeps running in the engine; observe its outcome so it cannot fault unseen.
            _ = run.ContinueWith(static task => _ = task.Exception, TaskScheduler.Default);

            return new()
            {
                Type = KeyValueResponseType.Errored,
                Reason = $"The script did not finish within {ScriptBudget.TotalSeconds:0} s. A partition it needs may have lost its majority: restart a stopped server."
            };
        }

        return await run.ConfigureAwait(false);
    }

    /// <summary>The partition that holds <paramref name="key"/>, or -1 when no running member can tell.</summary>
    public int PartitionOf(string key)
    {
        foreach (EmbeddedKahunaNode? member in members)
        {
            if (member is null)
                continue;

            try
            {
                return member.Raft.GetPartitionKey(key);
            }
            catch (RaftException)
            {
            }
        }

        return -1;
    }

    /// <summary>
    /// What the page draws, as JSON: the committed roster, the partition map with its replicas, and
    /// for each member whether it runs, which partitions it hosts and which it believes it leads.
    /// A leader claim is the member's own belief. Right after a failover the old leader can still
    /// claim the partition until it hears the new term, so the page shows it as a hint.
    /// </summary>
    public async Task<string> StatusJsonAsync(CancellationToken cancellationToken = default)
    {
        int[] partitionIds = PartitionIds();

        // Leader checks are asynchronous, so collect them before the synchronous JSON writer runs.
        List<int>[] hosts = new List<int>[members.Length];
        List<int>[] leads = new List<int>[members.Length];
        int systemLeader = -1;

        for (int i = 0; i < members.Length; i++)
        {
            hosts[i] = [];
            leads[i] = [];

            EmbeddedKahunaNode? member = members[i];
            if (member is null)
                continue;

            foreach (int partitionId in partitionIds)
            {
                if (member.Raft.HostsPartition(partitionId))
                    hosts[i].Add(partitionId);

                if (await LeadsAsync(member, partitionId, cancellationToken).ConfigureAwait(false))
                    leads[i].Add(partitionId);
            }

            if (systemLeader < 0 && leads[i].Contains(RaftSystemConfig.SystemPartition))
                systemLeader = i;
        }

        ArrayBufferWriter<byte> buffer = new();
        using (Utf8JsonWriter writer = new(buffer))
        {
            writer.WriteStartObject();
            writer.WriteNumber("replicationFactor", ReplicationFactor);
            writer.WriteNumber("minNodes", MinNodeCount);
            writer.WriteNumber("maxNodes", MaxNodeCount);

            // Prefer the view of the member that leads the system partition: it applies a roster
            // or placement change first.
            EmbeddedKahunaNode? source = (systemLeader >= 0 ? members[systemLeader] : null)
                ?? members.FirstOrDefault(member => member is not null && member.Raft.LocalRole == ClusterMemberRole.Voter)
                ?? members.FirstOrDefault(member => member is not null);

            if (source is not null)
            {
                ClusterMembership membership = source.Raft.GetMembership();
                writer.WriteNumber("membershipVersion", membership.MembershipVersion);
                writer.WriteStartArray("members");
                foreach (ClusterMember member in membership.Members)
                {
                    writer.WriteStartObject();
                    writer.WriteString("endpoint", member.Endpoint);
                    writer.WriteNumber("index", Array.IndexOf(endpoints, member.Endpoint));
                    writer.WriteString("role", member.Role.ToString());
                    writer.WriteEndObject();
                }
                writer.WriteEndArray();

                writer.WriteStartArray("partitions");
                foreach (RaftPartitionRange partition in source.Raft.GetPartitionMap())
                {
                    writer.WriteStartObject();
                    writer.WriteNumber("id", partition.PartitionId);
                    writer.WriteString("state", partition.State.ToString());
                    writer.WriteNumber("generation", partition.Generation);
                    writer.WriteStartArray("replicas");
                    foreach (RaftReplica replica in partition.Replicas)
                    {
                        writer.WriteStartObject();
                        writer.WriteNumber("index", Array.IndexOf(endpoints, replica.Endpoint));
                        writer.WriteString("role", replica.Role.ToString());
                        writer.WriteEndObject();
                    }
                    writer.WriteEndArray();
                    writer.WriteEndObject();
                }
                writer.WriteEndArray();
            }

            writer.WriteStartArray("nodes");

            for (int i = 0; i < members.Length; i++)
            {
                EmbeddedKahunaNode? member = members[i];

                writer.WriteStartObject();
                writer.WriteNumber("index", i);
                writer.WriteString("name", nodeOptions[i].NodeName);
                writer.WriteString("endpoint", endpoints[i]);
                writer.WriteBoolean("running", member is not null);
                writer.WriteString("role", member?.Raft.LocalRole.ToString() ?? "Stopped");

                writer.WriteStartArray("hosts");
                foreach (int partitionId in hosts[i])
                    writer.WriteNumberValue(partitionId);
                writer.WriteEndArray();

                writer.WriteStartArray("leads");
                foreach (int partitionId in leads[i])
                    writer.WriteNumberValue(partitionId);
                writer.WriteEndArray();

                writer.WriteEndObject();
            }

            writer.WriteEndArray();
            writer.WriteEndObject();
        }

        return Encoding.UTF8.GetString(buffer.WrittenSpan);
    }

    /// <summary>
    /// The index of a running member that believes it leads <paramref name="partitionId"/>. It polls
    /// until one does, so it also serves as the wait for a failover to finish. The wait is bounded:
    /// the caller holds the playground's gate for the whole poll.
    /// </summary>
    public async Task<int> LeaderIndexAsync(int partitionId, CancellationToken cancellationToken = default)
    {
        DateTime until = DateTime.UtcNow + LeaderWaitBudget;

        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();

            for (int i = 0; i < members.Length; i++)
            {
                EmbeddedKahunaNode? member = members[i];
                if (member is not null && await LeadsAsync(member, partitionId, cancellationToken).ConfigureAwait(false))
                    return i;
            }

            if (DateTime.UtcNow > until)
                throw new InvalidOperationException($"No node claimed partition {partitionId} within {LeaderWaitBudget.TotalSeconds:0} s.");

            await Task.Delay(TimeSpan.FromMilliseconds(20), cancellationToken).ConfigureAwait(false);
        }
    }

    /// <summary>
    /// Stops the member at <paramref name="index"/> as if the host it ran on had crashed: its traffic
    /// is cut, it leaves both transports, and its engine is disposed. The page can stop several
    /// members to show a loss of quorum.
    /// </summary>
    public async Task StopNodeAsync(int index)
    {
        EmbeddedKahunaNode member = MemberAt(index);

        // Cut the member off before it is disposed, so no peer calls into a node that is shutting down.
        raftTransport.PartitionNode(endpoints[index]);
        members[index] = null;
        PublishRoutes();

        await member.DisposeAsync().ConfigureAwait(false);
    }

    /// <summary>
    /// Starts a stopped member again under the same endpoint, with an empty log and empty storage. It
    /// joins through the running members and catches up from them.
    /// </summary>
    public async Task StartNodeAsync(int index, CancellationToken cancellationToken = default)
    {
        CheckIndex(index);

        if (members[index] is not null)
            throw new InvalidOperationException($"{nodeOptions[index].NodeName} is already running.");

        nodeOptions[index] = CreateOptions(index, endpoints.Where((_, peer) => peer != index && members[peer] is not null).ToList());

        members[index] = BuildNode(index);
        PublishRoutes();
        raftTransport.HealPartition(endpoints[index]);

        try
        {
            await StartMemberAsync(index, cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            EmbeddedKahunaNode? failed = members[index];
            raftTransport.PartitionNode(endpoints[index]);
            members[index] = null;
            PublishRoutes();

            if (failed is not null)
                await failed.DisposeAsync().ConfigureAwait(false);

            throw;
        }
    }

    /// <summary>Adds a voter. The placement rebalancer then moves replicas to it.</summary>
    public async Task AddNodeAsync(CancellationToken cancellationToken = default)
    {
        RequireHealthy();

        if (NodeCount >= MaxNodeCount)
            throw new InvalidOperationException($"This tab supports at most {MaxNodeCount} nodes.");

        int index = NodeCount;
        List<string> seeds = endpoints.ToList();

        Array.Resize(ref nodeOptions, index + 1);
        Array.Resize(ref endpoints, index + 1);
        Array.Resize(ref members, index + 1);

        nodeOptions[index] = CreateOptions(index, seeds);
        endpoints[index] = EndpointOf(index);
        members[index] = BuildNode(index);
        PublishRoutes();

        await StartMemberAsync(index, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Drains the last member, removes it from the roster, and stops it.</summary>
    public async Task RemoveNodeAsync(CancellationToken cancellationToken = default)
    {
        RequireHealthy();

        if (NodeCount <= MinNodeCount)
            throw new InvalidOperationException($"Keep at least {MinNodeCount} nodes in this cluster.");

        int index = NodeCount - 1;
        EmbeddedKahunaNode member = MemberAt(index);
        LeaveClusterResult result = await member.Raft.RequestLeaveAsync(cancellationToken).ConfigureAwait(false);

        if (!result.Left)
            throw new InvalidOperationException($"The node was not removed: {result.Outcome}. Retry after placement converges.");

        members[index] = null;
        await member.DisposeAsync().ConfigureAwait(false);

        Array.Resize(ref members, index);
        Array.Resize(ref endpoints, index);
        Array.Resize(ref nodeOptions, index);
        PublishRoutes();
    }

    public async ValueTask DisposeAsync()
    {
        for (int i = 0; i < members.Length; i++)
        {
            EmbeddedKahunaNode? member = members[i];
            if (member is null)
                continue;

            members[i] = null;
            await member.DisposeAsync().ConfigureAwait(false);
        }
    }

    /// <summary>A running member, for a caller that needs one to route through.</summary>
    public int FirstRunningIndex()
    {
        for (int i = 0; i < members.Length; i++)
        {
            if (members[i] is not null && members[i]!.Raft.LocalRole == ClusterMemberRole.Voter)
                return i;
        }

        throw new InvalidOperationException("Every server is stopped. Restart one first.");
    }

    private EmbeddedKahunaNode MemberAt(int index)
    {
        CheckIndex(index);

        return members[index] ?? throw new InvalidOperationException($"{nodeOptions[index].NodeName} is stopped.");
    }

    private void RequireHealthy()
    {
        if (members.Any(member => member is null || member.Raft.LocalRole != ClusterMemberRole.Voter))
            throw new InvalidOperationException("Restart stopped servers and wait for them to rejoin before you change the cluster size.");
    }

    /// <summary>The partitions to wait for and to report: the system partition and the data partitions.</summary>
    private int[] PartitionIds()
    {
        EmbeddedKahunaNode? source = members.FirstOrDefault(member => member is not null);
        List<int> ids = [RaftSystemConfig.SystemPartition];

        if (source is not null)
        {
            foreach (RaftPartitionRange partition in source.Raft.GetPartitionMap())
            {
                if (partition.State != RaftPartitionState.Removed && !ids.Contains(partition.PartitionId))
                    ids.Add(partition.PartitionId);
            }
        }

        if (ids.Count == 1)
        {
            for (int id = 1; id <= DataPartitions; id++)
                ids.Add(id);
        }

        return ids.ToArray();
    }

    /// <summary>
    /// A member's local answer to "do I lead this partition?". A node that is rejoining, that does
    /// not host the partition, or that was disposed under this poll leads nothing.
    /// </summary>
    private static async Task<bool> LeadsAsync(EmbeddedKahunaNode member, int partitionId, CancellationToken cancellationToken)
    {
        try
        {
            return await member.Raft.AmILeader(partitionId, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is RaftException or ObjectDisposedException)
        {
            return false;
        }
    }

    private static string EndpointOf(int index) => $"localhost:{BasePort + index}";

    private static EmbeddedKahunaOptions CreateOptions(int index, List<string>? joinSeeds) => new()
    {
        NodeName = $"kahuna-{index + 1}",
        NodeId = index + 1,
        Host = "localhost",
        Port = BasePort + index,
        Storage = "memory",
        WalStorage = "memory",
        InitialPartitions = DataPartitions,
        ReplicationFactor = ReplicationFactor,
        EnablePlacementRebalancer = true,
        ReplicaCountDeadband = 0,
        PlacementPassInterval = TimeSpan.FromSeconds(2),
        EnableLoadReports = true,
        // Nine nodes share one browser event loop. A leader's heartbeats can arrive a few hundred
        // milliseconds late, so a short election timeout would start elections that no fault caused.
        StartElectionTimeout = 1500,
        EndElectionTimeout = 3000,
        JoinExistingSeeds = joinSeeds is { Count: > 0 } ? joinSeeds : null,
    };

    private EmbeddedKahunaNode BuildNode(int index)
    {
        List<RaftNode> peers = new(endpoints.Length - 1);
        for (int i = 0; i < endpoints.Length; i++)
        {
            if (i != index)
                peers.Add(new(endpoints[i]));
        }

        return new EmbeddedKahunaNode(
            nodeOptions[index],
            interNode.ForNode(endpoints[index]),
            raftTransport,
            new StaticDiscovery(peers),
            NullLoggerFactory.Instance
        );
    }

    private async Task StartMemberAsync(int index, CancellationToken cancellationToken)
    {
        EmbeddedKahunaNode node = members[index]!;

        await node.Raft.UpdateNodes().ConfigureAwait(false);
        await node.StartAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Publishes the running members to both transports; a stopped member is unreachable.</summary>
    private void PublishRoutes()
    {
        Dictionary<string, IKahuna> kahunaRoutes = new(members.Length);
        Dictionary<string, IRaft> raftRoutes = new(members.Length);

        for (int i = 0; i < members.Length; i++)
        {
            EmbeddedKahunaNode? member = members[i];
            if (member is null)
                continue;

            kahunaRoutes[endpoints[i]] = member.Kahuna;
            raftRoutes[endpoints[i]] = member.Raft;
        }

        interNode.SetNodes(kahunaRoutes);
        raftTransport.SetNodes(raftRoutes);
    }

    private void CheckIndex(int index)
    {
        if ((uint)index >= (uint)members.Length)
            throw new InvalidOperationException($"There is no server {index + 1} in a {members.Length}-node cluster.");
    }
}
