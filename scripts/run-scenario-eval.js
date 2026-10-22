/**
 * run-scenario-eval.js — Collect test data for a Holistic Testing scenario.
 *
 * This script does NOT call the Anthropic API. It:
 *   1. Parses the scenario markdown into test cases (table/list/prose)
 *   2. If --live: navigates to the AI chat via Maestro and captures real responses
 *   3. Saves a structured JSON data file for Claude Code to evaluate
 *
 * Usage:
 *   node scripts/run-scenario-eval.js --scenario=<slug>           (KB eval — data only)
 *   node scripts/run-scenario-eval.js --scenario=<slug> --live    (Maestro + screenshots)
 *   [--flavor=<id>]  flavor whose aiTesting.selectors drive the live chat (default: $FLAVOR or 'main')
 *
 * After this script completes, ask Claude Code:
 *   "Evaluate the scenario at reports/prd_evals/<date>_<slug>_data.json"
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import minimist from 'minimist';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const argv = minimist(process.argv.slice(2));
const slug = argv.scenario;
const live = !!argv.live;
const flavorId = argv.flavor ?? process.env.FLAVOR ?? 'main';
if (!slug) { console.error('✗ --scenario=<slug> required'); process.exit(1); }

const scenarioPath = join(ROOT, 'config', 'scenarios', slug + '.md');
if (!existsSync(scenarioPath)) { console.error('✗ Scenario not found: ' + scenarioPath); process.exit(1); }

const scenarioRaw = readFileSync(scenarioPath, 'utf8');
const scenarioName = scenarioRaw.split('\n')[0].replace(/^#+\s*/, '').trim();
const today = new Date().toISOString().slice(0, 10);

console.log(`▶ Holistic Testing: "${scenarioName}" [${live ? 'live' : 'kb eval'}]`);

// ── KB protocol tags ──────────────────────────────────────────────────────────
// Protocol tags come from config/kb.json repositories[].protocolTags (deduplicated,
// in file order). A test case is tagged with the first protocol tag its text mentions.

function loadProtocolTags() {
  const kbPath = join(ROOT, 'config', 'kb.json');
  if (!existsSync(kbPath)) return [];
  try {
    const kb = JSON.parse(readFileSync(kbPath, 'utf8'));
    const tags = (kb.repositories ?? []).flatMap(r => r.protocolTags ?? []);
    return [...new Set(tags.filter(t => typeof t === 'string' && t.trim()))];
  } catch {
    return [];
  }
}

const PROTOCOL_TAGS = loadProtocolTags();

// ── Markdown parser ───────────────────────────────────────────────────────────

function normalizeCategory(raw = '') {
  const c = raw.toLowerCase();
  if (c.includes('adversar') || c.includes('security') || c.includes('inject')) return 'adversarial';
  if (c.includes('scope') || c.includes('reject') || c.includes('decline')) return 'out_of_scope';
  if (c.includes('edge') || c.includes('special') || c.includes('empty')) return 'edge_cases';
  if (c.includes('ambig')) return 'ambiguous_input';
  if (c.includes('protocol') || guessProtocol(c)) return 'protocol';
  return 'happy_path';
}

function guessProtocol(text = '') {
  const t = text.toLowerCase();
  return PROTOCOL_TAGS.find(tag => t.includes(tag.toLowerCase())) ?? null;
}

