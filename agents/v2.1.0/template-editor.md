<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v2-template-editor — Nix Template Editor + Code Generation

**Plan:** [v2.1.0 Execution Roadmap](../../plans/v2.1.0/EXECUTION-ROADMAP.md)
**Parallelizable:** Yes (independent of snapshot engine and Capacitor phases within v2.1.0)
**Blocks:** Shed template catalog (v2.1.0) depends on the archetype definitions and saved-template API

---

## Scope

Build a split-view template editor: form on the left with building blocks (memory, CPU, services, network), live-generated Nix code on the right. Ship 8+ built-in archetypes. Users build VM definitions visually and copy the resulting Nix expression.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `research/competitive-landscape.md` (Appendix A) | Template editor design and competitive rationale |
| `src/pages/SettingsPage.vue` | Form pattern to follow |
| `src/components/CreateVmDialog.vue` | Existing VM form for reference |
| `src/services/api.ts` | API service pattern |
| `backend/src/storage/distro-store.ts` | JSON storage pattern |
| `backend/src/routes/vms.ts` | Route pattern |

---

## Inputs

- Competitive analysis Appendix A (full design document)
- Existing Quasar form components and patterns
- Existing distro/VM types

---

## Outputs

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/pages/TemplateEditorPage.vue` | New | Split view: form left, Nix code right |
| `src/types/template.ts` | New | TemplateSpec, BuildingBlock, Archetype types |
| `src/components/template/ArchetypePicker.vue` | New | Grid of starter archetypes with icons |
| `src/components/template/BuildingBlockForm.vue` | New | Dynamic form that changes based on selections |
| `src/components/template/NixPreview.vue` | New | Code display with syntax highlighting + copy |
| `src/components/template/ServiceSelector.vue` | New | Multi-select checkboxes for NixOS services |
| `src/components/template/NetworkConfig.vue` | New | Bridge, IP, MAC address fields |
| `src/services/nix-generator.ts` | New | TemplateSpec → Nix expression string |
| `src/composables/useTemplateEditor.ts` | New | Template state management, archetype loading |
| `src/router/routes.ts` | Modify | Add /templates route |
| `src/layouts/MainLayout.vue` | Modify | Add Templates nav item |

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/storage/template-store.ts` | New | JSON file storage for user-saved templates |
| `backend/src/routes/templates.ts` | New | CRUD: GET /api/templates, POST, PUT, DELETE |
| `backend/src/schemas/template.ts` | New | Zod schemas for template input |
| `backend/data/archetypes.json` | New | Built-in archetype definitions |
| `backend/src/index.ts` | Modify | Register template routes |

### Tests

| File | Type | Description |
|------|------|-------------|
| `testing/unit/services/nix-generator.spec.ts` | New | Verify generated Nix is syntactically valid |
| `backend/tests/routes/templates.spec.ts` | New | CRUD operations, validation |
| `backend/tests/storage/template-store.spec.ts` | New | Persistence, load |
| `testing/e2e/templates.spec.ts` | New | Select archetype, modify blocks, copy Nix |

---

## Built-in Archetypes

| Archetype | Icon | Memory | vCPU | Hypervisor | Services |
|-----------|------|--------|------|------------|----------|
| Web Server (nginx) | `mdi-web` | 256 MB | 1 | qemu | nginx, openssh |
| App Server (Node.js) | `mdi-nodejs` | 512 MB | 1 | qemu | nodejs, openssh |
| App Server (Python) | `mdi-language-python` | 512 MB | 1 | qemu | python3, openssh |
| Database (PostgreSQL) | `mdi-database` | 1024 MB | 2 | qemu | postgresql |
| Database (MariaDB) | `mdi-database-outline` | 1024 MB | 2 | qemu | mariadb |
| Dev Environment | `mdi-code-tags` | 1024 MB | 2 | qemu | git, vim, openssh |
| Monitoring | `mdi-chart-line` | 512 MB | 1 | qemu | grafana, prometheus |
| Container Host | `mdi-docker` | 1024 MB | 2 | qemu | docker, openssh |

Archetypes are starting points — every field is editable via building blocks.

---

## Building Blocks

### Memory & CPU

```
┌─────────────────────────────────┐
│ Memory     [====|====]  512 MB  │
│ vCPUs      [==|======]  1       │
│ Hypervisor [QEMU        ▼]     │
│ Autostart  [✓]                  │
└─────────────────────────────────┘
```

### Network

```
┌─────────────────────────────────┐
│ Bridge     [br-microvm   ▼]    │
│ IP Address [10.10.0.___]       │
│ MAC        [auto-generate]     │
│ Interface  [tap-vmname]        │
└─────────────────────────────────┘
```

### Services

```
┌─────────────────────────────────┐
│ ☑ openssh    ☑ nginx           │
│ ☐ postgresql ☐ mariadb         │
│ ☐ docker     ☐ grafana         │
│ ☐ prometheus ☐ redis           │
└─────────────────────────────────┘
```

### Firewall

```
┌─────────────────────────────────┐
│ Allowed TCP ports: [80, 443, 22]│
│ Allowed UDP ports: [         ]  │
└─────────────────────────────────┘
```

### Packages

```
┌─────────────────────────────────┐
│ Additional packages:            │
│ [git, vim, curl, htop]          │
└─────────────────────────────────┘
```

### Shared Filesystem

```
┌─────────────────────────────────┐
│ Share 1:                        │
│   Host path:  [/data/www]       │
│   Mount point:[/var/www]        │
│ [+ Add share]                   │
└─────────────────────────────────┘
```

---

