<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v7-container-visibility — Container Runtime Visibility

**Priority:** High #1
**Tier:** Weaver Free (Docker, Podman) / Weaver (+ Apptainer) / Demo (mock)
**Plan:** [EXECUTION-ROADMAP](../../plans/v1.1.0/EXECUTION-ROADMAP.md) (Phase 7a)
**Parallelizable:** Yes (no dependencies beyond v1.0)
**Blocks:** v7b-1-runtime-actions, v7-cross-resource-agent

---

## Scope

Implement read-only container awareness alongside existing VM management. Docker + Podman are free-tier adoption attractors — build the `ContainerRuntime` adapter interface, implement Docker/Podman/Apptainer runtimes, add container discovery API, extend WebSocket status broadcasts, and create frontend container cards and detail page. Docker and Podman visibility are free; Apptainer is weaver-gated targeting institutional HPC/research buyers.

> **Strategic context:** This is the soft entry for container support. No competing dashboard exists for Apptainer users. The goal is to prove demand with read-only visibility before shipping full management in Phase 7b (the closer).

### What's Already Done

> **⚠ Codebase scan required** — Read the actual files before starting. This section was last updated 2026-03-20. Run the pre-flight codebase scan (see template Pre-Flight section) to verify current state.

**Container scan + dispatch (in `microvm.ts` / `/api/vms`):**
- `scanContainers(runtime: 'docker' | 'podman')` — runs `docker/podman ps -a --format '{{json .}}'`, parses JSON lines, registers in VM registry. Gracefully returns empty if binary not installed. Runs in parallel with `scanMicrovms()` on `POST /api/vms/scan`.
- `isContainerDef(def)` — type guard checking `def.runtime === 'docker' || 'podman'`
- `getContainerBin(runtime)` — resolves binary path from config (`DOCKER_BIN`/`PODMAN_BIN` env, defaults to `docker`/`podman`)
- Container dispatch wired in: `getVmStatus()`, `getVmUptime()`, `startVm()`, `stopVm()`, `restartVm()`
- `runtime`, `containerId`, `image`, `ports` fields added to `VmDefinition` (vm-registry.ts) and `VmInfo` (microvm.ts + src/types/vm.ts)
- `dockerBin`/`podmanBin` in `DashboardConfig` (config.ts) with env var resolution

**Backend unit tests (microvm.spec.ts):**
- 29 new tests covering container dispatch and `scanContainers()` — all passing
- "Container dispatch" describe block: getVmStatus/getVmUptime/startVm/stopVm/restartVm routing
- "scanContainers" describe block: docker/podman scan, JSON parsing, deduplication, binary-not-found

**E2E tests:**
- `testing/e2e/container-workloads.spec.ts` — registration, field preservation, action dispatch shape, Weaver card rendering, deletion
- `testing/e2e/vm-scan.spec.ts` — updated to cover combined docker+podman+microvm scan + empty-state UI

**Architectural note — conflict with this agent's plan:** The above work embedded containers directly into `microvm.ts` and `/api/vms` routes (treating containers as VM-like workloads). This agent's plan calls for a separate `ContainerRuntime` adapter interface with `/api/containers` routes. **Before implementing the adapter interface and new routes, reconcile this conflict.** Options: (a) keep `/api/vms` as the unified workload API and rename the adapter pattern to work within it, or (b) implement `/api/containers` as a separate read-only view and migrate container workloads.

**Existing infrastructure (unchanged):**
- Fastify backend with route plugin + dependency injection pattern
- Adapter interfaces to mirror (`LlmProvider`, `VmRegistry`, `SessionStore`)
- WebSocket broadcast on `/ws/status` (vm-status messages)
- Pinia stores with WebSocket-driven state (`vm-store.ts`)
- NixOS module with tier-aware configuration
- Mock service pattern for demo mode (`mock-agent.ts`)

### What's Missing

