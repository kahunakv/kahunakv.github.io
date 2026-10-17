import clsx from 'clsx';
import {useEffect, useMemo, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {examples, parseParameters, seedScript} from './examples.mjs';
import {loadEngine} from './runtime';
import styles from './styles.module.css';

const keywords = new Set([
  'AND', 'AS', 'AT', 'BEGIN', 'BUCKET', 'BY', 'CASE', 'CMP', 'CMPREV', 'COMMIT', 'DO', 'ELSE',
  'END', 'EX', 'FOR', 'FOUND', 'IF', 'IN', 'LET', 'NOREV', 'NOT', 'NX', 'OF', 'OR', 'PREFIX',
  'RETURN', 'ROLLBACK', 'SLEEP', 'SWITCH', 'THEN', 'THROW', 'XX',
]);
const commands = new Set([
  'DEL', 'DELETE', 'EDEL', 'EDELETE', 'EEXISTS', 'EEXTEND', 'EGET', 'ESCAN', 'ESET', 'EXISTS',
  'EXTEND', 'GET', 'SCAN', 'SET',
]);
const constants = new Set(['TRUE', 'FALSE', 'NULL']);

function readQuoted(code, start) {
  const quote = code[start];
  let index = start + 1;
  while (index < code.length) {
    if (code[index] === '\\') {
      index += 2;
      continue;
    }
    if (code[index] === quote) return index + 1;
    if (quote === '`' && code[index] === '\n') return index;
    index += 1;
  }
  return index;
}

function tokenize(code) {
  const tokens = [];
  let index = 0;

  while (index < code.length) {
    const char = code[index];
    const rest = code.slice(index);

    if (char === "'" || char === '"' || char === '`') {
      const next = readQuoted(code, index);
      tokens.push({kind: char === '`' ? 'key' : 'string', value: code.slice(index, next)});
      index = next;
      continue;
    }

    const placeholder = /^@[A-Za-z0-9_]+/.exec(rest);
    if (placeholder) {
      tokens.push({kind: 'placeholder', value: placeholder[0]});
      index += placeholder[0].length;
      continue;
    }

    const number = /^(?:0x[0-9a-f]+|\d+(?:\.\d+)?)/i.exec(rest);
    if (number && !/[A-Za-z0-9_]/.test(code[index - 1] ?? '')) {
      tokens.push({kind: 'number', value: number[0]});
      index += number[0].length;
      continue;
    }

    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (word) {
      const value = word[0];
      const upper = value.toUpperCase();
      let kind = 'plain';
      if (commands.has(upper)) kind = 'command';
      else if (keywords.has(upper)) kind = 'keyword';
      else if (constants.has(upper)) kind = 'constant';
      else if (code.slice(index + value.length).trimStart().startsWith('(')) kind = 'function';
      tokens.push({kind, value});
      index += value.length;
      continue;
    }

    const operator = /^(?:\.\.|==|!=|<>|<=|>=|&&|\|\||[-+*/%=<>!])/.exec(rest);
    if (operator) {
      tokens.push({kind: 'operator', value: operator[0]});
      index += operator[0].length;
      continue;
    }

    tokens.push({kind: 'plain', value: char});
    index += 1;
  }

  return tokens;
}

function Highlighted({code, highlightRef}) {
  const tokens = useMemo(() => tokenize(code), [code]);
  return (
    <pre className={styles.highlightLayer} aria-hidden="true">
      <code ref={highlightRef}>
        {tokens.map((token, index) =>
          token.kind === 'plain' ? token.value : (
            <span className={styles[token.kind]} key={index}>{token.value}</span>
          ),
        )}
        {'\n'}
      </code>
    </pre>
  );
}

function LineNumbers({code, lineNumbersRef}) {
  const count = useMemo(() => code.split('\n').length, [code]);
  return (
    <div className={styles.lineNumbers} aria-hidden="true">
      <div ref={lineNumbersRef}>
        {Array.from({length: count}, (_, index) => <span key={index}>{index + 1}</span>)}
      </div>
    </div>
  );
}

function formatMs(value) {
  return value < 10 ? value.toFixed(1) : Math.round(value);
}

function formatExpires(expires, now) {
  if (!expires) return '—';
  const seconds = Math.round((expires - now) / 1000);
  if (seconds <= 0) return 'expired';
  return seconds < 120 ? `in ${seconds} s` : `in ${Math.round(seconds / 60)} min`;
}

function Status({state, text}) {
  return (
    <div className={styles.status} data-state={state} role="status" aria-live="polite">
      <span className={styles.statusDot} aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

function ValueCell({value}) {
  if (value === null || value === undefined) return <td className={styles.nullValue}>null</td>;
  if (value === '') return <td className={styles.nullValue}>(empty)</td>;
  return <td className={styles.valueCell}>{value}</td>;
}

function ValuesTable({values, now}) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th className={styles.num}>Revision</th>
            <th>Expires</th>
          </tr>
        </thead>
        <tbody>
          {values.map((value, index) => (
            <tr key={`${value.key}-${index}`}>
              <td className={styles.keyCell}>{value.key ?? '—'}</td>
              <ValueCell value={value.value} />
              <td className={styles.num}>{value.revision >= 0 ? value.revision : '—'}</td>
              <td>{formatExpires(value.expires, now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultCard({run}) {
  const {outcome} = run;
  const values = outcome.values ?? [];
  const returned = values.length === 1 && values[0].key === null;
  // A write answers with the key and its new revision, but no value.
  const writes = outcome.type !== 'Get' && values.length > 0 && values.every((value) => value.value === null);

  let body;
  if (!outcome.ok) {
    body = <p className={styles.errorText}>{outcome.reason ?? 'The script failed.'}</p>;
  } else if (returned) {
    body = (
      <p className={styles.returnValue}>
        <span>return</span>
        {values[0].value ?? 'null'}
      </p>
    );
  } else if (writes) {
    body = (
      <ul className={styles.writeList}>
        {values.map((value, index) => (
          <li key={`${value.key}-${index}`}>
            <span className={styles.keyCell}>{value.key ?? '—'}</span>
            {value.revision >= 0 && <span>revision {value.revision}</span>}
          </li>
        ))}
      </ul>
    );
  } else if (values.length) {
    body = <ValuesTable values={values} now={run.at} />;
  } else {
    body = <p className={styles.empty}>No values returned.</p>;
  }

  return (
    <article className={clsx(styles.resultCard, !outcome.ok && styles.failed)}>
      <header>
        <code>{run.script}</code>
        <span>
          <strong className={styles.typeBadge} data-ok={outcome.ok}>{outcome.type}</strong>
          {' · '}
          {formatMs(outcome.ms ?? 0)} ms
        </span>
      </header>
      {body}
    </article>
  );
}

function StoreTable({keys, now}) {
  if (!keys.length) return <p className={styles.empty}>The store is empty.</p>;
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th className={styles.num}>Revision</th>
            <th>Expires</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((entry) => (
            <tr key={`${entry.durability}-${entry.key}`}>
              <td className={styles.keyCell}>
                {entry.key}
                {entry.durability === 'ephemeral' && <span className={styles.ephemeral}>ephemeral</span>}
              </td>
              <ValueCell value={entry.value} />
              <td className={styles.num}>{entry.revision}</td>
              <td>{formatExpires(entry.expires, now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function KahunaPlayground() {
  const dotnetUrl = useBaseUrl('/playground-engine/_framework/dotnet.js');
  const [engine, setEngine] = useState(null);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState({state: 'loading', text: 'Loading the engine...'});
  const [example, setExample] = useState(examples[0]);
  const [script, setScript] = useState(examples[0].script);
  const [parameters, setParameters] = useState(examples[0].parameters ?? '');
  const [lastRun, setLastRun] = useState(null);
  const [keys, setKeys] = useState([]);
  const [tab, setTab] = useState('output');
  const [runKey, setRunKey] = useState('Ctrl Enter');
  const [hasSelection, setHasSelection] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const lineNumbersRef = useRef(null);

  // Expiration times count down while a key with a TTL is in the store.
  useEffect(() => {
    if (!keys.some((entry) => entry.expires)) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [keys]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        if (/Mac|iPhone|iPad/.test(navigator.platform)) setRunKey('⌘ Enter');

        const playground = await loadEngine(dotnetUrl, (loaded, total) => {
          if (!cancelled) setStatus({state: 'loading', text: `Downloading the engine... ${loaded}/${total}`});
        });
        if (cancelled) return;

        setStatus({state: 'loading', text: 'Electing a leader...'});
        await playground.InitAsync();
        await playground.ResetAsync();
        await seed(playground);

        if (!cancelled) {
          setKeys(JSON.parse(await playground.KeysAsync()));
          setNow(Date.now());
          setEngine(playground);
          setBusy(false);
          setStatus({state: 'ready', text: 'Ready'});
        }
      } catch (error) {
        if (!cancelled) {
          setBusy(false);
          setStatus({state: 'error', text: `The engine could not start: ${error.message}`});
        }
      }
    }

    start();
    return () => {
      cancelled = true;
    };
  }, [dotnetUrl]);

  async function seed(playground) {
    const outcome = JSON.parse(await playground.ExecuteAsync(seedScript.trim(), null));
    if (!outcome.ok) throw new Error(`the sample data did not load (${outcome.type}: ${outcome.reason})`);
  }

  async function refreshKeys() {
    setKeys(JSON.parse(await engine.KeysAsync()));
    setNow(Date.now());
  }

  async function run(source = script) {
    const code = source.trim();
    if (!engine || busy || !code) return;

    setBusy(true);
    setStatus({state: 'loading', text: 'Running...'});
    try {
      let parametersJson = null;
      try {
        const parsed = parseParameters(parameters);
        if (Object.keys(parsed).length) parametersJson = JSON.stringify(parsed);
      } catch (error) {
        setStatus({state: 'error', text: error.message});
        return;
      }

      const outcome = JSON.parse(await engine.ExecuteAsync(code, parametersJson));
      // Each run replaces the previous result, so the panel always shows the script just run.
      setLastRun({script: code, outcome, at: Date.now()});
      setTab('output');
      await refreshKeys();
      setStatus(outcome.ok ? {state: 'ready', text: 'Ready'} : {state: 'error', text: `The script failed: ${outcome.type}`});
    } catch (error) {
      setStatus({state: 'error', text: `Engine error: ${error.message}`});
    } finally {
      setBusy(false);
    }
  }

  function selectedScript() {
    const target = textareaRef.current;
    if (!target) return '';
    return script.slice(target.selectionStart, target.selectionEnd).trim();
  }

  async function reset() {
    if (!engine || busy) return;

    setBusy(true);
    setStatus({state: 'loading', text: 'Resetting...'});
    try {
      await engine.ResetAsync();
      await seed(engine);
      await refreshKeys();
      setLastRun(null);
      setStatus({state: 'ready', text: 'Ready'});
    } catch (error) {
      setStatus({state: 'error', text: `Reset failed: ${error.message}`});
    } finally {
      setBusy(false);
    }
  }

  function chooseExample(next) {
    setExample(next);
    setScript(next.script);
    setParameters(next.parameters ?? '');
    setHasSelection(false);
    textareaRef.current?.focus();
  }

  function syncScroll(target) {
    if (highlightRef.current) {
      highlightRef.current.style.transform = `translate(${-target.scrollLeft}px, ${-target.scrollTop}px)`;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.style.transform = `translateY(${-target.scrollTop}px)`;
    }
  }

  function updateSelection(target) {
    setHasSelection(target.selectionStart !== target.selectionEnd);
  }

  return (
    <section className={styles.playground}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Kahuna Script · WebAssembly</p>
          <h1>Kahuna playground</h1>
          <p>
            Run Kahuna scripts against a real Kahuna node in this browser tab: the script parser,
            the transaction coordinator, the Raft log and the key/value store. Nothing goes to a
            server.
          </p>
        </div>
        <Status state={status.state} text={status.text} />
      </div>

      <div className={styles.shell}>
        <div className={styles.editorPane}>
          <div className={styles.exampleBar} aria-label="Example scripts">
            {examples.map((item) => (
              <button
                key={item.label}
                type="button"
                className={clsx(item === example && styles.activeExample)}
                onClick={() => chooseExample(item)}>
                {item.label}
              </button>
            ))}
          </div>

          {example?.description && example.script === script && (
            <p className={styles.exampleDescription}>{example.description}</p>
          )}

          <label className={styles.visuallyHidden} htmlFor="kahuna-playground-script">
            Kahuna script
          </label>
          <div className={styles.editorWrap}>
            <LineNumbers code={script} lineNumbersRef={lineNumbersRef} />
            <Highlighted code={script} highlightRef={highlightRef} />
            <textarea
              ref={textareaRef}
              id="kahuna-playground-script"
              value={script}
              wrap="off"
              spellCheck="false"
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              onChange={(event) => {
                setScript(event.target.value);
                updateSelection(event.currentTarget);
              }}
              onScroll={(event) => syncScroll(event.currentTarget)}
              onSelect={(event) => updateSelection(event.currentTarget)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault();
                  run(event.shiftKey ? selectedScript() : script);
                }
              }}
            />
          </div>

          <details className={styles.parameters} open={Boolean(parameters)}>
            <summary>
              Parameters
              <span>one <code>@name = value</code> pair per line</span>
            </summary>
            <textarea
              aria-label="Script parameters"
              value={parameters}
              rows={3}
              spellCheck="false"
              placeholder="@limit = 10"
              onChange={(event) => setParameters(event.target.value)}
            />
          </details>

          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => run()}
              disabled={!engine || busy || !script.trim()}>
              Run <kbd>{runKey}</kbd>
            </button>
            <button
              type="button"
              onClick={() => run(selectedScript())}
              disabled={!engine || busy || !hasSelection}>
              Run selected <kbd>Shift {runKey}</kbd>
            </button>
            <button type="button" onClick={reset} disabled={!engine || busy}>
              Reset data
            </button>
            <Link className={styles.docsLink} to="/docs/scripts">
              Script reference
            </Link>
          </div>
        </div>

        <div className={styles.resultsPane}>
          <div className={styles.tabs} role="tablist" aria-label="Results">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'output'}
              onClick={() => setTab('output')}>
              Output
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'store'}
              onClick={() => setTab('store')}>
              Store <span>{keys.length}</span>
            </button>
            {tab === 'output' && lastRun && (
              <button type="button" className={styles.clearButton} onClick={() => setLastRun(null)}>
                Clear output
              </button>
            )}
          </div>

          <div className={styles.tabPanel} role="tabpanel">
            {tab === 'store' ? (
              <StoreTable keys={keys} now={now} />
            ) : lastRun ? (
              <ResultCard run={lastRun} />
            ) : (
              <p className={styles.empty}>
                {engine
                  ? 'Run a script to see its result here. Each run is one transaction.'
                  : 'The engine is loading. The first visit downloads the WebAssembly runtime.'}
              </p>
            )}
          </div>
        </div>
      </div>

      <p className={styles.note}>
        A single in-memory Kahuna node compiled to WebAssembly. The data stays in this tab, and a
        reload starts again from the sample data.
      </p>
    </section>
  );
}
