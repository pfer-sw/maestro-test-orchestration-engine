#!/usr/bin/env node
/**
 * testability-report.js — consolidated, per-feature HTML view of the testability register.
 *
 * Source of truth: docs/testability/missing-resource-ids.md (never edited here).
 * Output: reports/testability/missing-ids_<YYYY-MM-DD>.html (local, gitignored).
 *
 * Usage:
 *   node scripts/testability-report.js [--date=YYYY-MM-DD] [--out=<path>]
 *
 * Every 7-column row under an "## Open — …" or "## GOOD EXAMPLE — …" heading is one open
 * element. Tables whose header starts with "Element" (no Screen column) use the section
 * name as the screen.
 *
 * Product-specific content lives in config/testability.json: products, the feature map
 * ((section, screen) regexes → product + feature, first match wins), the build label,
 * "already done right" examples and renames. Rows no feature matches are grouped under
 * "Unmapped" with a warning — give them a home in the config.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import minimist from 'minimist';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = minimist(process.argv.slice(2));
const date = args.date ?? new Date().toISOString().slice(0, 10);
const REGISTER = resolve(ROOT, 'docs/testability/missing-resource-ids.md');
const OUT = resolve(ROOT, args.out ?? `reports/testability/missing-ids_${date}.html`);

// ── config: products + feature map (first match wins) ─────────────────────
const CONFIG_PATH = resolve(ROOT, 'config/testability.json');
const cfg = existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) : {};
const slugify = v => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
const FEATURES = (cfg.features ?? []).map(f => ({
  ...f,
  product: slugify(f.product),
  section: f.section ? new RegExp(f.section) : null,
  screen: f.screen ? new RegExp(f.screen) : null,
}));
const PRODUCTS = (cfg.products ?? []).map(p => ({ ...p, id: slugify(p.id), blurb: p.blurb ?? '' }));
const UNMAPPED = { id: 'unmapped', name: 'Unmapped', blurb: 'Register sections with no entry in config/testability.json' };
const PALETTE = [['#245b8f', '#86b6e6'], ['#6a3fb5', '#c3a6f5'], ['#1d6f5c', '#7fd3bc'], ['#8a4b12', '#f0b27a'], ['#7a2e5b', '#e79ac6']];
const BUILD_LABEL = cfg.buildLabel ?? 'Android';
const SEVERITIES = ['blocker', 'high', 'medium', 'low'];

// ── parse the register ──────────────────────────────────────────────────────
const md = existsSync(REGISTER) ? readFileSync(REGISTER, 'utf8') : '';
if (!md) console.warn(`⚠ register not found or empty: ${REGISTER}`);
const rows = [];
let section = null;
let elementFirst = false;
for (const line of md.split('\n')) {
  const h = line.match(/^## (Open|GOOD EXAMPLE) — (.*)$/);
  if (h) { section = h[2].replace(/\s*\*\(.*\)\*\s*$/, '').trim(); elementFirst = false; continue; }
  if (/^## /.test(line)) { section = null; continue; }
  if (!section || !line.startsWith('|')) continue;
  const cells = line.split('|').slice(1, -1).map(c => c.trim());
  if (cells.length !== 7 || /^:?-+:?$/.test(cells[0])) continue;
  if (cells[0] === 'Screen' || cells[0] === 'Element') { elementFirst = cells[0] === 'Element'; continue; }
  let [screen, element, proposed, workaround, sev, build, found] = cells;
  if (elementFirst) {  // Element | Selector | … layout: the section names the screen
    [screen, element] = [section, cells[0]];
  }
  const severity = SEVERITIES.find(s => sev.toLowerCase().replace(/\*/g, '').startsWith(s));
  if (!severity) throw new Error(`unknown severity "${sev}" in: ${line}`);
  const f = FEATURES.find(f => (!f.section || f.section.test(section)) && (!f.screen || f.screen.test(screen)));
  if (!f) console.warn(`⚠ no feature mapping for section "${section}", screen "${screen}" — add one to config/testability.json`);
  rows.push({ product: f?.product ?? UNMAPPED.id, feature: f?.feature ?? section, screen, element, proposed, workaround,
              severity, sevNote: sev.replace(/\*/g, ''), build, found });
}

