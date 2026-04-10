<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v7b-3-governance-testing — Container Governance + E2E + Docs

**Priority:** High #2c
**Tier:** Weaver (bulk) / Fabrick (RBAC)
**Plan:** [EXECUTION-ROADMAP](../../plans/v1.2.0/EXECUTION-ROADMAP.md) (Phase 7b)
**Parent:** [v7-container-management.md](v7-container-management.md) (sub-agent 3 of 3)
**Parallelizable:** No (depends on v7b-2-creation-frontend)
**Blocks:** v7-cross-resource-agent

---

## Scope

Add the governance layer (RBAC, audit logging, bulk actions), NixOS module integration, comprehensive E2E test suite covering all of Phase 7b, and documentation. This is the final sub-agent — its gate is the full version gate (Docker E2E + NixOS smoke test).

### What's Already Done

<!-- MANDATORY: Scan the actual codebase before filling this in. Prior specs may be stale. -->
<!-- Run the e2e-test-writer pre-flight and grep for relevant files. Trust what you see, not prior specs. -->

- All runtime actions implemented (7b-1): start/stop/restart/remove, SIF pull/build, GPU, Docker create
- All action endpoints wired (7b-1): `POST /api/containers/:id/{start,stop,restart}`, `DELETE /api/containers/:id`
- Container creation endpoint (7b-2): `POST /api/containers`
- Image registry endpoints (7b-2): `GET/POST/DELETE /api/images`
- CreateContainerDialog with runtime selector, GPU toggle (7b-2)
- Card action buttons with confirmations (7b-2)
- Image cache management UI (7b-2)
- Existing RBAC system from v1.0 (role-based: admin/operator/viewer)
- Existing audit logging from v1.0 (agent operations, VM actions)
- Existing bulk action pattern (if any from VM management)

### What's Missing

