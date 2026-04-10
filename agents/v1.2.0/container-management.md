<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v7-container-management — Full Container Management (Coordinator)

**Priority:** High #2
**Tier:** Weaver (actions, creation, images) / Fabrick (RBAC)
**Plan:** [EXECUTION-ROADMAP](../../plans/v1.2.0/EXECUTION-ROADMAP.md) (Phase 7b)
**Parallelizable:** No (depends on v7-container-visibility)
**Blocks:** v7-cross-resource-agent

---

## Scope

The closer. Ship the complete container management story in one release. Implement full lifecycle actions for Apptainer (including GPU passthrough), Docker, and Podman containers. Build the unified creation dialog, image registry management, container-specific RBAC, bulk operations, and audit logging. Every container action available in one shot — not drip-fed across releases.

> **Market positioning:** After this release, the product page reads: *"The only dashboard that manages your MicroVMs, Apptainer instances, and Docker containers from a single pane — with AI-powered diagnostics across all of them."*

**This agent is split into 3 sequential sub-agents** due to the 16-day scope exceeding the 7-day threshold. See the sub-agent intervention threshold in the [orchestration plan](../.claude/plans/agile-pondering-river.md).

---

## Sub-Agent Chain

All sub-agents work on `feature/v1.2-container-management` branch. Version gate runs only after 7b-3.

| Sub-Agent | File | Scope | Est | Gate |
|-----------|------|-------|-----|------|
| **7b-1** | [v7b-1-runtime-actions.md](v7b-1-runtime-actions.md) | Apptainer/Docker/Podman action implementations + action endpoints | ~6 days | precommit + unit |
| **7b-2** | [v7b-2-creation-frontend.md](v7b-2-creation-frontend.md) | POST /api/containers, image endpoints, CreateContainerDialog, card buttons, image cache UI | ~6 days | precommit + unit + partial E2E |
| **7b-3** | [v7b-3-governance-testing.md](v7b-3-governance-testing.md) | RBAC, audit, bulk ops, NixOS module, full E2E, documentation | ~4 days | **Full version gate** |

```
7b-1: Runtime Actions (~6 days)
  │   Depends on: v1.1.0 (7a adapters exist)
  │   Gate: precommit + unit tests
  │   Commit: intermediate (feature branch)
  ▼
7b-2: Creation + Images + Frontend (~6 days)
  │   Depends on: 7b-1 (actions exist to call)
  │   Gate: precommit + unit tests + partial E2E
  │   Commit: intermediate (feature branch)
  ▼
7b-3: Governance + E2E + Docs (~4 days)
      Depends on: 7b-2 (all endpoints exist)
      Gate: FULL version gate (precommit + Docker E2E + NixOS smoke)
      Commit: final (merge to main)
```

---

## Combined API Endpoints (Phase 7b)

| Method | Endpoint | Tier | Sub-Agent | Description |
|--------|----------|------|-----------|-------------|
| POST | `/api/containers/:id/start` | Weaver | 7b-1 | Start container |
| POST | `/api/containers/:id/stop` | Weaver | 7b-1 | Stop container |
| POST | `/api/containers/:id/restart` | Weaver | 7b-1 | Restart container |
| DELETE | `/api/containers/:id` | Weaver | 7b-1 | Remove container |
| POST | `/api/containers` | Weaver | 7b-2 | Create new container |
| GET | `/api/images` | Weaver | 7b-2 | List cached images |
| POST | `/api/images/pull` | Weaver | 7b-2 | Pull image from registry |
| DELETE | `/api/images/:id` | Weaver | 7b-2 | Remove cached image |
| POST | `/api/containers/bulk/:action` | Weaver | 7b-3 | Bulk start/stop/restart |

---

## Combined Tier Gating

| Feature | Weaver Free | Weaver | Fabrick |
|---------|------|---------|------------|
| Container visibility (from 7a) | Apptainer only | All runtimes | All runtimes |
| Container actions | - | Full | Full |
| Container creation | - | Full | Full |
| GPU passthrough config | - | Full | Full |
| Image registry management | - | Full | Full |
| Bulk actions | - | Full | Full |
| Container-specific RBAC | - | - | Full |

---

## Phase Chain

| Phase | Agent | Delivers | Status |
|-------|-------|----------|--------|
| 7a | v7-container-visibility | Read-only container awareness, adapter interface, types, cards, detail page | TODO |
| 7b | v7-container-management (this — 3 sub-agents) | Full CRUD, actions, creation dialog, RBAC, bulk ops | TODO |
| 7c | v7-cross-resource-agent | Cross-resource AI, topology view, unified search | TODO |

---

## Combined Acceptance Criteria

1. All Apptainer actions work: start, stop, restart, pull SIF, build from def, GPU flags, bind mounts
2. All Docker actions work: start, stop, restart, remove, pull, create, volumes, env vars
3. All Podman actions work: same as Docker (API-compatible)
4. `CreateContainerDialog` supports: SIF, OCI image reference, runtime selection
5. GPU passthrough toggles (`--nv`, `--rocm`) work for Apptainer
6. Resource limits (CPU, memory) configurable in creation dialog
7. Container-specific RBAC permissions enforced at fabrick tier
8. Audit log captures all container actions with user, timestamp, action, target
9. Bulk actions (stop all, restart all by runtime) work from dashboard
10. Image cache management (list, prune) available in settings
11. All action endpoints return appropriate errors for tier violations (403)
12. NixOS module updated with container management and GPU options
13. E2E specs pass for full container management lifecycle
14. All documentation updated

---

## Estimated Effort

| Sub-Agent | Duration |
|-----------|----------|
| 7b-1: Runtime Actions | ~6 days |
| 7b-2: Creation + Images + Frontend | ~6 days |
| 7b-3: Governance + E2E + Docs | ~4 days |
| **Total** | **~16 days** |
