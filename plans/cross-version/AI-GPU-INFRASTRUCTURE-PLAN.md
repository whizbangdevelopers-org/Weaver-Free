<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# AI & GPU Infrastructure Integration Plan
## Non-NixOS Open-Source Tools That Create Competitive Moat

**Date:** 2026-04-01
**Type:** Cross-version feature plan
**Parent:** [MASTER-PLAN.md](../../MASTER-PLAN.md)

---

## Overview

This plan covers AI and GPU infrastructure integrations using non-NixOS open-source tools and standards. Where the [Nix Ecosystem Integration Plan](NIX-ECOSYSTEM-INTEGRATION-PLAN.md) leverages NixOS-specific packages, this plan targets vendor-neutral GPU management, inference engine integration, and model deployment tooling that competitors *could* integrate but haven't — or integrate only shallowly.

Weaver's moat is unified management across GPU vendors (NVIDIA, AMD, Intel), inference engines (Ollama, vLLM, TGI), and workload types (MicroVM + container + CPU-only) — all behind one bridge, one scheduling API, one audit trail. No competitor manages all three GPU vendors in a single pane. No competitor offers VM + container + GPU scheduling in one product. No competitor collapses CNI + ingress + blue/green into a bridge primitive that also serves as an inference load balancer.

---

## Integration Matrix

### Legend

- **Effort:** S (days), M (1-2 weeks), L (2-4 weeks)
- **Impact:** Revenue (drives tier upgrades), Moat (defensibility vs competitors), DX (developer/admin experience), Compliance (regulatory selling point)

---

## v1.2.0 — GPU Foundation (Weaver)

GPU hardware detection, passthrough, and container support. The foundation every later AI feature builds on. Decisions #113, #116.

### 1. Multi-Vendor GPU Inventory (lspci + vendor tools)

| Attribute | Value |
|-----------|-------|
| **Package** | `lspci` (pciutils) + `nvidia-smi` (NVIDIA) + `rocm-smi` (AMD) + `xpu-smi` (Intel) |
| **What it does** | Detects all PCIe GPUs regardless of vendor and reports model, VRAM, driver version, temperature, utilization, and inter-card links (NVLink, Infinity Fabric) |
| **Weaver use** | GPU inventory dashboard — the operator sees every GPU on the host with real-time telemetry. Detection is vendor-specific behind the scenes; the UI abstracts to a unified GPU list. Inter-card links shown as "Linked GPUs detected" with tooltip for advanced users |
| **Tier** | Weaver (visibility — same pattern as VM/container visibility) |
| **Effort** | M — backend polling service, vendor-tool abstraction layer, frontend GPU inventory page |
| **Impact** | DX + Moat — no competitor shows NVIDIA, AMD, and Intel GPUs in one unified inventory. Proxmox has no GPU management UI. K8s GPU Operator is NVIDIA-first |
| **Implementation** | Backend service polls `lspci` for GPU enumeration, then vendor-specific tools for telemetry. Configurable polling interval (default 10s). GPU data exposed via WebSocket alongside existing VM/container metrics. Frontend: GPU card on host info page showing vendor, model, VRAM usage/total, temperature, utilization |
| **Why v1.2** | Foundation for all GPU features. GPU passthrough and scheduling depend on knowing what hardware exists. Ships with the v1.2 security hardening stack — same "make the host fully managed" theme |

### 2. VFIO-PCI GPU Passthrough for MicroVMs

