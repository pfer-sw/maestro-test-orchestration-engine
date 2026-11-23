# Testability Register — Missing Resource IDs

**Living document.** Updated on EVERY test/exploration run. Never overwrite — append,
and move fixed entries to the "Resolved" section with the build that fixed them.

**Purpose:** hand devs a single, concrete list of elements that need `testTag` /
`resource-id` (Android) or `accessibilityIdentifier` (iOS) so Maestro can use stable `id:`
selectors instead of coordinates or text.

## Why this matters
- Coordinate taps break on any layout change, screen size, or density
- Text locators break on locale change and on copy edits
- Both produce flaky suites that erode trust in automation results

## Severity
| Level | Meaning |
|---|---|
| **blocker** | No stable locator exists at all — automation impossible or coordinate-only |
| **high** | Only text locator available — works but breaks on locale/copy change |
| **medium** | ID exists but is ambiguous/duplicated/unstable across builds |
| **low** | Nice-to-have; a usable stable locator already exists |

## How to add an entry (every run)
1. `inspect_screen` on each new screen before writing any flow
2. For every element you need to target, check for `resource-id`
3. If absent → add a row below with: screen, element, proposed id, current workaround, severity, build, date
4. If a previously-listed element now HAS an id → move it to Resolved with the build number

Group rows under `## Open — <area>` headings (one per screen family or run). A section that
blocks a whole feature gets a short blockquote saying so.

---

## Open — Notes list *(example — replace)*

| Screen | Element | Proposed ID | Current workaround | Severity | Build | Found |
|---|---|---|---|---|---|---|
| Notes list | Note row | `note_item_<n>` | `text: "<note title>"` + `index:` | high | 1.4.0 (140) | 2026-01-15 |

## Open — SWORD member app (Android) · Pulse onboarding v2 + 3-way chat

| Screen | Element | Proposed ID | Current workaround | Severity | Build | Found |
|---|---|---|---|---|---|---|
| Swipe cards ("Let's personalize your plan") | ✗ "not me" button | `three_way_chat_onboarding_swipe_no` | `swipe` LEFT from `id: three_way_chat_onboarding_swipe_deck` | high | 8.7.0 (8243) | 2026-11-10 |
| Swipe cards | ✓ "describes me" button | `three_way_chat_onboarding_swipe_yes` | `swipe` RIGHT from `id: three_way_chat_onboarding_swipe_deck` | high | 8.7.0 (8243) | 2026-11-10 |
| Swipe cards | Card category + statement text | `three_way_chat_onboarding_swipe_card_title` / `_statement` | read by text | medium | 8.7.0 (8243) | 2026-11-10 |
| Onboarding carousel / summary | "Continue", "Skip for now", "Let's go!", "Set up" buttons | `three_way_chat_onboarding_primary_button` / `_secondary_button` | `text:` | high | 8.7.0 (8243) | 2026-11-10 |
| Welcome (MonaLisaActivity) | "Build my plan" button | `pulse_welcome_build_plan_button` | `text: "Build my plan"` | high | 8.7.0 (8243) | 2026-11-10 |
| Create PIN code | "Not now" | `pin_create_skip_button` | `text: "Not now"` | high | 8.7.0 (8243) | 2026-11-10 |
| 3-way chat | Phoenix / HS message bubble | `chat_message_received` (sent bubbles already have `chat_message_sent`) | text regex; content-desc "Phoenix" is shared by every bubble | high | 8.7.0 (8243) | 2026-11-10 |
| 3-way chat | Activity card in a message ("Full Body Strengthener") | `chat_activity_card` | `text:` of the activity name (backend-driven) | high | 8.7.0 (8243) | 2026-11-10 |
| 3-way chat | Typing indicator | `chat_typing_indicator` | none: wait on message text / fixed timeout. A reply cannot be awaited reliably. | blocker | 8.7.0 (8243) | 2026-11-10 |
| 3-way chat | Pinned pending-task banner ("Start Session · Complete it in 4 minutes") | `chat_pending_task_banner` | `text: "Start Session"` | high | 8.7.0 (8243) | 2026-11-10 |
| Session rating ("How would you rate today's session?") | Close (✕) button: Button with no text / id / content-desc | `session_rating_close_button` | none; rate with `text: "Rate 5 out of 5"` + `Submit` instead (writes a rating) | blocker | 8.7.0 (8243) | 2026-11-10 |
| Session player (landscape) | Pause / controls overlay | `session_player_controls` | `text: "Show video controls"` (content-desc), then `tapOn: "Leave"` in the same flow; controls auto-hide after ~2 s | high | 8.7.0 (8243) | 2026-11-10 |
| Session player | Exercise timer + name | `session_exercise_timer` / `session_exercise_name` | read by text | medium | 8.7.0 (8243) | 2026-11-10 |
| Session preview / intro | "Start activity", "I'm ready", "Got it", "Finish session?" Yes/Cancel, "Done" | `session_start_button`, `session_ready_button`, … | `text:` | high | 8.7.0 (8243) | 2026-11-10 |
| 3-way chat | Plan card entries (Pulse Kit / Movement / Nutrition) | `plan_card_entry_<key>` | text | high | 8.7.0 (8243) | 2026-11-10 |
| 3-way chat | Kit card "Track your kit" | `chat_kit_card` | `text: "Track your kit"` | high | 8.7.0 (8243) | 2026-11-10 |

## Resolved
| Screen | Element | ID shipped | Fixed in build | Verified |
|---|---|---|---|---|

---

## Re-check protocol
At the start of every run, re-verify the Open entries against the current build.
Anything that gained an id moves to Resolved. Anything still missing gets its
"Build" column updated to the current build, so the register shows how long each
gap has been outstanding.
