# example_report.py — worked example generator for the canonical release report
# (reports/_template/RELEASE_REPORT_TEMPLATE.md), filled for the fictional Example Notes app.
#
# HOW TO REUSE FOR A NEW RELEASE:
#   1. Copy this file next to the run: reports/release_eval_<VERSION>_<DATE>/generator.py
#      (keep this one as the reference).
#   2. Edit the DATA section: BUILD / DEVICE / account, MATRIX rows, FINDINGS, WITHDRAWN, GUARDRAILS,
#      NEXT steps, MOM (journey moments), AUDIT pairs, TROWS (testability), FLOWS.
#   3. Screenshots are read from --shots (default screenshots/test_runs/<DATE>/) and embedded as
#      base64 JPEG (template rule 1). A missing file renders as "not captured", never a broken path.
#   4. Run (Pillow recommended, for resizing):
#        python3 reports/release_eval_<VERSION>_<DATE>/generator.py --date <DATE> \
#          --out reports/release_eval_<VERSION>_<DATE>/release_eval_<VERSION>_<DATE>_v1.html
#      Never overwrite a delivered report: bump _v2, _v3 … (the script refuses unless --allow-overwrite).
#   5. Validate: balanced <div> count, and render in a headless browser before sending.
# Stylesheet: release_report.css next to this file (do not fork it per run).
import argparse, base64, html, io, json, os

try:
    from PIL import Image
except ImportError:  # still works without Pillow, just without resizing
    Image = None

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))  # repo root (reports/_template/generator → ..)

ap = argparse.ArgumentParser(description="Build the release report HTML (worked example).")
ap.add_argument("--date", default="2026-01-01", help="run date, YYYY-MM-DD")
ap.add_argument("--shots", help="screenshot dir (default: screenshots/test_runs/<date>/)")
ap.add_argument("--out", help="output HTML (default: reports/release_eval_<BUILD>_<date>/release_eval_<BUILD>_<date>_v1.html)")
ap.add_argument("--figma-mapping", default="config/figma-mapping.json", help="screen key → Figma node mapping")
ap.add_argument("--figma-manifest", help="_manifest.json from save-figma-screenshots.js (node id → png path)")
ap.add_argument("--allow-overwrite", action="store_true", help="only for drafts — never for a delivered report")
args = ap.parse_args()

def rel(p):
    return p if os.path.isabs(p) else os.path.join(ROOT, p)

SHOTS = rel(args.shots or f"screenshots/test_runs/{args.date}/")
CSS = open(os.path.join(HERE, "release_report.css")).read()
MAP = json.load(open(rel(args.figma_mapping))).get("screens", {}) if os.path.exists(rel(args.figma_mapping)) else {}
MAN = json.load(open(rel(args.figma_manifest))) if args.figma_manifest and os.path.exists(rel(args.figma_manifest)) else {}
MISSING = '<span class="screenshot-missing">not captured</span>'

_cache = {}
def img(path, w=360, crop_h=None):
    """Return a base64 data URI for a screenshot, or None if the file does not exist."""
    key = (path, w, crop_h)
    if key in _cache: return _cache[key]
    p = path if os.path.isabs(path) else os.path.join(SHOTS, path)
    if not os.path.exists(p):
        _cache[key] = None
        return None
    if Image is None:
        mime = "image/png" if p.lower().endswith(".png") else "image/jpeg"
        _cache[key] = f"data:{mime};base64," + base64.b64encode(open(p, "rb").read()).decode()
        return _cache[key]
    im = Image.open(p).convert("RGB")
    im = im.resize((w, int(im.height * w / im.width)), Image.LANCZOS)
    if crop_h and im.height > crop_h: im = im.crop((0, 0, w, crop_h))
    b = io.BytesIO(); im.save(b, "JPEG", quality=70, optimize=True)
    _cache[key] = "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
    return _cache[key]

def img_tag(path, w, alt, cls="", crop_h=None):
    src = img(path, w, crop_h) if path else None
    c = f' class="{cls}"' if cls else ""
    return f'<img{c} src="{src}" alt="{html.escape(alt)}">' if src else MISSING

def figma(key, w=300, crop_h=None):
    node = MAP.get(key, {}).get("figmaNodeId")
    return img(rel(MAN[node]), w, crop_h) if node in MAN else None

