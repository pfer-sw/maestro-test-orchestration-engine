#!/usr/bin/env bash
# capture-video.sh <name> — screen video in 180 s segments until `touch <dir>/STOP` (wraps ../capture-run.sh).
source "$(dirname "$0")/_env.sh"; exec "$ROOT/scripts/capture-run.sh" "$DEVICE" "$SHOTS/capture/$1" video
