<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Implementation Phasing Plan

**Status:** Strategy Decided, Phase Details Draft
**Target:** v2.0.0+ (post v1.x.x arc)
**Created:** 2026-02-21
**Last Updated:** 2026-02-22
**Depends On:** [DISK-PROVISIONING-PLAN.md](DISK-PROVISIONING-PLAN.md), [SYSTEM-TEMPLATING-PLAN.md](SYSTEM-TEMPLATING-PLAN.md), [BACKUP-RECOVERY-PLAN.md](BACKUP-RECOVERY-PLAN.md), [WEAVER-VALUE-PROPOSITION.md](../../business/marketing/WEAVER-VALUE-PROPOSITION.md) (competitive analysis)

---

## Strategy

**Strategy C: Hybrid — Foundation first, then tier slices.**

Chosen for agent-friendliness:
- Small, bounded phases with clear inputs/outputs/acceptance criteria
- Each phase maps to one agent definition file
- Testable boundaries — each phase ships a complete tier slice
- Clear dependency chain — no ambiguity about ordering
- Small blast radius — mistakes in one phase don't affect later phases

---

## Forge Intent

**v1.x.x (Phases 7a–9b)** = Agent learning ground. Execute with agents, refine agent definitions, build the playbook for:
- Agent scope boundaries (what works in one sprint vs what needs splitting)
- Test coverage expectations per agent run
- Documentation deliverables per phase
- Error recovery patterns (when agents hit blockers)
- Review/QA workflow (what needs human review vs what can auto-merge)

**v2.x.x (Phases 10a–11c)** = Forge execution. Disk provisioning, system templating, Weaver Team peer federation, Fabrick clustering, and backup & recovery implemented primarily by agents using patterns proven in v1.x.x. Human role shifts from implementer to reviewer.

**Lessons captured in:** Agent definition files (`agents/`) + `docs/development/LESSONS-LEARNED.md`

---

## Dependency Chain

```
Disk Provisioning ──→ System Templating ──→ Backup & Recovery
   (foundation)        (depends on D#1,#4)    (depends on both)
                              │
                    Basic Clustering
                    (depends on disk + snapshots)
                              │
                    unlocks: cross-host restore,
                    fleet at scale, enterprise eval
```

Within each domain, tiers build on each other:
```
Weaver Free (foundation) → Weaver (power-user) → Basic Clustering (moat-breaker) → Fabrick (fleet/compliance)
```

Strategy C interleaves domains by tier, respecting the dependency chain. Weaver Team peer federation is inserted at Phase 10c (v2.2.0) as a single-node stepping stone, followed by Fabrick Basic Clustering at Phase 10d (v2.3.0) — the earliest point multi-node prerequisites (disk lifecycle, snapshots, Weaver Team protocol) are met — to break Proxmox's competitive moat and unlock fabrick adoption.

---

## v1.x.x Arc (Existing — Agent Learning Ground)

Phases 7a–8b are already planned in [EXECUTION-ROADMAP.md](../v1.1.0/EXECUTION-ROADMAP.md). v1.x.x ends at v1.5.0.

| Phase | Version | Domain | Status |
|-------|---------|--------|--------|
| 7a | v1.1.0 | Container Visibility | Planned |
| 7b | v1.2.0 | Full Container Management | Planned |
| 7c | v1.3.0 | Cross-Resource AI Agent | Planned |
| 8a | v1.4.0 | Import/Export Tier 1 (config-only) | Planned |
| 8b | v1.5.0 | Import/Export Tier 2 (parsers) | Planned |

**Note:** Phases 9a/9b removed — superseded by BACKUP-RECOVERY-PLAN.md. Features phased across v2.0.0–v2.5.0. Config export API (`GET /api/vms/export`) already exists in the codebase. Phase 8a stripped to config-only import/export ("Save as Template" → 10b, disk export → 10a).

---

## v2.x.x Arc (Forge — Disk + Templates + Backup)

### Phase 10a: Storage & Template Foundation (v2.0.0)

**Tier slice:** Free across all three domains.
**Agent scope:** Backend storage layer + template schema + export API + frontend UI.

