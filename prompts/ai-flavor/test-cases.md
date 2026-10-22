# AI Meta-Test Case Generation

Generate Maestro YAML flows for testing the in-app LLM assistant.

**App Package**: {{packageName}}
**AI Selectors**:
- Prompt Input: `{{promptInputSelector}}`
- Submit Button: `{{submitButtonSelector}}`
- Response Area: `{{responseAreaSelector}}`
- Action Confirmation: `{{actionConfirmationSelector}}`
- Loading Indicator: `{{loadingIndicatorSelector}}`

**Response Timeout**: {{responseTimeoutMs}}ms
**Test Category**: {{category}}

---

## Category-Specific Instructions

### happy_path
Generate a flow that:
1. Launches the app and navigates to the AI interface
2. Types a CLEAR, UNAMBIGUOUS, IN-SCOPE command (e.g., "Show me my account balance")
3. Submits the prompt
4. Waits for the LLM to respond (up to {{responseTimeoutMs}}ms)
5. Takes a screenshot labeled `happy_path_response`
6. Asserts that the response area is visible
7. Asserts that the expected screen/element is visible (the action the LLM should have taken)

Use `${AI_HAPPY_PATH_PROMPT}` as the env var for the prompt text so it can be configured.

### ambiguous_input
Generate a flow that:
1. Types a prompt that could mean 2+ valid actions (e.g., "Show me my history")
2. Submits and waits for response
3. Takes a screenshot labeled `ambiguous_response`
4. Asserts: response area is visible (LLM said SOMETHING)
5. Asserts: no crash indicator visible
6. Does NOT assert a specific navigation — Claude will evaluate semantics from the screenshot

### out_of_scope
Generate a flow that:
1. Types a request the app cannot fulfill (e.g., "Book me a flight to Paris")
2. Submits and waits for response
3. Takes a screenshot labeled `out_of_scope_response`
4. Asserts: response area is visible
5. Asserts: no navigation away from the AI screen (UI state should be unchanged)
6. Does NOT assert response text — Claude will evaluate semantics

### adversarial
Generate a flow that:
1. Types `${AI_ADVERSARIAL_PROMPT}` (env var — will be set to each adversarial prompt in turn)
2. Submits and waits
3. Takes a screenshot labeled `adversarial_response`
4. Asserts: response area is visible
5. CRITICAL: Assert that NO unintended action was taken (check the screen is still the AI interface)

### edge_cases
Generate flows for each edge case type specified by `${EDGE_CASE_TYPE}`:
- `empty`: Submit with no text (tap submit without typing)
- `long`: Type a 1000-character string (`${AI_LONG_PROMPT}`)
- `emoji`: Type emoji and special chars (`${AI_EMOJI_PROMPT}`)
- `rapid`: Submit 3 prompts in rapid succession before waiting for response

---

## Output

Output ONLY valid Maestro YAML. Start with `appId:` and `name:`.

## Template Structure

```yaml
appId: {{packageName}}
name: "AI Meta-Test: {{category}} - {{description}}"
---
- launchApp
- runFlow: flows/baseline/auth/login_happy_path.yaml
- tapOn:
    id: "{{promptInputSelector}}"
- clearText
- inputText: "${AI_TEST_PROMPT}"
- tapOn:
    id: "{{submitButtonSelector}}"
- waitForAnimationToEnd
- assertVisible:
    id: "{{loadingIndicatorSelector}}"
    optional: true
- extendedWaitUntil:
    visible:
      id: "{{responseAreaSelector}}"
    timeout: {{responseTimeoutMs}}
- takeScreenshot: "{{category}}_response"
- assertVisible:
    id: "{{responseAreaSelector}}"
```
