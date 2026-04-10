<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-M-2-vm-quotas — VM Resource Quotas

**Priority:** Medium #2
**Tier:** Enterprise
**Parallelizable:** Yes (independent)
**Plan:** [EXECUTION-ROADMAP Phase 6 — Authentication & Authorization](../../../plans/v1.0.0/EXECUTION-ROADMAP.md)

---

## Scope

Add VM resource quotas for enterprise tier. Admins can set per-user limits on: max VMs, max total memory, max total vCPUs. Quota enforcement happens at VM creation time.

### What's Already Done

- VM creation route (`POST /api/vms`) with validation
- User model with role field
- Tier system with enterprise detection

### What's Missing

- Quota model and storage
- Quota enforcement middleware on VM creation
- Admin UI for setting quotas
- Quota display in user management

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/routes/vms.ts` | VM creation route — quota check goes here |
| `backend/src/storage/vm-registry.ts` | VmDefinition — need to count user's existing VMs |
| `backend/src/services/microvm.ts` | VmInfo — how VMs are enumerated |
| `backend/src/middleware/auth.ts` | `request.userId` available for quota lookup |
| `backend/src/config.ts` | `config.tier` — enterprise detection |
| `backend/src/license.ts` | `requireTier()` pattern for gating routes |
| `backend/src/storage/` | JSON/SQLite storage patterns to follow for quota-store |
| `backend/src/routes/users.ts` | User routes — quota routes nest under `/api/users/:id/quotas` |
| `src/pages/UsersPage.vue` | Where quota editing UI will be added |
| `src/components/CreateVmDialog.vue` | Where quota usage display will be added |

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/storage/quota-store.ts` | New | Per-user quota storage: maxVms, maxMemoryMB, maxVcpus |
| `backend/src/routes/quotas.ts` | New | GET/PUT /api/users/:id/quotas (admin-only) |
| `backend/src/routes/vms.ts` | Modify | Check quotas before VM creation (enterprise only) |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/pages/UsersPage.vue` | Modify | Add quota section per user (editable limits) |
| `src/components/CreateVmDialog.vue` | Modify | Show remaining quota when enterprise (e.g., "3 of 5 VMs used") |

### Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/routes/quotas.spec.ts` | New | Set quotas, enforce on create, reject over-quota |

---

## Quota Model

```typescript
interface UserQuota {
  userId: string
  maxVms: number | null       // null = unlimited
  maxMemoryMB: number | null  // null = unlimited
  maxVcpus: number | null     // null = unlimited
}
```

- Default: all null (unlimited) — quotas are opt-in
- Only enforced when tier is enterprise
- Quota check: count user's current VMs vs limit before allowing creation

---

## Flow Notes

Admin sets quotas via `PUT /api/users/:id/quotas` → stored in `quota-store.ts`.
User creates VM via `POST /api/vms` → route preHandler loads user's quota from store → counts user's current VMs/memory/vCPUs → rejects with 409 if over limit.
Frontend: `CreateVmDialog.vue` fetches `GET /api/users/:id/quotas` on open → displays "3 of 5 VMs used" banner.
No WebSocket impact — quota is checked at creation time only, not broadcast.

---

## Safety Rules

1. Quota rejection must return 409 (not 403) with a message specifying which limit was exceeded (maxVms, maxMemoryMB, or maxVcpus)
2. Admin users are exempt from quota enforcement (admins can always create VMs)
3. Null quota values mean unlimited — never treat null as zero

---

## Tier Blind Spot Mitigation

**This feature is enterprise-only.** Standard dev/E2E runs at premium.

**Mitigation:**
- Backend unit tests (`quotas.spec.ts`) cover enforcement at all tiers: enterprise (enforced), premium (bypassed), free (bypassed)
- E2E tests verify that quota UI elements are **not visible** at premium tier
- E2E tests verify that `POST /api/vms` succeeds without quota checks at premium tier (backwards compat)
- Before release: temporarily switch localhost to enterprise and manually verify quota enforcement + CreateVmDialog usage banner

---

## E2E Notes

- **Temp resources:** MUST use `createTempUser()` for quota tests — setting quotas on shared `e2e-admin` would affect parallel tests
- **Shared state risk:** If quotas are set on shared users, VM creation tests in other specs could fail unexpectedly
- **Environment gaps:** E2E runs at premium — quota enforcement is inactive. E2E spec should verify the gate is off (no quota banner in CreateVmDialog at premium)
- **Cleanup:** `afterAll` must delete temp users to remove their quota entries

---

## Acceptance Criteria

1. Admin can set quotas per user via UsersPage
2. VM creation rejected with 403 when quota exceeded
3. Error message specifies which quota was exceeded
4. CreateVmDialog shows quota usage when applicable
5. Null quotas = unlimited (backwards compatible)
6. Quotas only enforced on enterprise tier
7. All existing tests pass
8. `npm run test:precommit` passes

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| Backend (storage + routes + enforcement) | 1 hour |
| Frontend (UsersPage + CreateVmDialog) | 45 min |
| Tests | 30 min |
| **Total** | **~2.5 hours** |

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Add quotas section: model, enforcement, API |
| `src/pages/HelpPage.vue` | Add "Resource Quotas" under enterprise features |