| Feature | Domain | Source Decision |
|---------|--------|-----------------|
| Disk lifecycle: create, delete, resize (raw/qcow2) | Disk | D#1 |
| Disk attach/detach: hotplug via cloud-hypervisor API | Disk | D#1 |
| Built-in templates: curated defaults ship with product | Templates | T1, T3 |
| Create VM from template: one-click VM creation | Templates | T3 |
| Basic cloud-init: hostname, SSH keys, root password (3 form fields) | Templates | T4 |
| Import external images: raw/qcow2 from outside | Backup | B1 |
| Export VM: disk + config as raw + JSON sidecar download | Backup | B1, B3 |

**Acceptance criteria:**
- User can create/resize/delete disk images via API and UI
- User can hotplug disks to running VMs
- Built-in templates appear in "Create VM" flow
- Basic cloud-init fields work in create flow
- User can import external disk images
- User can export any VM as raw disk + JSON config (browser download)
- All features work at Free tier
- E2E specs cover all new UI flows

**Why this is one phase:** All Free tier, all low-medium complexity, all foundational. No feature here depends on another feature in this phase (disk lifecycle is independent of template consumption is independent of export). Agent can parallelize work streams.

---

### Phase 10b: Storage & Template Weaver (v2.1.0)

**Tier slice:** Weaver across disk + templates. Backup deferred to 11a (more complex, deserves its own phase).
**Agent scope:** Snapshot engine + clone logic + template CRUD + cloud-init editor.

| Feature | Domain | Source Decision |
|---------|--------|-----------------|
| I/O rate limiting: per-disk throttle (bytes/s, ops/s) | Disk | D#1 |
| Manual snapshots: on-demand VM-level (all attached disks) | Disk | D#1, D#5 |
| Cloning: full clone from snapshot or base | Disk | D#1 |
| Templates/base images: full-copy disk per VM from template | Disk | D#1, D#4 |
| Detach-before-delete + standalone volume creation | Disk | D#3 |
| Save VM as template: capture running VM config + disk | Templates | T1, T3 |
| Template library UI: browse, search, manage saved templates | Templates | T3 |
| Advanced cloud-init: basic fields + raw YAML editor | Templates | T4 |

**Acceptance criteria:**
- Snapshots create/list/restore/delete work via API and UI
- Clone from snapshot produces independent VM
- I/O rate limiting configurable per disk
- "Save as template" captures full VM state (disk + config + cloud-init)
- Template library shows saved templates with search
- YAML cloud-init editor validates and previews
- Disks can be detached from VMs and exist independently
- Weaver tier gate enforced on all features
- E2E specs cover snapshot lifecycle, template CRUD, cloud-init editor

**Why backup is not here:** Backup Weaver involves the adapter interface, backup job scheduling, data-level hooks, and restore flows — that's a distinct system with its own testing surface. Mixing it with snapshot/template work would exceed agent scope.

---

### Phase 10c: Weaver Team — Peer Federation (v2.2.0)

**Tier slice:** Weaver Team — single-node peer visibility stepping stone.
**Agent scope:** Peer host enrollment + full remote workload management + host badge UI.
**Strategic rationale:** Weaver Team (v2.2.0) establishes the peer-to-peer protocol over REST+WS without requiring multi-node gRPC infrastructure. It proves the federation concept at minimal complexity and creates an upgrade path to Fabrick clustering. Test environment: single node + 1 peer — no NixOS cluster lab required.

| Feature | Description | Complexity |
|---------|-------------|------------|
| Peer host enrollment | Tailscale MagicDNS or manual IP, credential handshake | Medium |
| Full peer management | Manage up to 2 remote Weaver hosts' workloads | Medium |
| Host badge on workload cards | Visual indicator of which host a workload belongs to | Low |
| REST+WS peer protocol | Single-node protocol, no gRPC | Medium |
| Solo → Team upgrade prompt | Upgrade CTA on peer-limit reached | Low |

**Not in this phase (deferred to v2.3.0):**
- gRPC hub-spoke agent architecture
- Cold VM migration between nodes
- Nix ecosystem integrations (nixos-anywhere, Colmena, Attic, nixos-facter)
- Fleet provisioning, config sync across cluster

