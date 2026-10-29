#!/usr/bin/env python3
"""Bug report generator — one JSON spec → one self-contained HTML report (screenshots as base64).

    python3 reports/_template/bug-report/generate.py <spec.json> [--open]

Spec fields (see BUG_REPORT_TEMPLATE.md for what goes in each):
  id, title, subtitle, severity, layer, status            header + pills
  summary                                                 one paragraph (HTML allowed)
  environment: [[label, value], …]                        table (HTML allowed in value)
  steps: [str, …]                                         numbered
  expected_actual: [[expected, actual], …]                table
  evidence: [{title, pre?|table?|html?, note?}, …]        pre = text block, table = {head:[…], rows:[[…]]}
  screenshots: [{file, caption}, …]                       file relative to the repo root; missing → "not captured"
  analysis, impact, questions: [str, …]                   lists (HTML allowed)
  footer                                                  small print (local paths)
  out                                                     output path (under reports/, gitignored)
"""
import base64
import html
import json
import os
import subprocess
import sys

CSS = """
:root{--bg:#f7f7f5;--card:#fff;--ink:#1d1f24;--mute:#5d6470;--line:#e3e5e9;--accent:#c2410c;--ok:#15803d;--code:#f1f2f4}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#15171b;--card:#1e2126;--ink:#e8e9ec;--mute:#a2a8b3;--line:#30343b;--accent:#fb923c;--ok:#4ade80;--code:#262a30}}
:root[data-theme="dark"]{--bg:#15171b;--card:#1e2126;--ink:#e8e9ec;--mute:#a2a8b3;--line:#30343b;--accent:#fb923c;--ok:#4ade80;--code:#262a30}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 16px 64px}h1{font-size:24px;margin:0 0 4px}
h2{font-size:18px;margin:32px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
.sub{color:var(--mute);margin:0 0 18px}.pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:13px;font-weight:600;border:1px solid var(--line);margin:0 6px 6px 0}
.sev{color:var(--accent);border-color:var(--accent)}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:10px 0}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{border-bottom:1px solid var(--line);padding:7px 8px;text-align:left;vertical-align:top}th{color:var(--mute);font-weight:600}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;background:var(--code);border-radius:6px}code{padding:1px 5px;word-break:break-all}
pre{padding:10px 12px;overflow-x:auto;white-space:pre-wrap;word-break:break-word}
.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}figure{margin:0}figure img{width:100%;border:1px solid var(--line);border-radius:8px}
figcaption{font-size:13px;color:var(--mute);margin-top:4px}
.screenshot-missing{display:block;padding:40px 8px;text-align:center;border:1px dashed var(--line);border-radius:8px;color:var(--mute)}
.ok{color:var(--ok);font-weight:600}.bad{color:var(--accent);font-weight:600}ol li,ul li{margin:3px 0}
"""

E = html.escape


def shot(item):
    path, cap = item["file"], item.get("caption", "")
    if not os.path.exists(path):
        return f'<figure><span class="screenshot-missing">not captured</span><figcaption>{cap}</figcaption></figure>'
    b64 = base64.b64encode(open(path, "rb").read()).decode()
    return f'<figure><img src="data:image/png;base64,{b64}" alt="{E(cap)}"><figcaption>{cap}</figcaption></figure>'


def table(head, rows):
    h = "".join(f"<th>{c}</th>" for c in head) if head else ""
    r = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>" for row in rows)
    return f"<table>{'<tr>' + h + '</tr>' if h else ''}{r}</table>"


def lst(items, tag="ul"):
    return f"<{tag}>" + "".join(f"<li>{i}</li>" for i in items) + f"</{tag}>"


def render(s):
    parts = [f'<h1>{E(s["id"])} — {E(s["title"])}</h1>', f'<p class="sub">{s.get("subtitle", "")}</p>']
    pills = [f'<span class="pill sev">{s["severity"]}</span>'] if s.get("severity") else []
    pills += [f'<span class="pill">{s[k]}</span>' for k in ("layer", "status") if s.get(k)]
    parts.append("<p>" + "".join(pills) + "</p>")
    parts.append(f'<div class="card"><b>Summary.</b> {s["summary"]}</div>')
    if s.get("environment"):
        parts += ["<h2>Environment</h2>", table(None, [[f"<b>{a}</b>", b] for a, b in s["environment"]])]
    if s.get("steps"):
        parts += ["<h2>Steps to reproduce</h2>", lst(s["steps"], "ol")]
    if s.get("expected_actual"):
        parts += ["<h2>Expected vs actual</h2>", table(["Expected", "Actual"], s["expected_actual"])]
    for ev in s.get("evidence", []):
        parts.append(f'<h2>{ev["title"]}</h2>')
        if "pre" in ev:
            parts.append(f'<pre>{E(ev["pre"])}</pre>')
        if "table" in ev:
            parts.append(table(ev["table"].get("head"), ev["table"]["rows"]))
        if "html" in ev:
            parts.append(ev["html"])
        if ev.get("note"):
            parts.append(f'<p>{ev["note"]}</p>')
    if s.get("screenshots"):
        parts += ["<h2>Screenshots</h2>", '<div class="shots">' + "".join(shot(x) for x in s["screenshots"]) + "</div>"]
    for key, title, tag in (("analysis", "Analysis", "ul"), ("impact", "Impact", "ul"), ("questions", "Questions for dev", "ol")):
        if s.get(key):
            parts += [f"<h2>{title}</h2>", lst(s[key], tag)]
    if s.get("footer"):
        parts.append(f'<p class="sub">{s["footer"]}</p>')
    title = f'{s["id"]} {s.get("short_title", s["title"])}'[:60]
    return (
        f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>{E(title)}</title><style>{CSS}</style></head><body><main>{''.join(parts)}</main></body></html>"
    )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    spec = json.load(open(sys.argv[1]))
    out = spec["out"]
    if os.path.exists(out) and "--force" not in sys.argv:
        sys.exit(f"{out} exists — never overwrite a delivered report; bump to _v2 (or --force while still drafting)")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w").write(render(spec))
    print(out, os.path.getsize(out) // 1024, "KB")
    if "--open" in sys.argv:
        subprocess.run(["open", out])
