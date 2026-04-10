<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-H-3-audit-ui — Audit Log UI Page

**Priority:** High #3
**Tier:** Enterprise
**Parallelizable:** Yes (independent — backend already complete)
**Plan:** [EXECUTION-ROADMAP Phase 6 — Rate Limiting & Audit](../../../plans/v1.0.0/EXECUTION-ROADMAP.md)

---

## Scope

Add the frontend audit log viewer page. The backend is fully implemented (audit store, audit service, GET /api/audit with filtering and pagination). This agent adds only the missing UI.

### What's Already Done

- `backend/src/storage/audit-store.ts` — JSON-backed audit log storage
- `backend/src/services/audit.ts` — AuditService with query/filtering
- `backend/src/routes/audit.ts` — GET /api/audit (admin/operator) with filters: userId, action, resource, since, until, success, limit, offset
- Audit middleware logs all VM lifecycle, auth events, admin actions, field updates
- Security events emitted (auth failures, unauthorized access)

### What's Missing

- `AuditPage.vue` — Admin-only table with filters
- `/audit` route in router
- Nav item in sidebar

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/routes/audit.ts` | API contract — query params, response shape |
| `backend/src/models/audit.ts` | AuditEntry interface |
| `src/pages/WorkbenchPage.vue` | Page layout pattern |
| `src/router/routes.ts` | Route registration pattern |
| `src/layouts/MainLayout.vue` | Nav item pattern |
| `src/stores/auth-store.ts` | Role-based nav gating pattern |

---

## Outputs

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/pages/AuditPage.vue` | New | Table: timestamp, user, action, resource, success/fail, IP. Filters: date range, action type, user, resource. Pagination. |
| `src/composables/useAudit.ts` | New | Fetch audit entries from GET /api/audit with reactive filter/pagination state |
| `src/router/routes.ts` | Modify | Add `/audit` route (admin guard + enterprise tier gate) |
| `src/layouts/MainLayout.vue` | Modify | Add Audit nav item (visible when admin + enterprise) |

### Tests

| File | Type | Description |
|------|------|-------------|
| `testing/e2e/audit-ui.spec.ts` | New | Navigate to audit page, verify entries appear, filter by action |

---

## UI Design

```
┌─ Audit Log ──────────────────────────────────────────────────────┐
│                                                                    │
│  Filters:  [Date range ▾]  [Action ▾]  [User ▾]  [Resource ▾]    │
│                                                                    │
│  ┌──────────┬──────────┬────────────┬───────────┬────┬──────────┐ │
│  │ Time     │ User     │ Action     │ Resource  │ OK │ IP       │ │
│  ├──────────┼──────────┼────────────┼───────────┼────┼──────────┤ │
│  │ 14:32:01 │ admin    │ vm:start   │ web-nginx │ ✓  │ 10.0.0.1 │ │
│  │ 14:31:45 │ admin    │ auth:login │ admin     │ ✓  │ 10.0.0.1 │ │
│  │ 14:30:12 │ unknown  │ auth:login │ admin     │ ✗  │ 10.0.0.5 │ │
│  └──────────┴──────────┴────────────┴───────────┴────┴──────────┘ │
│                                                                    │
│  Showing 1–50 of 234          [← Prev]  [Next →]                  │
└────────────────────────────────────────────────────────────────────┘
```

- Use `q-table` with server-side pagination
- Success column: green check / red X
- Action column: color-coded by category (VM=blue, Auth=orange, Admin=purple)
- Date range picker for time filtering
- Refresh button for live monitoring

---

## Flow Notes

Request hits auth.ts (JWT + userId) → router guard checks `isEnterprise && isAdmin` → AuditPage loads.
`useAudit.ts` composable calls `GET /api/audit` with filter/pagination query params.
Backend `audit.ts` route already handles filtering, pagination, and admin/operator RBAC — no new middleware needed.
This is a read-only UI over an existing API. No mutations, no WebSocket impact.

---

## Tier Blind Spot Mitigation

**This feature is enterprise-only.** Standard dev/E2E runs at premium.

**Mitigation:**
- E2E tests verify that the Audit nav item is **not visible** at premium tier (backwards compat)
- E2E tests verify that navigating directly to `/audit` at premium tier redirects or shows 403
- Unit tests for `useAudit.ts` composable can run at any tier (API mocking)
- Before release: temporarily switch localhost to enterprise (`LICENSE_KEY=WVR-ENTERPRISE-...`) and manually verify page loads, filters work, pagination works

---

## E2E Notes

- **No shared state risk** — audit log is read-only, tests don't mutate it
- **Temp resources:** Not needed — reading existing audit entries is safe
- **Environment gaps:** E2E runs at premium tier, so audit page should be gated/hidden. E2E spec should verify the gate, not the page content
- **Positive content test:** Only possible if E2E environment is switched to enterprise tier, or via unit tests with mocked API responses

---

## Acceptance Criteria

1. Audit page accessible at `/audit` for enterprise admin users
2. Table shows timestamp, user, action, resource, success, IP
3. Filters work: date range, action type, user, resource
4. Pagination works (50 per page default)
5. Non-enterprise users don't see Audit nav item
6. Non-admin users get redirected from /audit
7. All existing tests pass
8. `npm run test:precommit` passes

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| AuditPage.vue + useAudit composable | 45 min |
| Router + nav integration | 10 min |
| Tests | 20 min |
| **Total** | **~1.5 hours** |

---

## Documentation

| Target | Updates |
|--------|----------|
| `src/pages/HelpPage.vue` | Add "Audit Log" help section (enterprise feature) |
| `docs/DEVELOPER-GUIDE.md` | Add AuditPage to page inventory |