// ── group ───────────────────────────────────────────────────────────────────
const impactOf = name => FEATURES.find(f => f.feature === name && f.impact)?.impact ?? '';
const groups = [];
const allProducts = [...PRODUCTS, ...(rows.some(r => r.product === UNMAPPED.id) ? [UNMAPPED] : [])];
for (const p of allProducts) {
  const names = [...new Set(rows.filter(r => r.product === p.id).map(r => r.feature))];
  const feats = names.map(name => {
    const items = rows.filter(r => r.product === p.id && r.feature === name)
      .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
    const count = Object.fromEntries(SEVERITIES.map(s => [s, items.filter(r => r.severity === s).length]));
    return { name, slug: `${p.id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, items, count, impact: impactOf(name) };
  }).sort((a, b) => b.count.blocker - a.count.blocker || b.count.high - a.count.high || b.items.length - a.items.length);
  if (feats.length) groups.push({ ...p, feats });
}
const total = rows.length;
const totalBy = s => rows.filter(r => r.severity === s).length;
const featureCount = groups.reduce((n, g) => n + g.feats.length, 0);
const buildCodes = rows.flatMap(r => [...r.build.matchAll(/\((\d+)\)/g)].map(m => Number(m[1])));
const buildStat = buildCodes.length
  ? (Math.min(...buildCodes) === Math.max(...buildCodes) ? `build ${buildCodes[0]}` : `builds ${Math.min(...buildCodes)} – ${Math.max(...buildCodes)}`)
  : 'no builds recorded';

// ── render ──────────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const pill = (sev, note) => `<span class="sev sev-${sev}"${note && note !== sev ? ` title="${esc(note)}"` : ''}>${sev}</span>`;
const bar = c => SEVERITIES.filter(s => c[s]).map(s => `<span class="seg seg-${s}" style="flex:${c[s]}" title="${c[s]} ${s}">${c[s]}</span>`).join('');

const indexRows = groups.flatMap(g => g.feats.map(f => `
      <tr data-max="${SEVERITIES.find(s => f.count[s])}">
        <td><span class="prod prod-${g.id}">${esc(g.name)}</span></td>
        <td><a href="#${f.slug}">${esc(f.name)}</a></td>
        ${SEVERITIES.map(s => `<td class="num${f.count[s] ? '' : ' zero'}">${f.count[s] || '–'}</td>`).join('')}
        <td class="barcell"><div class="bar">${bar(f.count)}</div></td>
      </tr>`)).join('') || `
      <tr><td colspan="7" class="empty">No open elements in the register.</td></tr>`;

const productColor = (p, i) => {
  const [light, dark] = PALETTE[i % PALETTE.length];
  return { light: p.color?.light ?? light, dark: p.color?.dark ?? dark };
};
const productVars = mode => allProducts.map((p, i) =>
  `--p-${p.id}:${productColor(p, i)[mode]};`).join(' ');
const productCss = allProducts.map(p =>
  `.prod-${p.id}{background:color-mix(in srgb,var(--p-${p.id}) 14%,var(--surface));color:var(--p-${p.id})} #p-${p.id} .product-head{border-color:var(--p-${p.id})}`).join('\n');

const goodExamples = (cfg.goodExamples ?? []).map(g =>
  `<div><h3>${esc(g.title)}</h3><p>${inline(g.text ?? '')}</p></div>`).join('\n      ');
const renames = cfg.renames?.items?.length ? `
    <h2 class="section">${esc(cfg.renames.heading ?? 'Renamed ids')}</h2>
    ${cfg.renames.items.map(r => `<p class="impact">${inline(r)}</p>`).join('\n    ')}
    ${cfg.renames.note ? `<p class="impact">${inline(cfg.renames.note)}</p>` : ''}` : '';
const doneRight = goodExamples || renames ? `
  <section class="product" id="done-right">
    <div class="product-head"><h2>Already done right</h2><p>Use these as the reference when adding tags</p></div>
    ${goodExamples ? `<div class="good">
      ${goodExamples}
    </div>` : ''}${renames}
  </section>` : '';

const featureSections = groups.map(g => `
  <section class="product" id="p-${g.id}">
    <div class="product-head"><h2>${esc(g.name)}</h2><p>${esc(g.blurb)} · ${g.feats.reduce((n, f) => n + f.items.length, 0)} elements</p></div>
    ${g.feats.map(f => `
    <article class="feature" id="${f.slug}">
      <header>
        <h3>${esc(f.name)}</h3>
        <div class="chips">${SEVERITIES.filter(s => f.count[s]).map(s => `<span class="chip sev-${s}">${f.count[s]} ${s}</span>`).join('')}</div>
      </header>
      ${f.impact ? `<p class="impact">${esc(f.impact)}</p>` : ''}
      <div class="tablewrap"><table>
        <thead><tr><th>Screen</th><th>Element</th><th>Proposed id</th><th>Today's workaround</th><th>Severity</th><th>Last checked</th></tr></thead>
        <tbody>${f.items.map(r => `
          <tr data-sev="${r.severity}">
            <td>${inline(r.screen)}</td><td>${inline(r.element)}</td>
            <td class="pid">${inline(r.proposed)}</td><td class="wa">${inline(r.workaround)}</td>
            <td>${pill(r.severity, r.sevNote)}</td><td class="build">${inline(r.build)}<span>found ${esc(r.found)}</span></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </article>`).join('')}
  </section>`).join('');

const html = `<title>Missing Automation IDs</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>
:root{
  --bg:#f4f6f8; --surface:#ffffff; --ink:#18212b; --muted:#5b6673; --line:#dde2e8; --soft:#eef1f4;
  --accent:#245b8f; --accent-soft:#e3edf7;
  --blocker:#b02f28; --blocker-bg:#fbe8e6; --high:#a35c0c; --high-bg:#fcefdc;
  --medium:#6b5d0e; --medium-bg:#f3efd2; --low:#4f5a66; --low-bg:#eceef1;
  ${productVars('light')}
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  color-scheme:dark;
  --bg:#10151b; --surface:#171f28; --ink:#e5e9ee; --muted:#9aa5b2; --line:#29333f; --soft:#1e2731;
  --accent:#86b6e6; --accent-soft:#1c2b3b;
  --blocker:#ff8f86; --blocker-bg:#3b1c1a; --high:#f2b46c; --high-bg:#3a2a15; --medium:#dccb70; --medium-bg:#33301a; --low:#b6bfca; --low-bg:#252e38;
  ${productVars('dark')}
}}
:root[data-theme="dark"]{
  color-scheme:dark;
  --bg:#10151b; --surface:#171f28; --ink:#e5e9ee; --muted:#9aa5b2; --line:#29333f; --soft:#1e2731;
  --accent:#86b6e6; --accent-soft:#1c2b3b;
  --blocker:#ff8f86; --blocker-bg:#3b1c1a; --high:#f2b46c; --high-bg:#3a2a15; --medium:#dccb70; --medium-bg:#33301a; --low:#b6bfca; --low-bg:#252e38;
  ${productVars('dark')}
}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font:15px/1.55 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;padding-inline:16px}
.wrap{max-width:1180px;margin:0 auto;padding-block:40px 64px}
h1,h2,h3{text-wrap:balance;margin:0;line-height:1.2}
code,.pid{font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;font-size:.84em}
code{background:var(--soft);padding:1px 5px;border-radius:4px}
a{color:var(--accent)}
.eyebrow{font-size:.74rem;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:600}
.top h1{font-size:clamp(1.8rem,4vw,2.5rem);margin-top:8px;font-weight:700}
.top .lede{max-width:68ch;color:var(--muted);margin:12px 0 0}
.stats{display:flex;flex-wrap:wrap;gap:12px 40px;margin:28px 0 8px;padding:18px 0;border-block:1px solid var(--line)}
.stat b{display:block;font-size:1.9rem;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.1}
.stat span{font-size:.8rem;color:var(--muted)}
.stat.blocker b{color:var(--blocker)}
.filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:28px 0 12px}
.filters span{font-size:.8rem;color:var(--muted);margin-right:4px}
.filters button{font:inherit;font-size:.82rem;padding:5px 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}
.filters button[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.filters button:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
h2.section{font-size:1.15rem;margin:36px 0 12px}
.tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:.86rem}
th{text-align:left;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.index{background:var(--surface);border:1px solid var(--line);border-radius:10px}
.index table{min-width:640px}
.index td.num{text-align:right;font-variant-numeric:tabular-nums;width:64px;font-weight:600}
.index td.zero{color:var(--muted);font-weight:400}
.index th:nth-child(n+3):nth-child(-n+6){text-align:right}
.index tr:last-child td{border-bottom:0}
td.empty{color:var(--muted);text-align:center;padding:18px}
.barcell{width:26%}
.bar{display:flex;height:18px;border-radius:4px;overflow:hidden;gap:2px}
.seg{display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:600;min-width:18px}
.seg-blocker{background:var(--blocker);color:var(--bg)} .seg-high{background:var(--high);color:var(--bg)}
.seg-medium{background:var(--medium-bg);color:var(--medium)} .seg-low{background:var(--low-bg);color:var(--low)}
.prod{display:inline-block;font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:999px;white-space:nowrap}
.product{margin-top:52px}
.product-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px;padding-bottom:10px;border-bottom:2px solid var(--ink)}
.product-head h2{font-size:1.6rem}
.product-head p{margin:0;color:var(--muted);font-size:.9rem}
${productCss}
.feature{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:18px 18px 6px;margin-top:18px}
.feature header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 16px;align-items:center}
.feature h3{font-size:1.08rem}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:.74rem;font-weight:600;padding:2px 9px;border-radius:999px}
.impact{margin:8px 0 10px;color:var(--muted);max-width:80ch;font-size:.9rem}
.feature table{min-width:860px}
.feature tr:last-child td{border-bottom:0}
td.pid{color:var(--accent);white-space:nowrap}
td.pid code{background:none;padding:0;font-size:1em;color:inherit}
td.wa{color:var(--muted);max-width:300px}
td.build{white-space:nowrap;color:var(--muted);font-size:.8rem}
td.build span{display:block;font-size:.74rem;opacity:.8}
.sev{display:inline-block;font-size:.72rem;font-weight:600;padding:2px 9px;border-radius:999px;text-transform:capitalize;white-space:nowrap}
.sev-blocker{background:var(--blocker-bg);color:var(--blocker)} .sev-high{background:var(--high-bg);color:var(--high)}
.sev-medium{background:var(--medium-bg);color:var(--medium)} .sev-low{background:var(--low-bg);color:var(--low)}
.good{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-top:14px}
.good div{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px 18px}
.good h3{font-size:1rem;margin-bottom:6px}
.good p{margin:0;font-size:.88rem;color:var(--muted)}
pre{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:16px;overflow-x:auto;font-size:.82rem;line-height:1.6}
.legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px 24px;margin-top:12px;font-size:.88rem}
.legend p{margin:0;color:var(--muted)}
footer{margin-top:56px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:.8rem}
.hidden-row{display:none}
@media (max-width:640px){.feature{padding:14px 12px 4px}.stat b{font-size:1.5rem}}
</style>

