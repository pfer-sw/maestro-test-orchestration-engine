# Wins

Catches from this framework that changed a release decision or prevented a production issue.
One entry per win, newest first. Keep the **how it was caught** line: it is the habit to repeat.
Reports stay local (gitignored), so each entry carries the facts it needs.

| Date | Release | Finding | Impact |
|---|---|---|---|
| *(example — replace)* 2026-01-15 | Example Notes 1.4.0 (140), dev | EX-01: assistant confirmed a shared note that was never shared | Fixed before release |

---

## EX-01: assistant confirmed a share that never happened *(example — replace)*

- **What we saw:** asked to share a note, the assistant replied "Done! I've shared Groceries", but
  the note's share list stayed empty.
- **How it was caught:** the claimed action was checked in the UI (`tab_notes` → note → Sharing)
  and with `net.sh calls`, instead of trusting the reply text. No share request was sent.
- **Outcome:** reported with the request log; fixed and confirmed on the next build.
- **Lesson:** when the AI says it did something, verify it in the app and in the network traffic.
