# Reporting run results to Hound (Gyro)

Hound is Gyro's test-management area: a library of test cases (`<PROJECT>-T…`) and, on each ticket,
a **Hound tests** section with a per-platform result and evidence per case. Runs file their results
there so the team sees them on the ticket, not only in a local report.

Setup (`.env`, added by the tester): `HOUND_BASE_URL` (the Gyro host), `HOUND_API_KEY` (a personal
key — acts as the tester — or a project service-account key) and `HOUND_PROJECT` (the Gyro project
key). API contract: `<HOUND_BASE_URL>/api/openapi.json`, paths under `/api/hound`.

## How

1. Write `hound.json` in the run folder (`reports/<adhoc|features|releases>/<run>/`) — format in the
   header of [`scripts/hound-report.js`](../../scripts/hound-report.js): the ticket, and per case
   either an existing `key` or a `definition` (title, description, preconditions, steps, platforms,
   persona, componentId, folderPath), its status, notes and screenshots.
2. **Show the tester the spec**, then `npm run hound-report -- <hound.json> --dry-run`, then live.
3. Cases without a `key` are created and the key is written back, so re-runs report to the same
   cases (evidence is replaced, not appended). A case may name its own `ticket` when one run covers
   two tickets' changes. A successful post stamps `filed` into the spec.
4. `npm run hound-status` lists every run folder and whether it is filed, skipped or still to file.

## Mandatory — file it or say why not

**Every run that verifies a ticket's change files its pass/fail cases on that ticket** before the run
counts as done. Skip only when the run verifies no ticket's acceptance — `hound.json` is then
`{ "skip": "<reason>" }`, also stated in the run's report:
- **exploratory** — mapping behaviour, looking for bugs, no acceptance criteria under test;
- **investigation / data gathering** — evidence for someone else's question;
- **tooling** — trying the framework, a device or an environment;
- **no ticket** — the change shipped without one (e.g. a hotfix PR only): name the PR.

A skipped run still gets its report. If exploring finds a bug, the bug ticket carries the report, and
the retest that verifies the fix files in Hound like any other run. In doubt, ask the tester.
NEEDS INPUT verdicts have no Hound status — they are not filed until resolved.

## Rules

- **`execution`**: `automated` when Claude drives the case's steps — local Maestro MCP runs included,
  no committed flow or CI needed ("counts as automatic if you start the test, don't look at it, and get
  the report at the end — even on your laptop"). Tester setup outside the case's steps does not change
  that; label it tester-induced in the notes. `manual` only when the tester performs the steps.
- **Platforms.** A backend/AI-only change (the app renders nothing differently) files the tested
  platform's result and the case's other platforms as `not_applicable` (`"notApplicable": ["ios"]`
  per case) with a note — Gyro counts that as covered. If the change touches what the app shows,
  untested platforms stay `not_run`. Decided per run, never inferred.
- **Persona is required** to create a case. When no persona matches the run's environment, use the
  closest one and say where the run really happened in the preconditions and the result notes.
- **Report to the ticket that owns the behaviour.**
- **Notes carry environment + build only** from the run identity — never account passwords.

## Gotchas

- **Folders must already exist** — only project leads / folder curators can create them (403,
  nothing written). Ask a lead. Cases outside folders are lead-only too.
- **Folders live in a component**: pass `componentId` with `folderPath`
  (`GET /api/hound/projects/<project>/test-cases` → each case's `componentId` + the `folders` list).
- Evidence sits on the ticket case (`cases[].evidence`), not on the platform run.
- Gyro's WAF rejects default library user agents — the client sends its own.

## Cases owned *(unit)*

| Case | Title | Ticket |
|---|---|---|
| *(example — replace)* PRJ-T12 | Member sees no intro prompts on first chat entry | PRJ-123 |
