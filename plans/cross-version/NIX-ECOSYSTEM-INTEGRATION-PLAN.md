<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Nix Ecosystem Integration Plan
## Leveraging NixOS/Nix Packages to Strengthen Weaver

**Date:** 2026-03-10
**Last updated:** 2026-04-01
**Type:** Cross-version feature plan
**Parent:** [MASTER-PLAN.md](../../MASTER-PLAN.md)

---

## Overview

The Nix ecosystem contains mature, well-maintained packages that solve problems Weaver would otherwise need to build from scratch. This plan evaluates each integration, assigns it to a version based on dependency chains and business impact, and identifies the tier gating.

---

## Integration Matrix

### Legend

- **Effort:** S (days), M (1-2 weeks), L (2-4 weeks)
- **Impact:** Revenue (drives tier upgrades), Moat (defensibility vs competitors), DX (developer/admin experience), Compliance (regulatory selling point)

---

## v1.1.0 — Container Visibility + Tier Infrastructure

These integrations have zero dependencies on future work and directly improve the v1.1 value proposition.

### 1. nix-ld — Run Unpatched Binaries on NixOS Guests

| Attribute | Value |
|-----------|-------|
| **Package** | [github.com/Mic92/nix-ld](https://github.com/Mic92/nix-ld) |
| **What it does** | Enables unpatched dynamically-linked Linux binaries to run on NixOS without wrapping |
| **Weaver use** | Include `nix-ld` in VM templates so researchers/users can download and run pre-built CUDA toolkits, proprietary software, VS Code Server, etc. without NixOS friction |
| **Tier** | Free (host-level NixOS module config) |
| **Effort** | S — add to NixOS module defaults |
| **Impact** | DX — removes the #1 objection to NixOS guests ("my binaries don't work") |
| **Implementation** | Add `programs.nix-ld.enable = true;` to the Weaver NixOS module and to VM templates that target general-purpose workloads |
| **Why v1.1** | Zero risk, zero complexity, massive objection removal. Should ship as early as possible |

### 2. nixos-generators — VM Image Export

| Attribute | Value |
|-----------|-------|
| **Package** | [github.com/nix-community/nixos-generators](https://github.com/nix-community/nixos-generators) |
| **What it does** | Generates NixOS images in various formats: QCOW2, raw, ISO, VirtualBox OVA, AMI, Azure VHD, etc. |
| **Weaver use** | "Export VM as image" — export a VM's declarative config as a portable image for sharing, migration, or cloud deployment |
| **Tier** | Weaver (part of config export/import story, but image generation is distinct from config export) |
| **Effort** | M — backend route + UI button + format selector, nixos-generators does the heavy lifting |
| **Impact** | Revenue + Moat — no competitor offers "declarative VM → portable image in 12 formats." Migration funnel accelerator |
| **Implementation** | `POST /api/vms/:name/export-image` with format parameter. Async job (image builds take minutes). Download link when complete. Pairs with v1.6 config export but is independently useful |
| **Why v1.1** | Homelab credibility feature ([HOMELAB-CREDIBILITY-FEATURES.md](../v1.1.0/HOMELAB-CREDIBILITY-FEATURES.md)). Users expect image export. Also enables the appliance VM distribution (Decision #21) |
| **Note** | Could defer to v1.4 if v1.1 scope is too large, but the backend is simple — nixos-generators is a thin wrapper |

### 3. home-manager — Per-User VM Customization

| Attribute | Value |
|-----------|-------|
| **Package** | [github.com/nix-community/home-manager](https://github.com/nix-community/home-manager) |
| **What it does** | Manages user-level environment (shell, editor, dotfiles, packages) declaratively |
| **Weaver use** | Separation of concerns in multi-user VMs: admins control the system config (NixOS), users customize their own environment (Home Manager). Critical for research/HPC where PIs want control but admins need governance |
| **Tier** | Weaver (VM template option) |
| **Effort** | S — documentation + template inclusion. Home Manager is a NixOS module, not a dashboard feature |
| **Impact** | DX + Revenue — enables "researcher self-service within guardrails" story for research/HPC vertical |
| **Implementation** | Include Home Manager as an optional module in VM templates. Weaver doesn't manage Home Manager directly — it's a VM-internal concern. Document the pattern in the admin guide |
| **Why v1.1** | Low effort, high value for the research/HPC pitch. Template enhancement, not a product feature |

---

## v1.2.0 — Full Container Management + Firewall (The Closer)

These integrations support the security hardening and compliance features shipping in v1.2.

### 4. sops-nix — Secret Management

| Attribute | Value |
|-----------|-------|
| **Package** | [github.com/Mic92/sops-nix](https://github.com/Mic92/sops-nix) |
| **What it does** | Manages secrets (API keys, passwords, certificates) encrypted at rest in the Nix store using SOPS (age, GPG, or cloud KMS) |
| **Weaver use** | **Secrets in VM configs** — database passwords, API keys, TLS certificates declared in Nix but encrypted at rest. Decrypted only at deploy time. Audit trail shows who changed a secret (commit) without exposing the value |
| **Tier** | Fabrick (tier-gated, see Decision #96) |
| **Effort** | M — integrate sops-nix into the NixOS module, add UI for secret references in VM config, key management setup in onboarding |
| **Impact** | Compliance + Revenue — **table stakes for every compliance sale.** NIST 800-171 (AC-3, SC-28), HIPAA (§164.312), PCI DSS (Req 3), CMMC. Every defense, healthcare, and financial services prospect will ask "how do you handle secrets?" |
| **Implementation** | 1) Add sops-nix to the Weaver NixOS module. 2) Backend: `POST /api/secrets` manages secret references (name → sops path). 3) VM config UI: secret picker for sensitive fields (passwords, keys). 4) Setup wizard: key generation (age keypair) during first-run. 5) Secrets never transit the dashboard API in plaintext — they're referenced by name and resolved by sops-nix at deploy time |
| **Why v1.2** | Ships alongside AppArmor/Seccomp hardening features. Completes the "security stack" that Fabrick customers expect. v1.1 is too early (security hardening features are v1.2) |
| **Decision** | **Resolved: sops-nix** (Decision #73). sops-nix supports more backends (age, GPG, AWS KMS, GCP KMS, Azure Key Vault). agenix is simpler (age-only, SSH key reuse) but too limited for Fabrick compliance requirements |

### 5. impermanence — Ephemeral Root Filesystem

| Attribute | Value |
|-----------|-------|
| **Package** | [github.com/nix-community/impermanence](https://github.com/nix-community/impermanence) |
| **What it does** | Makes the root filesystem ephemeral (tmpfs or ZFS rollback) — only explicitly declared state persists across reboots |
| **Weaver use** | **Security-hardened VMs** — root filesystem resets on every boot. Malware, accumulated state, unauthorized modifications are wiped automatically. Only declared services and data persist. "Your VMs are born clean every time" |
| **Tier** | Fabrick (tier-gated) |
| **Effort** | M — NixOS module integration + UI toggle per VM + persistence declaration UI (which paths survive reboot) |
| **Impact** | Moat + Compliance — **no competitor offers this.** Proxmox, VMware, cloud VMs all accumulate state. Impermanence is a category-defining security feature. NIST 800-171 SI-7 (Software & Information Integrity), CIS benchmark alignment. The defense/government vertical will pay for this alone |
| **Implementation** | 1) Add impermanence module to VM NixOS config. 2) UI: per-VM toggle "Ephemeral root" (off by default). 3) UI: persistence declaration — list of paths that survive reboot (e.g., `/var/lib/postgresql`, `/home`). 4) Weaver indicator: "ephemeral" badge on VM cards. 5) AI diagnostics: explain "file disappeared after reboot" as expected impermanence behavior |
| **Why v1.2** | Ships with hardening features. Impermanence is conceptually part of the hardening stack. Also: already referenced in the v3.0 edge management plan ([microvm-anywhere-nix-templates.md](../../research/microvm-anywhere-nix-templates.md)) — shipping it in v1.2 means edge (v3.0) gets it for free |
| **Note** | The microvm-anywhere research doc already has impermanence patterns. Implementation is proven |

