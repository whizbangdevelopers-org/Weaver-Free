<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# AI Infrastructure Vertical — Research

**Date:** 2026-03-06
**Status:** Superseded — findings promoted to [AI-INFERENCE-VALUE-PROPOSITION.md](../business/sales/AI-INFERENCE-VALUE-PROPOSITION.md) on 2026-03-28. This doc uses old "MVD" branding and pre-dates Decisions #113–#119 (multi-vendor GPU, fleet bridge, GPU scheduling, inference metrics, model deployment workflow, snapshot provisioning). Retained as historical research source only — do not use for current sales positioning.

---

## Thesis

Weaver can serve the AI inference infrastructure market as a vertical application of the existing product. The core roadmap already delivers most required capabilities; the vertical adds domain-specific packaging, templates, monitoring, and sales positioning. The NixOS reproducibility story is a genuine differentiator that no competitor offers.

**Not a pivot.** This is a lens on the existing roadmap that creates premium/enterprise sales narratives and opens a high-value market segment.

---

## Scope: Inference Yes, Training No

### Where Weaver fits — AI inference fleet

- MicroVMs boot in seconds — fast scale-up for inference serving
- GPU passthrough (VFIO-PCI) is proven in QEMU/KVM — one GPU per VM isolation
- NixOS reproducibility solves a real ML pain point: "works on my machine" for model environments
- Live Provisioning = spin up inference VMs on demand without host rebuilds
- Fleet management across hosts (v2.2+ clustering) = inference node orchestration

### Where Weaver does NOT fit — training

- Training wants bare-metal GPU access — every virtualization layer costs throughput
- Multi-GPU training across VMs adds coordination overhead that Slurm/K8s handle natively
- Training VMs need 256GB+ RAM — the VM overhead tax matters at that scale
- This market is dominated by RunPod, Lambda, CoreWeave with custom silicon and NVLink fabric
- **Decision:** Do not target training workloads. Position Weaver for inference/serving only.

### The compelling angle — edge AI inference (v3.0)

The unique positioning nobody else occupies:
- Small NixOS devices at the edge running lightweight inference models, managed centrally by Weaver
- Retail stores running product recognition
- Factory floors running defect detection
- Branch offices running local LLM inference (privacy-sensitive data stays on-premise)

Nobody in the "AI data center" space thinks about distributed edge inference managed by a lightweight NixOS-native control plane. The big players all assume centralized GPU clusters.

---

## Market Landscape

### The Gap

| Player | Self-Hosted | Edge | AI-Aware | NixOS | GPU Management | Lightweight |
|--------|:-----------:|:----:|:--------:|:-----:|:--------------:|:-----------:|
| RunPod | No | No | Yes | No | Yes | No |
| Lambda | No | No | Yes | No | Yes | No |
| CoreWeave | No | No | Yes | No | Yes | No |
| Proxmox | Yes | No | No | No | Manual passthrough | No |
| Harvester | Yes | No | No | No | Via K8s GPU Operator | No |
| Incus | Yes | No | No | No | Basic | Yes |
| **Weaver** | **Yes** | **v3.0** | **Extension** | **Yes** | **v1.2.0+** | **Yes** |

**The white space:** Self-hosted, AI-aware, lightweight, with edge capability. Nobody occupies this.

### Target Segments

**Segment 1: Privacy-first inference (near-term, v1.2+)**
- Companies that can't send data to cloud AI (healthcare, legal, finance, defense)
- Need: on-premise inference VMs with GPU isolation, audit trail, reproducible environments
- Size: Growing rapidly post-GDPR/HIPAA enforcement tightening
- Weaver value: Self-hosted, per-VM ACL (enterprise), audit log, NixOS reproducibility

**Segment 2: Edge AI fleet (mid-term, v3.0)**
- Retail, manufacturing, logistics running inference at branch/factory/warehouse
- Need: central management of distributed inference nodes, model versioning, telemetry
- Size: Edge AI market projected $50B+ by 2028
- Weaver value: microvm-anywhere, central fleet management, NixOS identical deployments

**Segment 3: AI lab / research cluster (mid-term, v2.2+)**
- University labs, R&D teams running shared GPU infrastructure
- Need: GPU scheduling, environment reproducibility, per-user quotas, experiment tracking
- Size: Niche but high per-seat value
- Weaver value: Resource quotas, NixOS flake-per-experiment, multi-node clustering

