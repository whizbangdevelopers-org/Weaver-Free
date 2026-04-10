<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-H-4-release — Release Preparation

**Priority:** High #4 (always last)
**Tier:** All
**Parallelizable:** No — depends on all other v1 agents complete
**Plan:** [EXECUTION-ROADMAP Phase 6 — Release Pipeline](../../../plans/v1.0.0/EXECUTION-ROADMAP.md)

---

## Scope

Prepare and execute the v1.0.0 release: version bump, changelog, production deployment guide, verify demo site, verify sync-to-free, git tag, and GitHub release.

### What's Already Done

- `release.yml` workflow — full release pipeline (build, sync-to-free, NUR dispatch)
- `release-verify-create.yml` — post-release verification checklist
- `release-verify-update.yml` — verification status updates
- `demo-deploy.yml` — demo site deployment to GitHub Pages
- `demo-reset.yml` — weekly demo data reset
- `sync-to-free.yml` — dev→free repo sync with exclusions
- `scripts/build-demo.sh` — demo build script
- `nixos/nur-package.nix` — NUR package definition
- `CHANGELOG.md` — file exists (needs v1.0.0 content)
- `docs/RELEASE-PROCESS.md` — release process documentation

### What's Missing

- `docs/deployment/PRODUCTION-GUIDE.md` — NixOS deployment guide
- CHANGELOG.md content for v1.0.0
- Version bump (package.json + backend/package.json → 1.0.0)
- README.md rewrite for launch
- Pre-release tier sweep (verify all tiers work)
- Agent housekeeping (AGENT-STATUS.md, CLAUDE.md API table)
- Execution of release checklist

---

## Prerequisites

All of the following must be complete before starting:

- [ ] v1-H-1-tier-enforcement: Tier wiring complete
- [ ] v1-H-2-user-management: User management page working
- [ ] v1-H-3-audit-ui: Audit log UI working
- [ ] v1-M-1-per-vm-acl: Per-VM access control working (or explicitly deferred)
- [ ] v1-M-2-vm-quotas: VM quotas working (or explicitly deferred)
- [ ] v1-M-3-demo-switcher: Demo tier-switcher working (or explicitly deferred)
- [ ] Preset tags feature: Complete or explicitly deferred (see plan file)
- [ ] All tests passing: `npm run test:prepush`
- [ ] E2E tests passing in Docker

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `CHANGELOG.md` | Existing changelog entries to extend |
| `README.md` | Current README to rewrite |
| `package.json` | Current version |
| `backend/package.json` | Current version |
| `docs/RELEASE-PROCESS.md` | Release procedure to follow |
| `docs/development/LESSONS-LEARNED.md` | "Manual Testing Blind Spots" section — pre-release tier sweep checklist |
| `CLAUDE.md` | API table to update with new endpoints |
| `agents/AGENT-STATUS.md` | Agent status to update post-release |

---

## Outputs

### Documentation

| File | Type | Description |
|------|------|-------------|
| `docs/deployment/PRODUCTION-GUIDE.md` | New | Complete NixOS deployment guide (prerequisites, install, config, HTTPS, first run, security, maintenance) |
| `CHANGELOG.md` | Modify | Full changelog from v0.1 through v1.0.0 |
| `README.md` | Modify | Launch-ready README with feature list, screenshots, quick start |

### Version Bump

| File | Type | Description |
|------|------|-------------|
| `package.json` | Modify | Version → `1.0.0` |
| `backend/package.json` | Modify | Version → `1.0.0` |

### Project Housekeeping

| File | Type | Description |
|------|------|-------------|
| `CLAUDE.md` | Modify | Update API table with all new endpoints (users, audit, quotas, vm-acl, tags, preset-tags) |
| `agents/AGENT-STATUS.md` | Modify | Move all Phase 6 agents to archived section |

---

## Pre-Release Tier Sweep

Before tagging, systematically verify features across tiers. Reference: LESSONS-LEARNED § "Manual Testing Blind Spots by Tier"

### Enterprise verification (temporary license key switch)

Run localhost with enterprise license key:

| Feature | Verification |
|---------|-------------|
| Audit log | Page loads, events display, filtering works |
| Resource quotas | Banner shows in Create VM, enforcement on POST |
| Per-VM ACL | Assign VMs to user, restricted user sees only assigned VMs |
| Bulk operations | Multi-select visible, actions execute |
| AI rate limit (30/min) | Agent route accepts requests beyond premium limit |

### Free verification (remove license key)

Run localhost with no license key + `PREMIUM_ENABLED=false`:

| Feature | Verification |
|---------|-------------|
| Create VM hidden | Dashboard shows no + button |
| Server key disabled | Settings toggle disabled, BYOK banner in AgentDialog |
| Distro mutations blocked | Settings distro section gated |
| Push notifications blocked | Notification channels gated |
| AI rate limit (5/min) | Agent route enforces lower limit |

### Demo verification

Run `VITE_DEMO_MODE=true npm run dev`:

| Feature | Verification |
|---------|-------------|
| Tier-switcher renders | Floating toolbar at bottom |
| Tier switching | Free/Premium/Enterprise toggle works |
| Feature gating | Features lock/unlock per tier |

---

## Release Execution Steps

| Step | Description |
|------|-------------|
| 1 | Run pre-release tier sweep (see above) |
| 2 | Verify all tests pass (`npm run test:prepush` + Docker E2E) |
| 3 | Update CLAUDE.md API table with all new endpoints |
| 4 | Version bump + changelog + production guide + README |
| 5 | Update `agents/AGENT-STATUS.md` — move Phase 6 agents to archive |
| 6 | Commit: `chore: prepare v1.0.0 release` |
| 7 | Tag: `git tag v1.0.0` |
| 8 | Push: `git push origin main --tags` |
| 9 | Verify `release.yml` workflow completes |
| 10 | Verify sync-to-free succeeds (no CLAUDE.md, no planning docs) |
| 11 | Verify demo site deploys and tier-switcher works |
| 12 | Verify NUR dispatch |
| 13 | Create GitHub Release with changelog |
| 14 | Run post-release verification |
| 15 | Update memory files (MEMORY.md: Phase 6 COMPLETE, current phase → Phase 7) |

---

## Acceptance Criteria

1. `v1.0.0` tag exists on main
2. GitHub Release created with full changelog
3. Demo site live and functional (including tier-switcher if M-3 completed)
4. Free repo synced and clean (no CLAUDE.md, no planning docs, no agent files)
5. NUR package dispatch sent
6. Production guide is complete and follows NixOS conventions
7. README has feature list, quick start, tier overview
8. CLAUDE.md API table is complete and accurate
9. AGENT-STATUS.md shows Phase 6 agents as archived
10. Pre-release tier sweep completed (enterprise, free, demo)
11. Post-release verification passes
12. All CI checks green

---

## Deferred Feature Handling

If any M-priority agent was not completed before release:

- Document it explicitly in the changelog: "Planned for v1.1: [feature]"
- Remove from the v1.0.0 scope in AGENT-STATUS.md (mark as "Deferred to v1.1")
- Ensure the deferred feature doesn't have partial code that could confuse users
- Create a GitHub issue tracking the deferred feature

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| Pre-release tier sweep | 30 min |
| Production deployment guide | 1–2 hours |
| CHANGELOG | 30 min |
| README rewrite | 30 min |
| CLAUDE.md + AGENT-STATUS.md updates | 15 min |
| Release execution + verification | 30 min |
| **Total** | **3.5–4.5 hours** |

---

## Documentation

This agent IS the documentation agent — all doc updates are in the Outputs section above.
