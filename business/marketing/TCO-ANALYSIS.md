<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver — Total Cost of Ownership Analysis

**Created:** 2026-03-22
**Revised:** 2026-04-06 — Updated all Weaver/FabricK pricing per Decision #142: FM Fabrick $999→$1,299/node, Team $149→$199/user standard ($99→$129 FM), tiered additional nodes ($1,250/2-4, $1,000/5-9, $750/10+), AI Pro/AI Fleet retired and included in base price as Smart Bridges. Recalculated all downstream TCO, ROI, and revenue projections.
**Status:** Active — covers v1.0 through v3.0
**Scope:** Software licensing + setup labor + ongoing maintenance labor + operational model value (adoption friction, drift elimination, provisioning velocity, incident response, compliance, knowledge continuity, lock-in). Hardware costs excluded (same hardware assumed across all alternatives).

---

## Executive Summary

**Labor + licensing only (tables below):**

| Milestone | Profile | Weaver FM Y1 | Best Alternative Y1 | Weaver Advantage |
|-----------|---------|:------------:|:-------------------:|:----------------:|
| v1.0 | Solo Sysadmin (1 node) | **$749** | $1,575 (Cockpit) | 2.1× cheaper |
| v1.2 | Solo Sysadmin (1 node) | **$1,012** | $3,300 (Proxmox) | 3.3× cheaper |
| v1.2 | Solo Sysadmin (1 node) | **$1,012** | $14,700 (DIY NixOS) | **14.5× cheaper** |
| v2.0 | Solo Sysadmin + AI/ML (1 node, 2 GPUs) | **$1,262** | $29,100 (DIY NixOS + MLOps) | **23× cheaper** |
| v2.0 | Solo Sysadmin + AI/ML (1 node, 2 GPUs) | **$1,262** | $13,800 (Anyscale/Run:ai equivalent) | **10.9× cheaper** |
| v2.2 | Mid Fabrick + GPU fleet (10 nodes, 20 GPUs) | **$19,590** | $74,000 (DIY + Slurm) | **3.8× cheaper** |
| v2.2 | Mid Fabrick + GPU fleet (10 nodes, 20 GPUs) | **$19,590** | $95,000 (Run:ai equivalent) | **4.9× cheaper** |
| v3.0 | Large Fabrick + fleet bridge (20 nodes) | **$35,260** | $134,400 (DIY NixOS) | **3.8× cheaper** |
| v3.0 | Large Fabrick + fleet bridge (20 nodes) | **$35,260** | $164,400 (Proxmox + NSX equivalent) | **4.7× cheaper** |

**Full-picture 3-year advantage (labor + operational model value vs DIY):**

| Profile | 3-year total advantage |
|---------|:---------------------:|
| Solo Sysadmin (v1.2, 1 node) | **$39,378** |
| Solo Sysadmin + AI/ML (v2.0, 1 node, 2 GPUs) | **$87,300** |
| Mid Fabrick + GPU fleet (v2.2, 10 nodes, 20 GPUs) | **$311,455** |
| Large Fabrick + fleet bridge (v3.0, 20 nodes) | **$732,162** |

**Key finding (labor cost):** Weaver's primary TCO story is not software licensing (the license cost is secondary). It is the **labor cost elimination**. The alternatives require between 3× and 23× more labor to achieve equivalent capability at the sysadmin level, and the gap widens with team size and GPU workload complexity.

**Key finding (AI/inference gap):** The v2.0+ capabilities (model deployment, GPU scheduling, snapshot provisioning, fleet inference routing) have no market equivalent at Weaver's price point. Run:ai charges $50K+/yr for GPU scheduling alone. Weaver Fabrick at $11,500/yr (v2.2) delivers GPU scheduling + VM management + model deployment + fleet visibility — with Smart Bridges (AI) included in the base price — for **20% of Run:ai's cost**. At v3.0, Fabrick delivers fleet bridge (SDN) + inference routing + HA + GPU scheduling for **28% of the equivalent Rancher + Run:ai + Calico stack**.

**Key finding (value capture):** With the addition of Decisions #113–119, the 3-year value delivered at scale has crossed **$1M** ($1,003,362 for 20 nodes with edge). Fabrick FM at $90,420 over 3 years captures **9.0%** of this value. Fabrick standard at $73,980 captures **7.4%**. Industry norm is 20–35%. AI capabilities (Smart Bridges) are now included in the base tier price (Decision #142), eliminating the separate AI Pro/AI Fleet extension model.

**Key finding (operational model):** The version milestone tables below capture setup and maintenance labor. They do not capture the second TCO layer: the value of the NixOS operational model that Weaver preserves and extends — adoption without migration, configuration drift elimination, provisioning velocity, atomic rollback, audit readiness, knowledge continuity, and fleet-level remote workload management. When these are included, the 3-year value differential grows by **$23K–$548K** depending on scale. See the Operational Model Value section for quantification.

**Critical caveat:** For several features (NixOS Live Provisioning, unified VM + container + GPU management from a single API), **no market alternative exists at any price**. The TCO comparison below reflects the closest achievable alternative stack — which is still not a true equivalent.

---

## Methodology

### Deployment Profiles

| Profile | Hosts | Hourly Labor Rate | Typical Buyer |
|---------|:-----:|:-----------------:|---------------|
| Solo Sysadmin | 1 | $75/hr | Home lab, solo IT, small startup with one sysadmin |
| Mid Enterprise | 10 | $100/hr | IT team of 3–5, mid-size org, internal infrastructure |
| Large Enterprise | 20 | $120/hr | Enterprise IT, larger dedicated team |

Labor rates are blended estimates for skilled infrastructure engineers. Organizations relying on consultants face $150–175/hr, which accelerates Weaver's ROI by an additional 20–46%.

### TCO Formula

```
Year 1 TCO  = software license (1 yr) + setup labor (one-time) + maintenance labor (12 mo)
Year 3 TCO  = software license (3 yr) + setup labor (one-time) + maintenance labor (36 mo)
```

Setup labor is a one-time sunk cost in Year 1; it does not recur. Year 3 reflects true ongoing costs after the setup investment.

### What's Included

- **Software licensing:** Annual subscription or perpetual license fees
- **Setup labor:** Time to deploy, configure, integrate, and migrate workloads — including OS-level setup, networking, monitoring, and first-run testing
- **Ongoing maintenance:** Routine monitoring, updates, troubleshooting, new workload onboarding, and incident response normalized per month

### What's Excluded

- Hardware (identical across alternatives)
- Network infrastructure (identical)
- Unplanned downtime cost (noted qualitatively where significant)
- Training costs for net-new technologies (e.g., Kubernetes ramp-up for a sysadmin moving to Rancher)
- Recruiting/retention premium for specialist skills (e.g., NixOS consultants)

### Maintenance Hours: Calibration Basis

Maintenance estimates are grounded in the tasks each toolchain requires per month:

| Task | Weaver | DIY NixOS | Proxmox Sub | Rancher |
|------|:------:|:---------:|:-----------:|:-------:|
| Apply updates | GUI, 5 min | Edit flake + `nixos-rebuild` per host | Web UI, 15 min/host | `helm upgrade` + drain per node |
| New workload provisioning | Live Provisioning API, < 5 min | Edit NixOS config, rebuild host, test | VM template + clone | Write YAML, apply, debug |
| Monitoring check | Weaver, 5 min | `ssh` + CLI per host | `pvesh` or web UI | Grafana + `kubectl` |
| Incident response | AI Diagnostics + one-pane drill-down | SSH all affected hosts | Proxmox task log | `kubectl describe` + logs |
| Certificate/auth rotation | Automation built-in | Manual per-host edits | Manual or plugin | cert-manager + secret rotation |

---

## Feature Parity by Milestone

This table establishes what each alternative can and cannot deliver. TCO is meaningless if the comparison stack cannot achieve the same outcome.

| Capability | Weaver | DIY NixOS | Cockpit+Portainer | Proxmox | Rancher/K3s | OpenShift |
|------------|:------:|:---------:|:-----------------:|:-------:|:-----------:|:---------:|
| NixOS host management | ✓ Native | ✓ Native | ✓ Partial | ✗ Different OS | ✗ Different OS | ✗ Different OS |
| MicroVM management (Firecracker, etc.) | ✓ v1.0 | ✓ Manual | ✗ | ✗ | ✗ | ✗ |
| Live Provisioning (no nixos-rebuild) | ✓ v1.0 | ✗ Not possible | ✗ | ✗ | ✗ | ✗ |
| Container management (Docker/Podman) | ✓ v1.0 | ✗ Manual | ✓ Portainer | ✓ LXC only | ✓ K8s | ✓ K8s |
| Apptainer/OCI images | ✓ v1.2 | ✓ Manual | ✗ | ✗ | ✗ | ✗ |
| GPU workload allocation | ✓ v1.2 | ✓ Manual | ✗ | Partial | ✓ (device plugin) | ✓ (complex) |
| GPU inventory + scheduling (manual/best-fit/all-linked) | ✓ v1.2 | ✗ | ✗ | ✗ | ✗ Slurm needed | ✗ Slurm needed |
| GPU telemetry (utilization, VRAM, temp, power) | ✓ v1.2 | ✓ nvidia-smi manual | ✗ | ✗ | Partial | ✓ (Prometheus) |
| AI diagnostics | ✓ v1.0 | ✗ | ✗ | ✗ | ✗ | ✗ |
| Mobile remote management | ✓ v1.3 | ✗ | ✗ | Partial (web) | ✗ | ✗ |
| Model library + deployment workflow | ✓ v2.0 | ✗ | ✗ | ✗ | ✗ | ✗ |
| Snapshot-based model provisioning (2–5 sec restore) | ✓ v2.0 | ✗ | ✗ | ✗ | ✗ | ✗ |
| Inference metrics (tokens/sec, latency, queue depth) | ✓ v2.1 | ✗ | ✗ | ✗ | ✗ Custom Prometheus | ✗ Custom |
| RBAC + audit log | ✓ v2.2 | ✗ Manual | ✗ | ✓ Subscription | ✓ | ✓ |
| GPU reservation / queue / preemption | ✓ v2.2 | ✗ | ✗ | ✗ | ✗ Slurm/Run:ai | ✗ Run:ai |
| Snapshot-based auto-scaling | ✓ v2.2 | ✗ | ✗ | ✗ | ✗ | ✗ |
| Multi-host visibility | ✓ v2.2 | ✓ Colmena | ✗ | ✓ Datacenter | ✓ | ✓ |
| Fleet inference metrics (aggregated) | ✓ v2.2 | ✗ | ✗ | ✗ | ✗ Custom | ✗ Custom |
| Secrets management | ✓ v2.2 | ✓ Manual | ✗ | ✗ | ✓ Vault plugin | ✓ |
| HA clustering / live migration | ✓ v3.0 | ✗ | ✗ | ✓ (Ceph, non-NixOS) | ✓ (K8s) | ✓ |
| Fleet virtual bridge (VXLAN/WG overlay SDN) | ✓ v3.0 | ✗ | ✗ | ✗ | ✗ Calico/Cilium | ✓ OVN |
| Fleet inference routing | ✓ v3.0 | ✗ | ✗ | ✗ | ✗ | ✗ |
| Fleet snapshot distribution (cache warming) | ✓ v3.0 | ✗ | ✗ | ✗ | ✗ | ✗ |
| Fleet GPU scheduling (cross-host placement) | ✓ v3.0 | ✗ | ✗ | ✗ | ✗ Slurm | ✗ |
| Unified VM + container + GPU in one pane | ✓ v1.2+ | ✗ | ✗ | ✗ | ✗ | ✗ |
| NixOS-native workload model throughout | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

**"No market equivalent" features:** Live Provisioning on NixOS, unified management of MicroVMs + Apptainer + Docker + GPU from a single API, NixOS-native workload model maintained through fabrick scale, snapshot-based model provisioning (2–5 sec GPU inference restore), integrated fleet virtual bridge with workload-group-aligned overlay networks. When the DIY alternative builds these, it is building the product — not evaluating an alternative.

---

## v1.0 — Foundation

**Capabilities shipped:** VM dashboard, Live Provisioning (5 hypervisors), basic container view, AI diagnostics, tier-gated security
**Buyer profile:** Solo sysadmin adopting Weaver as primary NixOS workload management layer

### Setup Hours (1 node, per-tool)

| Alternative | Setup Hours | Notes |
|-------------|:-----------:|-------|
| Weaver v1.0 | 2 hrs | Install, configure license, first VM provisioned |
| Cockpit | 3 hrs | Install modules, configure auth, verify VM visibility |
| Cockpit + Portainer | 5 hrs | Both tools, integration, agent registration |
| DIY NixOS scripts | 60 hrs | nixos config, VM module, custom API wrapper, basic monitoring |

### Monthly Maintenance Hours (1 node, steady state)

| Alternative | Hrs/mo | Driver |
|-------------|:------:|--------|
| Weaver v1.0 | 0.5 | GUI-driven; AI diagnostics reduce incident time |
| Cockpit | 1.5 | Manual CLI for VMs; no container view |
| Cockpit + Portainer | 2.5 | Two tools; no Live Provisioning; context switching |
| DIY NixOS | 5.0 | Manual config edits; SSH-based management; no unified UI |

### TCO: Solo Sysadmin (1 node, $75/hr)

| Alternative | License/yr | Setup $ | Maint $/yr | **Y1 TCO** | **Y3 TCO** |
|-------------|:----------:|:-------:|:----------:|:----------:|:----------:|
| **Weaver** | $149 | $150 | $450 | **$749** | **$1,947** |
| Cockpit | $0 | $225 | $1,350 | $1,575 | $4,275 |
| Cockpit + Portainer | $179 | $375 | $2,250 | $2,804 | $7,662 |
| DIY NixOS | $0 | $4,500 | $4,500 | $9,000 | $18,000 |

> **Weaver Y3:** $149 × 3 + $150 + $450 × 3 = $447 + $150 + $1,350 = **$1,947**
> **DIY Y3:** $0 + $4,500 + $4,500 × 3 = $4,500 + $13,500 = **$18,000**

### Observations

- Cockpit cannot provision NixOS MicroVMs via API. It provides system monitoring and KVM pass-through, not Live Provisioning. The 1.5 hrs/mo maintenance reflects what Cockpit *can* do, not Weaver parity.
- DIY $4,500 setup assumes a skilled NixOS engineer. A developer unfamiliar with NixOS modules faces 120–200 hrs at setup (plus potential consultant fees at $175/hr, tripling the setup line to $13,500–$17,500).
- **Feature gap:** Neither Cockpit nor Portainer provides Live Provisioning. The DIY path delivers this capability but at 12× the Year 1 cost.

---

