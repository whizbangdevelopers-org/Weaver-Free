<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2026-04-18

Non-security patch release. Fixes a critical release-mechanics bug that prevented the Weaver Free public tarball from being built from source. Tightens CI guardrails against the bug class that caused it.

### Fixed

- **Free tarball now builds from source.** v1.0.0 shipped with latent build failures on the Weaver-Free public repo: `../scripts/` path escapes in `prebuild` and `audit:docs-links` scripts, plus ~97 unguarded imports of sync-excluded paths across source, that only surfaced when someone tried to `nix-build` from the released tarball. Refactored with a stub-shim pattern: `demo.ts`, `mock-vm.ts`, `mock-container.ts`, `useDemoContainerState.ts`, `useMilestoneModal.ts`, and `mock-agent.ts` are now thin shims that ship to Free and eagerly glob (or `try/catch` dynamic-import) their `-data.ts` siblings that remain sync-excluded. Paid-tier route imports in `routes.ts` are now inside a `VITE_FREE_BUILD === 'true'` ternary guard that rolldown tree-shakes. Fabrick-tier pages (`FabrickOverviewPage.vue`, `LoomPage.vue`) moved into `src/pages/fabrick/` so they're auto-excluded by the existing directory rule.
- **OpenSSF Scorecard badge was showing "invalid repo path"** due to the deprecated `api.securityscorecards.dev` domain. Updated `code/README.md` to the current `api.scorecard.dev`.
- **Scorecard workflow rejected on "global perm is set to write"** — flipped `default_workflow_permissions` from `write` to `read` on both Weaver-Dev and Weaver-Free via the GitHub API, and added top-level `permissions: read-all` to 7 workflows that had only job-level permissions (codeql, demo-deploy, demo-reset, dependabot-labeler, dependabot-tracker, security-scan, stale).
- **sync-to-free workflow** had the `- demo/` pattern matching `src/components/demo/` at any depth (rsync pattern semantics). Anchored to `- /demo/` so only `code/demo/` is excluded.
- **`npm ci` anti-pattern in workspaces.** release.yml, test.yml, and release-verify-create.yml had redundant `cd backend && npm ci` and `cd tui && npm ci` steps that pruned root devDependencies (including `@quasar/app-vite` which provides the `quasar` binary) after the workspaces refactor. Collapsed to a single root `npm ci`.
- **NUR dispatch payload** sent raw-hex source hashes; `fetchFromGitHub` expects SRI format. Added hex→SRI conversion step in release.yml and changed the dispatch event-type from generic `update-package` to the per-package `weaver-free-release` convention (matching the Qepton precedent).
- **Dependency vulnerabilities** — `npm audit fix` (non-breaking) addressed 4 high-severity vulns; 11 dev-only issues remain.

### Added

- **New auditor `audit:excluded-imports`** — scans source for static or dynamic imports of sync-excluded paths without a guard. Static imports are always flagged; dynamic imports must be inside a `VITE_FREE_BUILD === 'true' ? [] : […]` ternary or a `try { … }` block. Wired into `test:compliance`.
- **New auditor `audit:release-builds`** — pre-flight simulation of downstream build contexts before a release tag is pushed. Currently covers the `free-tarball` context (sync-flattened `npm ci + build:all`); docker, public-demo, private-demo contexts planned. Wired into `test:prerelease`.
- **New auditor `audit:openssf-baseline`** — pre-OpenSSF Scorecard baseline check. Validates 7 Scorecard concerns locally (no network) so regressions fail the push rather than surfacing on the next weekly scan: Token-Permissions, Pinned-Dependencies, Dependency-Update-Tool, Security-Policy, SAST, License, Signed-Releases. Wired into `test:compliance`.
- **New product doc `docs/security/ENGINEERING-DISCIPLINE.md`** — ships with Weaver Free, registered in DocsPage. Tells the "internal CI vs Enterprise CI" credibility story with enumerated, verifiable checks. Available as a compliance doc slug.
- **Branch protection** enabled on `whizbangdevelopers-org/Weaver-Free` `main` (required_approving_review_count: 0, dismiss_stale_reviews: true, enforce_admins: false, allow_force_pushes: false, allow_deletions: false).
- **Dependabot** — `.github/dependabot.yml` removed from the sync exclusion list so Weaver-Free gets weekly dependency updates.
- **CodeQL push trigger** — codeql.yml now triggers on push to main (not just PRs and the weekly schedule).

