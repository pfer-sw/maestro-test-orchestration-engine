# Heal Flow Prompt

A Maestro flow has failed. Analyze the failure and produce a corrected flow.

**Flow File**: {{flowPath}}
**App Package**: {{packageName}}

**Original Flow Content**:
```yaml
{{flowYaml}}
```

**Error Output**:
```
{{errorOutput}}
```

**Screenshot at Point of Failure**: {{screenshotPath}}
*(Read the screenshot to understand the current state of the app)*

---

## Your Task

### Step 1 — MANDATORY: Inspect the view hierarchy (do this first, always)

Before writing a single line of YAML, call `inspect_view_hierarchy` on the failing screen.
Parse the CSV output and extract **every element that has a `resource-id`**. Record them in this format:

```
SCREEN: <name of screen inferred from content>
IDs found:
  - <resource-id-1>   (<element type>, <clickable/not>, "<text content if any>")
  - <resource-id-2>   ...
  ...
TEXT-ONLY elements (no resource-id):
  - "<text>"   (<element type>)
  ...
```

This ID inventory is the ground truth for the healed flow. Do not reference any ID that
is not in this inventory. If an ID that was in the original flow is no longer present,
that is the root cause — treat it as a renamed or removed element.

### Step 2 — Identify the root cause

Using the screenshot + ID inventory, diagnose why the flow failed:

| Symptom | Likely cause |
|---------|-------------|
| `Element not found: <id>` | ID renamed by dev, element removed, or screen not reached |
| `Assertion is false: "<text>" is visible` | Text changed, locale mismatch, or curly vs straight apostrophe |
| `Timeout waiting for <id>` | Animation not finished, screen transition too slow |
| `Expected screen X but got Y` | Navigation changed, missing pre-condition step |
| `Text field not accepting input` | Missing `tapOn` before `inputText` |

### Step 3 — Apply the locator strategy (always prefer resource-id)

Use IDs from the Step 1 inventory. Priority order — stop at first match:

1. **Resource ID** (strip package prefix): `id: "login_button"` ← **always first**
2. **Content description** (`a11y`): `text: "Close"` ← only if no resource-id. There is no `~` prefix in Maestro — replace any `id: "~…"`
3. **Text** (exact): `text: "Log in"` ← last resort; note it in a comment as fragile

Never write a locator using text if a resource-id is available in the inventory.
If a text locator is unavoidable, add a comment: `# TEXT ONLY — no resource-id found`

**Text input rule:** Always `eraseText: 100` after `tapOn` and before `inputText` on any editable field.
A previous failed run may have left stale content in the field.

### Step 4 — Produce the corrected flow

- Use `extendedWaitUntil visible: id: "<id>"` (not text) as the gate for each new screen
- Replace every outdated ID or text locator with the current ID from the inventory
- Add missing steps if the screen structure changed (e.g. new onboarding step)
- Add a `# HEALED:` comment at the top listing what changed

---

## Output

Output ONLY valid Maestro YAML. Start with a `# HEALED:` summary comment, e.g.:

```yaml
# HEALED: replaced text assertions with resource-ids (onboarding_*);
#         added step 4 "Enable notifications" (onboarding_skip_button)
appId: ${APP_ID}
---
...
```

Do not include any explanation outside the YAML block.

---

## Common Fixes

| Problem | Fix |
|---------|-----|
| `Element not found: Id matching regex: ~…` | `~` ids never match — re-inspect, use the resource-id, else `text:` with the content description |
| `Assertion is false: "<text>"` | Re-inspect → switch to `id:` locator; if no id, escape apostrophes or use regex |
| `Expected screen X but got Y` | Add a navigation step to reach the correct screen first |
| `Animation still in progress` | Add `waitForAnimationToEnd` before the failing assertion |
| `Text field not accepting input` | Add `tapOn` before `inputText` |
| Stale text in field from previous run | Add `eraseText: 100` after `tapOn` and before `inputText` on every text field |
| `Login required` | Prepend `runFlow: <relative path to>/baseline/auth/login_happy_path.yaml` (paths resolve relative to the flow file) |
| `Element partially visible` | Add `scrollUntilVisible` before the `tapOn` |
| `New screen inserted in flow` | Add the new screen's steps using IDs from the inventory |
