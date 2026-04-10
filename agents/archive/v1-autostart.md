<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-autostart — VM Auto-Start Policy

**Plan:** [FEATURE-GAPS](../plans/FEATURE-GAPS.md) (High Value)
**Parallelizable:** Yes (independent of all other tracks)
**Blocks:** None

---

## Scope

Expose the `autostart` field (already on VmDefinition) in the UI: a toggle on VmDetailPage and CreateVmDialog. Backend enforces autostart on service startup by starting VMs with `autostart: true`. This is the most commonly requested VM manager feature — "start this VM when the host boots."

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/storage/vm-registry.ts` | VmDefinition already has `autostart?: boolean` |
| `backend/src/services/microvm.ts` | VmInfo already has `autostart?: boolean`; startup logic goes here |
| `backend/src/routes/vms.ts` | VM routes — add PUT endpoint for autostart toggle |
| `backend/src/index.ts` | Server startup — trigger autostart after init |
| `src/types/vm.ts` | Frontend VmInfo — add autostart field |
| `src/components/CreateVmDialog.vue` | Add autostart toggle to create form |
| `src/pages/VmDetailPage.vue` | Add autostart toggle in config tab |
| `src/components/VmCard.vue` | Optional: show autostart icon indicator |
| `nixos/default.nix` | NixOS module — autostart is handled by the dashboard, not systemd |

---

## Inputs

- `autostart?: boolean` already exists on VmDefinition and backend VmInfo
- Field is persisted in both JSON and SQLite registries
- Not exposed in any UI, not enforced on startup, no API to toggle it

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/routes/vms.ts` | Modify | Add `PUT /api/vms/:name/autostart` with `{ autostart: boolean }` body |
| `backend/src/routes/vms.ts` | Modify | Accept `autostart?: boolean` in `POST /api/vms` (create) body |
| `backend/src/services/microvm.ts` | Modify | Add `setAutostart(name, value)` to update registry; include autostart in VmInfo response |
| `backend/src/services/microvm.ts` | Modify | Add `startAutostartVms()` — on startup, start all VMs with `autostart: true` |
| `backend/src/storage/vm-registry.ts` | Modify | Add `update(name, partial)` method if not present, or use existing pattern |
| `backend/src/storage/json-registry.ts` | Modify | Support partial update for autostart field |
| `backend/src/storage/sqlite-registry.ts` | Modify | Support partial update for autostart field |
| `backend/src/index.ts` | Modify | Call `startAutostartVms()` after registry init and server ready |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/types/vm.ts` | Modify | Add `autostart?: boolean` to VmInfo (if not already present) |
| `src/components/CreateVmDialog.vue` | Modify | Add autostart toggle (q-toggle, default: false) |
| `src/pages/VmDetailPage.vue` | Modify | Add autostart toggle in Configuration tab |
| `src/components/VmCard.vue` | Modify | Show small autostart icon (`mdi-play-circle-outline`) next to status if autostart enabled |
| `src/composables/useVmApi.ts` | Modify | Add `setAutostart(name, value)` API call |

### Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/routes/vms-autostart.spec.ts` | New | Toggle autostart on/off, verify persisted, verify included in GET response |
| `backend/tests/services/microvm-autostart.spec.ts` | New | startAutostartVms: starts VMs with autostart=true, skips already running, handles errors |
| `testing/e2e/autostart.spec.ts` | New | Toggle autostart in VmDetail, verify icon on card, verify in create dialog |

---

## API Changes

```
PUT /api/vms/:name/autostart
  Body: { autostart: boolean }
  Response: { success: true, autostart: boolean }
  Auth: operator+ (when RBAC exists)
  Tier: free

POST /api/vms
  Body: { ...existing, autostart?: boolean }  (default: false)

GET /api/vms
  Response: VmInfo[] — now always includes autostart field (default false)
```

---

## Startup Behavior

```typescript
async function startAutostartVms(): Promise<void> {
  const allVms = await registry.getAll()
  for (const [name, def] of Object.entries(allVms)) {
    if (!def.autostart) continue
    const status = await getVmStatus(name)
    if (status === 'running') continue
    try {
      await startVm(name)
      log.info(`Autostarted VM: ${name}`)
    } catch (err) {
      log.error(`Failed to autostart VM ${name}: ${err}`)
      // Don't block other VMs — continue
    }
  }
}
```

- Called once after server initialization
- Starts VMs sequentially (not parallel) to avoid resource spikes
- Logs each start/failure
- Does not block server startup — runs after routes are registered
- Skips VMs that are already running

---

## UI Details

### CreateVmDialog

```
┌─ Advanced Options ──────────────────────────────────┐
│                                                      │
│  Auto-start on boot:  [○ ━━━]  Off                  │
│                                                      │
│  💡 VM will automatically start when the dashboard   │
│     service starts (e.g., after host reboot).        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### VmDetailPage (Config tab)

```
┌─ Configuration ─────────────────────────────────────┐
│                                                      │
│  Hypervisor:  qemu                                   │
│  Memory:      512 MB                                 │
│  vCPUs:       1                                      │
│  Disk:        10 GB                                  │
│  Distro:      NixOS                                  │
│                                                      │
│  Auto-start:  [━━━ ●]  On                           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### VmCard indicator

Small icon next to status badge: `mdi-play-circle-outline` (grey, subtle) when autostart is enabled. Tooltip: "Auto-starts on boot."

---

## Tier Gating

None — autostart is **Free tier** (all tiers including demo for existing VMs).

---

## Acceptance Criteria

1. Autostart toggle visible in CreateVmDialog (default: off)
2. Autostart toggle visible in VmDetailPage config tab
3. Toggling autostart calls PUT endpoint and persists
4. VmCard shows autostart indicator icon when enabled
5. On server startup, VMs with autostart=true are started automatically
6. Already-running VMs are skipped during autostart
7. Autostart failures are logged but don't block other VMs
8. GET /api/vms includes autostart field for all VMs
9. All existing tests pass
10. `npm run test:precommit` passes

---

## Estimated Effort

| Task | Human | Claude Code |
|------|-------|-------------|
| Backend (API + startup logic) | 1 day | 30 min |
| Frontend (CreateVmDialog + VmDetail + VmCard) | 0.5 days | 20 min |
| Tests | 0.5 days | 15 min |
| **Total** | **2 days** | **1–1.5 hrs** |

---

## Documentation

| Target | Updates |
|--------|----------|
| `src/pages/HelpPage.vue` | Add autostart mention in VM Management section |
| `CLAUDE.md` | Add autostart API endpoint to API table |
