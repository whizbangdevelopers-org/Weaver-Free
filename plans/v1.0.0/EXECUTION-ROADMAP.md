<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v1.0.0 (Production Ready)

**Last updated:** 2026-03-04

Phase-by-phase execution plan through v1.0.0 release. For the full product roadmap and decision log, see [MASTER-PLAN.md](../../MASTER-PLAN.md).

## Phase Overview

```
Phase 1:  VM Registration CRUD (v0.1.0)            ████████████████████ 100%  COMPLETE
Phase 2:  Full Provisioning (v0.2.0)               ████████████████████ 100%  COMPLETE
Scope A:  AI Agent Diagnostics (v0.3.0)            ████████████████████ 100%  COMPLETE
Phase 3a: AI Settings UI / BYOK (v0.4.0)           ████████████████████ 100%  COMPLETE
Phase 3b: Hypervisor + Custom Distros (v0.5.0)     ████████████████████ 100%  COMPLETE
Phase 3c: Serial Console Viewer (v0.6.0)           ████████████████████ 100%  COMPLETE
Phase 4:  Help System (v0.7.0)                     ████████████████████ 100%  COMPLETE
Phase 5a: Curated Distro Catalog (v0.8.0)          ████████████████████ 100%  COMPLETE
Phase 5b: Windows Guest Support (v0.9.0)           ████████████████████ 100%  COMPLETE
Phase 5c: macOS Considerations (docs only)         ████████████████████ 100%  COMPLETE
Phase 5d: Mobile / Responsive Polish               ████████████████████ 100%  COMPLETE
Phase 6:  Production Ready (v1.0.0)                ██████████████████░░  95%  IN PROGRESS
```

---

## Prior Work (Phases 1–5)

### Phase 1: VM Registration CRUD (v0.1.0)

Core dashboard foundation: project scaffolding from quasar-template-pwa-api, Fastify backend with TypeScript + Zod, VM CRUD routes, WebSocket live status (2s broadcast), MicroVM service layer (systemctl integration), Weaver/Detail pages, Pinia stores, Vue composables, mock VM service for demo mode, NixOS module, hCaptcha demo login, Vitest + Playwright E2E in Docker, GitHub Actions CI/CD, git hooks.

### Phase 2: Full Provisioning (v0.2.0)

VM registration API with Zod validation, async provisioning pipeline (202 + WebSocket progress), NixOS guest builds via Nix flake, cloud image provisioning (QEMU + cloud-init), CreateVmDialog, VM deletion with cleanup, provisioning state machine, provisioning logs endpoint + UI tab.

### Scope A: AI Agent Diagnostics (v0.3.0)

AgentDialog with real-time markdown rendering, pluggable LlmProvider architecture (AnthropicProvider), BYOK + BYOV support, mock agent auto-fallback, agent REST + WebSocket endpoints, Pinia agent-store with per-VM tracking, useAgent + useAgentStream composables, stethoscope button on VmCard, AI Analysis tab on VmDetailPage.

### Phase 3a: AI Settings UI / BYOK (v0.4.0)

SettingsPage with AI provider section, vendor selector, API key input with show/hide toggle, server key toggle, settings-store with localStorage persistence, mode indicator.

### Phase 3b: Hypervisor Selection + Custom Distros (v0.5.0)

Multi-hypervisor support (QEMU, Cloud Hypervisor, crosvm, kvmtool, Firecracker), desktop mode toggle (QEMU-only, VGA + VNC), cloud distro detection, custom distributions CRUD in Settings and backend.

### Phase 3c: Serial Console Viewer (v0.6.0)

SerialConsole component (xterm.js), backend WebSocket proxy for console port, Console tab on VmDetailPage, E2E tests.

### Phase 4: Help System (v0.7.0)

HelpPage with searchable structured content, HelpTooltip component with global toggle, GettingStartedDialog with q-stepper (auto-trigger on first visit, auto-dismiss on VM arrival), E2E specs.

### Phase 5a: Curated Distro Catalog (v0.8.0)

Three-tier distro system (built-in → catalog → custom), CatalogStore backend, `distro-catalog.json` shipped with app (NixOS, CirrOS, Rocky, Alma, openSUSE), catalog name collision protection, refresh endpoint, Settings UI with catalog badges, CreateVmDialog grouped dropdown, NixOS module support.

### Phase 5b: Windows Guest Support (v0.9.0)

