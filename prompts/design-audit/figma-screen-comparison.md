# Figma Design vs. App Screenshot Comparison

You are performing a visual design audit for a mobile app. Compare the Figma reference
design frame to the actual app screenshot and identify discrepancies that matter to
users and to design fidelity: wrong or missing text, incorrect button labels, missing
elements, wrong logos, typography mismatches, and layout/spacing differences.

**Flow ID**: {{flowId}}
**Flow Name**: {{flowName}}
**Figma Frame Name**: {{figmaFrameName}}
**Figma Screenshot Path**: {{figmaScreenshotPath}}
**App Screenshot Path**: {{appScreenshotPath}}
**Flavor**: {{flavor}}
**Run Date**: {{runDate}}
**Sequence Index**: {{sequenceIndex}}
**Notes**: {{notes}}

Read both screenshots now before analyzing.

> **Animation frame context**: The Figma screenshot provided is the FINAL animation state
> for this screen — the frame the user sees when the animation settles. Do not flag differences
> that are explained by the app being captured at a different animation moment (e.g., a speech
> bubble appearing during the animation is expected if the Figma frame shows it). The `Notes`
> field above may provide additional context about the animation sequence.

---

## What to Compare

Check every visible element in both screenshots. Flag anything that differs. Categories:

### Text & Copy
- **Titles and headings** — text content and visual hierarchy (is a heading styled as body text, or vice versa?)
- **Subtitles and body copy** — text content matches Figma copy exactly
- **Button labels** — every visible button's label text
- **Navigation labels** — tab bar labels, back button text, header titles
- **Input field placeholders** — placeholder copy matches Figma

### Visual Identity
- **Logo** — correct logo variant used? (e.g., full wordmark vs icon-only, correct brand mark shape, not a placeholder). Check the *shape* of the mark, not just whether something is present.
- **Brand asset gradients and animated elements** — glows, gradient illustrations and animated brand elements (loaders, mascots, animated backgrounds) should match Figma's colour temperature and shape. A warm-toned Figma asset rendered cool-toned in the app IS a brand asset inconsistency — flag it. Animated elements are compared at their settled final frame; ignore differences that are only animation phase. Don't require pixel-perfect hex matching, but flag clearly different colour distributions.
- **Icons** — correct icon used? (e.g., filled vs outline variant, wrong icon entirely vs the intended one). This includes icons shown inside device mockups or notification previews.
- **Illustrations / hero images** — correct illustration present, or replaced with placeholder/different asset?

### Typography
- **Font weight** — is a bold heading rendered as regular weight, or vice versa? (ignore subpixel rendering artifacts)
- **Font style** — unexpected italic or all-caps where Figma shows normal case?
- **Text size hierarchy** — is a large heading rendered noticeably smaller than in Figma (or vice versa)?

### Layout & Spacing
- **Button padding** — does a button look significantly tighter or more padded than in Figma? (flag only obvious differences, not pixel-perfect measurements)
- **Element spacing** — is the visual rhythm between elements clearly different from Figma? (e.g., elements crammed together or spread far apart)
- **Element ordering** — are UI elements in a different vertical/horizontal order than Figma?

### Presence
- **Key UI elements** — are all major elements from the Figma frame present in the app?
- **Extra elements** — are there elements in the app that are absent from Figma?

---

## What NOT to Flag

Do NOT flag these as discrepancies:
- Pixel-level color differences (e.g., `#FFFFFF` vs `#FAFAFA`) that look identical to the naked eye
- Font rendering / subpixel antialiasing differences between Figma and device
- Shadow, blur, or elevation rendering differences (platform-specific)
- Screen density or resolution differences
- Test data substitutions (e.g., real username instead of "User Name" placeholder) — flag only if the substitution makes the screen look broken
- Loading states, spinners, or skeleton screens — these are transient
- Dynamic/personalised content that is expected to differ per user (avatars, dates, counters) — flag only if a static placeholder is shown where real content should be, or vice versa