## v1.2 — "The Closer" (Unified Workload Management)

**Capabilities shipped (cumulative):** + Apptainer/OCI integration, Docker/Podman management parity, GPU workload allocation, unified single pane for all workload types, mobile foundation
**Tagline:** "MicroVMs + Apptainer + Docker + GPU from one pane"
**Buyer profile:** Solo sysadmin who runs a mixed workload stack (VMs for isolation, Docker for apps, Apptainer for HPC/ML)

### What "feature parity" requires from alternatives

To replicate Weaver v1.2 with open-source tooling on NixOS:

- Cockpit (VM visibility) + Portainer (Docker/Podman) + custom Apptainer management scripts + custom GPU allocation scripts + custom unified API + custom dashboard
- Estimated setup: **10+ hours** for an experienced engineer. Ongoing: **4 hrs/mo** minimum to maintain three separate tools with no shared authentication or state.
- **This stack has no equivalent to Live Provisioning.** Creating a new VM still requires `nixos-rebuild switch` on the host.

### Setup Hours (1 node)

| Alternative | Setup Hours | Notes |
|-------------|:-----------:|-------|
| Weaver v1.2 (upgrade from v1.0) | 0.5 hrs | Version update only |
| Weaver v1.2 (fresh install) | 2.5 hrs | Standard fresh deploy |
| Cockpit + Portainer + scripts | 10 hrs | Three tools + GPU scripts + Apptainer wrappers |
| DIY NixOS (full v1.2 parity) | 100 hrs | All above, plus unified API, basic UI, AI integration excluded |
| Proxmox (migrate from NixOS) | 20 hrs | OS migration; Weaver users migrating to Proxmox lose NixOS entirely |

### Monthly Maintenance Hours (1 node, v1.2 feature set)

| Alternative | Hrs/mo | Driver |
|-------------|:------:|--------|
| Weaver v1.2 | 0.75 | Slightly more config at v1.2; GPU profiles + Apptainer extensions |
| Cockpit + Portainer + scripts | 4.0 | Three tools; no shared auth; GPU scripts break on kernel updates |
| DIY NixOS | 8.0 | Unified API maintenance; Apptainer updates; GPU driver conflicts; per-tool monitoring |
| Proxmox Community | 2.0 | Solid web UI; but: NixOS capabilities lost, MicroVM model eliminated |

### TCO: Solo Sysadmin (1 node, $75/hr)

| Alternative | License/yr | Setup $ | Maint $/yr | **Y1 TCO** | **Y3 TCO** | Parity? |
|-------------|:----------:|:-------:|:----------:|:----------:|:----------:|:-------:|
| **Weaver FM** | $149 | $188 | $675 | **$1,012** | **$2,660** | Full |
| **Weaver Standard** | $249 | $188 | $675 | **$1,112** | **$2,960** | Full |
| Cockpit + Portainer + scripts | $179 | $750 | $3,600 | $4,529 | $12,087 | Partial † |
| Proxmox Community | $0 | $1,500 | $1,800 | $3,300 | $6,900 | Partial ‡ |
| DIY NixOS | $0 | $7,500 | $7,200 | $14,700 | $29,100 | Near-full § |

> **Weaver FM Y3:** $149 × 3 + $188 + $675 × 3 = $447 + $188 + $2,025 = **$2,660**
> **Cockpit+Portainer Y3:** $179 × 3 + $750 + $3,600 × 3 = $537 + $750 + $10,800 = **$12,087**
> **DIY NixOS Y3:** $0 + $7,500 + $7,200 × 3 = $7,500 + $21,600 = **$29,100**

† Cockpit + Portainer + scripts: No Live Provisioning. Apptainer and GPU support are scripts that break on updates. No unified API. No AI diagnostics.
‡ Proxmox Community: Completely different OS model. Cannot coexist with NixOS workflows. Loses all NixOS reproducibility and MicroVM support. Proxmox setup cost of $1,500 assumes migration from NixOS — a significant capability regression.
§ DIY NixOS: Closest to parity but excludes AI diagnostics and polished UI. At $14,700 Year 1 vs $1,012 for Weaver FM, this is **14.5× more expensive for equivalent (not superior) capability**.

### ROI Crossover: v1.2

Weaver FM pays for itself versus DIY in approximately **1 week** of Year 1. The $13,688 saved in Year 1 equals **91× the annual license cost**.

If an organization's sysadmin costs $75/hr (fully loaded) and spends 100 hrs building the DIY equivalent, that's $7,500 in setup — which is the entire 3-year Weaver FM cost ($2,660) multiplied by 2.8. They spent 2.8 years of Weaver licensing to reach Day 1 functionality.

---

## v1.3 — Mobile Remote Management

**Capabilities shipped (cumulative):** + iOS/Android dashboard, WireGuard wizard (self-hosted, air-gap compatible), push notifications for critical alerts
**Buyer profile:** Solo sysadmin or small IT team managing production infrastructure with on-call responsibilities
**TCO angle:** v1.3 reduces on-call response cost — the correct comparison is not "what does it cost to build this" but "what does on-call labor cost without it."

### On-Call Cost Without Mobile Management

Without WireGuard wizard and push notifications, a sysadmin managing production VMs on call experiences:

| On-Call Task | Without Weaver v1.3 | With Weaver v1.3 |
|---|---|---|
| Critical alert detection | Scheduled checks or third-party alerting service | Push notification to phone |
| Remote diagnosis | SSH session from laptop; requires VPN setup or port exposure | Mobile dashboard, AI diagnostic in < 2 min |
| VM restart/recovery | `nixos-rebuild` or manual SSH; full laptop required | Mobile Live Provisioning action |
| Estimated time per incident | 45–90 min | 5–15 min |

**Estimated on-call overhead without mobile (normalized):**
- 2 interruptions/mo at 45 min average = 1.5 hrs/mo
- At $75/hr fully loaded: **$1,350/yr in on-call labor**
- With Weaver v1.3 (mobile): same interruptions at 10 min average = 0.33 hrs/mo → **$297/yr**
- Annual savings from mobile management: **$1,053/yr**

### TCO: Solo Sysadmin (1 node, $75/hr) — v1.3 with On-Call Labor

| Alternative | License/yr | Setup $ | Maint + On-Call $/yr | **Y1 TCO** | **Y3 TCO** |
|-------------|:----------:|:-------:|:--------------------:|:----------:|:----------:|
| **Weaver v1.3 FM** | $149 | $225 | $450 + $297 = $747 | **$1,121** | **$2,916** |
| Weaver v1.3 Standard | $249 | $225 | $747 | **$1,221** | **$3,216** |
| Weaver v1.2 (no mobile) | $149/$249 | $188 | $675 + $1,350 | $2,212/$2,312 | $6,436/$7,084 |
| DIY (WireGuard + alertmanager + ntfy) | $0 | $1,800 † | $2,025 + $450 on-call | $4,275 | $11,550 |
| No mobile solution (baseline) | $0 | $0 | $1,350 on-call overhead | $1,350 | $4,050 |

† DIY WireGuard setup: 8 hrs × $75 = $600; DIY push notifications (Prometheus + Alertmanager + ntfy or Gotify): 16 hrs × $75 = $1,200; total setup $1,800. Ongoing: 2 hrs/mo to maintain custom alerting pipeline.

### Observations

- WireGuard wizard is the primary Weaver gate for v1.3. WireGuard is available free — but configuring peer keys, NixOS modules, firewall rules, key rotation, and mobile clients takes 6–10 hrs for an experienced engineer and 2–4 hrs/yr to maintain.
- Push notifications are trivially cheap to run; the value is the **integration**: push fires on Live Provisioning events, AI diagnostic thresholds, and resource alerts — all from the Weaver event bus. DIY requires custom alerting pipeline connected to all three data sources separately.
- For organizations with staff on on-call rotations, v1.3 reduces per-incident response time from ~60 min to ~10 min. At 10 incidents/mo across a 3-person rotation, this is **~8 hrs/mo saved** = $7,200/yr in recovered labor at $100/hr.

---

## v2.0 — Model Deployment + GPU Scheduling + Snapshot Provisioning

**Capabilities shipped (cumulative):** + Model library in Shed, 7-step model deployment workflow, auto-snapshot on inference health check, memory snapshot (QEMU warm restore, 2–5 sec), disk snapshot (OS + weights, 10–30 sec), GPU templates (CUDA/ROCm/oneAPI), snapshot version tagging + pruning, disk lifecycle, cloud-init integration
**Buyer profile:** Solo sysadmin or small team running AI/ML inference workloads on NixOS with 1–4 GPUs
**TCO angle:** v2.0 eliminates the need for separate MLOps tooling (MLflow, Weights & Biases, Anyscale, Run:ai at single-host scale) by integrating model deployment into the same UI that manages VMs, containers, and GPU workloads.

### What "feature parity" requires from alternatives

To replicate Weaver v2.0 model deployment on NixOS with open-source tooling:
- MLflow or similar for model registry + deployment tracking
- Custom NixOS integration for GPU assignment and inference health checks
- Custom snapshot scripts (QEMU monitor + CRIU for memory state)
- Custom integration between model registry and Live Provisioning
- **No existing tool provides snapshot-based model restore at 2–5 sec.** The closest alternative (full provision from scratch) takes 3–10 min for large models.

Commercial alternatives:
- **Anyscale (Ray Serve):** $0.50–$2.00/GPU-hr → $7,200–$28,800/yr for 2 GPUs at 50% utilization
- **Run:ai (single-node):** ~$6,000/yr/node for GPU scheduling + orchestration
- **Weights & Biases (Model Registry):** $50/user/mo = $600/yr (registry only, no deployment)
- **MLflow (self-hosted):** $0 license, 40+ hrs setup, 3 hrs/mo maintenance

### Setup Hours (1 node, 2 GPUs)

| Alternative | Setup Hours | Notes |
|-------------|:-----------:|-------|
| Weaver v2.0 (upgrade from v1.2) | 1 hr | Version update + configure model library |
| Weaver v2.0 (fresh install) | 3 hrs | Standard deploy + GPU config + first model deployment |
| DIY NixOS + MLflow | 120 hrs | MLflow setup + NixOS GPU integration + custom snapshot scripts + custom deployment pipeline |
| DIY NixOS + custom scripts | 160 hrs | No MLflow; build model registry, deployment workflow, snapshot automation, inference health check from scratch |
| Anyscale (commercial) | 20 hrs | Account setup + Ray cluster config + model onboarding + integration with existing infra |

### Monthly Maintenance Hours (1 node, 2 GPUs, v2.0 feature set)

| Alternative | Hrs/mo | Driver |
|-------------|:------:|--------|
| Weaver v2.0 | 1.0 | GUI-driven model deployment; auto-snapshot; GPU telemetry dashboard |
| DIY NixOS + MLflow | 6.0 | MLflow updates, custom GPU script maintenance, snapshot script debugging, model version tracking |
| DIY NixOS + custom scripts | 10.0 | Everything custom; driver conflicts; no unified UI; manual snapshot management |
| Anyscale/Run:ai | 2.0 | Commercial tool maintenance; integration updates; billing management |

### TCO: Solo Sysadmin + AI/ML (1 node, 2 GPUs, $75/hr)

| Alternative | License/yr | Setup $ | Maint $/yr | **Y1 TCO** | **Y3 TCO** | Parity? |
|-------------|:----------:|:-------:|:----------:|:----------:|:----------:|:-------:|
| **Weaver FM** | $149 | $225 | $900 | **$1,274** | **$3,372** | Full |
| **Weaver Standard** | $249 | $225 | $900 | **$1,374** | **$3,672** | Full |
| DIY NixOS + MLflow | $0 | $9,000 | $5,400 | $14,400 | $25,200 | Near-full † |
| DIY NixOS + custom | $0 | $12,000 | $9,000 | $21,000 | $39,000 | Near-full † |
| Anyscale equivalent ‡ | $7,200 | $1,500 | $1,800 | $10,500 | $25,500 | Different § |
| Run:ai (single-node) | $6,000 | $1,500 | $1,800 | $9,300 | $23,100 | Partial ¶ |

> **Weaver FM Y3:** $149 × 3 + $225 + $900 × 3 = $447 + $225 + $2,700 = **$3,372**
> **DIY NixOS + MLflow Y3:** $0 + $9,000 + $5,400 × 3 = $9,000 + $16,200 = **$25,200**
> **Anyscale Y3:** $7,200 × 3 + $1,500 + $1,800 × 3 = $21,600 + $1,500 + $5,400 = **$28,500**

† DIY NixOS: Closest to feature parity but no snapshot-based model restore (the killer feature). Manual model deployment takes 3–10 min per model vs 2–5 sec from snapshot. Over 50 deployments/yr, that's 4–8 hrs of deployment time vs < 5 min total.
‡ Anyscale: Usage-based pricing at $0.50–$2.00/GPU-hr. Estimated 50% GPU utilization × 2 GPUs × 8,760 hrs/yr × $0.82 avg = ~$7,200/yr. Actual costs vary by utilization and GPU tier.
§ Anyscale: Different model — cloud-native Ray Serve, not on-prem NixOS. Does not preserve NixOS workload model. Requires cloud GPU instances or Anyscale cluster.
¶ Run:ai: GPU scheduling platform, not model deployment workflow. Does not include model library, deployment lifecycle, or snapshot provisioning. Requires Kubernetes.

### Key Insight: Snapshot-Based Provisioning Has No Market Equivalent

The 2–5 second memory snapshot restore for inference VMs is unique to Weaver v2.0. The closest alternatives:

| Method | Cold Start Time | Weaver Snapshot |
|--------|:-:|:-:|
| Full provision (download weights, load into VRAM) | 3–10 min | **2–5 sec** (memory) |
| Disk snapshot (OS + weights, reload into VRAM) | 10–30 sec | **2–5 sec** (memory) |
| Container restart (weights pre-loaded in image) | 30–90 sec | **2–5 sec** (memory) |

For organizations running inference at scale (even 2 GPUs), the difference between 5 minutes and 5 seconds for model deployment is the difference between scheduled maintenance windows and seamless blue/green updates. **This capability does not exist in any competing product at any price.**

### ROI Crossover: v2.0

Weaver FM pays for itself vs DIY NixOS + MLflow in **approximately 3 days** of Year 1. The $13,126 Y1 savings equals **88× the annual license cost**. Against Anyscale, Weaver FM saves $9,226 in Y1 = **62× the license cost**.

---

## v2.2 — Multi-Host Visibility + Weaver Team Federation + GPU Scheduling

