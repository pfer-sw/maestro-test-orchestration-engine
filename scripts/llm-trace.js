#!/usr/bin/env node
/**
 * llm-trace.js — read-only view of the in-app assistant's reasoning traces (optional; Langfuse adapter).
 *
 *   npm run trace -- <lookup value> [--project=<key>] [--since=ISO] [--until=ISO] [--full] [--json=<file>]
 *
 * Prints one block per trace: time, name, the configured trigger fields of the input, the model's
 * thinking / text, and every tool call (name + input). Use it before scoring any assistant behaviour
 * (docs/engine/llm-traces.md). --json saves the raw traces — keep them under screenshots/ (gitignored).
 *
 * Config: config/llm-trace.json (host, projects, key env var names, lookup field). Keys come from .env
 * via dotenv and are never printed. GET requests only.
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, '..', 'config', 'llm-trace.json');
if (!existsSync(CONFIG_PATH)) {
  console.error('No config/llm-trace.json — this unit has no AI trace source configured (optional, see docs/engine/llm-traces.md).');
  process.exit(1);
}
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
if (config.provider !== 'langfuse') {
  console.error(`provider "${config.provider}" not supported yet — only "langfuse". Add an adapter here.`);
  process.exit(1);
}

const args = process.argv.slice(2);
const lookup = args.find((a) => !a.startsWith('--'));
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const full = args.includes('--full');
const projectKey = opt('project') || config.defaultProject;
const project = config.projects?.[projectKey];

if (!lookup) {
  console.error(`Usage: npm run trace -- <${config.lookup?.description ?? 'lookup value'}> [--project=${Object.keys(config.projects ?? {}).join('|')}] [--since=ISO] [--until=ISO] [--full] [--json=<file>]`);
  process.exit(1);
}
if (!project) {
  console.error(`Unknown project "${projectKey}" — one of ${Object.keys(config.projects ?? {}).join(', ')}`);
  process.exit(1);
}
const host = process.env[config.hostEnvVar] || config.host;
const pk = process.env[project.publicKeyEnvVar];
const sk = process.env[project.secretKeyEnvVar];
if (!host || !pk || !sk) {
  console.error(`Missing host or ${project.publicKeyEnvVar} / ${project.secretKeyEnvVar} in .env`);
  process.exit(1);
}

const AUTH = { Authorization: 'Basic ' + Buffer.from(`${pk}:${sk}`).toString('base64') };
async function get(path) {
  const r = await fetch(host + path, { headers: AUTH });
  if (!r.ok) throw new Error(`GET ${path.split('?')[0]} → ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

const cut = (s, n) => (full || !s || s.length <= n ? s : s.slice(0, n) + ' …');
const text = (x) => (typeof x === 'string' ? x : JSON.stringify(x));
const pick = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

function thinkingOf(output) {
  const blocks = Array.isArray(output?.content) ? output.content : Array.isArray(output) ? output : [];
  const parts = blocks
    .map((b) => (b?.type === 'thinking' ? b.thinking : b?.type === 'text' ? `[text] ${b.text}` : null))
    .filter(Boolean);
  return parts.length ? parts.join('\n') : null;
}

// 1. find the traces: metadata filter first, else scan the window for the lookup value anywhere in the trace
const since = opt('since');
const until = opt('until');
const window = (qs) => {
  if (since) qs.set('fromTimestamp', since);
  if (until) qs.set('toTimestamp', until);
  return qs;
};
const list = [];
const metaKey = project.lookupMetadataKey ?? config.lookup?.metadataKey;
if (metaKey) {
  const filter = JSON.stringify([{ type: 'stringObject', column: 'metadata', key: metaKey, operator: '=', value: lookup }]);
  for (let page = 1; ; page++) {
    const j = await get(`/api/public/traces?${window(new URLSearchParams({ limit: '100', page: String(page), filter }))}`);
    list.push(...j.data);
    if (page >= (j.meta?.totalPages ?? 1)) break;
  }
}
if (!list.length) {
  console.error('no metadata match — scanning the time window for the value (pass --since to keep it short)');
  for (let page = 1; page <= 20; page++) {
    const j = await get(`/api/public/traces?${window(new URLSearchParams({ limit: '100', page: String(page) }))}`);
    list.push(...j.data.filter((t) => JSON.stringify(t).includes(lookup)));
    if (page >= (j.meta?.totalPages ?? 1)) break;
  }
}
list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

// 2. print each trace
const traces = [];
for (const t of list) traces.push(await get(`/api/public/traces/${t.id}`));
console.log(`[${projectKey}] ${lookup} — ${traces.length} traces${since ? ` since ${since}` : ''}`);

for (const t of traces) {
  console.log(`\n=== ${t.timestamp.slice(0, 19).replace('T', ' ')}Z  ${t.name ?? ''}  ${t.id}`);
  for (const field of project.triggerFields ?? []) {
    const v = pick(t.input, field);
    if (v !== undefined) console.log(`${field}: ${cut(text(v), 400)}`);
  }
  const obs = (t.observations ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (const o of obs) {
    if (o.type === 'GENERATION') {
      const th = thinkingOf(o.output);
      console.log(`${th ? 'thinking' : 'output'} ${o.startTime.slice(11, 19)}: ${cut(th ?? text(o.output), 900)}`);
    } else if (o.type === 'TOOL') {
      console.log(`tool ${o.name}: ${cut(text(o.input ?? {}), 600)}`);
    }
  }
  for (const [label, path] of Object.entries(project.outputFlags ?? {})) {
    if (pick(t.output, path)) console.log(`→ ${label}`);
  }
}

const jsonOut = opt('json');
if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify(traces, null, 2));
  console.log(`\nraw traces → ${jsonOut}`);
}