**Segment 4: Hybrid inference (long-term, v3.0+)**
- Burst to cloud when on-premise GPUs saturated, route back when available
- Need: Unified management of on-premise + cloud inference endpoints
- Size: Enterprise-only, high contract value
- Weaver value: Multi-node with cloud agents, health-based routing

---

## Feature Mapping

### Already Planned (just needs AI vertical framing)

| Existing Feature | Version | AI Vertical Application |
|-----------------|---------|------------------------|
| GPU passthrough (VFIO-PCI) | v1.2.0 | GPU-per-VM isolation for inference workloads |
| Live Provisioning | v1.1.0 | Spin up inference VMs on demand, no host rebuilds |
| System templates + cloud-init | v2.0.0 | Pre-built CUDA/ROCm/Ollama NixOS templates |
| Agent extraction + multi-node | v2.0–2.2 | Inference node fleet orchestration |
| Edge management (microvm-anywhere) | v3.0 | Edge inference at branch/factory/retail |
| Resource quotas | v1.0 (done) | GPU allocation quotas per team/user |
| Audit log | v1.0 (done) | Model deployment audit trail for compliance |
| Per-VM ACL | v1.0 (done) | GPU resource access control |
| Notification system | v1.0 (done) | GPU utilization alerts, inference health alerts |
| Import/export | v1.4–1.5 | ML environment config portability |

### New for AI Vertical (extension additions)

| Feature | Tier | Earliest Version | Description |
|---------|------|-----------------|-------------|
| GPU inventory dashboard | Enterprise | v1.2.0 | VRAM utilization, GPU temp, driver version, allocation map per host |
| AI VM templates (NixOS) | Premium | v2.0.0 | Curated: CUDA 12.x + PyTorch, ROCm + JAX, Ollama, vLLM, TGI, triton-inference-server |
| GPU scheduling | Enterprise | v2.2.0 | Time-slice or exclusive GPU assignment, queue for GPU access |
| Model deployment workflow | Enterprise extension | v2.1.0+ | Select model → provision VM → attach GPU → inject config → health check → serve endpoint |
| Inference health metrics | Enterprise extension | v2.1.0+ | Request latency, throughput, tokens/sec, model version, VRAM usage, auto-restart on OOM |
| Edge inference fleet | Enterprise extension | v3.0 | Central model push to edge devices, version management, A/B rollout, telemetry aggregation |
| Experiment tracking integration | Enterprise extension | v3.0+ | MLflow/W&B webhook integration for deployment events |

### NixOS Reproducibility Advantage

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
1. Select AI template from catalog
2. Customize (model, GPU count, memory)
3. Provision → identical environment on any NixOS host
4. Clone to 10 edge nodes → bit-for-bit identical inference stack

No other VM management tool offers this. Proxmox users manually install CUDA. K8s users fight with GPU operator versions. NixOS users get reproducibility for free — Weaver makes it point-and-click.

---

## Competitive Positioning

### vs. Cloud AI Platforms (RunPod, Lambda, CoreWeave)

| Dimension | Cloud AI | Weaver |
|-----------|----------|-----|
| Data sovereignty | Their servers | Your hardware |
| Cost at scale | Per-hour GPU rental (expensive) | CapEx hardware, free/premium software |
| Edge inference | Not offered | v3.0 microvm-anywhere |
| Vendor lock-in | High | Zero (NixOS, open formats) |
| Compliance (HIPAA/GDPR) | Shared responsibility | Full control |

**Pitch:** "RunPod for your own hardware. Keep your data, keep your GPUs, pay once."

### vs. Proxmox (with manual GPU passthrough)

| Dimension | Proxmox | Weaver |
|-----------|---------|-----|
| GPU passthrough | Manual VFIO config, no management UI | GPU inventory, allocation, health monitoring |
| ML templates | None | Curated NixOS AI templates |
| Reproducibility | None (Debian-based, config drift) | NixOS flake-locked environments |
| Inference monitoring | None | Latency, throughput, VRAM, auto-restart |
| Edge | None | microvm-anywhere |

**Pitch:** "Proxmox can pass through a GPU. We manage your AI fleet."

### vs. Kubernetes + GPU Operator

| Dimension | K8s + GPU Operator | Weaver |
|-----------|-------------------|-----|
| Complexity | High (K8s + Helm + Operator + device plugin) | Low (VM + GPU passthrough) |
| GPU isolation | Shared (MIG/MPS) or exclusive | Exclusive per-VM (clean VFIO) |
| Environment reproducibility | Container layers (drift-prone) | NixOS flake (bit-for-bit) |
| Operational overhead | Cluster management, etcd, networking | Single binary + NixOS |
| Edge | K3s (still complex) | microvm-anywhere (NixOS native) |

