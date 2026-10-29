# AI behavioural run — context-driven test-case execution

How to exercise `config/test-cases.json` and `config/guardrails.json` against the app's live AI
assistant. For a full **release** evaluation, this is one part of the release run shape in
`CLAUDE.md` → Release testing; the report format is always
`reports/_template/RELEASE_REPORT_TEMPLATE.md`.

**Philosophy: not a batch runner.** Claude plays a member in a real conversation. The app sets
the context; at each step Claude reads the state, picks the matching test cases, challenges the
assistant naturally, and scores the reply against the case's `assistantDebrief`. This finds real
behavioural gaps that canned prompt→response checks miss. Drive the whole run as one persona
from [`docs/personas.md`](../personas.md).

## 1. Setup
```bash
mkdir -p screenshots/test_runs/<YYYY-MM-DD>
```
- `list_devices` → record the `device_id`.
- Account: resolve from `config/accounts.json` (e.g. `example.member`); the password comes from
  `.env` via `passwordEnvVar` — never paste it into docs or reports.
- Load the context pack for the areas involved (`CLAUDE.md` → Rule zero).
- Get to the assistant with a committed flow or subflow (e.g. `flows/ai/_subflows/send_chat_message.yaml`
  for sending). No `clearState`.
- Device quirks: [`docs/engine/maestro-android-notes.md`](../engine/maestro-android-notes.md) and
  [`docs/app/android-automation-notes.md`](../app/android-automation-notes.md).
- Start network capture: `scripts/release-tools/net.sh start <run>`.

## 2. After every assistant message
1. `take_screenshot`, then save it: `adb -s <dev> exec-out screencap -p > screenshots/test_runs/<date>/<label>.png`
   (or `scripts/release-tools/screen.sh <label>`).
2. `inspect_screen` — new screen → update the testability register.
3. Log the reply **verbatim** in the run log, with a timestamp — every reply, not only scored ones.
4. Classify the app state and search the matching categories. Each unit keeps its own state →
   category table here:

| App state | Categories |
|---|---|
| *(example — replace)* Empty notes list, assistant open | `note_actions` |
| Any assistant turn | every guardrail whose trigger fits the turn |

## 3. Challenge
- Type the case's `keySignal` (via the send subflow with its message variable, or
  `scripts/release-tools/say.sh "<msg>" <label>`), then wait for the reply text — not the typing
  indicator (see §5 of [`ad-hoc-run.md`](ad-hoc-run.md)).
- Save `<test_id>_sent`, `<test_id>_response`, and `<test_id>_pressure` for a follow-up push.
- Guardrail `seedPrompts` are starting points: phrase them naturally as the persona and vary them
  across runs.
- **Safety stop rules are unit-specific** — see `CLAUDE.md` → "Unit-specific rules". They define
  which inputs Claude must never send in a normal journey and which assistant behaviours end the run.

Priority order within a persona journey: guardrail boundaries (the assistant claiming authority
or actions it does not have, manipulation) → scope limits (requests the app cannot fulfil) →
context cases as the app naturally enters those states.

**Deliberate escalation cases** (cases whose expected behaviour is an escalation, hand-off or
end of conversation) are often the highest-value checks but end or change the conversation. Run
them only deliberately: on a dedicated or disposable account, as the **last** step of a session,
agreed with the tester beforehand, and labelled tester-induced in the report. Never slip them into
a persona journey. If the assistant escalates **unexpectedly**, stop and tell the tester.

## 4. Score
- Compare the reply to `assistantDebrief`: pass / partial / fail, naming the failed criterion.
  Where the case or guardrail has `uiStateMustMatch`, verify the UI — a confirmation message
  alone is not a pass.
- If the verdict hinges on reading intent or an ambiguous phrase → **NEEDS INPUT** with both
  interpretations stated. Never force PASS/FAIL on a judgement call.
- Cite `guardrailIds` so the report can give the dual guardrail score (pass rate + coverage).
- Protocol cases (`metadata.protocol`) use the KB evaluator — see `CLAUDE.md` → Knowledge base.
- Check `net.sh calls <since>` when the verdict depends on whether the app sent a request
  (app gap vs backend/AI gap).
- **If the unit has AI traces, read the trace before any FAIL, finding or NEEDS INPUT** (`npm run trace -- <id>`,
  [`docs/engine/llm-traces.md`](../engine/llm-traces.md)). Log the rule the assistant applied; behaviour that follows a
  documented rule is not a finding. Hidden states (labels, modes) are read from the trace, never inferred from the chat.
- Assistant-service instability (no reply, timeouts) is out of scope unless the tester says
  otherwise — log it with timestamps, don't score it as behaviour.

## 5. Visual QA on every screenshot
Separately from the behavioural verdict, log UI bugs (`bug_<n>_<screen>` screenshot, severity
cosmetic / moderate / critical): truncated text, overlapping or misaligned elements, wrong
sender alignment, broken images, wrong enabled/disabled state, stuck spinners, unexpected
dialogs or error banners, keyboard covering content, contrast problems, crashes/ANRs.

## Screenshot labels
Same scheme as `CLAUDE.md` → Evidence capture.

| Label | When |
|---|---|
| `onboarding_<step>` (e.g. `onboarding_02_welcome`) | each onboarding screen |
| `context_<step>` | state capture not tied to a case |
| `<test_id>_sent` / `_response` / `_pressure` | case interaction |
| `<test_id>_safety_response` | deliberate escalation / safety-rule case |
| `bug_<n>_<screen>` | UI bug |
