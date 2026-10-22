# Hardware-Gated Screen Analysis Prompt

Use this prompt **instead of** `screen-analysis.md` when the screenshot shows a screen Claude
cannot drive by tapping, for example:
- A camera / video overlay (camera preview, document or QR scanner, AR view)
- A sensor-driven screen (step counter, motion tracking, GPS-only flow, Bluetooth pairing)
- A native payment sheet (Google Pay, in-app purchase)
- A biometric prompt (fingerprint, face unlock)
- A screen whose progress depends on any of the above (timers, counters, live readings)

**App Flavor**: {{flavor}}
**App Display Name**: {{flavorDisplayName}}
**Screenshot Path**: {{screenshotPath}}
**Known Screens So Far**: {{knownScreensList}}
**Current BFS Depth**: {{currentDepth}} / {{maxDepth}}
**Configured Skip Selectors**: {{hardwareGatedSkipSelectors}}

---

Analyze the screenshot **and** the `inspect_screen` hierarchy, then return a JSON object with the
following structure. Output ONLY valid JSON — no markdown, no explanation, no code fences.

```json
{
  "screenId": "gate.snake_case_unique_id",
  "screenName": "Human Readable Screen Name",
  "isNew": true,
  "description": "One sentence describing what this screen is for",
  "gateKind": "camera|sensor|payment|biometric|other",
  "isHardwareGated": true,
  "isResultScreen": false,
  "skipControls": {
    "skipFound": false,
    "skipResourceId": "",
    "skipContentDescription": ""
  },
  "elements": [
    {
      "type": "button|input|tab|list|toggle|text|image|overlay|counter",
      "label": "Visible text or icon name",
      "resourceId": "resource_id_from_view_hierarchy_without_package_prefix",
      "contentDescription": "content-desc (a11y) if no resource_id — used as text: in flows",
      "action": "What happens when the user interacts with this element",
      "isSafe": true,
      "isHardwareData": false
    }
  ],
  "navigationTargets": ["screen_id_1"],
  "bfsGuidance": {
    "type": "hardware_gate|gate_step|result_screen|pre_gate",
    "requiresSkip": true,
    "canContinueViaBfs": false,
    "continueVia": "skip_control|normal_navigation|none",
    "notes": "Short explanation of how to proceed in BFS"
  },
  "suggestedFlows": [
    {
      "flowId": "gate.screen_id.action_name",
      "description": "What this flow tests in one sentence",
      "priority": "critical|high|medium|low",
      "assertsHardwareData": false,
      "steps": [
        "Run login_happy_path.yaml",
        "Navigate to the gated screen",
        "Grant / dismiss the permission dialog",
        "Tap the skip control",
        "Assert result screen visible (structural only)"
      ]
    }
  ],
  "skipReasons": []
}
```

---

## Field Guidelines

**isHardwareGated**: `true` when advancing normally needs something Claude cannot supply
(real camera input, physical movement, a sensor reading, a payment, a biometric).

**isResultScreen**: `true` for the screen shown after the gated step ends or is skipped (summary,
receipt, confirmation). It has structural elements (cards, CTAs) but **no real hardware data**
when reached via skip.

### skipControls

Populated from the view hierarchy only — never from the screenshot alone.

- **skipResourceId**: the `resource-id` (package prefix stripped) of any control that bypasses the
  gated step (skip, "do it later", "enter manually", a debug/test-mode toggle).
- **skipContentDescription**: the `a11y` value when there is no resource-id (flows use `text:`).

If you find a skip control that differs from `{{hardwareGatedSkipSelectors}}`
(`config/flavors.json` → `hardwareGated.skipSelectors`), flag it — the config needs updating.
A control with no stable locator goes to the testability register as a **blocker**.

### elements.isHardwareData

`true` for any element that shows values produced by the hardware step: live readings, counters,
scores, scan results, payment amounts confirmed by the sheet. These are empty or default when the
step is skipped, so flows MUST NOT assert on them.

### bfsGuidance

| type | meaning | requiresSkip | continueVia |
|------|---------|--------------|-------------|
| `hardware_gate` | Entry to the gated step — real input required to advance | `true` | `skip_control`, else `none` |
| `gate_step` | An intermediate step inside the gated experience | `true` | `skip_control`, else `none` |
| `result_screen` | After the gated step — normal BFS can continue | `false` | `normal_navigation` |
| `pre_gate` | Setup / instructions / permission primer before the gate | `false` | `normal_navigation` |

**canContinueViaBfs**: `false` for `hardware_gate` and `gate_step`. When no skip control is
locatable: record every id found, mark the taxonomy entry `type: "hardware_gate"`,
`requiresSkip: true`, set its flows to `skipped`, and **stop descending** from this screen.
The tester performs the hardware step; Claude drives what comes after.

### suggestedFlows

- **assertsHardwareData**: `false` for all skip-path flows.
- Always start with a `runFlow` of `baseline/auth/login_happy_path.yaml` (path relative to the flow file).
- Handle the OS permission dialog conditionally (`runFlow: when: visible: id: <permission button>`);
  the camera "allow while using" id is in `config/flavors.json` → `hardwareGated.selectors`.
- Result-screen flows reached via skip MUST add the comment:
  `# NOTE: reached via skip — hardware data not populated`

### navigationTargets

For `hardware_gate` / `gate_step`: list only targets reachable via a skip control. Do NOT list
elements that need real input as navigation targets.

### skipReasons

Common reasons:
- `"requires real hardware input — no skip control available"` — blocks BFS
- `"hardware data screen — structural coverage only"` — result screen with empty values
- `"native system sheet — no app elements"` — payment / biometric sheet owned by the OS
