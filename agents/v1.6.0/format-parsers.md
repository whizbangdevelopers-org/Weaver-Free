<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v8b-format-parsers — External Format Parsers

**Priority:** Medium #5
**Tier:** Weaver Free (Dockerfile, docker-compose, podman-compose) / Weaver (Proxmox, libvirt)
**Plan:** [EXECUTION-ROADMAP](../../plans/v1.6.0/EXECUTION-ROADMAP.md) (Phase 8b — part 2)
**Parallelizable:** No (depends on config-export-import in same release)
**Blocks:** None

---

## Scope

Parse external VM/container configuration formats and generate Nix configs. Five parser targets:

1. **Proxmox `.conf`** → Nix MicroVM config (`virtualisation.microvm`)
2. **Libvirt XML** → Nix MicroVM config (`virtualisation.microvm`)
3. **Dockerfile** → Nix MicroVM config OR Apptainer SIF definition (dual output)
4. **docker-compose.yml** → `virtualisation.oci-containers.containers` Nix config (one or more services)
5. **podman-compose.yml / `podman generate kube` YAML** → `virtualisation.oci-containers.containers` Nix config

Formats 1–3 produce a single workload per import. Formats 4–5 may produce multiple services — the ImportDialog allows selecting which services to import in one batch.

> **Competitive positioning:** This is the onboarding funnel. Proxmox users can migrate their configs. Docker users can try cloud-hypervisor VMs with one click. Docker/Podman compose users get their entire stack translated to declarative NixOS config. The "Run as Container" toggle is a unique feature no competing dashboard offers.

### What's Already Done

<!-- MANDATORY: Scan the actual codebase before filling this in. Prior specs may be stale. -->
<!-- Run the e2e-test-writer pre-flight and grep for relevant files. Trust what you see, not prior specs. -->

- Export/import infrastructure from Phase 8a (archive format, import flow, preview UI)
- ImportDialog with file upload and preview pane
- Container runtime infrastructure (Phase 7) — Apptainer adapter can run SIF images
- Nix-based VM provisioning (v1.0)
- CreateVmDialog and CreateContainerDialog patterns

### What's Missing

