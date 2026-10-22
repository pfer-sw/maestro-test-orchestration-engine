# Flow Generation Prompt

Generate a valid Maestro YAML flow for the following test scenario.

**App Package**: {{packageName}}
**Screen**: {{screenName}}
**Flow ID**: {{flowId}}
**Action to Test**: {{actionDescription}}
**Priority**: {{priority}}
**Pre-conditions**: {{preconditions}}

**Elements Available on This Screen**:
{{elementsJson}}

---

## Output Requirements

Output ONLY valid Maestro YAML — no markdown fences, no explanation.
The YAML must start with `appId:` and include `name:`.

## Maestro YAML Rules

1. **Always start with**:
   ```yaml
   appId: <packageName>
   name: "<descriptive flow name>"
   ---
   ```

2. **Locator strategy — use in this order, stop at the first match:**
   - **Resource ID** (from `inspect_screen`, strip package prefix): `tapOn: { id: "login_button" }` ← **always first**
   - **Content description** (`a11y` in `inspect_screen`): `tapOn: { text: "Close" }` ← if no resource-id. Maestro has NO `~` accessibility-id prefix — `id: "~…"` never matches
   - **Text** (exact visible text): `tapOn: { text: "Log in" }` ← last resort; duplicated labels need `index:`
   - **Coordinates**: never use
   > Before writing any flow, inspect the view hierarchy to collect resource-ids for all interactive elements.

3. **Include assertions** after each navigation step — use resource-id when available:
   ```yaml
   - assertVisible:
       id: "expected_screen_resource_id"
   ```

4. **Use inputText for text fields**:
   ```yaml
   - tapOn:
       id: "input_field_resource_id"
   - eraseText: 120          # fields can be pre-filled
   - inputText: "test value"
   ```

5. **Use waitForAnimationToEnd** before asserting after taps that trigger animations

6. **Add a final assertion** that confirms the expected end state

7. **Use env vars** for credentials — never hardcode passwords:
   ```yaml
   - inputText: ${TEST_USERNAME}
   - inputText: ${TEST_PASSWORD}
   ```

8. **For flows that require login first**, start with a `runFlow` of the baseline login flow.
   Maestro resolves `runFlow` paths **relative to the flow file**, e.g. from
   `flows/generated/<flavor>/<YYYY-MM-DD>/`:
   ```yaml
   - runFlow: ../../../baseline/auth/login_happy_path.yaml
   ```

## Example Output

```yaml
appId: ${APP_ID}
name: "Notes - Rename Note"
---
- runFlow: ../../../baseline/auth/login_happy_path.yaml
- tapOn:
    id: "tab_notes"               # resource-id (preferred)
- waitForAnimationToEnd
- assertVisible:
    id: "notes_list"              # resource-id
- tapOn:
    id: "note_item"
    index: 0                      # duplicated rows need index:
- tapOn:
    id: "note_title_input"
- eraseText: 50
- inputText: "Renamed note"
- tapOn:
    id: "note_save_button"
- waitForAnimationToEnd
- assertVisible:
    text: "Renamed note"          # TEXT ONLY — asserting user-entered content
```
