<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-auth — Authentication System

**Plan:** [V1-PRODUCTION-PLAN](../plans/V1-PRODUCTION-PLAN.md) (Track 1a)
**Parallelizable:** Yes (no dependencies)
**Blocks:** v1-rbac, v1-audit

---

## Scope

Implement JWT-based authentication with bcrypt password hashing. Replace the hCaptcha demo login with a real auth system. Create the login page, auth middleware, user storage, and first-run admin setup.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/index.ts` | Understand route registration, plugin order |
| `backend/src/routes/health.ts` | Pattern for Fastify route plugins |
| `backend/src/routes/vms.ts` | Pattern for protected routes |
| `backend/src/storage/distro-store.ts` | JSON file storage pattern to follow |
| `backend/src/config.ts` | How config is loaded and passed to routes |
| `src/pages/WorkbenchPage.vue` | Current landing page |
| `src/router/routes.ts` | Current routing setup |
| `src/stores/app.ts` | App-level Pinia store pattern |
| `src/services/api.ts` | API service pattern for adding auth headers |
| `nixos/default.nix` | NixOS module to extend |

---

## Inputs

- Existing Fastify backend with route plugin pattern
- Existing Quasar frontend with Pinia stores and Vue Router
- Existing NixOS module
- No existing auth system (hCaptcha is demo-only, can be removed)

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/models/user.ts` | New | `User` interface: id, username, passwordHash, role, createdAt |
| `backend/src/storage/user-store.ts` | New | JSON file storage for users (follows DistroStore pattern) |
| `backend/src/services/auth.ts` | New | AuthService: register, login, verifyToken, refreshToken, changePassword |
| `backend/src/storage/session-store.ts` | New | `SessionStore` interface: set, get, delete, deleteByUser |
| `backend/src/storage/memory-session-store.ts` | New | In-memory Map adapter (free/demo tier) |
| `backend/src/storage/sqlite-session-store.ts` | New | better-sqlite3 adapter (premium tier). Redis adapter deferred to v2 enterprise. |
| `backend/src/routes/auth.ts` | New | POST /auth/login, POST /auth/register, POST /auth/refresh, POST /auth/logout |
| `backend/src/schemas/auth.ts` | New | Zod schemas: LoginInput, RegisterInput, ChangePasswordInput |
| `backend/src/middleware/auth.ts` | New | Fastify preHandler: validate JWT, attach user to request |
| `backend/src/index.ts` | Modify | Register auth routes (public), apply auth middleware to protected routes |
| `backend/src/config.ts` | Modify | Add `jwtSecret`, `dataDir` for user storage |
| `nixos/default.nix` | Modify | Add `initialAdminPassword` option, `jwtSecret` option |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/pages/LoginPage.vue` | New | Login form: username, password, error display, submit |
| `src/stores/auth-store.ts` | New | Pinia: user, token, refreshToken, isAuthenticated, login(), logout() |
| `src/composables/useAuth.ts` | New | Auto-refresh tokens, redirect on 401, auth state management |
| `src/services/api.ts` | Modify | Add Authorization header to all requests via interceptor |
| `src/router/routes.ts` | Modify | Add /login route, add beforeEnter guards on protected routes |
| `src/layouts/MainLayout.vue` | Modify | Show username + logout button in header/sidebar |

### Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/services/auth.spec.ts` | New | Register, login, token validation, expiry, wrong password |
| `backend/tests/routes/auth.spec.ts` | New | Login route 200/401, register, refresh, protected route without token |
| `backend/tests/middleware/auth.spec.ts` | New | Valid token passes, expired token 401, missing token 401 |
| `testing/unit/stores/auth-store.spec.ts` | New | Login sets token, logout clears, persistence |
| `testing/e2e/auth.spec.ts` | New | Login page, success redirect, wrong password, logout |

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Password hashing | bcrypt (cost factor 12) | Industry standard, built into Node.js ecosystem |
| Token type | JWT (HS256) | Stateless, simple, sufficient for single-instance |
| Token storage (frontend) | localStorage | Standard for SPAs; HttpOnly cookie adds complexity without benefit for API-only auth |
| Access token TTL | 24 hours | Homelabs don't need aggressive rotation |
| Refresh token TTL | 7 days | Convenience for home use |
| Session storage | **Tiered adapters** via `SessionStore` interface | In-memory (free/demo), SQLite via better-sqlite3 (premium), Redis (enterprise/v2). Tier determines adapter at startup. |
| First-run setup | If zero users, allow unrestricted POST /auth/register | Creates admin account, subsequent registrations require admin |
| JWT secret | `JWT_SECRET` env var, random default in dev | Must be set in production (startup warning if default) |

---

## API Endpoints

| Method | Path | Auth Required | Body | Response |
|--------|------|:------------:|------|----------|
| POST | /auth/register | No (first user) / Admin | `{ username, password }` | `{ user, token, refreshToken }` |
| POST | /auth/login | No | `{ username, password }` | `{ user, token, refreshToken }` |
| POST | /auth/refresh | No (uses refresh token) | `{ refreshToken }` | `{ token, refreshToken }` |
| POST | /auth/logout | Yes | — | `{ ok: true }` |
| PUT | /auth/password | Yes | `{ currentPassword, newPassword }` | `{ ok: true }` |
| GET | /auth/me | Yes | — | `{ user }` |

---

## Acceptance Criteria

1. Starting the app with no users shows a setup page or allows first registration
2. After creating admin, subsequent registrations require admin approval
3. Login with correct credentials returns JWT token
4. Login with wrong password returns 401
5. All `/api/*` routes (except health and auth) require valid JWT
6. Expired token returns 401, frontend auto-refreshes or redirects to login
7. WebSocket connections require valid token (passed as query param)
8. User's username and role appear in the UI header
9. Logout clears tokens and redirects to login
10. All existing unit tests still pass (no regressions)
11. `npm run test:precommit` passes
12. E2E auth tests pass in Docker

---

## Dependencies

- `bcryptjs` (npm) — password hashing
- `jsonwebtoken` (npm) — JWT creation and verification
- `better-sqlite3` (npm) — SQLite session store for premium tier
- No new frontend dependencies (Quasar provides form components)

---

## Estimated Effort

Backend: 2–3 days
Frontend: 1–2 days
Tests: 1 day
Total: **4–6 days**

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Add Authentication section: JWT flow, session stores, auth middleware, login page, auth routes |
| `src/pages/HelpPage.vue` | Add "Authentication" help section: login, first-run setup, logout |
| `docs/development/LESSONS-LEARNED.md` | Capture JWT + bcrypt patterns, Playwright storageState for localStorage auth |
