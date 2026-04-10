<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver — Code-Level Implementation Plan

**Last updated:** 2026-02-08
**Aligns with:** [BUSINESS-MARKETING-ANALYSIS.md](../business/marketing/BUSINESS-MARKETING-ANALYSIS.md) and [competitive-landscape.md](../research/competitive-landscape.md)

---

## Current State

The v0.1.0 MVP provides:
- **Backend** (Fastify): 5 REST endpoints + 1 WebSocket, hardcoded VM definitions, systemctl wrapper
- **Frontend** (Quasar/Vue 3): Dashboard page, VM detail page, VmCard/StatusBadge components, Pinia stores
- **Tests**: 30 backend + 40 frontend unit tests, 7 Playwright E2E tests
- **NixOS**: systemd service module, sudo rules, nginx vhost

**Key limitation**: VM definitions are hardcoded in `backend/src/services/microvm.ts`. The backend cannot discover VMs dynamically.

---

## Milestone Overview

| Milestone | Business Phase | Target | Focus |
|---|---|---|---|
| **M1: Community Foundation** | Phase 1 (months 1–3) | Free tier essentials | Dynamic VM discovery, metrics, logs, polish |
| **M2: Template Editor** | Phase 1 (months 3–6) | Unique differentiator | Nix code generation, building blocks, templates |
| **M3: Pro Features** | Phase 2 (months 6–9) | First paying customers | n8n pipeline, multi-user auth, noVNC console |
| **M4: SaaS & Scale** | Phase 2–3 (months 9–12) | Hosted offering | Agent protocol, multi-host, AI generation |
| **R: Research Issues** | Ongoing | Gap analysis | Spikes for unknowns before committing to implementation |

---

## M1: Community Foundation (Free Tier Essentials)

### M1.1 — Dynamic VM Discovery

**Problem**: VMs are hardcoded in `VM_DEFINITIONS` array in `backend/src/services/microvm.ts`. Must be updated manually when VMs are added/removed.

**Solution**: Discover VMs dynamically from systemd `microvm@*.service` units.

**Backend changes:**

| File | Change |
|---|---|
| `backend/src/services/microvm.ts` | Replace `VM_DEFINITIONS` with `discoverVms()` function that runs `systemctl list-units 'microvm@*'` and parses output |
| `backend/src/services/microvm.ts` | Add `getVmConfig(name)` that reads VM config from the Nix-generated systemd unit (ExecStart args, Environment, etc.) |
| `backend/src/services/microvm.ts` | Parse IP, memory, vCPU, hypervisor from `systemctl show microvm@<name>` and `/etc/microvm/<name>` if available |
| `backend/src/routes/vms.ts` | Remove hardcoded VM name validation; validate against discovered VMs |
| `backend/src/routes/ws.ts` | Call `discoverVms()` on each broadcast cycle to pick up new/removed VMs |

**Tests:**

| File | Change |
|---|---|
| `backend/tests/services/microvm.spec.ts` | Add tests for `discoverVms()` with mocked systemctl output |
| `backend/tests/routes/vms.spec.ts` | Update to use dynamic discovery |

**Acceptance criteria:**
- Adding a new `microvm@foo.service` unit makes `foo` appear in the API within one WS broadcast cycle (2s)
- Removing a unit makes it disappear
- No config file changes needed when VMs change

---

### M1.2 — CPU/Memory Metrics

**Problem**: Dashboard shows only running/stopped status. No resource utilization data.

**Solution**: Collect per-VM metrics via `machinectl` and cgroup stats.

**Backend changes:**

| File | Change |
|---|---|
| `backend/src/services/metrics.ts` | **New file.** `getVmMetrics(name)` reads from `/sys/fs/cgroup/machine.slice/microvm@<name>.service/` for CPU, memory usage, or uses `machinectl show` |
| `backend/src/services/metrics.ts` | Returns `{ cpuPercent, memUsedMB, memTotalMB, netRxBytes, netTxBytes }` |
| `backend/src/routes/vms.ts` | Add `GET /api/vms/:name/metrics` endpoint |
| `backend/src/routes/ws.ts` | Include metrics in WS broadcast payload (extend VmInfo type) |
| `backend/src/index.ts` | Register metrics routes |

**Frontend changes:**