## Nix Generator

The generator converts a `TemplateSpec` into a Nix expression string:

```typescript
interface TemplateSpec {
  name: string
  memory: number        // MB
  vcpu: number
  hypervisor: 'qemu' | 'cloud-hypervisor' | 'crosvm' | 'kvmtool' | 'firecracker'
  autostart: boolean
  network: {
    bridge: string
    ip: string
    mac?: string        // auto-generate if not set
    interfaceId?: string
  }
  services: string[]    // NixOS service names
  packages: string[]    // nixpkgs package names
  firewallTcp: number[]
  firewallUdp: number[]
  shares: { source: string; mountPoint: string }[]
}
```

Output example:

```nix
microVMs.web-server = {
  vcpu = 1;
  mem = 256;
  hypervisor = "qemu";
  autostart = true;

  interfaces = [{
    type = "tap";
    id = "vm-web-server";
    mac = "02:00:00:00:00:01";
  }];

  shares = [{
    source = "/data/www";
    mountPoint = "/var/www";
    tag = "www-data";
    proto = "virtiofs";
  }];

  nixos = ({ pkgs, ... }: {
    services.openssh.enable = true;
    services.nginx.enable = true;

    networking.firewall.allowedTCPPorts = [ 80 443 22 ];

    environment.systemPackages = with pkgs; [
      git
      vim
    ];

    networking = {
      hostName = "web-server";
      interfaces.eth0.ipv4.addresses = [{
        address = "10.10.0.10";
        prefixLength = 24;
      }];
      defaultGateway = "10.10.0.1";
    };
  });
};
```

---

## Code Preview Component

Use CodeMirror 6 with Nix language support:
- Syntax highlighting for Nix expressions
- Read-only (user modifies via form, not code)
- Copy to clipboard button
- Download as `.nix` file button
- Line numbers

Dependency: `@codemirror/lang-nix` (or basic highlighting mode)

---

## Template Storage

Users can save their customized templates for reuse:

```
POST /api/templates   → { name, spec }
GET  /api/templates   → TemplateInfo[]
GET  /api/templates/:id → TemplateSpec
PUT  /api/templates/:id → { name, spec }
DELETE /api/templates/:id
```

Stored in `{dataDir}/templates.json`. Weaver-only feature (free users can use editor but not save).

---

## Flow Notes

User navigates to /templates → ArchetypePicker shows 8 starter templates → user clicks one → BuildingBlockForm populates with archetype defaults → user edits memory/CPU/services/network → nix-generator.ts converts TemplateSpec to Nix string in real-time → NixPreview shows syntax-highlighted code.
Save: POST /api/templates (premium-only) → template-store.ts persists to JSON → appears in "My Templates" list.
Use: User opens CreateVmDialog → selects saved template → form pre-populates from template spec → creates VM normally.

---

## Safety Rules

1. Generated Nix must be syntactically valid — nix-generator.ts output must pass `nix-instantiate --parse` in tests
2. Package names must be validated against a known nixpkgs list (or at minimum, alphanumeric + hyphens only) to prevent injection
3. Template names must be sanitized — no path traversal characters in saved template names
4. NixPreview is read-only — users edit via form only, never direct code editing (prevents malformed Nix)

---

## Tier Blind Spot Mitigation

**Editor is free; save/load is premium-only.** Standard dev/E2E runs at premium.

**Mitigation:**
- Editor and Nix generation are free-tier — fully testable in E2E at any tier
- Template save/load is premium — testable in E2E (E2E runs premium)
- Free-tier E2E test: verify Save button is disabled/hidden, editor and copy/download still work
- Nix generator unit tests are tier-independent (pure function)

---

## E2E Notes

- **No shared state risk for editor** — the editor is stateless until Save is clicked
- **Temp resources for save tests:** Template save creates persistent data — use unique template names and clean up in afterAll
- **Environment gaps:** None — editor runs entirely in the frontend, no backend dependencies except for save/load
- **Nix validation:** E2E can test that generated code appears in NixPreview; syntactic validation is better suited to unit tests

---

## Acceptance Criteria

1. Template editor page loads with archetype grid
2. Selecting an archetype populates the building block form
3. Modifying any building block updates the Nix preview in real-time
4. Generated Nix passes `nix-instantiate --parse` validation
5. Copy button copies Nix code to clipboard
6. Download button saves `.nix` file
7. Save/load templates works (premium only)
8. All 8 archetypes produce valid, distinct Nix code
9. Network config generates correct interface/IP/gateway blocks
10. Service toggles correctly add/remove `services.<name>.enable = true`
11. `npm run test:precommit` passes

---

## Tier Gating

| Feature | Weaver Free | Weaver |
|---------|:----:|:-------:|
| Template editor (use archetypes + blocks) | Yes | Yes |
| Copy Nix to clipboard | Yes | Yes |
| Download .nix file | Yes | Yes |
| Save templates | No | Yes |
| Custom archetypes | No | Yes |

---

## Estimated Effort

Archetype picker + form UI: 2–3 days
Building block components: 2–3 days
Nix generator: 2 days
Code preview (CodeMirror): 1 day
Template storage (backend): 1 day
Tests: 1–2 days
Total: **9–12 days**

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Add template editor architecture: Nix generator, building blocks, archetype system, template storage |
| `src/pages/HelpPage.vue` | Add "Template Editor" section: how to use archetypes, building blocks, save templates (premium) |
| `CLAUDE.md` | Add /api/templates endpoints to API table |
| `docs/development/LESSONS-LEARNED.md` | Nix code generation patterns, CodeMirror integration |