**Acceptance criteria:**
- Admin can enroll a peer Weaver host (Tailscale or manual IP)
- Weaver shows workloads from peer hosts with host badge
- All management actions on peer workloads are fully available
- Upgrade prompt fires at peer host limit
- Weaver Team tier gate enforced
- E2E specs cover enrollment flow, peer visibility, action gating

---

### Phase 10d: Fabrick Basic Clustering (v2.3.0)

**Tier slice:** Fabrick — multi-node foundation. This is the Proxmox moat-breaker.
**Agent scope:** Agent extraction + hub-spoke gRPC + fleet UI + cold migration + Nix ecosystem integrations.
**Strategic rationale:** Fabrick Basic Clustering at v2.3.0 builds on Weaver Team's proven peer protocol, replacing REST+WS with gRPC and adding fleet provisioning via nixos-anywhere, Colmena, Attic, and nixos-facter. Test environment: 2-node NixOS lab (isolated from v2.2.0 single-node tests).

| Feature | Description | Complexity |
|---------|-------------|------------|
| Agent extraction | Hub-spoke gRPC architecture, agent binary per node | High |
| Multi-node workload list | See all VMs/containers across all nodes, node selector | Medium |
| Node management UI | Register nodes, view health, remove nodes | Medium |
| Cold VM migration | Stop VM on node A, transfer disk + config, start on node B | Medium-high |
| Config sync | Templates, distro catalog sync across cluster | Medium |
| nixos-anywhere + disko | Fleet provisioning over SSH, declarative disk layout | High |
| Colmena | NixOS fleet config management, parallel deployments | High |
| Attic binary cache | Shared nix store cache across fleet nodes | Medium |
| nixos-facter | Automated hardware discovery for fleet inventory | Medium |

**Not in this phase (deferred to v3.0.0):**
- Live migration (no-downtime transfer of running VMs)
- HA / automatic failover
- Shared storage (Ceph, ZFS replication)
- Resource scheduling / automatic placement

**Acceptance criteria:**
- Agent binary runs on each node, reports to hub via gRPC
- Weaver shows VMs from all registered nodes with node selector
- Cold migration moves a stopped VM between nodes (disk + config + cloud-init)
- nixos-anywhere can provision a new NixOS node into the fleet
- Colmena deploys config changes across all fleet nodes
- Attic binary cache speeds up fleet nix builds
- nixos-facter enumerates hardware on enrollment
- Fabrick tier gate enforced on all features
- E2E specs cover node registration, cross-node visibility, migration lifecycle
- Requires 2-node NixOS lab test environment

**Why split from v2.2.0:** Weaver Team (v2.2.0) requires only a single test node and REST+WS. Fabrick clustering (v2.3.0) requires a 2-node NixOS lab and gRPC. Mixing both in one version would require two incompatible test environments in the same gate, increasing blast radius and making failures ambiguous.

---

### Phase 11a: Backup Weaver (v2.4.0)

**Tier slice:** Weaver backup across VM-level and data-level.
**Agent scope:** Backup job engine + adapter interface + built-in adapters + restore + scheduler.

| Feature | Domain | Source Decision |
|---------|--------|-----------------|
| Manual VM backup: on-demand, snapshot-based consistency | Backup | B1 |
| Scheduled VM backup: automated to one target | Backup | B1 |
| Manual data backup: pre/post hooks + path selection | Backup | B1 |
| Scheduled data backup: automated to one target | Backup | B1 |
| Backup adapter interface: target abstraction | Backup | B2, B3 |
| Local directory adapter: raw copy + JSON sidecar | Backup | B3 |
| NFS mount adapter: raw copy + JSON sidecar | Backup | B3 |
| Full VM restore: one-click from backup | Backup | B6 |
| Backup scope: disk + config + cloud-init + template ref | Backup | B5 |

**Acceptance criteria:**
- Manual backup creates archive at configured target
- Scheduled backup runs on cron schedule
- Data backup executes pre-hook, copies paths, executes post-hook
- Local directory and NFS adapters work
- Restore recreates functional VM from backup (one-click)
- Backup includes disk images + VM config + cloud-init + template reference
- Weaver tier gate enforced
- E2E specs cover backup create/list/restore lifecycle

---

### Phase 11b: Storage & Template Fabrick (v2.5.0)

**Tier slice:** Fabrick across disk + templates.
**Agent scope:** Storage pools + CoW engine + quota system + template versioning + fleet ops.

