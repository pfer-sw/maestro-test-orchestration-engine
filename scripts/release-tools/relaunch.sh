#!/usr/bin/env bash
# relaunch.sh <name> — kill + cold start (NO clearState) with a burst running; prints the first destination.
# Use for anything only shown on a cold start (first-launch screens, celebrations triggered by backend changes).
# Starts $SPLASH when set, otherwise the app's launcher intent (monkey).
source "$(dirname "$0")/_env.sh"; D="$(dirname "$0")"
"$D/burst.sh" start "$1" & sleep 1
adb -s "$DEVICE" shell am force-stop "$APP_ID"; echo "kill $(date +%T)"; sleep 1.5
if [ -n "$SPLASH" ]; then
  adb -s "$DEVICE" shell am start -n "$APP_ID/$SPLASH" >/dev/null
else
  adb -s "$DEVICE" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
fi
sleep 12
"$D/screen.sh" "$1.first_destination" | head -8
"$D/burst.sh" stop "$1"
