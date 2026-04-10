<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Disk Provisioning & Management Plan

**Status:** All Initial Questions Decided
**Target:** Post-v1.0 (no phase assigned yet)
**Created:** 2026-02-21
**Last Updated:** 2026-02-21

---

## Overview

Design disk provisioning and management features for Weaver, informed by how established VM/container platforms handle storage.

## Industry Survey

### Proxmox VE (VM management dashboard)

- Storage pools: local, NFS, Ceph, ZFS, LVM-thin
- Per-VM disks: create, resize, detach/reattach, clone
- Disk types: virtio, SCSI, IDE with cache mode selection
- Snapshots: live + offline, linked clones from snapshots
- Disk import from OVA/raw/qcow2
- Hot-add disks to running VMs
- Backup integration: disk-level, scheduled

### LXD/Incus (container-centric, also supports VMs)

- Storage pools with pluggable backends (dir, btrfs, ZFS, Ceph, LVM)
- Custom volumes: lifecycle independent of instances, can attach to multiple
- Snapshots with scheduling (`snapshots.schedule = @daily`)
- Volume migration between pools
- Content types: filesystem vs block
- Quotas per-volume and per-pool

### Kubernetes PV/PVC (declarative model)

- StorageClass abstraction: user picks tier (fast, standard, archive), not backend
- Dynamic provisioning: claim size + class, system creates it
- Access modes: ReadWriteOnce, ReadWriteMany
- Reclaim policies: Retain, Delete
- Volume snapshots (CSI standard)
- Expansion: resize without detach on supported backends

### AWS EBS (cloud-native)

- Volume types as tiers: gp3 (general), io2 (high IOPS), st1 (throughput), sc1 (cold)
- Attach/detach to running instances
- Snapshots: incremental, cross-region copy
- Encryption at rest: per-volume toggle
- Performance provisioning: IOPS + throughput separate from size
- Lifecycle policies for snapshots

### cloud-hypervisor (our hypervisor)

- Disk backends: raw images, qcow2, vhost-user-blk
- Hotplug: add/remove virtio-blk disks at runtime via API
- API-driven: `PUT /vm.add-disk`, `PUT /vm.remove-disk`
- Read-only mounts supported (shared base images)
- Rate limiting: per-disk I/O throttling (bytes/s, ops/s)
- No built-in snapshot: host-side responsibility (filesystem snapshots, qemu-img)

---

## Feature Categories

