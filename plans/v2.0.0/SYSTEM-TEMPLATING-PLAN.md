<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# System Templating Plan

**Status:** All Initial Questions Decided
**Target:** Post-v1.0 (no phase assigned yet)
**Created:** 2026-02-21
**Last Updated:** 2026-02-21
**Depends On:** [DISK-PROVISIONING-PLAN.md](DISK-PROVISIONING-PLAN.md) (decisions #1, #4)

---

## Overview

Design VM templating — the ability to define, save, and reuse complete VM configurations (disk + compute + network + initialization). Constrained by disk provisioning decisions: Weaver templates use full-copy disks, Fabrick templates use CoW overlays.

## Industry Survey

### Proxmox VE

- "Convert to Template" on any VM — freezes it as a base
- Clone from template: full clone or linked clone (CoW)
- Template = VM config + disk, not editable once converted
- No versioning — create a new template to "update"
- Cloud-init integration via dedicated config drive

### LXD/Incus

- Profiles: reusable config fragments (compute, network, disk, cloud-init)
- Profiles stack — apply multiple profiles to one instance
- Images: published from instances, stored in image store
- Image aliases + fingerprints for versioning
- `lxc publish instance --alias my-template` workflow

### AWS (AMI + Launch Template)

- AMI: disk snapshot + metadata (architecture, kernel, block device mappings)
- Launch Template: compute + network + user-data + AMI reference (versioned)
- Launch Template versions: v1, v2, v3 — can set default version
- "Create AMI from instance" = save running state as template
- Marketplace: shared AMI catalog (community + paid)

### Kubernetes (Pod templates)

- Pod spec in Deployment/StatefulSet = template
- Helm charts = parameterized templates with values files
- No "save running state" — declarative only
- Versioning via Helm chart versions or Git

### cloud-hypervisor (our hypervisor)

- No built-in template concept
- VM config is a JSON/YAML payload to the API
- Template = stored config + disk image (our responsibility)
- cloud-init: pass via config drive (ISO image) or kernel cmdline

---

## Template Schema

```
Template = {
  name: string
  description: string
  version: string

  // Disk layer (constrained by DISK-PROVISIONING-PLAN #4)
  disk: {
    baseImage: string        // distro catalog reference or custom image
    size: string             // e.g., "2G"
    format: "raw" | "qcow2"
    additionalDisks?: []     // extra data disks
  }

  // VM config layer
  compute: {
    vcpus: number
    memory: string           // e.g., "512M"
    kernel?: string          // custom kernel path
    cmdline?: string         // kernel command line
  }

  // Network layer
  network: {
    mode: "bridge" | "nat"
    bridge?: string
    macAddress?: string      // fixed or auto-generated
  }

  // Initialization layer
  init?: {
    cloudInit?: object       // cloud-init user-data
    scripts?: string[]       // post-boot scripts
  }

  // Metadata
  tags: string[]
  createdFrom?: string       // VM name if saved from running VM
  createdAt: string
}
```

---

## Feature Categories

| Category | Description | Complexity | Tier | Decision |
|----------|-------------|------------|------|----------|
| Built-in templates | Ship curated defaults with the product | Low | Free | Decided (T1, T3) |
| Create VM from template | One-click VM creation from template | Low-medium | Free | Decided (T3) |
| Save VM as template | Capture running VM config + disk as template | Medium | Weaver | Decided (T1, T3) |
| Template library UI | Browse, search, manage saved templates | Medium | Weaver | Decided (T3) |
| Cloud-init basic | Hostname, SSH keys, root password | Low-medium | Free | Decided (T4) |
| Cloud-init advanced | Basic fields + raw YAML editor | Medium | Weaver | Decided (T4) |
| Template versioning | v1, v2, v3 with default version tracking | Medium | Fabrick | Decided (T2, T3) |
| Template sharing | Share templates across users | Low | Fabrick | Decided (T3) |
| Fleet updates | Update VMs to match newer template version | High | Fabrick | Decided (T3) |

---

## Open Questions

### T1. Template Sources

Where do templates come from?

| Source | Description | Example |
|--------|-------------|---------|
| Built-in | Ship with the product, curated defaults | "NixOS minimal", "Ubuntu web server" |
| Built-in (infrastructure) | Pre-loaded templates that close K8s-equivalent gaps without new subsystems | "nginx reverse proxy" (ingress/LB), "HAProxy load balancer" (TCP/HTTP LB) |
| User-created | "Save as template" from existing VM | Save a configured VM for reuse |
| Community/marketplace | Import from external catalog | Future — shared template registry |

**Status:** DECIDED

**Decision:**

| Source | Tier | Behavior |
|--------|------|----------|
| Built-in | All tiers | Curated defaults ship with the product. Extends distro catalog with compute + network + cloud-init defaults. Every user gets a starting point. |
| User-created | Weaver | "Save as template" from existing VM. Template library for managing saved templates. |
| Community/marketplace | Future (deferred) | Depends on multi-node plan (V2) and trust/curation model. Separate planning topic when foundation exists. |

**Rationale:** Built-in templates are onboarding — they make the product useful out of the box. User-created templates are a power-user workflow that aligns with Weaver. Community/marketplace is deferred — it implies trust models, curation, and potentially multi-node distribution that aren't designed yet.

---

### T2. Template Versioning

Do templates have versions?

- **No versioning:** Simple. Template is a snapshot in time. Edit = overwrite.
- **Versioning:** Template v1, v2, v3. Can roll back. VMs track which version they were created from. Enables "update all VMs from template v2 to v3" workflows. More complex.

**Status:** DECIDED — Tiered

**Decision:**

| Tier | Behavior |
|------|----------|
| Weaver | No versioning. Template = latest state. Edit overwrites. "Save as template" creates a named template. Simple. |
| Fabrick | Versioned templates. Each save creates a new immutable version. VMs track source version. Enables fleet queries and coordinated updates. |

**Rationale:** Data model difference is small (add `version: number` + historical snapshots). UX difference is significant (version picker, diff view, fleet queries). Weaver keeps it simple, Fabrick unlocks the operational power.

---

### T3. Template + Tier Interaction

Which template features land in which tier?

**Status:** DECIDED

**Decision:**

| Feature | Weaver Free | Weaver | Fabrick |
|---------|------|---------|------------|
| Built-in templates (use) | Yes | Yes | Yes |
| Create VM from template | Yes | Yes | Yes |
| Save VM as template | — | Yes | Yes |
| Template library UI | — | Yes | Yes |
| Template versioning | — | — | Yes |
| Template sharing (across users) | — | — | Yes |
| Fleet updates (from template version) | — | — | Yes |

**Rationale:** Free gets to consume built-in templates — that's onboarding, not a power feature. Weaver unlocks template creation and management. Fabrick unlocks versioning, sharing, and fleet operations. Consistent with disk plan tier philosophy.

---

### T4. Cloud-init Integration Depth

How deep does cloud-init go?

- **Basic:** Hostname, SSH keys, root password — covers 80% of use cases
- **Full:** Arbitrary cloud-init YAML (users, packages, runcmd, write_files) — powerful but complex UI
- **Hybrid:** Basic fields in the UI + "advanced" raw YAML editor for power users

**Status:** DECIDED — Tiered

**Decision:**

| Tier | Behavior |
|------|----------|
| Free | Basic cloud-init: hostname, SSH keys, root password. Three form fields. |
| Weaver | Hybrid: basic fields + advanced raw YAML editor. Power users can do anything cloud-init supports. |
| Fabrick | Same as Weaver. Cloud-init depth doesn't need another tier gate — Fabrick value is in fleet/versioning, not YAML editing. |

**Rationale:** Cloud-init depth is a UX question, not a scale question. Free gets functional defaults. Weaver unlocks the full editor. Fabrick doesn't need more cloud-init power.

---

## Decisions Log

Decisions are recorded here as they are made during discussion.

| # | Date | Question | Decision | Rationale |
|---|------|----------|----------|-----------|
| T1 | 2026-02-21 | Template sources | Built-in=all tiers, User-created=Weaver, Community/marketplace=deferred | Onboarding for all, power-user workflow at Weaver, marketplace needs V2 foundation |
| T2 | 2026-02-21 | Template versioning | Weaver=no versioning (edit overwrites), Fabrick=immutable versions with fleet tracking | Small data model cost, large UX cost; tier controls complexity exposure |
| T3 | 2026-02-21 | Tier interaction | Free=consume built-ins, Weaver=create+library, Fabrick=versioning+sharing+fleet | Onboarding free, creation paid, operations fabrick |
| T4 | 2026-02-21 | Cloud-init depth | Free=basic (hostname/SSH/password), Weaver=hybrid (basic+raw YAML), Fabrick=same as Weaver | UX question not scale question; full editor at Weaver sufficient |

---

## Notes

- This is a post-v1.0 feature set. No phase assigned in the execution roadmap yet.
- Disk layer decisions are locked by DISK-PROVISIONING-PLAN: Weaver = full-copy disks, Fabrick = CoW overlays.
- cloud-hypervisor has no native template concept — this is entirely our abstraction.
- Cloud-init delivery mechanism for cloud-hypervisor: config drive (ISO image mounted as secondary disk) or kernel cmdline injection.
