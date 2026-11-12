// Holds the in-tab Kahuna cluster: starts it, polls its status, and runs every server operation the
// page offers. The engine performs each change; this hook only asks for it and shows the result.
import {useEffect, useRef, useState} from 'react';
import {loadEngine} from '../KahunaPlayground/runtime';
import {seedScript} from '../KahunaPlayground/examples.mjs';
import {nodeName, START_NODES} from './model.mjs';

// Lets the browser paint before a long engine call holds the main thread.
const paint = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

const partitionName = (id) => (id === 0 ? 'system partition' : `P${id}`);

const leadersOf = (status, id) =>
  status.nodes.filter((n) => n.running && n.leads.includes(id)).map((n) => nodeName(n.index));

export default function useCluster(dotnetUrl) {
  const [cluster, setCluster] = useState(null);
  const [busy, setBusy] = useState(true);
  const [startup, setStartup] = useState('loading');
  const [download, setDownload] = useState(null);
  const [message, setMessage] = useState('Starting four real Kahuna servers in this tab…');
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);
  const [changingNode, setChangingNode] = useState(null);
  const api = useRef(null);
  const lock = useRef(false);
  const pendingPoll = useRef(null);
  const mounted = useRef(true);
  const previous = useRef(null);
  const nextEvent = useRef(0);

  function log(text) {
    if (mounted.current) setEvents((old) => [{id: ++nextEvent.current, at: new Date(), text}, ...old].slice(0, 50));
  }

  // Compares the new status with the last one and writes what changed to the journal.
  function accept(next) {
    if (!mounted.current) return;
    const old = previous.current;
    if (old) {
      if (old.membershipVersion !== next.membershipVersion) {
        const voters = next.members.filter((m) => m.role === 'Voter').map((m) => nodeName(m.index));
        log(`Roster v${next.membershipVersion} committed · voters: ${voters.join(', ')}`);
      }
      const ids = [0, ...next.partitions.map((p) => p.id)];
      for (const id of ids) {
        const before = leadersOf(old, id).join(', ');
        const after = leadersOf(next, id).join(', ');
        if (before !== after) log(`${partitionName(id)} leader: ${before || 'none'} → ${after || 'electing…'}`);
      }
      for (const part of next.partitions) {
        const was = old.partitions.find((p) => p.id === part.id);
        const replicas = (p) => p.replicas.map((r) => `${nodeName(r.index)}${r.role === 'Voter' ? '' : ` (${r.role.toLowerCase()})`}`).join(', ');
        if (was && replicas(was) !== replicas(part)) log(`P${part.id} replicas → ${replicas(part)}`);
      }
    }
    previous.current = next;
    setCluster(next);
  }

  async function refresh() {
    if (api.current) accept(JSON.parse(await api.current.ClusterStatusAsync()));
  }

  // Runs one operation at a time. A failed operation can still have changed the cluster, so the
  // page reads the engine again instead of keeping a topology it guessed.
  async function action(text, work, isStartup = false) {
    if (lock.current) return undefined;
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage(text);
    try {
      await pendingPoll.current;
      const result = await work();
      if (mounted.current) setMessage('Ready. Kahuna runs the elections and the replica placement.');
      return result;
    } catch (err) {
      if (mounted.current) {
        setError(err.message);
        if (isStartup) setStartup('error');
        log(`Error: ${err.message}`);
      }
      try {
        await refresh();
      } catch {
        // The status stays as it was.
      }
      return undefined;
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function start() {
    return action('Loading WebAssembly…', async () => {
      setStartup('loading');
      setDownload(null);
      await paint();
      api.current = await loadEngine(dotnetUrl, (loaded, total) => {
        if (mounted.current) {
          setDownload({loaded, total});
          setMessage(`Downloading WebAssembly · ${loaded}/${total} files`);
        }
      });
      if (!mounted.current) return;
      previous.current = null;
      setCluster(null);
      setStartup('starting');
      setMessage(`Starting ${START_NODES} servers and electing partition leaders…`);
      await paint();
      accept(JSON.parse(await api.current.StartClusterAsync(START_NODES)));
      setStartup('seeding');
      setMessage('Writing the sample keys…');
      await paint();
      const seeded = JSON.parse(await api.current.ExecuteOnNodeAsync(0, seedScript.trim(), null));
      if (!seeded.ok) throw new Error(`The sample keys did not load (${seeded.type}: ${seeded.reason})`);
      await refresh();
      log(`${START_NODES} servers started · ${previous.current.partitions.length} partitions · replication factor ${previous.current.replicationFactor}`);
      if (mounted.current) setStartup('ready');
    }, true);
  }

  function run(index, script, parametersJson) {
    return action(`Running the script on ${nodeName(index)}…`, async () => {
      const outcome = JSON.parse(await api.current.ExecuteOnNodeAsync(index, script, parametersJson));
      await refresh();
      return {outcome, servedBy: nodeName(index)};
    });
  }

  function toggleNode(index) {
    return action('Changing the server state…', async () => {
      const restarting = !previous.current.nodes[index].running;
      if (restarting) {
        setChangingNode(index);
        await paint();
      }
      try {
        accept(JSON.parse(await api.current[restarting ? 'StartNodeAsync' : 'StopNodeAsync'](index)));
        log(restarting
          ? `${nodeName(index)} restarted empty · it catches up from its peers`
          : `${nodeName(index)} stopped · its partitions elect new leaders`);
      } finally {
        if (mounted.current) setChangingNode(null);
      }
    });
  }

  function resize(direction) {
    return action(
      direction > 0 ? 'Joining a new server; waiting for it to become a voter…' : 'Draining the last server and committing its removal…',
      async () => {
        const current = previous.current;
        if (!current || current.nodes.some((n) => !n.running || n.role !== 'Voter'))
          throw new Error('Restart the stopped servers and wait for them to rejoin before you change the cluster size.');
        if (direction > 0) {
          setChangingNode(current.nodes.length);
          await paint();
        }
        try {
          accept(JSON.parse(await api.current[direction > 0 ? 'AddClusterNodeAsync' : 'RemoveClusterNodeAsync']()));
          log(direction > 0
            ? `${nodeName(current.nodes.length)} joined as a voter · the rebalancer moves replicas to it`
            : `${nodeName(current.nodes.length - 1)} drained and left the roster`);
        } finally {
          if (mounted.current) setChangingNode(null);
        }
      },
    );
  }

  useEffect(() => {
    mounted.current = true;
    start();
    return () => {
      mounted.current = false;
      api.current?.StopClusterAsync().catch(() => {});
    };
  }, [dotnetUrl]);

  // Poll the servers once a second, so elections and replica moves show as they happen.
  useEffect(() => {
    if (!cluster) return undefined;
    let cancelled = false;
    const timer = setInterval(async () => {
      if (lock.current || pendingPoll.current) return;
      pendingPoll.current = (async () => {
        try {
          const next = JSON.parse(await api.current.ClusterStatusAsync());
          if (!cancelled) accept(next);
        } catch (err) {
          if (!cancelled && mounted.current) setError(err.message);
        }
      })();
      await pendingPoll.current;
      pendingPoll.current = null;
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [!!cluster]);

  return {cluster, startup, download, busy, message, error, events, changingNode, start, run, toggleNode, resize};
}
