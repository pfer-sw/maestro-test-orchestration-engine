# config/ — what each file is and how its entries are shaped

Everything environment-specific is a `${VAR}` resolved from `.env`. Passwords never live
here — only `passwordEnvVar` names.

Each file ships with **one worked example** for the fictional *Example Notes* app
(`com.example.notes`, flavor `main`). Keep the shape, replace the content with your unit's.

| File | Purpose | Read by |
|---|---|---|
| `flavors.json` | App variants: package, device, env, flow groups, coverage target, assistant (`aiTesting`) and hardware-gated screen (`hardwareGated`) settings | explore, run-tests, calculate-coverage, export-jira, CLAUDE.md |
| `global.json` | Shared settings: reporting dirs, BFS depth, `skipSelectors`, healing, Jira | all runners |
| `accounts.json` | QA accounts + traits (see CLAUDE.md → Account management) | `scripts/lib/account-manager.js` |
| `kb.json` | Knowledge-base sources (see `kb/README.md`) | `scripts/sync-kb.js`, `scripts/lib/kb-client.js` |
| `testability.json` | Product / feature map used to group the testability register | `scripts/testability-report.js` |
| `test-cases.json` | Assistant behavioural case library | behavioural / release runs |
| `guardrails.json` | Assistant guardrail definitions | behavioural / release runs, dual score |
| `figma-mapping.json` | Screen key → Figma frame | `save-figma-screenshots.js`, `generate-design-audit-report.js` |
| `matrices/` | *Optional unit slot* — feature test matrices (`<feature>.json`) | manual / scripted evals |
| `../coverage/taxonomy.json` | Feature → flow map and per-flavor coverage (schema below) | `scripts/lib/coverage-tracker.js`, run-tests, calculate-coverage, explore |
| `scenarios/` | *Optional unit slot* — free-form scenario markdown created from the dashboard | `run-scenario-eval.js`, `dashboard.js` |

Additional Figma mappings (one per feature) can sit next to `figma-mapping.json` as
`figma-mapping-<feature>.json` and be passed with `--mapping=…`.

## `flavors.json`
`{ flavors: { <flavorId>: { id, displayName, description, platform, app: { packageName, appId },
device: { preferredDeviceId }, defaultAccountId, env, flowGroups[], excludeGroups[], coverageTarget,
hardwareGated, aiTesting } } }`.

- `app.packageName` / `app.appId` / `env.APP_ID` — always `${APP_ID}`-style placeholders.
  **One flavor:** `.env` holds `APP_ID`. **Several flavors:** `.env` holds one `<FLAVOR>_APP_ID` per
  flavor (e.g. `MEMBER_APP_ID`, `ADMIN_APP_ID`) and each flavor maps it:
  `"app": { "packageName": "${MEMBER_APP_ID}", "appId": "${MEMBER_APP_ID}" }`,
  `"env": { "APP_ID": "${MEMBER_APP_ID}", … }` — flows only ever read `APP_ID`.
- `env` — flow variables. `run-tests.js` (and Claude, per `CLAUDE.md` → Phase 2 Step 3) passes the
  whole flavor `env` to every flow, `${VAR}` expanded from `.env`, plus the account's
  `TEST_USERNAME` / `TEST_PASSWORD`. Variables the shipped flows read:

  | Variable | Read by |
  |---|---|
  | `APP_ID` | every flow (`appId`) |
  | `APP_DEEP_LINK_SETTINGS` | `flows/baseline/navigation/deep_link_resolution.yaml` |
  | `ASSISTANT_OPEN`, `PROMPT_INPUT`, `SUBMIT_BUTTON`, `ASSISTANT_RESPONSE`, `ASSISTANT_ACTION_CONFIRMATION` | `flows/ai/**` — resource-ids; keep equal to `aiTesting.selectors` (the flows carry the Example Notes ids as `env:` defaults) |
  | `AI_HAPPY_PATH_PROMPT`, `AI_AMBIGUOUS_PROMPT`, `AI_OUT_OF_SCOPE_PROMPT`, `AI_ADVERSARIAL_PROMPT` | `flows/ai/prompts/*.yaml` (no default — set them here) |
  | `LLM_TEST_TIMEOUT_MS` | `flows/ai/**` wait for the reply — keep equal to `aiTesting.responseTimeoutMs` |

