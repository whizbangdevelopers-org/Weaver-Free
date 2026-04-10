<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Backup & Recovery Plan

**Status:** All Initial Questions Decided
**Target:** Post-v1.0 — Phases 9a/9b in Execution Roadmap
**Created:** 2026-02-21
**Last Updated:** 2026-02-21
**Depends On:** [DISK-PROVISIONING-PLAN.md](DISK-PROVISIONING-PLAN.md) (snapshots, storage pools), [SYSTEM-TEMPLATING-PLAN.md](SYSTEM-TEMPLATING-PLAN.md) (VM config export)

---

## Overview

Design backup and recovery features for Weaver. Backups sit above snapshots — snapshots are point-in-time disk copies (local, fast, for rollback), while backups are durable copies (potentially off-host, for disaster recovery). The relationship between these two systems needs to be clearly defined.

## Industry Survey

### Proxmox VE

- Backup jobs: scheduled or manual, per-VM or bulk
- Backup modes: snapshot (live, no downtime), suspend (brief pause), stop (clean shutdown first)
- Storage targets: local, NFS, PBS (Proxmox Backup Server)
- Backup format: VMA (Proxmox-specific archive containing disk + config)
- Retention policies: keep-last, keep-daily, keep-weekly, keep-monthly
- Restore: full VM restore or individual file-level restore (via PBS)
- PBS deduplication: incremental backups at block level

### LXD/Incus

- Snapshots for local point-in-time (not backups)
- `lxc export` creates a tarball (instance + config + snapshots)
- Backup storage is external (user manages where tarballs go)
- No built-in backup scheduler — rely on cron/systemd timers
- Restore via `lxc import`

### AWS

- EBS Snapshots: incremental, stored in S3, cross-region copy
- AWS Backup: centralized backup service across services
- Backup plans: scheduled, retention policies, lifecycle rules
- Point-in-time recovery for RDS (continuous backup)
- Backup vault: immutable storage for compliance (WORM)
- Cross-account backup for DR

### Kubernetes

- Velero: cluster-level backup (resources + persistent volumes)
- CSI snapshots for volume-level backup
- etcd backup for cluster state
- No built-in backup — ecosystem tools

### Restic / Borg (general-purpose)

- Deduplication at block level
- Encryption at rest
- Multiple backends (local, S3, SFTP, etc.)
- Incremental forever (no full/differential distinction)
- Retention policies with pruning

---

## Snapshots vs Backups: The Relationship

| Aspect | Snapshots (Disk Plan) | Backups (This Plan) |
|--------|----------------------|---------------------|
| Purpose | Quick rollback, point-in-time | Disaster recovery, compliance |
| Location | Same host/pool as source | Off-host, off-site, or separate pool |
| Speed | Fast (CoW or qemu-img) | Slower (copy + compress + transfer) |
| Durability | Tied to source disk — lose the pool, lose the snapshot | Independent — survives host loss |
| Scope | Disk-level or VM-level (per disk plan) | VM-level (disk + config + metadata) |
| Retention | Short-term (hours/days) | Long-term (weeks/months/years) |
| Tier | Weaver (manual), Fabrick (scheduled) | TBD |

Key insight: **Snapshots are not backups.** Snapshots protect against "oops I broke my VM." Backups protect against "the host disk died" or "compliance requires 90 days of history."

---

## Feature Categories