- `ContainerRuntime` adapter interface and registry
- Apptainer, Docker, Podman, and Mock runtime implementations
- Container routes (`/api/containers`, `/api/runtimes`)
- WebSocket `container-status` broadcast type
- Frontend: container types, store, API service, cards, detail page
- Weaver integration (mixed VM + container cards in Infrastructure section)
- NixOS `containerRuntimes` option

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/services/llm-provider.ts` | Adapter interface pattern to mirror (`LlmProvider` → `ContainerRuntime`) |
| `backend/src/storage/index.ts` | Factory/registry pattern to mirror (`createRegistry` → `ContainerRuntimeRegistry`) |
| `backend/src/services/microvm.ts` | VM service layer — understand parallel structure for containers |
| `backend/src/routes/vms.ts` | Route plugin pattern to follow for `/api/containers` |
| `backend/src/index.ts` | Service initialization and route registration (injection pattern) |
| `backend/src/config.ts` | Tier gating pattern (`requireTier`, `config.tier`) |
| `backend/src/schemas/agent.ts` | Zod schema pattern for new endpoints |
| `src/stores/vm-store.ts` | Pinia store pattern with WebSocket-driven state |
| `src/components/VmCard.vue` | Card component pattern to follow for `ContainerCard` |
| `src/pages/VmDetailPage.vue` | Detail page pattern to follow for container detail |
| `src/services/api.ts` | Frontend API service pattern (`ApiService` base class) |
| `src/types/vm.ts` | Type definition pattern for container types |
| `backend/src/services/mock-agent.ts` | Mock service pattern for demo mode containers |
| `nixos/default.nix` | NixOS module to extend with `containerRuntimes` option |

---

## Outputs

### Backend

| Deliverable | Path |
|------------|------|
| `ContainerRuntime` interface | `backend/src/services/container-runtime.ts` |
| `ContainerRuntimeRegistry` | `backend/src/services/container-registry.ts` |
| `ApptainerRuntime` implementation | `backend/src/services/runtimes/apptainer.ts` |
| `DockerRuntime` implementation | `backend/src/services/runtimes/docker.ts` |
| `PodmanRuntime` implementation | `backend/src/services/runtimes/podman.ts` |
| Mock container service (demo mode) | `backend/src/services/runtimes/mock.ts` |
| Container routes (`/api/containers`) | `backend/src/routes/containers.ts` |
| Container Zod schemas | `backend/src/schemas/containers.ts` |
| WebSocket `container-status` broadcast | Update `backend/src/routes/ws.ts` |
| Runtime initialization + injection | Update `backend/src/index.ts` |

### Frontend

| Deliverable | Path |
|------------|------|
| Container types | `src/types/container.ts` |
| Container API service | `src/services/container-api.ts` |
| Container Pinia store | `src/stores/container-store.ts` |
| `ContainerCard` component | `src/components/ContainerCard.vue` |
| `ContainerStatusBadge` component | `src/components/ContainerStatusBadge.vue` |
| `RuntimeBadge` component | `src/components/RuntimeBadge.vue` |
| Container detail page | `src/pages/ContainerDetailPage.vue` |
| Weaver integration (mixed VM + container cards) | Update `src/pages/WorkbenchPage.vue` |
| Container route | Update `src/router/routes.ts` |

### NixOS

| Deliverable | Path |
|------------|------|
| `containerRuntimes` option | Update `nixos/default.nix` |

### Testing

| Deliverable | Path |
|------------|------|
| Backend unit tests for runtime adapters | `testing/unit/container-runtime.test.ts` |
| E2E specs for container visibility | `testing/e2e/containers.spec.ts` |

### Documentation

| Deliverable | Path |
|------------|------|
| Developer guide updates (container architecture) | `docs/DEVELOPER-GUIDE.md` |
| Help page container FAQ section | `src/pages/HelpPage.vue` |
| LESSONS-LEARNED container patterns | `docs/development/LESSONS-LEARNED.md` |

---

## CRUD Completeness Check

| Operation | Needed? | Covered by |
|-----------|---------|------------|
| **Create** | No — deferred to Phase 7b (v7b-2-creation-frontend) | — |
| **Read** (list) | Yes | `GET /api/containers` + `ContainerCard` on WorkbenchPage |
| **Read** (single) | Yes | `GET /api/containers/:id` + `ContainerDetailPage` |
| **Update** | No — deferred to Phase 7b | — |
| **Delete** | No — deferred to Phase 7b | — |
| **Undo/Clear** | N/A — read-only phase | — |

---

## All Endpoints Affected

| Endpoint | Impact |
|----------|--------|
| `GET /api/containers` | **New** — list all containers across runtimes, tier-filtered |
| `GET /api/containers/:id` | **New** — single container details |
| `GET /api/containers/:id/logs` | **New** — container log output |
| `GET /api/runtimes` | **New** — list available runtimes on this host |
| `WS /ws/status` | **Add event type** — `container-status` broadcast alongside `vm-status` |

**Not affected:** All existing VM endpoints (`/api/vms/*`), agent endpoints (`/api/vms/:name/agent`), user/audit/health endpoints. Container routes are additive — no modifications to existing routes.

---

## Interface Design

### ContainerRuntime

```typescript
export interface ContainerInfo {
  id: string
  name: string
  image: string
  status: 'running' | 'stopped' | 'failed' | 'unknown'
  runtime: 'apptainer' | 'docker' | 'podman'
  pid?: number
  startedAt?: string
  resources?: { memoryMB: number; cpuPercent: number }
  binds?: string[]
  gpuEnabled?: boolean
}

export interface ContainerRuntime {
  readonly name: string
  available(): Promise<boolean>
  list(): Promise<ContainerInfo[]>
  inspect(id: string): Promise<ContainerInfo | null>
  logs(id: string, tail?: number): Promise<string>
  // start/stop defined here but only wired in Phase 7b
  start(id: string): Promise<ActionResult>
  stop(id: string): Promise<ActionResult>
}
```

### ContainerRuntimeRegistry

```typescript
export class ContainerRuntimeRegistry {
  register(runtime: ContainerRuntime): void
  async detectAvailable(): Promise<ContainerRuntime[]>
  async listAll(): Promise<ContainerInfo[]>
  get(name: string): ContainerRuntime | undefined
}
```

### WebSocket Extension

```json
{
  "type": "container-status",
  "data": [{ "name": "...", "image": "...", "status": "running", "runtime": "apptainer" }],
  "timestamp": "..."
}
```

### API Endpoints

| Method | Endpoint | Tier | Description |
|--------|----------|------|-------------|
| GET | `/api/containers` | Free | List all containers across available runtimes |
| GET | `/api/containers/:id` | Free | Get single container details |
| GET | `/api/containers/:id/logs` | Free | Get container logs |
| GET | `/api/runtimes` | Free | List available runtimes on this host |

---

## Tier Gating

| Feature | Demo | Weaver Free | Weaver |
|---------|------|------|---------|
| Docker visibility | Mock data | Read-only | Read-only |
| Podman visibility | Mock data | Read-only | Read-only |
| Apptainer visibility | Mock data | — | Read-only |
| Container actions (start/stop) | — | — | Phase 7b |

---

## Phase Chain

| Phase | Agent | Delivers | Status |
|-------|-------|----------|--------|
| 7a | v7-container-visibility (this) | Read-only container awareness, adapter interface, types, cards, detail page | TODO |
| 7b | v7-container-management | Full CRUD, actions, creation dialog, RBAC, bulk ops | TODO |
| 7c | v7-cross-resource-agent | Cross-resource AI, topology view, unified search | TODO |

---

## Flow Notes

Backend: `ContainerRuntimeRegistry.detectAvailable()` on startup → registers adapters for installed runtimes.
API: `GET /api/containers` → registry.listAll() aggregates across all adapters → returns ContainerInfo[] with runtime badge.
WebSocket: ws.ts polling loop adds `container-status` broadcast alongside `vm-status` every 2 seconds.
Frontend: container-store receives WebSocket updates → ContainerCard components render reactively on WorkbenchPage.
Tier gate: Docker/Podman adapters free (adoption attractor). Apptainer adapter gated at weaver (HPC/institutional buyers). Demo mode uses mock adapter.

---

## Safety Rules

1. Adapter failures must not crash the main service — if Docker socket is unavailable, skip Docker, log warning, continue with other runtimes
2. Container IDs from different runtimes may collide — use `{runtime}:{id}` as composite key
3. Mock adapter must never execute real runtime commands — verify in unit tests
4. WebSocket broadcast must not leak Apptainer container data to free-tier users who haven't upgraded to weaver

---

## Tier Blind Spot Mitigation

**Features span Free and Weaver tiers.** Standard dev/E2E runs at weaver.

**Mitigation:**
- Docker/Podman visibility (free) testable in E2E — Docker is available in E2E Docker environment
- Apptainer visibility (premium) testable in E2E if Apptainer is in Docker image, otherwise via mock adapter
- Weaver-tier gate: unit tests verify Apptainer endpoints return 403 on free tier
- Demo mode: unit tests verify mock adapter returns canned data
- Runtime detection: unit tests with mocked filesystem/socket checks

---

## E2E Notes

- **Runtime availability:** E2E Docker has Docker socket available. Apptainer may not be installed — tests must handle "runtime not available" gracefully or use mock adapter. Podman tests may require explicit socket setup in the E2E environment.
- **Temp resources:** Container visibility is read-only — no shared state risk from reading existing containers
- **Environment gaps:** If E2E Docker doesn't have containers running, the container list will be empty. Consider starting a test container in beforeAll and removing in afterAll
- **Mock mode:** If no runtimes available, E2E should verify mock adapter path (demo mode containers appear)

---

## Acceptance Criteria

1. `ContainerRuntime` interface implemented with Apptainer, Docker, Podman, and Mock adapters
2. Runtime auto-detection correctly identifies installed runtimes
3. `ContainerRuntimeRegistry` aggregates containers across all available runtimes
4. `/api/containers` returns containers with runtime badge
5. WebSocket broadcasts `container-status` messages alongside `vm-status`
6. Weaver shows `ContainerCard` components intermixed with VM cards in the Infrastructure section
7. Container detail page shows inspect data, logs, bind mounts, resource usage
8. `container-store` updates reactively via WebSocket
9. Demo mode shows mock container data
10. Apptainer visibility is weaver-gated; returns 403 on free tier. Docker and Podman are accessible at free tier.
11. NixOS module accepts `containerRuntimes` option
12. E2E specs pass for container visibility flows
13. All documentation updated (developer guide, help page, lessons learned)

---

## Estimated Effort

| Area | Duration |
|------|----------|
| ContainerRuntime interface + registry | 0.5 days |
| Apptainer adapter | 1 day |
| Docker adapter | 1 day |
| Podman adapter | 0.5 days (Podman API is Docker-compatible) |
| Mock adapter + demo data | 0.5 days |
| Backend routes + schemas + WebSocket | 1 day |
| Frontend store + cards + detail page | 2 days |
| NixOS module updates | 0.5 days |
| E2E specs + unit tests | 1 day |
| Documentation | 0.5 days |
| **Total** | **~8-9 days** |

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Container architecture section: adapter interface, registry, runtime detection, WebSocket extension |
| `src/pages/HelpPage.vue` | Container visibility FAQ: supported runtimes, tier availability, how containers appear on dashboard |
| `docs/development/LESSONS-LEARNED.md` | Adapter pattern quality, mock data approach, WebSocket message type extension |
| `CLAUDE.md` | Add container API endpoints to API table, add `container-status` WebSocket message type |
