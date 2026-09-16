import React, {useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

// Small, concrete examples of persistent locks, key/value operations, and sequences.
const clusterNodes = [
  ['appA', 'App node A', 'Your application', 20, 65],
  ['appB', 'App node B', 'Your application', 20, 285],
  ['leader', 'Kahuna 1', 'Leader · handles this key', 260, 175],
  ['copyA', 'Kahuna 2', 'Replica · keeps a copy', 500, 65],
  ['copyB', 'Kahuna 3', 'Replica · keeps a copy', 500, 285],
];
const nodeRoles = {appA: 'app', appB: 'app', app: 'app', leader: 'leader', copyA: 'replica', copyB: 'replica', counter: 'sequence', requests: 'replica'};
const clusterPositions = [[20, 20], [220, 20], [120, 200], [20, 380], [220, 380]];
const stories = [
  {
    id: 'locks', label: 'Locking', title: 'Two apps. One lock. One winner.',
    intro: 'Both app nodes want to process the same invoice. A lock lets only one own the job at a time.',
    takeaway: 'The lock’s owner is copied across Kahuna servers. Both apps get an answer from the same leader.',
    link: '/docs/distributed-locks', linkLabel: 'Learn about locks',
    nodes: clusterNodes, positions: clusterPositions,
    steps: [
      {title: 'Both apps ask for the same lock', text: 'App A and App B both ask to lock “invoice-2048”. Their requests reach the Kahuna server in charge of that lock: its leader.', active: ['appA', 'appB', 'leader'], messages: [['appA', 'leader', 'Lock invoice-2048'], ['appB', 'leader', 'Lock invoice-2048']], values: ['Asking for lock', 'Asking for lock', 'Lock is free', 'Lock is free', 'Lock is free'], code: 'Same lock: invoice-2048'},
      {title: 'Kahuna copies the winning claim', text: 'In this example, A’s request is handled first. The leader copies “owner = A” to the replicas before confirming the lock.', active: ['leader', 'copyA', 'copyB'], messages: [['leader', 'copyA', 'Save owner = A'], ['leader', 'copyB', 'Save owner = A']], values: ['Waiting for reply', 'Waiting for reply', 'Saving owner: A', 'Saving owner: A', 'Saving owner: A'], code: 'The leader and at least one replica must save the claim.'},
      {title: 'A gets the lock. B gets “busy”.', text: 'Once the claim is safely replicated, A gets “acquired” and starts work. B gets “busy” because A already owns this lock.', active: ['appA', 'appB', 'leader'], messages: [['leader', 'appA', 'Acquired ✓'], ['leader', 'appB', 'Busy · try later']], values: ['Acquired ✓', 'Busy · try later', 'Owner: A', 'Owner: A', 'Owner: A'], code: 'A processes the invoice. B does not.'},
      {title: 'A finishes and releases the lock', text: 'A finishes its work and releases the lock. Kahuna replicates that change too, so the lock becomes available again.', active: ['appA', 'leader', 'copyA', 'copyB'], messages: [['appA', 'leader', 'Release lock'], ['leader', 'copyA', 'Save: free'], ['leader', 'copyB', 'Save: free']], values: ['Finished', 'Can retry', 'Lock is free', 'Lock is free', 'Lock is free'], code: 'The lock is available for its next owner.'},
      {title: 'B retries and becomes the owner', text: 'B asks again. With A’s lock released, Kahuna can save and replicate B’s claim, then tell B that it acquired the lock.', active: ['appB', 'leader', 'copyA', 'copyB'], messages: [['appB', 'leader', 'Try lock again'], ['leader', 'copyA', 'Save owner = B'], ['leader', 'copyB', 'Save owner = B']], values: ['Finished', 'Waiting for reply', 'Saving owner: B', 'Saving owner: B', 'Saving owner: B'], code: 'A new owner is confirmed only after replication.'},
      {title: 'Now B has the lock', text: 'B receives “acquired”. Ownership has moved from A to B, and the Kahuna replicas keep the same lock state.', active: ['appB', 'leader'], messages: [['leader', 'appB', 'Acquired ✓']], values: ['Finished', 'Acquired ✓', 'Owner: B', 'Owner: B', 'Owner: B'], code: 'One lock owner at a time.'},
    ],
  },
  {
    id: 'keyvalue', label: 'Key/value store', title: 'Save a value. Read it from another app.',
    intro: 'App A saves a color. App B asks for that same key through a different Kahuna server.',
    takeaway: 'SET saves a value with copies on other servers. GET reaches the leader for that same key to read it.',
    link: '/docs/distributed-keyvalue-store', linkLabel: 'Learn about the key/value store',
    nodes: clusterNodes, positions: clusterPositions,
    steps: [
      {title: 'A saves “color = mint”', text: 'App A sends SET color = “mint” to the leader for the key “color”. SET means “save this value under this name”.', active: ['appA', 'leader'], messages: [['appA', 'leader', 'SET color = mint']], values: ['SET color', 'Ready to read', 'Receiving SET', 'No value yet', 'No value yet'], code: 'Key: color     Value: mint'},
      {title: 'Kahuna replicates the value', text: 'The leader sends the write to the other Kahuna servers. It waits until a majority has saved it: at least two of these three servers.', active: ['leader', 'copyA', 'copyB'], messages: [['leader', 'copyA', 'Save color = mint'], ['leader', 'copyB', 'Save color = mint']], values: ['Waiting for reply', 'Ready to read', 'Saving: mint', 'Saving: mint', 'Saving: mint'], code: 'Replication means keeping copies on other servers.'},
      {title: 'A gets “saved”', text: 'The write is committed and A receives success. In this example, both replicas have caught up and also hold “mint”.', active: ['appA', 'leader'], messages: [['leader', 'appA', 'Saved ✓']], values: ['Saved ✓', 'Ready to read', 'color = mint', 'color = mint', 'color = mint'], code: 'SET complete. The value is now available to read.'},
      {title: 'B asks a different server', text: 'App B sends GET color to Kahuna 3. GET means “read the value stored under this name”. B can connect to a different server than A.', active: ['appB', 'copyB'], messages: [['appB', 'copyB', 'GET color']], values: ['Saved ✓', 'GET color', 'color = mint', 'color = mint', 'Received GET'], code: 'B asks for the exact same key: color.'},
      {title: 'That server asks the leader', text: 'Kahuna 3 forwards the GET to Kahuna 1, the leader for “color”. The leader handles this read so B gets the current value.', active: ['copyB', 'leader'], messages: [['copyB', 'leader', 'Forward GET color']], values: ['Saved ✓', 'Waiting for reply', 'Read: mint', 'color = mint', 'Asking leader'], code: 'Same key → same leader, even through a different server.'},
      {title: 'B receives “mint”', text: 'The leader returns “mint” through Kahuna 3 to App B. That is the value A saved with SET.', active: ['leader', 'copyB', 'appB'], messages: [['leader', 'copyB', 'Value: mint'], ['copyB', 'appB', 'Value: mint']], values: ['Saved ✓', 'Received: mint', 'color = mint', 'color = mint', 'color = mint'], code: 'SET color = mint   →   GET color returns mint'},
    ],
  },
  {
    id: 'sequences', label: 'Sequences', title: 'New request, next ID. Retry, same ID.',
    intro: 'An invoice sequence starts at 20 and increases by 1. A request key lets Kahuna recognize a retry.',
    takeaway: 'An idempotency key is a name for one request. Reusing it returns the saved result instead of consuming another ID.',
    link: '/docs/tutorials/distributed-sequencer', linkLabel: 'Learn about sequences',
    nodes: [['app', 'Your app', 'Creates invoices', 20, 175], ['counter', 'Invoice sequence', 'Increases by 1', 260, 175], ['requests', 'Saved requests', 'Remembered results', 500, 175]],
    positions: [[120, 20], [120, 200], [120, 380]],
    steps: [
      {title: 'Ask for an invoice number', text: 'Your app asks for the next number and labels this request “order-A”. The sequence currently holds 20.', active: ['app', 'counter'], messages: [['app', 'counter', 'Next ID · order-A']], values: ['Request: order-A', 'Current: 20', 'No saved requests'], code: 'Sequence: invoices     Request key: order-A'},
      {title: 'Increase 20 to 21 and remember it', text: 'Kahuna increases the sequence to 21 and saves “order-A → 21” with the sequence state. The number and its request key are stored together.', active: ['counter', 'requests'], messages: [['counter', 'requests', 'Remember order-A = 21']], values: ['Waiting for reply', '20 → 21', 'order-A → 21'], code: 'Current value: 21     Saved result: order-A → 21'},
      {title: 'Return ID 21', text: 'The app receives 21 and can use it as the invoice number. Kahuna remembers which request received that number.', active: ['counter', 'app'], messages: [['counter', 'app', 'Your ID: 21']], values: ['Received ID: 21', 'Current: 21', 'order-A → 21'], code: 'First answer for order-A: 21'},
      {title: 'Retry with the same request key', text: 'The app sends the request again with “order-A”. Kahuna checks the saved requests and finds that this one already received 21.', active: ['app', 'counter', 'requests'], messages: [['app', 'counter', 'Next ID · order-A'], ['counter', 'requests', 'Look up order-A']], values: ['Retry: order-A', 'Still: 21', 'Found: order-A → 21'], code: 'Same request key. No increment.'},
      {title: 'Return 21 again, not 22', text: 'Kahuna returns the saved result, 21. The sequence stays at 21. This is idempotency: repeating the same request does not allocate another number.', active: ['requests', 'counter', 'app'], messages: [['requests', 'counter', 'Saved ID: 21'], ['counter', 'app', 'Your ID: 21 again']], values: ['Received ID: 21', 'Still: 21', 'order-A → 21'], code: 'First answer: 21     Retry answer: 21'},
      {title: 'A new request gets 22', text: 'The next invoice uses a different request key, “order-B”. Kahuna increases the sequence to 22, saves that result, and returns the new ID.', active: ['app', 'counter', 'requests'], messages: [['app', 'counter', 'Next ID · order-B'], ['counter', 'requests', 'Remember order-B = 22']], values: ['Received ID: 22', '21 → 22', 'A → 21 · B → 22'], code: 'New request key: order-B     New ID: 22'},
    ],
  },
];

function Diagram({story, step, compact = false}) {
  const layout = story.nodes.map((node, index) => compact ? [...node.slice(0, 3), ...story.positions[index]] : node);
  const nodes = Object.fromEntries(layout.map(([id, , , x, y]) => [id, {x: x + 90, y: y + 52}]));
  const markerId = `${story.id}-${compact ? 'small' : 'wide'}-arrow`;
  return (
    <svg className={styles.diagram} viewBox={compact ? '0 0 420 510' : '0 0 700 440'} role="img" aria-label={`${story.label}: ${step.title}. ${step.text}`}>
      <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#53e9ab" /></marker></defs>
      <g aria-hidden="true">
        {step.messages.map(([from, to, label], index) => {
          const a = nodes[from];
          const b = nodes[to];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          // Clip each line to the card edges so its arrowhead stays visible.
          const scale = Math.min(dx ? 96 / Math.abs(dx) : Infinity, dy ? 58 / Math.abs(dy) : Infinity);
          const d = `M ${a.x + dx * scale} ${a.y + dy * scale} L ${b.x - dx * scale} ${b.y - dy * scale}`;
          return <g key={`${from}-${to}`}><path d={d} className={styles.wire} markerEnd={`url(#${markerId})`} /><path d={d} className={styles.signal} /><title>{label}</title></g>;
        })}
        {layout.map(([id, title, subtitle, x, y], index) => (
          <g key={id} data-role={nodeRoles[id]} transform={`translate(${x} ${y})`} className={clsx(styles.node, step.active.includes(id) && styles.activeNode)}>
            <rect width="180" height="104" rx="14" />
            <circle cx="18" cy="22" r="4" />
            <text x="31" y="27" className={styles.nodeTitle}>{title}</text>
            <text x="18" y="49" className={styles.nodeSubtitle}>{subtitle}</text>
            <text x="18" y="83" className={styles.nodeValue}>{step.values[index]}</text>
          </g>
        ))}
        <text x="20" y={compact ? 504 : 428} className={styles.diagramNote}>{story.id === 'sequences' ? 'SAVED REQUESTS ARE PART OF THE SEQUENCE STATE' : 'TWO APP NODES · THREE KAHUNA SERVERS'}</text>
      </g>
    </svg>
  );
}

export default function InternalsExplorer() {
  const [storyIndex, setStoryIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [compact, setCompact] = useState(false);
  const sectionRef = useRef(null);
  const story = stories[storyIndex];
  const step = story.steps[stepIndex];

  useEffect(() => {
    const viewport = window.matchMedia('(max-width: 540px)');
    const onViewport = () => setCompact(viewport.matches);
    onViewport();
    viewport.addEventListener('change', onViewport);
    return () => viewport.removeEventListener('change', onViewport);
  }, []);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPlaying(!motion.matches);
    const onMotion = () => setPlaying(!motion.matches);
    const onVisibility = () => setPageVisible(!document.hidden);
    motion.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {threshold: 0.2});
    observer.observe(sectionRef.current);
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!playing || !visible || !pageVisible) return undefined;
    const timer = window.setTimeout(() => {
      if (stepIndex === story.steps.length - 1) setPlaying(false);
      else setStepIndex((index) => index + 1);
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [playing, visible, pageVisible, stepIndex, storyIndex, story.steps.length]);

  function selectStep(index) {
    setPlaying(false);
    setStepIndex(index);
  }

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="inside-kahuna">
      <div className="container">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Inside Kahuna</p>
          <Heading as="h2" id="inside-kahuna">Coordination, in motion.</Heading>
          <p>Start with three everyday tasks: claim a job, save a value, and get the next invoice number. Follow each request to see what Kahuna does.</p>
        </div>
        <div className={styles.explorer}>
          <div className={styles.topbar}>
            <div className={styles.choices} role="group" aria-label="Choose an animation">
              {stories.map((item, index) => <button type="button" key={item.id} aria-pressed={index === storyIndex} onClick={() => {setStoryIndex(index); setStepIndex(0); setPlaying(false);}}><span>0{index + 1}</span>{item.label}</button>)}
            </div>
            <span className={styles.exampleLabel}>INTERACTIVE WALKTHROUGH</span>
          </div>
          <div className={styles.body}>
            <div className={styles.visual} data-running={playing && visible && pageVisible}>
              <div className={styles.visualHeader}><span className={styles.statusDot} />STEP {stepIndex + 1} OF {story.steps.length}<span className={styles.sceneName}>{story.label}</span></div>
              <div className={styles.sceneCaption} aria-live={playing ? 'off' : 'polite'} aria-atomic="true">
                <Heading as="h4">{step.title}</Heading>
                <p>{step.text}</p>
              </div>
              <Diagram story={story} step={step} compact={compact} />
              <ul className={styles.messages} aria-label="Messages in this step">
                {step.messages.map(([from, to, label]) => <li key={`${from}-${to}`}><span>{story.nodes.find(([id]) => id === from)[1]} → {story.nodes.find(([id]) => id === to)[1]}</span><strong>{label}</strong></li>)}
              </ul>
              <div className={styles.console}><span aria-hidden="true">›</span><code>{step.code}</code></div>
            </div>
            <div className={styles.narrative}>
              <Heading as="h3">{story.title}</Heading>
              <p className={styles.intro}>{story.intro}</p>
              <ol className={styles.steps}>
                {story.steps.map((item, index) => <li key={item.title}><button type="button" aria-current={index === stepIndex ? 'step' : undefined} onClick={() => selectStep(index)}><span className={styles.stepNumber}>{index < stepIndex ? '✓' : index + 1}</span>{item.title}</button></li>)}
              </ol>
              <p className={styles.description}>{story.takeaway}</p>
              <Link className={styles.docsLink} to={story.link}>{story.linkLabel} <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
          <div className={styles.controls}>
            <button type="button" className={styles.playButton} onClick={() => {if (!playing && stepIndex === story.steps.length - 1) setStepIndex(0); setPlaying(!playing);}}><span aria-hidden="true">{playing ? 'Ⅱ' : '▷'}</span>{playing ? 'Pause' : stepIndex === story.steps.length - 1 ? 'Replay' : 'Play'}</button>
            <span className={styles.counter}>Step {stepIndex + 1} of {story.steps.length}</span>
            <div className={styles.progress} aria-hidden="true">{story.steps.map((item, index) => <span key={item.title} data-complete={index <= stepIndex} />)}</div>
            <button type="button" disabled={stepIndex === 0} onClick={() => selectStep(stepIndex - 1)} aria-label="Previous step">←</button>
            <button type="button" disabled={stepIndex === story.steps.length - 1} onClick={() => selectStep(stepIndex + 1)} aria-label="Next step">→</button>
          </div>
        </div>
      </div>
    </section>
  );
}
