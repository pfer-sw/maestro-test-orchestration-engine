# Claude Operating Instructions: Maestro MCP Testing Framework

You are the AI brain of a mobile testing framework. **Read the command you were invoked
with** to know which mode to run. This file holds the engine rules; app-specific knowledge
lives in the files listed under "Where things live".

> **Engine branch.** Files marked *(unit)* below are slots each unit fills with its own
> knowledge; they ship with one worked example for the fictional *Example Notes* app
> (`com.example.notes`). If `config/flavors.json` still describes Example Notes, the repo has not
> been set up yet — run **`bootstrap`** before anything else.

## Rule zero — read the KB before every run, then act autonomously

**Every mode, every request that touches the device** (explore, test, release, ad-hoc, a "quick
check"): before the first device action, read the context pack for the areas involved —
[`kb/local/rules/README.md` → Context pack](kb/local/rules/README.md#context-pack--read-before-any-run).
Device and tooling knowledge counts too (`docs/engine/`, `docs/app/`, `scripts/release-tools/`).

The tester expects Claude to be **almost autonomous**: the KB answers what to tap, what to say and
what to expect. Drive everything that has a locator; hand over only what Claude physically cannot
do (hardware-gated screens). Web back-office tools are Claude's too, via Claude in Chrome — also the
fallback whenever an API / key / MCP route fails ([`docs/engine/web-back-office.md`](docs/engine/web-back-office.md), ED-002). Ask only when the answer changes
what is being tested. Needing to be guided step by step through something the KB already covers is
a failure of this rule.

When a run teaches something durable, write it where the next run will read it: product behaviour
→ `kb/local/rules/`; app ids and quirks → `docs/app/`; generic Maestro/device knowledge →
`docs/engine/`. Never only in memory or a report.

---

## Quick reference

| Command / request | Mode | Procedure |
|---|---|---|
| `bootstrap` | Unit onboarding — interview the unit, fill the *(unit)* slots, first exploration | [`docs/workflows/bootstrap.md`](docs/workflows/bootstrap.md) |
| `explore --flavor=<id>` | Explorer — map an app, discover screens, generate flows (first contact with a new app or flavor) | [`docs/workflows/explorer.md`](docs/workflows/explorer.md) — read it before starting |
| `test --flavor=<id\|all> [--heal] [--group=<baseline\|feature\|ai>]` | Orchestrator — run the flow suite, heal failures, fill coverage gaps, AI meta-tests | [`docs/workflows/orchestrator.md`](docs/workflows/orchestrator.md) — read it before starting |
| `test … --compare-figma=<url>` | Orchestrator + design audit | [`docs/design-audit.md`](docs/design-audit.md) |
| "release test / release eval" | Release run | **Release testing** below |
| anything else — "quick test", "check if X works", "verify this change on env Y" | Ad-hoc run | [`docs/workflows/ad-hoc-run.md`](docs/workflows/ad-hoc-run.md): load the context pack **before** the first device action; Claude drives everything with a locator |
| AI assistant behavioural run | Persona-driven conversation | [`docs/workflows/ai-behavioural-run.md`](docs/workflows/ai-behavioural-run.md) |

Flavor ids are the keys of `config/flavors.json`.

## Where things live

| Need | File |
|---|---|
| Product rules (how the app should behave) *(unit)* | [`kb/local/rules/`](kb/local/rules/README.md) — index + context pack in its README |
| Generic Maestro / Android / MCP quirks, text entry, evidence, flow speed | [`docs/engine/maestro-android-notes.md`](docs/engine/maestro-android-notes.md) |
| Generic iOS simulator notes | [`docs/engine/ios-simulator-notes.md`](docs/engine/ios-simulator-notes.md) |
| Web back-office tools (Claude in Chrome, Maestro web) | [`docs/engine/web-back-office.md`](docs/engine/web-back-office.md) |
| Camera / video injection on the emulator | [`docs/engine/camera-injection.md`](docs/engine/camera-injection.md) |
| Your app's ids, quirks, environments *(unit)* | [`docs/app/android-automation-notes.md`](docs/app/android-automation-notes.md) · [`docs/app/ios-automation-notes.md`](docs/app/ios-automation-notes.md) |
| AI assistant reasoning traces (optional, read-only) | [`docs/engine/llm-traces.md`](docs/engine/llm-traces.md) · `npm run trace -- <id>` · `config/llm-trace.json` |
| Harness patterns not shipped as code | [`docs/engine/patterns.md`](docs/engine/patterns.md) |
| Framework backlog — tooling, flows, harness work *(unit)* | [`docs/TODO.md`](docs/TODO.md) |
| Product / release follow-ups — re-tests, items waiting on dev or product, runs left to finish *(unit)* | [`docs/FOLLOW-UPS.md`](docs/FOLLOW-UPS.md) |
| Feature specs + matrices *(unit)* | Specs (prose) in `docs/specs/` (create as needed); machine-readable test matrices in `config/matrices/` (schema: `config/README.md`) |
| Config file schemas (flavors, accounts, test cases, guardrails, matrices, Figma, testability) | [`config/README.md`](config/README.md) |
| Personas *(unit)* | [`docs/personas.md`](docs/personas.md) |
| Creating test accounts *(unit)* | [`docs/workflows/account-provisioning.md`](docs/workflows/account-provisioning.md) |
| Release runbooks *(unit)* | `kb/local/release/` — start from [`_runbook-template.md`](kb/local/release/_runbook-template.md) |
| Bug tracker + single-bug HTML report *(unit data)* | [`docs/bugs.md`](docs/bugs.md) · [`reports/_template/bug-report/BUG_REPORT_TEMPLATE.md`](reports/_template/bug-report/BUG_REPORT_TEMPLATE.md) |
| Release report template (canonical) | [`reports/_template/RELEASE_REPORT_TEMPLATE.md`](reports/_template/RELEASE_REPORT_TEMPLATE.md) |
| Testability register *(unit data)* | [`docs/testability/missing-resource-ids.md`](docs/testability/missing-resource-ids.md) |
| Knowledge base sources | [`kb/README.md`](kb/README.md) · `config/kb.json` |
| AI assistant meta-testing (generic LLM-through-the-UI categories), evaluator swap for scripted evals, per-flow account resolution | [`docs/workflows/orchestrator.md`](docs/workflows/orchestrator.md) |
| Wiki pages mirrored locally | `npm run fetch-wiki -- <url\|slugId> --out=kb/wiki/<name>.md` (`WIKI_BASE_URL` + `WIKI_API_KEY`) |
| Filing run results + evidence on a Gyro ticket (Hound test cases) | [`docs/workflows/hound-reporting.md`](docs/workflows/hound-reporting.md) · `npm run hound-report -- <hound.json>` · `npm run hound-status` |
| Engineering decisions | [`docs/engineering-decisions.md`](docs/engineering-decisions.md) |
| Before saying "new", generating a report, or handing off a file | [`docs/workflows/claims-and-scope.md`](docs/workflows/claims-and-scope.md) — history check, scope line OK'd by the tester, absolute path + `open -R` |
| Check links, anchors, rules index, accounts and taxonomy (no device) | `npm run kb-lint` — also runs by itself after every doc edit (hook) |
| Wins (release-changing catches + the habit behind each) *(unit)* | [`docs/wins.md`](docs/wins.md) — add an entry when the tester credits a catch |

When a run confirms or contradicts a product rule, update the rules file — not memory.

## Driving the device — CLI for the phone, MCP for the web

| Target | Use |
|---|---|
| **Phone** (Android device or emulator, iOS simulator) — the default for every device run | Maestro **CLI**: `~/.maestro/bin/maestro --device <id> test <flow>` and `maestro --device <id> hierarchy`. Screenshots: `adb -s <id> exec-out screencap -p` or `scripts/release-tools/screen.sh <label>` (also saves the hierarchy). One-off steps: write the flow to a scratch file and run it with the CLI. Syntax check: `maestro check-syntax <flow>`. Each call under a hard timeout, one Maestro process at a time — [`docs/engine/maestro-android-notes.md`](docs/engine/maestro-android-notes.md#tooling-gotchas) |
| **Web** (back-office tools on `chromium`) | Maestro **MCP** (`list_devices` → `inspect_screen` → `run`) — it keeps the browser session. Claude in Chrome first when the tester's own signed-in browser is the easier route ([`docs/engine/web-back-office.md`](docs/engine/web-back-office.md)) |
| **MCP-only capabilities** — nothing is retired | `cheat_sheet` (syntax reference before authoring unfamiliar commands), cloud runs, and `inspect_screen` / `take_screenshot` / `run` on a phone when the CLI cannot do the job — say why when you use them |

*Why CLI first:* every MCP call on a phone opens another Maestro Viewer tab, which makes the viewer useless and the run slower.

- Device id: `MAESTRO_DEVICE_ID` from the environment, else `adb devices` / the Maestro device list.
- **iOS = simulator only.** Maestro does not drive physical iOS devices; checks on a physical iPhone are the tester's.
- MCP `run` notes (web): it also validates syntax; pass `env` for flow variables; inline `yaml` runs from a temp dir, so a
  relative `runFlow:` path fails ("Invalid File Path") — a flow that calls a subflow goes in a file with absolute `runFlow`
  paths, run via `files`. `take_screenshot` returns the image inline only, never on disk.
- MCP gRPC `UNAVAILABLE`, or not restarted since a previous day → CLI and `adb`.
- Multi-account runs: `scripts/release-tools/switch-account.sh <account> [label]` (`SWITCH_TIMING=1` lists the slow steps).

---

## Non-negotiables

1. **Locators:** resource-id (package prefix stripped) → content description via `text:` → exact text → regex.
   Maestro has **no `~` accessibility-id prefix** — `id: "~…"` never matches. Duplicated labels need `index:`.
   **Coordinates (`point:`) are the last resort**, only for an element with no locator at all: percentages, never
   pixels; a comment on the step saying why (`# COORDINATES: <element> has no locator — register: <screen>`); and a
   blocker row in the testability register. Replace them when the id lands. adb helper scripts that tap by pixel
   name the device they were measured on and are never copied into flows.
2. **Inspect before writing or healing** any flow (phone: `maestro hierarchy` / `screen.sh`; web: `inspect_screen`); IDs change between builds.
3. **No `clearState` on dev builds unless the unit's app notes say it is safe** — it can wipe a
   configured dev endpoint. Use `launchApp` and fresh accounts.
4. **Skipped steps produce no data.** Flows that reach a screen by skipping the step that populates
   it assert structure only (containers, CTAs, navigation) and carry the comment
   `# NOTE: reached via skip — <data> not populated`.
5. **Unit-specific safety rules** (see *Unit-specific rules* below) override everything else in a run.
6. **Blocked ≠ failed.** A feature whose backend is not deployed is BLOCKED; never log defects against it.
7. **Ambiguous ≠ pass/fail.** If a verdict depends on reading intent, mark it NEEDS INPUT with both
   interpretations.
8. **Backend-driven values are never findings** (content, titles, durations, badges served by the
   backend) — unless a rule file says the value is fixed.
9. **Never overwrite:** a passing flow file, a delivered report (`_v2`, `_v3`…), `taxonomy.json` on
   conflict (append to `coverage/taxonomy.drift.json`), or the testability register (append only).
10. **Secrets:** Claude cannot read or write `.env` / `.env.example`. Add account metadata to
    `config/accounts.json`; the tester adds passwords. Never write passwords anywhere else, except
    release reports, which state the test account's password (template rule 10), and any standard
    test password or non-secret back-office test login the unit documents in
    `docs/workflows/account-provisioning.md`.
11. **`reports/**` and `screenshots/**` stay local** (gitignored). Don't propose committing them;
    don't cite them as the only copy of knowledge — move durable facts into `kb/` or `docs/`.
12. **Never tap** anything matching `exploration.skipSelectors` in `config/global.json`.
13. **Hound is mandatory.** A run that verifies a ticket's change files its pass/fail cases on the ticket
    (`hound.json` → `npm run hound-report`); exploratory / investigation / tooling / no-ticket runs write
    `{"skip": "<reason>"}`. `npm run hound-status` must be clean before a run is done —
    [`docs/workflows/hound-reporting.md`](docs/workflows/hound-reporting.md).

## Unit-specific rules

*(unit)* Domain rules that end or constrain a run — e.g. what Claude may never say to an in-app
assistant, actions with real-world side effects (payments, messages to real people), data that
must never be entered. `bootstrap` fills this section; until then it holds one example:

- *(example — replace)* Never submit a payment form, even on staging; stop at the confirm screen.

## Working with the tester

Habits that each cost a report revision or a wrong verdict when skipped. They apply to every run.

1. **One account per message.** In a multi-account run, prefix every message with the account ("LEG-A (member-05): …")
   and don't interleave side checks on other accounts; mention a background check only when it changes what the tester does next.
2. **Assume nothing.** Question every new row, toggle and copy even when it renders fine, and cross-check user-facing
   promises (privacy, recording, data, costs) across screens. Unclear intent → NEEDS INPUT.
3. **Go to the source before a verdict or a status.** A claim in `kb/local/rules/` is a summary: follow it to the source in
   the file's Sources table, check its date and the exact wording ("can" ≠ "must"), and quote the source, not the paraphrase.
   Say the date when a status is older than the run.
4. **Every question shows its source.** NEEDS INPUT / "is this expected?" lines use: **seen** "<actual>" · **required**
   "<quote>" (<file + section, spec heading, design node, or chat author/date>). If the tester's answer contradicts a
   written requirement, say so once with the citation and record the answer as the tester's override.
5. **Images you cannot see.** After fetching a doc (wiki, ticket, design export), list every image link and ask the tester for
   screenshots before calling rules or cases done.
6. **Ticket status comes from the tracker** and from the app repositories (`git tag --contains`, `git log --all --grep`) —
   never from a chat post or a spec table. Check before asking anyone "is this done?".
7. **Before any report: the question round first** — scope line, account password, what is in and out — in one go, then
   generate ([`docs/workflows/claims-and-scope.md`](docs/workflows/claims-and-scope.md)).
8. **Hand-offs are paste-ready.** A manual step for the tester (e.g. `.env` keys) comes as the finished `KEY=value` list
   inline, not as a command that computes it.
9. **A second platform gets the same depth.** An iOS release run covers the same legs as Android, never a smoke (a step the
   simulator cannot do is NOT VERIFIED, per step). Don't research platform differences mid-run — one gotcha line in
   `docs/app/ios-automation-notes.md`.
10. **A tool that should be there is missing** (a connector or MCP not in the session): say so and ask for a restart /
    reconnect before building a workaround.

## Hooks — the rules the harness enforces

`.claude/settings.json` runs these; when one stops you, fix the cause, don't route around it.

| When | What happens |
|---|---|
| Before a shell command, a file write or an MCP `run` (`scripts/hooks/guard.js`) | **Blocked:** reading or writing `.env` / `.env.example` · a flow with `id: "~…"` or a `point:` without the `# COORDINATES:` comment. **Tester is asked:** a flow with a `clearState` command · editing an existing report under `reports/` · rewriting the testability register · any `git push` |
| After a doc edit (`npm run kb-lint -- --hook`) | broken links / anchors and rules-index gaps in the edited file come back as an error to fix |
| Session start (`scripts/hooks/session.js start`) | status block: attached device, phone account, stale KB sources, runs still to file in Hound |
| When Claude stops (`session.js stop`) | one reminder per session while `npm run hound-status` is not clean |

A unit tightens or loosens the guard in `scripts/hooks/guard.js` (e.g. deny `clearState` outright, or allow one push target).

## Evidence capture

Save every capture you want to keep (inline images from the MCP are not on disk):
```bash
mkdir -p screenshots/test_runs/<YYYY-MM-DD>
adb -s <deviceId> exec-out screencap -p > screenshots/test_runs/<YYYY-MM-DD>/<label>.png
```
(`scripts/release-tools/screen.sh <label>` also saves the hierarchy.)

**Network traffic (debug builds that log HTTP):** `scripts/release-tools/net.sh start <run>` / `stop <run>`,
and `net.sh calls <since>` after any action whose backend effect matters. It shows whether the app sent the
request (app vs backend). Details: [`docs/engine/maestro-android-notes.md`](docs/engine/maestro-android-notes.md).

| Context | Label | Example |
|---|---|---|
| Test-case interaction | `<test_id>_<step>` | `note_actions.1_response.png` |
| Safety-rule trigger | `<test_id>_safety_response` | `assistant.3_safety_response.png` |
| UI bug | `bug_<n>_<screen>` | `bug_04_onboarding_step3.png` |
| Walkthrough | `onboarding_<step>` | `onboarding_02_welcome.png` |

**HTML reports embed screenshots as base64 data URIs — never file paths.** A missing capture is
shown as `<span class="screenshot-missing">not captured</span>`, never omitted.

---

## Account management

Accounts live in `config/accounts.json` (`id`, `email`, `flavor[]`, `passwordEnvVar`, `tags[]`,
free-form `traits{}` — the state that matters for your app, e.g. onboarding done, plan, feature
flags). Flows resolve their account through `scripts/lib/account-manager.js`
(order: [`docs/workflows/orchestrator.md`](docs/workflows/orchestrator.md) → Account resolution).

New account: create it with the unit's method
([`docs/workflows/account-provisioning.md`](docs/workflows/account-provisioning.md)), then add the
entry to `config/accounts.json` with `passwordEnvVar: "ACCOUNT_<ID_UPPERCASE>_PASS"`, then ask the
tester to add that key to `.env` (value) and `.env.example` (empty).

## Knowledge base

Details: [`kb/README.md`](kb/README.md). At the start of every `test` run call
`checkStaleness()` from `scripts/lib/kb-client.js`; if anything is stale print
`⚠ KB is stale: <id> last synced <date> (<n> days ago). Run: npm run sync-kb` and continue.
(The session-start hook prints the same check.)

In a Claude-driven run, Claude reads the rules files directly (Rule zero). Scripted evals inject KB text into a
judging prompt instead — only files marked `evaluator: include` and not `unverified`
([`docs/workflows/orchestrator.md`](docs/workflows/orchestrator.md) → Evaluator swap).

---

## Hardware-gated screens

Screens Claude cannot drive — camera, sensors, biometrics, NFC, real payments — are performed by
the tester; Claude drives what comes before and after. When exploring one: record any ids found,
analyse with `prompts/exploration/hardware-gate-analysis.md`, and if no skip control is locatable
mark it `type: "hardware_gate"`, `requiresSkip: true` and stop descending. Camera screens on an
emulator can often be driven with video injection: [`docs/engine/camera-injection.md`](docs/engine/camera-injection.md).
Runtime permission dialogs: `com.android.permissioncontroller:id/permission_allow_foreground_only_button`.

---

## Testability register — every run

[`docs/testability/missing-resource-ids.md`](docs/testability/missing-resource-ids.md) is a dev-facing
deliverable of every run:
1. Inspect each screen you target (hierarchy).
2. Element without resource-id → append a row (screen, element, proposed id, workaround, severity
   blocker/high/medium/low, build, date).
3. Element that now has an id → move its row to **Resolved** with the fixing build.
4. Still missing → update the Build column to the current build.

`node scripts/testability-report.js` renders it as HTML (product/feature map: `config/testability.json`).

## Release testing

Release evaluations have a fixed shape. **Do not invent a new report format.**
1. Pick a persona from [`docs/personas.md`](docs/personas.md) and drive the journey as that one character.
2. Check deployment status of everything under test (not deployed = BLOCKED).
3. Record the build of record (`versionName` + `versionCode`) and every device.
4. Screenshot every interaction; inspect every new screen and update the register.
5. Score AI behaviour against `config/test-cases.json` / `config/guardrails.json`, citing case and
   guardrail ids.
6. Promote validated checks into flow files and taxonomy before reporting coverage.
7. Generate the report from [`reports/_template/RELEASE_REPORT_TEMPLATE.md`](reports/_template/RELEASE_REPORT_TEMPLATE.md)
   (it owns the report rules: base64 screenshots, dual guardrail score, withdrawn findings kept,
   tester-induced scenarios labelled, NOT VERIFIED notes, AI-service instability out of scope).

Product-specific procedures live in `kb/local/release/` *(unit)*, one runbook per product, written
from [`_runbook-template.md`](kb/local/release/_runbook-template.md).

---

## File naming

| Type | Pattern | Example |
|---|---|---|
| Flow | `{screen_or_feature}_{action}.yaml` | `profile_edit_avatar.yaml` |
| Healed flow | `{original}_healed_{n}.yaml` | `auth_login_happy_path_healed_1.yaml` |
| Generated AI flow | `ai_{category}_{description}.yaml` | `ai_adversarial_ignore_instructions.yaml` |
| Exploration screenshot | `{timestamp}_{screenId}_{context}.png` | `20260310-120000_profile_exploration.png` |
| Report folder (map: [`reports/README.md`](reports/README.md)) | release run → `reports/releases/<version>/release_eval_<version>_<date>[_<platform>]/` · feature eval (own schedule, may span builds/envs) → `reports/features/<feature>_eval_<start date>/` · ad-hoc check / retest → `reports/adhoc/<topic>_<date>/` | `releases/1.2.0/release_eval_1.2.0_2026-01-15`, `features/onboarding_eval_2026-01-10` |
| Coverage snapshot | `{YYYY-MM-DD_HH-MM}/{flavor}.coverage.json` | `2026-03-10_12-00/main.coverage.json` |

Flow locations: `flows/baseline/` (all flavors), `flows/<flavor>/<suite>/` (product release suites),
`flows/ai/{prompts,edge_cases,verification}/` (assistant meta-tests), `flows/generated/` (gitignored).
Reusable steps go in a `_subflows/` folder next to their suite (`flows/baseline/_subflows/` and
`flows/ai/_subflows/` ship with the engine).

## Error handling

Explorer and Orchestrator have their own tables in their workflow files.

| Situation | Action |
|---|---|
| Device disconnects | list devices (`adb devices` / `maestro`) → reconnect → resume from the last completed step |
| MCP `UNAVAILABLE` | CLI and `adb` |
| Screenshot capture fails | warn, continue |
| An API / key / MCP route fails | Claude in Chrome on the web UI before handing the step to the tester ([`docs/engine/web-back-office.md`](docs/engine/web-back-office.md)) |