- Proxmox `.conf` parser → NixConfigDraft
- Libvirt XML parser → NixConfigDraft
- Dockerfile parser → NixConfigDraft OR SifDefinition (dual output)
- docker-compose.yml parser → `OciContainersNixConfig` (multi-service)
- podman-compose.yml parser → `OciContainersNixConfig` (multi-service)
- `podman generate kube` YAML parser → `OciContainersNixConfig`
- "Run as Container" toggle in ImportDialog (Dockerfile only)
- Multi-service selection UI for compose formats (checkbox list of services)
- Format auto-detection (file extension + content heuristics)
- Import orchestrator: detect → parse → preview → user edits → apply
- Parser confidence scoring and warning system

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/services/import.ts` | Import service from 8a — extend with parser dispatch |
| `backend/src/routes/export.ts` | Import routes from 8a — may need parser-specific endpoints |
| `backend/src/schemas/export.ts` | Import schemas from 8a — extend with parser fields |
| `src/components/ImportDialog.vue` | Import UI from 8a — extend with format detection + dual output |
| `backend/src/services/container-runtime.ts` | Container interface — for SIF definition output |
| `backend/src/services/runtimes/apptainer.ts` | Apptainer adapter — SIF build integration |
| `src/components/CreateVmDialog.vue` | VM creation pattern |
| `src/components/CreateContainerDialog.vue` | Container creation pattern |

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/services/parsers/proxmox.ts` | New | Parse Proxmox `.conf` → NixConfigDraft |
| `backend/src/services/parsers/libvirt.ts` | New | Parse libvirt XML → NixConfigDraft |
| `backend/src/services/parsers/dockerfile.ts` | New | Parse Dockerfile → NixConfigDraft OR SifDefinition |
| `backend/src/services/parsers/docker-compose.ts` | New | Parse `docker-compose.yml` → OciContainersNixConfig[] (multi-service) |
| `backend/src/services/parsers/podman-compose.ts` | New | Parse `podman-compose.yml` + `podman generate kube` YAML → OciContainersNixConfig[] |
| `backend/src/services/parsers/index.ts` | New | Format detector + parser registry |
| `backend/src/services/import.ts` | Modify | Add parser dispatch, format detection |
| `backend/src/schemas/export.ts` | Modify | Add parser-specific schemas (targetType, confidence) |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/components/ImportDialog.vue` | Modify | Add format detection badge, Nix preview pane, "Run as Container" toggle |

### Tests

| File | Type | Description |
|------|------|-------------|
| `testing/unit/parsers/proxmox.test.ts` | New | Proxmox conf parsing with real-world samples |
| `testing/unit/parsers/libvirt.test.ts` | New | Libvirt XML parsing with real-world samples |
| `testing/unit/parsers/dockerfile.test.ts` | New | Dockerfile parsing (FROM, EXPOSE, ENV, CMD) |
| `testing/unit/parsers/docker-compose.test.ts` | New | Compose parsing: single service, multi-service, named volumes, depends_on warnings |
| `testing/unit/parsers/podman-compose.test.ts` | New | podman-compose + `podman generate kube` YAML parsing |
| `testing/e2e/format-import.spec.ts` | New | Upload external format → preview → create resource; multi-service selector flow |

---

## CRUD Completeness Check

| Operation | Needed? | Covered by |
|-----------|---------|------------|
| **Create** (parse + import) | Yes | `POST /api/import/preview` with external file → parsed preview → `POST /api/import` applies |
| **Read** (preview) | Yes | Parser output shown in ImportDialog with confidence + warnings |
| **Update** (edit before apply) | Yes | User edits generated Nix in preview pane before confirming |
| **Delete** | No | — |
| **Undo/Clear** | No | — |

---

## All Endpoints Affected

| Endpoint | Impact |
|----------|--------|
| `POST /api/import/preview` | **Modify** — extend to accept external format files, dispatch to parser, return NixConfigDraft |
| `POST /api/import` | **Modify** — extend to accept parsed NixConfigDraft with `targetType` (vm or container) |

**Not affected:** Export endpoints, VM/container CRUD endpoints, agent endpoints, WebSocket. Parsers are integrated into the existing import flow from 8a.

---

## Parser Interface

```typescript
// Single workload (VM or Dockerfile-as-container)
interface NixConfigDraft {
  source: 'proxmox' | 'libvirt' | 'dockerfile'
  targetType: 'vm' | 'container'    // dual output for Dockerfile
  confidence: number                 // 0-1
  vmName: string
  memory: number                     // MB
  vcpu: number
  hypervisor: string
  ports: number[]
  packages: string[]                 // Nix packages to include
  services: string[]                 // NixOS services to enable
  nixExpression: string              // Generated .nix code (for VM target)
  sifDefinition?: string             // Generated .def file (for container target)
  warnings: string[]
  sourceFile: string
}

// Multi-service compose output (docker-compose / podman-compose / podman generate kube)
interface OciContainersNixConfig {
  source: 'docker-compose' | 'podman-compose' | 'k8s-pod'
  services: OciServiceDraft[]        // One per compose service
  confidence: number                 // Overall; individual service confidence in each OciServiceDraft
  sourceFile: string
}

interface OciServiceDraft {
  name: string                       // compose service name → containers.<name>
  image: string
  ports: string[]                    // "host:container" pairs
  environment: Record<string, string>
  volumes: string[]                  // "host:container" bind mounts (named volumes → warning)
  nixExpression: string              // Generated virtualisation.oci-containers.containers.<name> block
  confidence: number
  warnings: string[]
}
```

---

## Format Mapping

### Proxmox `.conf` → Nix VM Config

| Proxmox | Nix |
|---------|-----|
| `memory: 2048` | `mem = 2048` |
| `cores: 2` | `vcpu = 2` |
| `net0: virtio,bridge=vmbr0` | `interfaces = [{ type = "tap"; }]` |
| `scsi0: local:vm-100-disk-0` | Warning: "Disk import deferred — config only" |
| `boot: order=scsi0` | `bootDisk = "/dev/vda"` |

### Libvirt XML → Nix VM Config

| Libvirt | Nix |
|---------|-----|
| `<memory>2097152</memory>` | `mem = 2048` (KiB → MB) |
| `<vcpu>2</vcpu>` | `vcpu = 2` |
| `<interface type='bridge'>` | `interfaces = [{ type = "tap"; }]` |
| `<disk>` elements | Warning: "Disk import deferred — config only" |

### Dockerfile → Nix VM Config OR Apptainer SIF

**VM target:**
| Dockerfile | Nix |
|-----------|-----|
| `FROM node:22` | `environment.systemPackages = [ pkgs.nodejs_22 ]` |
| `EXPOSE 3000` | `networking.firewall.allowedTCPPorts = [ 3000 ]` |
| `ENV FOO=bar` | `environment.variables.FOO = "bar"` |
| `CMD ["node", "server.js"]` | Comment: `# Start command: node server.js` |