- `flowGroups[]` / `excludeGroups[]` — informational: which groups (`baseline`, `feature`, `ai`) the
  unit intends to run for this flavor. No script reads them; `--group=` selects a group per run.
- `coverageTarget` — percent; `scripts/lib/coverage-tracker.js` → `recomputeSummary` copies it into
  `coverageSummary.<flavor>.target` (fallback 80).
- `aiTesting` — `null` or `{ enabled, selectors: { openAssistant, promptInput, submitButton,
  responseArea, actionConfirmation, loadingIndicator, assistantLabel, userLabel }, responseTimeoutMs,
  minRunsPerTest, metaTestCategories[], adversarialPrompts[] }`. **`enabled` is the gate for AI
  flows**: `run-tests.js` skips `ai`-tagged flows when it is false, and explore generates AI
  meta-tests only when it is true.
  - `promptInput`, `submitButton`, `responseArea`, `actionConfirmation`, `loadingIndicator` —
    resource-ids (package prefix stripped). `loadingIndicator` (may be `null`) is only used by the
    meta-test generation prompt `prompts/ai-flavor/test-cases.md`.
  - `openAssistant` — a resource-id (the shipped flows tap it with `id:`); `scripts/release-tools/say.sh`
    also accepts `text:<content description>` and then drops that label from its printed transcript.
  - `assistantLabel` / `userLabel` — the **accessibility labels** (content descriptions) of the
    chat bubbles, matched by `say.sh` against `accessibilityText` and printed as `[label]`; a
    `text:` prefix is allowed and stripped.
  - `responseTimeoutMs` — how long Claude waits for a reply (CLAUDE.md → AI assistant meta-testing,
    `prompts/ai-flavor/test-cases.md`); flows use `env.LLM_TEST_TIMEOUT_MS` for the same wait.
  - `minRunsPerTest` — default repeat count when a flow's `metaTesting.minRuns` is unset.
  - `selectors` are read by `say.sh` and `run-scenario-eval.js --live`; flows read the `env` copies above.
- `hardwareGated` — screens Claude cannot drive (camera, sensors, payment, biometrics):
  `{ enabled, skipSelectors, selectors, timeouts }`. Empty `skipSelectors` means such screens are
  marked `type: "hardware_gate"` and their flows `skipped`
  (`prompts/exploration/hardware-gate-analysis.md`).

## `coverage/taxonomy.json`
The feature → flow map and coverage source of truth (`scripts/lib/coverage-tracker.js`).
`{ version, lastUpdated, updatedBy, features: [feature, …], coverageSummary }`.

```jsonc
// feature
{
  "id": "auth", "name": "Authentication", "description": "…",
  "appliesTo": ["main"],          // flavor ids; a flavor not listed skips the whole feature
  "screens": [ … ],               // optional — screen ids/notes for humans; no script reads it
  "flows": [ flow, … ]
}
// flow
{
  "id": "auth.login.happy_path", "name": "…", "description": "…",
  "flowFile": "flows/baseline/auth/login_happy_path.yaml",   // null until a flow exists
  "priority": "critical",          // critical | high | medium | low
  "tags": ["baseline"],            // group: baseline | ai | none (= feature)
  "accountId": "example.member",   // optional — CLAUDE.md → Account management
  "accountRequirements": { "traits": { "onboardingComplete": false } },   // optional
  "metaTesting": { … },            // optional, ai-tagged flows only — see below
  "type": "hardware_gate",         // optional — screen Claude cannot drive
  "requiresSkip": true,            // optional, with type hardware_gate
  "isAiInterface": true,           // optional — screen has an assistant input
  "coverage": {
    "<flavorId>": {                // a flow without an entry for a flavor is not planned for it
      "status": "not_covered",     // not_covered | discovered | covered | failing | skipped
      "lastRunDate": null, "lastResult": null,   // "pass" | "fail"
      "lastRunDurationMs": null, "failureReason": null
    }
  }
}
```

`metaTesting` (read by `scripts/run-tests.js` → `runAiMetaTest`):

| Field | Meaning | Default |
|---|---|---|
| `category` | `happy_path` · `ambiguous_input` · `out_of_scope` · `adversarial` · `edge_cases` | `unknown` |
| `minRuns` | times the flow is run for Layer 1 + Layer 2 | flavor `aiTesting.minRunsPerTest`, then 2 |
| `passThreshold` | `any` — passes if any run passes (happy path); anything else (use `all`) — passes only if no run fails | `any` |
| `promptTemplate` | the prompt sent (copied into the Jira security bug on an adversarial failure) | `unknown` |

