# Bug tracker *(unit data)*

Every bug Claude or the tester confirms on a run gets a row here (append only — update Status/Ticket, never delete).
The **summary below the table is the durable record**; the HTML report is local evidence (`reports/**` is gitignored), so
a lost report must not lose the facts. How to write one: [`reports/_template/bug-report/BUG_REPORT_TEMPLATE.md`](../reports/_template/bug-report/BUG_REPORT_TEMPLATE.md).

**Ids:** global `BUG-NNN`, next free number.
**Status:** `candidate` → `confirmed` → `ticketed` → `fixed` (build) / `won't fix` / `withdrawn` (with the reason).
**Layer:** where the traffic and the AI trace put it — `app` · `backend` · `AI pipeline` (events between backend and the
assistant) · `assistant` (prompt / model) · `content`. See the template → "Name the layer".

| Id | Found | Title | Severity | Layer | Status | Build · env | Ticket | Report (local) |
|---|---|---|---|---|---|---|---|---|
| *(example — replace)* BUG-001 | 2026-01-15 | Assistant confirms a share that was never sent | High | assistant | fixed (1.4.1) | Example Notes 1.4.0 (140) · dev | NOTES-123 | `reports/release_eval_1.4.0_2026-01-15/BUG-001_share_not_sent.html` |

## *(example — replace)* BUG-001 — Assistant confirms a share that was never sent
Asked to share a note, the assistant replied "Done! I've shared Groceries"; `net.sh calls` showed no share request and the
trace showed the share tool was never called (the model answered from the prompt). Fixed in 1.4.1 (tool call made mandatory).
