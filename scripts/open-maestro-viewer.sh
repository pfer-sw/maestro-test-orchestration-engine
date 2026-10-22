#!/usr/bin/env bash
# Claude Code PreToolUse hook (mcp__maestro__run): show the Maestro Viewer in a VS Code tab.
# Needs the local extension in tools/vscode-maestro-viewer (npm run viewer:install).
# Never blocks the run: always exits 0.
[ "${MAESTRO_VIEWER_AUTOOPEN:-1}" = "0" ] && exit 0
open -g "vscode://local.maestro-viewer/open" >/dev/null 2>&1 || true
exit 0
