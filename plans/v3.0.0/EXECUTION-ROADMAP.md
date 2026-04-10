<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v3.0.0 (Fabrick — Multi-Host Fleet Control Plane)

**Last updated:** 2026-03-16

Weaver manages one NixOS host. Fabrick connects them all. Each host runs its own Weaver instance; Fabrick is the fleet control plane that spans them. Fabrick tier exclusively.

Sales line: *"Weaver is the loom that creates your infrastructure fabric."*

Depends on: Fabrick Basic Clustering foundation (v2.3.0) and system templating (v2.1.0).

For the full product roadmap and decision log, see [MASTER-PLAN.md](../../MASTER-PLAN.md).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Fabrick Control Plane                      │
│  Fleet overview · Host selector · Aggregate health + capacity    │
└───────────┬──────────────────────┬──────────────────────────────┘
            │                      │
     ┌──────▼──────┐        ┌──────▼──────┐
     │  Weaver     │  ...   │  Weaver     │
     │   (king)    │        │   (forge)   │
     │  NixOS host │        │  NixOS host │
     └─────────────┘        └─────────────┘
```

- **Weaver** (per-host): manages the VMs, containers, networking, provisioning, AI agents on a single NixOS host. v1.0–v2.6.
- **Fabrick** (fleet): enrolls hosts, aggregates state, orchestrates cross-host operations (HA, migration, scheduling), manages edge deployments.

---

## Phase Overview

```
v3.0.0 Phase 1 — Fabrick Foundation (enrollment, inter-host comms, fleet API)
v3.0.0 Phase 2 — Fleet UI (fleet overview, host selector, per-host context)
v3.0.0 Phase 3 — HA + Live Migration (failover, migration, shared storage, scheduling)

