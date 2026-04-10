<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1x-tags-search — VM Tags, Search, Filter & Bulk Actions

**Plan:** [FEATURE-GAPS](../plans/FEATURE-GAPS.md) (High Value)
**Parallelizable:** Yes (independent of v1 tracks)
**Blocks:** None

---

## Scope

Add VM tags/labels, dashboard search & filter, and bulk actions. This is one cohesive "dashboard at scale" feature set — without it, the dashboard only works well for <10 VMs. Enterprise tier allows unlimited VMs per node, so this is essential.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `src/types/vm.ts` | VmInfo type to extend with tags |
| `src/stores/vm-store.ts` | VM state, sortedVms getter, filtering entry point |
| `src/stores/ui-store.ts` | UI preferences (sort, view mode) — add filter state here |
| `src/pages/WorkbenchPage.vue` | Dashboard layout, sort dropdown, grid/list toggle |
| `src/components/VmCard.vue` | Card component to show tags |
| `src/components/VmListItem.vue` | List component to show tags |
| `backend/src/storage/vm-registry.ts` | VmDefinition type to extend with tags |
| `backend/src/routes/vms.ts` | VM CRUD routes, add tag management |
| `backend/src/services/microvm.ts` | VmInfo mapping, include tags in status |

---

## Inputs

- Existing dashboard with grid/list views and sort dropdown
- VmDefinition and VmInfo types without tags
- ui-store with sort preferences and persisted state

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/storage/vm-registry.ts` | Modify | Add `tags?: string[]` to VmDefinition |
| `backend/src/services/microvm.ts` | Modify | Include tags in VmInfo from registry |
| `backend/src/routes/vms.ts` | Modify | Add `PUT /api/vms/:name/tags` endpoint; accept tags in `POST /api/vms` |
| `backend/src/schemas/vms.ts` | Modify | Zod schema for tags (array of strings, max 10, each max 30 chars, lowercase alphanumeric + hyphens) |
| `backend/src/storage/json-registry.ts` | Modify | Persist tags field |
| `backend/src/storage/sqlite-registry.ts` | Modify | Add tags column (JSON text) or separate tags table |

### Frontend — Types & State

| File | Type | Description |
|------|------|-------------|
| `src/types/vm.ts` | Modify | Add `tags?: string[]` to VmInfo |
| `src/stores/vm-store.ts` | Modify | Add `filteredVms` getter that applies search + tag + status filters before sorting |
| `src/stores/ui-store.ts` | Modify | Add `searchQuery: string`, `filterTags: string[]`, `filterStatus: string[]` state |

### Frontend — Dashboard Search & Filter

| File | Type | Description |
|------|------|-------------|
| `src/pages/WorkbenchPage.vue` | Modify | Add search bar + filter chips in actions row; use `filteredVms` instead of `sortedVms` |
| `src/components/DashboardToolbar.vue` | New | Search input + tag filter dropdown + status filter chips + bulk action buttons |

### Frontend — Tag Display & Edit

| File | Type | Description |
|------|------|-------------|
| `src/components/VmCard.vue` | Modify | Show tag chips below VM name (max 3 visible, +N overflow) |
| `src/components/VmListItem.vue` | Modify | Show tag chips inline |
| `src/components/TagEditor.vue` | New | Reusable tag input with autocomplete from existing tags, add/remove |
| `src/pages/VmDetailPage.vue` | Modify | Add TagEditor in header area for editing VM tags |

### Frontend — Bulk Actions

| File | Type | Description |
|------|------|-------------|
| `src/components/BulkActionBar.vue` | New | Floating bar shown when VMs are selected: Start All, Stop All, Select by Tag |
| `src/pages/WorkbenchPage.vue` | Modify | Add checkbox selection to cards/list items; show BulkActionBar when selection active |
| `src/composables/useVmSelection.ts` | New | Selection state: selectedVms, selectAll, selectByTag, clearSelection |

### Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/routes/vms-tags.spec.ts` | New | CRUD tags: add/remove/list, validation (max length, chars, count) |
| `testing/unit/stores/vm-store-filter.spec.ts` | New | filteredVms with search, tags, status combinations |
| `testing/e2e/tags-search.spec.ts` | New | Add tags, search by name, filter by tag, filter by status, bulk start/stop |

