<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v2.5.0 (Storage & Template Fabrick)

**Last updated:** 2026-03-06

Copy-on-write, storage pools, quotas, template versioning, and fleet updates. For the full product roadmap and decision log, see [MASTER-PLAN.md](../../MASTER-PLAN.md).

## Phase Overview

```
v2.6.0: Storage & Template Fabrick                 ░░░░░░░░░░░░░░░░░░░░  PLANNED
```

## Detailed Plans

- Disk provisioning: [DISK-PROVISIONING-PLAN.md](../v2.0.0/DISK-PROVISIONING-PLAN.md)
- System templating: [SYSTEM-TEMPLATING-PLAN.md](../v2.0.0/SYSTEM-TEMPLATING-PLAN.md)

---

## v2.6.0: Storage & Template Fabrick

| Task | Tier | Priority |
| --- | --- | --- |
| Copy-on-write disk provisioning (qcow2 backing files) | Fabrick | High |
| Storage pools (group disks, track capacity, allocation policies) | Fabrick | High |
| Storage quotas per user/role | Fabrick | High |
| Template versioning (v1, v2, ... with diff view) | Fabrick | Medium |
| Fleet template updates (push template changes to running VMs) | Fabrick | High |
| Advanced disk management (I/O scheduling, tiered storage) | Fabrick | Medium |

---

## Release Plan

| Version | Milestone | Key Features | Status |
| --- | --- | --- | --- |
| v2.6.0 | Storage & Template Fabrick | CoW, pools, quotas, versioning, fleet updates | Planned |

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
