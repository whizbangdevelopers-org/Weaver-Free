<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Developer Guide

Comprehensive architecture and development guide for Weaver.

## Terminal Setup

Development involves commands at different privilege levels across two directories. We recommend opening four named terminals and keeping them available throughout your session:

| Label | Directory | Privilege | Typical use |
|-------|-----------|-----------|-------------|
| `mvd` | `<project-root>/Weaver-Dev/` | user | npm, git, dev servers, Docker E2E |
| `mvd-root` | same | root | sudo ops (permission fixes, service restarts) |
| `nixos` | `/etc/nixos/` (or your NixOS config path) | user | editing Nix configuration |
| `nixos-root` | same | root | `nixos-rebuild`, `systemctl` |

When documentation or tooling refers to a terminal label, it will use this format:

> **`mvd-root`**: `sudo rm -rf node_modules`

This means: run the command in the terminal matching that label.

### Fresh install

For a clean slate (new dependencies, no cached state, first-time-user setup screen):

**`mvd`**: `npm run fresh-install`

This removes node_modules, lockfiles, build caches, and backend data, then reinstalls everything. After it completes, run `npm run dev:full` to start from the first-time admin setup screen.

### Claude Code integration

If you use Claude Code, add the terminal labels to your project memory so Claude can direct commands to the right terminal. Ask Claude to "remember my terminal labels" and provide the table above with your actual paths filled in. Claude will save them to its project memory and use the **`label`**: `command` format when it needs you to run something manually.

## Architecture Overview

Weaver follows a three-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Quasar 2 / Vue 3 / TypeScript)                   │
│  Port 9010 (dev) | Static files (production)                │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Pages    │  │Components│  │ Stores   │  │Composables │  │
│  │          │  │          │  │ (Pinia)  │  │            │  │
│  │Login     │  │ VmCard   │  │ vm-store │  │ useVmApi   │  │
│  │Dashboard │  │ Status   │  │agent-store│ │ useVmStatus│  │
│  │VmDetail  │  │ Badge    │  │auth-store│  │ useAgent   │  │
│  │          │  │ Agent    │  │ ui-store │  │useAgentStrm│  │
│  │          │  │ Dialog   │  │ app      │  │ usePlatform│  │
│  │          │  │          │  │          │  │ useAuth    │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
└────────────────────────┬──────────────────┬─────────────────┘
                         │ REST API         │ WebSocket
                         │ (JWT Bearer)     │ (?token=)
┌────────────────────────┴──────────────────┴─────────────────┐
│  BACKEND (Fastify / TypeScript)                              │
│  Port 3110                                                   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Routes       │  │ WebSocket    │  │ Services          │  │
│  │              │  │              │  │                   │  │
│  │ /api/workload     │  │ /ws/status   │  │ microvm.ts        │  │
│  │ /api/health  │  │ 2s broadcast │  │ agent.ts          │  │
│  │ /api/auth    │  │ agent-token  │  │ auth.ts           │  │
│  │ /api/distros │  │ agent-compl  │  │ llm-provider.ts   │  │
│  │ /api/workload/    │  │ provision-   │  │ image-manager.ts  │  │
│  │  :name/agent │  │  state-change│  │ provisioner.ts    │  │
│  │ /ws/console  │  │              │  │ mock-agent.ts     │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Middleware    │  │ Storage      │  │ License           │  │
│  │              │  │              │  │                   │  │
│  │ auth.ts      │  │ user-store   │  │ license.ts        │  │
│  │ (JWT verify) │  │ session-store│  │ (tier validation) │  │
│  │ rate-limit   │  │ vm-registry  │  │                   │  │
│  │ (@fastify/)  │  │ distro-store │  │                   │  │
│  │              │  │ catalog-store│  │                   │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
└────────────────────────┬──────────────────┬─────────────────┘
                         │ systemctl        │ systemctl
┌────────────────────────┴──────────────────┴─────────────────┐
│  NIXOS HOST                                                  │
│                                                              │
│  microvm@web-nginx.service    (10.10.0.10, 256MB, 1 vCPU)   │
│  microvm@web-app.service      (10.10.0.11, 512MB, 1 vCPU)   │
│  microvm@dev-node.service     (10.10.0.20, 512MB, 1 vCPU)   │
│  microvm@dev-python.service   (10.10.0.21, 512MB, 1 vCPU)   │
│  microvm@svc-postgres.service (10.10.0.30, 512MB, 1 vCPU)   │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
Weaver-Dev/
│
├── src/                            # Frontend source (Quasar/Vue 3)
│   ├── adapters/                   # Platform-specific implementations
│   ├── boot/                       # App initialization modules
│   ├── components/                 # Reusable Vue components
│   │   ├── VmCard.vue             # VM status card for dashboard grid
│   │   ├── StatusBadge.vue        # Color-coded status indicator
│   │   ├── AgentDialog.vue        # Streaming AI analysis dialog
│   │   ├── nag/UpgradeNag.vue     # Tier upgrade prompt (shown in free tier)
│   │   ├── premium/               # Weaver-only components (sync-excluded)
│   │   │   ├── NetworkMgmtPanel.vue   # Network management tabs
│   │   │   ├── NotificationPushChannels.vue  # Push channel config
│   │   │   └── network/           # Network management sub-components
│   │   │       └── BridgeManager.vue  # Bridges table (merges stored + auto-detected)
│   │   └── fabrick/            # Fabrick-only components (future)
│   ├── composables/                # Vue composables (reusable logic)
│   │   ├── index.ts               # Barrel export
│   │   ├── useVmApi.ts            # REST API wrapper (fetchVms, vmAction)
│   │   ├── useVmStatus.ts         # WebSocket live status connection
│   │   ├── usePlatform.ts         # Runtime environment detection
│   │   ├── useAgent.ts            # AI agent API wrapper (runAgent)
│   │   ├── useAgentStream.ts      # WebSocket agent message listener
│   │   └── useAuth.ts             # Authentication composable (login, logout, guards)
│   ├── config/                     # App configuration
│   ├── core/                       # Core utilities
│   ├── css/                        # Global SCSS styles
│   ├── i18n/                       # Internationalization strings
│   ├── layouts/                    # Page layout components
│   │   └── MainLayout.vue         # Primary app layout with sidebar
│   ├── pages/                      # Route page components
│   │   ├── LoginPage.vue          # Authentication login/first-run setup
│   │   ├── WorkbenchPage.vue      # Main dashboard with VM grid
│   │   ├── VmDetailPage.vue       # Single VM detail view
│   │   ├── IndexPage.vue          # Landing/index redirect
│   │   └── ErrorNotFound.vue      # 404 page
│   ├── plugins/                    # Vue/Quasar plugins
│   ├── router/                     # Vue Router configuration
│   │   └── routes.ts              # Route definitions + auth guards
│   ├── services/                   # Service layer
│   │   ├── api.ts                 # Axios-based API client
│   │   ├── agent-api.ts           # AI agent API client
│   │   ├── db.ts                  # IndexedDB for offline caching
│   │   └── mock-vm.ts            # Mock VM service (demo mode)
│   ├── stores/                     # Pinia state management
│   │   ├── index.ts               # Store initialization
│   │   ├── vm-store.ts            # VM state (list, selected, lastUpdate)
│   │   ├── agent-store.ts         # AI agent operation tracking
│   │   ├── auth-store.ts          # Authentication state (user, tokens, session)
│   │   ├── app.ts                 # App-level state (tier, connection)
│   │   └── ui-store.ts            # UI preferences state
│   ├── types/                      # TypeScript type definitions
│   │   ├── vm.ts                  # VmInfo, VmActionResult, VmAction
│   │   ├── agent.ts               # AgentAction, AgentOperation, AgentWsMessage
│   │   └── notification.ts        # NotificationEvent, ChannelConfig, event types
│   └── utils/                      # Utility functions
│
├── src-pwa/                        # PWA service worker
│   ├── register-service-worker.ts  # SW registration
│   └── custom-service-worker.ts    # Workbox caching strategies
│
├── backend/                        # Fastify API server
│   ├── src/
│   │   ├── index.ts               # Server entry point
│   │   ├── license.ts             # License tier validation and key parsing
│   │   ├── routes/
│   │   │   ├── vms.ts             # VM CRUD + actions + provisioning (free tier)
│   │   │   ├── health.ts          # Health check endpoint
│   │   │   ├── ws.ts              # WebSocket status + provisioning events
│   │   │   ├── console.ts         # WebSocket serial/VNC console proxy
│   │   │   ├── distros.ts         # Distribution catalog CRUD
│   │   │   ├── agent.ts           # AI agent operation routes
│   │   │   ├── auth.ts            # Authentication routes (login, register, refresh)
│   │   │   ├── audit.ts           # Audit log query endpoint
│   │   │   ├── notifications.ts   # Notification event list endpoint
│   │   │   ├── premium/           # Weaver-only routes (sync-excluded)
│   │   │   │   ├── index.ts       # Barrel: registers all premium route plugins
│   │   │   │   ├── notification-config.ts  # Admin notification config CRUD
│   │   │   │   ├── web-push.ts    # Web Push subscription management
│   │   │   │   └── network-mgmt.ts  # Bridge/IP pool/firewall management
│   │   │   └── fabrick/        # Fabrick-only routes (future)
│   │   ├── schemas/
│   │   │   ├── agent.ts           # Zod schemas for agent endpoints
│   │   │   ├── auth.ts            # Zod schemas for auth endpoints
│   │   │   └── notification-config.ts  # Zod schemas for notification config
│   │   ├── middleware/
│   │   │   ├── auth.ts            # JWT verification middleware (createAuthMiddleware)
│   │   │   ├── rbac.ts            # Role-based access control (requireRole)
│   │   │   └── vm-acl.ts          # Per-VM access control enforcement (fabrick)
│   │   ├── models/
│   │   │   └── user.ts            # User model definition
│   │   ├── storage/
│   │   │   ├── vm-registry.ts     # VM definition registry (VmDefinition type + JsonVmRegistry)
│   │   │   ├── distro-store.ts    # Custom distro persistence (data/distros.json)
│   │   │   ├── catalog-store.ts   # Distro catalog (built-in + remote + data/catalog.json)
│   │   │   ├── seed-data.ts       # DEFAULT_VMS seeded on first run (no vms.json)
│   │   │   ├── user-store.ts      # User persistence (data/users.json)
│   │   │   ├── audit-store.ts     # Audit log persistence (data/audit-log.json)
│   │   │   ├── notification-store.ts        # Notification event persistence
│   │   │   ├── notification-config-store.ts # Channel config persistence
│   │   │   ├── web-push-subscription-store.ts # Browser push subscriptions
│   │   │   ├── session-store.ts   # Session store interface (adapter pattern)
│   │   │   ├── memory-session-store.ts  # In-memory sessions (demo/free tier)
│   │   │   ├── sqlite-session-store.ts  # SQLite sessions (weaver/fabrick)
│   │   │   ├── quota-store.ts     # Per-user VM quotas (fabrick)
│   │   │   ├── vm-acl-store.ts    # Per-VM access control lists (fabrick)
│   │   │   └── preset-tag-store.ts  # Preset tag vocabulary
│   │   ├── services/
│   │   │   ├── microvm.ts         # systemctl interaction + provisioner integration
│   │   │   ├── image-manager.ts   # Base image download, overlay, cloud-init, QEMU args
│   │   │   ├── provisioner-types.ts  # Provisioner interface + event emitter types
│   │   │   ├── agent.ts           # AI agent orchestration
│   │   │   ├── auth.ts            # Authentication service (JWT, bcrypt, sessions)
│   │   │   ├── audit.ts           # Audit logging service
│   │   │   ├── notification.ts    # Notification dispatch + dynamic adapter loading
│   │   │   ├── adapters/          # Notification adapter interface (free tier)
│   │   │   │   └── notification-adapter.ts  # NotificationAdapter interface
│   │   │   ├── premium/           # Weaver-only services (sync-excluded)
│   │   │   │   ├── provisioner.ts       # VM provisioning (cloud-init, ISO, QEMU lifecycle)
│   │   │   │   ├── network-manager.ts    # Bridge/IP pool/firewall management
│   │   │   │   └── adapters/             # Premium notification adapters
│   │   │   │       ├── ntfy-adapter.ts   # ntfy push adapter
│   │   │   │       ├── email-adapter.ts  # SMTP email adapter
│   │   │   │       ├── webhook-adapter.ts  # Webhook adapter
│   │   │   │       └── web-push-adapter.ts # Web Push adapter
│   │   │   ├── fabrick/        # Fabrick-only services (future)
│   │   │   ├── llm-provider.ts    # Pluggable LLM vendor interface
│   │   │   └── mock-agent.ts      # Canned responses for demo mode
│   │   └── db/                    # Database utilities
│   ├── data/
│   │   └── distro-catalog.json    # Shipped distro catalog (cloud images + ISOs)
│   └── package.json               # Backend dependencies
│
├── nixos/                          # NixOS integration
│   ├── default.nix                # NixOS service module (options + systemd)
│   └── package.nix                # Nix package definition (single source of truth for hashes)
│
├── demo/                           # Demo mode assets (README, deployment docs)
│
├── testing/                        # Test suites
│   ├── unit/                      # Vitest unit tests
│   │   ├── composables/           # Composable tests
│   │   ├── services/              # Service tests
│   │   └── stores/                # Store tests
│   ├── e2e/                       # Playwright E2E specs
│   │   └── helpers/               # Shared E2E helpers
│   ├── e2e-docker/                # Dockerized E2E runner
│   └── post-release/              # Post-release verification
│
├── scripts/                        # Helper scripts
│   ├── security-audit.sh          # Security audit with report
│   ├── setup-project.sh           # Initial project setup
│   ├── validate-icons.sh          # Icon validation
│   ├── generate-license.ts        # License key generation utility
│   ├── verify-form-rules.ts       # Static form validation audit
│   └── verify-form-e2e-coverage.ts # E2E coverage gap checker
│
├── tui/                            # Terminal UI sub-package (Ink/React)
│   ├── src/
│   │   ├── index.tsx              # Entry: arg parsing, Ink render
│   │   ├── app.tsx                # Root component, view router
│   │   ├── types/                 # Type copies (vm.ts, agent.ts, host.ts)
│   │   ├── client/                # API + WebSocket + auth credential store
│   │   ├── components/            # Ink components (VmList, VmDetail, etc.)
│   │   │   ├── premium/          # Weaver-tier views (excluded from free repo)
│   │   │   ├── fabrick/       # Fabrick-tier views (excluded from free repo)
│   │   │   └── nag/              # UpgradeNag (free tier, never excluded)
│   │   ├── hooks/                 # React hooks (useTierView)
│   │   ├── config/                # Tier view registry (tier-views.ts)
│   │   └── demo/                  # Mock clients for --demo mode
│   ├── package.json               # Separate deps (ink, react, ws, conf)
│   └── tsconfig.json              # jsx: react-jsx, no DOM lib
│
├── docs/                           # Documentation
├── .github/                        # GitHub configuration
│   ├── workflows/                 # CI/CD workflows
│   ├── ISSUE_TEMPLATE/            # Issue templates
│   └── PULL_REQUEST_TEMPLATE.md   # PR template
│
├── .githooks/                      # Git hooks
├── quasar.config.cjs              # Quasar build configuration
├── vitest.config.ts               # Unit test configuration
├── playwright.config.ts           # E2E test configuration
├── tsconfig.json                  # TypeScript configuration
└── package.json                   # Root package configuration
```

## Tier Directory Convention

Premium and fabrick code lives in `premium/` and `fabrick/` subdirectories within `routes/`, `services/`, `components/`, and `pages/`. These directories are excluded from the free public repo via `.github/sync-exclude.yml`.

**Three-layer defense in depth:**

1. **Sync exclusion** — `premium/` and `fabrick/` directories are stripped when syncing to the free repo, so source code is never publicly visible.
2. **Frontend `useTierFeature`** — Reactive tier-gated component. Watches `appStore.tier` and dynamically loads the premium component when the tier is sufficient. Falls back to `UpgradeNag` when the tier is insufficient or the component directory doesn't exist (free repo). Unlike `defineAsyncComponent`, re-evaluates when the tier changes at runtime.
3. **Backend `requireTier`** — Server-side 403 if the license tier is insufficient (unchanged).

**Backend pattern** — Premium routes are loaded dynamically in `index.ts`:
```typescript
try {
  const { premiumRoutes } = await import('./routes/weaver/index.js')
  await fastify.register(premiumRoutes, { ...opts })
} catch {
  fastify.log.info('Premium routes not available (free tier)')
}
```

**Frontend pattern** — Premium components use `useTierFeature`:
```typescript
const PremiumPanel = useTierFeature({
  minimumTier: 'weaver',
  loader: () => import('src/components/weaver/MyComponent.vue'),
  featureName: 'My Feature',
  features: ['Feature 1', 'Feature 2'],
})
```

**TUI pattern** — Same concept, React hook + dynamic import:
```typescript
// config/tier-views.ts — declarative registry
const TIER_VIEWS = {
  network: {
    minimumTier: 'weaver',
    loader: () => import('../components/weaver/NetworkView.js'),
    exportName: 'NetworkView',
    featureName: 'Network Topology',
    features: ['Bridge visualization', 'VM-to-bridge mapping'],
  },
}

