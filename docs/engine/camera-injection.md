# Emulator camera injection (`videofile`)

Some screens need a live camera feed (pose tracking, scanning, video capture). On an Android
emulator, a pre-recorded video can be injected as the camera source with the emulator's built-in
**`videofile`** camera mode — it reads a video straight from the host filesystem. No OBS, no
virtual camera driver, no sdcard push, no runtime console commands.

```
source.mp4  →  ffmpeg (bake rotation into pixels, strip rotation flag, h264/yuv420p 30 fps)
    → host file (prepared video)
        → emulator -camera-front "videofile:<path>"   (or -camera-back)
            → the app's camera sees the recorded scene, looping
```

## Prerequisites
| Tool | Check |
|---|---|
| Android Emulator ≥ 30.0 | `emulator -version` |
| ffmpeg / ffprobe | `ffmpeg -version` |
| An AVD (camera set to Emulated) | `emulator -list-avds` |
| The app installed on the emulator | `adb -s emulator-<port> shell pm list packages` |

## Scripts
- `scripts/start-virtual-camera.sh [<video>]` — prepares the video, (re)starts the emulator with the
  `videofile` camera flag and waits for boot.
- `scripts/stop-virtual-camera.sh` — kills that emulator. Nothing to restore: the mode is a CLI flag,
  the AVD `config.ini` is never modified.

Arguments, defaults and the environment variables they read (AVD name, port, video path, which
camera) are documented in **the header of each script** — read it rather than relying on this page.

## What the start script does
1. **Prepares the video** with ffmpeg: applies any rotation flag to the pixels (phones store portrait
   video as landscape + a rotation flag), strips the rotation metadata so the camera HAL does not
   rotate twice, re-encodes h264/yuv420p at 30 fps, drops audio.
2. **Stops any running instance** of that emulator — one launched from Android Studio does not have
   the camera flag and must be restarted.
3. **Starts the emulator** with `-camera-front "videofile:<host path>"` (or `-camera-back`). The
   video loops for as long as the camera is open.

## Why `videofile` and not `videoplayback`
`videoplayback` is the documented mode, but it needs the source set at runtime via
`adb emu camera videoplayback set <path>`, a console command missing from recent emulator builds.
`videofile:<path>` is undocumented in `-help` but present in the binary and works.

## Troubleshooting
- **Nothing detected in the feed:** check the prepared video's orientation and size
  (`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 <prepared>`).
  Delete the prepared file and re-run the start script.
- **The app waits forever for the subject:** the subject must be fully in frame, at a sensible
  distance, within the first seconds of the clip.
- **Grey/black camera:** the app lacks camera permission —
  `adb -s emulator-<port> shell pm grant <package> android.permission.CAMERA`, or let a permission
  flow grant it.
- **Timeouts:** make sure the clip (it loops) covers the activity; raise the flow's wait timeouts.

## When to use it
Only where the camera is the gate. If a screen has a locatable skip control, skipping is cheaper —
but skipped activities produce no real data, so flows reached via skip assert structure only.
