<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: Security — Legal & IP Audit

**Priority:** Cross-cutting (security infrastructure)
**Tier:** All
**Parallelizable:** Yes (independent)
**Plan:** Security audit domain 1 — [Issue #34](https://github.com/whizbangdevelopers-org/Weaver-Dev/issues/34)

---

## Scope

Automated verification that licensing, copyright notices, and AI training protections are correctly applied across all repos and deployment targets. Re-runnable scan to catch regressions.

**Standards enforced:**
1. LICENSE file exists at repo root with all three layers (AGPL-3.0 + Commons Clause + AI Training Restriction)
2. Every `package.json` has `"license": "SEE LICENSE IN LICENSE"`
3. Copyright notice appears on every user-facing page entry point
4. Demo build includes LICENSE + robots.txt + noai meta tags
5. Free repo sync includes LICENSE (not in exclude list)
6. Every source file has a copyright header (run `./scripts/add-copyright-headers.sh --check` from project root)

### What's Already Done

- LICENSE file with AGPL-3.0 + Commons Clause + AI Training Restriction (3eb4ac9)
- Copyright in MainLayout sidebar footer, HelpPage, DemoLoginPage (3eb4ac9)
- Demo `robots.txt` blocks 13 AI crawlers (3eb4ac9)
- Demo deploy injects `<meta name="robots" content="noai, noimageai">` via sed (3eb4ac9)
- LICENSE syncs to Free repo (not in sync exclude list) (3eb4ac9)
- `package.json` + `backend/package.json` license field updated (3eb4ac9)

### What This Agent Catches on Re-Scan

- New pages added without copyright notices
- LICENSE file accidentally modified or deleted
- package.json license field changed (e.g., during npm init or package manager update)
- New demo deploy steps that skip LICENSE/robots.txt
- sync-to-free.yml changes that accidentally exclude LICENSE
- New AI crawlers not covered by robots.txt
- New source files added without copyright headers
- Code files with wrong copyright flavor (Proprietary instead of AGPL, or vice versa)

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `LICENSE` | Source of truth — verify three-layer structure |
| `package.json` | License field must say "SEE LICENSE IN LICENSE" |
| `backend/package.json` | Same license field check |
| `src/layouts/MainLayout.vue` | Copyright in sidebar drawer footer |
| `src/pages/HelpPage.vue` | Copyright below help content |
| `src/pages/DemoLoginPage.vue` | Copyright below demo entry card |
| `.github/workflows/demo-deploy.yml` | Verify LICENSE copy, robots.txt copy, noai meta injection |
| `.github/workflows/sync-to-free.yml` | Verify LICENSE not in exclude list |
| `demo/robots.txt` | AI crawler block rules |

---

## Outputs

### Script

| File | Type | Description |
|------|------|-------------|
| `scripts/verify-legal-ip.ts` | New | Static scanner — checks all legal/IP compliance criteria |

### Config

| File | Type | Description |
|------|------|-------------|
| `package.json` | Modify | Add `audit:legal` npm script |

---

## CRUD Completeness Check

N/A — this is a security audit agent, not a feature agent.

---

## All Endpoints Affected

**Not affected:** No endpoints modified. This agent is read-only scanning.

---

## Design

### Scanner Algorithm

1. **LICENSE file check:**
   - Verify file exists at repo root
   - Verify contains "Commons Clause" text
   - Verify contains "AI Training Restriction" text
   - Verify contains "GNU AFFERO GENERAL PUBLIC LICENSE" text
   - Verify contains correct copyright holder

2. **package.json license field check:**
   - Read `package.json` — verify `license` === `"SEE LICENSE IN LICENSE"`
   - Read `backend/package.json` — same check

3. **Copyright notice scan:**
   - Glob `src/pages/*.vue` + `src/layouts/*.vue` to find all user-facing entry points
   - For each file, check for copyright text pattern (`whizBANG Developers LLC` or `©`)
   - Known exempted pages: ErrorNotFound.vue, IndexPage.vue (redirects)
   - Report pages missing copyright with file:line guidance

4. **Demo deploy workflow check:**
   - Parse `demo-deploy.yml`
   - Verify step exists that copies LICENSE to dist
   - Verify step exists that copies robots.txt to dist
   - Verify sed command injects noai meta tag

5. **Free repo sync check:**
   - Parse `sync-to-free.yml`
   - Verify LICENSE is NOT in the rm/exclude list

6. **AI crawler robots.txt check:**
   - Parse `demo/robots.txt`
   - Verify known AI crawlers are blocked: GPTBot, ClaudeBot, CCBot, Google-Extended, Bytespider
   - Flag if new well-known AI crawlers are missing

### Output

Console report with pass/fail for each criterion. JSON output optional.
Exit code: 0 = all pass, 1 = issues found.

---

## Flow Notes

Scanner reads source files only — no runtime, no API calls, no side effects.
All checks are string/regex based — no compilation needed.
Can run as part of CI or on-demand via `npm run audit:legal`.

---

## Safety Rules

1. Script is read-only — never modifies source files
2. Exit codes: 0 = all clean, 1 = issues found (CI-friendly)
3. Does not access GitHub API — only checks local files

---

## Acceptance Criteria

1. `npx tsx scripts/verify-legal-ip.ts` reports pass/fail for all 6 criteria
2. Scanner correctly identifies pages missing copyright notices
3. Scanner detects if LICENSE is incomplete (missing a layer)
4. Scanner detects if sync-to-free excludes LICENSE
5. `npm run audit:legal` runs clean on current codebase

---

## Tier Blind Spot Mitigation

No blind spot — scanner works at all tiers (reads source files, not runtime).
Demo-specific checks (robots.txt, deploy workflow) are only relevant to the demo deployment target.

---

## E2E Notes

- **E2E impact:** None — this is a static analysis tool
- **Temp resources:** None created
- **Cleanup:** None needed

---

## Documentation

| Target | Updates |
|--------|---------|
| `docs/DEVELOPER-GUIDE.md` | Add "Legal & IP Audit" under Development Tools |
| `CLAUDE.md` | Add `audit:legal` to Key Commands |