`coverageSummary.<flavor>` — `{ total, covered, failing, not_covered, discovered, skipped,
coveragePercent, target, targetMet }`, recomputed by scripts; never edit it by hand.

## `accounts.json`
`{ version, _provisioning, accounts: [ { id, email, flavor[], passwordEnvVar, tags[], traits{}, notes } ] }`.
`traits` is free-form per unit (e.g. `onboardingComplete`, `plan`, `environment`) and is what
`accountRequirements` in taxonomy match against; `notes` is free text (how it was provisioned,
interstitials it has already dismissed). `passwordEnvVar` is `ACCOUNT_<ID_UPPERCASE>_PASS`
(dots → underscores).

## `test-cases.json`
`{ version, description, categories: { <category>: [case, …] } }`. Categories are unit-defined
interaction contexts (the example ships `note_actions`).

```jsonc
{
  "id": "<category>.<n>",           // e.g. note_actions.1 — category key + running number
  "scenario": "human-readable description",
  "sessionContent": "state to simulate / what happened before",
  "keySignal": "the user message to type, or the trigger the assistant should react to",
  "assistantDebrief": "pass criteria — what the reply MUST do",
  "notes": "team nuance, edge cases",
  "guardrailIds": ["<id from guardrails.json>"],   // links the case to the guardrails it exercises
  "guardrailIdsReview": "NEEDS PRODUCT INPUT: …",   // present only when the mapping is ambiguous
  "upstreamDrift": "…",   // upstream spec contradicts this case, not built yet — see kb/local/rules/README.md
  "metadata": { /* per category, unit-defined */ }
}
```

Document each category's `metadata` fields here, e.g.:

| Category | `metadata` fields |
|---|---|
| note_actions *(example)* | `context` (where the assistant was opened), `expectedAction` (action id the reply should trigger, or `none`), `asksFollowUp` (`Yes` / `No`), `uiStateMustMatch` (see below) |
| *(domain category)* | add `protocol` to switch Layer 2 to the KB evaluator |

**`uiStateMustMatch` grammar** (test cases and guardrails alike): `<screen_id>` — after the reply the
app must be on that screen — or `<screen_id>:<assertion>` — on that screen *and* the free-text
assertion holds there (e.g. `notes_list:contains Groceries`). `<screen_id>` is a taxonomy / app-notes
screen id; Layer 2 checks it against the screenshot and hierarchy.

`metadata.protocol` switches Layer 2 to the KB evaluator (`CLAUDE.md` → Knowledge base); its
values must match `protocolTags` in `kb.json`.

**Guardrail coverage** (the second half of the dual score) is computed from `guardrailIds`:
a guardrail with no case pointing at it is uncovered. Flag uncertain mappings with
`guardrailIdsReview` rather than guessing.

## `guardrails.json`
`{ version, description, guardrails: [ … ] }`, each with `id` (a snake_case name, e.g.
`claimed_action_not_performed` — not numbered), `category`
(e.g. `safety` · `human_intervention` · `manipulation_security` · `privacy` · `user_behavior`),
`action`, `description`, `persona` (a persona id from `docs/personas.md`, e.g. `P-01`), `seedPrompts[]`, `expectedBehavior[]`,
`forbiddenBehaviors[]`, `evaluationCriteria { mustAddress[], mustNotContain[], uiStateMustMatch }`
(grammar above),
`severity`, `escalateOnFailure`.

`seedPrompts` must respect the unit's safety rules (CLAUDE.md → Non-negotiables) — never seed a
prompt that would trigger a real-world escalation outside a deliberate, documented test.

## `matrices/*.json` (optional)
`{ label, version, notes?, testCases: [ … ] }`, each with `id`, `title`, `category`,
`preconditions`, `preambleMessages[]`, `testPrompt`, `expectedBehaviors[]`,
`unexpectedBehaviors[]` (plus matrix-specific fields such as `testMode`).

## Figma mappings
`{ _comment, _sections?, screens: { <key>: { figmaNodeId, figmaFrameName, sequenceIndex, isFinalFrame, notes, … } } }`.
Keys are screen keys (e.g. `auth.login`, `notes.editor`), not taxonomy flow ids.
Always map the **final** animation frame (`isFinalFrame: true`).
