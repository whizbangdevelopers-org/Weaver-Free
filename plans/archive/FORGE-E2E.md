<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Forge: Autonomous E2E Test Maintenance

**Goal**: Zero-human-intervention E2E test maintenance. When feature agents change code, the system detects, diagnoses, and fixes test failures autonomously — or at minimum, produces a fix PR for human review.

**Status**: Foundation (Level 1 complete, working toward Level 2)

---

## The Vision

A "forge" for E2E testing means:

1. **Feature agent ships code** (new route, UI change, tier gate)
2. **E2E runs automatically** (already have this via Docker)
3. **Failures are auto-triaged** into root cause categories (Level 1 — done)
4. **Known patterns are auto-fixed** (Level 2 — next)
5. **Fixes are validated** by re-running E2E (Level 3)
6. **Unknown patterns surface** as structured issues, not raw logs (Level 4)
7. **The system learns** from each fix cycle, improving its pattern library (Level 5)

---

## Maturity Levels

### Level 1: Structured Triage (COMPLETE)

**What exists today:**
- `analyze-results.sh` — Parses Playwright JSON, categorizes failures into 7 root cause patterns (ENV_MISMATCH, AUTH_FAILURE, TIER_GATE, SHARED_STATE, ELEMENT_MISSING, TIMEOUT, API_ERROR), outputs actionable triage report
- `detect-flaky.sh` — Runs tests N times, identifies flaky vs consistently failing
- Temp resource helpers — `createTempUser()`, `createTempVm()` with cleanup to prevent shared state contamination
- Shared state convention — Documented in helpers and LESSONS-LEARNED

**Value**: Reduces triage from "read 14 raw error logs" to "here are 5 categorized groups with suggested fixes". Human still applies the fix.

### Level 2: Pattern-Based Auto-Fix

**Target**: For each recognized failure category, apply a mechanical fix without human intervention.

| Pattern | Auto-Fix Strategy | Feasibility |
|---------|------------------|-------------|
| ENV_MISMATCH (IPs) | Parse error for rejected IP, look up valid subnet from config, sed-replace in spec | HIGH — most are literal string replacements |
| TIER_GATE (count mismatch) | Read current tier from E2E env, check if feature is gated above that tier, flip assertion (expect present → expect absent) | MEDIUM — needs feature-to-tier mapping |
| AUTH_FAILURE (missing header) | Detect `request.get/post` without `Authorization` header, inject `beforeAll` token acquisition | MEDIUM — AST transform on test file |
| SHARED_STATE (session killed) | Detect test that mutates shared user, refactor to use `createTempUser()` | LOW — requires understanding test intent |
| ELEMENT_MISSING (selector) | Snapshot current DOM, find closest match to failed selector | LOW — heuristic, error-prone |
| TIMEOUT (race) | Add `test.describe.configure({ mode: 'serial' })` to file with timing failures | HIGH — mechanical insertion |

**Implementation approach**: A post-E2E hook that:
1. Runs `analyze-results.mjs --json` to get structured failures
2. For HIGH-feasibility categories, applies a fix script
3. Re-runs only the failed tests
4. If green, stages the fix for review
5. If still red, escalates to human with the structured triage report

### Level 3: Fix Validation Loop

**Target**: Auto-fix → re-run → verify → commit (or escalate).

```
analyze-results.mjs --json
  │
  ├─ HIGH-feasibility patterns → apply-fix scripts
  │   ├─ re-run failed tests only (--grep)
  │   │   ├─ PASS → git add + commit draft
  │   │   └─ FAIL → try next fix strategy or escalate
  │   └─ no fix available → escalate
  │
  └─ LOW-feasibility patterns → structured issue creation
```

**Key requirement**: The fix loop must be idempotent. Running it twice should not apply the same fix twice or corrupt the test file.

### Level 4: Structured Escalation

**Target**: When auto-fix fails, create a structured issue (not a raw error dump).

Output format for human review:
```
## E2E Failure: [category] in [file]:[line]
**Test**: [test title]
**Root cause**: [category label]
**Error**: [cleaned error message]
**Attempted fixes**: [what was tried]
**Suggested next steps**: [from category fix guide]
**Related files**: [test file, source file that likely caused the break]
```

This could be a GitHub issue, a PR comment, or a Claude Code prompt — whatever the workflow demands.

### Level 5: Learning Loop

**Target**: The system improves its pattern library from each fix cycle.

- New failure patterns that don't match existing categories get logged
- After manual fix, the human (or Claude) adds the pattern to the category list
- Fix scripts accumulate successful strategies per category
- Flaky test history builds a "known flaky" list that can be auto-skipped or auto-retried

---

## Architecture Decisions

