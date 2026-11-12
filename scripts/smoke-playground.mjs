// End-to-end check of the playground engine under Node, which runs the same single-threaded
// browser-wasm runtime a tab does. It starts the in-tab cluster, runs every example on it, then
// stops, restarts, adds and removes servers. It fails on a wrong result, a failed example, or a hang.
//
// Usage: node scripts/smoke-playground.mjs [engine directory]
//   The default directory is static/playground-engine.

import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {seedScript, examples, parseParameters} from '../src/components/KahunaPlayground/examples.mjs';
import {START_NODES} from '../src/components/ClusterPlayground/model.mjs';

const root = path.resolve(process.argv[2] ?? 'static/playground-engine');

// A deadlock on the single-threaded runtime leaves the event loop idle; turn it into a failure.
const deadline = setTimeout(() => {
  console.error('FAIL: timed out after 400 s');
  process.exit(1);
}, 400_000);

const {dotnet} = await import(pathToFileURL(path.join(root, '_framework/dotnet.js')).href);
const runtime = await dotnet.create();
const exports = await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName);
const engine = exports.Kahuna.Playground.PlaygroundEngine;

const started = performance.now();
const elapsed = () => `${Math.round(performance.now() - started)} ms`;

let status = JSON.parse(await engine.StartClusterAsync(START_NODES));
assert.equal(status.nodes.length, START_NODES);
const dataPartitions = status.partitions.filter((p) => p.state !== 'Removed');
console.log(`cluster up in ${elapsed()}: ${status.nodes.length} servers, ${dataPartitions.length} partitions, RF ${status.replicationFactor}`);
for (const p of dataPartitions) assert.equal(p.replicas.length, status.replicationFactor, `P${p.id} has RF replicas`);

async function run(node, script, parameters) {
  return JSON.parse(await engine.ExecuteOnNodeAsync(node, script, parameters ? JSON.stringify(parameters) : null));
}

async function runOk(node, script, parameters) {
  const outcome = await run(node, script, parameters);
  assert.ok(outcome.ok, `script failed on server ${node + 1} (${outcome.type}: ${outcome.reason ?? 'no reason'}):\n${script}`);
  return outcome;
}

// A node that just rejoined or a partition that just failed over can refuse for a moment.
async function eventually(what, attempt, timeoutMs = 60_000) {
  const until = performance.now() + timeoutMs;
  for (;;) {
    try {
      return await attempt();
    } catch (error) {
      if (performance.now() > until) throw new Error(`${what}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

await runOk(0, seedScript);
// Every server reads the seed data, whichever server leads the key's partition.
for (let node = 0; node < START_NODES; node++) {
  const read = await runOk(node, 'get `wallets/alice`');
  assert.equal(read.values[0].value, '500', `kahuna-${node + 1} reads the seed data`);
  assert.ok(read.values[0].partition > 0, 'a value reports its partition');
}

const hello = await runOk(1, `return 'hi'`);
assert.equal(hello.values[0].value, 'hi');

const missing = await run(2, 'get `nothing/here`');
assert.equal(missing.type, 'DoesNotExist');

const broken = await run(0, 'set');
assert.equal(broken.ok, false, 'a syntax error fails');

const thrown = await run(0, 'throw "boom"');
assert.equal(thrown.ok, false, 'throw fails the script');

// Every example runs; each one goes through a different server, so most are forwarded.
for (const [i, example] of examples.entries()) {
  const parameters = example.parameters ? parseParameters(example.parameters) : undefined;
  const outcome = await runOk(i % START_NODES, example.script, parameters);
  console.log(`  ${example.label} via kahuna-${(i % START_NODES) + 1}: ${outcome.type} ${JSON.stringify(outcome.values.map((v) => [v.key, v.value, v.revision, v.partition]))}`);
}

const election = examples.find((e) => e.label === 'Leader election');
assert.equal((await run(1, election.script)).ok, false, 'a second election is refused');
const limiter = examples.find((e) => e.label === 'Rate limit');
for (let i = 0; i < 2; i++) await runOk(2, limiter.script);
assert.equal((await run(3, limiter.script)).ok, false, 'the fourth call is rate limited');

// Failover: stop the server that leads the wallets partition, then write through a survivor.
const walletPartition = (await runOk(0, 'get `wallets/alice`')).values[0].partition;
const leader = status.nodes.find((n) => n.leads.includes(walletPartition))?.index
  ?? JSON.parse(await engine.ClusterStatusAsync()).nodes.find((n) => n.leads.includes(walletPartition)).index;
status = JSON.parse(await engine.StopNodeAsync(leader));
assert.equal(status.nodes[leader].running, false);
console.log(`stopped kahuna-${leader + 1}, the leader of P${walletPartition}`);
const survivor = (leader + 1) % START_NODES;
await eventually('write after failover', () => runOk(survivor, 'set `wallets/carol` 75'));
const newLeader = await eventually('a new leader claims the partition', async () => {
  const s = JSON.parse(await engine.ClusterStatusAsync());
  const claim = s.nodes.find((n) => n.running && n.leads.includes(walletPartition));
  assert.ok(claim, `P${walletPartition} has no leader claim yet`);
  return claim;
});
console.log(`P${walletPartition} failed over to kahuna-${newLeader.index + 1} in ${elapsed()}`);

// Restart: the server comes back empty and catches up, then serves the write it missed.
status = JSON.parse(await engine.StartNodeAsync(leader));
assert.equal(status.nodes[leader].running, true);
await eventually('read on the restarted server', async () => {
  const read = await runOk(leader, 'get `wallets/carol`');
  assert.equal(read.values[0].value, '75');
});
console.log(`kahuna-${leader + 1} restarted and caught up`);
await eventually('restarted server is a voter', async () => {
  const s = JSON.parse(await engine.ClusterStatusAsync());
  assert.equal(s.nodes[leader].role, 'Voter');
});

// Grow and shrink.
status = JSON.parse(await engine.AddClusterNodeAsync());
assert.equal(status.nodes.length, START_NODES + 1);
const added = START_NODES;
await eventually('placement moves a replica to the new server', async () => {
  const s = JSON.parse(await engine.ClusterStatusAsync());
  assert.ok(s.partitions.some((p) => p.replicas.some((r) => r.index === added)), 'no replica yet');
});
console.log(`added kahuna-${added + 1}; the rebalancer placed a replica on it`);
await eventually('read through the new server', async () => {
  const read = await runOk(added, 'get `wallets/carol`');
  assert.equal(read.values[0].value, '75');
});

status = JSON.parse(await engine.RemoveClusterNodeAsync());
assert.equal(status.nodes.length, START_NODES);
assert.ok(status.partitions.every((p) => p.replicas.every((r) => r.index >= 0 && r.index < START_NODES)), 'no removed server stays in placement');
await assert.rejects(() => engine.RemoveClusterNodeAsync(), 'the cluster keeps its minimum size');
await eventually('data survives the removal', async () => {
  const read = await runOk(0, 'get `wallets/carol`');
  assert.equal(read.values[0].value, '75');
});
console.log('removed the added server; data preserved');

await engine.StopClusterAsync();
clearTimeout(deadline);
console.log(`PASS in ${elapsed()}`);
process.exit(0);