### 6. lanzaboote — Secure Boot

| Attribute | Value |
|-----------|-------|
| **Package** | [github.com/nix-community/lanzaboote](https://github.com/nix-community/lanzaboote) |
| **What it does** | Implements UEFI Secure Boot for NixOS — signed bootloader, signed kernel, full chain of trust from firmware to userspace |
| **Weaver use** | **Host hardening for compliance-sensitive deployments.** Secure Boot chain proves the host hasn't been tampered with from UEFI through kernel through NixOS to Weaver. Critical for CMMC Level 2 (SC.L2-3.13.11), NIST 800-171, and defense/government deployments |
| **Tier** | Fabrick (tier-gated) |
| **Effort** | S — lanzaboote is a NixOS module. Weaver integration is documentation + a "Secure Boot status" indicator on the host info page |
| **Impact** | Compliance — Secure Boot is a checkbox on every government/defense RFP. Without it, we can't credibly sell to CMMC-pursuing organizations |
| **Implementation** | 1) Document lanzaboote setup in the deployment guide. 2) Weaver: detect Secure Boot status via `bootctl status` or `/sys/firmware/efi`. 3) Host info page: "Secure Boot: Enabled/Disabled" indicator. 4) Compliance report: include Secure Boot status in audit evidence export |
| **Why v1.2** | Ships with the hardening stack (AppArmor, Seccomp, impermanence). S effort, zero dependencies on multi-node or any other feature. Secure Boot is a compliance checkbox that defense/gov prospects will ask about from day one — waiting until v3.0 means losing those prospects at v1.x |

