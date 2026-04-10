<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-M-1-per-vm-acl — Per-VM Access Control

**Priority:** Medium #1
**Tier:** Enterprise
**Parallelizable:** After v1-H-2-user-management (needs /api/users routes)
**Plan:** [EXECUTION-ROADMAP Phase 6 — Authentication & Authorization](../../../plans/v1.0.0/EXECUTION-ROADMAP.md)

---

## Scope

Add per-VM access control for enterprise tier. Currently RBAC is role-based (admin/operator/viewer applied globally). This agent adds the ability to restrict which VMs a user can see and manage — e.g., "operator jsmith can only manage web-nginx and web-app."

### What's Already Done

- Role-based RBAC middleware (`requireRole()`)
- Three roles enforced on all routes (admin/operator/viewer)
- Auth middleware attaches `userId` and `userRole` to requests
- UsersPage.vue with CRUD for user accounts (from v1-H-2)

### What's Missing

- VM ACL model (user→VM mapping)
- ACL storage (persist which users can access which VMs)
- ACL middleware (filter VM lists, check VM access on actions)
- Admin UI for assigning VM permissions to users
- API routes for ACL management

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/middleware/rbac.ts` | Current role middleware to extend |
| `backend/src/middleware/auth.ts` | User identity on request |
| `backend/src/routes/vms.ts` | VM routes to add ACL filtering |
| `backend/src/routes/agent.ts` | Agent route — needs ACL check for `:name` param |
| `backend/src/routes/users.ts` | User management routes (from v1-H-2) |
| `backend/src/routes/ws.ts` | WebSocket — needs ACL filtering on broadcast |
| `backend/src/storage/` | Storage patterns (JSON/SQLite) |
| `src/pages/UsersPage.vue` | Where VM assignment UI will be added |

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/storage/vm-acl-store.ts` | New | User→VM permission mapping, JSON-backed |
| `backend/src/middleware/vm-acl.ts` | New | Filter VM lists by user ACL, check VM access on actions |
| `backend/src/routes/vm-acl.ts` | New | GET/PUT/DELETE /api/users/:id/vms — admin-only ACL management |
| `backend/src/routes/vms.ts` | Modify | Apply ACL filter on GET /api/vms, check on VM actions |
| `backend/src/routes/agent.ts` | Modify | Check ACL before allowing agent operation on a VM |
| `backend/src/routes/ws.ts` | Modify | Filter vm-status broadcast to only include ACL-allowed VMs |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/pages/UsersPage.vue` | Modify | Add VM assignment section per user (expandable row with VM multi-select + "Clear all" button) |

### Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/middleware/vm-acl.spec.ts` | New | ACL filtering, access denied for unassigned VMs, admin bypass, empty ACL = all access |
| `backend/tests/routes/vm-acl.spec.ts` | New | CRUD routes: assign, list, clear; 403 for non-admin; tier gate |
| `testing/e2e/vm-acl.spec.ts` | New | Full workflow with temp users — see E2E Notes below |

---

## Design

- **Admin** always sees all VMs (ACL bypass)
- **Operator/Viewer with no ACL entries** = sees all VMs (backwards compatible)
- **Operator/Viewer with ACL entries** = sees only assigned VMs
- ACL is opt-in: only enterprise tiers with explicit assignments are restricted
- VM ACL stored as `{ userId: string, vmNames: string[] }[]`

---

## Flow Notes

