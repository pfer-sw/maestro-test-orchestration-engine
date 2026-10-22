#!/usr/bin/env node
/**
 * generate-design-audit-report.js
 *
 * Generates an HTML design audit report from JSON comparison results written by Claude
 * during a --compare-figma test run.
 *
 * Usage:
 *   node scripts/generate-design-audit-report.js [--date=YYYY-MM-DD] [--flavor=<id>] [--mapping=config/figma-mapping-cv.json]
 *
 * Input:
 *   reports/design-audit/<date>/*.json
 *
 * Output:
 *   reports/design-audit/<date>/design-audit-report.html
 *
 * Style: light "guardrails" theme (see reports/guardrails/*.html) — this is the
 * STANDARD house style for every run. Screenshots are embedded as base64 data URIs
 * so the report is fully self-contained and portable.
 *
 * Exit codes:
 *   0 — report written, no critical mismatches (fail results)
 *   1 — report written, one or more critical mismatches found
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import minimist from 'minimist';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = minimist(process.argv.slice(2));
const dateArg = args.date ?? new Date().toISOString().slice(0, 10);
const flavorFilter = args.flavor ?? null;

const auditDir = path.resolve(ROOT, 'reports', 'design-audit', dateArg);

if (!fs.existsSync(auditDir)) {
  console.warn(`No design audit data found for date ${dateArg} at: ${auditDir}`);
  process.exit(0);
}

// ─── Load results ─────────────────────────────────────────────────────────────

const jsonFiles = fs.readdirSync(auditDir)
  .filter((f) => f.endsWith('.json') && !f.startsWith('_') && f !== 'design-audit-report.html');

if (jsonFiles.length === 0) {
  console.warn(`No JSON result files found in ${auditDir} — nothing to report.`);
  process.exit(0);
}

const results = jsonFiles
  .map((f) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(auditDir, f), 'utf8'));
    } catch (e) {
      console.warn(`Could not parse ${f}: ${e.message}`);
      return null;
    }
  })
  .filter(Boolean)
  .filter((r) => !flavorFilter || r.flavor === flavorFilter);

if (results.length === 0) {
  console.warn(`No results to report${flavorFilter ? ` for flavor "${flavorFilter}"` : ''}.`);
  process.exit(0);
}

// ─── Untested Figma screens ───────────────────────────────────────────────────

const mappingPath = path.resolve(ROOT, args.mapping ?? 'config/figma-mapping.json');
let untestedScreens = []; // entries mapped in figma-mapping.json but absent from results
if (fs.existsSync(mappingPath)) {
  try {
    const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    const screens = mapping.screens ?? {};
    const testedIds = new Set(results.map((r) => r.flowId));
    untestedScreens = Object.entries(screens)
      .filter(([k]) => !k.startsWith('_example') && !testedIds.has(k))
      .map(([k, v]) => ({ flowId: k, figmaFrameName: v.figmaFrameName ?? k, sequenceIndex: v.sequenceIndex }))
      .sort((a, b) => (a.sequenceIndex ?? Infinity) - (b.sequenceIndex ?? Infinity));
  } catch (e) {
    // ignore parse errors
  }
}

// ─── Counters ─────────────────────────────────────────────────────────────────

const counts = { pass: 0, warn: 0, fail: 0, error: 0 };
for (const r of results) counts[r.overallResult] = (counts[r.overallResult] ?? 0) + 1;
const hasFails = counts.fail > 0;

// Sort by sequenceIndex ascending (preserves flow order in report), then alphabetically by flowId
results.sort((a, b) => {
  const ai = typeof a.sequenceIndex === 'number' ? a.sequenceIndex : Infinity;
  const bi = typeof b.sequenceIndex === 'number' ? b.sequenceIndex : Infinity;
  if (ai !== bi) return ai - bi;
  return (a.flowId ?? '').localeCompare(b.flowId ?? '');
});

const flavors = [...new Set(results.map((r) => r.flavor).filter(Boolean))];
const runDates = [...new Set(results.map((r) => r.runDate).filter(Boolean))];
const allDiscrepancies = results.flatMap((r) =>
  (r.discrepancies ?? []).map((d) => ({ ...d, flowId: r.flowId, flowName: r.flowName }))
).sort((a, b) => {
  const s = { critical: 0, warn: 1, info: 2 };
  return (s[a.severity] ?? 3) - (s[b.severity] ?? 3);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Embed screenshots as base64 data URIs so the report is self-contained.
function dataUri(p) {
  if (!p) return '';
  const abs = path.isAbsolute(p) ? p : path.resolve(ROOT, p);
  try {
    const buf = fs.readFileSync(abs);
    const ext = path.extname(abs).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.webp' ? 'image/webp'
      : ext === '.gif' ? 'image/gif'
      : 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (e) {
    return '';
  }
}

function verdictPillClass(result) {
  if (result === 'pass')  return 'verdict-pass';
  if (result === 'warn')  return 'verdict-warn';
  if (result === 'fail')  return 'verdict-fail';
  if (result === 'error') return 'verdict-error';
  return '';
}
function verdictPillText(result) {
  if (result === 'pass')  return '✓ PASS';
  if (result === 'warn')  return '⚠ WARN';
  if (result === 'fail')  return '✕ MISMATCH';
  if (result === 'error') return '⚑ ERROR';
  return esc(result).toUpperCase();
}
function numberBgClass(result) {
  if (result === 'pass')  return 'bg-green';
  if (result === 'warn')  return 'bg-amber';
  if (result === 'fail')  return 'bg-red';
  return 'bg-gray';
}

// severity → criteria-card class + icon
function critClass(sev) {
  if (sev === 'critical') return 'fail';
  if (sev === 'warn')     return 'warn';
  return 'info';
}
function critIcon(sev) {
  if (sev === 'critical') return '❌';
  if (sev === 'warn')     return '⚠️';
  return 'ℹ️';
}
function sevCellClass(sev) {
  if (sev === 'critical') return 'sev-high';
  if (sev === 'warn')     return 'sev-med';
  if (sev === 'info')     return 'sev-info';
  return '';
}
function sevLabel(sev) {
  if (sev === 'critical') return 'CRITICAL';
  if (sev === 'warn')     return 'WARN';
  if (sev === 'info')     return 'INFO';
  return esc(sev ?? '').toUpperCase();
}

const auditedTotal = counts.pass + counts.warn + counts.fail;
const passPercent = auditedTotal > 0 ? Math.round((counts.pass / auditedTotal) * 100) : 0;

// ─── Card renderer ────────────────────────────────────────────────────────────

function renderCard(r, idx) {
  const figmaSrc = dataUri(r.figmaScreenshotPath);
  const appSrc   = dataUri(r.appScreenshotPath);
  const discList = (r.discrepancies ?? []);
  const matchList = (r.matchedElements ?? []);
  const missingFromApp   = (r.figmaMissingFromApp ?? []);
  const missingFromFigma = (r.appMissingFromFigma ?? []);
  const importantNotes   = (r.importantNotes ?? []);

  return `
    <div class="round-card" id="${esc(r.flowId)}">
      <div class="round-header">
        <div class="round-number ${numberBgClass(r.overallResult)}">${idx + 1}</div>
        <div class="round-title">
          <h3>${esc(r.flowName || r.flowId)}</h3>
          <span class="flow-id-badge">${esc(r.flowId)}</span>
          ${r.figmaFrameName ? `<span class="figma-badge">Figma: ${esc(r.figmaFrameName)}</span>` : ''}
        </div>
        <div class="verdict-pill ${verdictPillClass(r.overallResult)}">${verdictPillText(r.overallResult)}</div>
      </div>
      <div class="round-body">

        ${r.overallResult === 'error' ? `
        <div class="no-response"><div class="icon">⚑</div>Figma frame could not be fetched: ${esc(r.error)}</div>
        ` : `
        <div class="comparison-grid">
          <div class="comp-panel">
            <div class="comp-label">Figma Design</div>
            ${figmaSrc
              ? `<img class="comp-img" src="${figmaSrc}" alt="Figma reference for ${esc(r.flowId)}">`
              : `<div class="comp-placeholder">No Figma screenshot</div>`}
          </div>
          <div class="comp-panel">
            <div class="comp-label">App Screenshot</div>
            ${appSrc
              ? `<img class="comp-img" src="${appSrc}" alt="App screenshot for ${esc(r.flowId)}">`
              : `<div class="comp-placeholder">No app screenshot</div>`}
          </div>
        </div>
        `}

        ${r.summary ? `<div class="summary-text">${esc(r.summary)}</div>` : ''}

        ${importantNotes.length > 0 ? `
        <div class="notes-banner">
          <div class="notes-header">⚠ Important Notes</div>
          <ul class="notes-list">
            ${importantNotes.map((n) => `<li>${esc(n)}</li>`).join('')}
          </ul>
        </div>` : ''}

        ${discList.length > 0 ? `
        <div class="block-label">Discrepancies (${discList.length})</div>
        <div class="criteria-grid">
          ${discList.map((d) => `
          <div class="criterion ${critClass(d.severity)}">
            <span class="icon">${critIcon(d.severity)}</span>
            <div class="text">
              <strong>${esc(d.element)}</strong>
              <span class="vals"><span class="v-figma">${esc(d.figmaValue)}</span> <span class="arrow">→</span> <span class="v-app">${esc(d.appValue)}</span></span>
              ${d.description ? `<span class="desc">${esc(d.description)}</span>` : ''}
            </div>
          </div>`).join('')}
        </div>` : ''}

        ${missingFromApp.length > 0 ? `
        <div class="block-label">In Figma, missing from app (${missingFromApp.length})</div>
        <ul class="missing-list missing-app">${missingFromApp.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}

        ${missingFromFigma.length > 0 ? `
        <div class="block-label">In app, not in Figma (${missingFromFigma.length})</div>
        <ul class="missing-list missing-figma">${missingFromFigma.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}

        ${matchList.length > 0 ? `
        <details class="matched-section">
          <summary>Matched elements (${matchList.length})</summary>
          <div class="matched-grid">
            ${matchList.map((m) => `<span class="matched-item">✓ ${esc(m.element)}</span>`).join('')}
          </div>
        </details>` : ''}

        ${r.confidence === 'low' ? `<div class="conf-note">Low confidence: ${esc(r.confidenceNote)}</div>` : ''}
      </div>
    </div>`;
}

// ─── Untested screens section ─────────────────────────────────────────────────

function renderUntestedScreens() {
  if (untestedScreens.length === 0) return '';
  return `
  <section>
    <h2>Figma Screens Not Tested (${untestedScreens.length})</h2>
    <div class="observations">
      <div class="observation-item">
        <span class="dot dot-amber"></span>
        <div>These screens are mapped in <code>${path.relative(ROOT, mappingPath)}</code> but have no comparison result in this run — they may represent missing app content or simply screens not reached.</div>
      </div>
      ${untestedScreens.map((s) => `
      <div class="observation-item">
        <span class="dot dot-blue"></span>
        <div><strong>${esc(s.flowId)}</strong>${s.figmaFrameName ? ` — ${esc(s.figmaFrameName)}` : ''}</div>
      </div>`).join('')}
    </div>
  </section>`;
}

// ─── Discrepancy table ────────────────────────────────────────────────────────

function renderDiscTable() {
  if (allDiscrepancies.length === 0) return '';
  return `
  <section>
    <h2>All Discrepancies</h2>
    <table>
      <thead>
        <tr><th>Screen</th><th>Severity</th><th>Element</th><th>Figma</th><th>App</th></tr>
      </thead>
      <tbody>
        ${allDiscrepancies.map((d) => `
        <tr>
          <td><a href="#${esc(d.flowId)}" class="link">${esc(d.flowId)}</a></td>
          <td><span class="${sevCellClass(d.severity)}">${sevLabel(d.severity)}</span></td>
          <td>${esc(d.element)}</td>
          <td class="v-figma">${esc(d.figmaValue)}</td>
          <td class="v-app">${esc(d.appValue)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </section>`;
}

// ─── Full HTML ────────────────────────────────────────────────────────────────

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Design Audit Report — ${esc(dateArg)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f6f9; color: #1a1a2e; }

    header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
      padding: 36px 48px;
    }
    header h1 { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.3px; }
    header .meta { margin-top: 8px; font-size: 0.85rem; color: #a0aec0; display: flex; gap: 24px; flex-wrap: wrap; }
    header .meta span strong { color: #e2e8f0; }

    .container { max-width: 1000px; margin: 0 auto; padding: 40px 24px; }

    /* Summary banner */
    .summary-banner {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 40px;
    }
    .stat-card {
      background: #fff;
      border-radius: 12px;
      padding: 20px 24px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      text-align: center;
    }
    .stat-card .value { font-size: 2rem; font-weight: 800; }
    .stat-card .label { font-size: 0.78rem; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .pass   { color: #16a34a; }
    .fail   { color: #dc2626; }
    .warn   { color: #d97706; }
    .info   { color: #2563eb; }
    .gray   { color: #64748b; }

    /* Progress bar */
    .progress-wrap { display: flex; align-items: center; gap: 14px; margin: -20px 0 40px; }
    .progress-bar { flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 4px; width: ${passPercent}%;
      background: ${hasFails ? '#dc2626' : counts.warn > 0 ? '#d97706' : '#16a34a'}; }
    .progress-label { font-size: 0.82rem; color: #64748b; font-weight: 600; white-space: nowrap; }

    /* Section */
    section { margin-bottom: 40px; }
    section h2 { font-size: 1.1rem; font-weight: 700; color: #1e293b; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }

    /* Screen card */
    .round-card { background: #fff; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); overflow: hidden; margin-bottom: 20px; }
    .round-header { display: flex; align-items: center; gap: 16px; padding: 16px 24px; border-bottom: 1px solid #f1f5f9; }
    .round-number { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; color: #fff; flex-shrink: 0; }
    .bg-green { background: #16a34a; }
    .bg-amber { background: #d97706; }
    .bg-red   { background: #dc2626; }
    .bg-gray  { background: #64748b; }

    .round-header .round-title { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .round-header .round-title h3 { font-size: 1rem; font-weight: 700; }
    .flow-id-badge { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.72rem; color: #2563eb; }
    .figma-badge { display: inline-block; width: fit-content; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: #eef2ff; color: #4338ca; }

    .verdict-pill { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 999px; font-size: 0.8rem; font-weight: 700; white-space: nowrap; }
    .verdict-pass  { background: #dcfce7; color: #15803d; }
    .verdict-warn  { background: #fef3c7; color: #92400e; }
    .verdict-fail  { background: #fee2e2; color: #b91c1c; }
    .verdict-error { background: #f1f5f9; color: #475569; }

    .round-body { padding: 24px; }

    /* Comparison grid */
    .comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 22px; }
    @media (max-width: 720px) { .comparison-grid { grid-template-columns: 1fr; } }
    .comp-panel { display: flex; flex-direction: column; gap: 8px; }
    .comp-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600; }
    .comp-img { width: 100%; max-height: 620px; object-fit: contain; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; }
    .comp-placeholder { height: 240px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; color: #94a3b8; font-size: 0.85rem; }

    .summary-text { background: #f8fafc; border-left: 4px solid #2563eb; border-radius: 0 8px 8px 0; padding: 14px 18px; font-size: 0.92rem; color: #334155; font-style: italic; margin-bottom: 20px; }

    .block-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600; margin: 20px 0 10px; }

    /* Notes banner */
    .notes-banner { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 18px; margin-bottom: 8px; }
    .notes-header { font-size: 0.78rem; font-weight: 700; color: #92400e; margin-bottom: 8px; }
    .notes-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
    .notes-list li { font-size: 0.88rem; color: #78350f; line-height: 1.5; padding-left: 4px; }

    /* Criteria (discrepancies) grid */
    .criteria-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; }
    .criterion { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 8px; font-size: 0.85rem; }
    .criterion.info { background: #eff6ff; border: 1px solid #bfdbfe; }
    .criterion.fail { background: #fef2f2; border: 1px solid #fecaca; }
    .criterion.warn { background: #fffbeb; border: 1px solid #fde68a; }
    .criterion .icon { font-size: 1rem; flex-shrink: 0; margin-top: 1px; }
    .criterion .text { color: #374151; line-height: 1.45; display: flex; flex-direction: column; gap: 3px; }
    .criterion .text strong { color: #1e293b; }
    .criterion .vals { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.78rem; }
    .v-figma { color: #2563eb; }
    .v-app   { color: #b45309; }
    .arrow   { color: #94a3b8; }
    .criterion .desc { color: #64748b; font-size: 0.82rem; margin-top: 2px; }

    .missing-list { list-style: none; display: flex; flex-direction: column; gap: 5px; }
    .missing-list li { font-size: 0.86rem; color: #475569; padding-left: 14px; position: relative; }
    .missing-list li::before { content: '—'; position: absolute; left: 0; }
    .missing-app li::before { color: #dc2626; }
    .missing-figma li::before { color: #d97706; }

    .matched-section { margin-top: 16px; }
    .matched-section summary { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; cursor: pointer; }
    .matched-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .matched-item { font-size: 0.78rem; color: #15803d; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 999px; padding: 3px 10px; }

    .conf-note { margin-top: 14px; font-size: 0.82rem; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; }

    .no-response { background: #fff7ed; border: 1px dashed #fed7aa; border-radius: 12px; padding: 16px 20px; color: #92400e; font-size: 0.9rem; }
    .no-response .icon { font-size: 1.3rem; margin-bottom: 6px; }

    /* Observations / untested */
    .observations { background: #f8fafc; border-radius: 10px; padding: 20px 24px; }
    .observation-item { display: flex; gap: 12px; margin-bottom: 14px; font-size: 0.9rem; line-height: 1.55; }
    .observation-item:last-child { margin-bottom: 0; }
    .observation-item .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 7px; }
    .dot-blue { background: #2563eb; }
    .dot-amber { background: #d97706; }
    .observations code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.82rem; background: #eef2ff; padding: 1px 6px; border-radius: 4px; color: #4338ca; }

    /* Table */
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
    thead { background: #f8fafc; }
    th { padding: 12px 16px; text-align: left; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; color: #374151; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    td.v-figma, td.v-app { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.8rem; }
    .link { color: #2563eb; text-decoration: none; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
    .link:hover { text-decoration: underline; }
    .sev-low  { color: #16a34a; font-weight: 700; }
    .sev-med  { color: #d97706; font-weight: 700; }
    .sev-high { color: #dc2626; font-weight: 700; }
    .sev-info { color: #2563eb; font-weight: 700; }

    footer { text-align: center; padding: 32px; font-size: 0.8rem; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 20px; }
  </style>
</head>
<body>

<header>
  <h1>Design Audit Report — Figma vs. App</h1>
  <div class="meta">
    <span><strong>Date:</strong> ${esc(dateArg)}</span>
    ${runDates.length ? `<span><strong>Run:</strong> ${esc(runDates.join(', '))}</span>` : ''}
    <span><strong>Flavor:</strong> ${esc(flavors.join(', ') || flavorFilter || 'all')}</span>
    <span><strong>Screens audited:</strong> ${results.length}</span>
  </div>
</header>

<div class="container">

  <div class="summary-banner">
    <div class="stat-card"><div class="value info">${results.length}</div><div class="label">Screens Audited</div></div>
    <div class="stat-card"><div class="value pass">${counts.pass}</div><div class="label">Pass</div></div>
    <div class="stat-card"><div class="value warn">${counts.warn}</div><div class="label">Warn</div></div>
    <div class="stat-card"><div class="value fail">${counts.fail}</div><div class="label">Mismatches</div></div>
    <div class="stat-card"><div class="value ${allDiscrepancies.length > 0 ? 'fail' : 'pass'}">${allDiscrepancies.length}</div><div class="label">Discrepancies</div></div>
  </div>

  <div class="progress-wrap">
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <span class="progress-label">${passPercent}% clean</span>
  </div>

  ${renderUntestedScreens()}

  <section>
    <h2>Screen Comparisons (${results.length})</h2>
    ${results.map((r, i) => renderCard(r, i)).join('\n')}
  </section>

  ${renderDiscTable()}

</div>

<footer>
  Generated by Maestro MCP Design Audit · ${esc(dateArg)} · ${results.length} screens · Flavor: ${esc(flavors.join(', ') || flavorFilter || 'all')}
</footer>

</body>
</html>`;

// ─── Write output ─────────────────────────────────────────────────────────────
const outFile = path.join(auditDir, 'design-audit-report.html');
fs.writeFileSync(outFile, html, 'utf8');
console.log(`Design audit report written to: ${outFile}`);

if (hasFails) {
  console.log(`${counts.fail} critical design mismatch(es) found.`);
  process.exit(1);
}
process.exit(0);
