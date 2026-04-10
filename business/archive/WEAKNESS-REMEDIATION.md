<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weakness Remediation Plan

**Last updated:** 2026-02-12

Prioritized plan to close competitive gaps identified in [competitive-landscape.md](../research/competitive-landscape.md).

---

## Priority Classification

- **Pre-v1.0** — Must ship before the first release. Without these, the product is not credible for real-world use.
- **v1.1–v1.2** — Table-stakes features that established competitors have. Ship within 2–3 releases after v1.0.
- **v2.0+** — Enterprise-scale features. Only worth building once there's a user base that needs them.
- **Ongoing** — Community and marketing work that runs in parallel with development.

---

## Pre-v1.0 (Blockers for Credibility)

These weaknesses make the product unsuitable for any real deployment if left unaddressed.

### 1. Authentication System

| Aspect | Detail |
|--------|--------|
| **Gap** | No login, no sessions, no user identity |
| **Impact** | Anyone with network access has full control of all VMs |
| **Competitors** | Proxmox (PAM/LDAP), Cockpit (PAM/SSO), Incus (TLS certs) |
| **Approach** | Session-based auth with configurable providers (local users first, LDAP/SSO in Enterprise tier) |
| **Scope** | Login page, session middleware, logout, password management |
| **Phase** | Phase 6 (already planned) |

### 2. Role-Based Access Control

| Aspect | Detail |
|--------|--------|
| **Gap** | No user roles or permissions |
| **Impact** | Cannot delegate read-only access or limit destructive actions |
| **Competitors** | Proxmox (granular permissions), Incus (fine-grained) |
| **Approach** | Three roles: `admin` (full), `operator` (start/stop/restart, no delete/provision), `viewer` (read-only). Keep it simple — avoid Proxmox's permission tree complexity. |
| **Scope** | Role model, middleware guards on routes, frontend conditional rendering |
| **Phase** | Phase 6 (already planned) |

### 3. Audit Logging

| Aspect | Detail |
|--------|--------|
| **Gap** | No record of who did what |
| **Impact** | Cannot troubleshoot incidents or satisfy compliance |
| **Competitors** | Proxmox (task log), Incus (operations log) |
| **Approach** | Append-only log: timestamp, user, action, target VM, result. JSON file initially, queryable via API. |
| **Scope** | Audit middleware, log storage, API endpoint to query logs, UI page |
| **Phase** | Phase 6 (already planned) |

### 4. API Rate Limiting

| Aspect | Detail |
|--------|--------|
| **Gap** | No protection against abuse |
| **Impact** | A single client can overload the backend |
| **Competitors** | Standard in any production API |
| **Approach** | `@fastify/rate-limit` plugin. Conservative defaults (100 req/min per IP). |
| **Scope** | Plugin registration, configuration, 429 response handling in frontend |
| **Phase** | Phase 6 (already planned) |

### 5. Security Hardening

| Aspect | Detail |
|--------|--------|
| **Gap** | No systematic security review |
| **Impact** | Unknown attack surface |
| **Competitors** | Proxmox (regular CVE patches), Cockpit (Red Hat security team) |
| **Approach** | Full audit: input validation review, CSRF protection, WebSocket auth, dependency audit, HTTPS enforcement guide |
| **Scope** | Audit checklist, fixes for findings, SECURITY.md update |
| **Phase** | Phase 6 (already planned) |

### 6. Production Deployment Guide

| Aspect | Detail |
|--------|--------|
| **Gap** | No documented path from install to running in production |
| **Impact** | Only the developer can deploy it |
| **Competitors** | Proxmox (ISO installer), Cockpit (package install), Incus (snap/package) |
| **Approach** | Step-by-step NixOS module guide, Docker Compose guide, manual install guide |
| **Scope** | `docs/deployment/` with NixOS, Docker, and manual paths |
| **Phase** | Phase 6 (already planned) |

---

## Deferred Follow-Ups (Pre-existing, Should Be Before v1 or v1.1)

These were deferred during feature phases but impact production readiness.

### Windows Guest Improvements (Deferred from Phase 5b)

| Item | Priority | Rationale |
|------|----------|-----------|
| UEFI/OVMF firmware support | v1.1 | Modern Windows (11+) requires UEFI. Without it, limited to Windows 10 and older. |
| VirtIO drivers ISO | v1.1 | IDE disk + e1000 networking works but is slow. VirtIO drivers improve Windows VM performance 3-5x. Ship the drivers ISO in the distro catalog. |
| autounattend.xml | v1.2 | Unattended Windows install. Nice-to-have for power users but not a blocker. |
| TPM support | v2.0+ | Required for Windows 11. Complex (swtpm integration). Defer until demand is clear. |
| cloudbase-init | v2.0+ | Windows equivalent of cloud-init. Niche use case. |

