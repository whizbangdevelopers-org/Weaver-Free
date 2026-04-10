<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# V1 Production Ready Plan (v1.0.0)

**Phase:** 6
**Status:** Decisions Resolved — Ready for Implementation
**Target:** v1.0.0 release tag
**Depends on:** All features through Phase 5e (network map + management) complete in Dev

---

## Goal

Ship a production-ready v1.0.0 that can be deployed by real users beyond the developer. This means: authentication, role-based access, audit logging, a real license key system, and security hardening. No new features — only the infrastructure needed to run safely in the real world.

---

## Execution Tracks

Three independent tracks run in parallel, then converge for release:

```
Track 1 (sequential):     auth → rbac → audit
Track 2 (independent):    license key system
Track 3 (independent):    security hardening
Final (depends on all):   release prep
```

---

## Track 1: Authentication → RBAC → Audit

### 1a. Authentication System

**Agent:** [v1-auth](../agents/v1-auth.md)

Replace the hCaptcha demo login with a real authentication system.

| Decision | Resolution | Rationale |
|----------|-----------|-----------|
| Auth method | **JWT + bcrypt** (HS256, cost 12) | Stateless, no external deps. OAuth/SSO added later as additional auth methods issuing the same JWT. |
| Session storage | **Tiered adapters** via `SessionStore` interface: in-memory (free/demo), SQLite (premium), Redis (enterprise/v2) | Tier determines adapter at startup. Free is simple, premium survives restarts, enterprise enables shared sessions for multi-node. |
| Token expiry | **24h access, 7d refresh** | Balance security with UX for homelab use |

**Deliverables:**

| Component | File(s) | Description |
|-----------|---------|-------------|
| User model | `backend/src/models/user.ts` | User type with id, username, passwordHash, role, createdAt |
| User storage | `backend/src/storage/user-store.ts` | JSON file-based storage (follows DistroStore pattern) |
| Auth service | `backend/src/services/auth.ts` | Register, login, verify token, refresh token, change password |
| Session store interface | `backend/src/storage/session-store.ts` | `SessionStore` adapter interface (set, get, delete, deleteByUser) |
| Memory session adapter | `backend/src/storage/memory-session-store.ts` | In-memory Map-based adapter (free/demo tier) |
| SQLite session adapter | `backend/src/storage/sqlite-session-store.ts` | better-sqlite3 adapter (premium tier) |
| Auth routes | `backend/src/routes/auth.ts` | POST /auth/login, POST /auth/register, POST /auth/refresh, POST /auth/logout |
| Auth middleware | `backend/src/middleware/auth.ts` | Fastify preHandler hook that validates JWT on protected routes |
| Auth schemas | `backend/src/schemas/auth.ts` | Zod schemas for login, register, change-password |
| Login page | `src/pages/LoginPage.vue` | Username/password form, error handling, redirect to dashboard |
| Auth store | `src/stores/auth-store.ts` | Pinia store: user, token, isAuthenticated, login(), logout() |
| Auth composable | `src/composables/useAuth.ts` | Token refresh, auto-redirect, auth header injection |
| API interceptor | `src/services/api.ts` | Add Authorization header to all API requests |
| Route guards | `src/router/routes.ts` | beforeEnter guard redirects unauthenticated to /login |
| Setup wizard | First-run detection | If no users exist, show setup wizard to create admin account |
| NixOS module | `nixos/default.nix` | Add `initialAdmin` option for first-run setup |

**Tests:**
- Backend: auth service (register, login, token validation, expiry)
- Backend: auth routes (401 on missing token, 403 on invalid token, success flows)
- Backend: auth middleware (protected vs public routes)
- Frontend: auth store (login, logout, token persistence)
- E2E: login flow, redirect to dashboard, logout

### 1b. Role-Based Access Control

**Agent:** [v1-rbac](../agents/v1-rbac.md)
**Depends on:** v1-auth complete

Three roles with escalating permissions:

