<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Research & HPC IT Sales Case
## How Weaver Eliminates Infrastructure Burden for Research Computing
*Universities, National Labs, Federally Funded Research Centers & Data Science Teams*

**Date:** 2026-03-09
**Parent doc:** [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md)

---

## Table of Contents

1. [The Research/HPC IT Problem](#1-the-research-hpc-it-problem)
2. [Regulatory Mapping: What Weaver Addresses](#2-regulatory-mapping)
3. [Weaver for Research/HPC](#3-weaver-for-research-hpc)
4. [Fabrick for Research/HPC](#4-fabrick-for-research-hpc)
5. [Deficiency Remediation Plan](#5-deficiency-remediation-plan)
6. [Research/HPC-Specific Competitive Advantages](#6-competitive-advantages)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Discovery Questions](#9-discovery-questions)
10. [Cloud Burst & AI/HPC Node Support](#10-cloud-burst--aihpc-node-support-fabrick-v30)
11. [Research/HPC GTM Motion](#11-gtm-motion)

---

## 1. The Research/HPC IT Problem {#1-the-research-hpc-it-problem}

**No NixOS expertise required — ever.** Weaver runs alongside existing Docker, VMware, Proxmox, or bare-metal tooling. Migrate one workload at a time. No cutover event. No retraining.

Apptainer workloads alongside MicroVMs in one dashboard — no other tool does this. Parallel adoption alongside existing Slurm/PBS clusters. AI/HPC nodes above 512GB RAM use contract-tier block pricing ($2,000/512GB block, sliding scale) — Weaver licensing is a rounding error against cloud compute costs.

Research computing lives in a tension that no other sector experiences: researchers need complete freedom to experiment — arbitrary software stacks, GPU access, custom environments, root in their own sandboxes — while administrators need governance, security, reproducibility, and compliance with funding-source-specific requirements that change per grant. A single HPC cluster might simultaneously host NIH-funded clinical research (HIPAA), DoD-funded CUI work (NIST 800-171), NSF-funded open science (data sharing mandates), and industry-sponsored proprietary research (NDA isolation) — all with different access controls, data handling rules, and audit requirements.

**What research IT should be doing:**

- Enforcing data classification policies that vary by funding source (NIH vs DoD vs NSF vs industry)
- Managing GPU allocation fairly across competing research groups
- Maintaining reproducible computational environments for publication requirements
- Isolating multi-tenant workloads with different security classifications on shared infrastructure
- Supporting Apptainer/Singularity container workflows that researchers depend on
- Documenting infrastructure for grant compliance reports and institutional audits
- Ensuring export-controlled research data (ITAR/EAR) never leaves authorized systems

**What research IT actually spends time doing:**

- Rebuilding snowflake VMs that a postdoc configured two years ago and left undocumented
- Mediating GPU allocation disputes between labs ("who has the A100s this week?")
- Manually provisioning one-off environments because every PI wants something different
- Troubleshooting Apptainer containers via CLI because there's no management interface
- Maintaining separate infrastructure silos because different grants require different controls
- Recreating computational environments that "worked on my machine" for journal reproducibility reviews
- Fielding tickets from researchers who need self-service but only have SSH access

**Weaver eliminates the second list so IT can focus on the first.**

---

## 2. Regulatory Mapping: What Weaver Addresses {#2-regulatory-mapping}

### Direct Compliance Impact

| Regulation / Requirement | IT Obligation | Weaver Capability | Tier | Available |
|--------------------------|--------------|------------------------------|:----:|:---------:|
| **NIH Data Management & Sharing Policy** (2023+) | Documented compute environments; data access controls; sharing-ready infrastructure | Declarative config = reproducible environments. Per-VM RBAC (Fabrick) controls data access. Config-as-code documents the compute environment for DMS plans | Weaver+ | v1.0 |
| **NSF Data Management Plan** | Infrastructure documentation for grant proposals; reproducible compute for open science | NixOS declarative config provides complete environment specification. Git history documents infrastructure lifecycle across the grant period | All tiers | v1.0 |
| **NIST SP 800-171** (CUI — DoD-funded research) | Access control, audit logging, configuration management, system integrity for CUI | Per-VM RBAC, declarative audit log (git-based), zero configuration drift, AppArmor/Seccomp hardening, managed bridges for CUI network isolation | Fabrick | v1.0 (hardening v1.2) |
| **ITAR/EAR** — Export Controls | Physical and logical access controls; data cannot leave authorized systems; citizen-only access for certain workloads | Per-VM RBAC restricts access to authorized personnel. Managed bridges isolate export-controlled networks. Self-hosted — data never leaves institutional infrastructure | Fabrick | v1.0 |
| **ECRA** — Export Control Reform Act | Controls on emerging/foundational technologies in research | Same isolation and access controls as ITAR/EAR; declarative config documents compliance posture for export control officers | Fabrick | v1.0 |
| **HIPAA** (clinical research / health sciences) | ePHI access controls, audit trails, network segmentation for clinical data | Per-VM RBAC, declarative audit log, managed bridges for clinical data isolation — see [healthcare.md](healthcare.md) for full mapping | Fabrick | v1.0 |
| **FERPA** (university research using student data) | Access controls on education records used in research | Per-VM RBAC limits access to approved researchers. VM-level isolation for datasets containing student records — see [education.md](education.md) for full mapping | Fabrick | v1.0 |
| **IRB Requirements** — Human Subjects Data | Documented data handling procedures; access restricted to IRB-approved personnel; audit trail of data access | Per-VM RBAC enforces IRB-approved access lists. Declarative audit log provides evidence for IRB continuing reviews. VM isolation separates human subjects data from general workloads | Fabrick | v1.0 |
| **EU GDPR** (international collaborations) | Data processing documentation, access controls, data location transparency | Self-hosted — data stays on institutional infrastructure. Declarative config documents processing environment. Per-VM RBAC enforces access policies per collaboration agreement | Fabrick | v1.0 |
| **Institutional Data Classification** (public/internal/confidential/restricted) | Enforce tiered access controls matching data classification levels | Managed bridges create network tiers per classification level. Per-VM RBAC maps to institutional access roles. Declarative config documents the classification-to-infrastructure mapping | Weaver+ | v1.0 |
| **Journal Reproducibility Mandates** (Nature, Science, etc.) | Computational environment must be fully documented and reproducible | NixOS declarative config IS the reproducible environment specification. Apptainer container management (v1.1+) provides portable reproducibility. Git history documents exact environment at time of computation | All tiers | v1.0 (Apptainer v1.1+) |

### Indirect Compliance Support

| Research Function | IT Pain Today | How Weaver Helps |
|-------------------|--------------|----------------------------|
| **Grant reporting** | Manually documenting what infrastructure was provisioned with grant funds | Declarative config documents every system; git history shows exactly what ran during the grant period |
| **Multi-PI shared infrastructure** | Different PIs with different funding sources on the same cluster, no isolation | Managed bridges + per-VM RBAC create funding-source-specific isolation zones from shared hardware |
| **Apptainer/Singularity management** | All CLI-based — researchers manage containers with shell scripts; admins have no visibility | Weaver provides GUI + API management of Apptainer instances alongside VMs (v1.1 visibility, v1.2 full management) |
| **GPU resource scheduling** | Spreadsheets, email threads, or first-come-first-served for GPU access | Resource quotas (Fabrick) enforce per-user/per-group GPU allocation; dashboard shows real-time GPU utilization |
| **Lab onboarding/offboarding** | New grad students wait days for VM provisioning; departing members leave undocumented environments | Live Provisioning creates environments in seconds from declared templates; templates survive personnel transitions |
| **Data sovereignty** | International collaborations require data to stay on-premises; cloud solutions complicate this | Self-hosted, offline-first — data never leaves institutional infrastructure. No cloud dependency for any function |

---

## 3. Weaver for Research/HPC {#3-weaver-for-research-hpc}

**Target:** Individual research labs, small HPC centers, university department servers, PI-managed compute, data science teams

**Price:**
- **Weaver Solo** — $149/yr (FM, first 200) per node (admin only, local only, up to 128GB RAM)
- **Weaver Team** — $129/user/yr (FM, first 50 teams) (2–4 users + 1 viewer free, up to 2 remote peer Weaver hosts with full management, up to 128GB RAM/host). Ships v2.2.0.

**The pitch:** "Your postdoc built a GPU environment six months ago and left no documentation. The paper reviewer wants to reproduce the results but the VM is a snowflake. Weaver Solo at $149/yr (FM, first 200) per node gives you declarative, reproducible environments — and Apptainer management from a real dashboard instead of shell scripts. Got a team and a GPU box to watch? Weaver Team adds multi-user access and cross-host monitoring for $129/user/yr (FM)."

### Key Weaver Wins for Research/HPC

| Capability | Research Value |
|-----------|---------------|
| **Live Provisioning** | New grad student joins the lab Monday — their GPU-enabled research environment is ready in minutes, not after a week of sysadmin back-and-forth. PIs can provision environments for their own lab without filing tickets |
| **Zero Configuration Drift** | The computation environment that produced your Nature paper is provably identical to the one you declared — reproducibility by construction, not by hoping nobody ran `apt install` since then |
| **Apptainer Integration** (v1.1+) | The only VM management dashboard that also manages Apptainer containers. Read-only visibility in v1.1; full lifecycle management in v1.2. Researchers use Apptainer daily — now admins can see and govern it from the same dashboard |
| **GPU Passthrough** | NVIDIA `--nv` and AMD `--rocm` support for Apptainer containers; PCIe passthrough for VMs. GPU-intensive ML/AI workloads get dedicated hardware access without bare-metal compromise |
| **AI Diagnostics** | When a researcher's training job fails at 3 AM, natural language diagnostics explain what went wrong — in terms a computational scientist can understand, not just sysadmin logs |
| **Multi-Hypervisor** | Run security-sensitive workloads (CUI, clinical data) on Firecracker's minimal attack surface. Run general research workloads on QEMU. One dashboard, one policy, five hypervisors |
| **SLURM-Native Integration** | SLURM ships as a NixOS package — declarative job scheduler configuration alongside Weaver, no separate deployment required. Prolog/epilog hooks call Weaver's Live Provisioning API: each SLURM job gets a hardware-isolated MicroVM instead of sharing a namespace on a bare node. Job teardown destroys the VM and returns the node to a provably clean baseline. GPU resources shared between SLURM batch training jobs and interactive Weaver workloads via resource quotas — no spreadsheet, no email thread |
| **Sub-Second VM Boot** | Conference demo in 10 minutes and the VM is down? Firecracker boots in <125ms. Burst workloads spin up instantly for deadline-driven research |
| **Managed Bridges + IP Pools** | Declarative network segmentation — isolate DoD-funded research from NIH-funded research from open-science workloads. Different security policies, same hardware |

### ROI for a University Research Lab (4 GPU Nodes)

| Current Cost | With Weaver |
|-------------|----------------------|
| Proxmox: EUR355/socket x 8 sockets = **EUR2,840/yr** | 4 nodes x $149 = **$596/yr (Solo)** |
| 1 research computing admin spending 10 hrs/week on VM/container management at $60/hr = **$31,200/yr** | Reclaim 6 hrs/week = **$18,720/yr freed** for researcher support and actual science |
| Reproducing computational environments for paper reviews: 2 weeks/yr = **$4,800** | Zero — declarative config IS the reproducible environment spec |
| GPU allocation disputes: unquantified sysadmin time + researcher frustration | Weaver visibility + resource quotas eliminate the spreadsheet-and-email GPU scheduling |
| **Total current cost: ~$38,840/yr + GPU chaos** | **Weaver: $596/yr + $18,720 labor freed** |

**The NixOS resonance:** The Nix for Science community already uses NixOS for reproducible research. Weaver gives that community a management dashboard purpose-built for their workflow — not a general-purpose VM tool that ignores reproducibility.

### The Hydra CI/Build Farm Integration

Research groups and NixOS infrastructure teams running [Hydra](https://github.com/NixOS/hydra) — NixOS's CI and build farm — are a natural fit for Weaver. Hydra evaluates Nix expressions and distributes builds across worker machines. Weaver manages those workers:

| Hydra Pain | Weaver Solution |
|-----------|---------------------------|
| Build workers provisioned manually (SSH + nixos-rebuild) | Live Provisioning creates declarative build workers in seconds — no host rebuilds |
| Build queues back up during large evaluations (nixpkgs bumps, flake updates) | Burst capacity: spin up additional Firecracker-based workers on demand, tear down after the evaluation completes |
| GPU builds (CUDA compilation, ML model training in CI) require manual GPU allocation | GPU passthrough with resource quotas — Hydra workers get dedicated GPU access without starving interactive researchers |
| No visibility into build worker health or resource utilization | Weaver shows real-time CPU/memory/GPU across all build workers; AI diagnostics explain build failures |
| Build infrastructure undocumented for grant reporting | Declarative config + git history documents exactly what infrastructure built the software referenced in publications |

**Full-stack reproducibility:** Nix makes builds reproducible. NixOS makes hosts reproducible. Weaver makes the infrastructure *managing those hosts* reproducible and governed. For the Nix for Science community, this is reproducibility all the way down — from package definition to build worker to host infrastructure.

**Sales wedge:** Anyone already running Hydra is already committed to NixOS (zero adoption friction), already managing build workers (the pain point Weaver eliminates), and already values reproducibility (Weaver extends it to the infrastructure layer). Hydra users are the highest-intent prospects in the research/HPC vertical.

### Weaver Team for Research/HPC

This is the canonical Weaver Team scenario. A small research group — PI plus two or three researchers — runs a primary compute node alongside a dedicated GPU host for LLM inference or ML training workloads. The group wants to monitor the GPU box from their primary Weaver instance without deploying a full Fabrick fleet.

Weaver Team (v2.2.0) shows remote peer workloads in the existing Weaver view with a host badge on each workload card. Researchers see job status, RAM utilization, and whether the LLM inference server is running — from the primary node's dashboard. Management actions on the remote GPU host are fully available — restart, provision, and manage workloads directly from the primary node's dashboard.

| Team Use Case | Weaver Team Capability |
|--------------|------------------------|
| **Primary compute + GPU host** | See GPU host workloads in the Weaver view — job run state, RAM consumption, host badge — without leaving the primary node's dashboard |
| **LLM inference monitoring** | Confirm the inference server VM is alive and within memory bounds; catch runaway jobs before they exhaust GPU host RAM |
| **ML training oversight** | See whether training jobs are still running from the primary dashboard — no need for a separate SSH session to the GPU node |
| **2-peer cap fits the lab** | Covers primary compute node + GPU host + one more (storage node, secondary compute) — right-sized for a PI-led group without Fabrick overhead |
| **Peer discovery** | Tailscale MagicDNS peer discovery or manual IP entry; no infrastructure changes required |

**ROI note:** Weaver Solo at $149/yr (FM, first 200) covers the primary node; Weaver Team at $129/user/yr (FM) (e.g., PI + 2 researchers = $387/yr) adds multi-user access and remote peer management. Total cost for a 3-person lab with 2 hosts: **$537/yr** — a rounding error against GPU compute costs.

**Upgrade trigger:** When the group needs more than 2 remote peers, or shares Weaver access with more than 4 researchers — that's the Fabrick conversation. Fabrick also covers institutions that need per-VM RBAC, fleet-scale audit logs, resource quotas, and funding-source isolation across multiple hosts.

**The ROI table updated for Team pricing:**

| Current Cost | With Weaver Weaver Team (3 users, 2 hosts) |
|-------------|----------------------------------------------|
| Proxmox: EUR355/socket x 8 sockets = **EUR2,840/yr** | Primary node licensing + $387/yr Team = **~$984/yr total** |
| Research computing admin: 10 hrs/week on VM/container management at $60/hr = **$31,200/yr** | Reclaim 6 hrs/week = **$18,720/yr freed** |
| SSH-based GPU host monitoring: untracked researcher time | One-pane view across both hosts eliminates context switching |
| **Total: ~$34,040/yr + GPU oversight gaps** | **~$894/yr + $18,720 labor freed** |

---

## 4. Fabrick for Research/HPC {#4-fabrick-for-research-hpc}

**Target:** University HPC centers, national labs, federally funded research centers, multi-department research computing organizations, institutions handling CUI or export-controlled research

**Price:** $2,000/yr first node + $750/yr additional + $500/yr at 10+ nodes (up to 256GB RAM). For AI/HPC nodes above 512GB RAM, see Fabrick ($2,500/yr) or Contract tier (block pricing from $2,000/512GB block, sliding scale).

**The pitch:** "Your HPC cluster hosts NIH clinical research, DoD-funded CUI work, and open-science NSF projects on the same hardware — each with different compliance requirements. Fabrick gives you per-VM access controls, network isolation per funding source, and an audit trail that satisfies all three compliance regimes from one dashboard."

### Fabrick Features Mapped to Research Obligations

| Fabrick Feature | Research Requirement Addressed | Audit Evidence Produced | Available |
|-------------------|-------------------------------|------------------------|:---------:|
| **Per-VM RBAC** | Funding-source-specific access controls (NIST 800-171, IRB, ITAR) | Role assignments per VM — proves only authorized personnel access restricted research data | v1.0 |
| **SSO/SAML/LDAP** | Institutional identity integration (university SSO, lab directory services) | Single identity source; one audit trail; automatic deprovisioning when researchers leave the institution | v1.2+ |
| **Declarative Audit Log** | Grant compliance, IRB continuing reviews, export control audits | Git commit history: who changed what, when, why — tamper-evident by construction | v1.0 |
| **Resource Quotas** | Fair GPU allocation; prevent one lab from monopolizing shared resources | Per-user/per-group resource limits enforced at the platform level; dashboard shows utilization | v1.0 |
| **Bulk VM Operations** | Semester transitions, conference cluster provisioning, batch environment updates | Fleet-wide operations: spin up 50 research environments, tear down a graduated cohort's VMs, all logged | v1.0 |
| **All Plugins Included** | NIST 800-171 CUI handling, export control hardening | Firewall (nftables), AppArmor/Seccomp, kernel hardening, DNS — complete security stack | v1.0 (firewall v1.1, hardening v1.2) |
| **Managed Bridges** | Multi-tenant isolation — different funding sources, different compliance regimes, same hardware | Declarative network segmentation creates compliance zones per funding source or data classification | v1.0 |
| **Apptainer Management** (v1.1/1.2) | The dominant HPC container runtime — researchers expect it, admins need to govern it | v1.1: read-only visibility into running Apptainer instances. v1.2: full lifecycle management (build, deploy, monitor, GPU passthrough) from the dashboard | v1.1/v1.2 |

### Fleet Onboarding (v2.3.0)

HPC environments are frequently hybrid — on-prem cluster nodes plus cloud burst capacity on Hetzner, DigitalOcean, or AWS. Fabrick's fleet discovery wizard handles both in the same session.

**On-prem cluster nodes:** use the **CIDR probe** path to discover all Weaver agents on your cluster network. Probes only port 50051 — not a general port scan — on specified RFC 1918 CIDR blocks. Admin specifies the cluster subnet; Fabrick lists all responding hosts for one-click bulk registration.

**Cloud nodes (v2.4.0 — Hetzner + DigitalOcean; v3.0 — AWS):** the **cloud-provider scan** queries your provider account, probes each VM for a Weaver agent response, and presents a checkbox list of responding hosts. Uses the same provider credentials already stored in System Settings for cloud workload visibility (Decision #80) — no re-entry required. VMs already registered are shown as "Already registered" for coverage confirmation, not hidden.

A research institution onboarding a hybrid cluster can discover 40 on-prem nodes via CIDR and 10 DO burst nodes via cloud scan in a single wizard session. Workload inventory (HPC job VMs, Apptainer instances, Slurm batch VMs) is pulled from each Weaver agent automatically on registration. Each discovery session is audit-logged — satisfying NIST 800-171 3.3.1 for CUI-hosting institutions.

Existing cluster nodes not yet running NixOS — Ubuntu compute nodes, RHEL GPU servers, custom HPC Linux builds — can join as **Observed** fleet members via `weaver-observer` (statically-linked Rust binary, memory-safe, zero runtime dependencies, any Linux kernel ≥ 4.x). Observed hosts show running jobs, containers, and Apptainer instances read-only. They do not contribute to NIST 800-171 or grant compliance evidence. Observer nodes are included free up to 5× the Managed node count. For hybrid clusters, the fleet map provides a unified view of the full node inventory — NixOS Managed nodes and legacy Observed nodes side by side — as the NixOS migration progresses across hardware refresh cycles.

### Fabrick Success Programs for Research/HPC

| Program | Research Application | FM Price | Standard Price |
|---------|---------------------|:--------:|:--------------:|
| **Adopt** | NixOS onboarding for research computing teams; HPC-aware deployment playbook; Apptainer integration setup; researcher self-service configuration. **SLURM:** initial SLURM + Weaver deployment — NixOS module configuration, prolog/epilog setup, GPU quota baseline. Gets you running. | $5,000/yr | $15,000/yr |
| **Adopt — Compliance** | Everything in Adopt + NIST 800-171 / ITAR / HIPAA (medical research) control mapping session; grant compliance evidence walkthrough; DMP infrastructure section documentation; research data governance architecture review | — | $25,000/yr |
| **Accelerate** | Quarterly fleet reviews mapped to funding-source compliance (NIST 800-171, HIPAA, ITAR); GPU allocation optimization; Apptainer governance policies; integration with institutional identity systems and ORCID-based access. **SLURM:** quarterly SLURM integration health checks — job isolation audit, GPU utilization review, compliance evidence mapping for active grants. Keeps you compliant. | $15,000/yr | $45,000/yr |
| **Partner** | Named engineer who owns your SLURM + Weaver deployment: builds the prolog/epilog integration, configures GPU quota governance, architects multi-compliance-regime job isolation (NIH/DoD/NSF on shared hardware), and maintains the integration across version upgrades. Priority features for HPC-specific needs (burst provisioning, Apptainer templates); compliance mapping for CMMC certification path (DoD-funded institutions). This is the right tier when Weaver is mission-critical infrastructure for an active research computing program or national lab. | $30,000/yr | $90,000/yr |

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = $9,000/yr total compliance coverage during the FM period. Standard Adopt — Compliance ($25,000/yr) includes hands-on compliance service delivery not covered by the extension alone.

### Fabrick Partner — Recommended Path for Cluster Buyers

For institutional cluster buyers (university HPC centers, national labs, research computing organizations), the right purchase is **Fabrick licensing + Partner success program as a single contract** — one renewal date, one named engineer, one point of accountability.

| Cluster size | Fabrick licensing | Partner | Total (Fabrick Partner) |
|---|---|---|---|
| 20 nodes | $11,500/yr | $30,000/yr | **$41,500/yr** |
| 40 nodes + 8 GPU (Fabrick) | $39,500/yr | $30,000/yr | **$69,500/yr** |
| 100 nodes + 8 GPU (Fabrick) | $67,500/yr | $30,000/yr | **$97,500/yr** |

The named engineer owns the SLURM + Weaver integration end-to-end. This is the right tier when Weaver is mission-critical infrastructure for an active research computing program. See [TIER-MANAGEMENT.md](../../product/TIER-MANAGEMENT.md) for full bundle definition.

### ROI for a University HPC Center (40 Nodes, 8 GPU Nodes)

| Cost Category | Current State | With Fabrick |
|-------------|--------------|----------------------------------|
| Infrastructure software | VMware: $20,000–60,000/yr (or Proxmox + manual scripting) | 40 nodes: $23,500/yr |
| Research computing staff time on infrastructure (3 staff, 40% on VMs) | $86,400/yr | Redirect to researcher support and science — infrastructure management is declarative |
| Reproducibility failures | 1-2 rejected papers/yr due to environment non-reproducibility = **grant reputation damage** | Declarative environments eliminate reproducibility failures for infrastructure-related causes |
| GPU allocation overhead | Sysadmin mediating disputes + researcher downtime waiting for GPUs | Resource quotas enforce allocation; dashboard shows real-time utilization; self-service within quotas |
| Compliance staff time (export control, IRB, grant reporting) | $40,000/yr across compliance officers | Config-as-code provides evidence automatically; audit trail satisfies multiple compliance regimes from one source |
| Success program | N/A | Accelerate: $15,000/yr (FM) |
| **Total** | **$146,400–186,400/yr + reputation risk** | **$38,500/yr + staff redirected to research mission** |

---

## 5. Deficiency Remediation Plan {#5-deficiency-remediation-plan}

When a research institution has existing compliance findings — from federal audits, institutional reviews, CMMC assessments, or grant agency site visits — Weaver addresses infrastructure-related deficiencies systematically.

### Quick Wins (Week 1-2)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|-------------------------------|
| **Environment documentation** | "Computational environments used in published research cannot be reproduced" | Deploy Weaver — declarative config IS the environment specification. Every system's config is version-controlled and reproducible |
| **Change management** | "No record of who changed research infrastructure or when" | Every VM change becomes a git commit with who/when/what/why — audit trail exists from day one |
| **Infrastructure inventory** | "Cannot account for all systems provisioned with grant funds" | Weaver provides complete, real-time infrastructure inventory — every VM, container, and network segment documented declaratively |

### Medium-Term (Month 1-3)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|-------------------------------|
| **Multi-tenant isolation** | "Research workloads with different security classifications share network segments" | Managed bridges with IP pools — declarative isolation per funding source, data classification, or compliance regime |
| **CUI handling** | "NIST 800-171 controls not implemented at infrastructure level for DoD-funded research" | Per-VM RBAC, audit logging, AppArmor/Seccomp hardening, managed bridge isolation — controls mapped to NIST 800-171 families |
| **Container governance** | "No visibility into Apptainer containers running on research nodes; no management controls" | Apptainer integration (v1.1 visibility, v1.2 management) provides dashboard-based governance of the HPC container runtime |

### Strategic (Quarter 1-2)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|-------------------------------|
| **Export control compliance** | "Cannot demonstrate infrastructure controls for ITAR/EAR research data" | Per-VM RBAC + managed bridges create export-controlled enclaves. Declarative config documents the controls for export control officers |
| **CMMC readiness** (DoD-funded institutions) | "Infrastructure controls not mapped to CMMC Level 2 practices" | Accelerate success program ($15K/yr) includes quarterly compliance mapping to CMMC practices. Zero-drift architecture satisfies configuration management requirements |
| **Reproducibility infrastructure** | "No institutional capability for computational reproducibility at scale" | NixOS declarative config + Apptainer management provides institution-wide reproducibility infrastructure. Partner success program ($30K/yr) includes environment templating for common research workflows |

---

## 6. Research/HPC-Specific Competitive Advantages {#6-competitive-advantages}

### vs VMware (Post-Broadcom)

| Factor | VMware | Weaver |
|--------|--------|-------------------|
| Cost (40-node HPC center) | $20,000–60,000/yr (Broadcom subscription-only) | $23,500/yr (Fabrick) or $5,960/yr (Weaver) |
| Apptainer management | None — Apptainer is invisible to VMware | v1.1 visibility, v1.2 full management from the same dashboard |
| Computational reproducibility | Not a design goal; drift is possible | Zero drift by construction (NixOS); declarative config IS the reproducible spec |
| GPU passthrough | Supported but complex configuration | Supported — NVIDIA `--nv`, AMD `--rocm` for Apptainer; PCIe passthrough for VMs |
| Research self-service | vRealize/Aria complexity; not designed for researchers | Weaver + Live Provisioning — researchers provision within admin-defined guardrails |
| Multi-tenant compliance isolation | Manual VLAN configuration per tenant | Declarative managed bridges — config documents the isolation for every compliance regime |

### vs Proxmox

| Factor | Proxmox | Weaver |
|--------|---------|-------------------|
| Apptainer integration | None — container management is Docker/LXC only | Apptainer-native (v1.1/1.2) — the HPC container runtime, managed from the dashboard |
| Reproducibility | No declarative config; VMs drift over time | Zero drift — NixOS declarative config is the environment specification |
| Audit trail | API call logs — captures actions, not intent | Git diffs — captures what changed AND why; satisfies NIST 800-171 audit requirements |
| GPU resource governance | Basic resource limits; no per-group quotas | Per-user/per-group resource quotas with dashboard visibility |
| Per-VM access control | Pool-level only | Per-VM role assignments — critical for multi-compliance-regime environments |
| AI diagnostics | None | Built-in — natural language failure analysis for researchers and admins |

### vs Cloud HPC (AWS ParallelCluster, Azure CycleCloud, Google Cloud HPC)

| Factor | Cloud HPC | Weaver |
|--------|-----------|-------------------|
| Data sovereignty | Data in cloud provider data centers — problematic for ITAR, CUI, institutional policy | **On your premises** — data never leaves institutional infrastructure |
| Cost per GPU-hour | $1.50–30+/hr depending on instance type; costs scale linearly | Unlimited VMs per node ($149–1,500/yr per node); GPUs are your hardware, no per-hour charges |
| ITAR/EAR compliance | Requires GovCloud + complex configuration; still a cloud provider | Self-hosted — export control officer can physically verify data location |
| Apptainer support | Limited or requires custom AMIs | Native Apptainer management (v1.1/1.2) |
| Internet dependency | 100% — no cluster without connectivity | Self-hosted — offline-first license, no phone-home. Critical for air-gapped research environments |
| Reproducibility | Ephemeral instances; environment must be rebuilt each time | Declarative config persists — environment is always reproducible from version-controlled spec |
| Budget predictability | Variable — researchers can accidentally spend $50K in a weekend | Fixed annual licensing; no surprise bills |

### vs Slurm / PBS / Traditional Job Schedulers

Weaver does not replace job schedulers — it extends them. SLURM schedules jobs; Weaver provides the hardware-isolated MicroVM execution environments those jobs run in. Neither product achieves this alone.

**SLURM + Weaver on NixOS: zero-friction co-deployment.** SLURM ships as a NixOS package — the job scheduler and the execution environment are both declared in the same NixOS configuration that Weaver manages. No separate SLURM deployment, no integration project. Head node, submit nodes, and compute nodes are all Weaver-managed nodes.

| Capability | SLURM Alone | SLURM + Weaver |
|---|---|---|
| **Job isolation** | Process/namespace boundary — jobs share the host kernel | Each job runs in its own MicroVM — hardware boundary, not just a namespace |
| **Noisy neighbor** | CPU/memory contention between concurrent jobs | Resource quotas enforce per-job allocation; hardware boundary eliminates interference |
| **Job environment** | Researcher-managed environment modules; drift over time | Declarative NixOS guest config per job type — identical environment on every run |
| **Node cleanliness** | State accumulates between jobs; periodic manual wipe | MicroVM destroyed at job end — node is provably clean before the next job starts |
| **GPU sharing** | SLURM GRes plugin allocates GPUs to batch jobs only | Weaver resource quotas + SLURM GRes — GPU shared between batch training and interactive sessions; governed across both |
| **Multi-tenant isolation** | File permissions + user accounts — soft boundary | Per-VM RBAC + hardware boundary — NIH, DoD, and NSF workloads coexist on the same hardware with different compliance controls |
| **Audit trail** | SLURM accounting logs | SLURM accounting + Weaver declarative log — what ran, and what infrastructure it ran on |
| **Compliance** | No built-in compliance evidence | Job-level hardware isolation + audit trail satisfies CUI, HIPAA, and ITAR requirements simultaneously on shared infrastructure |

**The integration model.** Weaver's Live Provisioning API acts as the execution backend for SLURM. When SLURM allocates a job, the prolog script calls Weaver to provision a MicroVM with the declared job environment. The job runs inside the MicroVM with a hardware isolation boundary. The epilog script tears down the MicroVM — the node is clean before the next job starts, by construction.

**Why hardware isolation matters in HPC.** Traditional SLURM gives researchers effective root in their job environment on a shared node — convenient, but the isolation boundary is a namespace, not hardware. A compromised or misbehaving job can affect co-resident jobs or the host. With Weaver, the boundary is physical: a job cannot escape its MicroVM regardless of what it does. This is what allows a single SLURM cluster to simultaneously host NIH clinical research, DoD CUI workloads, and open-science NSF projects on the same hardware — each job isolated at the hardware level, each compliance regime satisfied independently.

**GPU sharing across SLURM and interactive workloads.** Weaver resource quotas combined with SLURM's GRes plugin enable fair GPU sharing between queued training jobs and active Jupyter or interactive research sessions. When a training job completes and its MicroVM is torn down, the GPU is released to the shared pool — available to the next SLURM job or an interactive researcher without manual intervention.

**The Apptainer advantage.** Weaver governs the Apptainer container environment that SLURM dispatches jobs into (v1.1 visibility, v1.2 full lifecycle management). Researchers get their familiar Apptainer workflow; admins get dashboard governance; SLURM gets reproducible, auditable execution environments.

### vs Hydra Without Weaver

Hydra is excellent at what it does — evaluating Nix expressions and distributing builds. But Hydra has no opinion about how its build workers are provisioned, monitored, or governed. Research teams running Hydra today manage build workers manually or with ad-hoc scripts.

| Factor | Hydra Alone | Hydra + Weaver |
|--------|------------|--------------------------|
| Build worker provisioning | Manual `nixos-rebuild` per worker; SSH-based setup | Live Provisioning creates workers from declared templates — no host rebuilds |
| Burst capacity | Add workers manually when queues back up | Spin up Firecracker workers on demand (<125ms boot); tear down when the evaluation completes |
| GPU builder management | Manual GPU assignment; no visibility into GPU utilization across builders | GPU passthrough with resource quotas; dashboard shows real-time GPU utilization per builder |
| Multi-tenant build isolation | All builds share the same worker pool and network | Managed bridges isolate build workers per compliance regime — CUI code builds in a NIST 800-171 zone, open-source builds on a separate segment |
| Build infrastructure audit | Hydra logs what was built; no record of the infrastructure state | Declarative config + git history documents the exact infrastructure state during every build — critical for grant compliance |
| Worker health monitoring | Manual; no centralized dashboard | Weaver shows CPU/memory/disk/GPU across all workers; AI diagnostics explain build failures |
| Worker lifecycle | Workers accumulate state over time; periodic manual reprovisioning | Zero drift by construction — workers are declarative and reproducible; reprovisioning is a dashboard click |

**Positioning:** Weaver is not a Hydra replacement — it's the infrastructure layer Hydra is missing. Hydra schedules builds; Weaver manages the workers those builds run on. Together they deliver governed, reproducible CI from build definition (Nix) through build execution (Hydra) to build infrastructure (Weaver).

#### Hydra Build Farm Economics (at Scale)

Organizations running Hydra at scale — the NixOS Foundation, Cachix, corporate Nix adopters (Shopify, Mercury, Replit-class), anyone operating a private binary cache — face infrastructure costs that Weaver directly reduces.

| Cost Factor | Hydra Today | Hydra + Weaver |
|------------|------------|--------------------------|
| **Builder provisioning** | Manual per-machine setup; hours of admin time per builder | Live Provisioning from templates — minutes, not hours. One admin manages 10x the builders |
| **Burst economics** | Either overprovision (pay for idle capacity) or queue builds (pay in developer wait time) | Spin up Firecracker builders in <125ms when queues grow; tear down when evaluation completes. Pay for capacity only when needed |
| **GPU builder cost** | Dedicated bare-metal GPUs sitting idle between CUDA package builds, or cloud GPUs at $25/hr | Resource quotas share GPU builders between Hydra and interactive workloads. GPU utilization goes from 20% to 80%+ |
| **Builder failure recovery** | Builder goes down → manual diagnosis → manual reprovisioning → builds stalled | AI diagnostics identify the failure; zero-drift means reprovisioning is a dashboard click, not a rebuild |
| **Admin staff time** | Dedicated build infrastructure engineer(s) | Declarative management frees staff for package maintenance, security response, contributor support |
| **License cost** | N/A (bare metal) or cloud instance pricing | $149/node/yr (Weaver) — a rounding error vs the hardware and labor costs |

**Example: 100-builder farm with 8 GPU nodes**

| | Current | With Weaver |
|-|---------|----------------------|
| Builder admin labor (1 FTE, 60% on infra) | ~$60,000/yr | Reclaim 40%+ → **$24,000/yr freed** for package work |
| GPU idle cost (8 nodes at 20% utilization) | 80% waste on hardware worth $200K+ | Shared GPU scheduling pushes utilization to 60-80% — equivalent to **3-5 fewer GPU nodes avoided (~$60-100K)** |
| Build queue delays during nixpkgs staging merges | Hours of queued builds → delayed security patches | Burst workers absorb spikes; critical builds get priority |
| Weaver licensing | — | 100 nodes × $149 = **$14,900/yr** |
| **Net impact** | | **$24K labor freed + $60-100K GPU nodes avoided for $14,900/yr** |

**The pitch:** "You're running a build farm that costs six figures in hardware and labor. $149/node/yr gives you burst capacity that eliminates build queues, GPU sharing that eliminates idle waste, and declarative worker management that lets your team focus on packages instead of infrastructure. The dashboard pays for itself in the first month from GPU utilization alone."

For the full open-source project support case — including sponsorship models, community goodwill, and the NixOS Foundation specifically — see [opensource-support.md](opensource-support.md).

#### Kubernetes Complexity in Research/HPC

Slurm and Kubernetes coexist awkwardly in research environments. Researchers want job submission, not pod manifests. GPU scheduling in K8s requires device plugins, topology-aware scheduling, and NUMA-aware allocation — all bolted on after the fact. The result is two parallel scheduling systems (Slurm for batch, K8s for services) with no unified governance, no shared GPU inventory, and no single compliance view across both.

| K8s Overhead | Impact in Research/HPC | Weaver Alternative |
|---|---|---|
| GPU scheduling bolt-ons (device plugin + topology-aware + NUMA) | Each GPU scheduling component is a separate failure surface; version drift between plugins causes silent misallocation | GPU passthrough via VFIO-PCI is native; bridge routing distributes work across GPU VMs; no device plugin chain |
| Slurm/K8s fragmentation (two schedulers, two governance models) | Admins maintain two systems; compliance evidence split across Slurm accounting and K8s audit logs | Weaver manages the nodes both schedulers run on; single audit trail covers all workloads regardless of scheduler |
| Container namespace isolation insufficient for multi-regime compliance | NIH, DoD, and NSF workloads on shared K8s clusters require extensive compensating controls (OPA, PSA, network policies) | MicroVM hardware isolation: each compliance regime gets a hardware boundary, not a namespace. No compensating controls |

Full competitive reference: [KUBERNETES-COMPETITIVE-POSITIONING.md](../KUBERNETES-COMPETITIVE-POSITIONING.md)

### The Reproducibility Advantage

The computational reproducibility crisis is real. Nature, Science, and major journals now require computational environment documentation. NixOS is already gaining traction in the Nix for Science community precisely because its declarative model guarantees reproducibility. Weaver gives that community — and every research institution — a management layer that makes reproducibility the default, not a heroic effort. No other VM management dashboard has "reproducible by construction" as a design principle.

### The Apptainer Advantage

Apptainer (formerly Singularity) is the dominant container runtime in HPC — not Docker, not Podman, not LXC. Every HPC researcher knows Apptainer. But Apptainer management today is 100% CLI. Weaver is the first and only VM management dashboard to integrate Apptainer management (v1.1 visibility, v1.2 full lifecycle). This is a category-defining feature for the research/HPC vertical. No competitor — VMware, Proxmox, or cloud — offers unified VM + Apptainer management from a single dashboard.

### AI-Era Threat Landscape Advantage

Anthropic's Project Glasswing (April 2026) demonstrated that frontier AI can discover **thousands of zero-day vulnerabilities** — including some that survived decades of human review — across every major operating system and browser. These capabilities will proliferate to attackers.

**Why this changes the calculus for research/HPC:**

- **Shared-kernel = fleet-wide compromise.** A single kernel zero-day — exactly the kind AI is now finding by the thousands — compromises every Docker container on the host simultaneously. On a multi-tenant HPC cluster, that means every researcher's data — including export-controlled ITAR/EAR projects, NIH clinical datasets, and NSF-funded intellectual property — is exposed in one event. Weaver's hardware boundary per MicroVM contains the blast radius to one workload.
- **Patch at the speed of AI discovery.** Research institutions managing dozens of heterogeneous compute nodes cannot manually track and patch the volume of zero-days AI is now surfacing. NSF and NIH data management plans increasingly require documented patching practices. NixOS's `flake.lock` pins every dependency by hash. Pin the fix, rebuild, deploy via Colmena — every node converges deterministically. Compliance evidence is the git diff.
- **Supply-chain verifiability.** Glasswing explicitly targets open-source and supply-chain security. Research computing stacks are built almost entirely on open-source software. NixOS's content-addressed store makes the entire supply chain formally verifiable — satisfying NIST 800-171 supply chain risk management controls that CMMC and CUI-handling institutions must demonstrate.
- **Hypervisor diversity.** Weaver's 5 hypervisor options mean a vulnerability in one doesn't cascade to workloads on another — critical when different compliance regimes (NIH, DoD, NSF) share the same physical infrastructure.

---

## 7. Objection Handling {#7-objection-handling}

### "We already have a working Slurm/PBS cluster"

Weaver is the infrastructure layer below SLURM, not a replacement. SLURM manages your job queue; Weaver manages the nodes SLURM runs on. Since SLURM ships as a NixOS package, both layers are declared in the same configuration — no integration project required.

The substantive upgrade: with Weaver's prolog/epilog hooks calling the Live Provisioning API, each SLURM job runs inside a hardware-isolated MicroVM instead of sharing a namespace on a bare node. Jobs can't affect each other. Nodes are guaranteed clean between jobs. Different compliance regimes — NIH, DoD, NSF — can coexist on the same hardware because each job's isolation boundary is hardware, not just a namespace.

Your Slurm jobs get more reliable infrastructure. Your Apptainer workflows get dashboard governance. Your admins get compliance evidence — per-job audit trail, multi-regime isolation — that SLURM alone cannot produce.

### "Our researchers will revolt if you take away their SSH access"

We're not taking anything away. Weaver adds a governance layer that researchers never see. They still SSH into their VMs, still run Apptainer containers, still use Jupyter notebooks. The difference: admins now have visibility, researchers can self-service new environments from the dashboard instead of filing tickets, and the institution has audit evidence when the grant agency asks.

### "NixOS? Our researchers use Ubuntu/CentOS/Rocky"

NixOS roots go back to 2003 and it's been shipping stable releases for 12 years — 100K+ packages, ~466 companies in production. VMs managed by Weaver can run any guest OS — Ubuntu, Rocky, whatever the researcher needs. NixOS is the host infrastructure; it's what makes zero-drift and reproducibility possible at the infrastructure level. Researchers interact with their guest OS environment of choice. The Apptainer integration works regardless of guest OS.

### "We can't justify new software spend — our budget comes from grant overhead"

At $149/yr (FM, first 200) per node, Weaver costs less than one hour of a postdoc's salary. For a 40-node HPC center, Fabrick at $12,460/yr is a fraction of what VMware costs — and it eliminates $86K+ in staff time on infrastructure management. The ROI case writes itself for the grants office. Many institutions fund infrastructure software from indirect cost recovery; Weaver fits cleanly into that model.

### "We need to support multiple compliance regimes simultaneously (NIH, DoD, NSF)"

That's exactly what Fabrick is designed for. Per-VM RBAC + managed bridges create compliance-isolated zones on the same hardware. A NIST 800-171 zone for DoD-funded CUI, a HIPAA zone for clinical research, and an open-access zone for NSF-funded work — all managed from one dashboard with one audit trail that satisfies all three regimes. No other product does this declaratively.

### "What about our existing infrastructure and environments?"

We offer migration services ($5,000–20,000) that run in parallel with your existing setup. Start with a new research group or a fresh allocation, prove the model over one semester, and migrate remaining workloads on your schedule. Hub-agent multi-node architecture (v2.0+) manages both environments from one dashboard during transition.

### "GPU passthrough is critical — does this actually work?"

Yes. NVIDIA `--nv` and AMD `--rocm` passthrough for Apptainer containers. PCIe passthrough for VMs. Fabrick resource quotas enforce per-user/per-group GPU allocation so the "who has the A100s" problem goes away. Weaver shows real-time GPU utilization across the cluster.

### "Our HPC cluster runs Ubuntu — we can't convert 200 nodes overnight"

You don't have to. Install `weaver-observer` on your Ubuntu nodes — they appear in Fabrick immediately, job and workload-visible. Observer nodes are free up to 5× your Managed node count. Convert your CUI-handling partitions, your compliance-sensitive nodes, or new node purchases to NixOS first; observe the rest across hardware refresh cycles. For grant compliance purposes (NIST 800-171, IRB), the Managed vs Observed distinction is explicit — compliance evidence covers only Managed hosts. The fleet map shows your migration progress across the full cluster.

### "Our institutional IT security office vets every new software tool before we can deploy it"

Institutional IT security reviews typically require: CVD policy, software quality evidence, and vendor support commitment. All three are documented. CVD policy with 48-hour acknowledgment and 7-day critical fix SLAs — `SECURITY.md`. Testing benchmark scored A/A+ against enterprise standards with SAST on every push — `docs/TESTING-ASSESSMENT.md`. Documented DR procedures — `docs/setup/DISASTER-RECOVERY.md`. For NIH and NSF software transparency requirements increasingly appearing in Data Management Plans and software sustainability reviews, the open-core codebase and published engineering practices satisfy those requirements directly. Institutional IT security checklist approval in one package.

---

## 8. Buyer Personas {#8-buyer-personas}

### University HPC Center Director

**Cares about:** Researcher satisfaction, GPU utilization, compliance across funding sources, reproducibility, budget justification
**Lead with:** Apptainer integration (v1.1/1.2) — the only dashboard that manages the HPC container runtime. Resource quotas eliminate GPU allocation disputes. Declarative config provides reproducibility by construction. Multi-compliance-regime isolation on shared hardware. 80%+ cost reduction vs VMware.
**Tier:** Fabrick + Accelerate or Partner

### Research Computing Systems Administrator

**Cares about:** Reducing ticket volume, managing snowflake environments, Apptainer/container governance, automating routine provisioning
**Lead with:** Live Provisioning lets researchers self-service within guardrails — fewer tickets. Apptainer dashboard replaces shell-script management. Zero drift means environments don't decay into undocumented snowflakes. AI diagnostics explain failures in context. NixOS is the tool they've been wanting to use at work.
**Tier:** Weaver (small labs) or Fabrick (HPC centers)
**Note:** Research computing admins who use NixOS personally are the strongest champions. The Nix for Science community is a direct pipeline.

### PI / Lab Director (Principal Investigator)

**Cares about:** Getting compute resources for their lab without waiting, reproducible environments for publications, grant compliance documentation
**Lead with:** Self-service VM provisioning from the dashboard — no more waiting for admin tickets. Declarative environments mean your Nature paper's computational spec is version-controlled. Grant reporting becomes a git command. $149/yr (FM, first 200) per node fits into any lab's supply budget.
**Tier:** Weaver
**Note:** PIs who manage their own compute (common in smaller departments) buy Weaver directly. PIs in larger institutions champion Fabrick purchases to their HPC center director.

### Research IT Manager (Department-Level)

**Cares about:** Supporting multiple PIs with different needs, standardization without restricting researchers, compliance documentation for department reviews
**Lead with:** Managed bridges isolate different research groups on shared hardware. Per-VM RBAC maps to funding-source-specific access requirements. Declarative config standardizes infrastructure without standardizing research workflows. Bulk VM operations handle semester transitions.
**Tier:** Fabrick

### National Lab / Federally Funded Research Center IT

**Cares about:** NIST 800-171 / CMMC compliance, export controls, air-gap capability, multi-tenant isolation at scale
**Lead with:** Zero-drift architecture satisfies NIST 800-171 configuration management controls. Offline-first license (HMAC, no phone-home) supports air-gapped environments. Per-VM RBAC + managed bridges create compliance-isolated enclaves. Declarative audit log provides evidence for federal auditors. Apptainer integration governs the container runtime already in use across the lab.
**Tier:** Fabrick + Partner

### Data Science / ML Team Lead

**Cares about:** GPU access, fast environment provisioning, Apptainer/container workflows, cost vs cloud
**Lead with:** GPU passthrough (NVIDIA `--nv`, AMD `--rocm`) with resource quotas — no more fighting for GPUs. Apptainer management from a real dashboard. Sub-second VM boot for burst workloads. Fixed annual licensing vs cloud GPU-hour pricing — run your A100s 24/7 for $149/yr (FM, first 200) per node instead of $25/hr in the cloud. Environment reproducibility for ML experiment tracking.
**Tier:** Weaver (team-managed nodes) or Fabrick (institutional GPU cluster)

---

## 9. Discovery Questions {#9-discovery-questions}

Use these to qualify research/HPC prospects and identify pain:

### Infrastructure Pain
- How do researchers currently request new compute environments? How long does it take from request to ready?
- How do you manage Apptainer/Singularity containers today? Is there any dashboard or governance, or is it all CLI?
- How do you handle GPU allocation across competing research groups? Is there contention?
- When a researcher leaves, what happens to their VM environments? How much time do you spend cleaning up undocumented systems?
- How many snowflake VMs exist on your cluster right now — systems that nobody can reproduce from scratch?

### Compliance Pain
- How many different compliance regimes does your infrastructure need to satisfy simultaneously (NIH, DoD, NSF, HIPAA, ITAR)?
- How do you currently demonstrate NIST 800-171 compliance for CUI workloads?
- How do you isolate research workloads with different security classifications on shared infrastructure?
- When a grant agency requests infrastructure documentation, how long does it take to produce?
- Do you handle any export-controlled research? How do you ensure data stays on authorized systems?

### Budget Pain
- What are you currently spending on infrastructure management software?
- How much of your research computing staff time goes to infrastructure management vs researcher support?
- Have you compared your cloud HPC spending to on-premises costs? What's the GPU-hour cost difference?
- How much researcher time is lost waiting for environment provisioning or GPU access?

### Strategic Pain
- Has your institution been asked to demonstrate computational reproducibility for publications?
- Are you pursuing or maintaining CMMC certification for DoD-funded research?
- How do you handle the tension between researcher self-service and institutional governance?
- Is your institution considering expanding on-premises compute vs cloud? What's driving that decision?
- Is the Nix for Science community or NixOS reproducibility something your team has explored?
- "If a frontier AI discovered a zero-day in your host kernel tomorrow — which Project Glasswing has demonstrated is now routine — how many research datasets across how many compliance regimes would be compromised simultaneously?"
- "Glasswing's 90-day public disclosure cycle means vulnerabilities found in your stack become public knowledge. Can your current infrastructure prove it's patched faster than the disclosure window?"

---

---

## 10. Cloud Burst & AI/HPC Node Support (Fabrick v3.0+)

**Full analysis:** [business/FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md)

Research computing organizations — particularly those running large-scale AI/ML training and HPC simulation — operate a hybrid model: a persistent on-prem control plane (Slurm head node or Kubernetes master) with ephemeral cloud compute nodes that provision on queue depth and terminate on idle. These burst nodes run 8× H100 GPUs, 1–2TB host RAM, NDR InfiniBand — and sustain **multi-day runs** (3–14 days for LLM training, hours to 3 days for HPC simulation).

### The Compliance Gap Cloud HPC Doesn't Solve

Standard cloud burst uses shared-tenancy instances. For research institutions handling:
- **CUI / NIST 800-171** (DoD-funded research) — shared tenancy fails the data isolation requirement
- **ITAR/EAR** (export-controlled research) — data cannot flow through shared cloud infrastructure
- **HIPAA** (clinical research) — ePHI on shared tenancy requires HIPAA BAA + additional controls
- **IRB requirements** — human subjects data must stay on authorized systems

These institutions either avoid cloud burst entirely (lost throughput) or pay full on-demand dedicated tenancy rates (eliminates cost savings). **Fabrick + Weaver burst nodes resolve this:** MicroVM hardware isolation satisfies the compliance constraints that container namespaces cannot. The burst node appears as an extension of the on-prem fabric — not "cloud data."

### The Pitch for Research/HPC AI Teams

*"Your Slurm cluster is maxed out. You need burst capacity for the next training run. Your compliance officer says you can't put CUI training data on a shared cloud instance. Fabrick enrolls a dedicated cloud node with hardware-isolated MicroVMs — your Slurm jobs run on it like it's another rack in your datacenter. When the run is done, the node deregisters. You pay $20/node-day for Fabrick licensing, which is a rounding error against the $400/day you're paying CoreWeave for the H100s."*

### Licensing for Burst Nodes

AI/HPC burst nodes at 1TB+ fall under the Contract tier (512GB+ block pricing). For ephemeral burst nodes, annual per-node licensing is wrong — a 14-day training run doesn't warrant a yearly contract. Fabrick v3.0 introduces **per-node-day consumption licensing** stacking on the Contract tier base:

| License component | Coverage |
|---|---|
| Contract base (Fabrick $2,500/yr) | Fabrick control plane + persistent nodes |
| Contract block ($2,000 first block) | 512GB+ RAM per burst node |
| Burst add-on (~$20/node-day) | Per-day charge while burst node is enrolled |

A lab running 3 training runs per year at 14 days each on 4 nodes = 168 node-days = ~$3,360/yr burst add-on. Against $67,200 in cloud compute costs, Fabrick licensing is 5%.

### New Buyer Persona: AI/HPC Platform Engineer

**Profile:** Manages the compute infrastructure for an AI research team or HPC facility. Owns the Slurm/K8s cluster, GPU allocation, and burst provisioning. Frustrated by the Slurm vs. Kubernetes fragmentation and the compliance constraints on cloud burst for regulated data.

**Cares about:** GPU utilization efficiency, burst provisioning speed, InfiniBand topology for multi-node training, compliance posture for regulated datasets, scheduler integration (Slurm or K8s), cost vs cloud alternatives.

**Lead with:** Fabrick as the isolation layer beneath their existing scheduler — "we don't replace Slurm, we manage the nodes Slurm runs on." MicroVM isolation on burst nodes satisfies compliance requirements that container namespaces cannot. GPU inventory visibility across on-prem + cloud fleet from one dashboard.

**Tier:** Contract (512GB+ nodes) + Fabrick fleet license + burst consumption add-on + Partner success program ($30K/yr for HPC-specific integration and scheduler API bridge).

### Discovery Questions (AI/HPC Platform)

- How do you currently provision cloud burst nodes for training runs? How long does it take from job submission to compute available?
- What compliance constraints affect your ability to use standard cloud burst (shared tenancy)?
- Are you running Slurm, Kubernetes, or both? What's the friction point between them?
- How do you track GPU utilization and InfiniBand health across your burst fleet?
- How many node-days of cloud burst do you consume per year? What's the cost?
- Do you have training jobs that require multi-node InfiniBand coupling? How do you validate interconnect quality before committing to a multi-day run?

---

*This document complements the universal value proposition in [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md). For pricing details, see [TIER-MANAGEMENT.md](../../product/TIER-MANAGEMENT.md). For Fabrick justification, see [FABRICK-VALUE-PROPOSITION.md](../../marketing/FABRICK-VALUE-PROPOSITION.md). For cloud burst architecture and open decisions, see [FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md).*

---

## 11. Research/HPC GTM Motion {#11-gtm-motion}

### Why This Vertical Requires a Different Sales Motion

Research/HPC IT buyers are not self-serve Stripe checkout customers. They are institutional buyers with:

- **3–6 month procurement cycles** — IT capital requests, budget committee approvals, legal review of non-standard license terms (AGPL + Commons Clause will get questions)
- **Grant-driven budget timing** — NIH/NSF grant periods run Oct–Mar; equipment budgets unlock at grant award, not calendar year; fiscal years vary by institution (July or January)
- **Institutional IT authority** — the HPC center director or VP of Research Computing recommends; a procurement officer signs; general counsel reviews; PI may need to co-sign if funding is grant-sourced
- **Proof before commitment** — 1–2 node pilots before cluster-scale purchasing is the norm, not the exception

The standard inbound/self-serve funnel converts homelab users and small shops in hours. Research/HPC Fabrick Partner deals require a relationship-based motion with an institutional champion.

### Community Entry Points — Highest Intent

| Community | Why High Intent | How to Engage |
|---|---|---|
| **Hydra build farm operators** | Already on NixOS, already managing build workers, already feel the pain Weaver solves. Zero adoption friction. | NixOS Discourse, `#infra` on NixOS Matrix |
| **Nix for Science** | Using NixOS for reproducible research; Weaver is the management layer they're missing | nix-science mailing list, NixCon talks |
| **Research computing sysadmins on NixOS** | Individual contributors who become internal champions — they bring the HPC center director to a demo | NixOS Discourse, university Linux user groups |
| **CASC member institutions** | Coalition for Academic Scientific Computation — 65+ research universities managing HPC at scale | CASC listserv, PEARC community |

**The internal champion model:** The NixOS sysadmin who runs the HPC cluster convinces management. Target the individual contributor first — they do the evaluation, then champion up. Budget approval comes from above; technical credibility comes from below.

### Conference Presence

| Conference | Audience | Timing | Value |
|---|---|---|---|
| **NixCon** | NixOS developers and community | Annual (Oct) | Community credibility first — Hydra + Weaver integration talk; zero institutional sales pressure |
| **PEARC** (Practice & Experience in Advanced Research Computing) | US university research computing teams | July | Direct access to HPC IT buyers at mid-scale; paper/talk opportunity for reproducibility story |
| **SC** (Supercomputing) | HPC center directors, national lab IT, research computing staff | November | Premier HPC venue, 12,000 attendees; right timing is v2.2+ when multi-node ships |
| **ISC High Performance** | European HPC community, national labs | May (Germany) | International research computing; right for v2.2+ |

**Sequencing:** NixCon first (community credibility, free), PEARC next (institutional buyers, affordable), SC/ISC when multi-node (v2.2+) is ready to demo at cluster scale.

### Budget Entry Points

| Budget Type | Timing | How Weaver Fits |
|---|---|---|
| **Grant indirect cost recovery** | Year-round (follows grant awards) | Infrastructure software from overhead funds; PI-initiated; $149–1,500/node is below most institutional purchasing thresholds — no committee approval required |
| **NSF/NIH equipment budget** | Grant-specific | Weaver listed as "computing infrastructure" in grant proposals; reproducibility and compliance documentation justify it to program officers |
| **IT capital budget** | Oct–Dec request, Jan–Jul approval | HPC center cluster infrastructure budget; Fabrick cluster licensing; formal procurement, 3–6 months |
| **DOE/DoD national lab IT** | Federal fiscal year (Oct) | Contract tier; requires security review; 6–12 month cycle |

**The under-$5,000 entry:** A single research lab (2–4 nodes) at Weaver ($596–$1,496/yr) is below most institutional purchasing thresholds — a PI can expense it directly without committee approval. This is the foot-in-the-door that leads to HPC center adoption one lab at a time.

### Sales Motion by Institution Type

| Institution | Entry Point | Champion | Decision Maker | Typical Timeline |
|---|---|---|---|---|
| **University research lab** | Weaver self-serve (PI-direct) | PI or postdoc sysadmin | PI | 1–2 weeks |
| **University HPC center** | Pilot via NixOS community contact | Research computing sysadmin | HPC center director | 3–6 months |
| **Federally funded research center** | Channel Partner referral or conference | Infrastructure architect | IT manager / CISO | 6–12 months |
| **National lab (DOE, NIH, etc.)** | Conference or existing relationship | Research computing lead | Center IT director + procurement | 9–18 months |

### Channel for Research/HPC

The Channel Partner program (NixOS consultancies, $30K/yr) is the right vehicle for institutional-scale Research/HPC sales. A NixOS consultancy with HPC experience can introduce Weaver through existing university and lab relationships, deliver the initial SLURM integration (Adopt/Accelerate program), and own the ongoing Fabrick Partner relationship for large clusters.

**Target channel partners for Research/HPC:** NixOS consultancies that already serve university IT, government research computing, or scientific computing. Identify at NixCon and through the NixOS Discourse professional services section. Channel Partner commission on a 100-node Fabrick Partner deal (~$97,500/yr) at 15% = $14,625/yr recurring — strong incentive for a NixOS consultancy to invest in the relationship.

---

## Recent Changes

- **2026-03-26** — Added fleet onboarding subsection to Section 4 (Fabrick). CIDR probe for on-prem nodes + cloud-provider scan for Hetzner/DO (v2.4.0) and AWS (v3.0); single session covers hybrid cluster discovery; NIST 800-171 3.3.1 evidence for CUI-hosting institutions.
- **2026-03-19** — Added Section 11: Research/HPC GTM Motion. Covers why institutional buyers require a different sales motion, community entry points (Hydra operators, Nix for Science, CASC), conference sequencing (NixCon → PEARC → SC/ISC), budget entry points, sales motion by institution type, and channel partner economics.
- **2026-03-19** — Fabrick Partner bundle added as recommended path for cluster buyers. One contract, one named engineer, one renewal date. Table showing 20/40/100-node pricing.
- **2026-03-19** — Fabrick success programs updated: SLURM integration made the headline deliverable across all three tiers. Adopt = initial SLURM deployment. Accelerate = quarterly SLURM health checks + compliance mapping. Partner = named engineer who owns the SLURM + Weaver integration end-to-end.
- **2026-03-19** — SLURM-native integration added throughout: Weaver capabilities table (SLURM row), vs SLURM competitive section (expanded to full comparison table + integration model), and objection handling (hardware isolation per job, prolog/epilog API model). SLURM is open source (GPL v2, NixOS package), positions as the scheduling layer above Weaver's MicroVM execution layer.
- **2026-03-19** — Added Section 10: Cloud Burst & AI/HPC Node Support (Fabrick v3.0+). Covers compliance gap, per-node-day licensing model, and new AI/HPC Platform Engineer buyer persona. Full analysis in [FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md).
- **2026-03-18** — Fabrick pricing revised to $2,000/yr first node, $750/yr additional, $500/yr at 10+. Fabrick tier added at $2,500/yr (512GB RAM). Contract tier added for 512GB+ deployments (sliding scale per 512GB block). RAM coverage noted per tier. Parallel migration / no-expertise-required positioning added as primary lead.
