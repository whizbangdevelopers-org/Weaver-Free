<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v7b-2-creation-frontend — Container Creation + Images + Frontend

**Priority:** High #2b
**Tier:** Weaver (creation, images, actions UI)
**Plan:** [EXECUTION-ROADMAP](../../plans/v1.2.0/EXECUTION-ROADMAP.md) (Phase 7b)
**Parent:** [v7-container-management.md](v7-container-management.md) (sub-agent 2 of 3)
**Parallelizable:** No (depends on v7b-1-runtime-actions)
**Blocks:** v7b-3-governance-testing

---

## Scope

Build the container creation flow end-to-end and wire frontend to backend actions from 7b-1. Implement the creation endpoint with Zod validation, image registry endpoints, `CreateContainerDialog` with runtime selector and GPU toggle, action buttons on container cards, and image cache management UI in settings.

### What's Already Done

<!-- MANDATORY: Scan the actual codebase before filling this in. Prior specs may be stale. -->
<!-- Run the e2e-test-writer pre-flight and grep for relevant files. Trust what you see, not prior specs. -->

- All runtime adapter actions implemented (7b-1): start/stop/restart/remove, SIF pull/build, GPU, Docker create
- Action endpoints wired: `POST /api/containers/:id/{start,stop,restart}`, `DELETE /api/containers/:id`
- Container cards and detail page (7a) — read-only
- `CreateVmDialog` pattern to follow for container creation
- Container store with WebSocket-driven state (7a)

### What's Missing

