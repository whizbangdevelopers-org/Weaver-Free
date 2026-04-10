<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v7b-1-runtime-actions — Container Runtime Actions

**Priority:** High #2a
**Tier:** Weaver (all actions)
**Plan:** [EXECUTION-ROADMAP](../../plans/v1.2.0/EXECUTION-ROADMAP.md) (Phase 7b)
**Parent:** [v7-container-management.md](v7-container-management.md) (sub-agent 1 of 3)
**Parallelizable:** No (depends on v7-container-visibility)
**Blocks:** v7b-2-creation-frontend

---

## Scope

Extend the Phase 7a adapter interface with full action implementations. Implement start/stop/restart for all runtimes, SIF pull/build for Apptainer, GPU passthrough, bind mounts, overlays, and Docker/Podman container lifecycle. Wire action endpoints on existing container routes. Pure backend — no frontend changes, no governance layer.

### What's Already Done

> **⚠ Codebase scan required** — Read the actual files before starting. This section was last updated 2026-03-20. Run the pre-flight codebase scan to verify what v1.1.0 actually shipped — it may differ from the plan below.

**What was implemented in the v1.0→v1.1 window (before v1.1.0 formal execution):**
- Docker/Podman start/stop/restart dispatch is **already implemented** in `backend/src/services/microvm.ts`:
  - `startVm()`, `stopVm()`, `restartVm()` all check `isContainerDef(def)` and execute `docker/podman start/stop/restart <name>` via `execFileAsync`
  - These are wired to the existing `/api/vms/:name/{start,stop,restart}` endpoints — **not** `/api/containers`
- `scanContainers(runtime)` discovers and registers containers via `ps -a --format '{{json .}}'`
- 29 unit tests covering all container action dispatch paths

**What this agent's plan assumes from v1.1.0 (verify before starting):**
- `ContainerRuntime` interface with `start()`/`stop()` method signatures — **may not exist** (containers were embedded in microvm.ts instead)
- `ContainerRuntimeRegistry` aggregating all adapters — **may not exist**
- `ApptainerRuntime`, `DockerRuntime`, `PodmanRuntime` adapter files — **may not exist**
- Container routes at `/api/containers` — **may not exist** (containers served via `/api/vms` instead)
- WebSocket `container-status` broadcast — **may not exist**

**Architectural decision required before starting this agent:** v1.1 implementation embedded containers in microvm.ts/vm-registry.ts using the VM workload pattern. This sub-agent was written assuming a separate ContainerRuntime adapter interface. Resolve which architecture wins before writing any code. See the conflict note in `container-visibility.md` "What's Already Done".

**Always present:**
- VM action endpoint pattern in `backend/src/routes/vms.ts`

### What's Missing

- Apptainer action implementations: `start()`, `stop()`, `restart()`, SIF pull, SIF build, GPU flags, bind mounts, overlays
- Docker action implementations: `start()`, `stop()`, `restart()`, `remove()`, image pull, container create, volumes, env vars
- Podman action implementations: inherit from Docker (API-compatible)
- Action endpoints: `POST /api/containers/:id/{start,stop,restart}`, `DELETE /api/containers/:id`
- Zod schemas for action request/response
- Unit tests for all runtime actions

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/services/container-runtime.ts` | Interface to implement — `start()`, `stop()` signatures |
| `backend/src/services/container-registry.ts` | Registry to dispatch actions through |
| `backend/src/services/runtimes/apptainer.ts` | Apptainer adapter — add action methods |
| `backend/src/services/runtimes/docker.ts` | Docker adapter — add action methods |
| `backend/src/services/runtimes/podman.ts` | Podman adapter — add action methods |
| `backend/src/routes/containers.ts` | Container routes to extend with action endpoints |
| `backend/src/routes/vms.ts` | VM action pattern (start/stop/restart) to mirror |
| `backend/src/config.ts` | Tier gating — `requireTier('premium')` |
| `backend/src/schemas/agent.ts` | Zod schema pattern for action endpoints |

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/services/runtimes/apptainer.ts` | Modify | Add start/stop/restart, SIF pull/build, GPU, binds, overlays |
| `backend/src/services/runtimes/docker.ts` | Modify | Add start/stop/restart/remove, image pull, create, volumes, env |
| `backend/src/services/runtimes/podman.ts` | Modify | Inherit Docker actions (API-compatible) |
| `backend/src/services/container-runtime.ts` | Modify | Add `restart()`, `remove()`, `pullImage()`, `create()` to interface |
| `backend/src/routes/containers.ts` | Modify | Add POST action endpoints + DELETE |
| `backend/src/schemas/containers.ts` | Modify | Add Zod schemas for action requests/responses |

### Tests

| File | Type | Description |
|------|------|-------------|
| `testing/unit/container-actions.test.ts` | New | Unit tests for all runtime actions with mocked commands |

---

## CRUD Completeness Check

| Operation | Needed? | Covered by |
|-----------|---------|------------|
| **Create** | No — deferred to 7b-2 | — |
| **Read** (list) | No — exists from 7a | — |
| **Read** (single) | No — exists from 7a | — |
| **Update** (actions: start/stop/restart) | Yes | `POST /api/containers/:id/{start,stop,restart}` |
| **Delete** | Yes | `DELETE /api/containers/:id` |
| **Undo/Clear** | N/A | — |