| Category | Description | Complexity | Tier | Decision |
|----------|-------------|------------|------|----------|
| Import external images | Import raw/qcow2 disk images from outside | Low | Free | Decided (B1) |
| Export VM | Download disk + config as portable archive | Low-medium | Free | Decided (B1) |
| Manual VM backup | On-demand snapshot-based VM backup | Medium | Weaver | Decided (B1) |
| Scheduled VM backup | Automated VM backup to one target | Medium | Weaver | Decided (B1) |
| Manual data backup | Back up specific directories with pre/post hooks | Medium-high | Weaver | Decided (B1) |
| Scheduled data backup | Automated data backup to one target | Medium-high | Weaver | Decided (B1) |
| Multiple backup targets | Configure more than one backup destination | Medium | Fabrick | Decided (B1) |
| Snapshot promotion | Promote existing snapshot to durable backup | Low-medium | Fabrick | Decided (B1) |
| Retention policies | Keep-last-N, keep-daily/weekly/monthly, auto-prune | Medium | Fabrick | Decided (B1) |
| Application-aware hooks | DB-specific pre/post scripts, per-directory retention | High | Fabrick | Decided (B1) |
| Backup verification | Integrity checks on stored backups | Low-medium | Fabrick | Decided (B1) |
| Backup format | Adapter-determined (raw+JSON, tar.gz, restic/borg native) | Medium | N/A (impl detail) | Decided (B3) |
| Built-in backup targets | Local directory, NFS mount | Medium | Weaver+ | Decided (B2, B3) |
| Extension backup targets | S3-compatible, restic repo, borg repo | Medium | Extension (any paid tier) | Decided (B3) |
| Incremental backups | Only back up changed blocks since last backup | High | Extension-delivered | Decided (B6) |
| Restore (full VM) | Restore entire VM from backup | Medium | Weaver+ | Decided (B6) |
| Restore (individual files) | Mount backup and extract specific files | High | Fabrick | Decided (B6) |
| Encryption at rest | Encrypt backup archives | Medium | Fabrick / Extension | Decided (B6) |
| Cross-host restore | Restore backup on a different host | Medium | Fabrick | Decided (B6) |

---

## Open Questions

### B1. Snapshot-to-Backup Relationship, Tier Split, and Data-Level Backup

How do snapshots and backups interact? What tier does each feature land in? Does the system support data-only backups (not just full VM)?

**Status:** DECIDED

**Decision:** Snapshot-based backups as the consistency mechanism. Import/export at Free tier (anti-lock-in). Scheduled backup to one target at Weaver. Data-level backup with pre/post hooks. Fabrick gets operational depth.