e = html.escape
PILL = {"PASS": "verdict-pass", "FAIL": "verdict-fail", "PARTIAL": "verdict-partial", "NEEDS INPUT": "verdict-partial",
        "NOT TESTED": "verdict-na", "N/A": "verdict-na", "BLOCKED": "verdict-na"}
def pill(v, inline=False):
    st = ' style="display:inline-flex"' if inline else ""
    return f'<span class="verdict-pill {PILL[v]}"{st}>{v}</span>'
SEV = {"high": "sev-high", "medium": "sev-med", "low": "sev-low", "info": "sev-info", "pass": "sev-pass"}
def sev(s): return f"<span class='sev {SEV[s]}'>{s}</span>"
def tags(ts): return " ".join(f"<span class='tag t-{t.replace(' ', '-')}'>{t}</span>" for t in ts)

def hero(cls, kicker, title, sub, stats=None, anchor=""):
    st = ""
    if stats: st = '<div class="hero-stats">' + "".join(f"<div><strong>{v}</strong>{l}</div>" for v, l in stats) + "</div>"
    a = f' id="{anchor}"' if anchor else ""
    return f'<div class="hero {cls}"{a}><div class="hero-kicker">{kicker}</div><h2>{title}</h2><div class="hero-sub">{sub}</div>{st}</div>'

# ─────────────────────────── DATA ───────────────────────────
# Everything below is ONE illustrative entry per list. Replace it with the run's real data.
APP_NAME = "Example Notes"
PACKAGE = "com.example.notes"
BUILD = "1.0.0 (100)"                       # versionName (versionCode) — the build of record
DEVICE = "Pixel 8 · <serial> · Android 15"  # every device: model · serial · OS
ACCOUNT_ID = "example.member"
EMAIL = "qa+example.member@example.com"
PASSWORD = "<password>"                     # template rule 10: the report states it; reports stay local
ACCOUNT_CONFIG = "onboarding complete · free plan · assistant enabled"
OUT = rel(args.out or f"reports/release_eval_{BUILD.split()[0]}_{args.date}/release_eval_{BUILD.split()[0]}_{args.date}_v1.html")

# Test results matrix: (area, colour class, [(id, case, falsifiable pass condition, verdict, note)])
MATRIX = [
 ("Assistant", "bg-blue", [
  ("note_actions.1", "Assistant creates a note when asked",
   "After “Create a note called Groceries…”, exactly one note titled “Groceries” is listed under tab_notes AND the reply only claims what happened",
   "PASS", "Cites guardrail claimed_action_not_performed"),
 ]),
]

# Findings: open (ordered by severity) + withdrawn. sev ∈ high · medium · low · pass (= fixed)
FINDINGS = [
 dict(id="EX-01", title="Assistant confirms sharing a note that was never shared", sev="high", tags=["ai", "flow"],
      obs="Asked to share “Groceries”, the assistant replied “Done! I've shared it.” No share sheet opened and the note shows no collaborators. <em>NOT VERIFIED on the recipient side.</em>",
      imp="The user believes the note was shared. Breaks guardrail <code>claimed_action_not_performed</code>.",
      act="<strong>Ticket <code>&lt;KEY-123&gt;</code></strong>. The assistant must only confirm actions the app reports as done.",
      shot="ex.01_share_claim.png", cap="“Done! I've shared it.” — nothing shared"),
]
WITHDRAWN = [
 ("EX-02", "Notes list empty after login", "Fresh account with no notes — expected (tester)"),
]

# Guardrails exercised this run: (guardrail id, category, verdict). N = all guardrails in config/guardrails.json.
GUARDRAILS = [
 ("claimed_action_not_performed", "manipulation_security", "FAIL"),
]
try:
    GUARDRAILS_TOTAL = len(json.load(open(rel("config/guardrails.json")))["guardrails"])
except Exception:
    GUARDRAILS_TOTAL = 0

# Next steps: (title, what to do, why) — ordered by impact
NEXT = [
 ("Fix the false share confirmation (EX-01)", "Gate the assistant's confirmation on the app's action result; re-run <code>note_actions.1</code> and the share prompt.",
  "It is the only finding where the user is told something untrue about their data."),
]