### Changed

- **`src/config/demo.ts` split into `demo-mode.ts` (ships) + `demo-data.ts` (sync-excluded)**. 51 non-demo files migrated from `src/config/demo` to `src/config/demo-mode` for their flag-only imports (`isDemoMode`, `isPublicDemo`, `DEMO_LINKS`, `PUBLIC_DEMO_LINKS`, `DEMO_TIER_STAGES`). The mock-data side uses the stub-shim pattern — old `from 'src/config/demo'` imports still work; `demo.ts` is now a small shim with eager `import.meta.glob` fallback to `demo-data.ts`.
- **Demo UI scaffolding** (`src/components/demo/`, `DemoBanner.vue`, `DemoToolbar.vue`, `DemoLoginModal.vue`, `src/pages/DemoLoginPage.vue`, `src/pages/funnel/`, `src/constants/pricing.ts`) is no longer sync-excluded. These files are small, not commercially sensitive, and publicly viewable at weaver-dev.github.io. Paid-tier components (`src/components/weaver/`, `src/components/fabrick/`, `src/pages/fabrick/`) remain excluded.
- **Release-process documentation** now explicitly states patch releases aren't security-only: release-mechanics fixes, build regressions, pipeline fixes, and documentation corrections are all valid patch-release triggers.
- **`audit:docs-links`** is now a no-op on Free builds where `scripts/verify-docs-links.ts` is sync-excluded. On Dev where the script exists, behavior is unchanged.
- **`generate:versions`** is a no-op on Free builds where `../scripts/delivery-projection.ts` doesn't exist. On Dev, the script runs as before.

## [1.0.0] - 2026-04-17

Initial public release. Production-ready NixOS MicroVM management dashboard.

### Added

**Core Dashboard**
- Real-time VM monitoring via WebSocket (2-second broadcast interval)
- Dashboard page with VM status cards (grid + compact list view toggle)
- VM detail page with configuration, networking, provisioning logs, and AI analysis tabs
- Start / Stop / Restart lifecycle management from the browser
- VM scanning and auto-discovery of `microvm@*.service` systemd units
- Keyboard shortcuts (?, D, S, N) and drag-and-drop card sorting
- Responsive PWA with mobile-optimized layouts and touch toolbar

**VM Provisioning (Weaver Solo+)**
- Async VM creation with cloud-init image provisioning pipeline
- Multi-hypervisor support: QEMU, Cloud Hypervisor, crosvm, kvmtool, Firecracker
- Windows guest support via BYOISO with VNC install (IDE disk + e1000 networking)
- Desktop mode toggle (QEMU VGA + VNC)
- Bridge networking with configurable subnet (default `10.10.0.0/24`)

**Distribution Catalog**
- Three-tier distro system: built-in, curated catalog, and custom user-defined
- Shipped catalog: NixOS, Arch, Fedora, Ubuntu, Debian, Alpine, Rocky, Alma, openSUSE, CirOS, Windows
- URL health monitoring with HEAD-request validation and admin override
- "Will it boot?" smoke test from Settings UI and CLI
- Remote catalog refresh endpoint

**AI Agent Diagnostics**
- Diagnose, Explain, and Suggest actions per VM with streaming markdown output
- Pluggable LLM provider architecture (Anthropic, extensible to other vendors)
- BYOK (Bring Your Own Key) and BYOV (Bring Your Own Vendor) support
- Mock agent auto-fallback for demo and keyless environments
- Tiered rate limiting: 5/10/30 requests per minute (free/premium/enterprise)

**Serial Console**
- In-browser serial console via xterm.js and WebSocket-to-TCP proxy
- VNC console support for desktop-mode VMs
- Mobile touch toolbar (Paste, Ctrl+C, Ctrl+D, Tab)

