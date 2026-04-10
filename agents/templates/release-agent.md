<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: {VERSION-ID}-release — Release Preparation

**Priority:** {High #N} (always last in phase)
**Tier:** All
**Parallelizable:** No — depends on all other {phase} agents complete
**Plan:** [EXECUTION-ROADMAP Phase N — {section}](../plans/v1.0.0/EXECUTION-ROADMAP.md)

---

## Scope

Prepare and execute the v{X.Y.Z} release: version bump, changelog, deployment guide updates, verify pipelines, git tag, and GitHub release.

### What's Already Done

- {Existing release workflows and scripts}
- {Existing documentation}
- {Existing CI/CD pipelines}

### What's Missing

- {Changelog content for this version}
- {Version bump}
- {New or updated deployment docs}
- {Pre-release verification}
- {Agent/project housekeeping}

---

## Prerequisites

<!-- Explicit checklist. Every agent that must complete before release starts. -->
<!-- Mark M-priority items as "(or explicitly deferred)" — see Deferred Feature Handling. -->

All of the following must be complete before starting:

- [ ] {agent-id}: {feature name} complete
- [ ] {agent-id}: {feature name} complete (or explicitly deferred)
- [ ] {Non-agent prerequisite, e.g., "Preset tags feature complete"}
- [ ] All tests passing: `npm run test:prepush`
- [ ] E2E tests passing in Docker

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `CHANGELOG.md` | Existing entries to extend |
| `README.md` | Current README to update |
| `package.json` | Current version |
| `backend/package.json` | Current version |
| `docs/RELEASE-PROCESS.md` | Release procedure to follow |
| `docs/development/LESSONS-LEARNED.md` | Blind spots and gotchas for pre-release sweep |
| `CLAUDE.md` | API table to update with new endpoints |
| `agents/AGENT-STATUS.md` | Agent status to update post-release |

---

## Outputs

### Documentation

| File | Type | Description |
|------|------|-------------|
| `CHANGELOG.md` | Modify | Full changelog for v{X.Y.Z} |
| `README.md` | Modify | {Updated feature list, quick start, etc.} |
| `docs/deployment/PRODUCTION-GUIDE.md` | {New/Modify} | {Deployment guide updates} |

### Version Bump

| File | Type | Description |
|------|------|-------------|
| `package.json` | Modify | Version -> `{X.Y.Z}` |
| `backend/package.json` | Modify | Version -> `{X.Y.Z}` |

### Project Housekeeping

| File | Type | Description |
|------|------|-------------|
| `CLAUDE.md` | Modify | Update API table with all new endpoints from this phase |
| `agents/AGENT-STATUS.md` | Modify | Move Phase {N} agents to archived section |

---

## Pre-Release Tier Sweep

<!-- MANDATORY: Systematically verify features across tiers before tagging. -->
<!-- Reference: LESSONS-LEARNED "Manual Testing Blind Spots by Tier" -->
<!-- Each tier section lists features to verify and how to verify them. -->

### Fabrick verification

<!-- Temporarily switch localhost to fabrick license key. -->

Run localhost with fabrick license key:

| Feature | Verification |
|---------|-------------|
| {Fabrick feature} | {What to check} |

### Weaver verification (standard dev environment)

<!-- This is the default dev tier — most features testable here. -->

| Feature | Verification |
|---------|-------------|
| {Weaver feature} | {What to check} |

### Free verification

<!-- Remove license key, set PREMIUM_ENABLED=false. -->

Run localhost with no license key + `PREMIUM_ENABLED=false`:

| Feature | Verification |
|---------|-------------|
| {Feature should be hidden/blocked} | {What to check} |

### Demo verification

<!-- Run with VITE_DEMO_MODE=true. -->

Run `VITE_DEMO_MODE=true npm run dev`:

| Feature | Verification |
|---------|-------------|
| {Demo-specific feature} | {What to check} |

---

## Release Execution Steps

<!-- Sequential numbered procedure. Each step must be completable and verifiable. -->

| Step | Description |
|------|-------------|
| 1 | Run pre-release tier sweep (see above) |
| 2 | Verify all tests pass (`npm run test:prepush` + Docker E2E) |
| 3 | Update CLAUDE.md API table with all new endpoints |
| 4 | Version bump + changelog + deployment guide + README |
| 5 | Update `agents/AGENT-STATUS.md` — move Phase {N} agents to archive |
| 6 | Commit: `chore: prepare v{X.Y.Z} release` |
| 7 | Tag: `git tag v{X.Y.Z}` |
| 8 | Push: `git push origin main --tags` |
| 9 | Verify `release.yml` workflow completes |
| 10 | Verify sync-to-free succeeds (no CLAUDE.md, no planning docs) |
| 11 | Verify demo site deploys |
| 12 | Verify NUR dispatch |
| 13 | Create GitHub Release with changelog |
| 14 | Run post-release verification |
| 15 | Update memory files (MEMORY.md: Phase {N} COMPLETE, current phase -> Phase {N+1}) |

---

## Deferred Feature Handling

<!-- How to handle M-priority agents that were not completed before release. -->

If any M-priority agent was not completed before release:

- Document it explicitly in the changelog: "Planned for v{X.Y+1}: {feature}"
- Remove from the v{X.Y.Z} scope in AGENT-STATUS.md (mark as "Deferred to v{X.Y+1}")
- Ensure the deferred feature doesn't have partial code that could confuse users
- Create a GitHub issue tracking the deferred feature

---

## Acceptance Criteria

1. `v{X.Y.Z}` tag exists on main
2. GitHub Release created with full changelog
3. Demo site live and functional
4. Free repo synced and clean (no CLAUDE.md, no planning docs, no agent files)
5. NUR package dispatch sent
6. Deployment guide complete and accurate
7. README reflects current feature set
8. CLAUDE.md API table is complete and accurate
9. AGENT-STATUS.md shows Phase {N} agents as archived
10. Pre-release tier sweep completed (fabrick, weaver, free, demo)
11. Post-release verification passes
12. All CI checks green

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| Pre-release tier sweep | {time} |
| Documentation (changelog, README, deployment guide) | {time} |
| Housekeeping (CLAUDE.md, AGENT-STATUS.md) | {time} |
| Release execution + verification | {time} |
| **Total** | **{time}** |

---

## Documentation

This agent IS the documentation agent — all doc updates are in the Outputs section above.
