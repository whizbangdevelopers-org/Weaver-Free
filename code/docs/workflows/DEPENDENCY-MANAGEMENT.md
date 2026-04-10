<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Dependency Management — Maintainer Guide

Human tasks for keeping dependencies current. For architecture and how the pipeline works, see the [Developer Guide](../DEVELOPER-GUIDE.md#dependency-management-pipeline).

---

## Weekly Tasks

Dependabot opens PRs every Monday at 9:00 AM Pacific.

### Merge `ready-to-merge` PRs

These are auto-labeled safe: GitHub Actions updates and npm minor/patch bumps.

1. Open [issue #39](https://github.com/whizbangdevelopers-org/Weaver-Dev/issues/39) — the "Ready to Merge" section lists them
2. Or filter PRs by label: `label:ready-to-merge`
3. Merge each PR (squash preferred)
4. The tracker workflow auto-updates #39 after merge

**Time:** ~5 minutes if no surprises.

### Triage `needs-review` PRs

These are major npm updates for packages NOT in the blocked list. The labeler couldn't auto-categorize them.

1. Open the PR, read the changelog for breaking changes
2. If safe: merge and close
3. If breaking: close with a comment explaining what needs to change first, or add to the blocked list (see [Reactive Tasks](#add-a-new-blocked-package) below)

**Time:** 5–15 minutes per PR depending on changelog size.

### Verify `blocked-by-quasar` PRs are still blocked

Glance at the "Blocked by Framework" section in #39. No action needed unless you know a framework release happened — if so, see [Monthly Tasks](#check-for-unblocked-dependencies).

---

## Monthly Tasks

The `version-drift-check.yml` workflow runs on the first Monday of each month. It may also be triggered manually via workflow_dispatch.

### Check for Unblocked Dependencies

**Automated notification:** If the drift check finds that Quasar's peer deps now accept a newer major version, it comments on #39 with the specifics.

When you receive a notification (or want to check manually):

1. Verify the claim — check [Quasar releases](https://github.com/quasarframework/quasar/releases) and `npm view quasar peerDependencies`
2. If confirmed, follow the [unblock procedure](#unblock-a-dependency)

**Time:** ~5 minutes to verify, 15–30 minutes to unblock if confirmed.

### Review Blocked List Freshness

Once a month, scan the blocked list for packages that may no longer need blocking:

1. Check [Fastify releases](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/) for v5 status
2. Check [Quasar releases](https://github.com/quasarframework/quasar/releases) for peer dep changes
3. If a constraint has lifted, follow the [unblock procedure](#unblock-a-dependency)

---

## Reactive Tasks

These happen in response to events, not on a schedule.

### Unblock a Dependency

Triggered by: version-drift-check comment on #39, or manual discovery.

1. **Remove from `BLOCKED_PACKAGES`** in [scripts/audit-security.ts](../../scripts/audit-security.ts)
2. **Remove from `QUASAR_BLOCKED` or `FASTIFY_BLOCKED`** in [.github/workflows/dependabot-labeler.yml](../../.github/workflows/dependabot-labeler.yml)
3. **Remove from `BLOCKED` array** in [.github/workflows/version-drift-check.yml](../../.github/workflows/version-drift-check.yml)
4. **Remove transitives** that were only blocked because of this parent — check `BLOCKED_TRANSITIVES` in audit-security.ts
5. **Run** `npm run test:prepush` to verify CI still passes
6. **Merge the waiting Dependabot PR** for the unblocked package
7. **Commit** the blocked-list changes

### Add a New Blocked Package

Triggered by: a new framework constraint, or a `needs-review` PR that can't be merged yet.

1. **Add to `BLOCKED_PACKAGES`** in [scripts/audit-security.ts](../../scripts/audit-security.ts) with a reason string
2. **Add to the appropriate array** (`QUASAR_BLOCKED` or `FASTIFY_BLOCKED`) in [dependabot-labeler.yml](../../.github/workflows/dependabot-labeler.yml)
3. **Add to `BLOCKED` array** in [version-drift-check.yml](../../.github/workflows/version-drift-check.yml)
4. **Add any known transitives** to `BLOCKED_TRANSITIVES` in audit-security.ts
5. Optionally **add an `ignore` rule** in [dependabot.yml](../../.github/dependabot.yml) to suppress PR creation entirely
6. **Run** `npm run test:security` to confirm the advisory is now filtered
7. **Close** the Dependabot PR with a comment linking to the reason

### Add a New Transitive

Triggered by: `npm run test:security` fails on a package that's only vulnerable because of a blocked parent.

1. **Add to `BLOCKED_TRANSITIVES`** in [scripts/audit-security.ts](../../scripts/audit-security.ts) with the parent relationship (e.g., `esbuild: 'transitive via vite'`)
2. **Run** `npm run test:security` to confirm it passes

### Handle a New Unknown Advisory

Triggered by: `npm run test:security` or `npm run test:prepush` fails with "Unknown (action required)".

1. Read the advisory URL in the output
2. **Is the package blocked?** Add it or its parent to the blocked list (see above)
3. **Is the package upgradeable?** Run `npm update <package>` or merge the Dependabot PR
4. **Is it a false positive?** Add to `BLOCKED_TRANSITIVES` with explanation
5. Re-run `npm run test:security` to confirm green

---

## Automation Status

What's automated today and what still requires a human:

| Task | Automated? | Human action |
|------|-----------|-------------|
| PR creation | Yes (Dependabot) | — |
| PR labeling | Yes (labeler workflow) | — |
| Tracking issue updates | Yes (tracker workflow) | — |
| Security audit filtering | Yes (audit-security.ts) | — |
| Unblock detection | Yes (drift check, monthly) | Verify and execute unblock |
| Merging `ready-to-merge` | **No** | Merge weekly |
| Triaging `needs-review` | **No** | Review changelog, decide |
| Unblocking procedure | **No** | Edit 3 files, run tests |
| Adding new blocked packages | **No** | Edit 3 files, close PR |

**Future automation candidates:**
- Auto-merge `ready-to-merge` PRs after CI passes (GitHub auto-merge feature)
- Auto-close `blocked-by-quasar` PRs with a standard comment
- Auto-unblock when drift check confirms (requires high confidence in detection)

---

## Quick Reference

| Resource | Location |
|----------|----------|
| Tracking issue | [#39 — Dependabot PR Tracker](https://github.com/whizbangdevelopers-org/Weaver-Dev/issues/39) |
| Dependabot config | [.github/dependabot.yml](../../.github/dependabot.yml) |
| Auto-labeler workflow | [.github/workflows/dependabot-labeler.yml](../../.github/workflows/dependabot-labeler.yml) |
| Tracker workflow | [.github/workflows/dependabot-tracker.yml](../../.github/workflows/dependabot-tracker.yml) |
| Drift check workflow | [.github/workflows/version-drift-check.yml](../../.github/workflows/version-drift-check.yml) |
| Security audit script | [scripts/audit-security.ts](../../scripts/audit-security.ts) |
| Sync exclusions | [.github/sync-exclude.yml](../../.github/sync-exclude.yml) |
| Architecture docs | [Developer Guide § Dependency Management Pipeline](../DEVELOPER-GUIDE.md#dependency-management-pipeline) |