// app.tsx — hook per view, nag fallback
const networkView = useTierView('network', TIER_VIEWS.network, state.tier)
// In render: networkView.isNag ? <UpgradeNag .../> : <networkView.Component .../>
```

The TUI `useTierView` hook handles three modes: (1) sufficient tier → dynamic import succeeds → real component, (2) insufficient tier → nag immediately (no import attempt), (3) module absent (free repo) → import fails → nag fallback. The `UpgradeNag` component shows feature name, description, feature bullets, and a pricing URL.

## When Separate Repos Would Make Sense

The current strategy uses two repositories (Dev private + Free public mirror) with license keys as the runtime tier gate. This is the right choice for a solo developer shipping v1. Revisit and consider separate repos per tier if any of these become true:

1. **Fabrick customers require source escrow or audit access** — they need their own repo with only their tier's code, not your full development history.
2. **You hire developers who should only see certain tiers** — a contractor working on the free tier shouldn't have access to weaver/fabrick source.
3. **A tier needs fundamentally different CI/CD** — for example, fabrick requires VMware test infrastructure that would slow down or complicate the shared pipeline.
4. **The free tier becomes a community project** — external contributors submitting PRs shouldn't see premium code in the same repo.

None of these are true today, and adding repos is easy — removing the complexity of multi-repo sync is hard. Stay with two repos until a concrete trigger forces the split.

## Development Workflow

### Starting Development

```bash
# 1. Install all dependencies
npm install
cd backend && npm install && cd ..

# 2. Set up git hooks
git config core.hooksPath .githooks

# 3. Start the backend (terminal 1)
npm run dev:backend

