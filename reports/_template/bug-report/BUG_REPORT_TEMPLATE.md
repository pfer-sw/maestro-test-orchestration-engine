# Bug report — standard (one bug, one HTML)

For a single finding the tester wants to act on now (send to dev, turn into a ticket). Release-wide findings still go
in the release report (`../RELEASE_REPORT_TEMPLATE.md`); a bug found during a release run gets **both**: this report +
its row in the release report's findings.

## How
1. Next id from [`docs/bugs.md`](../../../docs/bugs.md) (`BUG-NNN`).
2. Write the spec `reports/<run folder>/BUG-NNN.json` — start from [`example_spec.json`](example_spec.json); fields are in
   the `generate.py` docstring.
3. `python3 reports/_template/bug-report/generate.py reports/<run folder>/BUG-NNN.json --open` → `BUG-NNN_<slug>.html`
   (self-contained, screenshots as base64). It refuses to overwrite a delivered report: a correction → `_v2`.
4. Add / update the row + summary in `docs/bugs.md`, and the known issue in the matching `kb/local/rules/` file.

## Sections (fixed order — the generator renders them)
| Section | Rule |
|---|---|
| Header pills | severity (impact on the user), **layer**, status (`candidate` / `confirmed n/m`) |
| Summary | one paragraph: what the user did, what should happen, what happened, consequence |
| Environment | build (versionName + code), device + OS, backend host, flavor / client, test account (password only where `CLAUDE.md` allows it), relevant ids, experiment arm if any |
| Steps to reproduce | from a fresh state; say who did what (tester / Claude) |
| Expected vs actual | cite the rule (rules file + id) for "expected"; quote the app / assistant verbatim for "actual" |
| Evidence — app traffic | `net.sh` lines: method, path, status, time, body when it matters |
| Evidence — AI traces | when the unit has them (`docs/engine/llm-traces.md`): time, trigger, reasoning quote, tool calls, trace ids |
| Screenshots | base64, captioned with time + what it shows; missing → "not captured", never dropped |
| Analysis | the layer verdict and why; regression vs which build; variables that could matter |
| Impact | who hits it, how often, what it blocks (including the team's own test runs) |
| Questions for dev | concrete and answerable; include an unblock request for the test account when needed |

## Name the layer (before calling it confirmed)
1. **Did the app send it?** `net.sh calls <since>` — no request → `app`.
2. **Did the backend accept it?** Status code + what the UI shows after (e.g. a card marked done) — error → `backend`.
3. **Did the assistant hear about it?** The AI trace for that time window — no event / turn → `AI pipeline`.
4. **Did the assistant decide wrongly?** The trace shows the event and the reasoning → `assistant` (or `content` when the
   data it was given is wrong). If the reasoning cites a documented rule and follows it, it is **not a bug** — withdraw it
   (keep it in the run log) or turn it into a product question.

A UI state that says "done" only proves the backend stored it, not that anything downstream heard about it. When an
endpoint changes in a release, check that the events downstream still fire.

## Rules
- Evidence before verdict: a bug is `confirmed` only when the layer is shown, not guessed.
- Backend-driven values are never findings (`CLAUDE.md` non-negotiable 8). Blocked ≠ failed.
- Tickets: only when the tester asks — summary + environment + steps + expected / actual go into the unit's tracker;
  put the key in `docs/bugs.md`.