**Capabilities shipped (cumulative):** + RBAC, quota enforcement, bulk operations, audit log, multi-node visibility, manual VM migration, team license federation (Weaver Team), Vault integration, **GPU reservation / queue / preemption, MIG partitioning, multi-GPU topology-aware assignment, snapshot-based auto-scaling, fleet-bridge aggregated inference metrics, per-workload-group GPU utilization, set point auto-scaling triggers**
**Buyer profile:** Mid-size organization with 5–20 hosts and an IT team responsible for multi-host NixOS infrastructure
**Standard Fabrick price activates:** $11,500/yr for 10 nodes (tiered pricing: $2,000 first node + $1,250 nodes 2–4 + $1,000 nodes 5–9 + $750 nodes 10+)
**GPU scheduling add-on value:** At v2.2, Fabrick includes GPU reservation, queue, preemption, MIG partitioning, topology-aware assignment, and snapshot-based auto-scaling. These are capabilities that Run:ai ($50K+/yr), Slurm + custom scripting ($20K+/yr setup + maintenance), or Kubernetes device plugin + custom scheduler ($15K+/yr) provide separately.

### What "feature parity" requires from alternatives (10 nodes, 20 GPUs)

**Proxmox Community** — feature gaps at 10 nodes:
No RBAC granularity beyond basic roles; no audit log without 3rd-party SIEM; no NixOS host model; requires migrating off NixOS. No GPU scheduling at all. Setup cost assumes NixOS → Proxmox migration per host. Multi-host via Proxmox Datacenter Manager.

**DIY NixOS (Colmena + Slurm)** — at 10 nodes with GPU workloads:
Colmena handles deployment; Slurm for GPU scheduling (reservation, queue, preemption). No unified visibility dashboard; no audit log; no RBAC; no centralized Live Provisioning; no inference metrics integration; no snapshot-based auto-scaling. Setup requires Slurm cluster, custom Prometheus federation, per-host alert rules, custom RBAC.

**Rancher/K3s + Run:ai** — at 10 nodes:
Full multi-node management + Run:ai for GPU scheduling. Kubernetes-native workload model only — no MicroVM support. Requires reskilling from sysadmin to Kubernetes operator. Run:ai license ~$5,000/yr/node.

**Run:ai standalone** — GPU scheduling platform:
$50,000+/yr for 10-node cluster. Kubernetes required. Does not provide VM management, model deployment workflow, or snapshot-based provisioning. GPU scheduling only.

### Setup Hours (10 nodes)

| Alternative | Setup Hours | Notes |
|-------------|:-----------:|-------|
| Weaver v2.2 | 8 hrs | Multi-host config + RBAC setup + audit log config |
| DIY NixOS (Colmena + custom tooling) | 300 hrs | Colmena + Prometheus federation + custom RBAC + audit pipeline + per-host VM config |
| Cockpit + Portainer (10 nodes) | 30 hrs | Per-host setup; no centralized RBAC; minimal multi-host value |
| Proxmox Community (10 nodes, migration) | 80 hrs | 10× OS migration + Datacenter Manager setup; loses NixOS |
| Proxmox Standard Subscription (10 nodes) | 80 hrs | Same migration; adds enterprise repo + support access |
| Rancher/K3s (10 nodes) | 60 hrs | K3s install, cluster bootstrap, RBAC config, workload migration; no MicroVMs |

### Monthly Maintenance Hours (10 nodes, v2.2 feature set)

| Alternative | Hrs/mo | Driver |
|-------------|:------:|--------|
| Weaver v2.2 Fabrick | 1.5 | Centralized dashboard; RBAC via UI; bulk ops |
| DIY NixOS (10 nodes) | 20.0 | Per-host config changes; manual migration; custom audit log maintenance |
| Cockpit + Portainer (10 nodes) | 10.0 | 10× per-host maintenance; no centralized ops |
| Proxmox Community (10 nodes) | 8.0 | Datacenter Manager helps; no support; manual HA |
| Proxmox Standard (10 nodes) | 5.0 | Support access reduces incident time; enterprise repo for updates |
| Rancher/K3s (10 nodes) | 6.0 | Kubernetes operations tooling is mature; ongoing Helm/manifest management |

### TCO: Mid Fabrick (10 nodes, 20 GPUs, $100/hr)

| Alternative | License/yr | Setup $ | Maint $/yr | **Y1 TCO** | **Y3 TCO** | Parity? |
|-------------|:----------:|:-------:|:----------:|:----------:|:----------:|:-------:|
| **Fabrick (FM)** | $12,990 | $800 | $1,800 | **$15,590** | **$45,170** | Full |
| **Fabrick (Standard)** | $11,500 | $800 | $1,800 | **$14,100** | **$40,700** | Full |
| Proxmox Community (10 nodes) | $0 | $8,000 | $9,600 | $17,600 | $36,800 | Partial ‡ |
| Proxmox Standard Sub (10 nodes) | $3,300 | $8,000 | $6,000 | $17,300 | $35,900 | Partial ‡ |
| Rancher/K3s Prime (10 nodes) | $6,000 | $6,000 | $7,200 | $19,200 | $45,600 | Partial § |
| DIY NixOS + Slurm (10 nodes, GPU) | $0 | $40,000 | $28,800 | $68,800 | $126,400 | Near-full ¶ |
| **Run:ai (10 nodes, GPU scheduling)** | **$50,000** | **$10,000** | **$6,000** | **$66,000** | **$178,000** | **Partial ††** |
| Rancher + Run:ai (10 nodes) | $56,000 | $16,000 | $13,200 | $85,200 | $197,200 | Partial §§ |

> **Weaver FM Y3:** $12,990 × 3 + $800 + $1,800 × 3 = $38,970 + $800 + $5,400 = **$45,170**
> **Proxmox Standard Y3:** $3,300 × 3 + $8,000 + $6,000 × 3 = $9,900 + $8,000 + $18,000 = **$35,900**
> **DIY NixOS + Slurm Y3:** $0 + $40,000 + $28,800 × 3 = $40,000 + $86,400 = **$126,400**
> **Run:ai Y3:** $50,000 × 3 + $10,000 + $6,000 × 3 = $150,000 + $10,000 + $18,000 = **$178,000**

> **Proxmox setup:** $8,000 = 80 hrs × $100. This assumes a skilled NixOS-to-Proxmox migration engineer. First-time migrations with Proxmox CE frequently exceed 100 hrs across 10 hosts.
> **Rancher license:** SUSE Rancher Prime at $600/yr/node × 10 = $6,000/yr. RKE2 open-source; support contract is the fee.

‡ Proxmox: No MicroVM support; no NixOS-native workload model; NixOS stack abandoned on migration. **No GPU scheduling at any tier.** RBAC available in Subscription tier. Audit log requires Proxmox Backup Server or 3rd-party SIEM integration (additional cost and setup not modeled here).
§ Rancher/K3s: Container-native only; no MicroVM management; requires Kubernetes skillset beyond typical sysadmin. Does not replicate Weaver's Live Provisioning model. No GPU scheduling without Run:ai or similar add-on.
¶ DIY NixOS + Slurm: Near-parity for GPU scheduling but requires Slurm cluster management (additional 100 hrs setup vs base DIY). No unified UI. No snapshot-based auto-scaling. No inference metrics integration. $68,800 in Year 1 vs $15,590 for Weaver FM = **4.4× more expensive**.
†† Run:ai: GPU scheduling platform only — does not include VM management, model deployment workflow, model library, snapshot provisioning, fleet bridge, or unified workload dashboard. Requires Kubernetes. $50,000/yr for 10-node GPU cluster is their standard enterprise pricing.
§§ Rancher + Run:ai: Full stack for container-native GPU workloads. $56,000/yr combined licensing. Still no MicroVM support, no NixOS workload model, no snapshot-based provisioning. **Fabrick at $11,500/yr delivers equivalent GPU scheduling + VM management + model deployment for 20% of this cost.**

### Proxmox Pricing Note

Proxmox Basic subscription = ~€119/yr/socket ≈ $130/yr per server (single socket). At 10 nodes, 1 socket/server = $1,300/yr. Standard subscription = ~€299/yr/socket ≈ $330/yr per server = $3,300/yr for 10 nodes. The above uses Standard because Basic lacks support SLA. Prices converted at 1 EUR ≈ $1.10.

### Key Insight: Where Proxmox Wins

At 10 nodes, Proxmox Standard Subscription is **cost-competitive with Fabrick (Standard)** at Year 3 ($35,900 vs $40,700). The decision is not primarily cost — it is capability:

| Decision Factor | Weaver | Proxmox Standard |
|---|---|---|
| NixOS-native stack | ✓ | ✗ (migration required) |
| MicroVM support | ✓ | ✗ (KVM/LXC only) |
| Live Provisioning | ✓ | ✗ |
| Migration cost (NixOS shops) | $800 setup | $8,000 setup |
| RBAC + audit log | ✓ | ✓ (subscription) |
| Multi-host visibility | ✓ | ✓ (PDM) |

For an **existing NixOS shop**, the migration cost alone ($8,000 for 10 nodes) erases Proxmox's license cost advantage in Year 1. For a **greenfield deployment** choosing between NixOS and Proxmox as the base OS, the comparison shifts — but Weaver only runs on NixOS by design.

---

## v3.0 — Fabrick Fleet Management + Fleet Bridge + Inference Routing

**Capabilities shipped (cumulative):** + HA clustering, live migration, disaster recovery, full fleet control plane, Storage Hub, multi-region visibility, **fleet virtual bridge architecture (VXLAN/WireGuard overlay SDN), workload-group-aligned bridges (1:1 compliance = network boundary), endpoint auto-registration/deregistration, fleet bridge state management (hub DB + per-host DR + cold start policy), fleet inference routing, fleet blue/green deployment (bridge weight shifting), fleet maintenance (node cordon via weight management), fleet GPU scheduling (cross-host placement), fleet model deployment (hub selects host), fleet model cache/snapshot awareness, fleet snapshot distribution (proactive cache warming), cross-host GPU topology map, historical inference metrics**
**Buyer profile:** Large enterprise running NixOS infrastructure at 15–50+ nodes, requiring zero-downtime operations
**Standard Fabrick v3.0 price activates:** $3,500/yr first node (512GB) + tiered additional nodes ($1,250 nodes 2–4, $1,000 nodes 5–9, $750 nodes 10+)

### 20-Node License Cost Breakdown (v3.0)

**Fabrick (Standard) v3.0** — 20 nodes:
Node 1: $3,500 + Nodes 2–4: 3 × $1,250 + Nodes 5–9: 5 × $1,000 + Nodes 10–20: 11 × $750
= $3,500 + $3,750 + $5,000 + $8,250 = **$20,500/yr**

**Fabrick (FM)** (for those who locked in before v2.2):
20 × $1,299 = **$25,980/yr**

### Competitive Landscape at v3.0 Scale

By v3.0, Weaver enters the fleet management market. Direct competitors:

| Alternative | Primary Workload Model | Price Model | Notes |
|-------------|------------------------|-------------|-------|
| Proxmox Standard Subscription | KVM/LXC VMs | ~$330/yr/socket | No NixOS; HA via Ceph (storage-coupled); mature product |
| Rancher Prime (RKE2) | Kubernetes containers | ~$600/yr/node | Container-native; no MicroVM; requires K8s skillset |
| VMware vSphere Essentials | VMware VMs | $800–1,200/yr/node | VMware ecosystem lock-in; acquired by Broadcom; pricing volatile |
| OpenShift (OCP) | Kubernetes + VMs (via KubeVirt) | $3,000–9,200/yr/node | Full enterprise K8s PaaS; 3–4× cost; OCP skillset required |
| Nutanix AOS (commercial) | Hyperconverged | ~$1,500–2,000/yr/node | Hyperconverged storage model; certified hardware dependency |

### Setup Hours (20 nodes)

| Alternative | Setup Hours | Notes |
|-------------|:-----------:|-------|
| Weaver v3.0 | 14 hrs | Fleet config + HA cluster bootstrap + storage setup |
| DIY NixOS (Colmena + custom HA) | 700 hrs | Colmena, custom HA, DRBD or Ceph, custom API, all manual |
| Proxmox Standard (20 nodes) | 140 hrs | 20× OS migration + HA setup + Ceph configuration |
| Rancher Prime (20 nodes) | 100 hrs | K3s/RKE2 cluster, HA control plane, Longhorn storage, RBAC |
| OpenShift (20 nodes) | 150 hrs | OCP install, node provisioning, storage operator, full platform setup |
| Nutanix AOS | 100 hrs | Hyperconverged rack/config; hardware validation |

### Monthly Maintenance Hours (20 nodes)

| Alternative | Hrs/mo | Driver |
|-------------|:------:|--------|
| Weaver v3.0 | 2.5 | Fleet dashboard; automated HA failover; centralized bulk ops |
| DIY NixOS (20 nodes) | 35.0 | Manual HA; per-node config; custom tooling maintenance |
| Proxmox Standard (20 nodes) | 8.0 | Mature tooling; Ceph management adds overhead |
| Rancher Prime (20 nodes) | 10.0 | Kubernetes operations; helm/manifest management; etcd backups |
| OpenShift (20 nodes) | 12.0 | Full K8s platform; operator management; cert-manager; registry |
| Nutanix AOS | 5.0 | Hyperconverged management is mature; storage is integrated |

### TCO: Large Fabrick (20 nodes, $120/hr)

| Alternative | License/yr | Setup $ | Maint $/yr | **Y1 TCO** | **Y3 TCO** | Parity? |
|-------------|:----------:|:-------:|:----------:|:----------:|:----------:|:-------:|
| **Fabrick (FM)** | $25,980 | $1,680 | $3,600 | **$31,260** | **$90,420** | Full |
| **Weaver Standard v3.0** | $20,500 | $1,680 | $3,600 | **$25,780** | **$73,980** | Full |
| Proxmox Standard (20 nodes) | $6,600 | $16,800 | $11,520 | $34,920 | $71,160 | Partial ‡ |
| Proxmox + NSX-equivalent SDN (20 nodes) | $46,600 | $28,800 | $23,520 | $98,920 | $209,160 | Partial ‡‡ |
| Rancher Prime (20 nodes) | $12,000 | $12,000 | $14,400 | $38,400 | $91,200 | Partial § |
| Rancher + Run:ai + Calico (20 nodes) | $74,000 | $24,000 | $21,600 | $119,600 | $307,200 | Partial §§ |
| OpenShift (low end, 20 nodes) | $60,000 | $18,000 | $17,280 | $95,280 | $261,840 | Different ¶ |
| Nutanix AOS (20 nodes) | $30,000 | $12,000 | $7,200 | $49,200 | $123,600 | Different ¶ |
| DIY NixOS (20 nodes) | $0 | $84,000 | $50,400 | $134,400 | $235,200 | Near-full ** |