→ Edge Fleet + Cloud Burst: v3.1.0
→ Cloud Burst self-serve billing: v3.2.0
→ Fabrick Maturity (Workload Groups, Compliance Pack): v3.3.0
```

---

## Phase 1: Fabrick Foundation (Backend)

The Fabrick hub is a separate service from each host's Weaver instance. It speaks the Weaver API and aggregates across hosts.

| Task | Tier | Priority |
|------|------|----------|
| Fabrick hub service (Fastify, separate from per-host CL) | Fabrick | High |
| Host enrollment protocol (SSH-based, stores host credentials) | Fabrick | High |
| Per-host Weaver API client (adapter pattern) | Fabrick | High |
| Fleet state aggregation API (`GET /api/fabric/hosts`, `/api/fabric/fleet`) | Fabrick | High |
| Host health heartbeat (connectivity, drift detection) | Fabrick | High |
| Fabrick authentication (JWT scoped to fabric role, hub-level admin) | Fabrick | High |

---

## Phase 2: Fleet UI

The UI patterns are proven in the private demo (v3.0+ enterprise demo switcher). These are the production implementations backed by real Fabrick API calls.

| Task | Tier | Priority |
|------|------|----------|
| Fleet overview page (`/fleet`) — host cards with health, VM/container counts, CPU/mem | Fabrick | High |
| Host selector in toolbar — dropdown switches host context across all views | Fabrick | High |
| Fleet nav item in sidebar (gated to Fabrick tier) | Fabrick | High |
| Per-host context: Weaver, Network, Resources filter to selected host | Fabrick | High |
| Fleet-wide search (find a VM across all hosts) | Fabrick | Medium |
| Host detail page (`/fleet/:hostId`) — host-level deep dive | Fabrick | Medium |

**Demo reference:** `FabrickOverviewPage.vue`, `DemoHostSelector.vue`, Fleet nav item in `MainLayout.vue` — these express the final interaction pattern. The production components replace mock data with live Fabrick API calls.

---

## Phase 3: HA + Live Migration

| Task | Tier | Priority |
|------|------|----------|
| HA failover — automatic VM restart on surviving hosts when a host goes down | Fabrick | High |
| Live migration — move running VMs between hosts, minimal downtime | Fabrick | High |
| Shared storage — cluster-wide disk access required for live migration | Fabrick | High |
| Resource scheduling — place VMs based on host capacity, affinity rules | Fabrick | High |
| **Affinity / anti-affinity rules** — per-workload and per-Workload-Group placement constraints: "keep together" (co-locate for latency), "keep apart" (separate for resilience/compliance). Configured in Shed creation dialog + Workload Group settings. Smart Bridges enforces at placement time. | Fabrick | High |
| **NUMA-aware placement** — detect NUMA topology per host (extends host info), schedule workloads on optimal NUMA node for memory locality. Extends CPU pinning (v1.2 covert channel hardening) with topology awareness. Placement hint in Shed. | Fabrick | High |
| **Disruption budgets** — minimum-healthy-instances constraint per Workload Group. Smart Bridges cordon/drain respects the budget: won't drain below N healthy instances during maintenance. Equivalent to K8s PodDisruptionBudget but AI-enforced. | Fabrick | High |
| **Topology spread constraints** — distribute workloads across hosts/racks/zones for resilience. Hosts carry rack/zone labels; Workload Groups define spread constraints (e.g., "at least 1 instance per zone"). Smart Bridges auto-rebalances on host failure. | Fabrick | High |
| Fencing / STONITH — split-brain prevention | Fabrick | High |
| Cluster events log — migration history, failover events, scheduling decisions | Fabrick | Medium |

---

---

## AI & GPU Fleet Infrastructure (v3.0)

From the [AI-GPU-INFRASTRUCTURE-PLAN.md](../cross-version/AI-GPU-INFRASTRUCTURE-PLAN.md):

| Task | Tier | Priority |
|------|------|----------|
| **Fleet GPU scheduling** — cross-host GPU placement based on availability, VRAM, topology. Decision #116. | Fabrick | High |
| **Fleet inference routing** — fleet virtual bridge routes inference requests to optimal endpoint across hosts. Decision #114. | Fabrick | High |
| **Blue/green model deployment** — fleet-wide model version rollout with bridge weight shifting. Decision #118. | Fabrick | High |
| **Fleet snapshot distribution** — replicate model snapshots to target hosts before scaling. Decision #119. | Fabrick | Medium |
| **GPU topology map** — fleet-wide GPU inventory visualization with model version tracking. Decision #117. | Fabrick | Medium |
| **Fleet-wide AI rate limits** — per-user capacity ceilings enforced across all fleet nodes. Decision #128. | Fabrick | Medium |

---

## Nix Ecosystem Integrations (v3.0)

From the [NIX-ECOSYSTEM-INTEGRATION-PLAN.md](../cross-version/NIX-ECOSYSTEM-INTEGRATION-PLAN.md):

| Task | Tier | Priority |
|------|------|----------|
| **nix-topology** — auto-generated network diagrams from Nix config. Topology provably correct by construction. Combine declared topology (nix-topology) with live status (WebSocket). Diff view: declared vs runtime state (compliance feature). Maximum value at multi-node scale. | Weaver | Medium |
| **Colmena** — fleet deployment coordination. Fabrick uses Colmena internally for NixOS fleet operations. | Fabrick | High |
| **nixos-anywhere + disko** — node onboarding automation. Zero-touch enrollment for new hosts. | Fabrick | High |
| **Attic** — binary cache for fleet. Hosts share build artifacts; faster deployments at scale. | Fabrick | Medium |

---

---

## Design Decisions

### Host Liveness Detection — Status Transition Model

The "Host health heartbeat" task (Phase 1) requires a two-stage status transition model. Do not implement a single hard cutoff.

| Stage | Trigger | Action |
|-------|---------|--------|
| Degraded | No heartbeat/update received within N seconds | Mark host `degraded` |
| Offline | No heartbeat/update received within M seconds (M > N) | Mark host `offline` |
| Recovery | Heartbeat resumes | Transition back through `degraded` → `healthy` |

The "attention needed" sort in the fleet overview already handles surfacing (`STATUS_PRIORITY: offline=2, degraded=1, healthy=0`). The missing production piece is the liveness detection that drives these transitions — the sort infrastructure is ready, the input is not.

**N and M values:** TBD at implementation time based on realistic Weaver host polling intervals. Start with N=30s, M=90s and tune.

### WS Connection Indicator in Fabrick Mode

In Fabrick mode, the local browser↔backend WebSocket status chip is hidden entirely (the chip is irrelevant when talking to a fleet). However, if the browser loses its connection to the Fabrick hub, there is currently no visible indicator.

**Required:** a Fabrick-specific connection indicator that shows hub reachability. It should not display the same chip as the per-host WS indicator — the visual distinction matters. Design TBD at implementation time; at minimum, an unobtrusive status in the fleet toolbar or a toast on connection loss/recovery.

---

## Reference Plans

- Multi-node architecture foundation: [V2-MULTINODE-PLAN.md](../v2.0.0/V2-MULTINODE-PLAN.md)
- microvm-anywhere patterns: [microvm-anywhere-nix-templates.md](../../research/microvm-anywhere-nix-templates.md)
- Nix ecosystem integrations: [NIX-ECOSYSTEM-INTEGRATION-PLAN.md](../cross-version/NIX-ECOSYSTEM-INTEGRATION-PLAN.md)
- Cloud burst & AI/HPC node support: [FABRICK-CLOUD-BURST.md](../../business/product/FABRICK-CLOUD-BURST.md)

---

## v3.3 Scaffold (invisible — ships in this version)

The Fabrick hub's fleet API unlocks the two backend endpoints that v3.3 scope
features depend on. They ship as part of the fleet API surface, not as preview
features — they're genuinely needed for Fabrick itself.

| Task | Notes |
|------|-------|
| `GET /api/fabric/workloads/all` | Enumerates all workloads across all enrolled hosts, grouped by `hostId`. Already needed for the fleet overview and host drill-down. The v3.3 group member picker reuses it with no changes. |
| `GET /api/scope/workloads` | Returns cross-host workload union for the calling user's group membership. Fabrick only. Returns `[]` for users with no groups — safe to ship before group management UI exists. |
| User model: add `groups: string[]` field | Stores WorkloadGroup IDs. Defaults to `[]`. Used by `GET /api/scope/workloads`. |
| Emit `group.member.*` audit events | Wire group membership changes to the audit log. |
| `/workload/:hostId/:name` route | Cross-host workload detail route. Needed for Fabrick drill-down click-through (Decision #83) and scope mode. |

By the time v3.0 ships, an FM customer with `compliancePackEnabled` has:
- DB tables (v1.2), API skeleton (v2.3), scope endpoint and routing (v3.0)
- Fast-track remaining work: group management UI + access request workflow UI only.

*See [plans/v3.3.0/EXECUTION-ROADMAP.md](../v3.3.0/EXECUTION-ROADMAP.md) for full context.*

---

## Release Plan

| Version | Milestone | Key Features | Status |
|---------|-----------|--------------|--------|
| v3.0.0 | Fabrick | Multi-host fleet control plane, Fleet UI, HA + live migration | Planned |
| v3.1.0 | Edge + Cloud Burst | NixOS edge fleet management, cloud burst node enrollment (AI/HPC, invoice-based) | Planned |
| v3.2.0 | Cloud Burst Self-Serve | Stripe metered billing, pre-purchase pools, GPU-aware scheduling, pre-warmed nodes | Planned |
| v3.3.0 | Fabrick Maturity | Workload Groups, scoped Weaver view, IdP sync, Compliance Pack | Planned |

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
