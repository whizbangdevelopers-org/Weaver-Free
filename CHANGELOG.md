<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.2] - 2026-04-20

Patch release. Closes a Free-tier monetization gap (unlimited VM control) and tightens the release/sync machinery. End-to-end upgrade path validated on a live non-flake NixOS VM.

### Added

- **Free-tier VM control cap (observer pattern).** Free-tier installations can register and observe unlimited VMs, but lifecycle actions (start/restart) are gated to the first 10 VMs alphabetically plus a 64 GB total running-memory ceiling. Pure-function gate at `backend/src/services/free-tier-cap.ts` with 11 unit tests; wired into `POST /api/workload/:name/start` and `/:name/restart` with a 403 response and audit-logged denial. Upgrade nags (AI Default, Resource Quotas) are now visible to Free admins as conversion touchpoints.
- **New auditor `audit:mcp-coverage`** (#34) — three-layer parity check that the code MCP server's knowledge manifest covers every source it claims to, that the manifest is fresher than its sources, and that the reader pattern matches what the manifest declares.
- **New auditor `audit:nix-deps-hash`** (#35) — computes a sha256 fingerprint of `package-lock.json` and compares it against a `# lockfile-marker:` comment in `nixos/package.nix`. Fails the push with remediation steps when the pairing drifts, so downstream Nix builds can't surface with an outdated `npmDepsHash`.
- **New auditor `audit:sync-exclude-cruft`** (#36) — greps every rsync invocation in `sync-to-free.yml` and `release.yml` to ensure `--delete-excluded` is present. Prevents the class of bug where a pattern added to `sync-exclude.yml` silently leaves pre-existing files behind on the Free mirror.
- **`docs/UPGRADE.md`** — canonical upgrade runbook covering three installation paths: flake + NUR, flake + direct GitHub input, and traditional channels + NUR (pinned and unpinned sub-cases). Includes an 8-point post-upgrade verification checklist, rollback guidance, and a staging-VM validation pattern.
- **`ADMIN-GUIDE.md` — "Validating Upgrades in a Staging VM"** section documents the two-VM recommendation (flake-managed and channels-managed) and the per-release six-step validation workflow.
- **Sigstore cosign keyless signing** on all release tarballs and SBOMs. Release assets now include `.sig` and `.pem` files signed via Fulcio with Rekor transparency-log inclusion. Cosign pinned to v2.5.3 in `sigstore/cosign-installer` — cosign v3 dropped `--output-signature` / `--output-certificate` in favor of a single `--bundle` output; the migration is a deliberate v1.0.3+ change.
- **Badge wiring (Row 2 + Row 3).** README now shows a total-tests badge that sums unit + backend + TUI + E2E pass/fail counts from per-job gist writes, plus per-suite badges. Row 3 adds compliance-auditors, cosign-signed, SLSA L3, and a live CII Best Practices Passing badge (project #12592).
- **`docs/security/COMPENSATING-CONTROLS.md`** — documents 7 structural gaps (solo-maintainer, second reviewer, etc.) and the compensating controls that offset each. AI review is recognized as a first-layer compensating control alongside automated auditors and recorded exceptions.
- **`docs/security/CONTRACTED-REVIEW-OFFERING.md`** — Fabrick-tier bolt-on for customers who need human second-reviewer coverage on their Weaver deployments.
- **`CONTRIBUTING.md` — "About this project"** + Governance sections now spell out the two-admin model (Mark Wriver primary; Yuri Jacuk secondary-admin-on-standby, activating June 2026) and the committed roadmap through v2.x and v3.x.

### Fixed

- **`/api/health` missing `version` field.** The health route now resolves the backend package version at module load and includes `version` in the response. Catches version drift on upgraded installs.
- **`VITE_FREE_BUILD` auto-detect in Nix builds.** When `src/pages/fabrick/` is absent (the Weaver-Free tarball), `nixos/package.nix` now sets `VITE_FREE_BUILD=true` automatically so rolldown tree-shakes the paid-tier route ternary. Previously the env var had to be set by the caller; omitting it produced `UNLOADABLE_DEPENDENCY` failures on pages that were supposed to be excluded.
- **Sync workflow preserved stale excluded files** on the Free mirror. `sync-to-free.yml` now passes `--delete-excluded` on both the `code/ → target/` rsync and the `.github/ → target/.github/` rsync, so files newly added to `sync-exclude.yml` are removed from Free on the next sync instead of lingering as cruft. A `--filter='P /.git'` protect rule guards `target/.git` from being deleted by `--delete-excluded` combined with `--exclude='.git'`.
- **`release.yml` rsync path symmetry.** The release workflow's final sync to Free now uses the same `--delete-excluded` + `--filter='P /.git'` discipline as the main sync workflow.
- **Over-broad rsync exclusion patterns.** `- /reports/`, `- /coverage/`, `- /logs/`, `- /data/`, `- /playwright-report/`, `- /test-results/` are now anchored with leading slashes so they match ONLY the top-level path. Unanchored `- data/` was matching `backend/data/` (which holds `distro-catalog.json`, a real shipped file) and deleting it on sync — the Nix build then failed with `cp: cannot stat backend/data/distro-catalog.json`. `dist/` is intentionally kept unanchored; nested `backend/dist`, `tui/dist`, and `src-pwa/dist` are all build artifacts that should be excluded.
- **`audit:doc-parity` counter drift** — auditor-count references in `CLAUDE.md`, `MASTER-PLAN.md`, `NOTES.md`, `STATUS.md`, and `ENGINEERING-DISCIPLINE.md` brought back into sync at 36.
- **Test-badge pipeline schema violation.** `.github/workflows/test.yml` `if:` expressions no longer reference `secrets.*` (forbidden at the job/step `if:` level in GitHub Actions). Badge publishing now keys off `workflow_dispatch || startsWith(github.ref, 'refs/tags/v')` and sends to a classic-PAT-authenticated gist owned by the weaver-dev user.
- **Backend + TUI lint drift** — `test:precommit` now covers backend lint + typecheck and TUI typecheck, catching three pre-existing backend lint errors (unused imports + unused caught-error) that had slipped past the root-scoped precommit.
- **OpenSSF CII Passing unblocked** — Commons Clause dropped from the Weaver-Free LICENSE (Decision recap: AGPL-3.0 only for Free). Combined with the new Governance doc, this let us earn the CII Passing badge on first submission.
- **`audit:release-builds` docker context removed.** Weaver is a NixOS module, not a Docker image — it manages `microvm@*.service` units and `br-microvm` bridge networking at host level. Running Weaver in a container would require `--privileged` or Docker-in-Docker, either of which defeats the isolation model. Docker is a workload Weaver **manages**, not a shipping format for Weaver itself. The aspirational `docker build -t ghcr.io/...` line was also struck from the release checklist in `code/CLAUDE.md`.

### Changed

- **Upgrade nags visible on Free.** `SettingsPage.vue` no longer gates the AI Default and Resource Quotas cards behind `appStore.isWeaver`. Free-tier admins see the same cards with tier-upgrade messaging — a deliberate conversion touchpoint at the tier boundary.
- **`nixos/package.nix`** now copies `docs/UPGRADE.md`, `docs/ADMIN-GUIDE.md`, and `docs/USER-GUIDE.md` into `$out/lib/weaver/docs/` so installed binaries ship with their own upgrade and operator documentation.
- **`attest-build-provenance` documented as soft-fail on the private Dev repo.** GitHub attestations require either a paid org plan or a public repo. Weaver-Dev is private on the free plan, so attestations fail with "Feature not available for the organization." `continue-on-error: true` is retained with a workflow comment explaining the constraint — the flag becomes removable when the org upgrades to Team/Enterprise or this workflow is moved to run on the public Free repo directly.

### Validated

- **Non-flake upgrade path end-to-end.** The traditional-channels + NUR upgrade path was smoke-tested against v1.0.1 on a live NixOS VM. Six cascading bugs discovered during the test are all fixed in this release: npmDepsHash drift, `VITE_FREE_BUILD` auto-detect missing from Nix build, `--delete-excluded` missing from sync rsyncs, `--exclude='.git'` combined with `--delete-excluded` trashing target `.git`, unanchored `/data/` exclusion pattern deleting `backend/data/distro-catalog.json`, and `/api/health` missing a `version` field. Flake-based upgrade paths share the same `nixos/package.nix` derivation and are covered transitively.

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
