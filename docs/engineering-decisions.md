# Engineering Decisions

A running log of architectural / tooling decisions for this framework.
Newest first. Each entry: context, decision, rationale, and revisit conditions.

## Entry template

```markdown
## ED-NNN — <Title> (<YYYY-MM-DD>)

**Context:** what prompted the decision.

**Decision:** what was decided.

**Rationale:** why — options considered and why they lost.

**Revisit if:** the conditions that would reopen it.
```

---

## ED-003 — maestro-runner evaluated, parked (2026-10-28)

**Context:** maestro-runner (https://github.com/devicelab-dev/maestro-runner, Go, Apache-2.0) runs Maestro
YAML without a JVM, claims ~5x speed, and is the only Maestro-YAML route to **physical iPhones** (Maestro 2.11+
refuses them).

**Decision:** not adopted. Worth a trial only as the **Android CLI fallback**.

**Rationale:** it supports every command our flows use, avoids the JVM/gRPC layer behind MCP `UNAVAILABLE`
errors, reads typed text back and retypes it, and lints flows before running. Against it: **no MCP server**
(CLI-only, so the explore/heal loop would need adapting); its default DeviceLab drivers are **closed binaries**
(use `--driver uiautomator2` / `--driver wda`); telemetry is on by default (`DO_NOT_TRACK=1`); some semantics
differ from Maestro (index ordering, long-press duration); one main maintainer. Physical iPhones also need a
device-signed build and an Apple `--team-id`.

**Trial if picked up:** pin it (`npm i -D maestro-runner`), run the baseline suite on the same emulator with
both runners, compare pass parity / time / flakes; adopt as CLI fallback only at ≥95% parity and clearly
faster or steadier. Keep the Maestro MCP for interactive work.

**Revisit if:** real-iPhone testing becomes a requirement, or maestro-runner ships an MCP server.

---

## ED-002 — Claude in Chrome for web back-office tools + project-wide fallback (2026-10-28)

**Context:** journeys often finish in a web back-office tool (a portal that resolves an escalation or
changes an assignment), which was a tester handover. Two spikes: Maestro web (MCP `chromium` device) works,
but every new automation browser needs a manual SSO unlock and a closed window kills the MCP session.
Claude in Chrome drives the tester's own signed-in Chrome — no SSO, no portal login — and reads network
requests.

**Decision:**
1. **Back-office steps → Claude in Chrome.** Claude drives them instead of handing them over
   ([`docs/engine/web-back-office.md`](engine/web-back-office.md)).
2. **Project-wide fallback:** when the normal route — REST API, API key, MCP server — fails or doesn't
   cover the task, use Claude in Chrome on the web UI before handing the step to the tester.

**Rationale:** removes the SSO handover and the window fragility, adds network evidence. Maestro web
stays for when committed, repeatable web flows are required (it still needs a human for SSO).

**Trade-offs:** no committed flows or coverage for these steps; it acts with the tester's identity
(test environments only; confirm before writes outside test accounts); needs the tester's Chrome open.

**Revisit if:** back-office steps must run unattended / in CI (then Maestro web + an SSO bypass for test
users), or the tool gets an API for the actions.

---

## ED-001 — Driver evaluation: Artemis vs. Droidrun vs. Maestro

**Context:** two alternative AI-driven mobile automation frameworks were considered as possible
replacements for / additions to the Maestro-MCP + Claude architecture:

- **Google Artemis** (https://github.com/google/artemis)
- **Droidrun / mobilerun** (https://github.com/droidrun/mobilerun)

**Decision:** **Stay on Maestro** as the core driver. Do not adopt Artemis. Keep
Droidrun as an optional exploration/experiment aid only — not as the regression driver.

### Why the value isn't the driver
The differentiator is the layer *on top* of the driver, not the driver itself:
taxonomy-as-source-of-truth, two-layer AI eval (`maestro_result` + `semantic_result`),
design audit vs. Figma, healing loop, account resolution, and Jira coverage reporting.
Any driver swap risks all of that and gains little.

### Artemis — rejected
| Factor | Assessment |
|--------|------------|
| Platform | **Android-only.** Hard blocker for any "Android first, iOS later" roadmap; Maestro is cross-platform. |
| Overlap | Redundant. It solves the same "NL → UI via MCP driven by Claude" problem Maestro MCP already covers. |
| Migration cost | High. Taxonomy, YAML flows, healing, design audit and CLAUDE.md are all built around Maestro's flow format and tool surface. |
| Artifacts | Weaker. Imperative NL-task model, no declarative reusable/diffable YAML flows — worse for a re-runnable regression suite. |
| Benchmark caveat | Its 99%+ on AndroidWorld measures **autonomous task completion** (an agentic-exploration metric), *not* regression-suite reliability. |
| Possible narrow use | Android-only exploration turbo — could seed screen discovery, then codify results back into Maestro YAML. |

**Verdict:** Cool tech, wrong fit. Trades the iOS future for capability already in place.

### Droidrun / mobilerun — optional experiment, not core
| Factor | Assessment |
|--------|------------|
| Platform | **Cross-platform (Android + iOS)** via Portal app. |
| Providers | Provider-agnostic (Anthropic, OpenAI, Gemini, xAI, Ollama, …). |
| Architecture | **Agentic** — combines accessibility tree + screenshots, autonomously decides actions per device state. |
| Core tension | Agentic (adaptive, non-deterministic) vs. deterministic, diffable, version-controlled YAML flows. A regression suite wants determinism; exploration wants adaptivity. |
| Best fit | Phase 1 **exploration** and one-off bug repro — then codify findings into Maestro flows. |
| Not a fit | Replacing the deterministic regression layer — agentic runs are harder to reproduce, heal, and gate CI on. |

**Verdict:** Complementary in a way Artemis isn't: a plausible **exploration engine** feeding
the Maestro-based regression suite. Do not make it the regression driver.

### Revisit if
- The unit commits to **Android-only forever** (removes Artemis's main blocker — the redundancy argument still stands).
- Maestro's exploration/authoring proves too slow and Droidrun's agentic discovery measurably outperforms the BFS explorer.
- Stronger autonomous multi-app task completion is needed than Maestro provides.