| File | Change |
|---|---|
| `src/types/vm.ts` | Extend `VmInfo` with `metrics?: { cpuPercent, memUsedMB, memTotalMB, netRxBytes, netTxBytes }` |
| `src/components/VmCard.vue` | Add CPU/memory mini-bars (Quasar `q-linear-progress`) |
| `src/pages/VmDetailPage.vue` | Add Metrics tab with time-series charts |
| `src/components/MetricsChart.vue` | **New file.** Lightweight chart component (use `chart.js` or Quasar's built-in) |
| `src/composables/useVmMetrics.ts` | **New file.** Reactive metrics from WS data with rolling 5-minute history |
| `src/stores/vm-store.ts` | Store metrics history per VM |

**Tests:**

| File | Change |
|---|---|
| `backend/tests/services/metrics.spec.ts` | **New.** Mock cgroup file reads |
| `backend/tests/routes/vms.spec.ts` | Test metrics endpoint |
| `testing/unit/composables/useVmMetrics.spec.ts` | **New.** Test rolling history |
| `testing/unit/components/VmCard.spec.ts` | **New.** Test metric bar rendering |

---

### M1.3 — Logs Viewer

**Problem**: No way to see VM logs from the dashboard.

**Solution**: Stream `journalctl` output for microvm units.

**Backend changes:**

| File | Change |
|---|---|
| `backend/src/services/logs.ts` | **New file.** `getVmLogs(name, lines?, since?)` runs `journalctl -u microvm@<name> --no-pager -n <lines>` |
| `backend/src/routes/vms.ts` | Add `GET /api/vms/:name/logs?lines=100&since=1h` |
| `backend/src/routes/ws.ts` | Add optional log streaming WS channel: `/ws/logs/:name` |

**Frontend changes:**

| File | Change |
|---|---|
| `src/pages/VmDetailPage.vue` | Replace placeholder Logs tab with real log viewer |
| `src/components/LogViewer.vue` | **New file.** Scrollable log output with auto-scroll, search/filter, timestamp display |
| `src/composables/useVmLogs.ts` | **New file.** Fetch logs via REST, optionally stream via WS |

**Tests:**

| File | Change |
|---|---|
| `backend/tests/services/logs.spec.ts` | **New.** Mock journalctl output |
| `testing/unit/components/LogViewer.spec.ts` | **New.** Test rendering, scroll, filter |

---

### M1.4 — Network Topology View

**Problem**: No visibility into VM networking. All networking is declared in Nix but invisible in the UI.

**Solution**: Read network info from systemd-networkd/ip commands and render as a topology graph.

**Backend changes:**

| File | Change |
|---|---|
| `backend/src/services/network.ts` | **New file.** `getNetworkTopology()` runs `ip addr show`, `bridge link show`, parses TAP interfaces, bridge membership, IP assignments |
| `backend/src/routes/network.ts` | **New file.** `GET /api/network/topology` returns nodes (host, bridge, VMs) and edges (TAP links) |
| `backend/src/index.ts` | Register network routes |

**Frontend changes:**

| File | Change |
|---|---|
| `src/pages/NetworkPage.vue` | **New page.** Topology graph showing host → bridge → VM connections with IPs |
| `src/components/NetworkGraph.vue` | **New file.** SVG or canvas graph (use `vue-flow` or custom SVG) |
| `src/router/routes.ts` | Add `/network` route |
| `src/layouts/MainLayout.vue` | Add Network link to sidebar/drawer |

**Tests:**

| File | Change |
|---|---|
| `backend/tests/services/network.spec.ts` | **New.** Mock `ip` command output |
| `testing/unit/pages/NetworkPage.spec.ts` | **New.** Test topology rendering |

---

### M1.5 — Community Templates (Read-Only Browser)

**Problem**: No templates exist. New VM creation requires writing Nix from scratch.

**Solution**: Bundle 5 built-in templates as JSON data, render in a browsable list with copy-to-clipboard.

**Backend changes:**

| File | Change |
|---|---|
| `backend/src/data/templates/` | **New directory.** JSON template files: `web-server.json`, `app-server.json`, `database.json`, `dev-env.json`, `minimal.json` |
| `backend/src/services/templates.ts` | **New file.** `listTemplates()`, `getTemplate(id)` — reads from bundled JSON |
| `backend/src/routes/templates.ts` | **New file.** `GET /api/templates`, `GET /api/templates/:id` |
| `backend/src/index.ts` | Register template routes |

**Template JSON schema:**

```typescript
interface VmTemplate {
  id: string;
  name: string;
  description: string;
  category: 'web' | 'app' | 'database' | 'dev' | 'minimal';
  icon: string; // MDI icon name
  defaults: {
    mem: number;
    vcpu: number;
    hypervisor: 'qemu' | 'firecracker' | 'cloud-hypervisor';
    services: string[]; // NixOS service names
    ports: number[];
    packages: string[]; // Nix package names
  };
  nixTemplate: string; // Nix expression template with ${placeholders}
}
```

**Frontend changes:**

| File | Change |
|---|---|
| `src/pages/TemplatesPage.vue` | **New page.** Grid of template cards with category filter |
| `src/components/TemplateCard.vue` | **New file.** Card showing template name, description, icon, defaults |
| `src/components/NixPreview.vue` | **New file.** Syntax-highlighted Nix code block with copy button |
| `src/router/routes.ts` | Add `/templates` route |
| `src/layouts/MainLayout.vue` | Add Templates link to sidebar |

**Tests:**

| File | Change |
|---|---|
| `backend/tests/services/templates.spec.ts` | **New.** Test template loading |
| `backend/tests/routes/templates.spec.ts` | **New.** Test API endpoints |
| `testing/unit/components/TemplateCard.spec.ts` | **New.** Test card rendering |
| `testing/unit/components/NixPreview.spec.ts` | **New.** Test syntax highlighting + copy |

---

### M1.6 — Polish & Developer Experience

| Task | File(s) | Change |
|---|---|---|
| Fix hardcoded CORS origin | `backend/src/index.ts` | Read from `CORS_ORIGIN` env var, default to `*` in dev |
| Add OpenAPI/Swagger docs | `backend/src/index.ts` | Add `@fastify/swagger` + `@fastify/swagger-ui` |
| Health check includes version | `backend/src/routes/health.ts` | Read version from `package.json` |
| Favicon + branding | `public/` | Replace default Quasar favicon |
| Error boundary | `src/App.vue` | Global Vue error handler with user-friendly message |
| Loading states | `src/pages/WorkbenchPage.vue` | Skeleton loaders while WS connects |
| Empty state | `src/pages/WorkbenchPage.vue` | Friendly message when no VMs discovered |

---

## M2: Template Editor (Unique Differentiator)

### M2.1 — Building Blocks Form

**Problem**: Templates from M1.5 are read-only. Users can't customize them.

**Solution**: Interactive form that generates Nix code from user selections.

**Frontend changes:**

| File | Change |
|---|---|
| `src/pages/CreateVmPage.vue` | **New page.** Split view: form (left), live Nix preview (right) |
| `src/components/builder/MemorySlider.vue` | **New.** Memory selection (256MB–4GB slider) |
| `src/components/builder/CpuSelector.vue` | **New.** vCPU count (1–8 dropdown) |
| `src/components/builder/HypervisorPicker.vue` | **New.** QEMU / Firecracker / Cloud Hypervisor radio buttons |
| `src/components/builder/NetworkConfig.vue` | **New.** Bridge selection, IP input, TAP interface toggle |
| `src/components/builder/ServiceToggles.vue` | **New.** Toggles for nginx, postgresql, openssh, nodejs, python, etc. |
| `src/components/builder/VmNameInput.vue` | **New.** VM name with validation (lowercase, hyphens, unique) |
| `src/components/builder/AutostartToggle.vue` | **New.** Autostart yes/no |
| `src/composables/useNixGenerator.ts` | **New.** Reactive Nix code generation from form state |
| `src/services/nix-generator.ts` | **New.** Pure function: `generateNixExpression(config: VmBuilderConfig): string` |
| `src/types/builder.ts` | **New.** `VmBuilderConfig` interface |
| `src/router/routes.ts` | Add `/create` route |
| `src/layouts/MainLayout.vue` | Add "Create VM" button in header/sidebar |

**The Nix generator** is the core logic. It takes structured config and outputs valid Nix:

```typescript
interface VmBuilderConfig {
  name: string;
  mem: number;
  vcpu: number;
  hypervisor: 'qemu' | 'firecracker' | 'cloud-hypervisor';
  network: {
    bridge: string;
    ip: string;
    mac?: string; // auto-generate if empty
  };
  autostart: boolean;
  services: string[];
  packages: string[];
  ports: number[];
  shares: { tag: string; hostPath: string; }[];
}
```

**Tests:**

| File | Change |
|---|---|
| `testing/unit/services/nix-generator.spec.ts` | **New.** Extensive tests for Nix output correctness |
| `testing/unit/composables/useNixGenerator.spec.ts` | **New.** Reactivity tests |
| `testing/unit/components/builder/*.spec.ts` | **New.** Component tests for each builder widget |
| `testing/e2e/create-vm.spec.ts` | **New.** E2E: fill form → verify Nix output → copy |

---

### M2.2 — Code Editor with Nix Syntax Highlighting

**Problem**: The Nix preview needs syntax highlighting and manual editing support.

**Solution**: Integrate CodeMirror 6 with Nix language support.

**Dependencies**: `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-nix` (or custom Lezer grammar)

| File | Change |
|---|---|
| `src/components/NixEditor.vue` | **New file.** CodeMirror 6 wrapper with Nix highlighting, read-only toggle, copy button |
| `src/pages/CreateVmPage.vue` | Replace `NixPreview` with `NixEditor` in split view |
| `package.json` | Add CodeMirror dependencies |

---

### M2.3 — Template Loading into Editor

**Problem**: Templates from M1.5 and the editor from M2.1 aren't connected.

**Solution**: "Use Template" button on TemplateCard loads template defaults into the builder form.

| File | Change |
|---|---|
| `src/components/TemplateCard.vue` | Add "Use Template" button |
| `src/pages/CreateVmPage.vue` | Accept `?template=<id>` query param; load template defaults into form state |
| `src/stores/builder-store.ts` | **New.** Pinia store for builder form state with `loadTemplate(id)` action |
| `src/pages/TemplatesPage.vue` | Route to `/create?template=<id>` on button click |

---

## M3: Pro Features

### M3.1 — n8n Deployment Pipeline Integration

**Problem**: Generated Nix code must be manually copy-pasted and applied. No automated deployment path.

**Solution**: POST generated Nix to n8n webhook for validated deployment.

**Backend changes:**

| File | Change |
|---|---|
| `backend/src/services/deploy.ts` | **New file.** `submitDeployment(nixCode, vmName, action)` POSTs to configured n8n webhook URL |
| `backend/src/routes/deploy.ts` | **New file.** `POST /api/deploy` — accepts Nix code + metadata, forwards to n8n, returns job ID |
| `backend/src/routes/deploy.ts` | `GET /api/deploy/:jobId` — poll n8n execution status |
| `backend/src/config/index.ts` | **New file.** Centralized config from env vars including `N8N_WEBHOOK_URL`, `N8N_API_KEY` |

**Frontend changes:**

| File | Change |
|---|---|
| `src/pages/CreateVmPage.vue` | Add "Deploy via n8n" button (alongside "Copy to Clipboard") |
| `src/components/DeployStatus.vue` | **New file.** Shows pipeline progress: validating → dry-run → approval → deploying → done |
| `src/composables/useDeployment.ts` | **New file.** Poll `/api/deploy/:jobId` for status updates |
| `src/pages/DeploymentsPage.vue` | **New page.** List of recent deployments with status |
| `src/router/routes.ts` | Add `/deployments` route |

**n8n workflow** (JSON template to include in repo):

| File | Change |
|---|---|
| `n8n/microvm-deploy.json` | **New file.** Importable n8n workflow: webhook → validate → dry-run → approval → git commit → rebuild → notify |
| `n8n/README.md` | **New file.** Setup instructions for n8n integration |

**Feature flag**: This entire feature is behind `FEATURE_N8N_DEPLOY=true` env var (Pro only).

**Tests:**

| File | Change |
|---|---|
| `backend/tests/services/deploy.spec.ts` | **New.** Mock n8n webhook calls |
| `backend/tests/routes/deploy.spec.ts` | **New.** Test deployment submission and status |

---

### M3.2 — Multi-User Authentication

**Problem**: Dashboard has no auth. Anyone with network access can start/stop VMs.

**Solution**: Add authentication middleware with local users (Community) and SSO/OIDC (Pro).

**Backend changes:**

| File | Change |
|---|---|
| `backend/src/middleware/auth.ts` | **New file.** Fastify plugin: JWT session validation, role extraction |
| `backend/src/services/auth.ts` | **New file.** `authenticate(username, password)`, `validateToken(jwt)`, `refreshToken()` |
| `backend/src/routes/auth.ts` | **New file.** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/refresh` |
| `backend/src/config/index.ts` | Add `AUTH_ENABLED`, `JWT_SECRET`, `OIDC_ISSUER`, `OIDC_CLIENT_ID` |
| `backend/src/index.ts` | Register auth plugin (skip for unauthenticated routes: health, static) |
| `backend/src/routes/vms.ts` | Add `preHandler: [requireAuth]` to mutating routes (start/stop/restart) |

**Community tier**: Single admin user with password from env var or config file.
**Pro tier**: OIDC/SSO via `fastify-openid-connect` or similar.

**Frontend changes:**

| File | Change |
|---|---|
| `src/pages/LoginPage.vue` | **New page.** Login form (username/password or "Login with SSO" button) |
| `src/stores/auth-store.ts` | **New.** Pinia store: `user`, `token`, `isAuthenticated`, `login()`, `logout()` |
| `src/router/guards.ts` | **New file.** Navigation guard: redirect to `/login` if not authenticated |
| `src/layouts/MainLayout.vue` | Add user avatar/menu in header with logout |
| `src/boot/auth.ts` | **New boot file.** Initialize auth state from stored JWT on app start |
| `src/services/api.ts` | Add Authorization header to all API requests |

**Tests:**

| File | Change |
|---|---|
| `backend/tests/middleware/auth.spec.ts` | **New.** JWT validation, expired token, invalid token |
| `backend/tests/routes/auth.spec.ts` | **New.** Login flow, token refresh |
| `testing/unit/stores/auth-store.spec.ts` | **New.** Login/logout state management |

---

### M3.3 — VM Console (noVNC)

**Problem**: No way to interact with a VM's console from the browser.

**Solution**: Proxy VM serial console or VNC via WebSocket to noVNC in the browser.

**Backend changes:**

| File | Change |
|---|---|
| `backend/src/services/console.ts` | **New file.** Opens PTY/socket to VM's serial console via `socat` or QEMU monitor socket |
| `backend/src/routes/console.ts` | **New file.** `WS /ws/console/:name` — bidirectional WebSocket proxying to VM console |
| `backend/src/index.ts` | Register console WS route |

**Frontend changes:**

| File | Change |
|---|---|
| `src/components/VmConsole.vue` | **New file.** Embeds `xterm.js` (for serial) or `@novnc/novnc` (for VNC) |
| `src/pages/VmDetailPage.vue` | Add Console tab that mounts `VmConsole` |
| `package.json` | Add `xterm`, `xterm-addon-fit`, `xterm-addon-web-links` (or `@novnc/novnc`) |

**NixOS changes:**

| File | Change |
|---|---|
| `nixos/default.nix` | Add sudo rules for socat/QEMU monitor access |
| VM definitions | Ensure QEMU VMs expose serial console or VNC socket |

**Feature flag**: Behind `FEATURE_CONSOLE=true` env var (Pro only).

---

### M3.4 — Audit Log

**Problem**: No record of who did what. Teams need accountability.

**Solution**: Log all mutating actions (start/stop/restart/deploy) with user, timestamp, and result.

**Backend changes:**

| File | Change |
|---|---|
| `backend/src/services/audit.ts` | **New file.** `logAction(user, action, target, result)` — writes to SQLite or JSON log |
| `backend/src/middleware/audit.ts` | **New file.** Fastify hook on mutating routes: records action after handler completes |
| `backend/src/routes/audit.ts` | **New file.** `GET /api/audit?limit=50&user=&action=` — query audit log |
| `backend/src/index.ts` | Register audit middleware and routes |

**Frontend changes:**

| File | Change |
|---|---|
| `src/pages/AuditPage.vue` | **New page.** Filterable table of audit events |
| `src/router/routes.ts` | Add `/audit` route |
| `src/layouts/MainLayout.vue` | Add Audit link to sidebar (Pro only) |

**Feature flag**: Behind `FEATURE_AUDIT=true` env var (Pro only).

---

## M4: SaaS & Scale

### M4.1 — Agent Protocol (for Hosted SaaS)

**Problem**: The hosted SaaS needs to communicate with the user's NixOS host without the user exposing ports.

**Solution**: A lightweight agent daemon that runs on the user's NixOS host and connects outbound to the SaaS.

**New package: `weaver-agent`**

| File | Change |
|---|---|
| `agent/src/index.ts` | **New.** Agent entry point: connects to cloud via WebSocket, authenticates with API key |
| `agent/src/tunnel.ts` | **New.** Maintains persistent outbound WS connection to cloud |
| `agent/src/commands.ts` | **New.** Handles commands from cloud: `list-vms`, `vm-action`, `get-metrics`, `get-logs`, `deploy` |
| `agent/src/config.ts` | **New.** Reads `CLOUD_URL`, `API_KEY` from env or config file |
| `agent/package.json` | **New.** Minimal Node.js package |
| `nixos/agent.nix` | **New.** NixOS module: `services.weaver-agent = { enable, cloudUrl, apiKey }` |

---

### M4.2 — Multi-Host Management

**Problem**: Dashboard manages only the local host.

**Solution**: Backend aggregates VM data from multiple hosts via agents or SSH.

**Backend changes:**

| File | Change |
|---|---|
| `backend/src/services/hosts.ts` | **New file.** `listHosts()`, `getHostVms(hostId)` — aggregates from multiple agent connections |
| `backend/src/routes/hosts.ts` | **New file.** `GET /api/hosts`, `GET /api/hosts/:id/vms` |
| `backend/src/routes/vms.ts` | Extend VM routes to accept `?host=` parameter |

**Frontend changes:**

| File | Change |
|---|---|
| `src/pages/HostsPage.vue` | **New page.** List of connected hosts with VM counts and status |
| `src/components/HostCard.vue` | **New file.** Host overview card |
| `src/stores/host-store.ts` | **New.** Pinia store for multi-host state |
| `src/pages/WorkbenchPage.vue` | Add host filter dropdown when multiple hosts exist |
| `src/router/routes.ts` | Add `/hosts` route |

---

### M4.3 — AI-Assisted VM Creation

**Problem**: Users must know what services/packages they need for their VM.

**Solution**: LLM generates Nix config from natural language description.

**Backend changes:**

| File | Change |
|---|---|
| `backend/src/services/ai.ts` | **New file.** `generateFromPrompt(description)` — calls Claude/OpenAI API with system prompt containing microvm.nix schema, returns Nix expression |
| `backend/src/routes/ai.ts` | **New file.** `POST /api/ai/generate` — accepts `{ prompt }`, returns `{ nixCode, explanation }` |
| `backend/src/config/index.ts` | Add `AI_API_KEY`, `AI_MODEL`, `AI_PROVIDER` |

**Frontend changes:**

| File | Change |
|---|---|
| `src/pages/CreateVmPage.vue` | Add "Describe your VM" text area with "Generate" button above the builder form |
| `src/components/AiPromptInput.vue` | **New file.** Text area with suggested prompts, loading state, error handling |
| `src/composables/useAiGenerate.ts` | **New.** Calls `/api/ai/generate`, loads result into builder store |

**Feature flag**: Behind `FEATURE_AI=true` env var (Pro only).

---

### M4.4 — Template-from-Source

**Problem**: Users can't generate VM templates from existing artifacts.

**Solution**: Backend analyzes source (Dockerfile, git repo, running VM) and generates template.

**Backend changes:**

| File | Change |
|---|---|
| `backend/src/services/source-detect.ts` | **New file.** `detectStack(path)` — scans directory for package.json, requirements.txt, Cargo.toml, go.mod, Dockerfile, etc. Returns `{ runtime, ports, packages, memory }` |
| `backend/src/services/dockerfile-parser.ts` | **New file.** Parses Dockerfile: extracts FROM (→ runtime), EXPOSE (→ ports), ENV, CMD |
| `backend/src/services/vm-to-template.ts` | **New file.** `extractTemplate(vmName)` — reads running VM's Nix config, parameterizes unique values |
| `backend/src/routes/templates.ts` | Add `POST /api/templates/from-source` — accepts `{ type: 'dockerfile'|'repo'|'vm', source }` |

**Frontend changes:**

| File | Change |
|---|---|
| `src/pages/TemplatesPage.vue` | Add "Create from Source" button |
| `src/components/SourceImportDialog.vue` | **New file.** Dialog with tabs: Dockerfile, Git Repo, Running VM. Each tab has input + "Analyze" button |
| `src/pages/CreateVmPage.vue` | Accept analyzed source as initial builder state |

**Feature flag**: Behind `FEATURE_SOURCE_IMPORT=true` env var (Pro only).

---

## Feature Flags Architecture

All Pro features use a simple env-var-based feature flag system:

| File | Change |
|---|---|
| `backend/src/config/features.ts` | **New file.** `isFeatureEnabled(name)` reads from env vars |
| `backend/src/index.ts` | Conditionally register Pro routes based on feature flags |
| `src/config/features.ts` | **New file.** Frontend feature flags fetched from `GET /api/config/features` |
| `backend/src/routes/config.ts` | **New file.** `GET /api/config/features` — returns enabled feature list |

```typescript
// backend/src/config/features.ts
export const features = {
  n8nDeploy: process.env.FEATURE_N8N_DEPLOY === 'true',
  console: process.env.FEATURE_CONSOLE === 'true',
  audit: process.env.FEATURE_AUDIT === 'true',
  ai: process.env.FEATURE_AI === 'true',
  sourceImport: process.env.FEATURE_SOURCE_IMPORT === 'true',
  multiHost: process.env.FEATURE_MULTI_HOST === 'true',
  auth: process.env.AUTH_ENABLED === 'true',
};
```

Community Edition ships with all flags `false` by default. Pro Edition ships with them `true`.

---

## R: Research Issues (Gap-Fillers)

These are investigation spikes — not implementation tickets. Each produces a findings document before any code is written.

### R1: Dynamic VM Discovery Methods

**Question**: What's the most reliable way to discover microvm.nix VMs at runtime?

**Research tasks:**
- Test `systemctl list-units 'microvm@*'` output format across NixOS versions
- Check if `/etc/microvm/` or `/var/lib/microvms/` exists with VM metadata
- Investigate whether `microvm.nix` exposes VM config via a JSON file or Nix eval
- Test with 0, 1, 5, 20+ VMs to verify performance
- Document how VM config (IP, memory, hypervisor) can be extracted at runtime

**Deliverable**: Findings doc with recommended approach and edge cases.

---

### R2: Per-VM Metrics Collection

**Question**: What metrics are available for microvm.nix VMs and how do we collect them?

**Research tasks:**
- Check if cgroup v2 stats are available under `/sys/fs/cgroup/machine.slice/microvm@*`
- Test `machinectl show` output for relevant metrics
- Investigate QEMU monitor socket for guest-level metrics
- Check Firecracker metrics endpoint (different from QEMU)
- Measure overhead of metric collection at 2s intervals with 20+ VMs
- Evaluate whether `systemd-cgtop` output is parseable

**Deliverable**: Findings doc with metric sources per hypervisor type.

---

### R3: VM Console Access Mechanisms

**Question**: How can we provide browser-based console access to microvm.nix VMs?

**Research tasks:**
- Determine if QEMU VMs expose VNC socket and where it's located
- Determine if QEMU VMs expose serial console and how to attach
- Check Firecracker console access (different mechanism)
- Check Cloud Hypervisor console access
- Evaluate noVNC vs xterm.js for the frontend
- Test WebSocket proxying latency and bandwidth requirements
- Document required NixOS/sudo permissions

**Deliverable**: Findings doc with recommended approach per hypervisor, security implications.

---

### R4: Nix Expression Parsing & Generation

**Question**: How do we reliably generate valid Nix expressions from TypeScript?

**Research tasks:**
- Evaluate template string approach vs AST-based generation
- Test `nix-instantiate --parse` for validation (is it fast enough for live preview?)
- Check if `nix eval` can validate expressions without building
- Investigate existing TypeScript Nix parsers/generators (if any)
- Determine the full set of microvm.nix options that need to be supported
- Test generated Nix against `nixos-rebuild dry-activate`

**Deliverable**: Findings doc with generator approach, validation strategy, and microvm.nix option coverage.

---

### R5: n8n Webhook Integration

**Question**: What's the exact n8n API contract for the deployment pipeline?

**Research tasks:**
- Test n8n webhook node response format and timing
- Determine how to poll n8n execution status (REST API? Execution ID?)
- Test n8n "Wait" node for approval gates — how does the callback work?
- Measure latency: dashboard POST → n8n execution → rebuild complete → callback
- Test error handling: what does n8n return when a workflow step fails?
- Create a minimal proof-of-concept workflow (webhook → shell command → respond)

**Deliverable**: Findings doc with API contract, sample workflow JSON, and timing measurements.

---

### R6: Multi-Host Communication

**Question**: How should the dashboard communicate with remote NixOS hosts?

**Research tasks:**
- Evaluate agent-based (outbound WS from host) vs SSH-based (dashboard connects to host) approaches
- Test Colmena's API/CLI for remote NixOS deployment
- Test deploy-rs as an alternative
- Investigate NixOS's built-in `nixos-rebuild --target-host` for remote rebuilds
- Evaluate WireGuard tunnel vs SSH tunnel for agent communication
- Assess security model: key exchange, authentication, authorization

**Deliverable**: Findings doc with recommended architecture, security model, and proof-of-concept.

---

### R7: CodeMirror Nix Language Support

**Question**: What's the current state of Nix syntax highlighting in CodeMirror 6?

**Research tasks:**
- Check if `@codemirror/lang-nix` exists or if a Lezer grammar is needed
- Evaluate alternative: Monaco Editor with Nix support
- Test performance of live syntax highlighting during typing
- Check if Nix LSP (nil, nixd) can provide completions via WASM or API

**Deliverable**: Findings doc with recommended editor, setup steps, and any custom grammar work needed.

---

### R8: Dockerfile-to-Nix Translation

**Question**: How accurately can we translate Dockerfiles to Nix VM definitions?

**Research tasks:**
- Map common Dockerfile instructions to Nix equivalents: FROM → packages, EXPOSE → firewall, ENV → environment, RUN → build steps
- Catalog the 20 most common Docker base images and their Nix package equivalents
- Test with real-world Dockerfiles (Node.js app, Python Flask, Go binary, PostgreSQL)
- Identify untranslatable patterns and how to handle them (warn user, add TODO comments)
- Investigate `dockerfile2nix` or similar existing tools

**Deliverable**: Findings doc with translation map, coverage estimate, and sample outputs.

---

### R9: SaaS Agent Security Model

**Question**: How do we securely connect a user's NixOS host to a hosted SaaS instance?

**Research tasks:**
- Evaluate WireGuard tunnel (host → cloud) with API key authentication
- Evaluate WebSocket with mutual TLS
- Study how Grafana Agent, Portainer Edge Agent, and Netdata Agent handle this
- Define threat model: what happens if the cloud is compromised? Can it harm the host?
- Design permission model: what can the cloud ask the agent to do?
- Evaluate NixOS-native secrets management (sops-nix, agenix) for API key storage

**Deliverable**: Security design doc with threat model, protocol specification, and NixOS module design.

---

### R10: Community Template Distribution

**Question**: What's the best mechanism for sharing and discovering VM templates?

**Research tasks:**
- Evaluate GitHub repo with PR-based contributions (like awesome-nix)
- Evaluate FlakeHub for template distribution as flake outputs
- Evaluate NUR integration (already used for the dashboard package)
- Design template metadata format for discoverability (tags, categories, ratings)
- Research how Proxmox turnkey templates and Docker Hub handle discovery/trust

**Deliverable**: Findings doc with recommended distribution model and template registry design.

---

### R11: LLM Nix Generation Quality

**Question**: How well can current LLMs generate valid microvm.nix expressions?

**Research tasks:**
- Test Claude, GPT-4, and open models with 20 VM description prompts
- Measure: % syntactically valid, % that pass `nix-instantiate --parse`, % that build successfully
- Design system prompt with microvm.nix schema, examples, and constraints
- Test few-shot prompting with template examples
- Estimate API costs per generation at various model tiers
- Evaluate local models (Ollama) for self-hosted Pro tier

**Deliverable**: Findings doc with prompt engineering recommendations, accuracy benchmarks, and cost estimates.

---

## Issue Tracker Summary

### Implementation Issues (by milestone)

| # | Title | Milestone | Effort | Dependencies |
|---|---|---|---|---|
| 1 | Dynamic VM discovery from systemd | M1 | Medium | None |
| 2 | CPU/memory metrics per VM | M1 | Medium | R2 |
| 3 | Logs viewer (journalctl) | M1 | Low–Medium | #1 |
| 4 | Network topology visualization | M1 | Medium | #1 |
| 5 | Built-in template browser (5 templates) | M1 | Low | None |
| 6 | Polish: OpenAPI docs, loading states, empty states | M1 | Low | None |
| 7 | Building blocks form + Nix generator | M2 | Medium–High | R4, #5 |
| 8 | Code editor with Nix syntax highlighting | M2 | Medium | R7 |
| 9 | Template loading into editor | M2 | Low | #5, #7 |
| 10 | n8n deployment pipeline integration | M3 | Medium | R5 |
| 11 | Multi-user authentication | M3 | Medium | None |
| 12 | VM console (noVNC/xterm.js) | M3 | High | R3 |
| 13 | Audit log | M3 | Low–Medium | #11 |
| 14 | Feature flags architecture | M3 | Low | None |
| 15 | Agent protocol + NixOS module | M4 | High | R6, R9 |
| 16 | Multi-host management | M4 | High | #15 |
| 17 | AI-assisted VM creation | M4 | Medium | R11, #7 |
| 18 | Template-from-source (Docker/Git/VM) | M4 | Medium–High | R8, #7 |

### Research Issues

| # | Title | Blocks | Effort |
|---|---|---|---|
| R1 | Dynamic VM discovery methods | #1 | Low |
| R2 | Per-VM metrics collection | #2 | Low |
| R3 | VM console access mechanisms | #12 | Medium |
| R4 | Nix expression parsing & generation | #7 | Medium |
| R5 | n8n webhook integration | #10 | Low |
| R6 | Multi-host communication | #15, #16 | Medium |
| R7 | CodeMirror Nix language support | #8 | Low |
| R8 | Dockerfile-to-Nix translation | #18 | Medium |
| R9 | SaaS agent security model | #15 | Medium |
| R10 | Community template distribution | #5 | Low |
| R11 | LLM Nix generation quality | #17 | Medium |
