<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-release — Release Preparation

**Plan:** [V1-PRODUCTION-PLAN](../plans/V1-PRODUCTION-PLAN.md) (Final)
**Parallelizable:** No — depends on all v1 tracks complete
**Blocks:** Nothing (this is the final v1 step)

---

## Scope

Prepare and execute the v1.0.0 release: version bump, changelog, production deployment guide, demo site, NUR package, sync-to-free verification, git tag, and GitHub release.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `package.json` | Current version to bump |
| `backend/package.json` | Backend version to bump |
| `.github/workflows/sync-to-free.yml` | Sync workflow to verify |
| `CLAUDE.md` | Release checklist section |
| `../plans/v1.0.0/EXECUTION-ROADMAP.md` | Phase tracker to update (project level) |
| `nixos/default.nix` | NixOS module to verify |

---

## Prerequisites

All of the following must be complete before starting:
- [ ] v1-auth: Authentication system working
- [ ] v1-rbac: Role-based access control working
- [ ] v1-audit: Audit logging working
- [ ] v1-license: License key system working
- [ ] v1-security: Security hardening complete
- [ ] All tests passing: `npm run test:prepush`
- [ ] E2E tests passing in Docker

---

## Outputs

### Version & Changelog

| File | Type | Description |
|------|------|-------------|
| `package.json` | Modify | Version → `1.0.0` |
| `backend/package.json` | Modify | Version → `1.0.0` |
| `CHANGELOG.md` | New | Full changelog from v0.1 through v1.0 |

### Documentation

| File | Type | Description |
|------|------|-------------|
| `docs/deployment/PRODUCTION-GUIDE.md` | New | Complete NixOS deployment guide |
| `docs/deployment/SECURITY.md` | Verify | Security config guide (from v1-security) |
| `README.md` (dev repo) | Rewrite | Launch-ready README with screenshots |

### Demo Site

| File | Type | Description |
|------|------|-------------|
| `scripts/build-demo.sh` | New | Build PWA in demo mode |
| `.github/workflows/deploy-demo.yml` | New | Deploy to GitHub Pages on release |
| Demo site content | Deploy | Live at weaver-demo.github.io |

### Release Artifacts

| Artifact | Description |
|----------|-------------|
| Git tag | `v1.0.0` on main branch |
| GitHub Release | Release notes with feature highlights |
| NUR package | Updated NUR package definition |
| Sync-to-free | Free repo updated via workflow |

---

## CHANGELOG.md Structure

```markdown
# Changelog

## [1.0.0] - 2026-XX-XX

### Added
- Authentication system (JWT + bcrypt, login page, session management)
- Role-based access control (admin, operator, viewer)
- Audit logging for all VM and network actions
- License key system (replaces PREMIUM_ENABLED boolean)
- Security hardening (rate limiting, CORS, CSP, WebSocket auth)
- Production deployment guide

### Changed
- PREMIUM_ENABLED deprecated in favor of LICENSE_KEY
- Health endpoint now returns tier information

## [0.9.0] - 2026-XX-XX (Dev)
### Added
- Windows guest support (ISO-install provisioning path)
- Guest OS field on VM definitions
- Windows-specific QEMU arguments (IDE + e1000)
...

## [0.8.0] - 2026-XX-XX (Dev)
### Added
- Curated distro catalog (three-tier merge system)
...
```

Continue back through all versions to v0.1.0.

---

## Production Deployment Guide Outline

```
docs/deployment/PRODUCTION-GUIDE.md

1. Prerequisites
   - NixOS host
   - Bridge interface configured
   - Disk space requirements

2. Installation
   - Add to flake inputs
   - Import NixOS module
   - Minimal configuration example

3. Configuration
   - All NixOS module options with descriptions
   - Environment variables reference
   - License key setup

4. HTTPS Setup
   - nginx reverse proxy configuration
   - Let's Encrypt with ACME
   - Self-signed certificates (homelab)

5. First Run
   - Create admin account
   - Verify dashboard loads
   - Create first VM

6. Security
   - CORS configuration
   - Rate limiting tuning
   - Firewall rules
   - Secrets management (sops-nix, agenix)

7. Maintenance
   - Backup (data directory)
   - Updates (flake update)
   - Log rotation
   - Audit log management

8. Troubleshooting
   - Common issues
   - Log locations
   - systemd journal commands
```

---

## Release Checklist (Execute in Order)

```
1. [ ] Verify all v1 agent work is merged
2. [ ] npm run test:prepush passes
3. [ ] E2E tests pass in Docker
4. [ ] Update version in package.json → 1.0.0
5. [ ] Update version in backend/package.json → 1.0.0
6. [ ] Write CHANGELOG.md
7. [ ] Write production deployment guide
8. [ ] Rewrite README.md for launch
9. [ ] Update EXECUTION-ROADMAP.md (Phase 6 → COMPLETE)
10. [ ] Build demo site, verify it works
11. [ ] Commit: "chore: prepare v1.0.0 release"
12. [ ] Tag: git tag v1.0.0
13. [ ] Push: git push origin main --tags
14. [ ] Create GitHub Release from tag with changelog
15. [ ] Verify sync-to-free workflow runs and succeeds
16. [ ] Verify demo site deploys
17. [ ] Update/publish NUR package
18. [ ] Run post-release verification tests
19. [ ] Verify free repo README is correct (no CLAUDE.md, no planning docs)
```

---

## Acceptance Criteria

1. `v1.0.0` tag exists on main
2. GitHub Release created with full changelog
3. Demo site live and functional at the configured URL
4. Free repo synced and clean (no internal docs)
5. NUR package published and installable
6. Production guide is complete and follows NixOS conventions
7. README has screenshots, feature list, quick start
8. Post-release tests pass
9. All CI checks green

---

## Estimated Effort

Changelog: 0.5 days
Production guide: 1 day
README rewrite: 0.5 days
Demo site setup: 1 day
Release mechanics (tag, GH release, NUR, verify): 0.5 days
Total: **3–4 days**
