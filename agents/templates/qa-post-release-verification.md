<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: QA — Post-Release Verification

**Priority:** Release infrastructure
**Tier:** All
**Parallelizable:** Yes (independent)
**Plan:** Automates the 30+ item manual post-release checklist in `testing/post-release/README.md`

---

## Scope

Automated post-release verification that runs after every release tag push. Checks GitHub Release state, free repo sync completeness, demo site functionality, and NixOS module status. Replaces the manual checklist with a single script that reports pass/fail across all verification domains.

**Current state:** Partial bash script (`post-release-verify.sh`) covers 3 checks. Full checklist is 30+ items requiring manual browser testing, CLI commands, and visual inspection.

**Target:** Automate ~80% of the checklist via `gh` CLI, `curl`, and GitHub API. Remaining ~20% requires manual visual/interaction testing (documented as manual steps in the report).

### What's Already Done

- `testing/post-release/post-release-verify.sh` — checks release exists, free repo version, demo HTTP 200
- `testing/post-release/README.md` — full manual checklist
- `release-agent.md` template — 15-step release procedure (manual)

### What This Agent Replaces

- Manual `gh release view` command
- Manual free repo sync verification
- Manual excluded file checks
- Manual demo site HTTP status check
- Manual API endpoint spot checks

### What Remains Manual (documented in report)

- Demo site visual testing (5 VMs render, mobile layout correct)
- Demo site interaction testing (login, actions, WebSocket indicator)
- Console error inspection (browser DevTools)
- NixOS service status (requires host access)

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `testing/post-release/README.md` | Full checklist — source of truth for verification items |
| `testing/post-release/post-release-verify.sh` | Existing partial script — extend, don't duplicate |
| `.github/workflows/sync-to-free.yml` | Excluded file list — must verify these are absent from free repo |
| `.github/workflows/demo-deploy.yml` | Demo site deployment — verify deployment target |
| `release-agent.md` | Release procedure context |

---

## Outputs

### Script

| File | Type | Description |
|------|------|-------------|
| `scripts/verify-post-release.ts` | New | Comprehensive post-release verification — replaces partial bash script |

### Config

| File | Type | Description |
|------|------|-------------|
| `package.json` | Modify | Add `verify:release` npm script |

---

## Design

### Verification Domains

#### Domain 1: GitHub Release (automated)

| Check | Method | Pass Criteria |
|-------|--------|--------------|
| Release exists for tag | `gh release view v{version}` | Exit 0 |
| Release is not draft | `gh release view --json isDraft` | `isDraft: false` |
| Release is not pre-release | `gh release view --json isPrerelease` | `isPrerelease: false` |
| Release title matches version | `gh release view --json name` | Contains version string |
| Release body is non-empty | `gh release view --json body` | Body length > 50 chars |
| Release has changelog content | `gh release view --json body` | Contains "## " (markdown headers) |

#### Domain 2: Free Repo Sync (automated)

| Check | Method | Pass Criteria |
|-------|--------|--------------|
| Free repo has latest commit | `gh api repos/.../commits/main` | Commit message contains version or sync reference |
| Version matches | `gh api repos/.../contents/package.json` | Version in package.json matches release tag |
| LICENSE present | `gh api repos/.../contents/LICENSE` | HTTP 200 |
| Excluded files absent | `gh api repos/.../contents/{file}` for each excluded path | HTTP 404 for all |

**Excluded files to verify absent:**
- `CLAUDE.md`
- `.github/workflows/sync-to-free.yml`
- `docs/planning/` (directory)
- `docs/workflows/CLAUDEMD-GENERATOR-PROMPT.md`
- `docs/setup/MCP-TOOLING-SETUP.md`

#### Domain 3: Demo Site (automated + manual)

**Automated:**
| Check | Method | Pass Criteria |
|-------|--------|--------------|
| Site responds | `curl -s -o /dev/null -w "%{http_code}" https://weaver-demo.github.io` | HTTP 200 |
| Site has content | `curl -s https://weaver-demo.github.io` | HTML contains "MicroVM" |
| robots.txt present | `curl -s https://weaver-demo.github.io/robots.txt` | Contains "GPTBot" |
| LICENSE present | `curl -s https://weaver-demo.github.io/LICENSE` | Contains "AGPL" |
| noai meta tag present | `curl -s https://weaver-demo.github.io` | Contains `content="noai` |

