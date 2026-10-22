# Release report generator — worked example

`example_report.py` builds the canonical release report described in
[`../RELEASE_REPORT_TEMPLATE.md`](../RELEASE_REPORT_TEMPLATE.md), with one illustrative entry per
section for the fictional *Example Notes* app. It is **not part of the runtime**: nothing in
`scripts/` or `package.json` imports it.

```bash
python3 reports/_template/generator/example_report.py --date 2026-01-01 --out /tmp/example.html
```

| Option | Default |
|---|---|
| `--date` | `2026-01-01` |
| `--shots` | `screenshots/test_runs/<date>/` |
| `--out` | `reports/release_eval_<BUILD>_<date>/release_eval_<BUILD>_<date>_v1.html` |
| `--figma-mapping` | `config/figma-mapping.json` |
| `--figma-manifest` | none — `_manifest.json` written by `scripts/save-figma-screenshots.js` |
| `--allow-overwrite` | off — the script refuses to overwrite a delivered report |

Paths are relative to the repo root. Pillow is used to resize screenshots when installed; a missing
screenshot renders as `not captured`.

For a release: copy the file next to the run (`reports/release_eval_<VERSION>_<DATE>/generator.py`),
replace the DATA section, run it. The earlier numbered `00`–`07` assembly scripts were removed —
this single file replaces them.

`release_report.css` is the shared, authoritative stylesheet (inlined into every report).
`css_v2_reference.txt` is an older v2 snapshot without the v3 additions (jumpbar, divider band,
verdict hero, risk cards) — reference only.
