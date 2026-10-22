# Bootstrap — onboarding a new unit

**Trigger:** the tester says `bootstrap` (or `config/flavors.json` still describes the fictional
*Example Notes* app). Goal: by the end, every *(unit)* slot in `CLAUDE.md` → "Where things live"
holds this unit's knowledge, the worked examples are gone, and one baseline flow passes on a device.

Bootstrap writes knowledge; it never invents it. Anything the tester can't answer yet becomes a
`TODO` line in `docs/TODO.md`, not a guess.

---

## 1. Interview (one message, grouped questions)

Ask in one go, numbered, so the tester can answer inline. Skip what the repo already answers.

| # | Ask | Fills |
|---|---|---|
| 1 | App name(s); flavor ids you want (short, e.g. `member`, `admin`); package / bundle id per flavor and environment (dev / staging / prod); Android, iOS or both. **iOS:** where do simulator builds come from? (Maestro runs iOS on simulators only; a device `.ipa` won't install — `docs/engine/ios-simulator-notes.md` → Prerequisites) | `config/flavors.json`, `docs/app/*-automation-notes.md` |
| 2 | Is `clearState` safe on dev builds? Any launch interstitials (permissions, PIN, update prompts, consent)? Deep links the app supports (scheme + one per root screen, e.g. settings) | `docs/app/…` → Interstitials / Navigation map, non-negotiable 3, flavor `env.APP_DEEP_LINK_SETTINGS` |
| 3 | How are test accounts created (tool / MCP / API / admin UI / manual)? Is there a standard test password? Which account states matter (onboarded, plan, feature flags…)? | `docs/workflows/account-provisioning.md`, `config/accounts.json` traits |
| 4 | Does the app embed an AI assistant? If yes: how to open it, what it may and may not do, any behaviour spec; resource-ids of its open button, input, send button, reply and action confirmation (or "inspect on device") | `aiTesting` block + flavor `env` (`ASSISTANT_OPEN`, `PROMPT_INPUT`, `SUBMIT_BUTTON`, `ASSISTANT_RESPONSE`, `ASSISTANT_ACTION_CONFIRMATION`, `AI_*_PROMPT`), `config/test-cases.json`, `config/guardrails.json` |
| 5 | Where does product knowledge live (PRDs, wiki, specs repo, Figma)? Which of it is authoritative? | `config/kb.json`, `kb/local/rules/`, `config/figma-mapping.json` |
| 6 | Domain safety: anything Claude must never type, tap or trigger (real payments, messages to real people, regulated content)? | `CLAUDE.md` → *Unit-specific rules*, `config/global.json` `skipSelectors` |
| 7 | Screens Claude can't drive (camera, sensors, biometrics, back-office) | `CLAUDE.md` hardware-gated handling, rules files |
| 8 | Jira project / labels and the ids of the custom fields for coverage %, run date and flavor (or skip them), Figma access — or skip | `config/global.json` `jira` (incl. `customFields`), `.env` keys |
| 9 | Typical users of the app (2–4 personas) and the release journeys that matter | `docs/personas.md`, `kb/local/release/` |

## 2. Write config (metadata only — never secrets)

1. `config/flavors.json` — one entry per flavor; `app.packageName` and `env.APP_ID` stay `${VAR}`
   placeholders resolved from `.env` (one flavor: `APP_ID`; several: `<FLAVOR>_APP_ID` each, mapped
   to `env.APP_ID`). `aiTesting.enabled` only if Q4 is yes; then set the assistant ids and
   `AI_*_PROMPT` values in the flavor `env` too (the AI flows read them from there). Schema:
   `config/README.md`.
   **Renaming flavor `main`** (or adding flavors): update `appliesTo` and every `coverage.<flavor>`
   key in `coverage/taxonomy.json` (and its `coverageSummary` key), `flavor[]` in
   `config/accounts.json`, and tell the tester to `export FLAVOR=<id>` for `scripts/release-tools/`
   (their default is `main`) and for `npm run prd-eval`.
2. `config/accounts.json` — one entry per known account; `traits` from Q3; `passwordEnvVar`
   `ACCOUNT_<ID_UPPERCASE>_PASS`. Create accounts per the unit's method if none exist.
3. `config/kb.json` — sources from Q5; keep `local-supplements`; set `protocolTags` to the unit's
   domains. The placeholder sources `local-source` (`${KB_LOCAL_SOURCE_PATH}`) and `domain-rules`
   (`<repo-name>`) are examples: fill them with a real checkout / repo or delete them, and update
   the *Current sources* table in `kb/README.md` to match.
4. `config/global.json` — `skipSelectors` from Q6, Jira from Q8. `jira.customFields` is not read
   by the shipped scripts: fill in the project's real field ids if you extend `export-jira.js` to
   use them, otherwise delete the example ids.
5. **Hand the tester the `.env` checklist** — every `${VAR}` and `passwordEnvVar` you referenced,
   as key names only. Claude cannot read or write `.env` / `.env.example`; wait for "done".

## 3. Write the knowledge slots

| Slot | What to write |
|---|---|
| `docs/app/android-automation-notes.md` (and iOS if Q1) | Fill each template heading from Q1–Q2; leave headings with nothing known as `TBD — first run` |
| `docs/workflows/account-provisioning.md` | The method from Q3, step by step, with the exact tool calls / requests |
| `kb/local/rules/<area>-rules.md` | One file per product area from Q5, frontmatter per `kb/local/rules/README.md`; spec-sourced rules start `status: spec`, never `observed` |
| `kb/local/rules/README.md` | File index rows **and Context pack rows** for every new file — an unlisted file is never read |
| `CLAUDE.md` → *Unit-specific rules* | Q6/Q7 answers as short imperative bullets |
| `docs/personas.md` | Q9 personas in the table shape |
| `config/test-cases.json`, `config/guardrails.json` | Only if Q4: cases from the assistant's spec. Test case ids `<area>.<n>` (e.g. `note_actions.1`); guardrail ids are snake_case names (e.g. `claimed_action_not_performed`); `guardrails[].persona` is a `docs/personas.md` id (`P-01`); `uiStateMustMatch` is `<screen_id>` or `<screen_id>:<assertion>`. Document each new category's `metadata` fields in the `config/README.md` category table (replacing the `note_actions` example row) |
| `kb/local/release/<product>-runbook.md` | Only if release journeys are known: copy `_runbook-template.md` |

Pull wiki pages with `npm run fetch-wiki` into `kb/wiki/` first and write rules from them — cite the
page in each rule file's frontmatter `scope` or a Sources line.

## 4. First device contact

1. `list_devices`; launch the app with the new flavor (`run`: `appId` + `launchApp`).
2. `inspect_screen` on the launch screen and the login screen.
3. Rewrite `flows/baseline/_subflows/login.yaml` (the login steps; `login_happy_path.yaml` calls it
   via `runFlow` and adds launch + interstitials + the home assertion) with the real ids, then
   `login_happy_path.yaml`'s interstitials and home id; `run` until it passes. Then `logout.yaml`.
4. The other example baseline flows — `auth/login_invalid_creds.yaml`,
   `critical/onboarding_complete.yaml`, `navigation/deep_link_resolution.yaml` (needs
   `APP_DEEP_LINK_SETTINGS` in the flavor env), `navigation/tab_bar_traversal.yaml` — adapt each to
   the app and `run` it until it passes, or delete it. Every kept flow gets a taxonomy entry
   (`config/README.md` → `coverage/taxonomy.json`) with `tags: ["baseline"]` — baseline flows are the
   circuit breaker, so keep only ones that pass reliably.
5. If Q4 is yes: the AI flows under `flows/ai/` read the assistant ids and prompts from the flavor
   `env` (step 2.1) — `run` `flows/ai/prompts/happy_path_prompt.yaml` once to prove the wiring.
6. Record every id and interstitial found in `docs/app/…`; every element without an id in the
   testability register.
7. `explore --flavor=<id>` at depth 1 to seed `coverage/taxonomy.json`: set
   `exploration.maxDepth` to `1` in `config/global.json` for this run, and revert it to its previous
   value (default `5`) right after.

## 5. Remove the worked examples

Delete or replace everything marked as the Example Notes example once a real equivalent exists:

```bash
grep -rniE 'example notes|com\.example\.notes|example\.member|\(example' \
  CLAUDE.md config coverage flows docs kb prompts
```

Some hits are **engine illustrations and stay**: they explain a format, not this unit's data —
`config/README.md` schema prose and examples (except the category `metadata` row, replaced in
step 3), `kb/README.md` prose, `kb/local/release/_runbook-template.md`,
`reports/_template/RELEASE_REPORT_TEMPLATE.md` and `reports/_template/generator/`,
`scripts/release-tools/_env.sh`, `README.md`, and the *(example — not shipped)* row in
`kb/local/release/README.md`. Everything else is unit data to clear.

- Delete `kb/local/rules/example-notes-rules.md` and its index / context-pack rows.
- Replace example rows in `docs/personas.md`, `docs/wins.md`, `docs/TODO.md`,
  `docs/testability/missing-resource-ids.md`, `config/figma-mapping.json`, `config/testability.json`.
- Clear the example rows of the unit-data tables: the state → category table in
  `docs/workflows/ai-behavioural-run.md` §2, the framing example, decision defaults and
  environments rows in `docs/workflows/ad-hoc-run.md`, the *Current sources* rows in `kb/README.md`
  (keep `local-supplements`), the *(example — replace)* rows in `kb/local/release/README.md`, and
  the `note_actions` category row in `config/README.md`.
- Example flows under `flows/ai/` stay only if `aiTesting.enabled`; otherwise delete them (they have
  no taxonomy entries — if you added any, remove those too) and the assistant keys in the flavor
  `env`.
- Keep `flows/baseline/_subflows/relaunch_with_race_retry.yaml` — it is an engine pattern; just
  update its ids.

## 6. Close-out checklist (print it)

```
Bootstrap — <unit> — <date>
[x/ ] flavors.json            <ids>
[x/ ] accounts.json           <n> accounts — .env keys confirmed by tester
[x/ ] kb.json + rules files   <n> files, context pack rows <n>
[x/ ] app notes               android / ios
[x/ ] unit-specific rules     <n> bullets
[x/ ] personas                <n>
[x/ ] AI testing              enabled / n.a. — <n> cases, <n> guardrails
[x/ ] baseline login flow     PASS / FAIL (<reason>)
[x/ ] taxonomy seeded         <n> screens discovered
[x/ ] examples removed        grep clean / <remaining>
Open questions → docs/TODO.md
```

Then commit on the unit's branch (`bootstrap: <unit> — slots filled, baseline login passing`).
