# Android automation notes — SWORD Health member app (Pulse 3-way chat)

The **app layer**: facts about *this* app that Claude needs before driving it. Generic Maestro /
Android / MCP knowledge (text entry, driver quirks, network capture, evidence) lives in
[`../engine/maestro-android-notes.md`](../engine/maestro-android-notes.md) — don't repeat it here.
Date every fact you learn in a run ("seen <build>, <date>").

## The app (package ids per flavor/env, build of record)
- Dev build: `com.swordhealth.guarda.dev`. Seen 8.7.0 (versionCode 8243), targetSdk 36, minSdk 26
  (2026-11-10). The APK is universal (arm64, armeabi-v7a, x86, x86_64), so it installs on the x86_64
  emulator.
- Build of record: `adb shell dumpsys package com.swordhealth.guarda.dev | grep -E "versionName|versionCode"`.
- The tester drops dev APKs in `~/Downloads/androidAPKforOnboarding/`. Install with
  `adb install -r -g "<apk>"` (`-g` grants runtime permissions).
- Cold start shows a **blank beige screen for about 10 s** before the login screen. That is
  loading, not a hang. Wait for `id: "loginEmailTextfield"`, not for animations to end.

## Emulator (this machine, Linux)
- AVD `Pixel_8_API_35` (Android 15, Google Play image, x86_64, KVM). Created 2026-11-10.
- Start it **detached** or it dies when the launching shell exits:
  `(setsid nohup ~/Android/Sdk/emulator/emulator -avd Pixel_8_API_35 -no-snapshot-save -no-boot-anim > <log> 2>&1 < /dev/null &)`.
- A force-killed emulator lost the installed app (2026-11-10). Shut it down gracefully
  (close the window, or `adb emu kill`) and reinstall the APK if `pm list packages -3` is empty.
- **GPU mode:** with `-gpu auto` the emulator once crashed silently (no shutdown lines in the log, only
  gfxstream `glFramebufferRenderbuffer` / h264 "no frame!" spam) while the kit and workout videos played
  (2026-11-10). `-gpu swiftshader_indirect` avoided the crash, but on 2026-11-18 it made System UI and the
  app hit "isn't responding" on the video welcome screen. **Use `-gpu host` with `hw.cpu.ncore=6`**
  (AVD `config.ini`): a full 3-account run passed with it on 2026-11-18. Video decoding stays in software,
  so the emulator still runs at about 600 % CPU on video screens. Tap `Wait` on any ANR dialog
  (`tapOn: {text: "Wait", optional: true}`).
- After restarting the emulator, the Maestro MCP keeps the dead
  connection ("Device server died … UNAVAILABLE"). Restart it with `pkill -f "maestro.cli.AppKt mcp"`; the
  next MCP call reconnects.
- Use **one** adb: `~/Android/Sdk/platform-tools/adb`. A second adb server (`/usr/bin/adb`)
  makes Maestro report the device as "offline".

## Login & accounts
Email-first login (Compose; the ids are test tags). Verified on 8.7.0, 2026-11-10:
- `loginEmailTextfield` → `continueButton` → `loginPasswordTextfield` (focused on arrival, so
  `inputText` directly; `show_password_button` toggles visibility) → `hideKeyboard` → `loginButton`.
- After login: **Create PIN code** screen. Skip it with `tapOn: "Not now"` (no id).
- A Pulse member who hasn't started onboarding then lands on `ai.chat.ui.monalisa.MonaLisaActivity`:
  a full-screen video with "Welcome, <name>", benefit copy and a **"Build my plan"** button. That
  is the start of onboarding v2. Tapping it uses up the account's first-entry state.
- Also on the screen: `loginRecoverPasswordButton` ("Forgot password?"), `loginSignupButton` ("Sign up").
- Activity: `com.swordhealth.guarda.login.ui.LoginActivity`.
- Test accounts: not yet provisioned for team-clinical. See
  [`../workflows/account-provisioning.md`](../workflows/account-provisioning.md).

## Navigation map
**Pulse onboarding v2 (first login), seen 8.7.0 on 2026-11-10.** Everything happens in `MonaLisaActivity`;
container id `three_way_chat_onboarding_screen`, with step title/description ids
`three_way_chat_onboarding_step_title` / `_step_description`.
1. "Welcome, <name>" video → `tapOn: "Build my plan"`.
2. Four info slides (Protect your muscles / Eat better, no rules / Track real progress / And everything else
   too) → `tapOn: "Continue"` each.
