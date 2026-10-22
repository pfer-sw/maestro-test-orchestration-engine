#!/usr/bin/env node
/**
 * generate-html-report.js
 *
 * Generates an HTML guardrail test report from a JSON results file.
 *
 * Usage:
 *   node scripts/generate-html-report.js <path-to-results.json>
 *
 * Output:
 *   reports/ai_interactions/<date>_<guardrailId>.html
 *
 * JSON schema: see reports/ai_interactions/_schema.json
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Args ─────────────────────────────────────────────────────────────────────
const resultsPath = process.argv[2];
if (!resultsPath) {
  console.error('Usage: node scripts/generate-html-report.js <path-to-results.json>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resultIcon(result) {
  if (result === 'pass')    return '✅';
  if (result === 'fail')    return '❌';
  if (result === 'partial') return '⚠️';
  return escapeHtml(result);
}

function verdictBadgeClass(verdict) {
  if (verdict === 'pass')    return 'badge-pass';
  if (verdict === 'fail')    return 'badge-fail';
  if (verdict === 'partial') return 'badge-partial';
  return '';
}

function verdictBadgeText(verdict) {
  if (verdict === 'pass')    return '✅ Pass';
  if (verdict === 'fail')    return '❌ Fail';
  if (verdict === 'partial') return '⚠️ Partial Pass';
  return escapeHtml(verdict);
}

function overallVerdictBadge(verdict) {
  if (verdict === 'pass')    return `<span class="verdict-badge pass">✅ PASS</span>`;
  if (verdict === 'fail')    return `<span class="verdict-badge fail">❌ FAIL</span>`;
  if (verdict === 'partial') return `<span class="verdict-badge partial">⚠️ PARTIAL</span>`;
  return `<span class="verdict-badge">${escapeHtml(verdict)}</span>`;
}

function priorityClass(priority) {
  if (priority === 'high')   return 'priority-high';
  if (priority === 'medium') return 'priority-medium';
  if (priority === 'low')    return 'priority-low';
  return '';
}

function findingClass(severity) {
  if (severity === 'ok')       return 'ok';
  if (severity === 'critical') return 'critical';
  if (severity === 'warn')     return 'warn';
  return '';
}

// ─── Section renderers ────────────────────────────────────────────────────────
function renderPromptCards(prompts) {
  return prompts.map((p) => `
    <div class="prompt-card">
      <div class="card-header">
        <span class="card-num">Prompt ${p.num}</span>
        <span class="card-title">${escapeHtml(p.title)}</span>
        <span class="badge ${verdictBadgeClass(p.verdict)}">${verdictBadgeText(p.verdict)}</span>
      </div>
      <div class="card-body">
        <div class="input-block">
          <span class="input-label">Input</span>
          <div class="input-text">&ldquo;${escapeHtml(p.input)}&rdquo;</div>
        </div>
        <div class="response-block">
          <div class="response-label">Assistant response</div>
          <div class="response-bubble">
            ${p.response.map(r => `<p>&ldquo;${escapeHtml(r)}&rdquo;</p>`).join('\n            ')}
          </div>
        </div>
        <table class="criteria-table">
          <thead>
            <tr><th>Criterion</th><th>Result</th><th>Notes</th></tr>
          </thead>
          <tbody>
            ${p.criteria.map(c => `
            <tr>
              <td>${escapeHtml(c.criterion)}</td>
              <td><span class="result-icon">${resultIcon(c.result)}</span></td>
              <td class="note-text">${escapeHtml(c.note)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`).join('\n');
}

function renderSummaryTable(data) {
  const headers = data.summaryColumnHeaders || [];
  return `
    <table class="summary-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Prompt</th>
          ${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
          <th>Verdict</th>
        </tr>
      </thead>
      <tbody>
        ${data.prompts.map(p => `
        <tr>
          <td class="prompt-num">${p.num}</td>
          <td class="prompt-desc">${escapeHtml(p.title)}</td>
          ${(p.summaryColumns || []).map(col => `<td>${resultIcon(col)}</td>`).join('')}
          <td><span class="badge ${verdictBadgeClass(p.verdict)}">${verdictBadgeText(p.verdict)}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderFindings(findings) {
  return `
    <div class="findings-list">
      ${findings.map(f => `
      <div class="finding-item ${findingClass(f.severity)}">
        <span class="finding-num">${escapeHtml(f.num)}</span>
        <div class="finding-text">${f.text}</div>
      </div>`).join('\n')}
    </div>`;
}

function renderOpenQuestions(questions) {
  return `
    <div class="questions-list">
      ${questions.map((q, i) => `
      <div class="question-item">
        <span class="q-icon">Q${i + 1}</span>
        ${escapeHtml(q)}
      </div>`).join('\n')}
    </div>`;
}

function renderActions(actions) {
  return `
    <table class="actions-table">
      <thead>
        <tr><th>Priority</th><th>Action</th></tr>
      </thead>
      <tbody>
        ${actions.map(a => `
        <tr>
          <td><span class="${priorityClass(a.priority)}">${a.priority.toUpperCase()}</span></td>
          <td>${escapeHtml(a.action)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

// ─── Full HTML ────────────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Guardrail Test Report &ndash; ${escapeHtml(data.guardrailId)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0d0f12;
    --surface: #13161a;
    --surface2: #1c2026;
    --border: #272c34;
    --border-bright: #3a414d;
    --text: #d6dce6;
    --text-muted: #7a8494;
    --text-dim: #4a5262;
    --accent: #4fc3f7;
    --accent-dim: #1a3a4a;
    --green: #4caf82;
    --green-dim: #0d2e1e;
    --yellow: #f5c842;
    --yellow-dim: #2e2508;
    --red: #f05b5b;
    --red-dim: #2e0d0d;
    --mono: 'IBM Plex Mono', monospace;
    --sans: 'IBM Plex Sans', sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    font-size: 14px;
    line-height: 1.6;
    min-height: 100vh;
  }

  /* HEADER */
  .report-header {
    border-bottom: 1px solid var(--border);
    padding: 40px 48px 32px;
    background: var(--surface);
    position: relative;
    overflow: hidden;
  }
  .report-header::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--red), var(--yellow), var(--accent));
  }
  .header-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
  }
  .header-left .label {
    font-family: var(--mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .report-title {
    font-family: var(--mono);
    font-size: 22px;
    font-weight: 600;
    color: var(--accent);
    letter-spacing: -0.01em;
  }
  .report-title span { color: var(--text-muted); font-weight: 400; }
  .overall-verdict {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }
  .verdict-label {
    font-family: var(--mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-muted);
  }
  .verdict-badge {
    font-family: var(--mono);
    font-size: 18px;
    font-weight: 600;
    padding: 6px 16px;
    border-radius: 4px;
    border: 1.5px solid var(--red);
    color: var(--red);
    background: var(--red-dim);
    letter-spacing: 0.05em;
  }
  .verdict-badge.pass    { border-color: var(--green);  color: var(--green);  background: var(--green-dim); }
  .verdict-badge.partial { border-color: var(--yellow); color: var(--yellow); background: var(--yellow-dim); }
  .verdict-badge.fail    { border-color: var(--red);    color: var(--red);    background: var(--red-dim); }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0;
    margin-top: 28px;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }
  .meta-item {
    padding: 12px 16px;
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  .meta-key {
    font-family: var(--mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-dim);
    margin-bottom: 4px;
  }
  .meta-val {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text);
  }
  .meta-val.tag      { color: var(--accent); }
  .meta-val.critical { color: var(--red); font-weight: 600; }

  /* MAIN */
  .container {
    max-width: 960px;
    margin: 0 auto;
    padding: 40px 48px 80px;
  }

  .section { margin-bottom: 48px; }

  .section-title {
    font-family: var(--mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--text-dim);
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .section-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* GUARDRAIL DEF */
  .def-box {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 24px 28px;
  }
  .def-quote {
    font-style: italic;
    font-size: 13px;
    color: var(--text-muted);
    border-left: 3px solid var(--accent-dim);
    padding-left: 16px;
    margin-bottom: 20px;
    line-height: 1.7;
  }
  .def-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  @media (max-width: 600px) { .def-cols { grid-template-columns: 1fr; } }
  .def-col-title {
    font-family: var(--mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-bottom: 10px;
  }
  .def-col-title.expected  { color: var(--green); }
  .def-col-title.forbidden { color: var(--red); }
  .def-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .def-list li {
    font-size: 12px;
    color: var(--text-muted);
    display: flex;
    gap: 8px;
    align-items: flex-start;
    line-height: 1.5;
  }
  .def-list li::before { content: '•'; flex-shrink: 0; margin-top: 1px; }
  .def-list.expected  li::before { color: var(--green); }
  .def-list.forbidden li::before { color: var(--red); }

  /* PROMPT CARDS */
  .prompt-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 20px;
    overflow: hidden;
    animation: fadeUp 0.4s ease both;
  }
  .prompt-card:nth-child(2) { animation-delay: 0.08s; }
  .prompt-card:nth-child(3) { animation-delay: 0.16s; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    gap: 12px;
    flex-wrap: wrap;
  }
  .card-num {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .card-title { font-weight: 500; color: var(--text); font-size: 13px; flex: 1; }
  .badge {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 3px;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }
  .badge-pass    { background: var(--green-dim);  color: var(--green);  border: 1px solid #1a4a30; }
  .badge-partial { background: var(--yellow-dim); color: var(--yellow); border: 1px solid #3a2d00; }
  .badge-fail    { background: var(--red-dim);    color: var(--red);    border: 1px solid #4a1010; }

  .card-body { padding: 20px; }

  .input-block {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  .input-label {
    font-family: var(--mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-dim);
    padding: 3px 8px;
    border: 1px solid var(--border);
    border-radius: 3px;
    white-space: nowrap;
    margin-top: 2px;
    flex-shrink: 0;
  }
  .input-text {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--accent);
    background: var(--accent-dim);
    border: 1px solid #1f3f52;
    border-radius: 4px;
    padding: 10px 14px;
    line-height: 1.5;
    flex: 1;
  }

  .response-block { margin-bottom: 16px; }
  .response-label {
    font-family: var(--mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-dim);
    margin-bottom: 8px;
  }
  .response-bubble {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-left: 3px solid var(--border-bright);
    border-radius: 4px;
    padding: 12px 14px;
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
    line-height: 1.65;
  }
  .response-bubble p + p { margin-top: 8px; }

  /* CRITERIA TABLE */
  .criteria-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4px;
    font-size: 12px;
  }
  .criteria-table th {
    text-align: left;
    font-family: var(--mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-dim);
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
  }
  .criteria-table td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  .criteria-table tr:last-child td { border-bottom: none; }
  .criteria-table tr:hover td { background: rgba(255,255,255,0.02); }
  .result-icon { font-size: 13px; }
  .note-text { color: var(--text-muted); font-size: 11px; }

  /* SUMMARY TABLE */
  .summary-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }
  .summary-table th {
    background: var(--surface2);
    text-align: left;
    font-family: var(--mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-dim);
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
  }
  .summary-table td {
    padding: 11px 14px;
    border-bottom: 1px solid var(--border);
    color: var(--text-muted);
  }
  .summary-table tr:last-child td { border-bottom: none; }
  .summary-table tr:hover td { background: rgba(255,255,255,0.02); }
  td.prompt-num  { font-family: var(--mono); font-size: 11px; color: var(--text-dim); }
  td.prompt-desc { color: var(--text); font-size: 12px; }

  /* FINDINGS */
  .findings-list { display: flex; flex-direction: column; gap: 12px; }
  .finding-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 16px 20px;
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .finding-item.critical { border-left: 3px solid var(--red); }
  .finding-item.warn     { border-left: 3px solid var(--yellow); }
  .finding-item.ok       { border-left: 3px solid var(--green); }
  .finding-num {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--text-dim);
    flex-shrink: 0;
    padding-top: 2px;
  }
  .finding-text { font-size: 13px; color: var(--text-muted); line-height: 1.6; }
  .finding-text strong { color: var(--text); font-weight: 500; }

  /* OPEN QUESTIONS */
  .questions-list { display: flex; flex-direction: column; gap: 10px; }
  .question-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 14px 18px;
    font-size: 12.5px;
    color: var(--text-muted);
    display: flex;
    gap: 12px;
    align-items: flex-start;
    line-height: 1.6;
  }
  .q-icon {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--accent);
    background: var(--accent-dim);
    border: 1px solid #1f3f52;
    border-radius: 3px;
    padding: 2px 7px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  /* ACTIONS */
  .actions-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }
  .actions-table th {
    background: var(--surface2);
    text-align: left;
    font-family: var(--mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-dim);
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
  }
  .actions-table td {
    padding: 11px 14px;
    border-bottom: 1px solid var(--border);
    color: var(--text-muted);
    vertical-align: top;
  }
  .actions-table tr:last-child td { border-bottom: none; }
  .priority-high   { color: var(--red);    font-family: var(--mono); font-size: 10px; font-weight: 600; letter-spacing: 0.06em; }
  .priority-medium { color: var(--yellow); font-family: var(--mono); font-size: 10px; font-weight: 600; letter-spacing: 0.06em; }
  .priority-low    { color: var(--green);  font-family: var(--mono); font-size: 10px; font-weight: 600; letter-spacing: 0.06em; }

  /* FOOTER */
  .report-footer {
    border-top: 1px solid var(--border);
    padding: 20px 48px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .footer-text { font-family: var(--mono); font-size: 10px; color: var(--text-dim); }

  code {
    font-family: var(--mono);
    font-size: 11px;
    background: var(--surface2);
    padding: 1px 5px;
    border-radius: 3px;
  }
</style>
</head>
<body>

<header class="report-header">
  <div class="header-top">
    <div class="header-left">
      <div class="label">Guardrail Test Report</div>
      <div class="report-title"><span>guardrail /</span> ${escapeHtml(data.guardrailId)}</div>
    </div>
    <div class="overall-verdict">
      <span class="verdict-label">Overall Verdict</span>
      ${overallVerdictBadge(data.overallVerdict)}
    </div>
  </div>
  <div class="meta-grid">
    <div class="meta-item"><div class="meta-key">Date</div><div class="meta-val">${escapeHtml(data.date)}</div></div>
    <div class="meta-item"><div class="meta-key">Tester</div><div class="meta-val">${escapeHtml(data.tester)}</div></div>
    <div class="meta-item"><div class="meta-key">Test account</div><div class="meta-val">${escapeHtml(data.account ?? data.member)}</div></div>
    <div class="meta-item"><div class="meta-key">Device</div><div class="meta-val">${escapeHtml(data.device)}</div></div>
    <div class="meta-item"><div class="meta-key">App Flavor</div><div class="meta-val tag">${escapeHtml(data.flavor)} (${escapeHtml(data.packageName)})</div></div>
    <div class="meta-item"><div class="meta-key">Guardrail ID</div><div class="meta-val tag">${escapeHtml(data.guardrailId)}</div></div>
    <div class="meta-item"><div class="meta-key">Category</div><div class="meta-val tag">${escapeHtml(data.category)}</div></div>
    <div class="meta-item"><div class="meta-key">Action</div><div class="meta-val tag">${escapeHtml(data.action)}</div></div>
    <div class="meta-item"><div class="meta-key">Severity</div><div class="meta-val critical">${escapeHtml(data.severity)}</div></div>
  </div>
</header>

<main class="container">

  ${data.definition ? `
  <section class="section">
    <div class="section-title">Guardrail Definition</div>
    <div class="def-box">
      <div class="def-quote">${escapeHtml(data.definition.description)}</div>
      <div class="def-cols">
        <div>
          <div class="def-col-title expected">Expected Behavior</div>
          <ul class="def-list expected">
            ${data.definition.expectedBehaviors.map(b => `<li>${escapeHtml(b)}</li>`).join('\n            ')}
          </ul>
        </div>
        <div>
          <div class="def-col-title forbidden">Forbidden Behavior</div>
          <ul class="def-list forbidden">
            ${data.definition.forbiddenBehaviors.map(b => `<li>${escapeHtml(b)}</li>`).join('\n            ')}
          </ul>
        </div>
      </div>
    </div>
  </section>` : ''}

  <section class="section">
    <div class="section-title">Test Results</div>
    ${renderPromptCards(data.prompts)}
  </section>

  <section class="section">
    <div class="section-title">Summary</div>
    ${renderSummaryTable(data)}
  </section>

  <section class="section">
    <div class="section-title">Key Findings</div>
    ${renderFindings(data.findings)}
  </section>

  <section class="section">
    <div class="section-title">Open Questions for Team</div>
    ${renderOpenQuestions(data.openQuestions)}
  </section>

  <section class="section">
    <div class="section-title">Recommended Actions</div>
    ${renderActions(data.actions)}
  </section>

</main>

<footer class="report-footer">
  <span class="footer-text">${escapeHtml(data.guardrailId)} &middot; ${escapeHtml(data.category)} &middot; ${escapeHtml(data.date)}</span>
  <span class="footer-text">escalateOnFailure: ${data.escalateOnFailure} &middot; Overall: ${data.overallVerdict.toUpperCase()}</span>
</footer>

</body>
</html>`;

// ─── Write output ─────────────────────────────────────────────────────────────
const outDir  = path.join(__dirname, '..', 'reports', 'ai_interactions');
const outFile = path.join(outDir, `${data.date}_${data.guardrailId}.html`);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html, 'utf8');

console.log(`✅ Report written to: ${outFile}`);
