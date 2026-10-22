---
scope: Example Notes (flavor main) — notes list, sync, assistant actions
status: observed
verifiedOn: 1.4.0 (140), 2026-01-15
evaluator: exclude
---

# Example Notes — product rules *(example — replace)*

> **Worked example.** This file shows the conventions defined in [`README.md`](README.md) for the
> fictional Example Notes app. The `bootstrap` workflow deletes it; write your own rules files
> in the same shape.

Conventions used below: each rule is one numbered line; **Observed** records the build + date a
run saw it; **(tester)** marks a rule stated by the tester; a rule never seen in the app carries
`unverified` inline and must not become a pass/fail criterion until observed.

## 1. Empty state
1.1 A fresh account opens on `home_screen`; `tab_notes` shows an empty state with a "Create your
    first note" CTA. **Observed** 1.4.0 (140), 2026-01-15.
1.2 The empty-state CTA opens the editor with the cursor in the title field. **Observed** 1.4.0 (140), 2026-01-15.

## 2. Creating a note
2.1 A note with an empty title is saved as "Untitled". **Observed** 1.4.0 (140), 2026-01-15.
2.2 Leaving the editor with back saves the note; there is no explicit Save button. **(tester)**
    **Observed** 1.4.0 (140), 2026-01-15.

## 3. Sync
3.1 A note created offline shows a "Not synced" badge until the device reconnects, then syncs
    without user action (`setAirplaneMode` + `net.sh calls`: one `POST /notes` on reconnect).
    **Observed** 1.4.0 (140), 2026-01-15.
3.2 Conflicting edits on two devices keep both versions. `unverified` — stated by product, not yet seen.

## 4. Assistant actions
4.1 The assistant only confirms an action the UI reflects (guardrail `claimed_action_not_performed`).
    **Observed** 1.4.0 (140), 2026-01-15.
4.2 Destructive actions (delete, clear) ask for confirmation first. **Observed** 1.4.0 (140), 2026-01-15.

## Known issues
| Id | Issue | Status |
|---|---|---|
| EX-01 | Assistant confirmed a share that never happened (`docs/wins.md`) | fixed 1.4.1 (141) |

## Sources
| Source | Date |
|---|---|
| Product spec page (wiki mirror `kb/wiki/example-notes-spec.md` — illustrative, not shipped) | 2026-01-10 |
| Release run, 1.4.0 (140) | 2026-01-15 |
