#!/usr/bin/env node
/**
 * Session hooks (.claude/settings.json). Never throw, never block.
 *
 *   session.js start   SessionStart — one status block for Claude and the tester: attached devices, the account
 *                      the phone is logged into, stale KB sources, runs still to file in Hound.
 *   session.js stop    Stop — reminds once per session when `npm run hound-status` is not clean (non-negotiable 13).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const run = (cmd, args, timeout = 3000) => {
  try { return { ok: true, out: execFileSync(cmd, args, { cwd: ROOT, timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) }; }
  catch (err) { return { ok: false, out: String(err.stdout ?? '') }; }
};

function houndOpen() {
  const { ok, out } = run('node', ['scripts/hound-status.js']);
  return ok ? [] : out.split('\n').filter((line) => line.includes('✗')).map((line) => line.trim());
}

async function start() {
  const lines = [];
  const devices = run('adb', ['devices']).out.split('\n').slice(1).map((l) => l.trim().split(/\s+/)).filter(([, state]) => state === 'device').map(([id]) => id);
  lines.push(devices.length ? `Android device: ${devices.join(', ')}` : 'Android device: none attached');
  const current = path.join(ROOT, 'screenshots/.current_account');
  if (fs.existsSync(current)) lines.push(`Phone account (last switch-account.sh): ${fs.readFileSync(current, 'utf8').trim()}`);
  try {
    const { checkStaleness } = await import(path.join(ROOT, 'scripts/lib/kb-client.js'));
    for (const s of checkStaleness()) lines.push(`⚠ KB is stale: ${s.id} last synced ${s.lastDate ?? 'never'}${s.ageDays != null ? ` (${s.ageDays} days ago)` : ''}. Run: ${s.hint}`);
  } catch { /* KB config missing — nothing to report */ }
  const open = houndOpen();
  lines.push(open.length ? `Hound: ${open.length} run(s) still to file —\n  ${open.join('\n  ')}` : 'Hound: clean');
  const text = `Project status at session start\n${lines.join('\n')}`;
  process.stdout.write(JSON.stringify({ systemMessage: text, hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }));
}

async function stop() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const session = JSON.parse(raw || '{}').session_id ?? 'unknown';
  const open = houndOpen();
  if (!open.length) return;
  const marker = path.join(os.tmpdir(), `maestro-mcp-hound-reminder-${session}`);
  if (fs.existsSync(marker)) return;
  fs.writeFileSync(marker, '');
  process.stdout.write(JSON.stringify({ systemMessage: `Hound: ${open.length} run(s) still to file (npm run hound-status):\n  ${open.join('\n  ')}` }));
}

const mode = process.argv[2];
(mode === 'start' ? start() : mode === 'stop' ? stop() : Promise.resolve()).catch(() => {}).finally(() => process.exit(0));
