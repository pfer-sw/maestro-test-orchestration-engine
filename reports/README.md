# reports/ — map

Everything here is **local** (gitignored) except this file and `_template/`. Durable facts go to `kb/` / `docs/` (CLAUDE.md
non-negotiable 11). Put a new run in the right folder; never at the root.

| Folder | What goes in it | Naming |
|---|---|---|
| `releases/<version>/` | release runs (one per product / platform) and any release summary | `release_eval_<version>_<date>[_<platform>]/` |
| `features/` | feature evals — run on their own schedule, may span builds and environments | `<feature>_eval_<start date>/` |
| `adhoc/` | ad-hoc checks, single-bug retests, "verify this on env Y" | `<topic>_<date>/` |
| `_template/` | report templates + generators (tracked) | — |

*(example — replace)* `releases/1.2.0/release_eval_1.2.0_2026-01-15/`, `features/onboarding_eval_2026-01-10/`,
`adhoc/login_retest_2026-01-20/`.

**Tool output — written by scripts, don't move or rename:** `raw/` (Maestro JUnit, `calculate-coverage.js`), `coverage/`
(`export-jira.js`, coverage snapshots), `testability/` (`testability-report.js`), `design-audit/` (Figma audit), `ai_interactions/`
(`generate-html-report.js`), `prd_evals/` (`run-scenario-eval.js`).

Inside a run folder: `RUN_LOG.md` (append-only), the HTML report(s) (`_v2`… never overwrite), single-bug reports `BUG-NNN_<slug>.html` +
their spec `BUG-NNN.json` (tracker: `docs/bugs.md`).
