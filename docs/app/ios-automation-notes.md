# iOS automation notes — your app (template)

iOS counterpart of [`android-automation-notes.md`](android-automation-notes.md). Generic simulator
knowledge (simctl, PlistBuddy, hierarchy keys) lives in
[`../engine/ios-simulator-notes.md`](../engine/ios-simulator-notes.md). Lines marked
*(example — replace)* are deleted by the `bootstrap` workflow.

## The app (bundle id, build of record)
Bundle id per flavor/env, how to read version/build, and **where the simulator build comes from**
(CI artefact, team channel, local `xcodebuild` — a device `.ipa` won't install; see the engine notes'
Prerequisites).
- *(example — replace)* Simulator build: CI job `ios-simulator-debug` → `ExampleNotes-simulator.zip`.
- *(example — replace)* `com.example.notes` — `PlistBuddy` on the app container's `Info.plist`.

## Same ids as Android
Ids that match Android, so flows port as-is apart from `appId`.
- *(example — replace)* `email_input`, `password_input`, `login_button`, `assistant_input`.

## Different from Android
| Area | Android | iOS |
|---|---|---|
| *(example — replace)* Bottom nav | `tab_home`, `tab_notes`, `tab_settings` | `tab_bar_home`, `tab_bar_notes`, `tab_bar_settings` |

## Post-login interstitials (iOS order)
Every system sheet and app popup after login, in order, with how to dismiss it.
- *(example — replace)* 1. "Save Password?" → `tapOn: "Not Now"`. 2. Notifications → `tapOn: "Allow"`.
