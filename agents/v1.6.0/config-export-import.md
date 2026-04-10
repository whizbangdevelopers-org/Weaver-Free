<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v8a-config-export-import — Config-Only Export/Import

**Priority:** Medium #4
**Tier:** Weaver Free (VM config export/import) / Weaver (container config export/import)
**Plan:** [EXECUTION-ROADMAP](../../plans/v1.6.0/EXECUTION-ROADMAP.md) (Phase 8b — part 1)
**Parallelizable:** Yes (independent of secrets management arc)
**Blocks:** format-parsers (same v1.6.0 release)

---

## Scope

Add the ability to export VM and container configurations as portable archives and import them on another host. Config-only — no disk images (deferred to Phase 10a), no "Save as Template" (deferred to Phase 10b), no external format parsers (Phase 8b). This is the lightweight migration tool: export your configs, move to a new host, import.

Container configs are exportable because Phase 7 container infrastructure is complete by this point.

> **Scope boundary:** `GET /api/vms/export` and `GET /api/vms/:name/export` already exist (JSON config export from v1.0). This agent builds the full archive format (tar.gz with manifest + JSON + Nix), adds container export, and adds the import flow with preview.

### What's Already Done

<!-- MANDATORY: Scan the actual codebase before filling this in. Prior specs may be stale. -->
<!-- Run the e2e-test-writer pre-flight and grep for relevant files. Trust what you see, not prior specs. -->

- `GET /api/vms/export` — bulk VM config export (JSON)
- `GET /api/vms/:name/export` — single VM config export (JSON)
- VM service layer with systemctl/microvm integration
- Container runtime infrastructure (Phase 7a/7b) — all adapters, registry, stores
- Audit logging middleware
- Existing creation dialogs (CreateVmDialog, CreateContainerDialog)

### What's Missing

