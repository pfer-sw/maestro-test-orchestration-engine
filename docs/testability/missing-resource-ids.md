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

## Resolved
| Screen | Element | ID shipped | Fixed in build | Verified |
|---|---|---|---|---|

---

## Re-check protocol
At the start of every run, re-verify the Open entries against the current build.
Anything that gained an id moves to Resolved. Anything still missing gets its
"Build" column updated to the current build, so the register shows how long each
gap has been outstanding.
