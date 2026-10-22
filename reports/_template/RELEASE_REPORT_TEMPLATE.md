# Release Report Template — CANONICAL

**Status: this is THE template for all release testing.** Do not invent a new report format —
extend this one.

**Reference output:** your unit's latest delivered report, highest `_vN` in `reports/release_eval_<VERSION>_<DATE>/`
(local only — `reports/**` is gitignored). Record its path here once you have one.
**Generator:** `reports/_template/generator/example_report.py` (worked example — see its README)

---

## Section order (fixed)

**Principle: order by decision-distance, not chronology.** A manager reads until they can act,
then stops. Everything after that point is for the record and must not be in the way.

### Part 1 — for decisions
| # | Section | Hero class | Purpose |
|---|---|---|---|
| 1 | **Summary** | `hero-next` | Verdict banner, headline stats, top 3 risk cards. If they read only this, they are correctly informed. |
| 2 | **Findings** | `hero-findings` | One card per finding: Observed / Impact / Action + screenshot. |
| 3 | **Test Results Matrix** | `hero-moments` | Case-by-case audit trail with explicit pass conditions. |
| 4 | **Guardrails — Overview & Score** | `hero-guard` | Dual score: pass rate AND coverage. |
| 5 | **Next Steps** | `hero-next` | Ordered by impact, each with a "Why". |

### — `.divider-band`: "Detail & evidence follows" —

### Part 2 — for the record
| # | Section | Hero class | Purpose |
|---|---|---|---|
| 6 | **Test Persona** | `hero-persona` | Who we tested as — plus the run identity: build, device(s), account id + email + password, account config. No persona? Keep the section as "Run identity". |
| 7 | **Conversation Moments** | `hero-moments` | The journey, one card per moment, with exchange + screenshots. |
| 8 | **Testability Register** | `hero-testab` | Dev-facing locator gaps + the reference "good example". |
| 9 | **Automated Coverage Created** | `hero-auto` | What regression suite this run left behind. |
| 10 | Artifacts | — | Where everything lives. |

A `.jumpbar` of anchor links sits directly under the header. Footnote closes the document.

### Test Results Matrix — rules
- Grouped by `<area>` — your product's areas, e.g. Onboarding · Home · Assistant · Forms · Settings · Guardrails
- IDs traceable to `test-cases.json` / `guardrails.json` / `config/matrices/*.json` where they exist
- **Every row states a FALSIFIABLE pass condition** — something a second person could re-check
  and disagree with. "Onboarding works" is checklist theatre; "empty submit shows an inline
  error AND does not navigate" is a real condition. If a falsifiable condition cannot be
  written, the row should not exist.
- `BLOCKED` (feature not deployed) and `NOT TESTED` (out of scope) are listed **per row**, never
  averaged away — gaps must stay individually visible
- Guardrail scenarios live here as rows; the Guardrails section keeps only the score and
  category analysis, so the two never drift apart

## Non-negotiables

1. **Screenshots are base64 data URIs.** Never relative or absolute file paths — the report
   must survive being emailed, dropped in Slack, or opened from anywhere.
   Resize first: `sips -Z 420 <file>.png` keeps a ~20-image report near 2 MB.
2. **Every moment gets a verdict pill** (PASS / PARTIAL / FAIL / NOT TESTED).
3. **Every finding card carries a severity chip** and tags from the fixed set:
   `design` · `ui` · `ai` · `copy` · `flow` · `testability` · `improvement` · `test gap` · `blocked`.
4. **Withdrawn findings stay in the report**, greyed, with the reason. They prove the
   investigation happened and stop the next person re-raising them.
5. **Guardrails get a DUAL score** — pass rate *and* coverage. A 100% pass rate on 22%
   coverage is a statement about the journey, not about the product's safety posture. Say so.
   Coverage = guardrails exercised this run ÷ N, where N = number of guardrails in
   `config/guardrails.json`, counting a guardrail
   as exercised when a case run this release lists it in `guardrailIds`.
6. **Moments cross-reference findings** via a `.bugref` box ("Defects found in this section"),
   pointing at the Findings section. Use `.bugref-clean` when a section is clean.
7. **Be honest about what was not verified.** Every claim the app makes that the test could
   not confirm (e.g. "the assistant said the reminder was set") gets an explicit NOT VERIFIED note.
8. **Tester-induced scenarios are labelled as such.** Impersonating a human agent, admin-forced
   states, injected data, deliberately skipped steps — always marked, so nothing reads as organic.
9. **Never report a defect for an undeployed feature.** Check deployment status first; if the
   backend is not live, the section is BLOCKED, not FAILED.
10. **Run identity is stated in full, twice.** The header line under the title AND the Test Persona
   section carry: build (`versionName` + `versionCode`) · every device (serial + model) · the
   account **id, email AND password** (e.g. `example.member` /
   `qa+example.member@example.com` / `<password>`) · the account config that
   matters for the variant under test. Email + password are what let someone log in later to
   check a finding. These are non-production test accounts only; reports stay local (gitignored).
11. **Calibrate the verdict to the pass condition** (record where your team agreed it):
   - **FAIL**: a single yes/no rule from the spec (PRD / Figma) is clearly broken. Don't soften it
     to PARTIAL. If the rule itself is in doubt, withdraw the finding instead.
   - **PARTIAL**: the case bundles several checks and most hold (e.g. "every fact true": all
     numbers right, one invented time phrase).
   - **NEEDS INPUT**: the app behaves *by design* (reasoning trace, product decision) but the pass
     condition was ours, not the spec's (e.g. a deliberate silent escalation scored against "user
     gets a reply").
   - A finding the team confirms is **fixed** is removed from the next version, together with its
     matrix row.

---

## How to run it

1. Copy `reports/_template/generator/example_report.py` to `reports/release_eval_<VERSION>_<DATE>/generator.py`.
2. Edit its DATA section — plain Python lists / dicts, one worked example entry each:
   `MATRIX` (area → rows), `FINDINGS` / `WITHDRAWN`, `GUARDRAILS`, `NEXT`, `MOM_DATA` (journey
   moments), `AUDIT` (Figma vs app), `TROWS` (testability), `FLOWS`, plus build / device / account.
3. Run it: `python3 reports/release_eval_<VERSION>_<DATE>/generator.py --date <DATE> --out <file>`
   (`--shots`, `--figma-mapping`, `--figma-manifest` optional). Screenshots are resized and embedded.
4. Output goes to `reports/release_eval_<VERSION>_<DATE>/` (e.g. `release_eval_1.2.0_2026-01-15`). The release tag is also in every file name: `<platform>_<product>_release_eval_<VERSION>_<DATE>_vN.html`, `RUN_LOG_<VERSION>.md`.

**Versioning:** never overwrite a delivered report. New revision = `_v2`, `_v3`.

---

## Helper components available in the CSS

`.hero` (+ colour variants) · `.round-card` (moment) · `.finding-card` · `.gallery`
`.bugref` / `.bugref-clean` · `.auto-card` · `.sug` (next step) · `.callout` / `.callout-blue`
`.verdict-pill` · `.sev` chips · `.tag` chips · `.message-bubble` (`.bubble-assistant` / `.bubble-user` / `.bubble-human-agent`)
`.screenshot-missing` (a capture that does not exist — never omit it)
