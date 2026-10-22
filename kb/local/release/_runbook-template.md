# <Product / feature> release test — runbook (repeat every release)

One line: what this release evaluation covers, on which platform, and which run it was built from
(version, date). Copy this file to `<product>-release-runbook.md` and fill every section.

Read first: product rules (`../rules/<file>.md`) · conversation protocol if the app has an AI
assistant ([`docs/workflows/ai-behavioural-run.md`](../../../docs/workflows/ai-behavioural-run.md)) ·
device quirks ([`docs/app/android-automation-notes.md`](../../../docs/app/android-automation-notes.md)) ·
report rules `reports/_template/RELEASE_REPORT_TEMPLATE.md`.

---

## 0. Legs
Split the release into legs; for each, say what it covers, who drives it (Claude vs tester) and
which rules / test cases score it.

| Leg | What | Driven by | Rules / cases |
|---|---|---|---|
| *(example — replace)* A. Login → first note | fresh account, onboarding, create a note | Claude | `example-notes-rules.md` §1–2 |

Drive the whole journey as **one persona** (`docs/personas.md`); say which legs can interleave.

## 1. Before the run
Numbered checklist: account (fresh, recorded in `config/accounts.json`), build of record + device,
known issues + deployment check (not deployed = BLOCKED), report folder + run log, screenshot folder.

## 2. Constants for every leg
Rules that hold across all legs: safety stop rules (`CLAUDE.md` → "Unit-specific rules"), what is
out of scope (e.g. AI-service instability), which actions are reversible, testability register on
every new screen.

## 3. Leg <X> — <name>
One section per leg that needs more than its table row: the procedure, what to log along the way
(data-log table shape), how to score it, and what counts as NEEDS INPUT.

## 4. Deliverables
1. Report from the template (base64 screenshots, fixed sections, next `_vN`, never overwrite).
2. Testability register rows.
3. Validated checks promoted to flow files + `coverage/taxonomy.json`.
4. Rules updates in `kb/local/rules/` for anything new, with build + date.

## 5. Carry-over
What the next run must pick up: checks never executed, failures to re-check, BLOCKED items and
what unblocks them. Update at the end of every run.

| What | Status |
|---|---|
| *(example — replace)* Offline sync conflict (rule 3.2) | never observed — needs two devices |