---

## Tag Rules

- Max **10 tags** per VM
- Each tag: **1–30 characters**, lowercase, alphanumeric + hyphens (`/^[a-z0-9][a-z0-9-]*$/`)
- Tags are freeform (no predefined taxonomy)
- Autocomplete suggests tags already used on other VMs
- No duplicate tags on a single VM

## Search Behavior

- **Instant filter** as user types (no submit button)
- Searches VM name (substring match, case-insensitive)
- Can be combined with tag and status filters
- Keyboard shortcut: `/` to focus search (consistent with existing `?` for help)

## Filter Behavior

- **Status filter:** chips for Running / Stopped / Failed (multi-select, default: all)
- **Tag filter:** dropdown with checkboxes listing all tags in use across VMs
- Filters are **AND** logic: VM must match search query AND selected status AND selected tags
- Filter state persisted in ui-store (survives page refresh)

## Bulk Actions

| Action | Tier | Behavior |
|--------|------|----------|
| Select all (visible) | Free | Selects all VMs matching current filter |
| Start selected | Free | POST start for each selected stopped VM |
| Stop selected | Free | POST stop for each selected running VM (confirmation dialog) |
| Restart selected | Free | POST restart for each selected VM (confirmation dialog) |
| Select by tag | Premium | Quick-select all VMs with a specific tag |
| Bulk tag (add/remove tag to selection) | Premium | Batch tag management |

---

## API Changes

```
PUT /api/vms/:name/tags
  Body: { tags: string[] }
  Response: { success: true, tags: string[] }
  Auth: operator+ (when RBAC exists)
  Tier: free

GET /api/vms
  Response: VmInfo[] — now includes tags field

POST /api/vms
  Body: { ...existing, tags?: string[] }
```

---

## Dashboard Layout Change

```
Before:
┌─────────────────────────────────────────┐
│ [Last updated: ...]  [Sort ▼] [Grid|List] [+ Create VM] │
└─────────────────────────────────────────┘

After:
┌─────────────────────────────────────────┐
│ [🔍 Search VMs...]  [Status ▼] [Tags ▼]  │
│ [Last updated: ...]  [Sort ▼] [Grid|List] [+ Create VM] │
└─────────────────────────────────────────┘

When VMs selected:
┌─────────────────────────────────────────┐
│ ▣ 3 selected  [▶ Start] [■ Stop] [↻ Restart]  [✕ Clear] │
└─────────────────────────────────────────┘
```

---

## Tier Gating

| Feature | Demo | Free | Premium | Enterprise |
|---------|:----:|:----:|:-------:|:----------:|
| VM tags (add/remove) | No | Yes | Yes | Yes |
| Search by name | Yes | Yes | Yes | Yes |
| Filter by status | Yes | Yes | Yes | Yes |
| Filter by tag | No | Yes | Yes | Yes |
| Bulk start/stop/restart | No | Yes | Yes | Yes |
| Select by tag | No | No | Yes | Yes |
| Bulk tag management | No | No | Yes | Yes |

---

## Acceptance Criteria

1. Tags can be added/removed on VmDetailPage via TagEditor
2. Tags display on VmCard (chips) and VmListItem (inline chips)
3. Search input filters VMs by name in real-time
4. Status filter chips filter by running/stopped/failed
5. Tag filter dropdown filters by one or more tags
6. All three filters compose (AND logic)
7. Bulk action bar appears when VMs are selected
8. Bulk start/stop/restart work with confirmation dialogs
9. Tag autocomplete suggests existing tags from other VMs
10. Filter and search state persists across page refreshes
11. All existing tests pass
12. `npm run test:precommit` passes

---

## Estimated Effort

| Task | Human | Claude Code |
|------|-------|-------------|
| Backend (tags CRUD + schema) | 1 day | 1 hr |
| Frontend (search + filter) | 2 days | 1.5 hrs |
| Frontend (tag display + editor) | 1.5 days | 1 hr |
| Frontend (bulk actions) | 1.5 days | 1 hr |
| Tests | 1.5 days | 1 hr |
| **Total** | **7–8 days** | **5–6 hrs** |
