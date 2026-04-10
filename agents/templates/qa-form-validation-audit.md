<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: QA — Form Validation Audit

**Priority:** Cross-cutting (QA tooling)
**Tier:** All
**Parallelizable:** Yes (independent)
**Plan:** Quality infrastructure — not tied to a specific roadmap phase

---

## Scope

Automated verification that all Quasar form fields follow project validation standards. Two scripts scan the codebase and report compliance issues and E2E coverage gaps.

**Standards enforced:**
1. All QInput/QSelect inside forms/dialogs must have `:rules` (or be explicitly optional)
2. All forms use `lazy-rules` (preferred mode — flag greedy as non-compliant)
3. Shared validation utils (`src/utils/validation.ts`) used where applicable
4. Consistent trigger pattern: `ref.validate()` + `hasError` or `<q-form @submit>`

### What's Already Done

- Shared validation utilities in `src/utils/validation.ts` (isValidIPv4, isHostIPv4, nameNotInUse, ipOnBridgeSubnet, ipNotInUse)
- Inline validation on all network dialogs (Phase 5d)
- E2E tests for bridge, firewall, IP pool, VM config validation
- `.claude/rules/frontend.md` mandates inline validation on dialog forms

### What's Missing

- No automated way to detect validation drift or missing rules
- No E2E coverage map for validation paths
- Several older forms still use greedy validation (CreateVmDialog, AddVmDialog, LoginPage, SettingsPage)
- Some components duplicate shared validation logic inline

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `src/utils/validation.ts` | Shared validation functions — the gold standard |
| `src/components/premium/network/BridgeManager.vue` | Exemplar of preferred lazy-rules + validate() + hasError pattern |
| `testing/e2e/network.spec.ts` | Best existing form validation E2E tests |
| `testing/e2e/helpers/index.ts` | E2E helper module pattern |

---

## Outputs

### Scripts

| File | Type | Description |
|------|------|-------------|
| `scripts/verify-form-rules.ts` | New | Static analysis scanner — parses Vue SFCs, audits all form fields |
| `scripts/verify-form-e2e-coverage.ts` | New | E2E coverage gap checker — cross-references rules against E2E specs |

### Tests

| File | Type | Description |
|------|------|-------------|
| `testing/e2e/helpers/form-validation.ts` | New | Shared helpers for form validation E2E tests |
| `testing/e2e/form-validation.spec.ts` | New | Gap-filling E2E spec for uncovered validation paths |

### Config

| File | Type | Description |
|------|------|-------------|
| `package.json` | Modify | Add `audit:forms` and `audit:e2e-coverage` npm scripts |

---

## CRUD Completeness Check

N/A — this is a QA tooling agent, not a feature agent.

---

## All Endpoints Affected

**Not affected:** No endpoints modified. This agent is read-only tooling.

---

## Design

### Static Scanner Algorithm

1. Glob `src/**/*.vue` to discover all Vue SFCs
2. Parse each SFC with `@vue/compiler-sfc`
3. Compile template to AST with `@vue/compiler-dom`
4. Walk AST (including v-if branches) for `q-input`/`q-select` nodes
5. For each: check `:rules` prop, `lazy-rules` attr, label text
6. Analyze `<script setup>` for validation imports and duplicate patterns
7. Classify fields as compliant, greedy, missing-rules, duplicate, or exempt
8. Output console report or JSON

### E2E Coverage Checker

1. Run static scanner to get all form fields and their error messages
2. Extract error message strings from `:rules` expressions
3. Scan `testing/e2e/*.spec.ts` for `toContainText` assertions
4. Match error messages against E2E assertions
5. Report coverage percentage and gap list

---

## Flow Notes

Scanner reads source files only — no runtime, no API calls, no side effects.
E2E gap checker calls the scanner internally, then reads E2E spec files.
Both scripts exit non-zero when issues/gaps are found (CI-friendly).

---

## Safety Rules

1. Scripts are read-only — they never modify source files
2. Scanner tolerates compilation errors in complex templates (skips with warning)
3. Exit codes: 0 = all clean, 1 = issues found (useful for CI gates)

---

## Acceptance Criteria

1. `npx tsx scripts/verify-form-rules.ts` reports all forms with correct field counts
2. Scanner correctly identifies greedy, duplicate, and missing-rules issues
3. `npx tsx scripts/verify-form-e2e-coverage.ts` shows coverage percentage and gap list
4. `testing/e2e/form-validation.spec.ts` passes in Docker E2E
5. `npm run test:precommit` passes

---

## Tier Blind Spot Mitigation

No blind spot — scanner works at all tiers (it reads source code, not runtime).
E2E spec runs at Weaver tier where all forms are accessible.
QuotaSection is enterprise-only in production but visible at Weaver in E2E.

---

## E2E Notes

- **Temp resources:** form-validation.spec.ts does NOT create/modify VMs or users — it only tests client-side validation (dialog stays open on error)
- **Shared state risk:** None — tests fill invalid data and verify error messages without submitting
- **Environment gaps:** LoginPage setup-mode password mismatch not testable (E2E starts post-setup). QuotaSection not easily testable (enterprise UI behind admin config).
- **Cleanup:** No cleanup needed — no state mutations

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Add "Form Validation Audit" section under Development Tools |
| `CLAUDE.md` | Add `audit:forms` and `audit:e2e-coverage` to Key Commands |
