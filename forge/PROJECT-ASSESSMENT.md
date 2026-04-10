<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Forge: Weaver Assessment

**Date:** 2026-03-06
**Phase:** Pre-Release (v1.0.0 at 95%)
**Last Release:** none (premature v1.0.0 tag to be removed)

## Scorecard

| Dimension | Grade | Notes |
|-----------|-------|-------|
| Template scaffolding | A | CLAUDE.md, 6 rules files, hooks, versioned agents, 8 audit scripts |
| Institutional knowledge | A | 137+ lessons, active gotchas, all earned from real development |
| Tier/license model | A | 3-tier + Extensions model decided, tier-matrix.json, requireTier() gates, frontend guards, parity auditor |
| Domain spec | A | VM data model, WebSocket protocol, API contracts, agent BYOK/BYOV — all specified |
| Feedback loop | A | First extraction executed 2026-03-03 (template structural improvements from MicroVM experience) |
| Business-to-code bridge | A | Pegaprox, Forge vocabulary; tier + extension decisions in memory; trial strategy documented |
| Test coverage | A | 1,338 tests (269 unit + 582 backend + 183 TUI + 304 E2E), all green |
| E2E maturity | A | Docker-first, live E2E, iterate mode, premium + free tier runs |
| Agent task readiness | A | Versioned agent dirs (v1.1–v2.0) with Forge MANIFEST.md; GTM agents ready to execute |
| Release planning | A | plans/ and agents/ aligned 1:1 with release versions (v1.0–v3.0); RELEASE-ROADMAP.md in business/product/ |
| Project-level MCP | A | Three-level agent pattern: project orchestration, Forge task specs, code execution |

## Three-Level Agent Architecture

```
.claude/agents/           ← Project orchestration (planning, status, release)
  forge-sync.md            Regenerates forge/STATUS.json from project state
  plan-reviewer.md         Cross-reference and version alignment audit
  release-prep.md          Release checklist automation

agents/<version>/         ← Forge task specs (what to build)
  MANIFEST.md              Execution order, gates, branches
  <agent>.md               Scope, acceptance criteria, deliverables

code/.claude/agents/      ← Code execution (how to run it)
  test-runner.md           Unit + backend tests
  e2e-runner.md            Docker E2E execution
  security-reviewer.md     OWASP code review
  gtm-*.md                 GTM launch executors
```

## Forge Execution Model

Each release version has a self-contained directory in both `plans/` and `agents/`:

```
plans/vX.Y.0/EXECUTION-ROADMAP.md   ← What to build, acceptance criteria
agents/vX.Y.0/MANIFEST.md           ← How Forge executes it (order, gates, branches)
agents/vX.Y.0/<agent>.md            ← Individual agent task specs
```

**Lifecycle:** Forge reads MANIFEST.md → creates branch(es) → executes agents in order → runs quality gates → merges to main → tags release → moves agents to `agents/archive/vX.Y.0/`.

**Machine-readable status:** [forge/STATUS.json](STATUS.json) — Forge orchestrator reads this to schedule agents across projects.

**Entry points:**
- [forge/STATUS.json](STATUS.json) — Machine-readable queue, blockers, estimates
- [agents/AGENT-STATUS.md](../agents/AGENT-STATUS.md) — Cross-version agent index
- [business/product/RELEASE-ROADMAP.md](../business/product/RELEASE-ROADMAP.md) — Strategic release timeline
- [MASTER-PLAN.md](../MASTER-PLAN.md) — Plan index with all version links

## Blocking Items

1. **v1.0.0 tag premature** — must be removed and re-released after remaining gates pass
2. **Release dry run** — v1.0.0-rc1 tag + NixOS fresh-install smoke test
3. **Legal/insurance review** — ToS/ToU + carrier touchpoint before shipping

## Decision Queue

| # | Decision | Impact | Deadline |
|---|----------|--------|----------|
| 1 | v2.0.0 agent estimates (currently TBD) | Forge scheduling accuracy | Before v2.0 planning |
| 2 | Template extraction: project-level `.claude/` + STATUS.json convention | Enables multi-project Forge orchestration | Before Gantry bootstrap |

---

*Source template: [quasar-project-template/forge/PROJECT-ASSESSMENT.md](https://github.com/whizbangdevelopers-org/quasar-project-template/blob/main/forge/PROJECT-ASSESSMENT.md)*
