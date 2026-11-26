#!/usr/bin/env node
/**
 * kb-lint.js — integrity check for the instructions and the knowledge base. No device needed.
 *
 *   npm run kb-lint                 everything
 *   npm run kb-lint -- <file.md>…   links of those files only (what the PostToolUse hook runs)
 *   npm run kb-lint -- --hook       reads a PostToolUse hook payload on stdin, checks the edited file
 *
 * Errors (exit 1): a relative link to a file that does not exist · a #anchor that matches no heading ·
 *   a rules file missing from kb/local/rules/README.md · a rules file without frontmatter (scope/status/evaluator) ·
 *   config/accounts.json entries without id/email/passwordEnvVar/flavor or with a duplicate id ·
 *   a taxonomy flowFile that is not on disk.
 * Warnings: links into local-only folders (reports/, screenshots/, kb/wiki/) that are missing on this machine.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOC_ROOTS = ['CLAUDE.md', 'README.md', 'docs', 'kb/README.md', 'kb/local', 'config', 'evals', 'reports/README.md', 'reports/_template'];
const LOCAL_ONLY = /^(reports\/(?!_template|README)|screenshots\/|kb\/(?!local|README)|cockpit\/|assets\/)/;
const errors = [];
const warnings = [];

function markdownFiles(entry) {
  const full = path.join(ROOT, entry);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return entry.endsWith('.md') ? [entry] : [];
  return fs.readdirSync(full).flatMap((name) => (name === 'node_modules' ? [] : markdownFiles(path.join(entry, name))));
}

// GitHub-style heading slugs, with -1, -2… for repeats.
const slugCache = new Map();
function slugs(file) {
  if (slugCache.has(file)) return slugCache.get(file);
  const seen = new Map();
  const out = new Set();
  let fenced = false;
  for (const line of fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n')) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const heading = !fenced && line.match(/^#{1,6}\s+(.*)$/);
    if (!heading) continue;
    const text = heading[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, (c) => (c === '_' ? '_' : '')).trim();
    let slug = text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
    const n = seen.get(slug) ?? 0;
    seen.set(slug, n + 1);
    if (n) slug = `${slug}-${n}`;
    out.add(slug);
  }
  slugCache.set(file, out);
  return out;
}

function checkLinks(file) {
  let fenced = false;
  fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (fenced) return;
    for (const match of line.replace(/`[^`]*`/g, (code) => (code.includes('](') ? code : '')).matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const target = match[1];
      if (/^(https?:|mailto:|vscode:|data:)/.test(target) || target.startsWith('<')) continue;
      const [rawPath, anchor] = target.split('#');
      const linked = rawPath ? path.normalize(path.join(path.dirname(file), decodeURIComponent(rawPath))) : file;
      const where = `${file}:${i + 1}`;
      if (linked.startsWith('..')) continue; // outside the repo (memory, app clones)
      if (!fs.existsSync(path.join(ROOT, linked))) {
        (LOCAL_ONLY.test(linked) ? warnings : errors).push(`${where}  link → ${linked} does not exist`);
        continue;
      }
      if (anchor && linked.endsWith('.md') && !/^L\d+/.test(anchor) && !slugs(linked).has(anchor.toLowerCase())) {
        errors.push(`${where}  anchor #${anchor} matches no heading in ${linked}`);
      }
    }
  });
}

function checkRules() {
  const dir = 'kb/local/rules';
  const index = fs.readFileSync(path.join(ROOT, dir, 'README.md'), 'utf8');
  for (const name of fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
    const [table, pack = ''] = index.split('## Context pack');
    if (!table.includes(`(${name})`)) errors.push(`${dir}/${name}  not in the README file table`);
    if (!pack.includes(name)) errors.push(`${dir}/${name}  not in the README context pack — an unlisted file is a file nobody reads`);
    const front = fs.readFileSync(path.join(ROOT, dir, name), 'utf8').match(/^---\n([\s\S]*?)\n---/);
    for (const key of ['scope', 'status', 'evaluator']) {
      if (!front || !new RegExp(`^${key}:`, 'm').test(front[1])) errors.push(`${dir}/${name}  frontmatter is missing "${key}"`);
    }
  }
}

function checkConfig() {
  const accounts = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/accounts.json'), 'utf8')).accounts ?? [];
  const ids = new Set();
  for (const account of accounts) {
    const label = `config/accounts.json  ${account.id ?? account.email ?? '(no id)'}`;
    for (const key of ['id', 'email', 'passwordEnvVar', 'flavor']) if (!account[key]) errors.push(`${label}  missing "${key}"`);
    if (ids.has(account.id)) errors.push(`${label}  duplicate id`);
    ids.add(account.id);
  }
  const walk = (node) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      if (typeof node.flowFile === 'string' && !fs.existsSync(path.join(ROOT, node.flowFile))) {
        errors.push(`coverage/taxonomy.json  ${node.id ?? ''} flowFile ${node.flowFile} is not on disk`);
      }
      Object.values(node).forEach(walk);
    }
  };
  walk(JSON.parse(fs.readFileSync(path.join(ROOT, 'coverage/taxonomy.json'), 'utf8')));
}

async function main() {
  const args = process.argv.slice(2);
  let files = args.filter((a) => !a.startsWith('--'));
  if (args.includes('--hook')) {
    let raw = '';
    for await (const chunk of process.stdin) raw += chunk;
    const edited = path.relative(ROOT, JSON.parse(raw || '{}').tool_input?.file_path ?? '');
    const tracked = edited.endsWith('.md') && DOC_ROOTS.some((r) => edited === r || edited.startsWith(`${r}/`));
    if (!tracked || !fs.existsSync(path.join(ROOT, edited))) return;
    checkLinks(edited);
    if (edited.startsWith('kb/local/rules/')) checkRules();
    if (errors.length) {
      // decision:block on PostToolUse feeds the reason back to Claude; the edit itself already happened.
      process.stdout.write(JSON.stringify({ decision: 'block', reason: `kb-lint — fix before moving on:\n${errors.join('\n')}` }));
    }
    return;
  }
  if (files.length) files.map((f) => path.relative(ROOT, path.resolve(f))).forEach(checkLinks);
  else {
    files = DOC_ROOTS.flatMap(markdownFiles);
    files.forEach(checkLinks);
    checkRules();
    checkConfig();
  }
  for (const w of warnings) console.log(`warn   ${w}`);
  for (const e of errors) console.log(`ERROR  ${e}`);
  console.log(`\nkb-lint: ${files.length} file(s), ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (errors.length) process.exitCode = 1;
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