---

## v1.6.0 — Config Export/Import

### 6. nixos-generators (full integration)

The v1.1 integration adds basic image export. v1.6 extends it with:

- Export VM config + image together as a portable bundle
- Import from external NixOS configs (parse `configuration.nix` → VmInfo)
- Format conversion: Proxmox `.conf` → NixOS config → QCOW2 image (via nixos-generators)

This is a natural extension of the v1.6 config export/import scope (Decision #74). No separate plan needed — it fits within the [v1.6 EXECUTION-ROADMAP](../v1.6.0/EXECUTION-ROADMAP.md).

---

## v2.3.0 — Fabrick Basic Clustering

These integrations enable the multi-node architecture and fleet management.

### 7. nixos-anywhere + disko — Zero-Touch Node Onboarding

| Attribute | Value |
|-----------|-------|
| **Package** | [github.com/nix-community/nixos-anywhere](https://github.com/nix-community/nixos-anywhere) + [github.com/nix-community/disko](https://github.com/nix-community/disko) |
| **What they do** | nixos-anywhere: Install NixOS on any machine via SSH (from any Linux). disko: Declarative disk partitioning as a NixOS module |
| **Weaver use** | **Remote node onboarding for multi-node (v2.3 Fabrick clustering).** Customer has bare metal or a running Linux box → dashboard triggers nixos-anywhere → NixOS installed with Weaver agent + disko disk layout → node joins the cluster automatically |
| **Tier** | Fabrick (multi-node is Fabrick) |
| **Effort** | L — significant integration: SSH credential management, progress tracking, error handling, disko layout templates, agent auto-registration |
| **Impact** | Revenue + DX — "Point us at bare metal, we'll do the rest." Eliminates the biggest friction in multi-node adoption: installing NixOS on each node manually. Fabrick Adopt/Accelerate service differentiator |
| **Implementation** | 1) Hub dashboard: "Add Node" wizard. 2) Input: SSH host + credentials (or key). 3) disko template selector (RAID, LVM, ZFS — pre-built layouts). 4) Hub triggers nixos-anywhere over SSH. 5) Progress UI (nixos-anywhere outputs). 6) Post-install: agent starts, connects to hub, node appears in dashboard. 7) Error handling: rollback if install fails |
| **Why v2.3** | Depends on the Fabrick clustering architecture (v2.3). No value without multi-node. nixos-anywhere is already referenced in the v3.0 edge plan ([MASTER-PLAN Decision #35](../../MASTER-PLAN.md)) — shipping the integration at v2.3 means edge (v3.0) reuses it |
| **Note** | Also powers the NixOS appliance trial (Decision #21) — nixos-anywhere can install a pre-configured Weaver appliance on customer hardware |

### 8. colmena — Fleet Deployment Engine

| Attribute | Value |
|-----------|-------|
| **Package** | [github.com/zhaofengli/colmena](https://github.com/zhaofengli/colmena) |
| **What it does** | Deploy NixOS configurations to multiple machines in parallel. Supports deployment groups, rollback, and diff previews |
| **Weaver use** | **Multi-node config push** — when the hub has a new VM config or system update, Colmena pushes it to the target agent node. Replaces the need to build a custom deployment protocol |
| **Tier** | Fabrick (multi-node) |
| **Effort** | M — Colmena integration as the deployment backend for hub → agent config pushes. Alternative: deploy-rs (simpler, built-in rollback). **Decision needed at v2.3 planning time** |
| **Impact** | DX + Moat — battle-tested deployment vs building our own. Colmena handles diff previews, parallel deploys, rollback — all features Fabrick customers expect |
| **Implementation** | Hub generates per-node NixOS configs → Colmena deploys them. Weaver shows deployment status per node. Rollback UI triggers Colmena rollback |
| **Why v2.3** | Core multi-node infrastructure. Without a deployment engine, hub-agent is just monitoring — Colmena makes it a management plane |
| **Decision** | Colmena vs deploy-rs. Colmena: more features (parallel, groups, diff preview), actively maintained, Flake-native. deploy-rs: simpler, built-in magic rollback (auto-rollback if activation fails). **Recommendation:** Colmena — its feature set maps closer to what Fabrick customers need (fleet operations, deployment groups). deploy-rs's magic rollback is elegant but Colmena's explicit rollback is more auditable |

### 9. attic — Self-Hosted Binary Cache

| Attribute | Value |
|-----------|-------|
| **Package** | [github.com/zhaofengli/attic](https://github.com/zhaofengli/attic) |
| **What it does** | Self-hosted Nix binary cache with deduplication, garbage collection, and multi-tenant support |
| **Weaver use** | **Fast VM provisioning in air-gapped environments.** First build of a VM config is slow (Nix builds from source). Attic caches the result — every subsequent provision of the same config is a binary download. Critical for: 1) air-gapped environments (defense, national labs), 2) burst provisioning (Hydra workers, conference clusters), 3) multi-node (build once on hub, cache, deploy to all agents) |
| **Tier** | Fabrick (tier-gated) |
| **Effort** | M — bundle Attic as an optional NixOS service. Weaver config page for cache settings. Point Nix at the local cache |
| **Impact** | Revenue + DX — solves "Nix builds are slow" complaint. Air-gap customers (defense, national labs) **cannot use cache.nixos.org** — Attic is the answer. Multi-node provisioning goes from 10 minutes to 30 seconds |
| **Implementation** | 1) NixOS module: optional Attic service on the hub/single-node. 2) Auto-configure `nix.settings.substituters` to include local Attic. 3) Weaver: cache statistics page (hits, misses, disk usage, GC). 4) Multi-node: hub runs Attic, agent nodes use it as their binary cache |
| **Why v2.3** | Maximum value with multi-node (build once, deploy everywhere). Also valuable for single-node (faster reprovisioning) but the ROI is lower. Bundle with clustering launch |
| **Note** | Attic is written by the same author as Colmena (zhaofengli) — the two are designed to work together |

