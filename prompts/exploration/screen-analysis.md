# Screen Analysis Prompt

You are analyzing a mobile app screenshot as part of an automated test discovery process.

**App Flavor**: {{flavor}}
**App Display Name**: {{flavorDisplayName}}
**Screenshot Path**: {{screenshotPath}}
**Known Screens So Far**: {{knownScreensList}}
**Current BFS Depth**: {{currentDepth}} / {{maxDepth}}

---

Analyze the screenshot carefully and return a JSON object with the following structure.
Output ONLY valid JSON — no markdown, no explanation, no code fences.

```json
{
  "screenId": "snake_case_unique_id_for_this_screen",
  "screenName": "Human Readable Screen Name",
  "isNew": true,
  "description": "One sentence describing what this screen is for",
  "elements": [
    {
      "type": "button|input|tab|list|toggle|text|image|icon",
      "label": "Visible text or icon name",
      "resourceId": "resource_id_from_view_hierarchy_without_package_prefix",
      "contentDescription": "content-desc (a11y) if no resource_id — used as text: in flows",
      "action": "What happens when the user interacts with this element",
      "isSafe": true
    }
  ],
  "navigationTargets": ["screen_id_1", "screen_id_2"],
  "isAiInterface": false,
  "aiElements": {
    "promptInput": null,
    "submitButton": null,
    "responseArea": null,
    "loadingIndicator": null
  },
  "suggestedFlows": [
    {
      "flowId": "screen_id.action_name",
      "description": "What this flow tests in one sentence",
      "priority": "critical|high|medium|low",
      "steps": [
        "Launch app",
        "Navigate to this screen",
        "Tap <element>",
        "Assert <expected state>"
      ]
    }
  ],
  "skipReasons": []
}
```

## Field Guidelines

**screenId**: Use dot notation for nested screens (e.g., `profile.edit`, `settings.notifications`).
If this screen already exists in knownScreensList, set `isNew: false` and use the same screenId.

**elements.resourceId**: From `inspect_view_hierarchy`, use the `resource-id` value with the package prefix stripped
(e.g., `com.example.notes:id/login_button` → `login_button`). Leave empty string `""` if none exists.

**elements.contentDescription**: Only populate if `resourceId` is empty — the exact `a11y` value from `inspect_screen` (e.g. `Close`). Flows target it with `text:`; there is no `~` prefix.

**elements.isSafe**: Set to `false` for any element that could be destructive (delete, clear, reset, log out with no recovery).
Only safe elements should be interacted with during automated exploration.

**navigationTargets**: List the screenIds that the visible navigation elements lead to.
Only include targets you are confident about. If uncertain, omit rather than guess.

**isAiInterface**: Set to `true` if this screen has a text input connected to an AI/LLM assistant.
This triggers generation of AI meta-test flows for this screen.

**aiElements**: Only populate if `isAiInterface` is true.
Use resource-ids from `inspect_screen` (e.g. `assistant_input`, `assistant_send_button`); never invent ids from the screenshot.

**suggestedFlows**: List 1-3 flows that are worth testing on this screen.
Focus on the primary user action and the most important error/edge case.
Omit flows that are identical to flows already in knownScreensList.

**skipReasons**: List any reasons why this screen should NOT be explored further
(e.g., "requires payment", "native OS dialog", "already covered by known screen X").