**Pitch:** "AI infrastructure without the Kubernetes tax."

---

## Revenue Model

### Extension Pricing (AI Infrastructure Extension)

Following the existing extension model (à la carte at tier minimums):

| Component | Tier Minimum | Pricing Signal |
|-----------|-------------|---------------|
| GPU inventory + monitoring | Enterprise | Included in Enterprise base |
| AI VM templates | Premium | Included in template catalog |
| GPU scheduling | Enterprise | Included in Enterprise base |
| Model deployment workflow | Enterprise extension | Add-on (~$X/host/month or perpetual) |
| Inference health metrics | Enterprise extension | Bundled with deployment workflow |
| Edge inference fleet | Enterprise extension | Add-on (~$X/edge-node/month) |

**Enterprise already includes all extensions** — so the AI vertical strengthens the Enterprise value proposition without fragmenting pricing.

### Revenue Impact

- **Premium conversion hook:** AI VM templates make Premium more attractive to ML teams
- **Enterprise justification:** GPU scheduling + deployment workflow + audit = Enterprise must-have for any AI team
- **Edge upsell:** Per-edge-node pricing creates recurring revenue that scales with deployment
- **Competitive pricing:** Undercut cloud AI platforms on TCO while offering features Proxmox can't match

---

## Validation Steps (Before Promoting to business/)

1. **Community signal:** Monitor r/selfhosted, r/homelab, r/LocalLLaMA for "self-hosted inference management" requests
2. **NixOS + ML overlap:** Check NixOS Discourse / nixpkgs ML packages activity — is there a community building ML on NixOS?
3. **GPU passthrough demand in Weaver context:** After v1.2.0 ships GPU passthrough, track feature usage and support requests
4. **Edge AI buyer interviews:** When v3.0 planning starts, include edge AI use cases in user research
5. **Template demand:** After v2.0.0 ships templating, publish AI templates and measure adoption

**Promote to business/ when:** At least 2 validation signals confirm demand. Then create `business/AI-VERTICAL-STRATEGY.md` with pricing, GTM, and partnership plan.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI hype cools, demand shrinks | Low-medium | Medium | Core product unaffected — AI features are extensions, not core |
| NVIDIA licensing restricts VM GPU passthrough | Low | High | AMD ROCm as fallback, document supported configs |
| Cloud AI becomes too cheap to compete on cost | Medium | Medium | Privacy/sovereignty angle still holds; edge still unique |
| K8s GPU Operator becomes simple enough | Low | Medium | NixOS reproducibility still wins; simplicity still wins |
| NixOS ML ecosystem too immature | Medium | Medium | Contribute upstream (nixpkgs CUDA packages); ship templates that handle the hard parts |

**Overall risk:** Low. The AI vertical is additive — if the market doesn't materialize, we've built GPU passthrough (useful anyway) and templates (useful anyway). No wasted roadmap effort.

---

## Timeline Alignment

```
v1.0.0  ─── ship ─── (AI vertical: nothing needed yet)
v1.1.0  ─── Live Provisioning ─── (AI: on-demand inference VM spin-up)
v1.2.0  ─── GPU passthrough ─── (AI: GPU inventory, first vertical features)
         └── Validate: is there demand? Community signal check
v2.0.0  ─── Templates + cloud-init ─── (AI: curated ML templates)
         └── Publish AI templates, measure adoption
v2.1.0  ─── Snapshots + cloning ─── (AI: model deployment workflow, inference metrics)
         └── If validated: promote to business/, create AI-VERTICAL-STRATEGY.md
v2.2.0  ─── Clustering ─── (AI: GPU scheduling, multi-node inference)
v3.0.0  ─── Edge + HA ─── (AI: edge inference fleet, hybrid inference)
         └── Full AI vertical realized
```

---

*Cross-reference: [MASTER-PLAN.md](../MASTER-PLAN.md) | [FABRICK-VALUE-PROPOSITION.md](../business/marketing/FABRICK-VALUE-PROPOSITION.md) | [WEAVER-VALUE-PROPOSITION.md](../business/marketing/WEAVER-VALUE-PROPOSITION.md) | [competitive-landscape.md](competitive-landscape.md) | [LOAD-TESTING-PLAN.md](../plans/cross-version/LOAD-TESTING-PLAN.md)*