| Attribute | Value |
|-----------|-------|
| **Package** | VFIO-PCI (Linux kernel subsystem), QEMU / cloud-hypervisor |
| **What it does** | Passes a physical PCIe GPU directly to a VM with hardware-level isolation. The VM gets exclusive access to the GPU — no sharing, no hypervisor overhead on GPU operations |
| **Weaver use** | Hardware-isolated GPU workloads for compliance-sensitive inference, HPC, rendering, and VDI. Any PCIe GPU works regardless of vendor — VFIO is a hypervisor-level mechanism, not a vendor feature. Supports single GPU or all-linked GPUs (NVLink/Infinity Fabric group) passed as a unit |
| **Tier** | Weaver |
| **Effort** | M — IOMMU group detection, VFIO bind/unbind orchestration, Shed GPU picker UI, NixOS module for VFIO kernel params |
| **Impact** | Revenue + Compliance — hardware isolation is the compliance story for regulated AI (HIPAA, CMMC, defense). No container-based GPU solution provides equivalent isolation. Proxmox supports VFIO but with no management UI and NVIDIA-only community scripts |
| **Implementation** | Detect IOMMU groups at startup. Shed (Decision #92) GPU assignment: operator picks GPU from inventory or best-fit auto-pick (most free VRAM). All-linked option offered only when inter-card link detected. Backend binds VFIO driver, passes device to QEMU/cloud-hypervisor via LP. Unbind on workload destroy |
| **Why v1.2** | Ships alongside container GPU support — v1.2 delivers the full three-path workload model (Decision #113). GPU passthrough is the compliance path; containers are the speed path; CPU-only is the lightweight path |

### 3. Container GPU Support (Podman + Vendor Toolkits)

| Attribute | Value |
|-----------|-------|
| **Package** | [NVIDIA Container Toolkit](https://github.com/NVIDIA/nvidia-container-toolkit), ROCm runtime, Intel oneAPI runtime, Podman |
| **What it does** | Enables GPU access inside containers without VFIO passthrough. NVIDIA Container Toolkit hooks into the container runtime; ROCm and oneAPI use device node passthrough. Namespace isolation (not hardware isolation) |
| **Weaver use** | Fast-iteration GPU workloads — ML engineer workflow, prototyping, non-compliance workloads. Rootless Podman + GPU = security posture without a privileged daemon (consistent with Podman-substitute positioning, Decision #54). Lower overhead than VFIO, faster startup, easier GPU sharing via MIG (A100/H100) |
| **Tier** | Weaver |
| **Effort** | M — vendor toolkit detection, Podman device passthrough orchestration, Shed container GPU picker, MIG partition display for supported hardware |
| **Impact** | DX + Revenue — the ML engineer path. Same bridge routing as GPU VMs — the bridge doesn't care whether the endpoint is QEMU or Podman. Completes the three-path model alongside VFIO and CPU-only |
| **Implementation** | Detect installed vendor toolkits. Shed creation flow: "Container (fast iteration)" path shows available GPUs or MIG partitions. Backend passes `--device` flags to Podman. MIG partition management deferred to Fabrick v2.2+ (requires quota enforcement). Bridge routes to container endpoints identically to VM endpoints |
| **Why v1.2** | Completes the three-path workload model. Container management ships in v1.1; GPU container support is the natural v1.2 extension. ML engineers expect Docker/Podman GPU workflows — meeting them where they are |

### 4. CPU-Only Inference Path (Firecracker + llama.cpp)

| Attribute | Value |
|-----------|-------|
| **Package** | Firecracker (MicroVM), [llama.cpp](https://github.com/ggerganov/llama.cpp), Ollama (CPU mode) |
| **What it does** | Runs quantized models (GGUF format) on CPU with no GPU required. Firecracker provides fastest boot time and lowest overhead of any MicroVM hypervisor. llama.cpp is the dominant CPU inference runtime |
| **Weaver use** | Lightweight inference for small models, edge deployment, development/testing without GPU, and cost-sensitive workloads. Firecracker boot in <200ms means CPU inference VMs can be ephemeral — spin up for a request burst, destroy when idle |
| **Tier** | Weaver |
| **Effort** | S — Firecracker already supported; add inference-focused templates with llama.cpp/Ollama CPU pre-configured |
| **Impact** | DX + Moat — no competitor offers a sub-second-boot CPU inference VM. Completes the three-path model: GPU VM (compliance), GPU container (speed), CPU VM (lightweight). Edge AI story starts here |
| **Implementation** | NixOS flake template with llama.cpp and/or Ollama CPU mode. Shed surfaces as "CPU only (lightweight)" path. Bridge routes to Firecracker endpoints identically. No memory snapshot support (Firecracker limitation) — disk snapshot only |
| **Why v1.2** | Low effort, completes the three-path model, opens edge AI narrative. Firecracker is already a supported hypervisor — this is a template addition, not a platform feature |

### 5. Basic GPU Scheduling (Shed-Native)

| Attribute | Value |
|-----------|-------|
| **Package** | Custom (no external dependency — built on GPU inventory data) |
| **What it does** | Three GPU assignment modes in the Shed creation flow: explicit manual pick, best-fit auto-pick (most free VRAM), and all-linked GPUs (only shown when NVLink/Infinity Fabric detected) |
| **Weaver use** | Single-operator GPU assignment at workload creation time. Applies to both GPU VMs (VFIO) and GPU containers (vendor toolkit). The operator chooses how to assign GPUs; Weaver enforces the assignment |
| **Tier** | Weaver |
| **Effort** | S — UI picker in Shed backed by GPU inventory data. Assignment logic is straightforward: filter available GPUs, rank by free VRAM, detect links |
| **Impact** | DX — replaces manual VFIO configuration and `nvidia-smi` inspection. "Pick a GPU from a dropdown" vs "edit QEMU command-line flags" |
| **Implementation** | Shed creation flow: after workload path selection, GPU assignment step shows available GPUs from inventory. Best-fit ranks by free VRAM. All-linked groups linked GPUs and passes the group. Assignment stored in workload metadata, enforced at LP provision time |
| **Why v1.2** | Ships with GPU inventory — no value in showing GPUs you can't assign. Reservation, queuing, and preemption are Fabrick v2.2+ features that build on this foundation |

---

## v2.0.0 — Inference Engine Support (Weaver)

Model deployment workflow, inference engine integration, and snapshot provisioning. The transition from "GPU management" to "AI infrastructure." Decisions #118, #119.

### 6. Ollama Integration (Template + Health Probe)

| Attribute | Value |
|-----------|-------|
| **Package** | [Ollama](https://github.com/ollama/ollama) |
| **What it does** | Local LLM inference server with model pulling, serving, and a simple API. Dominant in the self-hosted AI community. Supports CPU and GPU inference |
| **Weaver use** | First-class Shed template: select Ollama from catalog → pick model (Llama 3, Mistral, Gemma, etc.) → assign GPU (or CPU) → provision → serving. Health probe hits Ollama's `/api/tags` and `/api/generate` for readiness check. Metrics collected from Ollama's API: model loaded, response latency, memory usage |
| **Tier** | AI Pro ($99/yr, Solo/Team) |
| **Effort** | M — NixOS flake template with Ollama pinned, Shed integration, health probe adapter, snapshot support |
| **Impact** | Revenue + DX — Ollama is the #1 self-hosted LLM tool. 81% of self-hosters are tech professionals. Ollama template is the gateway from Free evaluation to AI Pro. "Deploy Ollama in 30 seconds with GPU passthrough and bridge routing" |
| **Implementation** | NixOS flake template pins Ollama version + model pull config. Shed: "Ollama" template in AI section of catalog. First provision pulls model weights from user-specified source. Health probe: `GET /api/tags` confirms model loaded, test inference confirms serving. Auto-snapshot on health check pass (Decision #119). Bridge routes to Ollama's API endpoint |
| **Why v2.0** | Requires model library (registry of references), deployment workflow, and snapshot infrastructure — all v2.0 scope. Ollama is the simplest integration (single binary, simple API) — proves the pattern for vLLM and TGI |

### 7. vLLM Integration (Template + Health Probe)

| Attribute | Value |
|-----------|-------|
| **Package** | [vLLM](https://github.com/vllm-project/vllm) |
| **What it does** | High-throughput inference engine with PagedAttention, continuous batching, and OpenAI-compatible API. The production inference standard for large-scale serving |
| **Weaver use** | Production inference template for teams serving high-throughput workloads. vLLM's OpenAI-compatible API means existing client code works unchanged. Health probe hits `/health` and `/v1/models`. Inference metrics (tokens/sec, latency, queue depth) collected from vLLM's `/metrics` endpoint (OpenMetrics format) |
| **Tier** | AI Pro ($99/yr, Solo/Team) |
| **Effort** | M — NixOS flake template with vLLM + CUDA/ROCm pinned, health probe adapter, metrics parser, snapshot support |
| **Impact** | Revenue + Moat — vLLM is the production inference standard. "Deploy vLLM with NixOS reproducibility" eliminates CUDA version hell. Snapshot provisioning (Decision #119) means a pre-warmed vLLM instance restores in 2-5 seconds vs 3-10 minute cold start |
| **Implementation** | NixOS flake template pins vLLM, CUDA/ROCm, and Python dependencies. GPU assignment via Shed (single or all-linked for tensor-parallel). Health probe: `/health` + `/v1/models` + test completion request. Metrics adapter parses `/metrics` (Prometheus format) into Weaver's inference metrics model. Auto-snapshot after health check |
| **Why v2.0** | vLLM requires GPU passthrough (v1.2) + model library + deployment workflow + snapshot infrastructure. Production inference engine — proves Weaver is serious about AI infrastructure, not just a GPU passthrough tool |

### 8. TGI Integration (Template + Health Probe)

| Attribute | Value |
|-----------|-------|
| **Package** | [Text Generation Inference (TGI)](https://github.com/huggingface/text-generation-inference) |
| **What it does** | Hugging Face's inference server with flash attention, quantization support, and a production-grade API. Popular in regulated industries due to Hugging Face's enterprise support |
| **Weaver use** | Enterprise inference template for organizations standardized on Hugging Face. Health probe hits `/health` and `/info`. Metrics from `/metrics` endpoint. Important for pharma, healthcare, and defense verticals where Hugging Face enterprise licensing is already in place |
| **Tier** | AI Pro ($99/yr, Solo/Team) |
| **Effort** | M — NixOS flake template with TGI + CUDA pinned, health probe adapter, metrics parser, snapshot support |
| **Impact** | Revenue — captures the Hugging Face ecosystem audience. Regulated industries already trust Hugging Face; TGI template + Weaver compliance story (MicroVM isolation, audit trail) is a powerful combination |
| **Implementation** | NixOS flake template pins TGI and dependencies. Health probe: `/health` + `/info` (model name, quantization, max batch). Metrics adapter parses `/metrics`. Auto-snapshot after health check. Same bridge routing, same blue/green deployment as Ollama and vLLM templates |
| **Why v2.0** | Ships alongside Ollama and vLLM — all three inference engines share the same model library, deployment workflow, and snapshot infrastructure. TGI completes the "big three" coverage |

### 9. ZenCoder On-Premise (Managed Workload Template)

| Attribute | Value |
|-----------|-------|
| **Package** | [ZenCoder](https://zencoder.ai/) (on-premise enterprise deployment) + [zenagents-library](https://github.com/ZenCoderAI/zenagents-library) (MIT — agent definitions) |
| **What it does** | Secure AI coding agent with premium LLM access. On-premise deployment runs the full inference stack locally — no code leaves the network. IDE plugins (VS Code, JetBrains) connect to the local server |
| **Weaver use** | Managed workload template for regulated industries: "Deploy ZenCoder on-premise in 30 seconds." Pre-configured GPU assignment, network isolation, secrets management, health probes. Defense/healthcare/financial buyers need AI coding capabilities but can't send code to external LLMs — ZenCoder on Weaver solves this. Health probe integration, inference metrics, auto-restart on VRAM OOM — same depth as Ollama/vLLM/TGI |
| **Tier** | AI Pro ($99/yr, Solo/Team) — template deployment. Partner bundle pricing for Tier 3 (TBD) |
| **Effort** | M — NixOS flake template for ZenCoder on-premise stack, health probe adapter, GPU assignment, snapshot support. `zenagents-library` (MIT) agent definitions pre-loaded |
| **Impact** | Revenue + Channel — captures the secure AI development market. No competitor offers on-premise AI coding infrastructure with compliance controls. Partner opportunity: co-marketed bundle for defense/healthcare. See `business/sales/partners/zencoder.md` |
| **Implementation** | Three tiers: (1) Shed template (v2.0, no partnership needed). (2) Managed workload with health probes and metrics (v2.0-2.1). (3) Partner bundle with co-marketing (business development). ZenCoder FabricK subscription is customer-supplied — Weaver hosts the workload, doesn't resell the license |
| **Why v2.0** | Ships with template catalog and inference engine infrastructure. Same model library, deployment workflow, and snapshot provisioning as Ollama/vLLM/TGI. ZenCoder is the fourth inference engine template — proves Weaver manages any AI workload, not just open-source LLM servers |

### 10. Model Library (Shed-Native Registry)

| Attribute | Value |
|-----------|-------|
| **Package** | Custom (no external dependency — registry of references, not weight storage) |
| **What it does** | A registry of model references stored in Weaver's database: name, source (HuggingFace ID, S3 URI, local path, Ollama tag), version, GPU requirements, runtime config, status (testing/staging/production), access control. Weaver stores pointers, not weights — model source is the user's responsibility |
| **Weaver use** | "My Models" section in Shed alongside the template catalog. Templates reference models; models are the weights + config; templates are the full deployment recipe. Model status lifecycle: testing → staging → production. Version tracking provides the audit trail — "which model version was serving at 2:15 PM on March 28" |
| **Tier** | AI Pro ($99/yr, Solo/Team) |
| **Effort** | M — database schema, Shed UI section, model reference CRUD, status lifecycle, version metadata |
| **Impact** | Moat + Compliance — model version tracking with audit trail is table stakes for regulated AI (EU AI Act Art. 9, HIPAA, 21 CFR Part 11). No VM management competitor offers this. Compliance Export Extension (Decision #104) includes model deployment evidence |
| **Implementation** | Model reference fields: name, source, version (source revision hash), GPU requirements (min/recommended VRAM, multi-GPU required), runtime config (server type, quantization, context length, batch size), status, template binding. Shed UI: model list with status badges, create/edit/archive flows. Version history retained for audit |
| **Why v2.0** | Foundation for the deployment workflow (steps 1-7), inference engine templates, and snapshot provisioning. Without a model registry, deployment is ad-hoc — no version tracking, no audit trail, no status lifecycle |

### 11. Snapshot-Based Model Provisioning

| Attribute | Value |
|-----------|-------|
| **Package** | QEMU snapshot (memory), filesystem snapshot (disk) — no external dependency |
| **What it does** | Auto-snapshots a running inference VM after health check passes: OS + drivers + model server + model weights loaded in VRAM (memory snapshot) or on disk (disk snapshot). Subsequent deployments restore from snapshot in 2-5 seconds (memory) or 10-30 seconds (disk) instead of 3-10 minutes (full provision) |
| **Weaver use** | "Build once, run many." First deployment is slow (pull weights, load model). Every subsequent deployment restores from snapshot. Rollback is instant — previous version's snapshot is a ready-to-serve VM with the old model already in VRAM. Shed automatically uses the fastest path: snapshot exists → restore; no snapshot → full provision → auto-snapshot on success |
| **Tier** | AI Pro ($99/yr, Solo/Team) |
| **Effort** | L — snapshot capture orchestration, version tagging, pruning policy, Shed integration, memory vs disk snapshot selection logic |
| **Impact** | Moat + Revenue — **"Deploy a model in 2 seconds from snapshot, with the model already in VRAM."** No competitor offers this. K8s cold-starts pods in 1-10 minutes. Cloud platforms pull weights every time. Snapshot rollback is faster than any competing rollback path |
| **Implementation** | After inference health check passes (Decision #117): capture QEMU memory snapshot (if supported) + disk snapshot. Version-tag alongside model version + template version + NixOS flake lock hash. Shed checks for matching snapshot before full provision. Pruning policy: keep last N versions, keep all production snapshots, age-based. Old snapshots invalidated when flake lock, model server version, or driver version changes |
| **Why v2.0** | Depends on inference health probes (v2.1 for full metrics, but basic health check is v2.0), model library (version tagging), and deployment workflow. Snapshot provisioning transforms the deployment speed story from "minutes" to "seconds" — this is the feature that makes auto-scaling viable for large models |

---

## v2.1.0 — Inference Metrics (Weaver)

Inference-aware observability beyond host-level GPU telemetry. Decision #117.

### 12. Inference Health Probe Metrics

| Attribute | Value |
|-----------|-------|
| **Package** | Compatible with vLLM, TGI, Ollama, Triton Inference Server — all expose OpenMetrics-compatible endpoints (`/health`, `/metrics`, `/v1/models`) |
| **What it does** | Collects inference-specific metrics from the model server's standard endpoints: request latency (p50/p95/p99), tokens/sec throughput, queue depth, model name and version, active request count, batch size |
| **Weaver use** | "Inference" tab on workload detail page. Transforms GPU monitoring from "is the GPU busy?" (v1.2) to "what is the model doing and how well?" Feeds the AI agent (v1.4 cross-resource agent) for bridge weight adjustment — shift traffic away from endpoints with degrading latency. Blue/green health checks use inference metrics: "is the new model version serving at acceptable latency?" not just "is the VM alive" |
| **Tier** | AI Pro ($99/yr, Solo/Team) |
| **Effort** | M — health probe polling service, metrics parser for OpenMetrics format, frontend inference metrics tab, AI agent integration for bridge weight feedback |
| **Impact** | Moat + DX — actionable inference observability integrated into the management plane. Prometheus/Grafana can do this separately; Weaver does it in-context with bridge weight controls and blue/green triggers adjacent |
| **Implementation** | Extend v1.1 health probe system: configurable HTTP endpoint per workload. Parse OpenMetrics response into Weaver's metrics model. Store in time-series for trend display. Bridge weight adjustment API accepts inference metric thresholds. Displayed alongside GPU telemetry (v1.2) on workload detail page |
| **Why v2.1** | Requires inference engine templates (v2.0) running with health endpoints. v1.2 GPU telemetry provides hardware-level data; v2.1 adds workload-level intelligence. The gap between "GPU utilization 90%" and "latency p99 = 2.3s, tokens/sec = 45, queue depth = 12" is the gap between monitoring and observability |

### 13. Auto-Restart on VRAM OOM

| Attribute | Value |
|-----------|-------|
| **Package** | Vendor tools (`nvidia-smi`, `rocm-smi`, `xpu-smi`) — detects process killed by VRAM exhaustion |
| **What it does** | Detects VRAM out-of-memory events via GPU vendor tool output (e.g., `nvidia-smi` reports process killed). Configurable response: auto-restart workload (default), restart with reduced batch size (if model server supports runtime config), or alert only |
| **Weaver use** | Self-healing inference infrastructure. VRAM OOM is the #1 failure mode for inference workloads — a single oversized batch or concurrent request spike can kill the model server. Without auto-restart, the operator discovers a dead inference endpoint hours later. OOM events logged to audit trail for pattern analysis |
| **Tier** | AI Pro ($99/yr, Solo/Team) |
| **Effort** | S — OOM detection from existing GPU polling data, restart trigger via existing workload lifecycle API, audit log entry |
| **Impact** | DX + Revenue — "your inference endpoints self-heal." Table stakes for production inference. Prometheus can alert; Weaver restarts. The difference between "I got paged at 3 AM" and "Weaver restarted the model server and I saw it in the morning log" |
| **Implementation** | GPU polling service (v1.2) detects OOM signal in vendor tool output. Triggers configurable response: restart workload (LP destroy + restore from snapshot if available), restart with reduced config (API call to model server if supported), or alert only. OOM event written to audit log with GPU metrics at time of failure |
| **Why v2.1** | Requires GPU polling (v1.2) and inference health probes (v2.1) — the OOM detection comes from GPU telemetry, the restart confirmation comes from inference health check. Ships alongside inference metrics as part of the "inference observability" wave |

---

## v2.2.0 — GPU Scheduling + Fleet Inference Foundations (Fabrick)

Multi-user GPU contention management, fleet-level metrics, and snapshot-based auto-scaling. Decisions #116, #117, #119, #128.

### 14. GPU Reservation per Workload Group

| Attribute | Value |
|-----------|-------|
| **Package** | Custom (built on workload groups, Decision #88) |
| **What it does** | Guarantees GPU allocation for a workload group — reserved GPUs cannot be assigned to workloads in other groups. Prevents the "first-come grabs all GPUs" problem in multi-team environments |
| **Weaver use** | Research computing: each lab/grant gets reserved GPU allocation. Enterprise: production inference group gets guaranteed capacity, development group gets best-effort on remaining GPUs. Defense: CUI workload group gets dedicated hardware, unclassified group uses the rest |
| **Tier** | AI Fleet ($499/yr/node, Fabrick) |
| **Effort** | M — reservation data model per workload group, enforcement in Shed GPU assignment, reservation dashboard showing allocated vs available |
| **Impact** | Revenue + Compliance — multi-team GPU allocation fairness is the fabrick upgrade trigger. Research computing directors and IT directors in regulated industries need provable resource allocation boundaries |
| **Implementation** | Workload group config (Decision #88) gets GPU reservation field: count and/or specific GPU IDs. Shed GPU assignment checks reservation before offering GPUs. Dashboard: reservation view showing per-group allocated/used/available. Audit log records reservation changes |
| **Why v2.2** | Requires workload groups (Decision #88, v2.2) and GPU inventory (v1.2). Single-operator Weaver doesn't need reservation — one person manages all GPUs. Multi-team Fabrick is where contention starts |

### 15. GPU Queue (FIFO/Priority)

| Attribute | Value |
|-----------|-------|
| **Package** | Custom (queue infrastructure with RBAC integration) |
| **What it does** | When no GPU is available, workload creation enters a queue instead of failing. FIFO (first-in-first-out) by default; priority mode allows workload groups to have priority levels. Operator sees queue position and estimated wait time |
| **Weaver use** | Multi-user GPU sharing without the "refresh and hope" experience. HPC/research: graduate students queue for GPU time behind priority production workloads. Enterprise: development workloads queue behind production inference. Replaces Slurm-style job scheduling for GPU workloads |
| **Tier** | AI Fleet ($499/yr/node, Fabrick) |
| **Effort** | M — queue data model, priority logic, Shed queue status UI, notification on queue advancement |
| **Impact** | Moat + Revenue — replaces Slurm for GPU scheduling. Slurm is the incumbent in HPC/research GPU scheduling but has no VM/container management, no bridge routing, no inference metrics. Weaver unifies workload management with GPU scheduling |
| **Implementation** | Queue per host (v2.2) and per fleet (v3.0). Workload creation from Shed: GPU unavailable → enter queue with priority from workload group config. Queue advances when GPU becomes available (workload destroyed or reservation released). Notification via WebSocket when position advances or workload starts |
| **Why v2.2** | Requires GPU reservation (determines priority boundaries) and workload groups (determines priority levels). Queue is the natural complement to reservation — reservation guarantees minimum allocation, queue manages overflow demand |

### 16. GPU Preemption

| Attribute | Value |
|-----------|-------|
| **Package** | Custom (policy engine on workload group priority model) |
| **What it does** | Higher-priority workload groups can evict lower-priority workloads from GPUs. Evicted workload is gracefully stopped (drain period), snapshot saved, and moved to queue for re-provisioning when capacity returns |
| **Weaver use** | Production inference preempts development workloads. Emergency model deployment preempts batch jobs. The operator sets policy; Weaver enforces it automatically. Evicted workloads snapshot before stopping — restore is fast when GPU becomes available again |
| **Tier** | AI Fleet ($499/yr/node, Fabrick) |
| **Effort** | M — preemption policy engine, graceful drain + snapshot on eviction, queue re-entry, notification to affected users |
| **Impact** | Moat — no VM management competitor offers GPU preemption. Slurm does, but without VM/container management. This is the fabrick GPU governance feature that IT directors require |
| **Implementation** | Workload group priority model: groups ranked by priority. Preemption trigger: higher-priority workload enters queue → Weaver identifies lowest-priority active workload on target GPU → drain timer → snapshot → stop → re-queue. Evicted user notified with reason. Audit log records preemption event |
| **Why v2.2** | Requires reservation, queue, and snapshot infrastructure. Preemption without snapshot would destroy work; preemption with snapshot preserves state. The combination is the differentiator |

### 17. Multi-GPU Topology-Aware Assignment

| Attribute | Value |
|-----------|-------|
| **Package** | `nvidia-smi topo -m` (NVIDIA NVLink), `rocm-smi --showtopo` (AMD Infinity Fabric), PCIe topology via `lspci` |
| **What it does** | Extends all-linked GPU assignment (v1.2) with NUMA affinity and PCIe bus topology scoring. Places multi-GPU workloads on GPUs with the highest interconnect bandwidth and closest memory affinity |
| **Weaver use** | Large model inference (70B+ params) on multi-GPU setups. Topology-aware placement ensures tensor-parallel inference uses NVLink-connected GPUs (900 GB/s) instead of PCIe-connected GPUs (64 GB/s) — 14x bandwidth difference. NUMA affinity ensures CPU memory access doesn't bottleneck GPU data transfer |
| **Tier** | AI Fleet ($499/yr/node, Fabrick) |
| **Effort** | M — topology data model, NUMA detection, scoring algorithm, Shed integration for topology-aware auto-pick |
| **Impact** | Moat + DX — topology-aware GPU placement is what Slurm and K8s GPU Operator struggle with. Weaver detects topology automatically and places optimally without operator intervention |
| **Implementation** | Extend GPU inventory with topology data: NVLink/IF link map, NUMA node assignment, PCIe bus/slot. Scoring algorithm: prefer linked GPUs > same NUMA node > same PCIe root complex. Shed "all-linked" option enhanced with topology score display. Auto-pick uses topology scoring when multiple valid placements exist |
| **Why v2.2** | Builds on v1.2 GPU inventory and link detection. Single-GPU assignment doesn't need topology awareness. Multi-GPU at enterprise scale does. The topology data is already collected at v1.2 — v2.2 makes scheduling decisions from it |

### 18. Fleet-Level Inference Metrics

| Attribute | Value |
|-----------|-------|
| **Package** | Custom (aggregation layer over per-host inference metrics from v2.1) |
| **What it does** | Aggregates inference metrics across fleet bridges (Decision #114) and workload groups (Decision #88). Per-fleet-bridge: total throughput, aggregated latency percentiles, endpoint health distribution, fleet VRAM utilization. Per-workload-group: reserved vs actual GPU utilization, queue wait time and depth |
| **Tier** | AI Fleet ($499/yr/node, Fabrick) |
| **Effort** | M — hub aggregation service, fleet metrics API, fleet inference dashboard page |
| **Impact** | Revenue + DX — fleet-wide inference visibility is the Fabrick differentiator. Single-host metrics exist at v2.1; fleet aggregation is what makes GPU fleet management a product, not a collection of hosts |
| **Implementation** | Hub collects per-host inference metrics via agent connection. Aggregation per fleet bridge: sum throughput, merge latency histograms, count endpoint states. Per workload group: compute reserved vs used GPU ratio. Weaver: fleet inference overview page with bridge-level and group-level views. Feeds set point auto-scaling triggers |
| **Why v2.2** | Requires per-host inference metrics (v2.1) and fleet bridge architecture (Decision #114, v3.0 for full fleet bridges but v2.2 peer monitoring provides the hub-agent data path). Fleet metrics aggregation is the v2.2 clustering prerequisite for v3.0 fleet scheduling |

### 19. Snapshot-Based Auto-Scaling

| Attribute | Value |
|-----------|-------|
| **Package** | Custom (built on snapshot provisioning v2.0 + set point auto-scaling Decision #95) |
| **What it does** | Auto-scaling triggers (set point `preProvisionAt`) restore inference VMs from memory snapshot in 2-5 seconds instead of full provisioning in 3-10 minutes. Makes inference auto-scaling viable for large models — the pre-provision window is tight enough to absorb traffic spikes before latency degrades |
| **Weaver use** | Production inference auto-scaling: latency exceeds threshold → restore snapshot → VM serving in seconds → enters bridge rotation. Deprovision when sustained low latency. Predictive mode: AI learns traffic patterns and pre-provisions before load arrives |
| **Tier** | AI Fleet ($499/yr/node, Fabrick) |
| **Effort** | L — integration of snapshot restore into set point engine, snapshot selection logic (match model version + template), bridge auto-registration on restore, drain and destroy on scale-down |
| **Impact** | Moat — **the feature that makes large-model auto-scaling possible.** K8s HPA scales reactively with minutes-long cold starts. Weaver set points + snapshot restore = seconds. "Auto-scale a 70B model with 2-second cold start" is a pitch no competitor can match |
| **Implementation** | Set point engine (Decision #95) gets snapshot-aware provisioning: `preProvisionAt` trigger → find matching snapshot (model version + template version) → QEMU memory restore → health check → bridge registration at `implementAt`. Scale-down: `deprovisionAt` → drain endpoint weight → destroy workload → retain snapshot for next scale-up |
| **Why v2.2** | Requires snapshots (v2.0), inference metrics as trigger source (v2.1), and fleet bridge endpoint lifecycle (Decision #114). Auto-scaling without snapshots is too slow for large models — the snapshot is what makes sub-10-second scaling viable |

### 20. Per-User Configurable AI Rate Limits (Weaver Team)

| Attribute | Value |
|-----------|-------|
| **Package** | Custom (rate limiting per user, per AI deployment model) |
| **What it does** | Admin-configurable per-user rate limits for AI agent requests across all three deployment models: cloud API (token spend protection), local AI (host resource protection), self-hosted model server (GPU compute protection). Default 10/min, admin adjusts per user based on role or budget |
| **Weaver use** | First tier with multiple users sharing AI infrastructure (Team). Per-user budget/capacity control answers the fabrick objection: "what happens if someone scripts 500 agent requests?" Admin sets individual ceilings. Rate limit protects regardless of whether the backend is Claude API, Ollama, or a vLLM cluster |
| **Tier** | Weaver Team (v2.2) |
| **Effort** | S — per-user rate limit config in admin panel, enforcement middleware, rate limit status in user profile |
| **Impact** | Revenue + Compliance — budget predictability and capacity governance are compliance requirements in regulated verticals. Differentiator: no competing VM management tool provides AI rate limiting |
| **Implementation** | Admin panel: per-user rate limit setting (requests/minute). Enforcement: middleware checks rate before proxying to AI backend. Three deployment model awareness: cloud API (cost), local (resource), self-hosted (compute). User sees remaining quota. Rate limit violations logged to audit trail |
| **Why v2.2** | First multi-user tier. Solo (single operator) doesn't need per-user config. Team introduces the "shared AI infrastructure" scenario where per-user controls become immediately relevant |

---

## v3.0.0 — Fleet GPU Infrastructure (Fabrick)

Fleet-level GPU scheduling, inference routing, and model management across hosts. Decisions #114, #116, #117, #118, #119, #128.

### 21. Fleet GPU Scheduling (Cross-Host Placement)

| Attribute | Value |
|-----------|-------|
| **Package** | Custom (hub-level scheduler built on fleet bridge architecture, Decision #114) |
| **What it does** | Hub selects the optimal host for a new GPU workload based on: GPU availability, VRAM capacity, snapshot cache (prefer hosts with cached model snapshot), topology score, current inference load, and reservation constraints. The operator creates a workload; Fabrick decides where it runs |
| **Weaver use** | "Deploy this model" → Fabrick finds the best host, provisions (from snapshot if cached), and auto-registers the endpoint on the fleet bridge. The operator doesn't SSH anywhere, doesn't pick a host, doesn't manage VFIO bindings. Fleet GPU scheduling replaces Slurm for inference workloads and K8s GPU Operator for container GPU workloads |
| **Tier** | AI Fleet ($499/yr/node, Fabrick) |
| **Effort** | L — cross-host scheduling algorithm, snapshot cache awareness, fleet bridge integration, placement decision audit trail |
| **Impact** | Moat — **the convergence feature.** Fleet bridge routing (Decision #114) + GPU scheduling (Decision #116) + snapshot provisioning (Decision #119) = a model serving infrastructure that no competitor offers as a unified product. Slurm schedules but doesn't manage VMs. K8s manages pods but can't do VFIO hardware isolation. Proxmox manages VMs but has no scheduler |
| **Implementation** | Hub scheduling service: workload creation request → evaluate all connected hosts → score by GPU availability (type, VRAM, topology) + snapshot cache hit + current load + reservation constraints → select host → trigger LP on selected host → endpoint auto-registers on fleet bridge. Placement decision logged to audit trail for capacity analysis |
| **Why v3.0** | Requires fleet bridge architecture (Decision #114, v3.0), per-host GPU scheduling (v2.2), and fleet snapshot awareness. The hub must know what every host has (GPUs, snapshots, load) to make optimal placement decisions |

### 22. Fleet Inference Routing via Bridge

| Attribute | Value |
|-----------|-------|
| **Package** | Fleet virtual bridge (Decision #114) — overlay-backed (VXLAN/WireGuard), workload-group-aligned |
| **What it does** | Elevates single-host bridge routing to fleet scope. Request arrives → Fabrick routes to the least-loaded inference endpoint across the entire fleet. Bridge weights are fleet-level, not host-level. AI agent manages fleet-wide weights based on cross-host latency and throughput metrics |
| **Weaver use** | Fleet-level inference load balancing without a separate load balancer, service mesh, or API gateway. The fleet bridge IS the inference router. Blue/green model updates at fleet scale: roll out new model version across 10 hosts with per-host blue/green, coordinated by the hub. Node cordon: set endpoint weights to 0 on the cordoned host — traffic drains to other hosts automatically |
| **Tier** | AI Fleet ($499/yr/node, Fabrick) |
| **Effort** | L — fleet bridge weight API (cross-host), AI agent fleet-level weight management, cordon/uncordon workflow, fleet blue/green coordination |
| **Impact** | Moat — **replaces three K8s components at fleet scale:** CNI plugin (overlay), ingress controller + MetalLB (fleet bridge routing), Argo Rollouts (fleet blue/green). One primitive, one API, one audit trail. Sales line: *"AI infrastructure without the Kubernetes tax"* |
| **Implementation** | Fleet bridge extends Decision #114 architecture. Weight API: `PUT /api/bridges/:name/weights` — same shape as single-host, but `:name` is a fleet bridge and endpoints are `host:workload`. Hub resolves endpoint location and routes through overlay. AI agent reads fleet inference metrics (v2.2) and adjusts weights. Fleet blue/green: hub coordinates per-host weight shifts in sequence with health check gates between hosts |
| **Why v3.0** | Requires overlay network (Decision #34, v2.0), fleet bridge architecture (Decision #114, v3.0), and fleet inference metrics (v2.2). The single-host bridge story is complete at v1.4; fleet elevation is the v3.0 value proposition |

### 23. Blue/Green Model Deployment (Fleet-Wide)

| Attribute | Value |
|-----------|-------|
| **Package** | Custom (fleet-level coordination of per-host blue/green, Decision #112) |
| **What it does** | Coordinated model version rollout across the fleet: provision new model version on each host (from snapshot), shift fleet bridge weights per-host in sequence, health check between each host transition, confirm or rollback the entire fleet. Rollback restores previous version's snapshot on all hosts in seconds |
| **Weaver use** | Zero-downtime model updates across a multi-host inference fleet. The operator initiates one fleet-level blue/green; Fabrick handles per-host orchestration. Failed health check on any host halts the rollout and rolls back completed hosts. Full fleet rollback is parallel snapshot restore — faster than any competing rollback mechanism |
| **Tier** | AI Fleet ($499/yr/node, Fabrick) |
| **Effort** | L — fleet rollout orchestrator, per-host sequencing, health check gates, parallel rollback, rollout progress UI |
| **Impact** | Revenue + Moat — fleet-level model deployment with instant rollback. Enterprise ML teams managing 10+ inference hosts need coordinated rollouts. This is what Argo Rollouts + K8s does — except with hardware-isolated VMs, snapshot rollback, and no YAML |
| **Implementation** | Hub orchestrator: select model version + target fleet bridge → for each host with matching endpoints: provision new version (snapshot restore if cached) → health check → shift weight → confirm host. If any host fails health check: halt, rollback completed hosts (parallel snapshot restore), alert. Rollout progress visible in fleet inference dashboard |
| **Why v3.0** | Requires fleet bridge routing, fleet GPU scheduling, and snapshot provisioning at fleet scale. The single-host blue/green story ships at v1.4 (Solo) / v2.2 (Team); fleet coordination is the v3.0 extension |

### 24. Fleet Snapshot Awareness & Distribution

| Attribute | Value |
|-----------|-------|
| **Package** | Custom (hub-level snapshot inventory + proactive distribution) |
| **What it does** | Hub tracks which hosts have which snapshots (model version + template version + snapshot type). Fleet scheduling prefers snapshot-cached hosts. Proactive cache warming pushes snapshots to hosts before demand arrives, so fleet auto-scaling doesn't cold-start |
| **Weaver use** | "Build once, run many" at fleet scale. Provision a model once on one host → snapshot → distribute snapshot to 10 hosts → all 10 can restore in seconds. Fleet auto-scaling checks snapshot cache before provisioning — cached host serves in 2-5 seconds, uncached host requires full provision (minutes). Cache warming eliminates the cold-start penalty across the fleet |
| **Tier** | AI Fleet ($499/yr/node, Fabrick) |
| **Effort** | L — snapshot inventory tracking, distribution protocol, cache warming scheduler, scheduling integration |
| **Impact** | Moat — fleet snapshot distribution is the "build once, run many" infrastructure that makes fleet auto-scaling practical. Without it, scaling to a new host means a 3-10 minute cold start. With it, every host is pre-warmed |
| **Implementation** | Hub maintains snapshot inventory: per-host list of available snapshots (model version, template version, snapshot type, size). Scheduling service queries inventory for placement decisions. Cache warming: when a new model version is deployed, hub pushes snapshot to N hosts based on fleet bridge membership and traffic patterns. Transfer via overlay network |
| **Why v3.0** | Requires per-host snapshots (v2.0), fleet bridge architecture (v3.0), and fleet GPU scheduling (v3.0). Snapshot distribution is the optimization that converts fleet scheduling from "place optimally" to "place optimally and serve instantly" |

### 25. GPU Topology Map + Model Version Tracking

| Attribute | Value |
|-----------|-------|
| **Package** | Custom (fleet visualization built on GPU inventory + inference metrics + fleet bridge data) |
| **What it does** | Visual dashboard: which GPUs on which hosts, which models running on each, which fleet bridges routing to them, rollout progress during fleet blue/green. Model version tracking across fleet: host-A running v2, host-B running v3, rollout 60% complete. Historical latency/throughput time series for capacity planning |
| **Weaver use** | Fleet inference operations center. The operator sees the entire GPU fleet — hardware, models, traffic, health — in one view. Capacity planning: historical metrics show when GPU utilization trends toward saturation, triggering hardware procurement decisions. Compliance: full audit trail of which model version served on which hardware at any point in time |
| **Tier** | AI Fleet ($499/yr/node, Fabrick) |
| **Effort** | L — topology visualization, cross-host model version tracking, historical metrics storage, capacity planning views |
| **Impact** | DX + Compliance — the "single pane of glass" for GPU fleet operations. Historical metrics + model version tracking stored in SQL audit backend (Decision #93) provide compliance evidence for regulated AI |
| **Implementation** | Fleet GPU topology page: host cards with GPU slots showing model, utilization, temperature. Fleet bridge overlay: traffic flow between endpoints. Model version tracker: table showing model → hosts → versions → rollout status. Historical metrics: time-series stored in SQL audit backend, rendered as line charts for latency, throughput, utilization |
| **Why v3.0** | Requires all prior GPU/inference features. The topology map is the capstone visualization that makes fleet GPU management tangible and auditable |

### 26. Fleet-Wide AI Rate Limits

| Attribute | Value |
|-----------|-------|
| **Package** | Custom (extends per-user rate limits from v2.2 Team to fleet scope) |
| **What it does** | Admin sets AI rate limit ceilings per user across the entire fleet from the hub. Rate limits enforced consistently regardless of which host processes the request. Default 30/min at Fabrick tier |
| **Weaver use** | Fleet-wide AI governance. A user's rate limit applies whether they're hitting the AI agent on host-A or host-B. Prevents circumventing per-host limits by distributing requests across nodes. Hub aggregates rate consumption from all agents |
| **Tier** | AI Fleet ($499/yr/node, Fabrick) |
| **Effort** | M — hub-level rate aggregation, cross-host rate enforcement, fleet admin rate config UI |
| **Impact** | Compliance + Revenue — fleet-wide AI governance is a procurement checkbox for regulated industries. "No matter which host handles the request, the rate limit holds" |
| **Implementation** | Hub maintains per-user rate counters aggregated from all agents. Agents check with hub before processing AI requests (or use distributed token bucket with periodic sync). Admin panel: fleet-level per-user rate config. Audit trail: rate limit violations logged with host, user, timestamp |
| **Why v3.0** | Requires Fabrick hub-agent architecture and per-user rate limits (v2.2 Team). Fleet-level enforcement needs the hub as aggregation point. Single-host rate limits are per-host by definition — fleet-wide requires coordination |

---

## AI Extension Gating (Decision #120)

AI/inference features are gated as a separate extension, not included in base product FM pricing. Three tiers:

| Extension Tier | Price | Included Capabilities | Ships |
|---------------|:-----:|----------------------|:-----:|
| **AI Base** | $0 (all tiers) | BYOK AI diagnostics, mock agent fallback, vendor selection, profile switching | v1.0 |
| **AI Pro** | $99/yr (Solo/Team) | Model library, deployment workflow, snapshot provisioning, inference engine templates, inference metrics, auto-restart on OOM, GPU templates | v2.0 |
| **AI Fleet** | $499/yr/node (Fabrick) | GPU reservation/queue/preemption, MIG partitioning, topology-aware assignment, snapshot-based auto-scaling, fleet inference metrics, fleet inference routing, fleet model deployment, fleet snapshot distribution, fleet GPU scheduling | v2.2–v3.0 |

**FM treatment:** AI Pro/Fleet are priced independently from the base product FM lock. AI Pro waived for FM customers who complete a qualifying champion action (enterprise referral, published testimonial, community contribution). AI Fleet at $499/yr/node is 90% below Run:ai ($5,000/yr/node).

**Rationale:** Decisions #113–#119 added 48 features worth $6,000–$50,000/yr at market rates. Including them in the FM lock would create a $1M+/yr value leak across the FM customer base at scale.

---

## Competitive Moat Analysis

These integrations collectively create a defensive position no competitor can replicate without building a unified VM + container + GPU management platform:

```
Layer 1 (v1.2):   Multi-vendor GPU support across 3 vendors, 3 workload paths.
                   → "NVIDIA, AMD, Intel — same dashboard, same bridge
                      routing, same blue/green deployment. Pick VM for
                      compliance, container for speed, CPU for lightweight."
                   No competitor supports NVIDIA+AMD+Intel in unified management.
                   Proxmox: NVIDIA-only community scripts.
                   K8s GPU Operator: NVIDIA-first, AMD experimental.

Layer 2 (v2.0–2.2): Inference engine integration with health probes, metrics,
                     snapshot provisioning, and GPU scheduling.
                   → "Deploy a model in 30 seconds from template, or 2 seconds
                      from snapshot — with production metrics from day one.
                      Auto-restart on OOM. GPU reservation per team."
                   No competitor offers snapshot-based model provisioning.
                   No competitor integrates inference metrics into the
                   workload management plane.

Layer 3 (v3.0):    Fleet GPU scheduling replaces Slurm/K8s GPU Operator.
                   Fleet inference routing via bridge replaces CNI + ingress +
                   Argo Rollouts. "Build once, run many" at fleet scale.
                   → "AI replaces the scheduler" — MCP-driven autonomous
                      fleet management (Decision #94). Fleet blue/green
                      with instant snapshot rollback across 10+ hosts.
                   No competitor unifies fleet VM management, fleet GPU
                   scheduling, and fleet inference routing in one product.
```

**The key differentiator:** unified VM + container + GPU management. Competitors own one domain:
- **Proxmox** does VMs (no GPU management UI, no inference, no fleet scheduling)
- **Kubernetes** does containers (no hardware-isolated VMs, GPU Operator is bolted-on, no snapshot provisioning)
- **Slurm** does GPU scheduling (no VM/container management, no bridge routing, no inference metrics)
- **Run:ai** does GPU orchestration (K8s-only, no VM support, $5,000/yr/node)

Weaver manages all three workload types behind one bridge, with one scheduling API, one audit trail, and one deployment workflow. Each layer compounds the switching cost — by v3.0, replacing Weaver means replacing three separate products.

---

## Summary: Version Targeting

| Version | Integration | Tier | Effort | Primary Impact |
|---------|-------------|------|--------|----------------|
| **v1.2** | Multi-vendor GPU inventory | Weaver | M | DX — unified GPU visibility across 3 vendors |
| **v1.2** | VFIO-PCI GPU passthrough | Weaver | M | Revenue + Compliance — hardware-isolated GPU workloads |
| **v1.2** | Container GPU support (Podman + toolkits) | Weaver | M | DX — ML engineer fast-iteration path |
| **v1.2** | CPU-only inference (Firecracker + llama.cpp) | Weaver | S | DX + Moat — sub-second boot CPU inference |
| **v1.2** | Basic GPU scheduling (Shed) | Weaver | S | DX — GPU assignment from dropdown, not command line |
| **v2.0** | **Ollama integration** | AI Pro | M | **Revenue — gateway from Free to AI Pro** |
| **v2.0** | **vLLM integration** | AI Pro | M | **Moat — production inference with NixOS reproducibility** |
| **v2.0** | **TGI integration** | AI Pro | M | **Revenue — Hugging Face ecosystem capture** |
| **v2.0** | **Model library** | AI Pro | M | **Moat + Compliance — model version audit trail** |
| **v2.0** | **Snapshot provisioning** | AI Pro | L | **Moat — 2-second model deployment from snapshot** |
| **v2.1** | Inference health probe metrics | AI Pro | M | Moat — actionable inference observability |
| **v2.1** | Auto-restart on VRAM OOM | AI Pro | S | DX — self-healing inference endpoints |
| **v2.2** | **GPU reservation per workload group** | AI Fleet | M | **Revenue — enterprise GPU allocation fairness** |
| **v2.2** | **GPU queue (FIFO/priority)** | AI Fleet | M | **Moat — replaces Slurm for GPU scheduling** |
| **v2.2** | GPU preemption | AI Fleet | M | Moat — enterprise GPU governance |
| **v2.2** | Multi-GPU topology-aware assignment | AI Fleet | M | Moat — optimized multi-GPU placement |
| **v2.2** | Fleet-level inference metrics | AI Fleet | M | Revenue — fleet inference visibility |
| **v2.2** | Snapshot-based auto-scaling | AI Fleet | L | Moat — sub-10-second inference auto-scaling |
| **v2.2** | Per-user AI rate limits (Team) | Weaver Team | S | Revenue + Compliance — AI capacity governance |
| **v3.0** | **Fleet GPU scheduling** | AI Fleet | L | **Moat — replaces Slurm + K8s GPU Operator** |
| **v3.0** | **Fleet inference routing** | AI Fleet | L | **Moat — replaces CNI + ingress + Argo Rollouts** |
| **v3.0** | Fleet blue/green model deployment | AI Fleet | L | Revenue — coordinated fleet model rollouts |
| **v3.0** | Fleet snapshot distribution | AI Fleet | L | Moat — "build once, run many" at fleet scale |
| **v3.0** | GPU topology map + model tracking | AI Fleet | L | DX + Compliance — fleet GPU operations center |
| **v3.0** | Fleet-wide AI rate limits | AI Fleet | M | Compliance — fleet AI governance |

---

*This plan should be registered in [MASTER-PLAN.md](../../MASTER-PLAN.md) under Cross-version plans and referenced from version-specific EXECUTION-ROADMAPs as integrations are scheduled.*