function parseMarkdownTable(lines) {
  const tableLines = lines.filter(l => l.trim().startsWith('|'));
  if (tableLines.length < 3) return null; // need header + separator + at least 1 row

  const headers = tableLines[0].split('|').map(h => h.trim()).filter(Boolean).map(h => h.toLowerCase());
  const dataRows = tableLines.slice(2);

  const findCol = (...keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
  const idxDesc     = findCol('description', 'test case', 'scenario', 'name', 'title');
  const idxMsg      = findCol('message', 'input', 'prompt', 'user', 'query');
  const idxExpected = findCol('expected', 'behavior', 'output', 'acceptance', 'criteria', 'result');
  const idxCategory = findCol('category', 'type', 'kind');

  return dataRows.map((row, i) => {
    const cells = row.split('|').map(c => c.trim()).filter((_, j) => j > 0 && j <= headers.length);
    const get = idx => (idx >= 0 ? cells[idx] : '') ?? '';
    const desc = get(idxDesc) || cells[0] || '';
    if (!desc) return null;
    const raw = get(idxCategory);
    return {
      id: `tc_${i + 1}`,
      description: desc,
      userMessage: get(idxMsg) || desc,
      expectedBehavior: get(idxExpected) || '',
      category: normalizeCategory(raw),
      protocol: guessProtocol(desc + ' ' + get(idxExpected)),
    };
  }).filter(Boolean);
}

function parseListItems(lines) {
  const items = lines.filter(l => /^[-*•]\s+/.test(l.trim()) || /^\d+\.\s+/.test(l.trim()));
  if (!items.length) return null;
  return items.map((item, i) => {
    const text = item.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '').trim();
    return {
      id: `tc_${i + 1}`,
      description: text,
      userMessage: text,
      expectedBehavior: '',
      category: normalizeCategory(text),
      protocol: guessProtocol(text),
    };
  });
}

function parseScenario(content) {
  const lines = content.split('\n');
  // skip the first heading line
  const body = lines.filter((l, i) => !(i === 0 && l.startsWith('#')));

  const fromTable = parseMarkdownTable(body);
  if (fromTable && fromTable.length) return fromTable;

  const fromList = parseListItems(body);
  if (fromList && fromList.length) return fromList;

  // Fallback: treat whole content as a single test case
  const text = body.join(' ').replace(/\s+/g, ' ').trim().slice(0, 600);
  return [{
    id: 'tc_1',
    description: text,
    userMessage: text,
    expectedBehavior: '',
    category: 'happy_path',
    protocol: guessProtocol(text),
  }];
}

// ── Live: find adb ─────────────────────────────────────────────────────────────

function findAdb() {
  return [
    process.env.ADB_PATH,
    '/opt/homebrew/bin/adb',
    '/usr/local/bin/adb',
    process.env.HOME && `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`,
    process.env.ANDROID_HOME && `${process.env.ANDROID_HOME}/platform-tools/adb`,
  ].filter(Boolean).find(p => existsSync(p)) ?? null;
}

function getConnectedDevice(adb) {
  const r = spawnSync(adb, ['devices'], { encoding: 'utf8', timeout: 4000 });
  if (r.error || r.status !== 0) return null;
  const lines = r.stdout.split('\n').slice(1).filter(l => l.trim() && !l.startsWith('*'));
  const ready = lines.map(l => l.trim().split(/\s+/)).find(p => p[1] === 'device');
  return ready?.[0] ?? null;
}

function adbScreencap(adb, deviceId, outPath) {
  const r = spawnSync(adb, ['-s', deviceId, 'exec-out', 'screencap', '-p'], { timeout: 8000 });
  if (r.error || !r.stdout?.length) return false;
  writeFileSync(outPath, r.stdout);
  return true;
}

// ── Live: generate + run Maestro flow ─────────────────────────────────────────