### Testing Gaps (Deferred from Dev Backlog)

| Item | Priority | Rationale |
|------|----------|-----------|
| Unit test coverage to 70%+ | Pre-v1.0 | Current coverage is low. Core services (provisioner, agent, VM lifecycle) need coverage before release. |
| Component tests (@vue/test-utils) | v1.1 | Frontend component tests catch UI regressions. Not blocking but valuable. |
| Visual regression tests (Playwright) | v1.1 | Screenshot comparison catches CSS regressions across releases. |
| Cross-browser testing | Pre-v1.0 | Must verify Chrome, Firefox, Safari, and mobile browsers before claiming PWA support. |
| NixOS module integration test | Pre-v1.0 | Must verify the module installs and runs on a clean NixOS system. |

### Technical Debt (Deferred from Dev Backlog)

| Item | Priority | Rationale |
|------|----------|-----------|
| Proper error types (not generic Error) | v1.1 | Improves debugging and error handling but not user-facing. |
| TypeScript strict settings review | v1.1 | Tightens type safety. Do after test coverage increase. |
| WebSocket authentication | Pre-v1.0 | Currently unauthenticated. Must gate with session tokens once auth exists. |
| WebSocket broadcast interval config | v1.1 | Currently hardcoded 2s. Larger deployments may need tuning. |

---

## v1.1–v1.2 (Table Stakes)

Features that established competitors have and users will expect shortly after v1.0.

### 7. VM Snapshots

| Aspect | Detail |
|--------|--------|
| **Gap** | No point-in-time snapshots |
| **Impact** | Users cannot save/restore VM state before risky operations |
| **Competitors** | Proxmox (live snapshots), Incus (snapshots), virt-manager (snapshots) |
| **Approach** | QEMU `qemu-img snapshot` for qcow2 disks. Create/list/restore/delete via API. |
| **Scope** | Backend service, API endpoints, VmDetail "Snapshots" tab |
| **Complexity** | Medium — QEMU supports this natively for qcow2 |

### 8. Monitoring / Resource Metrics

| Aspect | Detail |
|--------|--------|
| **Gap** | No CPU, memory, disk, or network usage data |
| **Impact** | Users cannot see if VMs are healthy or resource-starved |
| **Competitors** | Proxmox (built-in graphs), Cockpit (systemd metrics) |
| **Approach** | Phase 1: Collect from `/proc` and QEMU monitor. Phase 2: Prometheus metrics export for external dashboards (Grafana). |
| **Scope** | Backend collector, time-series storage (or export only), Dashboard sparklines or graphs |
| **Complexity** | Medium — collection is straightforward; storage/visualization adds scope |

### 9. Backup / Restore

| Aspect | Detail |
|--------|--------|
| **Gap** | No VM backup capability |
| **Impact** | Data loss risk on disk failure |
| **Competitors** | Proxmox (PBS integration), Incus (export/import) |
| **Approach** | Export VM disk + config as archive. Import to restore. Local or remote (NFS/S3) target. |
| **Scope** | Backend service, API endpoints, Settings "Backup" section |
| **Complexity** | Medium-High — disk I/O, compression, remote targets |

### 10. Dashboard Auto-Refresh Fallback

| Aspect | Detail |
|--------|--------|
| **Gap** | When WebSocket disconnects, dashboard shows stale data with no fallback |
| **Impact** | Users see outdated VM status until WebSocket reconnects |
| **Approach** | Poll `GET /api/vms` every 10s when WebSocket is disconnected |
| **Scope** | Frontend composable change |
| **Complexity** | Low |

---

## v2.0+ (Enterprise Scale)

Only build these once there's demonstrated demand from multi-node or team deployments.

### 11. Clustering / Multi-Node

| Aspect | Detail |
|--------|--------|
| **Gap** | Single-node only |
| **Competitors** | Proxmox (Corosync clustering), Incus (Raft-based clustering) |
| **Approach** | Agent-based: lightweight agent on each node, central dashboard aggregates. Avoid Proxmox's peer-to-peer complexity. |
| **Complexity** | Very High — distributed systems, consensus, network partitions |

### 12. Live Migration

| Aspect | Detail |
|--------|--------|
| **Gap** | Cannot move running VMs between hosts |
| **Competitors** | Proxmox, Incus, oVirt |
| **Approach** | QEMU live migration (`-incoming`). Requires shared storage or disk mirroring. |
| **Complexity** | Very High — depends on clustering, shared storage |
| **Prerequisite** | Clustering (item 11) |

