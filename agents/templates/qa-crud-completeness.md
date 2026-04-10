<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: QA — CRUD Completeness Checker

**Priority:** Cross-cutting (QA tooling)
**Tier:** All
**Parallelizable:** Yes (independent)
**Plan:** Prevents recurrence of lesson `v1-H-2` — feature shipped without Create button because spec only listed Read/Update/Delete

---

## Scope

Automated verification that every backend resource has matching frontend UI for all applicable CRUD operations. Cross-references backend route files against frontend service calls, composables, and page components to identify missing operations.

**Core lesson (from v1-H-2):** "A feature spec listed Read/Update/Delete operations but omitted Create. The backend had a POST route, the API service had the call, but no UI button existed. The gap was invisible until a user tried to create a resource."

**Standards enforced:**
1. Every backend POST (create) route has a corresponding frontend UI entry point (button, dialog, form)
2. Every backend DELETE route has a corresponding frontend UI entry point (button, confirmation dialog)
3. Every backend GET (list/detail) route has a corresponding frontend page or component
4. Every backend PUT/PATCH (update) route has a corresponding frontend edit UI
5. Frontend API service methods map 1:1 to backend routes

### What's Already Done

- `feature-agent.md` template includes a CRUD completeness table — but it's a manual checklist, not automated
- All current resources (VMs, users, distros, notifications, tags, network, audit) have backend routes
- Frontend services in `src/services/api.ts` mirror backend routes
- Composable `useVmApi.ts` wraps VM service calls

### What This Agent Catches on Re-Scan

- New backend routes without frontend UI (the v1-H-2 class of bug)
- Frontend service methods that call non-existent backend routes
- Backend DELETE routes without a corresponding delete button/confirmation in the UI
- Resources with asymmetric CRUD (e.g., can create but not delete, or can read but not update)

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/routes/*.ts` | All backend route definitions — extract resource CRUD map |
| `backend/src/routes/premium/*.ts` | Weaver routes — same CRUD check |
| `src/services/api.ts` | Frontend API service layer — should mirror backend |
| `src/composables/useVmApi.ts` | VM composable — wraps service calls |
| `src/pages/WorkbenchPage.vue` | Primary UI — create/delete/action buttons |
| `src/pages/VmDetailPage.vue` | VM detail — edit/delete/action buttons |
| `src/pages/SettingsPage.vue` | Distro and config management |
| `src/pages/UsersPage.vue` | User management |
| `src/pages/AuditPage.vue` | Audit log (read-only) |
| `src/pages/NetworkPage.vue` | Network topology + management |
| `src/components/CreateVmDialog.vue` | VM creation UI |
| `src/components/premium/network/BridgeManager.vue` | Bridge CRUD UI |

---

## Outputs

### Script

| File | Type | Description |
|------|------|-------------|
| `scripts/verify-crud-completeness.ts` | New | Cross-references backend routes against frontend UI entry points |

### Config

| File | Type | Description |
|------|------|-------------|
| `package.json` | Modify | Add `audit:crud` npm script |

---

## Design

### Resource Model

The scanner operates on a "resource" abstraction. Each resource has:
- **Name** (e.g., "vms", "users", "distros", "bridges", "firewall-rules")
- **Backend routes** — grouped by CRUD operation (Create/Read/Update/Delete)
- **Frontend service methods** — from `api.ts`
- **Frontend UI entry points** — buttons, dialogs, pages

### Scanner Algorithm

1. **Extract backend resource map:**
   - Parse each route file in `backend/src/routes/**/*.ts`
   - Group routes by resource: `POST /` = Create, `GET /` = List, `GET /:id` = Read, `PUT /:id` = Update, `DELETE /:id` = Delete
   - Handle action routes separately (e.g., `POST /:name/start` is an Action, not Create)
   - Record tier gate for each operation

2. **Extract frontend service map:**
   - Parse `src/services/api.ts`
   - For each service class, extract method names and the HTTP methods/paths they call
   - Map service methods to CRUD operations

3. **Extract frontend UI map:**
   - Scan `src/pages/*.vue` and `src/components/**/*.vue`
   - Look for patterns indicating CRUD UI:
     - Create: `@click` handlers calling service `.create()` or `.add()`, dialog open triggers with "create"/"add" in name
     - Delete: `@click` handlers calling service `.remove()` or `.delete()`, confirmation dialogs
     - Update: `@click` handlers calling service `.update()`, `.set()`, `.put()`, inline edit patterns
     - Read: Component rendering data from store or service `.get()` / `.getAll()`

4. **Cross-reference and report:**
   - For each resource: check Backend → Service → UI chain
   - Flag gaps: "Backend has DELETE /api/widgets/:id but no UI delete button found"
   - Flag orphans: "Service has `deleteWidget()` but no backend route matches"

### Known Resource Matrix (current state)

| Resource | Create | Read | Update | Delete | Actions |
|----------|--------|------|--------|--------|---------|
| VMs | POST /api/vms | GET list + detail | PUT autostart/desc/tags | DELETE /:name | start/stop/restart/scan |
| Users | POST /api/auth/register | GET list + detail | PUT role | DELETE /:id | — |
| Distros | POST /api/distros | GET list + url-status | PUT url | DELETE /:name | refresh-catalog, validate-urls, test |
| Bridges | POST /api/network/bridges | GET list | — | DELETE /:name | — |
| IP Pools | — | GET /:name | PUT /:name | — | — |
| Firewall Rules | POST /api/network/firewall | GET list | — | DELETE /:id | — |
| VM Network Config | — | GET /:name | PUT /:name | — | — |
| Notification Config | — | GET / | PUT channels, PUT alerts | DELETE channels | test channel |
| Web Push Subs | POST subscribe | — | — | DELETE subscribe | generate-vapid-keys |
| Tags | — | GET / | PUT / | — | — |
| Audit Log | — | GET / (query) | — | — | — |
| Quotas | — | GET /:id | PUT /:id | — | — |
| VM ACL | — | GET /:id/vms | PUT /:id/vms | DELETE /:id/vms | — |

### Output Format

```
CRUD Completeness Report
========================

