// The /playground page: a real Kahuna cluster in the browser tab. Visitors see the servers and the
// partitions each one hosts and leads, stop and restart servers, add and remove them, and run Kahuna
// scripts on the server they select.
import {useState} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {ScriptConsole} from '../KahunaPlayground';
import {MAX_NODES, MIN_NODES, START_NODES, nodeName} from './model.mjs';
import useCluster from './useCluster';
import styles from './styles.module.css';

const STEPS = ['loading', 'starting', 'seeding'];
const STEP_LABELS = ['Load the engine', 'Start the servers', 'Write sample keys'];

// Fill the front row first; capacity grows toward the back of the floor.
const slots = Array.from({length: MAX_NODES}, (_, id) => ({id, x: 90 + (id % 3) * 150, y: 390 - Math.floor(id / 3) * 150}));

function formatTime(date) {
  return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
}

function SessionStatus({lab, starting, online}) {
  const title = starting
    ? 'Preparing your cluster'
    : lab.startup === 'error'
      ? 'The cluster did not start'
      : lab.busy
        ? 'Working…'
        : lab.error
          ? 'The operation failed'
          : 'Cluster ready';
  const text = starting || lab.busy ? lab.message : lab.error || `${online} servers online · select a server, then run a script on it`;
  const current = STEPS.indexOf(lab.startup);
  return (
    <section className={styles.sessionStatus} aria-label="Cluster session status">
      <div className={styles.sessionHeading} role="status">
        <span className={lab.busy ? styles.spinner : styles.statusMark} data-error={!!lab.error || undefined} aria-hidden="true">
          {lab.busy ? '' : lab.error ? '!' : '✓'}
        </span>
        <div>
          <strong>{title}</strong>
          <p>{text}</p>
        </div>
        {lab.startup === 'error' && <button type="button" disabled={lab.busy} onClick={lab.start}>Retry</button>}
      </div>
      {starting && (
        <ol className={styles.startupSteps} aria-label="Startup progress">
          {STEPS.map((step, i) => (
            <li key={step} aria-current={current === i ? 'step' : undefined} data-complete={current > i}>
              <span>{current > i ? '✓' : i + 1}</span>
              {STEP_LABELS[i]}
              {i === 0 && current === 0 && lab.download && <small>{lab.download.loaded}/{lab.download.total} files</small>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function ClusterPlayground() {
  const lab = useCluster(useBaseUrl('/playground-engine/_framework/dotnet.js'));
  const {cluster, busy} = lab;
  const [selected, setSelected] = useState(0);
  const [rotation, setRotation] = useState(-30);
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState(null);
  const [layer, setLayer] = useState('replication');
  const [motionPaused, setMotionPaused] = useState(false);

  const starting = !['ready', 'error'].includes(lab.startup);
  const nodes = cluster?.nodes ?? [];
  const count = nodes.length;
  const inspect = Math.max(0, Math.min(selected, count - 1));
  const node = nodes[inspect];
  const down = (index) => !!nodes[index] && !nodes[index].running;
  const selectedDown = down(inspect);
  const online = nodes.filter((n) => n.running && n.role === 'Voter').length;
  const alternative = nodes.find((n) => n.running && n.role === 'Voter');

  const partitions = (cluster?.partitions ?? [])
    .filter((p) => p.state !== 'Removed')
    .map((p) => {
      const leaders = nodes.filter((n) => n.running && n.leads.includes(p.id));
      return {...p, hosts: p.replicas.map((r) => r.index), leader: leaders.length === 1 ? leaders[0].index : null};
    });
  const leaderless = partitions.filter((p) => p.leader === null).length;
  const systemLeader = nodes.find((n) => n.running && n.leads.includes(0));
  const hosted = partitions.filter((p) => p.hosts.includes(inspect));
  const voters = cluster?.members?.filter((m) => m.role === 'Voter').length ?? 0;

  const status = !cluster
    ? busy ? 'Starting servers…' : 'Servers offline'
    : busy
      ? 'Operation in progress'
      : leaderless
        ? 'Electing leaders'
        : nodes.some((n) => !n.running)
          ? 'Degraded · every partition still has a leader'
          : 'Cluster healthy';

  const canResize = !!cluster && !busy && online === count;
  const resizeBlocked = !!cluster && !starting && online < count;

  function describePartition(id) {
    const part = partitions.find((p) => p.id === id);
    if (!part) return '';
    return part.leader === null ? 'no leader: electing' : `leader ${nodeName(part.leader)}`;
  }

  const blocked = !cluster
    ? null
    : selectedDown
      ? `${nodeName(inspect)} is down, so it cannot run scripts. Select a running server, or restart this one.`
      : node && node.role !== 'Voter'
        ? `${nodeName(inspect)} is still joining. Wait until it is a voter.`
        : null;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div>
          <p className={styles.brand}>KAHUNA <span>/</span> CLUSTER PLAYGROUND</p>
          <h1>A distributed key/value store you can break</h1>
          <p className={styles.lead}>
            Start a real {START_NODES}-server Kahuna cluster in this browser tab. Stop a leader and watch its
            partitions elect a new one. Add a server and watch the rebalancer move replicas to it. Run Kahuna
            scripts through any server while you do it.
          </p>
        </div>
      </header>
      <div className={styles.caption}>
        <span className={styles.badge}>REAL KAHUNA · WEBASSEMBLY</span>
        Raft, replica placement and the key/value store run in this tab · in-memory storage · nothing goes to a server
      </div>

      <SessionStatus lab={lab} starting={starting} online={online} />

      <div className={styles.workspace}>
        <section className={styles.scenePanel} aria-label="Cluster servers">
          <div className={styles.sceneTop}>
            <span className={leaderless ? styles.danger : styles.healthy}>● {status}</span>
            <span>RF {cluster?.replicationFactor ?? 3}<b>/</b>{partitions.length || 8} PARTITIONS</span>
          </div>
          <div className={styles.stats}>
            <div><small>RUNNING SERVERS</small><strong>{online}<span> / {count || START_NODES}</span></strong></div>
            <div><small>ROSTER VERSION</small><strong>{cluster?.membershipVersion ?? '—'}</strong></div>
            <div><small>PARTITIONS WITH A LEADER</small><strong>{partitions.length - leaderless}<span> / {partitions.length || 8}</span></strong></div>
            <div><small>SYSTEM LEADER</small><strong className={styles.mono}>{systemLeader ? nodeName(systemLeader.index) : '—'}</strong></div>
          </div>

          <div
            className={styles.scene}
            data-motion-paused={motionPaused}
            aria-label="Interactive 3D view of the servers"
            onPointerDown={(e) => {
              if (e.target.closest('button')) return;
              setDrag({x: e.clientX, rotation});
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (drag) setRotation(Math.max(-75, Math.min(30, drag.rotation + (e.clientX - drag.x) / 4)));
            }}
            onPointerUp={() => setDrag(null)}
            onPointerCancel={() => setDrag(null)}
            style={{'--orbit': `${rotation}deg`, '--counter-orbit': `${-rotation}deg`, '--zoom': zoom}}>
            <div className={styles.world}>
              <div className={styles.floor} />
              <svg className={styles.connections} viewBox="0 0 540 540" aria-hidden="true">
                {slots.filter((p) => p.id < count).flatMap((p) =>
                  layer === 'client'
                    ? (p.id === inspect ? [<path key={p.id} d={`M270 20 Q${p.x} 20 ${p.x + 30} ${p.y + 30}`} className={!down(p.id) ? styles.flow : undefined} />] : [])
                    : slots
                      .filter((q) => q.id > p.id && q.id < count && partitions.some((part) => part.hosts.includes(p.id) && part.hosts.includes(q.id)))
                      .map((q) => <path key={`${p.id}-${q.id}`} d={`M${p.x + 30} ${p.y + 30} L${q.x + 30} ${q.y + 30}`} className={!down(p.id) && !down(q.id) ? styles.flow : undefined} />),
                )}
              </svg>
              {slots.map((p) => {
                const n = nodes[p.id];
                const joining = lab.changingNode === p.id || (n?.running && n.role !== 'Voter');
                const preparing = starting && p.id < START_NODES;
                const visible = preparing || joining || p.id < count;
                const isDown = down(p.id) && !joining;
                const shown = partitions.length ? partitions : Array.from({length: 8}, (_, i) => ({id: i + 1, hosts: [], leader: null}));
                return (
                  <div key={p.id} className={styles.serverPosition} style={{left: p.x, top: p.y, '--bounce-delay': `${-p.id * 230}ms`}}>
                    {visible ? (
                      <>
                        {(joining || preparing) && <span className={styles.startingPad} aria-hidden="true" />}
                        <button
                          type="button"
                          className={[
                            styles.server,
                            inspect === p.id && !preparing && styles.selectedServer,
                            isDown && styles.failedServer,
                            joining && styles.joiningServer,
                            preparing && styles.preparingServer,
                            (joining || preparing) && styles.startingServer,
                          ].filter(Boolean).join(' ')}
                          style={{'--reveal-delay': `${p.id * 70}ms`}}
                          aria-label={joining ? `${nodeName(p.id)} is joining the cluster` : `Select ${nodeName(p.id)}`}
                          aria-pressed={inspect === p.id}
                          disabled={!cluster || joining || preparing}
                          onClick={() => setSelected(p.id)}>
                          <span className={styles.serverTop}>
                            <span>{preparing ? 'STARTING' : isDown ? 'DOWN' : joining ? 'JOINING' : inspect === p.id ? 'SELECTED' : 'KAHUNA'}</span>
                          </span>
                          <span className={styles.serverSide} />
                          <span className={styles.serverBack} />
                          <span className={styles.serverLeft} />
                          <span className={styles.serverFront}>
                            <span className={styles.serverName}>{nodeName(p.id)}</span>
                            {shown.map((part) => {
                              const role = preparing ? 'absent' : isDown ? 'offline' : part.leader === p.id ? 'leader' : part.hosts.includes(p.id) ? 'follower' : 'absent';
                              const label = `P${part.id}: ${role === 'absent' ? 'not hosted' : role}`;
                              return (
                                <span className={styles.drive} data-role={role} key={part.id} title={label} aria-label={label}>
                                  <i /><span>P{part.id}</span><b>{role === 'leader' ? 'L' : role === 'follower' ? 'F' : '–'}</b>
                                </span>
                              );
                            })}
                          </span>
                        </button>
                        {isDown && (
                          <div className={styles.fire} role="img" aria-label={`${nodeName(p.id)} is down`}>
                            <span className={styles.firePlume} aria-hidden="true">
                              {Array.from({length: 5}, (_, f) => (
                                <i className={styles.flame} key={`flame-${f}`} style={{'--offset': `${(f - 2) * 7}px`, '--height': `${[24, 37, 46, 31, 22][f]}px`, '--delay': `${-f * 0.17}s`, '--duration': `${0.32 + (f % 3) * 0.13}s`}} />
                              ))}
                              {Array.from({length: 9}, (_, s) => (
                                <i className={styles.ember} key={`ember-${s}`} style={{'--offset': `${((s * 7) % 30) - 15}px`, '--drift': `${((s % 3) - 1) * 12}px`, '--delay': `${-s * 0.23}s`, '--duration': `${1 + (s % 4) * 0.23}s`}} />
                              ))}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className={styles.expansion}>{p.id + 1}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.bladeLegend} aria-label="Partition colors">
            <span><i data-role="leader" /> Leader · L</span>
            <span><i data-role="follower" /> Follower · F</span>
            <span><i data-role="absent" /> Not hosted · –</span>
            <span><i data-role="offline" /> Down</span>
          </div>
          {lab.changingNode !== null && (
            <p className={styles.joiningNotice} role="status">
              <span className={styles.spinner} aria-hidden="true" />
              {nodeName(lab.changingNode)} is joining · it catches up before it serves requests
            </p>
          )}
          <div className={styles.sceneBottom}>
            <div className={styles.modes}>
              <button type="button" aria-pressed={layer === 'replication'} onClick={() => setLayer('replication')}>Replication</button>
              <button type="button" aria-pressed={layer === 'client'} onClick={() => setLayer('client')}>Client</button>
            </div>
            <div>
              <button type="button" aria-label="Rotate the scene left" onClick={() => setRotation((r) => Math.max(-75, r - 15))}>↶</button>
              <button type="button" aria-label="Rotate the scene right" onClick={() => setRotation((r) => Math.min(30, r + 15))}>↷</button>
              <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.8, z - 0.1))}>−</button>
              <button type="button" aria-label="Reset the camera" onClick={() => { setRotation(-30); setZoom(1); }}>⌖</button>
              <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.3, z + 0.1))}>+</button>
            </div>
            <button type="button" aria-pressed={motionPaused} onClick={() => setMotionPaused((paused) => !paused)}>
              {motionPaused ? 'Resume animation' : 'Pause animation'}
            </button>
          </div>
          <p className={styles.sceneNote}>
            {layer === 'client'
              ? 'The line shows where your next script goes. A server that does not lead a key’s partition forwards the work to the leader.'
              : 'A line joins two servers that hold replicas of the same partition. Placement and leadership come from the servers. Drag to orbit.'}
          </p>
        </section>

        <aside className={styles.sidebar}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <h2>Cluster size</h2>
              <span className={styles.healthy}>{count || START_NODES} servers</span>
            </div>
            <div className={styles.manual}>
              <button type="button" aria-label="Remove the last server" disabled={!canResize || count <= MIN_NODES} onClick={() => lab.resize(-1)}>− Remove</button>
              <span>{count || START_NODES} / {MAX_NODES}</span>
              <button type="button" aria-label="Add a server" disabled={!canResize || count >= MAX_NODES} onClick={() => lab.resize(1)}>+ Add</button>
            </div>
            {resizeBlocked && (
              <div className={styles.decision} role="status">
                <strong>Resizing is paused.</strong> Restart the stopped servers and wait for them to rejoin. The
                playground changes the roster only while every server is healthy.
              </div>
            )}
            <p className={styles.note}>
              A new server joins as a learner, catches up, and becomes a voter. Then the rebalancer moves
              replicas to it. Remove drains the last server before it leaves. The cluster keeps {MIN_NODES} to {MAX_NODES} servers.
            </p>
            {lab.error && <p className={styles.errorText} role="alert">{lab.error}</p>}
            <button type="button" className={styles.resetButton} disabled={busy} onClick={() => { setSelected(0); lab.start(); }}>
              Reset the cluster
            </button>
          </section>

          <section className={`${styles.panel} ${styles.selectedPanel}`} data-down={selectedDown || undefined} aria-label="Selected server">
            <div className={styles.panelTitle}>
              <div>
                <span className={styles.selectedBadge}>Selected server</span>
                <h2>{nodeName(inspect)}</h2>
              </div>
              <span className={selectedDown ? styles.danger : styles.healthy}>{node?.role ?? (busy ? 'Starting' : 'Offline')}</span>
            </div>
            <dl>
              <div><dt>Endpoint</dt><dd>{node?.endpoint ?? '—'}</dd></div>
              <div><dt>Storage</dt><dd>In-memory store + Raft log</dd></div>
              <div><dt>Roster</dt><dd>{voters} voters · v{cluster?.membershipVersion ?? 0}</dd></div>
              <div><dt>Replicas hosted</dt><dd>{hosted.length} / {partitions.length} partitions</dd></div>
              <div><dt>Partitions led</dt><dd>{partitions.filter((p) => p.leader === inspect).length}{node?.leads.includes(0) ? ' + system partition' : ''}</dd></div>
            </dl>
            <div className={styles.partitionGrid}>
              {partitions.map((p) => (
                <span
                  key={p.id}
                  className={p.hosts.includes(inspect) ? (p.leader === inspect ? styles.leader : styles.replica) : styles.absent}
                  title={`P${p.id}: replicas ${p.hosts.map(nodeName).join(', ')}; ${p.leader === null ? 'no leader' : `leader ${nodeName(p.leader)}`}`}>
                  P{p.id}
                </span>
              ))}
            </div>
            <p className={styles.legend}><i /> Leader <i /> Follower <i /> Not hosted</p>
            <button
              type="button"
              className={selectedDown ? styles.recover : styles.fault}
              disabled={busy || !cluster || (node && node.running && node.role !== 'Voter')}
              onClick={() => lab.toggleNode(inspect)}>
              {selectedDown ? `Restart ${nodeName(inspect)}` : `Stop ${nodeName(inspect)}`}
            </button>
            {selectedDown && alternative && (
              <button type="button" className={styles.secondaryWide} onClick={() => setSelected(alternative.index)}>
                Select {nodeName(alternative.index)}
              </button>
            )}
            <p className={styles.note}>
              Stop simulates a crash. The partitions the server led elect new leaders from their other
              replicas. A partition that loses two of its three replicas has no majority, so it cannot elect a
              leader or accept writes. A restarted server comes back empty and catches up from its peers.
            </p>
          </section>
        </aside>
      </div>

      <section className={styles.consoleSection} aria-label="Kahuna Script console">
        <div className={styles.consoleTitle}>
          <h2>Kahuna Script console</h2>
          <span>Scripts run on the selected server. Each script is one transaction.</span>
        </div>
        <ScriptConsole
          ready={lab.startup === 'ready' && !!cluster}
          busy={busy}
          blocked={blocked}
          target={cluster ? nodeName(inspect) : null}
          onRun={(script, parametersJson) => lab.run(inspect, script, parametersJson)}
          describePartition={describePartition}
          loadingText="The cluster is starting. You can choose an example while you wait."
          toolbar={cluster && (
            <label className={styles.targetPicker}>
              <span>Server</span>
              <select value={inspect} onChange={(e) => setSelected(Number(e.target.value))}>
                {nodes.map((n) => (
                  <option key={n.index} value={n.index}>{nodeName(n.index)}{n.running ? '' : ' (down)'}</option>
                ))}
              </select>
            </label>
          )}
        />
      </section>

      <section className={styles.eventPanel} aria-label="Cluster journal">
        <div className={styles.panelTitle}>
          <h2>Cluster journal <span>/ LIVE</span></h2>
        </div>
        <div className={styles.events} role="log" aria-live="polite">
          {lab.events.length ? (
            lab.events.map((e) => (
              <div key={e.id}>
                <span>{formatTime(e.at)}</span>
                <span>{e.text}</span>
              </div>
            ))
          ) : (
            <p>Roster, leader and replica changes appear here.</p>
          )}
        </div>
      </section>

      <footer className={styles.footer}>
        <span>
          Real Kahuna and Raft, compiled to WebAssembly, with in-memory transport and storage. Animations show
          the topology, not measured traffic. Data resets on reload.
        </span>
        <span>
          <Link to="/docs/architecture/raft/">How Raft works in Kahuna</Link> ·{' '}
          <Link to="/docs/replica-placement/">Replica placement</Link>
        </span>
      </footer>
    </div>
  );
}
