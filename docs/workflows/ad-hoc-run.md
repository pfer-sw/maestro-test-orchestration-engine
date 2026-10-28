# Ad-hoc run — targeted check of one change

For any request that is not `explore`, `test` or a full release run: "quick test", "check if X
works", "verify this change on env Y". These come with a goal and a few constraints, not a
procedure — this file supplies the procedure, so Claude drives the run instead of waiting to be
guided step by step.

## 1. Frame it (before touching the device)
Write one line in the run log: **change under test · pass condition · environment · who does what**.
Example *(example — replace)*: "Assistant creates a note from a chat request · note 'Groceries'
appears under `tab_notes` · dev env · Claude drives everything".

## 2. Load the context pack
Read the rows for the area under test in
[`kb/local/rules/README.md` → Context pack](../../kb/local/rules/README.md#context-pack--read-before-any-run)
**before** the first device action (`CLAUDE.md` → Rule zero). They hold the screen sequences,
expected behaviour and known quirks. The matching `config/test-cases.json` cases are the pass
conditions for the report matrix.

## 3. Division of labour
**Claude drives everything that has a locator**: login, onboarding, prompts and modals, forms,
assistant messages, navigation. **The tester performs only what Claude cannot**: anything that
needs a physical action (camera, biometrics, another device), anything off-device. Web back-office
tools are driven by Claude via Claude in Chrome ([`web-back-office.md`](../engine/web-back-office.md)). "I'll do step X" means *only step X* — Claude gets the app to the start of X,
announces the handover, and resumes on the first screen after it.

## 4. Decision defaults (no need to ask)
Each unit fills this table with its own defaults so Claude never stops to ask about them.

| Moment | Default |
|---|---|
| *(example — replace)* Assistant asks a follow-up | Answer as the persona (`docs/personas.md`), choosing the reply that keeps the run on the change under test |
| Permission dialogs | As the onboarding flow does |
| Onboarding / promo modals | Skip or dismiss without commentary; they are not the change under test |

**Ask only** when the choice changes what is being tested: the requested setup differs from what
exists in a way that matters to the test, a safety stop path opens (`CLAUDE.md` → "Unit-specific
rules"), or the behaviour under test is absent.

## 5. Waiting for async / AI responses
Wait on the **content**, not on loaders: `waitForAnimationToEnd` with a short timeout, then
`extendedWaitUntil` on the expected text or element, then screenshot. No result → keep polling
(screenshot every 30 s) up to **2 min**. Still nothing: log the timestamps, check
`scripts/release-tools/net.sh calls <since>` to see whether the app sent the request, and tell the
tester. The silence may be the very change under test, so do not nudge the system (re-send,
relaunch) without agreement.

## 6. Recording
Tools in `scripts/release-tools/` (all write to `screenshots/test_runs/<date>/`; read each
script's header for arguments):

| Tool | Use |
|---|---|
| `screen.sh <label>` | every interaction: screenshot + hierarchy + element list |
| `capture-video.sh <name>` | **start in the background at the first device action**; continuous video in segments until stopped. Covers waits and tester hand-offs |
| `burst.sh start\|stop <name>` + `frames.py` | auto-advancing screens / animations → distinct-frame contact sheets |
| `relaunch.sh <name>` | cold start without `clearState`, captures the first destination |
| `say.sh "<msg>" <label> [wait_s]` | send an assistant/chat message as the member, wait, capture `<label>_sent/_response` and print the reply text; hides the keyboard only when shown |
| `net.sh start\|stop\|calls\|grep` | HTTP traffic from logcat (debug builds) — app vs backend |

- While the tester performs a hand-off step, poll for the screen that follows it and take over on arrival.
- Keep `RUN_LOG.md` in `reports/<run>/` with timestamps: every message sent, every reply
  (verbatim), every hand-off.

## 7. Report
Release template ([`RELEASE_REPORT_TEMPLATE.md`](../../reports/_template/RELEASE_REPORT_TEMPLATE.md)),
scoped: the header names the change under test and environment; legs not exercised are
`NOT TESTED` rows, never omitted. Rules learnt go to `kb/local/rules/` as usual.

## 8. Environments
How each environment is selected in the app and what differs between them — one line per
environment, kept in [`docs/app/android-automation-notes.md`](../app/android-automation-notes.md) → Environments.
- *(example — replace)* `dev`: default for dev builds; `staging`: select under Settings → Developer → Environment before login.
