<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-H-2-user-management — User Management Page

**Priority:** High #2
**Tier:** All (admin-only feature)
**Parallelizable:** Yes (independent)
**Plan:** [EXECUTION-ROADMAP Phase 6 — Authentication & Authorization](../../../plans/v1.0.0/EXECUTION-ROADMAP.md)

---

## Scope

Add a user management page for admins: list users, change roles, delete users. The backend auth system is complete (JWT, bcrypt, roles, login page, admin setup, password complexity, account lockout). This agent adds the missing admin UI and API routes for managing other users.

### What's Already Done

- Auth middleware (`auth.ts`) — JWT verification, `request.userId`, `request.userRole`
- RBAC middleware (`rbac.ts`) — `requireRole()` preHandler
- Auth store (`auth-store.ts`) — `canManageUsers` getter
- User model with `role` field (admin/operator/viewer)
- Login page, admin first-run setup, password change

### What's Missing

- `GET /api/users` — List all users (admin-only)
- `PUT /api/users/:id/role` — Change user role (admin-only)
- `DELETE /api/users/:id` — Delete user (admin-only)
- `UsersPage.vue` — Admin UI for user management
- `/users` route in router

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/middleware/auth.ts` | Auth middleware pattern |
| `backend/src/middleware/rbac.ts` | `requireRole()` pattern |
| `backend/src/services/auth.ts` | User storage, password hashing, lockout |
| `backend/src/storage/user-store.ts` | User persistence (if exists) |
| `src/stores/auth-store.ts` | `canManageUsers` getter |
| `src/router/routes.ts` | Route registration pattern |
| `src/layouts/MainLayout.vue` | Nav item pattern |

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/routes/users.ts` | New | GET /api/users, PUT /api/users/:id/role, DELETE /api/users/:id (all admin-only) |
| `backend/src/schemas/users.ts` | New | Zod schemas for user list response, role update, user params |
| `backend/src/index.ts` | Modify | Register users routes |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/pages/UsersPage.vue` | New | Admin page: user table with role dropdown, delete button, timestamps |
| `src/router/routes.ts` | Modify | Add `/users` route (admin guard) |
| `src/layouts/MainLayout.vue` | Modify | Add Users nav item (visible when `canManageUsers`) |

### Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/routes/users.spec.ts` | New | Admin CRUD, non-admin 403, can't delete self, can't demote last admin |
| `testing/e2e/users.spec.ts` | New | Admin sees users page, changes role, deletes user |

---

## Safety Rules

1. Admin cannot delete their own account
2. Admin cannot downgrade the last remaining admin
3. Passwords are never returned in user list responses
4. Role changes are audit-logged

---

## Acceptance Criteria

1. Admin sees "Users" nav item in sidebar
2. Users page lists all users with username, role, created date
3. **Admin can create a new user** (Add User button → dialog with username, password, role)
4. Admin can change any user's role via dropdown
5. Admin can delete users (with confirmation dialog)
6. Cannot delete own account (button disabled with tooltip)
7. Cannot demote last admin (server returns 409)
8. Non-admin users get 403 on /api/users routes
9. Non-admin users don't see Users nav item
10. All existing tests pass
11. `npm run test:precommit` passes

> **Post-mortem (2026-02-19):** Original spec omitted "create user" because the
> `POST /api/auth/register` endpoint already existed. But no UI exposed it from
> the Users page — the feature was incomplete without an Add button. Fixed in
> commit `99797a7`. See LESSONS-LEARNED § "Agent Specs Must Cover Full CRUD."

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| Backend (routes + schemas) | 30 min |
| Frontend (UsersPage + nav) | 45 min |
| Tests | 30 min |
| **Total** | **~2 hours** |

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Add user management routes to API reference |
| `src/pages/HelpPage.vue` | Add "User Management" section under admin features |
| `CLAUDE.md` | Add /api/users endpoints to API table |
