<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: {VERSION-ID} — {Feature Name}

**Priority:** {High #N / Medium #N / Low #N}
**Tier:** {All / Fabrick / Weaver+ / Demo}
**Parallelizable:** {Yes (independent) / After {dependency-agent} (reason)}
**Plan:** [EXECUTION-ROADMAP Phase N — {section}](../plans/v1.0.0/EXECUTION-ROADMAP.md)

---

## Pre-Flight: Codebase Scan

**MANDATORY before writing any code.** Two steps:

1. **Run the e2e-test-writer agent** (`code/.claude/agents/e2e-test-writer.md`) to audit current E2E coverage gaps. Document all gaps found in the E2E Notes section. Write any missing specs before starting feature work.

2. **Scan the actual codebase** to populate "What's Already Done" accurately. Do not fill in that section from memory or prior agent specs — read the current files. Prior agent specs may be stale. Grep for relevant interfaces, services, routes, and components before listing them.

---

## Scope

{1-3 paragraphs describing what the agent does and why it matters.}

### What's Already Done

<!-- MANDATORY: Scan the actual codebase before filling this in. Do not copy from a prior agent spec. -->
<!-- Run: grep for relevant types, services, routes, components. Read the files. Trust what you see, not what prior specs say. -->

- {Existing infrastructure the agent builds on — verified by reading the current code}
- {Middleware, stores, routes, components already in place — confirmed to exist}

### What's Missing

- {Specific gaps this agent fills}
- {New routes, pages, stores, middleware}

---

## Context to Read Before Starting

<!-- Every file the agent needs to understand before writing code. -->
<!-- Include: middleware chain, storage patterns, route patterns, UI patterns, NixOS module. -->
<!-- If the feature touches WebSocket, include ws.ts. -->
<!-- If the feature touches tiers, include license.ts and config.ts. -->

| File | Why |
|------|-----|
| `backend/src/...` | {pattern or contract to follow} |
| `src/...` | {component or store pattern} |

---

## Outputs

<!-- List every file created or modified. Group by layer. -->

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/...` | New/Modify | {description} |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/...` | New/Modify | {description} |

### NixOS

<!-- Delete this section if the feature has no NixOS module impact. -->

| File | Type | Description |
|------|------|-------------|
| `nixos/default.nix` | Modify | {new options} |

### Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/...` | New | {what's tested} |
| `testing/e2e/...` | New | {workflow tested} |

---

## CRUD Completeness Check

<!-- MANDATORY: Answer each question. Delete rows that don't apply. -->
<!-- Lesson: v1-H-2 shipped without a Create button because the spec only listed Read/Update/Delete. -->

| Operation | Needed? | Covered by |
|-----------|---------|------------|
| **Create** | {Yes/No} | {route + UI component} |
| **Read** (list) | {Yes/No} | {route + UI component} |
| **Read** (single) | {Yes/No} | {route + UI component} |
| **Update** | {Yes/No} | {route + UI component} |
| **Delete** | {Yes/No} | {route + UI component} |
| **Undo/Clear** | {Yes/No} | {route + UI component — the "revert to default" path} |

---

## All Endpoints Affected

<!-- MANDATORY: Enumerate every endpoint this feature touches. -->
<!-- Include: existing endpoints that need middleware/filtering, new endpoints, WebSocket. -->
<!-- Lesson: v1-M-1 initially missed WebSocket filtering — a data leak. -->

| Endpoint | Impact |
|----------|--------|
| `GET /api/...` | {new / add middleware / filter response} |
| `WS /ws/status` | {filter broadcast / add event type / no impact} |

**Not affected:** {list endpoints explicitly excluded and why}

---

## Design

<!-- Optional: data model, UI mockup, or architectural notes. -->
<!-- Use this for anything that needs visual or structural explanation. -->
<!-- For data models, show the TypeScript interface. -->
<!-- For UI, use ASCII mockup — keep it simple. -->

---

## Flow Notes

<!-- MANDATORY: 3-5 lines of plain text. No diagrams. -->
<!-- Describe the request path through middleware and handlers. -->
<!-- See Forge repo METHODOLOGY.md for flow notes guidance -->

{Request hits auth.ts (JWT) -> rbac.ts (requireRole) -> {new middleware} -> handler.}
{Frontend reads from store -> composable -> component.}
{WebSocket impact: {filtered/broadcast/none}.}

---

## Safety Rules

<!-- What operations must be prevented? What invariants must hold? -->
<!-- Examples: can't delete self, can't demote last admin, can't exceed quota. -->
<!-- If no safety rules apply, write "None — read-only feature" and delete the list. -->

1. {Operation that must be prevented + why}
2. {Invariant that must hold}

---

## Acceptance Criteria

<!-- Workflow-based, not technical assertions. -->
<!-- Write as user journeys: "Admin navigates to X -> sees Y -> does Z -> result is W" -->
<!-- Always end with the standard test gates. -->

1. {User workflow: actor -> navigation -> action -> expected result}
2. {Negative case: unauthorized user -> expected denial}
3. All existing tests pass
4. `npm run test:precommit` passes

---

## Tier Blind Spot Mitigation

<!-- MANDATORY for any feature gated above Free tier. -->
<!-- Dev localhost runs Weaver. E2E Docker runs Weaver. -->
<!-- If this feature is Fabrick-only or Demo-only, it CANNOT be tested in standard dev/E2E. -->
<!-- State the gap explicitly and describe mitigation. -->

**This feature is {tier}-only.** Standard dev/E2E runs at {Weaver/Weaver Free}.

**Mitigation:**
- {Unit tests cover middleware behavior at all tiers}
- {E2E tests verify feature is inactive at E2E tier (backwards compat)}
- {Manual verification: temporarily switch to {tier} before release}

<!-- If the feature works at all tiers, write: -->
<!-- "No blind spot — feature active at all tiers including E2E (weaver)." -->

---

## E2E Notes

<!-- MANDATORY: Shared state and environment guidance for E2E spec authors. -->

- **Temp resources:** {MUST use createTempUser() / createTempVm() if test mutates shared state}
- **Shared state risk:** {What would break if test used the shared e2e-operator/e2e-admin?}
- **Environment gaps:** {Env vars not set in E2E Docker? Features that require specific config?}
- **Cleanup:** {afterAll block must clean up temp resources}

<!-- If no E2E spec is needed, explain why (e.g., "demo-only, unit tests sufficient"). -->

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| Backend | {time} |
| Frontend | {time} |
| Tests | {time} |
| **Total** | **{time}** |

---

## Documentation

<!-- MANDATORY per CLAUDE.md § Documentation Policy. -->

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | {new sections: routes, middleware, architecture} |
| `src/pages/HelpPage.vue` | {user-facing feature description} |
| `CLAUDE.md` | {new API endpoints for the API table} |
