<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Security Audit Domains — Forge Integration

**Purpose:** Track non-code security concerns across 5 audit domains. Each domain has an umbrella GitHub issue with sub-tasks that can be closed independently by user or AI assistant.
**Updated:** 2026-02-21
**Status:** Domains 1-4 verified complete (regressions fixed). Domain 5 first pass ~90% complete.

---

## Domain Overview

| # | Domain | Issue | Agent Ready? | Status |
|---|--------|-------|-------------|--------|
| 1 | [Legal & IP Protection](#1-legal--ip-protection) | [#34](https://github.com/whizbangdevelopers-org/Weaver-Dev/issues/34) | Yes | First pass complete |
| 2 | [Secrets & Access Control](#2-secrets--access-control) | [#35](https://github.com/whizbangdevelopers-org/Weaver-Dev/issues/35) | After first pass | Verified ✓ (1 regression fixed) |
| 3 | [Supply Chain Integrity](#3-supply-chain-integrity) | [#36](https://github.com/whizbangdevelopers-org/Weaver-Dev/issues/36) | After first pass | Verified ✓ (4 regressions fixed) |
| 4 | [Deployment Security](#4-deployment-security) | [#37](https://github.com/whizbangdevelopers-org/Weaver-Dev/issues/37) | After first pass | Verified ✓ |
| 5 | [Org Governance](#5-org-governance) | [#38](https://github.com/whizbangdevelopers-org/Weaver-Dev/issues/38) | Limited | First pass ~90% complete |

---

## Forge Agent Strategy

### Principle
**Execute manually first, then codify.** Agent templates are only created after a domain's first manual pass surfaces real findings. This prevents shallow templates that miss actual gaps.

### Agent Lifecycle per Domain

```
First Manual Execution
  → Document findings in GitHub issue sub-tasks
  → Identify what's automatable vs. manual-only
  → Create agent template in agents/templates/
  → Future scans run agent to verify no regression
```

### Current Agent Templates

| Domain | Template | Status |
|--------|----------|--------|
| Legal & IP | `security-legal-ip-audit.md` | Ready to create |
| QA Form Validation | `qa-form-validation-audit.md` | Created (prior work) |
| QA Route Auth | `qa-route-auth-coverage.md` | Created |
| QA CRUD Completeness | `qa-crud-completeness.md` | Created |
| QA Post-Release | `qa-post-release-verification.md` | Created |
| QA New Route Compliance | `qa-new-route-compliance.md` | Created |

---

## 1. Legal & IP Protection

**Issue:** [#34](https://github.com/whizbangdevelopers-org/Weaver-Dev/issues/34)
**Status:** First pass COMPLETE (3eb4ac9)

**What was found and fixed:**
- No LICENSE file existed → Created AGPL-3.0 + Commons Clause + AI Training Restriction
- No copyright notices anywhere → Added to MainLayout, HelpPage, DemoLoginPage
- No AI crawler protection for demo → Added robots.txt + noai meta tags
- package.json said "MIT" → Updated to "SEE LICENSE IN LICENSE"

**Remaining manual items:**
- GitHub org Copilot training opt-out
- Verify LICENSE renders on Free repo after sync
- BSL license for Fabrick (deferred post-v1.0)

**Agent scan criteria:**
1. LICENSE exists and contains all three layers
2. package.json license field correct in both packages
3. Copyright notice on every user-facing page entry point
4. Demo build includes LICENSE + robots.txt + noai meta
5. Free repo sync includes LICENSE

---

## 2. Secrets & Access Control

**Issue:** [#35](https://github.com/whizbangdevelopers-org/Weaver-Dev/issues/35)
**Status:** First pass COMPLETE (automated) — manual verification items remain

**What was found and fixed:**
- Source scan for hardcoded secrets: CLEAN (only test fixtures and demo-mode tokens)
- `.env`/`.gitignore` audit: correct — `.env`, `.env.local`, `.env.*.local` all gitignored
- Added `permissions:` blocks to 4 workflows missing them: `demo-reset.yml`, `security-scan.yml`, `sync-to-free.yml`, `test.yml`
- Identified 5 secrets referenced across workflows (3 required + 2 optional)

**Verification pass (2026-02-21):**
- Regression found: `version-drift-check.yml` (added after original audit) had permissions at job level instead of workflow level → Fixed: moved to workflow-level `permissions:` block
- All other workflows verified correct

**Remaining manual items (see USER-ACTION-ITEMS.md):**
- Verify all 5 secrets exist in GitHub Settings
- Manual dispatch sync + demo deploy workflows to test
- Enable branch protection on `main`
- Enable 2FA requirement for org members
- Audit org member list

**Agent scan criteria:**
1. No hardcoded secrets in source (`sk-`, `ghp_`, `gho_`, `AKIA` patterns)
2. `.env` files in `.gitignore`
3. All workflows have explicit `permissions:` blocks
4. No `secrets.*` reference without corresponding `REQUIRED SECRETS` header comment

---

## 3. Supply Chain Integrity

**Issue:** [#36](https://github.com/whizbangdevelopers-org/Weaver-Dev/issues/36)
**Status:** First pass COMPLETE (d94971d, abb75ef)

**What was found and fixed:**
- 40/40 GitHub Actions `uses:` references pinned from mutable tags (`@v4`) to immutable SHA digests
- 11 unique Actions across 10 workflow files — all pinned with version comment
- Automated scanner: `npm run audit:routes` verifies route auth compliance (68 routes)

**Verification pass (2026-02-21):**
- 4 regressions found in 3 workflows added after original audit:
  - `dependabot-labeler.yml`: `dependabot/fetch-metadata@v2` → SHA-pinned
  - `dependabot-tracker.yml`: `actions/checkout@v4` → SHA-pinned
  - `version-drift-check.yml`: `actions/checkout@v4` + `actions/setup-node@v4` → SHA-pinned
- Updated count: 44/44 Actions refs now SHA-pinned across 13 workflow files

**npm audit findings (documented, not all fixable):**
- Backend: Fastify 4.29.1 has 2 HIGH vulns (DoS via content-type + body validation bypass). Fix requires Fastify 5 (semver major) — deferred to post-v1.0
- Frontend: 30 vulns in eslint/tooling chain (dev-only, no production exposure)
- `engines` field pins Node >= 18, npm >= 9

**Remaining items:**
- Fastify 5 migration (post-v1.0 — tracked as known risk)
- Dependabot/Renovate configuration (optional, low priority)
- Review unused dev dependencies

**Agent scan criteria:**
1. All `uses:` in `.github/workflows/` reference SHA pins (not tags)
2. `npm audit --audit-level=critical` passes in both packages
3. `engines` field present in both package.json files
4. No `--no-verify` or `--force` flags in workflow commands

---

## 4. Deployment Security

**Issue:** [#37](https://github.com/whizbangdevelopers-org/Weaver-Dev/issues/37)
**Status:** First pass COMPLETE — already better than expected

**What was found (already in place from Phase 6):**
- `@fastify/helmet` registered with full CSP (script-src, style-src, img-src, connect-src, frame-ancestors 'none')
- HSTS, X-Content-Type-Options, Referrer-Policy, X-DNS-Prefetch-Control, X-Permitted-Cross-Domain-Policies all set via helmet defaults
- CORS: wildcard rejected in production (same-origin only), permissive only in development
- Error handler sanitizes 500s: returns "Internal server error" string, logs details server-side only
- Body limit: 1MB default
- Rate limiting: `createRateLimit` helper used across routes

**Remaining items:**
- Run Mozilla Observatory or SecurityHeaders.com scan against live deployment
- Cookie security audit (httpOnly, secure, sameSite flags)
- HTTPS enforcement at NixOS/nginx level (outside Fastify scope)

**Agent scan criteria:**
1. `@fastify/helmet` registered in `backend/src/index.ts`
2. CSP `frame-ancestors: 'none'` present
3. CORS does not allow `*` in production mode
4. Error handler does not pass raw error messages to response body
5. `bodyLimit` configured on Fastify instance

---

## 5. Org Governance

**Issue:** [#38](https://github.com/whizbangdevelopers-org/Weaver-Dev/issues/38)
**Status:** First pass ~90% complete (2026-02-21)

**What was found already in place:**
- CONTRIBUTING.md exists with full contributor guide
- Issue templates configured (bug report, feature request)
- PR template configured
- CHANGELOG.md maintained
- LICENSE file with correct terms

**What was fixed (2026-02-21):**
- CODE_OF_CONDUCT.md created (Contributor Covenant v2.1)

**Remaining manual items (see USER-ACTION-ITEMS.md):**
- Set repo topics on Dev and Free repos
- Set repo descriptions on Dev and Free repos
- Configure GitHub Discussions (post-launch)
- Verify issue templates render on Free repo after sync

**Automation potential:** Limited — most remaining tasks are one-time GitHub UI actions. A GitHub API-based agent could verify settings are correct but can't set them without appropriate permissions.

---

## Automated Verification Scripts

| Script | npm command | Domain | What it checks |
|--------|-------------|--------|----------------|
| `verify-legal-ip.ts` | `npm run audit:legal` | 1 | LICENSE layers, package.json, copyright notices, demo deploy, AI crawlers |
| `verify-route-auth.ts` | `npm run audit:routes` | 4 | Route auth (requireRole), tier gates, rate limiting across 68 routes |
| `verify-post-release.ts` | `npm run verify:release` | 2,3 | GitHub release, free repo sync, demo site, API spot checks |
| `verify-form-rules.ts` | `npm run audit:forms` | — | Form validation compliance (rules, lazy-rules) |
| `verify-form-e2e-coverage.ts` | `npm run audit:e2e-coverage` | — | E2E test coverage for form validation paths |

---

## Relationship to Existing Audits

| Existing | Scope | Gap |
|----------|-------|-----|
| Phase 6 security hardening (1675b0b) | Code-level: validation, auth, rate limiting | Missed: licensing, secrets, org settings |
| SHA pinning (d94971d) | All 40 Actions refs across 10 workflows | Fastify vuln fix deferred (needs major version bump) |
| `npm run test:security` | Frontend `npm audit` only | Missing: backend audit, unused deps |
| QA form validation audit | Form rules + E2E coverage | Unrelated to security domains |
| Pre-commit hooks | Lint + typecheck | No security scanning |

---

*Cross-reference: [USER-ACTION-ITEMS.md](USER-ACTION-ITEMS.md) | [EXECUTION-ROADMAP.md](EXECUTION-ROADMAP.md) | [GTM-LAUNCH-PLAN.md](GTM-LAUNCH-PLAN.md)*
