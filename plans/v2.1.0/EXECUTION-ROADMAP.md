<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v2.1.0 (Storage & Template Weaver)

**Last updated:** 2026-03-06

Snapshots, cloning, save-as-template, and template library. Builds on the storage foundation from v2.0.0. For the full product roadmap and decision log, see [MASTER-PLAN.md](../../MASTER-PLAN.md).

## Phase Overview

```
v2.1.0: Storage & Template Weaver                  ░░░░░░░░░░░░░░░░░░░░  PLANNED
```

## Detailed Plans

- System templating: [SYSTEM-TEMPLATING-PLAN.md](../v2.0.0/SYSTEM-TEMPLATING-PLAN.md)

---

## v2.1.0: Storage & Template Weaver

| Task | Tier | Priority |
| --- | --- | --- |
| Disk snapshots (create, list, restore, delete) | Weaver | High |
| VM cloning (full clone from running or stopped VM) | Weaver | High |
| Save-as-template (running VM → reusable template) | Weaver | High |
| Template library UI (browse, search, create-from-template) | Weaver | High |
| YAML cloud-init editor (structured UI for userdata) | Weaver | Medium |
| "Create from template" workflow in CreateVmDialog | Weaver | High |
| Template metadata (description, tags, base distro, author) | Weaver | Medium |
| Nix template editor (visual NixOS module composition) | Weaver | Medium |
| TPM support (swtpm) for Windows 11 compliance | Fabrick | Medium |
| cloudbase-init (Windows cloud-init equivalent) | Fabrick | Low |

**Host Maintenance Manager** (Decision #111 — parallel agent, same version)

| Task | Tier | Priority |
| --- | --- | --- |
| Nix store GC — on-demand + scheduled, disk reclaimed before/after | Weaver Solo | High |
| Generation management — list, prune to N, rollback safety gate | Weaver Solo | High |
| Flake update — `nix flake update`, input diff, confirmation gate | Weaver Solo | High |
| Path A rebuild — `nixos-rebuild test → health check → confirm → switch`, live log stream | Weaver Solo | High |
| AI remediation loop — diagnose, propose safe fix, execute, re-check (up to 3× Path A / 5× Path B) | Weaver Solo | High |
| Path B zero-downtime rebuild — clone active VMs → bridge shift → rebuild → health check → confirm or revert | Weaver Team | High |
| Reboot detection — kernel/bootloader diff detected → `nixos-rebuild boot` option surfaced | Weaver Solo | Medium |
| Maintenance windows — scheduled workload stop + task queue + auto-restart | Weaver Solo | Medium |

---

## Release Plan

| Version | Milestone | Key Features | Status |
| --- | --- | --- | --- |
| v2.1.0 | Storage & Template Weaver | Snapshots, cloning, save-as-template, template library, YAML cloud-init, Host Maintenance Manager (Path A + B + AI remediation loop) | Planned |

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
