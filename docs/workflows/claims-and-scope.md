# Claims & scope checklist — before a claim, a report or a hand-off

Three short gates. Each one exists because skipping it cost a report revision or the tester's trust
in the unit this engine came from.

## 1. Before calling something "new" (new bug, new in this build, regression)
"New" is a claim about history — check the history first:
- `grep -rni "<key words / id / screen>" docs/bugs.md docs/testability/missing-resource-ids.md docs/app/ kb/local/`
- Older builds: the previous release report's findings (local) and `git log --all --grep=<key words>` in this repo.
- The ticket tracker: is there already a ticket? Check the release ticket's linked tickets and a text search.

Found earlier → say "**seen before** on <build/date> (<where>)", not "new". Not found → "**not seen before** in
bugs.md / register / notes", which is what we can actually prove. "Regression" needs a build where it worked.
*Why:* a behaviour already in the testability register was reported as "new in this release".

## 2. Before generating a report — the scope line
Write one line and **get the tester's OK before generating**:

> **Scope:** <feature / legs> · <platforms> · <env> · <builds> · **in:** <case ids / areas> · **out:** <excluded ids / areas, why>

- It goes in the report header and the run log, verbatim.
- Every case and finding in the report must be inside **in**; anything in **out** is left out entirely (not
  greyed, not "NOT TESTED") unless the tester says otherwise.
- Don't re-offer an out-of-scope item later in the run ("want me to try X?") — it was decided.

*Why:* a feature report went v1 → v3 because its scope was set after generating, and a debug option that had been
ruled out was offered again mid-run.

## 3. Hand-offs and bulk edits
- **Every delivered file** (report, HTML, export): print its **absolute path** and the reveal command on its own line:
  `open -R "/Users/…/report_v2.html"` (macOS).
- **Bulk path / name rewrites** (`sed -i`, scripted renames, moving folders): exclude `*.html` and anything under
  `reports/**` that was delivered — delivered reports are never edited; a new revision is `_vN`.
  Check with `grep -l` what the rewrite would touch before running it.
