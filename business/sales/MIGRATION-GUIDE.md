<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver — Migration Guide

**Last updated:** 2026-03-26
**Status:** Living document — append migration helpers as they are identified

This document serves two purposes:
1. **Internal planning** — collect every migration helper needed across all tiers and source systems
2. **Enterprise clarity** — ensure the enterprise migration story is complete and concrete before sales engagements

See also: Decision #89 (MASTER-PLAN.md) for the strategic rationale.

---

## Step 0: Fleet Host Discovery

Before workload migration begins, Fabrick needs to know which hosts it is managing. For organizations arriving with an existing NixOS fleet, the **fleet discovery wizard** (Decision #97, v2.3.0) replaces manual host registration. Use the path that matches your network topology:

| Topology | Path | Notes |
|---|---|---|
| Tailscale network | **Tailscale scan** | OAuth client, `devices:read` scope. Queries Tailnet, checkbox list of responding Weaver agents. < 5 min to full inventory |
| Internal RFC 1918 segments, air-gap | **CIDR probe** | No external API calls. /20 max prefix. RFC 1918 enforcement. Audit-logged |
| Strict access controls, FedRAMP, air-gap | **CSV/hostname import** | Upload host list. Fabrick connects only to listed hosts. No lateral probing. 500-row max |
| Cloud VMs running Weaver | **Cloud scan** (v2.4.0+) | Reuses existing cloud credentials (Hetzner/DO v2.4.0; AWS v3.0). Probes discovered VMs for Weaver agent |

Discovered hosts land in Fabrick (`/fabrick`) automatically. Workload inventory is pulled from each host's Weaver agent on registration — no separate scan step (Decision #98). Each discovery session is audit-logged.

### Non-NixOS hosts: weaver-observer (Decision #101)

Not every host in the fleet will run NixOS. Fabrick recognizes two member states:

| State | Host requirements | Capabilities | Badge |
|-------|------------------|--------------|-------|
| **Managed** | NixOS + full Weaver agent | Full workload lifecycle, compliance evidence, all Fabrick features | None (default) |
| **Observed** | Any Linux, kernel ≥ 4.x | Read-only workload visibility (containers, processes, ports) via `weaver-observer` binary (Rust, statically linked) | Yellow "Observed" badge |

`weaver-observer` is a statically-linked Rust binary — zero runtime dependencies, memory-safe by construction, runs on any Linux kernel ≥ 4.x. Install it on any non-NixOS host (Ubuntu, RHEL, Debian, Yocto/Buildroot) to bring it into the fleet immediately — no NixOS conversion required. Observed hosts appear on the Fabrick map, provide workload inventory, and show a yellow "Observed" badge. They do not generate compliance evidence and are not counted in your Managed node license.

**5× Observer headroom:** Observer nodes are included at no extra charge up to 5× your Managed node count. An organization with 10 Managed NixOS hosts can observe up to 50 non-NixOS hosts — enough to see the entire fleet while converting incrementally. The "Convert to Managed" button is available on any Observed host; conversion counts against the Managed node license from that point forward.

**Compliance boundary:** Observed hosts are outside the Weaver compliance boundary. Audit evidence, AI policy enforcement, and Access Inspector scope apply only to Managed hosts. The distinction is explicit in all UI views — there is no ambiguity about what is and is not covered.

**For migration from Proxmox or VMware:** run fleet discovery first to register all hosts into Fabrick, install `weaver-observer` on any non-NixOS hosts so they appear as Observed nodes, then use the workload import helpers below to pull the existing inventory. The group creation and access control setup (Step 1 below) can proceed in parallel — you don't need all hosts registered before starting group configuration.

---

## The Core Migration Insight

When organizations move from Proxmox, VMware, legacy access control, or LDAP/AD-managed infrastructure, the VMs are not the hard part. The hard part is rebuilding the **access control model** in the new system without disrupting the team or the compliance posture.

Weaver groups solve this directly. The migration flow is:

```
1. Import workload inventory (Proxmox pools, VMware resource groups, CSV)
2. Assign workloads to Weaver groups
3. Apply compliance framework tags (hipaa, pci-cde, cmmc, etc.)
4. Set AI tool policies per group
5. Add team members to groups
   → Scope and AI policy activate immediately
   → Compliance officer can verify before first VM migrates
6. Migrate VMs — access control is already in place
```

The compliance officer's work is done before the last VM migrates. This is not possible with Proxmox (LDAP passthrough bolted on) or vanilla VMware (resource groups have no compliance awareness). It is built into Weaver from day one.

---

## Migration Sources

### Proxmox

**Pegaprox target.** Proxmox access control is LDAP/AD passthrough with pool-based resource grouping. No compliance awareness, no AI policy, no auditor role. Migration helpers needed:

| Helper | Description | Version | Status |
|--------|-------------|---------|--------|
| **Pool import** | Read Proxmox pool definitions via API; create matching Weaver groups with same workload membership | v3.3.0 | Planned |
| **User/ACL import** | Read Proxmox user list and ACL assignments; map to Weaver roles (viewer/operator/admin/auditor) | v3.3.0 | Planned |
| **VM inventory import** | Pull VM list from Proxmox API; create registered workload stubs in Weaver before provisioning | v3.0.0 | Planned |
| **Compliance tag prompt** | After pool import, prompt admin to tag each group with applicable compliance frameworks | v3.3.0 | Planned |
| **AI policy auto-suggest** | Based on compliance tags, suggest default AI policy (hipaa → claude-only, etc.) | v3.3.0 | Planned |

**FabricK angle:** Multi-node Proxmox clusters map to Fabrick fleet. Each Proxmox node becomes a Weaver host; each pool becomes a cross-host Weaver group. The cluster's LDAP integration becomes IdP group sync in Fabrick.

---

### VMware / vSphere

**FabricK priority.** VMware customers are actively looking for exits post-Broadcom acquisition. Resource groups and folders map directly to Weaver groups. vCenter LDAP integration maps to Fabrick IdP sync.

| Helper | Description | Version | Status |
|--------|-------------|---------|--------|
| **Resource group import** | Read vCenter resource group definitions; create matching Weaver groups | v3.3.0 | Planned |
| **Folder hierarchy import** | Flatten vSphere folder hierarchy into Weaver group structure | v3.3.0 | Planned |
| **Role/permission import** | Map vCenter roles (No Access, Read Only, VM Operator, Administrator) to Weaver roles | v3.3.0 | Planned |
| **vCenter LDAP → IdP sync** | Existing vCenter LDAP config provides the IdP group DN for Fabrick auth-sso | v3.3.0 (Fabrick) | Planned |
| **VM inventory import** | Pull VM inventory from vCenter API; register in Weaver | v3.0.0 | Planned |

**Enterprise angle:** VMware Enterprise Plus customers have sophisticated RBAC — custom roles, nested groups, per-datacenter permissions. Weaver's compliance-aware group model handles this without requiring the same complexity. The pitch: *"You can simplify your access model on the way out, not carry its complexity forward."*

---

### Docker / Podman (Container Runtime Migration)

**Workload format migration.** Unlike Proxmox/VMware migration (primarily an access control model problem), Docker and Podman migration is primarily a **workload format problem**: translate existing compose definitions to declarative `virtualisation.oci-containers` NixOS config. Access control is trivially simple on the source side (Docker group membership or `sudo`) — Weaver adds real RBAC from day one.

**Zero-config arrival for existing NixOS users:** If a user already declares containers via `virtualisation.oci-containers`, Weaver discovers them automatically at v1.1.0 — no migration step required. The helpers below target users arriving from non-NixOS hosts or from non-declarative Docker/Podman usage (raw CLI or compose files outside NixOS's control).

**Common arrival path:** Most Docker/Podman users arrive from Ubuntu, Debian, or RHEL. Recommended sequence:

```
1. Install weaver-observer on existing non-NixOS host — see all running containers (rootful)
   and port annotations (rootless) before any conversion
2. Run format parser (docker-compose.yml or podman-compose.yml) → get Nix config preview in Shed
3. Review generated virtualisation.oci-containers config; edit as needed
4. Install NixOS on target host; apply generated config
5. Containers appear in Weaver at first boot — zero extra config
6. Decommission legacy host
```

#### Docker

| Helper | Description | Version | Status |
|--------|-------------|---------|--------|
| **Zero-config discovery** | NixOS hosts using `virtualisation.oci-containers` have Docker containers auto-discovered — no migration step | v1.1.0 | Shipped |
| **docker-compose.yml parser** | Parse `docker-compose.yml` (v2/v3 format); generate equivalent `virtualisation.oci-containers.containers` Nix config per service | v1.6.0 | Planned |
| **Named network → bridge mapping** | Compose named networks → `networking.bridges` declarations + per-container `--network` options | v1.6.0 | Planned |
| **Volume mount declaration** | Compose volume mounts → `virtualisation.oci-containers.containers.*.volumes` with host path validation warnings | v1.6.0 | Planned |
| **Docker daemon removal guide** | In-app guide: remove `virtualisation.docker.enable`; migrate existing `docker run` invocations to `virtualisation.oci-containers`; optional: keep Docker via `virtualisation.docker.enable = true` if rootless or legacy workloads require it | v1.6.0 | Planned |
| **Pre-migration visibility** | Install `weaver-observer` on existing Docker host (Ubuntu/Debian/RHEL); see all running containers before NixOS conversion begins | v2.3.0 | Planned |

#### Podman

| Helper | Description | Version | Status |
|--------|-------------|---------|--------|
| **Zero-config discovery** | NixOS `virtualisation.oci-containers` defaults to Podman — containers auto-discovered at v1.1.0 | v1.1.0 | Shipped |
| **podman-compose.yml parser** | Parse `podman-compose.yml`; generate `virtualisation.oci-containers.containers` Nix config | v1.6.0 | Planned |
| **`podman generate kube` import** | Accept K8s YAML output from `podman generate kube`; extract container definitions; generate Nix config (useful intermediate for users already exporting pod specs) | v1.6.0 | Planned |
| **Pod grouping preservation** | Podman pods (shared network namespace) → `virtualisation.oci-containers` containers with matching network config; pod visualized as single topology node in Strands | v1.6.0 | Planned |
| **Rootless → rootful migration guide** | Step-by-step wizard: move rootless systemd user units to rootful `virtualisation.oci-containers` (NixOS default for most users); includes security tradeoff note (rootful is NixOS-idiomatic; rootless is better hardening posture) | v1.6.0 | Planned |
| **Pre-migration visibility** | `weaver-observer` on non-NixOS Podman host; rootful containers visible immediately; rootless containers visible as port annotations on host node | v2.3.0 | Planned |

**Access control note:** Docker and Podman have no workload-level access control — Docker group membership or `sudo` is the gate. Weaver adds viewer/operator/admin/auditor roles from day one. For teams, assign container workloads to a Weaver group during migration to establish access control before the first container restarts under Weaver management.

---

### Kubernetes

**Migration context:** Organizations running Kubernetes often have workloads that don't benefit from container orchestration — GPU workloads, compliance-sensitive VMs, edge deployments, stateful services that fight pod scheduling. These are the workloads that migrate to Weaver. The K8s cluster keeps running the workloads it serves well.

**The pitch is not "replace all your K8s." It's "stop expanding K8s into workloads it wasn't designed for."**

| Helper | Description | Version | Status |
|--------|-------------|---------|--------|
| **Deployment manifest parser** | Parse K8s Deployment/StatefulSet YAML; extract container image, resource requests, environment variables, volume mounts; generate Weaver workload definition (MicroVM or container) | v2.0.0 | Planned |
| **Service → Bridge mapping** | Map K8s Service definitions (ClusterIP, LoadBalancer, NodePort) to Weaver bridge configurations with equivalent endpoint routing | v2.2.0 | Planned |
| **ConfigMap/Secret extraction** | Parse ConfigMaps and Secrets from YAML manifests or `kubectl get` output; generate equivalent Weaver environment config or sops-nix secret references | v2.0.0 | Planned |
| **Helm chart inventory** | Read Helm release list (`helm list`); produce per-release workload migration plan showing which releases can move to Weaver and which should stay on K8s | v2.2.0 | Planned |
| **Namespace → Workload Group mapping** | Map K8s namespaces (with RBAC, network policies, resource quotas) to Weaver Workload Groups with equivalent access control and compliance boundaries | v3.3.0 | Planned |
| **Pre-migration visibility** | `weaver-observer` on K8s worker nodes; inventories running pods, resource usage, and network topology; surfaces pod-level detail in FabricK fleet view before any migration begins | v2.3.0 | Planned |
| **GPU workload fast-path** | K8s GPU pods (NVIDIA device plugin + resource requests) → VFIO-PCI passthrough MicroVMs. Eliminates device plugin chain, topology-aware scheduling, and NUMA-aware allocation — native GPU isolation per workload | v1.2.0 | Planned |
| **Ingress → Bridge routing** | Map K8s Ingress/Gateway API rules to bridge active routing configuration; weighted endpoints, TLS termination, path-based routing | v2.2.0 | Planned |

**What migrates well to Weaver:**
- GPU workloads (AI inference, HPC, rendering) — VFIO-PCI passthrough replaces device plugin chain
- Compliance-sensitive workloads — MicroVM hardware isolation replaces namespace + network policy + pod security
- Stateful services — VMs with persistent disk, no pod scheduling surprises
- Edge deployments — NixOS MicroVMs, atomic rollbacks, offline-capable
- Workloads the K8s team dreads — anything requiring custom operators, special scheduling, or extensive pod security hardening

**What stays on K8s:**
- Stateless microservices that benefit from pod autoscaling and rapid horizontal scale
- Workloads deeply integrated with K8s APIs (custom controllers, CRDs, operator-managed services)
- CI/CD runners that leverage K8s job scheduling

**Parallel operation:** FabricK and K8s coexist. Observer inventories K8s worker nodes. Bridge routing can front-end both Weaver workloads and K8s services during transition. The migration is incremental — workload by workload, not cluster-wide cutover.

**Full competitive reference:** [KUBERNETES-COMPETITIVE-POSITIONING.md](KUBERNETES-COMPETITIVE-POSITIONING.md)

---

### LDAP / Active Directory

**Two operating modes** depending on whether the customer wants to keep or replace their directory.

#### Mode 1: Replace with Weaver-native groups (Weaver Team)

For organizations without a full fabrick directory, or teams tired of maintaining one:

- Weaver groups **are** the directory for workload access
- No LDAP server required
- Native, simple, compliance-aware
- User accounts managed directly in Weaver
- Appropriate for: SMB, research labs, small defense contractors, healthcare practices, education

| Helper | Description | Version | Status |
|--------|-------------|---------|--------|
| **CSV user import** | Bulk-create Weaver users from CSV export of existing LDAP/AD users | v3.3.0 | Planned |
| **Group CSV import** | Create Weaver groups from CSV with member list | v3.3.0 | Planned |
| **Role mapping guide** | In-app wizard mapping AD roles to Weaver roles (Admin/Operator/Viewer/Auditor) | v3.3.0 | Planned |

#### Mode 2: Sync from existing AD/LDAP (Fabrick + auth-sso)

For fabrick customers keeping their directory:

AD/LDAP groups model **organizational structure** (Nurses, Physicians, Finance-Team). Compliance boundaries cut *across* that structure — the ePHI workload boundary spans Nurses + Physicians + Clinical-IT. Weaver groups model the compliance cut directly:

```
AD group: "Nurses"         ─┐
AD group: "Physicians"      ├─→ Weaver group: "ePHI-workloads" [hipaa · claude-only]
AD group: "Clinical-IT"    ─┘
```

AD manages who is in the group. Weaver manages what that group can touch and which AI tools they can use. The compliance boundary is expressed once in Weaver — not scattered across AD group nesting.

| Helper | Description | Version | Status |
|--------|-------------|---------|--------|
| **IdP group DN mapping** | Wizard to map AD/LDAP group DNs to Weaver group `idpGroupDn` fields | v3.3.0 (Fabrick) | Planned |
| **LDAP browser** | Browse LDAP tree to pick groups when setting `idpGroupDn` | v3.3.0 (Fabrick) | Planned |
| **Sync preview** | Show which users would be in each Weaver group before activating IdP sync | v3.3.0 (Fabrick) | Planned |
| **Compliance gap report** | After sync, show which AD groups have no compliance framework tag in Weaver | v3.3.0 (Fabrick) | Planned |

---

### Generic / CSV

Catch-all for organizations with no structured source system (manual spreadsheets, home-grown systems, early-stage teams):

| Helper | Description | Version | Status |
|--------|-------------|---------|--------|
| **CSV workload import** | Import VM/container list from CSV; register as Weaver workloads | v1.1.0+ | Planned |
| **CSV group + member import** | Create groups and assign members from CSV | v3.3.0 | Planned |
| **Export current state** | Export Weaver workloads, groups, and users as CSV/JSON for backup or migration audit | v1.0.0 (partial) | In progress |

---

## Access Control Migration — The Full Picture

The most important migration is not the VMs. It is the **access model**.

### The problem with existing tools

| Tool | Access control model | Migration pain |
|------|---------------------|----------------|
| Proxmox | LDAP passthrough + pools | Pools have no compliance awareness; must rebuild |
| VMware | vCenter roles + LDAP | Complex nesting; no compliance layer |
| Bare LDAP/AD | Organizational groups | Cut across compliance boundaries incorrectly |
| Manual / spreadsheet | Nothing | Starting from scratch |

### What Weaver provides instead

A **compliance-boundary access model** that is:

- **Simpler than LDAP** for teams that don't need a full fabrick directory
- **Smarter than LDAP** for compliance purposes when they do — models the compliance cut, not the org chart
- **Migration-ready** — the group model is the intermediate state during any migration, letting you run ahead of the VM migration and have access control in place first
- **Upgrade-transparent** — Weaver Team groups become Fabrick fleet groups automatically on upgrade; no re-configuration

### The migration sequence (recommended)

```
Week 1: Run fleet discovery wizard (Tailscale / CIDR / CSV / cloud scan) — registers all hosts into Fabrick
Week 1: Install Weaver on target host(s)
Week 1: Import workload inventory (Proxmox/VMware API or CSV)
Week 1: Create groups, apply compliance tags, set AI policies
Week 1: Add users, assign roles (including Auditor for compliance officer)
Week 1: Compliance officer runs Access Inspector — verifies scope before any VMs move

Week 2+: Begin VM migration in waves
         → Each migrated VM joins its pre-assigned group immediately
         → Access control is live from first day of migration

Final week: Decommission source system
            → Weaver groups are the surviving access control layer
            → If IdP sync enabled: AD/LDAP continues managing membership
            → If Weaver-native: AD/LDAP can be decommissioned with the source VMs
```

---

## Enterprise Migration Clarity

Enterprise (Fabrick) migrations have additional complexity. This section collects the enterprise-specific helpers needed.

### Fleet enrollment

When migrating a multi-host environment, each host must be enrolled in Fabrick before cross-host groups can be activated. Use the fleet discovery wizard (see **Step 0** above) to register all hosts in one session — this replaces per-host manual enrollment and is the recommended starting point for any multi-host migration.

| Helper | Description | Version | Status |
|--------|-------------|---------|--------|
| **Bulk host enrollment** | Enroll multiple Weaver hosts into Fabrick fleet via API or config file | v3.0.0 | Planned |
| **Fleet migration checklist** | In-app checklist: host enrolled → groups synced → IdP connected → compliance officer verified | v3.3.0 | Planned |
| **Pre-migration compliance report** | Fleet-wide report: which groups have compliance tags, which don't; AI policy coverage | v3.3.0 | Planned |

### Evidence continuity

Enterprise compliance customers often have audit evidence from their previous system. Weaver must not create a gap in the audit trail during migration.

| Helper | Description | Version | Status |
|--------|-------------|---------|--------|
| **Audit log import** | Import historical audit records from previous system (Proxmox, VMware, custom) into Weaver audit log with source attribution | v3.3.0 (Compliance Pack) | Planned |
| **Evidence handoff package** | Export a "migration point" evidence package: current group composition, AI policies, user assignments — timestamped and signed. Bridges the old system's audit trail to Weaver's. | v3.3.0 (Compliance Pack) | Planned |
| **Parallel-run period** | Run Weaver alongside the source system for N days; both systems generate audit events; Compliance Pack reconciles them | v4.x | Under consideration |

### Compliance framework continuity

| Helper | Description | Version | Status |
|--------|-------------|---------|--------|
| **Framework tag auto-detect** | Scan workload names, descriptions, and network config against known compliance patterns; suggest framework tags | v3.3.0 | Planned |
| **HIPAA workload tagging wizard** | Step-by-step: identify ePHI workloads → assign to hipaa group → set claude-only AI policy → verify with Access Inspector | v3.3.0 | Planned |
| **CMMC readiness checklist** | Walk through CMMC Level 2 controls relevant to workload isolation; map to Weaver group configuration | v3.3.0 | Planned |
| **PCI-CDE boundary wizard** | Identify cardholder data environment workloads → isolate into pci-cde group → verify network path compliance | v3.3.0 | Planned |

### MSP / Multi-tenant migration

MSPs migrating client infrastructure from Proxmox or VMware have a per-client isolation requirement.

| Helper | Description | Version | Status |
|--------|-------------|---------|--------|
| **Per-client group template** | Create a standard group set per client (viewer group, operator group, auditor) from a template | v3.3.0 | Planned |
| **Client isolation verification** | Confirm client A workloads are not visible to client B users before going live | v3.3.0 | Planned |
| **Bulk client onboard** | Enroll N clients from CSV: name, workloads, users, compliance frameworks | v3.3.0 | Planned |

---

## Open Items

Items that need further definition before implementation can be scoped:

### Fleet Discovery & Observer (Decisions #97–#102)

- [x] **weaver-observer distribution channel** — **Decided:** (a) signed binary + install script via GitHub Releases (primary); (b) `.deb`/`.rpm` artifacts on GitHub Releases for self-hosted Artifactory/Nexus import — no WBD-operated package repo; (c) Ansible role on Galaxy. No OCI image. **Language: Rust** (Decision #129) — statically-linked, memory-safe, zero runtime dependencies. Two architectures: x86_64 + aarch64. Six build outputs per release (2 arch × 3 artifacts: binary + .deb + .rpm).
- [x] **weaver-observer auto-update** — **Decided:** customer responsibility (Ansible role re-run, Artifactory sync, manual). Fabrick reports running observer version on host detail page. Minimum supported version floor enforced — Fabrick rejects connections below floor (hard gate for security patches), soft-warns on non-critical lag. WBD does not own the update delivery channel.
- [x] **Tombstone confirmation UX** — **Decided:** dialog shows scrollable diff list (name, last seen, type) + three actions: Confirm removal / Skip tombstones (add new only, leave existing) / Cancel. Skip tombstones covers agent-flap/incident case.
- [x] **Observer inactive state re-activation** — **Decided:** red `Inactive` badge + fleet banner explaining shortfall and options. Deactivation order: LIFO. Re-activation is automatic when headroom restored (license upgrade or Observed→Managed conversion) — no admin action required, reverse LIFO order.
- [x] **weaver-observer version compatibility matrix** — **Decided:** major version = breaking boundary (hub vN rejects observer vN-1, hard block). Minor/patch lag = soft-warn only (yellow badge). Security floor violation = hard block regardless of major version match.
- [x] **CIDR probe result TTL** — **Decided:** asymmetric by state. Managed: heartbeat-driven `Unreachable` flag only, no auto-tombstone (unreachable = incident). Observed: `Unreachable` flag + 30-day TTL auto-tombstone (decommission without notice is routine for third-party Linux hosts).

### Docker / Podman

- [ ] **Multi-service compose import** — `docker-compose.yml` and `podman-compose.yml` often define 5–15 services. Options: (a) import all services in one batch, (b) import one service at a time with navigation, (c) import as a linked group. UX decision needed before implementing the parser.
- [ ] **Compose `depends_on` mapping** — service startup ordering in compose files has no direct equivalent in `virtualisation.oci-containers`. Options: (a) convert to systemd `After=` dependencies, (b) warn and leave as-is, (c) generate a `systemd.services` override. Decision needed.
- [ ] **Named volumes vs bind mounts** — compose named volumes (`volumes: db-data:`) have no direct NixOS equivalent (they're Docker-managed). Should parser emit a warning and convert to bind mounts, or declare a `tmpfs`/`zfs` dataset as a stub?
- [ ] **Rootless Podman detection** — `weaver-observer` on a non-NixOS host: can it reliably detect rootless Podman containers (slirp4netns, no host-visible bridge) vs rootful? Needs investigation before committing to the visibility claim.

### Migration Sources

- [ ] **Proxmox API availability** — confirm which Proxmox versions expose pool/ACL via REST API (vs. CLI only)
- [ ] **VMware API access** — vCenter REST API (vSphere 7+) vs legacy SOAP API; determine minimum supported vSphere version
- [ ] **Audit log import format** — define a standard ingest format for historical records from third-party systems
- [ ] **LDAP browser scope** — full tree browser vs DN entry with validate button; UX decision needed
- [ ] **Migration mode flag** — should Weaver have an explicit "migration mode" that relaxes certain gates (e.g., allows untagged groups) during the transition window?
- [ ] **Parallel-run reconciliation** — how are conflicts between old-system audit events and Weaver audit events handled? (v4.x consideration)

---

## Success Programs

Migration complexity scales with fleet size, source system diversity, and compliance requirements. Success Programs provide hands-on migration expertise to reduce risk and accelerate time-to-value.

| Program | FM Price | Standard Price | Migration Focus |
|---------|:--------:|:--------------:|----------------|
| **Community** | $0 | $0 | Documentation, community forum, self-service migration guides |
| **Adopt** | $5,000/yr | $15,000/yr | Onboarding playbook, first source system import (Proxmox/VMware/Docker), group creation walkthrough, compliance tag assignment |
| **Accelerate** | $15,000/yr | $45,000/yr | Migration project planning, access control model mapping, quarterly architecture reviews, fleet enrollment assistance |
| **Partner** | $30,000/yr | $90,000/yr | Named engineer for multi-source migration, LDAP/AD integration, evidence continuity planning, compliance framework handoff |

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = **$9,000/yr** total compliance coverage during migration. Standard Adopt — Compliance ($25,000/yr) includes hands-on compliance framework mapping sessions and evidence walkthroughs.

### Professional Services for Migration

| Service | What IT Stops Doing | Price |
|---------|---------------------|:-----:|
| **Migration** (Proxmox/VMware/libvirt) | Multi-month migration project planning and execution | $5,000-20,000 |
| **Fleet Architecture Design** | Infrastructure topology decisions and documentation | $2,000-5,000/day |
| **NixOS Adoption Training** | Internal training program development and delivery | $3,000-5,000/cohort |

---

## Reference

- Decision #97: [MASTER-PLAN.md](../../MASTER-PLAN.md) — Fleet discovery wizard (Tailscale, CIDR, CSV, cloud scan)
- Decision #98: [MASTER-PLAN.md](../../MASTER-PLAN.md) — Host workload scan on registration, soft-delete tombstoning
- Decision #99: [MASTER-PLAN.md](../../MASTER-PLAN.md) — gRPC port 50051, mTLS requirement
- Decision #100: [MASTER-PLAN.md](../../MASTER-PLAN.md) — Cloud-provider-aware discovery (Hetzner/DO v2.4.0, AWS v3.0)
- Decision #101: [MASTER-PLAN.md](../../MASTER-PLAN.md) — Non-NixOS host observation, weaver-observer binary, Managed/Observed states
- Decision #102: [MASTER-PLAN.md](../../MASTER-PLAN.md) — Observer headroom model (5× Managed count, no SKU)
- Decision #89: [MASTER-PLAN.md](../../MASTER-PLAN.md) — Weaver Team tier inclusion, migration helper, LDAP/AD replacement
- Decision #88: [MASTER-PLAN.md](../../MASTER-PLAN.md) — Group policy model, compliance dimensions, AI vendor enforcement
- v3.3.0 Execution Roadmap: [plans/v3.3.0/EXECUTION-ROADMAP.md](../../plans/v3.3.0/EXECUTION-ROADMAP.md)
- Tier model: [TIER-MANAGEMENT.md](../product/TIER-MANAGEMENT.md)
- Podman positioning: [podman-substitute.md](../marketing/podman-substitute.md)
- Format parsers agent: [agents/v1.6.0/format-parsers.md](../../agents/v1.6.0/format-parsers.md)
- Sales verticals: [sales/verticals/](verticals/)
