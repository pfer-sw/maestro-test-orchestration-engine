#!/usr/bin/env node
/**
 * app-run-report.js — one HTML page per matrix: the latest Android app (Maestro) result for every case.
 *
 * Sources (never edited here):
 *   config/matrices/<matrix>.json          — the case list (imported from the wiki)
 *   reports/app_runs/<YYYY-MM-DD>/<id>.json — one run record per case run (newest date wins)
 *   reports/app_runs/<YYYY-MM-DD>/<file>    — screenshots named in a record's `screenshots[]`
 * Output: reports/app_runs/report_<matrix>.html (local, gitignored). Screenshots are embedded as
 * base64 data URIs; a case with none shows "not captured".
 *
 * Usage:
 *   node scripts/app-run-report.js [--matrix=pulse-onboarding-v2] [--out=<path>]
 *
 * Run record: { caseId, runAt, environment, model, profile, trigger, verdict
 * (PASS | PARTIAL | FAIL | BLOCKED | NEEDS INPUT; PARTIAL = some runs or checks of the case not done), checks[{check, result, evidence?, note?}],
 * observed{ protocolFromReasoning?, agentShownInUi?, toolCalls[{name, suggested_task?, content[]}] },
 * screenshots[{file, label}], matrixIssues[{caseId, issue, action}] }.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { resolve, dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';
import minimist from 'minimist';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = minimist(process.argv.slice(2));
const MATRIX_ID = args.matrix ?? 'pulse-onboarding-v2';
const MATRIX_PATH = resolve(ROOT, 'config/matrices', `${MATRIX_ID}.json`);
const RUNS_DIR = resolve(ROOT, 'reports/app_runs');
const OUT = resolve(ROOT, args.out ?? `reports/app_runs/report_${MATRIX_ID}.html`);

if (!existsSync(MATRIX_PATH)) { console.error(`✗ Matrix not found: ${MATRIX_PATH}`); process.exit(1); }
const matrix = JSON.parse(readFileSync(MATRIX_PATH, 'utf8'));
const caseIds = new Set(matrix.testCases.map(c => c.id));

// ── latest record per case (date folders sorted ascending, so later ones overwrite) ──
const latest = new Map();
const dateDirs = existsSync(RUNS_DIR)
  ? readdirSync(RUNS_DIR).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && statSync(join(RUNS_DIR, d)).isDirectory()).sort()
  : [];
for (const d of dateDirs) {
  for (const f of readdirSync(join(RUNS_DIR, d)).filter(f => f.endsWith('.json')).sort()) {
    const rec = JSON.parse(readFileSync(join(RUNS_DIR, d, f), 'utf8'));
    if (!caseIds.has(rec.caseId)) continue;
    latest.set(rec.caseId, { ...rec, _dir: join(RUNS_DIR, d), _date: d });
  }
}

// Matrix issues from every record; one entry per (case, issue), newest wins.
const issues = new Map();
for (const rec of latest.values()) for (const i of rec.matrixIssues ?? []) issues.set(`${i.caseId}|${i.issue}`, { ...i, foundIn: rec.caseId });

// ── helpers ─────────────────────────────────────────────────────────────────
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const VERDICTS = ['PASS', 'PARTIAL', 'FAIL', 'BLOCKED', 'NEEDS INPUT', 'NOT RUN'];
const vClass = v => 'v-' + v.toLowerCase().replace(/\s+/g, '-');
const verdictOf = c => latest.get(c.id)?.verdict ?? 'NOT RUN';

function screenshots(rec) {
  const shots = (rec.screenshots ?? []).map(s => {
    const p = join(rec._dir, s.file);
    if (!existsSync(p)) return `<figure><span class="screenshot-missing">not captured</span><figcaption>${esc(s.label)} (${esc(s.file)} missing)</figcaption></figure>`;
    const uri = `data:${MIME[extname(p).toLowerCase()] ?? 'image/png'};base64,${readFileSync(p).toString('base64')}`;
    return `<figure><img src="${uri}" alt="${esc(s.label)}"><figcaption>${esc(s.label)}</figcaption></figure>`;
  });
  return shots.length ? shots.join('') : '<span class="screenshot-missing">not captured</span>';
}

function caseDetail(c) {
  const rec = latest.get(c.id);
  const spec = `
    <div class="spec">
      <p><b>Preconditions</b> ${esc(c.preconditions)}</p>
      <p><b>Trigger</b> ${esc(c.testPrompt)}</p>
      <p><b>Expected</b></p><ul>${c.expectedBehaviors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>
      ${c.unexpectedBehaviors.length ? `<p><b>Fail if</b></p><ul>${c.unexpectedBehaviors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
      ${c.appCheck ? `<p><b>In-app check (Maestro)</b> ${esc(c.appCheck)}</p>` : ''}
      <p class="muted">Sources: ${esc(c.sources || '—')}${c.jira ? ` · <a href="${esc(c.jira)}">${esc(c.jira.split('/').pop())}</a>` : ''}</p>
    </div>`;
  if (!rec) return spec;
  const checks = (rec.checks ?? []).map(k => `<tr><td>${esc(k.check)}</td><td class="${k.result === 'pass' ? 'ok' : k.result === 'fail' ? 'bad' : 'warn'}">${esc(k.result)}</td><td>${esc([k.evidence, k.note].filter(Boolean).join(' — '))}</td></tr>`).join('');
  const calls = (rec.observed?.toolCalls ?? []).map(t => `
      <div class="call"><code>${esc(t.name)}</code>${t.suggested_task ? ` · suggested_task=<code>${esc(t.suggested_task)}</code>` : ''}
        ${t.content?.length ? `<blockquote>${t.content.map(esc).join('<br>')}</blockquote>` : ''}</div>`).join('');
  return `${spec}
    <div class="run">
      <p class="muted">Run ${esc(rec.runAt)} · ${esc(rec.environment)} · model ${esc(rec.model)}<br>Profile: ${esc(rec.profile)}<br>Trigger sent: ${esc(rec.trigger)}</p>
      ${rec.observed?.protocolFromReasoning ? `<p><b>Protocol (from reasoning)</b> <code>${esc(rec.observed.protocolFromReasoning)}</code> · <b>Agent shown in UI</b> ${esc(rec.observed.agentShownInUi ?? 'not shown')}</p>` : ''}
      ${calls}
      ${checks ? `<table class="checks"><tr><th>Check</th><th>Result</th><th>Evidence / note</th></tr>${checks}</table>` : ''}
      <div class="shots">${screenshots(rec)}</div>
    </div>`;
}

// ── page ────────────────────────────────────────────────────────────────────
const counts = Object.fromEntries(VERDICTS.map(v => [v, 0]));
for (const c of matrix.testCases) counts[verdictOf(c)]++;
const ran = matrix.testCases.length - counts['NOT RUN'];
const bySection = new Map();
for (const c of matrix.testCases) bySection.set(c.category, [...(bySection.get(c.category) ?? []), c]);

const sections = [...bySection].map(([name, cases]) => `
  <h2>${esc(name)}</h2>
  ${cases.map(c => {
    const v = verdictOf(c), manual = c.manualResult ?? '—';
    return `<details${v !== 'NOT RUN' ? ' open' : ''}>
      <summary><span class="id">${esc(c.id)}</span><span class="verdict ${vClass(v)}">${esc(v)}</span>
        <span class="title">${esc(c.title)}</span>
        <span class="meta">${esc(c.priority)} · ${esc(c.testType)} · manual: ${esc(manual)}</span></summary>
      ${caseDetail(c)}
    </details>`;
  }).join('')}`).join('');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>App Test Report</title>
<style>
  :root { --bg:#fff; --fg:#1d2430; --muted:#5d6676; --line:#e3e6eb; --card:#f6f7f9;
          --pass:#1f7a3a; --fail:#b42323; --blocked:#8a5a00; --input:#5b3fb0; --notrun:#6b7280; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#14171c; --fg:#e6e9ee; --muted:#9aa3b2; --line:#2a2f37; --card:#1c2027;
          --pass:#4cc274; --fail:#f07070; --blocked:#e0a83a; --input:#a48cf0; --notrun:#9aa3b2; } }
  :root[data-theme="dark"] { --bg:#14171c; --fg:#e6e9ee; --muted:#9aa3b2; --line:#2a2f37; --card:#1c2027;
          --pass:#4cc274; --fail:#f07070; --blocked:#e0a83a; --input:#a48cf0; --notrun:#9aa3b2; }
  body { background:var(--bg); color:var(--fg); font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; margin:0 auto; padding:24px 16px 64px; max-width:1100px; }
  h1 { font-size:22px; margin:0 0 4px; } h2 { font-size:17px; margin:32px 0 8px; border-bottom:1px solid var(--line); padding-bottom:4px; }
  .muted { color:var(--muted); font-size:13px; }
  .tiles { display:flex; flex-wrap:wrap; gap:8px; margin:16px 0; }
  .tile { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:8px 14px; min-width:96px; }
  .tile b { display:block; font-size:22px; }
  details { border:1px solid var(--line); border-radius:8px; margin:6px 0; background:var(--card); }
  summary { cursor:pointer; padding:8px 12px; display:flex; flex-wrap:wrap; gap:8px; align-items:baseline; }
  .id { font-weight:600; font-family:ui-monospace,monospace; } .title { flex:1 1 300px; } .meta { color:var(--muted); font-size:12px; }
  .verdict { font-size:12px; font-weight:700; padding:1px 8px; border-radius:10px; border:1px solid currentColor; }
  .v-pass { color:var(--pass); } .v-partial { color:var(--input); } .v-fail { color:var(--fail); } .v-blocked { color:var(--blocked); } .v-needs-input { color:var(--input); } .v-not-run { color:var(--notrun); }
  .spec, .run { padding:0 14px 10px; } .run { border-top:1px dashed var(--line); padding-top:10px; }
  ul { margin:4px 0 8px; padding-left:20px; } p { margin:6px 0; }
  code { font-family:ui-monospace,monospace; font-size:13px; }
  blockquote { margin:6px 0; padding:6px 10px; border-left:3px solid var(--line); }
  table { border-collapse:collapse; width:100%; font-size:13px; margin:8px 0; } th, td { text-align:left; border-bottom:1px solid var(--line); padding:4px 6px; vertical-align:top; }
  .ok { color:var(--pass); font-weight:600; } .bad { color:var(--fail); font-weight:600; } .warn { color:var(--blocked); font-weight:600; }
  .shots { display:flex; flex-wrap:wrap; gap:10px; } figure { margin:0; max-width:100%; } img { max-width:min(420px,100%); border:1px solid var(--line); border-radius:6px; }
  figcaption { font-size:12px; color:var(--muted); max-width:420px; }
  .screenshot-missing { color:var(--muted); font-style:italic; }
  .issues { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:8px 14px; }
</style></head><body>
<h1>${esc(matrix.label)}</h1>
<p class="muted">Matrix <code>config/matrices/${esc(MATRIX_ID)}.json</code> v${esc(matrix.version)} · ${ran}/${matrix.testCases.length} cases run · generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</p>
<div class="tiles">${VERDICTS.map(v => `<div class="tile"><b class="${vClass(v)}">${counts[v]}</b>${esc(v)}</div>`).join('')}</div>
${issues.size ? `<h2>Matrix issues</h2><div class="issues"><ul>${[...issues.values()].map(i => `<li><b>${esc(i.caseId)}</b>: ${esc(i.issue)} — <i>${esc(i.action)}</i> <span class="muted">(found while running ${esc(i.foundIn)})</span></li>`).join('')}</ul></div>` : ''}
${sections}
</body></html>
`;
writeFileSync(OUT, html);
console.log(`✓ ${ran}/${matrix.testCases.length} cases run → ${OUT}`);
console.log('  ' + VERDICTS.map(v => `${v}: ${counts[v]}`).join(' · '));
