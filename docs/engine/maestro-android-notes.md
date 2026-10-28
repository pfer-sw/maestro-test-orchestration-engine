# Maestro / Android engine notes

Generic device and tooling facts that hold for any Android app driven by this engine. Each one
cost real time in a run; read this before driving a device. App-specific facts (package ids,
login, navigation, known ids) belong in [`../app/android-automation-notes.md`](../app/android-automation-notes.md).

## launchApp and permissions
- By default `launchApp` **grants every declared permission**. A flow that asserts a permission
  dialog must not start with it — or pass `permissions: { all: deny }`.
- "Package undefined is not installed" means `APP_ID` never reached Maestro. In zsh an unquoted
  `$VARS` string is not word-split, so pass each `-e KEY=value` as its own argument.
- To make a runtime permission dialog appear again, revoke it **and** clear its flags (revoke alone
  leaves `USER_SET`, i.e. "denied once"):
  `adb -s <deviceId> shell pm revoke <package> <permission>` then
  `adb -s <deviceId> shell pm clear-permission-flags <package> <permission> user-set user-fixed`.
  **`pm revoke` kills the app.** Cold-start it with `adb shell am start -n <package>/<activity>`, not
  `launchApp` (which re-grants every permission and hides the dialog).
- Avoid `clearState` on builds whose endpoint or debug settings live in app storage — it wipes them.
  Prefer a fresh account to reset member state.

## Text entry
- **Clearing a field:** `tapOn` lands mid-text and `eraseText` deletes only before the cursor, so one
  pass leaves the tail. Repeat `tapOn` + `eraseText: 120` three times.
- **Do not enable Maestro's IME** (`dev.mobile.maestro/.input.MaestroInputMethodService`). It
  renders a full-screen blank view that `hideKeyboard` does not dismiss.
- **Gboard auto-correct rewrites input** (e.g. `autorelease` → `auto release`). Both Maestro
  `inputText` and `adb shell input text` go through the IME. Durable fix: turn auto-correct off
  on the test device.
- Fallback typing: `adb -s <dev> shell "input text 'word%sword'"` — spaces must be `%s`
  (host-side quoting does not survive to the device shell).
- `adb shell input text` is **asynchronous for long strings** — screenshot and confirm the whole
  text is in the field before tapping send.
- Repair a mangled word: `input keyevent 21` (DPAD_LEFT) × N, then `input keyevent 67` (DEL).
- Some OEM secure keyboards make screenshots of password fields **black** — not a bug; inspect the
  hierarchy instead.
- **Never press `back` blindly to dismiss the keyboard.** If the keyboard is already closed and the
  screen is the app's root, `back` exits the app. Check first:
  `adb shell dumpsys input_method | grep mInputShown=true`.

## Maestro MCP / driver
- **Version: Maestro CLI + MCP 2.12.0** (validated 2026-10-28; changelog:
  https://github.com/mobile-dev-inc/Maestro/blob/main/CHANGELOG.md). The MCP is the same binary started
  as `maestro mcp`, so one upgrade covers both. Upgrade with the official installer
  (`curl -Ls "https://get.maestro.mobile.dev" | bash`), then restart the MCP servers — they keep the old
  jars loaded: `pkill -f "maestro.cli.AppKt mcp"`; each session reconnects on its next call. Then run
  `maestro check-syntax <flow>` over `flows/` and fix what it rejects. The Viewer port can change.
- What 2.11–2.12 changed: invalid `index`/`point`/scroll `speed` now fail the step (speed must be 0–100);
  `start`/`end` inside a selector is rejected; `optional: true` is honoured on `setAirplaneMode`/`setDarkMode`
  (values `enabled`/`disabled` only); Android tap/type wait out window animations (fixes "Device server died"
  on slow splash handoffs); `pressKey: Tab` fixed; crashes are detected and reported (Android native, iOS by
  process exit); `assertScreenshot` diffs go into the run's artifacts.
- `maestro check-syntax` catches commands Maestro never had — e.g. `clearText` (use `eraseText: <n>`) and
  `assertVisible` with `timeout:` (use `extendedWaitUntil: { visible: …, timeout: … }`). Run it on every
  generated flow before trusting it.
- The MCP tools are `list_devices`, `inspect_screen`, `take_screenshot`, `run` (also validates the
  YAML), plus `cheat_sheet`. Every call needs the `device_id` from `list_devices`.
- **The MCP does not survive an overnight/weekend gap** and can hold a dead gRPC connection
  (`UNAVAILABLE`). Restart it at the start of each session; meanwhile use
  `~/.maestro/bin/maestro --device <id> test <flow>` and plain `adb`.
- `uiautomator dump` is empty while the Maestro driver is attached → use `maestro hierarchy`
  (or `scripts/release-tools/screen.sh`).
- **Keep `waitForAnimationToEnd` short** (e.g. `timeout: 7500`): long waits stall live sessions. To
  wait for async content, poll with `extendedWaitUntil` on the expected text instead.
- Do not wait on transient indicators (typing dots, spinners, "thinking" rows) — they disappear
  before the condition can match. Wait on the content that replaces them.
- Scroll long lists with repeated `swipe` (start/end percentages); `scroll` with `direction:` is
  invalid. Screenshot after each swipe and stop when the content no longer moves.
- `maestro hierarchy` sometimes returns nothing mid-run; in scripts, a fixed wait followed by one
  capture is more reliable than tight hierarchy polling.

## Tooling gotchas
- **Maestro MCP and the CLI clash.** Scripts that call `maestro hierarchy` / `maestro test`
  (`screen.sh`, `say.sh`) can kill the MCP's `run` with `UNAVAILABLE` ("Device server died during
  deviceInfo"). In a scripted run use the CLI throughout. (2.12 fixed a different "Device server died" cause —
  slow splash-screen handoffs.)