| Role | Dashboard | VM Control | VM Provisioning | Network Mgmt | Settings | User Mgmt |
|------|:---------:|:----------:|:---------------:|:------------:|:--------:|:----------:|
| viewer | Read | - | - | - | - | - |
| operator | Read | Start/Stop/Restart | Create/Delete | Read | Read | - |
| admin | Read | All | All | All | All | All |

**Deliverables:**

| Component | File(s) | Description |
|-----------|---------|-------------|
| Role middleware | `backend/src/middleware/rbac.ts` | `requireRole('operator')` preHandler hook |
| Role on user model | `backend/src/models/user.ts` | Add `role: 'admin' \| 'operator' \| 'viewer'` |
| Route protection | All route files | Add role middleware to each endpoint |
| User management page | `src/pages/UsersPage.vue` | Admin-only page: list users, change roles, delete users |
| User management routes | `backend/src/routes/users.ts` | GET /users, PUT /users/:id/role, DELETE /users/:id |
| Frontend role gating | Components | Hide/disable UI elements based on role |
| Nav item visibility | `src/layouts/MainLayout.vue` | Show Users page only for admin |

**Tests:**
- Backend: role middleware (viewer blocked from VM actions, operator blocked from settings)
- Backend: user management routes (admin-only access)
- E2E: viewer sees read-only dashboard, operator can control VMs, admin sees all

### 1c. Audit Logging

**Agent:** [v1-audit](../agents/v1-audit.md)
**Depends on:** v1-auth complete (needs user identity)

Log all meaningful actions with who, what, when.

**Deliverables:**

| Component | File(s) | Description |
|-----------|---------|-------------|
| Audit model | `backend/src/models/audit.ts` | AuditEntry: timestamp, user, action, target, details, ip |
| Audit storage | `backend/src/storage/audit-store.ts` | Append-only JSON file, configurable retention |
| Audit service | `backend/src/services/audit.ts` | `logAction(user, action, target, details)` |
| Audit middleware | `backend/src/middleware/audit.ts` | Auto-log on all mutating routes (POST, PUT, DELETE) |
| Audit routes | `backend/src/routes/audit.ts` | GET /api/audit (admin-only), with pagination + filtering |
| Audit page | `src/pages/AuditPage.vue` | Admin-only table: timestamp, user, action, target, details |
| NixOS module | `nixos/default.nix` | `auditLogDir` and `auditRetentionDays` options |

**Audited actions:**
- VM: start, stop, restart, create, delete
- Network: bridge create/delete, firewall rule add/remove, IP pool change
- Auth: login, logout, failed login, password change
- Admin: user create, role change, user delete
- Settings: distro add/remove, catalog refresh, AI settings change

**Tests:**
- Backend: audit service (log, query, pagination, filtering, retention)
- Backend: audit middleware (auto-logging on mutations)
- E2E: perform actions, verify audit page shows entries

---

## Track 2: License Key System

**Agent:** [v1-license](../agents/v1-license.md)
**Independent — can run in parallel with Track 1**

Replace `PREMIUM_ENABLED` boolean with a 4-tier license key system.

| Decision | Resolution | Rationale |
|----------|-----------|-----------|
| Tier model | **4-tier: demo / free / premium / enterprise** | Demo (no key) for eval. Free key from registration enables adoption tracking without telemetry. |
| Key format | `CL-<tier>-<payload>-<checksum>` | Self-describing, offline-validatable. Tiers: `FRE`, `PRE`, `ENT` |
| HMAC secret | **`LICENSE_HMAC_SECRET` env var** | Works with NixOS secrets (sops-nix, agenix). Random default in dev with startup warning. |
| Expiry model | Free = perpetual, Premium = perpetual, Enterprise = annual | Homelabbers hate subscriptions |

**Deliverables:**

