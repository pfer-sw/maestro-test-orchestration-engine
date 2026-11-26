# Explorer — map an app and generate its first flows

**Trigger:** `explore --flavor=<id>`. The entry point for a unit touching base with a new app (or a new flavor of one),
usually right after `bootstrap`: it maps every screen, primary action and navigation path, produces flows and populates
`coverage/taxonomy.json`. Paths below are from the repo root. Engine rules (locators, device driving, non-negotiables) stay in
[`CLAUDE.md`](../../CLAUDE.md) — read "Driving the device" first: on a phone, "inspect" means `maestro --device <id> hierarchy`
and "run" means the Maestro CLI.

**Step 1 — Initialize**
1. `list_devices`; use the device matching `preferredDeviceId` in `config/flavors.json`, else the first.
2. Read the flavor in `config/flavors.json` (`app.packageName`, `env`, `aiTesting`).
3. Read `coverage/taxonomy.json` — the existing map; never overwrite known entries.

Apps are pre-installed. If the app is missing, ask the tester to check the flavor's `APP_ID` (or
`<FLAVOR>_APP_ID`) in `.env` (Claude cannot read it).

**Step 2 — Launch:** `run` with `appId: <packageName>` / `- launchApp`, then screenshot.

**Step 3 — BFS discovery.** For each screen in the queue:
1. Screenshot → save to `screenshots/exploration/<flavor>/<timestamp>_<screenId>.png`.
2. `inspect_screen`; analyse with `prompts/exploration/screen-analysis.md`
   (hardware-gated screens: `prompts/exploration/hardware-gate-analysis.md`).
3. New screen → taxonomy flow entry with `coverage.<flavor>.status: "discovered"`, enqueue its targets. Known screen → compare
   structure; differences go to `coverage/taxonomy.drift.json`.
4. Generate a flow with `prompts/exploration/flow-generation.md`, then execute it with `run`.
   Fails → correct and retry up to 3 times; still failing → keep `discovered`, log why.
   Passes → save to `flows/generated/<flavor>/<YYYY-MM-DD>/<flowFile>`, set the flow's `flowFile` and
   `coverage.<flavor>.status: "covered"`. (Taxonomy schema: `config/README.md` → `coverage/taxonomy.json`.)
5. Flavors with `aiTesting.enabled`, on screens with an LLM interface (`isAiInterface: true`) → also
   generate the 5 meta-test categories (below) into `flows/ai/prompts/` and `flows/ai/edge_cases/`.
6. Update the testability register for every element without a resource-id.
7. Respect `exploration.maxDepth` in `config/global.json` (default 5); deeper screens → `discovered` with a note.

Auth wall → credentials from the resolved account. Device disconnects → `list_devices` and resume.

**Step 4 — Completion:** write taxonomy, run `node scripts/calculate-coverage.js`, print:
```
Exploration complete for flavor: <flavor>
Screens discovered: X | Flows generated: X | Flows validated: X | Coverage: X%
```

## Error handling
| Situation | Action |
|---|---|
| Flow still invalid after 3 attempts | keep `discovered`, log reason, continue |
| taxonomy inconsistency | append to `coverage/taxonomy.drift.json`, flag, do not overwrite |
| Device disconnects | list devices → reconnect → resume from the last completed screen |
