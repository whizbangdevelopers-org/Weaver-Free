<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Feature Arc Inventory

**Status:** Tracking
**Created:** 2026-02-21
**Last Updated:** 2026-02-22

---

## Overview

Master inventory of all major feature domains (arcs) for Weaver, their planning status, and sequencing.

---

## Planned Arcs (Planning Complete)

| Arc | Planning Doc | Decisions | Target |
|-----|-------------|-----------|--------|
| Disk Provisioning | [DISK-PROVISIONING-PLAN.md](v2.0.0/DISK-PROVISIONING-PLAN.md) | 5 (D#1–D#5), all decided | v2.x.x (Phases 10a–11b) |
| System Templating | [SYSTEM-TEMPLATING-PLAN.md](v2.0.0/SYSTEM-TEMPLATING-PLAN.md) | 4 (T1–T4), all decided | v2.x.x (Phases 10a–11b) |
| Backup & Recovery | [BACKUP-RECOVERY-PLAN.md](v2.0.0/BACKUP-RECOVERY-PLAN.md) | 6 (B1–B6), all decided | v2.x.x (Phases 11a–11c) |
| Implementation Phasing | [IMPLEMENTATION-PHASING-PLAN.md](v2.0.0/IMPLEMENTATION-PHASING-PLAN.md) | 6 (P1–P6), strategy decided | v2.x.x (Strategy C) |

## In-Progress Arcs (In Execution Roadmap, No Separate Plan)

| Arc | Roadmap Phases | Target |
|-----|---------------|--------|
| Container Orchestration | 7a (visibility), 7b (management), 7c (cross-resource AI) | v1.1.0–v1.3.0 |
| Import/Export | 8a (config-only), 8b (parsers) | v1.4.0–v1.5.0 |

> **Note:** Phases 9a/9b (Config Export + Backup) removed. Features fully covered by BACKUP-RECOVERY-PLAN.md, phased across v2.0.0–v2.5.0. v1.x.x ends at v1.5.0.

## Unplanned Arcs (Need Planning Documents)

| Arc | Planning Doc | Notes |
|-----|-------------|-------|
| Clustering / Multi-node | None | Referenced as "V2" in several decisions (cross-host restore, template sharing, migration, fleet updates). Largest unplanned domain. Implies node discovery, resource scheduling, placement, live migration, HA/failover. |
| Monitoring / Sensors | None | Host metrics, VM metrics, container metrics, alerting, dashboards. Natural plugin domain (Prometheus exporter plugin, Grafana integration plugin). |
| AI as VM Manager | None | Evolution from diagnostics (v0.3.0) → autonomous management. AI agent gains write access: create/delete/migrate VMs, scale resources, respond to alerts. Major trust/safety design. |
| Drag-and-Drop Topology | None | Visual resource/network management. Drag VMs onto bridges, see network relationships, interactive placement. UI-heavy, depends on networking backend. |
| Networking | None | Bridge management, firewall rules, IP pool allocation, potentially SDN. Roadmap already notes "Network: view free, bridges premium. Firewall rules deferred to post-v1." Backend system distinct from topology visualization UI. Per-VM firewall rules (premium) vs inter-VM policy (enterprise). |
| Marketplace / Plugin Ecosystem | None | If the plugin model (established in backup B3) extends product-wide, there's a registry/distribution/trust question. Monitoring plugins, network plugins, AI model plugins. May fold into clustering or stay a sub-topic. |

---

## Forge Strategy

- **v1.x.x** (Phases 7a–8b): Agent learning ground. Execute with agents, refine definitions, build the playbook.
- **v2.x.x** (Phases 10a–11c): Forge execution. Disk + templates + clustering + backup. Human role = reviewer.
- **v3.x.x+**: Advanced clustering, monitoring, AI manager, topology, networking. Fully forge using v1+v2 playbook.

---

## Dependency Map

```
v1.x.x (learning ground, ends at v1.5.0)
├── Containers (7a–7c)
└── Import/Export (8a–8b)

v2.x.x (forge)
├── Disk Provisioning ──→ System Templating ──→ Backup & Recovery
│   (10a–10b)              (10a–11b)              (11a–11c)
└── Plugin framework established (11c)

v3.x.x+ (forge, unplanned)
├── Networking (backend: bridges, firewall, IP pools)
├── Clustering / Multi-node (node discovery, scheduling, migration, HA)
│   └── unlocks: cross-host restore, template sharing, fleet at scale
├── Monitoring / Sensors (metrics, alerting, dashboards)
│   └── natural plugin domain (Prometheus, Grafana)
├── AI as VM Manager (autonomous operations, safety model)
│   └── depends on: monitoring (data), clustering (scope)
├── Drag-and-Drop Topology (visual management UI)
│   └── depends on: networking (backend)
└── Marketplace / Plugin Ecosystem (registry, distribution, trust)
    └── depends on: plugin framework (11c), clustering (multi-node distribution)
```

---

## Competitive Position vs Proxmox (Per-Tier Knockout)

Proxmox is the incumbent for self-hosted VM management with a web UI. This analysis tracks when users at each tier stop considering Proxmox as a viable alternative.

### Proxmox Was Never Viable (Day 1)

| Audience | Why Proxmox fails | When we capture them |
|----------|-------------------|---------------------|
| NixOS sysadmins | Proxmox requires Debian. Full stop. | v1.0.0 (Free tier) |
| Apptainer/HPC users | Proxmox has no Singularity/Apptainer awareness | v1.1.0 (Phase 7a) |
| AI-first operators | Proxmox will never add AI diagnostics | v0.3.0 (already shipped) |
| cloud-hypervisor users | Proxmox is KVM/QEMU only | v1.0.0 (already shipped) |

These users aren't choosing between us and Proxmox. They're choosing between us and **scripts + systemd units** (the "roll your own" approach).

### Progressive Knockout (General Homelab / Self-Hosting)

| Milestone | Who stops considering Proxmox | Proxmox still wins on |
|-----------|-------------------------------|----------------------|
| v2.0.0 (10a) | Users burned by VMA lock-in, users who want portability | Maturity, community size, "it just works" reputation |
| v2.1.0 (10b) | Users who value UX, mobile access, mixed VM+container+Apptainer | Backup (vzdump/PBS is mature), clustering, ZFS/Ceph |
| **v2.2.0 (10c)** | **Enterprise users who need multi-node management. Moat cracked.** | **HA, automatic failover, shared storage (advanced clustering)** |
| v2.3.0 (11a) | Users with existing restic/borg infrastructure (BYOB plugin model) | Advanced clustering features only |
| v2.5.0 (11c) | Enterprise users wanting plugin flexibility | Advanced clustering features only |
| v3.0.0 (advanced clustering) | **Everyone.** Proxmox's last moat destroyed. | Community size and r/homelab inertia (not a feature) |

### Proxmox's Moat: Clustering (Accelerated Attack)

**Decision (P4):** Basic clustering inserted at Phase 10c (v2.2.0) — the earliest point its prerequisites are met. This breaks Proxmox's moat years earlier than waiting for v3.x.x.

**Basic clustering (v2.2.0 — moat-breaker):**
- Multi-node visibility (see all VMs across nodes)
- Manual VM migration (stop, transfer, start on target)
- Config synchronization (templates, settings)
- Cluster-aware dashboard (node selector, aggregate stats)

**Advanced clustering (v3.0.0 — moat destroyed):**
- Live migration (no-downtime transfer)
- HA / automatic failover
- Shared storage (Ceph, ZFS replication)
- Resource scheduling / automatic placement

**Why v2.2.0 is sufficient:** An enterprise user who gets multi-node visibility + manual migration + AI diagnostics + Apptainer + restic plugin will switch from Proxmox. Our compound advantages (AI, Apptainer, plugins, modern UI, NixOS-native) multiply in a clustered context. They don't need HA on day one — they need enough to get in the door, where our other advantages close the deal.

**Revenue impact:** Every release after v2.1.0 without clustering is enterprise revenue left on the table. Enterprise is the highest-revenue tier. Accelerating clustering from v3.x.x to v2.2.0 captures enterprise evaluation cycles sooner.

### Proxmox's Weaknesses We Exploit

| Proxmox weakness | Our advantage | Ships in |
|-----------------|---------------|----------|
| Proprietary VMA backup format | Open formats + BYOB plugin model (restic/borg) | v2.2.0 |
| No Apptainer/Singularity | Apptainer-first container strategy | v1.1.0 |
| No AI diagnostics or management | AI agent (diagnostics → autonomous management) | v0.3.0 → v3.x.x |
| Debian-only | NixOS-native, declarative, reproducible | v1.0.0 |
| ExtJS UI (dated, not responsive) | Vue 3 + Quasar, mobile-ready, modern | v1.0.0 |
| KVM/QEMU only | cloud-hypervisor (lightweight, security-focused) | v1.0.0 |
| No plugin ecosystem | Plugin adapter framework (backup → monitoring → networking) | v2.4.0 |
| Single backup ecosystem (VMA/PBS) | Multi-tool integration (restic, borg, S3) | v2.2.0 |

---

## Notes

- Phases 9a/9b removed — superseded by BACKUP-RECOVERY-PLAN.md. v1.x.x ends at v1.5.0. Config export API already exists.
- The plugin model (backup B3) is a product-wide decision that affects future arcs — monitoring and networking are natural plugin domains.
- Clustering is the largest unplanned domain and is a prerequisite for several features in other arcs (cross-host restore, template sharing, fleet updates, live migration).
- AI as VM Manager has significant trust/safety implications — the AI gains destructive write access. Needs its own planning process.