- Container-specific RBAC permissions (enterprise: per-container ACLs)
- Audit log entries for all container actions
- Bulk action endpoints: `POST /api/containers/bulk/:action`
- Bulk action toolbar on dashboard (frontend)
- NixOS module: container management options, GPU passthrough flags
- Full E2E test suite for container management lifecycle
- Documentation: DEVELOPER-GUIDE, HelpPage, LESSONS-LEARNED

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/routes/containers.ts` | Container routes to add bulk endpoints + RBAC middleware |
| `backend/src/middleware/rbac.ts` | RBAC middleware to extend with container permissions |
| `backend/src/services/audit.ts` | Audit service to extend with container action entries |
| `backend/src/config.ts` | Tier gating — fabrick features |
| `backend/src/routes/vms.ts` | VM bulk action pattern (if exists) to mirror |
| `src/pages/WorkbenchPage.vue` | Weaver to add bulk action toolbar |
| `src/components/ContainerCard.vue` | Card — verify RBAC-aware action visibility |
| `nixos/default.nix` | NixOS module to extend |
| `testing/e2e/helpers/` | E2E test helpers and conventions |
| `testing/e2e-docker/` | Docker E2E infrastructure |

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/routes/containers.ts` | Modify | Add bulk action endpoints, RBAC middleware on all 7b routes |
| `backend/src/middleware/rbac.ts` | Modify | Add container-specific permissions (fabrick) |
| `backend/src/services/audit.ts` | Modify | Add container action audit entries |
| `backend/src/schemas/containers.ts` | Modify | Add bulk action schemas |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/pages/WorkbenchPage.vue` | Modify | Add container bulk action toolbar |
| `src/components/ContainerCard.vue` | Modify | RBAC-aware action button visibility |

### NixOS

| File | Type | Description |
|------|------|-------------|
| `nixos/default.nix` | Modify | Container management enable/disable, GPU passthrough flags, allowed runtimes |

### Tests

| File | Type | Description |
|------|------|-------------|
| `testing/unit/container-rbac.test.ts` | New | RBAC enforcement at all tiers for container endpoints |
| `testing/e2e/container-management.spec.ts` | New | Full container management lifecycle E2E |

---

## CRUD Completeness Check

| Operation | Needed? | Covered by |
|-----------|---------|------------|
| **Create** | No — exists from 7b-2 | — |
| **Read** | No — exists from 7a | — |
| **Update** (actions) | No — exists from 7b-1 | — |
| **Delete** | No — exists from 7b-1 | — |
| **Bulk actions** | Yes | `POST /api/containers/bulk/:action` + dashboard toolbar |
| **RBAC** | Yes | Container-specific permissions (enterprise) |
| **Audit** | Yes | All container actions logged |

---

## All Endpoints Affected

| Endpoint | Impact |
|----------|--------|
| `POST /api/containers/bulk/:action` | **New** — bulk start/stop/restart across selected containers |
| `POST /api/containers/:id/start` | **Add middleware** — RBAC check (enterprise), audit logging |
| `POST /api/containers/:id/stop` | **Add middleware** — RBAC check (enterprise), audit logging |
| `POST /api/containers/:id/restart` | **Add middleware** — RBAC check (enterprise), audit logging |
| `DELETE /api/containers/:id` | **Add middleware** — RBAC check (enterprise), audit logging |
| `POST /api/containers` | **Add middleware** — audit logging |
| `POST /api/images/pull` | **Add middleware** — audit logging |
| `DELETE /api/images/:id` | **Add middleware** — audit logging |

**Not affected:** GET endpoints (read-only, no RBAC/audit needed), VM endpoints, agent endpoints, WebSocket.

---

## Flow Notes

Bulk action: User selects containers on dashboard → bulk action toolbar appears → clicks "Stop All" → `POST /api/containers/bulk/stop` with container IDs → backend iterates, per-container RBAC check + action + audit → collects results (success/failure per container) → returns aggregate result → WebSocket broadcasts updated statuses.
RBAC (enterprise): Container-specific ACLs stored alongside VM ACLs → middleware checks user's container permissions before allowing action → operator sees only containers they have access to in bulk selection.
Audit: Every container action (create, start, stop, restart, remove, bulk) logged with: user, timestamp, action, container ID, runtime, result (success/failure).
NixOS: `services.weaver.containerManagement.enable` → `true` allows container endpoints. `gpuPassthrough.nvidia` / `gpuPassthrough.rocm` → configure GPU flags.

---

## Safety Rules

1. Bulk stop/restart must not include containers the user doesn't have RBAC access to — filter before action
2. Adapter failures on individual containers in bulk ops must not abort the batch — collect per-container errors, report all
3. Container-specific RBAC (enterprise) must not allow privilege escalation — operator can't grant themselves admin container access
4. Audit log entries must be tamper-resistant — append-only, no user-facing delete
5. NixOS module must default container management to disabled — explicit opt-in

---

## Acceptance Criteria

1. Bulk actions (stop all, restart all, stop by runtime) work from dashboard toolbar
2. Per-container errors in bulk ops reported individually (partial success allowed)
3. Container-specific RBAC enforced at fabrick tier — 403 for unauthorized containers
4. RBAC settings UI hidden at weaver tier, visible at fabrick
5. Audit log captures all container actions with user, timestamp, action, target, result
6. NixOS module accepts container management and GPU options
7. E2E specs pass for full container management lifecycle (Docker path)
8. E2E specs verify tier gating (free → 403, weaver → allowed)
9. E2E specs verify bulk actions with test containers
10. All documentation updated (DEVELOPER-GUIDE, HelpPage, LESSONS-LEARNED)
11. `npm run test:precommit` passes
12. Full Docker E2E suite passes (`cd testing/e2e-docker && ./scripts/run-tests.sh`)

---

## Tier Blind Spot Mitigation

**Features span Weaver and Fabrick tiers.** Standard dev/E2E runs at weaver.

**Mitigation:**
- Weaver features (bulk actions): testable in E2E (E2E runs weaver)
- Fabrick feature (container-specific RBAC): unit tests verify RBAC enforcement at all tiers. E2E verifies RBAC settings UI is hidden at weaver
- Before release: temporarily switch to enterprise for RBAC verification

---

## E2E Notes

- **This sub-agent owns the full E2E suite for Phase 7b** — tests cover all 3 sub-agents' work
- **Runtime availability:** E2E Docker has Docker socket — can create/start/stop/remove real Docker containers
- **Temp resources:** MUST create test containers with unique names (`test-7b-*`) and clean up in afterAll. MUST remove pulled test images
- **Apptainer/Podman:** Not available in E2E Docker — tested via unit tests with mocked commands
- **GPU tests:** Cannot test GPU passthrough in E2E Docker — unit tests mock device detection
- **Bulk actions:** Create 3+ test containers, select all, bulk stop, verify all stopped
- **RBAC:** Unit tests verify fabrick gating. E2E verifies RBAC UI hidden at weaver
- **Cleanup:** afterAll MUST remove all test-created containers and pulled test images

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| RBAC + audit integration for all container endpoints | 1 day |
| Bulk action endpoints + frontend toolbar | 1 day |
| NixOS module updates (container management + GPU flags) | 0.5 days |
| E2E specs (full container management lifecycle) | 1 day |
| Documentation (DEVELOPER-GUIDE, HelpPage, LESSONS-LEARNED) | 0.5 days |
| **Total** | **~4 days** |

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Container management architecture: runtime actions, creation flow, RBAC, bulk ops, image registry |
| `src/pages/HelpPage.vue` | Container management FAQ: how to create containers, GPU setup, bulk operations, image management |
| `docs/development/LESSONS-LEARNED.md` | Container management patterns: adapter action wiring, bulk error handling, RBAC extension, sub-agent boundary quality |
| `CLAUDE.md` | Add all Phase 7b API endpoints to API table |
