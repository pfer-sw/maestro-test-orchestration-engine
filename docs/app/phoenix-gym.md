# Phoenix Gym (team-clinical) — how Claude drives it

> **Parked (2026-11-18):** the tester chose to test Phoenix only through the Android app. Keep this
> page for reference; results and the report now live in `reports/app_runs/` (`npm run app-report`),
> see [android-automation-notes.md](android-automation-notes.md).

Web tool that simulates Phoenix (Monalisa) turns against a member state. Used for the Pulse
onboarding v2 matrix (`config/matrices/pulse-onboarding-v2.json`, cases with `testMode: gym`).

- **URL:** https://team-clinical-phoenix-gym.staging.swordhealth.com/ — **VPN required** (off VPN:
  `403 RBAC: access denied`). Login form (username/password) — the tester signs in once in the
  Maestro automation window; the session survives across MCP `run` calls. Never close that window.
- **API (route B, not reachable yet):** the Streamlit server calls
  `http://team-clinical-ai-services.ai.svc.cluster.local.` (`phoenix-gym/k8s/pipeline/environments/team-clinical.json`)
  — in-cluster only, no DNS over VPN, and `/ai-services/monalisa/*` is not routed on
  `team-clinical-api.staging.swordhealth.com` (404). Needs kubectl access or an ingress route.
- **Driving it with Maestro web (`device_id: chromium`):** it is a Streamlit app.
  - Wait for load with `extendedWaitUntil: notVisible: id: "Running..."`.
  - `scrollUntilVisible` does not scroll it; use `swipe` (20%→90% = up, 85%→35% = down).
  - Select boxes: tap `id: "Selected <value>. <label>"` (e.g. `Selected Thrive. Unit`), then tap the option text.
  - No `Escape` key on web; close a dropdown by tapping its current option.
  - Read results with `inspect_screen`, not the screenshot: the Conversation column is narrow, but the
    hierarchy holds the full tool-call JSON (name, arguments, **reasoning**) and tool results.
- **Setup for onboarding v2:** Unit = Pulse; untick **Hide tool calls & results**; profile
  **Carolyn Onboarding V2** (`phoenix-gym/simulation/resources/patient_profiles/pulse/carolyn_onboarding_v2.json`:
  prediabetes, movement+nutrition+steps+biometric, intro activity pending, a 30-min HS escalation
  reminder). Pulse presets are GLP-1 only. Event **Start onboarding** = `first_time_member_entered_chat`.
- **The UI does not show the selected agent** (`specialized_agent_name`); infer it from the protocol
  named in the reasoning, or wait for API access.
- **Intro activity card:** v2 `onboarding.md:136` uses `suggested_task="pulse_session"`
  (`pulse_intro_activity` does not exist in ai-services).
- **Results:** one record per case run in `reports/app_runs/<YYYY-MM-DD>/<caseId>.json` (+ screenshots
  named in its `screenshots[]`, saved next to it). `npm run app-report` renders
  `reports/app_runs/report_pulse-onboarding-v2.html` — latest result per case, summary tiles, matrix
  issues, base64 screenshots. Record schema: header of `scripts/gym-run-report.js`.

## Scoring against the prompt — pull first
Before scoring any case against ai-services, run `git -C ~/sword-ai/ai-services pull` (read-only use)
and note the commit in the run record. On 2026-11-18, B-03 was wrongly scored FAIL against a 2026-11-02
clone: the plan table had changed on 2026-11-10 (8b6bd16, SW20-46966; bucket B 4,000 + 2 → 4,000 + 3).
The wiki matrix can lag behind the prompt too. When Phoenix contradicts the matrix, check the prompt's
git log before calling it a defect.