- Archive format: tar.gz with `manifest.json + config.json + config.nix`
- Export service: build archive from VM/container config
- Import service: unpack archive, validate, preview, apply
- ExportDialog: config-only export with VM/container selection
- ImportDialog: upload, preview, confirm
- Import preview endpoint (dry run)
- Container config export endpoints
- NixOS module options for export/import paths

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/services/microvm.ts` | VM service — extend for Nix config extraction |
| `backend/src/routes/vms.ts` | Existing export endpoints to understand current format |
| `backend/src/services/container-registry.ts` | Container state to export |
| `backend/src/routes/containers.ts` | Container routes to extend with export |
| `backend/src/schemas/` | Zod schema patterns |
| `backend/src/config.ts` | Tier gating |
| `src/components/CreateVmDialog.vue` | Dialog pattern |
| `src/pages/VmDetailPage.vue` | Export button placement |
| `src/pages/WorkbenchPage.vue` | Import button placement |
| `nixos/default.nix` | NixOS module to extend |

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/services/export.ts` | New | Export service: build tar.gz archives from config |
| `backend/src/services/import.ts` | New | Import service: unpack, validate, preview, apply |
| `backend/src/routes/export.ts` | New | Export/import route plugin |
| `backend/src/schemas/export.ts` | New | Zod schemas for export/import payloads |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/components/ExportDialog.vue` | New | Export options: select VMs/containers, config-only |
| `src/components/ImportDialog.vue` | New | Import wizard: upload, preview, confirm |
| `src/pages/VmDetailPage.vue` | Modify | Add "Export" action button |
| `src/pages/WorkbenchPage.vue` | Modify | Add "Import" button near Create VM |
| `src/services/api.ts` | Modify | Add export/import API methods |

### NixOS

| File | Type | Description |
|------|------|-------------|
| `nixos/default.nix` | Modify | Export/import temp directory config |

### Tests

| File | Type | Description |
|------|------|-------------|
| `testing/unit/export-import.test.ts` | New | Archive creation, manifest validation, round-trip |
| `testing/e2e/import-export.spec.ts` | New | Export → download → re-import round-trip |

---

## CRUD Completeness Check

| Operation | Needed? | Covered by |
|-----------|---------|------------|
| **Create** (export) | Yes | `POST /api/export` → creates archive |
| **Create** (import) | Yes | `POST /api/import` → creates VM/container from archive |
| **Read** (preview) | Yes | `POST /api/import/preview` → dry run, show what will be created |
| **Read** (download) | Yes | `GET /api/export/:id` → download archive |
| **Update** | No | — |
| **Delete** | No — archives are ephemeral (temp dir, auto-cleaned) | — |
| **Undo/Clear** | No | — |

---

## All Endpoints Affected

| Endpoint | Impact |
|----------|--------|
| `POST /api/export` | **New** — create export archive (VM and/or container configs) |
| `GET /api/export/:id` | **New** — download export archive (streaming) |
| `POST /api/import` | **New** — import from uploaded archive |
| `POST /api/import/preview` | **New** — dry run preview of import |
| `GET /api/containers/:id/export` | **New** — export single container config (JSON, mirrors VM pattern) |
| `GET /api/containers/export` | **New** — export all container configs (JSON, mirrors VM pattern) |

**Not affected:** Existing `GET /api/vms/export` and `GET /api/vms/:name/export` (JSON export stays as-is). All action endpoints, agent endpoints, WebSocket.

---

## Archive Format

```
mvd-export-{timestamp}.tar.gz
├── manifest.json        # Schema version, export date, source host, resource list
├── vms/
│   ├── web-nginx.json   # VmInfo JSON for each exported VM
│   └── web-nginx.nix    # Parameterized Nix definition
├── containers/
│   ├── redis-cache.json  # ContainerInfo JSON for each exported container
│   └── redis-cache.nix   # Generated Nix service definition
└── README.md             # Human-readable summary
```

**Design decisions:**
- **tar.gz** — universal, streamable, no extra dependencies
- **No disk images** — config-only (disk export deferred to Phase 10a)
- `manifest.json` includes schema version for forward compatibility
- Nix configs are parameterized (name, IP, MAC as template variables)
- Container exports include runtime type and image reference
- Per-resource subdirectories (vms/, containers/) for clarity

---

## Flow Notes

Export: User clicks Export on VmDetailPage or bulk-selects on Weaver → ExportDialog shows VM/container checkboxes → POST /api/export with resource list → backend reads configs, parameterizes Nix, builds tar.gz → returns export ID → GET /api/export/:id streams the archive.
Import: User clicks Import on Weaver → ImportDialog → file upload → POST /api/import/preview (dry run) → shows what VMs/containers will be created, highlights conflicts (name collisions) → user confirms → POST /api/import → backend unpacks, validates manifest, creates resources via existing provisioning paths.
Container export: Backend reads container config from registry adapter → serializes to JSON + generates Nix service definition → includes in archive.
Audit logging: All export/import actions logged via existing audit middleware.

---

## Safety Rules

1. Import preview (dry run) is mandatory — users must review what will be created before applying
2. Name collision on import must be detected and surfaced — never silently overwrite existing VMs/containers
3. Archive manifest must include schema version — reject archives with incompatible schema versions
4. Parameterized Nix templates must never contain hardcoded IPs or MACs from the source host
5. Export archives are stored in temp directory with auto-cleanup (TTL: 1 hour)
6. Import must validate archive integrity (manifest present, configs parseable) before creating any resource

---

## Acceptance Criteria

1. Export button on VmDetailPage produces downloadable `.tar.gz`
2. Archive contains `manifest.json`, per-VM JSON + Nix, per-container JSON + Nix
3. Bulk export from Weaver exports selected VMs and containers
4. Import from archive recreates VMs and containers with correct config
5. Import preview shows what will be created before applying
6. Name collisions detected and surfaced in preview
7. Round-trip: export VM → delete → import → VM restored with same config
8. Container config export works for all runtimes (Apptainer, Docker, Podman)
9. VM config export is free-tier; container config export is weaver-tier
10. Audit log records all export/import actions
11. E2E specs pass for export/import round-trip
12. All documentation updated

---

## Tier Blind Spot Mitigation

**Features span Free and Weaver tiers.** Standard dev/E2E runs at weaver.

**No blind spot** — VM export (free) and container export (weaver) both testable in E2E. Unit tests verify free-tier users can export VMs but not containers.

---

## E2E Notes

- **Temp resources:** MUST create temp VMs/containers for export tests — never export shared resources
- **Round-trip test:** Export → delete temp VM → import → verify restored config matches original
- **Shared state risk:** Import creates new resources — use unique names, clean up in afterAll
- **Archive validation:** Test with malformed archives (missing manifest, corrupt data) — verify graceful rejection
- **Cleanup:** afterAll must delete imported resources and temp export files

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| Export service (archive creation, Nix parameterization) | 1 day |
| Import service (unpack, validate, preview, apply) | 1 day |
| Export/import routes + Zod schemas | 0.5 days |
| ExportDialog + ImportDialog (frontend) | 1 day |
| Container config export endpoints | 0.5 days |
| Unit tests + E2E specs | 1 day |
| Documentation | 0.5 days |
| **Total** | **~5-6 days** |

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Export/import architecture: archive format, parameterization, round-trip flow |
| `src/pages/HelpPage.vue` | "Import & Export" section: how to export VMs/containers, how to import on new host |
| `docs/development/LESSONS-LEARNED.md` | Archive format design, streaming response patterns, import preview UX |
| `CLAUDE.md` | Add export/import API endpoints to API table |

---

## Deferred Features

| Feature | Deferred to | Rationale |
|---------|-------------|-----------|
| Disk image export (qcow2 in archive) | Phase 10a (v2.0.0) | Storage-intensive, requires DISK-PROVISIONING-PLAN infrastructure |
| "Save as Template" | Phase 10b (v2.1.0) | Requires SYSTEM-TEMPLATING-PLAN template library |
| External format parsers | Phase 8b part 2 (v1.6.0/format-parsers) | Separate concern — parsing is independent of archive format |