RESOURCES SCANNED: 13

COMPLETE (all CRUD ops have backend + service + UI):
  vms         — C:✓ R:✓ U:✓ D:✓ Actions: start,stop,restart,scan
  distros     — C:✓ R:✓ U:✓ D:✓ Actions: refresh,validate,test
  bridges     — C:✓ R:✓ U:— D:✓ (no update by design)

GAPS FOUND:
  [MISSING_UI] quotas — backend PUT exists, no frontend edit form found
  [MISSING_SERVICE] vm-acl — backend routes exist, api.ts has no matching service
  [ASYMMETRIC] ip-pools — can read and update but not create or delete (by design? add exemption)

READ-ONLY (by design):
  audit-log   — R only (correct: audit logs are immutable)
  tags        — R+U only (correct: tags are preset, not individually CRUD'd)

EXEMPTED: 2
  health      — infrastructure endpoint, not a resource
  auth        — identity management, not a CRUD resource
```

Exit code: 0 = all pass, 1 = gaps found.

---

## Exemption Handling

Some resources intentionally lack certain CRUD operations:

| Resource | Missing Op | Reason |
|----------|-----------|--------|
| Audit Log | C/U/D | Immutable by design — append-only |
| Tags | C/D | Preset tags are bulk-set, not individually created/deleted |
| IP Pools | C/D | Pools are bridge sub-resources, created/deleted with the bridge |
| VM Network Config | C/D | Config is per-VM metadata, created/deleted with the VM |
| Health | All | Infrastructure endpoint, not a resource |

Exemptions are hardcoded in the scanner with documented justifications.

---

## Safety Rules

1. Script is read-only — never modifies source files
2. Exit codes: 0 = all clean, 1 = gaps found (CI-friendly)
3. Frontend UI detection uses heuristic string matching — may produce false negatives for unconventional patterns

---

## Acceptance Criteria

1. `npx tsx scripts/verify-crud-completeness.ts` reports all 13 resources with correct CRUD status
2. Scanner correctly identifies the known-complete resources (VMs, distros, bridges)
3. Scanner correctly marks read-only resources (audit, tags) as exempt
4. Adding a new backend route without frontend UI triggers a gap report
5. `npm run audit:crud` runs clean on current codebase

---

## E2E Notes

- **E2E impact:** None — read-only static analysis
- **Temp resources:** None
- **Cleanup:** None

---

## Documentation

| Target | Updates |
|--------|---------|
| `docs/DEVELOPER-GUIDE.md` | Add "CRUD Completeness Audit" under Development Tools |
| `CLAUDE.md` | Add `audit:crud` to Key Commands |
