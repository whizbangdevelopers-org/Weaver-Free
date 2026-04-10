<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v3.3.0 (Fabrick Maturity)

**Last updated:** 2026-03-24
**Status:** Planning — Decision #88 extends scope (compliance dimensions, AI policy, access inspector)

Depends on: Fabrick foundation (v3.0.0) — host enrollment, inter-host comms, fleet API, auth-sso plugin (v1.2.0).

v3.3 is the Fabrick maturity release. v3.0 ships the Fabrick control plane. v3.3 makes it an fabrick-grade identity and access management system. The headline feature is **Workload Scope** — cross-host scoped Weaver views driven by workload groups, IdP group mapping, and a lightweight access request workflow packaged as an add-on module.

---

## Strategic Position

```
v3.0  Fabrick fleet control plane — closes the initial Enterprise deal
v3.3  Enterprise RBAC maturity — drives expansion/renewal conversation
v4.0  Platform + Verticals (SaaS plane, extension SDK) — decision gate at v2.2
```

v3.3 is the land-and-expand step. Enterprise customers buy v3.0 for fleet control. v3.3 gives their compliance teams what they need: formal group-based access, IdP-driven provisioning, approval workflows, and an audit trail. It is sold as an **Fabrick Compliance Pack** add-on module — not a free upgrade.

---

## Pricing: Fabrick Compliance Pack (Add-on Module)

Positioned separately from the base Fabrick tier. Target buyers: compliance officers, security teams, IT directors at healthcare, defense, financial services, and pharma accounts — the same verticals already identified in business/sales/.

- Base Fabrick: fleet control, workload management, Fabrick
- + Fabrick Compliance Pack: workload groups, RBAC depth, IdP group sync, access request workflow, group audit trail

This preserves the base Fabrick price point while creating an expansion SKU. Existing v3.0 Enterprise customers are NOT auto-upgraded — they get a renewal conversation.

See [MASTER-PLAN.md](../../MASTER-PLAN.md) for tier model detail.

---

## Phase Overview

```
v3.3.0 Phase 1 — Workload Groups (data model, admin UI, basic assignment)
v3.3.0 Phase 2 — Scoped Weaver View (cross-host union, host badges, toolbar)
v3.3.0 Phase 3 — IdP Group Mapping (auth-sso → workload group sync)
v3.3.0 Phase 4 — Access Request Workflow (lightweight — request, queue, approve/deny)
v3.3.0 Phase 5 — AI Tool Policy Enforcement (group-level BYOV policy, backend enforcement)
v3.3.0 Phase 6 — Access Inspector / "View as" (admin verifies user+group scope and AI policy)
v3.3.0 Phase 7 — Compliance Pack audit trail + packaging
```

---

## What Arrives Pre-Built

v3.3 is the UI and workflow release. The infrastructure arrives incrementally across
earlier versions so no version carries an unreasonable load and FM fast-track is
always possible.