**Authentication & Authorization**
- Cookie-based JWT session auth with bcrypt password hashing (cost 13)
- First-run admin account detection and setup wizard
- Role-based access control: admin / operator / viewer
- Per-VM access control lists (enterprise)
- Account lockout (5 attempts / 15 minutes, persisted to disk)
- 30-minute access tokens with 7-day refresh tokens
- Single-session enforcement: new login revokes all prior sessions for that user (all tiers, last login wins)

**Tier System**
- 4-tier licensing: demo / free / premium / enterprise
- License key validation with HMAC-SHA256 checksum (offline-capable)
- Frontend tier gating via `useTierFeature` reactive composable
- Backend tier gating via `requireTier()` middleware
- Demo tier-switcher toolbar for live feature showcase

**Notifications**
- In-app notification bell with event history (free)
- Push notification channels: ntfy, email (SMTP), webhook (Slack/Discord/PagerDuty), Web Push (premium)
- Per-channel event subscriptions with dynamic adapter loading
- Resource alerts with configurable CPU/memory thresholds (premium)

**User Management**
- User list, create, role change, and delete (admin)
- VM resource quotas with enforcement (enterprise)
- Bulk VM operations: multi-select start/stop/restart (enterprise)

**Audit & Compliance**
- Audit log with queryable API (enterprise): all VM, user, and agent actions
- Per-user rate limiting with tier gradient and response headers

**Network**
- Network topology page with auto-detected bridges (free)
- Bridge management: create/delete managed bridges and IP pools (premium)

**Host Info**
- Host info strip: NixOS version, CPU topology, disk usage, network interfaces, live metrics (premium)
- KVM availability detection

**Help System**
- Searchable help page with Getting Started, VM Management, AI Features, Settings, and FAQ sections
- Contextual help tooltips with global toggle
- Getting Started wizard (auto-triggers on first visit, auto-dismisses when VMs arrive)

**Settings**
- AI provider configuration with vendor selector and API key management
- Custom distribution CRUD with URL override and validation
- Tag management with preset vocabulary
- Notification channel configuration (premium)
- View preferences persistence

**NixOS Integration**
- Declarative NixOS module with full option set (port, host, auth, licensing, provisioning, bridge)
- Dedicated system user with restricted sudo (microvm@*.service only)
- Flake and non-flake installation paths
- Secrets management integration (sops-nix)

**Terminal UI (TUI)**
- Ink/React terminal client with VM list, detail, and status views
- `--demo` mode with mock clients for offline use
- Credential storage via XDG-compliant `conf` package
- WebSocket reconnection with 4401 close code handling
- Server-side session revocation on logout and quit

**Demo Site**
- Static SPA deployment to GitHub Pages
- 8 sample VMs (multi-distro, multi-hypervisor, varied states including Windows)
- Tier-switcher toolbar: Free / Weaver / Fabrick live toggle
- Mock VM create/delete for interactive demo

**DevOps & Quality**
- GitHub Actions CI/CD: test, release, sync-to-free, CodeQL, security-scan, stale
- Release workflow with approval gate and post-release verification
- Dev-to-Free repo sync (PR-based, excludes internal files)
- Dockerized Playwright E2E testing (never bare `npx playwright test`)
- Dynamic test count badges via Gist
- Security audit pipeline with blocked-package tracking
- Form validation audit (static + E2E coverage gap checker)
- Git hooks: pre-commit linting, pre-push testing

### Security

- JWT secret required in production (no auto-generation)
- Access token TTL reduced to 30 minutes (from 24 hours during development)
- Token refresh timer corrected to 25 minutes (was incorrectly set to 23 hours)
- Bcrypt rounds increased to 13 (OWASP 2024+)
- Account lockout persisted to disk (survives restarts)
- CORS wildcard rejected in production
- `file://` URL validation restricted to allowed directories
- All GitHub Actions SHA-pinned (40 actions across 10 workflows)
- License HMAC empty-secret bypass prevented
- Rate limit bypass decoupled from NODE_ENV
- Agent context uses configurable binary paths (defense-in-depth)
- Parallel VM status fetching (prevents sequential timing leaks)
- 5-domain non-code security audit: legal/IP, secrets, supply chain, deployment, org governance
