# Account provisioning — how this unit creates test accounts

Every run needs accounts in a known state. This file documents **how your unit creates them** —
a provisioning tool or MCP server, an internal API, a seed script, or a manual sign-up — so Claude
can create a fresh account without being walked through it.

## Rules (all units)
- **Record every account in `config/accounts.json`** — `id`, `email`, `flavor[]`, `tags[]`; the
  environment and member state go in `traits` (e.g. `"environment": "dev"`,
  `"onboardingComplete": true`) so `accountRequirements` can match them; how it was provisioned
  (tool, date, anything assigned differently) goes in `notes` — with
  `passwordEnvVar: "ACCOUNT_<ID_UPPERCASE>_PASS"` (e.g. `example.member` → `ACCOUNT_EXAMPLE_MEMBER_PASS`).
- **Passwords never go in the repo.** Claude cannot read or write `.env` / `.env.example`; after
  adding an account, ask the tester to add the key to `.env` (with the value) and to
  `.env.example` (empty). Never write a password anywhere else (docs, flows, reports, memory),
  except where `CLAUDE.md` explicitly allows it.
- **Fresh accounts, not resets.** Prefer creating a new account over `clearState` or reusing one
  whose state is unknown. Never reuse an email; bump a numeric suffix.
- **Record what you got, not what you asked for.** If the tool assigns different attributes than
  requested, record the actual values in `config/accounts.json` and in the report.
- **A failed or rejected create can still consume the identifier.** Registration often happens before the step that
  fails (and a call cancelled mid-way may have run on the tool's side), so the retry hits "email in use". After the
  **first** precondition failure, stop and ask the tester — the cause is usually the environment's configuration — instead
  of cycling inputs and burning identifiers. Record consumed identifiers as burners.
- **Shared sandboxes drift.** An account whose features look wrong on a shared environment is most
  likely a configuration change, not an app bug — log it as NEEDS INPUT and tell the tester.

## Back-office logins (optional)
If a journey needs a web back-office tool (clinician / agent / admin portal) and its **test** logins are
not secret internally, list them here so Claude can log in as the right user with Claude in Chrome
([`../engine/web-back-office.md`](../engine/web-back-office.md)). Test environments only — never
production. Record which back-office user an account landed on (it may differ from what was requested).

| Environment | User (id) | Login | Password |
|---|---|---|---|
| *(example — replace)* staging | Example Agent (1) | `example.agent` | `<test password>` |

## Your method
Replace this section with your unit's procedure. Cover:

| Topic | What to write |
|---|---|
| Tool | Name and type (MCP server, API, script, manual), where it runs, one-time setup (never tokens or passwords) |
| Environments | Which environments it can target and how to choose one |
| Arguments | The arguments Claude must always pass, with defaults per account type |
| Verification | The flow or screen that proves the account is in the expected state |
| Gotchas | Known failures and their workaround, dated |

*(example — replace)* Example Notes: accounts are created with a sign-up flow on the dev build —
`flows/baseline/auth/` contains the login flows; a new member `qa+example.member@example.com`
(next ones: `qa+example.member2@example.com`, …) signs up through the app, then is added to
`config/accounts.json` as `example.member` with `passwordEnvVar: "ACCOUNT_EXAMPLE_MEMBER_PASS"`. Proof: `home_screen` visible after login.