3. Swipe cards "Let's personalize your plan". Swipe the deck `id: three_way_chat_onboarding_swipe_deck`
   RIGHT = ✓, LEFT = ✗; the buttons have no ids. The deck **adapts**: after an answer it may skip cards.
   Seen sequence: Movement "I can move around today without pain…" → "I'm on my feet for most of the day"
   → "I'm up and about here and there" → Nutrition "Evenings… dinner" → "Mornings… breakfast" → (no
   snacking card after ✗✗) → Check-in timing "Mornings are when I'm most on top of things" → Getting
   started "I know what I should be doing — I just can't find the time" → "All set!" → `Continue`.
   "Undo" (text only) reverts a card.
4. "Unlock your pulse kit" (the intro activity): `Let's go!` starts it; `Skip for now` = not activated.
5. "Your program is ready!" → `Continue`.
6. "Connect your Wearable" → `Skip for now` (or `Set up`).
7. 3-way chat "Your Care Team · Phoenix, <HS>, You". It opens empty; Phoenix's welcome arrives about 1 s
   later, as several bubbles typed out over ~10–20 s.

**Chat ids:** input `chat_input_text_field` (tap it, then `inputText`), send `chat_send_button` (disabled
until there is text), `chat_mic_button`, `chat_attachment_button`, settings `chat_context_options_menu_settings`,
own messages `chat_message_sent`. Phoenix bubbles have no id (content-desc "Phoenix").
- Waiting for a reply: send, `extendedWaitUntil visible "<own text>"`, then `extendedWaitUntil notVisible
  "<own text>"` with `optional: true` and timeout ~45 s. The reply pushes the own message off-screen, or the
  timeout acts as the wait. Then read all bubbles with `inspect_screen`; text under the pinned banner is
  still in the hierarchy.
- Re-opening the app (`launchApp` with `stopApp: false`) shows "Connecting…" and then the full history. No
  duplicate welcome is sent.

## Known ids and quirks
- Screens are Jetpack Compose. Compose test tags appear as `resource-id` **without** a package prefix
  (e.g. `continueButton`). Target them with `id:` as-is.

## Environments
- Out of the box, 8.7.0 dev talks to **staging**: `api.staging.swordhealth.com` and
  `app-links.staging.swordhealth.com` (seen in `adb logcat`, okhttp logging, 2026-11-10).
- **Switch to team-clinical (QA Menu).** On a phone, shaking it opens the QA Menu. On the emulator a
  simulated shake (`adb emu sensor set acceleration …`) does **nothing** on the login screen: the app
  registers no accelerometer listener there (2026-11-10). Open the menu directly instead:
  ```bash
  adb shell am start -n com.swordhealth.guarda.dev/com.swordhealth.guarda.qa.QAActivity
  ```
  then `tapOn: "Team Clinical Endpoint"` → `tapOn: "Restart"` → wait for `id: "loginEmailTextfield"`.
  Verified: the restarted app then calls `team-clinical-api.staging.swordhealth.com` (8.7.0, 2026-11-10).
- The QA Menu also has the endpoints Staging, Prod, MOCK, Team Engagement, Growth, Therapist and
  Mobile, plus D2C variants. It has a "Show test clients" toggle and tabs General, Multi-Unit,
  Bloom, Move / Pulse, Mind…; the Move / Pulse tab is not yet mapped. Other QA screens:
  `qa.ComponentsActivity` and `qa.monalisa.ChatComponentsActivity`.
- Do not `clearState`: it wipes the chosen endpoint. Re-select it after any reinstall.
- Check which host the app is using: `adb logcat -d --pid=$(adb shell pidof com.swordhealth.guarda.dev) | grep "okhttp.OkHttpClient: -->"`.

## Intro activity / session player (seen 8.7.0, 2026-11-10)
- From onboarding: `Let's go!`. From chat: tap the activity card (`text: "Full Body Strengthener"`), then
  `Start activity`. The app shows "Viewing full screen" (`Got it`) and asks to rotate: `setOrientation:
  LANDSCAPE_LEFT`. Then an intro text screen → `I'm ready` → "Pause your workout anytime" tip (`Got it`;
  it pauses the "Get ready" countdown until dismissed) → ~16 s "Get ready" → 4 exercises × 30 s.