function runMaestroFlow(yaml, deviceId) {
  const tmpPath = join(ROOT, '.tmp_holistic_flow.yaml');
  writeFileSync(tmpPath, yaml);
  const r = spawnSync('maestro', ['--device', deviceId, 'test', tmpPath], {
    encoding: 'utf8',
    timeout: 60000,
    cwd: ROOT,
    env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` },
  });
  try { unlinkSync(tmpPath); } catch {}
  return { success: r.status === 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// Chat selectors and appId come from config/flavors.json → flavors.<id>.
// A selector is a resource-id, or `text:<label>` for a text / content-description match.
function loadChatConfig(id) {
  const flavors = JSON.parse(readFileSync(join(ROOT, 'config', 'flavors.json'), 'utf8')).flavors ?? {};
  const flavor = flavors[id];
  if (!flavor) throw new Error(`Unknown flavor "${id}" (config/flavors.json has: ${Object.keys(flavors).join(', ')})`);
  const sel = flavor.aiTesting?.selectors ?? {};
  if (!sel.promptInput || !sel.submitButton) {
    throw new Error(`flavors.${id}.aiTesting.selectors.promptInput / submitButton must be set for --live`);
  }
  const expand = v => String(v ?? '').replace(/\$\{(\w+)\}/g, (_, k) => process.env[k] ?? '');
  const appId = process.env.APP_ID || expand(flavor.app?.packageName);
  if (!appId) throw new Error(`No appId: set APP_ID or flavors.${id}.app.packageName`);
  return { appId, promptInput: sel.promptInput, submitButton: sel.submitButton };
}

function selectorYaml(sel) {
  const esc = v => v.replace(/"/g, '\\"');
  return sel.startsWith('text:') ? `text: "${esc(sel.slice(5))}"` : `id: "${esc(sel)}"`;
}

function buildChatFlow(chat, userMessage) {
  const escMsg = userMessage.replace(/"/g, '\\"');
  return `appId: ${chat.appId}
---
- tapOn:
    ${selectorYaml(chat.promptInput)}
- inputText: "${escMsg}"
- tapOn:
    ${selectorYaml(chat.submitButton)}
- waitForAnimationToEnd:
    timeout: 10000`;
}

// ── Main ───────────────────────────────────────────────────────────────────────

console.log('  Parsing scenario...');
const testCases = parseScenario(scenarioRaw);
if (!testCases.length) { console.error('✗ No test cases extracted'); process.exit(1); }

console.log(`  Found ${testCases.length} test case(s):`);
testCases.forEach(tc => console.log(`    ${tc.id}: ${tc.description.slice(0, 80)}`));

const liveResults = [];

if (live) {
  const adb = findAdb();
  if (!adb) { console.error('✗ adb not found — cannot run live eval'); process.exit(1); }
  const deviceId = getConnectedDevice(adb);
  if (!deviceId) { console.error('✗ No device connected'); process.exit(1); }
  let chat;
  try { chat = loadChatConfig(flavorId); } catch (err) { console.error('✗ ' + err.message); process.exit(1); }

  console.log(`\n  Device: ${deviceId}`);
  console.log('  ⚠ Make sure the app is open on the AI chat screen before each test.');
  console.log('');

  const screenshotDir = join(ROOT, 'screenshots', 'holistic_evals', today);
  mkdirSync(screenshotDir, { recursive: true });

  for (const tc of testCases) {
    console.log(`  → ${tc.id}: sending "${tc.userMessage.slice(0, 60)}..."`);

    // screenshot before
    const beforePath = join(screenshotDir, `${slug}_${tc.id}_before.png`);
    adbScreencap(adb, deviceId, beforePath);

    // run flow
    const yaml = buildChatFlow(chat, tc.userMessage);
    const flowResult = runMaestroFlow(yaml, deviceId);

    // screenshot after (response visible)
    const afterPath = join(screenshotDir, `${slug}_${tc.id}_after.png`);
    const captured = adbScreencap(adb, deviceId, afterPath);

    const entry = {
      tcId: tc.id,
      maestroSuccess: flowResult.success,
      maestroOutput: flowResult.stdout.slice(0, 500),
      screenshotBefore: captured ? beforePath : null,
      screenshotAfter: captured ? afterPath : null,
    };
    liveResults.push(entry);

    const icon = flowResult.success ? '✓' : '✗';
    console.log(`    ${icon} flow ${flowResult.success ? 'passed' : 'failed'}${captured ? ', screenshot saved' : ''}`);
  }
}

// ── Save data file ─────────────────────────────────────────────────────────────

const outDir = join(ROOT, 'reports', 'prd_evals');
mkdirSync(outDir, { recursive: true });
const dataPath = join(outDir, `${today}_${slug}_data.json`);

const data = {
  scenarioName,
  slug,
  runDate: today,
  mode: live ? 'live' : 'kb',
  scenarioFile: scenarioPath,
  testCases,
  liveResults: live ? liveResults : [],
};

writeFileSync(dataPath, JSON.stringify(data, null, 2));

console.log('');
console.log(`✓ Data saved: reports/prd_evals/${today}_${slug}_data.json`);
console.log('');
console.log('  Next step: ask Claude Code to evaluate this scenario:');
console.log(`  "Evaluate the holistic testing scenario at ${dataPath}"`);
