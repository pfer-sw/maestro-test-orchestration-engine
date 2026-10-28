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
- **Physical iPhones:** Maestro 2.11+ stops listing them and fails a run early with "Physical iOS devices
  are not yet supported". The only Maestro-YAML route to real iPhones is maestro-runner — see ED-003.