Request hits `auth.ts` (JWT + userId) → `rbac.ts` (requireRole) → `vm-acl.ts` (filter by userId's ACL if enterprise + has entries) → handler.
Frontend reads filtered VM list from store — no client-side filtering needed.
WebSocket `vm-status` broadcast filtered server-side per connection's userId ACL.
Admin sees all VMs always — ACL middleware short-circuits on admin role.

---

## All Endpoints Requiring ACL Checks

The ACL middleware must be applied to every endpoint that operates on a specific VM or returns VM data:

| Endpoint | ACL Behavior |
|----------|-------------|
| `GET /api/vms` | Filter response to only ACL-allowed VMs |
| `GET /api/vms/:name` | 403 if VM not in user's ACL |
| `POST /api/vms/:name/start` | 403 if VM not in user's ACL |
| `POST /api/vms/:name/stop` | 403 if VM not in user's ACL |
| `POST /api/vms/:name/restart` | 403 if VM not in user's ACL |
| `POST /api/vms/:name/agent` | 403 if VM not in user's ACL |
| `GET /api/vms/:name/agent/:opId` | 403 if VM not in user's ACL |
| `GET /api/vms/:name/export` | 403 if VM not in user's ACL |
| `GET /api/vms/export` | Filter to only ACL-allowed VMs |
| `PUT /api/vms/:name/tags` | 403 if VM not in user's ACL |
| `WS /ws/status` | Filter `vm-status` broadcast to ACL-allowed VMs per connection |

**Not ACL-gated** (admin-only or global): `POST /api/vms/scan`, `GET /api/vms/export` (admin-only), quotas, users, audit, health.

---

## ACL API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET /api/users/:id/vms` | List assigned VM names for user (admin-only) |
| `PUT /api/users/:id/vms` | Set assigned VM names `{ vmNames: string[] }` (admin-only) |
| `DELETE /api/users/:id/vms` | Clear all ACL entries for user (revert to global access, admin-only) |

The DELETE route is the "undo" path — admin clears ACL to restore full access for a user.

---

## Acceptance Criteria (User Workflows)

1. **Assign VMs workflow**: Admin navigates to Users → expands a user row → sees "VM Access" section → selects VMs from multi-select list → saves → user sees only assigned VMs on dashboard on next load
2. **Clear ACL workflow**: Admin navigates to Users → expands a user row → clicks "Clear VM restrictions" → user sees all VMs again (backwards compatible default)
3. **Restricted user experience**: User with ACL sees only assigned VMs on dashboard, VM detail, and agent operations; gets 403 on actions for unassigned VMs
4. **WebSocket filtering**: Restricted user's WebSocket connection only receives `vm-status` events for ACL-allowed VMs
5. **Admin bypass**: Admin always sees all VMs regardless of any ACL entries
6. **Backwards compatible**: Users with no ACL entries see all VMs (no behavior change)
7. **Enterprise gate**: ACL only enforced when tier is enterprise; on lower tiers, all users see all VMs
8. **All existing tests pass**
9. **`npm run test:precommit` passes**

---

## Tier Blind Spot Mitigation

This is an **enterprise-only** feature. It cannot be manually tested on premium localhost (the standard dev environment).

**Mitigation:**
- Backend unit tests (`vm-acl.spec.ts`) cover ACL middleware for all tiers: enterprise (enforced), premium (bypassed), free (bypassed)
- E2E tests run at premium tier — ACL tests should verify that ACL middleware is inactive (no filtering) at premium, confirming backwards compatibility
- Before release: temporarily switch localhost to enterprise (`LICENSE_KEY=WVR-ENTERPRISE-...`) and manually verify the full assign/restrict/clear workflow

---

## E2E Notes

- **MUST use `createTempUser()`** for all ACL tests — assigning ACLs to shared `e2e-operator` would contaminate parallel tests (Lesson: Shared State Convention)
- **MUST use `createTempVm()`** if testing VM creation within ACL context
- E2E environment runs premium tier — ACL tests verify middleware is inactive at this tier
- Temp resources cleaned up in `afterAll` block

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| Backend (storage + middleware + routes) | 1.5 hours |
| Frontend (UsersPage VM assignment) | 45 min |
| Tests (unit + E2E) | 45 min |
| **Total** | **~3 hours** |

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Add per-VM ACL section: model, middleware, API routes, WebSocket filtering |
| `src/pages/HelpPage.vue` | Update "User Roles" section with per-VM access (enterprise) |
| `CLAUDE.md` | Add /api/users/:id/vms endpoints to API table |
