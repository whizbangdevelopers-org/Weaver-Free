<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v3.1.0 (Edge Fleet + Cloud Burst)

**Last updated:** 2026-03-25
**Status:** Planned

Depends on: Fabrick foundation (v3.0.0) — host enrollment, inter-host comms, fleet API.

v3.1 extends the Fabrick fleet to two specialized node classes that were scoped out of v3.0 for testing isolation: NixOS edge nodes (manufacturing floors, retail, IoT) and cloud burst nodes (AI/HPC workloads). Both share the same Fabrick enrollment and fleet management surface established at v3.0 — v3.1 is additive, not architectural.

Cloud burst self-serve billing (Stripe metered, pre-purchase pools) ships at v3.2. v3.1 covers invoice-based large enterprise billing only.

---

## Strategic Position

```
v3.0  Fabrick fleet control plane — HA, multi-host, enterprise
v3.1  Edge fleet + Cloud burst (invoice-based) — edge market + AI/HPC
v3.2  Cloud burst self-serve billing — AI-native labs, self-serve buyers
v3.3  Fabrick Maturity (Compliance Pack) — enterprise expansion/renewal
```

v3.1 is the market expansion release. v3.0 closes the initial Enterprise deal (HA, fleet management). v3.1 opens two adjacent markets: the $22B edge software market (NixOS edge fleet, declarative, zero drift) and regulated AI/HPC buyers who need hardware isolation for training workloads.

---

## Phase Overview

```
v3.1.0 Phase 1 — Edge Fleet (NixOS-only: enrollment, deploy, monitor, rollback)
v3.1.0 Phase 2 — Cloud Burst Node Support (GPU passthrough prereqs + invoice-based enrollment)
```

---

## Phase 1: Edge Fleet (NixOS-only)

Edge nodes are Weaver hosts running at the edge — manufacturing floors, retail locations, camera nodes, IoT automation. Same NixOS declarative model, managed remotely via Fabrick.

**Implementation path:** The [microvm-anywhere template patterns](../../research/microvm-anywhere-nix-templates.md) are the foundation. The same `makeMicroVM` factory function and composable NixOS module templates (base, web, database, worker) that provision datacenter VMs can deploy/reprovision NixOS microVMs on remote edge nodes over SSH via `fleet-deploy.sh` and nixos-anywhere. Impermanence provides boot-clean resilience for unreliable edge environments (power loss, tampering).

| Task | Tier | Priority |
|------|------|----------|
| Edge node registration (SSH-based enrollment via nixos-anywhere) | Fabrick | High |
| Fleet manifest management (declarative: what deploys where) | Fabrick | High |
| API-triggered fleet deployments (provision/reprovision edge nodes) | Fabrick | High |
| Edge agent heartbeats → fleet status dashboard | Fabrick | High |
| Edge node health monitoring (connectivity, drift detection) | Fabrick | High |
| Impermanence integration (boot-clean resilience for edge) | Fabrick | Medium |
| Atomic rollbacks for failed edge deployments | Fabrick | High |
| Fleet manifest history (what was deployed when, to which nodes) | Fabrick | Medium |
| `genList` scaling — identical edge workers with one number change | Fabrick | Medium |

**Edge scope:** NixOS nodes only. Immutable, declarative edge deployments with zero drift and atomic rollbacks. Not competing with K3s/SNO for generic container orchestration.

**Target segments:** Manufacturing floors (23% of $22B edge software market), video/camera nodes (29%), retail (hundreds of identical nodes), IoT automation (27%).

---

## Phase 2: Cloud Burst Node Support (AI/HPC)

Enterprise AI/HPC workloads run on cloud-hosted nodes at 1TB+ RAM in an off-premise model. These burst nodes provision on queue depth, sustain multi-day training runs (3–14 days), and terminate on idle. Fabrick must enroll and manage them alongside on-prem nodes. Full analysis: [business/product/FABRICK-CLOUD-BURST.md](../../business/product/FABRICK-CLOUD-BURST.md).

**Prerequisite (Weaver per-host):**

| Task | Tier | Priority |
|------|------|----------|
| GPU passthrough for MicroVMs (PCIe VFIO passthrough) | Fabrick | High — burst nodes are worthless without it |
| InfiniBand device passthrough | Fabrick | High — required for multi-node training |
| GPU utilization metrics via WebSocket | Fabrick | High — feeds Fabrick fleet GPU inventory |

**Fabrick fleet capabilities — v3.1 (large enterprise, invoice-based billing):**

| Task | Tier | Priority |
|------|------|----------|
| Cloud burst node enrollment — Weaver agent + WireGuard tunnel registration | Fabrick | High |
| Fleet map: cloud vs on-prem visual distinction, provider/region grouping | Fabrick | High |
| GPU inventory aggregation — H100 count, utilization, InfiniBand topology across fleet | Fabrick | High |
| Burst node lifecycle management — active → retiring → deregistered | Fabrick | High |
| Node-day consumption counter in Fabrick dashboard (billing via monthly invoice) | Fabrick | High |
| Storage mount configuration as part of enrollment (data gravity mitigation) | Fabrick | Medium |

**Self-serve billing deferred to v3.2:**

Stripe metered billing, pre-purchase day pools, automated renewal notifications, GPU-aware scheduling hint API, and pre-warmed node pool management all ship at v3.2. v3.1 covers large enterprise accounts on monthly invoice.

**Decisions resolved:** Decision #66 — per-node-day licensing, customer-choice control plane location, v3.0/v3.1/v3.2 scope split. See [FABRICK-CLOUD-BURST.md](../../business/product/FABRICK-CLOUD-BURST.md).

---

## Testing Strategy

v3.1 is intentionally isolated from v3.0 for testing purposes. Edge fleet and cloud burst have distinct hardware dependencies (physical edge nodes, GPU hardware) that cannot share test environments with HA clustering (shared storage, STONITH). Splitting these into v3.1 allows:
- v3.0 E2E tests: 2-node lab, no GPU hardware required
- v3.1 E2E tests: edge node simulation (NixOS VM acting as edge node) + GPU passthrough test rig
- Each version gate is independently verifiable before the next begins

---

## Release Plan

| Version | Milestone | Key Features | Status |
|---------|-----------|--------------|--------|
| v3.1.0 | Edge + Cloud Burst | NixOS edge fleet management, cloud burst node enrollment (AI/HPC, invoice-based) | Planned |

---

## Reference Plans

- Fabrick foundation (prerequisite): [plans/v3.0.0/EXECUTION-ROADMAP.md](../v3.0.0/EXECUTION-ROADMAP.md)
- Cloud burst self-serve billing (successor): [plans/v3.2.0/EXECUTION-ROADMAP.md](../v3.2.0/EXECUTION-ROADMAP.md)
- microvm-anywhere patterns: [research/microvm-anywhere-nix-templates.md](../../research/microvm-anywhere-nix-templates.md)
- Cloud burst & AI/HPC analysis: [business/product/FABRICK-CLOUD-BURST.md](../../business/product/FABRICK-CLOUD-BURST.md)
- Nix ecosystem integrations: [plans/NIX-ECOSYSTEM-INTEGRATION-PLAN.md](../cross-version/NIX-ECOSYSTEM-INTEGRATION-PLAN.md)

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
