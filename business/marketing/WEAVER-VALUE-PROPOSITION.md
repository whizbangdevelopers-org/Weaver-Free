<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver Value Proposition — Solo ($249/yr) and Team ($199/user/yr)

**Date:** 2026-03-04 | **Updated:** 2026-03-27
**Purpose:** Justify Weaver pricing against Proxmox and the "roll your own" approach. Progressive competitive knockout timeline.
**Companion:** [FABRICK-VALUE-PROPOSITION.md](FABRICK-VALUE-PROPOSITION.md) (enterprise justification at $2,000+/yr)

---

## Pricing

| Plan | RAM | FM Price | Standard Price | FM Cap | Billing |
|------|:---:|:--------:|:--------------:|:------:|---------|
| Weaver Solo | 128GB | **$149/yr** (first 200, locked forever) | **$249/yr** (post-v1.2) | v1.2 or 200 cap | Annual or quarterly |
| Weaver Team | 128GB/host | **$129/user/yr** (first 50 teams, locked forever) | **$199/user/yr** (post-v2.2) | v2.2 or 50 cap | Annual only (FM opens at v2.1) |
| Fabrick | 256GB/node | **$1,299/yr/node** (first 20, forever) | $2,000 (v1.0) · $2,000 (v2.2+) · $3,500 (v3.0+) | v2.2 | Annual |
| Fabrick | 512GB/node | **$1,750/yr/node** (first 10, forever) | $2,500 (v1.0) · $3,000 (v2.2+) · $3,500 (v3.0+) | v2.2 | Annual |

FM price = pre-cap standard, locked forever. Standard steps up at major version milestones as delivered value grows. See [FOUNDING-MEMBER-PROGRAM.md](FOUNDING-MEMBER-PROGRAM.md) and [PRICING-POWER-ANALYSIS.md](PRICING-POWER-ANALYSIS.md).

---

## The Weaver Buyer

### Weaver Solo — $149/yr

Weaver Solo targets **self-hosting sysadmins and self-hosters** who are either:
- Running Proxmox and paying €355–1,060/yr/socket for a Debian-locked, dated UI
- Running scripts + systemd units and losing hours to manual management
- Running Cockpit/virt-manager and hitting their single-node, no-VM-creation ceiling

**The pitch:** "Everything Proxmox Community charges €355/socket for — plus Live Provisioning, multi-hypervisor, AI diagnostics, and a modern UI. $249/yr standard. Or $149/yr as a Founding Member before The Closer ships."

**The sysop-as-champion buyer (key acquisition path):** 81% of self-hosters work in tech professionally (selfh.st 2025 survey). Weaver Solo at $149/yr is frequently an out-of-pocket professional evaluation — the buyer is a sysadmin assessing Weaver for potential workplace adoption on their own hardware first. This is the bottom-up GTM motion: home lab evaluation → workplace champion → Fabrick contract. A $149 Weaver purchase that converts to a 10-node Fabrick deployment is a 53× return on acquisition cost. Pricing that frictionlessly captures this person — no friction, no credit card interrogation — is the highest-leverage decision in the entire pricing model.

### Weaver Team — $129/user/yr FM · $199/user/yr standard

Weaver Team targets **small technical teams (2–4 people) running distributed infrastructure** — the remote LLM box, the backup server, the secondary site. These teams don't need full Fabrick governance, but they need more than a Solo license covering one node.

**Ships v2.2.0.** Seats: 2–4 users + 1 viewer free.

**The pitch:** "Manage all your hosts in one view — full management across up to 2 remote Weaver nodes, Tailscale auto-discovery, for $129/user/yr FM (standard $199/user/yr post-v2.2)."

**The defining feature — remote peer management:** Up to 2 remote Weaver hosts appear inside the local Weaver view with full management access. Remote workloads show up in Weaver alongside local ones. Every workload card carries a host badge identifying which node it lives on. All management actions are available on remote peers — restart, provision, stop, manage.