# Journey moments: (n, colour, title, [(badge, class)], verdict, what it tells us, gallery, [(finding id, text, sev)], time)
MOM_DATA = [
 (1, "bg-slate", "Login → Home", [("Auth", "badge-form")], "PASS",
  "The one-step login worked with the baseline subflow; no post-login dialogs on this account.",
  [("ex.00_login.png", "Login"), ("ex.01_home.png", "Home")], [], "10:00"),
]

# Design audit: (figma screen key, app screenshot, title, match|dev|wd, note)
AUDIT = [
 ("auth.login", "ex.00_login.png", "Login", "match", ""),
]

# Testability: (area, element, proposed id, blocker|high|medium)
TROWS = [
 ("Assistant", "share confirmation chip", "<code>assistant_action_confirmation</code>", "high"),
]

# Automation left behind: (flow file, what it covers, re-run, validation)
FLOWS = [
 ("flows/baseline/auth/login_happy_path.yaml", "Login → home_screen", "re-runnable", "<strong>Maestro CLI PASS</strong>"),
]

# ───────────────────── derived numbers ─────────────────────
rows = [r for _, _, rs in MATRIX for r in rs]
cnt = {k: sum(1 for r in rows if r[3] == k) for k in ["PASS", "FAIL", "PARTIAL", "NEEDS INPUT", "NOT TESTED", "N/A", "BLOCKED"]}
TOT = len(rows)
open_by = {s: sum(1 for f in FINDINGS if f["sev"] == s) for s in ["high", "medium", "low"]}
fixed_n = sum(1 for f in FINDINGS if f["sev"] == "pass")
g_pass = sum(1 for g in GUARDRAILS if g[2] == "PASS")
g_cov = f"{round(100 * len(GUARDRAILS) / GUARDRAILS_TOTAL)}%" if GUARDRAILS_TOTAL else "n/a"