| Component | File(s) | Description |
|-----------|---------|-------------|
| License module | `backend/src/license.ts` | Key parsing, HMAC validation, tier extraction, expiry check |
| Config changes | `backend/src/config.ts` | Replace `premiumEnabled: boolean` with `tier: Tier`, add `licenseExpiry` |
| Route guard update | All premium routes | Replace `if (!config.premiumEnabled)` with `requireTier(config, 'premium')` |
| Health response | `backend/src/routes/health.ts` | Add `tier` and `tierExpiry` to response |
| Frontend store | `src/stores/app.ts` | Replace `premiumEnabled` with `tier`, add `isPremium`/`isEnterprise` getters |
| Frontend gating | All premium-gated components | Replace `premiumEnabled` checks with tier checks |
| License settings | `src/pages/SettingsPage.vue` | License section: enter key, show tier badge, show expiry |
| NixOS module | `nixos/default.nix` | Add `licenseKey`, `licenseKeyFile` options, deprecate `premiumEnabled` |
| Key generator | `scripts/generate-license.sh` | Internal CLI tool (not shipped) |
| Backwards compat | Config | `PREMIUM_ENABLED=true` maps to premium tier with deprecation warning |

**Tests:**
- Backend: license parsing (valid keys, invalid format, expired, wrong checksum)
- Backend: tier enforcement (free blocked from premium routes, premium blocked from enterprise)
- Backend: backwards compatibility (PREMIUM_ENABLED=true still works)
- Frontend: tier badge display, UI gating
- E2E: enter license key, verify premium features unlock

---

## Track 3: Security Hardening

**Agent:** [v1-security](../agents/v1-security.md)
**Independent — can run in parallel with Tracks 1 and 2**

Harden the application for production deployment.

**Deliverables:**

| Component | File(s) | Description |
|-----------|---------|-------------|
| Rate limiting | `backend/src/plugins/rate-limit.ts` | @fastify/rate-limit: 100 req/min general, 10/min auth |
| CORS config | `backend/src/plugins/cors.ts` | @fastify/cors: configurable origin whitelist |
| Helmet (CSP) | `backend/src/plugins/helmet.ts` | @fastify/helmet: CSP, X-Frame-Options, etc. |
| Input sanitization | Route handlers | Verify all user inputs go through Zod schemas |
| WebSocket auth | `backend/src/routes/ws.ts` | Require valid token for WebSocket connections |
| HTTPS enforcement | `nixos/default.nix` | Document HTTPS setup, add `forceHttps` option |
| Dependency audit | `scripts/security-audit.sh` | Enhance npm audit script, add to CI |
| Error handling | All routes | Ensure no stack traces or internal details leak in production |
| Secret management | Documentation | Guide for managing API keys, license keys, HMAC secrets |
| Security headers | Nginx config | Document recommended nginx security headers |

**Tests:**
- Backend: rate limiting (verify 429 after threshold)
- Backend: CORS (verify blocked origin rejected)
- Backend: error responses (no stack traces in production mode)
- Security: npm audit passes with no high/critical vulnerabilities

---

## Final: Release Preparation

**Agent:** [v1-release](../agents/v1-release.md)
**Depends on:** All three tracks complete

**Deliverables:**

| Task | Description |
|------|-------------|
| Version bump | Update `package.json` and `backend/package.json` to `1.0.0` |
| CHANGELOG | Create `CHANGELOG.md` with all features from v0.1 through v1.0 |
| Production docs | `docs/deployment/PRODUCTION-GUIDE.md` — step-by-step NixOS deployment |
| Demo site | Deploy to `weaver-demo.github.io` with sample data |
| Sync-to-free | Verify `sync-to-free.yml` workflow works end-to-end |
| NUR package | Publish/update NUR package |
| Git tag | Tag `v1.0.0` on main |
| GitHub release | Create release with changelog notes |
| README rewrite | Update Dev and Free repo READMEs for v1.0 |
| Post-release tests | Run `testing/post-release/` verification suite |

---

## Files Summary

### New files

