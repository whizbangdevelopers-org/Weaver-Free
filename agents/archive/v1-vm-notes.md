<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-vm-notes — VM Notes / Description Field

**Plan:** [FEATURE-GAPS](../plans/FEATURE-GAPS.md) (High Value)
**Parallelizable:** Yes (independent of all other tracks)
**Blocks:** None

---

## Scope

Add a free-text `description` field to VMs. Editable on VmDetailPage, visible as a subtitle on VmCard and VmListItem. Simple but expected — Proxmox and Portainer both have this. Users need a place to note "This runs the Plex server" or "Don't restart during business hours."

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/storage/vm-registry.ts` | VmDefinition type to extend |
| `backend/src/services/microvm.ts` | VmInfo type, status mapping |
| `backend/src/routes/vms.ts` | VM routes — add PUT endpoint |
| `backend/src/storage/json-registry.ts` | JSON persistence — add field |
| `backend/src/storage/sqlite-registry.ts` | SQLite persistence — add column |
| `src/types/vm.ts` | Frontend VmInfo type |
| `src/components/VmCard.vue` | Card layout — show description |
| `src/components/VmListItem.vue` | List layout — show description |
| `src/pages/VmDetailPage.vue` | Detail page — editable description |
| `src/components/CreateVmDialog.vue` | Create form — optional description |

---

## Inputs

- VmDefinition and VmInfo have no description/notes field
- VmCard shows name, status, IP, memory, hypervisor
- VmListItem shows name, status, IP

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/storage/vm-registry.ts` | Modify | Add `description?: string` to VmDefinition |
| `backend/src/services/microvm.ts` | Modify | Add `description?: string` to VmInfo, map from registry |
| `backend/src/routes/vms.ts` | Modify | Accept `description` in POST /api/vms; add `PUT /api/vms/:name/description` |
| `backend/src/storage/json-registry.ts` | Modify | Persist description field |
| `backend/src/storage/sqlite-registry.ts` | Modify | Add description column (TEXT, nullable) |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/types/vm.ts` | Modify | Add `description?: string` to VmInfo |
| `src/components/VmCard.vue` | Modify | Show description as subtitle below VM name (truncated, grey text) |
| `src/components/VmListItem.vue` | Modify | Show description inline after name (truncated) |
| `src/pages/VmDetailPage.vue` | Modify | Editable description field in header area (click-to-edit or inline textarea) |
| `src/components/CreateVmDialog.vue` | Modify | Add optional description field (q-input, textarea) |
| `src/composables/useVmApi.ts` | Modify | Add `setDescription(name, description)` API call |

### Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/routes/vms-description.spec.ts` | New | Set description, verify in GET response, create with description |
| `testing/e2e/vm-notes.spec.ts` | New | Add description in VmDetail, verify on card, create with description |

---

## API Changes

```
PUT /api/vms/:name/description
  Body: { description: string }  // max 500 chars, empty string to clear
  Response: { success: true, description: string }
  Auth: operator+ (when RBAC exists)
  Tier: free

POST /api/vms
  Body: { ...existing, description?: string }

GET /api/vms
  Response: VmInfo[] — now includes description field
```

### Validation

- Max **500 characters**
- UTF-8 text, any printable characters allowed
- Empty string or omitted = no description
- Stripped of leading/trailing whitespace

---

## UI Details

### VmCard

```
┌──────────────────────────────────┐
│  web-nginx           ● Running   │
│  Plex media server               │  ← grey, truncated at 1 line
├──────────────────────────────────┤
│  IP: 10.10.0.10                  │
│  Memory: 256 MB                  │
│  ...                             │
└──────────────────────────────────┘
```

- Description shown as `text-caption text-grey` below the VM name
- Truncated with ellipsis at one line (CSS `text-overflow: ellipsis`)
- Hidden if empty (no blank space)

### VmListItem

```
│ ● web-nginx — Plex media server    10.10.0.10   256 MB   Running │
```

- Description shown after name, separated by em dash
- Truncated if too long
- Hidden if empty

### VmDetailPage

```
┌─ Header ─────────────────────────────────────────────┐
│  web-nginx                               ● Running   │
│  [Plex media server - handles all streaming_____]  ✏ │  ← click-to-edit
└──────────────────────────────────────────────────────┘
```

- Click-to-edit pattern: text displays normally, click reveals q-input
- Save on blur or Enter, cancel on Escape
- Placeholder text when empty: "Add a description..."
- Auto-saves via PUT endpoint (no save button needed)

### CreateVmDialog

```
┌─ VM Details ─────────────────────────────────────────┐
│  Name:        [web-nginx          ]                  │
│  Description: [Optional notes about this VM___]      │
│  ...                                                  │
└──────────────────────────────────────────────────────┘
```

- Optional textarea below name field
- Single line by default, expands on focus
- Placeholder: "Optional notes about this VM"

---

## SQLite Migration

```sql
ALTER TABLE vms ADD COLUMN description TEXT;
```

Run on startup if column doesn't exist. Existing VMs get `NULL` (displayed as no description).

---

## Tier Gating

None — VM description is **Free tier** (all tiers including demo for existing VMs).

---

## Acceptance Criteria

1. Description field visible in CreateVmDialog (optional)
2. Description editable on VmDetailPage (click-to-edit)
3. Description displays on VmCard as grey subtitle (truncated)
4. Description displays on VmListItem inline (truncated)
5. Empty description shows no extra space on card/list
6. PUT endpoint persists description to registry
7. Description included in GET /api/vms response
8. Max 500 character limit enforced (backend + frontend)
9. SQLite migration adds column without breaking existing data
10. All existing tests pass
11. `npm run test:precommit` passes

---

## Estimated Effort

| Task | Human | Claude Code |
|------|-------|-------------|
| Backend (API + storage) | 0.5 days | 20 min |
| Frontend (card/list/detail/create) | 1 day | 30 min |
| Tests | 0.5 days | 15 min |
| **Total** | **2 days** | **1–1.5 hrs** |

---

## Documentation

| Target | Updates |
|--------|----------|
| `src/pages/HelpPage.vue` | Mention description field in VM Management section |
| `CLAUDE.md` | Add description API endpoint to API table |
