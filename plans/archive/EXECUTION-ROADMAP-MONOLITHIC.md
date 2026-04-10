<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap

**Last updated:** 2026-03-04

Phase-by-phase execution plan for Weaver development.

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
Phase 5b: Windows Guest Support (v0.9.0)      ████████████████████ 100%  COMPLETE
Phase 5c: macOS Considerations (docs only)    ████████████████████ 100%  COMPLETE
Phase 5d: Mobile / Responsive Polish         ████████████████████ 100%  COMPLETE
Phase 6:  Production Ready (v1.0.0)                ██████████████████░░  95%  IN PROGRESS
─── Container Orchestration Arc ───
Phase 7a: Container Visibility (v1.1.0)            ░░░░░░░░░░░░░░░░░░░░  PLANNED
Phase 7b: Full Container Management (v1.2.0)       ░░░░░░░░░░░░░░░░░░░░  PLANNED
Phase 7c: Cross-Resource AI Agent (v1.3.0)         ░░░░░░░░░░░░░░░░░░░░  PLANNED
─── Import/Export Arc ───
Phase 8a: Import/Export Tier 1 (v1.4.0)            ░░░░░░░░░░░░░░░░░░░░  PLANNED
Phase 8b: Import/Export Tier 2 (v1.5.0)            ░░░░░░░░░░░░░░░░░░░░  PLANNED
─── Backup & Recovery Arc (v2.x.x) ───
Phases 10a–11c: See IMPLEMENTATION-PHASING-PLAN.md         PLANNED (v2.0.0–v2.5.0)
─── Advanced Clustering Arc (v3.x.x) ───
─── Edge Management Arc (v2.x–3.0, NixOS only) ───
Edge: Remote NixOS node management (multi-node + agent)    PLANNED
─── Advanced Clustering Arc (v3.x.x) ───
v3.0.0: HA, live migration, auto-provisioning             PLANNED
```

---

## Completed Phases

### Phase 1: VM Registration CRUD (v0.1.0) — COMPLETE

Core dashboard foundation with VM management.

| Deliverable | Status |
| --- | --- |
| Project scaffolding from quasar-template-pwa-api | Done |
| Fastify backend with TypeScript + Zod | Done |
| VM routes (GET/POST /api/vms, start/stop/restart) | Done |
| WebSocket live status at /ws/status (2s broadcast) | Done |
| MicroVM service layer (systemctl integration) | Done |
| Dashboard page with VM cards + StatusBadge | Done |
| VM detail page with config/networking tabs | Done |
| Pinia stores (vm-store, ui-store, app) | Done |
| Vue composables (useVmApi, useVmStatus, usePlatform) | Done |
| Mock VM service for demo mode | Done |
| NixOS module (package + service) | Done |
| hCaptcha demo login | Done |
| Vitest unit tests + Playwright E2E in Docker | Done |
| GitHub Actions CI/CD workflows | Done |
| Git hooks (pre-commit, pre-push) | Done |

### Phase 2: Full Provisioning (v0.2.0) — COMPLETE

VM registration, provisioning lifecycle, and async build pipeline.

| Deliverable | Status |
| --- | --- |
| VM registration API (POST /api/vms) with Zod validation | Done |
| Async provisioning pipeline (202 + WebSocket progress) | Done |
| NixOS guest builds via Nix flake | Done |
| Cloud image provisioning (QEMU + cloud-init) | Done |
| CreateVmDialog component with form validation | Done |
| VM deletion with cleanup | Done |
| Provisioning state machine (registered → provisioning → provisioned/failed) | Done |
| Provisioning logs endpoint and UI tab | Done |

### Scope A: AI Agent Diagnostics (v0.3.0) — COMPLETE

AI-powered VM analysis with streaming output.

| Deliverable | Status |
| --- | --- |
| AgentDialog component with real-time markdown rendering | Done |
| Pluggable LlmProvider architecture (AnthropicProvider) | Done |
| BYOK + BYOV support via POST body | Done |
| Mock agent auto-fallback (no API key = canned responses) | Done |
| Agent REST endpoints (POST 202 + GET status) | Done |
| Agent WebSocket messages (agent-token/complete/error) | Done |
| Pinia agent-store with per-VM operation tracking | Done |
| useAgent + useAgentStream composables | Done |
| Smart stethoscope button on VmCard | Done |
| AI Analysis tab on VmDetailPage | Done |
| Zod schema validation for agent endpoints | Done |

### Phase 3a: AI Settings UI / BYOK (v0.4.0) — COMPLETE

User-facing settings for AI provider configuration.

| Deliverable | Status |
| --- | --- |
| SettingsPage with AI provider section | Done |
| Vendor selector (extensible) | Done |
| API key input with show/hide toggle | Done |
| Server key toggle | Done |
| settings-store with localStorage persistence | Done |
| Mode indicator (server key / BYOK / mock) | Done |

### Phase 3b: Hypervisor Selection + Custom Distros (v0.5.0) — COMPLETE

Multi-hypervisor support and user-defined distributions.

| Deliverable | Status |
| --- | --- |
| Hypervisor selector in CreateVmDialog (QEMU, Cloud Hypervisor, crosvm, kvmtool, Firecracker) | Done |
| Desktop mode toggle (QEMU-only, VGA + VNC) | Done |
| Cloud distro detection (auto-force QEMU) | Done |
| Custom Distributions section in Settings | Done |
| Distro CRUD API (backend) | Done |
| Add/remove custom distros with format + cloud-init support | Done |

### Phase 3c: Serial Console Viewer (v0.6.0) — COMPLETE

In-browser serial console access for running VMs.

| Deliverable | Status |
| --- | --- |
| SerialConsole component (xterm.js) | Done |
| Backend WebSocket proxy for console port | Done |
| Console tab on VmDetailPage | Done |
| E2E tests for console port + custom distro CRUD | Done |

### Phase 4: Help System (v0.7.0) — COMPLETE

`/help` page, contextual tooltips, and getting started wizard.

| Deliverable | Status |
| --- | --- |
| HelpPage.vue with structured, searchable help content | Done |
| Sections: Getting Started, VM Management, AI Features, Settings, FAQ | Done |
| /help route + sidebar navigation item | Done |
| HelpTooltip.vue component (q-tooltip + mdi-help-circle-outline trigger) | Done |
| Global toggle: settingsStore.showHelpTooltips (default: on) | Done |
| Tooltips on: Dashboard actions, Settings sections, VmDetail tabs | Done |
| GettingStartedDialog.vue with q-stepper | Done |
| Auto-trigger on first visit (no VMs + hasSeenWizard=false) | Done |
| Auto-dismiss when VMs arrive via WebSocket | Done |
| settingsStore.hasSeenWizard persistence + re-show button in Settings | Done |
| E2E specs for help page, tooltips, wizard | Done |

---

### Phase 5a: Curated Distro Catalog (v0.8.0) — COMPLETE

Three-tier distro system with curated catalog shipped with the app.

| Deliverable | Status |
| --- | --- |
| `CatalogStore` backend storage (JSON file, in-memory map) | Done |
| `distro-catalog.json` shipped with app (NixOS, CirrOS, Rocky, Alma, openSUSE) | Done |
| Three-tier merge: built-in → catalog → custom (custom overrides catalog overrides built-in) | Done |
| `GET /api/distros` returns `category` field (builtin/catalog/custom) + `description` | Done |
| Catalog name collision protection (POST 409, DELETE 400) | Done |
| `POST /api/distros/refresh-catalog` endpoint (optional remote URL) | Done |
| Auto-cleanup: custom distros shadowed by catalog entries removed on startup | Done |
| Settings page: Catalog Distributions section with "Catalog" badges + Refresh button | Done |
| Settings page: name collision validation in add-distro form | Done |
| CreateVmDialog: grouped dropdown by category (NixOS → Built-in → Catalog → Custom → Other) | Done |
| NixOS module: `distroCatalogUrl` option, ships catalog file, DISTRO_CATALOG_URL env var | Done |
| E2E tests for catalog section, badges, refresh button | Done |

---

### Phase 5b: Windows Guest Support (v0.9.0) — COMPLETE

Windows guest OS support via BYOISO (Bring Your Own ISO) with VNC install.

| Deliverable | Status |
| --- | --- |
| `guestOs: 'linux' \| 'windows'` field on VmDefinition, DistroImageSource, API types | Done |
| ISO-install provisioning path (download ISO, create blank disk, boot from CDROM) | Done |
| Windows-specific QEMU args: IDE disk + e1000 networking (driver-free install) | Done |
| Linux ISO-install path: VirtIO disk + VirtIO net with CDROM boot | Done |
| Auto-force QEMU + desktop mode for Windows guests (frontend + backend validation) | Done |
| Windows badges in distro lists (Settings) and CreateVmDialog dropdown | Done |
| Guest OS selector in add-custom-distro form (Settings) | Done |
| RAM warning banner for Windows VMs with < 2 GB | Done |
| Help page: "Windows Guests" Q&A section | Done |
| E2E specs for Windows distro workflows (Settings + CreateVmDialog) | Done |
| Backend test coverage for new methods (isIsoDistro, createBlankDisk, generateQemuArgs options) | Done |

> **Deferred to follow-up:** UEFI/OVMF firmware, VirtIO drivers ISO, autounattend.xml, TPM, cloudbase-init.

---

### Phase 5c: macOS Considerations (docs only) — COMPLETE

Documentation-only phase (legal limitation — macOS only runs on Apple hardware).

| Deliverable | Status |
| --- | --- |
| macOS guest limitation Q&A in Help page FAQ section | Done |

---

### Phase 5d: Mobile / Responsive Polish — COMPLETE

PWA improvements for mobile and small screens.

| Deliverable | Status |
| --- | --- |
| Serial console touch toolbar (Paste, Ctrl+C, Ctrl+D, Tab) on mobile | Done |
| Larger console font on mobile (16px vs 14px desktop) | Done |
| Responsive console min-height (300px on small screens) | Done |
| Dashboard grid/list view toggle with persisted preference | Done |
| VmListItem compact list component | Done |
| Stat cards horizontal scroll on mobile (no-wrap) | Done |
| Responsive dialog widths (CreateVm, GettingStarted: max-width 90vw) | Done |
| Quasar Screen plugin enabled for JS breakpoint detection | Done |
| E2E specs for mobile features (view toggle, dialog sizing, layout) | Done |

> **Deferred:** Capacitor native app builds (stretch — only if users request native features).

---

### Phase 6: Production Ready (v1.0.0) — 95% COMPLETE

Soft market entry — tier enforcement, security, hardening, and polish for initial release. Tier matrix fully decided (see decision log).

**Tier Gating Infrastructure**

| Deliverable | Status |
| --- | --- |
| Tier configuration model (`free` / `premium` / `enterprise`) + NixOS option | Done |
| Tier gating middleware — Fastify route-level enforcement via `requireTier()` decorator | Done |
| Frontend tier composable (`useTierFeature`) — hide/disable gated UI elements | Done |
| Tier gate unit tests (middleware rejects/allows per tier) | Done |
| Demo tier-switcher functional gates (7 files: app store, DemoLoginPage, mock-vm, useVmApi, VmCard, VmListItem, VmDetailPage, SettingsPage, WorkbenchPage) | Done |

**Authentication & Authorization**

| Deliverable | Status |
| --- | --- |
| Authentication system (cookie-based session, bcrypt passwords, SQLite) | Done |
| Login page UI + session token validation middleware | Done |
| Role model: admin / operator / viewer + `requireRole()` middleware | Done |
| Per-VM access control (enterprise, `PUT /api/users/:id/vms`) | Done |
| Bulk VM operations (enterprise, client-side per-VM loop in BulkActionBar) | Done |
| VM resource quotas (enterprise, `GET/PUT /api/users/:id/quotas`) | Done |

**Rate Limiting & Audit**

| Deliverable | Status |
| --- | --- |
| Per-user rate limiting middleware with tier gradient (5 / 10 / 30 per min) | Done |
| Rate limit response headers (`X-RateLimit-Remaining`, `Retry-After`) | Done |
| Server-provided AI agent key gating (reject if no server key + free tier) | Done |
| Push notification channels + resource alerts (premium) | Done |
| Audit log (all VM/user actions, queryable, `GET /api/audit`) | Done |

**Demo Site**

| Deliverable | Status |
| --- | --- |
| Demo tier-switcher toolbar (Free / Premium / Enterprise toggle) | Done |
| Tier-switcher wires into same gating middleware (runtime switch via `demoTierOverride`) | Done |
| Demo site deployment (static SPA, GitHub Pages) | Done |
| Mock VM create/delete for demo mode (mockCreateVm, mockDeleteVm) | Done |
| Cross-bridge routing edges in network topology (LB → app tier, gateway → services) | **Remaining** |

**Security & Polish**

| Deliverable | Status |
| --- | --- |
| Security hardening review + full audit (5 domains: legal/IP, secrets, supply chain, deployment, org governance) | Done |
| Performance profiling baseline (184KB main JS, 3.3MB total, lazy-loaded heavy chunks) | Done |
| Production deployment guide (NixOS module documentation) | Done |
| Dependency management pipeline (Dependabot triage, version-drift-check, blocked-package tracking) | Done |

**Release Pipeline**

| Deliverable | Status |
| --- | --- |
| `release.yml` workflow (tag-triggered build + GitHub Release creation) | Done |
| `sync-to-free.yml` workflow (PR-based Dev→Free sync) | Done |
| `release-publish` GitHub environment with required reviewer gate | Done |
| `release-verify-create` post-release verification script | Done |
| Release process dry run (push pre-release tag, verify full pipeline) | **Remaining** |

**Documentation & Media**

| Deliverable | Status |
| --- | --- |
| README GTM rewrite (hero image, install, tier breakdown, architecture) | Done |
| CONTRIBUTING.md rewrite (CoC, feedback mechanisms, license agreement) | Done |
| CHANGELOG.md collapsed to [1.0.0] release section | Done |
| NixOS minimum bumped to 25.11 across all platform docs | Done |
| Automated screenshot pipeline (11 PNGs, 2-phase capture, agent definition) | Done |
| DEMO-README updated (architecture diagram, tier-switcher docs) | Done |
| v1.0 documentation audit (SECURITY.md, issue templates, production guide) | Done |

> **Remaining:** Release process dry run (push `v1.0.0-rc1` tag, verify approval gates and sync workflows end-to-end). Cross-bridge routing edges in demo network topology (shows LB/gateway routing to downstream services across bridges — sells the v2 vision). All implementation, testing (269 unit + 582 backend + 183 TUI + 304 E2E = 1,338 total), security audits, and documentation are complete. Release gates: NixOS fresh-install smoke test + legal/insurance review (added 2026-03-03).

---

## Planned Phases

### Phase 7a: Container Visibility (v1.1.0)

Read-only container awareness alongside VMs. Apptainer-first strategy targets the underserved HPC/research market where no dashboard tooling exists.

> **Strategic rationale:** Apptainer (formerly Singularity) users are institutional (universities, national labs, pharma R&D), budget-backed (research grants include tooling line items), and NixOS-adjacent (reproducibility-minded). Zero competing dashboard products exist for this audience. Docker/Podman runtimes expand the addressable market via premium tier without competing head-to-head with Portainer.

| Task | Tier | Priority |
| --- | --- | --- |
| `ContainerRuntime` interface (list, inspect, logs, start, stop) | All | High |
| `ApptainerRuntime` implementation (`apptainer instance list/stats --json`) | All | High |
| Runtime auto-detection (probe which runtimes are installed on host) | All | High |
| `ContainerRuntimeRegistry` — aggregate across available runtimes | All | High |
| Container discovery API: `GET /api/containers`, `GET /api/containers/:id` | All | High |
| WebSocket: `container-status` message type on `/ws/status` | All | High |
| `ContainerCard` dashboard component (status, image, runtime badge) | Free | High |
| Container detail page (inspect, logs, bound paths, resource usage) | Free | Medium |
| `container-store` Pinia store with WebSocket-driven state | Free | High |
| Mock container data for demo mode | Demo | Medium |
| `DockerRuntime` implementation (Docker socket API) | Premium | Medium |
| `PodmanRuntime` implementation (Podman-compatible API) | Premium | Medium |
| NixOS module: `containerRuntimes` option (e.g. `["apptainer"]`) | All | Medium |
| E2E specs for container visibility (cards, detail page, runtime badges) | All | High |

### Phase 7b: Full Container Management (v1.2.0)

The closer. Ship the complete container management story in one release — not drip-fed. After 7a establishes visibility and proves demand, 7b delivers every action users asked for simultaneously. The goal is to make Weaver the obvious choice for anyone managing VMs and containers on the same nodes.

| Task | Tier | Priority |
| --- | --- | --- |
| **Apptainer actions** | | |
| Start/stop/restart Apptainer instances | Premium | High |
| Pull SIF images from OCI registries + library:// | Premium | High |
| Build SIF from definition files | Premium | High |
| GPU passthrough config (`--nv` NVIDIA, `--rocm` AMD) | Premium | High |
| Bind mount configuration UI | Premium | High |
| Overlay filesystem management | Premium | Medium |
| **Docker/Podman actions** | | |
| Start/stop/restart/remove containers | Premium | High |
| Pull images from registries (Docker Hub, GHCR, custom) | Premium | High |
| Container creation from image reference | Premium | High |
| Volume mount configuration | Premium | Medium |
| Environment variable management | Premium | Medium |
| **Unified creation flow** | | |
| `CreateContainerDialog` — from SIF or OCI image reference | Premium | High |
| Runtime selector (Apptainer / Docker / Podman) with capability badges | Premium | High |
| Resource limits UI (CPU, memory, GPU) | Premium | Medium |
| **Operations & governance** | | |
| Audit logging for all container actions | Premium | High |
| RBAC: container permissions separate from VM permissions | Enterprise | High |
| Bulk actions (stop all, restart all by runtime) | Premium | Medium |
| Container image cache management (list cached, prune unused) | Premium | Medium |
| **Infrastructure** | | |
| Container action API endpoints (`POST /api/containers/:id/start`, etc.) | Premium | High |
| `POST /api/containers` creation endpoint with Zod validation | Premium | High |
| Image registry API (`GET /api/images`, `POST /api/images/pull`) | Premium | High |
| NixOS module: container management options, GPU passthrough flags | Premium | Medium |
| E2E specs for full container management lifecycle | Premium | High |

> **Market positioning:** After this release, the product page reads: *"The only dashboard that manages your MicroVMs, Apptainer instances, and Docker containers from a single pane — with AI-powered diagnostics across all of them."* Nobody else can say this.

### Phase 7c: Cross-Resource AI Agent (v1.3.0)

The enterprise differentiator. AI agent gains awareness of both VMs and containers, enabling cross-resource diagnostics and topology visualization.

| Task | Tier | Priority |
| --- | --- | --- |
| Agent context injection: VM state + container state in prompt | Premium | High |
| Cross-resource diagnostics ("why can't container X reach VM Y?") | Premium | High |
| Agent actions on containers (restart, inspect, read logs) | Premium | High |
| Network topology view: VMs + containers + bridges + relationships | Enterprise | High |
| Agent-suggested resource placement ("this workload fits a MicroVM better") | Enterprise | Medium |
| Resource dependency mapping (which containers depend on which VMs) | Enterprise | Medium |
| Unified search across VMs and containers | Premium | Medium |
| Dashboard: combined resource stats (total VMs, total containers, by runtime) | Free | Medium |
| E2E specs for cross-resource agent and topology view | Enterprise | High |

> **Deferred:** Kubernetes/Nomad cluster orchestration (Phase 9+ if demand exists — stays single-node for now).

### Phase 8a: Import/Export Tier 1 (v1.4.0)

Config-level VM and container export/import. Lightweight portable archives for migration between hosts — no disk images (disk export deferred to v2.0.0 Phase 10a, "Save as Template" deferred to v2.1.0 Phase 10b).

Agent: [config-export-import](../../agents/v1.4.0/config-export-import.md)

| Task | Priority |
| --- | --- |
| Export VM config as `.tar.gz` archive (manifest + JSON + Nix) | High |
| Export container config (runtime, image, binds, GPU flags) | High |
| Import from archive with preview/dry-run | High |
| ExportDialog + ImportDialog components | High |
| Export/import API endpoints (4 endpoints) | High |
| Audit log entries for all export/import actions | Medium |
| Round-trip test: export → delete → import → restored | High |

### Phase 8b: Import/Export Tier 2 (v1.5.0)

External format parsers for migration from other platforms. Dockerfile parser gains dual output — Nix VM config or Apptainer SIF — since the container infrastructure from Phase 7 already exists.

| Task | Priority |
| --- | --- |
| Proxmox `.conf` parser → Nix generation | High |
| Libvirt XML parser → Nix generation | High |
| Dockerfile parser → dual output: Nix generation OR Apptainer SIF (free tier — onboarding funnel) | High |
| Vagrantfile parser → Nix generation (stretch) | Low |
| Import orchestrator (format detection → parse → preview → choose VM or container target) | High |
| Nix preview pane in ImportDialog | Medium |
| "Run as Container" option in ImportDialog (when container runtimes available) | Medium |
| Parser confidence scores + warning display | Medium |
| Unit tests with real-world sample files for each parser | High |

> **Dockerfile parser bridge:** Because container infrastructure ships in Phase 7, the Dockerfile parser can target both output paths from day one — no retrofit needed. Users import a Dockerfile and choose: run as an isolated MicroVM (Nix) or run as an Apptainer container (SIF). This is a unique migration funnel no competitor offers.

### Phases 9a/9b: Removed — Superseded by v2.x.x Backup Plan

> **Phases 9a (Config Export + Backup) and 9b (Advanced Backup) have been removed.** Their features are fully covered by the detailed [BACKUP-RECOVERY-PLAN.md](v2.0.0/BACKUP-RECOVERY-PLAN.md) and phased across v2.0.0–v2.5.0 in [IMPLEMENTATION-PHASING-PLAN.md](v2.0.0/IMPLEMENTATION-PHASING-PLAN.md).
>
> **Config export API** (`GET /api/vms/export`, `GET /api/vms/:name/export`) already exists in the codebase. A UI for it can ride any v1.x release as a minor addition.
>
> **v1.x.x ends at v1.5.0** (Import/Export Tier 2). Full backup, disk provisioning, templating, and clustering ship in v2.x.x.

---

## Dev Backlog — COMPLETE

All high-priority items resolved:

- ~~Error boundary component~~ Done (App.vue `onErrorCaptured`)
- ~~Loading skeletons for dashboard cards~~ Done (skeleton cards during connect)
- ~~Toast notifications for VM action results~~ Done (Quasar Notify)
- ~~Keyboard shortcuts~~ Done (?, D, S, N)
- ~~VM action confirmation dialogs (stop/restart)~~ Done
- ~~Dashboard card sorting~~ Done (name/status/manual drag-and-drop)
- ~~Animation on status transitions~~ Done (CSS transitions)
- ~~VM uptime formatting~~ Done (human-readable durations)
- ~~Template placeholder cleanup~~ Done

Remaining items (deferred to Phase 6 or post-v1):
- Increase unit test coverage to 70%+
- Component tests with @vue/test-utils
- Visual regression tests with Playwright
- i18n support structure

---

## Release Plan

| Version | Milestone | Key Features | Status |
| --- | --- | --- | --- |
| v0.1.0 | VM Registration CRUD | VM CRUD, dashboard, WebSocket, NixOS module | Done |
| v0.2.0 | Full Provisioning | Async provisioning, cloud images, Nix builds | Done |
| v0.3.0 | AI Agent Diagnostics | Agent streaming, BYOK, mock mode | Done |
| v0.4.0 | AI Settings UI / BYOK | Settings UI, vendor selection, mode indicator | Done |
| v0.5.0 | Hypervisor + Custom Distros | Multi-hypervisor, custom distros | Done |
| v0.6.0 | Serial Console Viewer | Serial console viewer, xterm.js | Done |
| v0.7.0 | Help System | Help page, tooltips, getting started wizard | Done |
| **v0.8.0** | **Curated Distro Catalog** | **Three-tier distro system, catalog store, grouped dropdown** | **Done** |
| **v0.9.0** | **Windows Guest Support** | **`guestOs` field, ISO-install path, IDE+e1000, BYOISO via VNC** | **Done** |
| v1.0.0 | Production Ready | Auth, RBAC, audit logging, tier gating, demo tier-switcher, security hardening — soft market entry | 95% (release dry run remaining) |
| v1.1.0 | Container Visibility | ContainerRuntime interface, Apptainer-first, read-only cards + detail | Planned |
| v1.2.0 | Full Container Management | Apptainer/Docker/Podman actions, GPU passthrough, creation dialog, RBAC — **the closer** | Planned |
| v1.3.0 | Cross-Resource AI Agent | VM+container agent context, topology view, cross-resource diagnostics | Planned |
| v1.4.0 | Import/Export Tier 1 | Config-level VM+container export/import archives, Nix config import | Planned |
| v1.5.0 | Import/Export Tier 2 | Proxmox/libvirt/Dockerfile→Nix+SIF dual-output parsers, migration tooling | Planned |
| v2.0.0 | Storage & Template Foundation | Disk lifecycle, built-in templates, cloud-init, import/export (Free) | Planned |
| v2.1.0 | Storage & Template Premium | Snapshots, cloning, save-as-template, template library, YAML cloud-init | Planned |
| v2.2.0 | Basic Clustering | Multi-node visibility, manual migration, config sync (Enterprise moat-breaker) | Planned |
| v2.3.0 | Backup Premium | Backup jobs, adapter interface, local/NFS adapters, restore | Planned |
| v2.4.0 | Storage & Template Enterprise | CoW, pools, quotas, versioning, fleet updates | Planned |
| v2.5.0 | Backup Enterprise + Plugins | Multi-target, retention, S3/restic/borg plugins, file restore | Planned |
| v2.x–3.0 | Edge Management | Remote NixOS node management — extension of clustering + lightweight agent. NixOS devices only. Manufacturing, cameras, retail, IoT | Planned |
| v3.0.0 | Advanced Clustering | HA, failover, live migration, shared storage, resource scheduling, LB-triggered auto-provisioning | Planned |

> **Current version:** 0.1.0 in package.json. A premature v1.0.0 tag (2026-02-22) was removed. v1.0.0 will be re-tagged after release dry run and NixOS smoke test. (Legal/insurance gate moved to v1.1.0 — v1.0 ships no security-posture feature domains per Decision #30.)

---

## Decision Log

| Date | Decision | Rationale |
| --- | --- | --- |
| -- | Use Fastify over Express | Better TypeScript support, faster performance |
| -- | WebSocket over SSE | Bidirectional communication, lower latency |
| -- | systemctl over MicroVM API | Direct, reliable, no additional dependencies |
| -- | Demo mode over staging | Simpler, no infrastructure cost |
| -- | hCaptcha over reCAPTCHA | Better privacy, comparable UX |
| -- | Pinia over Vuex | Official Vue 3 recommendation, simpler API |
| -- | Docker E2E over local | Consistent browser environment, CI-friendly |
| -- | BYOK/BYOV pattern | Users bring own keys; mock mode for demos |
| -- | Multiplex agent on /ws/status | Single WebSocket, filter by message type |
| -- | xterm.js for serial console | De facto terminal standard, WebSocket native |
| -- | Structured help content over markdown | Searchable, indexable, component-friendly |
| -- | tar.gz for VM export archives | Universal, streamable, no extra dependencies |
| -- | Tiered import/export (8a basic, 8b parsers) | Ship backup fast, iterate on migration tooling |
| -- | Dockerfile import in free tier | Onboarding funnel from Docker → NixOS ecosystem |
| -- | Intent-based import (generate Nix, not disk copy) | Aligns with declarative model, unique differentiator |
| 2026-02-13 | Apptainer-first container strategy | Underserved HPC/research market, zero dashboard competition, institutional budgets |
| 2026-02-13 | Containers before import/export (Phase 7, not 8) | Hit market with closer immediately after v1.0 soft entry; import/export is retention, containers are growth |
| 2026-02-13 | Soft entry (v1.0) then closer (v1.2) release model | v1.0 establishes product; v1.1 proves container demand; v1.2 ships complete management in one shot |
| 2026-02-13 | Container runtimes tier-gated | Apptainer free, Docker/Podman premium — avoids Portainer competition at free tier |
| 2026-02-13 | Dockerfile parser dual output (8b→7a bridge) | Parser lands after container infra exists — targets both Nix VM and Apptainer SIF from day one, no retrofit |
| 2026-02-18 | VM backup as Phase 9 (after import/export) | Config export is free-tier; disk backup is premium/enterprise. Separated from import/export to keep v1.4 focused on portable config archives |
| 2026-02-18 | Config export free-tier | JSON config export (`GET /api/vms/export`) available at free tier — lightweight, no disk I/O, natural extension of existing VM list API |
| 2026-02-18 | Demo = tier-switcher showcase | Demo site shows all features (mock data) with a toolbar tier toggle (Free/Premium/Enterprise). Switching tiers locks features in real-time — the toggle IS the sales pitch. Same gating middleware as production, just runtime-switchable |
| 2026-02-18 | VM lifecycle read/write split | Free: start/stop/restart + scan + register existing. Premium: create/provision + delete. Enterprise adds: per-VM access control, bulk operations, resource quotas. Demo: all features via mock data. Dashboard viewing is all tiers |
| 2026-02-18 | AI agent tier split | Free: mock + BYOK (5/min). Premium: + server key (10/min). Enterprise: configurable (default 30/min). BYOK at free removes adoption friction; server key is premium convenience. Rate limits are per-user upgrade enticers |
| 2026-02-18 | VM detail + console all free | Serial console, detail page, tags, description, autostart, provisioning logs, AI analysis tab — all free tier. Zero-cost to serve, makes free tier feel complete. Per-VM RBAC (enterprise) controls access at the VM level |
| 2026-02-18 | Distro management follows provisioning | View distro list: free. All mutations (add/delete custom, refresh catalog, URL override/validation): premium. Distro management is useless without VM creation — no free leak at v1.0.0 |
| 2026-02-18 | Notifications + audit tier split | In-app bell + history: free. Push channels (ntfy, email, webhook, web push) + resource alerts: premium. Audit log: enterprise. "See what happened" → "get told" → "prove who did what" |
| 2026-02-18 | Network: view free, bridges premium | Topology page + auto-detected bridges: free. Create/delete managed bridges + IP pools: premium. Firewall rules deferred to post-v1 (per-VM rules premium, inter-VM policy enterprise) |
| 2026-02-21 | Phase 8a stripped to config-only | Removed "Save as Template" (→ 10b) and "Optional disk image" (→ 10a) from Phase 8a. 8a = config-level import/export only. Clean boundary with v2 disk/template features |
| 2026-02-21 | Phases 9a/9b removed | Superseded by BACKUP-RECOVERY-PLAN.md. Features phased across v2.0.0–v2.5.0. Config export API already exists. v1.x.x ends at v1.5.0 |
| 2026-02-21 | v2.x.x phases added to release plan | v2.0.0–v2.5.0 covering disk, templates, clustering, backup, plugins. See IMPLEMENTATION-PHASING-PLAN.md |
| 2026-02-22 | v1.0.0 (not 0.x) for first public release | No pre-release marketing exists — no audience has been following 0.x development. First public impression IS the product. Shipping 0.x signals "not ready" to people with zero prior context. v1.0.0 says "this is the product" from day one |
| 2026-02-23 | AI providers as plugin system | Each AI provider (Anthropic, OpenAI, Ollama, ZenCoder, Custom) is a named plugin implementing `LlmProvider`. Free: Anthropic BYOK only. Premium: plugin system unlocked — install/configure/profile-switch between providers. Enterprise: same plugins + policy routing (assign provider per dept/server/tag/role, allowlist BYOK vendors, audit provider usage). Demo showcases all plugins with mock responses + tier-switcher. First plugin category — sets pattern for future plugin types |
| 2026-02-23 | TUI as first-class client | React/Ink. Same gating + tier strategy as web. v1.0.0 bar: free tier features + demo mode. 97% parity (28/29). Missing: enterprise bulk ops only |
| 2026-02-25 | Appliance VM + trial tier | Docker image ships with v1.0 free. NixOS appliance VM (QCOW2/OVA) post-v1.0. Trial tier: 5 VMs, 1 user, 30 days, watermark, auto-downgrades to free |
| 2026-02-26 | Brand system | Two-layer: amber product (#FF6B35) + green company frame (#7AB800). Bomb in footer/login/help only. Brand guide at docs/designs/BRAND-GUIDE.md |
| 2026-03-03 | 3-tier + plugins model | All future feature domains use plugin model, not tier-gated bundles. `requirePlugin()` middleware at v1.1.0. Plugin categories: AI, DNS, Firewall, Auth, Hardening, Backup. Enterprise = all plugins included. 6-3 score vs 4-tier |
| 2026-03-03 | TLS tiering | Free: no TLS feature. Premium: nudge to configure. Enterprise: TLS required |
| 2026-03-03 | Password policy | 14-char minimum + password manager recommended |
| 2026-03-03 | GDPR approach | Product-only GDPR compliance + license verification disclosure |
| 2026-03-03 | Firewall templates | Profile-dependent egress. Factory-aware hybrid (bake rules + hot-apply). nftables bridge family for zones (enterprise). Ships v1.2.0 after DNS plugin infra. Free tier = zero firewall features (insurance: no liability) |
| 2026-03-03 | DNS strategy | dnsmasq (host stub) + CoreDNS (DNS VM). `.vm.internal` domain. Recommend-don't-force auto-deploy. Template metadata → firewall profile. Email deliverability folded into DNS Resolver (Premium) + DNS Audit (Enterprise) |
| 2026-03-03 | Git forge | Forgejo (MIT, Codeberg e.V.). NixOS minimal + overlay. LAN only default, tiered exposure. Git Forge ships before Monitoring |
| 2026-03-03 | MFA as auth plugins | TOTP purchasable from Free ($3 foot-in-door → card on file → upgrade funnel). FIDO2 at Premium (personal security, not governance). SSO/LDAP at Enterprise. Home lab → corporate pipeline |
| 2026-03-03 | Hardening as plugins | AppArmor, Seccomp, Kernel — Enterprise-minimum, purchasable at Premium for home lab learning |
| 2026-03-03 | Insurance principle | Free = zero security features, zero liability. No scanning, no display, no implied security posture. Features behind paywall = insurable claims backed by audit trails |
| 2026-03-03 | Legal/insurance release gate | ToS/ToU review + insurance carrier touchpoint before every release with new feature domains. Added to release checklist |
| 2026-03-04 | Two-demo strategy | Public (curated Free + teasers) + Private (full tier-switcher + stage labels). Current demo → private. Public demo adds `VITE_DEMO_PUBLIC` flag. Private shows: Free=Released, Premium=User Testing, Enterprise=Fully Planned — In Development. [TWO-DEMO-STRATEGY.md](v1.0.0/TWO-DEMO-STRATEGY.md) |
| 2026-03-04 | Two-track pricing (C-premium) | Premium anchored vs Proxmox/VMware ("cheaper and better", $99/yr/node). Enterprise anchored vs Rancher/OpenShift/Nutanix/Spectro Cloud/HashiCorp/Canonical ("features, not price", $799/yr + $399 additional + $299 at 10+). 6-bellwether competitive analysis in [ENTERPRISE-VALUE-PROPOSITION.md](../business/marketing/FABRICK-VALUE-PROPOSITION.md). Pending founder meeting |
| 2026-03-04 | Edge management (NixOS only) | v2.x–3.0. Extension of multi-node clustering + lightweight agent + manage-over-WAN. NixOS devices only — immutable edge, zero drift, atomic rollbacks. $22B software market growing 37% CAGR. Segments: manufacturing (23%), video/cameras (29%), retail, IoT (27%). Not competing with K3s/SNO for generic containers |

---

*This roadmap is a living document. Update as phases progress and priorities shift.*