`guestOs` field, ISO-install provisioning path, Windows-specific QEMU args (IDE + e1000), Linux ISO-install path (VirtIO), auto-force QEMU + desktop mode for Windows, Windows badges in UI, guest OS selector in add-custom-distro, RAM warning banner, E2E specs.

> **Deferred:** UEFI/OVMF firmware, VirtIO drivers ISO, autounattend.xml, TPM, cloudbase-init.

### Phase 5c: macOS Considerations (docs only)

macOS guest limitation Q&A in Help page FAQ (legal limitation — macOS only runs on Apple hardware).

### Phase 5d: Mobile / Responsive Polish

Serial console touch toolbar, responsive console sizing, dashboard grid/list view toggle, VmListItem compact list component, stat cards horizontal scroll, responsive dialog widths, Quasar Screen plugin, E2E specs.

> **Deferred:** Capacitor native app builds (stretch — only if users request native features).

---

## Phase 6: Production Ready (v1.0.0) — 95% COMPLETE

Soft market entry — tier enforcement, security, hardening, and polish for initial release. Tier matrix fully decided (see [MASTER-PLAN.md § Decision Log](../../MASTER-PLAN.md)).

### Tier Gating Infrastructure

| Deliverable | Status |
| --- | --- |
| Tier configuration model (`free` / `premium` / `enterprise`) + NixOS option | Done |
| Tier gating middleware — Fastify route-level enforcement via `requireTier()` decorator | Done |
| Frontend tier composable (`useTierFeature`) — hide/disable gated UI elements | Done |
| Tier gate unit tests (middleware rejects/allows per tier) | Done |
| Demo tier-switcher functional gates (7 files: app store, DemoLoginPage, mock-vm, useVmApi, VmCard, VmListItem, VmDetailPage, SettingsPage, WorkbenchPage) | Done |

### Authentication & Authorization

| Deliverable | Status |
| --- | --- |
| Authentication system (cookie-based session, bcrypt passwords, SQLite) | Done |
| Login page UI + session token validation middleware | Done |
| Role model: admin / operator / viewer + `requireRole()` middleware | Done |
| Per-VM access control (enterprise, `PUT /api/users/:id/vms`) | Done |
| Bulk VM operations (enterprise, client-side per-VM loop in BulkActionBar) | Done |
| VM resource quotas (enterprise, `GET/PUT /api/users/:id/quotas`) | Done |

### Rate Limiting & Audit

| Deliverable | Status |
| --- | --- |
| Per-user rate limiting middleware with tier gradient (5 / 10 / 30 per min) | Done |
| Rate limit response headers (`X-RateLimit-Remaining`, `Retry-After`) | Done |
| Server-provided AI agent key gating (reject if no server key + free tier) | Done |
| Push notification channels + resource alerts (premium) | Done |
| Audit log (all VM/user actions, queryable, `GET /api/audit`) | Done |

### Demo Site