**Manual (reported as checklist):**
- [ ] Demo login page renders correctly
- [ ] Can enter demo mode
- [ ] 5+ sample VMs visible on dashboard
- [ ] VM actions work (start/stop/restart)
- [ ] WebSocket connected indicator shows green
- [ ] No JavaScript console errors
- [ ] Mobile layout renders correctly (resize browser)
- [ ] Tier switcher toggles Weaver Free/Weaver/Fabrick correctly

#### Domain 4: API Spot Checks (conditional — requires host access)

These checks only run if `--host` flag is provided (for NixOS deployment verification):

| Check | Method | Pass Criteria |
|-------|--------|--------------|
| Health endpoint | `curl http://localhost:3100/api/health` | `{ "status": "ok" }` |
| VM list | `curl http://localhost:3100/api/vms` (with auth) | Returns array |
| Auth setup-required | `curl http://localhost:3100/api/auth/setup-required` | Returns boolean |
| 404 handling | `curl http://localhost:3100/api/nonexistent` | HTTP 404, no stack trace |
| 400 handling | `curl -X POST http://localhost:3100/api/vms` (no body) | HTTP 400, Zod error |

### Output Format

```
Post-Release Verification: v1.0.0
===================================

GITHUB RELEASE:
  ✓ Release exists for v1.0.0
  ✓ Not draft, not pre-release
  ✓ Title: "Weaver v1.0.0"
  ✓ Body contains changelog content (847 chars)

FREE REPO SYNC:
  ✓ Version matches: 1.0.0
  ✓ LICENSE present
  ✓ CLAUDE.md absent (correctly excluded)
  ✓ sync-to-free.yml absent (correctly excluded)
  ✓ docs/planning/ absent (correctly excluded)
  ✗ docs/workflows/CLAUDEMD-GENERATOR-PROMPT.md PRESENT (should be excluded!)

DEMO SITE:
  ✓ HTTP 200 at https://weaver-demo.github.io
  ✓ Page contains "MicroVM"
  ✓ robots.txt blocks AI crawlers
  ✓ LICENSE present in build
  ✓ noai meta tag present
  ⚠ Manual checks required (see checklist below)

API SPOT CHECKS:
  ⊘ Skipped (use --host to enable)

MANUAL VERIFICATION CHECKLIST:
  [ ] Demo login page renders correctly
  [ ] Can enter demo mode
  [ ] 5+ sample VMs visible on dashboard
  ...

RESULT: 14/15 automated checks passed, 1 FAILED
```

Exit code: 0 = all automated checks pass, 1 = any automated check fails.

---

## CLI Options

| Flag | Description |
|------|-------------|
| `--version <ver>` | Version to verify (required) |
| `--host <url>` | Enable API spot checks against a running instance (e.g., `http://localhost:3100`) |
| `--json` | Output as JSON instead of formatted text |
| `--skip-demo` | Skip demo site checks (if demo not yet deployed) |

---

## Safety Rules

1. Script is read-only — never modifies any repository or deployment
2. Uses `gh api` for GitHub checks — respects rate limits
3. Uses `curl` for HTTP checks — read-only GET requests
4. No authentication tokens stored or transmitted (uses existing `gh` auth)
5. Exit codes: 0 = all pass, 1 = failures found

---

## Acceptance Criteria

1. `npx tsx scripts/verify-post-release.ts --version 1.0.0` runs all automated checks
2. GitHub Release domain correctly detects draft/pre-release/missing states
3. Free repo sync domain correctly identifies excluded files that leaked
4. Demo site domain correctly checks HTTP status, content, and AI protections
5. Manual checklist is always printed regardless of automated results
6. Script exits non-zero when any automated check fails
7. `npm run verify:release -- --version 1.0.0` works as npm script

---

## E2E Notes

- **E2E impact:** None — read-only verification tool
- **Temp resources:** None
- **Cleanup:** None

---

## Documentation

| Target | Updates |
|--------|---------|
| `testing/post-release/README.md` | Reference the new script, note which manual items it replaces |
| `docs/DEVELOPER-GUIDE.md` | Add "Post-Release Verification" under Release Process |
| `CLAUDE.md` | Add `verify:release` to Key Commands |
