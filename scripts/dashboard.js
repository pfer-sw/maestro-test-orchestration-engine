/**
 * dashboard.js — Local HTTP server for the Maestro Testing Dashboard.
 * Usage: node scripts/dashboard.js  (or: npm run dashboard)
 * Opens a browser UI at http://localhost:7654
 */

import 'dotenv/config';
import http from 'http';
import { spawn, execSync, spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { resolve, dirname, join, extname, relative, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PORT = parseInt(process.env.DASHBOARD_PORT ?? '7654', 10);
const CREDS_FILE = join(ROOT, '.credentials.json');

// Active runs: runId → { proc, lines[], done, exitCode }
const runs = new Map();

// ── Credentials ─────────────────────────────────────────────────────────────

function loadCreds() {
  if (!existsSync(CREDS_FILE)) return {};
  try { return JSON.parse(readFileSync(CREDS_FILE, 'utf8')); } catch { return {}; }
}

function saveCreds(email, password) {
  writeFileSync(CREDS_FILE, JSON.stringify({ email, password }, null, 2));
}

// ── Log filter ───────────────────────────────────────────────────────────────

const LOG_KEYWORDS = /PASS|FAIL|ERROR|WARN|skip|complete|coverage|sync|flow|found|error|%|→|✓|✗|⚠|SKIP|done|healed|bug|missing/i;

function shouldForward(line) {
  if (!line.trim()) return false;
  const t = line.trim();
  if (t.startsWith('[') || t.startsWith('✓') || t.startsWith('✗') || t.startsWith('⚠')) return true;
  return LOG_KEYWORDS.test(t);
}

// ── Reports ──────────────────────────────────────────────────────────────────

function walkReports(dir, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkReports(full, results);
    } else if (extname(entry) === '.html') {
      results.push({
        name: entry,
        path: '/' + relative(ROOT, full).replace(/\\/g, '/'),
        group: relative(join(ROOT, 'reports'), dirname(full)).replace(/\\/g, '/'),
        date: entry.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '',
        mtime: stat.mtimeMs,
      });
    }
  }
  return results;
}

// ── KB status ────────────────────────────────────────────────────────────────

function getKbStatus() {
  const cfgPath = join(ROOT, 'config', 'kb.json');
  const manifestPath = join(ROOT, 'kb', '_manifest.json');
  if (!existsSync(cfgPath)) return [];

  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  const maxAge = cfg.maxAgeDays ?? 7;
  const now = Date.now();

  return cfg.repositories.map(repo => {
    const lastSync = manifest.lastSync?.[repo.id] ?? null;
    const fileCount = manifest.fileCount?.[repo.id] ?? 0;
    const ageDays = lastSync ? Math.floor((now - new Date(lastSync).getTime()) / 86400000) : null;
    const isLocal = !!repo.localPath;
    const isStale = ageDays !== null ? ageDays > maxAge : !isLocal;
    return { id: repo.id, lastSync, fileCount, ageDays, isLocal, isStale, localPath: repo.localPath ?? null };
  });
}

// ── Device status ─────────────────────────────────────────────────────────────

function findAdb() {
  const candidates = [
    process.env.ADB_PATH,
    '/opt/homebrew/bin/adb',
    '/usr/local/bin/adb',
    process.env.HOME && `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`,
    process.env.ANDROID_HOME && `${process.env.ANDROID_HOME}/platform-tools/adb`,
    process.env.ANDROID_SDK_ROOT && `${process.env.ANDROID_SDK_ROOT}/platform-tools/adb`,
  ].filter(Boolean);
  return candidates.find(p => existsSync(p)) ?? null;
}