### 13. Storage Pool Management

| Aspect | Detail |
|--------|--------|
| **Gap** | No abstraction over storage backends |
| **Competitors** | Proxmox (Ceph, ZFS, NFS, iSCSI, LVM) |
| **Approach** | Storage pool model with pluggable backends. Start with local directory + NFS. |
| **Complexity** | High |

---

## NixOS + Distro Catalog Value Proposition

The NixOS ecosystem creates a unique competitive advantage that no other VM management tool offers:

### Why NixOS + Distro Catalog = Defensible Value

1. **Declarative VM provisioning** — NixOS users define infrastructure as code. Weaver is the only web UI that lets them manage VMs defined this way. The NixOS module (`services.weaver`) provides declarative config for the dashboard itself, and microvm.nix provides declarative config for guest VMs. This is a full-stack declarative story nobody else has.

2. **Distro catalog as NixOS option** — The `distroCatalogUrl` NixOS module option lets admins point to a curated or private catalog of VM images. This turns the distro catalog into infrastructure-as-code: the available VM templates are declared in the NixOS config, version-controlled, and reproducible across hosts.

3. **Reproducible VM provisioning** — NixOS guest builds via Nix flake produce bit-for-bit reproducible VMs. Combined with the distro catalog, this means the exact same set of VM images and guest definitions can be deployed identically across environments.

4. **Growing NixOS market** — NixOS adoption is accelerating (NixOS Cloud, microvm.nix, NixVirt all launched 2024–2025). The ecosystem is underserved by management tools — microvm.nix has no web UI, NixVirt is CLI-only. Weaver fills this gap.

5. **Catalog as distribution channel** — The distro catalog can serve as a curated marketplace. The three-tier system (built-in + catalog + custom) means:
   - Built-in distros work out of the box (zero config)
   - Catalog distros ship with the app and update via `distroCatalogUrl`
   - Custom distros let power users add anything
   - This is more sophisticated than any competitor's template system

### NixOS-Specific Roadmap Items

| Item | Timeline | Value |
|------|----------|-------|
| NUR package publishing | v1.0 | One-liner install for NixOS users (`services.weaver.enable = true`) |
| NixOS integration tests (nixos-test) | v1.0 | Prove the module works on clean installs |
| Flake-based installation | v1.1 | Modern NixOS users expect flake inputs |
| Multi-host NixOS deployment | v2.0+ | Declarative cluster config across NixOS nodes |
| microvm.nix deep integration | v1.1 | Auto-detect microvm.nix-defined VMs, import their config |

---

## Ongoing: Community and Awareness

| Activity | Channel | Frequency |
|----------|---------|-----------|
| Project announcements | r/NixOS, NixOS Discourse, Matrix | Per release |
| AI diagnostics demo video | YouTube, Reddit r/homelab | v1.0 launch |
| Comparison blog posts (vs Proxmox, Cockpit) | Blog / dev.to | Quarterly |
| Conference talks (NixCon, FOSDEM) | In-person | Annual |
| GitHub Discussions / community support | GitHub | Ongoing |
| Demo site live | weaver-demo.github.io | v1.0 launch |

---

## Summary: What Must Ship Before v1.0

| # | Item | Already Planned? | Effort |
|---|------|:---:|--------|
| 1 | Authentication system | Yes (Phase 6) | High |
| 2 | Role-based access control | Yes (Phase 6) | Medium |
| 3 | Audit logging | Yes (Phase 6) | Medium |
| 4 | API rate limiting | Yes (Phase 6) | Low |
| 5 | Security hardening review | Yes (Phase 6) | Medium |
| 6 | Production deployment guide | Yes (Phase 6) | Medium |
| 7 | WebSocket authentication | No (new) | Medium |
| 8 | Unit test coverage 70%+ | Deferred | High |
| 9 | Cross-browser testing | Deferred | Medium |
| 10 | NixOS module integration test | Deferred | Medium |
| 11 | Demo site deployment | Yes (Phase 6) | Low |
| 12 | sync-to-free verification | Yes (Phase 6) | Low |

**Estimated total effort for pre-v1.0 gaps: ~6–8 weeks of focused development.**

---

*Cross-reference: [competitive-landscape.md](../research/competitive-landscape.md) | [TIER-MANAGEMENT.md](TIER-MANAGEMENT.md) | [EXECUTION-ROADMAP.md](../plans/v1.0.0/EXECUTION-ROADMAP.md)*
