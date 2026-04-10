<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v2.6.0 (Backup Fabrick + Extensions)

**Last updated:** 2026-03-06

Multi-target backup, retention policies, remote storage extensions, file-level restore, and encryption. For backup premium (v2.5.0), see [v2.5.0/EXECUTION-ROADMAP.md](../v2.5.0/EXECUTION-ROADMAP.md). For the full product roadmap and decision log, see [MASTER-PLAN.md](../../MASTER-PLAN.md).

## Phase Overview

```
v2.6.0: Backup Fabrick + Extensions                 ░░░░░░░░░░░░░░░░░░░░  PLANNED
```

## Detailed Plans

- Backup & recovery design: [BACKUP-RECOVERY-PLAN.md](../v2.0.0/BACKUP-RECOVERY-PLAN.md)
- Implementation phasing: [IMPLEMENTATION-PHASING-PLAN.md](../v2.0.0/IMPLEMENTATION-PHASING-PLAN.md)

---

## v2.6.0: Backup Fabrick + Extensions

| Task | Tier | Priority |
| --- | --- | --- |
| Multi-target backup (backup to multiple destinations simultaneously) | Fabrick | High |
| Retention policies (time-based, count-based, GFS rotation) | Fabrick | High |
| S3 backup adapter extension | Fabrick | High |
| restic backup adapter extension | Fabrick | Medium |
| borg backup adapter extension | Fabrick | Medium |
| File-level restore (mount backup, browse, extract individual files) | Fabrick | High |
| Backup encryption (at-rest, client-side key management) | Fabrick | High |
| Backup verification (integrity checks, test restores) | Fabrick | Medium |

---

## Release Plan

| Version | Milestone | Key Features | Status |
| --- | --- | --- | --- |
| v2.6.0 | Backup Fabrick + Extensions | Multi-target, retention, S3/restic/borg extensions, file restore, encryption | Planned |

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
