<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Testing Maturity Roadmap — Path to A+

**Last updated:** 2026-03-08
**Current grade:** A (up from A-)
**Target grade:** A+

Cross-reference: [TESTING-ASSESSMENT.md](TESTING-ASSESSMENT.md) | [LOAD-TESTING-PLAN.md](../../plans/cross-version/LOAD-TESTING-PLAN.md)

---

## Current Scorecard

| Dimension | Rating | Status |
|-----------|--------|--------|
| Testing Pyramid Shape | A | Stable |
| Static Analysis Depth | A+ | Stable |
| E2E Isolation | A | Stable |
| Tier/Feature Parity Enforcement | A+ | Stable |
| Security Testing | B+ → A | Phase 1 |
| Gate Enforcement | B+ → A | Phase 1 |
| Coverage & Audit Trail | A- → A | Phase 1 |
| Cross-Browser Testing | A | Done (Phase 2) |
| Mutation Testing | B → A | Phase 2 |
| Reproducibility | B → A | Phase 1 |
| Performance / Load Testing | C+ → A | Phase 3 |

---

## Phase 1: Quick Wins (B+ → A, no new infra)

### 1. Gate Enforcement — B+ → A
**What:** Add GitHub Actions CI workflow as PR merge gate
**Delivered:** `.github/workflows/ci.yml` running `test:prepush` on every PR
**Why A:** Dual-gate (local hooks + CI) matches enterprise standard

### 2. Security Testing — B+ → A
**What:** Add dependency license auditing + SAST scanning
**Delivered:**
- `audit:license` — scans all deps for copyleft/blocked licenses (GPL, AGPL, SSPL)
- `audit:sast` — regex-based OWASP pattern scanning (command injection, XSS, SQL injection, hardcoded secrets, eval, path traversal, prototype pollution)
- Both added to `test:compliance` chain
**Why A:** Custom auditor + license audit + SAST = exceeds "npm audit or Snyk" baseline

### 3. Coverage & Audit Trail — A- → A
**What:** Set enforced coverage thresholds at actual measured values
**Delivered:** Vitest thresholds set to current actuals minus buffer (regression gate, not aspirational)
**Why A:** Enforced thresholds in CI = matches "Codecov with thresholds" standard

### 4. Reproducibility — B → A
**What:** Pin Node version + lockfile integrity verification
**Delivered:**
- `.nvmrc` with Node 24
- `audit:lockfile` — verifies lockfile version, dependency completeness
- Added to `test:compliance` chain
**Why A:** Pinned versions + lockfile verification + deterministic Docker = hermetic

---

## Phase 2: Maturity Lift (B → A, moderate effort)

### 5. Cross-Browser Testing — B+ → A ✓
**What:** Full 5-browser E2E suite passing (Chromium + Firefox + WebKit + Mobile Chrome + Mobile Safari)
**Delivered:**
- Fixed mobile viewport drawer visibility (added `ensureDrawerOpen` helper)
- Fixed Firefox/WebKit localStorage hydration race (reload after goto)
- Fixed WebKit Q-select timing (target `.q-field__control` instead of label)
- Added mobile viewport detection (`isMobileViewport` helper) — skip hover/complex-form tests on touch devices
- All 5 browser projects pass with 0 failures via `npm run e2e:browsers`
**Why A:** 5 browsers all passing, mobile-aware test helpers, exceeds "2-3 browsers mandatory"

### 6. Mutation Testing — B → A
**What:** Extend mutation testing to backend + enforce score threshold
**Action:**
- Create `backend/stryker.config.mjs` targeting backend services
- Add `test:mutation:backend` npm script
- Set break threshold at 50% initially
- Add mutation score report to CI (non-blocking → blocking)
**Why A:** Frontend + backend mutation coverage on critical paths = full Stryker adoption
**Effort:** Config + potential test gap fixes where mutation score is low

---

## Phase 3: The A+ Push (requires k6 execution)

### 7. Performance / Load Testing — C+ → A
**What:** Execute Phase 1 from LOAD-TESTING-PLAN.md + add Lighthouse CI
**Action:**
1. Write k6 scripts in `testing/load/k6/`:
   - API CRUD at scale (10/50/100/500/1000/5000 VM entries)
   - WebSocket connection scaling (10/50/200/500/1000 concurrent)
2. Run synthetic load against Fastify, store baselines at `testing/load/baselines/v1.0.0.json`
3. Add Lighthouse CI config (`.lighthouserc.js`):
   - Performance score ≥ 80
   - Accessibility score ≥ 90
   - Best practices ≥ 90
4. Add `npm run test:lighthouse` and `npm run test:load` scripts
**Why A:** Actual load test results + bundle budgets + Lighthouse CI = comprehensive perf coverage
**Effort:** Significant — writing k6 scripts, running tests, analyzing results, setting baselines
**Dependency:** No hardware upgrade needed for Phase 1 (synthetic only)

---

## Remaining A+ Items (post-Phase 3)

These are stretch goals that push individual dimensions from A to A+:

| Dimension | Current | A+ Requirement |
|-----------|---------|----------------|
| Security | A | SBOM generation (CycloneDX), container image scanning |
| Gate Enforcement | A | Branch protection rules, required reviewers, status checks |
| Reproducibility | A | Nix flake for build environment, fully hermetic CI |
| Cross-Browser | A | All browsers in default CI, visual regression testing |

---

## Auditor Inventory (post-Phase 1)

| # | Auditor | Script | In Compliance Chain |
|---|---------|--------|-------------------|
| 1 | Form validation | `audit:forms` | Yes |
| 2 | Route auth/tier | `audit:routes` | Yes |
| 3 | E2E coverage gaps | `audit:e2e-coverage` | Yes |
| 4 | Legal & IP | `audit:legal` | Yes |
| 5 | Doc freshness | `audit:doc-freshness` | Yes |
| 6 | Tier parity | `audit:tier-parity` | Yes |
| 7 | TUI parity | `audit:tui-parity` | Yes |
| 8 | CLI args | `audit:cli-args` | Yes |
| 9 | WS codes | `audit:ws-codes` | Yes |
| 10 | Bundle size | `audit:bundle` | Yes |
| 11 | License | `audit:license` | Yes |
| 12 | Lockfile | `audit:lockfile` | Yes |
| 13 | SAST | `audit:sast` | Yes |

**Manual-only (too slow for compliance chain):**
- `test:mutation` — Stryker mutation testing
- `test:mutation:quick` — Stryker on utils only
- `e2e:browsers` — Cross-browser E2E (Firefox + WebKit + mobile)
