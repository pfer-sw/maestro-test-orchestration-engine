#!/usr/bin/env bash
# cleanup.sh [--kill] — list (or kill) leftover run processes started before today: Maestro MCP servers / CLI JVMs,
# the iOS simulator-server, capture-run loops, logcat streams and adb screenrecord. Run at the start of every run.
# Leftovers from earlier sessions slow every Maestro call (2026-11-06: two MCP servers from Oct 29 / Nov 4 + an iOS
# simulator-server from Nov 4). Today's processes are never touched — they belong to the current session.
TODAY="$(date '+%a %b %e')"
PATTERN='maestro\.cli\.AppKt|maestro/deps/simulator-server|capture-run\.sh|adb .*logcat|adb .*screenrecord'
ps -Ao pid=,lstart=,command= | grep -E "$PATTERN" | grep -v grep | while read -r PID D1 MON DAY T Y CMD; do
  STARTED="$D1 $MON $(printf '%2s' "$DAY")"
  [ "$STARTED" = "$TODAY" ] && continue
  echo "stale  pid $PID  started $D1 $MON $DAY $T  ${CMD:0:110}"
  [ "$1" = "--kill" ] && kill "$PID" 2>/dev/null && echo "       killed"
done
echo "done ($( [ "$1" = "--kill" ] && echo kill || echo list ) mode)"
