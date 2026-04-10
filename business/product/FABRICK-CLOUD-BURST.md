<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Fabrick — Cloud Burst & AI/HPC Node Support

**Created:** 2026-03-19
**Status:** Decisions resolved (Decision #66) — ready for v3.0 implementation planning

Addresses the gap discovered during business modeling: enterprise AI/HPC workloads run on cloud-hosted nodes at 1TB+ RAM in an off-premise model that Fabrick does not currently account for.

---

## Executive Summary

Fabrick's current model assumes persistent on-premise nodes managed via annual per-node licensing. Fabrick AI/HPC customers operate a fundamentally different pattern: a persistent on-prem control plane (Slurm head node or Kubernetes master) with ephemeral cloud compute nodes that provision on queue depth and terminate on idle. These nodes run 8× H100 GPUs, 1–2TB host RAM, NDR InfiniBand — and stay up for **days to weeks**, not minutes.

**The gap is not pricing** — the Contract tier already covers 1TB+ nodes via sliding block pricing. **The gap is enrollment and lifecycle**: Fabrick has no mechanism to register, monitor, and manage cloud-hosted Weaver nodes alongside on-prem nodes. Without this, Fabrick is absent from the fastest-growing segment of fabrick infrastructure spend.

**The opportunity:** Regulated industries (finance, healthcare, defense, research) cannot use shared-tenancy cloud burst due to compliance requirements. MicroVM hardware isolation — Weaver's core capability — is exactly what satisfies the compliance constraints that container namespaces cannot. Fabrick is the control plane that manages this hybrid fleet.

---

## Market Research: How the Industry Uses Cloud Burst

*Research conducted 2026-03-19. Sources: SkyPilot blog, Photoroom H100 guide, AWS/Azure HPC blogs, CoreWeave, Introl, CNCF project docs, Sacra GPU cloud market research.*

### Job Duration and Trigger Patterns

Cloud burst nodes are **not ephemeral in the hourly sense**. Actual run durations:

| Workload | Typical Duration | Trigger |
|----------|-----------------|---------|
| LLM pre-training / fine-tuning | 3–14 days | Queue depth / scheduled |
| HPC simulation (CFD, climate, genomics) | Hours to 3 days | Queue overflow from on-prem |
| Hyperparameter sweeps, batch inference | Hours | Scheduled, event-driven |
| Rendering / VFX | Hours to days | Deadline-driven |

**Key finding:** Burst nodes are not spun up for minutes and torn down. They sustain multi-day workloads. Annual per-node licensing is wrong for this pattern; per-node-day consumption aligns with actual usage.

**Trigger mechanism:** The dominant pattern is capacity-based — Slurm or Kubernetes triggers cloud provisioning when on-prem queue depth exceeds a threshold. Event-driven triggers (data upload, upstream pipeline complete) are common in ML pipelines. Cost-threshold triggering is rare — customers optimize cost at provisioning strategy selection time (spot vs on-demand), not as a real-time trigger.

### Standard Burst Node Profile

| Component | Specification |
|-----------|--------------|
| GPU | 8× H100 SXM5 (80GB HBM3 each, 640GB VRAM total) |
| Host RAM | 1–2TB |
| CPU | Dual AMD EPYC, 128–192 cores |
| Interconnect | NDR InfiniBand 400 Gb/s — required for multi-node training |
| Local storage | 27TB+ NVMe, backed by Lustre/GPFS/VAST |

**The binding constraint is GPU VRAM and InfiniBand, not host RAM.** Host RAM coverage (1–2TB) determines the Contract tier block count; GPU passthrough determines whether Fabrick is useful for these workloads at all.

### Orchestration Landscape

Two incompatible worlds dominate, with no tool bridging them cleanly:

| World | Tools | Characteristics |
|-------|-------|-----------------|
| **Slurm** (on-prem HPC orgs) | AWS ParallelCluster, Azure CycleCloud, GCP Slurm scripts | Queue-based, gang scheduling, bare-metal GPU assumptions |
| **Kubernetes** (cloud-native ML) | Cluster Autoscaler, Volcano, Kueue, Kubeflow | Pod-based, autoscaling, cloud-native APIs |
| **Abstraction layer (emerging)** | SkyPilot, Ray, Project Slinky | Multi-cloud, provider-agnostic, bridges Slurm/K8s gap |

**Fabrick's positioning:** Fabrick is **not** a scheduler. It is the isolation layer *beneath* whatever scheduler the customer already uses. Slurm dispatches jobs; Fabrick manages the nodes those jobs run on — providing MicroVM isolation, fleet visibility, compliance attestation, and lifecycle management. This complements both worlds without requiring customers to change schedulers.

### Cloud Provider Landscape

| Provider Type | Examples | Share / Notes |
|---|---|---|
| Hyperscalers | AWS (P5/H100), Azure (NDv5), GCP (A3) | 60%+ of spend; strongest for regulated workloads (GovCloud, dedicated tenancy) |
| GPU Neoclouds | CoreWeave ($3.5B ARR), Lambda Labs, Fluidstack, Nebius | Fastest growing; 30–50% cheaper than hyperscalers for pure training; proper InfiniBand |
| European bare-metal | Hetzner, OVH | Popular for cost-sensitive research; less InfiniBand consistency |
| GPU marketplaces | Vast.ai, RunPod | Spot-model; highest interruption risk; research/startup use |

Regulated industries (finance, healthcare, defense) primarily use hyperscalers with dedicated tenancy due to compliance requirements — or avoid cloud burst entirely.

### Billing Model Reality

| Model | Discount | Interruption Risk | Customer Fit |
|-------|----------|-------------------|--------------|
| On-demand (per-hour) | Baseline | Zero | Regulated workloads, long runs without checkpointing |
| Spot/Preemptible | 60–91% | H100: ~4.1%/hr | Sweeps, batch inference, fine-tuning with checkpointing |
| Reserved (1–3yr) | 40–50% | Zero | Steady-state base capacity, not burst |

**For Weaver/Fabrick licensing:** The cloud provider bills per-hour for compute. Fabrick licensing sits on top — its billing unit should reflect how these nodes are actually used: **per-node-day**. A 14-day LLM training run on 4 burst nodes = 56 node-days. This is comprehensible and aligns with procurement expectations.

### The Dominant Hybrid Pattern

```
On-Premises                          Cloud
─────────────────────────────────    ──────────────────────────────────────
Fabrick Control Plane (persistent)   Weaver Agent (ephemeral, days–weeks)
Slurm head node / K8s master         8× H100 burst worker
On-prem permanent GPU cluster        Teardown on idle
Shared filesystem (Lustre/GPFS)      Mounts shared filesystem over VPN
```

This is Fabrick's architecture exactly. The market already expects and operates this pattern. Fabrick needs to enroll, monitor, and manage the right side.

**Data gravity is pain point #1:** Moving terabyte-scale training datasets to cloud workers is the biggest operational friction. Fabrick's role here is not to solve data movement — it manages the nodes. But Fabrick should expose storage mount configuration as part of cloud node enrollment, so operators declare once, not per-job.

### Key Pain Points (Ranked)

1. **Data gravity / egress costs** — training datasets are TBs to PBs; moving them is slow and expensive
2. **InfiniBand quality inconsistency** — multi-node training requires tight coupling; hyperscalers sometimes deliver Ethernet-backed "HPC" instances
3. **Slurm vs Kubernetes fragmentation** — no tool bridges both natively
4. **Spot interruption / fault tolerance** — H100 spot interrupts at ~4.1%/hr; 15–30 min checkpointing is the mitigation
5. **Cold-start latency** — 3–10 min to provision a new GPU node; pre-warmed pools cost money idle
6. **Multi-tenancy compliance in burst** — regulated industries face HIPAA/ITAR/FedRAMP constraints; dedicated tenancy eliminates most spot savings

**Fabrick directly addresses pain points 3, 6, and partially 5** (through warm node pool management in a future phase).

---

## Architecture: Fabrick as the Isolation Layer

### What Fabrick Does (and Doesn't Do)

| Fabrick does | Fabrick does not do |
|---|---|
| Manage node enrollment (on-prem + cloud) | Schedule jobs (that's Slurm/K8s) |
| Provide MicroVM isolation on burst nodes | Provision the cloud VM itself (customer responsibility, or future integration) |
| Aggregate fleet health and GPU inventory | Move training data to cloud nodes |
| Enforce compliance posture (RBAC, audit log) | Replace InfiniBand fabric management |
| Manage node lifecycle (active → retiring) | Bill for cloud compute (customer pays provider) |

### Two Cloud Node Archetypes

| Archetype | Description | Duration | Licensing |
|---|---|---|---|
| **Persistent cloud node** | Rented dedicated server (Hetzner, OVH) or reserved cloud instance. Long-lived, managed identically to on-prem | Months–years | Annual Contract tier (existing) |
| **Burst / ephemeral node** | Provisioned on queue depth, terminated on idle. Multi-day training or HPC job duration | Days–weeks | **Per-node-day consumption** (new) |

The annual Contract tier already handles persistent cloud nodes. The gap is burst nodes that exist for weeks per year — annual licensing has no sensible application.

### Enrollment Flow

```
1. Customer provisions cloud node (manual, Terraform, CloudFormation — Fabrick-agnostic)
2. NixOS + Weaver agent installed on node (nixos-anywhere or cloud-init)
3. Weaver agent establishes WireGuard tunnel to Fabrick control plane
4. Fabrick enrolls node: reads /proc/meminfo, GPU inventory, InfiniBand presence
5. Node appears on Fleet map — visually distinct (cloud region group)
6. Fabrick tracks: enrollment time, node-days active, GPU utilization, tunnel health
7. On teardown: node de-registers, node-days consumed recorded for licensing
```

### Fleet Map Impact

Fleet map needs a visual distinction between node types:

| Node class | Visual treatment |
|---|---|
| On-prem nodes | Solid cards, datacenter rack icon |
| Persistent cloud nodes | Cloud provider badge on card, same solid treatment |
| Burst nodes (active) | Cloud badge + amber pulsing indicator (time-limited) |
| Burst nodes (retiring) | Greyed, countdown timer |

Cloud nodes should group by region/provider. On-prem nodes group by physical location. Loom shows hybrid fleet at a glance.

### WireGuard Tunnel Management

Fabrick manages the WireGuard configuration between cloud burst nodes and the control plane. This is part of enrollment:
- Fabrick generates peer configs
- Cloud node receives config via cloud-init or nixos-anywhere bootstrap
- Tunnel health is monitored as part of node heartbeat
- Tunnel teardown is part of node retirement sequence

---

## Licensing: Burst Consumption Model

### The Problem with Annual Licensing for Burst

A 1TB burst node runs for two 14-day training jobs per year = 28 node-days of annual usage. An annual Contract tier license at $4,500/yr (Fabrick base + 1 block) billed for ~28 actual-use-days is economically incoherent for the customer. They won't buy it. They'll use spot instances with no Fabrick, no isolation, no compliance posture.

### Proposed: Per-Node-Day Stacking on Contract Tier

**Model:** Burst nodes are licensed on a consumption basis, stacking on the customer's existing Contract tier base license.

| License component | What it covers |
|---|---|
| Contract tier base (Fabrick, $2,500/yr) | The Fabrick control plane + all persistent nodes up to 512GB |
| Contract blocks (per 512GB above 512GB, $2,000–$1,250 sliding) | Burst node RAM coverage during active days |
| **Burst consumption add-on (per-node-day)** | Daily rate for enrolled burst nodes, charged against a pre-purchased day pool or metered monthly |

**Proposed burst day rate:** $15–25/node-day for 1TB nodes (1 Contract block). Rationale:
- Cloud provider charges ~$320–450/day for an 8× H100 node on-demand
- $20/node-day Fabrick licensing = 4–6% of compute cost — a rounding error, consistent with how Contract tier pricing is positioned ("licensing is a rounding error vs cloud compute costs")
- Volume tiers: 100+ node-days/month → $12/day, 500+ → $10/day

**Pre-purchased day pools** vs **metered monthly**: Contract buyers expect contracts — offer both. Pre-purchase 500 node-days at $10/day ($5,000 commitment), draw down as needed, renew when depleted. Metered monthly for customers who can't predict usage.

**This is a new revenue stream, not a replacement.** Persistent cloud nodes and on-prem nodes continue on annual Contract tier. Burst consumption is additive.

### Example Economics

**AI lab, 4 H100 burst nodes, 3 training runs/yr (14 days each):**

| Cost | Amount |
|---|---|
| Cloud compute (4 nodes × 42 days × $400/day) | $67,200 |
| Fabrick Control tier base | $2,500/yr (Fabrick) |
| Burst node-days (4 nodes × 42 days × $20/day) | $3,360/yr |
| **Total Fabrick cost** | **$5,860/yr** |
| **Fabrick as % of cloud compute** | **8.7%** |

The compliance posture, GPU inventory management, fleet visibility, and isolation that Fabrick provides cost 8.7% of the cloud compute budget. For a regulated institution (finance, healthcare, defense), this pays for itself in one avoided compliance incident.

---

## GPU Passthrough: v3.0 Requirement

Without GPU passthrough, Fabrick cannot manage burst nodes for their actual workloads. GPU passthrough for Weaver (per-host) is planned — this must be confirmed as a v3.0 requirement, not deferred.

**What Fabrick adds at the fleet level beyond per-host GPU passthrough:**

| Capability | Scope |
|---|---|
| GPU inventory aggregation | Fleet-wide view: how many H100s are active, idle, allocated across all burst nodes |
| GPU utilization monitoring | Real-time utilization per node, per VM — identifies underutilized burst nodes for early teardown |
| GPU-aware scheduling hints | Fabrick can surface capacity to the customer's scheduler (Slurm/K8s) via API — "4 H100 nodes available in burst pool" |
| InfiniBand topology awareness | Record whether enrolled node has InfiniBand or Ethernet-only interconnect — critical for multi-node training job placement |

---

## The Compliance Angle: Natural Fit

The research confirmed what Weaver's positioning already claims: regulated industries (finance, healthcare, defense research) face compliance constraints that **prevent** them from using standard shared-tenancy cloud burst. They either:
1. Don't burst at all (lost productivity, hardware underutilization)
2. Pay for dedicated tenancy at full on-demand rate (eliminates most cost savings)
3. Use on-prem GPU clusters that can't scale for large training runs

**Fabrick + Weaver burst nodes resolve this:**
- MicroVM isolation provides hardware boundary — satisfies compliance requirements that container namespaces cannot
- Per-VM RBAC + declarative audit log carries over to burst nodes
- WireGuard tunnel keeps data in-network — burst nodes appear as an extension of on-prem fabric, not "cloud data"
- Air-gap capable — burst nodes reach Fabrick over WireGuard; no public internet data path required for workloads

This is the differentiator vs raw cloud burst: compliance-capable isolation at scale, managed through the same control plane as on-prem infrastructure.

---

## Resolved Decisions (Decision #66 — 2026-03-19)

| Decision | Resolution |
|----------|-----------|
| **A — Licensing unit** | **Per-node-day.** Stacks on Contract tier base (Fabrick + block pricing). Volume tiers apply at 100+ and 500+ node-days/month. Aligns with how customers reason about burst job duration. |
| **B — Control plane location** | **Customer choice.** Fabrick hub can run on-prem or on a cloud-hosted persistent VM. Weaver agents on burst nodes register with whichever hub the customer operates. Ensures all-cloud AI labs (no on-prem hardware) can use Fabrick burst. |
| **C — Version split** | **v3.0 = large enterprise (invoice-based). v3.1 = self-serve.** v3.0 delivers enrollment, fleet visibility, GPU inventory, node lifecycle, and a node-day consumption counter in Fabrick — billing via monthly invoice. v3.1 delivers Stripe metered API, pre-purchase day pools with self-serve draw-down, and automated renewal. Target buyer determines the split: large enterprise uses procurement/invoice (v3.0 native); AI-native labs and smaller orgs want self-serve (v3.1). |

---

## Product Impact Summary

### Fabrick v3.0 Additions (from this gap)

| Capability | Priority |
|---|---|
| Cloud burst node enrollment (Weaver agent + WireGuard + Fabrick registration) | High |
| Fleet map: cloud vs on-prem visual distinction, region grouping | High |
| GPU inventory aggregation across fleet (H100 count, utilization, InfiniBand present/absent) | High |
| Burst node lifecycle management (active → retiring → deregistered) | High |
| Node-day consumption tracking (for burst licensing) | High |
| Storage mount configuration as part of enrollment (addresses data gravity pain) | Medium |
| GPU-aware scheduling hint API (for Slurm/K8s integration) | Medium (v3.1 candidate) |
| Pre-warmed node pool management (reduces cold-start latency) | Medium (v3.1 candidate) |

### Weaver v3.0 Additions (per-host, prerequisite)

| Capability | Priority |
|---|---|
| GPU passthrough for MicroVMs (PCIe VFIO passthrough) | High — required for burst node usefulness |
| InfiniBand device passthrough | High — required for multi-node training |
| GPU utilization metrics via WebSocket | High — feeds Fabrick fleet inventory |

### Licensing System Changes

| Change | Impact |
|---|---|
| Per-node-day consumption tracking in Fabrick hub | New billing dimension |
| Day-pool license key type (pre-purchased blocks) | New key format |
| Metered monthly reporting (for customers who prefer not to pre-purchase) | Integration with Stripe metered billing |

---

## Competitive Positioning

| Competitor | How they handle cloud burst | Fabrick advantage |
|---|---|---|
| Proxmox | No cloud burst concept; on-prem only | Fabrick manages hybrid fleet from one control plane |
| Rancher/RKE | K8s nodes can be cloud VMs; no MicroVM isolation | Hardware isolation on burst nodes; compliance-capable |
| AWS ParallelCluster | Manages EC2 instances as Slurm nodes; no isolation layer | Weaver adds MicroVM isolation beneath Slurm; multi-cloud |
| CoreWeave (bare metal) | Provides the GPU nodes; no fleet management | Fabrick manages across providers, not just CoreWeave |
| SkyPilot | Multi-cloud job routing; no isolation, no fleet management | SkyPilot could route jobs to Fabrick-managed nodes — complementary, not competing |

**Key message:** *"SkyPilot or Slurm routes the jobs. Fabrick manages the isolation layer the jobs run on. CoreWeave provides the hardware. These three things are distinct — and Fabrick fills the isolation gap none of the others address."*

---

## Related Documents

| Document | Relationship |
|---|---|
| [plans/v3.0.0/EXECUTION-ROADMAP.md](../../plans/v3.0.0/EXECUTION-ROADMAP.md) | Phase 5: Cloud Burst Node Support — implementation tasks |
| [business/product/TIER-MANAGEMENT.md](TIER-MANAGEMENT.md) | Contract tier burst consumption licensing model |
| [business/sales/verticals/research-hpc.md](../sales/verticals/research-hpc.md) | Research/HPC vertical — cloud burst sales angle + AI/HPC Platform Engineer persona |
| [business/marketing/FABRICK-VALUE-PROPOSITION.md](../marketing/FABRICK-VALUE-PROPOSITION.md) | Fabrick pricing justification — cloud burst as Fabrick/Contract differentiator |
| [MASTER-PLAN.md](../../MASTER-PLAN.md) | Plan index entry, Fabrick initiative section |
