<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-audit — Audit Logging

**Plan:** [V1-PRODUCTION-PLAN](../plans/V1-PRODUCTION-PLAN.md) (Track 1c)
**Parallelizable:** After v1-auth (requires user identity on requests)
**Blocks:** None

---

## Scope

Log all meaningful user actions with who, what, when, and from where. Provide an admin-only audit log viewer in the UI with filtering and pagination.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/middleware/auth.ts` | How user identity is attached to requests |
| `backend/src/routes/vms.ts` | Mutating routes to auto-log |
| `backend/src/routes/network-mgmt.ts` | Mutating routes to auto-log |
| `backend/src/storage/distro-store.ts` | JSON file storage pattern |
| `backend/src/config.ts` | Config pattern for dataDir |
| `src/pages/WorkbenchPage.vue` | Page layout patterns |
| `nixos/default.nix` | NixOS module options pattern |

---

## Inputs

- v1-auth complete: User identity available on every authenticated request
- All mutating routes identified in the role permission matrix

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/models/audit.ts` | New | `AuditEntry`: id, timestamp, userId, username, action, target, details, ip, userAgent |
| `backend/src/storage/audit-store.ts` | New | Append-only JSON file, rotation by date, configurable retention |
| `backend/src/services/audit.ts` | New | `AuditService`: logAction(), query(), purgeOld() |
| `backend/src/middleware/audit.ts` | New | Fastify onResponse hook for auto-logging mutating requests |
| `backend/src/routes/audit.ts` | New | GET /api/audit (admin-only) with pagination, date range, action filter, user filter |
| `backend/src/schemas/audit.ts` | New | Zod schemas for query params |
| `backend/src/index.ts` | Modify | Register audit routes, apply audit middleware |
| `nixos/default.nix` | Modify | Add `auditLogDir`, `auditRetentionDays` options |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/pages/AuditPage.vue` | New | Admin-only table: timestamp, user, action, target, details |
| `src/composables/useAudit.ts` | New | Fetch audit entries with filter/pagination params |
| `src/router/routes.ts` | Modify | Add /audit route (admin-only, gated by rbac) |
| `src/layouts/MainLayout.vue` | Modify | Add Audit nav item (admin-only) |

### Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/services/audit.spec.ts` | New | Log, query, pagination, filtering, date range, retention |
| `backend/tests/middleware/audit.spec.ts` | New | Auto-logging on POST/PUT/DELETE, not on GET |
| `backend/tests/routes/audit.spec.ts` | New | Admin can query, non-admin 403, pagination |
| `testing/e2e/audit.spec.ts` | New | Perform actions, navigate to audit page, verify entries |

---

## Audited Actions

| Category | Action | Target | Details |
|----------|--------|--------|---------|
| VM | vm:start | VM name | — |
| VM | vm:stop | VM name | — |
| VM | vm:restart | VM name | — |
| VM | vm:create | VM name | distro, hypervisor, memory |
| VM | vm:delete | VM name | — |
| Network | network:bridge:create | Bridge name | subnet, gateway |
| Network | network:bridge:delete | Bridge name | — |
| Network | network:firewall:add | Rule ID | source, dest, action |
| Network | network:firewall:delete | Rule ID | — |
| Network | network:ippool:update | Bridge name | range |
| Auth | auth:login | Username | success/failure, IP |
| Auth | auth:logout | Username | — |
| Auth | auth:login:failed | Username | IP, reason |
| Auth | auth:password:change | Username | — |
| Admin | admin:user:create | Username | role |
| Admin | admin:user:role:change | Username | oldRole → newRole |
| Admin | admin:user:delete | Username | — |
| Settings | settings:distro:add | Distro name | format |
| Settings | settings:distro:delete | Distro name | — |
| Settings | settings:catalog:refresh | — | source URL |
| Agent | agent:diagnose | VM name | vendor |

---

## Audit Entry Schema

```typescript
interface AuditEntry {
  id: string           // UUID
  timestamp: string    // ISO 8601
  userId: string       // User ID who performed action
  username: string     // Username (denormalized for readability)
  action: string       // e.g., 'vm:start', 'auth:login'
  target: string       // What was acted upon
  details?: Record<string, unknown>  // Additional context
  ip: string           // Client IP
  userAgent?: string   // Browser/client info
  statusCode: number   // HTTP response code (success/failure indicator)
}
```

---

## Storage Design

- **File format:** One JSON file per day: `audit-2026-02-12.json`
- **Location:** `{dataDir}/audit/` (configurable via `AUDIT_LOG_DIR`)
- **Retention:** Default 90 days, configurable via `AUDIT_RETENTION_DAYS`
- **Cleanup:** On startup + daily interval, delete files older than retention
- **Performance:** Append-only writes, read queries scan relevant date range files
- **Rotation:** One file per day keeps individual files manageable

---

## Query API

```
GET /api/audit
  ?page=1
  &limit=50
  &from=2026-02-01T00:00:00Z
  &to=2026-02-12T23:59:59Z
  &action=vm:start
  &user=admin
  &target=web-nginx

Response: { entries: AuditEntry[], total: number, page: number, limit: number }
```

---

## Acceptance Criteria

1. Every mutating API call (POST, PUT, DELETE) creates an audit entry
2. Auth events (login, logout, failed login) are logged
3. Admin can view audit log with filtering by date, action, user, target
4. Pagination works correctly (50 entries per page default)
5. Non-admin users get 403 when accessing audit endpoint
6. Audit files rotate daily, old files purged after retention period
7. Audit entries include accurate IP and username
8. Failed actions (4xx/5xx responses) are logged with status code
9. All existing tests pass
10. `npm run test:precommit` passes

---

## Estimated Effort

Backend: 2 days
Frontend: 1 day
Tests: 1 day
Total: **4 days**

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Add Audit section: audit model, storage, middleware, routes, audited actions list |
| `src/pages/HelpPage.vue` | Add "Audit Log" help section explaining where to find it and what it tracks |
| `docs/development/LESSONS-LEARNED.md` | Capture append-only storage pattern, audit middleware auto-logging approach |