<div class="wrap">
  <div class="top">
    <div class="eyebrow">${esc(BUILD_LABEL)} · testability register</div>
    <h1>Missing automation IDs</h1>
    <p class="lede">Elements our Maestro suites need to target that have no stable <code>resource-id</code> / <code>testTag</code>, grouped by feature. A <strong>blocker</strong> has no usable locator at all, so the step stays manual or needs a screen-position tap. A <strong>high</strong> works only by matching text, which breaks on copy or locale changes.</p>
  </div>

  <div class="stats">
    <div class="stat"><b>${total}</b><span>open elements</span></div>
    <div class="stat blocker"><b>${totalBy('blocker')}</b><span>blockers</span></div>
    <div class="stat"><b>${totalBy('high')}</b><span>high · text-only</span></div>
    <div class="stat"><b>${featureCount}</b><span>features affected</span></div>
    <div class="stat"><b>${esc(cfg.version ?? '–')}</b><span>${buildStat}</span></div>
  </div>

  <h2 class="section">Features, worst first</h2>
  <div class="index tablewrap"><table>
    <thead><tr><th>Product</th><th>Feature</th><th>Blocker</th><th>High</th><th>Medium</th><th>Low</th><th>Mix</th></tr></thead>
    <tbody>${indexRows}</tbody>
  </table></div>

  <div class="filters" role="group" aria-label="Filter rows by severity">
    <span>Show</span>
    <button type="button" id="f-all" data-min="low" aria-pressed="true">All</button>
    <button type="button" id="f-high" data-min="high" aria-pressed="false">Blocker + high</button>
    <button type="button" id="f-blocker" data-min="blocker" aria-pressed="false">Blockers only</button>
  </div>

  ${featureSections}

  ${doneRight}

  <section class="product" id="how">
    <div class="product-head"><h2>How to fix</h2><p>Compose — put the tag on the tappable container, not on an inner label</p></div>
