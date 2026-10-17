// Publishes the playground engine (playground-engine/) and copies exactly the runtime assets that
// its .NET boot manifest references into static/playground-engine/_framework.
//
// Needs the .NET 10 SDK with the wasm-tools workload (dotnet workload install wasm-tools).
// Usage: npm run build:playground-engine

import {execFileSync} from 'node:child_process';
import {readFile, mkdir, copyFile, rm, mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const project = path.resolve('playground-engine/Kahuna.Playground.csproj');
const output = await mkdtemp(path.join(os.tmpdir(), 'kahuna-playground-'));
const destination = path.resolve('static/playground-engine/_framework');

execFileSync('dotnet', ['publish', project, '-c', 'Release', '-o', output], {stdio: 'inherit'});

const source = path.join(output, 'wwwroot/_framework');
const loader = await readFile(path.join(source, 'dotnet.js'), 'utf8');
const manifest = JSON.parse(loader.split('/*json-start*/')[1].split('/*json-end*/')[0]);

const assets = new Set(['dotnet.js']);
function collect(value) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.name === 'string') assets.add(value.name);
  Object.values(value).forEach(collect);
}
collect(manifest.resources);

await rm(destination, {recursive: true, force: true});
await mkdir(destination, {recursive: true});
for (const file of assets) await copyFile(path.join(source, file), path.join(destination, file));
await rm(output, {recursive: true, force: true});

console.log(`Copied ${assets.size} runtime assets to ${path.relative(process.cwd(), destination)}`);
