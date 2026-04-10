<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v1.6.0 (Migration Tooling — Export, Import + Format Parsers)

**Last updated:** 2026-03-27

Phase 8b — complete migration tooling in one release. Config export/import (moved from v1.5.0, which became Integrated Secrets Management) combined with external format parsers for migration from other platforms. Dockerfile parser gains dual output (Nix VM config or Apptainer SIF) since container infrastructure from Phase 7 already exists. docker-compose/podman-compose parsers added per Decision #110 — generate `virtualisation.oci-containers` Nix config, multi-service import, Free tier. For integrated secrets management (v1.5.0), see [v1.5.0/EXECUTION-ROADMAP.md](../v1.5.0/EXECUTION-ROADMAP.md). For the full product roadmap and decision log, see [MASTER-PLAN.md](../../MASTER-PLAN.md).

## Phase Overview

```
Phase 8b: Migration Tooling (v1.6.0)               ░░░░░░░░░░░░░░░░░░░░  PLANNED
```

**v1.x ends at v1.6.0.** Full backup, disk provisioning, templating, and clustering ship in v2.x.

---

## Phase 8b: Config Export/Import (v1.6.0)

**Agent:** [config-export-import](../../agents/v1.6.0/config-export-import.md) *(agent definition to be created)*

| Task | Priority |
| --- | --- |
| Export VM config as `.tar.gz` archive (manifest + JSON + Nix) | High |
| Export container config (runtime, image, binds, GPU flags) | High |
| Import from archive with preview/dry-run | High |
| ExportDialog + ImportDialog components | High |
| Export/import API endpoints (4 endpoints) | High |
| Audit log entries for all export/import actions | Medium |
| Round-trip test: export → delete → import → restored | High |

> **Note:** Config export API (`GET /api/workload/export`, `GET /api/workload/:name/export`) already exists in the codebase. This phase adds the full UI and container support.

---

## Phase 8b: Format Parsers (v1.6.0)

**Agent:** [format-parsers](../../agents/v1.6.0/format-parsers.md)

| Task | Priority |
| --- | --- |
| Proxmox `.conf` parser → Nix generation (Weaver tier) | High |
| Libvirt XML parser → Nix generation (Weaver tier) | High |
| Dockerfile parser → dual output: Nix generation OR Apptainer SIF (Free tier — onboarding funnel) | High |
| docker-compose.yml parser → `virtualisation.oci-containers` Nix config, multi-service (Free tier — Decision #110) | High |
| podman-compose.yml + `podman generate kube` YAML parser → `virtualisation.oci-containers` Nix config (Free tier — Decision #110) | High |
| Multi-service selector UI in ImportDialog — checkbox list for compose files | High |
| Vagrantfile parser → Nix generation (stretch) | Low |
| Import orchestrator (format detection → parse → preview → choose VM or container target) | High |
| Nix preview pane in ImportDialog | Medium |
| "Run as Container" option in ImportDialog (Dockerfile only) | Medium |
| Parser confidence scores + warning display | Medium |
| Unit tests with real-world sample files for each parser | High |

> **Dockerfile parser bridge:** Because container infrastructure ships in Phase 7, the Dockerfile parser can target both output paths from day one — no retrofit needed. Users import a Dockerfile and choose: run as an isolated MicroVM (Nix) or run as an Apptainer container (SIF). This is a unique migration funnel no competitor offers.

> **Compose parser bridge (Decision #110):** docker-compose and podman-compose parsers output `virtualisation.oci-containers` Nix config — the declarative NixOS container layer already targeted by v1.1.0 zero-config discovery. Compose users arrive at the same managed state as native NixOS users, via a one-time import. Three open UX/policy items must be resolved before dev starts — see [MIGRATION-GUIDE.md Open Items](../../business/sales/MIGRATION-GUIDE.md).

---

## Release Plan

| Version | Milestone | Key Features | Status |
| --- | --- | --- | --- |
| v1.6.0 | Migration Tooling | VM + container config export/import, Proxmox/libvirt/Dockerfile parsers, dual output, docker-compose/podman-compose → oci-containers parsers, multi-service import, import orchestrator — **migration funnel closes** | Planned |

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
