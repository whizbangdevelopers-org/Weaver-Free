<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1x-import-export — VM Config Import/Export & Backup

**Plan:** Post-v1.0 (v1.1–v1.2)
**Parallelizable:** Yes (independent of other post-v1 work)
**Blocks:** None
**Depends on:** v1.0.0 released (auth, audit, license system in place)

---

## Scope

Add the ability to export VM configurations as portable archives and import configurations from external sources (Nix, Proxmox, libvirt, Dockerfile). This addresses the #1 competitive gap vs Proxmox/Incus and provides a migration path for users coming from other platforms.

Three tiers of functionality, shipped incrementally:

1. **Export/Backup** (v1.1) — Export VM config + disk as archive, restore from archive
2. **Nix Config Import** (v1.1) — Import from running microvm.nix definitions, save as template
3. **External Format Import** (v1.2) — Parse Proxmox `.conf`, libvirt XML, Vagrantfile, Dockerfile → generate Nix

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `code/backend/src/services/microvm.ts` | Current VM service layer (extend for export/import) |
| `code/backend/src/routes/vms.ts` | VM route patterns (add export/import endpoints) |
| `code/backend/src/schemas/` | Zod schema patterns |
| `code/src/types/vm.ts` | VmInfo type (extend for export metadata) |
| `code/src/pages/VmDetailPage.vue` | VM detail page (add Export button) |
| `code/src/components/CreateVmDialog.vue` | Import UI integration point |
| `code/nixos/default.nix` | NixOS module (add export/import service config) |
| `research/competitive-landscape.md` lines 145-370 | Competitive import/export analysis, Appendix B |
| `business/archive/WEAKNESS-REMEDIATION.md` lines 149-157 | Backup/restore gap analysis |
| `plans/V2-MULTINODE-PLAN.md` lines 219-224 | Template-from-source deferral notes |

---

## Inputs

- Existing VM service layer with systemctl integration
- Existing template/distro catalog system
- Competitive analysis with detailed format mappings
- NixOS module with microvm.nix integration

---

## Outputs

### Tier 1: Export/Backup (v1.1)

#### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/routes/export.ts` | New | Export/import route plugin |
| `backend/src/schemas/export.ts` | New | Zod schemas for export/import payloads |
| `backend/src/services/export.ts` | New | Export service — archive creation, restore logic |
| `backend/src/services/microvm.ts` | Modify | Add `getVmNixConfig()` to read Nix definition |

#### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/components/ExportDialog.vue` | New | Export options: config only vs config + disk, format selection |
| `src/components/ImportDialog.vue` | New | Import wizard: file upload, preview, confirm |
| `src/pages/VmDetailPage.vue` | Modify | Add "Export" action button |
| `src/pages/WorkbenchPage.vue` | Modify | Add "Import VM" button (near Create VM) |
| `src/services/api.ts` | Modify | Add export/import API methods |

#### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/vms/:name/export` | Export VM config (+ optional disk) as archive |
| GET | `/api/vms/:name/export/:id` | Download export archive (streaming) |
| POST | `/api/vms/import` | Import from uploaded archive |
| POST | `/api/vms/import/preview` | Preview import (dry run — show what will be created) |

#### Archive Format

```
vm-export-{name}-{timestamp}.tar.gz
├── manifest.json        # Version, export date, source host, VM metadata
├── config.nix           # The Nix VM definition (parameterized)
├── config.json          # Portable JSON representation of VmInfo
├── disk.qcow2           # Optional — VM disk image (can be large)
└── README.md            # Human-readable description
```

**Design decisions:**
- **tar.gz** (universal, streamable, no extra dependencies)
- Disk image is **optional** — config-only exports are small and fast
- `manifest.json` includes schema version for forward compatibility
- Nix config is parameterized (name, IP, MAC as placeholders)

### Tier 2: Nix Config Import (v1.1)

| File | Type | Description |
|------|------|-------------|
| `backend/src/services/nix-parser.ts` | New | Parse microvm.nix definitions → VmInfo |
| `backend/src/routes/export.ts` | Modify | Add `/api/vms/:name/save-template` endpoint |
| `src/components/SaveTemplateDialog.vue` | New | "Save as Template" — parameterize name/IP, choose template name |
| `src/pages/VmDetailPage.vue` | Modify | Add "Save as Template" action |

**How it works:**
1. User clicks "Save as Template" on a running VM
2. Backend reads the VM's Nix definition from `microvm-host.nix`
3. Parameterizes unique values (name, IP, MAC) as template variables
4. Saves to the template library (existing distro/template catalog system)
5. Template appears in CreateVmDialog dropdown

