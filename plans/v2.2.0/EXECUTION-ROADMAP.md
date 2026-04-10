<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v2.2.0 (Weaver Team — Peer Federation)

**Last updated:** 2026-03-25

Weaver Team peer federation: full management of remote Weaver hosts (up to 2 peers), Tailscale peer discovery, license key split (Solo/Team). Fabrick Basic Clustering ships at v2.3.0 with its own isolated multi-node test environment. For the full product roadmap and decision log, see [MASTER-PLAN.md](../../MASTER-PLAN.md).

## Solo-First Sequencing Principle

v2.2.0 is the first release that introduces Weaver Team as a distinct buyer variant. All features in v1.0–v2.1 are Solo-compatible (single admin, single host). Team features land on top of a proven Solo foundation — not in parallel.

**Why:** Multi-user introduces session isolation, role enforcement, audit trail correctness, and workload group scope. Building on a stable Solo base means these concerns are isolated, not entangled with core feature development. Solo revenue through v1.x–v2.1 also validates demand before the Team compliance layer is invested in.

**In the demo:** the DemoTierSwitcher shows a Solo/Team sub-tab within the Weaver tier at v2.2+. Solo tab first — walk investors through the complete Solo story, then show Team as an additive layer. "Everything Solo has, plus organizational buying features." This framing makes the pricing delta ($149/yr flat vs $129/user/yr) immediately legible as value, not upsell friction.

## Phase Overview

```
v2.2.0: Basic Clustering                           ░░░░░░░░░░░░░░░░░░░░  PLANNED
```

## Detailed Plans

- Multi-node architecture: [V2-MULTINODE-PLAN.md](../v2.0.0/V2-MULTINODE-PLAN.md)

---

## v2.2.0: Basic Clustering

### Weaver Team — Peer Weaver Federation (Decision #76, #77, #78)

| Task | Tier | Priority |
| --- | --- | --- |
| License key backend: split `WVR-PRE` → `WVR-WVS` (Solo) and `WVR-WVT` (Team) | Weaver | High |
| Peer registration UI — add peer Weaver by IP/hostname or Tailscale host | Weaver Team | High |
| Tailscale peer detection — discover Weaver instances on the Tailnet | Weaver Team | Medium |
| REST+WS peer protocol — full workload management of remote Weaver | Weaver Team | High |
| Remote workload display in Weaver — host badge, full management rendering | Weaver Team | High |
| Upgrade prompt on peer limit reached ("More hosts — requires Fabrick") | Weaver Team | High |
| Peer health indicator — connection status for each registered peer | Weaver Team | Medium |

**Fabrick Basic Clustering moved to v2.3.0** — agent extraction, hub-spoke, multi-node visibility, manual migration, gRPC protocol, nixos-facter, nixos-anywhere, Colmena, and Attic all ship at v2.3.0 with their own isolated test environment. See [plans/v2.3.0/EXECUTION-ROADMAP.md](../v2.3.0/EXECUTION-ROADMAP.md).

> **Strategic significance:** Splitting Weaver Team (v2.2) from Fabrick Clustering (v2.3) means Team revenue unlocks without waiting for multi-node gRPC infrastructure. Each version has its own test environment — single-node peer federation (v2.2) vs multi-node cluster (v2.3).

---

## AI Blue/Green Workflow (v2.2.0) — Decision #112

Full productized workflow for the Team audience. Bridge active routing infrastructure ships at v1.4.0; this release adds the team-coordinated workflow layer on top.

| Task | Tier | Priority |
| --- | --- | --- |
| Blue/green named workflow: clone → configure → test → shift bridge weight → confirm/rollback | Weaver Team | High |
| AI orchestration of full blue/green cycle — AI manages traffic shift and rollback decision | Weaver Team | High |
| Team approval workflow for traffic shifts — visible to all team members before shift commits | Weaver Team | Medium |
| In-flight deployment visibility — shared view of active blue/green operations across team | Weaver Team | Medium |

> **Upgrade trigger:** Solo users who discover bridge weight controls at v1.4.0 and want team-coordinated approval workflows hit the natural Weaver Team ceiling here.

---

## AI & GPU Infrastructure (v2.2)

From the [AI-GPU-INFRASTRUCTURE-PLAN.md](../cross-version/AI-GPU-INFRASTRUCTURE-PLAN.md):

| Task | Tier | Priority |
| --- | --- | --- |
| GPU reservation per-workload-group — reserve specific GPUs for groups | Fabrick | High |
| GPU queue (FIFO/priority) — workloads queue for GPU access | Fabrick | High |
| GPU preemption — evict lower-priority workloads for higher-priority | Fabrick | Medium |
| Multi-GPU topology-aware assignment (NUMA, PCIe bus) | Fabrick | Medium |
| Fleet-level inference metrics aggregation | Fabrick | Medium |
| Snapshot-based auto-scaling via set points (Decision #95, #119) | Fabrick | High |
| Per-user configurable AI rate limits (Decision #128) | Weaver Team | High |

---

## Release Plan

| Version | Milestone | Key Features | Status |
| --- | --- | --- | --- |
| v2.2.0 | Weaver Team | Peer federation, full remote workload management (up to 2 peers), Tailscale peer discovery, AI blue/green workflow (Decision #112) | Planned |
| v2.3.0 | Fabrick Basic Clustering | Multi-node visibility, manual migration, config sync — **fabrick moat-breaker** | Planned |

---

---

## v3.3 Scaffold (invisible — ships in this version)

v2.2 is the first release with multi-host context. The WorkloadGroup API skeleton
lands here, feature-flagged off for all customers. An FM customer who needs
v3.3 features early gets their license key updated — no code deployment needed.

| Task | Notes |
|------|-------|
| `WorkloadGroupStore` — CRUD against the v1.2 DB stubs | Read/write group records. No service layer above it yet. |
| `GET /api/groups` | Returns `[]` unless `compliancePackEnabled` in license key. Admin only. |
| `POST /api/groups` | Creates a group record. Feature-flagged. Admin only. |
| `PUT /api/groups/:id` | Updates name/description/members. Feature-flagged. Admin + owner. |
| `DELETE /api/groups/:id` | Feature-flagged. Admin only. |
| `GET /api/groups/:id/members` | Feature-flagged. |
| `PUT /api/groups/:id/members` | Add/remove users from a group. Feature-flagged. |
| Emit `group.*` audit events | Wire to `AuditAction` types already defined in `audit-store.ts`. |

No UI ships. These are API-only, gated behind the `compliancePackEnabled` license
flag. An FM customer with the flag set gets functional group management via API
immediately. The admin UI lands at v3.3.

*See [plans/v3.3.0/EXECUTION-ROADMAP.md](../v3.3.0/EXECUTION-ROADMAP.md) for full context.*

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