| File | Track | Purpose |
|------|-------|---------|
| `backend/src/models/user.ts` | Auth | User type definition |
| `backend/src/models/audit.ts` | Audit | Audit entry type |
| `backend/src/storage/user-store.ts` | Auth | User persistence |
| `backend/src/storage/session-store.ts` | Auth | SessionStore adapter interface |
| `backend/src/storage/memory-session-store.ts` | Auth | In-memory session adapter (free/demo) |
| `backend/src/storage/sqlite-session-store.ts` | Auth | SQLite session adapter (premium) |
| `backend/src/storage/audit-store.ts` | Audit | Audit log persistence |
| `backend/src/services/auth.ts` | Auth | Authentication logic |
| `backend/src/services/audit.ts` | Audit | Audit logging |
| `backend/src/routes/auth.ts` | Auth | Auth endpoints |
| `backend/src/routes/users.ts` | RBAC | User management endpoints |
| `backend/src/routes/audit.ts` | Audit | Audit query endpoints |
| `backend/src/schemas/auth.ts` | Auth | Zod validation |
| `backend/src/middleware/auth.ts` | Auth | JWT validation hook |
| `backend/src/middleware/rbac.ts` | RBAC | Role enforcement hook |
| `backend/src/middleware/audit.ts` | Audit | Auto-logging hook |
| `backend/src/license.ts` | License | Key validation |
| `backend/src/plugins/rate-limit.ts` | Security | Rate limiting |
| `backend/src/plugins/cors.ts` | Security | CORS configuration |
| `backend/src/plugins/helmet.ts` | Security | Security headers |
| `src/pages/LoginPage.vue` | Auth | Login form |
| `src/pages/UsersPage.vue` | RBAC | User management |
| `src/pages/AuditPage.vue` | Audit | Audit log viewer |
| `src/stores/auth-store.ts` | Auth | Auth state |
| `src/composables/useAuth.ts` | Auth | Auth utilities |
| `scripts/generate-license.sh` | License | Key generation (internal) |
| `docs/deployment/PRODUCTION-GUIDE.md` | Release | Deployment guide |
| `CHANGELOG.md` | Release | Release notes |

### Modified files

| File | Track | Change |
|------|-------|--------|
| `backend/src/config.ts` | License | `premiumEnabled` → `tier` enum |
| `backend/src/index.ts` | All | Register new routes, plugins, middleware |
| `backend/src/routes/health.ts` | License | Add `tier`, `tierExpiry` |
| `backend/src/routes/vms.ts` | RBAC | Add role middleware |
| `backend/src/routes/network.ts` | RBAC | Add role middleware |
| `backend/src/routes/network-mgmt.ts` | RBAC + License | Add role + tier middleware |
| `backend/src/routes/ws.ts` | Security | Add WebSocket auth |
| `src/services/api.ts` | Auth | Add Authorization header |
| `src/stores/app.ts` | License | `premiumEnabled` → `tier` |
| `src/router/routes.ts` | Auth | Add route guards, login route |
| `src/layouts/MainLayout.vue` | RBAC | Role-based nav items |
| `nixos/default.nix` | All | License, auth, audit options |
| `package.json` | Release | Version 1.0.0 |
| `backend/package.json` | Release | Version 1.0.0, new dependencies |

---

## Verification Checklist

1. `npm run test:prepush` passes (lint + typecheck + unit + security)
2. E2E tests pass in Docker (`testing/e2e-docker/`)
3. Login flow works (create admin, login, redirect to dashboard)
4. Viewer role: can see dashboard, cannot start/stop VMs
5. Operator role: can manage VMs, cannot manage users or settings
6. Admin role: full access including user management and audit log
7. License key: enter premium key in settings, premium features unlock
8. No license: demo mode, limited functionality
9. Free license key: full free tier features, adoption tracked at issuance
9. Rate limiting: rapid requests return 429
10. Audit log: all VM actions appear in audit page
11. Demo site deploys and shows sample data
12. Sync-to-free pushes correctly (no CLAUDE.md, no docs/planning/)
13. `v1.0.0` tag created and GitHub release published

---

*Cross-reference: [MASTER-PLAN.md](../MASTER-PLAN.md) | [EXECUTION-ROADMAP.md](../v1.0.0/EXECUTION-ROADMAP.md) | [TIER-MANAGEMENT.md](../business/product/TIER-MANAGEMENT.md)*