### 10. nixos-facter — Hardware Auto-Discovery

| Attribute | Value |
|-----------|-------|
| **Package** | [github.com/numtide/nixos-facter](https://github.com/numtide/nixos-facter) |
| **What it does** | Detects hardware capabilities: CPU model/cores, RAM, GPUs, NICs, storage devices, virtualization extensions |
| **Weaver use** | **Auto-discovery for cluster nodes.** When a node joins the cluster, nixos-facter reports its capabilities. Weaver shows hardware inventory across the cluster. Resource quota recommendations based on actual hardware ("this node has 4x A100s — allocate 1 per research group") |
| **Tier** | Fabrick (clustering) |
| **Effort** | S — run nixos-facter on agent startup, report results to hub |
| **Impact** | DX — admins see what they have without SSHing into each node. Enables smart scheduling ("place this GPU VM on a node that has GPUs") |
| **Implementation** | Agent runs `nixos-facter` at startup → sends JSON report to hub. Weaver: "Cluster Inventory" page showing per-node hardware. Scheduling hints for VM placement |
| **Why v2.3** | Maximum value with clustering. Single-node benefit is minimal (you know what your one machine has) |

---

## v3.0.0 — Advanced Clustering + Edge Management

### 11. nix-topology — Auto-Generated Network Diagrams

| Attribute | Value |
|-----------|-------|
| **Package** | [github.com/oddlama/nix-topology](https://github.com/oddlama/nix-topology) |
| **What it does** | Generates network topology diagrams directly from NixOS configuration — nodes, links, VLANs, services |
| **Weaver use** | **Topology view derived from actual config.** Instead of the dashboard inferring topology from runtime state (current approach), nix-topology generates it from the declared Nix config. The topology is provably accurate by construction — it shows what's declared, not what's guessed |
| **Tier** | Weaver (topology is already Weaver) |
| **Effort** | L — significant integration: parse nix-topology output, merge with runtime state, render in v-network-graph. The challenge is combining declared topology (nix-topology) with live state (WebSocket updates) |
| **Impact** | Moat — **"topology that's correct by construction"** is a pitch no competitor can make. Proxmox shows runtime state (might be wrong). VMware shows what vCenter thinks (might be stale). Weaver shows what the Nix config declares (provably correct) + live status overlay |
| **Implementation** | 1) Generate nix-topology output from the host's NixOS config. 2) Parse into the dashboard's topology data model. 3) Overlay live VM status (running/stopped) from WebSocket. 4) Diff view: "declared topology vs runtime state" — highlights VMs that exist in config but aren't running (or vice versa) |
| **Why v3.0** | The current topology view (v1.0 runtime-inferred, v1.1 elbow routing) works well for single-node. nix-topology's value explodes with multi-node clustering where the declared config spans multiple hosts. Also: the diff view ("declared vs actual") is a compliance feature — auditors love it |
| **Note** | Could prototype at v2.3 for single-node, but the full value requires multi-node topology spanning hosts |