**Anti-lock-in principle (informed by DigitalOcean's closed model):** Import/export must be Free and use open formats (raw/qcow2 + JSON config). Users must always be able to get their data out. Backup format must be portable — no proprietary archives that only Weaver can read.

| Tier | VM-level | Data-level |
|------|----------|------------|
| Free | Import external images (raw/qcow2). Export VM (disk + config, open format). | — |
| Weaver | Manual + scheduled VM backup to one target. Snapshot-based for consistency. | Manual + scheduled data backup with pre/post hooks to one target. |
| Fabrick | Multiple backup targets. Snapshot promotion. Advanced retention policies (keep-daily/weekly/monthly, auto-prune). Backup verification. | Same + application-aware hooks (DB-specific), per-directory retention. |

**Data-level backup mechanism:** Pre/post hooks (lightest touch). User defines:
- Pre-backup command: e.g., `pg_dump -U postgres mydb > /tmp/backup.sql`
- Paths to back up: e.g., `/tmp/backup.sql`, `/srv/photos/`
- Post-backup command: e.g., `rm /tmp/backup.sql`

**Rationale:** Weaver = automation (scheduled) to one place. Fabrick = operational depth (multiple targets, retention rules, verification, app-aware hooks). Import/export is Free because lock-in harms adoption — our audience (NixOS sysadmins) won't commit to a platform that holds their data hostage.

---

### B2. Backup Targets

Where can backups be stored?

- Local directory (same host, different pool — protects against VM deletion, not host failure)
- NFS/CIFS mount (off-host, traditional)
- S3-compatible storage (off-site, cloud-native — MinIO, AWS S3, Backblaze B2)
- Restic/Borg repository (leverage existing backup infrastructure)

**Status:** DECIDED (revised by B3 — extension model)

**Decision:** Built-in adapters (local directory, NFS) ship with all tiers that have backup. Advanced adapters (S3, restic/borg) are purchasable extensions at any paid tier. Tier gates target **count**. Extension model gates target **type**.

| Tier | Built-in targets | Extension targets | Target count |
|------|-----------------|----------------|--------------|
| Weaver | Local directory, NFS | S3, restic/borg (purchasable) | One configured target |
| Fabrick | Local directory, NFS | S3, restic/borg (purchasable) | Multiple targets |

**Extension model:** Advanced backup adapters are add-ons purchasable at any paid tier. A Weaver user who runs restic buys the restic extension and backs up to one restic repo. An Fabrick user buys restic + S3 extensions and backs up to both. Extends the BYOK (Bring Your Own Key) philosophy to BYOB (Bring Your Own Backup tool).

**Design note:** Backup target = adapter interface (matches existing codebase pattern). Each target type gets a storage adapter. Extensions are the same adapter interface — the gate is a license check, not an architecture difference. Adding new target types later is just a new adapter + extension listing.

**Rationale:** Avoids forcing a full Fabrick upgrade for users who just want restic integration. Weaver homelab user with restic is well-served by Weaver + restic extension. Fabrick value remains target count (redundancy/DR) and operational depth (retention, verification). Extension revenue captures the "tweener" customer without adding a 5th tier.

---

### B3. Backup Format and Extension Model

What format are backups stored in? How does format interact with tiering?

- **Custom archive:** Tarball of disk image + VM config JSON. Simple, portable, large.
- **Restic/Borg integration:** Delegate to proven backup tools. Deduplication, encryption, incremental — for free. But adds a dependency.
- **Raw copy + sidecar:** Copy disk image as-is + JSON config sidecar. No compression overhead, but large.

**Status:** DECIDED

**Decision:** Adapter-determined format + extension monetization model. Format is an implementation detail of the target adapter — users choose a target, the adapter handles the format. Built-in adapters ship with all paid tiers. Advanced adapters are purchasable extensions.

| Adapter | Format | Built-in or Extension |
|---------|--------|--------------------|
| Local directory | Raw copy + JSON sidecar | Built-in |
| NFS mount | Raw copy + JSON sidecar | Built-in |
| S3-compatible | Compressed archive (tar.gz) + JSON sidecar | Extension |
| Restic repo | Restic native (dedup + encryption) | Extension |
| Borg repo | Borg native (dedup + encryption) | Extension |

**Free tier (export):** Always raw copy + JSON sidecar — maximum portability. No target configuration needed; user downloads via browser/curl. Export is a file download, not a backup system.

**Extension model (product-wide decision):** Advanced backup adapters are add-ons purchasable at any paid tier, independent of the tier upgrade path. Extends the BYOK philosophy — "Bring Your Own Backup tool." A Weaver user with an existing restic infrastructure buys the restic extension instead of upgrading to Fabrick. This keeps the 4-tier matrix (demo/free/weaver/fabrick) clean while capturing revenue from users who need one specific advanced capability.

**Implications for B2:** B2 revised — built-in adapters at all paid tiers, extension adapters purchasable separately. Tier still gates target count (Weaver=1, Fabrick=multiple).

**Rationale:** Format follows target — no user-facing format choice. All formats use open, portable standards (anti-lock-in from B1). Extension model avoids a 5th tier, captures "tweener" revenue, and matches the BYOK brand identity. NixOS audience disproportionately uses restic — extension model lets them buy exactly what they need.

---

### B4. Tier Differentiation

Which backup features land in which tier?

**Status:** DECIDED — Folded into B1

See B1 for the full tier matrix covering VM-level, data-level, and import/export.

---

### B5. Backup Scope

What's included in a backup?

- Disk image(s) only?
- Disk + VM config (compute, network)?
- Disk + VM config + cloud-init + template reference?
- Disk + VM config + snapshots?

**Status:** DECIDED

**Decision:** Disk images + VM config + cloud-init user-data + template reference (metadata only). Snapshots excluded.

| Layer | Included | Why |
|-------|----------|-----|
| Disk image(s) | Yes | The data — this is the point of a backup. |
| VM config (vCPUs, memory, kernel, cmdline, network, bridge, MAC) | Yes | Without config, restore requires manual re-creation. Config makes restore one-click. |
| Cloud-init user-data | Yes | SSH keys, hostname, packages — losing this means restored VM boots differently than original. Small data, high value. |
| Template reference | Yes (metadata only) | Template name + version (if Fabrick). Provenance tracking, not the template itself. |
| Snapshots | No | Snapshots are local rollback tools (per snapshot-vs-backup distinction). Including them doubles backup size for data that serves a different purpose. Snapshot promotion (Fabrick, B1) is the designed path to preserve a specific snapshot as a durable backup. |

**Rationale:** Backup = everything needed to restore a functional VM in one operation. Config + cloud-init achieve that. Snapshots are excluded by design — they're a different system with a different purpose, and the promotion path (Fabrick) already bridges the two when needed.

---

### B6. Remaining Feature Tiers (Incremental, Restore, Encryption, Cross-Host)

How do the remaining backup features tier out?

**Status:** DECIDED

**Decision:**

| Feature | Tier | Mechanism |
|---------|------|-----------|
| Incremental backups | Extension-delivered | Restic/borg handle incrementals natively. Built-in adapters (raw copy) are always full copy. Not a tier gate — it's an inherent capability of the extension adapter you choose. |
| Restore (full VM) | Weaver+ (matches backup tier) | Every tier that can back up can restore. Backup without restore is a write-only archive. |
| Restore (individual files) | Fabrick | Power-user workflow — mount backup image, navigate filesystem, extract files. Extension adapters (restic/borg) have native file-level restore. Most users restore the whole VM. |
| Encryption at rest | Fabrick (built-in) / Extension-delivered (restic/borg) | Built-in adapters: Fabrick adds optional encryption wrapper (age or GPG) around raw copy. Extension adapters: encryption is native. Compliance feature. |
| Cross-host restore | Fabrick | Multi-node/DR concern. Connects to V2 multi-node plan. Restore adjusts network config interactively (prompt for new bridge/subnet if original doesn't exist on target). |

**Rationale:** Incremental and encryption follow the extension pattern — advanced capabilities delivered by advanced adapters, not tier-gated separately. Full VM restore is table stakes for any backup tier. File-level restore and cross-host restore are operational depth (Fabrick). Cross-host restore explicitly deferred to V2 multi-node foundation.

---

## Decisions Log

Decisions are recorded here as they are made during discussion.

| # | Date | Question | Decision | Rationale |
|---|------|----------|----------|-----------|
| B1 | 2026-02-21 | Snapshot-backup relationship + tiers + data-level | Snapshot-based consistency; Free=import/export (anti-lock-in); Weaver=manual+scheduled to 1 target (VM+data); Fabrick=multi-target, retention, app-aware hooks | Weaver=automation to one place, Fabrick=operational depth; open formats prevent DO-style lock-in |
| B2 | 2026-02-21 | Backup targets | Built-in adapters (local/NFS) at all paid tiers; advanced adapters (S3/restic/borg) as purchasable extensions; tier gates count not type | Revised by B3: extension model captures tweener revenue without 5th tier; Weaver=1 target, Fabrick=multiple |
| B3 | 2026-02-21 | Backup format + extension model | Adapter-determined format (local/NFS=raw+JSON, S3=tar.gz+JSON, restic/borg=native); advanced adapters as purchasable extensions at any paid tier; Free export=raw+JSON download | Format follows target; extension model extends BYOK philosophy; avoids 5th tier; all formats open/portable |
| B5 | 2026-02-21 | Backup scope | Disk images + VM config + cloud-init + template ref (metadata). Snapshots excluded. | Backup = everything for one-click restore; snapshots are a different system; promotion (Fabrick) bridges the two |
| B6 | 2026-02-21 | Remaining features | Incremental=extension-delivered; full restore=Weaver+; file restore=Fabrick; encryption=Fabrick/extension; cross-host=Fabrick (V2) | Extension pattern for advanced capabilities; restore matches backup tier; operational depth at Fabrick |

---

## Notes

- Phases 9a/9b in the execution roadmap are allocated for backup & recovery.
- Snapshots (disk plan) are a prerequisite — they provide the consistency mechanism for live backups.
- Backup tooling choice (custom vs restic/borg integration) has major implications for implementation scope.
- Cross-host restore connects to the multi-node plan (V2) — restoring on a different host implies the target host can accept the VM config format.