| Deliverable | Status |
| --- | --- |
| Demo tier-switcher toolbar (Weaver Free / Weaver / Fabrick toggle) | Done |
| Tier-switcher wires into same gating middleware (runtime switch via `demoTierOverride`) | Done |
| Demo site deployment (static SPA, GitHub Pages) | Done |
| Mock VM create/delete for demo mode (mockCreateVm, mockDeleteVm) | Done |
| Cross-bridge routing edges in network topology (LB → app tier, gateway → services) | **Remaining** |
| **Workload status model — add `idle` status** (Decision #57) | Done |

### Host Config Viewer

| Deliverable | Status |
| --- | --- |
| `GET /api/config` — read `configuration.nix` from host filesystem, return raw content + parsed workload sections | Done |
| Parse and categorize workload definitions: `microvm.vms.*` (MicroVMs), `virtualisation.oci-containers.*` (OCI containers), `services.slurm.*` (Slurm nodes); infrastructure layer separate | Done |
| Settings > Host Config page — Nix syntax-highlighted viewer, categorized sections sidebar | Done |
| Demo mode: mock `configuration.nix` with representative MicroVM, OCI container, and Slurm node definitions | Done |
| E2E specs: viewer renders, sections categorized, demo mode mock data | Done |

### Security & Polish

| Deliverable | Status |
| --- | --- |
| Security hardening review + full audit (5 domains: legal/IP, secrets, supply chain, deployment, org governance) | Done |
| Performance profiling baseline (184KB main JS, 3.3MB total, lazy-loaded heavy chunks) | Done |
| Production deployment guide (NixOS module documentation) | Done |
| Dependency management pipeline (Dependabot triage, version-drift-check, blocked-package tracking) | Done |

### Release Pipeline

| Deliverable | Status |
| --- | --- |
| `release.yml` workflow (tag-triggered build + GitHub Release creation) | Done |
| `sync-to-free.yml` workflow (PR-based Dev→Free sync) | Done |
| `release-publish` GitHub environment with required reviewer gate | Done |
| `release-verify-create` post-release verification script | Done |
| Release process dry run (push pre-release tag, verify full pipeline) | **Remaining** |

### Documentation & Media

| Deliverable | Status |
| --- | --- |
| README GTM rewrite (hero image, install, tier breakdown, architecture) | Done |
| CONTRIBUTING.md rewrite (CoC, feedback mechanisms, license agreement) | Done |
| CHANGELOG.md collapsed to [1.0.0] release section | Done |
| NixOS minimum bumped to 25.11 across all platform docs | Done |
| Automated screenshot pipeline (11 PNGs, 2-phase capture, agent definition) | Done |
| DEMO-README updated (architecture diagram, tier-switcher docs) | Done |
| v1.0 documentation audit (SECURITY.md, issue templates, production guide) | Done |

> **Remaining:** Release process dry run (push `v1.0.0-rc1` tag, verify approval gates and sync workflows end-to-end). Cross-bridge routing edges in demo network topology (shows LB/gateway routing to downstream services across bridges — sells the v2 vision). **Workload status model** (Decision #57): add `idle` to `VmInfo.status` union, update `StatusBadge`, `VmCard`, sort priority, backend systemd derivation, demo data, and Fabrick fleet stat boxes — must ship before v1.0.0 to avoid retrofitting type contracts, E2E tests, and TUI parity post-release. **Host Config viewer** (Decision #71): `GET /api/config` endpoint, categorized Nix viewer (MicroVMs + OCI containers + Slurm nodes + infrastructure layer), Settings > Host Config page, demo mock, E2E specs. All other implementation, testing (269 unit + 582 backend + 183 TUI + 304 E2E = 1,338 total), security audits, and documentation are complete. Release gate: NixOS fresh-install smoke test. (Legal/insurance review moved to v1.1.0 — v1.0 ships no security-posture feature domains per Decision #30.)

---

## Dev Backlog — COMPLETE

All high-priority items resolved:

- ~~Error boundary component~~ Done (App.vue `onErrorCaptured`)
- ~~Loading skeletons for dashboard cards~~ Done (skeleton cards during connect)
- ~~Toast notifications for VM action results~~ Done (Quasar Notify)
- ~~Keyboard shortcuts~~ Done (?, D, S, N)
- ~~VM action confirmation dialogs (stop/restart)~~ Done
- ~~Weaver card sorting~~ Done (name/status/manual drag-and-drop)
- ~~Animation on status transitions~~ Done (CSS transitions)
- ~~VM uptime formatting~~ Done (human-readable durations)
- ~~Template placeholder cleanup~~ Done

Remaining items (deferred to post-v1):
- Increase unit test coverage to 70%+
- Component tests with @vue/test-utils
- Visual regression tests with Playwright
- i18n support structure

---

## Release Plan (v0.1–v1.0)

| Version | Milestone | Key Features | Status |
| --- | --- | --- | --- |
| v0.1.0 | VM Registration CRUD | VM CRUD, dashboard, WebSocket, NixOS module | Done |
| v0.2.0 | Full Provisioning | Async provisioning, cloud images, Nix builds | Done |
| v0.3.0 | AI Agent Diagnostics | Agent streaming, BYOK, mock mode | Done |
| v0.4.0 | AI Settings UI / BYOK | Settings UI, vendor selection, mode indicator | Done |
| v0.5.0 | Hypervisor + Custom Distros | Multi-hypervisor, custom distros | Done |
| v0.6.0 | Serial Console Viewer | Serial console viewer, xterm.js | Done |
| v0.7.0 | Help System | Help page, tooltips, getting started wizard | Done |
| v0.8.0 | Curated Distro Catalog | Three-tier distro system, catalog store, grouped dropdown | Done |
| v0.9.0 | Windows Guest Support | `guestOs` field, ISO-install path, IDE+e1000, BYOISO via VNC | Done |
| v1.0.0 | Production Ready | Auth, RBAC, audit logging, tier gating, demo tier-switcher, security hardening — soft market entry | 95% |

> **Current version:** 0.1.0 in package.json. A premature v1.0.0 tag (2026-02-22) was removed. v1.0.0 will be re-tagged after release dry run, NixOS smoke test, and legal/insurance gate pass.

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
