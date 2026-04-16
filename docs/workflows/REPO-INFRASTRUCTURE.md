<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Repository Infrastructure

GitHub features, configurations, and repository structure for Weaver.

## Repository Structure

Weaver uses a three-repository model:

| Repository | Visibility | Purpose | URL |
| ---------- | ---------- | ------- | --- |
| Weaver-Dev | Private | Development (primary) | `github.com/whizbangdevelopers-org/Weaver-Dev` |
| Weaver | Public | Free mirror | `github.com/whizbangdevelopers-org/Weaver-Free` |
| weaver-demo.github.io | Public | Live demo (GitHub Pages) | `weaver-demo.github.io` |

### Dev Repository (Private)

The primary development repository. All development happens here.

- Contains all source code, documentation, and CI/CD configuration.
- Includes internal planning documents, CLAUDE.md, and MCP tooling setup.
- Workflows sync to the Free and Demo repos on release.

### Free Repository (Public)

The public mirror for community access.

- Synced automatically from Dev via `sync-to-free.yml`.
- Excludes internal planning documents and developer tooling configuration.
- Accepts community issues and discussions.
- Does not accept direct PRs (contributors should submit PRs to Dev).

### Demo Repository (Public)

GitHub Pages site for the live demo.

- Contains only built static assets (SPA output).
- Deployed automatically on release.
- Runs in demo mode with mock VM service and hCaptcha gating.

## Branch Protection

### `main` Branch Rules

| Rule | Setting | Notes |
| ---- | ------- | ----- |
| Require PR reviews | 1 approval | At least one maintainer must approve |
| Require status checks | Yes | All CI checks must pass |
| Required checks | `test`, `lint`, `typecheck`, `build` | Must pass before merge |
| Require up-to-date branches | Yes | Branch must be current with `main` |
| Include administrators | Yes | Rules apply to admins too |
| Allow force pushes | No | Disabled for safety |
| Allow deletions | No | Cannot delete `main` |

### Configuring Branch Protection

Go to **Settings > Branches > Branch protection rules > Add rule**:

1. Branch name pattern: `main`
2. Enable all settings listed above
3. Save changes

## Security Features

| Feature | Status | Configuration |
| ------- | ------ | ------------- |
| Secret scanning | Enabled | Settings > Security > Secret scanning |
| Push protection | Enabled | Blocks commits containing secrets |
| Dependabot alerts | Enabled | Automatic vulnerability notifications |
| Dependabot updates | Enabled | `.github/dependabot.yml` |
| CodeQL scanning | Enabled | `.github/workflows/codeql.yml` |
| Private vulnerability reporting | Enabled | Settings > Security |

## Required Secrets

| Secret | Used By | Scope |
| ------ | ------- | ----- |
| `GIST_TOKEN` | `test.yml` | PAT with `gist` scope |
| `TEST_BADGE_GIST_ID` | `test.yml` | Gist ID string |
| `HCAPTCHA_SECRET` | Demo deployment | hCaptcha secret key |
| `HCAPTCHA_SITEKEY` | Demo deployment | hCaptcha site key |
| `SYNC_TOKEN` | `sync-to-free.yml` | PAT with `repo` scope for pushing to free repo |

## Webhook Configuration

No external webhooks are configured. All automation runs through GitHub Actions.

## Workflows

| Workflow | File | Trigger | Purpose |
| -------- | ---- | ------- | ------- |
| Tests | `test.yml` | Push to `main`, PRs | Lint, typecheck, unit tests, build |
| Release | `release.yml` | Tag push (`v*`) | Build and create GitHub Release |
| Sync to Free | `sync-to-free.yml` | Push to `main`, manual | Sync Dev to Free repo (PR-based) |
| CodeQL | `codeql.yml` | Push to `main`, schedule | Security code scanning |
| Dependabot Labeler | `dependabot-labeler.yml` | Dependabot PR opened | Auto-triage: ready/blocked/review |
| Dependabot Tracker | `dependabot-tracker.yml` | Push to `main`, Dependabot PRs | Update tracking issue #39 |
| Version Drift Check | `version-drift-check.yml` | Monthly schedule, manual | Check if blocked deps can be unblocked |
| Demo Reset | `demo-reset.yml` | Schedule, manual | Reset demo site data |
| Stale | `stale.yml` | Schedule (daily) | Auto-close inactive issues |

See [DEPENDENCY-MANAGEMENT.md](DEPENDENCY-MANAGEMENT.md) for the full dependency triage pipeline.

## Issue/PR Templates

| Template | File | Purpose |
| -------- | ---- | ------- |
| Bug report | `.github/ISSUE_TEMPLATE/bug_report.yml` | Structured bug reports |
| Feature request | `.github/ISSUE_TEMPLATE/feature_request.yml` | Feature proposals |
| Template config | `.github/ISSUE_TEMPLATE/config.yml` | Issue template configuration |
| PR template | `.github/PULL_REQUEST_TEMPLATE.md` | Pull request description |

## Labels

| Label | Color | Description |
| ----- | ----- | ----------- |
| `bug` | `#d73a4a` | Something is not working |
| `feature` | `#a2eeef` | New feature request |
| `documentation` | `#0075ca` | Documentation updates |
| `dependencies` | `#0366d6` | Dependency updates |
| `security` | `#ee0701` | Security-related |
| `blocked` | `#b60205` | Blocked by external factor |
| `in-progress` | `#fbca04` | Work in progress |
| `nixos` | `#7057ff` | NixOS-specific |
| `backend` | `#1d76db` | Backend/API changes |
| `frontend` | `#0e8a16` | Frontend/UI changes |
| `demo` | `#c5def5` | Demo mode related |
| `automated` | `#bfdadc` | Bot-generated PR |
| `ci-cd` | `#d4c5f9` | CI/CD and GitHub Actions |
| `ready-to-merge` | `#0e8a16` | Reviewed and safe to merge |
| `needs-review` | `#fbca04` | Requires manual review |
| `blocked-by-quasar` | `#b60205` | Waiting for framework compatibility |

## Automation

| Feature | Status | Configuration |
| ------- | ------ | ------------- |
| Dependabot updates | Enabled | `.github/dependabot.yml` |
| Dependabot auto-triage | Enabled | `.github/workflows/dependabot-labeler.yml` |
| Dependabot tracking | Enabled | `.github/workflows/dependabot-tracker.yml` + issue #39 |
| Version drift alerts | Enabled | `.github/workflows/version-drift-check.yml` (monthly) |
| Security audit filter | Enabled | `scripts/audit-security.ts` (filters blocked deps) |
| Stale bot | Enabled | `.github/workflows/stale.yml` |
| Dev-to-Free sync | Enabled | `.github/workflows/sync-to-free.yml` (PR-based) |
| Auto-delete branches | Enabled | Settings > General |

See [DEPENDENCY-MANAGEMENT.md](DEPENDENCY-MANAGEMENT.md) for the full pipeline documentation.
