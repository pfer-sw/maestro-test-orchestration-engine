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
