# Android automation notes — your app (template)

The **app layer**: facts about *this* app that Claude needs before driving it. Generic Maestro /
Android / MCP knowledge (text entry, driver quirks, network capture, evidence) lives in
[`../engine/maestro-android-notes.md`](../engine/maestro-android-notes.md) — don't repeat it here.

Each section has a one-line instruction and one example line for the fictional **Example Notes**
app. Lines marked *(example — replace)* are deleted by the `bootstrap` workflow; replace them with
your own facts. Date every fact you learn in a run ("seen <build>, <date>").

## The app (package ids per flavor/env, build of record)
List the package id for every flavor and environment, the main activity, and how to read the build.
- *(example — replace)* Flavor `main`: `com.example.notes` (dev and staging builds share it); main
  activity `com.example.notes.MainActivity`; build of record via `adb shell dumpsys package com.example.notes | grep version`.

## Login & accounts
Describe the login steps with their ids, and which account types the flows need (metadata in `config/accounts.json`).
- *(example — replace)* One-step login: `email_input` → `password_input` → `login_button`; lands on
  `home_screen`. Default account: `example.member`.

## Navigation map
List the root screens and how to reach each (tab ids, deep links, menu paths).
- *(example — replace)* Bottom tabs `tab_home`, `tab_notes`, `tab_settings`; the assistant opens
  from Home (`assistant_input`, `assistant_send_button`, reply in `assistant_response`).

## Known ids and quirks
Ids that are not obvious, ids that changed between builds, elements with text-only locators, and behaviour that trips flows.
- *(example — replace)* `assistant_response` is reused for every reply — use `index:` for the latest;
  wait on the reply text with `extendedWaitUntil`, not on the typing indicator.

## Environments
How a build is pointed at an environment, how to tell which one it is using, and what differs between them.
- *(example — replace)* Dev builds hit `api.dev.example.com`; check the host with `net.sh` (see engine notes).

## Interstitials / modals
Every popup that can appear after launch or login, in order, with how to dismiss it.
- *(example — replace)* First login shows the system notification dialog, then (sometimes) a
  post-login tour skipped with `onboarding_skip_button`, then a "What's new" sheet dismissed with
  `text: "Got it"` (no id — in the testability register).

## Related
- iOS counterpart: [`ios-automation-notes.md`](ios-automation-notes.md)
- Missing ids: [`../testability/missing-resource-ids.md`](../testability/missing-resource-ids.md)
