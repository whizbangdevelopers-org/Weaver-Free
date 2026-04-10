<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Feature Gaps — Not Previously Planned

Competitive gaps identified 2026-02-12 that were not in any existing roadmap, plan, or agent.
Cross-reference: [WEAKNESS-REMEDIATION.md](../business/archive/WEAKNESS-REMEDIATION.md) for gaps that *were* already planned.

---

## High Value — Tier placement decided, agents created

| Done | Feature | Agent | Version | Tier | Rationale |
|:----:|---------|-------|---------|------|-----------|
| [ ] | VM tags / labels / grouping | [v1x-tags-search](../agents/v1x-tags-search.md) | v1.1 | Free (basic), Premium (filtered views, tag-based bulk) | Can't organize 20+ VMs without grouping. Proxmox/Portainer/Incus all have tags. |
| [ ] | Dashboard search & filter | [v1x-tags-search](../agents/v1x-tags-search.md) | v1.1 | Free | Users need to find VMs by name, status, tag, hypervisor. |
| [ ] | Bulk actions (start/stop all, by tag) | [v1x-tags-search](../agents/v1x-tags-search.md) | v1.1 | Free (all), Premium (tag-based) | Painful without it at 10+ VMs. |
| [ ] | Notifications / alerts | [v1x-notifications](../agents/v1x-notifications.md) | v1.1 | Premium (ntfy.sh), Enterprise (all adapters) | VM goes down and nobody knows. Already in tier strategy, not built. |
| [ ] | Dark mode | [v1-dark-mode](../agents/v1-dark-mode.md) | v1.0 | Free | Quasar supports it trivially. Homelabbers expect it. |
| [ ] | VM auto-start policy | [v1-autostart](../agents/v1-autostart.md) | v1.0 | Free | Most common VM manager feature. `autostart` field already on VmDefinition, not wired to UI. |
| [ ] | VM notes / description | [v1-vm-notes](../agents/v1-vm-notes.md) | v1.0 | Free | Free-text notes per VM. Proxmox/Portainer have this. Simple but expected. |

## Medium Value — Candidates for v1.1–v1.2

| Done | Feature | Version | Tier | Notes |
|:----:|---------|---------|------|-------|
| [ ] | Cloud-init userdata editor | v1.2 | Premium | Cloud-init provisioning exists but no UI to edit userdata. |
| [ ] | SSH key management | v1.2 | Premium | Inject SSH keys at VM creation. Currently manual config inside guest. |
| [ ] | API documentation (OpenAPI/Swagger) | v1.1 | Free | No programmatic integration path. Power users and enterprise want to script against the API. |
| [ ] | Webhook integrations | v1.2 | Premium | Fire webhooks on VM events (started/stopped/failed). Enables external automation. |
| [ ] | WebSocket fallback polling | v1.1 | Free | Already in WEAKNESS-REMEDIATION.md (#10). When WS disconnects, no HTTP fallback. |

## Lower Priority — Post v1.2

| Done | Feature | Version | Tier | Notes |
|:----:|---------|---------|------|-------|
| [ ] | VM resource quotas / limits | v2.0 | Enterprise | Per-user or per-group resource caps. Only needed for teams. |
| [ ] | DNS management for VMs | v2.0 | Premium | Configure DNS records for VM IPs. Nice but niche. |
| [ ] | i18n / multi-language | v2.0 | Free | Already deferred in dev backlog. Only matters for non-English markets. |
| [ ] | VM console recording / replay | v2.0 | Enterprise | Record serial/VNC sessions for audit. Very enterprise. |

---

*Last reviewed: 2026-02-12*
