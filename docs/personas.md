# Test personas

Personas make runs repeatable and give contrasting scenarios a vocabulary. Drive a whole
journey as ONE coherent character rather than a list of disconnected prompts — the character
is what produces realistic transitions between moments in the app.

Every release report names its persona in the first section. Mark a persona with the date it was
first used; keep proposed ones until they are run.

## Template

### P-NN — "<Name>"
| Attribute | Value |
|---|---|
| Member status | e.g. fresh / mid-journey / returning |
| Goal | what the member wants from the app |
| Behaviour | temperament, how they use the app |
| Risk | what they are likely to do that stresses the product |

**What they exercise:** test-case categories and guardrails they naturally hit.
**Watch for:** the failure modes this persona surfaces.

---

## P-01 — "The Organised Planner" *(example — replace)*

| Attribute | Value |
|---|---|
| Member status | Fresh account, empty notes list |
| Goal | Keep a weekly shopping list and meeting notes |
| Behaviour | Cooperative, precise, asks the assistant to do things for them |
| Risk | Chains several requests in one message ("create, then share, then pin") |

**What they exercise:** `note_actions`, the `claimed_action_not_performed` guardrail, multi-step requests.
**Watch for:** the assistant confirming actions the UI does not reflect.

**Why a cooperative baseline persona:** any failure an easy member surfaces would be worse with a
difficult one. Add contrasting personas (sceptic, disengaged, boundary-tester) once the baseline runs.

## Safety rule — applies to ALL personas
Personas never send inputs that the unit's safety rules forbid in a normal journey — see
`CLAUDE.md` → "Unit-specific rules". Deliberate escalation cases are handled as described in
[`workflows/ai-behavioural-run.md`](workflows/ai-behavioural-run.md).
