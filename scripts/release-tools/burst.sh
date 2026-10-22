#!/usr/bin/env bash
# burst.sh start <name> | stop <name> — screenshot every ~0.4 s into capture/<name>/ (for animations and
# auto-advancing screens that cannot be frozen). Run `start` in the background; `stop` ends it.
source "$(dirname "$0")/_env.sh"; B="$SHOTS/capture/$2"; mkdir -p "$B"
case "$1" in
  start) rm -f "$B/STOP"; while [ ! -f "$B/STOP" ]; do adb -s "$DEVICE" exec-out screencap -p > "$B/$(date +%H%M%S).png"; sleep 0.4; done ;;
  stop)  touch "$B/STOP" ;;
esac
