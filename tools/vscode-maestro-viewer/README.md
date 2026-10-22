# Maestro Viewer tab (local VS Code extension)

Opens the Maestro MCP viewer (`http://127.0.0.1:10000/`) in a VS Code Simple Browser tab beside the
editor. The Claude Code `PreToolUse` hook in `.claude/settings.json` calls
`scripts/open-maestro-viewer.sh` before every `mcp__maestro__run`, which sends
`vscode://local.maestro-viewer/open`. The Simple Browser reuses one tab, so repeated runs don't stack tabs.

Install / update: `npm run viewer:install`, then **Developer: Reload Window**.
Manual open: Command Palette → **Maestro: Open Viewer**. URL: setting `maestroViewer.url`.
Disable: remove the hook from `.claude/settings.json`, or set `MAESTRO_VIEWER_AUTOOPEN=0`.