- `POST /api/containers` endpoint — creation with full config (runtime, image, ports, volumes, env, GPU)
- Image registry endpoints: `GET /api/images`, `POST /api/images/pull`, `DELETE /api/images/:id`
- `CreateContainerDialog.vue` — runtime selector, GPU toggle, resource limits, image picker
- Container action buttons on `ContainerCard.vue` (start/stop/restart/remove)
- Confirmation dialogs for destructive actions (remove)
- Image cache management section in `SettingsPage.vue`

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/routes/containers.ts` | Container routes to extend with POST creation + image routes |
| `backend/src/services/container-runtime.ts` | Updated interface from 7b-1 — `create()`, `pullImage()` methods |
| `backend/src/services/container-registry.ts` | Registry — dispatch creation to correct adapter |
| `backend/src/schemas/containers.ts` | Existing Zod schemas to extend with creation schema |
| `backend/src/config.ts` | Tier gating — `requireTier('premium')` |
| `src/components/CreateVmDialog.vue` | Creation dialog pattern to follow |
| `src/components/ContainerCard.vue` | Card to add action buttons to |
| `src/stores/container-store.ts` | Store to add creation/action methods to |
| `src/services/container-api.ts` | API service to extend with creation/action calls |
| `src/pages/SettingsPage.vue` | Settings page to add image cache section to |

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/routes/containers.ts` | Modify | Add `POST /api/containers` creation endpoint |
| `backend/src/routes/images.ts` | New | Image registry routes: list, pull, delete |
| `backend/src/schemas/containers.ts` | Modify | Add creation schema, image schemas |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/components/CreateContainerDialog.vue` | New | Runtime selector, GPU toggle, resource limits, image picker |
| `src/components/ContainerCard.vue` | Modify | Add action buttons (start/stop/restart/remove) + confirmations |
| `src/pages/SettingsPage.vue` | Modify | Add image cache management section |
| `src/stores/container-store.ts` | Modify | Add create/action/image methods |
| `src/services/container-api.ts` | Modify | Add creation, action, image API calls |

### Tests

| File | Type | Description |
|------|------|-------------|
| `testing/unit/container-creation.test.ts` | New | Unit tests for creation endpoint + image endpoints |

---

## CRUD Completeness Check

| Operation | Needed? | Covered by |
|-----------|---------|------------|
| **Create** | Yes | `POST /api/containers` + `CreateContainerDialog` |
| **Read** (list) | No — exists from 7a | — |
| **Read** (single) | No — exists from 7a | — |
| **Update** (actions) | Frontend wiring only | Action buttons on `ContainerCard` → action endpoints from 7b-1 |
| **Delete** | Frontend wiring only | Remove button on `ContainerCard` → `DELETE` endpoint from 7b-1 |
| **Undo/Clear** | N/A | — |

---

## All Endpoints Affected

| Endpoint | Impact |
|----------|--------|
| `POST /api/containers` | **New** — create container with full config |
| `GET /api/images` | **New** — list cached images across runtimes |
| `POST /api/images/pull` | **New** — pull image from registry with progress |
| `DELETE /api/images/:id` | **New** — remove cached image |

**Not affected:** Action endpoints from 7b-1 (already exist), 7a GET endpoints, VM endpoints, agent endpoints, WebSocket.

---

## CreateContainerDialog Design

```
┌─────────────────────────────────────────┐
│ Create Container                    [X] │
├─────────────────────────────────────────┤
│ Runtime: [Apptainer ▼] [Docker] [Podman]│
│                                         │
│ Image: [_________________________] [🔍] │
│   └ Browse cached images or enter ref   │
│                                         │
│ Name:  [_________________________]      │
│                                         │
│ ─── Resources ───                       │
│ CPU Limit:    [_____] cores             │
│ Memory Limit: [_____] MB               │
│ □ GPU Passthrough  [NVIDIA ▼]           │
│   (Apptainer only, greyed if no GPU)    │
│                                         │
│ ─── Volumes ───                         │
│ /host/path → /container/path  [+ Add]   │
│                                         │
│ ─── Environment ───  (Docker/Podman)    │
│ KEY=VALUE                     [+ Add]   │
│                                         │
│ ─── Ports ───  (Docker/Podman)          │
│ Host:Container                [+ Add]   │
│                                         │
│              [Cancel] [Create]          │
└─────────────────────────────────────────┘
```

**Runtime-dependent sections:**
- Apptainer: GPU toggle, bind mounts, overlays. No ports/env (handled by SIF).
- Docker/Podman: Ports, volumes, env vars. No GPU toggle.

---

## Flow Notes

Creation: User clicks "+" button → `CreateContainerDialog` opens → selects runtime → fills config → `POST /api/containers` → route checks `requireTier('premium')` → dispatches to `registry.get(runtime).create(config)` → adapter executes → container appears in WebSocket broadcast.
Image pull: User clicks image browse → `GET /api/images` lists cached → "Pull new" triggers `POST /api/images/pull` → progress streamed → image appears in cache → selectable in dialog.
Card actions: User clicks action button on `ContainerCard` → confirmation for destructive (remove) → `POST /api/containers/:id/{action}` (7b-1 endpoints) → status updates via WebSocket.
Settings cache: User navigates to Settings → image cache section → `GET /api/images` → list with size → "Prune" triggers `DELETE /api/images/:id`.

---

## Safety Rules

1. Container creation must validate all inputs via Zod — reject invalid port mappings, empty image refs, malformed volume paths
2. Image pull progress must be cancelable — user can abort long pulls
3. Remove action on card requires confirmation dialog — user types container name to confirm
4. CreateContainerDialog must disable GPU toggle if no GPU detected (greyed out with tooltip)
5. Image cache deletion must not remove images used by running containers — check before delete

---

## Acceptance Criteria

1. `CreateContainerDialog` opens, shows runtime selector with Apptainer/Docker/Podman
2. Runtime selection changes visible form fields (GPU for Apptainer, ports/env for Docker)
3. Creating a container via dialog results in new container appearing on dashboard
4. Image browse shows cached images; pull new image works with progress
5. Action buttons on `ContainerCard` work: start, stop, restart, remove
6. Remove confirmation requires typing container name
7. Settings page shows image cache with sizes and prune action
8. All creation/image endpoints require weaver tier (403 on free)
9. Unit tests pass for creation and image endpoints
10. `npm run test:precommit` passes

---

## Tier Blind Spot Mitigation

**All features are Weaver-only.** Standard dev/E2E runs at weaver.

**No blind spot** — all features testable in standard E2E environment.

---

## E2E Notes

- **Partial E2E possible:** Container creation via Docker can be tested end-to-end (Docker socket available)
- **Temp resources:** MUST create test containers with unique names (`test-7b2-*`) and clean up in afterAll
- **Image pull:** Can pull small test images (e.g., `alpine:latest`) in E2E — clean up pulled images in afterAll
- **Apptainer/Podman:** Dialog rendering testable, but actual creation only via Docker path in E2E
- **Full E2E coverage deferred to 7b-3** — this sub-agent focuses on unit tests + partial E2E for critical paths

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| Container creation endpoint + Zod schemas | 1 day |
| Image registry endpoints (list, pull, delete) | 1 day |
| CreateContainerDialog (runtime selector, GPU, resources, volumes, ports, env) | 2 days |
| Card action buttons + confirmation dialogs | 1 day |
| Settings: image cache management section | 0.5 days |
| Unit tests for creation + image endpoints | 0.5 days |
| **Total** | **~6 days** |

---

## Documentation

| Target | Updates |
|--------|----------|
| None in this sub-agent | Documentation deferred to 7b-3 (covers all 3 sub-agents) |