- Full completion: `extendedWaitUntil visible "(Activity completed|How would you rate.*)"` with a 360 s
  timeout. Ends on "How would you rate today's session?". The ✕ has no locator, so rate
  (`text: "Rate 5 out of 5"`) and `Submit`, then `setOrientation: PORTRAIT`.
- Leaving early: Back does nothing in the player. `tapOn text "Show video controls"` then `tapOn "Leave"` **in
  the same flow** (controls auto-hide), then "Finish session?" → `Yes`. Whatever the elapsed time, the app
  then shows **"Activity completed"** with the time so far.
- **Timing for abandon cases (A-05 / D-02 run 1) — not reachable with Maestro on this machine.** The exercise
  timer counts **up** (00:00 → 00:30 per exercise). Each Maestro command takes seconds on the emulator, and
  a `Leave` tap during the "Get ready" countdown is ignored (no "Finish session?" dialog). Two attempts
  (2026-11-10, 2026-11-18) both passed 30 s. Options: the tester does the < 30 s exit by hand on the emulator,
  or use `adb shell input` from a tight shell loop. Do not spend a fresh account on another Maestro attempt.

## Reusable flows (`flows/pulse/onboarding-v2/_subflows/`)
- `login_team_clinical.yaml`: from the QA Menu (after `pm clear` + `am start …QAActivity`) to "Build my
  plan". Env `TEST_USERNAME` / `TEST_PASSWORD`.
- `onboarding_intro.yaml`: "Build my plan" + 4 info slides, up to the readiness card. **The caller swipes the
  readiness card** (RIGHT = clear, LEFT = flagged); a conditional swipe inside a subflow didn't fire.
- `onboarding_swipes.yaml`: the remaining cards (bucket B, nutrition "everywhere", mornings, time), up to
  "Unlock your pulse kit". The caller then taps `Skip for now` or `Let's go!`.
- `skip_to_chat.yaml`: taps Continue / Skip for now until the chat input shows.
- `send_and_wait.yaml`: env `MSG`; sends it and waits ~45 s for Phoenix's multi-bubble reply.
- After `pm clear`, onboarding has an extra **notifications** step ("Stay connected with me and <HS>",
  `Skip for now`), and the chat shows a "Tap to turn on your notifications." banner (close: `text: "Close"`).

## Switching accounts
`adb shell pm clear com.swordhealth.guarda.dev` (this also wipes the endpoint) → open the QA Menu
(`am start -n …/com.swordhealth.guarda.qa.QAActivity`) → `Team Clinical Endpoint` → `Restart` → log in.
Verified three times on 2026-11-10. This is the only clearState this app tolerates, because the endpoint is
re-selected right after.

## Interstitials / modals
- After login: **Create PIN code** → `tapOn: "Not now"`.
- In the chat, once the activity card scrolls off-screen, the app pins a **"Start Session · Complete it in
  4 minutes"** banner under the header (clickable, no id). It covers the top bubble in screenshots.
- **Emulator keyboard:** on the first `inputText`, Gboard may open **"Try out your stylus"** and swallow
  the text. Prevent it with `adb shell settings put secure stylus_handwriting_enabled 0` (done on
  `Pixel_8_API_35`, 2026-11-10); if it appears, `tapOn: "Cancel"`. Do **not** follow it with `hideKeyboard`
  when the keyboard is already closed: it sends Back and exits the app.

## Related
- iOS counterpart: [`ios-automation-notes.md`](ios-automation-notes.md)
- Missing ids: [`../testability/missing-resource-ids.md`](../testability/missing-resource-ids.md)

## Results and scoring
- One record per case in `reports/app_runs/<YYYY-MM-DD>/<caseId>.json`, with screenshots next to it.
  `npm run app-report` builds `reports/app_runs/report_pulse-onboarding-v2.html` (newest date wins).
- Before scoring against Phoenix's prompt, `git -C ~/sword-ai/ai-services pull` (read-only) and note the
  commit. On 2026-11-18 B-03 had been wrongly scored FAIL against a stale clone: the plan table changed on
  2026-11-10 (8b6bd16). When Phoenix contradicts the matrix, check the prompt's git log first.
