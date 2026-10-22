# Maestro + Claude Test Engine

**An AI-driven mobile test framework.** Claude explores your app, writes the
Maestro flows, runs them, heals the ones that break, and reports what it found.

Built on [Maestro](https://maestro.dev) via MCP, with Claude as the brain rather
than the typist. You point it at a build; it produces a coverage map, a set of
executable flows, and a scored report.

---

## Why this exists

Conventional mobile suites rot. Someone renames a button, forty flows go red, and
a human spends a morning re-writing selectors. Worse, nobody can tell you what
*isn't* covered — only what's failing.

This framework inverts that:

- **The map is the source of truth.** `coverage/taxonomy.json` tracks every screen
  and flow with a live status, so coverage is a fact you can query, not a guess.
- **Broken flows get repaired, not rewritten by hand.** When Claude runs the suite,
  a failure triggers a re-inspection of the view hierarchy, a regenerated flow
  against current resource-ids, and a re-run.
- **Untestable UI becomes a work item.** Every run appends elements that lack a
  stable `resource-id` to a dev-facing register — the framework reports on your
  app's testability, not just its correctness.
- **It can test an LLM through the UI.** If your app embeds an assistant, the
  framework drives it adversarially and scores the *semantics* of what it did,
  not just whether a tap landed.

---

## Two ways to run it

The intelligence — reading screens, writing and healing flows, judging an LLM's
answers — comes from **Claude running a session with `CLAUDE.md` as its
instructions** and the Maestro MCP server as its hands. The Node scripts are the
plumbing Claude calls into; on their own they do only the mechanical part.

| | Claude-driven (Claude Code session) | Script-only (`npm run …`) |
|---|---|---|
| Run flows, record coverage, export to Jira | ✅ | ✅ |
| Baseline circuit breaker, failure screenshots | ✅ | ✅ |
| BFS exploration and flow generation | ✅ | ✗ — helpers only |
| Healing failed flows (`--heal`) | ✅ | ✗ — prepares the context, then stops |
| Gap-filling, LLM semantic evaluation, design audit comparison | ✅ | ✗ |
| Release testing and reports | ✅ | ✗ |

Use script-only runs for unattended regression on flows that already exist; use a
Claude session for everything that needs judgement. Where the scripts stop, they
say so in the code (`NOTE FOR CLAUDE`).

---

## The two phases

Claude operates in two modes. Everything else is plumbing.

### Phase 1 — Explorer

```bash
npm run explore -- --flavor=<flavor>
```

Claude-driven. Breadth-first walk of the app. For each screen Claude takes a screenshot,
inspects the view hierarchy, classifies the screen, generates a Maestro YAML
flow, validates it, and enqueues whatever it can navigate to next. Output is a
populated taxonomy plus a directory of flows that actually run.

### Phase 2 — Orchestrator

```bash
npm run test -- --flavor=<flavor> --heal
```

Builds an execution plan (`baseline` → `feature` → `ai`, critical-first within
each), runs it, recalculates coverage and exports to Jira — this much the script
does on its own. In a Claude session it also heals failures and fills coverage
gaps with mini-explorations.

**Baseline flows are a circuit breaker.** If one fails and can't be healed, the
run stops immediately — a broken login makes every downstream result meaningless.

---

## Quick start

**Requires** Node ≥ 20, [Maestro](https://docs.maestro.dev), the Android SDK
(`adb` on `PATH`), a connected device or emulator — for iOS, macOS + Xcode and a
**simulator build** of the app (`.app` for `iphonesimulator`; a device `.ipa` won't
install — see `docs/engine/ios-simulator-notes.md`), and — for anything
Claude-driven — [Claude Code](https://claude.com/claude-code) with the Maestro
MCP server registered for this project:

```bash
npm install
cp .env.example .env     # then fill it in — see Configuration
claude mcp add maestro -- ~/.maestro/bin/maestro mcp --working-dir "$PWD"
```

Then either open Claude Code in the repo and ask for a mode from `CLAUDE.md`
(`explore --flavor=<flavor>`, `test --flavor=<flavor> --heal`, a release test),
or run the script-only pieces directly:

```bash
npm run test -- --flavor=<flavor> --group=baseline   # execute + coverage, no healing
npm run coverage                                     # coverage snapshot
```

| Command | What it does |
|---|---|
| `npm run explore` | Phase 1 helpers — the BFS itself is Claude-driven |
| `npm run test` | Phase 2 — execute, coverage, circuit breaker (healing needs Claude) |
| `npm run coverage` | Recalculate coverage from JUnit output |
| `npm run export-jira` | Push dashboard + file bugs (`--dry-run` supported) |
| `npm run sync-kb` | Refresh the knowledge base from upstream repos |
| `npm run dashboard` | Local coverage dashboard |
| `npm run prd-eval` | Scenario eval from `config/scenarios/*.md` (optional) |
| `npm run full-run` | test → coverage → export, in sequence |

---

## Adopting the engine (new unit)

This branch is the **engine only**: scripts, prompts, process rules and empty,
shaped slots for your unit's knowledge. Every slot ships with one worked example
for a fictional app, *Example Notes* (`com.example.notes`), so Claude can see the
expected shape before writing yours. Example files and rows are marked
`example` — the bootstrap run replaces them.

1. **Fork** this branch into your unit's repo (keep it private once it holds your
   accounts and product rules).
2. **Set up the machine** — Quick start above, then create `.env` from
   `.env.example` yourself (Claude never reads or writes env files).
3. **Open Claude Code in the repo and say `bootstrap`.** Claude interviews you
   (apps, flavors, accounts, KB sources, integrations, safety rules), fills the
   slots below, and does a depth-1 exploration on a device. See
   [`docs/workflows/bootstrap.md`](docs/workflows/bootstrap.md).
4. Then `explore --flavor=<id>` to map the app, and `test --flavor=<id> --heal`.

| Slot | Holds | Shape documented in |
|---|---|---|
| `config/flavors.json` | apps / variants under test, AI-assistant selectors | `config/README.md` |
| `config/accounts.json` | test accounts (metadata + `passwordEnvVar`) | `config/README.md` |
| `config/kb.json` | where your knowledge base comes from | `kb/README.md` |
| `config/test-cases.json`, `guardrails.json` | AI-assistant behaviour library (optional) | `config/README.md` |
| `coverage/taxonomy.json` | feature → flow map, the coverage source of truth | `config/README.md` |
| `flows/` | your Maestro flows (`baseline/` gates every run) | `CLAUDE.md` → File naming |
| `kb/local/rules/` | product rules, each with a verification status | `kb/local/rules/README.md` |
| `kb/local/release/` | release runbooks | `kb/local/release/_runbook-template.md` |
| `docs/app/` | your app's ids, quirks, environments | the templates inside |
| `docs/personas.md` | personas that drive release runs | the file itself |
| `docs/testability/missing-resource-ids.md` | dev-facing register of untestable UI | the file itself |
| `CLAUDE.md` → *Unit-specific rules* | your domain's safety / never-do rules | `CLAUDE.md` |

Generic Maestro / Android / iOS knowledge you should **not** have to rediscover
lives in `docs/engine/`.

### Pulling engine updates

Keep this branch as a remote (`git remote add engine <url>`) and merge it into
your unit's branch. Engine changes touch `scripts/`, `prompts/`, `docs/engine/`,
`reports/_template/` and the generic sections of `CLAUDE.md`; your knowledge
lives in the slots above, so conflicts stay small. Improvements that are not
unit-specific should go back upstream as a PR to this branch.

> **Locator discipline is enforced.** Resource ID → content description (matched
> with `text:`) → exact text → regex. Coordinates never. Maestro has no `~`
> accessibility-id prefix — `id: "~…"` never matches. IDs survive locale changes
> and copy edits; text does not. Always `inspect_screen` before writing a flow.

---

## Testing an embedded LLM

If your app ships an in-app assistant, set `aiTesting` on the flavor and the
framework switches on two-layer evaluation:

| Layer | Question | Verdict |
|---|---|---|
| **1 — Maestro** | Did the interaction execute? | `maestro_result` |
| **2 — Claude** | Did the assistant do the *right thing*? | `semantic_result` |

Five categories are exercised: happy path, ambiguous input, out-of-scope,
**adversarial** (prompt injection, jailbreaks), and edge cases.

Because LLMs are non-deterministic, aggregation differs by intent. A happy path
passes if it succeeds on *any* run. Out-of-scope and adversarial cases pass only
if they hold on **every** run. Different behaviour across identical runs is
flagged as a `consistency_issue` even when the aggregate passes — instability is
itself the finding.

**Adversarial failures escalate immediately** — a security bug is filed mid-run
rather than at the end.

---

## Release testing

The most-used mode. A release evaluation is a guided, persona-led run of a real
build, driven by Claude with a human tester alongside (the tester does what
Claude physically cannot — hardware-gated screens, back-office tools — and
triages findings live). Its shape is fixed:

1. Drive the journey as one persona from `docs/personas.md`.
2. Check what is deployed first — an undeployed feature is **BLOCKED**, never FAILED.
3. Record the build of record and every device; screenshot every interaction.
4. Update the testability register on every new screen — a deliverable of every run.
5. Score AI behaviour against `config/test-cases.json` and `config/guardrails.json`.
6. Promote validated checks into flow files before reporting coverage.
7. Generate the report from `reports/_template/RELEASE_REPORT_TEMPLATE.md` — never
   a new format, never overwriting a delivered version.

Product-specific procedures and rules live in `kb/local/release/` (runbooks) and
`kb/local/rules/` (observed product behaviour, each file marked with its
verification status).

---

## Repository layout

```
scripts/            Engine. Phase runners + lib/ (maestro, jira, accounts, kb, coverage)
prompts/            The actual intelligence — screen analysis, flow generation,
                    healing, semantic evaluation, design audit
config/             flavors · accounts · global · test-cases · guardrails · kb · matrices/
                    (schemas: config/README.md)
coverage/           taxonomy.json — the single source of truth
flows/              baseline/ (all flavors, + _subflows/) · ai/ (assistant meta-tests) · generated/
kb/local/           authored, tracked: rules/ (product rules, with status) · release/ (runbooks)
docs/               engine/ (generic Maestro/device knowledge) · app/ (your app's notes) ·
                    workflows/ (bootstrap, ad-hoc, AI behavioural run, accounts) · personas ·
                    design-audit · engineering decisions · testability register
reports/_template/  Canonical release-report format — do not improvise a new one
CLAUDE.md           Claude's operating instructions. The most important file here.
```

### `CLAUDE.md` is the real entry point

It is not documentation *about* the framework — it *is* the framework's control
logic. Both phases, the error-handling matrix, the escalation rules and the
reporting contract live there, and Claude follows it literally. Read it before
changing behaviour; edit it to change behaviour.

---

## What ships, and what doesn't

This branch holds the **engine plus one worked example per slot**. A fresh clone is
deliberately not a fully-loaded test suite, and it helps to know which absences
are intentional.

### Run artefacts are excluded

Screenshots, video, synced knowledge base and delivered reports are all
git-ignored. They are outputs, regenerated every run, and they dominate the
repo's size — the working directory routinely exceeds 250 MB while the tracked
tree is under 1 MB. Directories are kept with `.gitkeep` so paths resolve on a
fresh clone.

The one exception is `reports/_template/`, which is tracked: the report format
is a contract, not an output.

### The knowledge base is synced, not stored

Synced `kb/` sources are git-ignored because they are **mirrors**, not sources.
Their contents are pulled from upstream repositories declared in `config/kb.json`,
and committing a copy would create a second, silently-drifting version of content
that already has an owner elsewhere. `kb/local/` is the exception: it is authored
here and tracked (see `kb/README.md`).

**A fresh clone therefore has only `kb/local/`.** This does not break anything, but
it does change behaviour: evaluations for test cases with a `metadata.protocol`
fall back from `prompts/ai-flavor/kb-evaluator.md` to
`prompts/ai-flavor/response-verification.md` — they still run, but without
domain ground truth. Populate it before relying on domain scoring:

```bash
npm run sync-kb          # needs GITHUB_TOKEN + GITHUB_ORG, or a local checkout path
```

Every `test` run checks KB freshness and warns if a source is stale (default
threshold: 7 days) without aborting.

---

## Configuration

Copy `.env.example` to `.env` and fill it in. `.env` is git-ignored and must stay
that way — only `passwordEnvVar` *names* belong in committed config. Keep `.env`
out of Claude's reach: add `Read(./.env*)` and `Edit(./.env*)` to `permissions.deny` in your own
Claude Code settings (e.g. `.claude/settings.local.json` or `~/.claude/settings.json`) — the engine
does not ship that setting. Claude adds an account's metadata to `config/accounts.json`, and the
tester adds its password.

| Variable | Purpose |
|---|---|
| `MAESTRO_DEVICE_ID` | Target device/emulator serial (`adb devices`) |
| `APP_ID` | App id (package / bundle id) — single flavor |
| `<FLAVOR>_APP_ID` | App id per flavor when there are several (e.g. `MEMBER_APP_ID`); each flavor maps it to `env.APP_ID` — see `config/README.md` → `flavors.json` |
| `ACCOUNT_<ID>_PASS` | One per account in `accounts.json` |
| `ANTHROPIC_API_KEY` | Claude-driven analysis, healing, evaluation |
| `JIRA_*` | Dashboard + bug export (optional — falls back to `reports/coverage/`) |
| `FIGMA_TOKEN` | Design-audit comparisons (optional) |
| `GITHUB_TOKEN` / `GITHUB_ORG` | Knowledge-base sync (optional) |
| `KB_LOCAL_SOURCE_PATH` | Local checkout path for a local-repo KB source (optional) |
| `WIKI_BASE_URL` / `WIKI_API_KEY` | `npm run fetch-wiki` mirror of wiki pages (optional) |
| `SPLASH` / `NET_LOG_TAG` / `FLAVOR` | `scripts/release-tools/` (see `_env.sh`). The tools load `.env` themselves (shell exports win); with several flavors they pick `<FLAVOR>_APP_ID`, so export `FLAVOR` (default `main`) |

Optional integrations degrade gracefully: a missing `JIRA_*` writes coverage
locally and logs; a failed Figma fetch skips the design audit; neither aborts a
run.

---

## Design audit (optional)

```bash
npm run test -- --flavor=<flavor> --compare-figma=<url>
```

Downloads the mapped Figma frames once, screenshots each passing screen, and has
Claude compare them, writing per-flow JSON plus an HTML report.

> **Animation frames matter.** Map to the **final** frame of an animation — the
> state a user actually sees once it settles. Pointing at an idle or mid-typing
> frame produces false mismatches. `config/figma-mapping.json` documents the
> available frames per screen in its `notes` field.

---

## Conventions that are not optional

A few rules exist because violating them silently corrupts results:

- **Never assert data a skipped step didn't produce.** When a flow reaches a
  screen by skipping the step that populates it, assert structure only —
  containers, CTAs, navigation.
- **Never overwrite `taxonomy.json` on conflict.** Append to
  `coverage/taxonomy.drift.json` and flag it. The map is only useful if it's trusted.
- **Never overwrite a delivered report.** Version it: `_v2`, `_v3`.
- **Withdrawn findings stay in the report**, with the reason they were withdrawn.
- **Tester-induced scenarios get labelled** — forced states and deliberate skips
  are not organic behaviour and must not read as such.
- **Unverifiable claims get an explicit `NOT VERIFIED` note.** If the app claims
  something the test could not confirm, say so rather than implying it passed.

Full rules, including the error-handling matrix, live in `CLAUDE.md`.