---

## Important Notes — When to populate

Populate `importantNotes` (a string array) when you observe any of the following:

- **Missing content volume**: The Figma frame shows significantly more content, sections, or screens than what is visible in the app. This usually means the app is truncating or skipping content that Figma designed. Be specific: "Figma shows a 5-card carousel but app renders only 2 cards."
- **Missing onboarding/flow steps**: Figma indicates there are more steps in a sequence than the app is showing at this point.
- **Structural layout departure**: The overall layout structure differs so much that individual element checks may be unreliable — note this so engineers know to review the whole screen.
- **Assets not loaded**: Images, illustrations, or media slots are present but empty/broken (different from a known placeholder).

Leave `importantNotes` as an empty array `[]` if none of the above apply.

---

## Output

Return ONLY a valid JSON object. No markdown fences, no explanation text, no commentary.
The JSON must be parseable by `JSON.parse()` with no pre/post processing.

```
{
  "flowId": "{{flowId}}",
  "flowName": "{{flowName}}",
  "figmaFrameName": "{{figmaFrameName}}",
  "figmaScreenshotPath": "{{figmaScreenshotPath}}",
  "appScreenshotPath": "{{appScreenshotPath}}",
  "flavor": "{{flavor}}",
  "runDate": "{{runDate}}",
  "sequenceIndex": {{sequenceIndex}},
  "overallResult": "pass",
  "summary": "One-sentence summary of the comparison result.",
  "importantNotes": [],
  "discrepancies": [
    {
      "id": "disc_1",
      "severity": "critical",
      "element": "Human-readable element name, e.g. 'Primary CTA button'",
      "figmaValue": "What the Figma design shows for this element",
      "appValue": "What the actual app shows for this element",
      "description": "Clear description of the mismatch",
      "category": "button_labels"
    }
  ],
  "matchedElements": [
    {
      "element": "Human-readable element name",
      "status": "match"
    }
  ],
  "figmaMissingFromApp": [],
  "appMissingFromFigma": [],
  "confidence": "high",
  "confidenceNote": null
}
```

### Field rules

**overallResult**
- `"pass"` — no discrepancies, or only `"info"` severity discrepancies
- `"warn"` — one or more `"warn"` severity discrepancies, no `"critical"`
- `"fail"` — one or more `"critical"` discrepancies
- `"error"` — reserved for fetch/runtime errors; do not use in comparison output

**discrepancies[].severity**
- `"critical"` — wrong or missing user-facing text, missing key UI element, wrong button label, wrong logo, wrong major asset
- `"warn"` — typography weight/style mismatch, noticeable spacing/padding difference, wrong icon variant, element present but visually wrong in a noticeable way
- `"info"` — very minor cosmetic observation, unlikely to be noticed by users

**discrepancies[].category** — use one of:
`button_labels`, `title`, `subtitle`, `text_content`, `navigation_labels`,
`input_placeholder`, `missing_element`, `extra_element`, `layout_order`,
`typography`, `logo`, `icon`, `spacing_padding`, `illustration`

**importantNotes** — array of plain-text strings. Each note should be a single clear
sentence describing what's missing or structurally wrong at the screen level.
Use this for content-volume gaps (Figma shows more than app renders) and structural
departures. Do not duplicate discrepancy items here.

**figmaMissingFromApp** — array of element name strings (no objects) that appear in the
Figma frame but are entirely absent from the app screenshot.

**appMissingFromFigma** — array of element name strings that appear in the app but are
not present in the Figma frame.

**confidence**
- `"high"` — you are confident both screenshots show the same screen
- `"medium"` — minor layout differences but same general screen
- `"low"` — the screenshots may be showing different screens; set this if the app and
  Figma layouts are substantially different in structure

**confidenceNote** — null if confidence is "high"; otherwise a brief explanation.

**matchedElements** — list every element you checked that matched correctly. This is
important: the report will show both matched and unmatched elements.
