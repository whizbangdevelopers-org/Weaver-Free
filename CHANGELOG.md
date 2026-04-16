<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-XX-XX

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