**Peer discovery:** Zero-config with Tailscale MagicDNS — Weaver finds peer hosts automatically from an existing Tailscale network. Manual IP entry is available for non-Tailscale setups. Peer protocol: REST + WebSocket.

**The upgrade trigger is built in:** Two ceiling moments — (1) "I need more than 2 remote peers" as the team's infrastructure grows; (2) "I shifted bridge traffic but nobody approved it" on a blue/green deployment. Both are the Weaver Team ceiling. The 2-peer cap is the natural pressure point that converts distributed teams into Fabrick contracts when they need fleet-scale governance, per-VM RBAC, and resource quotas.

**RAM:** Up to 128GB RAM per host (same as Solo).

---

## Feature Arc Inventory

### Shipped (v1.0.0)

| Arc | What Ships | Weaver Value |
|-----|-----------|---------------|
| Core Weaver | VM CRUD, WebSocket, serial console, tags, help, wizard | Table stakes — but modern UI already beats Proxmox's ExtJS |
| AI Diagnostics | Admin-managed AI credential vault (frontier + application-specific AI), streaming diagnostics, mock fallback, per-user AI infrastructure protection | **No competitor has this.** Admin controls which AI vendor, no per-user key management overhead. Built-in rate limits protect API spend, GPU compute, and host resources regardless of AI deployment model (Decision #128) |
| Multi-Hypervisor | QEMU, Cloud Hypervisor, crosvm, kvmtool, Firecracker | **5 hypervisors from one interface.** Proxmox = QEMU only |
| Live Provisioning | Create/provision/delete VMs without `nixos-rebuild switch` | **Category-defining.** Zero host rebuilds, self-service VM creation |
| Bridge Management | Create/delete managed bridges, IP pools | Weaver infrastructure management |
| Auth & Security | JWT, RBAC, per-VM ACL (enterprise), 5 audit domains | Production-ready security posture |
| Tier Gating | `requireTier()` middleware, AI cost protection rate limits, license keys | Revenue infrastructure + API spend guardrails in place |
| Demo Site | GitHub Pages, tier-switcher, 8 mock VMs, hCaptcha | Conversion funnel live |
| TUI Client | React/Ink, 97% feature parity, 183 tests | SSH-first operators get a first-class experience |

### Planned — v1.1.0 (Container Visibility + DNS + Topology + Auth Extensions)

| Arc | Planning Doc | Weaver Value |
|-----|-------------|---------------|
| Container Visibility | [EXECUTION-ROADMAP.md](../../plans/v1.1.0/EXECUTION-ROADMAP.md) (Phase 7a) | See Apptainer + Docker + Podman containers alongside VMs. **No competitor does this.** |
| DNS Extension | [DNS-PLAN.md](../../plans/v1.1.0/DNS-PLAN.md) | `.vm.internal` auto-zone, resolver, DHCP integration. First purchasable extension |
| Topology Elbows | [TOPOLOGY-ELBOW-ROUTING-PLAN.md](../../plans/v1.1.0/TOPOLOGY-ELBOW-ROUTING-PLAN.md) | Orthogonal edge routing — datacenter-grade network visualization. Foundation for plugin overlays |
| Service Health Probes | [SERVICE-HEALTH-PROBES-PLAN.md](../../plans/v1.1.0/user-action-docs/SERVICE-HEALTH-PROBES-PLAN.md) | Per-VM TCP/HTTP health checks, aggregate status display |
| Integrated Extensions Framework | `requirePlugin()` middleware (Decision #22) | Architecture for purchasable feature domains |
| Auth Extensions (TOTP/FIDO2) | Decision #28, #42 | TOTP included in Weaver. FIDO2 included in Weaver (unlocked for Yubico TA customers via OAuth). See [TECHNOLOGY-ALLIANCES.md](TECHNOLOGY-ALLIANCES.md) |
| Windows Guest Enhancements | UEFI/OVMF + VirtIO drivers ISO | Win 11 support (UEFI) + 3–5x I/O perf (VirtIO). VMware/Proxmox Windows migration path. BYOISO shipped v1.0 |

### Planned — v1.2.0 (Full Container Management — "The Closer")

| Arc | Planning Doc | Weaver Value |
|-----|-------------|---------------|
| Container Management | [EXECUTION-ROADMAP.md](../../plans/v1.2.0/EXECUTION-ROADMAP.md) (Phase 7b) | Create, start, stop, delete containers. Apptainer actions, Docker/Podman, unified creation flow |
| Firewall Extension | [FIREWALL-TEMPLATE-PLAN.md](../../plans/v1.2.0/FIREWALL-TEMPLATE-PLAN.md) | nftables presets, custom rules, egress control. Purchasable at Weaver minimum |
| GPU Passthrough (NVIDIA, AMD, Intel) | Phase 7b | Vendor-agnostic VFIO-PCI passthrough — exclusive GPU-per-VM isolation for AI inference, HPC simulation, 3D rendering, VDI, and video transcoding. Any PCIe GPU works. Three-path model: GPU VM (QEMU, hardware isolation), GPU container (Podman + vendor toolkit, fast iteration), CPU-only VM (Firecracker, lightweight). Decision #113 |

### Planned — v1.4.0 (AI Agent + Bridge Active Routing)

| Arc | Planning Doc | Weaver Value |
|-----|-------------|---------------|
| Bridge Active Routing | Decision #112 | Bridges gain weighted traffic distribution — the bridge becomes an inference load balancer. Multiple inference VMs behind one bridge, AI-managed weights based on latency/throughput. Blue/green model deployment: clone VM with new model → shift weight → health check → confirm/rollback. No separate load balancer, no NGINX, no HAProxy. Also serves traditional workloads: HPC job distribution, VDI session balancing, any multi-instance service |
| AI Credential Vault | Decision #73 | Admin-managed frontier model keys + application-specific AI credentials. SQLCipher encrypted, sops-nix provisioned, Live Provisioning compliant |

### Planned — v2.0.0+ (Storage, Templates, Multi-Node)

| Arc | Planning Doc | Weaver Value |
|-----|-------------|---------------|
| Disk Provisioning | [DISK-PROVISIONING-PLAN.md](../../plans/v2.0.0/DISK-PROVISIONING-PLAN.md) | Disk lifecycle, hotplug, I/O limits |
| System Templating | [SYSTEM-TEMPLATING-PLAN.md](../../plans/v2.0.0/SYSTEM-TEMPLATING-PLAN.md) | Built-in archetypes, create-from-template, cloud-init |
| Snapshot Provisioning | Decision #119 | "Build once, run many." Auto-snapshot on successful health check. Subsequent deployments restore from snapshot: **2–5 sec** (QEMU memory snapshot, full RAM+VRAM state) or 10–30 sec (disk snapshot). Applies to all workloads — AI inference (model in VRAM on restore), HPC (environment pre-loaded), VDI (user session warm), rendering (project loaded). Rollback = restore previous snapshot (instant). Makes auto-scaling viable for any heavy workload |
| Model Library | Decision #118 | Shed-native registry of model references (name, source, version, GPU requirements, status). Testing → staging → production lifecycle. User provides model source (HuggingFace, S3, local); Weaver stores pointers, not weights. Combined with snapshot provisioning: full deployment workflow from Shed in seconds |
| Backup & Recovery | [BACKUP-RECOVERY-PLAN.md](../../plans/v2.0.0/BACKUP-RECOVERY-PLAN.md) | BYOB plugin model (restic, borg, S3). Open formats, no VMA lock-in |
| Import/Export | [EXECUTION-ROADMAP.md](../../plans/v2.0.0/EXECUTION-ROADMAP.md) (Phases 8a–8b) | Proxmox `.conf` parser, Libvirt XML parser, Dockerfile dual output |
| Multi-Node | [V2-MULTINODE-PLAN.md](../../plans/v2.0.0/V2-MULTINODE-PLAN.md) | Hub-agent architecture, node registry, cross-node topology |
| Edge Computing | Extension of multi-node + [microvm-anywhere templates](../../research/microvm-anywhere-nix-templates.md) | Deploy/reprovision microVMs on remote NixOS edge nodes over SSH. Same templates work datacenter and edge. $22B market, 37% CAGR |
| Remote Access Wizards | [v1.3.0/EXECUTION-ROADMAP.md](../../plans/v1.3.0/EXECUTION-ROADMAP.md) | **Weaver gate: WireGuard wizard** — remote management without touching your firewall (self-hosted, air-gap friendly). Tailscale wizard is Free. Network Isolation Mode for compliance. One rebuild, remote access forever. |
| Capacitor Mobile | [v1.3.0/EXECUTION-ROADMAP.md](../../plans/v1.3.0/EXECUTION-ROADMAP.md) | Native iOS/Android (same Quasar codebase), biometric auth — **Weaver Free tier.** Push notifications + deep-link actions bundled with WireGuard remote management — **Weaver** (natural upgrade prompt within the remote-access story). |

### Unplanned (v3.0.0+)

| Arc | Notes |
|-----|-------|
| Monitoring / Sensors | Host + VM + container metrics, alerting, dashboards. Natural plugin domain (Prometheus, Grafana) |
| AI as VM Manager | Autonomous operations — AI gains write access. Major trust/safety design needed |
| Drag-and-Drop Topology | Visual resource management. Drag VMs onto bridges. Depends on networking backend |
| Marketplace / Extension Ecosystem | Registry, distribution, trust model for third-party extensions |

---

## Dependency Map

```
v1.0.0 (shipped)
├── Core dashboard + Live Provisioning + AI + multi-hypervisor + auth + TUI
└── Integrated Extensions infrastructure (requireTier, requirePlugin architecture)

v1.1.0
├── Container Visibility (Phase 7a) — Apptainer/Docker/Podman read-only
├── DNS Extension — first purchasable extension
├── Topology Elbows — visual foundation for plugin overlays
└── Service Health Probes — per-VM health monitoring

v1.2.0 ("The Closer")
├── Full Container Management (Phase 7b) — create/stop/delete containers
├── Firewall Extension — nftables presets, egress control
└── GPU Passthrough — NVIDIA/AMD/Intel via VFIO-PCI for inference, HPC, rendering, VDI

v1.4.0
├── Bridge Active Routing — bridge becomes inference LB + traffic controller
├── AI Credential Vault — admin-managed model keys
├── Cross-Resource AI Agent — full-stack AI diagnostics
└── AI blue/green (Solo) — clone, shift, confirm/rollback for model deployment

v2.0.0–v2.6.0 (Forge execution)
├── Disk Provisioning ──→ System Templating ──→ Backup & Recovery
│   (v2.0)                 (v2.1)                 (v2.4–v2.6)
├── Import/Export (v2.0 — config-only, then parsers)
├── Basic Clustering (v2.2 — multi-host visibility)
│   └── Multi-node visibility, manual migration, config sync
├── Edge Computing (v3.0 — extension of multi-node + microvm-anywhere templates)
└── Remote Access Wizards (Tailscale free, WireGuard Weaver) + Network Isolation Mode
    └── Capacitor Mobile + Push Notifications + Biometric Auth

v3.0.0+ (advanced)
├── Advanced Clustering — HA, live migration, shared storage
├── Monitoring / Sensors (plugin domain)
├── AI as VM Manager (autonomous operations)
├── Drag-and-Drop Topology
└── Marketplace / Extension Ecosystem
```

---

## Competitive Position vs Proxmox (Pegaprox)

### Audiences Where Proxmox Was Never Viable

| Audience | Why Proxmox Fails | When We Capture Them |
|----------|-------------------|---------------------|
| NixOS sysadmins | Proxmox requires Debian. Full stop. | v1.0.0 (Weaver Free tier) |
| Apptainer/HPC users | Proxmox has no Singularity/Apptainer awareness | v1.1.0 |
| AI-first operators | Proxmox will never add AI diagnostics | v1.0.0 (already shipped) |
| cloud-hypervisor users | Proxmox is KVM/QEMU only | v1.0.0 (already shipped) |

These users choose between us and **scripts + systemd units**, not us and Proxmox.

### NixOS Ecosystem Defensibility

The NixOS stack creates compound advantages no competitor can replicate:

1. **Full-stack declarative story** — NixOS module for the dashboard + microvm.nix for guests + Nix for packages. Infrastructure as code from host to guest to application. Nobody else has this.
2. **Distro catalog as infrastructure-as-code** — `distroCatalogUrl` NixOS option means available VM templates are declared in config, version-controlled, reproducible across hosts. Three-tier system (built-in → catalog → custom) is more sophisticated than any competitor's template system.
3. **Bit-for-bit reproducible VMs** — NixOS guest builds via flake produce identical VMs. Combined with the catalog, the exact same images deploy identically across environments.
4. **Growing underserved market** — NixOS adoption accelerating (NixOS Cloud, microvm.nix, NixVirt all launched 2024–2025). microvm.nix has no web UI, NixVirt is CLI-only. We fill this gap.

### Progressive Knockout (General Self-Hosting)

| Milestone | Who Stops Considering Proxmox | Proxmox Still Wins On |
|-----------|-------------------------------|----------------------|
| **v1.0.0** (shipped) | NixOS users, AI-curious, multi-hypervisor | Everything else — maturity, backup, clustering, community |
| **v1.1.0** | Apptainer/HPC, DNS users, Windows migrators (UEFI+VirtIO) | Backup, clustering, container management depth |
| **v1.2.0** ("Closer") | Users who want VMs + containers in one pane + GPU | Backup (vzdump/PBS mature), clustering, ZFS/Ceph |
| **v2.0.0** | Users burned by VMA lock-in, users who want disk portability | Clustering, community size, "it just works" reputation |
| **v1.3.0** | Users who want mobile access, remote management, network isolation | Backup, clustering, shared storage |
| **v2.1.0** | Users who value UX, templates | Backup depth (vzdump), clustering, shared storage |
| **v2.2.0** | Fabrick evaluators needing multi-node visibility + manual migration | HA, automatic failover, advanced clustering |
| **v2.4.0–v2.6.0** | Users with existing restic/borg (BYOB plugin model) | Advanced clustering features only |
| **v3.0.0** | Fabrick evaluators needing HA + live migration | Community size and r/homelab inertia (not a feature) |

### Clustering Strategy (v2.2 → v3.0)

Basic clustering at v2.2.0 is the earliest point prerequisites are met. This opens the enterprise clustering conversation years earlier than a v3.x-only timeline.

**Basic clustering (v2.2.0 — multi-host visibility):**
- Multi-node visibility (see all VMs across nodes)
- Manual VM migration (stop, transfer, start on target)
- Config synchronization (templates, settings)
- Cluster-aware dashboard (node selector, aggregate stats)

**Advanced clustering (v3.0.0 — moat destroyed):**
- Live migration (no-downtime transfer)
- HA / automatic failover
- Shared storage (Ceph, ZFS replication)
- Resource scheduling / automatic placement

**Why v2.2.0 is sufficient:** An enterprise user who gets multi-node visibility + manual migration + AI diagnostics + Apptainer + restic plugin will switch. Our compound advantages (AI, Apptainer, plugins, modern UI, NixOS-native) multiply in a clustered context. They don't need HA on day one — they need enough to get in the door, where our other advantages close the deal.

### Proxmox Weaknesses We Exploit

| Proxmox Weakness | Our Advantage | Ships In |
|-----------------|---------------|----------|
| Proprietary VMA backup format | Open formats + BYOB plugin model (restic/borg) | v2.4.0 |
| No Apptainer/Singularity | Apptainer-first container strategy | v1.1.0 |
| No AI diagnostics or management | AI agent with built-in infrastructure protection (diagnostics → autonomous management) | v1.0.0 → v3.0.0 |
| Debian-only | NixOS-native, declarative, reproducible | v1.0.0 |
| ExtJS UI (dated, not responsive) | Vue 3 + Quasar, mobile-ready, modern | v1.0.0 |
| KVM/QEMU only | 5 hypervisors (QEMU, Cloud Hypervisor, crosvm, kvmtool, Firecracker) | v1.0.0 |
| No extension ecosystem | Integrated Extensions framework (DNS → Firewall → Backup → Monitoring) | v1.1.0+ |
| Single backup ecosystem (VMA/PBS) | Multi-tool integration (restic, borg, S3) | v2.4.0 |
| Per-socket pricing (2 sockets = 2×) | Per-node pricing, simpler, cheaper | v1.0.0 |
| No mobile app | PWA (Free) + Capacitor native (Weaver) + push notifications | v1.0.0 / v1.3.0 |
| No safe host upgrade path | `test → health check → confirm → switch` — live and revertible; AI remediation loop fixes failures before reverting; LP eliminates routine rebuilds entirely; Path B clones standby VMs so production traffic never drops | v2.1.0 (MM) |
| No deployment automation | AI blue/green: clone → configure → shift bridge traffic → confirm/rollback — rolling updates without K8s | v1.4.0+ |
| Requires separate LB + deploy stack | Bridge = network switch + load balancer + blue/green controller — already deployed, no extra nodes or software | v1.4.0 (active routing) |

### Host Lifecycle Safety: LP + Maintenance Manager

Two complementary features that resolve the rebuild paradox:

**Live Provisioning** eliminates routine rebuilds for workload operations. Create VMs, update containers, reconfigure networking — no `nixos-rebuild switch`. The host is declared once; Weaver manages everything after that via API.

**Maintenance Manager** (v2.1.0) makes unavoidable rebuilds safe — kernel updates, package upgrades, flake transitions. Two paths depending on tier:

**Path A — Simple (Weaver Solo):** `nixos-rebuild test` applied directly to the live system. The AI health check validates affected `microvm@*` services, network state, and resource utilization after the rebuild settles. If validation fails, the AI remediation loop engages: diagnose root cause, propose a fix from a safe action set, execute, re-check. Up to 3 iterations before auto-reverting to the prior pinned generation on next reboot. No Proxmox, Ansible, or Puppet equivalent exists — none offer "apply it, see if it works, then auto-fix before deciding."

**Path B — Zero-downtime (Weaver Team):** LP + bridge routing turn the rebuild into a traffic management operation. (1) Clone active VMs to standby via LP API — API calls, seconds each; (2) Bridge shifts all traffic to standby clones; (3) `nixos-rebuild test` runs against production VMs while standby clones serve live traffic — zero production exposure; (4) AI proactively health-checks the rebuilt production VMs; (5) Confirm (bridge back to production, standby destroyed, `nixos-rebuild switch`) or Revert (bridge stays with standby, production rolls back). Workloads never see the rebuild — users do not experience downtime.

**AI remediation loop (both paths):** On health check failure, the AI streams a diagnosis to the operator, proposes a fix (restart `microvm@<name>`, adjust resource limits via LP API, `systemctl reload`, config patch, flake input rollback, or destroy + reprovision — each tier requiring appropriate approval), executes it, and re-runs the health check. The loop repeats until healthy or iterations are exhausted. Arbitrary shell execution is never permitted.

**Combined pitch:** LP makes routine rebuilds unnecessary. MM makes unavoidable rebuilds safe, self-healing, and — at Weaver Team — zero-downtime. The AI manages the health check and attempts remediation before any human needs to act.

### AI Blue/Green Deployment (v1.4.0+)

Rolling updates without Kubernetes:

1. **Pre-provision** — LP API call boots the green VM (not in rotation); no `nixos-rebuild` — Live Provisioning makes this an API call; Firecracker boot in seconds
2. **Configure** — apply the change on green while blue handles all live traffic
3. **Test** — AI validates health; green is in Standby (healthy, awaiting traffic shift)
4. **Shift** — bridge weight shifts to green; blue drains in-flight connections
5. **Confirm or rollback** — AI or operator decides; reverting is re-weighting the bridge back to blue

This is a natural extension of the pre-provisioning lifecycle (Decision #95): the same Pre-provisioning → Standby → Active → Draining stages, triggered by a deployment decision instead of a metric threshold. LP is what makes it viable at every step — no host rebuild, no downtime on the host, just API calls.

Bridges are active traffic management objects — not compute nodes. They do not count against license node limits. This pattern enables blue/green deployments at **Weaver Team** without Fabrick clustering or Kubernetes overhead.

**The convergence:** in K8s you maintain three separate components for these functions — a CNI plugin (network switching), an ingress controller + MetalLB (load balancing), and Argo Rollouts or Spinnaker (blue/green control). In Weaver it's the bridge: one component, already deployed from v1.0, no separate nodes, no separate software stack. Active routing adds one capability and collapses all three roles. *"We didn't add a load balancer. We realized the bridge already was one."*

**The mental model:** in Weaver's case the bridge is the load balancer, blue and green are the two VM instances, and the AI manages the traffic weight shift and health check instead of a human with a kubectl command. Identical to K8s blue/green or AWS Elastic Beanstalk environment swaps — at the MicroVM level, without the cluster overhead.

**The pitch:** "Rolling updates and blue/green deployments — without Kubernetes. Weaver's AI manages the traffic shift, health check, and rollback decision."

**Solo → Team upgrade trigger:** Solo users get bridge weight controls and AI-assisted shifts at v1.4.0. The ceiling hits when a second operator needs to approve a traffic shift before it commits, or a team member needs shared visibility into an in-flight deployment. That collaboration wall is Weaver Team — same as the 2-peer cap ceiling in v2.2.0's peer federation story.

---

## Competitive Position vs Kubernetes — "No Platform Team"

Weaver Solo and Team buyers are often the person who's tired of running Kubernetes — at home, at a small company, or in a team that can't justify the platform engineering headcount.

### The K8s Complexity Tax at Weaver Scale

| What K8s Requires | What Weaver Replaces It With | Cost Delta |
|---|---|---|
| Platform engineer(s) to operate control plane | NixOS declarative config — one sysadmin manages everything | $150K+/yr saved |
| CNI plugin + ingress controller + service mesh | Bridge — one component, already deployed | $0 extra software |
| Argo Rollouts / Spinnaker for blue/green | Smart Bridges (Team) or manual bridge weights (Solo) | No separate deploy tool |
| Helm charts + ArgoCD for GitOps | `git commit` → `colmena apply` — NixOS IS the GitOps | No YAML, no CRDs |
| Pod security admission + OPA/Gatekeeper | MicroVM hardware isolation — separate kernel per workload | No policy engine needed |
| Container registry + image scanning | NixOS flake builds — reproducible, no mutable layers | No registry dependency |

### Why This Matters for Solo/Team Buyers

**The homelab sysadmin:** "I run K3s at home for 6 services. Three of them are GPU workloads that fight the scheduler. I spend more time on K8s maintenance than on the services themselves." → Weaver Solo at $249/yr. GPU passthrough via VFIO-PCI. Bridge manages traffic. No cluster to maintain.

**The small team (2–4 people):** "We have a K8s cluster for our ML inference pipeline. We need a platform engineer but can't justify the headcount." → Weaver Team at $199/user/yr. Smart Bridges automates blue/green model deployment. AI manages health checks and rollback. The bridge replaces ingress + rollout controller.

**The upgrade trigger:** Solo users who outgrow manual bridge weights ("I need automated blue/green") → Team. Team users who need fleet-scale governance ("I have 5 hosts now") → Fabrick. The K8s refugee enters at Solo and climbs the same ladder.

### The Pitch

"Microservice benefits — independent deployment, isolated failure domains, per-service scaling — without Kubernetes, without service mesh, without a platform team. $249/yr."

Full competitive reference: [KUBERNETES-COMPETITIVE-POSITIONING.md](../sales/KUBERNETES-COMPETITIVE-POSITIONING.md)

---

## The AI Threat Landscape — Why Hardware Isolation Matters Now

In April 2026, Anthropic's Project Glasswing — a coalition with AWS, Google, Microsoft, NVIDIA, CrowdStrike, and 40+ others — demonstrated that AI can discover thousands of zero-day vulnerabilities, including bugs that survived decades of human code review. Anthropic committed $100M in credits with a 90-day public disclosure cycle. Key quote: *"AI cyber capabilities at this level will proliferate over the coming months, and not every actor who gets access to them will be focused on defense."*

This changes the threat calculus for every infrastructure operator. The volume and velocity of exploitable vulnerabilities just increased by orders of magnitude. Weaver's architecture was designed for exactly this scenario:

**Hardware isolation per workload = blast radius containment.** Every MicroVM runs its own kernel behind a hypervisor boundary. A zero-day exploited in one workload cannot reach another — the blast radius is one VM, not the entire host. Container-only architectures (Docker, Podman, Kubernetes pods) share a kernel. One kernel zero-day compromises every workload on the host. With AI discovering kernel vulnerabilities faster than humans can patch them, shared-kernel architectures carry compounding risk.

**NixOS declarative patching = provable patch propagation.** When a Glasswing-class disclosure drops, `nixos-rebuild switch` applies the patch atomically and reproducibly. The operator can prove — to auditors, to compliance frameworks, to their own team — that every host runs the patched config. No configuration drift, no "we think we patched it," no manual verification across hosts. The patch is a git commit; the deployment is deterministic.

**Hypervisor diversity = defense through diversity.** Weaver manages 5 hypervisors (QEMU, Cloud Hypervisor, crosvm, kvmtool, Firecracker). A hypervisor-targeting zero-day affects only workloads running on that hypervisor — not the entire fleet. Proxmox gives you QEMU only. VMware gives you ESXi only. A single hypervisor zero-day is a total fleet compromise for those platforms.

**The pitch:** "AI just made zero-day discovery industrial-scale. Weaver gives you hardware isolation per workload, deterministic patching, and hypervisor diversity — the three architectural defenses that actually matter when vulnerabilities appear faster than humans can review them. $249/yr."

---

## Forge Strategy

- **v1.x** (v1.1–v1.2): Agent learning ground. Execute with agents, refine definitions, build the playbook.
- **v2.x** (v2.0–v2.6): Forge execution. Disk + templates + clustering + backup. Human role = reviewer.
- **v3.x+**: Advanced clustering, monitoring, AI manager, topology, networking. Fully Forged using v1+v2 playbook.

---

## Weaver vs Fabrick — Two Markets, Two Pitches

| | Weaver ($249/yr solo · $199/user/yr team standard; $149/$129 FM) | Fabrick ($2,000–$2,500/yr/node; $1,299 FM) |
|------|---------------------|--------------------------|
| **Buyer** | Sysadmin, self-hoster, small team | IT department, compliance-driven org |
| **Competitive anchor** | Proxmox (€355/socket) | VMware ($5K+), Rancher, OpenShift |
| **Pitch** | "Cheaper AND better than Proxmox" | "Credible, not scary — features, not price" |
| **Pricing** | $249/yr solo · $199/user/yr team standard ($149/$129 FM, annual) | Node-based (Decision #63) |
| **Key differentiator** | Live Provisioning + AI + modern UI | Per-VM RBAC + audit log + all plugins included |
| **Extension model** | Buy what you need (DNS $X, Firewall $X) | All included |
| **Conversion from** | Weaver Free tier users who hit the provisioning wall | Weaver users who need team governance |

Full enterprise justification: [FABRICK-VALUE-PROPOSITION.md](FABRICK-VALUE-PROPOSITION.md)

---

*Evolved from [FEATURE-ARC-INVENTORY.md](../../plans/archive/FEATURE-ARC-INVENTORY.md) (archived). Absorbed NixOS defensibility content from [WEAKNESS-REMEDIATION.md](archive/WEAKNESS-REMEDIATION.md) (archived). Cross-reference: [TIER-MANAGEMENT.md](TIER-MANAGEMENT.md) | [MASTER-PLAN.md](../../MASTER-PLAN.md)*