- **`takeScreenshot:` fails on a path with spaces** (still on 2.12.0). Capture with `screen.sh` / `adb exec-out
  screencap` between Maestro calls instead.
- Python helpers in `scripts/release-tools/` (`frames.py`, report generation) need **Pillow** in the
  active venv: `python3 -m pip install pillow`.
- `setAirplaneMode: enabled|disabled` works on physical devices and the USB driver link survives it.
- **`calculate-coverage.js` rewrites taxonomy from every XML in `reports/raw/`.** A stale
  `results.xml` can flip unrelated flows and wipe documented BLOCKED reasons. Run it only right
  after the orchestrator produced fresh results; for hand edits use `recomputeSummary` from
  `scripts/lib/coverage-tracker.js`.

## Network traffic (use on every run)
A debug build that logs HTTP to logcat (e.g. an OkHttp logging interceptor) shows request line,
headers, JSON body, status and timing. That tells an app-side gap (request never sent) apart from a
backend one. **Requires a debug build that logs HTTP** — on a release build `net.sh` sees nothing.
- The logcat tag comes from env `NET_LOG_TAG` (default `okhttp.OkHttpClient`). Set it if your app
  logs under another tag.
- `scripts/release-tools/net.sh start <run>` at the start of a run, `net.sh stop <run>` at the end.
  The logcat ring buffer keeps only ~1 MiB (minutes of traffic), so stream long runs to disk.
- `net.sh calls [HH:MM:SS]`: request/response summary since a time. Run it right after any action
  whose backend effect matters (leaving a player, submitting a form, sending a message).
- `net.sh grep <regex>`: full lines (headers + bodies) for one endpoint.
- **Logs contain `Authorization` headers and cookies.** `net.sh` redacts them; never save raw
  `adb logcat` output.
- Which backend is the build pointing at? Trigger any request and read the host:
  `grep -oE -- '--> [A-Z]+ https://[^/ ]+' <net.log> | sort | uniq -c`.
- Cite the request lines (method, path, status, time) as evidence in findings and reports.

## Evidence capture
- `take_screenshot` returns the image inline only. Save every capture with
  `adb -s <dev> exec-out screencap -p > screenshots/test_runs/<date>/<label>.png`
  (or `scripts/release-tools/screen.sh <label>`, which also saves the hierarchy).
- Notification history is good evidence (reminders, pushes):
  `adb shell dumpsys notification --noredact`.
- Build of record: `adb shell dumpsys package <package> | grep version` (`versionName` + `versionCode`).

## Related
- App-specific notes: [`../app/android-automation-notes.md`](../app/android-automation-notes.md)
- iOS simulator: [`ios-simulator-notes.md`](ios-simulator-notes.md)
- Web back-office tools (Claude in Chrome, Maestro web): [`web-back-office.md`](web-back-office.md)
- Camera injection on the emulator: [`camera-injection.md`](camera-injection.md)
- Missing ids: [`../testability/missing-resource-ids.md`](../testability/missing-resource-ids.md)