# 4. Start the frontend (terminal 2)
npm run dev
```

### Development Ports

| Service | Port | Description |
| ------- | ---- | ----------- |
| Quasar Dev Server | 9010 | Frontend with HMR |
| Fastify Backend | 3110 | API + WebSocket server |
| Playwright UI | 9323 | E2E test interactive mode |

### API Proxy

In development, the Quasar dev server proxies API requests to the backend. This is configured in `quasar.config.cjs`:

- `/api/*` proxies to `http://localhost:3110/api/*`
- `/ws/*` proxies to `ws://localhost:3110/ws/*`

In production, the Fastify server serves both the static frontend and API from the same port.

### Pre-flight Port Check

All dev scripts automatically verify their ports are free before starting. If a port is occupied, the script exits immediately with the PID and process name of the conflicting process:

```
Port 3110 is in use:
  PID 12345 — node
    cmd: node backend/dist/index.js --port 3110

Kill conflicting processes or use different ports.
  Quick fix: lsof -ti :PORT | xargs kill
```

To manually check ports:

```bash
./scripts/check-ports.sh 9010 3110    # Check specific ports
```

The check runs automatically — no action needed for normal `npm run dev:full` usage.

### Resource Locking (Forge)

Composite scripts (`dev:full`, `e2e:live`) are wrapped with `flock` via `scripts/with-lock.sh`. If another agent or process already holds the lock, execution **waits in line** until the lock is released — no silent collisions, no CPU thrashing on small systems.

```bash
./scripts/with-lock.sh dev npm run dev:backend   # Acquire "dev" lock
./scripts/with-lock.sh e2e scripts/nix-fresh-test.sh  # Acquire "e2e" lock
```

Lock files live in `/tmp/mvd-<name>.lock`. They auto-release when the process exits (kernel-managed via `flock`, no stale locks). Lock names used by npm scripts:

| Lock | Scripts |
|------|---------|
| `dev` | `dev:full`, `dev:full-provision` |
| `e2e` | `e2e:live`, `e2e:live:free`, `e2e:live:skip-build` |

### Form Validation Audit

Two scripts verify that all Quasar form fields follow the project's validation conventions:

```bash
# Static analysis — scans all Vue SFCs for validation compliance
npm run audit:forms              # Console report
npx tsx scripts/verify-form-rules.ts --json   # JSON output

# E2E coverage gap checker — cross-references rules against E2E specs
npm run audit:e2e-coverage       # Console report (exits 1 if gaps found)
npx tsx scripts/verify-form-e2e-coverage.ts --json  # JSON output
```

The static scanner checks every `q-input` and `q-select` for:
- `:rules` prop present (or field explicitly exempt — toggles, static selects)
- `lazy-rules` attribute (preferred over greedy validation)
- Shared validation utils from `src/utils/validation.ts` used where applicable
- Consistent trigger pattern (`ref.validate()` + `hasError` or `<q-form @submit>`)

The E2E coverage checker identifies which validation error messages have corresponding `toContainText` assertions in `testing/e2e/*.spec.ts`.

### Distro Catalog Testing

A CLI tool validates that all catalog distro images are downloadable, provisionable, and bootable. It talks to the backend via HTTP and exercises the full provisioning stack.

**Prerequisites:** Backend running with `PROVISIONING_ENABLED=true`, bridge configured (`BRIDGE_GATEWAY`), QEMU/KVM available.

```bash
# Typical workflow:
npm run test:distros:dry       # 1. Verify config + URL reachability
npm run test:distros:preload   # 2. Prime the image cache (optional)
npm run test:distros           # 3. CirOS smoke test (~30s)
npm run test:distros:all       # 4. Full catalog test (all 11 distros)
npm run test:distros:cleanup   # 5. Remove test-* VMs

# Additional modes:
npx tsx scripts/test-distro-catalog.ts --distros ubuntu,fedora  # Filtered test
npx tsx scripts/test-distro-catalog.ts --test my-custom-distro  # Selective smoke test
npx tsx scripts/test-distro-catalog.ts --all --no-preload       # Skip preload (cached)
npx tsx scripts/test-distro-catalog.ts --all --with-cleanup     # Test + auto-destroy
npx tsx scripts/test-distro-catalog.ts --dry-run --json         # JSON output
```

**Modes:**

| Mode | Flag | Description |
|------|------|-------------|
| Smoke test | _(default)_ | CirOS only (~20 MB) — fastest lifecycle validation |
| Filtered | `--distros a,b` | Named distros with auto-preload |
| Full catalog | `--all` | All distros with auto-preload |
| Selective | `--test <name>` | Single distro with auto-cleanup (new image validation) |
| Readiness | `--dry-run` | Config check + URL reachability (no VMs) |
| Preload | `--preload` | Download all images without provisioning |
| Cleanup | `--cleanup` | Destroy all `test-*` VMs |

**UI integration:** Admins can also test individual distros from **Settings > Distributions** using the play button on each distro row. This triggers the same provisioning smoke test via the `POST /api/distros/:name/test` endpoint.

### E2E Testing (Dockerized Playwright)

All E2E tests run inside Docker — never bare `npx playwright test`.

```bash
npm run e2e            # Run all tests + auto-analyze results
npm run e2e:single     # Run a single spec file
npm run e2e:analyze    # Re-analyze results from the last run
```

`npm run e2e` does three things:
1. Runs all Playwright specs via `testing/e2e-docker/scripts/run-tests.sh`
2. Prints a categorized triage report (root cause patterns, fix suggestions, file heatmap)
3. Appends the triage report to `testing/e2e-docker/output/triage-log.md`

The triage log is a rolling, timestamped markdown file that persists across runs. To promote findings into project documentation, tell Claude Code **"capture e2e lessons"** — it reads the log and writes new patterns to `docs/development/LESSONS-LEARNED.md` or `docs/development/KNOWN-GOTCHAS.md`.

E2E spec files live in `testing/e2e/*.spec.ts` with shared helpers in `testing/e2e/helpers/`. Auth is pre-configured via `storageState` written by `global-setup.ts`.

#### Free-Tier E2E (Marketing Funnel)

A separate Docker profile runs the `free-tier-funnel.spec.ts` spec against a backend configured with a real free-tier license key:

```bash
npm run e2e:free       # Run free-tier marketing funnel tests
```

This generates a free-tier license key via `generateLicenseKey()` from `backend/src/license.ts`, passes it through `LICENSE_KEY` + `LICENSE_HMAC_SECRET` env vars to the Docker container, and runs ~25 assertions that verify:

- **Backend 403s** — premium endpoints (create/delete VM, refresh catalog, host details) return 403
- **Dashboard** — Create VM button hidden, no delete on VM cards, start/stop/restart still available
- **Settings** — host detail lock message, Premium badge on server key toggle, distro management buttons hidden, resource quotas lock message
- **Network** — topology graph renders, Network Management replaced by UpgradeNag
- **Notifications** — in-app section visible, push channels replaced by UpgradeNag
- **Navigation** — Audit Log hidden from sidebar, direct audit URL shows fabrick lock
- **VM Detail** — delete button hidden, AI diagnose accessible (BYOK)

Each assertion maps to a revenue conversion touchpoint. If an upgrade nag breaks, a marketing funnel step is lost.

### Marketing Screenshots

Automated screenshot capture produces 11 marketing-quality PNGs for the README and docs:

```bash
./scripts/capture-screenshots.sh   # Full pipeline: standard + demo modes
```

The pipeline has two phases:
1. **Standard mode** — runs `testing/e2e/screenshots.spec.ts` via Docker E2E (premium tier, 5 VMs). Captures: vm-detail, network-topology, settings, users, help, audit, login.
2. **Demo mode** — builds demo SPA, serves on :9030, runs `testing/e2e/demo-screenshots.spec.ts` via Docker. Captures: hero-dashboard (8 VMs), tier-switcher-free, tier-switcher-fabrick, demo-login.

Output lands in `docs/designs/*.png`. The agent definition at `.claude/agents/screenshot-capture.md` enables on-demand re-runs.

To run phases individually:

```bash
# Standard mode only
cd testing/e2e-docker && ./scripts/run-single.sh testing/e2e/screenshots.spec.ts

# Demo mode only (requires demo SPA built + served)
VITE_DEMO_MODE=true npx quasar build -m spa
npx serve dist/spa -l 9030 &
cd testing/e2e-docker && DEMO_SCREENSHOTS=true \
  TEST_FILE=testing/e2e/demo-screenshots.spec.ts \
  docker compose --profile single up playwright-single --build --abort-on-container-exit
```

## API Endpoints Reference

### Summary

| Method | Endpoint | Description | Auth |
| ------ | ----------------------- | -------------------------- | ---- |
| POST | `/api/auth/register` | Register user (first = admin) | Public* |
| POST | `/api/auth/login` | Authenticate user | Public |
| POST | `/api/auth/refresh` | Refresh access token | Public |
| POST | `/api/auth/logout` | Revoke session | Required |
| GET | `/api/auth/me` | Get current user info | Required |
| GET | `/api/auth/setup-required` | Check first-run status | Public |
| PUT | `/api/auth/password` | Change password | Required |
| GET | `/api/workload` | List all VMs | Required |
| GET | `/api/workload/:name` | Get single VM | Required |
| POST | `/api/workload` | Create/provision a VM (or register-only in demo) | Admin |
| DELETE | `/api/workload/:name` | Destroy provisioned VM or untrack from registry | Admin |
| GET | `/api/workload/:name/logs` | Get provisioning log for a VM | Required |
| POST | `/api/workload/scan` | Discover microvm@* systemd services | Admin |
| POST | `/api/workload/:name/start` | Start VM | Required |
| POST | `/api/workload/:name/stop` | Stop VM | Required |
| POST | `/api/workload/:name/restart` | Restart VM | Required |
| POST | `/api/workload/:name/agent` | Start AI agent operation (202) | Required |
| GET | `/api/workload/:name/agent/:operationId` | Get agent operation status | Required |
| GET | `/api/users` | List all users (no password hashes) | Admin |
| GET | `/api/users/:id` | Get single user by ID | Admin |
| PUT | `/api/users/:id/role` | Change user role | Admin |
| DELETE | `/api/users/:id` | Delete user account | Admin |
| GET | `/api/users/:id/quotas` | Get user quota + current usage | Admin (fabrick) |
| PUT | `/api/users/:id/quotas` | Set user quota limits | Admin (fabrick) |
| GET | `/api/users/:id/vms` | Get per-VM ACL for a user | Admin (fabrick) |
| PUT | `/api/users/:id/vms` | Set per-VM ACL for a user | Admin (fabrick) |
| DELETE | `/api/users/:id/vms` | Clear per-VM ACL for a user | Admin (fabrick) |
| GET | `/api/audit` | Query audit log (paginated) | Admin/Operator |
| GET | `/api/notifications` | List recent notifications (paginated) | Required |
| GET | `/api/notifications/config` | Full notification channel config | Admin |
| PUT | `/api/notifications/config/channels/:channelId` | Create/update channel | Admin (premium+) |
| DELETE | `/api/notifications/config/channels/:channelId` | Remove channel | Admin (premium+) |
| POST | `/api/notifications/config/channels/:channelId/test` | Test a channel | Admin |
| PUT | `/api/notifications/config/resource-alerts` | Update alert thresholds | Admin (premium+) |
| POST | `/api/notifications/web-push/subscribe` | Register push subscription | Required |
| DELETE | `/api/notifications/web-push/subscribe` | Unsubscribe push | Required |
| GET | `/api/notifications/web-push/vapid-public-key` | Get VAPID public key | Required |
| POST | `/api/notifications/web-push/generate-vapid-keys` | Generate VAPID key pair | Admin |
| GET | `/api/distros` | List all distributions (built-in + catalog + custom) | Required |
| POST | `/api/distros` | Add a custom distribution | Admin |
| DELETE | `/api/distros/:name` | Remove a custom distribution | Admin |
| POST | `/api/distros/refresh-catalog` | Refresh remote distro catalog | Admin/Operator |
| GET | `/api/distros/url-status` | Get URL validation results + lastRunAt | Required |
| POST | `/api/distros/validate-urls` | Trigger immediate URL validation | Admin |
| PUT | `/api/distros/:name/url` | Update/override a distro image URL | Admin |
| DELETE | `/api/distros/:name/url-override` | Remove URL override, restore default | Admin |
| POST | `/api/distros/:name/test` | Start a "will it boot?" smoke test | Admin |
| GET | `/api/distros/:name/test` | Get smoke test status/result | Admin |
| GET | `/api/host` | Detailed host info (CPU topology, disk, network, metrics) | Admin (premium) |
| GET | `/api/network/bridges` | List bridges | Admin/Operator (premium) |
| POST | `/api/network/bridges` | Create bridge | Admin/Operator (premium) |
| DELETE | `/api/network/bridges/:name` | Delete bridge | Admin/Operator (premium) |
| GET | `/api/network/firewall` | Get firewall rules | Admin/Operator (premium) |
| GET | `/api/network/ip-pool/:name` | Get IP pool for bridge | Admin/Operator (premium) |
| PUT | `/api/network/ip-pool/:name` | Set IP pool for bridge | Admin/Operator (premium) |
| GET | `/api/network/topology` | Get network topology (bridges + nodes) | Admin/Operator |
| GET | `/api/organization` | Organization identity (name, logo, contact info) | Required |
| PUT | `/api/organization` | Update organization identity | Admin (weaver+) |
| GET | `/api/tags` | List preset tags | Required |
| PUT | `/api/tags` | Replace preset tags (max 50) | Admin |
| GET | `/api/health` | Health check (includes basic host info + organization) | Public |
| GET | `/api/system/doctor` | System diagnostics (hardware, KVM, IOMMU, bridge, license) | Admin |
| WS | `/ws/status` | Real-time VM + agent + provisioning status | Required |
| WS | `/ws/console/:vmName` | Serial/VNC console proxy (TCP bridge) | Required |

\* Registration is public but only the first registered user becomes admin. Subsequent registrations may be restricted by admin policy.

### GET /api/workload

Returns all VM definitions with their current status.

**Response:**
```json
[
  {
    "name": "web-nginx",
    "status": "running",
    "ip": "10.10.0.10",
    "mem": 256,
    "vcpu": 1,
    "hypervisor": "qemu",
    "uptime": "2026-01-15T10:30:00.000Z"
  }
]
```

### GET /api/workload/:name

Returns a single VM by name.

**Parameters:**
- `name` -- VM name matching `^[a-z][a-z0-9-]*$`

**Response:** Single VmInfo object or 404.

### POST /api/workload/scan

Discovers `microvm@*.service` systemd units on the host and adds newly found VMs to the registry. Runs `systemctl list-units` (no sudo required). Admin only, rate-limited to 5/min.

**Response:**
```json
{ "discovered": ["web-nginx", "db-postgres"], "added": ["db-postgres"], "existing": ["web-nginx"] }
```

On production first startup with an empty registry, the backend auto-scans once.

### POST /api/workload

Create and optionally provision a VM. Admin only. Requires free tier or above.

When provisioning is enabled and a `distro` is specified, the VM is provisioned asynchronously (cloud-init image download, overlay creation, cloud-init ISO generation). The response returns immediately with 202; provisioning progress streams via WebSocket `provision-state-change` events.

When provisioning is disabled (demo mode), the VM is simply registered in the dashboard.

**Request Body:**
```json
{
  "name": "my-vm",
  "ip": "10.10.0.50",
  "mem": 512,
  "vcpu": 1,
  "hypervisor": "qemu",
  "distro": "arch",
  "diskSize": 20,
  "vmType": "server",
  "guestOs": "linux"
}
```

- `name` (required): `^[a-z][a-z0-9-]*$`, 2-63 characters
- `ip` (required): Valid IPv4 address, must be in the bridge subnet
- `mem` (required): Memory in MB, integer 64-65536
- `vcpu` (required): vCPU count, integer 1-32
- `hypervisor` (required): `"qemu"` | `"cloud-hypervisor"` | `"crosvm"` | `"kvmtool"` | `"firecracker"`
- `distro` (optional): Distribution name from the distro catalog, or `"other"` for ad-hoc images
- `diskSize` (optional): Disk size in GB, integer 5-500 (default: 10)
- `vmType` (optional): `"server"` | `"desktop"` (default: `"server"`)
- `imageUrl` (optional): Direct URL to a disk image (required when `distro` is `"other"`). Supports `http://`, `https://`, `file://`
- `imageFormat` (optional): `"qcow2"` | `"raw"` | `"iso"` (default: `"qcow2"`, only used with `distro: "other"`)
- `cloudInit` (optional): Whether the image supports cloud-init auto-configuration (default: `true` for qcow2/raw, `false` for iso)

**Response (202 with provisioning, 200 without):**
```json
{ "success": true, "message": "VM 'my-vm' created, provisioning started" }
```

**Constraints:**
- Cloud/ISO distros (Ubuntu, Fedora, etc.) require QEMU hypervisor
- Desktop mode requires QEMU hypervisor
- Firecracker is incompatible with NixOS MicroVMs (no virtiofs/9p support)

**Errors:**
- 400: Invalid name format, validation failure, or hypervisor/distro incompatibility
- 403: Demo tier (provisioning requires free+)
- 409: VM with that name already exists

### GET /api/workload/:name/logs

Returns the provisioning log for a VM. The log contains output from image download, overlay creation, and QEMU startup.

**Response (200):**
```json
{ "log": "Downloading arch base image...\nCreating overlay disk...\n..." }
```

### DELETE /api/workload/:name

Destroy a provisioned VM or untrack a registered VM. Admin only.

When provisioning is enabled, delegates to the provisioner which cleans up VM files (disk overlay, cloud-init ISO, TAP interface) and removes the VM from the registry. When provisioning is disabled, stops the VM service (best-effort) and removes from registry.

**Parameters:**
- `name` -- VM name matching `^[a-z][a-z0-9-]*$`

**Response (200):**
```json
{ "success": true, "message": "VM 'my-vm' destroyed" }
```

**Errors:**
- 404: VM not found in registry

### GET /api/workload/export

Export all VM configurations as JSON. Free tier and above. Returns pure configuration data (no runtime status like uptime or current state) — suitable for version control or host migration.

**Response (200):**
```json
{
  "exportedAt": "2026-02-18T12:00:00.000Z",
  "version": "1.0",
  "vms": [
    {
      "name": "web-nginx",
      "ip": "10.10.0.10",
      "mem": 256,
      "vcpu": 1,
      "hypervisor": "qemu",
      "distro": "nixos",
      "vmType": "server",
      "guestOs": "linux",
      "tags": ["web", "production"],
      "bridge": "br0"
    }
  ]
}
```

### GET /api/workload/:name/export

Export a single VM's configuration as JSON. Same format as above but with a single-object `vm` field instead of an array.

**Parameters:**
- `name` -- VM name matching `^[a-z][a-z0-9-]*$`

**Response (200):**
```json
{
  "exportedAt": "2026-02-18T12:00:00.000Z",
  "version": "1.0",
  "vm": {
    "name": "web-nginx",
    "ip": "10.10.0.10",
    "mem": 256,
    "vcpu": 1,
    "hypervisor": "qemu",
    "distro": "nixos",
    "vmType": "server",
    "guestOs": "linux",
    "tags": ["web", "production"],
    "bridge": "br0"
  }
}
```

**Errors:**
- 404: VM not found

### POST /api/workload/:name/start

Starts a stopped VM by calling `sudo systemctl start microvm@<name>.service`.

**Response:**
```json
{ "success": true, "message": "VM 'web-nginx' started" }
```

### POST /api/workload/:name/stop

Stops a running VM by calling `sudo systemctl stop microvm@<name>.service`.

### POST /api/workload/:name/restart

Restarts a VM by calling `sudo systemctl restart microvm@<name>.service`.

### POST /api/workload/:name/agent

Starts an AI agent operation (diagnose, explain, or suggest). Returns immediately with 202; results stream via WebSocket.

**Request Body:**
```json
{
  "action": "diagnose",
  "apiKey": "sk-...",
  "vendor": "anthropic"
}
```

- `action` (required): `"diagnose"` | `"explain"` | `"suggest"`
- `apiKey` (optional): BYOK — user-provided API key
- `vendor` (optional): BYOV — `"anthropic"` (more vendors planned)

**Response (202):**
```json
{
  "operationId": "550e8400-e29b-41d4-a716-446655440000",
  "vmName": "web-nginx",
  "action": "diagnose",
  "status": "started"
}
```

**Errors:**
- 400: Invalid VM name, action, or vendor
- 429: An agent operation is already running

### GET /api/workload/:name/agent/:operationId

Returns the current state of an agent operation (for polling fallback).

**Response (200):**
```json
{
  "operationId": "550e8400-...",
  "vmName": "web-nginx",
  "action": "diagnose",
  "status": "complete",
  "tokens": "## Diagnosis: web-nginx\n...",
  "startedAt": "2026-01-01T00:00:00.000Z",
  "completedAt": "2026-01-01T00:00:05.000Z"
}
```

### GET /api/host

Returns detailed host information including NixOS version, CPU topology (sockets, cores, threads, cache sizes), disk usage, network interfaces, and live metrics (free RAM, load averages). Requires admin role and premium tier. Uses 60-second cache. In demo mode, returns mock data.

**Response (200):**
```json
{
  "nixosVersion": "25.11.717285",
  "cpuTopology": {
    "sockets": 1, "coresPerSocket": 8, "threadsPerCore": 2,
    "virtualizationType": "VT-x",
    "l1dCache": "384 KiB", "l1iCache": "256 KiB",
    "l2Cache": "12 MiB", "l3Cache": "25 MiB"
  },
  "diskUsage": [
    { "filesystem": "/dev/sda1", "sizeHuman": "100G", "usedHuman": "42G", "availHuman": "58G", "usePercent": 42, "mountPoint": "/" }
  ],
  "networkInterfaces": [
    { "name": "eth0", "state": "UP", "macAddress": "aa:bb:cc:dd:ee:ff" }
  ],
  "liveMetrics": { "freeMemMb": 18432, "loadAvg1": 1.2, "loadAvg5": 0.9, "loadAvg15": 0.7 }
}
```

### GET /api/config

Returns the host's NixOS `configuration.nix` as raw content plus parsed workload sections. Free tier, requires any authenticated role (admin/operator/viewer). No tier gate. Config path is configurable via `NIXOS_CONFIG_PATH` env var (default: `/etc/nixos/configuration.nix`). In demo mode, returns mock Nix content with representative MicroVM, OCI container, and Slurm sections. On non-NixOS hosts or when the file is unreadable, returns `available: false` with a sanitized error message — never a 500.

**Response (200):**
```json
{
  "available": true,
  "rawContent": "{ config, pkgs, ... }: { ... }",
  "sections": [
    { "id": "microvm-web-nginx", "label": "web-nginx (MicroVM)", "type": "microvm", "lineStart": 4, "lineEnd": 15, "rawNix": "..." },
    { "id": "oci-redis", "label": "redis (OCI Container)", "type": "oci-container", "lineStart": 17, "lineEnd": 22, "rawNix": "..." },
    { "id": "slurm-slurm", "label": "Slurm Node Config", "type": "slurm", "lineStart": 24, "lineEnd": 26, "rawNix": "..." },
    { "id": "infrastructure", "label": "Infrastructure", "type": "infrastructure", "lineStart": 28, "lineEnd": 35, "rawNix": "..." }
  ],
  "configPath": "/etc/nixos/configuration.nix",
  "readAt": "2026-03-20T00:00:00.000Z"
}
```

Section `type` values: `microvm | oci-container | slurm | infrastructure`. When `available: false`, `rawContent` is `null`, `sections` is `[]`, and `error` contains a sanitized message.

### GET /api/health

Health check endpoint. Returns `200 OK` when the server is running. Includes a `host` field with basic host information (hostname, IP address, arch, CPU model/count, RAM, kernel version, uptime, KVM availability) when the host info service is available.

### GET /api/system/doctor

System diagnostics endpoint. Admin only, rate-limited to 5 requests per minute. Runs 14 hardware and Weaver-specific checks: architecture, CPU virtualization (VT-x/AMD-V), KVM module, `/dev/kvm` access, IOMMU, RAM, disk space, NixOS version, bridge kernel module, QEMU availability, IP forwarding, data directory, bridge interface, and license status.

**Response (200):**
```json
{
  "timestamp": "2026-04-03T14:00:00.000Z",
  "durationMs": 42,
  "summary": { "total": 14, "passed": 12, "warned": 2, "failed": 0, "result": "warn" },
  "checks": [
    { "check": "Architecture", "status": "pass", "detail": "x86_64", "remediation": null },
    { "check": "IOMMU", "status": "warn", "detail": "Not detected", "remediation": "Enable VT-d in BIOS" }
  ]
}
```

Returns mock data in demo mode. See [COMPATIBILITY.md](COMPATIBILITY.md) for the full hardware compatibility matrix and BIOS configuration reference.

### GET /api/audit

Query the audit log. Requires admin or operator role. Returns paginated audit entries in newest-first order.

**Query Parameters:**

| Parameter | Type | Description |
| --- | --- | --- |
| `userId` | string | Filter by user ID |
| `action` | string | Filter by action (e.g. `vm.start`, `user.login`) |
| `resource` | string | Filter by resource (e.g. VM name) |
| `since` | ISO 8601 | Only entries after this timestamp |
| `until` | ISO 8601 | Only entries before this timestamp |
| `success` | `true`/`false` | Filter by success/failure |
| `limit` | number | Max entries per page (default 100, max 1000) |
| `offset` | number | Skip N entries for pagination |

**Response (200):**
```json
{
  "entries": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2026-02-12T12:00:00.000Z",
      "userId": "user-uuid",
      "username": "admin",
      "action": "vm.start",
      "resource": "web-nginx",
      "details": {},
      "ip": "127.0.0.1",
      "success": true
    }
  ],
  "total": 42,
  "limit": 100,
  "offset": 0
}
```

**Action naming convention:** `{resource}.{verb}` -- e.g. `vm.start`, `vm.stop`, `vm.restart`, `user.login`, `user.register`, `user.password-change`, `agent.run`.

**Errors:**
- 401: Authentication required
- 403: Insufficient permissions (viewer role)

### Notification Config API

Admin-configurable notification channels. Config mutations require admin role and premium+ tier.

#### GET /api/notifications/config

Returns the full notification channel configuration including all channels, global defaults, and resource alert thresholds.

**Response (200):**
```json
{
  "version": 1,
  "channels": {
    "in-app": { "type": "in-app", "enabled": true, "events": ["vm:started", "vm:stopped", ...] },
    "my-webhook": { "type": "webhook", "enabled": true, "events": ["vm:failed"], "url": "https://...", "method": "POST", "format": "json" }
  },
  "globalDefaults": { "enabledEvents": ["vm:started", "vm:stopped", ...] },
  "resourceAlerts": { "cpuThresholdPercent": 80, "memoryThresholdPercent": 80, "checkIntervalSeconds": 60 }
}
```

#### PUT /api/notifications/config/channels/:channelId

Create or update a notification channel. The `channelId` must match `^[a-zA-Z][a-zA-Z0-9_-]*$`. The request body uses a discriminated union on the `type` field.

**Channel types:** `in-app`, `ntfy`, `email`, `webhook`, `web-push`

**Webhook format options:** `json` (raw event), `slack` (Slack attachments), `discord` (Discord embeds), `pagerduty` (PagerDuty Events API v2)

**Response (200):** `{ "ok": true, "channelId": "my-webhook" }`

#### DELETE /api/notifications/config/channels/:channelId

Remove a channel. The `in-app` channel cannot be removed.

#### POST /api/notifications/config/channels/:channelId/test

Send a test notification through the specified channel. Rate limited to 5 requests per minute.

**Response (200):** `{ "success": true, "channelId": "my-webhook" }`

#### PUT /api/notifications/config/resource-alerts

Update resource alert thresholds (CPU, memory, check interval).

**Request body:**
```json
{ "cpuThresholdPercent": 85, "memoryThresholdPercent": 90, "checkIntervalSeconds": 120 }
```

### Distribution Catalog API

The distribution catalog provides a 3-layer system for managing VM base images.

#### GET /api/distros

Returns all available distributions merged from three sources: built-in (hardcoded: arch, fedora, ubuntu, debian, alpine), catalog (shipped JSON + optional remote refresh), and custom (user-added, persisted). Each entry includes its source for UI display.

**Response (200):**
```json
[
  { "name": "arch", "label": "Arch Linux", "url": "https://...", "format": "qcow2", "guestOs": "linux", "cloudInit": true, "source": "built-in" },
  { "name": "windows-11", "label": "Windows 11", "url": "https://...", "format": "iso", "guestOs": "windows", "cloudInit": false, "source": "catalog" },
  { "name": "my-custom", "label": "My Image", "url": "https://...", "format": "qcow2", "guestOs": "linux", "cloudInit": true, "source": "custom" }
]
```

#### POST /api/distros

Add a custom distribution. Admin only. Cannot shadow built-in or catalog names.

**Request Body:**
```json
{ "name": "my-image", "label": "My Image", "url": "https://...", "format": "qcow2", "guestOs": "linux", "cloudInit": true }
```

#### DELETE /api/distros/:name

Remove a custom distribution. Admin only. Built-in and catalog entries cannot be removed.

#### POST /api/distros/refresh-catalog

Refresh the catalog from the configured remote URL (if `DISTRO_CATALOG_URL` is set). Admin or operator. Rate limited to 5/min.

#### GET /api/distros/url-status

Returns URL validation results for all distro image URLs. Includes per-distro status (`valid`/`invalid`/`unknown`), HTTP status codes, and `lastRunAt` timestamp. Available to any authenticated user.

#### POST /api/distros/validate-urls

Triggers an immediate HEAD-request check against all distro image URLs (skipping flake-based distros). Concurrency-limited to 3 at a time. Returns validation results. Admin only.

#### PUT /api/distros/:name/url

Updates the image URL for a distro. For built-in or catalog distros, this creates a custom override entry that shadows the default URL. For existing custom distros, it updates the URL directly. Immediately validates the new URL. Admin only.

#### DELETE /api/distros/:name/url-override

Removes a custom URL override for a built-in or catalog distro, restoring the default URL. Only applicable to distros that have overrides (not pure custom distros — use `DELETE /api/distros/:name` for those). Re-validates after reset. Admin only.

#### POST /api/distros/:name/test

Starts an asynchronous smoke test for a distro image. Creates a temporary `smoketest-<name>` VM, provisions it, starts it, and checks it reaches "running" status. The test VM is auto-destroyed after completion. Returns `202 Accepted` immediately. Poll `GET /api/distros/:name/test` for results. Admin only. Rate limited to 5/min.

#### GET /api/distros/:name/test

Returns the current or last test result for a distro: `{ status: 'running' | 'passed' | 'failed' | 'none', error?, durationSeconds? }`. Admin only.

### Console WebSocket Proxy

The `/ws/console/:vmName` endpoint provides a WebSocket-to-TCP bridge for VM serial consoles and VNC connections. The WebSocket connects to the VM's allocated console port on localhost and proxies data bidirectionally.

- **Serial consoles** (server VMs): Text data flows between the WebSocket client and QEMU's serial port socket
- **VNC consoles** (desktop VMs): Binary VNC protocol is proxied for use with noVNC or similar clients

The console port is allocated during provisioning and stored on the VM definition (`consolePort`, `consoleType`).

### Notification Event Types

Events are organized by category. Each channel subscribes to specific events independently.

| Category | Events |
| --- | --- |
| VM | `vm:started`, `vm:stopped`, `vm:failed`, `vm:recovered` |
| Provisioning | `vm:provisioning`, `vm:provisioned`, `vm:provision-failed`, `vm:destroying` |
| Resource | `resource:high-cpu`, `resource:high-memory` |
| Security | `security:auth-failure`, `security:unauthorized-access`, `security:permission-denied` |

### Notification Adapter Pattern

The `NotificationService` dynamically loads adapters from the persisted channel config:

```
NotificationConfigStore (JSON file)
        │
        ▼
NotificationService.reloadAdapters(config)
        │
        ├── NtfyAdapter (ntfy channels)
        ├── EmailAdapter (SMTP via nodemailer)
        ├── WebhookAdapter (json/slack/discord/pagerduty)
        └── WebPushAdapter (VAPID via web-push library)
```

Each adapter implements the `NotificationAdapter` interface with `send(event)`, `test()`, and `name` getter. Per-channel event filtering is handled by the service — adapters only receive events they're subscribed to.

The `seedFromEnv()` method on `NotificationConfigStore` migrates existing `NTFY_URL`/`NTFY_TOPIC` env var config into the new JSON config store on first run.

## WebSocket Protocol

### Connection

```
ws://localhost:3110/ws/status
```

### Message Format

The server broadcasts VM status every 2 seconds:

```json
{
  "type": "vm-status",
  "data": [
    {
      "name": "web-nginx",
      "status": "running",
      "ip": "10.10.0.10",
      "mem": 256,
      "vcpu": 1,
      "hypervisor": "qemu",
      "uptime": "2026-01-15T10:30:00.000Z"
    }
  ],
  "timestamp": "2026-01-15T12:00:00.000Z"
}
```

### Client Implementation

The `useVmStatus` composable manages the WebSocket connection:

- Auto-connects on component mount
- Auto-disconnects on component unmount
- Auto-reconnects after 3 seconds on connection loss
- Exposes reactive `vms`, `connected`, and `lastUpdate` refs

The toolbar Live/Offline chip in `MainLayout.vue` tracks connection state via the `ws.ts` service's `onWsConnect`/`onWsDisconnect` callbacks, reflecting real-time WebSocket health independently of any page-level composable.

Session-kicked events (close code 4402) are handled separately: `MainLayout.vue` subscribes to `onSessionKicked` and shows a Quasar notification before redirecting to login. The TUI handles the same event via `wsClient.onSessionKicked()` in `app.tsx`.

**Security event filtering:** The auth middleware tags each 401 rejection with an `authRejectionReason` (`no-token`, `invalid-token`, `session-revoked`). The `onResponse` hook uses this to filter notifications: session-revoked 401s (from login kick, logout, or role change) are expected lifecycle events and do not emit `security:unauthorized-access`. Only genuinely suspicious rejections (missing/invalid tokens) trigger security notifications. 403s from RBAC emit the separate `security:permission-denied` event (info severity, not error).

### Provisioning Events

When a VM is being provisioned or destroyed, the server broadcasts state changes:

```json
{
  "type": "provision-state-change",
  "name": "my-vm",
  "state": "provisioning",
  "progress": "Downloading base image..."
}
```

States: `provisioning`, `provisioned`, `provision-failed`, `destroying`. The `progress` field provides human-readable step descriptions. On failure, an `error` field contains the error message.

### Agent Messages

AI agent operations broadcast on the same `/ws/status` endpoint:

```json
{ "type": "agent-token", "operationId": "uuid", "token": "chunk of text..." }
{ "type": "agent-complete", "operationId": "uuid", "fullText": "full markdown..." }
{ "type": "agent-error", "operationId": "uuid", "error": "error message" }
```

The `useAgentStream` composable filters these messages and updates the `agent-store`. Existing `useVmStatus` consumers ignore agent messages via `type === 'vm-status'` check.

## State Management (Pinia Stores)

### vm-store

Primary store for VM data.

**State:**
- `vms: VmInfo[]` -- All VM objects
- `selectedVm: string | null` -- Currently selected VM name
- `lastUpdate: string | null` -- ISO timestamp of last data update

**Getters:**
- `vmByName(name)` -- Find VM by name
- `runningCount` -- Count of running VMs
- `totalCount` -- Total VM count
- `vmsByStatus(status)` -- Filter VMs by status

**Actions:**
- `updateVms(vms)` -- Replace VM list and update timestamp
- `selectVm(name)` -- Set selected VM

### agent-store

Tracks AI agent operations.

**State:**
- `operations: Record<string, AgentOperation>` -- All operations by ID
- `activeOperationId: string | null` -- Currently active operation

**Getters:**
- `activeOperation` -- The current active operation or null
- `hasActiveOperation` -- True if an operation is currently running
- `operationsForVm(name)` -- All operations for a given VM

**Actions:**
- `startOperation(id, vmName, action)` -- Create and activate an operation
- `appendToken(id, token)` -- Append streaming text to an operation
- `completeOperation(id, fullText)` -- Mark operation as complete
- `failOperation(id, error)` -- Mark operation as failed
- `clearOperation(id)` -- Remove an operation

### auth-store

Authentication state, persisted to localStorage.

**State:**
- `user: User | null` -- Current authenticated user object
- `token: string | null` -- JWT access token
- `refreshToken: string | null` -- JWT refresh token

**Getters:**
- `isAuthenticated` -- True if a valid token exists
- `isAdmin` -- True if user role is admin
- `isOperator` -- True if user role is admin or operator
- `canManageVms` -- True if user can start/stop/restart VMs (admin or operator)
- `canManageUsers` -- True if user can manage user accounts (admin only)
- `displayName` -- User's display name or username
- `userRole` -- Current user's role string

**Actions:**
- `login(username, password)` -- Authenticate and store tokens
- `register(username, password)` -- Register new user (first = admin)
- `refresh()` -- Refresh access token using refresh token
- `fetchMe()` -- Fetch current user info from `/api/auth/me`
- `changePassword(currentPassword, newPassword)` -- Change user password
- `logout()` -- Revoke session and clear stored tokens
- `clearAuth()` -- Clear local auth state without server call

**Persistence:** localStorage via `pinia-plugin-persistedstate` (key: `'auth'`)

### ui-store

UI preferences and transient state.

### app

Application-level state (tier, connection status).

**Tier-related state:**
- `tier: string` -- Current license tier (`'demo'` | `'free'` | `'premium'` | `'fabrick'`)

**Tier-related getters:**
- `isDemo` -- True if running in demo tier (no license key)
- `isFree` -- True if free tier
- `isPremium` -- True if premium tier
- `isFabrick` -- True if fabrick tier
- `isLicensed` -- True if any paid tier (premium or fabrick)

## Authentication System

### JWT Flow

The authentication system uses JSON Web Tokens (JWT) with the HS256 algorithm:

- **Access token**: 30-minute expiry, sent as `Authorization: Bearer <token>` header
- **Refresh token**: 7-day expiry, used to obtain new access tokens without re-login
- **Password hashing**: bcrypt with cost factor 13 (OWASP 2024+ recommendation)

### Auth Middleware

The `createAuthMiddleware()` function in `backend/src/middleware/auth.ts` validates JWT tokens on all `/api/` and `/ws/` routes. A `PUBLIC_ROUTES` whitelist exempts authentication endpoints that must be accessible without a token:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/refresh`
- `GET /api/auth/setup-required`
- `GET /api/health`

All other routes require a valid JWT in the `Authorization` header.

### Session Store (Adapter Pattern)

Session management uses an adapter pattern via the `SessionStore` interface:

| Implementation | Tier | Description |
| --- | --- | --- |
| `MemorySessionStore` | demo / free | In-memory session storage, lost on restart |
| `SqliteSessionStore` | premium / fabrick | Persistent SQLite-backed sessions |

The store adapter is selected at startup based on the resolved license tier.

### User Storage

User accounts are stored in a JSON file at `data/users.json`. The `user-store.ts` module handles reading, writing, and querying user records. Each user has a username, bcrypt-hashed password, role (`admin` or `user`), and creation timestamp.

### Login Page

`LoginPage.vue` handles both initial login and first-run admin setup:

1. On load, calls `GET /api/auth/setup-required` to detect whether any users exist.
2. If no users exist, presents a "Create Admin Account" form (first registered user becomes admin).
3. Otherwise, presents the standard login form.

### Route Guards

The Vue Router uses an async `router.beforeEach` global guard that:

1. Checks `authStore.isAuthenticated` — unauthenticated requests to protected routes are redirected to `/login`.
2. Calls `appStore.initialize()` (once) — fetches `/health` to populate the tier, provisioning flags, and bridge gateway before the first page renders. This ensures `useTierFeature` has the correct tier when it evaluates.

The `/login` route is excluded from the guard (marked `meta.public`). After successful login, the user is redirected to their originally requested route.

### Token Refresh

An axios response interceptor in `src/services/api.ts` handles automatic token refresh:

1. If any API call returns 401 (Unauthorized), the interceptor attempts a token refresh via `POST /api/auth/refresh`.
2. On success, the original request is retried with the new access token.
3. On failure (refresh token also expired), the user is logged out and redirected to `/login`.

### WebSocket Authentication

WebSocket connections authenticate via a `?token=` query parameter on the connection URL:

```
ws://localhost:3110/ws/status?token=<jwt-access-token>
```

The auth middleware validates the token from the query string for WebSocket upgrade requests. Unauthenticated WebSocket connections are rejected with a 401 status.

### CLI Verification

To verify the API from the command line (useful for debugging and production checks):

```bash
# 1. Check if the service is running (no auth required)
curl -s http://localhost:3100/api/health | jq .

# 2. Check if first-run setup is needed (no auth required)
curl -s http://localhost:3100/api/auth/setup-required | jq .

# 3. Log in and capture the token (note: field is "token", not "accessToken")
TOKEN=$(curl -s http://localhost:3100/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"YOUR_USER","password":"YOUR_PASS"}' | jq -r '.token')

# 4. Use the token for authenticated endpoints
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/workload | jq .
```

Replace `localhost:3100` with `localhost:3110` for the dev backend or `localhost:3120` for the E2E backend.

> **Common mistake:** The login response returns `token` (not `accessToken`). Using `jq -r '.accessToken'` will produce `null` and all subsequent requests will fail with "Invalid or expired token".

### Role-Based Access Control (RBAC)

The dashboard implements RBAC with four roles: `admin`, `operator`, `auditor`, and `viewer`. Permissions are enforced on both the backend (route-level middleware) and frontend (conditional UI rendering).

#### Role Permission Matrix

| Action | Admin | Operator | Auditor | Viewer |
| --- | --- | --- | --- | --- |
| View VMs, network, settings | Yes | Yes | Yes | Yes |
| Start / Stop / Restart VMs | Yes | Yes | No | No |
| Create / Delete VMs | Yes | No | No | No |
| Manage distributions (add/remove custom) | Yes | No | No | No |
| Refresh distro catalog | Yes | Yes | No | No |
| AI agent actions (diagnose, explain, suggest) | Yes | Yes | Yes | Yes |
| View audit log (fabrick) | Yes | Yes | Yes | No |
| Manage user accounts | Yes | No | No | No |
| Network management mutations | Yes | Yes | No | No |

#### Backend Enforcement

The `requireRole()` factory in `backend/src/middleware/rbac.ts` returns a Fastify `preHandler` hook that checks `request.userRole` (set by the JWT auth middleware) against a list of allowed roles. If the role is not permitted, a `403 Insufficient permissions` response is returned.

Usage in route files:

```ts
import { requireRole } from '../middleware/rbac.js'

// Admin-only route
app.delete('/:name', { preHandler: [requireRole('admin')] }, async (req, reply) => { ... })

// Admin or operator route
app.post('/:name/start', { preHandler: [requireRole('admin', 'operator')] }, async (req, reply) => { ... })
```

Routes without a `requireRole` preHandler are accessible to all authenticated users (any role).

#### Frontend Enforcement

The `auth-store` provides permission-checking getters that UI components use with `v-if` directives:

| Getter | True for | Used by |
| --- | --- | --- |
| `canManageVms` | admin, operator | Start/Stop/Restart buttons |
| `canManageUsers` | admin | User management UI |
| `isOperator` | admin, operator | General operator-level checks |

The header displays a color-coded role badge next to the username: purple for admin, teal for operator, blue for auditor, grey for viewer.

**Important:** Frontend checks are for UX only. The backend always re-validates permissions via `requireRole()` middleware, so removing a `v-if` cannot bypass authorization.

### Per-VM Access Control (fabrick)

On fabrick tier, admins can restrict which VMs individual users can access. This is implemented via a per-user ACL (Access Control List) that maps user IDs to allowed VM names.

**Key behavior:**
- No ACL entries = unrestricted access (backwards compatible)
- Admin role always bypasses ACL checks
- Only enforced when `config.tier === 'fabrick'`
- ACL filtering applies to: VM list, VM detail, VM actions (start/stop/restart), agent operations, and WebSocket status broadcasts

**Backend implementation:**
- `backend/src/storage/vm-acl-store.ts` — JSON-backed store (`{dataDir}/vm-acls.json`)
- `backend/src/middleware/vm-acl.ts` — `createVmAclCheck()` factory returns a preHandler that checks `aclStore.isAllowed(userId, vmName)`
- `backend/src/routes/vm-acl.ts` — Admin CRUD routes: `GET/PUT/DELETE /api/users/:id/vms`

**Frontend:** The Users page shows a shield icon per non-admin user (fabrick only). Clicking it opens a dialog to assign/clear VM access.

### Demo Mode — Tier Switcher

When running with `VITE_DEMO_MODE=1` (the demo site), a floating toolbar appears at the bottom of the page allowing instant tier switching between Free, Premium, and Fabrick. This uses the `effectiveTier` getter in the app store, which checks for a demo override before falling back to the real server tier. All existing tier gates (`isPremium`, `isFabrick`, etc.) read from `effectiveTier`, so the entire UI updates instantly.

Implementation: `src/stores/app.ts` (effectiveTier getter, setDemoTier action), `src/components/demo/DemoTierSwitcher.vue`.

### Rate Limiting

The backend uses `@fastify/rate-limit` for two purposes: general API abuse protection and AI cost protection. Rate limits apply per-IP for unauthenticated requests and per-user (by `request.userId`) for authenticated requests.

General endpoints (auth, VM mutations) use fixed limits to prevent abuse. AI agent endpoints use tier-based limits because each request consumes real resources regardless of deployment model: API tokens for cloud providers (Anthropic, OpenAI), GPU compute cycles for self-hosted model servers (vLLM, TGI), or host CPU/GPU/RAM for local models (Ollama). The AI rate limit is an infrastructure protection feature, not just an anti-abuse measure (Decision #128).

#### Rate Limit Tiers

| Endpoint Category | Limit | Window |
| --- | --- | --- |
| Auth endpoints (login, register, refresh) | 10 requests | 1 minute |
| VM mutation (start, stop, restart, create, delete) | 30 requests | 1 minute |
| VM scan (POST `/api/workload/scan`) | 5 requests | 1 minute |
| Distro catalog refresh | 5 requests | 1 minute |
| AI agent (POST `/api/workload/:name/agent`) | 5/10/30 per tier* | 1 minute |
| General API (all other endpoints) | 120 requests | 1 minute |

#### Response Headers

Every API response includes rate limit headers:

| Header | Description |
| --- | --- |
| `X-RateLimit-Limit` | Maximum requests allowed in the current window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |
| `Retry-After` | Seconds until the client can retry (only on 429) |

#### 429 Response Format

When a rate limit is exceeded, the server responds with:

```json
{
  "statusCode": 429,
  "error": "Too many requests. Please try again later."
}
```

#### Configuration

Rate limiting is registered as a Fastify plugin in `backend/src/index.ts` before route registration. Per-route overrides are applied via the `config.rateLimit` option on individual route definitions in `backend/src/routes/auth.ts`, `backend/src/routes/vms.ts`, and `backend/src/routes/agent.ts`.

The key generator function uses `request.userId` (set by the auth middleware) for authenticated requests, falling back to `request.ip` for unauthenticated requests:

```ts
keyGenerator: (request) => request.userId ?? request.ip
```

#### Test Environment

When `NODE_ENV=test`, the global rate limit is set to 1,000,000 requests per minute to avoid interfering with existing test suites. Dedicated rate-limit tests in `backend/tests/middleware/rate-limit.spec.ts` use independent Fastify instances with low limits to verify behavior.

## License Tier System

### Tier Model

Weaver supports four license tiers:

| Tier | Key Required | Features |
| --- | --- | --- |
| `demo` | No (no key) | Mock data, in-memory sessions, evaluation only |
| `free` | `WVR-FRE-...` | Real VM control, basic features |
| `premium` | `WVR-WVS-...` / `WVR-WVT-...` | SQLite sessions, advanced agent features |
| `fabrick` | `WVR-ENT-...` | Full feature set, priority support |

### Configuration Resolution

The license tier is resolved at startup in this order:

1. `LICENSE_KEY` environment variable (direct key string)
2. `LICENSE_KEY_FILE` environment variable (path to file containing key)
3. `PREMIUM_ENABLED=true` environment variable (backward compatibility, maps to premium tier)
4. No key present: defaults to `demo` tier

### Key Format

License keys follow the format `WVR-<tier>-<payload>-<checksum>`:

- `WVR` -- Fixed prefix
- `<tier>` -- `FRE`, `WVS` (Solo), `WVT` (Team), or `FAB` (Fabrick)
- `<payload>` -- Encoded license data (expiry, org, features)
- `<checksum>` -- HMAC-SHA256 signature verified with `LICENSE_HMAC_SECRET`

Keys are generated using the `scripts/generate-license.ts` utility.

### Tier Guard

The `requireTier(config, 'premium')` guard function can be used in route handlers to restrict access based on the current license tier. Returns a 403 if the active tier is below the required level.

### Tier Enforcement Architecture

Tier restrictions follow a **backend-authoritative** pattern:

1. **Backend (authoritative):** Every tier-gated endpoint calls `requireTier()` in the route handler or a preHandler hook. This is the security boundary — it returns 403 regardless of which client makes the request (web UI, TUI, curl, scripts).

2. **Web frontend (cosmetic):** The `app` store exposes `isPremium()`, `isFabrick()`, etc. Components hide UI elements and show upgrade nags for features the user's tier cannot access. This is a UX convenience, not a security gate — the backend blocks the API call even if the frontend check were bypassed.

3. **TUI (relies on backend):** The TUI makes direct API calls with no local tier validation. If a free-tier user invokes a premium action, the backend returns 403 and the TUI displays a `TierGateMessage`. In demo mode, the TUI simulates enforcement locally via `TIER_BLOCKED` blocklist in `tui/src/demo/mock.ts`.

**Key rule for contributors:** When adding a new tier-gated feature, always add `requireTier()` to the backend route handler first. Frontend/TUI visibility checks are optional UX polish — they must never be the only gate.

### Health Endpoint Tier Info

The `GET /api/health` endpoint includes tier information in its response:

```json
{
  "status": "ok",
  "tier": "premium",
  "tierExpiry": "2027-01-15T00:00:00.000Z",
  "tierGraceMode": false
}
```

### Frontend Tier Access

The `app` Pinia store exposes tier state and computed getters (`tier`, `isDemo`, `isFree`, `isPremium`, `isFabrick`, `isLicensed`, `serverKeyAllowed`) so components can conditionally render features based on the active tier.

### Tier-Gated Features

| Feature | Required Tier | Enforcement |
|---------|--------------|-------------|
| AI infrastructure protection | All (gradient) | demo/free=5, solo=10, team=10+per-user configurable, fabrick=30+fleet-wide per-user configurable — protects API spend, GPU compute, or host resources depending on AI deployment model (Decision #128) |
| Server AI key usage | Premium+ | Free/demo must BYOK; 403 if no key provided |
| Bulk VM operations | Fabrick | BulkActionBar + VM checkboxes hidden below fabrick |
| Audit log UI | Fabrick | `/audit` page + nav item visible only for fabrick admin |
| Resource quotas | Fabrick | Per-user VM/memory/vCPU limits enforced at creation |
| User management | All (admin) | `/users` page visible to admins in all tiers |

### Resource Quotas (Fabrick)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users/:id/quotas` | Admin | Get user quota limits + current usage |
| PUT | `/api/users/:id/quotas` | Admin | Set user quota limits |

**Quota Model:**
- `maxVms` (number | null) -- Max VM count (null = unlimited)
- `maxMemoryMB` (number | null) -- Max total memory in MB (null = unlimited)
- `maxVcpus` (number | null) -- Max total vCPU count (null = unlimited)

Quotas are enforced at VM creation time. When exceeded, the API returns 403 with a message specifying which quota was exceeded. Only enforced on fabrick tier. Storage: `data/quotas.json`.

### Grace Period

When a license key expires, the system enters a 30-day grace period:

- `tierGraceMode` becomes `true` in the health response
- The dashboard operates in read-only mode (VM status visible, actions disabled)
- After the 30-day grace period, the system falls back to demo tier

## Component Hierarchy

```
App.vue
└── MainLayout.vue
    ├── NotificationBell.vue (toolbar: bell icon + q-menu dropdown)
    │   └── NotificationPanel.vue (list with checkboxes, bulk actions, dismiss)
    │
    ├── WorkbenchPage.vue
    │   ├── VmCard.vue (repeated for each VM)
    │   │   └── StatusBadge.vue
    │   └── CreateVmDialog.vue (modal, distro selector)
    │
    ├── VmDetailPage.vue
    │   ├── StatusBadge.vue
    │   └── AgentDialog.vue
    │
    ├── UsersPage.vue (admin: user table, role changes, delete)
    │   └── QuotaSection.vue (fabrick: per-user resource limits)
    │
    ├── AuditPage.vue (fabrick admin: filterable audit log table)
    │
    ├── SettingsPage.vue
    │   ├── NotificationSettings.vue
    │   ├── TagManagement.vue (admin: bulk tag rename/delete)
    │   └── (Distro management section)
    │
    └── ErrorNotFound.vue
```

### Key Components

**VmCard.vue** -- Displays a single VM as a card with:
- VM name and IP address
- StatusBadge showing running/stopped/failed state
- Memory and vCPU information
- Start/Stop/Restart action buttons
- Stethoscope button: navigates to detail page, auto-opens Diagnose if VM has issues

**StatusBadge.vue** -- Color-coded status indicator:
- Green for `running`
- Red for `stopped`
- Orange for `failed`
- Gray for `unknown`

**AgentDialog.vue** -- Fullscreen dialog for AI agent streaming output:
- Real-time markdown rendering as tokens arrive
- Blinking cursor animation during streaming
- Severity badge (info/warning/critical) extracted from response
- Copy-to-clipboard button for full output
- Auto-scrolls during streaming

## TypeScript Types

Core types defined in `src/types/vm.ts`:

```typescript
interface VmInfo {
  name: string
  status: 'running' | 'stopped' | 'failed' | 'unknown'
  ip: string
  mem: number        // MB
  vcpu: number
  hypervisor: string // e.g., 'qemu'
  uptime: string | null  // ISO timestamp or null if not running
  distro?: string
  guestOs?: 'linux' | 'windows'
  vmType?: 'server' | 'desktop'
  provisioningState?: ProvisioningState
  provisioningError?: string
  consoleType?: 'serial' | 'vnc'
  consolePort?: number
  macAddress?: string
  tapInterface?: string
}

type ProvisioningState = 'registered' | 'provisioning' | 'provisioned' | 'provision-failed' | 'destroying'

interface VmActionResult {
  success: boolean
  message: string
}

type VmAction = 'start' | 'stop' | 'restart'
```

Agent types defined in `src/types/agent.ts`:

```typescript
type AgentAction = 'diagnose' | 'explain' | 'suggest'
type LlmVendor = 'anthropic'

interface AgentOperationStarted {
  operationId: string
  vmName: string
  action: AgentAction
  status: 'started'
}

interface AgentOperation {
  operationId: string
  vmName: string
  action: AgentAction
  status: 'running' | 'complete' | 'error'
  tokens: string
  error?: string
  startedAt: string
  completedAt?: string
}

// WebSocket message union
type AgentWsMessage =
  | { type: 'agent-token'; operationId: string; token: string }
  | { type: 'agent-complete'; operationId: string; fullText: string }
  | { type: 'agent-error'; operationId: string; error: string }
```

## NixOS Integration

The `nixos/default.nix` file provides:

1. **Package definition** (`buildNpmPackage`) -- Builds the frontend SPA and backend into a single Nix package with a launcher script.

2. **NixOS module** -- Declares `services.weaver` with options:
   - `enable` -- Enable/disable the service
   - `port` -- API server port (default: 3100)
   - `host` -- Bind address (default: 127.0.0.1)
   - `openFirewall` -- Open firewall port
   - `package` -- Override the package
   - `premiumEnabled` -- Enable premium features (deprecated, use `licenseKey`)
   - `jwtSecret` / `jwtSecretFile` -- JWT signing secret (required in production)
   - `initialAdminPassword` / `initialAdminPasswordFile` -- First-run admin account
   - `licenseKey` / `licenseKeyFile` -- License key for tier resolution
   - `serviceUser` / `serviceGroup` -- Override service identity (default: dedicated system user)
   - `provisioningEnabled` -- Enable VM provisioning (cloud-init, ISO, QEMU lifecycle)
   - `microvmsDir` -- Directory for provisioned VM files (default: `/var/lib/microvms`)
   - `bridgeInterface` -- Bridge interface for VM networking (default: `br-microvm`)
   - `bridgeGateway` -- Gateway IP for bridge network (default: `10.10.0.1`)
   - `distroCatalogUrl` -- Remote URL for distro catalog refresh
3. **System integration:**
   - Dedicated `weaver` user and group (when using defaults)
   - Restricted sudo rules for `microvm@*` service management
   - Systemd service unit with restart-on-failure
   - Data directory at `/var/lib/weaver`

4. **Provisioning integration** (when `provisioningEnabled = true`):
   - Service user added to `kvm` group (QEMU hardware acceleration)
   - `/var/lib/microvms` directory created for VM files
   - Sudo rules for TAP interface management (`ip tuntap`, `ip link`)
   - QEMU and cdrkit (cloud-init ISO) added to service PATH
   - Bridge networking, NAT (iptables MASQUERADE), IP forwarding enabled
   - Environment variables: `PROVISIONING_ENABLED`, `MICROVMS_DIR`, `QEMU_BIN`, `QEMU_IMG_BIN`
   - **Example VM**: After first admin account creation, the backend auto-provisions a CirOS test VM (`example-cirros`, ~20 MB, 128 MB RAM, 1 vCPU) at IP `10.10.0.100`. This is a real provisioned VM — deletable through the normal UI. Implemented in `backend/src/services/example-vm.ts`.

### Local Production Deploy (NixOS)

Test the full NixOS production build locally by consuming the repo's flake as an input in your system config. This builds the package via `buildNpmPackage` in the Nix sandbox (identical to what end users run).

**Step 1: Add the flake input** (`/etc/nixos/flake.nix`):

```nix
{
  inputs = {
    # ... other inputs ...

    # Weaver (local dev path)
    weaver.url = "path:/path/to/Weaver-Dev";
    weaver.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, weaver, ... }@inputs: {
    nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
      modules = [ ./configuration.nix ];
      specialArgs = { inherit inputs; };
    };
  };
}
```

> **Important:** Do NOT import `nixos/default.nix` via an absolute path (e.g., `/home/user/.../nixos/default.nix`). Pure flake evaluation forbids raw absolute paths. Use the `path:` flake input as shown above. See LESSONS-LEARNED.md for details.

**Step 2: System module** (`/etc/nixos/modules/services/weaver.nix`):

```nix
{ config, pkgs, lib, inputs, ... }:
{
  imports = [
    inputs.weaver.nixosModules.default
  ];

  config = {
    services.weaver = {
      enable = true;
      port = 3100;
      host = "0.0.0.0";
      openFirewall = true;

      premiumEnabled = true;

      jwtSecretFile = "/var/lib/weaver/.jwt-secret";
      initialAdminPasswordFile = "/var/lib/weaver/.admin-password";
    };
  };
}
```

**Fresh install steps:**

```bash
# 1. Stop existing service and VMs
sudo systemctl stop weaver
sudo systemctl stop 'microvm@*'

# 2. Clean old data
sudo rm -rf /var/lib/weaver/*

# 3. Create auth secrets (owned by the service user)
sudo mkdir -p /var/lib/weaver
openssl rand -base64 32 | sudo tee /var/lib/weaver/.jwt-secret > /dev/null
echo 'Admin123' | sudo tee /var/lib/weaver/.admin-password > /dev/null
sudo chmod 600 /var/lib/weaver/.jwt-secret /var/lib/weaver/.admin-password
sudo chown -R weaver:weaver /var/lib/weaver

# 4. Update flake lock and rebuild (uses automated script)
sudo ./scripts/nix-rebuild-local.sh

# 5. Verify
systemctl status weaver
curl http://localhost:3100/api/health

# 6. Log in as admin/Admin123, change password, then clean up
sudo rm /var/lib/weaver/.admin-password
```

> **Browser cache between tests:** The dashboard stores auth tokens, wizard-dismissed state, sort preferences, and other settings in `localStorage`. Between fresh install cycles, **clear your browser data** (localStorage + cookies) for `localhost:3100` — or use a private/incognito window each time. Stale tokens or dismissed-wizard flags from a previous run will cause confusing behaviour (e.g., skipping the Getting Started wizard, auth failures, or old preferences carrying over). The automated script (`nix-fresh-install.sh`) wipes server-side data but cannot clear your browser.

**Configuring which VMs appear on the dashboard:**

In production, the dashboard auto-discovers VMs on first startup by scanning for `microvm@*.service` systemd units. Admins can also trigger a scan from the UI ("Scan for VMs" button) or via `POST /api/workload/scan`. In dev/test mode, `DEFAULT_VMS` from `backend/src/storage/seed-data.ts` are seeded instead.

- **Auto-scan** (production) — On first run with an empty registry, the backend runs `systemctl list-units microvm@*.service` and adds discovered VMs to the registry.
- **Manual scan** — Admins can trigger a scan at any time from the dashboard empty state or via the API.
- **Manual edit** — Edit `/var/lib/weaver/vms.json` directly. The registry is a JSON object keyed by VM name. Restart the service after editing.

```json
// /var/lib/weaver/vms.json
{
  "my-vm": { "name": "my-vm", "ip": "10.10.0.50", "mem": 512, "vcpu": 1, "hypervisor": "qemu" }
}
```

The dashboard calls `systemctl status microvm@<name>.service` to determine VM state, so entries must match real systemd units for start/stop/restart to work.

**After changing npm dependencies**, update the hashes in `nixos/package.nix` and refresh the flake lock:

```bash
# Option A: Use the automated script (computes hashes, stages, rebuilds,
#           auto-commits & pushes flake.lock in the NixOS repo)
sudo ./scripts/nix-rebuild-local.sh

# Option B: Manual steps
# 1. Update hashes in nixos/package.nix (use prefetch-npm-deps or copy from build error)
# 2. Stage changes (Nix path: inputs only see staged/committed content)
git add -A
# 3. Update the NixOS flake lock to pick up the new source
sudo nix flake update weaver --flake /etc/nixos
# 4. Rebuild
sudo nixos-rebuild switch --flake /etc/nixos#$(hostname)
```

**Switching between production and dev mode:**

```bash
# Stop production, run from source
sudo systemctl stop weaver
npm run dev:full

# Resume production
sudo systemctl start weaver
```

> **Note:** `nixos-rebuild switch` triggers a full `buildNpmPackage` build (several minutes). For rapid code iteration, use dev mode instead.

## Backend Service Layer

The `backend/src/services/microvm.ts` module interfaces with NixOS:

- **`listVms()`** -- Iterates VM_DEFINITIONS, checks each VM's systemctl status
- **`getVm(name)`** -- Returns single VM info with live status
- **`startVm(name)`** -- Calls `sudo systemctl start microvm@<name>.service`
- **`stopVm(name)`** -- Calls `sudo systemctl stop microvm@<name>.service`
- **`restartVm(name)`** -- Calls `sudo systemctl restart microvm@<name>.service`
- **`getVmStatus(name)`** -- Queries `systemctl is-active` for service status
- **`getVmUptime(name)`** -- Queries `systemctl show --property=ActiveEnterTimestamp`
- **`addVm(def)`** -- Adds a VM entry to the registry (checks for duplicates)
- **`removeVm(name)`** -- Stops the VM service (best-effort) and removes from registry
- **`createVm(def, provisioner?)`** -- Registers a VM and optionally triggers provisioning
- **`deleteVm(name, provisioner?)`** -- Destroys a provisioned VM or stops+unregisters
- **`isCloudDef(vm)`** -- Checks if a VM definition uses cloud-init provisioning

All systemctl calls use `execFile` (not `exec`) to prevent shell injection.

### Provisioner Service

The `backend/src/services/weaver/provisioner.ts` module handles VM lifecycle management for cloud-init and ISO-based VMs:

- **`provision(vmName)`** -- Downloads base image, creates overlay disk, generates cloud-init ISO, allocates TAP interface and MAC address, writes QEMU systemd unit
- **`destroy(vmName)`** -- Tears down TAP interface, removes VM files (disk, cloud-init, unit), removes from registry
- **`getLog(vmName)`** -- Returns provisioning log content
- **`getConsolePort(vmName)`** -- Returns the allocated console port for a running VM (null if stopped)

Provisioning is asynchronous — `provision()` emits `provision-state-change` events via the `provisioningEvents` EventEmitter, which the WebSocket relay broadcasts to connected clients.

**Provisioning paths:**

| Path | Distro Examples | Flow |
| --- | --- | --- |
| Cloud-init | arch, ubuntu, fedora, debian, alpine | Download qcow2 → overlay → cloud-init ISO → QEMU |
| ISO install | windows-11, nixos-iso | Blank disk → attach ISO as CDROM → QEMU |

### Image Manager

The `backend/src/services/image-manager.ts` module handles disk and image operations:

- **`ensureImage(distro)`** -- Downloads base image if not cached, returns path
- **`createOverlay(vmName, basePath)`** -- Creates qcow2 overlay disk backed by base image
- **`createBlankDisk(vmName, sizeGb)`** -- Creates empty qcow2 disk for ISO installs
- **`generateCloudInit(vmName, hostname, userData)`** -- Builds cloud-init ISO (meta-data + user-data)
- **`generateSystemdUnit(vmName, qemuArgs)`** -- Returns systemd unit file content for QEMU
- **`isCloudDistro(distro)`** / **`isIsoDistro(distro)`** -- Routing helpers based on distro format
- **`allocateConsolePort(vmName)`** -- Deterministic port allocation based on VM name hash

### Distribution Catalog

Three-layer system for VM base images:

1. **Built-in** — Hardcoded in `ImageManager.builtinDistros()`: arch, fedora, ubuntu, debian, alpine
2. **Catalog** — Shipped in `backend/data/distro-catalog.json`, refreshable from remote URL
3. **Custom** — User-added via API, persisted in `data/distros.json`

Custom entries can shadow catalog entries (same name, different URL). Built-in entries cannot be shadowed. The merge order is: built-in → catalog → custom (last wins for duplicates).

## AI Agent Service Layer

The `backend/src/services/agent.ts` module orchestrates AI diagnostics:

- **`gatherVmContext(vmName)`** -- Runs `systemctl status` + `journalctl -n 50` via `execFileAsync`
- **`buildPrompt(action, context)`** -- Constructs action-specific prompts with gathered VM data
- **`runAgent(opts)`** -- Orchestrates the full flow: resolve provider → gather context → stream LLM → broadcast tokens

### LLM Provider Architecture

The `backend/src/services/llm-provider.ts` module defines a vendor-agnostic interface:

```typescript
interface LlmProvider {
  readonly name: string
  stream(opts: LlmStreamOptions): AsyncIterable<string>
}
```

**Current providers:**
- `AnthropicProvider` -- Uses `@anthropic-ai/sdk` streaming API

**Provider resolution order** (in `resolveProvider()`):
1. BYOK + BYOV: User-provided key + vendor → create provider for that vendor
2. BYOK only: User-provided key → defaults to Anthropic provider
3. Server key: `ANTHROPIC_API_KEY` env var → server-side Anthropic provider
4. No key: Returns null → falls back to mock agent

### Mock Agent

When no LLM provider is available, `mock-agent.ts` streams canned markdown responses:
- Per-VM diagnoses (e.g., `svc-postgres` shows a critical crash loop scenario)
- Generic explain and suggest responses
- Simulates streaming by chunking text with randomized delays

### Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Server-side API key (absent = mock mode) | _(none)_ |
| `AGENT_MODEL` | Claude model for agent operations | `claude-sonnet-4-5-20250929` |
| `JWT_SECRET` | HMAC key for JWT signing | Auto-generated (warning) |
| `JWT_SECRET_FILE` | Path to JWT secret file (NixOS sops-nix) | _(none)_ |
| `LICENSE_KEY` | License key string | _(none, demo mode)_ |
| `LICENSE_KEY_FILE` | Path to license key file | _(none)_ |
| `LICENSE_HMAC_SECRET` | HMAC key for license validation | Auto-generated (dev) |
| `PREMIUM_ENABLED` | Deprecated: maps to premium tier | `false` |
| `PROVISIONING_ENABLED` | Enable VM provisioning (cloud-init, ISO) | `true` |
| `MICROVMS_DIR` | Directory for VM disk images and cloud-init ISOs | `/var/lib/microvms` |
| `QEMU_BIN` | Path to qemu-system-x86_64 binary | `/run/current-system/sw/bin/qemu-system-x86_64` |
| `QEMU_IMG_BIN` | Path to qemu-img binary | `/run/current-system/sw/bin/qemu-img` |
| `DISTRO_CATALOG_URL` | Remote URL for distro catalog refresh | _(none)_ |
| `INITIAL_ADMIN_PASSWORD` | First-run admin password (NixOS) | _(none)_ |
| `INITIAL_ADMIN_PASSWORD_FILE` | Path to initial admin password file | _(none)_ |
| `NTFY_URL` | ntfy server URL (legacy, migrated to config store) | _(none)_ |
| `NTFY_TOPIC` | ntfy topic (legacy, migrated to config store) | _(none)_ |
| `NTFY_TOKEN` | ntfy access token (legacy, migrated to config store) | _(none)_ |

## Demo Mode

When running in demo mode, the frontend uses `src/services/mock-vm.ts` instead of making real API calls. The mock service:

- Maintains in-memory VM state
- Simulates realistic delays (200-1500ms)
- Supports all actions (start, stop, restart)
- Can be reset to initial state with `resetMockVms()`
- Ships with the same five VM definitions as the real backend

## Terminal User Interface (TUI)

The TUI is a separate sub-package (`tui/`) that provides a terminal-native client for managing MicroVMs over SSH. It consumes the same REST API and WebSocket backend as the web frontend.

### Stack

- **Ink 5.x** (React for CLI) — component framework
- **Native `fetch`** — HTTP client (Node 18+)
- **Node `ws`** — WebSocket client (port of `src/services/ws.ts`)
- **`conf`** — XDG-compliant credential storage (`~/.config/weaver/`)

### Development

```bash
npm run dev:tui                              # Watch mode (tsx)
npm run build:tui                            # Compile to tui/dist/
npm run start:tui -- --demo                  # Run compiled TUI with mock data
npm run start:tui -- --host http://host:3110 # Connect to live backend
```

**Manual testing** (build + run in one step):

```bash
npm run build:tui && npm run start:tui -- --demo --tier fabrick
npm run build:tui && npm run start:tui -- --demo --tier free
npm run build:tui && npm run start:tui -- --export --demo
npm run build:tui && npm run start:tui -- --export --demo --output vms.json
```

> **Note:** `start:tui` runs the compiled `tui/dist/` — always `build:tui` first after code changes.

### CLI Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--host <url>` | Backend URL | `http://localhost:3100` |
| `--demo` | Demo mode (no backend needed) | `false` |
| `--tier <name>` | Demo tier (`demo\|free\|premium\|fabrick`) | `premium` |
| `--username <u>` | Skip login prompt | — |
| `--password <p>` | Skip login prompt | — |
| `--export` | Export all VM configs as JSON and exit | — |
| `--output <file>` | Write export to file instead of stdout | — |
| `-h, --help` | Show help | — |

### Views

The TUI has 16 views organized by tier:

| View | Tier | Key | Description |
|------|------|-----|-------------|
| `login` | — | (startup) | Username/password login |
| `register` | — | (first-run) | Admin account creation |
| `list` | free | (default) | VM table with search, filter |
| `detail` | free | `d`/Enter | VM detail with start/stop/restart/delete |
| `agent` | free | `a` | AI agent dialog |
| `create` | free | `n` | Create new VM form |
| `help` | free | `?` | Keybindings + tier matrix |
| `network` | premium | `N` | ASCII network topology |
| `host-detail` | premium | `H` | CPU, disk, memory metrics |
| `distros` | free | `D` | Distro catalog with number-key selection |
| `templates` | premium | `T` | VM templates with number-key selection |
| `notifications` | premium | `I` | Notification list |
| `settings` | premium | `,` | Connection info, AI config |
| `users` | fabrick | `u` | User management table |
| `user-detail` | fabrick | Enter (in users) | Quotas, ACL, role |
| `audit` | fabrick | `A` | Audit log with filters |

### Keybindings

| Key | Action | Context |
|-----|--------|---------|
| j/k, arrows | Navigate | list, users, audit |
| d, Enter | Open detail | list |
| s | Start stopped VM | list, detail |
| S | Stop running VM | list, detail |
| r | Restart running VM | list, detail |
| n | Create new VM | list |
| x | Delete VM (with confirm) | detail |
| f | Scan for VMs | list |
| / | Search VMs by name | list |
| t | Cycle status filter | list |
| a | AI agent dialog | list, detail |
| ? | Help view | list |
| N | Network topology | list (premium+) |
| D | Distro catalog | list (free+) |
| T | VM templates | list (premium+) |
| H | Host info | list (premium+) |
| I | Notifications | list (premium+) |
| , | Settings | list (premium+) |
| u | User management | list (fabrick) |
| A | Audit log | list (fabrick) |
| L | Logout | list |
| b, Esc | Go back | everywhere |
| q | Quit | list |

### Architecture

The TUI is a **first-class client** alongside the web frontend, targeting CLI-preferring NixOS admins. It does not implement any business logic — the backend enforces all tier gating, auth, and validation.

```
┌──────────────────────────────────────────────────────────────────┐
│ Weaver  [connected]  [tier: premium]  VMs: 8         │
├──────────────────────────────────────────────────────────────────┤
│ > web-nginx   running  10.10.0.10  256MB  1v  1h 30m  nixos     │
│   web-app     stopped  10.10.0.11  512MB  2v  -       nixos     │
│   dev-python  failed   10.10.0.20  1GB    2v  -       alma-9    │
├──────────────────────────────────────────────────────────────────┤
│ [s]tart [S]top [r]estart [d]etail [a]gent [n]ew [/]search       │
│ [t]filter [f]scan [?]help [N]etwork [H]ost [I]nfo [,]settings   │
└──────────────────────────────────────────────────────────────────┘
```

### Type Sharing

Types are **copied** from `src/types/` into `tui/src/types/` (not symlinked). This avoids Nix sandbox issues and cross-workspace ESM resolution problems. When modifying shared types (`VmInfo`, `AgentAction`, etc.), update both locations.

### Tier Gating (TIER_BLOCKED)

The TUI uses a **blocklist model** for tier gating in demo mode (`tui/src/demo/mock.ts`):

```typescript
const TIER_BLOCKED: Record<string, Set<string>> = {
  demo:       new Set(),          // all features visible with mock data
  free:       new Set(['network-mgmt', 'distros-mgmt', 'host-detail', ...]),
  premium:    new Set(['users', 'audit', 'quotas', 'acl', 'bulk-ops']),
  fabrick: new Set(),          // everything unlocked
}
```

Each mock API method checks `isTierBlocked(tier, feature)` and returns 403 if blocked. Views display a `TierGateMessage` component when they receive 403.

### Demo Mode

`--demo` runs entirely in-memory with mock API and WebSocket clients. The mock WS cycles VM status every 5 seconds and simulates agent streaming. Use `--tier` to test tier gating (the mock API returns 403 for premium features when running in `free` tier).

All tier levels are testable: `--demo --tier free` (blocks premium+), `--demo --tier premium` (blocks fabrick), `--demo --tier fabrick` (everything), `--demo --tier demo` (everything, mock showcase).

### NixOS Packaging

The Nix build (`nixos/package.nix`) compiles the TUI alongside the backend and frontend. The resulting package provides a `microvm-tui` binary in `$out/bin/`.

## Route Structure

```
/login                 --> LoginPage.vue (public, no auth)
/                      --> Redirects to /dashboard
/dashboard             --> WorkbenchPage.vue (requires auth)
/vm/:name              --> VmDetailPage.vue (requires auth)
/network               --> NetworkMapPage.vue (requires auth)
/settings              --> SettingsPage.vue (requires auth)
/help                  --> HelpPage.vue (requires auth)
/*                     --> ErrorNotFound.vue (404)
```

## Test VM (NixOS Installation Testing)

A QEMU test VM validates the full NixOS installation experience without affecting your host machine.

**Location:** `test-vm/` (in the project root, outside the repo)

### Prerequisites

Build the dashboard first:

```bash
npm run build:spa
npm run build:backend
```

### Run the test VM

```bash
cd test-vm
nixos-rebuild build-vm --flake .#test
./result/bin/run-test-vm
```

### Access from host

| Service   | URL                            |
|-----------|--------------------------------|
| Dashboard | http://localhost:18080          |
| API       | http://localhost:13110/api/workload  |
| Health    | http://localhost:13110/api/health |

### What the test VM includes

- Dashboard service with pre-built package from local repo
- Nginx serving the SPA with API/WS proxy
- 5 mock `microvm@` services that can be started/stopped from the dashboard
- Auto-login as root, `curl` and `jq` pre-installed
- Port forwarding (guest 3110 → host 13110, guest 80 → host 18080)

### Inside the VM

```bash
systemctl status weaver          # Check dashboard service
systemctl start microvm@web-nginx           # Start a mock VM
curl http://localhost:3110/api/workload | jq .   # Query the API
```

## Headless Piping (Non-Interactive Claude Code)

Claude Code can be used non-interactively for automation, CI/CD, and scripting
via the `-p` (print) flag. This is useful for one-shot analysis, automated
reviews, and integration into shell workflows.

### Basic Usage

```bash
# One-shot prompt
claude -p "Summarize the API endpoints in this project"

# Pipe stdin with a prompt
gh pr diff 42 | claude -p "Review this diff for security issues"

# Pipe a file for analysis
cat backend/src/services/microvm.ts | claude -p "Explain the VM management flow"
```

### Output Formats

| Format | Flag | Use Case |
|--------|------|----------|
| Plain text | *(default)* | Human-readable output |
| JSON | `--output-format json` | Structured data for scripts |
| Streaming JSON | `--output-format stream-json` | Real-time token streaming |

```bash
# JSON output with session metadata
claude -p "List all TODO comments" --output-format json | jq '.result'

# Structured extraction with JSON schema
claude -p "Extract function names from api.ts" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}}}'
```

### Tool Permissions

Use `--allowedTools` to control which tools Claude can use without prompting:

```bash
# Read-only analysis
claude -p "Review this codebase" --allowedTools "Read,Glob,Grep"

# Full edit capabilities
claude -p "Fix the lint errors" --allowedTools "Read,Edit,Bash(npm run lint:*)"

# Fine-grained bash control (trailing space+asterisk for prefix matching)
claude -p "Run tests" --allowedTools "Bash(npm run test *)"
```

### Multi-Step Conversations

```bash
# Continue the most recent session
claude -p "Now focus on the WebSocket code" --continue

# Resume a specific session by ID
session_id=$(claude -p "Start a review" --output-format json | jq -r '.session_id')
claude -p "Continue the review" --resume "$session_id"
```

### System Prompt Customization

```bash
# Append to default system prompt
claude -p "Review the code" \
  --append-system-prompt "You are a security engineer. Focus on OWASP top 10."
```

### Practical Examples

```bash
# Security review of a PR
gh pr diff 123 | claude -p \
  --append-system-prompt "Find security vulnerabilities." \
  --allowedTools "Read,Grep" \
  --output-format json | jq -r '.result'

# Automated changelog generation
git log --oneline v0.9.0..HEAD | claude -p \
  "Generate a CHANGELOG entry from these commits" \
  --output-format text

# CI lint-fix pipeline
claude -p "Fix all ESLint errors in src/" \
  --allowedTools "Read,Edit,Bash(npm run lint *)"
```

### Limitations

- Large stdin (>7,000 characters) may produce empty output — split into chunks
- For production automation, consider the [Agent SDK](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/sdk) instead of `-p` mode

## Session Naming and Resume

Claude Code tracks conversation sessions and lets you resume previous work.

### Naming Sessions

Name the current session for easy retrieval later:

```
> /rename auth-refactor
```

Name sessions early when starting distinct tasks — descriptive names like
`auth-refactor` or `phase-6-release` are easier to find than auto-generated ones.

### Resuming Sessions

```bash
# Resume the most recent session
claude --continue        # or: claude -c

# Resume a named session
claude --resume auth-refactor

# Interactive session picker (browse all sessions)
claude --resume
```

### Session Picker Shortcuts

When the interactive picker opens (`claude --resume` with no name):

| Key | Action |
|-----|--------|
| `↑`/`↓` | Navigate sessions |
| `Enter` | Resume selected session |
| `P` | Preview session content |
| `R` | Rename session |
| `/` | Search/filter |
| `A` | Toggle current directory vs all projects |
| `B` | Filter to current git branch |
| `Esc` | Exit |

You can also switch sessions mid-work with `/resume` from inside an active session.

## Checkpointing and Rewind

Every prompt you send creates a checkpoint. Claude tracks all file edits, letting
you rewind to any previous point in the session.

### Opening the Rewind Menu

```
Esc + Esc          # Press Escape twice
```

Or use `/rewind` from the prompt.

### Rewind Actions

| Action | Effect |
|--------|--------|
| **Restore code and conversation** | Revert both file changes and chat history |
| **Restore conversation** | Rewind chat but keep current code on disk |
| **Restore code** | Revert files but keep conversation history |
| **Summarize from here** | Compress messages from this point forward (frees context) |

After restoring, the original prompt is placed back in your input field for re-sending or editing.

### Limitations

- **Bash commands are not tracked** — `rm`, `mv`, `cp` etc. cannot be undone via rewind
- **External edits are not tracked** — only Claude's Write/Edit tool calls are captured
- **Not a Git replacement** — checkpoints are session-level undo, not permanent history
- Checkpoints auto-expire after 30 days

### Use Cases

- **Exploring alternatives** — try different implementations, rewind if they don't work
- **Recovering from mistakes** — quickly undo a batch of changes that broke something
- **Freeing context** — summarize a long debugging tangent from the midpoint forward

## Fast Mode

Fast mode uses the same Opus 4.6 model with ~2.5x faster output at higher cost.

### Toggling

```
> /fast                  # Toggle on/off during a session
```

Persistent default (in `~/.claude/settings.json`):

```json
{ "fastMode": true }
```

This project has `fastMode: true` set at the user level.

### Behavior

- Toggling on switches to Opus 4.6 if not already active
- Toggling off keeps the model on Opus 4.6 (use `/model` to switch)
- The `↯` icon appears next to the input prompt when active (gray during rate-limit cooldown)
- Rate limits auto-fallback to standard speed, then re-enable when cooldown expires

### When to Use

| Scenario | Mode |
|----------|------|
| Interactive development, live debugging | Fast mode |
| Long autonomous tasks, CI/CD pipelines | Standard mode |
| Quick straightforward edits | Fast mode + lower effort (`/model`) |

## Claude Code Knowledge Architecture

Claude Code knowledge is organized in three tiers, balancing token cost against availability:

```
┌─────────────────────────────────────────────────────────────┐
│  MEMORY.md  (always loaded — every API call, every session) │
│  ~/.claude/projects/<encoded-path>/memory/MEMORY.md         │
│  Keep lean: preferences, ports, repo layout, pointers       │
│  200-line cap — every line costs tokens on every call        │
├─────────────────────────────────────────────────────────────┤
│  LESSONS-LEARNED.md  (read on demand — zero cost until read)│
│  docs/development/LESSONS-LEARNED.md                        │
│  Technical patterns, gotchas, architecture decisions         │
│  No size limit — read once when entering a relevant area    │
├─────────────────────────────────────────────────────────────┤
│  .claude/rules/*.md  (auto-loaded by path glob)             │
│  Conventions per file type — loaded only for matching files  │
│  Cost proportional to which files you're editing             │
└─────────────────────────────────────────────────────────────┘
```

### Routing Rule for New Knowledge

| Question | Destination |
|----------|-------------|
| Needed every session regardless of task? | MEMORY.md |
| Technical pattern/gotcha for a specific area? | LESSONS-LEARNED.md |
| Convention tied to a file path pattern? | `.claude/rules/*.md` |

### How It Works

- **MEMORY.md** is injected into the system prompt on every API call. It holds user preferences, repo layout, port assignments, and pointers to deeper files. ~50 lines, stays lean.
- **LESSONS-LEARNED.md** is read on demand when Claude enters a relevant area. Contains framework patterns (Quasar, Fastify, Vitest), debugging insights, and architecture decisions. Grows unbounded.
- **Rules files** (`.claude/rules/*.md`) load automatically when Claude works on files matching their path glob. Hold per-file-type conventions (backend patterns, frontend patterns, testing rules).

### Maintenance

Claude auto-maintains both MEMORY.md and LESSONS-LEARNED.md during development:
- New operational context (preferences, active state) routes to MEMORY.md
- New technical lessons (patterns, gotchas, decisions) route to LESSONS-LEARNED.md
- MEMORY.md includes a routing instruction to prevent drift

### Backport to Template

Generic lessons (not project-specific) should be backported to the project template so future projects start with accumulated knowledge. From the template repo:

```bash
./scripts/backport-lessons.sh /path/to/project/docs/development/LESSONS-LEARNED.md
```

The script shows new entries for review. Strip project-specific details before copying to the template.

### Claude Code Agents

Custom subagent definitions live in `.claude/agents/*.md`. Each agent is a specialized subprocess that Claude Code can launch via the Task tool to handle focused work autonomously.

#### Available Agents

| Agent | Purpose | Invocation |
|-------|---------|------------|
| **test-runner** | Runs unit + backend tests, reports pass/fail summary | After code changes |
| **e2e-runner** | Runs Playwright E2E tests via Docker, reports results | After feature implementation |
| **tui-tester** | Runs TUI sub-package tests (169 tests: API, demo mock, Ink components, tier gating) | After TUI changes |
| **security-reviewer** | Reviews code for OWASP vulnerabilities (injection, XSS, auth bypass) | Before security-sensitive commits |
| **gtm-content** | Creates launch content (README, blog, community posts, comparison pages) | Pre-launch marketing |
| **gtm-demo** | Builds demo site infrastructure (config, sample data, build script, workflows) | Demo site setup |

#### Agent Definition Format

Each `.md` file has YAML frontmatter specifying capabilities:

```yaml
---
name: test-runner
description: Runs unit and backend tests and reports results.
tools: Read, Bash, Glob, Grep      # Tools the agent can use
disallowedTools: Write, Edit        # Prevents accidental modifications
model: haiku                        # Fast model for test output parsing
maxTurns: 10                        # Limits agent iterations
---
```

#### Design Principles

- **Read-only runners** (test-runner, e2e-runner, tui-tester, security-reviewer) use `disallowedTools: Write, Edit` to prevent accidental modifications. They observe and report only.
- **Content generators** (gtm-content, gtm-demo) have Write/Edit access because their purpose is creating files.
- All agents use `model: haiku` for cost efficiency — they parse output, not architect solutions.
- `maxTurns: 10` prevents runaway loops.

#### Creating New Agents

1. Create `.claude/agents/your-agent.md` with YAML frontmatter
2. Write clear instructions: what commands to run, what output format to produce
3. Specify minimal tool access (principle of least privilege)
4. Add the agent to this table
5. Backport generic agents to the project template with `{{PRODUCT_NAME}}` placeholders

## Security Configuration

The backend applies multiple layers of security hardening. This section documents the controls and their configuration.

### Security Headers (Helmet)

`@fastify/helmet` is registered with a Content Security Policy tailored for a Quasar SPA:

| Directive | Value | Reason |
| --- | --- | --- |
| `default-src` | `'self'` | Only load resources from same origin |
| `connect-src` | `'self'`, `ws:`, `wss:` | Allow WebSocket connections |
| `script-src` | `'self'` | No inline scripts |
| `style-src` | `'self'`, `https:`, `'unsafe-inline'` | Quasar uses inline styles |
| `font-src` | `'self'`, `https:`, `data:` | Allow CDN fonts and data URIs |
| `img-src` | `'self'`, `data:` | Allow data URI images |

Additional headers set by Helmet: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `X-DNS-Prefetch-Control`, `X-Download-Options`, `X-Permitted-Cross-Domain-Policies`.

### CORS

`@fastify/cors` restricts cross-origin requests:

- **Development:** Allows `http://localhost:9010` (Quasar dev server)
- **Production:** Set `CORS_ORIGIN` environment variable to the frontend origin
- Credentials (cookies/auth headers) are allowed via `credentials: true`

### Rate Limiting

`@fastify/rate-limit` is registered globally with per-route overrides:

| Scope | Limit | Window |
| --- | --- | --- |
| Global default | 120 requests | 1 minute |
| Auth routes (login, register, refresh) | 10 requests | 1 minute |
| VM mutation (start, stop, restart) | 30 requests | 1 minute |

Rate limit keys are derived from `request.userId` for authenticated requests and `request.ip` for unauthenticated ones. Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.

### Request Body Limits

Fastify is configured with an explicit `bodyLimit` of 1 MB (1,048,576 bytes). Requests exceeding this limit receive a 413 Payload Too Large response.

### Input Validation

All POST/PUT endpoints use Zod schemas for request body and parameter validation via `fastify-type-provider-zod`. Key validations include:

- **VM names:** `^[a-z][a-z0-9-]*$` regex, 2-63 characters
- **IP addresses:** IPv4 format validation
- **Usernames:** `^[a-zA-Z][a-zA-Z0-9_-]*$` regex, 3-32 characters
- **Passwords:** 14-128 characters, must contain at least one uppercase letter, one lowercase letter, one digit, and one special character
- **Agent actions:** Enum (`diagnose`, `explain`, `suggest`)
- **Operation IDs:** UUID format

Invalid requests receive a 400 response with structured validation error details.

### Authentication Security

- **JWT algorithm:** HS256 with configurable secret (`JWT_SECRET` or `JWT_SECRET_FILE`)
- **JWT secret in production:** The server refuses to start if `JWT_SECRET` is not configured when `NODE_ENV=production`. In development/test, a random secret is auto-generated (with a console warning)
- **Access token TTL:** 30 minutes
- **Refresh token TTL:** 7 days
- **Refresh tokens:** Single-use (old session deleted on refresh)
- **Password hashing:** bcrypt with cost factor 13
- **Account lockout:** After 5 failed login attempts within 15 minutes, the account is temporarily locked. The lockout window resets after the 15-minute period expires. Lockout state is persisted to disk (survives restarts)
- **Single-session enforcement (all tiers):** New login revokes all prior sessions for that user. WebSocket connections are closed with code 4402. Multi-user (weaver/fabrick) means multiple user accounts, not multiple sessions per account.
- **JWT payload:** Contains only `sub` (user ID), `username`, `role`, `jti` (token ID), `type` -- no secrets
- **Session store:** Every token is validated against the session store; revoked sessions immediately invalidate tokens

### WebSocket Security

The `/ws/status` WebSocket endpoint authenticates via a `?token=` query parameter. The token is validated before any data is sent. Unauthenticated connections receive an error message and are closed with code 4401.

### WebSocket Close Codes

| Code | Meaning | Client behavior |
|------|---------|-----------------|
| 4400 | Invalid VM name (serial console) | Show error, do not reconnect |
| 4401 | Authentication required / expired | Stop reconnect, redirect to login |
| 4402 | Session replaced (logged in elsewhere) | Stop reconnect, show notification, redirect to login |
| 4403 | Insufficient permissions (serial console) | Show error, do not reconnect |

### Single-Session Enforcement (All Tiers)

Only one active session per user is allowed at all tiers. When a user logs in from a new client (web or TUI), the backend revokes all prior sessions for that user and emits a `session-revoked` event via `sessionEvents` (EventEmitter in `auth.ts`). The WebSocket handler in `ws.ts` listens for this event and closes existing connections for that user with code 4402. Both the web UI (Quasar warning toast) and TUI (error message above login prompt) inform the user why their session ended.

Multi-user (weaver/fabrick) means multiple user **accounts** can be logged in simultaneously — not multiple sessions for the **same** account. Last login always wins.

### Password Recovery

If the admin forgets their password, the `reset-admin-password.sh` script provides emergency recovery via root access on the host:

```bash
# Interactive (prompts for username and password)
sudo ./scripts/reset-admin-password.sh

# Non-interactive
sudo ./scripts/reset-admin-password.sh admin newpassword123
```

The script directly updates the bcrypt hash in `/var/lib/weaver/users.json`, clears any lockout state, and fixes file ownership. If the `weaver.service` is running, the script sends `SIGHUP` to trigger a hot-reload of the user store — the new password takes effect immediately without restarting the service. All existing sessions for the user are invalidated (old tokens reference a stale password hash). Requires the backend's `node_modules` to be installed (uses `bcryptjs` with the same 13-round cost factor).

#### SIGHUP Hot-Reload

The backend listens for `SIGHUP` and reloads the user store from disk. This is the standard Unix pattern for config/data reload (nginx, PostgreSQL) and supports:

- **Password recovery** — `reset-admin-password.sh` writes `users.json` then signals the service
- **Fabrick multi-user** — reloads ALL users atomically, not just a single account
- **External tooling** — any script that modifies `users.json` can trigger a reload via `systemctl kill --signal=HUP weaver.service`

### Error Handling

**Backend (API responses):**

The global Fastify error handler (`index.ts`) differentiates between environments:

- **Development:** 5xx error messages are returned in full for debugging
- **Production:** 5xx errors return a generic `"Internal Server Error"` to prevent information leakage
- **Zod validation errors:** Always return `{ error: "Validation failed", details: [...] }` regardless of environment

For 4xx errors from route handlers, the backend returns `{ error: "user-friendly message" }`. System errors from `execFileAsync` (which contain paths like `/run/current-system/sw/bin/systemctl`) are **never** passed to the client — they are logged server-side and replaced with a sanitized message:

```typescript
} catch (err) {
  console.error(`[microvm] Failed to start VM '${name}':`, err)
  return { success: false, message: `Failed to start VM '${name}'. Check server logs for details.` }
}
```

**Frontend (error extraction):**

All frontend catch blocks that surface errors to users use the `extractErrorMessage()` utility (`src/utils/error.ts`). This extracts the backend's `response.data.error` from Axios errors instead of showing the generic "Request failed with status code 400":

```typescript
import { extractErrorMessage } from 'src/utils/error'

} catch (err) {
  $q.notify({
    type: 'negative',
    message: extractErrorMessage(err, 'Failed to start VM'),
  })
}
```

The utility checks `axios.isAxiosError(err)` first, then falls back to `err.message`, then the provided fallback string.

### Command Execution

All system commands use `execFile` (never `exec` or `shell: true`) to prevent shell injection. Binary paths are fully qualified via configuration (e.g., `/run/current-system/sw/bin/systemctl`).

### Secret Management

- No secrets are hardcoded in source code
- `.env`, `.env.local`, and `.env.*.local` are excluded via `.gitignore`
- Secrets support both direct environment variables and file-based injection (`*_FILE` variants) for NixOS sops-nix integration
- In development, missing secrets are auto-generated with console warnings
- In production, missing `JWT_SECRET` triggers an error-level warning

### Environment Variables (Security-Related)

| Variable | Description | Required in Production |
| --- | --- | --- |
| `JWT_SECRET` | HMAC key for JWT signing | Yes |
| `JWT_SECRET_FILE` | Path to JWT secret file (alternative) | Alternative to above |
| `CORS_ORIGIN` | Allowed CORS origin | Yes |
| `LICENSE_HMAC_SECRET` | HMAC key for license validation | Yes (if using licenses) |
| `INITIAL_ADMIN_PASSWORD` | First-run admin password | Recommended |
| `INITIAL_ADMIN_PASSWORD_FILE` | Path to initial admin password file | Alternative to above |

## Dependency Management Pipeline

Weaver depends on two framework ecosystems — **Quasar** (pins Vue, Vite, Pinia, vue-router, TypeScript, ESLint) and **Fastify** (v5 deferred post-v1.0) — which prevent freely upgrading all dependencies. The project uses a five-component automated pipeline to handle this without breaking CI or losing track of pending upgrades.

### How It Works

```
 Dependabot (weekly)
   │
   │  opens PRs for npm + GitHub Actions updates
   │
   ▼
 dependabot-labeler.yml (on PR open)
   │
   │  checks package name against blocked lists
   │  applies label: ready-to-merge │ blocked-by-quasar │ needs-review
   │
   ▼
 dependabot-tracker.yml (on PR open/close + push to main)
   │
   │  reads all open Dependabot PRs
   │  categorizes by label into tables
   │  updates tracking issue #39
   │
   ▼
 audit-security.ts (in CI via npm run test:security)
   │
   │  runs npm audit on frontend + backend
   │  filters advisories for BLOCKED_PACKAGES + BLOCKED_TRANSITIVES
   │  fails only on unknown high/critical vulns
   │
   ▼
 version-drift-check.yml (monthly schedule)
   │
   │  queries npm for Quasar's latest peerDependencies
   │  compares against blocked list
   │  comments on #39 when a blocker clears
```

### Blocked Package Lists

Three files contain blocked package lists that must stay in sync:

| File | Data Structure | Purpose |
|------|---------------|---------|
| `scripts/audit-security.ts` | `BLOCKED_PACKAGES` + `BLOCKED_TRANSITIVES` | CI audit filtering |
| `.github/workflows/dependabot-labeler.yml` | `QUASAR_BLOCKED` + `FASTIFY_BLOCKED` arrays | PR auto-labeling |
| `.github/workflows/version-drift-check.yml` | `BLOCKED` array | Monthly unblock check |

**Currently blocked:**

| Package | Blocked By | Reason |
|---------|-----------|--------|
| vite, vue, vue-router, pinia, @vitejs/plugin-vue, typescript, eslint | Quasar | Quasar's peer deps pin these major versions |
| fastify, @fastify/websocket, @fastify/cors, @fastify/static, @fastify/rate-limit, @fastify/helmet | Fastify | v5 breaking API changes, deferred post-v1.0 |

Transitive packages (e.g., `esbuild` via `vite`, `ajv` via `eslint`) are tracked in `BLOCKED_TRANSITIVES` in `audit-security.ts` and automatically filtered.

### How Labels Flow

| Dependabot PR Type | Label Applied | What It Means |
|-------------------|--------------|---------------|
| GitHub Actions (any version) | `ready-to-merge` | Safe — merge at will |
| npm minor/patch | `ready-to-merge` | Safe — merge at will |
| npm major, package in blocked list | `blocked-by-quasar` | Do not merge until framework supports it |
| npm major, package NOT blocked | `needs-review` | Review changelog for breaking changes, then merge or close |

### Key Design Decisions

1. **Package-level blocking, not advisory-level.** When a new GHSA appears for an already-blocked package (e.g., another fastify DoS), it's automatically filtered. No manual GHSA ID tracking.

2. **Grouped minor/patch PRs.** Dependabot groups all minor+patch updates into a single PR per ecosystem (frontend, backend) to reduce noise. Major updates arrive as individual PRs for targeted review.

3. **Sync exclusion.** All three Dependabot workflows are excluded from the free repo sync (`.github/sync-exclude.yml`) since they're dev-only automation.

For day-to-day operational procedures, see the [Dependency Management Maintainer Guide](workflows/DEPENDENCY-MANAGEMENT.md).

## Testing Architecture

### Engineering Principle: No Quick Fixes

**Never apply manual workarounds or one-time patches.** Every fix must be permanent and prevent the problem from recurring. If a script requires manual intervention to work correctly, the script is broken — fix the script.

This applies to:
- **Lifecycle scripts** (fresh-install, rebuild, test harness) — must be idempotent and safe to run at any time
- **Data seeding** — use explicit opt-in (`SEED_SAMPLE_VMS=true`), never environment-based blanket checks
- **Process lifecycle** — scripts that kill servers must wait for full exit before modifying data (graceful shutdown can re-persist state)
- **Test environments** — each environment (dev, E2E Docker, live E2E, NixOS prod) must be fully isolated with no bleed-over

### Testing Pyramid

Tests are organized from fast to slow, with composites that chain layers together:

| Layer | Speed | Composite | When | What |
|-------|-------|-----------|------|------|
| Lint + Typecheck | ~10s | `test:precommit` | Every commit | ESLint + vue-tsc |
| Unit tests | ~15s | `test:precommit` | Every commit | Vitest (frontend, backend, TUI) |
| Security audit | ~5s | `test:prepush` | Every push | npm audit + blocked packages |
| Static compliance | ~10s | `test:prepush` | Every push | Forms, routes, legal, e2e-coverage, tier-parity |
| E2E premium | ~2min | `test:prerelease` | Pre-release | Playwright Docker (premium tier) |
| E2E free | ~1min | `test:prerelease` | Pre-release | Playwright Docker (free license key) |
| Distro catalog | 30s-20min | Manual | Pre-release | Requires live NixOS backend with provisioning |
| Post-release | ~10s | Manual | After tag | `verify:release --version v<version>` |

### Composite Chain

```
test:precommit  = lint + typecheck + unit + backend + TUI (~40s)
test:prepush    = precommit + security + compliance (~55s)
test:compliance = audit:forms + audit:routes + audit:e2e-coverage + audit:legal + audit:tier-parity (~10s)
test:prerelease = prepush + e2e (premium) + e2e:free (~4min)
```

### Static Compliance Analyzers

Five fast scanners that run as `test:compliance`:

| Script | npm Script | What It Checks |
|--------|-----------|----------------|
| `verify-form-rules.ts` | `audit:forms` | All `<q-input>`/`<q-select>` have `:rules` or `@exempt` |
| `verify-route-auth.ts` | `audit:routes` | All backend routes have `requireRole`/ACL/manual auth |
| `verify-form-e2e-coverage.ts` | `audit:e2e-coverage` | Every validation rule has an E2E test assertion |
| `verify-legal-ip.ts` | `audit:legal` | LICENSE, copyright notices, AI training blocks |
| `verify-tier-parity.ts` | `audit:tier-parity` | `tier-matrix.json` matches backend gates + frontend guards |

### Tier Parity System

`tier-matrix.json` (repo root) is the machine-readable source of truth for the 4-tier feature matrix (20 features: 8 free, 8 premium, 4 fabrick). The `verify-tier-parity.ts` script cross-references it against:

- Backend `requireTier()` gates in route files
- Frontend `isPremium`/`isFabrick` guards in Vue components
- Orphan detection: tier gates in code not mapped in the matrix

When adding a gated feature: update `tier-matrix.json`, run `npm run audit:tier-parity`.

### E2E Testing

All E2E tests run inside Docker via `testing/e2e-docker/`. Five test profiles exist:

| Profile | Docker Service | Tier | Script |
|---------|---------------|------|--------|
| Premium | `playwright-tests` | Premium (default) | `npm run e2e` |
| Free | `playwright-free` | Free (license key) | `npm run e2e:free` |
| Demo (public) | `playwright-demo-public` | Static SPA (no backend) | `npm run e2e:demo-public` |
| Demo (private) | `playwright-demo-private` | Static SPA (no backend) | `npm run e2e:demo-private` |
| Demo (mocked) | (in premium suite) | Demo (route-mocked health) | `demo-mode.spec.ts` |

The demo-public and demo-private profiles build the demo SPA (`VITE_DEMO_MODE=true`, optionally `VITE_DEMO_PUBLIC=true`), serve it statically on port 9030 via `npx serve`, and run Playwright against it — no backend required. They verify page content, CTA links, tier/version behavior, and cross-cutting invariants (no console errors, no API leaks, no deprecated terminology).

E2E spec files: `testing/e2e/*.spec.ts`. Shared helpers: `testing/e2e/helpers/`.

## Versioned Docs for Demos

Documentation is bundled into the SPA at build time. Demos need docs that match the version being shown — not the latest working copy.

### How It Works

- **Living docs** (`docs/ADMIN-GUIDE.md`, etc.): Always edited in place. Production builds and demos without snapshots use these.
- **Version snapshots** (`docs/v1.0/`, `docs/v1.1/`, etc.): Frozen copies created at release time via `npm run docs:snapshot -- <version>`. Never edited after creation.
- **DocsPage.vue**: In demo mode, loads the snapshot matching `appStore.demoVersion`. If no snapshot exists, falls back to living docs with a development banner.
- **Build-time validation**: `npm run audit:docs-links` (24th auditor) validates all links resolve — cross-doc references, anchor targets, snapshot completeness, version tags. Runs in `prebuild` and `test:compliance`.

### Commands

```bash
npm run docs:snapshot -- 1.0       # Create frozen snapshot for v1.0
npm run docs:snapshot -- 1.1       # Create frozen snapshot for v1.1
npm run docs:snapshot -- 1.0 --force  # Overwrite existing snapshot
npm run audit:docs-links           # Validate all docs links (current + snapshots)
```

### Workflow

1. Edit living docs during development
2. Review content in the demo (shows living docs + development banner)
3. Fix content issues
4. Snapshot when ready: `npm run docs:snapshot -- <version>`
5. Demo serves frozen snapshot — banner disappears

### What Gets Bundled

ADMIN-GUIDE, USER-GUIDE, PRODUCTION-DEPLOYMENT, COMPATIBILITY, SECURITY-BASELINES, NIST-800-171-MAPPING, HIPAA-164-312-MAPPING, PCI-DSS-MAPPING, CIS-BENCHMARK-ALIGNMENT, SOC2-READINESS, ATTRIBUTION, TERMS-OF-SERVICE.

Adding a new doc: import in `DocsPage.vue`, add to `currentDocs`, `slugToPath`, `fileToSlug`, and `snapshot-docs.sh`. Run `audit:docs-links` to verify.

## Release Pipeline

The release pipeline is entirely GitHub Actions-based. Pushing a version tag triggers a multi-stage workflow that builds, publishes, syncs to the free repo, and dispatches a NUR package update — all with a manual approval gate before anything goes public.

### Pipeline Flow

```
 git tag v1.0.0 && git push origin v1.0.0
   │
   ▼
 ┌─────────────────────────────────────────┐
 │  1. BUILD                               │
 │  - npm ci (frontend + backend)          │
 │  - npm run build:all                    │
 │  - Package SPA as .tar.gz              │
 │  - Upload artifacts (SPA, backend)      │
 └───────────────┬─────────────────────────┘
                 │
                 ▼
 ┌─────────────────────────────────────────┐
 │  2. CREATE DRAFT RELEASE                │
 │  - GitHub Release (draft)               │
 │  - Auto-generated release notes         │
 │  - SPA tarball attached as asset        │
 │  - Pre-release flag for -rc/-beta/-alpha│
 └───────────────┬─────────────────────────┘
                 │
                 ▼
 ┌─────────────────────────────────────────┐
 │  3. MANUAL APPROVAL                     │  ◄── Human clicks "Approve" in Actions UI
 │  - 'release-publish' environment gate   │
 │  - Required reviewer must approve       │
 └───────────────┬─────────────────────────┘
                 │
                 ▼
 ┌─────────────────────────────────────────┐
 │  4. PUBLISH RELEASE                     │
 │  - Draft → public on Dev repo           │
 └───────────────┬─────────────────────────┘
                 │
                 ▼
 ┌─────────────────────────────────────────┐
 │  5. RELEASE TO FREE REPO                │
 │  - rsync Dev → Free (excludes dev-only) │
 │  - Commit + push to Free main           │
 │  - Create matching tag + release        │
 │  - Copy release assets (tarball)        │
 └───────────────┬─────────────────────────┘
                 │
                 ▼  (skipped for -rc/-beta/-alpha)
 ┌─────────────────────────────────────────┐
 │  6. UPDATE NUR PACKAGES                 │
 │  - Compute sha256 from Free repo tarball│
 │  - Dispatch to nur-packages repo        │
 │  - NUR rebuilds with new hash + version │
 └─────────────────────────────────────────┘
```

### Workflow Files

| Workflow | File | Trigger | Role |
|----------|------|---------|------|
| Release | `.github/workflows/release.yml` | Tag push (`v*`) | Full pipeline: build → draft → approve → publish → sync → NUR |
| Sync to Free | `.github/workflows/sync-to-free.yml` | Push to `main`, manual | Ongoing code sync (PR-based, auto-merged). Skips commits starting with "Release v" to avoid double-sync with release.yml |

### Dev-to-Free Sync Exclusions

Both workflows use the same exclusion list. The free repo never receives:

- **Dev tooling:** `CLAUDE.md`, `.mcp.json`, `.claude/`, `.githooks/`, `testing/`, `TESTING.md`, `playwright.config.ts`, `vitest.config.ts`, `flake.nix`, `flake.lock`
- **Planning docs:** `docs/planning/`, `mcp-server/`
- **Tier-gated source:** `backend/src/routes/weaver/`, `backend/src/routes/fabrick/`, `backend/src/services/weaver/`, `backend/src/services/fabrick/`, `src/components/weaver/`, `src/components/fabrick/`, `src/pages/weaver/`, `src/pages/fabrick/`, `tui/src/components/weaver/`, `tui/src/components/fabrick/`
- **Dev-only workflows:** `sync-to-free.yml`, `dependabot-labeler.yml`, `dependabot-tracker.yml`, `version-drift-check.yml`, `demo-reset.yml`, `stale.yml`
- **Licensing:** `scripts/generate-license.ts`

Base exclusions are hard-coded in both workflows. Repo-specific exclusions are read from `.github/sync-exclude.yml` at runtime.

### Required Secrets

| Secret | Scope | Used By |
|--------|-------|---------|
| `SYNC_TOKEN` | PAT with `repo` scope | release.yml (free repo push + NUR dispatch), sync-to-free.yml |
| `GITHUB_TOKEN` | Auto-provided | release.yml (draft/publish on Dev repo) |

### Required Environments

| Environment | Purpose | Configuration |
|-------------|---------|---------------|
| `release-publish` | Manual approval gate | Settings > Environments > Add required reviewers |

### Pre-release Tags

Tags containing `-rc`, `-beta`, or `-alpha` (e.g., `v1.0.0-rc1`) are handled specially:

- The GitHub Release is marked as **pre-release** (visible but not "latest")
- The NUR update step is **skipped** (NUR only tracks stable releases)
- Everything else runs normally — useful for dry-running the pipeline

### Post-Release Verification

After the pipeline completes, run the verification script to confirm all four domains:

```bash
# Check GitHub Release + Free repo sync + Demo site
npm run verify:release -- --version v1.0.0

# Also check a live API instance
npm run verify:release -- --version v1.0.0 --host http://localhost:3100

# Skip demo site check (if not yet deployed)
npm run verify:release -- --version v1.0.0 --skip-demo
```

The script validates:
1. **GitHub Release** — exists on Dev, not draft, title and body present
2. **Free Repo Sync** — version tag exists, LICENSE present, excluded files absent
3. **Demo Site** — HTTP 200, contains "MicroVM", robots.txt, noai meta tag
4. **API Spot Checks** — `/api/health` and `/api/auth/setup-required` respond (optional, requires `--host`)

### Performing a Release

```bash
# 1. Update versions
#    - package.json (root)
#    - backend/package.json

# 2. Update CHANGELOG.md with release date and notes

# 3. Run full test suite
npm run test:prepush

# 4. Build everything
npm run build:all

# 5. Commit version bump
git add package.json backend/package.json CHANGELOG.md
git commit -m "Release v1.0.0"

# 6. Tag and push
git tag v1.0.0
git push origin main --tags

# 7. Wait for GitHub Actions:
#    - Build completes (~2 min)
#    - Draft release appears
#    - Approve in Actions UI
#    - Publish + sync + NUR (~3 min)

# 8. Verify
npm run verify:release -- --version v1.0.0
```

## MCP Servers (Claude Code Tooling)

The project configures [Model Context Protocol](https://modelcontextprotocol.io/) servers in `.mcp.json` to give Claude Code direct access to external systems during development. These reduce agent iteration time by eliminating manual lookup and CLI round-trips.

### Configured Servers

| Server | Package | Transport | Purpose |
| --- | --- | --- | --- |
| **GitHub** | `@modelcontextprotocol/server-github` | npx (Node) | PR/issue management, code search, repository operations |
| **NixOS** | `mcp-nixos` | uvx (Python) | Real-time NixOS package/option lookup (130K+ packages, 23K+ options) |
| **Playwright** | `@playwright/mcp` | npx (Node) | Browser interaction via accessibility snapshots for E2E spec development |
| **Docker** | `mcp-server-docker` | uvx (Python) | Container/image/network management for runtime adapter testing |
| **Quasar Docs** | GitMCP | SSE (remote) | Quasar Framework documentation lookup (component APIs, config options) |
| **Dashboard** | `mcp-server/` (local) | npx/tsx (Node) | Structured project knowledge — API routes, stores, types, config, tier model |

### Prerequisites

| Dependency | Required By | NixOS Package |
| --- | --- | --- |
| Node.js 18+ / npx | GitHub, Playwright | `nodejs_22` |
| Python / uvx | NixOS, Docker | `uv` |
| Docker daemon | Docker MCP | `docker` |
| `GITHUB_TOKEN` env var | GitHub MCP | Set in shell profile or `.env` |

### Configuration

MCP servers are defined in `.mcp.json` at the project root (project-scoped, shared with all contributors):

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" }
    },
    "nixos": {
      "command": "uvx",
      "args": ["mcp-nixos"]
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    },
    "docker": {
      "command": "uvx",
      "args": ["mcp-server-docker"]
    },
    "quasar-docs": {
      "type": "sse",
      "url": "https://gitmcp.io/quasarframework/quasar"
    },
    "dashboard": {
      "command": "npx",
      "args": ["tsx", "mcp-server/src/index.ts"]
    }
  }
}
```

Claude Code automatically discovers `.mcp.json` when opening a session in the project directory. No manual activation is needed.

### Server Details

#### GitHub MCP

Provides tools for repository operations without leaving the Claude Code session: creating issues, PRs, searching code, managing releases. Uses `GITHUB_TOKEN` environment variable for authentication.

**Used in:** All phases (PR creation, issue management, release workflows).

#### NixOS MCP (mcp-nixos)

Queries the NixOS package set and option definitions in real time. Eliminates the manual cycle of looking up option types, checking package availability, and verifying module syntax when working on `nixos/default.nix` or NixOS deployment configuration.

**Capabilities:**
- Search 130K+ NixOS packages by name or description
- Look up NixOS module options with type signatures and defaults
- Query Home Manager and nix-darwin options
- Resolve package metadata (version, description, maintainers)

**Used in:** Phase 6 (NUR publishing, NixOS module updates), Phase 7 (container runtime NixOS options), any NixOS-touching work.

#### Playwright MCP

Microsoft's official MCP server for browser automation. Lets Claude Code interact with a real browser through accessibility tree snapshots rather than screenshots. Useful for writing E2E test specs against the actual DOM structure instead of guessing selectors.

**Capabilities:**
- Navigate to pages and interact with elements
- Take accessibility snapshots of the rendered page
- Fill forms, click buttons, extract text
- Runs headed by default (use `--headless` flag if needed)

**Used in:** All phases (E2E spec writing per project policy). Complements the Docker-based Playwright runner — use this MCP for spec development, Docker for CI execution.

#### Docker MCP

Exposes Docker container, image, and network management through MCP tools. During container orchestration development (Phase 7), this allows Claude Code to test `DockerRuntime` adapter implementations against real containers interactively.

**Capabilities:**
- List, start, stop, remove containers
- Inspect container details and logs
- Manage images and networks
- Supports remote Docker via `DOCKER_HOST` env var

**Used in:** Phase 7a/7b (DockerRuntime adapter development and testing), E2E Docker environment debugging.

#### Quasar Docs (GitMCP)

Auto-generated MCP server from the [Quasar Framework GitHub repository](https://github.com/quasarframework/quasar) via [GitMCP](https://gitmcp.io). Provides access to Quasar's official documentation — component APIs, configuration options, plugin usage, and CLI references. Unlike the other servers, this is a remote SSE server with no local prerequisites.

**Capabilities:**
- Look up Quasar component APIs (QBtn, QTable, QDialog, etc.)
- Query `quasar.config.cjs` options and build configuration
- Reference Quasar plugin and directive documentation
- Check Quasar utility functions and composables

**Used in:** All phases (frontend component work, Quasar config changes, layout decisions).

#### Dashboard MCP (Custom)

A custom TypeScript MCP server at `mcp-server/` that exposes structured project knowledge as tools. Instead of agents reading large files (DEVELOPER-GUIDE.md, MASTER-PLAN.md, route files, store files) to understand project structure, they call focused tools that return structured JSON.

**Architecture:** Reads source files at call time (always current, no caching). Uses regex parsing, not AST. Returns `warnings` array for any files it couldn't read, never crashes on missing files. Runs via `npx tsx` — no build step needed.

**Tools (10):**

| Tool | Reads | Returns |
| --- | --- | --- |
| `getApiEndpoints` | `backend/src/routes/*.ts`, `backend/src/index.ts` | All routes with method, path, auth, rate limit, tier gate, prefix map |
| `getTypeDefinitions` | `src/types/*.ts` | Exported interfaces/types with full content; optional `files` filter |
| `getStoreSignatures` | `src/stores/*.ts` | State, getters, actions per Pinia store; optional `store` filter |
| `getComponentTree` | `src/components/`, `src/pages/`, `src/layouts/` | Vue files with imports and composable usage, categorized |
| `getConfigSchema` | `backend/src/config.ts` | DashboardConfig interface + all env vars with defaults |
| `getPortLayout` | `quasar.config.cjs`, `backend/src/index.ts` | Port assignments (dev/e2e/NixOS) with drift detection |
| `getTierModel` | `MASTER-PLAN.md` (parent project dir) | 4-tier feature matrix table |
| `getDecisions` | `MASTER-PLAN.md` (parent project dir) | Resolved architecture decisions |
| `getPhaseStatus` | `plans/v1.0.0/EXECUTION-ROADMAP.md` (parent) | Phase progress, current/next phase |
| `getStorageAdapters` | `backend/src/storage/*.ts`, `backend/src/services/adapters/*.ts` | Adapter interfaces, implementations, standalone stores |

**Directory structure:**
```
mcp-server/
├── package.json          # ESM, private, deps: @modelcontextprotocol/sdk, zod
├── tsconfig.json         # ES2022, strict, bundler resolution
└── src/
    ├── index.ts          # Server entry point + 10 tool registrations
    ├── tools/            # One file per tool
    │   ├── api-endpoints.ts
    │   ├── type-definitions.ts
    │   ├── store-signatures.ts
    │   ├── component-tree.ts
    │   ├── config-schema.ts
    │   ├── port-layout.ts
    │   ├── tier-model.ts
    │   ├── decisions.ts
    │   ├── phase-status.ts
    │   └── storage-adapters.ts
    └── utils/
        ├── file-reader.ts      # safeReadFile, listFiles, listDirs
        └── markdown-parser.ts  # extractSection, parseMarkdownTable
```

**Testing with MCP Inspector:**
```bash
npx @modelcontextprotocol/inspector npx tsx mcp-server/src/index.ts
```

**Sync exclusion:** `mcp-server/` is excluded from the free repo via `.github/sync-exclude.yml` (dev-only tool that references parent project paths).

**Used in:** All phases (replaces repeated file reads for project structure queries).

**Maintenance:** Tools read files at call time and scan directories dynamically — add a new route file, store, or component and it's automatically picked up on the next call. You only need to revisit the MCP server for:

- **New tools** — a new subsystem agents frequently query (e.g., auth middleware, migration scripts) that doesn't fit existing tools
- **Pattern changes** — if you change how routes are registered, switch stores from options API to setup syntax, etc. The regex parsers would need updating to match the new patterns
- **Structural moves** — renaming `src/stores/` or `backend/src/routes/` (the scan paths are hardcoded)

The most likely trigger is adding a tool, not fixing existing ones. The current 10 cover the patterns that are stable in this codebase.

### Adding User-Level MCP Servers

Servers needed across all projects (not just this one) go in `~/.claude/mcp.json`. The format is identical to the project `.mcp.json`. User-level servers merge with project-level servers, with project taking precedence on name conflicts.

## Adding New Features

### Adding a New API Endpoint

1. Create or edit a route file in `backend/src/routes/`.
2. Define Zod schemas for request/response validation.
3. Register the route in the Fastify plugin.
4. Update the API client in `src/services/api.ts`.
5. Add corresponding tests.

### Adding a New Page

1. Create the page component in `src/pages/`.
2. Add the route in `src/router/routes.ts`.
3. Add navigation in the layout component.
4. Create any needed composables or store actions.

### Adding a New Store

1. Create the store file in `src/stores/`.
2. Export from `src/stores/index.ts`.
3. Add persistence configuration if needed.
4. Write unit tests in `testing/unit/stores/`.
