#!/usr/bin/env bash
# stop-virtual-camera.sh
#
# Stops the Pixel_5 emulator started by start-virtual-camera.sh.
# No config restore needed — the videofile camera mode is passed as a CLI flag,
# so the AVD config.ini is never modified.

set -euo pipefail

AVD_NAME="${EMULATOR_AVD:-Pixel_5}"
EMULATOR_PORT="${EMULATOR_PORT:-5554}"
EMULATOR_DEVICE="emulator-${EMULATOR_PORT}"

if adb devices 2>/dev/null | grep -q "$EMULATOR_DEVICE"; then
  echo "▶ Stopping emulator $EMULATOR_DEVICE..."
  adb -s "$EMULATOR_DEVICE" emu kill 2>/dev/null || true
  echo "  Done."
else
  echo "▶ Emulator $EMULATOR_DEVICE not running."
fi
