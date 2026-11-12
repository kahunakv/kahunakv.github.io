// The Kahuna Script console of the playground: example scripts, a highlighted editor, parameters
// and result cards. The cluster playground (src/components/ClusterPlayground) gives it a function
// that runs a script on the selected server.
import clsx from 'clsx';
import {useEffect, useMemo, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import {examples, parseParameters} from './examples.mjs';
import styles from './styles.module.css';

// Keep these lists in sync with the Prism grammar in src/theme/prism-include-languages.js.
const keywords = new Set([
  'AS', 'AT', 'BEGIN', 'BUCKET', 'BY', 'CASE', 'CMP', 'CMPREV', 'COMMIT', 'DO', 'ELSE',
  'END', 'EX', 'FOR', 'FOUND', 'IF', 'IN', 'LET', 'NOREV', 'NOT', 'NX', 'OF', 'PREFIX',
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

    const operator = /^(?:\.\.|==|!=|<>|<=|>=|&&|\|\||[-+*/=<>!@])/.exec(rest);
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

function formatRemaining(ms) {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 120) return `in ${seconds} s`;
  if (seconds < 7200) return `in ${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;
  return `in ${Math.round(seconds / 3600)} h`;
}

// The current time, updated every second while `active` is true.
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

// Counts down to a key's expiration. The bar shows the share of the lease that is left, from the
// last write to the expiration.
function ExpiresCell({expires, lastModified, now}) {
  if (!expires) return <td className={styles.nullValue}>never</td>;
  const left = expires - now;
  const at = new Date(expires).toLocaleTimeString();
  if (left <= 0) {
    return <td className={styles.expired} title={`Expired at ${at}`}>expired</td>;
  }
  const total = lastModified && expires > lastModified ? expires - lastModified : left;
  const share = Math.max(0, Math.min(1, left / total));
  return (
    <td className={styles.expires} title={`Expires at ${at}`}>
      <span>{formatRemaining(left)}</span>
      <span className={styles.leaseBar} aria-hidden="true"><span style={{width: `${share * 100}%`}} /></span>
    </td>
  );
}

function ValueCell({value}) {
  if (value === null || value === undefined) return <td className={styles.nullValue}>null</td>;
  if (value === '') return <td className={styles.nullValue}>(empty)</td>;
  return <td className={styles.valueCell}>{value}</td>;
}

function PartitionCell({partition, describePartition}) {
  if (partition === undefined || partition < 0) return <td className={styles.nullValue}>—</td>;
  return (
    <td>
      <span className={styles.partitionChip}>P{partition}</span>
      {describePartition && <span className={styles.partitionLeader}>{describePartition(partition)}</span>}
    </td>
  );
}

function ValuesTable({values, describePartition}) {
  // Tick only while some key still has time left; the countdown stops once every key expired.
  const latest = Math.max(0, ...values.map((value) => value.expires || 0));
  const [ticking, setTicking] = useState(latest > Date.now());
  const now = useNow(ticking);
  useEffect(() => {
    setTicking(latest > now);
  }, [latest, now]);

  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th className={styles.num}>Revision</th>
            <th>Partition</th>
            <th>Expires</th>
          </tr>
        </thead>
        <tbody>
          {values.map((value, index) => (
            <tr key={`${value.key}-${index}`}>
              <td className={styles.keyCell}>{value.key ?? '—'}</td>
              <ValueCell value={value.value} />
              <td className={styles.num}>{value.revision >= 0 ? value.revision : '—'}</td>
              <PartitionCell partition={value.partition} describePartition={describePartition} />
              <ExpiresCell expires={value.expires} lastModified={value.lastModified} now={now} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultCard({run, describePartition}) {
  const {outcome} = run;
  const values = outcome.values ?? [];
  const returned = values.length === 1 && values[0].key === null;
  // A read of a missing key answers with the key, no value and no revision.
  const missing = outcome.type === 'DoesNotExist';
  // A write answers with the key and its new revision, but no value.
  const writes = !missing && outcome.type !== 'Get' && values.length > 0 && values.every((value) => value.value === null);

  let body;
  if (!outcome.ok) {
    body = <p className={styles.errorText}>{outcome.reason ?? 'The script failed.'}</p>;
  } else if (missing) {
    const key = values.find((value) => value.key !== null);
    body = (
      <div className={styles.missing}>
        <p>
          {key ? <><span className={styles.keyCell}>{key.key}</span> does not exist.</> : 'The key does not exist.'}{' '}
          It was never written, it was deleted, or its expiration passed.
        </p>
        {key?.partition >= 0 && (
          <p className={styles.missingWhere}>
            <span className={styles.partitionChip}>P{key.partition}</span>
            {describePartition && <span>{describePartition(key.partition)}</span>}
          </p>
        )}
      </div>
    );
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
            {value.partition >= 0 && (
              <span className={styles.partitionChip} title={describePartition?.(value.partition)}>P{value.partition}</span>
            )}
            {value.revision >= 0 && <span>revision {value.revision}</span>}
          </li>
        ))}
      </ul>
    );
  } else if (values.length) {
    body = <ValuesTable values={values} describePartition={describePartition} />;
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
      {run.servedBy && <p className={styles.servedBy}>Sent to <strong>{run.servedBy}</strong></p>}
    </article>
  );
}

/**
 * The script console.
 *
 * - `onRun(script, parametersJson)` runs one script and resolves to `{outcome, servedBy}`.
 * - `ready` is false while the engine starts; `busy` is true while any operation runs.
 * - `blocked` is a message that explains why the target cannot run scripts, or null.
 * - `target` names the server the next run goes to. `toolbar` holds extra controls.
 * - `describePartition(id)` returns a short text about a partition, such as its leader.
 */
export function ScriptConsole({onRun, ready, busy, blocked, target, toolbar, describePartition, loadingText}) {
  const [example, setExample] = useState(examples[0]);
  const [script, setScript] = useState(examples[0].script);
  const [parameters, setParameters] = useState(examples[0].parameters ?? '');
  const [lastRun, setLastRun] = useState(null);
  const [error, setError] = useState('');
  const [runKey, setRunKey] = useState('Ctrl Enter');
  const [hasSelection, setHasSelection] = useState(false);
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const lineNumbersRef = useRef(null);

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setRunKey('⌘ Enter');
  }, []);

  const canRun = ready && !busy && !blocked;

  async function run(source = script) {
    const code = source.trim();
    if (!canRun || !code) return;

    let parametersJson = null;
    try {
      const parsed = parseParameters(parameters);
      if (Object.keys(parsed).length) parametersJson = JSON.stringify(parsed);
    } catch (parseError) {
      setError(parseError.message);
      return;
    }

    setError('');
    try {
      const result = await onRun(code, parametersJson);
      // Each run replaces the previous result, so the panel always shows the script just run.
      if (result) setLastRun({script: code, outcome: result.outcome, servedBy: result.servedBy, at: Date.now()});
    } catch (runError) {
      setError(`Engine error: ${runError.message}`);
    }
  }

  function selectedScript() {
    const target = textareaRef.current;
    if (!target) return '';
    return script.slice(target.selectionStart, target.selectionEnd).trim();
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
    <div className={styles.playground}>
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
              disabled={!canRun || !script.trim()}>
              {target ? `Run on ${target}` : 'Run'} <kbd>{runKey}</kbd>
            </button>
            <button
              type="button"
              onClick={() => run(selectedScript())}
              disabled={!canRun || !hasSelection}>
              Run selected <kbd>Shift {runKey}</kbd>
            </button>
            {toolbar}
            <Link className={styles.docsLink} to="/docs/scripts/">
              Script reference
            </Link>
          </div>
          {(blocked || error) && <p className={styles.consoleNotice} role="status">{error || blocked}</p>}
        </div>

        <div className={styles.resultsPane}>
          <div className={styles.tabs} aria-label="Results">
            <span className={styles.tabTitle}>Output</span>
            {lastRun && (
              <button type="button" className={styles.clearButton} onClick={() => setLastRun(null)}>
                Clear output
              </button>
            )}
          </div>

          <div className={styles.tabPanel} role="region" aria-label="Script output" aria-live="polite">
            {lastRun ? (
              <ResultCard run={lastRun} describePartition={describePartition} />
            ) : (
              <p className={styles.empty}>
                {ready
                  ? 'Run a script to see its result here. Each run is one transaction.'
                  : loadingText ?? 'The engine is loading. The first visit downloads the WebAssembly runtime.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