<pre>// once, on each screen's root composable: exposes testTags to Maestro as resource-ids
Modifier.semantics { testTagsAsResourceId = true }

// on every element a test taps: the clickable container, not its text child
Modifier.testTag("note_item_3")

// state a test needs to read, e.g. a sync badge
Modifier.testTag("note_sync_badge").semantics { stateDescription = "offline" }</pre>
    <div class="legend">
      <p><span class="sev sev-blocker">blocker</span> no stable locator; step is manual or coordinate-only</p>
      <p><span class="sev sev-high">high</span> text match only; breaks on copy or locale changes</p>
      <p><span class="sev sev-medium">medium</span> id exists but is ambiguous, shared or unstable</p>
      <p><span class="sev sev-low">low</span> nice to have; a usable locator already exists</p>
    </div>
  </section>

  <footer>Generated ${date} from <code>docs/testability/missing-resource-ids.md</code> by <code>scripts/testability-report.js</code>. The register is updated on every test run; regenerate rather than edit this page.</footer>
</div>

<script>
(function(){
  var order=['blocker','high','medium','low'];
  var buttons=document.querySelectorAll('.filters button');
  function apply(min){
    var limit=order.indexOf(min);
    document.querySelectorAll('.feature tbody tr').forEach(function(tr){
      tr.classList.toggle('hidden-row', order.indexOf(tr.dataset.sev)>limit);
    });
    document.querySelectorAll('.feature').forEach(function(f){
      f.hidden = !f.querySelector('tbody tr:not(.hidden-row)');
    });
    document.querySelectorAll('.index tbody tr').forEach(function(tr){
      tr.classList.toggle('hidden-row', order.indexOf(tr.dataset.max)>limit);
    });
    buttons.forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.min===min)); });
  }
  buttons.forEach(function(b){ b.addEventListener('click', function(){ apply(b.dataset.min); }); });
})();
</script>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`${total} elements · ${featureCount} features · ${totalBy('blocker')} blockers → ${OUT}`);
for (const g of groups) for (const f of g.feats)
  console.log(`  ${String(g.name).padEnd(9)} ${String(f.name).padEnd(34)} ${SEVERITIES.map(s => f.count[s]).join('/')}`);