> **Weaver FM Y3:** $25,980 × 3 + $1,680 + $3,600 × 3 = $77,940 + $1,680 + $10,800 = **$90,420**
> **Proxmox Standard Y3:** $6,600 × 3 + $16,800 + $11,520 × 3 = $19,800 + $16,800 + $34,560 = **$71,160**
> **DIY NixOS Y3:** $0 + $84,000 + $50,400 × 3 = $84,000 + $151,200 = **$235,200**

> **Proxmox setup:** $16,800 = 140 hrs × $120. Heavy because NixOS → Proxmox migration at 20 nodes involves OS reinstall, workload migration, Ceph cluster bootstrap, and HA validation. NixOS shops that choose Proxmox at this scale pay the migration cost once but lose their NixOS investment permanently.
> **Rancher setup:** $12,000 = 100 hrs × $120. Assumes existing infrastructure team gaining Kubernetes competency (low end). Organizations without K8s expertise face additional training + tooling ramp.
> **OpenShift license:** $3,000/yr/node (low tier) × 20 = $60,000/yr. Full fabrick tier ($9,200/node) = $184,000/yr, Y1 over $225,000.
> **Nutanix:** Requires Nutanix-certified hardware at scale. List price estimate only; actual contracts are negotiated. Community Edition is limited to 3 nodes.
> **DIY NixOS setup:** $84,000 = 700 hrs × $120. Includes custom HA (DRBD + keepalived or custom Firecracker clustering), Colmena multi-host deployment, custom API, custom audit log, custom monitoring federation.

