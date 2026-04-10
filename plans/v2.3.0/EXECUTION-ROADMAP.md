<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v2.3.0 (Fabrick Basic Clustering — Enterprise Moat-Breaker)

**Last updated:** 2026-03-26
**Status:** Planned

Depends on: v2.1.0 (disk lifecycle + snapshots required for VM migration).

Multi-node visibility, manual VM migration, config sync, and all multi-node Nix ecosystem integrations. This is the Proxmox moat-breaker — the release that justifies fabrick evaluation. Weaver Team peer federation (single-node, REST+WS) ships at v2.2.0 and is a prerequisite for this version's Fabrick protocol layer.

**Test environment:** requires a 2-node NixOS lab setup. Isolated from v2.2 (which only needs a single node + SSH peer). This isolation is why clustering was split from Weaver Team.

---

## Strategic Position

```
v2.2  Weaver Team — peer federation (single-node, REST+WS, team revenue unlock)
v2.3  Fabrick Basic Clustering — multi-node, gRPC, enterprise moat-breaker
v2.4  Backup Weaver — single-node, independent test surface
```

Every release after v2.1 without clustering is enterprise revenue left on the table. An enterprise user who gets multi-node visibility + manual migration + AI diagnostics + Apptainer + restic extension will switch from Proxmox. They don't need HA on day one — they need enough to get in the door, where compound advantages close the deal.

---

## Phase Overview

```
v2.3.0 Phase 1 — Agent Infrastructure (extraction, hub-spoke, protocol)
v2.3.0 Phase 2 — Fleet UI (multi-node workload list, node management)
v2.3.0 Phase 3 — VM Migration + Config Sync
v2.3.0 Phase 4 — Nix Ecosystem Integrations (nixos-anywhere, Colmena, Attic, nixos-facter)
```

---

## Phase 1: Agent Infrastructure

| Task | Tier | Priority |
|------|------|----------|
| Agent extraction — lightweight Weaver agent running on each node | Fabrick | High |
| Hub-spoke topology — dashboard hub discovers and monitors agents | Fabrick | High |
| Agent protocol: gRPC (Fabrick fleet) | Fabrick | High |
| Hub authentication (JWT scoped to hub role) | Fabrick | High |
| Agent heartbeat + health status reporting | Fabrick | High |

---

## Phase 2: Fleet UI

| Task | Tier | Priority |
|------|------|----------|
| Multi-node workload list — aggregated view across all nodes. Discovered hosts land in **Fabrick** (`/fabrick`) by default. Weaver (`/weaver`) remains the per-host workload surface; drilling into a host from Fabrick opens its Weaver view. | Fabrick | High |
| Node management UI (add/remove nodes, view status) | Fabrick | High |
| **"Find existing Weaver agents" wizard** — branch of "Add Node" for enterprise clients with an existing fleet. Three mechanisms: (1) **Tailscale scan** — enter API key, Fabrick queries Tailnet and filters by agent port, one-click bulk register (< 5 min to full fleet inventory); (2) **CIDR range probe** — enter one or more CIDR blocks, Fabrick probes the known agent port only (not a general port scan — detecting your own agent), lists responding hosts; (3) **Manual / CSV import** — hostname/IP list for air-gapped environments. Once a host connects, workloads enumerate automatically via `GET /api/vms` and `GET /api/containers`. Tailscale path is primary; CIDR path covers defense/OT/gov; manual is the air-gap fallback. | Fabrick | Medium |
| **Host workload scan** — on host registration, Fabrick automatically pulls `GET /api/vms` + `GET /api/containers` from the Weaver agent; workloads populate in the host's Weaver view without manual action. Manual **Rescan** button available for drift (workloads started outside Weaver post-registration). | Fabrick | High |
| Node health monitoring (CPU, memory, disk, connectivity) | Fabrick | High |
| Cluster-aware dashboard — node selector, per-node filtering, aggregate stats | Fabrick | High |
| Fleet-wide search (find a workload across all nodes) | Fabrick | Medium |

---

## Phase 3: VM Migration + Config Sync

| Task | Tier | Priority |
|------|------|----------|
| Manual VM migration between nodes (cold migration — stop, transfer disk + config, start) | Fabrick | High |
| Config sync across cluster nodes (templates, distro catalog, settings) | Fabrick | Medium |
| Migration history log | Fabrick | Medium |

**Not in this version (deferred to v3.0.0):**
- Live migration (no-downtime transfer of running VMs)
- HA / automatic failover
- Shared storage (Ceph, ZFS replication)
- Resource scheduling / automatic placement

---

## Phase 4: Nix Ecosystem Integrations

From the [NIX-ECOSYSTEM-INTEGRATION-PLAN.md](../cross-version/NIX-ECOSYSTEM-INTEGRATION-PLAN.md):

| Task | Tier | Priority |
|------|------|----------|
| **nixos-anywhere + disko** — zero-touch node onboarding. "Add Node" wizard: SSH host → disko disk layout → NixOS install → agent auto-registration. Eliminates manual NixOS installation on each node | Fabrick | High |
| **Colmena** — fleet deployment engine. Hub generates per-node NixOS configs → Colmena pushes to agents. Parallel deploy, diff previews, rollback UI | Fabrick | High |
| **Attic** — self-hosted binary cache. First VM build slow (Nix builds from source); Attic caches result. Every subsequent provision is a binary download. Critical for air-gapped deployments (defense, national labs) and burst provisioning | Fabrick | Medium |
| **nixos-facter** — hardware auto-discovery. Agent runs nixos-facter at startup → sends hardware report (CPU, RAM, GPUs, NICs, storage) to hub. Cluster Inventory page. Enables smart VM placement ("place GPU VM on node with GPUs") | Fabrick | Medium |

---

## Testing Strategy

See **[TEST-MODEL.md](TEST-MODEL.md)** for the full scenario table, phase gates, lab topology, and drift simulation procedure.

**Two lab tiers:**
- **Virtual** (Foundry — Hub VM + Agent VM): correctness tests for all protocol, discovery, enrollment, and migration logic. Nested KVM on Agent VM for MicroVM support.
- **Hybrid** (Foundry Hub VM + bare metal mini PC): real KVM, actual nixos-facter hardware report, Firecracker boot time, real disk transfer. Scenarios marked `[BM]` in TEST-MODEL.md require this tier.

This environment is completely separate from v2.2's single-node peer federation tests. Running them in the same version would have required both test environments simultaneously for a single version gate — the primary reason for the split.

---

## Release Plan

| Version | Milestone | Key Features | Status |
|---------|-----------|--------------|--------|
| v2.3.0 | Fabrick Basic Clustering | Multi-node visibility, manual migration, config sync, Nix fleet integrations — **fabrick moat-breaker** | Planned |

---

## Reference Plans

- Demo spec (fleet discovery wizard mock): [DEMO-SPEC.md](DEMO-SPEC.md)
- Test model + lab topology: [TEST-MODEL.md](TEST-MODEL.md)
- Multi-node architecture: [V2-MULTINODE-PLAN.md](../v2.0.0/V2-MULTINODE-PLAN.md)
- Weaver Team peer federation (v2.2 prerequisite): [plans/v2.2.0/EXECUTION-ROADMAP.md](../v2.2.0/EXECUTION-ROADMAP.md)
- Nix ecosystem integrations: [NIX-ECOSYSTEM-INTEGRATION-PLAN.md](../cross-version/NIX-ECOSYSTEM-INTEGRATION-PLAN.md)
- Implementation phasing: [IMPLEMENTATION-PHASING-PLAN.md](../v2.0.0/IMPLEMENTATION-PHASING-PLAN.md)

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
