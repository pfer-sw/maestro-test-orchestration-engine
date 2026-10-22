#!/usr/bin/env bash
# capture-run.sh — continuous evidence capture for auto-advancing screens (e.g. onboarding carousels).
# Records screen video in 180 s segments AND a screenshot + view-hierarchy dump every ~2 s,
# until a stop file appears. Use when screens advance on their own and can't be frozen.
#
#   scripts/capture-run.sh <deviceId> <outDir> [video] # start (run in background)
#                                                     # 'video' = recording only — use while another
#                                                     # tool drives the device (concurrent uiautomator
#                                                     # dumps collide and return empty)
#   touch <outDir>/STOP                               # stop; last video segment is pulled
set -u
DEV="$1"; OUT="$2"; MODE="${3:-all}"
mkdir -p "$OUT/video" "$OUT/burst" "$OUT/hierarchy"
rm -f "$OUT/STOP"

record_loop() {
  local n=1
  while [ ! -f "$OUT/STOP" ]; do
    local seg; seg=$(printf "seg_%02d" "$n")
    adb -s "$DEV" shell screenrecord --time-limit 180 "/sdcard/$seg.mp4" &
    local pid=$!
    while kill -0 "$pid" 2>/dev/null; do
      [ -f "$OUT/STOP" ] && { adb -s "$DEV" shell pkill -INT screenrecord; sleep 2; }
      sleep 1
    done
    adb -s "$DEV" pull "/sdcard/$seg.mp4" "$OUT/video/$seg.mp4" >/dev/null 2>&1 && adb -s "$DEV" shell rm "/sdcard/$seg.mp4"
    n=$((n+1))
  done
}

burst_loop() {
  while [ ! -f "$OUT/STOP" ]; do
    local ts; ts=$(date +%H%M%S)
    adb -s "$DEV" exec-out screencap -p > "$OUT/burst/$ts.png" 2>/dev/null
    adb -s "$DEV" exec-out uiautomator dump /dev/tty 2>/dev/null | sed 's/UI hierchary dumped to.*//' > "$OUT/hierarchy/$ts.xml"
    [ -s "$OUT/hierarchy/$ts.xml" ] || rm -f "$OUT/hierarchy/$ts.xml"
    sleep 1
  done
}

if [ "$MODE" = video ]; then record_loop & wait; else record_loop & burst_loop & wait; fi
echo "capture stopped"