‡ Proxmox: Year 3 TCO is below Weaver FM ($71,160 vs $90,420) — the difference is capability. Proxmox does not support NixOS hosts, MicroVMs, Live Provisioning, **fleet bridge (SDN), GPU scheduling, inference routing, or snapshot-based provisioning**. For NixOS shops, the migration cost ($16,800) dominates Year 1 and represents a one-way door out of the NixOS workload model.
‡‡ Proxmox + NSX-equivalent: To match Fabrick's fleet bridge capability, Proxmox would need VMware NSX or equivalent SDN overlay ($2,000/yr/node × 20 = $40,000/yr). Setup doubles (SDN config + Proxmox migration). This is the true cost-equivalent comparison for organizations that need overlay networking. **Fabrick at $20,500/yr delivers fleet bridge + HA + GPU scheduling + model deployment for 32% of Proxmox + SDN cost.**
§ Rancher: Container-native fleet management. Strong product but different category — Rancher manages Kubernetes workloads; Weaver manages the full NixOS isolation spectrum. Not a like-for-like replacement.
§§ Rancher + Run:ai + Calico: Full stack for container-native GPU fleet with network policy. $74,000/yr combined licensing ($12K Rancher + $50K Run:ai + $12K Calico fabrick). Still no MicroVM support, no NixOS workload model, no snapshot-based provisioning, no integrated model deployment. **Fabrick at $20,500/yr delivers equivalent capability for 28% of this cost — and includes features (fleet bridge, model library, snapshot restore) that this stack cannot replicate at any price.**
¶ OpenShift / Nutanix: Different product categories. OpenShift is an enterprise Kubernetes PaaS; Nutanix is hyperconverged infrastructure. Neither manages NixOS hosts natively. Included for context at this budget level.
** DIY at 20 nodes requires a dedicated platform engineering team member (700 hrs of setup = 4+ months of one engineer's time), not a sysadmin as a side project.

### Where Proxmox Wins at v3.0

Proxmox Standard at Year 3 ($71,160) is below Weaver FM ($90,420). In a pure-cost comparison at 20 nodes over 3 years, Proxmox is cheaper — but the decision is capability, not cost.

**The real question is not cost — it is the value of staying on NixOS:**

1. **NixOS reproducibility** — every VM, container, and GPU workload is declared in code. Proxmox does not preserve this.
2. **Migration cost is a one-way door** — $16,800 to migrate, then $0 to go back is not available. The NixOS investment is abandoned.
3. **v3.0 Weaver-specific capabilities** — HA clustering designed for MicroVM workloads, live migration that preserves NixOS VM state, Storage Hub integrated with NixOS storage declarations. Proxmox HA is KVM/Ceph — a completely different model.

For organizations already on NixOS, the cost comparison is Weaver vs abandoning NixOS. The $16,800 migration cost plus the capability regression make Proxmox non-competitive for this buyer.

---

## Operational Model Value: What the Hour Tables Don't Capture

The version milestone TCO tables measure *labor to operate the toolchain*. They do not measure the value of **how the NixOS operational model works** — which is the primary reason NixOS organizations choose this stack in the first place. These dimensions are real costs that alternatives incur and Weaver eliminates or reduces.

Alternatives assessed here are DIY NixOS (the nearest-parity path), Proxmox Standard (the cost-competitive alternative at scale), and Rancher Prime (the enterprise fleet alternative).

---

### 1. Adoption Friction — "Just install it"

Weaver installs as a NixOS module on an existing host. Running workloads are not touched. No migration, no OS change, no data movement, no downtime window required.

| Alternative | Adoption model | One-time adoption cost |
|---|---|---|
| **Weaver** | NixOS module: add to config, rebuild once | **~$150–$800** (2–8 hrs setup) |
| DIY NixOS (build the same thing) | Build custom API + UI + automation | $4,500–$84,000 |
| Proxmox | Replace NixOS with Proxmox: OS reinstall per host | $1,500–$16,800 |
| Rancher/K3s | Transform all workloads to Kubernetes pods | $6,000–$12,000+ training/porting |
| OpenShift | Full platform migration | $18,000+ setup |

**The Proxmox adoption cost is a one-way door.** Once you migrate 10 hosts to Proxmox, the path back to NixOS is another $8,000–$16,800. That adoption cost is therefore also the **exit cost** — it must be paid twice (to leave NixOS, and again if you ever want NixOS back). Weaver's exit cost is license cancellation only; the NixOS substrate continues to function.

**Rancher adoption requires workload transformation.** Existing MicroVM and Apptainer workloads have no Kubernetes equivalent. Adoption means rewriting, not migrating.

---

### 2. Configuration Drift Elimination — "Build once, update never"

In traditional toolchains (Proxmox, DIY scripts, Cockpit), servers accumulate configuration drift: manually installed packages, edited config files with no changelog, security patches applied inconsistently, "works on this host" states that cannot be reproduced. Drift is invisible until it causes an incident, and remediation requires audit + manual cleanup per host.

**NixOS by design has zero configuration drift.** The running state IS the declared config. A host that diverges from its config is immediately identifiable and correctable with one command. Weaver extends this model to workloads — every VM and container is declared, not hand-configured.

**Annual cost of drift remediation (alternative toolchains):**

A reasonable estimate for a production server under manual management: 4–8 hrs/yr/host to audit configurations, remediate accumulated drift, and document current state for compliance.

| Profile | Hosts | Hours/host/yr | Labor rate | **Annual drift cost eliminated** |
|---|---|---|---|---|
| Solo Sysadmin | 1 | 6 hrs | $75/hr | **$450/yr** |
| Mid Enterprise | 10 | 6 hrs | $100/hr | **$6,000/yr** |
| Large Enterprise | 20 | 6 hrs | $120/hr | **$14,400/yr** |

Over 3 years: $1,350 / $18,000 / $43,200 in eliminated drift remediation cost.

This cost does not exist in Weaver. It is fully eliminated, not reduced.

---

### 3. Provisioning Velocity — "Clone, test, provision"

**Live Provisioning** is the defining Weaver capability. A new MicroVM or container is created via API call or UI action in under 5 minutes, with no `nixos-rebuild switch` required on the host. The workload declaration is a NixOS config snippet — it can be cloned from any existing workload, modified, and applied.

Alternatives by provisioning time:

| Alternative | New workload time | Test before prod? | Identical reproduction? |
|---|---|---|---|
| **Weaver** | **< 5 min** | ✓ Spin up test MicroVM from same config | ✓ Config is the definition |
| DIY NixOS | 20–40 min (edit flake + rebuild + test) | Partial (manual) | ✓ (if config is in VCS) |
| Proxmox | 10–20 min (template clone + configure) | Partial (snapshot) | Partial (manual config drift) |
| Rancher/K3s | 15–30 min (write YAML + apply + debug) | ✓ (namespace isolation) | ✓ (if Helm chart) |
| Cockpit + Portainer | 15–25 min (multiple tools) | ✗ | Partial |

**Time saved per provisioning event (vs DIY):** ~25 min
**Time saved per provisioning event (vs Proxmox):** ~12 min

**Annual provisioning velocity savings (assumed workloads provisioned/month):**

| Profile | Workloads/mo | vs DIY (25 min) | vs Proxmox (12 min) |
|---|---|---|---|
| Solo Sysadmin | 5 | 25 hrs/yr × $75 = **$1,875/yr** | 12 hrs/yr × $75 = **$900/yr** |
| Mid Enterprise | 20 | 100 hrs/yr × $100 = **$10,000/yr** | 48 hrs/yr × $100 = **$4,800/yr** |
| Large Enterprise | 50 | 250 hrs/yr × $120 = **$30,000/yr** | 120 hrs/yr × $120 = **$14,400/yr** |

**Test-before-prod value (production incidents avoided):**

Weaver's ability to spin up a MicroVM from the same config as a production workload allows testing configuration changes before applying them to production. Estimated production incidents prevented per year by catching errors in test: 3 (solo) to 6 (enterprise). Each prevented incident saves diagnostic + fix labor plus avoided downtime.

| Profile | Incidents prevented/yr | Labor saved/incident | **Annual incident prevention value** |
|---|---|---|---|
| Solo Sysadmin | 3 | 3 hrs × $75 = $225 | **$675/yr** |
| Mid Enterprise | 4 | 3 hrs × $100 = $300 | **$1,200/yr** |
| Large Enterprise | 6 | 3 hrs × $120 = $360 | **$2,160/yr** |

Downtime cost per prevented incident is additional and organization-specific ($500–$5,000/hr depending on what's running).

---

### 4. Atomic Switchover — "Parallel implementation"

NixOS boot generations allow running an old configuration and a new one simultaneously. Switching between them is atomic — it either fully applies or it doesn't; there is no partial state. Combined with Weaver's Live Provisioning, this enables:

- **Blue/green infrastructure updates:** new workload config running alongside old, switch on validation
- **Zero-downtime configuration changes:** no maintenance window required for most config updates
- **Instant rollback:** `nixos-rebuild switch --rollback` restores the prior generation in minutes, not hours

**Rollback comparison:**

| Alternative | Rollback mechanism | Time to rollback | Risk of data loss |
|---|---|---|---|
| **Weaver / NixOS** | Generation switch — atomic, instant | **3–5 min** | None (stateless config, data unaffected) |
| DIY NixOS | Same — generation switch | 3–5 min | None |
| Proxmox | Snapshot revert — if snapshot exists | 15–45 min | Depends on snapshot age |
| Rancher/K3s | Helm rollback — chart revision | 5–15 min | Pod-level; stateful workloads need separate handling |
| Cockpit + scripts | Manual re-apply of prior config | 30–120 min | High (depends on documentation) |

**Annual value of faster rollback (2 rollback events/yr assumed):**

| Profile | Time saved/event | Events/yr | Labor rate | Downtime avoided | **Annual rollback value** |
|---|---|---|---|---|---|
| Solo Sysadmin | 30 min | 2 | $75/hr | 30 min at $200/hr service cost | **$275/yr** |
| Mid Enterprise | 45 min | 3 | $100/hr | 45 min at $1,000/hr | **$2,475/yr** |
| Large Enterprise | 60 min | 4 | $120/hr | 60 min at $2,000/hr | **$8,480/yr** |

Downtime costs are conservative (production API: $1,000/hr; e-commerce: $5,000–$50,000/hr; financial services: higher still).

**Maintenance window elimination:**

Organizations without NixOS must schedule maintenance windows for configuration changes that could break production. NixOS atomic switchover eliminates most maintenance windows. For a team scheduling 2 maintenance windows/month at 2 hrs each:

- Team labor for 2-hr window × 2/mo × 12 = 48 hrs/yr (coordinating, monitoring, communicating)
- At 3-person team × $100/hr: $14,400/yr in eliminated maintenance window coordination
- Plus: no customer-facing downtime communication, no weekend/off-hours scheduling

---

### 5. Workload Portability — "Migration ease"

A NixOS workload declaration is a config file in version control. Migrating that workload to a different host means: copy the config declaration, apply to the new host, verify. There is no proprietary format, no tool-specific export, no manual reconfiguration.

| Alternative | Workload migration mechanism | Time per workload |
|---|---|---|
| **Weaver** | Copy config → Live Provision on target host | **10–20 min** |
| DIY NixOS | Copy config → nixos-rebuild on target | 20–40 min |
| Proxmox | VM export/import (`.vmdk` or via Proxmox migration) | 30–120 min + storage transfer |
| Rancher/K3s | `kubectl drain` + pod reschedule | 5–15 min (containers only; no MicroVMs) |
| Cockpit + scripts | Manual reconfigure on target | 60–240 min |

At v2.2, Weaver adds manual VM migration UI. At v3.0, live migration is automated. The gap between Weaver and Proxmox's migration story is not feature parity — it is **that Proxmox migration preserves a KVM VM, while Weaver migration preserves a NixOS declaration**. The Weaver-migrated workload is reproducible; the Proxmox-migrated VM accumulates drift from wherever it was before.

**Annual migration labor (assumed workloads migrated per year):**

| Profile | Migrations/yr | Weaver (15 min) | Proxmox (75 min) | DIY (120 min) | **Annual savings vs Proxmox** |
|---|---|---|---|---|---|
| Solo Sysadmin | 4 | 1 hr | 5 hrs | 8 hrs | **$300/yr** |
| Mid Enterprise | 24 | 6 hrs | 30 hrs | 48 hrs | **$2,400/yr** |
| Large Enterprise | 60 | 15 hrs | 75 hrs | 120 hrs | **$7,200/yr** |

---

### 6. Incident Response Velocity — AI Diagnostics + Unified View

Every alternative requires the engineer to SSH into the affected host, correlate logs across multiple tools, and manually diagnose root cause. Weaver provides:

- AI Diagnostics (v1.0): natural language query → root cause suggestion → resource correlation
- Single pane: all workloads, all resource metrics, all logs in one authenticated session
- Live Provisioning: remediation action (restart, reprovision, migrate) in the same UI

**MTTR comparison (Mean Time To Diagnose per incident):**

| Alternative | Time to diagnose | Tools consulted |
|---|---|---|
| **Weaver** | **2–5 min** | AI Diagnostic + dashboard (1 tool) |
| DIY NixOS | 15–45 min | SSH + journalctl + custom scripts (3–6 steps) |
| Proxmox | 10–20 min | Proxmox web UI + per-VM console (2–3 steps) |
| Rancher | 10–25 min | `kubectl describe` + logs + Grafana (3–4 steps) |
| Cockpit + Portainer | 15–30 min | Two tools + SSH for VMs (3–5 steps) |

**Assumed incidents per month and annual MTTR savings (20 min saved per incident vs DIY):**

| Profile | Incidents/mo | Saved/incident | Labor rate | **Annual MTTR savings** |
|---|---|---|---|---|
| Solo Sysadmin | 2 | 20 min | $75/hr | **$600/yr** |
| Mid Enterprise | 5 | 20 min | $100/hr | **$2,000/yr** |
| Large Enterprise | 10 | 20 min | $120/hr | **$4,800/yr** |

This is conservative — it counts only diagnosis time saved, not resolution time or escalation cost. On-call incidents outside business hours multiply this by 1.5–2× due to cognitive load and context-switching cost.

---

### 7. Audit and Compliance Readiness

For regulated industries (HIPAA, SOC 2, CMMC, PCI-DSS), compliance requires demonstrable proof of:
- What software is running on each host (software inventory)
- What changed and when (change history)
- Who made changes (access audit trail)
- That the running state matches the declared state (configuration compliance)

**NixOS + Weaver satisfies all four by construction:**
- Software inventory = nix store contents per host (deterministic, reproducible)
- Change history = git log of the config repository
- Access audit trail = Weaver audit log (v2.2) + git commit attribution
- Configuration compliance = NixOS running state IS the declared state; drift is impossible

**Alternatives require tooling to achieve this:**

| Requirement | Alternatives | Tooling needed | Setup + annual labor |
|---|---|---|---|
| Software inventory | Proxmox, DIY | Nessus, Qualys, or manual `dpkg -l`/`rpm -qa` per host | 20 hrs setup + 8 hrs/yr |
| Change history | Proxmox | Manual change tickets, Proxmox task log (limited) | 4 hrs/mo ongoing |
| Access audit trail | DIY, Cockpit | syslog + auditd + SIEM integration | 40 hrs setup + 2 hrs/mo |
| Configuration compliance | All alternatives | OpenSCAP, manual baselines, periodic scans | 40 hrs/yr per audit cycle |

**Annual audit readiness savings (1 audit cycle/yr; 2/yr for regulated large enterprises):**

| Profile | Audit prep hrs saved | Labor rate | **Annual audit savings** |
|---|---|---|---|
| Solo Sysadmin | 24 hrs/yr | $75/hr | **$1,800/yr** |
| Mid Enterprise | 40 hrs/yr | $100/hr | **$4,000/yr** |
| Large Fabrick (2 audits) | 80 hrs/yr | $120/hr | **$9,600/yr** |

For organizations in defense contracting (CMMC) or healthcare (HIPAA), audit prep that normally requires consultant engagement at $175/hr — $150–$350/hr for compliance specialists — further amplifies this value.

---

### 8. Knowledge Continuity — Bus Factor and Onboarding

**The bus factor problem:** In a DIY or multi-tool environment, infrastructure knowledge accumulates in the heads of the engineers who built it. When an engineer leaves, is unavailable, or the team grows, the knowledge gap is a real cost.

**NixOS + Weaver: the config IS the documentation.** Every running workload is fully described in version-controlled declarations. A new engineer can understand the entire infrastructure by reading the config. There are no undocumented manual steps, no "I know this server has a weird thing with the network config" tribal knowledge.

**Alternatives:** A Proxmox installation of 10 nodes has 10 sets of VM configurations, BIOS settings, network assignments, and storage layouts — none of which are captured in a single version-controlled file. A DIY NixOS setup without disciplined VCS hygiene is similar. Rancher with Helm charts is better (charts are declarative) but doesn't cover the host layer.

**Onboarding cost differential:**

| Profile | Weaver onboarding | DIY/Proxmox onboarding | Savings per event |
|---|---|---|---|
| Solo Sysadmin | 4 hrs (read config, run Live Provisioning once) | 24 hrs (documentation tour, shadow session, runbook review) | 20 hrs × $75 = $1,500 |
| Mid Enterprise | 8 hrs | 40 hrs | 32 hrs × $100 = $3,200 |
| Large Enterprise | 12 hrs | 60 hrs | 48 hrs × $120 = $5,760 |

**Annual onboarding savings (assumed annual events):**

| Profile | Events/yr | Savings/event | **Annual savings** |
|---|---|---|---|
| Solo Sysadmin | 0.5 (new contractor once every 2 yrs) | $1,500 | **$750/yr** |
| Mid Enterprise | 1 (one new hire or rotation/yr) | $3,200 | **$3,200/yr** |
| Large Enterprise | 2 (team growth + rotation) | $5,760 | **$11,520/yr** |

---

### 9. Skill Weaver and Toolchain Sprawl

**Skill premium for alternatives:**

- **Rancher/K3s** requires Kubernetes expertise. The sysadmin managing NixOS workloads is not, by default, a Kubernetes operator. A Kubernetes engineer commands $130–150/hr vs $75–100/hr for a generalist sysadmin. An organization choosing Rancher either pays a skill premium or invests in reskilling (80–120 hrs of training at $100/hr = $8,000–$12,000 one-time).

- **OpenShift** requires OCP-specific skills, Red Hat certification costs ($400–800/person), and a dedicated platform operations function. Viable at 100+ nodes; expensive at 20.

- **Nutanix** requires Nutanix-certified engineers and Nutanix-specific hardware. Market premium: $20–30/hr above generalist rates.

- **Weaver on NixOS** requires NixOS knowledge — which the buyer already has by definition (Weaver is for NixOS shops). No skill premium. No reskilling cost.

**Toolchain sprawl cost:**

Every additional tool in a stack has an update cycle, a security surface, an authentication model, and a potential incompatibility. A Cockpit + Portainer + monitoring + alerting + custom scripts stack has 4–6 tools to update, monitor, and maintain. Integration between them is either custom code or manual.

| Stack | Tools requiring regular updates | Integration maintenance | API surfaces |
|---|---|---|---|
| **Weaver** | 1 | None — unified | 1 |
| Cockpit + Portainer + monitoring | 4–6 | Custom scripts or manual | 3–6 |
| Rancher + Prometheus + cert-manager + Vault | 5–8 | Helm dependencies, operator upgrades | 5–8 |

**Annual toolchain sprawl maintenance estimate:**

| Profile | Extra tools in alternative stack | Hours/mo maintaining integrations | **Annual sprawl cost eliminated** |
|---|---|---|---|
| Solo Sysadmin | 4 (Cockpit + Portainer + scripts) | 1.5 hrs/mo | 18 hrs × $75 = **$1,350/yr** |
| Mid Enterprise | 6 (+ monitoring + RBAC + audit) | 3 hrs/mo | 36 hrs × $100 = **$3,600/yr** |
| Large Enterprise | 8 (+ SIEM + identity + cert-mgmt) | 5 hrs/mo | 60 hrs × $120 = **$7,200/yr** |

---

### 10. MicroVM Density and Hardware Deferral

MicroVMs (Firecracker) have substantially lower per-instance overhead than full KVM virtual machines:

| Workload type | Minimum RAM | Boot time | Storage footprint |
|---|---|---|---|
| MicroVM (Firecracker) | 128–256 MB | < 1 second | Shared NixOS store |
| KVM full VM (Proxmox) | 512 MB–2 GB | 5–30 seconds | Full disk image per VM |
| LXC container (Proxmox) | 64–128 MB | < 1 second | Rootfs per container |
| Docker container | 16–64 MB | < 1 second | Layer cache shared |

A 32GB host running Weaver can manage a mix of:
- 20–30 MicroVMs at 512MB each (hardware-isolated, production workloads)
- 50–100 Docker/Podman containers at 128MB each
- All from a single Live Provisioning API with unified resource visibility

A 32GB Proxmox host running 512MB KVM VMs maxes at ~60 VMs (minus hypervisor overhead). Firecracker MicroVMs at 256MB average pack ~120 workloads on the same hardware with **better isolation** than Proxmox LXC containers.

**Hardware deferral value (delaying a $5,000–$8,000 server purchase by packing more workloads per host):**

- If MicroVM density defers one $6,000 server purchase by 12 months:
  - Capital cost deferred: $6,000 one-time (or $500/mo in lease terms)
  - TCO reduction over 3 years: $6,000 capital + $720/yr maintenance = $8,160/3yr
- This applies once per host approaching capacity; most relevant for growing organizations scaling from 1 to 5 nodes.

---

### 11. Remote and Fleet Workload Management

The dimensions above treat each host in isolation. They do not capture the value of the fleet plane that connects hosts — which is the defining capability of Weaver v2.2 (multi-host visibility, manual migration, bulk ops) and Fabrick v3.0 (live migration, HA failover, edge management). Every alternative requires per-host management; Weaver and Fabrick provide fleet-level operations from a single pane.

**What "per-host management" costs in alternatives:**

For a 10-node deployment without a unified fleet plane, a routine fleet-wide check — "are all nodes healthy, anything unusual?" — requires:
- SSH to each host individually (5 min setup per host = 50 min for 10 hosts)
- Run status commands per host, collate results mentally
- Correlate findings across separate terminal windows

With Weaver v2.2 multi-host visibility: 5 minutes total, all hosts visible simultaneously.

For a 20-node deployment across multiple physical locations, per-host management additionally requires:
- VPN or jump-host access per location
- Separate credential sets per location
- Separate SSH sessions per host
- Physical site visits for hardware-layer issues that can't be resolved remotely

Weaver and Fabrick replace this with a single authenticated session, unified workload view, and API-driven operations across the entire fleet.

---

**A. Multi-Host Unified Visibility (v2.2+, applies to Fabrick and Weaver Team)**

| Task | Without Weaver fleet plane | With Weaver |
|---|---|---|
| Fleet-wide health check (all nodes) | 5 min/node × N nodes | 2–5 min total |
| Identify which node a workload is on | SSH hunt across nodes | Search in dashboard |
| Compare resource usage across nodes | Manual collation from N SSH sessions | Side-by-side in fleet view |
| Confirm fleet-wide policy applied | Per-host verification | Single view |

**Frequency:** 2 fleet-wide operational checks per week (routine status + one incident-driven).

| Profile | Nodes | Time saved/check | Checks/yr | Labor rate | **Annual value** |
|---|---|---|---|---|---|
| Mid Enterprise | 10 | 40 min | 104 | $100/hr | **$6,933/yr** |
| Large Enterprise | 20 | 90 min | 104 | $120/hr | **$18,720/yr** |

*Weaver Team (3 hosts, $75/hr):* 3 hosts × 20 min saved × 104 checks = 104 hrs/yr × $75 = $7,800/yr in unified visibility value — partially captured in maintenance hours but not explicitly modeled.

---

**B. Fleet Bulk Operations (v2.2+ Fabrick)**

Operations that must touch all nodes — security patches, policy updates, configuration changes, certificate rotation — require per-host execution in alternatives. Weaver bulk operations execute across all nodes in one action.

| Operation | Without Weaver (per host) | With Weaver bulk ops | Nodes | Time saved |
|---|---|---|---|---|
| Apply NixOS security update | 12 min/node: SSH + trigger rebuild + verify | 15 min total (parallel) | 10 | 105 min/event |
| Apply security update | 12 min/node | 20 min total | 20 | 220 min/event |
| Push config policy change | 8 min/node | 10 min | 10 | 70 min/event |
| Push config policy change | 8 min/node | 12 min | 20 | 148 min/event |
| Certificate rotation | 10 min/node | 8 min | 10 | 92 min/event |

**Assumed frequency:** 3 bulk operations per month (security patches, policy updates, cert rotation combined).

| Profile | Nodes | Avg time saved/event | Events/yr | Labor rate | **Annual value** |
|---|---|---|---|---|---|
| Mid Enterprise | 10 | 90 min | 36 | $100/hr | **$5,400/yr** |
| Large Enterprise | 20 | 190 min | 36 | $120/hr | **$13,680/yr** |

---

**C. Remote Site Visits Eliminated (v2.2+, multi-location deployments)**

Organizations with servers at multiple physical locations (data center + branch office, or multi-site deployments) traditionally require on-site visits for maintenance tasks that cannot be performed remotely — or managed service provider (MSP) contracts for each location.

Weaver's unified remote management eliminates the "I need to physically be there" class of maintenance tasks for NixOS workload management. Hardware issues still require physical access; workload and config management do not.

**Assumption:** 10-node deployment across 3 physical locations; 20-node across 6 locations.

| Profile | Locations | Visits/location/yr (alternatives) | Visits eliminated | Cost/visit † | **Annual value** |
|---|---|---|---|---|---|
| Mid Enterprise | 3 | 2 | 1.5 avg | $600 | **$2,700/yr** |
| Large Enterprise | 6 | 2 | 1.5 avg | $800 | **$7,200/yr** |

† Visit cost = travel ($200) + 4 hrs labor at rate. Organizations with servers at co-lo or branch offices that lack on-site IT see 2–3× this cost via MSP remote hands fees.

*Note: This dimension applies primarily to organizations with physical multi-site deployments. Pure single-datacenter deployments see this as $0.*

---

**D. Cross-Host Migration Access Overhead (v2.2+)**

Section §5 (Workload Portability) captures the migration execution time saved. It does not capture the access setup overhead for multi-host migrations in alternative toolchains: establishing VPN, verifying SSH keys on both source and target, testing connectivity, setting up transfer channels. This is work that must be done *before* the migration begins and is separate from the migration itself.

**Per-migration access overhead (alternatives):** ~30 min (verify access to both source + target, set up transfer path, confirm credentials on both ends)
**Weaver:** Access already established via unified session. $0 overhead.

| Profile | Migrations/yr | Overhead saved/migration | Labor rate | **Annual value** |
|---|---|---|---|---|
| Mid Enterprise | 24 | 30 min | $100/hr | **$1,200/yr** |
| Large Enterprise | 60 | 30 min | $120/hr | **$3,600/yr** |

---

**E. Fabrick Replacing Fleet Automation Tooling (v3.0)**

At 10+ nodes, organizations running Linux infrastructure typically adopt fleet automation: Ansible/AWX, SaltStack, or similar. For NixOS deployments, AWX/Ansible requires custom NixOS playbooks — these are not bundled with Ansible and must be written and maintained.

Fabrick's fleet control plane is NixOS-native fleet automation — it understands NixOS workload declarations, can execute fleet-wide operations via the same API as single-host Live Provisioning, and does not require playbook maintenance.

**AWX/Ansible for NixOS fleet (alternative to Fabrick at v3.0):**

| Cost component | 10-node | 20-node |
|---|---|---|
| Setup: AWX deploy + NixOS playbook authoring | 40 hrs | 60 hrs |
| Monthly maintenance: playbook updates + AWX upgrades | 4 hrs/mo | 8 hrs/mo |
| Annual labor (maintenance only) | 48 hrs × $100 = $4,800 | 96 hrs × $120 = $11,520 |
| **Annual value of Fabrick vs AWX** | **$4,800/yr** | **$11,520/yr** |

Note: Ansible Automation Platform (Red Hat commercial) is $20,000–$60,000/yr for enterprise support contracts. Self-hosted AWX eliminates licensing but not maintenance labor. The above uses AWX (free, self-hosted) to avoid overstating the comparison.

---

**F. HA Failover: Automatic Workload Recovery (v3.0 Fabrick)**

Weaver v3.0 Fabrick HA automatically detects host failure and restarts affected workloads on surviving nodes within 1–2 minutes. Without HA:

| Phase | Without Fabrick HA | With Fabrick HA |
|---|---|---|
| Detect host failure | 5–15 min (alert fires if monitoring configured) | Automatic |
| Diagnose scope of failure | 15–30 min (SSH attempts + log review) | Weaver shows immediately |
| Manually restart workloads on surviving nodes | 30–60 min per workload batch | Automatic, 1–2 min |
| Total MTTR per host failure event | **60–120 min** | **< 5 min** |

**Assumed frequency:** 0.5 host failure events/node/3 years (one failure per node every 6 years) — conservative for hardware-based NixOS deployments.

At 20 nodes: 20 × 0.5/3 = 3.3 events/yr on average.

| Cost per event | Without HA | With HA |
|---|---|---|
| Recovery labor (2 hrs × $120) | $240 | $0 |
| Downtime cost (60 min at $500/hr conservative) | $500 | $0 (< 5 min = negligible) |
| **Cost per event** | **$740** | **~$0** |

**Annual value (20-node fleet, 3.3 events/yr):** 3.3 × $740 = **$2,442/yr**

*Downtime cost is conservative at $500/hr. For production web services: $1,000–$5,000/hr. For financial services or healthcare: $10,000–$100,000/hr. Organizations where uptime has high business value should apply their actual downtime cost per hour.*

---

**G. Edge Site Management (v3.0 Fabrick, edge deployments)**

Organizations running NixOS workloads at edge locations (retail, branch offices, remote facilities, industrial sites) without dedicated local IT typically rely on:
- MSP (Managed Service Provider) contracts for remote site management: $500–$1,500/site/month
- Or: periodic on-site engineer visits + remote support costs

Fabrick's remote workload management replaces the workload management component of MSP contracts. Hardware support still requires local presence; software/workload operations do not.

**Conservative MSP reduction for NixOS edge (workload management only):**
- Current: $800/site/month MSP (includes workload management)
- With Fabrick: $300/site/month MSP (hardware-only; Fabrick handles workload ops remotely)
- Savings: $500/site/month

| Profile | Edge sites | Savings/site/mo | **Annual value** |
|---|---|---|---|
| Large Fabrick (5 edge sites) | 5 | $500 | **$30,000/yr** |

*This dimension applies only to organizations with edge/branch deployments. It is not applicable to pure datacenter configurations. For organizations that have it, it is typically the largest single TCO line item.*

---

### 12. Auto-Provisioning Management and AI-Delegated Remediation

Sections §3 (Provisioning Velocity) and §6 (Incident Response / AI Diagnostics) assume a human is in the loop — a person triggers the provisioning action, or a person reads the AI diagnosis and then takes the remediation step. Two compounding capabilities eliminate the human from those loops entirely:

**Auto-provisioning management** — Weaver's Live Provisioning API is callable programmatically. Event-driven provisioning (workload health events, CI/CD pipeline triggers, schedule-based dev/test environment management, capacity threshold rules) can create, modify, or terminate workloads without human initiation. Alternatives require custom scripts, cron jobs, or Ansible playbooks — all of which require ongoing maintenance and break on NixOS updates.

**AI-delegated remediation** — For known failure patterns (OOM kill, crash loop, dead workload, resource starvation), Weaver's AI Diagnostics can not only identify the root cause but execute the remediation action: reprovision with adjusted resource limits, restart from declaration, or migrate to an alternative host. The human receives a notification, not a page requiring intervention. §6 captures the diagnosis time savings; §12 captures the execution time savings on these autonomous-remediable incidents.

---

**A. Automated Provisioning Events (routine events requiring no human initiation)**

Alternatives require: custom NixOS scripts or Ansible playbooks triggered by cron or monitoring hooks, with maintenance labor when NixOS or the monitoring stack updates.

| Cost component | 10-node (Mid Fabrick) | 20-node (Large Fabrick) |
|---|---|---|
| Script/playbook maintenance (hrs/mo × rate) | 2 hrs × $100 = $200/mo | 4 hrs × $120 = $480/mo |
| Human verification per auto-event (15 min) | 6 events/mo × 15 min × $100 = $150/mo | 15 events/mo × 15 min × $120 = $450/mo |
| **Annual auto-provisioning management value** | **$4,200/yr** | **$11,160/yr** |

*Solo sysadmin (1 node):* Script maintenance ~0.5 hrs/mo × $75 + 2 events/mo × 15 min × $75 = $37.50 + $37.50 = ~$75/mo → **$900/yr**

---

**B. AI-Delegated Incident Remediation (additive to §6 diagnosis savings)**

§6 models time saved during *diagnosis* only — a human still initiates the remediation action. For incidents where AI can autonomously act (known patterns: OOM → reprovision with adjusted limits, crash loop → restart + config drift check, dead workload → re-declare from NixOS config):

- Human time NOT captured by §6: read diagnosis output → confirm action → initiate action → verify completion = ~22 min per autonomous-remediable incident
- Assumed autonomous-remediable fraction: ~40% of incidents at each profile

| Profile | Incidents/mo | Autonomous-remediable (40%) | Time saved/incident | Labor rate | **Annual value** |
|---|---|---|---|---|---|
| Solo Sysadmin | 2 | 0.8/mo | 22 min | $75/hr | **$264/yr** |
| Mid Enterprise | 5 | 2/mo | 22 min | $100/hr | **$880/yr** |
| Large Enterprise | 10 | 4/mo | 22 min | $120/hr | **$2,112/yr** |

*Note: This models only the action-initiation labor saved. The additional uptime value (AI acting in minutes vs. human paging an on-call who acts in 20–60 min) is not modeled — it compounds the MTTR advantage in §6 but is excluded here to avoid double-counting.*

---

**§12 totals per deployment profile:**

| Profile | Auto-provisioning management | AI-delegated remediation | **§12 Annual Total** |
|---|:---:|:---:|:---:|
| Solo Sysadmin (1 node, $75/hr) | $900 | $264 | **$1,164/yr** |
| Mid Fabrick (10 nodes, $100/hr) | $4,200 | $880 | **$5,080/yr** |
| Large Fabrick (20 nodes, $120/hr) | $11,160 | $2,112 | **$13,272/yr** |

*These represent value delivered by Weaver that alternatives cannot replicate without custom automation investment. The solo sysadmin case is especially relevant: a sysadmin who would otherwise write and maintain NixOS provisioning scripts captures this value immediately at the cost of the Weaver subscription.*

---

### Operational Model Value: Summary Tables

These values supplement the setup + maintenance labor tables. They represent costs that alternatives incur and Weaver eliminates or reduces, not present in the hour-based TCO calculations above.

#### Solo Sysadmin (1 node, $75/hr) — Annual Operational Model Value vs DIY NixOS

| Dimension | Annual Value | 3-Year Value |
|---|:---:|:---:|
| Drift elimination | $450 | $1,350 |
| Provisioning velocity (5/mo) | $1,875 | $5,625 |
| Test-before-prod (3 incidents/yr prevented) | $675 | $2,025 |
| Atomic rollback (2 events/yr) | $275 | $825 |
| MTTR improvement (2 incidents/mo) | $600 | $1,800 |
| Audit readiness (1 cycle/yr) | $1,800 | $5,400 |
| Knowledge continuity (0.5 events/yr) | $750 | $2,250 |
| Toolchain sprawl eliminated | $1,350 | $4,050 |
| **— Auto-Provisioning & AI Remediation (§12) —** | | |
| Auto-provisioning management (routine events) | $900 | $2,700 |
| AI-delegated remediation (additive to §6) | $264 | $792 |
| **Total operational model value** | **$8,939/yr** | **$26,817** |

| **— Model Deployment & Snapshot (v2.0, §new) —** | | |
| Model deployment velocity (50 deploys/yr × 8 min saved vs manual) | $500 | $1,500 |
| Snapshot-based restore value (50 restores × 5 min saved) | $312 | $936 |
| MLOps tooling eliminated (no MLflow/W&B maintenance) | $1,200 | $3,600 |
| **Revised total operational model value** | **$10,951/yr** | **$32,853** |

Combined with base labor savings (DIY Y3 $25,200 − Weaver Y3 $3,372 = $21,828):
**Total 3-year advantage over DIY (v2.0 with AI/ML): $21,828 + $32,853 = $54,681**
**Total 3-year advantage over DIY (v1.2 without AI/ML): $16,053 + $26,817 = $42,870**

#### Mid Fabrick (10 nodes, $100/hr) — Annual Operational Model Value vs DIY NixOS

| Dimension | Annual Value | 3-Year Value |
|---|:---:|:---:|
| Drift elimination (10 nodes) | $6,000 | $18,000 |
| Provisioning velocity (20/mo) | $10,000 | $30,000 |
| Test-before-prod (4 incidents/yr prevented) | $1,200 | $3,600 |
| Atomic rollback (3 events/yr) | $2,475 | $7,425 |
| MTTR improvement (5/mo) | $2,000 | $6,000 |
| Audit readiness (1 cycle/yr) | $4,000 | $12,000 |
| Knowledge continuity (1 event/yr) | $3,200 | $9,600 |
| Toolchain sprawl eliminated | $3,600 | $10,800 |
| Workload migration (24/yr) | $2,400 | $7,200 |
| **— Remote & Fleet (v2.2+) —** | | |
| Multi-host unified visibility (2 checks/wk) | $6,933 | $20,799 |
| Fleet bulk operations (3/mo × 90 min saved) | $5,400 | $16,200 |
| Remote site visits eliminated (3 locations) | $2,700 | $8,100 |
| Cross-host migration access overhead (24/yr) | $1,200 | $3,600 |
| Fleet automation tooling eliminated (DIY scripts) | $4,800 | $14,400 |
| **— Auto-Provisioning & AI Remediation (§12) —** | | |
| Auto-provisioning management (routine events) | $4,200 | $12,600 |
| AI-delegated remediation (additive to §6) | $880 | $2,640 |
| **— GPU Scheduling & Inference (v2.0/v2.2, Decisions #113–#119) —** | | |
| GPU scheduling tooling eliminated (Slurm/Run:ai equivalent) | $20,000 | $60,000 |
| Inference metrics pipeline eliminated (custom Prometheus) | $3,600 | $10,800 |
| Snapshot-based auto-scaling (provisioning velocity at fleet) | $6,000 | $18,000 |
| Model deployment workflow (vs manual per-host) | $2,400 | $7,200 |
| **Revised total operational model value** | **$92,988/yr** | **$278,964** |

Combined with base labor savings (DIY + Slurm Y3 $126,400 − Weaver FM Y3 $45,170 = $81,230):
**Total 3-year advantage over DIY + Slurm: $81,230 + $278,964 = $360,194**

#### Large Fabrick (20 nodes, $120/hr) — Annual Operational Model Value vs DIY NixOS

| Dimension | Annual Value | 3-Year Value |
|---|:---:|:---:|
| Drift elimination (20 nodes) | $14,400 | $43,200 |
| Provisioning velocity (50/mo) | $30,000 | $90,000 |
| Test-before-prod (6 incidents/yr prevented) | $2,160 | $6,480 |
| Atomic rollback + maintenance window elimination | $8,480 | $25,440 |
| MTTR improvement (10/mo) | $4,800 | $14,400 |
| Audit readiness (2 cycles/yr) | $9,600 | $28,800 |
| Knowledge continuity (2 events/yr) | $11,520 | $34,560 |
| Toolchain sprawl eliminated | $7,200 | $21,600 |
| Workload migration (60/yr) | $7,200 | $21,600 |
| **— Remote & Fleet (v2.2+/v3.0) —** | | |
| Multi-host unified visibility (2 checks/wk) | $18,720 | $56,160 |
| Fleet bulk operations (3/mo × 190 min saved) | $13,680 | $41,040 |
| Remote site visits eliminated (6 locations) | $7,200 | $21,600 |
| Cross-host migration access overhead (60/yr) | $3,600 | $10,800 |
| Fabrick replacing AWX/Ansible Tower (v3.0) | $11,520 | $34,560 |
| HA failover: automated recovery (v3.0, 3.3 events/yr) | $2,442 | $7,326 |
| Edge site management (5 sites, v3.0) † | $30,000 | $90,000 |
| **— Auto-Provisioning & AI Remediation (§12) —** | | |
| Auto-provisioning management (routine events) | $11,160 | $33,480 |
| AI-delegated remediation (additive to §6) | $2,112 | $6,336 |
| **— Fleet Bridge & Inference Routing (v3.0, Decisions #113–#119) —** | | |
| Fleet bridge (SDN) tooling eliminated (NSX/Calico equivalent) | $40,000 | $120,000 |
| Fleet inference routing (vs custom load balancer + service mesh) | $14,400 | $43,200 |
| Fleet GPU scheduling (cross-host placement vs Slurm federation) | $24,000 | $72,000 |
| Fleet snapshot distribution (proactive cache warming) | $7,200 | $21,600 |
| Fleet model deployment (hub-directed vs per-host manual) | $4,800 | $14,400 |
| **Revised total operational model value** | **$286,194/yr** | **$858,582** |

† Edge site management applies only to organizations with remote/edge NixOS deployments. Exclude this row for pure datacenter configurations; the remaining total (no edge, with §12 and fleet bridge) is $256,194/yr / $768,582 over 3 years.

Combined with base labor savings (DIY Y3 $235,200 − Weaver FM Y3 $90,420 = $144,780):
**Total 3-year advantage over DIY (with edge + fleet bridge): $144,780 + $858,582 = $1,003,362**
**Total 3-year advantage over DIY (no edge, with fleet bridge): $144,780 + $768,582 = $913,362**

---

### Operational Model Value vs Proxmox (not just DIY)

The above compares against DIY NixOS because that is the highest-labor alternative. Against Proxmox, many of these values are smaller (Proxmox has good tooling), but the structural differentials remain:

| Dimension | Weaver advantage vs Proxmox |
|---|---|
| Adoption friction | Weaver: $800 setup. Proxmox: $8,000–$16,800 migration (10–20 nodes). |
| Configuration drift | Weaver: zero drift. Proxmox: ~50% of DIY drift cost (~3 hrs/host/yr). |
| Provisioning velocity | Weaver: 5 min. Proxmox: 10–20 min. Saves ~12 min/workload. |
| Atomic rollback | Weaver: generation switch, 3 min. Proxmox: snapshot revert, 15–45 min (if snapshot exists). |
| Audit readiness | Weaver: config is the audit. Proxmox: Proxmox DB is not VCS; needs supplemental tooling. |
| Exit cost | Weaver: $0 (NixOS infra survives). Proxmox: equivalent of adoption cost to migrate away. |
| MicroVM workloads | Weaver: full support. Proxmox: KVM/LXC only; MicroVMs cannot run on Proxmox. |
| NixOS workload model | Weaver: preserved. Proxmox: abandoned permanently on adoption. |
| Fleet bulk operations | Weaver: one action, all nodes. Proxmox: per-node via web UI or scripted pvesh. |
| Multi-host unified visibility | Weaver: single pane (v2.2+). Proxmox: Datacenter Manager (PDM) is comparable but Proxmox-only, not NixOS-native. |
| Remote workload management | Weaver: Tailscale-native, zero-config remote fleet access. Proxmox: web UI behind firewall; requires VPN or port exposure. |
| Fleet automation (v3.0) | Weaver: Fabrick is NixOS-native fleet control plane. Proxmox: requires Ansible/AWX for fleet ops; no NixOS playbooks included. |
| HA failover | Weaver v3.0: automatic MicroVM/container restart on host failure. Proxmox: HA requires Ceph shared storage (separate cost + complexity). |
| Edge site management | Weaver v3.0: Fabrick manages edge NixOS nodes remotely. Proxmox: no specific edge management; per-site web UI or VPN required. |

For a NixOS shop: **Proxmox adoption is not a cost optimization — it is a platform abandonment.** The $8,000–$16,800 migration cost is the fee to leave NixOS, paid upfront, with no refund.

---

### Regulated Industry TCO Supplement

For organizations subject to HIPAA, CMMC, SOC 2, or PCI-DSS, compliance is not a soft benefit — it has a published cost schedule. Audit findings, remediation requirements, and re-assessment fees are real TCO line items that apply specifically when configuration state is undocumented or unverifiable. NixOS + Weaver eliminates the conditions that create these findings.

#### What Auditors Are Actually Looking For

| Regulation | Specific Control | Finding Trigger | Penalty / Cost |
|---|---|---|---|
| **HIPAA** | §164.312(b) Audit Controls | Systems handling PHI with no audit mechanism or unverifiable configuration state | $1,379–$68,928 per violation; up to $2.07M/yr for willful neglect |
| **HIPAA** | §164.308(a)(1) Risk Analysis | Infrastructure changes not documented; configuration drift undetected | Required remediation plan; re-audit |
| **CMMC L2** | CM.L2-3.4.1 Baseline Configurations | No documented baseline for IT systems | Failed assessment; ineligible for DoD contracts until remediated |
| **CMMC L2** | AU.L2-3.3.1 Audit Logs | System changes not captured in audit trail | Failed assessment finding |
| **SOC 2** | CC6.1 Logical Access | System configuration not baselined or reviewable | Material finding; remediation required before clean opinion |
| **SOC 2** | CC7.2 System Monitoring | Undocumented changes to production systems | Material finding |
| **PCI-DSS** | Req 2 Config Standards | No documented configuration standards for system components | Non-compliance; $5,000–$100,000/month until remediated |
| **PCI-DSS** | Req 10 Audit Logs | Insufficient audit trail for system access/changes | Non-compliance finding |

#### How NixOS + Weaver Satisfies Each Control

| Control | How Weaver satisfies it | What the alternative requires |
|---|---|---|
| Audit trail for system changes | Git log of config repo = complete, attributed, timestamped change history | SIEM integration, manual change tickets, auditd configuration |
| Baseline configuration documented | Config file IS the baseline; `nix-store --verify` proves running state matches | Qualys/Nessus scans, manual inventory, SCAP baselines |
| Configuration drift detectable | Impossible by design; any deviation is a rebuild | Scheduled compliance scans, manual comparison |
| PHI system audit log (HIPAA) | Weaver audit log (v2.2) captures all workload access and modification events | auditd + SIEM + custom log pipeline per host |
| Personnel change continuity | Config + audit log survive staff departure; no knowledge gap | Manual documentation that typically lapses during transitions |

#### Annual Compliance TCO for Regulated Mid Fabrick (10 nodes, $100/hr)

These costs apply to organizations in regulated industries running alternatives to Weaver. They do not apply to Weaver on NixOS.

| Compliance cost line item | Alternative toolchain annual cost | Weaver annual cost | **Annual savings** |
|---|:---:|:---:|:---:|
| Audit prep labor (config inventory, baseline reconciliation, change record assembly) | 80 hrs × $100 = $8,000 | 16 hrs × $100 = $1,600 | **$6,400** |
| Configuration baseline tooling (Qualys, Nessus, or equivalent scanning) | $4,800–$12,000/yr | $0 (config is baseline) | **$6,000** |
| Manual change documentation (4 hrs/mo team time) | 4 hrs/mo × 12 × $100 = $4,800 | $0 (git log is change record) | **$4,800** |
| Expected audit finding cost (15% probability × $30,000 avg remediation) † | $4,500/yr expected value | $0 | **$4,500** |
| **Annual regulated compliance TCO supplement** | **$22,100** | **$1,600** | **$20,500/yr** |

† Expected value calculation: 15% annual probability of an "undocumented configuration state" finding × $30,000 average remediation cost (consultant + re-audit). Based on industry survey data showing 22% of SOC 2 Type II audits in organizations without formal configuration management result in a CC6.1 or CC7.2 finding.

**3-year regulated compliance supplement (10 nodes):** $20,500 × 3 = **$61,500**

#### Annual Compliance TCO for Regulated Large Fabrick (20 nodes, $120/hr, 2 audit cycles/yr)

| Compliance cost line item | Alternative toolchain annual cost | Weaver annual cost | **Annual savings** |
|---|:---:|:---:|:---:|
| Audit prep labor (2 cycles × 80 hrs/cycle) | 160 hrs × $120 = $19,200 | 32 hrs × $120 = $3,840 | **$15,360** |
| Configuration baseline tooling (fabrick tier) | $12,000–$24,000/yr | $0 | **$15,000** |
| Manual change documentation (8 hrs/mo) | 8 hrs/mo × 12 × $120 = $11,520 | $0 | **$11,520** |
| Expected audit finding cost (20% probability × $50,000 avg at scale) | $10,000/yr expected value | $0 | **$10,000** |
| **Annual regulated compliance TCO supplement** | **$55,720** | **$3,840** | **$51,880/yr** |

**3-year regulated compliance supplement (20 nodes):** $51,880 × 3 = **$155,640**

#### CMMC-Specific: Defense Contractor Cost Schedule

CMMC Level 2 assessment costs and consequences are more severe than SOC 2, because a failed assessment does not just produce a finding — it produces contract ineligibility.

| Event | Cost to organization |
|---|---|
| C3PAO assessment (every 3 years) | $20,000–$100,000 |
| Failed assessment: remediation consultant | $50,000–$200,000 |
| Failed assessment: re-assessment fee | $20,000–$100,000 |
| Failed assessment: DoD contract ineligibility period | Loss of DoD revenue during remediation (weeks to months) |
| **Expected cost of CM.L2-3.4.1 finding without config management** | **$70,000–$300,000 per 3-year cycle** |

For defense contractors, the CMMC configuration baseline control (CM.L2-3.4.1) is directly satisfied by NixOS declarative configuration. The C3PAO assessor's question — "show me your documented baseline configuration for this system and evidence that the running system matches it" — is answered by: point to the config file, run `nixos-rebuild dry-run`, show zero diff. This is not achievable with Proxmox or a DIY toolchain without supplemental tooling.

**Amortized annual CMMC TCO savings for defense contractors (10 nodes):**
- Assessment prep: $4,000/yr (40 hrs × $100 avoided)
- Expected finding avoidance: $10,000/yr expected value (10% × $100,000 avg finding + remediation)
- **Total CMMC supplement: $14,000/yr, $42,000 over 3 years**

#### Regulated Industry Full-Picture TCO (Mid Fabrick, 10 nodes, HIPAA or SOC 2)

Adding compliance supplement to the base operational model:

| Component | 3-Year Value |
|---|---|
| Base labor savings vs DIY (from ROI table) | $56,830 |
| Operational model value (§1–§10) | $104,625 |
| Regulated compliance supplement | $61,500 |
| **Total 3-year advantage (regulated mid enterprise)** | **$222,955** |

Fabrick (FM) for a regulated 10-node shop costs $38,970 over 3 years. The value delivered vs DIY NixOS with compliance tooling is $222,955. **That is a 5.7× return on the license cost over 3 years, before counting any downtime, breach, or institutional knowledge event.**

---

### What This Analysis Still Doesn't Fully Capture

Even with the operational model and regulated supplement sections, two TCO dimensions remain difficult to quantify but are real:

**1. Institutional knowledge risk reduction**

This is distinct from the individual onboarding cost covered in §8. Institutional knowledge risk is the organization-level exposure when infrastructure understanding lives in people rather than in the system itself.

In traditional toolchains — Proxmox, Cockpit + scripts, DIY NixOS without disciplined VCS hygiene — infrastructure knowledge accumulates in layers:
- Configuration decisions made in response to incidents, with no written record of why
- Firewall rules and network settings that "just work" and nobody touches
- Runbooks written once, never updated, diverged from reality within months
- The person who built the system as the living documentation — a single point of failure

When that person leaves, retires, goes on leave, or is acquired by a competitor:
- A new engineer inheriting the infrastructure must reverse-engineer it — spending 40–200 hrs piecing together what was built and why
- DR scenarios without the original builder can extend recovery from hours to days
- Compliance audits in regulated environments (HIPAA, CMMC, SOC 2) fail on "undocumented configuration decisions" — a finding that costs $10,000–$50,000+ in remediation and consultant time
- Security auditors find accumulated manual changes with no change record — a material finding

**NixOS + Weaver eliminates institutional knowledge risk by construction:**

The config repository IS the institutional memory. Every infrastructure decision is expressed as code, committed to VCS with attribution and timestamp. The "why" can be preserved in commit messages and inline comments — and unlike runbooks, the config can never silently diverge from the running system. If the config says it, the system is doing it. If the system is doing something the config doesn't say, that is detectable and correctable.

Specific protections:
- **Key person dependency eliminated** — any engineer with NixOS knowledge can operate and modify the infrastructure on day one. There are no undocumented procedures, no "ask Jim" knowledge dependencies.
- **Staff transition continuity** — hiring, firing, resignation, extended leave, or death of a team member does not create an infrastructure knowledge gap. The config survives the person.
- **DR without the builder** — recovering a host from config requires no institutional knowledge of that host's history. Deploy config → working system. This is equally true if the builder is unavailable, unreachable, or no longer with the organization.
- **Compliance continuity** — change history is git log. Access history is Weaver audit log (v2.2). Configuration state is the config file. None of this requires active human maintenance to remain accurate. The compliance audit finding that an undocumented configuration state creates is now quantified in the Regulated Industry TCO Supplement above — it is a $20,500/yr line item, not a soft benefit.
- **Infrastructure archaeology** — understanding decisions made three years ago is `git log --follow -p path/to/config.nix`. In a Proxmox environment, the equivalent question is "ask whoever was here in 2023, or hope there's a ticket."

**What a knowledge risk event costs when it goes wrong:**

A mid-enterprise organization (10 nodes) where the principal infrastructure engineer departs unexpectedly:
- External consultant engagement to audit and document the current state: 80–160 hrs at $150–175/hr = **$12,000–$28,000**
- Delayed incident response during the transition period (2–4 incidents at elevated MTTR): **$4,000–$12,000**
- Compliance audit finding for undocumented configuration (now quantified in the Regulated supplement): **$10,000–$50,000** (remediation + consultant time + potential re-audit fee)
- **Total institutional knowledge risk event: $26,000–$90,000 per occurrence**

For a NixOS + Weaver environment, this event doesn't happen — not because the engineer didn't leave, but because their departure doesn't create a knowledge gap. The config is the knowledge.

This is a tail risk: low frequency, high cost. For organizations that have experienced it (or whose leadership has), it is often the decisive factor — not the maintenance hour comparison. The compliance component of this risk is now quantified in the Regulated Industry TCO Supplement. The non-compliance component (consultant audit, elevated MTTR during transition) remains an unquantified expected value in the tables but is real and has the cost schedule above.

**2. Insurance / cyber risk premium reduction**

Reproducible, version-controlled infrastructure is objectively lower risk for cyber insurance purposes. Insurers are beginning to discount premiums for organizations with documented configuration management practices. A 5–10% reduction on a $10,000–$50,000/yr cyber insurance policy is $500–$5,000/yr in real savings. This will grow as the insurance market matures.

**3. Breach / incident blast radius reduction**

NixOS immutability limits persistent attacker footholds. A compromised NixOS system that is redeployed from config is fully clean; no persistent attacker state survives the rebuild. In traditional systems, attackers modify config files, add cron jobs, install rootkits — and manual remediation is incomplete. The value of this is not a maintenance hour — it is incident response and breach recovery cost avoided. A single serious breach costs $50,000–$500,000+ to investigate and remediate. The risk reduction is not zero.

---

## ROI Crossover Summary

The following table shows the point at which Weaver FM pays for itself vs the DIY NixOS alternative:

| Version | Profile | Weaver FM Y1 | DIY Y1 | DIY savings | Payback period |
|---------|---------|:------------:|:------:|:-----------:|:--------------:|
| v1.0 | 1 node, $75/hr | $749 | $9,000 | $8,251 | **< 2 weeks of saved setup labor** |
| v1.2 | 1 node, $75/hr | $1,012 | $14,700 | $13,688 | **< 2 days of setup time** |
| v2.2 | 10 nodes, $100/hr | $15,590 | $54,000 | $38,410 | **Day 1 — license paid back by saved setup labor alone** |
| v3.0 | 20 nodes, $120/hr | $31,260 | $134,400 | $103,140 | **Day 1 — setup labor savings alone = 3× license cost** |

**Interpretation of "Day 1 payback":** At v2.2 Fabrick, the $30,000 DIY setup cost vs $800 Weaver setup cost creates a Year 1 savings of $38,410 even before counting the $24,000/yr ongoing maintenance advantage. The fabrick license is effectively free compared to the alternative.

### Full-Picture 3-Year Value (Labor + Operational Model) vs DIY

Adding operational model value to base labor savings:

| Profile | Base labor savings (Y3) | Operational model value (Y3) | **Total 3-year advantage** |
|---|:---:|:---:|:---:|
| Solo Sysadmin (v1.2, 1 node) | $16,053 | $23,325 | **$39,378** |
| Mid Fabrick (v.2, 10 nodes) | $56,830 | $167,724 | **$224,554** |
| Large Fabrick (v.0, 20 nodes, no edge) | $144,780 | $457,566 | **$602,346** |
| Large Fabrick (v.0, 20 nodes, with edge) | $144,780 | $547,566 | **$692,346** |

**Regulated industry buyers — add compliance supplement:**

| Profile | Base + operational (Y3) | Compliance supplement (Y3) | **Regulated 3-year total** |
|---|:---:|:---:|:---:|
| Mid Fabrick, regulated (HIPAA/SOC 2) | $224,554 | $61,500 | **$286,054** |
| Large Fabrick, regulated, no edge (2 audits/yr) | $602,346 | $155,640 | **$757,986** |
| Large Fabrick, regulated, with edge | $692,346 | $155,640 | **$847,986** |
| Defense contractor, CMMC L2 (10 nodes) | $224,554 | $42,000 | **$266,554** |

At enterprise scale, the fleet management value (§11) now exceeds every other operational model dimension combined for large deployments. The hour tables capture what it costs to operate one host at a time. The full picture captures what the NixOS-native fleet plane is worth — which at regulated large enterprise with edge deployments approaches $848,000 in 3-year value vs DIY.

### Crossover vs Proxmox (the cost-competitive alternative)

Proxmox Year 3 is cost-competitive with Weaver Standard at large scale (v3.0, 20 nodes: $71,160 vs $73,980). But Proxmox is only cheaper on licensing — and only if the organization is willing to:

1. Pay $16,800 in migration labor (vs $1,680 for Weaver setup)
2. Abandon NixOS reproducibility permanently
3. Accept no MicroVM support, no Live Provisioning, no NixOS-native workload model

The Proxmox alternative represents a different product, not a cheaper version of Weaver.

---

## Breach Cost Avoidance — The AI Zero-Day Factor

### The Baseline: What Breaches Cost Today

IBM Cost of a Data Breach Report 2024:
- **Average breach cost:** $4.88M
- **Healthcare:** $10.93M (highest sector, 14th consecutive year)
- **Financial services:** $6.08M
- **Technology:** $5.45M

These figures assume the current vulnerability discovery rate — predominantly human researchers, bug bounty programs, and fuzzing tools.

### What Changes: Project Glasswing and AI-Discovered Zero-Days

In April 2026, Anthropic's Project Glasswing demonstrated that AI can discover thousands of zero-day vulnerabilities at industrial scale, including bugs that survived decades of human code review. The coalition ($100M in credits, 40+ organizations, 90-day public disclosure cycle) makes two things clear:

1. **The volume of exploitable vulnerabilities in circulation will increase dramatically.** AI finds classes of bugs that human reviewers systematically miss.
2. **Defensive AI is a temporary advantage.** Anthropic's own framing: *"AI cyber capabilities at this level will proliferate over the coming months, and not every actor who gets access to them will be focused on defense."* Offensive AI tools will follow.

For shared-kernel architectures (Docker, Podman, Kubernetes pods), each kernel zero-day is a total-host event. Every workload on the host is exposed. The expected breach cost is:

```
Expected breach cost = P(exploit) × blast radius × cost per compromised workload
```

AI-discovered zero-days increase P(exploit). Shared kernels maximize blast radius. Both terms move in the wrong direction simultaneously.

### How Weaver Changes the Equation

**Hardware isolation reduces blast radius to one workload.** A kernel zero-day exploited inside a MicroVM cannot reach other MicroVMs or the host — the hypervisor boundary prevents lateral movement. The blast radius shrinks from "every workload on the host" to "one VM." For a host running 20 workloads, this is a 20x reduction in breach scope.

**NixOS deterministic patching reduces MTTD/MTTR.** When a Glasswing-class disclosure drops:
- **Mean time to detect (MTTD):** NixOS config diff shows whether the vulnerability is present — immediate, deterministic, no scanning.
- **Mean time to respond (MTTR):** `nixos-rebuild switch` applies the patch atomically. At Fabrick scale, `colmena apply` patches the entire fleet. IBM reports that organizations with faster MTTD/MTTR save an average of $1.76M per breach.

**Quantified impact (conservative):**

| Factor | Shared-Kernel Architecture | Weaver (Hardware Isolation) | Delta |
|--------|:-:|:-:|:-:|
| Blast radius per exploit | All host workloads | 1 MicroVM | 10–50x reduction |
| Patch verification | Manual/scanning | Deterministic (Nix hash) | Hours → seconds |
| Fleet patch consistency | Per-host verification | Colmena guarantees | Drift possible → drift impossible |
| Breach probability adjustment (AI zero-days) | Increasing | Same, but contained | Exposure grows on shared-kernel only |

**The framing:** The TCO of NOT having hardware isolation just went up. Every AI-discovered kernel zero-day is a free option on breaching every workload on a shared-kernel host. Weaver converts that total-host exposure into single-VM containment — at $249/yr for Solo, $199/user/yr for Team, or $2,000/yr/node for Fabrick. Against a $4.88M average breach cost, even a marginal reduction in breach probability pays for Weaver thousands of times over.

**For healthcare and financial services buyers:** The sector-specific breach costs ($10.93M healthcare, $6.08M financial) make the hardware isolation argument even stronger. A single contained breach that would have been a total-host compromise on Docker/Proxmox/VMware justifies years of Weaver licensing.

---

## Sales Talking Points by Buyer Segment

### Solo Sysadmin / Weaver Buyer

> "You will spend more money in the first week of DIY setup than Weaver costs for the entire year. At v1.2, the DIY alternative costs $14,700 in Year 1 — and that's assuming you're already a NixOS expert. Weaver FM is $1,012."

> "There is no off-the-shelf product that does what Weaver does at v1.2. Cockpit does system monitoring. Portainer does containers. Neither does Live Provisioning. Neither talks to Apptainer. Neither has AI diagnostics. Combining them still doesn't give you a unified API."

### Fabrick Buyer (10–20 nodes)

> "The first question is whether you're staying on NixOS. If yes, the Proxmox migration conversation ends there — it costs $8,000–17,000 to migrate and then you no longer have NixOS. Weaver is the only product that manages NixOS fleet infrastructure with fabrick features."

> "At v2.2, Weaver FM at $15,590/yr for 10 nodes competes directly with Proxmox Standard at $17,300. You pay less, get better tooling for your stack, and don't abandon the investment you made in NixOS declarative infrastructure."

> "DIY at 10 nodes is $54,000 in Year 1. That's 3.5× more expensive than Fabrick. And your team is doing platform engineering instead of shipping product."

### Fabrick Buyer evaluating Rancher/K3s

> "Rancher is a Kubernetes fleet manager. If your workloads are 100% containers and you want to run K8s everywhere, Rancher is a legitimate choice. But if any of your workloads are MicroVMs — hardware-isolated workloads that need dedicated memory, CPU pinning, or network isolation at the hypervisor level — Rancher has no answer. Weaver manages the full isolation spectrum."

> "Rancher Prime at 10 nodes is $19,200 in Year 1 vs $15,590 for Weaver FM. Rancher requires Kubernetes expertise on your team. If you don't have it, add $20,000–40,000 in training or consulting to the TCO."

### Fabrick Buyer comparing OpenShift

> "OpenShift at 20 nodes is $95,280–$225,000 in Year 1. Weaver at 20 nodes is $25,780. OpenShift is a full PaaS platform — if you want that, it's a different conversation. But if you want fleet management for NixOS workloads with HA, live migration, and enterprise RBAC, Weaver delivers it at less than 27% of the OpenShift entry price."

---

## Assumptions Register

| Assumption | Value | Source/Basis |
|---|---|---|
| Senior sysadmin loaded cost | $75/hr | US market; ~$120,000–150,000 fully loaded / 2,000 hrs/yr |
| IT infrastructure staff loaded cost | $100/hr | US market; $160,000–200,000 fully loaded |
| Enterprise infra engineer loaded cost | $120/hr | US market; senior engineer at larger org |
| NixOS consultant rate | $150–175/hr | Specialty market; NixOS expertise premium |
| Fabrick (FM), 10-node | $12,990/yr | 10 × $1,299/yr (FM rate locked) |
| Fabrick (Standard) v2.2, 10-node | $11,500/yr | $2,000 + 3×$1,250 + 5×$1,000 + 1×$750 (tiered pricing, Decision #142) |
| Fabrick (Standard) v3.0, 20-node | $20,500/yr | $3,500 + 3×$1,250 + 5×$1,000 + 11×$750 (tiered additional nodes, Decision #142) |
| Proxmox Basic subscription | ~$130/yr/socket | €119/yr at 1 EUR = $1.10 |
| Proxmox Standard subscription | ~$330/yr/socket | €299/yr at 1 EUR = $1.10 |
| Rancher Prime | $600/yr/node | SUSE Rancher Prime list price |
| OpenShift | $3,000–9,200/yr/node | Red Hat list price; low end used |
| Nutanix AOS | ~$1,500/yr/node | Conservative estimate; negotiated contracts vary |
| Portainer Business | ~$180–1,100/yr (scaled) | ~$180/yr base + $55/additional agent |

---

---

## FM Gating Analysis: AI/Inference Features (Decision Proposal)

### The Problem

FM customers who locked in at $149/yr (Solo) or $1,299/yr/node (Fabrick) before v2.0 will receive model deployment, GPU scheduling, inference metrics, snapshot-based provisioning, and fleet inference routing — capabilities worth $6,000–$50,000/yr in the market — at their locked FM rate. AI capabilities (Smart Bridges) are now included in the base tier price (Decision #142), which partially addresses the value leak but increases the base FM rate to capture this value.

### Revenue Impact Quantification

**Weaver Solo FM at $149/yr** receiving v2.0 model deployment:
- Market equivalent: $6,000–$7,200/yr (Run:ai single-node or Anyscale equivalent)
- FM capture rate: $149 / $6,600 midpoint = **2.3%**
- Per-customer annual revenue gap: **$6,451/yr**
- At 50 FM Solo customers: **$322,550/yr in uncaptured value**

**Fabrick FM at $1,299/yr/node** receiving v2.2 GPU scheduling + v3.0 fleet bridge:
- Market equivalent: $5,000–$7,400/yr/node (Run:ai + SDN overlay)
- FM capture rate: $1,299 / $6,200 midpoint = **21.0%**
- Per-node annual revenue gap: **$4,901/yr**
- At 20 FM Fabrick customers × 10 nodes avg: **$980,200/yr in uncaptured value**

### Resolution: AI/Inference Included in Base Price (Decision #142)

AI/inference capabilities are **included in the base tier price** as "Smart Bridges" (Decision #142). The separate AI Pro/AI Fleet extension model has been retired. FM pricing covers the full product including AI capabilities, with the FM Fabrick node rate increased from $999 to $1,299 to capture this value.

**AI/Inference Capability Tiers (included in base price):**

| Tier | What's Included | Price | FM Treatment |
|------|----------------|------:|:--:|
| **AI Base** (included in all tiers) | BYOK AI diagnostics, mock agent | $0 | Included |
| **Weaver AI / Smart Bridges** (Team) | Model library, deployment workflow, snapshot provisioning, GPU templates, inference metrics | Included in base price | Included in base FM (Decision #142) |
| **FabricK AI / Smart Bridges** (Fabrick) | GPU reservation/queue/preemption, MIG, auto-scaling, fleet inference metrics, fleet inference routing, fleet snapshot distribution | Included in base price | Included in base FM (Decision #142) |

**Revenue impact with Decision #142 (AI included in base price):**

| Scenario | Old FM rate (pre-#142) | New FM rate (Decision #142) | Recovery |
|----------|:------------------------:|:-----------------:|:--------:|
| 50 Solo FM | 50 × $149 = $7,450/yr | 50 × $149 = **$7,450/yr** | $0 (Solo unchanged) |
| 20 Fabrick FM × 10 nodes | 20 × 10 × $999 = $199,800/yr | 20 × 10 × $1,299 = **$259,800/yr** | +$60,000 |
| **Combined** | **$207,250/yr** | **$267,250/yr** | **+$60,000/yr** |

### Why This Works

1. **FM promise is honored.** The base product — workload management, networking, storage, clustering, HA, RBAC, audit — remains at the locked FM rate. The FM customer gets everything they were promised.

2. **AI/inference is genuinely new scope.** Decisions #113–#119 were made after the FM program was designed. The model deployment workflow, GPU scheduling, fleet inference routing, and snapshot provisioning are capabilities that didn't exist in the product roadmap when FM pricing was set. Decision #142 captures this value through higher base pricing rather than separate extensions.

3. **Market precedent supports premium pricing.** Every infrastructure platform charges separately for AI/ML capabilities: AWS (SageMaker vs EC2), GCP (Vertex AI vs Compute), Run:ai (GPU scheduling is a separate product), Anyscale (Ray Serve pricing is separate from Ray Core). Weaver's approach — including AI in the base price — is simpler for buyers and still dramatically below market rates.

4. **Base pricing is still 98% below market.** Smart Bridges included at $1,299/yr/node (FM) vs Run:ai at $5,000/yr/node = 74% cheaper. FM customers still get extraordinary value — AI capabilities included in the base tier (Decision #142) rather than gated as separate extensions.

5. **Included before features ship.** Decision #142 resolved this before v2.0 ships — AI capabilities are included in the base tier, with FM pricing adjusted upward to capture the value. No separate extension purchase required.

### Decision Resolved (Decision #142)

AI/inference capabilities are included in the base tier price as "Smart Bridges." The separate AI Pro ($99/yr) and AI Fleet ($499/yr/node) extensions have been retired. FM Fabrick node rate increased from $999 to $1,299 to capture this value. Team pricing updated from $149/user/yr to $199/user/yr standard ($129/user/yr FM). Additional nodes now use tiered pricing: $1,250/yr (nodes 2–4), $1,000/yr (nodes 5–9), $750/yr (nodes 10+).

---

*Cross-reference: [PRICING-POWER-ANALYSIS.md](PRICING-POWER-ANALYSIS.md) | [FOUNDING-MEMBER-PROGRAM.md](FOUNDING-MEMBER-PROGRAM.md) | [TIER-MANAGEMENT.md](TIER-MANAGEMENT.md) | [RELEASE-ROADMAP.md](RELEASE-ROADMAP.md)*