| Version | What lands | Plan reference |
|---------|-----------|----------------|
| **Now** (pre-v1.2) | Typed `AuditAction` union, `AuditResourceType`, `group.*` / `access.*` event names pre-registered. `src/types/rbac.ts` interface contracts. | This session, 2026-03-23 |
| **v1.2** | DB table stubs: `workload_groups`, `access_requests`. Schema locked, no routes, no UI. | [v1.2.0 scaffold section](../v1.2.0/EXECUTION-ROADMAP.md#v35-scaffold-invisible--ships-in-this-version) |
| **v2.2** | `WorkloadGroupStore` + feature-flagged CRUD API (`GET/POST/PUT/DELETE /api/groups`, membership routes). No UI. `group.*` audit events wired. FM customers with `compliancePackEnabled` key get live group management via API. | [v2.2.0 scaffold section](../v2.2.0/EXECUTION-ROADMAP.md#v35-scaffold-invisible--ships-in-this-version) |
| **v3.0** | `GET /api/fabric/workloads/all`, `GET /api/scope/workloads`, `user.groups[]` field, `/workload/:hostId/:name` route. | [v3.0.0 scaffold section](../v3.0.0/EXECUTION-ROADMAP.md#v35-scaffold-invisible--ships-in-this-version) |

**v3.3 delivers:** admin UI, scoped Weaver view, IdP group sync, access request
workflow UI, compliance reports, public GA. No new infrastructure — activation and UI only.

**FM fast-track at any point after v2.2:** set `compliancePackEnabled` in license key,
fast-track the missing UI layer as a sprint. DB and API are already live.

---

## Scaffold Already In Place

The following infrastructure was added before v3.3 development begins, so it is
available for FM fast-track without schema redesign. Each item is production-safe —
gated or additive, no breaking changes to existing callers.

| File | What was done | When |
|------|--------------|------|
| `code/backend/src/storage/audit-store.ts` | `action: string` → typed `AuditAction` union. `group.*` and `access.*` event names pre-registered. New `AuditResourceType` field + `resourceType` query filter. Existing entries and callers unaffected (field is optional, union is a superset of existing strings). | 2026-03-23 |
| `code/backend/src/services/audit.ts` | `AuditLogParams.action` typed to `AuditAction`. `resourceType` forwarded to store. Re-exports new types. | 2026-03-23 |
| `code/backend/src/routes/audit.ts` | API boundary cast — free-form query param `?action=` still accepted from clients, cast to `AuditAction` internally. | 2026-03-23 |
| `code/src/types/rbac.ts` | **Interface contracts only — no implementation.** `WorkloadGroup`, `WorkloadGroupMember`, `ScopedWorkloadInfo`, `AccessRequest`, `ApprovalStep`, `AccessRequestStatus`, `AccessRequestQueueSummary`. State machine transitions documented inline. | 2026-03-23 |

**FM fast-track readiness:** audit schema is locked, RBAC contracts are defined,
type system is ready. Fast-track requires: DB table stubs (backend), CRUD API routes
(feature-flagged), and UI. No redesign work.

---

## Phase 1: Workload Groups

### Data Model

```typescript
type ComplianceFramework =
  | 'hipaa' | 'pci-cde' | 'cmmc' | 'cui' | 'itar'
  | 'sox'   | 'ferpa'   | 'gxp'  | 'iec62443'

type AiGroupPolicy = 'allow-all' | 'claude-only' | 'local-only' | 'none'

interface WorkloadGroup {
  id: string
  name: string
  description?: string
  owners: string[]                              // userIds — dept heads
  idpGroupDn?: string                           // LDAP DN or OIDC group claim (Phase 3)
  members: Array<{ hostId: string; vmName: string }>
  // Decision #88 additions:
  complianceFrameworks: ComplianceFramework[]   // [] = no framework tag; multiple allowed
  aiPolicy: AiGroupPolicy                       // inherited by all member workloads; wins over BYOV
}
```

**Group type taxonomy** (from vertical analysis, Decision #88) — the compliance framework tags
map directly to real-world isolation boundaries customers already manage:

| Tag | Vertical(s) | Isolation requirement |
|-----|-------------|----------------------|
| `hipaa` | Healthcare, pharma | ePHI boundary, BAA-covered AI only |
| `pci-cde` | Finance, retail | Cardholder data environment isolation |
| `cmmc` | Defense contractors | CMMC level 2/3 CUI boundary |
| `cui` | Defense, government | Controlled Unclassified Information |
| `itar` | Defense, aerospace | Foreign national access restriction, air-gapped AI |
| `sox` | Finance, public co. | SoD enforcement — operator ≠ approver |
| `ferpa` | Education | Student records isolation |
| `gxp` | Pharma, life sciences | 21 CFR Part 11 / Annex 11 validated environment |
| `iec62443` | Manufacturing | IT/OT zone boundary |

User model gains:
```typescript
// Existing user record extended
groups: string[]   // WorkloadGroup IDs
```

### Backend

| Task | Tier | Priority |
|------|------|----------|
| `WorkloadGroupStore` — CRUD, persistence, owner validation | Fabrick | High |
| `GET /api/groups` — list groups (admin: all, owner: theirs) | Fabrick | High |
| `POST /api/groups` — create group (admin only) | Fabrick | High |
| `PUT /api/groups/:id` — update name/description/members (admin + owner) | Fabrick | High |
| `DELETE /api/groups/:id` — delete group (admin only) | Fabrick | High |
| `GET /api/groups/:id/members` — list users in group | Fabrick | High |
| `PUT /api/groups/:id/members` — add/remove users (admin + owner) | Fabrick | High |
| Middleware: group ownership gate (`requireGroupOwner`) | Fabrick | High |
| `tier-matrix.json` — new `workload-groups` entry | Fabrick | High |

### Admin UI

New page: `/groups` — accessible to admin (full) and group owners (scoped to their groups).

| Feature | Notes |
|---------|-------|
| Group list — name, description, owner(s), workload count, member count | |
| Create group dialog — name, description, assign owners, pick workloads from fleet | |
| Workload picker — grouped by host, checkbox per workload (calls `GET /api/fabric/workloads/all`) | |
| Member manager — add/remove users from a group (admin: any group, owner: their groups) | |
| IdP group link field — visible only when auth-sso plugin active (Phase 3) | |

Sidebar entry: `/groups` — visible to admin and group owners (Fabrick only).

---

## Phase 2: Scoped Weaver View

### What it is

When a user is a member of one or more workload groups, navigating to `/weaver` shows a cross-host union of their assigned workloads instead of the full single-host workload list. Each card carries a host badge so the user knows where the workload lives.

Admin users always see the full single-host view regardless of group membership.

### Routing

All workload detail links in cross-host contexts move to `/workload/:hostId/:name`. This resolves name collision across hosts (two hosts can both have `api-service`). Single-host Weaver links continue working — the `:hostId` segment is optional in the router, defaults to the local host.

### Backend

| Task | Tier | Priority |
|------|------|----------|
| `GET /api/scope/workloads` — returns union of caller's groups' workloads across hosts | Fabrick | High |
| Fabrick hub: fan-out to per-host Weaver agents, merge results, add `hostId + hostname` | Fabrick | High |
| Router: `/workload/:hostId/:name` — cross-host detail route | Fabrick | High |
| `tier-matrix.json` — new `workload-scope` entry | Fabrick | High |

### Frontend

| Task | Notes |
|------|-------|
| `AppState`: add `weaverScopeActive: boolean`, `weaverScopeWorkloads: ScopedWorkloadInfo[]` | |
| `AppState`: add `weaverScopeFilter`, `weaverScopeView`, `weaverScopeSort` (separate from Fabrick drill state) | Resolved: separate state fields, no bleed-over between modes |
| `activateWeaverScope()` action — calls `/api/scope/workloads`, sets scope state | |
| `WeaverPage.vue` — switch data source to `weaverScopeWorkloads` when scope active | |
| `MainLayout.vue` — scope indicator chip: `[N hosts · Weaver]` when scope active | |
| `MainLayout.vue` — sub-toolbar activation: `(isFabrickMode && drillHostId) \|\| weaverScopeActive` | |
| `WorkloadCard.vue` — optional `hostBadge?: string` prop, shown in top-right when set | |
| Router: add `/workload/:hostId/:name` route | |
| Demo: `DEMO_SCOPE_ACL` mock data — two personas (Alice: 3 workloads/2 hosts, Bob: 2 workloads/2 hosts) | |
| Demo: persona switcher in user dropdown (v3.3+, Fabrick only) | Resolved: user dropdown, not DemoToolbar |

### Toolbar Context (three modes, all use the sub-toolbar)

| Mode | Toolbar chip | Sub-toolbar |
|------|-------------|-------------|
| Fabrick drill-down | `hostname · Weaver` | `fabrickDrillFilter / View / Sort` state |
| Weaver scope | `N hosts · Weaver` | `weaverScopeFilter / View / Sort` state |
| Normal Weaver | _(none)_ | WebSocket chip + NotificationBell |

---

## Phase 3: IdP Group Mapping

Requires: `auth-sso` plugin active (shipped v1.2.0).

When a Weaver group has an `idpGroupDn` set, user scope is derived from their IdP group membership at login — not from manual `groups[]` on the user record. HR manages AD/LDAP; Weaver reflects it automatically.

### Delegation model

```
IT Admin      → creates workload groups, sets workload membership, sets idpGroupDn
Dept Head     → manages who's IN their groups (add/remove) — or this is HR's job in AD
HR / AD       → manages IdP group membership (with IdP sync, this drives Weaver scope automatically)
User          → logs in, scope auto-applied, no manual provisioning
```

### Backend

| Task | Tier | Priority |
|------|------|----------|
| Login flow: resolve caller's IdP groups → match against `idpGroupDn` fields → apply scope | Fabrick | High |
| `WorkloadGroupStore.resolveForUser(userId, idpGroups[])` — returns effective group set | Fabrick | High |
| Fallback: if no IdP groups match, fall back to manual `user.groups[]` | Fabrick | High |
| Sync hook: on IdP group change (webhook or next-login), invalidate scope cache | Fabrick | Medium |

---

## Phase 4: Access Request Workflow (Lightweight)

Packaged as part of the Fabrick Compliance Pack. Not available without the add-on.

### Flow

```
User → requests access to a group ("Request Access" button on /groups list)
     → request lands in dept head's queue (pending badge on sidebar)
Dept Head → approves or denies with optional comment
     → user notified (in-app notification)
     → on approval: user added to group, scope activates on next navigation
```

### Features

| Task | Notes |
|------|-------|
| `AccessRequest` model: requesterId, groupId, status, comment, timestamps | |
| `GET /api/groups/:id/requests` — pending queue (admin + owner) | |
| `POST /api/groups/:id/requests` — submit request (any user) | |
| `PUT /api/groups/:id/requests/:reqId` — approve/deny (admin + owner) | |
| `/groups` page: "Request Access" button per group (visible to non-members) | |
| `/groups` page: pending queue tab for owners | |
| NotificationBell: badge + event when request approved/denied | |
| Audit log entry per request action (Phase 5) | |

**Not included (deferred to v4.x or later):**
- Escalation chains
- Request expiry / time-limited access
- Approval delegation
- Multi-stage approval

---

## Phase 5: AI Tool Policy Enforcement

Decision #88. Group-level AI vendor policy enforcement. Compliance Pack feature (`compliancePackEnabled` gate).

### Policy inheritance model

```
WorkloadGroup.aiPolicy
  ↓ (wins over per-workload BYOV setting)
WorkloadInfo.aiPolicy (resolved at request time)
  ↓
Weaver backend enforces — rejects requests violating group policy
```

**Enforcement mapping by compliance framework:**

| Framework | Default AI policy | Rationale |
|-----------|------------------|-----------|
| `hipaa` | `claude-only` | BAA coverage required for ePHI workloads |
| `itar` / `cmmc` / `cui` | `local-only` | Air-gap required; no external API calls |
| `pci-cde` / `sox` / `gxp` | `claude-only` or `allow-all` | Customer choice; BAA/DPA available |
| `ferpa` / `iec62443` | `allow-all` | No mandated restriction; admin may tighten |
| _(no framework)_ | `allow-all` | Default open — BYOV per-workload applies |

### Backend

| Task | Tier | Gate |
|------|------|------|
| `WorkloadGroupStore.resolveAiPolicy(hostId, vmName)` — returns effective policy for a workload | Fabrick | `compliancePackEnabled` |
| Agent endpoint middleware: resolve group membership → check `aiPolicy` → reject if violation | Fabrick | `compliancePackEnabled` |
| Error response: `403 AI_POLICY_VIOLATION` with group name and policy in body | Fabrick | `compliancePackEnabled` |
| `tier-matrix.json` — new `group-ai-policy` entry | Fabrick | — |

### Frontend

| Task | Notes |
|------|-------|
| AI vendor picker in workload/agent UI: show policy badge when group policy is active | |
| Policy badge: `mdi-shield-lock` + framework tag, tooltip explains restriction | |
| Admin group editor: AI policy selector with framework auto-suggestion | e.g. selecting `hipaa` pre-fills `claude-only` |

---

## Phase 6: Access Inspector ("View as")

Decision #88. Revises local Decision C ("Admin impersonation — Not needed").
Compliance Pack feature (`compliancePackEnabled` gate).

### What it is

Admin-only read-only tool in the Weaver sub-toolbar. Lets an admin view a host as a
specific user OR group would see it — verifying:
- Workload visibility matches the identity's group membership
- AI tool policy is correctly enforced for that identity's workloads

**Not impersonation** — inspector mode is read-only. No VM actions permitted. No audit log
writes in inspector mode (viewing, not acting on behalf of).

### Toolbar interaction

```
Weaver sub-toolbar (default):
  [icon] Weaver  [WS chip]  ···  [search]  [user menu]

Weaver sub-toolbar (inspector active):
  [icon] Weaver  [WS chip]  [👤 jsmith · ops-group]  ···  [search]  [Exit Inspector]
```

- "View as..." button: low-profile icon button (`mdi-account-search`) in sub-toolbar, admin only
- Picker: modal with two tabs — **Users** (list with role badge) | **Groups** (list with framework tags)
- When active: `mdi-incognito` chip shows selected identity; chip is clickable to change identity
- Exit: `mdi-close` on the chip or navigate away (auto-exit)
- Read-only enforcement: all VM action buttons disabled in inspector mode; banner shown

### Backend

| Task | Tier | Gate |
|------|------|------|
| `GET /api/inspect/scope?userId=` — returns workloads visible to user | Fabrick | `compliancePackEnabled` + admin role |
| `GET /api/inspect/scope?groupId=` — returns workloads visible to group | Fabrick | `compliancePackEnabled` + admin role |
| Response includes: workload list + effective AI policy per workload | Fabrick | — |

### Frontend

| Task | Notes |
|------|-------|
| `AppState`: `inspectorMode: false`, `inspectorIdentity: { type: 'user'\|'group', id, label }` | |
| `MainLayout.vue`: "View as..." button in Weaver sub-toolbar (admin + compliancePack only) | |
| Inspector picker dialog: Users tab + Groups tab, search filter | |
| `WeaverPage.vue`: swap data source to inspector scope when `inspectorMode` active | |
| Read-only enforcement: `canManageVms` returns false in inspector mode | |
| Inspector banner: amber banner below sub-toolbar — "Viewing as [identity] · Read only" | |
| Demo: two canned inspector personas (Alice: ops-group · hipaa, Bob: dev-group · no framework) | |

---

## Phase 7: Compliance Pack Audit Trail + Packaging

### Audit trail

Every group management action written to the existing audit log (`/api/audit`):

| Event | Actor | Detail |
|-------|-------|--------|
| `group.created` | admin | group name, initial members |
| `group.member.added` | admin / owner | who added whom to which group |
| `group.member.removed` | admin / owner | who removed whom |
| `group.idp.linked` | admin | DN mapped |
| `access.requested` | user | group requested |
| `access.approved` | owner | approved by whom, when |
| `access.denied` | owner | denied by whom, reason |

### Packaging

- Feature flag: `compliancePackEnabled` (set by license key payload)
- All Phase 4 + audit features gate on `compliancePackEnabled && isEnterprise`
- Phases 1–3 (basic groups + scoped view + IdP sync) are base Fabrick — no compliance pack required
- License key format extension: `WVR-ENT-CP-<payload>-<checksum>` for Compliance Pack add-on

---

## Decisions Resolved (this session, 2026-03-23)

| # | Decision | Resolution |
|---|----------|------------|
| A | Scope definition | Workload Groups — named sets with `{ hostId, vmName }[]` members. Users assigned to groups. |
| B | Auto-activate vs toggle | Auto-activate when user has group membership. No toggle. |
| C | Admin impersonation | ~~Not needed.~~ **Revised by Decision #88.** Replaced with Access Inspector ("View as") — admin-only, read-only, compliance verification tool. Not impersonation. Compliance Pack feature. |
| D | Demo persona switcher placement | User dropdown (not DemoToolbar). Simulates logging in as a different scoped persona. |
| E | Shared vs separate filter/sort/view state | Separate. `fabrickDrillFilter/View/Sort` and `weaverScopeFilter/View/Sort` are independent. |
| F | Cross-host name collision routing | `/workload/:hostId/:name` for all cross-host links. Single-host defaults to local host. |
| G | Multiple groups per user | Yes — scope = union of all groups' workloads, deduped by `hostId:vmName`. |
| H | Group management UI | Standalone `/groups` page. Supports manual assignment + IdP group link field (when SSO active). |
| I | Access request workflow | Lightweight (option 2) — request queue, approve/deny, in-app notification. In Compliance Pack. |
| — | v3.3 pricing | Fabrick Compliance Pack add-on module. Not free upgrade. Expansion SKU at renewal. |
| — | Version slot | v3.3.0 — between Fabrick (v3.0) and Platform/Verticals (v4.0). v4.0 plan unchanged. |
| J | Compliance framework dimension | Groups carry `complianceFrameworks: ComplianceFramework[]`. Multiple frameworks per group. Tags drive audit scope, evidence labeling, inspector callouts. Base Fabrick — no Compliance Pack required. Decision #88. |
| K | AI tool policy dimension | Groups carry `aiPolicy`. Inherited by member workloads; wins over BYOV. Backend enforces. Compliance Pack. Decision #88. |
| L | Access Inspector scope | Read-only. Per-session. No audit writes in inspector mode. Auto-exits on navigation. Decision #88. |
| M | Group taxonomy | Compliance-boundary driven, not organizational. Framework tags map to real-world isolation boundaries (clearance, data class, SoD, zone, program, client, funding source). Decision #88. |

---

## Reference Plans

- Fabrick foundation (prerequisite): [plans/v3.0.0/EXECUTION-ROADMAP.md](../v3.0.0/EXECUTION-ROADMAP.md)
- auth-sso plugin (prerequisite): [plans/v1.2.0/EXECUTION-ROADMAP.md](../v1.2.0/EXECUTION-ROADMAP.md)
- Platform + Verticals (successor): [plans/v4.0.0/EXECUTION-ROADMAP.md](../v4.0.0/EXECUTION-ROADMAP.md)
- Tier model: [business/product/TIER-MANAGEMENT.md](../../business/product/TIER-MANAGEMENT.md)
- Master plan: [MASTER-PLAN.md](../../MASTER-PLAN.md)
