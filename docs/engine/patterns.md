# Harness patterns not shipped as code

Harnesses that proved useful in practice but are too tied to a specific product to ship
generically. Each is described well enough for Claude to rebuild it for a new unit; when one
gets rebuilt generically, move it into `scripts/` and delete its section here.

## Prompt-matrix eval

**Problem:** an in-app assistant must handle many phrasings of the same intent (e.g. "create a
note", "jot this down", "new note please") and each must lead to the right action.

**Shape:**
1. Matrix in `config/matrices/<name>.json`, shaped as in `config/README.md` → `matrices/*.json`:
   `{ label, version, notes?, testCases: [{ id, title, category, preconditions, preambleMessages[],
   testPrompt, expectedBehaviors[], unexpectedBehaviors[] }] }`.
2. A setup flow navigates to the assistant; `flows/ai/_subflows/send_chat_message.yaml` sends each
   prompt (`MESSAGE`, `PROMPT_INPUT`, `SUBMIT_BUTTON`).
3. After each response: screenshot + hierarchy, then score every expected / unexpected behaviour with a Claude call using
   a matrix-specific verification prompt in `prompts/ai-flavor/<name>-verification.md`.
4. Output JSON per row → `node scripts/generate-html-report.js <results.json>`.
5. Rows that fail → one Jira bug per distinct failure mode (not per row), via `scripts/lib/jira-client.js`.

Keep the model id configurable; run each row `minRunsPerTest` times and flag inconsistent rows.

## Post-step form driver

**Problem:** after a long flow (e.g. a checkout) the app shows a chain of short forms
(rating, survey, confirmation) that every run must get through.

**Shape:** a `_subflows/` flow per form that asserts the container id, answers with a fixed
neutral choice, and taps the CTA by id. **Never coordinates** — if a form has no ids, register it as
a blocker in the testability register and drive it manually until it does.

## Release report generator

**Problem:** release reports need consistent HTML with base64-embedded screenshots, a findings
table and a test matrix.

**Shape:** `reports/_template/generator/example_report.py` — a single script with a DATA section
(run metadata, moments, findings, matrix) and a render section that follows
`reports/_template/RELEASE_REPORT_TEMPLATE.md`. Copy it per run into the run's report folder, fill
DATA, run it. Never edit the template's section order.

## Scenario eval from markdown

`npm run prd-eval` (`scripts/run-scenario-eval.js`) reads `config/scenarios/<slug>.md` — one
scenario per file, with a protocol tag matching `config/kb.json` — drives the assistant with it and
scores the reply with the KB-backed evaluator. Use it to turn PRD acceptance criteria into
repeatable assistant checks.
