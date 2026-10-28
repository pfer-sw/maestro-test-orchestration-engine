# Web back-office tools — Claude in Chrome (and Maestro web)

Many journeys have a second side in a web tool: a clinician / agent / admin portal that resolves
what the app escalated, changes an assignment, or confirms a backend effect. These steps used to be
tester handovers. Claude drives them with **Claude in Chrome** ([ED-002](../engineering-decisions.md)).
Maestro's web support also works and is described below for the cases where committed flows are needed.

## Claude in Chrome (default)

Claude in Chrome is a browser extension that lets Claude act in the **tester's own Chrome**, with its
existing sign-ins (SSO / Okta / MFA already done), in new tabs next to the tester's.

**Setup (once):** install the **Claude** extension from the Chrome Web Store, signed in to the same
account as Claude Code → in Claude Code `/chrome` → **Enabled by default** (applies to the CLI and the VS
Code panel) → allow the extension on the back-office domains when prompted. A conversation started
before enabling it does not get the `mcp__claude-in-chrome__*` tools: start a new one (or `@browser`).

**Rules:**
- Work in a **new tab**; close it at the end. Re-read the tab context if a tab id stops working.
- **Start network capture before loading the page** (or reload once) — requests made during the first
  load are otherwise missed. Cite method, path, status as evidence, as with `net.sh` on Android.
- It acts with the **tester's identity**: test / staging environments only, and confirm with the
  tester before any action that writes outside the test accounts.
- **"Just viewing" may not be read-only.** Check the network log on first use: a page can POST on load
  (summaries, read receipts, AI digests) for the open record and others in a queue. Ask dev before
  treating a page view as side-effect-free.
- Avoid buttons that raise native `alert`/`confirm` dialogs — they block the extension until the
  tester dismisses them.
- Back-office logins that are not secret internally may be documented in
  `docs/workflows/account-provisioning.md` (see `CLAUDE.md` rule 10) so Claude can switch users.

**Trade-offs:** no committed flows or coverage for these steps; runs need the tester's Chrome open.

**Project-wide fallback:** when the normal route to a system — REST API, API key, an MCP server —
fails or doesn't cover the task, use Claude in Chrome on that system's web UI before handing the
step to the tester.

## Maestro web (when committed flows are needed)

The Maestro MCP lists a `chromium` device; `run`, `inspect_screen`, `take_screenshot` work on it
(flows declare `url:` instead of `appId:`). Learned on Maestro 2.10–2.12, Chrome 156:

- **Maestro starts its own Chrome with an empty profile.** SSO / Okta / MFA appears every time a new
  automation browser starts; a human must unlock it in that window. Within one MCP browser session the
  sign-in survives across `run` calls. **CLI runs (`maestro --device chromium test`) start a fresh
  browser each time**, so they hit SSO on every run — not usable unattended behind SSO.
- **Never close the automation window.** The MCP keeps the dead Selenium session (`no such window:
  target window already closed`, `No CDP page target available`) and `/mcp` reconnect may not clear it.
  Recovery: kill the `maestro.cli.AppKt mcp` process that owns the `chromedriver` child; the MCP
  reconnects on the next call with a fresh browser.
- The MCP's `env` parameter is how credentials reach a flow; Claude cannot read `.env`, so a CLI
  wrapper must load the keys itself (load only the needed keys, never echo them, handle a last line
  without a trailing newline).
- `inspect_screen` labels web hierarchies `platform: ios` — ignore it; `rid` is the DOM `id`.
- Web element ids often carry **random suffixes** (`username-aqfi1`) → match with a regex
  (`id: "username-.*"`); generic wrapper ids (e.g. a shared tooltip id) are not unique — don't use them.
- Link text can be padded with spaces/newlines in the hierarchy, so exact text fails; use
  `"(?s)\\s*Label\\s*"`.
- 2.12: web `launchApp` waits for the page it opens; Selenium 4.51 (Chrome 153–155 officially).
