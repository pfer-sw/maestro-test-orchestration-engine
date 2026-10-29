# AI traces — read the assistant's reasoning before scoring it (optional)

When the app embeds an AI assistant and its turns are traced (Langfuse or similar), the trace shows **what woke the
assistant, what it reasoned, which tools it called and what it sent**. That turns guesses into evidence: whether a
behaviour follows a rule on purpose, which internal label or state the assistant recorded (never shown in the UI), and
whether an event from the backend ever arrived. ED-004.

Units without traces skip this page; nothing else depends on it.

## Setup (once per unit)
1. Ask the AI team for **read-only, project-scoped** keys (one public/secret pair per project) and the host.
2. The tester adds the keys to `.env` under the names in `config/llm-trace.json` (and empty names to `.env.example`).
   Claude never reads `.env`; the script loads it with dotenv and never prints the values.
3. Fill `config/llm-trace.json`: host, one entry per project (what it explains, key env var names), the **lookup field**
   (the trace metadata key that holds the user / conversation / program id), and optional `triggerFields` /
   `outputFlags` to print from each trace's input / output.
4. Check: `npm run trace -- <id of a test account> --since=<today>` lists that account's turns.

A Langfuse MCP server at **local scope** (`claude mcp add --scope local …`, read-only allowlist) is an alternative when the
team offers one — never commit its token.

## When to read a trace (every assistant run)
| Before… | Look for |
|---|---|
| scoring any assistant behaviour as FAIL / a finding / NEEDS INPUT | the rule the assistant cited in its reasoning — by design, prompt gap, or model miss |
| checking a hidden classification or state (labels, modes, flags) | the tool call that recorded it — read the value there, never infer it from the chat |
| "the assistant didn't react" | whether a trace exists for that event at all — none → the event never reached it (AI pipeline) |
| reminders, abstains, timing | turns triggered by reminders / schedulers and the abstain flag |

Quote the deciding lines (time + trace id) in the run log and the report. A trace explains a verdict; on-device
evidence still decides it. Combined with `net.sh` it names the layer — see
[`reports/_template/bug-report/BUG_REPORT_TEMPLATE.md`](../../reports/_template/bug-report/BUG_REPORT_TEMPLATE.md) → "Name the layer".

## Rules
- Read-only. Never write scores, prompts or datasets — they belong to the AI team.
- Raw trace JSON contains user data: save it only under `screenshots/` (gitignored); quote what you need.
- Record experiment / rollout assignments found in trace metadata per test account — they change behaviour.

## What units have learned (add yours)
- *(example — replace)* An availability question ("today or tomorrow?") followed straight away by the card is by design
  when the assistant's rules say the question is never a gate — the trace quotes the rule; withdraw the candidate.
