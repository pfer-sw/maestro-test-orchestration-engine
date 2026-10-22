# Product rules (authored, tracked)

The single home for how the app is supposed to behave. Each file starts with a
frontmatter header:

| Field | Values |
|---|---|
| `scope` | which product/flavor the rules cover |
| `status` | `observed` — seen in a named build · `spec` — authoritative guideline, not build-specific · `unverified` — stated by the tester/product, never yet observed |
| `verifiedOn` | build + date of the last run that confirmed it |
| `evaluator` | `include` — injected into Layer 2 evaluation · `exclude` — reference for testers/Claude only |

`scripts/lib/kb-client.js` injects a file **only** when `evaluator: include` **and** `status` is not
`unverified`. A rule nobody has seen the app follow must not become evaluation ground truth.

**Upstream drift.** When an upstream PRD or spec contradicts a rule here, don't rewrite the rule —
product intent often changes at launch. Append an `## Upstream drift (not built)` section citing the upstream
file + commit, and an `upstreamDrift` note on affected test cases. Validate when the feature ships, then update
the rule or drop the note.

## File index

| File | Scope | Status | Evaluator |
|---|---|---|---|
| [`example-notes-rules.md`](example-notes-rules.md) *(example — replace)* | Example Notes: note creation, sync, empty state, assistant actions | observed | exclude |

## Context pack — read before any run

`CLAUDE.md` → Rule zero: before the first device action of **any** run, read the rows for the
areas involved. Paths are from the repo root.

| Area | Read |
|---|---|
| Always | `docs/engine/maestro-android-notes.md` · `docs/app/android-automation-notes.md` · `docs/personas.md` · `scripts/release-tools/` headers (screen, net, burst, capture-video, relaunch, say) |
| *(example — replace)* Notes / assistant | `kb/local/rules/example-notes-rules.md` · `docs/workflows/ai-behavioural-run.md` · `config/test-cases.json` (`note_actions`) · `config/guardrails.json` |
| New account | `docs/workflows/account-provisioning.md` |
| iOS simulator run | `docs/engine/ios-simulator-notes.md` · `docs/app/ios-automation-notes.md` |

When a new rules file is added, add its row here — an unlisted file is a file nobody reads.

## Maintenance
- Update a file whenever a run confirms or contradicts an entry; bump `verifiedOn`.
- Mark tester-stated rules **(tester)** inline.
- When an `unverified` rule is first observed, change `status` to `observed` — only then may it
  be switched to `evaluator: include`.
- State each rule once. If two products share it, give it its own file and link to it.

Feature specs (prose) live in `docs/specs/`; their machine-readable test matrices in
`config/matrices/` (schema: `config/README.md`); release procedures in `kb/local/release/`.