| Category | Description | Complexity | Tier | Decision |
|----------|-------------|------------|------|----------|
| Disk lifecycle | Create, delete, resize raw/qcow2 images | Low-medium | Free | Decided (#1) |
| Attach/detach | Hot-add/remove disks to running VMs | Medium | Free | Decided (#1) |
| I/O rate limiting | Throttle disk performance per VM | Low | Weaver | Decided (#1) |
| Templates/base images | Read-only base + CoW overlay per VM | Medium | Weaver | Decided (#1) |
| Snapshots (manual) | On-demand point-in-time copies | Medium-high | Weaver | Decided (#1) |
| Cloning | Full clone or linked clone from snapshot/base | Medium | Weaver | Decided (#1) |
| Snapshots (scheduled) | Automated scheduled snapshots | Medium-high | Fabrick | Decided (#1) |
| Storage pools | Organize disks by location/backend (local dir, ZFS, NFS) | Medium | Fabrick | Decided (#1, #2) |
| Quotas | Per-user or per-tier disk space limits | Low | Fabrick | Decided (#1) |
| Encryption | At-rest encryption (LUKS or fs-level) | High | Fabrick | Decided (#1) |
| Migration | Move disks between storage pools/hosts | High | Fabrick + multi-node | Decided (#1) |

---

## Open Questions

### 1. Tier Differentiation

Which features land in which tier?

**Status:** DECIDED

- **Free:** Disk lifecycle (create/delete/resize) + attach/detach (hotplug). Functional but manual.
- **Weaver:** I/O rate limiting, templates/base images, manual snapshots, cloning. Power-user features for single-node admins.
- **Fabrick:** Scheduled snapshots, storage pools, quotas, encryption, migration. Fleet/compliance/scale features.

---

### 2. Storage Pool Model

Proxmox-style (admin defines pools, users pick) vs Kubernetes-style (storage classes as abstraction)?

**Status:** DECIDED — Hybrid, phased

**Decision:** Named pools (Proxmox-style) with a `tier` tag on each pool. Three-phase rollout:

| Phase | What ships | Audience |
|-------|-----------|----------|
| Post-v1 initial | Named pools — admin points at directories, users see pool names | Solo admins, homelab (familiar, low ceremony) |
| Weaver/Fabrick | UI groups pools by tier tag, hides pool details by default | Teams get self-service, admins still see pools in settings |
| Multi-node (V2) | Tier becomes primary concept, pools are per-node implementation detail | Cluster-wide provisioning |

**Rationale:** Early adopters are NixOS-savvy single-node users — they expect to see real pool names (Proxmox audience). The tier tag is a low-cost string field that enables the K8s-style abstraction later as a **UI change, not a schema change**. Growth toward teams and fabrick revenue happens without data model rework.

---

### 3. Disk Lifecycle Coupling

Are disks always owned by a VM (Proxmox model) or independent resources that attach/detach (AWS/K8s model)?

- VM-owned: simpler, disk dies with VM
- Independent volumes: more flexible, survives VM deletion, more complex

**Status:** DECIDED — Hybrid, phased

**Decision:** VM-owned by default, with independence unlocked by tier:

| Phase | What ships | Behavior |
|-------|-----------|----------|
| Post-v1 initial (Free) | VM-owned by default | Disks created with a VM, deleted with a VM. Simple. |
| Weaver | "Detach before delete" + standalone volume creation | Disks can become independent. Weaver users get a Volumes inventory. Delete-VM prompts: "keep or delete attached disks?" |
| Fabrick | Full independent volume lifecycle | Volumes page, attach/detach API, unattached volume tracking, reclaim policies (retain/delete) |

**Rationale:** Underlying data model supports independence from day one (disk = file on a pool, VM config = references to disk paths). The upgrade path is a feature unlock, not a migration. Matches early audience expectations (solo admins expect VM-owned) while enabling team/fleet workflows at higher tiers.

---

### 4. Base Image Relationship

The distro catalog already manages base images. Should base images become a first-class "read-only disk" with CoW overlays per VM?

**Status:** DECIDED — Tiered, with template caveat

**Decision:** Dual-mode by tier:

| Tier | Behavior |
|------|----------|
| Free | Full copy of base image per VM. Distro catalog stays as-is. Works, slower, uses more space. |
| Weaver | Templates feature = save a configured VM as a reusable base. Snapshots + cloning work on full-copy disks. Still full copy on create. |
| Fabrick | Base images registered as read-only disks. VM creation = thin CoW overlay. Space-efficient, fast provisioning. Distro catalog feeds the disk system. Deletion checks for dependent overlays. |

**Rationale:** Weaver gets the template **workflow** (save/reuse configured VMs). Fabrick gets the **efficiency optimization** (CoW, shared bases, overlay management). CoW matters at scale (50 VMs from same base), not at 3.

**Dependency — System Templating (separate planning topic):**
Templates span more than disk — a full VM template includes disk image + VM config (memory, vCPUs, network, boot args, cloud-init). The disk decisions here cover the storage layer of templates, but the full template feature (create from template, template library, template versioning) needs its own planning document. Decisions made here constrain that design: templates at Weaver use full-copy disks, templates at Fabrick use CoW overlays.

---

### 5. Snapshot Scope

VM-level snapshots (all disks + state) vs individual disk snapshots?

- VM-level: simpler UX, one button
- Disk-level: more granular, more powerful

**Status:** DECIDED — Tiered

**Decision:**

| Tier | Behavior |
|------|----------|
| Weaver | VM-level snapshots only. One button captures all attached disks. Simple restore. Covers 90% of use cases. |
| Fabrick | VM-level + disk-level snapshots. Advanced users can snapshot individual disks. Enables selective restore, partial rollback, database-specific workflows. |

**Rationale:** Implementation builds naturally — VM-level snapshots are built on disk-level snapshots internally (iterate attached disks, snapshot each). Weaver hides the granularity. Fabrick exposes it. No architectural rework needed to unlock disk-level.

---

## Decisions Log

Decisions are recorded here as they are made during discussion.

| # | Date | Question | Decision | Rationale |
|---|------|----------|----------|-----------|
| 1 | 2026-02-21 | Tier differentiation | Free=lifecycle+hotplug, Weaver=snapshots+clones+templates+IO, Fabrick=scheduled+pools+quotas+encryption+migration | Basic ops free, power-user features paid, fleet/compliance features fabrick |
| 2 | 2026-02-21 | Storage pool model | Hybrid: named pools with tier tag, phased from Proxmox-style to K8s-style | Early adopters expect pools; tier tag enables abstraction later as UI change not schema change |
| 3 | 2026-02-21 | Disk lifecycle coupling | Hybrid: VM-owned default, independent volumes unlocked at Weaver/Fabrick | Data model supports independence from day one; tier unlock not migration |
| 4 | 2026-02-21 | Base image relationship | Free=full copy, Weaver=template workflow (full copy), Fabrick=CoW overlays | Weaver gets workflow, Fabrick gets efficiency; system templating needs separate plan |
| 5 | 2026-02-21 | Snapshot scope | Weaver=VM-level only, Fabrick=VM-level + disk-level | VM-level built on disk-level internally; tier controls granularity exposure |

---

## Notes

- This is a post-v1.0 feature set. No phase assigned in the execution roadmap yet.
- cloud-hypervisor's native disk hotplug API gives us a strong foundation for attach/detach without VM restart.
- Snapshot implementation depends heavily on the storage backend chosen (ZFS snapshots vs qemu-img snapshots vs filesystem-level).