function getDeviceStatus() {
  const adb = findAdb();
  if (!adb) return { ok: false, devices: [], ready: [], error: 'adb not found — add ADB_PATH=/path/to/adb to .env' };

  const r = spawnSync(adb, ['devices'], { timeout: 4000, encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    return { ok: false, devices: [], ready: [], error: r.error?.message ?? `adb exited ${r.status}` };
  }

  const lines = r.stdout.split('\n').slice(1).filter(l => l.trim() && !l.startsWith('*'));
  const devices = lines.map(l => {
    const parts = l.trim().split(/\s+/);
    return { id: parts[0], status: parts[1] ?? 'unknown' };
  }).filter(d => d.id && d.id.length > 2);
  const ready = devices.filter(d => d.status === 'device');
  return { ok: ready.length > 0, devices, ready };
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

const SCENARIOS_DIR = join(ROOT, 'config', 'scenarios');

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function listScenarios() {
  if (!existsSync(SCENARIOS_DIR)) return [];
  return readdirSync(SCENARIOS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const full = join(SCENARIOS_DIR, f);
      const stat = statSync(full);
      const raw = readFileSync(full, 'utf8');
      const name = raw.split('\n')[0].replace(/^#+\s*/, '').trim();
      const slug = basename(f, '.md');
      return { slug, name, mtime: stat.mtimeMs, created: stat.birthtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function saveScenario(name, content) {
  mkdirSync(SCENARIOS_DIR, { recursive: true });
  let slug = slugify(name);
  let candidate = join(SCENARIOS_DIR, slug + '.md');
  let i = 1;
  while (existsSync(candidate)) { candidate = join(SCENARIOS_DIR, slug + '-' + i++ + '.md'); }
  slug = basename(candidate, '.md');
  writeFileSync(candidate, `# ${name}\n\n${content}`);
  return slug;
}

function deleteScenario(slug) {
  const p = join(SCENARIOS_DIR, slug + '.md');
  if (!existsSync(p)) return false;
  unlinkSync(p);
  return true;
}

// ── Accounts ─────────────────────────────────────────────────────────────────

function getAccounts() {
  const p = join(ROOT, 'config', 'accounts.json');
  if (!existsSync(p)) return [];
  const { accounts = [] } = JSON.parse(readFileSync(p, 'utf8'));
  return accounts.map(a => ({ id: a.id, email: a.email, flavor: a.flavor, tags: a.tags, traits: a.traits ?? {} }));
}

// ── Spawn helper ─────────────────────────────────────────────────────────────

function spawnRun(runId, cmd, args, extraEnv = {}) {
  const creds = loadCreds();
  const env = {
    ...process.env,
    ...(creds.email ? { TEST_USERNAME: creds.email } : {}),
    ...(creds.password ? { TEST_PASSWORD: creds.password } : {}),
    ...extraEnv,
  };

  const proc = spawn(cmd, args, { cwd: ROOT, env, shell: false });
  const entry = { proc, lines: [`▶ Running: ${cmd} ${args.join(' ')}\n`], done: false, exitCode: null, sseClients: [] };
  runs.set(runId, entry);

  function broadcast(line) {
    entry.lines.push(line);
    for (const res of entry.sseClients) {
      try { res.write(`data: ${JSON.stringify({ line })}\n\n`); } catch {}
    }
  }

  function handleData(data) {
    const text = data.toString();
    for (const line of text.split('\n')) {
      if (shouldForward(line) || entry.lines.length <= 2) broadcast(line);
    }
  }

  proc.stdout.on('data', handleData);
  proc.stderr.on('data', handleData);

  proc.on('close', code => {
    entry.done = true;
    entry.exitCode = code;
    const summary = code === 0 ? '✓ Done' : `✗ Exited with code ${code}`;
    broadcast(summary);
    for (const res of entry.sseClients) {
      try { res.write(`data: ${JSON.stringify({ done: true, exitCode: code })}\n\n`); } catch {}
    }
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function json(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  const urlObj = new URL(url, `http://localhost:${PORT}`);
  const path = urlObj.pathname;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  // Static file: serve dashboard.html
  if (method === 'GET' && path === '/') {
    const htmlPath = join(ROOT, 'dashboard.html');
    if (!existsSync(htmlPath)) { res.writeHead(404); return res.end('dashboard.html not found'); }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(readFileSync(htmlPath));
  }

  // Serve report HTML files
  if (method === 'GET' && path.startsWith('/reports/')) {
    const filePath = join(ROOT, path.slice(1));
    if (!existsSync(filePath) || extname(filePath) !== '.html') { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(readFileSync(filePath));
  }

  // API: credentials GET
  if (method === 'GET' && path === '/api/credentials') {
    const creds = loadCreds();
    return json(res, 200, { email: creds.email ?? '', hasPassword: !!creds.password });
  }

  // API: credentials POST
  if (method === 'POST' && path === '/api/credentials') {
    const body = await readBody(req);
    saveCreds(body.email ?? '', body.password ?? '');
    return json(res, 200, { ok: true });
  }

  // API: run POST
  if (method === 'POST' && path === '/api/run') {
    const body = await readBody(req);
    const { command = 'node', args = [] } = body;
    const runId = Date.now().toString();
    spawnRun(runId, command, args);
    return json(res, 200, { runId });
  }

  // API: SSE stream
  if (method === 'GET' && path.startsWith('/api/stream/')) {
    const runId = path.split('/').pop();
    const entry = runs.get(runId);
    if (!entry) { res.writeHead(404); return res.end('Run not found'); }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Replay buffered lines
    for (const line of entry.lines) {
      res.write(`data: ${JSON.stringify({ line })}\n\n`);
    }
    if (entry.done) {
      res.write(`data: ${JSON.stringify({ done: true, exitCode: entry.exitCode })}\n\n`);
      return res.end();
    }

    entry.sseClients.push(res);
    req.on('close', () => {
      entry.sseClients = entry.sseClients.filter(r => r !== res);
    });
    return;
  }

  // API: reports
  if (method === 'GET' && path === '/api/reports') {
    const reports = walkReports(join(ROOT, 'reports')).sort((a, b) => b.mtime - a.mtime);
    return json(res, 200, reports);
  }

  // API: KB status
  if (method === 'GET' && path === '/api/kb-status') {
    return json(res, 200, getKbStatus());
  }

  // API: accounts
  if (method === 'GET' && path === '/api/accounts') {
    return json(res, 200, getAccounts());
  }

  // API: device status
  if (method === 'GET' && path === '/api/device-status') {
    return json(res, 200, getDeviceStatus());
  }

  // API: scenarios list
  if (method === 'GET' && path === '/api/scenarios') {
    return json(res, 200, listScenarios());
  }

  // API: scenarios create
  if (method === 'POST' && path === '/api/scenarios') {
    const body = await readBody(req);
    if (!body.name) return json(res, 400, { error: 'name required' });
    const slug = saveScenario(body.name, body.content ?? '');
    return json(res, 200, { slug });
  }

  // API: scenarios delete
  if (method === 'DELETE' && path.startsWith('/api/scenarios/')) {
    const slug = path.split('/').pop();
    const ok = deleteScenario(slug);
    return json(res, ok ? 200 : 404, { ok });
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🧪 Maestro Dashboard running at http://localhost:${PORT}\n`);
  // Auto-open browser on macOS
  try { spawn('open', [`http://localhost:${PORT}`], { detached: true, stdio: 'ignore' }).unref(); } catch {}
});
