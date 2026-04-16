<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# GitHub Features Checklist

Comprehensive checklist of GitHub features used and their configuration status for the Weaver project.

## Repository Settings

### General

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Repository visibility | Private (Dev) / Public (Free) | Intentional split |
| Default branch | `main` | Standard convention |
| Template repository | No | Not a template |
| Sponsorship | Not configured | Consider for Free repo |
| Social preview image | Not set | Add project screenshot |
| Topics/Tags | Not set | Add: `nixos`, `microvm`, `dashboard`, `quasar`, `vue3` |
| Description | Set | "NixOS MicroVM Management Dashboard" |
| Website URL | Set | Link to demo site |

### Features Toggles

| Feature | Enabled | Notes |
| ------- | ------- | ----- |
| Wikis | Disabled | Use `docs/` instead |
| Issues | Enabled | Primary issue tracker |
| Discussions | Enabled | For questions and ideas |
| Projects | Available | Not actively used |
| Preserve this repository | Not set | Consider for archival |

### Pull Requests

| Feature | Setting | Notes |
| ------- | ------- | ----- |
| Allow merge commits | Yes | Default merge strategy |
| Allow squash merging | Yes | For multi-commit PRs |
| Allow rebase merging | No | Disabled for cleaner history |
| Auto-delete head branches | Yes | Clean up after merge |
| Allow auto-merge | Yes | For Dependabot PRs |

## Branch Protection

### `main` Branch

| Rule | Configured | Notes |
| ---- | ---------- | ----- |
| Require pull request | Yes | No direct push to main |
| Required approving reviews | 1 | Single reviewer sufficient |
| Dismiss stale reviews | Yes | Re-review after new pushes |
| Require review from code owners | No | No CODEOWNERS file yet |
| Require status checks | Yes | CI must pass |
| Required checks: `test` | Yes | Unit tests |
| Required checks: `lint` | Yes | ESLint |
| Required checks: `typecheck` | Yes | TypeScript |
| Required checks: `build` | Yes | SPA build |
| Require branches to be up to date | Yes | Must be current |
| Require signed commits | No | Not enforced |
| Require linear history | No | Merge commits allowed |
| Include administrators | Yes | No exceptions |
| Restrict push access | No | Via PR only |
| Allow force pushes | No | Disabled |
| Allow deletions | No | Cannot delete main |

## Security

| Feature | Configured | Notes |
| ------- | ---------- | ----- |
| Dependabot alerts | Yes | Automatic |
| Dependabot security updates | Yes | Auto-PRs for vulnerabilities |
| Dependabot version updates | Yes | `.github/dependabot.yml` |
| Secret scanning | Yes | Detects exposed secrets |
| Push protection | Yes | Blocks secret commits |
| CodeQL analysis | Yes | JavaScript/TypeScript scanning |
| Private vulnerability reporting | Yes | Settings > Security |
| Security policy | Yes | `SECURITY.md` |
| Security advisories | Available | Create as needed |

## GitHub Actions

### Workflow Files

| Workflow | File | Status |
| -------- | ---- | ------ |
| CI Tests | `.github/workflows/test.yml` | Active |
| Release | `.github/workflows/release.yml` | Active |
| Sync to Free | `.github/workflows/sync-to-free.yml` | Active |
| CodeQL | `.github/workflows/codeql.yml` | Active |
| Security Scan | `.github/workflows/security-scan.yml` | Active |
| Stale Issues | `.github/workflows/stale.yml` | Active |

### Actions Settings

| Setting | Value | Notes |
| ------- | ----- | ----- |
| Actions permissions | Allow all actions | Default |
| Workflow permissions | Read only (default) | Each workflow specifies needs |
| Required workflows | None | Not using org-level required workflows |
| Runners | GitHub-hosted | `ubuntu-latest` |

## Templates

| Template | File | Status |
| -------- | ---- | ------ |
| Bug report | `.github/ISSUE_TEMPLATE/bug_report.yml` | Active |
| Feature request | `.github/ISSUE_TEMPLATE/feature_request.yml` | Active |
| Config | `.github/ISSUE_TEMPLATE/config.yml` | Active |
| PR template | `.github/PULL_REQUEST_TEMPLATE.md` | Active |

## Labels

| Label | Created | Color |
| ----- | ------- | ----- |
| `bug` | Yes | `#d73a4a` |
| `feature` | Yes | `#a2eeef` |
| `documentation` | Yes | `#0075ca` |
| `dependencies` | Yes | `#0366d6` |
| `security` | Yes | `#ee0701` |
| `blocked` | To create | `#b60205` |
| `in-progress` | To create | `#fbca04` |
| `nixos` | To create | `#7057ff` |
| `backend` | To create | `#1d76db` |
| `frontend` | To create | `#0e8a16` |
| `demo` | To create | `#c5def5` |

## Integrations

| Integration | Status | Purpose |
| ----------- | ------ | ------- |
| Dependabot | Active | Dependency updates |
| CodeQL | Active | Security scanning |
| GitHub Pages | Active (Demo repo) | Demo site hosting |

## Not Using (Intentional)

| Feature | Reason |
| ------- | ------ |
| GitHub Wiki | Using `docs/` directory instead |
| GitHub Projects | Using `docs/planning/` for planning |
| GitHub Packages | Not publishing npm packages |
| GitHub Container Registry | Not publishing Docker images yet |
| GitHub Copilot | Not configured at org level |
| CODEOWNERS | Single-developer project currently |
| Required workflows (org-level) | Not needed |
| Environments | Not using deployment environments yet |
| Rulesets | Using branch protection instead |

## Configuration Checklist (New Repository Setup)

When setting up a new repository in the org that follows the same pattern:

- [ ] Set repository description and website URL
- [ ] Configure branch protection on `main`
- [ ] Enable Dependabot alerts and security updates
- [ ] Enable secret scanning and push protection
- [ ] Enable CodeQL analysis
- [ ] Add issue templates
- [ ] Add PR template
- [ ] Configure auto-delete branches
- [ ] Add `.github/dependabot.yml`
- [ ] Create custom labels
- [ ] Add required secrets to Actions
- [ ] Enable Discussions (if desired)
- [ ] Add `SECURITY.md`
- [ ] Add `CONTRIBUTING.md`