| Feature | Domain | Source Decision |
|---------|--------|-----------------|
| Scheduled snapshots: automated with scheduling | Disk | D#1 |
| Disk-level snapshots: individual disk granularity | Disk | D#5 |
| Storage pools: named pools with tier tag, phased UI | Disk | D#2 |
| CoW overlays: base image as read-only, thin overlay per VM | Disk | D#4 |
| Quotas: per-user or per-tier disk space limits | Disk | D#1 |
| Encryption at rest: LUKS or fs-level per disk | Disk | D#1 |
| Full independent volume lifecycle: volumes page, attach/detach API | Disk | D#3 |
| Template versioning: immutable versions, default version tracking | Templates | T2 |
| Template sharing: across users | Templates | T3 |
| Fleet updates: update VMs to match newer template version | Templates | T3 |

**Acceptance criteria:**
- Storage pools configurable via settings, disks assigned to pools
- CoW overlay creation from base image (space-efficient)
- Scheduled snapshots run on configured schedule
- Disk-level snapshots work independently of VM-level
- Quota enforcement rejects disk creation over limit
- Template versions are immutable, VMs track source version
- Fleet query: "which VMs are on template X v2?"
- Fleet update: "update all VMs from template X v2 to v3"
- Fabrick tier gate enforced on all features
- E2E specs cover pools, CoW, quotas, versioning, fleet

**Why this is a big phase:** Fabrick features are interconnected — CoW depends on storage pools, fleet updates depend on template versioning, disk-level snapshots enable selective workflows. Splitting further would create artificial boundaries. Agent handles this by having a clear feature list with independent acceptance criteria per feature.

---

### Phase 11c: Backup Fabrick + Extensions (v2.6.0)

**Tier slice:** Fabrick backup + extension adapter framework.
**Agent scope:** Multi-target orchestration + retention engine + extension framework + advanced restore.

| Feature | Domain | Source Decision |
|---------|--------|-----------------|
| Multiple backup targets: backup job writes to >1 destination | Backup | B1 |
| Snapshot promotion: promote snapshot to durable backup | Backup | B1 |
| Retention policies: keep-last-N, keep-daily/weekly/monthly, auto-prune | Backup | B1 |
| Application-aware hooks: DB-specific pre/post, per-directory retention | Backup | B1 |
| Backup verification: integrity checks on stored backups | Backup | B1 |
| Restore (individual files): mount backup, extract specific files | Backup | B6 |
| Encryption at rest (built-in): age/GPG wrapper for raw copy | Backup | B6 |
| Extension adapter framework: license-gated adapter loading | Backup | B3 |
| S3 extension adapter: compressed archive (tar.gz) + JSON sidecar | Backup | B3 |
| Restic extension adapter: native dedup + encryption + incremental | Backup | B3 |
| Borg extension adapter: native dedup + encryption + incremental | Backup | B3 |
| Cross-host restore: restore on different host (V2 multi-node gate) | Backup | B6 |

**Acceptance criteria:**
- Backup job can target multiple destinations simultaneously
- Retention policies auto-prune old backups per configured rules
- Snapshot promotion creates durable backup from existing snapshot
- File-level restore mounts backup and extracts selected files
- Extension framework loads adapters based on license check
- S3 adapter writes compressed archives to S3-compatible storage
- Restic adapter integrates with existing restic repos (incremental, encrypted)
- Borg adapter integrates with existing borg repos
- Fabrick tier gate enforced; extensions require separate license
- E2E specs cover multi-target, retention, extensions, file restore

---

## Phase Summary

| Phase | Version | Tier | Domains | Complexity | Strategic role |
|-------|---------|------|---------|------------|----------------|
| 10a | v2.0.0 | Free | Disk + Templates + Backup (export/import) | Low-medium | Foundation |
| 10b | v2.1.0 | Weaver | Disk + Templates + Nix editor + TPM | Medium | Power-user features |
| **10c** | **v2.2.0** | **Weaver Team** | **Peer Federation** | **Medium** | **Federation stepping stone** |
| **10d** | **v2.3.0** | **Fabrick** | **Basic Clustering + Nix Ecosystem** | **High** | **Proxmox moat-breaker** |
| 11a | v2.4.0 | Weaver | Backup | Medium-high | Backup system |
| 11b | v2.5.0 | Fabrick | Disk + Templates | High | Fleet/compliance |
| 11c | v2.6.0 | Fabrick | Backup + Extensions | High | Extension ecosystem |

