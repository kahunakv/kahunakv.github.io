// End-to-end check of the playground engine under Node, which runs the same single-threaded
// browser-wasm runtime a tab does. It fails on a wrong result, a failed example, or a hang.
//
// Usage: node scripts/smoke-playground.mjs [engine directory]
//   The default directory is static/playground-engine.

import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {seedScript, examples, parseParameters} from '../src/components/KahunaPlayground/examples.mjs';

const root = path.resolve(process.argv[2] ?? 'static/playground-engine');

// A deadlock on the single-threaded runtime leaves the event loop idle; turn it into a failure.
const deadline = setTimeout(() => {
  console.error('FAIL: timed out after 120 s');
  process.exit(1);
}, 120_000);

const {dotnet} = await import(pathToFileURL(path.join(root, '_framework/dotnet.js')).href);
const runtime = await dotnet.create();
const exports = await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName);
const engine = exports.Kahuna.Playground.PlaygroundEngine;

const started = performance.now();
await engine.InitAsync();
console.log(`engine up in ${Math.round(performance.now() - started)} ms`);

async function run(script, parameters) {
  return JSON.parse(await engine.ExecuteAsync(script, parameters ? JSON.stringify(parameters) : null));
}

async function runOk(script, parameters) {
  const outcome = await run(script, parameters);
  assert.ok(outcome.ok, `script failed (${outcome.type}: ${outcome.reason ?? 'no reason'}):\n${script}`);
  return outcome;
}

async function keys() {
  return JSON.parse(await engine.KeysAsync());
}

await runOk(seedScript);
const seeded = await keys();
assert.ok(seeded.some((k) => k.key === 'wallets/alice' && k.value === '500'), 'the seed data loads');

const hello = await runOk(`return 'hi'`);
assert.equal(hello.values[0].value, 'hi');

const missing = await run('get `nothing/here`');
assert.equal(missing.type, 'DoesNotExist');

const broken = await run('set');
assert.equal(broken.ok, false, 'a syntax error fails');
console.log(`syntax error reports: ${broken.type}: ${broken.reason}`);

const thrown = await run('throw "boom"');
assert.equal(thrown.ok, false, 'throw fails the script');
console.log(`throw reports: ${thrown.type}: ${thrown.reason}`);

const ephemeral = await runOk('eset `tmp/e` 1');
assert.ok((await keys()).some((k) => k.key === 'tmp/e' && k.durability === 'ephemeral'), 'ephemeral keys are listed');

for (const example of examples) {
  const parameters = example.parameters ? parseParameters(example.parameters) : undefined;
  const outcome = await runOk(example.script, parameters);
  console.log(`  ${example.label}: ${outcome.type} ${JSON.stringify(outcome.values.map((v) => [v.key, v.value, v.revision]))}`);
}

// Examples that refuse on a repeated run must refuse, not crash.
const election = examples.find((e) => e.label === 'Leader election');
assert.equal((await run(election.script)).ok, false, 'a second election is refused');
const limiter = examples.find((e) => e.label === 'Rate limit');
for (let i = 0; i < 2; i++) await runOk(limiter.script);
assert.equal((await run(limiter.script)).ok, false, 'the fourth call is rate limited');

await engine.ResetAsync();
assert.deepEqual(await keys(), [], 'reset leaves an empty store');

clearTimeout(deadline);
console.log(`PASS in ${Math.round(performance.now() - started)} ms`);
process.exit(0);
