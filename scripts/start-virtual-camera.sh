#!/usr/bin/env bash
# start-virtual-camera.sh
#
# Prepares an Android emulator (AVD from $EMULATOR_AVD, default Pixel_5) with a video file injected
# as the FRONT camera source using the emulator's built-in videofile camera mode — for apps whose
# camera-driven screens (pose tracking, scanning, video capture) should see a recorded clip.
# The video is read directly from the host filesystem — no push required.
# No OBS, no virtual camera driver, no runtime console commands needed.
#
# Usage:
#   ./scripts/start-virtual-camera.sh [<video_file>]
#
# Env:
#   CAMERA_VIDEO      video to inject when no argument is given (one of the two is required)
#   EMULATOR_AVD      AVD name (default Pixel_5) · EMULATOR_PORT (default 5554)
#   APP_ID            app under test (only echoed in the summary)
#   CAMERA_TEST_FLOW  Maestro flow to suggest running once the emulator is up (optional)
#
# The emulator stays running in the background. When done, kill it with:
#   ./scripts/stop-virtual-camera.sh

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VIDEO_INPUT="${1:-${CAMERA_VIDEO:-}}"
AVD_NAME="${EMULATOR_AVD:-Pixel_5}"
EMULATOR_PORT="${EMULATOR_PORT:-5554}"
EMULATOR_DEVICE="emulator-${EMULATOR_PORT}"
EMULATOR_BIN="$HOME/Library/Android/sdk/emulator/emulator"
PREPARED_VIDEO="$PROJECT_ROOT/video/.prepared_camera.mp4"

# ── Checks ────────────────────────────────────────────────────────────────────
if [[ -z "$VIDEO_INPUT" ]]; then
  echo "ERROR: no video given. Usage: $0 <video_file>  (or set CAMERA_VIDEO)"
  exit 1
fi

if [[ ! -f "$VIDEO_INPUT" ]]; then
  echo "ERROR: Video not found: $VIDEO_INPUT"
  exit 1
fi

if ! command -v ffmpeg &>/dev/null; then
  echo "ERROR: ffmpeg not found. Install with: brew install ffmpeg"
  exit 1
fi

if [[ ! -f "$EMULATOR_BIN" ]]; then
  echo "ERROR: Android emulator not found at $EMULATOR_BIN"
  exit 1
fi

# ── Step 1: Prepare video ─────────────────────────────────────────────────────
# The source video is recorded portrait but stored as 1280x720 with a 90°
# Display Matrix rotation flag. ffmpeg auto-applies the rotation by default,
# giving portrait pixels (720x1280). We strip the rotate metadata so the
# camera HAL doesn't double-rotate it, and ensure h264/yuv420p at 30fps.
echo "▶ Preparing video for emulator camera..."
ffmpeg -y \
  -i "$VIDEO_INPUT" \
  -vf "scale=480:640" \
  -c:v libx264 \
  -pix_fmt yuv420p \
  -r 30 \
  -an \
  -metadata:s:v:0 rotate=0 \
  "$PREPARED_VIDEO" 2>/dev/null
echo "  Prepared: $PREPARED_VIDEO"
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height -of csv=p=0 "$PREPARED_VIDEO" 2>/dev/null \
  | awk -F, '{printf "  Dimensions: %sx%s\n", $1, $2}'

# ── Step 2: Start emulator with videofile camera ──────────────────────────────
# Use -camera-front "videofile:<path>" to point the FRONT camera at the prepared
# video (most camera-driven app screens use the front camera).
# Always restart to ensure the correct camera flag is active — an emulator
# launched via Android Studio won't have the videofile camera configured.
if adb devices 2>/dev/null | grep -q "$EMULATOR_DEVICE"; then
  echo "▶ Stopping existing emulator $EMULATOR_DEVICE..."
  adb -s "$EMULATOR_DEVICE" emu kill 2>/dev/null || true
  sleep 3
fi

echo "▶ Starting emulator $AVD_NAME with camera-front videofile..."
"$EMULATOR_BIN" \
  -avd "$AVD_NAME" \
  -port "$EMULATOR_PORT" \
  -camera-front "videofile:$PREPARED_VIDEO" \
  -memory 6144 \
  -no-snapshot-load \
  -no-boot-anim \
  -no-audio \
  > /tmp/emulator_${AVD_NAME}.log 2>&1 &
EMULATOR_PID=$!
echo "  Emulator PID: $EMULATOR_PID (log: /tmp/emulator_${AVD_NAME}.log)"

echo -n "  Waiting for device to come online"
adb -s "$EMULATOR_DEVICE" wait-for-device
echo -n "."

echo -n "  Waiting for boot to complete"
until adb -s "$EMULATOR_DEVICE" shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; do
  sleep 3
  echo -n "."
done
echo " done."

echo ""
echo "✓ Virtual camera is ready!"
echo ""
echo "  Emulator : $EMULATOR_DEVICE"
echo "  Video    : $PREPARED_VIDEO (looping, portrait 480x640, read from host)"
echo "  App ID   : ${APP_ID:-<set APP_ID>}"
echo ""
if [[ -n "${CAMERA_TEST_FLOW:-}" ]]; then
  echo "  Run the camera flow:"
  echo "    maestro --device $EMULATOR_DEVICE test $CAMERA_TEST_FLOW"
  echo ""
fi
echo "  Stop with: ./scripts/stop-virtual-camera.sh"