### Tier 3: External Format Import (v1.2)

| File | Type | Description |
|------|------|-------------|
| `backend/src/services/parsers/proxmox.ts` | New | Parse Proxmox `.conf` → Nix config |
| `backend/src/services/parsers/libvirt.ts` | New | Parse libvirt XML → Nix config |
| `backend/src/services/parsers/dockerfile.ts` | New | Parse Dockerfile → Nix config |
| `backend/src/services/parsers/vagrantfile.ts` | New | Parse Vagrantfile → Nix config (stretch) |
| `backend/src/services/import-orchestrator.ts` | New | Unified import pipeline: detect format → parse → preview → create |
| `src/components/ImportDialog.vue` | Modify | Add format detection, source file upload, Nix preview pane |

**Parser output:** Each parser produces a `NixConfigDraft`:

```typescript
interface NixConfigDraft {
  source: 'proxmox' | 'libvirt' | 'dockerfile' | 'vagrantfile' | 'archive'
  confidence: number          // 0-1, how confident the parser is
  vmName: string
  memory: number
  vcpu: number
  hypervisor: string
  ports: number[]
  packages: string[]          // Nix packages to include
  services: string[]          // NixOS services to enable
  nixExpression: string       // Generated .nix code
  warnings: string[]          // Things the parser couldn't translate
}
```

**Format mapping:**

| Source | Maps To |
|--------|---------|
| Proxmox `memory: 2048` | `mem = 2048` |
| Proxmox `cores: 2` | `vcpu = 2` |
| Proxmox `net0: virtio,bridge=vmbr0` | `interfaces = [{ type = "tap"; }]` |
| libvirt `<memory>2097152</memory>` | `mem = 2048` |
| libvirt `<vcpu>2</vcpu>` | `vcpu = 2` |
| Dockerfile `FROM node:22` | `environment.systemPackages = [ pkgs.nodejs_22 ]` |
| Dockerfile `EXPOSE 3000` | `networking.firewall.allowedTCPPorts = [ 3000 ]` |
| Dockerfile `CMD ["node", "server.js"]` | Comment: `# Start command: node server.js` |

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Archive format | tar.gz | Universal, no extra deps, streamable |
| Config portability | JSON + Nix dual representation | JSON for programmatic use, Nix for NixOS users |
| Disk export | Optional (checkbox in ExportDialog) | Config-only exports are fast; disk can be huge |
| Parser confidence | 0-1 score + warnings list | Honest about what can't be translated |
| Import preview | Mandatory dry-run step | Users must review generated Nix before applying |
| Nix generation | String templates (not AST) | Simpler, sufficient for the VM config subset |
| Dockerfile translation | Best-effort with warnings | 80% translation + clear "TODO" comments for the rest |

---

## Premium / Free Tier Assignment

| Feature | Tier | Rationale |
|---------|------|-----------|
| Export config (JSON/Nix) | Free | Core portability |
| Export with disk image | Premium | Storage-intensive, enterprise use |
| Import from archive | Free | Core portability |
| Save as template | Free | Grows template ecosystem |
| Proxmox/libvirt import | Premium | Migration tooling for serious users |
| Dockerfile import | Free | Onboarding funnel from Docker |

---

## Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/export.test.ts` | Unit | Archive creation, manifest schema, restore flow |
| `backend/tests/parsers/proxmox.test.ts` | Unit | Proxmox conf parsing with known samples |
| `backend/tests/parsers/libvirt.test.ts` | Unit | Libvirt XML parsing with known samples |
| `backend/tests/parsers/dockerfile.test.ts` | Unit | Dockerfile parsing (FROM, EXPOSE, ENV, CMD) |
| `backend/tests/nix-parser.test.ts` | Unit | microvm.nix definition extraction |
| `testing/e2e/import-export.spec.ts` | E2E | Export → download → re-import round-trip |

---

## Flow Notes

Export: User clicks Export on VmDetailPage → ExportDialog shows options (config-only vs config+disk) → POST /api/vms/:name/export → backend reads Nix definition + optionally disk → streams tar.gz → GET /api/vms/:name/export/:id downloads archive.
Import: User clicks Import on WorkbenchPage → ImportDialog shows upload → POST /api/vms/import/preview (dry run) → user reviews → POST /api/vms/import → backend unpacks archive → creates VM via existing provisioning path.
Save as Template: VmDetailPage → "Save as Template" → backend reads Nix definition → parameterizes name/IP/MAC → saves to template store → appears in CreateVmDialog.
External parsers: ImportDialog detects file format → dispatches to parser → NixConfigDraft with confidence score and warnings → user reviews generated Nix → edits if needed → applies.
Audit logging on all export/import actions via existing audit middleware.

