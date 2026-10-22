# Release-testing knowledge (authored, tracked)

Everything needed to repeat a release evaluation without the previous session's context.
**Not injected into Layer 2 evaluation** — `config/kb.json` `local-supplements` excludes this
directory (`excludeDirs: ["release"]`) so it never eats the evaluator token budget.

One runbook per product or feature release suite, written from
[`_runbook-template.md`](_runbook-template.md).

| File | What |
|---|---|
| [`_runbook-template.md`](_runbook-template.md) | Heading layout every runbook follows |
| *(example — not shipped; illustrates a row)* `example-notes-release-runbook.md` | Example Notes release test: legs A–C (login + notes, assistant, sync), deliverables, carry-over |

## Related, elsewhere in the repo

| Where | What |
|---|---|
| `kb/local/rules/` | Product rules the runbooks test against |
| `docs/engine/maestro-android-notes.md` · `docs/app/android-automation-notes.md` | Device / Maestro / app gotchas |
| `reports/_template/RELEASE_REPORT_TEMPLATE.md` | Canonical report rules |
| `scripts/release-tools/` | Device helpers (`screen.sh`, `net.sh`, `burst.sh`, `relaunch.sh`, `capture-video.sh`, `say.sh`, `frames.py`, `figma_compare.py`) |
| `docs/testability/missing-resource-ids.md` | Testability register |
| *(example — replace)* `flows/<suite>/` | Maestro flows promoted from release runs |

Update the rules files whenever a run contradicts them, and add to the runbook's carry-over table
at the end of each run.