**Total v2 arc:** 7 phases, v2.0.0 through v2.6.0.

**Advanced Clustering (v3.0.0):** HA, automatic failover, shared storage, live migration, resource scheduling, LB-triggered auto-provisioning (scale VMs up/down based on load balancer metrics — the "K8s killer" feature). Full Proxmox clustering parity. Planned separately when basic clustering (10d) is proven.

---

## Agent Definition Strategy

Each phase gets one agent definition file in `agents/`:

| Phase | Agent file | Key constraint |
|-------|-----------|----------------|
| 10a | `v2-storage-template-free.md` | No Weaver/Fabrick features leak in |
| 10b | `v2-storage-template-premium.md` | Depends on 10a outputs |
| 10c | `v2-weaver-team-federation.md` | Single-node + 1 peer; no gRPC; Depends on 10a + 10b |
| 10d | `v2-fabrick-basic-clustering.md` | Requires 2-node NixOS lab; Depends on 10c protocol patterns |
| 11a | `v2-backup-premium.md` | Depends on 10b (snapshots for consistency) |
| 11b | `v2-storage-template-enterprise.md` | Depends on 10b outputs; benefits from 10d (fleet across cluster) |
| 11c | `v2-backup-enterprise-extensions.md` | Depends on 11a + 11b; cross-host restore requires 10d |

**Agent definition template** (refined during v1.x.x execution):
1. Feature list with acceptance criteria
2. Source decisions (links to planning docs)
3. Files to create/modify (predicted)
4. Test deliverables (unit, backend, E2E)
5. Documentation deliverables (developer guide, help page, lessons learned)
6. Tier gate verification checklist
7. Definition of done

---

## Decisions Log

| # | Date | Question | Decision | Rationale |
|---|------|----------|----------|-----------|
| P1 | 2026-02-21 | Phasing strategy | Strategy C: hybrid (foundation first, then tier slices) | Most agent-friendly: small phases, clear boundaries, testable outputs, no cross-domain juggling within a phase |
| P2 | 2026-02-21 | v1.x.x vs v2.x.x split | v1.x.x = agent learning ground (containers, import/export); v2.x.x = forge (disk, templates, backup) | v1.x.x builds agent playbook; v2.x.x executes it; human role shifts from implementer to reviewer |
| P3 | 2026-02-21 | Phase numbering | 10a/10b/10c/11a/11b/11c continuing from existing 9b | Avoids renumbering existing planned phases; clear v2 boundary |
| P4 | 2026-02-21 | Clustering insertion | Weaver Team peer federation at Phase 10c (v2.2.0) — single-node stepping stone; Fabrick Basic Clustering at Phase 10d (v2.3.0) — earliest point multi-node prerequisites are met | Testing isolation: v2.2 requires only REST+WS + 1 peer; v2.3 requires 2-node NixOS lab + gRPC; mixing would create ambiguous test environments; Proxmox moat broken at v2.3 |
| P5 | 2026-02-21 | Phase 8a scope | Config-only import/export; "Save as Template" → 10b, disk export → 10a | Clean boundary between v1 config portability and v2 disk/template features |
| P6 | 2026-02-21 | Phases 9a/9b removal | Removed — superseded by BACKUP-RECOVERY-PLAN.md; v1.x.x ends at v1.5.0 | Config export API already exists; backup features phased across v2.0.0–v2.5.0; placeholder phases created confusion |

---

## Notes

- Phases 9a/9b removed — superseded by BACKUP-RECOVERY-PLAN.md. Config export API (`GET /api/vms/export`) already exists. v1.x.x ends at v1.5.0.
- Cross-host restore (Phase 11c) gates on V2 multi-node plan — may be deferred further if multi-node isn't ready.
- Extension adapter framework (Phase 11c) is the first extension system in the product — establishes the pattern for future extension domains.
- Migration from disk (D#3): independent volumes at Fabrick may require data migration tooling if Weaver users have standalone volumes when they downgrade. Decide at implementation time.