---

## Safety Rules

1. Import preview (dry run) is mandatory — users must review generated config before applying
2. External format parsers must surface warnings for untranslatable directives (never silently drop config)
3. Disk exports can be large — streaming response required, not buffered in memory
4. Archive manifest must include schema version for forward compatibility
5. Import must validate archive integrity (manifest present, config parseable) before creating any VM
6. Parameterized Nix templates must never contain hardcoded IPs or MACs from the source VM

---

## Tier Blind Spot Mitigation

**Features span Free and Premium tiers.** Standard dev/E2E runs at premium.

**Mitigation:**
- Free-tier features (config export, archive import, save-as-template, Dockerfile import) testable in E2E as-is
- Premium-tier features (disk export, Proxmox/libvirt import) testable in E2E as-is (E2E runs premium)
- Parser unit tests use real-world sample files from each format — no tier dependency
- Round-trip test (export → delete → import → verify) validates the full pipeline at any tier

---

## E2E Notes

- **Temp resources:** MUST use `createTempVm()` for import/export tests — exporting/deleting shared VMs would break parallel tests
- **Shared state risk:** Import creates new VMs — must use unique names and clean up in afterAll
- **Environment gaps:** Disk export tests may need a real disk image in E2E Docker, or must test config-only export
- **Parser tests:** Better suited to unit tests (deterministic inputs/outputs) than E2E
- **Cleanup:** afterAll must delete any imported VMs and remove temp export files

---

## Acceptance Criteria

### Tier 1 (v1.1)
1. Export button on VmDetailPage produces downloadable `.tar.gz`
2. Archive contains `manifest.json`, `config.json`, `config.nix`
3. "Config + disk" checkbox includes `disk.qcow2` in archive
4. Import from archive recreates VM with correct config
5. Import preview shows what will be created before applying
6. Round-trip: export VM → delete → import → VM restored with same config
7. Audit log records all export/import actions

### Tier 2 (v1.1)
8. "Save as Template" on running VM extracts Nix definition
9. Template appears in CreateVmDialog dropdown
10. Parameterized values (name, IP, MAC) are replaced on template use

### Tier 3 (v1.2)
11. Upload a Proxmox `.conf` → see generated Nix in preview pane
12. Upload a libvirt XML → see generated Nix in preview pane
13. Upload a Dockerfile → see generated Nix with packages and ports
14. Warnings shown for untranslatable directives
15. User can edit generated Nix before applying
16. All parsers have unit tests with real-world sample files

---

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| `archiver` | npm | tar.gz creation (or use Node.js `tar` built-in) |
| `xml2js` | npm | Libvirt XML parsing |
| `dockerfile-ast` | npm | Dockerfile parsing (or regex-based) |
| None | Proxmox | Plain text key-value format, custom parser |

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Tier 1: Export/import archive | 2 days |
| Tier 1: UI (ExportDialog, ImportDialog) | 1 day |
| Tier 2: Nix config extraction + Save as Template | 1 day |
| Tier 3: Proxmox parser | 1 day |
| Tier 3: Libvirt XML parser | 1 day |
| Tier 3: Dockerfile parser | 1.5 days |
| Tier 3: Import orchestrator + preview UI | 1 day |
| Tests (all tiers) | 1.5 days |
| **Total** | **10 days** |
| Tier 1+2 only (v1.1) | **4 days** |
| Tier 3 only (v1.2) | **4.5 days** |

---

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Add import/export architecture: archive format, parser pipeline, template storage |
| `src/pages/HelpPage.vue` | Add "Import & Export" section: how to export VMs, import from other platforms |
| `CLAUDE.md` | Add export/import API endpoints to API table |
| `docs/development/LESSONS-LEARNED.md` | Parser confidence scoring pattern, streaming archive design |

---

*Cross-reference: [competitive-landscape.md Appendix B](../research/competitive-landscape.md) | [WEAKNESS-REMEDIATION.md](../business/archive/WEAKNESS-REMEDIATION.md) | [V2-MULTINODE-PLAN.md](../plans/v2.0.0/V2-MULTINODE-PLAN.md)*