**Container target (SIF):**
| Dockerfile | SIF Definition |
|-----------|----------------|
| `FROM node:22` | `Bootstrap: docker\nFrom: node:22` |
| `COPY . /app` | `%files\n. /app` |
| `RUN npm install` | `%post\ncd /app && npm install` |
| `EXPOSE 3000` | Comment in `%labels` |
| `CMD ["node", "server.js"]` | `%runscript\ncd /app && node server.js` |

### docker-compose.yml / podman-compose.yml → `virtualisation.oci-containers`

| Compose field | Nix `virtualisation.oci-containers.containers.<name>.*` |
|---------------|--------------------------------------------------------|
| `image: nginx:latest` | `image = "nginx:latest"` |
| `ports: ["80:80"]` | `ports = ["80:80"]` |
| `environment: { FOO: bar }` | `environment = { FOO = "bar"; }` |
| `volumes: ["/data:/data"]` | `volumes = ["/data:/data"]` |
| `volumes: [db-data:/var/lib/postgres]` | Warning: "Named volume — convert to bind mount or declare storage separately" |
| `networks: [backend]` | Warning: "Custom network — review bridge config; NixOS defaults to `podman0`" |
| `depends_on: [db]` | Warning: "Startup ordering — add `systemd.services.<name>.after = [\"container-db.service\"]` manually" |

For `podman generate kube` YAML: extract `containers[*]` from PodSpec, map fields above, emit one `OciServiceDraft` per container.

---

## "Run as Container" Toggle

When a Dockerfile is detected, ImportDialog shows a toggle:

```
┌─────────────────────────────────────────┐
│ Import: Dockerfile detected             │
├─────────────────────────────────────────┤
│                                         │
│ Target: (•) Run as VM  ( ) Run as Container │
│                                         │
│ ┌─── Preview ────────────────────────┐  │
│ │ # Generated NixOS VM config        │  │
│ │ { config, pkgs, ... }: {           │  │
│ │   microvm.mem = 512;               │  │
│ │   ...                              │  │
│ │ }                                  │  │
│ └────────────────────────────────────┘  │
│                                         │
│ Confidence: 85%                         │
│ ⚠ Warnings:                            │
│   - CMD translated as comment only      │
│                                         │
│              [Cancel] [Import]          │
└─────────────────────────────────────────┘
```