### ~~12. lanzaboote — Secure Boot~~ → Moved to v1.2.0

Lanzaboote moved to v1.2.0 with the rest of the hardening stack. See [v1.2.0 section](#5-impermanence--ephemeral-root-filesystem) above. Rationale: S effort, zero dependencies, compliance checkbox that defense/gov prospects need from day one. No reason to wait for v3.0.

---

## Summary: Version Targeting

| Version | Integration | Tier | Effort | Primary Impact |
|---------|-------------|------|--------|----------------|
| **v1.1** | nix-ld | Free | S | DX — remove NixOS binary objection |
| **v1.1** | nixos-generators (basic) | Weaver | M | Revenue — image export, appliance distribution |
| **v1.1** | home-manager | Weaver | S | DX — researcher self-service templates |
| **v1.2** | **sops-nix** | Fabrick | M | **Compliance — table stakes for every compliance sale** |
| **v1.2** | **impermanence** | Fabrick | M | **Moat — no competitor has ephemeral-root VMs** |
| **v1.2** | **lanzaboote** | Fabrick | S | **Compliance — Secure Boot for defense/gov RFPs** |
| **v1.6** | nixos-generators (full) | Weaver | — | Bundled with config export/import scope |
| **v2.3** | **nixos-anywhere + disko** | Fabrick | L | **Revenue — zero-touch multi-node onboarding** |
| **v2.3** | **colmena** | Fabrick | M | DX — fleet deployment engine |
| **v2.3** | **attic** | Fabrick | M | **Revenue — fast provisioning, air-gap support** |
| **v2.3** | nixos-facter | Fabrick | S | DX — hardware auto-discovery for clusters |
| **v3.0** | nix-topology | Weaver | L | Moat — topology correct by construction |

---

## Decisions Needed

| # | Decision | Options | Recommendation | Decide By |
|---|----------|---------|----------------|-----------|
| ~~A~~ | ~~Secret management backend~~ | ~~sops-nix vs agenix~~ | **Resolved: sops-nix** — Decision #73. KMS support needed for Fabrick compliance | Decided |
| B | Deployment engine | Colmena vs deploy-rs | **Colmena** — fleet ops, parallel deploy, diff preview match Fabrick needs. Recommendation stands; final decision at v2.3 planning | v2.3 planning |
| C | nix-topology timing | v2.3 prototype vs v3.0 full | **v3.0 full** — single-node topology works fine; multi-node is where it shines. Recommendation stands; confirmed v3.0 | v2.3 planning |
| ~~D~~ | ~~lanzaboote fast-track~~ | ~~Ship with v1.2 hardening or defer to v3.0~~ | **Resolved: v1.2** — S effort, zero dependencies, no reason to wait | Decided 2026-03-10 |

---

## Competitive Moat Analysis

These integrations collectively create a defensive position no competitor can replicate without adopting NixOS:

```
Layer 1 (v1.1-1.2):  nix-ld + home-manager + sops-nix + impermanence + lanzaboote
                      → "NixOS VMs that just work, with secrets encrypted
                         at rest, roots that reset every boot, and Secure
                         Boot chain from firmware to userspace"

Layer 2 (v2.3):       nixos-anywhere + disko + colmena + attic
                      → "Point us at bare metal, we'll install NixOS,
                         configure it, cache the builds, and manage
                         the fleet — zero touch"

Layer 3 (v3.0):       nix-topology + impermanence (edge)
                      → "Topology that's provably correct, edge nodes
                         that reset to clean state on every power cycle,
                         and Secure Boot already shipping since v1.2"
```

Each layer builds on the previous. By v3.0, the NixOS ecosystem integration is so deep that switching to Weaver means switching to a fundamentally different (better) infrastructure model — not just a different dashboard.

---

*This plan should be registered in [MASTER-PLAN.md](../../MASTER-PLAN.md) under Cross-version plans and referenced from version-specific EXECUTION-ROADMAPs as integrations are scheduled.*