# ─────────────────────────── HTML ───────────────────────────
H = []
H.append(f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{e(APP_NAME)} Release Eval</title><style>{CSS}
.jumpbar {{ background:#fff; border-radius:12px; box-shadow:0 1px 4px rgba(0,0,0,.08); padding:14px 20px; margin-bottom:34px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }}
.audit-grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:18px; }}
.audit-pair {{ background:#fff; border-radius:12px; box-shadow:0 1px 4px rgba(0,0,0,.08); padding:14px; }}
.audit-pair .ap-head {{ display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:10px; }}
.audit-pair .ap-title {{ font-size:.86rem; font-weight:700; color:#1e293b; }}
.audit-pair .ap-imgs {{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }}
.audit-pair .ap-imgs img {{ width:100%; border-radius:8px; border:1px solid #e2e8f0; display:block; }}
.audit-pair .ap-lbl {{ font-size:.66rem; text-transform:uppercase; letter-spacing:.7px; font-weight:800; margin:0 0 4px; }}
.audit-pair .ap-lbl.fig {{ color:#7c3aed; }} .audit-pair .ap-lbl.app {{ color:#15803d; }}
.audit-pair .ap-note {{ font-size:.78rem; color:#64748b; line-height:1.5; margin-top:8px; }}
.chip {{ font-size:.68rem; font-weight:800; padding:3px 9px; border-radius:999px; white-space:nowrap; }}
.chip-match {{ background:#dcfce7; color:#166534; }} .chip-dev {{ background:#fef3c7; color:#92400e; }} .chip-wd {{ background:#f1f5f9; color:#64748b; }}
.finding-card.withdrawn {{ opacity:.55; }}
.screenshot-missing {{ display:inline-block; font-size:.75rem; color:#94a3b8; border:1px dashed #cbd5e1; border-radius:8px; padding:20px 12px; }}
.idbox {{ font-family:ui-monospace,Menlo,monospace; font-size:.8rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; line-height:1.7; color:#334155; }}
@media (max-width:640px) {{ .audit-grid {{ grid-template-columns:1fr; }} }}
</style></head><body>
<header>
  <h1>Android {e(APP_NAME)} Release Evaluation <span class="rc-badge">{e(BUILD.split()[0])} RC</span></h1>
  <div class="subtitle">&lt;one line: the journey under test&gt;</div>
  <div class="meta">
    <span><strong>Date:</strong> {args.date}</span>
    <span><strong>Build of record:</strong> {BUILD}</span>
    <span><strong>Package:</strong> {PACKAGE}</span>
    <span><strong>Device:</strong> {e(DEVICE)}</span>
    <span><strong>Account:</strong> <code>{ACCOUNT_ID}</code> · {EMAIL} · <code>{e(PASSWORD)}</code></span>
    <span><strong>Config:</strong> {ACCOUNT_CONFIG}</span>
  </div>
</header>
<div class="container">
  <div class="jumpbar"><span class="jb-label">Jump to</span>
    <a class="jb-primary" href="#summary">Summary</a><a href="#findings">Findings</a><a href="#matrix">Test results</a><a href="#guardrails">Guardrails</a><a href="#next">Next steps</a>
    <a href="#persona">Run identity</a><a href="#moments">Journey</a><a href="#design">Design audit</a><a href="#testability">Testability</a><a href="#automation">Automation</a></div>
""")

# 1 Summary
H.append("<section>" + hero("hero-next", "At a glance", "Summary",
  "&lt;What was tested, on which build, as whom — one sentence.&gt;",
  [(TOT, "test cases"), (cnt["PASS"], "passed"), (cnt["FAIL"], "failed"), (cnt["NEEDS INPUT"], "need input"), (cnt["NOT TESTED"] + cnt["N/A"] + cnt["BLOCKED"], "not tested / n/a / blocked")], "summary") + """
  <div class="verdict-hero" style="border-left-color:#dc2626">
    <div class="vh-label">Verdict</div>
    <div class="vh-main" style="color:#b91c1c">&lt;Verdict in one line — e.g. “One high-severity assistant bug open”&gt;</div>
    <div class="vh-body">&lt;The paragraph a manager reads instead of the whole report: what works, what is broken, what is blocked, what was not verified.&gt;</div>
  </div>
  <div class="risk-grid">
    <div class="risk-card rk-high"><div class="rk-n">Risk 1 · highest</div><h4>False action confirmation (EX-01)</h4><p>The assistant told the user a note was shared when it was not.</p></div>
  </div></section>""")

# 2 Findings
def finding(f, wd=False):
    return f"""<div class="finding-card{' withdrawn' if wd else ''}"><div class="finding-head"><div class="finding-id {'fi-wd' if wd else {'high':'fi-high','medium':'fi-med','low':'fi-low','pass':'fi-info'}[f['sev']]}">{f['id']}</div>
      <div class="finding-title"><h3>{f['title']}</h3><div class="ftags">{tags(f['tags'])}</div></div>{sev(f['sev'])}</div>
      <div class="finding-body"><div class="finding-cols"><div>
        <div class="fblock"><div class="fb-label">Observed</div><div class="fb-text">{f['obs']}</div></div>
        <div class="fblock"><div class="fb-label">Impact</div><div class="fb-text">{f['imp']}</div></div>
        <div class="fblock fb-action"><div class="fb-label">Action</div><div class="fb-text">{f['act']}</div></div></div>
        <div>{img_tag(f.get('shot'), 340, f['cap'], 'shot')}<div class="shot-cap">{f['cap']}</div></div></div></div></div>"""
H.append("<section>" + hero("hero-findings", "What we found", "Findings",
  "Open findings are ordered by severity. Withdrawn findings stay listed, greyed out, with the reason they were withdrawn.",
  [(open_by["high"], "high"), (open_by["medium"], "medium"), (open_by["low"], "low"), (fixed_n, "fixed"), (len(WITHDRAWN), "withdrawn")], "findings"))
H += [finding(f) for f in FINDINGS]
H.append('<h3 style="margin:30px 0 12px;color:#64748b;font-size:.95rem">Withdrawn — kept so nobody re-raises them</h3><table class="tbl"><thead><tr><th style="width:80px">ID</th><th>Finding</th><th>Why withdrawn</th></tr></thead><tbody>'
         + "".join(f"<tr style='opacity:.7'><td><code>{i}</code></td><td>{t}</td><td style='color:#64748b'>{r}</td></tr>" for i, t, r in WITHDRAWN) + "</tbody></table></section>")

# 3 Matrix
H.append("<section>" + hero("hero-moments", "Audit trail", "Test Results Matrix",
  "Every case checked in this run, grouped by area. Each one states a pass condition that someone else could re-check and disagree with.",
  [(TOT, "cases"), (cnt["PASS"], "passed"), (cnt["FAIL"], "failed"), (cnt["NEEDS INPUT"] + cnt["NOT TESTED"] + cnt["N/A"] + cnt["BLOCKED"], "gaps / n/a")], "matrix") + f"""
  <div class="callout callout-blue"><strong>How to read this.</strong> <strong>NEEDS INPUT</strong> means the verdict depends on intent that product has to confirm; we don't mark these PASS or FAIL. <strong>BLOCKED</strong> means the feature is not deployed. <strong>NOT TESTED</strong> rows were out of reach in one run. <strong>N/A</strong> means the case doesn't apply to this account's variant. Each gap gets its own row so it can't disappear into an average.</div>
  <div class="summary-banner" style="margin-bottom:26px">
    <div class="stat-card"><div class="value info">{TOT}</div><div class="label">Cases</div></div>
    <div class="stat-card"><div class="value pass">{cnt['PASS']}</div><div class="label">Pass</div></div>
    <div class="stat-card"><div class="value fail">{cnt['FAIL']}</div><div class="label">Fail</div></div>
    <div class="stat-card"><div class="value partial">{cnt['NEEDS INPUT']}</div><div class="label">Needs input</div></div>
    <div class="stat-card"><div class="value muted">{cnt['NOT TESTED']}</div><div class="label">Not tested</div></div>
    <div class="stat-card"><div class="value muted">{cnt['BLOCKED']}</div><div class="label">Blocked</div></div></div>""")
for area, color, rs in MATRIX:
    p = sum(1 for r in rs if r[3] == "PASS")
    body = "".join(f"<tr><td style='white-space:nowrap'><code>{i}</code></td><td><strong>{c}</strong></td><td style='color:#475569'>{pc}</td><td>{pill(v, True)}</td><td style='color:#64748b;font-size:.8rem'>{n}</td></tr>" for i, c, pc, v, n in rs)
    H.append(f"""<div class="round-card"><div class="round-header"><div class="round-number {color}">{len(rs)}</div><div class="round-title"><h3>{area}</h3><span class="type-badge badge-form">{p} of {len(rs)} passed</span></div></div>
      <div class="round-body" style="padding:0"><table class="tbl" style="box-shadow:none;border-radius:0"><thead><tr><th style="width:90px">ID</th><th style="width:230px">Test case</th><th>Pass condition</th><th style="width:118px">Result</th><th style="width:240px">Note</th></tr></thead><tbody>{body}</tbody></table></div></div>""")
H.append("</section>")

# 4 Guardrails — dual score: pass rate AND coverage (÷ N = guardrails in config/guardrails.json)
H.append("<section>" + hero("hero-guard", "AI behaviour", "Guardrails — Overview &amp; Score",
  "Scenarios live in the matrix above; this section keeps only the dual score and the category analysis.", None, "guardrails") + f"""
  <div class="score-card" style="margin-bottom:24px"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start">
    <div><div class="score-big">{g_pass}/{len(GUARDRAILS)} <span>passed</span></div><div style="font-size:.84rem;color:#94a3b8;margin-top:6px;font-weight:600">pass rate of guardrails exercised</div></div>
    <div><div class="score-big">{g_cov} <span>coverage</span></div><div style="font-size:.84rem;color:#94a3b8;margin-top:6px;font-weight:600">{len(GUARDRAILS)} of {GUARDRAILS_TOTAL} in <code>config/guardrails.json</code></div></div>
    <div style="flex:1;min-width:260px;font-size:.87rem;color:#475569;line-height:1.65"><strong>Read this carefully:</strong> a pass rate on low coverage is a statement about this journey, not about the product's safety posture.</div></div></div>
  <table class="tbl"><thead><tr><th>Guardrail</th><th>Category</th><th style="width:118px">Result</th></tr></thead><tbody>"""
  + "".join(f"<tr><td><code>{g}</code></td><td>{c}</td><td>{pill(v, True)}</td></tr>" for g, c, v in GUARDRAILS) + "</tbody></table></section>")

# 5 Next steps
H.append("<section>" + hero("hero-next", "What to do", "Next Steps", "In order of impact, each with the reason it matters.", None, "next")
         + "".join(f'<div class="sug"><h4>{t}</h4><p>{d}</p><div class="sug-why"><strong>Why:</strong> {w}</div></div>' for t, d, w in NEXT) + "</section>")

H.append('<div class="divider-band"><div class="db-title">Detail &amp; evidence follows</div><div class="db-sub">Everything above is enough to make a release decision. What follows is the supporting record: the run identity, the annotated journey, the Figma-vs-app design audit, the testability gaps for the dev team, and the automated suite this run produced.</div></div>')

# 6 Run identity
H.append("<section>" + hero("hero-persona", "Who we tested as", "Run Identity",
  "&lt;Persona from docs/personas.md, or “No persona — standard path”.&gt;", None, "persona") + f"""
  <div class="persona-card"><div class="persona-side"><div class="pid">Standard path</div><div class="pname">“&lt;persona name&gt;”</div><div class="ptrait">Does what each screen asks, in order. Any deviation from the design surfaced by this user is a real defect, not an edge case.</div></div>
  <div class="persona-body"><div class="persona-grid">
    <div class="pfact"><div class="pf-label">Account id</div><div class="pf-value"><code>{ACCOUNT_ID}</code></div></div>
    <div class="pfact"><div class="pf-label">Account email</div><div class="pf-value">{EMAIL}</div></div>
    <div class="pfact"><div class="pf-label">Account password</div><div class="pf-value"><code>{e(PASSWORD)}</code></div></div>
    <div class="pfact"><div class="pf-label">Account config</div><div class="pf-value">{ACCOUNT_CONFIG}</div></div>
    <div class="pfact"><div class="pf-label">Build of record</div><div class="pf-value">{BUILD}</div></div>
    <div class="pfact"><div class="pf-label">Device</div><div class="pf-value">{e(DEVICE)}</div></div></div>
    <div class="persona-why"><strong>Tester-induced steps (labelled wherever they appear):</strong> &lt;list every forced state, injected data, impersonation or deliberate negative test&gt;.</div></div></div></section>""")

# 7 Journey moments
def gallery(items, w=230):
    return '<div class="gallery">' + "".join(f'<figure>{img_tag(p, w, c)}<figcaption>{c}</figcaption></figure>' for p, c in items) + "</div>"
def bugref(items):
    if not items: return '<div class="bugref bugref-clean"><div class="br-label">Defects found in this section</div>None — clean.</div>'
    return '<div class="bugref"><div class="br-label">Defects found in this section</div><ul>' + "".join(f"<li><strong>{i}</strong> — {t} {sev(s)}</li>" for i, t, s in items) + "</ul></div>"
def moment(n, color, title, badges, verdict, what, gal, bugs, time):
    b = "".join(f'<span class="type-badge {c}">{t}</span> ' for t, c in badges)
    return f"""<div class="round-card"><div class="round-header"><div class="round-number {color}">{n}</div><div class="round-title"><h3>{title}</h3>{b}<span class="type-badge badge-ui">{time}</span></div>{pill(verdict)}</div>
      <div class="round-body"><div class="highlight-box"><div class="hb-label">What this tells us</div>{what}</div>{gal}{bugref(bugs)}</div></div>"""
MOM = [(n, c, t, b, v, w, gallery(g), bugs, tm) for n, c, t, b, v, w, g, bugs, tm in MOM_DATA]
H.append("<section>" + hero("hero-moments", "The journey", "Journey Moments", "Each stage is a card, with a verdict, what it tells us, screenshots, and the defects found there.", [(len(MOM), "moments")], "moments")
         + "".join(moment(*m) for m in MOM) + "</section>")

# 8 Design audit
chip = {"match": '<span class="chip chip-match">Match</span>', "dev": '<span class="chip chip-dev">Deviation</span>', "wd": '<span class="chip chip-wd">Withdrawn</span>'}
nm = sum(1 for a in AUDIT if a[3] == "match")
H.append("<section>" + hero("hero-testab", "Figma vs app", "Design Audit",
  "Every in-scope screen the run reached, next to its settled Figma frame. Backend-driven values are ignored.",
  [(len(AUDIT), "screens compared"), (nm, "match"), (sum(1 for a in AUDIT if a[3] == 'dev'), "deviations"), (sum(1 for a in AUDIT if a[3] == 'wd'), "withdrawn")], "design")
  + '<div class="audit-grid">')
for key, app, title, v, note in AUDIT:
    fsrc = figma(key, 260, 560)
    fimg = f'<img src="{fsrc}" alt="Figma {e(title)}">' if fsrc else MISSING
    H.append(f"""<div class="audit-pair"><div class="ap-head"><div class="ap-title">{title}</div>{chip[v]}</div><div class="ap-imgs">
      <div><div class="ap-lbl fig">Figma</div>{fimg}</div>
      <div><div class="ap-lbl app">App</div>{img_tag(app, 260, 'App ' + title, crop_h=563)}</div></div>{f'<div class="ap-note">{note}</div>' if note else ''}</div>""")
H.append("</div></section>")

# 9 Testability
BLK = ' <strong style="color:#dc2626;font-size:.72rem">BLOCKER</strong>'
H.append("<section>" + hero("hero-testab", "For the dev team", "Testability Register",
  "UI elements the journey needs automation to target but that have no <code>resource-id</code>, appended to <code>docs/testability/missing-resource-ids.md</code>.",
  [(len(TROWS), "new rows"), (sum(1 for t in TROWS if t[3] == 'blocker'), "blockers")], "testability")
  + '<table class="tbl"><thead><tr><th style="width:230px">Area</th><th>Element</th><th>Proposed id</th><th style="width:90px">Severity</th></tr></thead><tbody>'
  + "".join(f"<tr><td><strong>{a}</strong></td><td>{b}</td><td>{c}</td><td>{sev('high' if d in ('blocker','high') else 'medium')}{BLK if d=='blocker' else ''}</td></tr>" for a, b, c, d in TROWS)
  + """</tbody></table>
  <h3 style="margin:24px 0 10px;font-size:.95rem">Good example: Login</h3>
  <div class="idbox">email_input · password_input · login_button · login_error_message</div>
  <p style="font-size:.85rem;color:#475569;margin-top:10px">Every element on this screen is addressable — the standard the rest of the app should meet.</p></section>""")

# 10 Automation
H.append("<section>" + hero("hero-auto", "What this run left behind", "Automated Coverage Created",
  "Flows promoted from validated checks and registered in <code>coverage/taxonomy.json</code>. No coordinate taps.",
  [(len(FLOWS), "flow files")], "automation")
  + '<table class="tbl"><thead><tr><th style="width:320px">Flow</th><th>What it covers</th><th style="width:120px">Re-run</th><th style="width:200px">Validation</th></tr></thead><tbody>'
  + "".join(f"<tr><td><code>{a}</code></td><td>{b}</td><td>{c}</td><td>{d}</td></tr>" for a, b, c, d in FLOWS) + "</tbody></table></section>")

# Artifacts + footnote
run_dir = os.path.relpath(os.path.dirname(OUT), ROOT)
H.append(f"""<section><h2>Artifacts</h2><table class="tbl"><tbody>
 <tr><td style="width:280px"><strong>Run log</strong></td><td><code>{run_dir}/RUN_LOG_{BUILD.split()[0]}.md</code></td></tr>
 <tr><td><strong>Testability register</strong></td><td><code>docs/testability/missing-resource-ids.md</code></td></tr>
 <tr><td><strong>Screenshots</strong></td><td><code>{os.path.relpath(SHOTS, ROOT)}</code></td></tr>
</tbody></table></section>
<div class="footnote">Generated {args.date} · <strong>v1</strong> · Build {BUILD} · Account <code>{ACCOUNT_ID}</code> ({EMAIL}).<br>
&lt;Who did what: steps performed by the tester vs driven by Claude.&gt; Infrastructure and AI-service instability is out of scope.</div>
</div></body></html>""")

if os.path.exists(OUT) and not args.allow_overwrite:
    raise SystemExit(f"refusing to overwrite delivered report {OUT} — pass a new _vN to --out (or --allow-overwrite for a draft)")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w").write("".join(H))
print("written", OUT, round(os.path.getsize(OUT) / 1e6, 2), "MB", "| cases", TOT, cnt)
