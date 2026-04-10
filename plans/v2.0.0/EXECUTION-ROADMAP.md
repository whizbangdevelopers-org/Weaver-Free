<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v2.0.0 (Storage & Template Foundation)

**Last updated:** 2026-03-06

Storage foundation, built-in templates, cloud-init, agent extraction, and Nix template editor. Mobile app shipped in v1.3.0. For import/export (v1.4–v1.5), see [v1.4.0/](../v1.4.0/) and [v1.5.0/](../v1.5.0/). For subsequent v2.x releases, see [v2.1.0/](../v2.1.0/) through [v2.5.0/](../v2.5.0/). For v3.0, see [v3.0.0/](../v3.0.0/). For the full product roadmap and decision log, see [MASTER-PLAN.md](../../MASTER-PLAN.md).

## Pre-Planning TODO

- [ ] Absorb planned features from MASTER-PLAN into this roadmap: nginx reverse proxy template, HAProxy load balancer template. See [MASTER-PLAN.md § Planned Features Not Yet in Roadmaps](../../MASTER-PLAN.md#planned-features-not-yet-in-roadmaps).

## Phase Overview

```
v2.0.0: Storage & Template Foundation              ░░░░░░░░░░░░░░░░░░░░  PLANNED
```

> **Note:** Capacitor mobile app moved to v1.3.0 (Remote Access + Mobile). See [plans/v1.3.0/EXECUTION-ROADMAP.md](../v1.3.0/EXECUTION-ROADMAP.md).

## Detailed Plans

- Disk provisioning: [DISK-PROVISIONING-PLAN.md](DISK-PROVISIONING-PLAN.md)
- System templating: [SYSTEM-TEMPLATING-PLAN.md](SYSTEM-TEMPLATING-PLAN.md)
- Multi-node architecture: [V2-MULTINODE-PLAN.md](V2-MULTINODE-PLAN.md)
- Backup & recovery: [BACKUP-RECOVERY-PLAN.md](BACKUP-RECOVERY-PLAN.md)
- Implementation phasing (v2.0–v2.5): [IMPLEMENTATION-PHASING-PLAN.md](IMPLEMENTATION-PHASING-PLAN.md)

---

## v2.0.0: Storage & Template Foundation

**Agents:** [agent-extract](../../agents/v2.0.0/agent-extract.md), [template-editor](../../agents/v2.0.0/template-editor.md)

| Task | Tier | Priority |
| --- | --- | --- |
| Disk lifecycle (create, attach, detach, resize, delete) | Free | High |
| Disk hotplug (attach/detach without VM restart) | Weaver | High |
| I/O limits (per-disk IOPS and throughput caps) | Weaver | Medium |
| Built-in VM templates (common OS configurations) | Free | High |
| Cloud-init integration (inject userdata at VM creation) | Weaver | High |
| i18n / multi-language foundation | Free | Low |

### AI & GPU Infrastructure (v2.0)

From the [AI-GPU-INFRASTRUCTURE-PLAN.md](../cross-version/AI-GPU-INFRASTRUCTURE-PLAN.md):

| Task | Tier | Priority |
| --- | --- | --- |
| Ollama integration (template + health probe) | Weaver | High |
| vLLM integration (template + health probe) | Weaver | High |
| TGI integration (template + health probe) | Weaver | Medium |
| Model Library — registry of references (HuggingFace, S3, local, Ollama tag) | Weaver | High |
| Single-host model deployment workflow | Weaver | High |
| Auto-snapshot on inference health check pass (Decision #119) | Weaver | Medium |

**Moved to later versions:**
- Agent extraction → v2.3.0 (Fabrick Basic Clustering, where it belongs)
- nixos-anywhere + Colmena + Attic → v2.3.0 (Fabrick multi-node infrastructure)
- Nix template editor → v2.1.0 (pairs with template library)
- TPM support + cloudbase-init → v2.1.0 (Windows guest additions, additive)

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