Toggling to "Run as Container" replaces the preview with the SIF definition and routes the import through the container creation path (Phase 7b's `POST /api/containers`).

---

## Flow Notes

Format detection: ImportDialog file upload → backend checks file extension + content heuristics (`.conf` = Proxmox, `.xml` with `<domain>` = libvirt, `FROM` keyword = Dockerfile) → returns detected format.
Parse: Backend dispatches to format-specific parser → parser returns NixConfigDraft with confidence score + warnings → frontend renders preview with editable Nix/SIF.
Dual output (Dockerfile): When target toggles between VM/container, backend re-parses with different `targetType` → different preview (Nix vs SIF definition).
Apply: User edits preview if needed → POST /api/import with NixConfigDraft → if targetType=vm, creates VM via existing provisioning. If targetType=container, creates container via `POST /api/containers` (7b endpoint) with SIF build.
Audit: All import actions logged with source format, target type, confidence score.

---

## Safety Rules

1. Parser confidence < 50% must show prominent warning — "Low confidence translation, review carefully"
2. Warnings for untranslatable directives must never be hidden — always visible in preview
3. User must be able to edit generated Nix/SIF before applying — never auto-apply parsed output
4. Disk-related directives from Proxmox/libvirt must produce clear warnings ("Disk import not supported in this version")
5. Dockerfile `RUN` commands in SIF `%post` must be validated — no shell injection from untrusted Dockerfiles
6. Format detection must handle ambiguous files gracefully — ask user to confirm format if confidence < 70%

---

## Acceptance Criteria

1. Upload Proxmox `.conf` → preview shows generated Nix with correct memory/CPU/network mapping
2. Upload libvirt XML → preview shows generated Nix with correct memory/CPU mapping
3. Upload Dockerfile → preview shows generated Nix (VM target) with packages and ports
4. Toggle "Run as Container" on Dockerfile → preview switches to SIF definition
5. Importing Dockerfile as container creates Apptainer instance via Phase 7b infrastructure
6. Confidence score and warnings displayed for all formats
7. User can edit generated config before applying
8. Upload docker-compose.yml with 3 services → checkbox list appears; select 2 → Nix preview shows 2 `oci-containers` blocks
9. Upload podman-compose.yml → same multi-service flow
10. Upload `podman generate kube` YAML → container definitions extracted, Nix preview shown
11. Named volume in compose file → warning displayed (not silently dropped)
12. Proxmox/libvirt import requires Weaver tier (403 on free)
13. Dockerfile import is Free tier (onboarding funnel)
14. docker-compose / podman-compose import is Free tier (migration funnel)
10. Unit tests pass for all parsers with real-world sample files
11. E2E specs pass for format import flows
12. All documentation updated

---

## Tier Blind Spot Mitigation

**Features span Free and Weaver tiers.** Standard dev/E2E runs at weaver.

**No blind spot** — Dockerfile (free) and Proxmox/libvirt (weaver) both testable in E2E. Unit tests verify free-tier users can import Dockerfiles but not Proxmox/libvirt.

---

## E2E Notes

- **Sample files:** Include test fixtures: `testing/fixtures/proxmox-sample.conf`, `testing/fixtures/libvirt-sample.xml`, `testing/fixtures/Dockerfile-sample`, `testing/fixtures/docker-compose-sample.yml`, `testing/fixtures/podman-compose-sample.yml`, `testing/fixtures/podman-kube-sample.yaml`
- **Parser tests:** Better suited to unit tests (deterministic inputs/outputs) — E2E tests cover the import UI flow
- **Dual output:** E2E tests should verify both VM and container targets for Dockerfile import
- **Temp resources:** Import creates VMs/containers — use unique names, clean up in afterAll
- **Apptainer in E2E:** SIF build may not work in E2E Docker — test Docker target path in E2E, Apptainer path via unit tests

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| Proxmox parser + unit tests | 1 day |
| Libvirt XML parser + unit tests | 1 day |
| Dockerfile parser (dual output: Nix + SIF) + unit tests | 1.5 days |
| docker-compose.yml parser + unit tests | 1 day |
| podman-compose.yml + podman generate kube parser + unit tests | 1 day |
| Format detector + parser registry | 0.5 days |
| ImportDialog updates (format badge, dual toggle, preview pane, multi-service selector) | 1.5 days |
| E2E specs | 0.5 days |
| Documentation | 0.5 days |
| **Total** | **~8 days** |

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Parser architecture: format detection, NixConfigDraft interface, dual output, confidence scoring |
| `src/pages/HelpPage.vue` | "Import from Other Platforms" section: Proxmox migration, libvirt migration, Dockerfile conversion |
| `docs/development/LESSONS-LEARNED.md` | Parser confidence scoring, dual-target architecture, format detection heuristics |
| `CLAUDE.md` | Note parser support in feature description |

---

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| `xml2js` or `fast-xml-parser` | npm | Libvirt XML parsing |
| `dockerfile-ast` or regex | npm/custom | Dockerfile parsing |
| None | Proxmox | Plain text key-value format, custom parser |