---

## All Endpoints Affected

| Endpoint | Impact |
|----------|--------|
| `POST /api/containers/:id/start` | **New** — start container via runtime adapter |
| `POST /api/containers/:id/stop` | **New** — stop container via runtime adapter |
| `POST /api/containers/:id/restart` | **New** — restart container via runtime adapter |
| `DELETE /api/containers/:id` | **New** — remove container via runtime adapter |

**Not affected:** GET endpoints from 7a (`/api/containers`, `/api/containers/:id`, `/api/containers/:id/logs`, `/api/runtimes`), all VM endpoints, agent endpoints, WebSocket. No frontend changes.

---

## Apptainer Action Details

| Action | Command | Notes |
|--------|---------|-------|
| Start instance | `apptainer instance start [flags] <image> <name>` | Flags: `--bind`, `--overlay`, `--nv`/`--rocm` |
| Stop instance | `apptainer instance stop <name>` | Clean shutdown |
| Restart | Stop + start (no native restart) | Preserve original flags |
| Pull SIF (OCI) | `apptainer pull docker://<ref>` | Track progress via stderr |
| Pull SIF (library) | `apptainer pull library://<ref>` | Track progress via stderr |
| Build from def | `apptainer build <output.sif> <def-file>` | Requires definition file upload |
| GPU (NVIDIA) | `--nv` flag on start | Verify `/dev/nvidia*` exists first |
| GPU (AMD) | `--rocm` flag on start | Verify `/dev/kfd` exists first |
| Bind mounts | `--bind /host:/container` | Validate: no `..`, within allowed dirs |
| Overlays | `--overlay <overlay-img>` | Writable layer on read-only SIF |

---

## Docker/Podman Action Details

| Action | Docker API | Notes |
|--------|-----------|-------|
| Start | `POST /containers/{id}/start` | Via Docker socket |
| Stop | `POST /containers/{id}/stop` | Graceful with timeout |
| Restart | `POST /containers/{id}/restart` | Native restart |
| Remove | `DELETE /containers/{id}` | Force option for running containers |
| Image pull | `POST /images/create?fromImage=<ref>` | Stream progress events |
| Create | `POST /containers/create` | With config: ports, volumes, env |

Podman uses the same REST API — `PodmanRuntime` extends `DockerRuntime` with different socket path (`/run/podman/podman.sock`).

---

## Flow Notes

Action request: `POST /api/containers/:id/start` → route checks `requireTier('premium')` → extracts runtime from composite ID (`{runtime}:{id}`) → registry.get(runtime).start(id) → returns ActionResult → WebSocket broadcasts updated container-status.
Remove request: `DELETE /api/containers/:id` → same tier check → adapter.remove(id) → container disappears from next WebSocket broadcast.
GPU detection: Before appending `--nv`/`--rocm`, check for device files (`/dev/nvidia0`, `/dev/kfd`). Fail with descriptive error if absent.
SIF pull/build: Long-running — stream progress via response chunking or return 202 + poll.

---

## Safety Rules

1. Container remove is destructive — backend must validate the container exists and belongs to the requesting runtime before executing
2. GPU passthrough flags (`--nv`, `--rocm`) must verify GPU device exists before enabling — fail with clear error if not
3. Bind mount paths must be validated — no `..` traversal, must be within allowed directories (configurable)
4. SIF build from definition file: sanitize uploaded file, execute in temp directory, validate output
5. Action on a non-existent container must return 404, not 500

---

## Acceptance Criteria

1. `apptainer instance start/stop` works with all flag combinations (GPU, bind, overlay)
2. Docker start/stop/restart/remove works via Docker socket API
3. Podman start/stop/restart/remove works via Podman socket API
4. SIF pull from OCI and Sylabs library completes with progress indication
5. SIF build from uploaded definition file produces valid SIF
6. GPU detection fails gracefully with clear error when no GPU device exists
7. Bind mount validation rejects path traversal attempts
8. All action endpoints require weaver tier (403 on free)
9. Unit tests pass with mocked runtime commands
10. `npm run test:precommit` passes

---

## Tier Blind Spot Mitigation

**All features are Weaver-only.** Standard dev/E2E runs at weaver.

**No blind spot** — all features testable in standard E2E environment.

**Mitigation for untestable paths:**
- Apptainer/Podman: not available in E2E Docker — unit tests with mocked commands
- GPU passthrough: no GPU in E2E Docker — unit tests mock device detection

---

## E2E Notes

- **No E2E specs in this sub-agent** — this is pure backend with no frontend changes. Full E2E coverage deferred to 7b-3.
- **Unit tests are the gate** — mock `child_process.exec` for Apptainer commands, mock Docker socket for Docker/Podman actions.
- **Integration testing:** Docker actions can be tested against real Docker socket in E2E Docker environment, but that's 7b-3's job.

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| Apptainer actions (start/stop/restart, SIF pull/build, GPU, binds, overlays) | 3 days |
| Docker actions (full lifecycle, image pull, container create, volumes, env) | 2 days |
| Podman actions (Docker-compatible, shared implementation) | 0.5 days |
| Unit tests for all runtime actions | 0.5 days |
| **Total** | **~6 days** |

---

## Documentation

| Target | Updates |
|--------|----------|
| None in this sub-agent | Documentation deferred to 7b-3 (covers all 3 sub-agents) |
