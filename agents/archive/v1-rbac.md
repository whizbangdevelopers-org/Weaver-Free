<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-rbac — Role-Based Access Control

**Plan:** [V1-PRODUCTION-PLAN](../plans/V1-PRODUCTION-PLAN.md) (Track 1b)
**Parallelizable:** After v1-auth (requires auth middleware and user model)
**Blocks:** None directly (v1-audit can start as soon as v1-auth is done)

---

## Scope

Add three roles (admin, operator, viewer) with permission enforcement on all backend routes and UI element visibility in the frontend. Add a user management page for admins.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/middleware/auth.ts` | Auth middleware to extend with role checking |
| `backend/src/models/user.ts` | User model with role field (added by v1-auth) |
| `backend/src/routes/vms.ts` | Routes that need role protection |
| `backend/src/routes/network.ts` | Routes that need role protection |
| `backend/src/routes/network-mgmt.ts` | Premium routes that need role protection |
| `backend/src/routes/agent.ts` | AI agent routes |
| `src/stores/auth-store.ts` | Auth store with user/role (added by v1-auth) |
| `src/layouts/MainLayout.vue` | Nav items to gate by role |
| `src/pages/WorkbenchPage.vue` | Action buttons to gate |
| `src/components/VmCard.vue` | Action buttons to gate |

---

## Inputs

- v1-auth complete: User model has `role` field, auth middleware attaches user to request
- All existing routes are protected by auth middleware

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/middleware/rbac.ts` | New | `requireRole(role: Role)` Fastify preHandler hook |
| `backend/src/routes/users.ts` | New | Admin-only: GET /api/users, PUT /api/users/:id/role, DELETE /api/users/:id |
| `backend/src/schemas/users.ts` | New | Zod schemas for user management |
| `backend/src/routes/vms.ts` | Modify | Add role middleware: viewer=GET only, operator=GET+actions, admin=all |
| `backend/src/routes/network.ts` | Modify | Read-only for all roles (free tier) |
| `backend/src/routes/network-mgmt.ts` | Modify | Operator+ for CRUD operations |
| `backend/src/routes/agent.ts` | Modify | Operator+ for AI diagnostics |
| `backend/src/index.ts` | Modify | Register users routes |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/pages/UsersPage.vue` | New | Admin page: user table, role dropdown, delete button |
| `src/composables/useRbac.ts` | New | `canViewVms()`, `canControlVms()`, `canManageUsers()`, etc. |
| `src/router/routes.ts` | Modify | Add /users route (admin only) |
| `src/layouts/MainLayout.vue` | Modify | Gate nav items: Users (admin), Settings (admin) |
| `src/components/VmCard.vue` | Modify | Hide action buttons for viewer role |
| `src/pages/WorkbenchPage.vue` | Modify | Hide Create VM button for viewer |
| `src/pages/VmDetailPage.vue` | Modify | Hide action buttons for viewer |
| `src/pages/SettingsPage.vue` | Modify | Read-only for non-admin |

### Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/middleware/rbac.spec.ts` | New | Role enforcement: viewer blocked, operator allowed, admin all |
| `backend/tests/routes/users.spec.ts` | New | Admin CRUD, non-admin 403 |
| `testing/unit/composables/useRbac.spec.ts` | New | Permission computation from role |
| `testing/e2e/rbac.spec.ts` | New | Viewer read-only, operator controls, admin manages users |

---

## Role Permission Matrix

| Endpoint | Viewer | Operator | Admin |
|----------|:------:|:--------:|:-----:|
| GET /api/vms | Yes | Yes | Yes |
| GET /api/vms/:name | Yes | Yes | Yes |
| POST /api/vms/:name/start | - | Yes | Yes |
| POST /api/vms/:name/stop | - | Yes | Yes |
| POST /api/vms/:name/restart | - | Yes | Yes |
| POST /api/vms | - | Yes | Yes |
| DELETE /api/vms/:name | - | Yes | Yes |
| POST /api/vms/:name/agent | - | Yes | Yes |
| GET /api/network/topology | Yes | Yes | Yes |
| GET /api/network/bridges | Yes | Yes | Yes |
| POST /api/network/bridges | - | Yes | Yes |
| DELETE /api/network/bridges/:name | - | - | Yes |
| GET /api/network/firewall | Yes | Yes | Yes |
| POST /api/network/firewall | - | Yes | Yes |
| DELETE /api/network/firewall/:id | - | - | Yes |
| GET /api/users | - | - | Yes |
| PUT /api/users/:id/role | - | - | Yes |
| DELETE /api/users/:id | - | - | Yes |
| GET /api/audit | - | - | Yes |
| PUT /api/settings/* | - | - | Yes |

---

## Acceptance Criteria

1. Viewer can see dashboard, VM details, network topology — cannot perform any actions
2. Operator can start/stop/restart VMs, create VMs, manage network — cannot manage users or settings
3. Admin has full access including user management and audit log
4. Backend returns 403 with descriptive message when role is insufficient
5. Frontend hides/disables buttons that the current user's role cannot use
6. Users page (admin only) shows all users with role management
7. Admin cannot delete their own account
8. Admin cannot downgrade the last remaining admin
9. All existing tests pass (no regressions)
10. `npm run test:precommit` passes

---

## Estimated Effort

Backend: 1–2 days
Frontend: 1–2 days
Tests: 1 day
Total: **3–5 days**

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Add RBAC section: role definitions, permission matrix, role middleware, user management routes |
| `src/pages/HelpPage.vue` | Add "User Roles" help section explaining what each role can do |
| `docs/development/LESSONS-LEARNED.md` | Capture any RBAC middleware patterns or Fastify permission gotchas |
