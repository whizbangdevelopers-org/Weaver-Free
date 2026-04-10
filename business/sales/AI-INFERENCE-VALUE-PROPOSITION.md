<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# AI Inference Infrastructure Sales Case
## How Weaver and Fabrick Deliver Self-Hosted AI Without the Kubernetes Tax
*ML Teams, Research Labs, Privacy-First Organizations & Edge AI Deployments*

**Date:** 2026-03-28
**Parent doc:** [IT-FOCUS-VALUE-PROPOSITION.md](IT-FOCUS-VALUE-PROPOSITION.md)
**Research source:** [ai-infrastructure-vertical.md](../../research/ai-infrastructure-vertical.md) (market research, validation steps)

---

## Table of Contents

1. [The AI Infrastructure Problem](#1-the-ai-infrastructure-problem)
2. [Regulatory Mapping: What Weaver Addresses](#2-regulatory-mapping)
3. [Weaver for AI Inference](#3-weaver-for-ai-inference)
4. [Fabrick for AI Inference](#4-fabrick-for-ai-inference)
5. [Deficiency Remediation Plan](#5-deficiency-remediation-plan)
6. [AI Inference-Specific Competitive Advantages](#6-competitive-advantages)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Success Programs](#9-success-programs)
10. [Discovery Questions](#10-discovery-questions)

---

## 1. The AI Infrastructure Problem {#1-the-ai-infrastructure-problem}

**No NixOS expertise required — ever.** Weaver runs alongside existing Docker, VMware, Proxmox, or bare-metal tooling. Migrate one workload at a time. No cutover event. No retraining.

Every organization running AI inference on self-hosted hardware faces the same crisis: the ML environment is a black box. Models that work on a developer's laptop fail in production. GPU allocation is tribal knowledge. Model version rollouts are manual and terrifying. There is no audit trail for what model is running where, on which hardware, with which dependencies.

The industry response is Kubernetes + GPU Operator + Helm + ArgoCD + a platform team. The result: months of setup, YAML sprawl, GPU device plugin failures, and a $150K+/yr platform engineering cost before a single model serves a request.

**What AI/ML teams should be doing:**

- Deploying models to production with reproducible environments
- Rolling out model updates with zero-downtime blue/green deployments
- Scaling inference capacity based on request load
- Maintaining GPU allocation fairness across teams
- Documenting model deployment history for compliance and reproducibility
- Isolating inference workloads handling sensitive data (healthcare, legal, defense)

**What AI/ML teams actually spend time doing:**

- Debugging CUDA version mismatches between dev, staging, and production
- Manually SSH-ing into GPU servers to check which models are running
- Restarting crashed inference servers with no health monitoring
- Fighting with Kubernetes GPU Operator versions and device plugin failures
- Rebuilding environments from scratch because "something changed"
- Running inference on shared GPUs with no isolation or audit trail

**Weaver eliminates the second list so ML teams can focus on the first.**

### Private AI Infrastructure — The Broader Story (Decision #134)

AI inference is one use case. The broader buyer pain is: **"I need AI capabilities across my organization, but I can't send any of it to the cloud."**

Weaver is private AI infrastructure. Every department that needs AI but can't use the cloud runs their workload on Weaver:

| Department | AI Need | Privacy Constraint | Weaver Solution |
|-----------|---------|-------------------|-----------------|
| **Engineering** | AI coding agents | ITAR/CUI — source code can't leave network | ZenCoder on-premise on Weaver (recommended private AI engine) |
| **Clinical / Research** | AI-assisted documentation, analysis | HIPAA — patient data, ePHI | Ollama/vLLM on Weaver, isolated workload group |
| **Accounting / Finance** | AI financial analysis, reconciliation | SOX, internal policy — financials stay private | Local inference on Weaver, audit trail |
| **Legal** | AI contract review, document analysis | Attorney-client privilege | Local inference on Weaver, isolated group |
| **Operations** | AI infrastructure diagnostics | Don't expose infra topology to cloud APIs | Claude BYOK through Weaver |

**Three private AI pillars:**
1. **Private AI coding** — ZenCoder (recommended) on Weaver for dev teams
2. **Private AI inference** — Ollama, vLLM, TGI on Weaver for application workloads
3. **Private AI diagnostics** — Claude BYOK through Weaver for infrastructure management

All three managed under one compliance umbrella: RBAC, audit logging, workload groups with AI policy enforcement (`local-only`, `claude-only`, `none` per group), per-user rate limits. One license, one management plane, one audit trail.

**Per-user AI rate limits (Decision #128).** AI agent rate limits are configurable per user at Team+ tier. Admins set individual ceilings based on role or budget — preventing runaway API costs (cloud providers), GPU saturation (self-hosted models), or queue flooding (shared inference servers). Free: 5/min, Solo: 10/min, Team: 10/min + per-user config, Fabrick: 30/min + fleet-wide per-user config.

**Competitive position:** GitHub Copilot, AWS CodeWhisperer, and Cursor are cloud-only. Proxmox has no AI features. Kubernetes requires months of GPU Operator setup. Weaver ships private AI infrastructure out of the box.

---

## 2. Regulatory Mapping: What Weaver Addresses {#2-regulatory-mapping}

AI inference in regulated industries carries compliance requirements that cloud AI cannot satisfy and Kubernetes makes difficult to prove.

| Regulation | Requirement | Weaver/Fabrick Capability | Available |
|-----------|-------------|--------------------------|:---------:|
| **HIPAA** § 164.312(a) | Access controls for ePHI used in clinical inference | Per-VM RBAC, audit log, hardware isolation | v1.0 |
| **HIPAA** § 164.312(b) | Audit trail for model access to patient data | Git-based change log, tamper-evident audit | v1.0 |
| **SOC 2** CC6.1 | Logical access to inference endpoints | Tier-gated access, per-VM ACL | v1.0 |
| **NIST 800-53** CM-2/CM-6 | Baseline configuration for inference environments | NixOS declarative config = baseline by construction | v1.0 |
| **NIST 800-171** 3.4.1 | CUI protection in defense AI workloads | MicroVM hardware isolation, air-gap compatible | v1.0 |
| **21 CFR Part 11** | Electronic records integrity for pharma AI/ML | Immutable NixOS config, signed attestation | v2.2 |
| **CMMC Level 2** AC.3.022 | Network segmentation for CUI inference | Bridge-per-workload, firewall presets | v1.2 |
| **EU AI Act** Art. 9 | Risk management for high-risk AI systems | Reproducible environments, deployment audit trail | v1.0 |
| **GDPR** Art. 25 | Data protection by design for inference on EU data | Self-hosted (no data egress), hardware isolation | v1.0 |
| **NIH DMS** / **NSF DMP** | Computational reproducibility for funded research | NixOS flake-locked environments, bit-for-bit cloning | v1.0 |

**The compliance moat:** Cloud AI platforms operate under shared responsibility models. Kubernetes environments require extensive documentation to prove isolation. Weaver's MicroVM hardware isolation is compliance-by-construction — each inference workload runs in its own hardware boundary, and the NixOS declarative model means the configuration IS the documentation.

---

## 3. Weaver for AI Inference {#3-weaver-for-ai-inference}

### The NixOS Reproducibility Advantage

This is the genuine moat. In the ML world, environment reproducibility is a constant pain:

```
Traditional ML setup:
  conda create → pip install → CUDA version mismatch → driver conflict →
  "works on my machine" → 3 hours debugging → still doesn't match production

NixOS ML setup:
  nix build .#inference-vm → identical everywhere, forever
  flake.lock pins: kernel, driver, CUDA, PyTorch, model deps
  Rollback: nixos-rebuild switch --rollback (instant)
```

Weaver makes this accessible through the UI:
1. Select AI template from catalog (CUDA, ROCm, Ollama, vLLM)
2. Customize (model, GPU assignment, memory)
3. Provision → identical environment on any NixOS host
4. Clone to 10 nodes → bit-for-bit identical inference stack

No other VM management tool offers this. Proxmox users manually install CUDA. K8s users fight GPU Operator versions. NixOS users get reproducibility for free — Weaver makes it point-and-click.

### Feature Mapping — What Exists Today + Near-Term

| Capability | Version | How It Serves AI Inference |
|-----------|---------|---------------------------|
| **GPU passthrough** (VFIO-PCI) — NVIDIA, AMD, Intel | v1.2 | One GPU per VM — clean hardware isolation for each model. Vendor-agnostic: any PCIe GPU works (Decision #113) |
| **Live Provisioning** | v1.0 | Spin inference VMs in seconds, no `nixos-rebuild switch` |
| **AI VM templates** — vendor variants | v2.0 | CUDA (NVIDIA), ROCm (AMD), oneAPI (Intel), Ollama, vLLM, TGI. Same NixOS flake structure, different driver pins. Deploy a model stack in 30 seconds |
| **Model library + deployment workflow** | v2.0 | Shed-native model registry (name, source, version, GPU requirements, status). Full workflow: select model → provision → health check → serve. Testing → staging → production lifecycle. Model source is the user's responsibility — Weaver stores pointers, not weights (Decision #118) |
| **Snapshot-based model provisioning** | v2.0 | Auto-snapshot on successful health check. Subsequent deployments restore from snapshot in 2–5 seconds (QEMU memory snapshot, model already in VRAM) instead of 3–10 minutes (full provision). Rollback is instant — restore previous version's snapshot. Makes inference auto-scaling viable at scale (Decision #119) |
| **Bridge active routing** | v1.4 | Weighted traffic distribution across inference endpoints — the bridge IS your inference load balancer |
| **AI blue/green deployment** | v1.4 (Solo) / v2.2 (Team) | Clone inference VM with new model version → shift bridge weight → health check → confirm/rollback. Zero-downtime model updates. Snapshot rollback: instant restore to previous model version |
| **GPU + inference metrics** | v1.2 / v2.1 | v1.2: GPU utilization, VRAM, temperature. v2.1: inference-aware — tokens/sec, request latency, queue depth, model version. Auto-restart on VRAM OOM. Feeds bridge weight adjustment and auto-scaling triggers (Decision #117) |
| **Resource quotas** | v1.0 | GPU allocation quotas per team/user |
| **Per-VM ACL** | v1.0 | Access control per inference endpoint |
| **Audit log** | v1.0 | Model deployment audit trail for compliance — who deployed which model version, when, on what hardware |
| **Notification system** | v1.0 | GPU utilization alerts, inference health alerts |
| **Container support** (Docker/Podman) | v1.1 | GPU inference via NVIDIA Container Toolkit — no hypervisor needed |
| **Apptainer** | v1.1 | HPC/research container runtime — the standard in academic ML |

### Smart Bridges — AI-Operated Bridge Automation

The bridge is the most underappreciated primitive for AI inference. **Smart Bridges** (included in Team and Fabrick base pricing — no add-on required) turns the bridge into an AI-operated inference load balancer. On a single Weaver host:

- Multiple inference VMs serve the same model behind one bridge
- Bridge active routing (v1.4) distributes requests by weight across endpoints
- Smart Bridges reads inference latency/throughput and adjusts weights automatically
- Blue/green model updates: clone VM with new model → shift bridge weight gradually → confirm or rollback

This is what NGINX, HAProxy, or a K8s ingress controller does — except the bridge is already deployed from v1.0. No additional infrastructure. No separate load balancer nodes. No separate AI extension purchase.

**Sales line:** *"We didn't add a load balancer. We realized the bridge already was one. Smart Bridges makes it self-driving."*

### Three-Path Workload Model (Decision #113)

Not every GPU workload needs the same isolation. Weaver offers three paths — the bridge routes to all of them identically:

| Path | Runtime | GPU Method | Isolation | When to Use |
|------|---------|-----------|-----------|-------------|
| **GPU VM** | QEMU / cloud-hypervisor | VFIO-PCI passthrough | Hardware | Regulated data, compliance required, audit trail needed |
| **GPU Container** | Podman + vendor toolkit | NVIDIA Container Toolkit / ROCm / oneAPI | Namespace | Fast iteration, ML engineer workflow, no compliance gate |
| **CPU-only VM** | Firecracker | N/A | Hardware | Quantized models (GGUF), lightweight inference (llama.cpp, Ollama CPU) |

**Vendor-agnostic by design:** VFIO-PCI is a hypervisor-level mechanism — any PCIe GPU works. NVIDIA, AMD, Intel. Same dashboard, same bridge routing, same blue/green deployment. No vendor lock-in at the infrastructure layer. GPU inventory (v1.2) detects vendor, model, VRAM, driver version, and temperature regardless of manufacturer.

**The Podman angle:** Podman is the default container runtime on NixOS. Rootless Podman + GPU = security posture without a privileged daemon. This is consistent with Weaver's positioning as the dashboard Podman never shipped (Decision #54). ML engineers who already use Docker get the same workflow with better security defaults.

**Shed UX (v2.0+):** The "Create inference workload" flow in Shed (Decision #92) surfaces this choice naturally — hardware-isolated VM (compliance) vs container (speed) vs CPU-only (lightweight). Template catalog tags templates by GPU vendor and isolation level.

**Sales line:** *"Weaver manages your GPUs regardless of vendor. NVIDIA, AMD, Intel — same dashboard, same bridge routing, same blue/green deployment. No vendor lock-in at the infrastructure layer."*

### The Self-Hoster Entry Point — Weaver Free ($0)

81% of self-hosters work in tech professionally. Many already run Ollama, vLLM, or llama.cpp on their home servers. They are the AI inference audience before any enterprise pitch:

- **Weaver Free** gives them visibility into what's running — containers, VMs, GPU utilization — at zero cost
- They evaluate locally, discover the AI diagnostics (BYOK), see bridge topology, and hit the Live Provisioning upgrade trigger
- At work, the same person champions Weaver for their team's inference infrastructure
- The sysop-as-champion motion applies directly: $0 home eval → $249/yr personal → $10,000/yr Fabrick fabrick = **40x ROI on acquisition cost**

This is not a separate market from enterprise AI inference — it's the same people wearing different hats.

### Weaver Solo for AI — $249/yr

The single-operator AI inference setup:

- GPU passthrough with VFIO-PCI isolation
- AI VM templates (CUDA/ROCm/Ollama/vLLM)
- Bridge-based inference load balancing
- AI-assisted blue/green model deployment (v1.4)
- NixOS reproducibility — flake-locked inference environments
- Also serves traditional GPU workloads: HPC simulation, 3D rendering, VDI, video transcoding
- $249/yr vs RunPod at $0.74/hr/H100 ($6,482/yr for one GPU)

### Weaver Team for AI — $199/user/yr ($129/user/yr FM)

When the ML team needs collaboration:

- **Smart Bridges (Weaver AI)** — AI-operated bridge automation included in Team base price. The AI agent reads inference latency/throughput and adjusts bridge weights automatically, manages blue/green rollouts, and triggers health-check-based failover
- Team approval workflows for model deployment (blue/green shift requires approval)
- Shared visibility of in-flight deployments across team members
- Zero-downtime host maintenance — bridge shifts traffic to standby while host rebuilds (Decision #111 Path B)
- Natural upgrade trigger: Solo user hits the "I need someone to approve this traffic shift" wall

---

## 4. Fabrick for AI Inference {#4-fabrick-for-ai-inference}

Fabrick is where the inference fleet story becomes a competitive moat.

### Fleet-Level Inference Routing

At Fabrick scale, the bridge primitive elevates to fleet-level traffic management:

- Request arrives → Fabrick routes to the least-loaded inference VM across the fleet
- Bridge weights are fleet-level, not host-level — cross-node traffic distribution
- Smart Bridges (Fabrick AI) manages fleet-wide model deployment: roll out new model version across 10 hosts with blue/green per-host, coordinated at fleet level
- Node cordon for maintenance: drain inference traffic to peer hosts, maintain, uncordon — zero model downtime

**This is the convergence:** fleet-level bridge routing IS inference fleet routing. The bridge weight API extended to cross-node endpoints IS a model serving load balancer. No separate inference gateway, no service mesh, no Envoy sidecar.

**Hub-authority state model.** Fleet bridge state uses a hub-authority model — the Fabrick hub database is the single source of truth. Each host persists last-known weights locally for disaster recovery. If the hub goes down, hosts continue serving on cached weights. When the hub recovers, it reconciles. Split-brain is avoided because the hub is the only writer.

### Snapshot-Based Model Provisioning — "Build Once, Run Many"

The killer feature for inference fleet management. Traditional model deployment: pull 140GB of weights, load into VRAM, wait 5–10 minutes. Every time. On every host.

Weaver's approach:
1. First deployment — full provision (slow, happens once)
2. Auto-snapshot — Weaver captures the running VM state after health check passes: OS, drivers, model server, model weights loaded in VRAM
3. Every subsequent deployment — restore from snapshot: **2–5 seconds** (QEMU memory snapshot) or 10–30 seconds (disk snapshot)

**Build once, run many.** Provision the model once on one host. Snapshot it. Deploy that snapshot to 10 hosts in seconds. Every instance is identical — same environment, same model, same VRAM state. NixOS reproducibility guarantees the environment; the snapshot guarantees the warm state.

**Rollback is instant.** Previous model version exists as a snapshot. Shift bridge weight back, restore the old snapshot. The rollback path is faster than the deploy path on any competing platform.

**Auto-scaling becomes viable for large models.** Without snapshots, auto-scaling a 70B model means a 5-minute cold start — useless for traffic spikes. With memory snapshots, a new inference VM is serving in 2–5 seconds. The set point pre-provisioning window (Decision #95) is tight enough to absorb spikes before latency degrades.

| Deploy Method | Cold Start | Model in VRAM |
|---|---|---|
| Full provision (pull weights, load model) | 3–10 min | No — loading |
| Disk snapshot restore | 10–30 sec | No — reloading from disk |
| Memory snapshot restore (QEMU) | **2–5 sec** | **Yes — already loaded** |
| K8s pod cold start (for comparison) | 1–10 min | No |

**Model source is the user's problem.** Weaver doesn't store 140GB model files. The user provides a source reference (HuggingFace ID, S3 URI, local path). Weaver pulls it once, builds the VM, snapshots the result. After that, the snapshot IS the deployment artifact.

**Fleet snapshot distribution (Fabrick v3.0):** the hub knows which hosts have which snapshots. Fleet scheduling prefers hosts with cached snapshots. Proactive cache warming pushes snapshots to hosts before demand arrives.

### GPU Scheduling (v2.2+, Decision #116)

- Explicit, best-fit, or all-linked GPU assignment from Shed (v1.2)
- Reservation per workload group — guaranteed GPU allocation for your team (v2.2)
- Queue with priority — wait for GPU availability, FIFO or priority-based (v2.2)
- VRAM-aware scheduling — the scheduler knows how much VRAM each model needs
- Multi-GPU topology-aware assignment for large model inference (v2.2+)
- Fleet GPU scheduling — hub selects best host based on GPU availability + snapshot cache (v3.0)

### Set Point Auto-Scaling (v3.3, Decision #95)

AI-driven auto-scaling built for inference workloads:

- `preProvisionAt`: request latency exceeds threshold → restore inference VM from snapshot (2–5 sec)
- `implementAt`: new VM healthy → enters rotation behind the bridge
- `deprovisionAt`: sustained low latency → drain and destroy excess capacity
- Predictive mode: AI learns traffic patterns and pre-provisions before load arrives

**Why this beats K8s HPA for inference:** K8s scales reactively — cold-start a pod after the threshold hits (minutes for large models). Weaver set points + snapshot restore = warm inference VM in seconds. The pre-provision → standby gap is tight enough to absorb traffic spikes before they impact latency.

### Cloud Burst for AI/HPC (v3.0+, Decision #66)

Hybrid on-premise + cloud GPU nodes:

- Persistent on-prem inference fleet + ephemeral cloud GPU burst when saturated
- Fabrick manages both as one fleet — same bridge routing, same weights, same AI management
- Per-node-day consumption billing for burst nodes (not annual per-node)
- Regulated industries get MicroVM hardware isolation on cloud GPUs — compliance that containers cannot provide

### Edge AI Fleet (v3.0+)

The positioning nobody else occupies:

- Small NixOS devices at the edge running lightweight inference models, managed centrally by Fabrick
- Retail stores running product recognition
- Factory floors running defect detection
- Branch offices running local LLM inference (privacy-sensitive data stays on-premise)
- Central model push to edge devices, version management via blue/green, telemetry aggregation

**Edge AI market:** $50B+ projected by 2028. Nobody in the "AI data center" space thinks about distributed edge inference managed by a lightweight NixOS-native control plane. The big players all assume centralized GPU clusters.

### Fabrick Pricing for AI

| Tier | Price | AI Inference Use Case | Available |
|------|:-----:|----------------------|:---------:|
| **Fabrick 256GB** | $2,000/yr first node, $1,250/yr (2–4), $1,000/yr (5–9), $750/yr (10+) | Standard inference fleet — most models fit in 256GB. Smart Bridges (Fabrick AI) included | v2.3 |
| **Fabrick 512GB** | $2,500/yr/node | Large model inference (70B+ params), multi-GPU nodes. Smart Bridges (Fabrick AI) included | v2.3 |
| **Contract 512GB+** | Sliding scale | AI/HPC burst nodes, 8×H100 configurations (1-2TB RAM) | v3.0 |

**vs cloud inference cost:** A single H100 on RunPod costs $0.74/hr = $6,482/yr. Fabrick at $2,000/yr manages the entire fleet of GPUs you already own. The hardware is CapEx you've already spent. Fabrick is the management layer that makes it useful.

---

## 5. Deficiency Remediation Plan {#5-deficiency-remediation-plan}

Features not yet available, with version targets and interim positioning:

| Gap | Version Target | Interim Approach | Impact |
|-----|:--------------:|-----------------|--------|
| GPU passthrough UI | v1.2 | Manual VFIO-PCI config (NixOS native) | Low — NixOS GPU passthrough works today; UI is convenience |
| AI VM templates | v2.0 | Manual NixOS flake for inference environments | Medium — reproducibility exists, templates add speed |
| GPU scheduling | v2.2 | Manual GPU assignment per VM | Medium — works for small teams, doesn't scale |
| Inference metrics (tokens/sec, latency) | v2.1+ | External monitoring (Prometheus/Grafana) | Low — standard tooling works; integrated metrics are convenience |
| Fleet inference routing | v3.0 | Single-host bridge routing (v1.4) | High for fleet buyers — single-host story is complete; fleet is the gap |
| Edge AI management | v3.0 | Manual per-host Weaver | High for edge buyers — central management is the value |
| Cloud burst (GPU) | v3.0 | On-prem only | Medium — most early buyers are on-prem first |

**Positioning for v1.0–v1.4 sales conversations:** Weaver delivers GPU passthrough, reproducible ML environments, and bridge-based inference load balancing on a single host today. For fleet inference, customers start with Weaver Solo/Team on each host and upgrade to Fabrick when fleet coordination ships at v3.0. The single-host story is complete and competitive; fleet is the growth path.

---

## 6. AI Inference-Specific Competitive Advantages {#6-competitive-advantages}

### vs Cloud AI Platforms (RunPod, Lambda, CoreWeave)

| Dimension | Cloud AI | Weaver/Fabrick |
|-----------|----------|----------------|
| **Data sovereignty** | Their servers | Your hardware |
| **Cost at scale** | Per-hour GPU rental ($6,482/yr per H100) | CapEx hardware + $249–2,000/yr software |
| **Environment reproducibility** | Docker layers (drift-prone) | NixOS flake (bit-for-bit identical) |
| **Edge inference** | Not offered | v3.0 Fabrick edge fleet |
| **GPU vendor support** | NVIDIA only (most platforms) | NVIDIA, AMD, Intel — any PCIe GPU via VFIO-PCI |
| **Vendor lock-in** | High (proprietary APIs) | Zero (NixOS, open formats, standard VFIO, multi-vendor GPU) |
| **Compliance** | Shared responsibility model | Full control, hardware isolation |
| **Model deployment speed** | Minutes (pull weights, load model, every time) | 2–5 seconds (snapshot restore, model in VRAM) |
| **Model rollout** | Manual or custom CI/CD | Bridge blue/green with AI health check |
| **Rollback** | Redeploy previous version (minutes) | Restore previous snapshot (seconds) |

**Pitch:** *"RunPod for your own hardware. Keep your data, keep your GPUs, pay once."*

### vs Proxmox (with manual GPU passthrough)

| Dimension | Proxmox | Weaver |
|-----------|---------|--------|
| **GPU passthrough** | Manual VFIO config, no management UI | GPU inventory (NVIDIA/AMD/Intel), allocation, health monitoring |
| **GPU vendors** | NVIDIA only (community scripts for AMD) | NVIDIA, AMD, Intel — vendor-agnostic VFIO-PCI |
| **ML templates** | None | Curated NixOS AI templates — CUDA, ROCm, oneAPI, Ollama, vLLM |
| **Reproducibility** | None (Debian-based, config drift) | NixOS flake-locked environments |
| **Inference load balancing** | None | Bridge active routing with AI-managed weights |
| **Model deployment speed** | Minutes (manual VFIO + manual model load) | 2–5 sec snapshot restore |
| **Model deployment** | Manual | Blue/green with health check and instant snapshot rollback |
| **Edge** | None | Fabrick edge fleet (v3.0) |

**Pitch:** *"Proxmox can pass through a GPU. We manage your AI fleet."*

### vs Kubernetes + GPU Operator

| Dimension | K8s + GPU Operator | Weaver/Fabrick |
|-----------|-------------------|----------------|
| **Complexity** | High (K8s + Helm + Operator + device plugin + CNI + ingress) | Low (VM + GPU passthrough + bridge) |
| **GPU isolation** | Shared (MIG/MPS) or exclusive per pod | Exclusive per VM (VFIO hardware boundary) or per container (vendor toolkit) — user chooses |
| **GPU vendors** | NVIDIA-first (AMD GPU Operator experimental) | NVIDIA, AMD, Intel equally supported via VFIO-PCI |
| **Load balancing** | Separate ingress controller + MetalLB | Bridge (already deployed, v1.0) |
| **Blue/green** | Argo Rollouts or Spinnaker (separate install) | Built-in bridge weight shifting |
| **Environment reproducibility** | Container layers (drift-prone) | NixOS flake (bit-for-bit) |
| **Model deploy / rollback speed** | Minutes (cold-start pod, pull weights) | 2–5 sec snapshot restore / instant rollback |
| **Auto-scaling for large models** | Minutes cold-start (HPA reactive) | Seconds (snapshot + set point pre-provisioning) |
| **Platform team required** | Yes ($150K+/yr) | No |
| **Edge** | K3s (still complex) | NixOS-native (Fabrick edge fleet) |

**Pitch:** *"AI infrastructure without the Kubernetes tax. Three K8s components — CNI, ingress controller, and Argo Rollouts — collapse into one bridge."*

### The Bridge Convergence (unique to Weaver)

In Kubernetes, inference traffic routing requires maintaining:
1. **CNI plugin** (network switching) — separate install, separate config
2. **Ingress controller + MetalLB** (load balancing) — separate install, separate upgrade cycle
3. **Argo Rollouts / Spinnaker** (blue/green deployment control) — separate install, separate failure mode

In Weaver, the bridge does all three. Already deployed from v1.0. No additional nodes, no additional software. Active routing (Decision #112) adds one capability and collapses the entire stack.

At Fabrick scale, the bridge elevates to fleet-level inference routing — cross-node traffic distribution managed by Smart Bridges (Fabrick AI, included in base price). This is a model serving load balancer without the load balancer.

### Project Glasswing: Why AI Infrastructure Is Now a Priority Target

In April 2026, Anthropic launched **Project Glasswing** — a coalition with AWS, Google, Microsoft, NVIDIA, CrowdStrike, and 40+ organizations using AI to discover thousands of zero-day vulnerabilities, including kernel-level bugs that survived decades of human review. The implication for AI infrastructure is acute: inference workloads are high-value targets, and the vulnerability discovery rate just jumped by orders of magnitude.

**AI inference workloads are uniquely sensitive.** A GPU host running shared-kernel containers (Docker, Podman, K8s pods) for inference handles:

- **Model weights** — proprietary IP worth millions in training compute
- **Customer prompts** — may contain PII, ePHI, CUI, or privileged business data
- **Generated content** — inference outputs that are themselves regulated in healthcare, legal, and defense contexts
- **API keys and credentials** — access tokens to upstream model providers, databases, and internal services

A kernel zero-day on a shared GPU host exposes all of it — every tenant's prompts, every model's weights, every credential in memory. Before Glasswing, this was a theoretical concern. Now it's an empirical one: AI is discovering the exploits that make it real.

**Weaver's hardware isolation per inference workload:**

- Each inference VM runs its own kernel. A compromised model-serving container doesn't see other tenants' prompts, weights, or credentials.
- GPU passthrough via VFIO-PCI means the GPU is exclusively assigned — no shared GPU memory between workloads. MIG/MPS sharing on K8s means GPU memory is a shared attack surface.
- Five hypervisors provide defense in depth. A hypervisor-specific exploit affects workloads on that hypervisor — not the entire inference fleet. K8s runs containerd everywhere, offering zero runtime diversity.

**The 90-day disclosure cycle and inference SLAs.** Glasswing operates on a 90-day public disclosure window. For inference infrastructure, this means: every 90 days, newly discovered kernel and runtime vulnerabilities become public knowledge — and potential exploit vectors. NixOS declarative patching applies fixes fleet-wide in one atomic operation. K8s requires rolling node updates with pod evictions, scheduler coordination, and GPU workload rescheduling — all while maintaining inference SLAs. The patch velocity gap between "one `colmena apply`" and "rolling K8s node drain across a GPU fleet" is measured in days, not hours.

**For multi-tenant inference (Fabrick).** Organizations running inference for multiple internal teams or external customers face the sharpest version of this risk. Shared-kernel multi-tenant inference means one tenant's kernel exploit exposes every other tenant's data. Weaver's Workload Groups (v3.3) provide hardware-isolated tenant boundaries — each group runs in its own set of MicroVMs, on its own kernels, with its own bridge. Tenant isolation is a hypervisor boundary, not a namespace policy.

**Sales line:** *"Your inference workloads handle the most sensitive data in your organization — model IP, customer prompts, regulated outputs. Glasswing just proved that shared-kernel isolation can't protect them. Hardware isolation per workload isn't a luxury — it's the minimum."*

---

## 7. Objection Handling {#7-objection-handling}

### "We already use Kubernetes for ML — why switch?"

You don't switch. Weaver runs alongside K8s. But consider: your GPU Operator + device plugin + Helm chart + ArgoCD pipeline costs a platform engineer ($150K+/yr) and still doesn't give you hardware-isolated inference VMs. Weaver does, for $249/yr, with the same blue/green rollout pattern you already understand — just without the cluster.

### "Firecracker doesn't support GPU passthrough"

Correct. GPU workloads use QEMU/cloud-hypervisor MicroVMs (which support VFIO-PCI), or run as containers with the NVIDIA Container Toolkit. Weaver manages all five hypervisors and both container runtimes from one pane. The right workload type is chosen per use case — Firecracker for CPU inference (fast boot, low overhead), QEMU for GPU inference (VFIO passthrough).

### "NixOS isn't proven for ML workloads"

NixOS roots go back to 2003 and it's been shipping stable releases for 12 years — this isn't experimental infrastructure. It also has the most complete CUDA packaging of any Linux distribution. `nixpkgs` maintains CUDA 11.x and 12.x, cuDNN, TensorRT, PyTorch, JAX, and the full ML stack — all pinned by flake.lock. The reproducibility guarantee is stronger than any container image: if it builds, it's identical everywhere, forever. No "works on my machine."

### "RunPod/Lambda is cheaper for burst GPU"

For burst, yes. For steady-state inference on hardware you already own, Weaver is 10–25x cheaper. Most organizations have GPUs sitting in servers that are underutilized because there's no management layer. Weaver unlocks the GPUs you already paid for. Cloud burst (Fabrick v3.0) handles the overflow.

### "We need multi-GPU for large models"

VFIO can pass through multiple GPUs to a single VM. NVLink topology awareness is a Stage 2 feature (not yet in the roadmap). For most inference workloads (up to 70B parameters with quantization), single-GPU with sufficient VRAM is adequate. Multi-GPU inference at scale (175B+ unquantized) is a Fabrick v3.0+ feature.

### "What about training workloads?"

Weaver targets inference, not training. Training wants bare-metal GPU access — every virtualization layer costs throughput. Multi-GPU training across VMs adds coordination overhead that Slurm/K8s handle natively. Weaver complements training infrastructure: Slurm dispatches training jobs on bare metal; Weaver manages the inference fleet that serves the trained models. Same hardware, different management layers.

### "We're a small team — do we need Fabrick?"

No. Weaver Solo ($249/yr) gives one ML engineer GPU passthrough, reproducible environments, bridge-based load balancing, and AI-assisted blue/green deployment. Upgrade to Team ($199/user/yr) when you need approval workflows for model rollouts. Upgrade to Fabrick when you have multiple hosts.

---

## 8. Buyer Personas {#8-buyer-personas}

### Persona 1: ML Engineer / Data Scientist

**Role:** Builds and deploys models. Fights environment issues daily.
**Pain:** "It works on my laptop but not in production." CUDA version hell. No easy way to roll back a bad model.
**Trigger:** Discovers NixOS reproducibility via Weaver template — deploys a model that's identical on every host, forever.
**Entry:** Weaver Solo ($249/yr) or Free (BYOK AI diagnostics). Smart Bridges included in Team upgrade.
**Upsell:** Team (approval workflows), then Fabrick (fleet inference).

### Persona 2: ML Platform Engineer

**Role:** Maintains the infrastructure that ML teams deploy to. Currently running K8s + GPU Operator.
**Pain:** GPU Operator version conflicts. ArgoCD pipelines that break on Helm chart updates. Platform team burnout.
**Trigger:** "Three K8s components collapse into one bridge" — immediate operational simplification.
**Entry:** Weaver Solo (evaluate on one host), then Fabrick (replace the cluster).
**Upsell:** Success Programs (Adopt → Accelerate → Partner).

### Persona 3: Research Computing Director

**Role:** Manages shared GPU infrastructure for university labs or R&D teams.
**Pain:** GPU allocation disputes. Unreproducible experiments. Per-grant compliance (NIH DMS, NIST 800-171).
**Trigger:** GPU quotas + NixOS flake-per-experiment + Apptainer support + compliance audit trail.
**Entry:** Weaver (per-host GPU management), then Fabrick (multi-host GPU fleet).
**Upsell:** Compliance Export Extension ($4,000/yr) for grant compliance evidence.

### Persona 4: IT Director (Regulated Industry)

**Role:** Oversees infrastructure for healthcare, defense, financial services, or pharma org running AI inference.
**Pain:** "Our models touch ePHI/CUI/PII — cloud AI is off the table. K8s namespace isolation isn't enough for our auditors."
**Trigger:** MicroVM hardware isolation for inference workloads + compliance-by-construction audit trail.
**Entry:** Fabrick (fleet management + compliance).
**Upsell:** Compliance Export Extension + Success Programs.

### Persona 5: Edge AI Deployer

**Role:** Deploys inference models to retail stores, factory floors, or branch offices.
**Pain:** Managing 50+ edge devices running inference models with no centralized control. Model updates are manual SSH sessions.
**Trigger:** Fabrick edge fleet + central model push + blue/green rollout to edge nodes.
**Entry:** Fabrick (fleet is the minimum for edge).
**Upsell:** Cloud burst for overflow when edge capacity is exhausted.

---

## 9. Success Programs {#9-success-programs}

AI inference deployments benefit from structured onboarding and ongoing optimization. Success Programs provide hands-on expertise for GPU fleet management, model deployment workflows, and NixOS reproducibility practices.

| Program | FM Price | Standard Price | AI Inference Focus |
|---------|:--------:|:--------------:|-------------------|
| **Community** | $0 | $0 | Community forum, documentation, best-effort support |
| **Adopt** | $5,000/yr | $15,000/yr | GPU passthrough setup, VFIO-PCI configuration, first AI VM template deployment, bridge routing for inference endpoints |
| **Accelerate** | $15,000/yr | $45,000/yr | Quarterly GPU fleet architecture reviews, model deployment workflow optimization, inference metrics tuning, blue/green rollout planning |
| **Partner** | $30,000/yr | $90,000/yr | Named engineer for GPU fleet architecture, multi-vendor GPU strategy (NVIDIA/AMD/Intel), snapshot provisioning optimization, edge AI fleet planning |

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = **$9,000/yr** total compliance coverage for regulated AI inference (HIPAA, CMMC, 21 CFR Part 11). Standard Adopt — Compliance ($25,000/yr) includes hands-on framework mapping sessions and evidence walkthroughs.

---

## 10. Discovery Questions {#10-discovery-questions}

### Environment & Reproducibility

1. How do you ensure your inference environments are identical across development, staging, and production?
2. When a model fails in production, how long does it take to reproduce the environment locally?
3. How often do CUDA or driver version mismatches cause deployment failures?
4. Do you pin your ML dependencies, or does `pip install` pull latest?

### GPU Management

5. How many GPUs do you have, and what percentage are actively serving inference?
6. How do you allocate GPUs across teams or projects? Is there a queue or is it first-come?
7. What happens when a GPU inference server crashes at 2 AM?
8. How do you track which model version is running on which GPU?

### Model Deployment

9. What does your model deployment process look like today? How long from "model trained" to "model serving in production"?
10. Do you have zero-downtime model updates, or do you accept downtime during rollouts?
11. When a new model version performs worse than expected, how quickly can you roll back?
12. Who approves model deployments to production? Is there an approval workflow?

### Compliance & Audit

13. Do your inference workloads handle regulated data (ePHI, CUI, PII, financial data)?
14. Can you demonstrate to an auditor exactly what software stack was running when a specific inference request was processed?
15. How do you produce evidence for grant compliance (NIH DMS, NSF DMP) or regulatory audits?

### Infrastructure & Scale

16. Are you running inference on-premise, in the cloud, or hybrid?
17. Do you have edge locations that need local inference (stores, factories, branch offices)?
18. What would happen to your inference capacity if you could spin up a new GPU-attached VM in under 10 seconds?
19. How much does your current inference infrastructure cost annually (cloud compute + platform engineering + tooling)?

---

*Cross-reference: [IT-FOCUS-VALUE-PROPOSITION.md](IT-FOCUS-VALUE-PROPOSITION.md) | [WEAVER-VALUE-PROPOSITION.md](../marketing/WEAVER-VALUE-PROPOSITION.md) | [FABRICK-VALUE-PROPOSITION.md](../marketing/FABRICK-VALUE-PROPOSITION.md) | [research-hpc.md](verticals/research-hpc.md) | [ai-infrastructure-vertical.md](../../research/ai-infrastructure-vertical.md) | [FABRICK-CLOUD-BURST.md](../product/FABRICK-CLOUD-BURST.md)*
