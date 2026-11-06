# iOS simulator engine notes

Generic facts for driving an app on an Xcode simulator with Maestro. App-specific facts (bundle id,
id differences from Android, interstitials) belong in [`../app/ios-automation-notes.md`](../app/ios-automation-notes.md).

## Prerequisites — read before promising iOS coverage
- **Simulators only, no physical iPhones.** Maestro drives iOS through an Xcode simulator (booted
  from Xcode / `xcrun simctl`, or launched by Maestro itself). Needs macOS + Xcode with a simulator
  runtime installed.
- **The build must be a simulator build.** A device `.ipa` (App Store / TestFlight / ad-hoc, arm64
  device slice, signed) **will not install** on a simulator. Ask the app team for a build made for
  the `iphonesimulator` SDK — a `.app` bundle (often shipped zipped, e.g. from CI as
  `<App>-simulator.zip`), e.g.
  `xcodebuild -scheme <Scheme> -sdk iphonesimulator -configuration Debug -derivedDataPath build`.
  Apple-silicon Macs need the `arm64` simulator slice; Intel Macs `x86_64`.
- Check a build before a run: `file <App>.app/<Binary>` / `lipo -info` should list the simulator
  architecture, and `Info.plist` → `DTPlatformName` must be `iphonesimulator`.
- No simulator build available → iOS is **BLOCKED** for the run (non-negotiable 6), not failed.
  Record it in the report and `docs/TODO.md`.

## Devices
- Maestro MCP `list_devices` shows every Xcode simulator; only the booted one is `connected: true`.
  Use that `device_id`.
- Booted simulator: `xcrun simctl list devices booted`. Boot one: `xcrun simctl boot <udid>`, then
  `open -a Simulator`.

## App facts from the command line
- Bundle id: `xcrun simctl listapps <udid> | grep -i <name>`.
- Version / build of record:
  ```bash
  APP=$(xcrun simctl get_app_container <udid> <bundleId>)
  /usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' -c 'Print CFBundleVersion' "$APP/Info.plist"
  ```
- Install a build: `xcrun simctl install <udid> <path>.app`. Uninstall: `xcrun simctl uninstall <udid> <bundleId>`.
- App log: `xcrun simctl spawn <udid> log show --last 2m --style compact --predicate 'process == "<ProcessName>"'`.
- Push a file into the Files app ("On My iPhone"):
  ```bash
  LS=$(xcrun simctl get_app_container <udid> com.apple.DocumentsApp groups | awk '/FileProvider.LocalStorage/{print $2}')
  mkdir -p "$LS/File Provider Storage/<folder>" && cp <files> "$LS/File Provider Storage/<folder>/"
  ```

## Maestro on iOS
- `launchApp`, `stopApp`, `inputText`, `eraseText`, `hideKeyboard`, `scrollUntilVisible` all work.
  `launchApp` with `permissions:` can pre-set system permission dialogs.
- No adb: save screenshots with `xcrun simctl io <udid> screenshot <file>.png`.
- `inspect_screen` right after a transition can return a nearly empty tree. Wait
  (`waitForAnimationToEnd`) and inspect again before deciding an element has no id.
- **Hierarchy keys:** iOS `accessibilityIdentifier` shows as `rid`, accessibility label as `a11y`.
  Target them with `id:` and `text:` exactly as on Android.
- Elements in a document picker / file provider are addressed by id `"<name>, <kind>"` (e.g.
  `"MyFolder, Folder"`, `"clip, mp4"`); a text tap on a folder does not open it.
- System sheets (e.g. "Save Password?") use iOS copy: `"Not Now"` (capital N), `"Don’t Allow"` with a
  curly apostrophe.
- **Skeleton / shimmer placeholders** can carry placeholder content in the accessibility tree that
  is not visible on screen. Never assert on a screen before its real content is visible.
- Multiplatform flows: prefer ids shared by both platforms; where they differ, keep per-platform
  subflows rather than coordinates.
- **Inspect via the CLI on iOS.** The Maestro MCP's `inspect_screen` can open a Maestro Viewer window on every call. Use
  `maestro --device <udid> hierarchy` (≈15 s per dump) and `maestro --device <udid> test <flow>.yaml` instead, and
  `xcrun simctl io <udid> screenshot` for captures.
- **Start every standalone flow with `launchApp`.** Between separate `test` runs the app can drop to the home screen.
- **Pre-filled text fields:** `eraseText` only deletes *before* the cursor, and `tapOn` puts the cursor where it lands
  (often mid-text) — the old value's tail survives. Clear with `repeat` ×3 of `tapOn` + `eraseText` (same as Android).
- **Number pad keyboards** have no Done/return key: `hideKeyboard` fails. Tap an empty area of the screen (not a label) to
  close it. While the keypad is up, a `tapOn` aimed at a button it covers types a digit instead.
- **`retryTapIfNoChange` (default on) taps twice when the hierarchy doesn't change** — toggles (pause/resume, play)
  flip back. Use `retryTapIfNoChange: false` on toggles.
- **Overlays that close themselves within a second or two** can't be read with a separate hierarchy dump. Act on them in
  the same flow (tap, then tap the option right after), or hand the step to the tester.
- **Modals queued for launch** (celebrations, promo sheets) may show on the *next* cold start rather than inline, and
  two modals can race — relaunch before asserting one, and log which one won.
- **StoreKit review prompt ("Enjoying <App>?")** on the simulator: its buttons don't respond (to Maestro or a click).
  Kill and relaunch the app.
- **Document picker taps are flaky** (a tap on `"<file>, <kind>"` can report success without selecting). Check the
  screen after the tap; retry once, then ask the tester to pick.
- **SpringBoard crash:** SpringBoard and the app can crash together inside `XCTAutomationSupport` (Maestro's XCUITest
  layer; `~/Library/Logs/DiagnosticReports/SpringBoard-*.ips`). Not an app bug — `xcrun simctl shutdown <udid>` /
  `boot <udid>` and relaunch.
- **Video capture:** `xcrun simctl io <udid> recordVideo --codec h264 --force <file>.mp4` (stop with
  `pkill -INT -f recordVideo`), then `ffmpeg -i <file>.mp4 -vf fps=10 frame_%04d.png` for frames. **Simulator timings are
  not reliable** for sub-second requirements — measure those on a device.
- **No push on the simulator:** a dev build on the simulator gets no APNs push. Verify push / reminder behaviour on a
  physical device.
- **The keyboard stays up after a chat send** — `hideKeyboard` before screenshots.
- **Physical iPhones:** Maestro 2.11+ stops listing them and fails a run early with "Physical iOS devices
  are not yet supported". The only Maestro-YAML route to real iPhones is maestro-runner — see ED-003.
