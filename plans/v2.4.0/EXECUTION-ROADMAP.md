<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v2.4.0 (Backup Weaver)

**Last updated:** 2026-03-06

Backup jobs, adapter interface, local/NFS adapters, and restore workflows. For the full product roadmap and decision log, see [MASTER-PLAN.md](../../MASTER-PLAN.md).

## Phase Overview

```
v2.5.0: Backup Weaver                              ░░░░░░░░░░░░░░░░░░░░  PLANNED
```

## Detailed Plans

- Backup & recovery design: [BACKUP-RECOVERY-PLAN.md](../v2.0.0/BACKUP-RECOVERY-PLAN.md)
- Implementation phasing: [IMPLEMENTATION-PHASING-PLAN.md](../v2.0.0/IMPLEMENTATION-PHASING-PLAN.md)

---

## v2.5.0: Backup Weaver

| Task | Tier | Priority |
| --- | --- | --- |
| Config export UI (free tier — already exists as API) | Free | Medium |
| Backup job definition (schedule, target, retention) | Weaver | High |
| `BackupAdapter` interface (pluggable storage backends) | Weaver | High |
| Local filesystem backup adapter | Weaver | High |
| NFS backup adapter | Weaver | High |
| Disk backup + restore (full VM disk images) | Weaver | High |
| Backup job history and status UI | Weaver | Medium |
| Restore workflow (select backup → preview → restore) | Weaver | High |

---

## Release Plan

| Version | Milestone | Key Features | Status |
| --- | --- | --- | --- |
| v2.5.0 | Backup Weaver | Backup jobs, adapter interface, local/NFS adapters, restore | Planned |

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
