<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v1.2.0 (Full Container Management)

**Last updated:** 2026-03-04

Execution plan for Phase 7b — the closer release. For container visibility (v1.1.0), see [v1.1.0/EXECUTION-ROADMAP.md](../v1.1.0/EXECUTION-ROADMAP.md). For the full product roadmap and decision log, see [MASTER-PLAN.md](../../MASTER-PLAN.md).

## Pre-Planning TODO

- [ ] Absorb planned features from MASTER-PLAN into this roadmap: cloud-init userdata editor, SSH key management, webhook integrations, Windows autounattend.xml. See [MASTER-PLAN.md § Planned Features Not Yet in Roadmaps](../../MASTER-PLAN.md#planned-features-not-yet-in-roadmaps).

## Phase Overview

```
Phase 7b: Full Container Management (v1.2.0)       ░░░░░░░░░░░░░░░░░░░░  PLANNED
```

## Also Shipping in v1.2.0

- **Firewall templates** — profile-dependent egress, nftables bridge family for zones (enterprise). See [FIREWALL-TEMPLATE-PLAN.md](FIREWALL-TEMPLATE-PLAN.md).
- **Sector personalization** — required sector dropdown at first-run (Free), aspirational sector selection (Weaver), sector-aware upgrade nags, in-product vertical demos. See [SECTOR-PERSONALIZATION-PLAN.md](SECTOR-PERSONALIZATION-PLAN.md).

### Nix Ecosystem Integrations (v1.2)

From the [NIX-ECOSYSTEM-INTEGRATION-PLAN.md](../cross-version/NIX-ECOSYSTEM-INTEGRATION-PLAN.md):

- **sops-nix** (Fabrick, M effort) — Secrets encrypted at rest in Nix store via SOPS. Backend: `POST /api/secrets` manages secret references. VM config UI: secret picker for sensitive fields. Setup wizard: age keypair generation. Table stakes for NIST 800-171, HIPAA, PCI DSS compliance sales. Decision resolved: sops-nix chosen (Decision #73) — KMS support required for Fabrick compliance.
- **impermanence** (Fabrick extension, M effort) — Ephemeral root filesystem for VMs. Per-VM toggle + persistence path declaration UI. Root resets on every boot; only declared state survives. No competitor offers this. Aligns with hardening extension category (AppArmor, Seccomp). Already proven in microvm-anywhere research patterns.
- **lanzaboote** (Fabrick extension, S effort) — UEFI Secure Boot for NixOS hosts. Signed bootloader → signed kernel → full chain of trust. Weaver: Secure Boot status indicator on host info page + compliance report inclusion. Required for CMMC Level 2, NIST 800-171. Ships with the rest of the hardening stack — S effort, zero dependencies.
- **Covert channel hardening** (Weaver extension, M effort) — Six mitigations exposed as toggleable hardening profiles per MicroVM or per Workload Group: (1) **CPU core pinning** — dedicate physical cores per MicroVM via `vcpu.pinning`, eliminating shared cache side channels. Exposed through Live Provisioning and Shed creation dialog. (2) **Intel CAT / AMD cache partitioning** — hardware cache isolation between VMs via kernel parameters, declarative NixOS config. (3) **Speculative execution hardening** — enforce all mitigations (retpolines, IBRS, STIBP, SSBD) as a toggleable profile via NixOS boot params. (4) **Intel MBA (Memory Bandwidth Allocation)** — isolate memory bus bandwidth per VM. (5) **Network traffic padding** (Fabrick, Smart Bridges) — constant-rate shaping on fleet virtual bridges to defeat traffic analysis. (6) **Timer resolution reduction** — reduce guest timer precision to mitigate timing channels via hypervisor config. Items 1–4 are hardware-level isolation that no shared-kernel container solution can match. Item 5 leverages Smart Bridges. Defense/HIPAA/financial verticals require these for compliance (NIST 800-53 SC-4, DISA STIG).

### AI & GPU Infrastructure (v1.2)

From the [AI-GPU-INFRASTRUCTURE-PLAN.md](../cross-version/AI-GPU-INFRASTRUCTURE-PLAN.md):

- **Multi-vendor GPU inventory** (Weaver, S effort) — Detect NVIDIA/AMD/Intel GPUs via `lspci` + vendor tools. Display vendor, model, VRAM, driver, temperature on host info page. Decisions #113.
- **GPU passthrough (VFIO-PCI)** (Weaver, M effort) — Hardware GPU assignment to MicroVMs. IOMMU group detection, VFIO driver binding, QEMU/cloud-hypervisor args. Decision #113.
- **Container GPU support** (Weaver, S effort) — Podman `--device` / `--gpus` flags for NVIDIA/AMD/Intel runtime toolkits. Decision #113.
- **CPU-only inference path** (Weaver, S effort) — Firecracker + llama.cpp/Ollama CPU mode. Quantized models (GGUF Q4/Q5). Decision #113.
- **Basic GPU scheduling** (Weaver, M effort) — Manual pick, best-fit (most free VRAM), all-linked (NVLink/Infinity Fabric). Decision #116.

---

## Phase 7b: Full Container Management (v1.2.0)

The closer. Ship the complete container management story in one release — not drip-fed. After 7a establishes visibility and proves demand, 7b delivers every action users asked for simultaneously. The goal is to make Weaver the obvious choice for anyone managing VMs and containers on the same nodes.

### Apptainer Actions

| Task | Tier | Priority |
| --- | --- | --- |
| Start/stop/restart Apptainer instances | Weaver | High |
| Pull SIF images from OCI registries + library:// | Weaver | High |
| Build SIF from definition files | Weaver | High |
| GPU passthrough config (`--nv` NVIDIA, `--rocm` AMD) | Weaver | High |
| Bind mount configuration UI | Weaver | High |
| Overlay filesystem management | Weaver | Medium |

### Docker/Podman Actions

| Task | Tier | Priority |
| --- | --- | --- |
| Start/stop/restart/remove containers | Weaver | High |
| Pull images from registries (Docker Hub, GHCR, custom) | Weaver | High |
| Container creation from image reference | Weaver | High |
| Volume mount configuration | Weaver | Medium |
| Environment variable management | Weaver | Medium |

### Unified Creation Flow

| Task | Tier | Priority |
| --- | --- | --- |
| `CreateContainerDialog` — from SIF or OCI image reference | Weaver | High |
| Runtime selector (Apptainer / Docker / Podman) with capability badges | Weaver | High |
| Resource limits UI (CPU, memory, GPU) | Weaver | Medium |

### Operations & Governance

| Task | Tier | Priority |
| --- | --- | --- |
| Audit logging for all container actions | Weaver | High |
| RBAC: container permissions separate from VM permissions | Fabrick | High |
| Bulk actions (stop all, restart all by runtime) | Weaver | Medium |
| Container image cache management (list cached, prune unused) | Weaver | Medium |

### Infrastructure

| Task | Tier | Priority |
| --- | --- | --- |
| Container action API endpoints (`POST /api/containers/:id/start`, etc.) | Weaver | High |
| `POST /api/containers` creation endpoint with Zod validation | Weaver | High |
| Image registry API (`GET /api/images`, `POST /api/images/pull`) | Weaver | High |
| NixOS module: container management options, GPU passthrough flags | Weaver | Medium |
| E2E specs for full container management lifecycle | Weaver | High |

> **Market positioning:** After this release, the product page reads: *"The only dashboard that manages your MicroVMs, Apptainer instances, and Docker containers from a single pane — with AI-powered diagnostics across all of them."* Nobody else can say this.

---

## SLURM + Weaver Integration Kit (Partner Program Artifact)

The primary deliverable for the Fabrick Partner program in the Research/HPC vertical. Ships as a documented integration kit delivered by the named Partner engineer — not a product feature gate. Fabrick licensing (per-VM RBAC + resource quotas) is required for the integration to deliver its full value.

### Integration Kit Components

| Artifact | Description | Effort |
|---|---|---|
| **NixOS module template** | Declares SLURM + Weaver on the same NixOS host; configures head node, submit nodes, and compute nodes declaratively in a single flake | M |
| **Prolog script** | Calls Weaver Live Provisioning API to create a hardware-isolated MicroVM for the SLURM job; passes job resource requirements (CPU, memory, GPU count) as VM spec | S |
| **Epilog script** | Calls Weaver API to destroy the MicroVM at job completion; returns node to a provably clean baseline | S |
| **GPU quota bridge** | Configuration template linking SLURM GRes plugin allocations to Weaver resource quotas; governs shared GPU access between SLURM batch jobs and interactive Weaver workloads | S |
| **Multi-compliance-regime template** | NixOS managed bridge configuration for concurrent NIH/DoD/NSF isolation zones on shared hardware; per-VM RBAC policy mapping by funding source | M |
| **Integration guide** | Step-by-step deployment guide for Partner engineers; covers head node setup, API service account + JWT auth, job isolation validation, and GPU sharing verification | M |

### Tier Requirements

| Feature | Required for | Why |
|---|---|---|
| Live Provisioning API | Weaver+ | The prolog/epilog integration backend |
| Resource quotas | Fabrick | GPU sharing governance between SLURM batch jobs and interactive workloads |
| Per-VM RBAC | Fabrick | Multi-tenant job isolation per compliance regime (NIH/DoD/NSF on shared hardware) |
| Managed bridges | Weaver+ | Network isolation per funding source |

### Delivery Model

This is not a gated product feature — it is a Partner program deliverable. The named Partner engineer:
1. Deploys the NixOS module template for the customer's cluster configuration
2. Configures and tests prolog/epilog scripts against the customer's SLURM version
3. Sets up the GPU quota bridge for the customer's hardware profile
4. Validates multi-compliance-regime isolation if applicable
5. Maintains the integration across Weaver and SLURM version upgrades

Any customer with Fabrick + SLURM can replicate this manually using the public Weaver API. The Fabrick Partner program pays for the named engineer who builds it, maintains it, and guarantees it works.

---

## Design Decisions

### Podman Network Topology — Rootful vs Rootless

When building the container network map for v1.2:

**Rootful Podman** (NixOS `virtualisation.oci-containers` default) creates a host-visible bridge (`podman0`, `10.88.0.0/16`) — structurally identical to `docker0`. Render it the same way as the Docker bridge on the network map.

**Rootless Podman** uses slirp4netns — no host bridge. Appears only as port annotations on the host node, not as a bridge with connected container nodes.

In practice, NixOS users running systemd container services are rootful by default, so the bridge model applies to most deployments.

**Podman pods** (shared network namespace): render a pod as a single topology node with multiple service labels inside — cleaner than individual container nodes and maps to Kubernetes semantics. This directly supports the "Podman substitute" positioning (Decision #54): Weaver surfaces pod topology that Podman CLI cannot show.

**Pod detection:** check `podman pod ps` output or inspect the `io.podman.annotations.pod-id` label on the container. Containers sharing a pod-id are grouped into one topology node.

---

## Release Plan

| Version | Milestone | Key Features | Status |
| --- | --- | --- | --- |
| v1.2.0 | Full Container Management | Apptainer/Docker/Podman actions, GPU passthrough, creation dialog, RBAC, firewall templates — **the closer** | Planned |

---

---

## v3.3 Scaffold (invisible — ships in this version)

Auth-sso is the IdP prerequisite for workload group sync (Decision #84). While it
ships here as a standalone feature, two invisible pieces land alongside it that
the v3.3 FM fast-track depends on.

| Task | Notes |
|------|-------|
| DB: `workload_groups` table stub | Schema only — no routes, no UI. Columns: `id`, `name`, `description`, `owners` (JSON), `idp_group_dn`, `members` (JSON), `created_at`, `updated_at`. Adding the table now means v3.3 has no migration against live customer data. |
| DB: `access_requests` table stub | Schema only. Columns: `id`, `requester_id`, `group_id`, `steps` (JSON — ApprovalStep[]), `status`, `expires_at`, `reason`, `created_at`, `updated_at`. State machine shape locked at this version. |

These tables are empty and have no API exposure. They exist so that when an FM
customer needs v3.3 features early, the DB side requires zero migration work.

*See [plans/v3.3.0/EXECUTION-ROADMAP.md](../v3.3.0/EXECUTION-ROADMAP.md) for full context.*

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