### Where does the auto-fix logic live?

**Option A: Shell scripts (extend analyze-results.sh)**
- Pro: Simple, no new deps, works in Docker
- Con: String manipulation in bash is fragile for code transforms

**Option B: Node.js fix scripts (per-category .mjs files)**
- Pro: Can use AST parsing (e.g., ts-morph) for reliable transforms
- Con: Heavier, needs deps in E2E Docker image

**Option C: Claude Code agent with structured prompts**
- Pro: Can understand intent, not just syntax; handles novel patterns
- Con: Requires API access in CI, cost per run, non-deterministic

**Recommended path**: Start with **Option B** for HIGH-feasibility patterns (IP replacement, serial mode insertion). Use **Option C** as the escalation path for patterns that need reasoning. Option A is the fallback for environments without Node or API access.

### When does the fix loop run?

1. **Post-agent-execution** (immediate) — After a feature agent completes and E2E fails
2. **CI pipeline** (PR-gated) — As a PR check that attempts auto-fix before failing the PR
3. **Scheduled** (nightly) — Flaky detection runs to catch drift

All three should be supported. The fix loop is the same; only the trigger differs.

---

## Current Foundation (What We Have)

| Component | Status | Location |
|-----------|--------|----------|
| Dockerized E2E runner | DONE | `testing/e2e-docker/scripts/run-tests.sh` |
| Iterate runner (fast re-runs) | DONE | `testing/e2e-docker/scripts/run-iterate.sh` |
| JSON result parser + categorizer | DONE | `testing/e2e-docker/scripts/analyze-results.mjs` |
| Flaky detector | DONE | `testing/e2e-docker/scripts/detect-flaky.sh` |
| Temp user helpers | DONE | `testing/e2e/helpers/auth.ts` |
| Temp VM helpers | DONE | `testing/e2e/helpers/index.ts` |
| Shared state convention docs | DONE | `docs/development/LESSONS-LEARNED.md` |
| Root cause pattern library | DONE | 7 categories in `analyze-results.mjs` |
| Auto-fix scripts | TODO | Level 2 |
| Fix validation loop | TODO | Level 3 |
| Structured escalation | TODO | Level 4 |
| Learning loop | TODO | Level 5 |

---

## Next Steps (Immediate)

1. **Build the IP auto-fixer** — Simplest pattern. Parse "not in subnet" errors, find the offending IP in the spec file, replace with a valid one. This proves out the Level 2 architecture.
2. **Build the serial-mode inserter** — For timeout failures in parallel specs, auto-insert `test.describe.configure({ mode: 'serial' })`.
3. **Wire analyze → fix → re-run** — The post-E2E hook that chains analysis, fix attempt, and validation.

---

## Agent Spec Guidance: Flow Notes over Diagrams

When writing agent specs, **do not include code flow diagrams** (mermaid, ASCII art, etc.). They create a maintenance burden that outweighs their value for agent execution.

**Why agents don't need diagrams:**
- Agents parse code directly — they don't need an abstraction layer on top of it
- A diagram that says "request → auth → tier check → handler" adds nothing over reading the actual middleware chain in the source file
- If a diagram disagrees with code, the agent trusts the code anyway
- Every agent that modifies a flow would need to update the diagram — agents are bad at this, producing stale diagrams that mislead the next agent

**What to do instead:** Add a `## Flow Notes` section to agent specs — plain text, 3-5 lines, disposable:

```markdown
## Flow Notes
Request hits auth middleware → requireRole('admin') → requireTier('enterprise') → handler.
Frontend checks useTierFeature('enterprise') before rendering the button.
WebSocket broadcast picks up changes via the existing vm-status loop.
```

This is cheap to write, cheap to discard when the spec is archived, and gives agents exactly enough routing context to avoid reading files they don't need. The `## Context to Read Before Starting` table in agent specs serves the same purpose more durably — Flow Notes are a lightweight supplement for complex multi-layer interactions.

**Where diagrams DO help:** Human troubleshooting of cross-layer failures, onboarding new contributors, architecture reviews. Keep these in `docs/` as living documents maintained by humans, not in agent specs.

---

## Broader Forge Principles

This E2E approach is one facet of a larger goal: **autonomous software maintenance**. The same pattern applies to:

- **Unit test maintenance** — When a function signature changes, update affected test files
- **Type error resolution** — When a type changes, propagate the fix through dependents
- **Dependency updates** — When a dep bumps, run tests, fix breaking changes, PR the result
- **Documentation drift** — When code changes, update docs that reference the changed API

The E2E layer is the hardest (browser state, async timing, visual regressions) and the most valuable to automate. If we can make E2E self-healing, the others follow more easily.
