# Design audit — app vs Figma

Optional. Runs when `test` is invoked with `--compare-figma=<url>`, or when a release runbook asks for it.
A failure here never aborts test execution.

## 1. Download frames (once per run)
```bash
node scripts/save-figma-screenshots.js --figma-url=<url> --date=<YYYY-MM-DD>
# a second mapping file (one per Figma file / feature):
node scripts/save-figma-screenshots.js --figma-url=<url> --mapping=config/figma-mapping-<feature>.json --label=<feature> --date=<YYYY-MM-DD>
```
Writes PNGs plus `_manifest.json` (`{ nodeId → path }`) to
`screenshots/design-audit/figma/<date>[/<label>]/`. Needs `FIGMA_TOKEN`. On failure: warn
and skip the audit for the run.

Rate limit: a 429 with `x-figma-rate-limit-type: low` can carry a multi-day Retry-After. Ask
the tester to export the whole section as PNG, then crop it with
`python3 scripts/crop-figma-section-export.py --tree <nodes json> --mapping … --section <id>=<png> --out …`.
Never use the Figma MCP `get_screenshot` for bulk frames — it is rate-limited.

## 2. Match each screen to a frame
- Mapping entries are keyed by **screen key** (`onboarding.intro`, `notes.empty_state`, …), not by
  taxonomy flow id. Pick the key for the screen the flow ends on; use the flow id only where the
  two coincide.
- No entry → log `Design audit: no mapping found for <flowId> — skipping` and continue.
- Entry but node missing from the manifest → write
  `{ "flowId", "overallResult": "error", "error": "Figma frame not downloaded", "runDate", "sequenceIndex" }`.

### Animation frames
Screens often have several keyframes (idle → typing → settled). Map the **final** frame —
the state the user sees once the animation settles (`isFinalFrame: true`). An early frame
produces false "mismatches". When creating an entry:
1. `GET /v1/files/:fileKey/nodes?ids=<sectionNodeId>` to list children.
2. Sort by `absoluteBoundingBox.x` (left → right = start → end).
3. Use the last one; list every frame in `notes`
   (e.g. `3 frames: 101 (idle), 102 (typing), 103 (reply shown — USE THIS)`).

## 3. Compare
1. Capture the app screen with adb (`adb -s <dev> exec-out screencap -p > screenshots/design-audit/app/<date>/<flowId_dots_to_underscores>_app.png`).
2. Fill `prompts/design-audit/figma-screen-comparison.md`: `flowId`, `flowName`,
   `figmaFrameName`, `figmaScreenshotPath`, `appScreenshotPath`, `sequenceIndex` (or null),
   `flavor`, `runDate`, `notes` (or "None").
3. Read both images, run the comparison, write the JSON (including `sequenceIndex`) to
   `reports/design-audit/<date>/<flowId>.json`.
4. Print `Design audit [<flowId>]: <overallResult> — <summary>`; prefix `DESIGN MISMATCH` on fail.

## 4. Report
```bash
node scripts/generate-design-audit-report.js --date=<YYYY-MM-DD> --flavor=<id> [--mapping=config/figma-mapping-<feature>.json]
```
Exit code 1 = critical mismatches → put **DESIGN MISMATCHES FOUND** in the run summary. If the
script fails, log it and continue.

## What to check, what not to flag
- Brand colours and gradients, not just the presence of an element.
- **Keep flagging every visual deviation even when Figma is known to lag**; the tester withdraws
  the intended ones (and withdrawn findings stay in the report with the reason).
- **Never flag backend-driven values**: durations, titles, badges, counters, server-provided copy.
- Keep per-file Figma notes (outdated areas, key naming) in the feature's release runbook under
  `kb/local/release/`.
