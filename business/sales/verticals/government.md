<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver — Government Sector
## IT Value Proposition

> **Decision ref:** See MASTER-PLAN.md Decisions Resolved for tier and feature decisions.
> **Status:** Planned sales vertical — draft for review.

*Civilian Federal Agencies, DoD Civilian IT, State & Local Government, Federal DevSecOps Teams*

**Date:** 2026-03-13
**Parent doc:** [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md)

> **Scope note:** This vertical covers direct government agency buyers — civilian federal, DoD civilian (GS/SES, not cleared contractors), state/local, and government DevSecOps teams. Defense contractors and cleared facilities are covered in [defense-contractor.md](defense-contractor.md).

---

## Table of Contents

1. [Industry Problem](#1-industry-problem)
2. [Regulatory Mapping](#2-regulatory-mapping)
3. [Weaver for Government](#3-weaver-for-government)
4. [Fabrick for Government](#4-fabrick-for-government)
5. [Deficiency Remediation Plan](#5-deficiency-remediation-plan)
6. [Competitive Advantages](#6-competitive-advantages)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Discovery Questions](#9-discovery-questions)
10. [Federal AI Workloads & Fabrick (v3.0+)](#10-federal-ai-workloads--fabrick-v30)

---

## 1. Industry Problem {#1-industry-problem}

**No NixOS expertise required — ever.** Weaver runs alongside existing Docker, VMware, Proxmox, or bare-metal tooling. Migrate one workload at a time. No cutover event. No retraining. FedRAMP/FISMA audit trail by construction. Self-hosted, air-gap capable. No NixOS expertise required for compliance teams.

Government IT teams face a compliance paradox: the most prescriptive security mandates in any sector, applied against the most uneven budgets and staffing ratios in any sector. A federal civilian CISO manages the same NIST SP 800-53 control catalog as a county IT administrator who also runs the help desk, manages the website, and fixes the printer.

The compliance surface has expanded aggressively since 2021. EO 14028 mandated zero trust architecture across all federal agencies. OMB M-22-09 set hard deadlines for zero trust implementation. CISA's Known Exploited Vulnerabilities (KEV) catalog requires patching on government timelines. FISMA requires continuous monitoring — not quarterly scanning, continuous. FedRAMP authorization for cloud tools takes 12–18 months and costs $500K–$2M. And the Authority to Operate (ATO) process — the single most time-consuming compliance obligation in federal IT — demands exhaustive documentation of every system, every control, and every configuration change, with evidence that reflects actual running state rather than a snapshot from 18 months ago.

DISA STIGs add another layer. For DoD civilian IT, every deployed OS and application has a STIG checklist. Hundreds of checks. Each one manually verified or verified via SCAP scanner. When the infrastructure is imperative — configured by hand, possibly drifted — the gap between what the STIG says and what the system actually does is a discovery exercise, not a verification exercise.

**What government IT should be doing:**

- Maintaining ATO documentation that reflects actual system state, not a snapshot from last assessment cycle
- Implementing and evidencing NIST SP 800-53 controls across all FISMA-categorized systems
- Running continuous monitoring programs that satisfy OMB and DHS requirements
- Executing zero trust architecture per EO 14028 and OMB M-22-09 — verified, not aspirational
- Applying CISA KEV patches within mandated windows (typically 14 days for internet-facing, 60 days otherwise)
- Enforcing least-privilege access with identity integration across agencies and contractors
- Meeting OMB M-21-31 logging maturity requirements (EL1 through EL3)
- Responding to CISA Binding Operational Directives within mandated timelines

**What government IT actually spends time doing:**

- Manually provisioning and rebuilding VMs with no reproducible configuration baseline
- Writing SSP narratives that drift from actual system configurations the day after they are approved
- Gathering screenshots and log exports from multiple disconnected tools to assemble ATO evidence packages
- Investigating configuration drift on systems that IG auditors and FISMA assessors will examine
- Rebuilding environments after failures with no guarantee the rebuilt system matches the ATO-approved baseline
- Running SCAP scans to find STIG deviations they would have had if the system were declaratively configured to begin with
- Managing separate tools for access control, audit logging, network segmentation, and hardening — each with its own ATO documentation boundary

**Weaver eliminates the second list so IT can focus on the first.**

### The NixOS Advantage for Government

Government compliance is fundamentally about provability. Can you prove the system is configured the way you said it is? Can you prove it hasn't changed? Can you prove who changed it, when, and why? Every audit, every assessment, every IG finding circles back to provability.

NixOS's declarative model closes that gap at the architecture level. The running system is the declared configuration — mathematically identical, not approximately similar. Configuration drift is structurally impossible. The git history of the Nix configuration *is* the audit log — tamper-evident, attributed, and timestamped without requiring a separate audit logging infrastructure. For FISMA assessors, the answer to "show me your baseline and change control process" is a `git log` command, not a three-week evidence collection exercise.

Immutable VMs mean incident response has a clean answer to "what did this system look like before the incident?" The declared configuration is the answer. Rollback is not a restoration operation — it is a re-declaration. Recovery is deterministic.

---

## 2. Regulatory Mapping {#2-regulatory-mapping}

### Direct Compliance Impact

> **Version key:** v1.0 = shipped today. v1.1+ / v1.2+ = on roadmap. NixOS = host OS capability (not a dashboard feature). Capabilities without a version tag are v1.0.

| Regulation / Framework | Requirement | Weaver Capability | Tier | Available |
|------------------------|-------------|------------------------------|------|:---------:|
| **FISMA** — Federal Information Security Modernization Act | Categorize systems, implement controls, continuous monitoring, annual assessment | Declarative config = system baseline is always current. Git history provides continuous monitoring evidence. Zero drift means assessed state = running state every day, not just assessment day | All tiers | v1.0 |
| **NIST SP 800-53 rev5 — CM Family** (§CM-2, CM-3, CM-6, CM-7) | CM-2: baseline configs; CM-3: change control; CM-6: config settings; CM-7: least functionality | NixOS declarative model IS the configuration baseline. Every change is a git commit with attribution. Nothing runs unless declared — least functionality by construction. Satisfies CM-2, CM-3, CM-6, CM-7 simultaneously | All tiers | v1.0 |
| **NIST SP 800-53 rev5 — AU Family** (§AU-2, AU-3, AU-6, AU-12) | AU-2: auditable events; AU-3: content of records; AU-6: review/analysis; AU-12: audit generation | Git-based declarative audit log — every change records who/when/what/why. Tamper-evident by construction. Satisfies AU content requirements at OMB M-21-31 EL2+ maturity | Fabrick | v1.0 |
| **NIST SP 800-53 rev5 — AC Family** (§AC-2, AC-3, AC-5, AC-6) | Account management, access enforcement, separation of duties, least privilege | Per-VM RBAC (v1.0); SSO/SAML/LDAP integration (v1.2+); role-based access enforced at API level with separation of duties between viewer/operator/admin roles | Fabrick | v1.0 (RBAC), v1.2+ (SSO/LDAP) |
| **NIST SP 800-53 rev5 — SC Family** (§SC-7, SC-8, SC-28, SC-32) | Boundary protection, transmission confidentiality, protection at rest, system partitioning | Managed bridges with IP pools for network boundary enforcement; declarative firewall/nftables (v1.1); NixOS supports FIPS-mode OpenSSL and LUKS encryption; per-VM RBAC + bridges for system partitioning | Weaver | v1.0 (bridges), v1.1 (firewall) |
| **NIST SP 800-53 rev5 — SI Family** (§SI-2, SI-7) | Flaw remediation, software/firmware integrity | Zero-drift architecture = integrity verification by construction. Fleet-wide declarative patching. AppArmor/Seccomp hardening (v1.2). Firecracker's minimal attack surface reduces exploit surface | Weaver | v1.0 (drift/patching), v1.2 (hardening plugins) |
| **EO 14028** — Improving the Nation's Cybersecurity (§4: Zero Trust) | Federal agencies must move toward zero trust architecture; National Security Memorandum 8 extended to national security systems | Zero trust at the infrastructure layer: per-VM RBAC, managed bridge isolation, deny-by-default network policy (v1.1), declarative identity-to-resource access control. The declared configuration is the policy — no manual firewall exception accumulation | Fabrick | v1.0 (RBAC + bridges), v1.1 (deny-by-default) |
| **OMB M-22-09** — Moving the U.S. Government Toward Zero Trust Cybersecurity Principles | Five pillars: Identity, Devices, Networks, Applications/Workloads, Data. Zero trust maturity by FY2024 | Network pillar: declarative per-environment segmentation via managed bridges. Application/Workload pillar: per-VM RBAC + audit log. Identity pillar: SSO/SAML/LDAP (v1.2). Devices pillar: NixOS host hardening. Declarative model provides evidence that maturity targets are implemented, not aspirational | Fabrick | v1.0 (networks, workloads), v1.2 (identity pillar) |
| **DISA STIGs** — Security Technical Implementation Guides | OS and application hardening checklists; hundreds of checks per platform; SCAP-automated where possible | NixOS declarative config enforces hardening by construction — not by post-install script. STIG-equivalent baselines are declared and version-controlled. Hardening plugins (AppArmor, Seccomp, kernel hardening at v1.2) enforce defense-in-depth declaratively. No drift between STIG check and running state | Weaver | v1.0 + v1.2 (plugins) |
| **CIS Benchmarks** — Center for Internet Security | Level 1/Level 2 hardening benchmarks for operating systems and applications | NixOS declarative model enforces CIS benchmark controls at declaration time. Config export proves benchmark compliance state. Fleet-wide enforcement means no node can silently fall below benchmark | All tiers | v1.0 |
| **FIPS 140-2/3** — Cryptographic Module Validation (§ per NIST SP 800-131A) | Use FIPS-validated cryptographic modules for federal data | NixOS supports FIPS-mode OpenSSL configured declaratively. Weaver ensures FIPS mode is enforced consistently across all nodes — provable via config-as-code audit trail | All tiers | v1.0 + NixOS native |
| **FedRAMP** — Federal Risk and Authorization Management Program | Cloud services used for federal data require FedRAMP authorization | Self-hosted — federal data never leaves your facility. No cloud authorization required for on-premises Weaver deployment. Eliminates the 12–18 month, $500K–$2M FedRAMP authorization process entirely | All tiers | v1.0 |
| **OMB M-21-31** — Improving Detection of Cybersecurity Incidents | Event logging at EL1–EL3 maturity; 72-hour active log retention, 12-month cold storage | Declarative audit log captures all infrastructure events with full attribution. Git-based log is immutable and searchable. Event granularity satisfies EL2 requirements | Fabrick | v1.0 |
| **CISA KEV Catalog** — Known Exploited Vulnerabilities | Patch KEV entries within mandated windows (14 days for internet-facing, 60 days otherwise) | Fleet-wide declarative patching: a KEV patch is a config commit applied across all nodes simultaneously. Git history proves patch timeline per CVE. No manual per-host patching — the declaration is the patch state | All tiers | v1.0 |
| **CJIS Security Policy** (§5.4 logging, §5.10 access control) | Advanced authentication, encryption at rest/in-transit, audit logging, access control for CJI data | Per-VM RBAC isolates CJI workloads; managed bridges enforce network segmentation; declarative audit log meets CJIS 5.4 logging requirements; offline-first license supports air-gapped law enforcement environments | Fabrick | v1.0 |
| **IRS Publication 1075** | Safeguard Federal Tax Information; documented access controls, audit trail, annual safeguard review | Self-hosted — FTI never leaves the secure environment. Per-VM isolation for FTI workloads, RBAC enforcement, declarative audit trail for IRS safeguard reviews | Fabrick | v1.0 |
| **StateRAMP** | FedRAMP-equivalent authorization for state government cloud services | Self-hosted deployment eliminates StateRAMP authorization requirement entirely | All tiers | v1.0 |
| **Section 508** — Rehabilitation Act Accessibility | Accessible interfaces for government-used electronic and information technology | Web-based dashboard (Vue 3 + Quasar) supports WCAG 2.1 accessibility patterns; API-first architecture enables integration with accessible tooling and screen readers | All tiers | v1.0 |

### Indirect Compliance Support

| Government Function | IT Pain Today | How Weaver Helps |
|--------------------|--------------|----------------------------|
| **ATO Maintenance** | SSP is a point-in-time document that drifts from reality between assessments | Declarative config IS the system state. SSP evidence is always current — pull a `git log` |
| **Continuous Monitoring (ConMon)** | Scanning tools detect drift after the fact; remediation lags behind findings | Zero-drift architecture means there is no drift to detect. ConMon becomes verification that declared = running (it always does) |
| **POA&M Management** | Tracking and remediating control gaps across siloed, heterogeneous systems | Fleet-wide policy enforcement closes gaps across all nodes simultaneously. Git history proves remediation timeline for Authorizing Official review |
| **CISA BOD / ED Compliance** | Scrambling to implement emergency directives across heterogeneous infrastructure | Declarative config changes apply fleet-wide. A Binding Operational Directive response is a config commit, not a server-by-server manual operation |
| **OMB M-22-09 Zero Trust Evidence** | Demonstrating zero trust maturity to OMB requires evidence, not just architecture diagrams | Managed bridge isolation + per-VM RBAC + deny-by-default firewall produce evidence artifacts: declared network boundaries, role assignment logs, access enforcement records |
| **CISA KEV Patching Evidence** | Documenting patch timelines across heterogeneous infrastructure for CISA reporting | Git commit timestamps prove when each KEV patch was applied fleet-wide. No manual patch log maintenance |
| **Inter-Agency Data Sharing** | Isolating shared workloads between agencies on common infrastructure | Managed bridges and per-VM RBAC create agency-specific enclaves on shared hardware |
| **COOP / Disaster Recovery** | Continuity of Operations plans require documented, tested, reproducible recovery procedures | Declarative config = reproducible rebuild. Sub-second VM boot (Firecracker <125ms) drops COOP RTO from hours to milliseconds |

---

## 3. Weaver for Government {#3-weaver-for-government}

**Target:** County/municipality IT departments, small state agencies, tribal government IT, public library systems, school district IT (non-FERPA complex), government IT consultants serving SMB-tier agencies

**Price:**
- **Weaver Solo** — $149/yr (FM, first 200) per node (admin only, local only, up to 128GB RAM)
- **Weaver Team** — $129/user/yr (FM, first 50 teams) (2–4 users + 1 viewer free, up to 2 remote peer Weaver hosts with full management, up to 128GB RAM/host). Ships v2.2.0.

**The pitch:** "Your FISMA assessor asks 'show me your baseline configurations and change control process.' With your current setup, you spend two weeks assembling screenshots. With Weaver, you hand them a git repo — every configuration, every change, every author, every timestamp. That's CM-2, CM-3, CM-6, and CM-7 closed simultaneously."

### Key Weaver Wins for Government

| Capability | Government Value |
|-----------|-----------------|
| **Live Provisioning** | Spin up VMs for new projects, departments, or grant-funded programs without SSH + rebuild cycles. New workloads in minutes, not procurement cycles |
| **Zero Configuration Drift** | NIST SP 800-53 CM-2 (baseline configurations) and CM-3 (configuration change control) satisfied by construction — not by quarterly scanning |
| **AI Diagnostics** | When a citizen-facing system goes down, natural language diagnosis reduces MTTR. Critical for agencies where the "IT team" is one person who also manages the network switches |
| **Managed Bridges + IP Pools** | Declarative network segmentation — isolate sensitive workloads (CJI, FTI, PII) from general government networks. The boundary is version-controlled code, not manual firewall rules |
| **Sub-Second VM Boot** | Government COOP requirements demand fast recovery. Firecracker <125ms boot means replacement VMs are running before the incident report is filed |
| **Multi-Hypervisor** | Run security-sensitive workloads on Firecracker (minimal attack surface), general workloads on QEMU — one dashboard, one policy, one ATO boundary |
| **Offline-First License** | HMAC-based validation, no phone-home. Deploy in air-gapped environments, classified enclaves, or locations with unreliable connectivity — common in rural government and tribal IT |
| **Weaver** | Podman visibility for containerized government services (v1.1+). Rootless Podman = no privileged daemon — a STIG-friendly default. One dashboard covers MicroVMs and containers without an additional ATO boundary |

### ROI for a County IT Department (3 Nodes, 1 IT Administrator)

| Cost Category | Current State | With Weaver |
|--------------|--------------|-------------------------------|
| Proxmox: EUR355/socket x 3 sockets | **EUR1,065/yr** | 3 nodes x $149 = **$447/yr (Solo)** |
| 1 IT admin at $55/hr, 10 hrs/week on VM management | **$28,600/yr** | Reclaim 6 hrs/week = **$17,160/yr freed** for security and compliance work |
| ATO / FISMA assessment prep: 3 weeks/yr evidence gathering | **$6,600** | < 1 week — declarative config is the evidence |
| Configuration scanning tools | **$2,000–5,000/yr** | $0 — drift is impossible by construction |
| **Total** | **~$38,265–41,265/yr** | **$447/yr + $17,160 labor freed** |

### ROI for a Tribal Government IT Operation (1–2 Nodes, Part-Time IT)

| Cost Category | Current State | With Weaver |
|--------------|--------------|-------------------------------|
| Manual VM management (libvirt/virt-manager) | $0 licensing but ongoing labor | 2 nodes x $149 = **$298/yr (Solo)** |
| Part-time IT contractor at $65/hr, 5 hrs/week on infrastructure | **$16,900/yr** | Reclaim 3 hrs/week = **$10,140/yr freed** |
| No formal audit trail — vulnerability during federal funding reviews | Compliance risk | Git-based audit log satisfies federal grant compliance requirements |
| **Total** | **~$16,900/yr + compliance risk** | **$298/yr + $10,140 labor freed + audit readiness** |

### Weaver Team for Government

**The scenario:** A small municipal IT team or government agency runs a primary host alongside a backup/DR site host — or a small agency spans multiple building locations. Weaver Team lets the team monitor cross-site workload health from one Weaver view without deploying an Fabrick control plane.

Weaver Team (v2.2.0) shows remote peer workloads in the existing Weaver view with a host badge on each workload card. The IT team sees whether citizen-facing services are running at the backup site, checks resource utilization across both hosts, and gets a unified view of cross-site workload health. Management actions on remote peers are fully available — restart, provision, and manage workloads across both hosts. Each host is independently licensed and managed; there is no shared control plane at Weaver tier.

| Team Use Case | Weaver Team Capability |
|--------------|------------------------|
| **Primary + DR/backup site** | Monitor workload health at the backup site from the primary Weaver view — confirm services are running, check resource consumption, verify the DR environment is healthy |
| **Multi-building agency** | Small agencies with hosts at different locations see all workloads in one view without VPN tunneling to each host separately |
| **Cross-site COOP visibility** | During a continuity of operations event, the team can confirm what is running at the backup site from the primary host's dashboard |
| **Peer discovery** | Tailscale MagicDNS peer discovery (WireGuard-based, SOC 2 Type II) or manual IP entry — no infrastructure changes required to add a peer |
| **2-peer cap** | Primary host + backup/DR host + one additional — right-sized for small agencies without Fabrick overhead |

**FedRAMP/compliance note:** Weaver Team peer connections use Tailscale (WireGuard-based, SOC 2 Type II audited). Document this for compliance reviewers: inter-host monitoring traffic is encrypted in transit via WireGuard, no cloud control plane receives workload data, and each host retains its independently licensable ATO boundary. Peer management operates over encrypted Tailscale connections and does not require a cloud control plane.

**Upgrade to Fabrick** for centralized governance, audit log aggregation, per-VM RBAC across hosts, resource quotas, and unlimited peers. Fabrick is the right tier for agencies that need fleet-scale control beyond 2 remote peers.

**ROI for a small municipal IT team (2 hosts, 3 staff, Weaver Team):**

| | Current | With Weaver Weaver Team |
|---|---|---|
| Primary host | Proxmox or manual libvirt | Weaver Solo/Team |
| DR/backup site host | Separate tool or SSH-based checks | Appears in Weaver view with host badge |
| Cross-site monitoring | Manual; requires VPN + separate session | Unified dashboard — one pane of glass |
| Team cost | $0 licensing + significant time overhead | 3 users × $129/user/yr (FM) = **$387/yr** |

---

## 4. Fabrick for Government {#4-fabrick-for-government}

**Target:** Federal civilian agencies, large state agencies, multi-department government organizations, law enforcement agencies handling CJI, state revenue departments handling FTI, federal DevSecOps teams

**Price:** $2,000/yr first node + $750/yr additional + $500/yr at 10+ nodes (up to 256GB RAM)

**The pitch:** "Your ATO package is 500 pages of documentation that is outdated the day it is approved. Your Authorizing Official signed off on a snapshot. Weaver makes your ATO a living document — because the system configuration IS the documentation, and it is always current. Zero drift means assessed state is running state. Always."

### Fabrick Features Mapped to Government Obligations

| Fabrick Feature | NIST 800-53 Controls Addressed | ATO Evidence Produced | Available |
|-------------------|-------------------------------|----------------------|:---------:|
| **Per-VM RBAC** | AC-2 (account mgmt), AC-3 (access enforcement), AC-5 (separation of duties), AC-6 (least privilege) | Role assignments per VM with enforcement logs; least-privilege demonstrated at VM granularity; separation of duties between viewer/operator/admin | v1.0 |
| **SSO/SAML/LDAP** | IA-2 (identification and authentication), IA-4 (identifier management), IA-5 (authenticator management) | Integration with agency Active Directory or PIV/CAC authentication chain; single identity source of truth; supports OMB M-22-09 Identity pillar | v1.2+ |
| **Declarative Audit Log** | AU-2 (audit events), AU-3 (content of records), AU-6 (audit review), AU-12 (audit generation) | Git commit history: who, what, when, why — tamper-evident, immutable, searchable. Satisfies OMB M-21-31 EL2 requirements | v1.0 |
| **Bulk VM Operations** | CM-3 (configuration change control), CM-5 (access restrictions for change) | Fleet-wide policy changes applied atomically with approval workflow in git; change control is verifiable by Authorizing Official | v1.0 |
| **Resource Quotas** | SC-6 (resource availability), CP-2 (contingency plan) | Resource limits prevent workload interference across agency or program boundaries | v1.0 |
| **All Plugins Included** | SC-7 (boundary protection), SI-3 (malicious code protection), SC-8 (transmission confidentiality) | Firewall (nftables v1.1), DNS (v1.1), AppArmor/Seccomp (v1.2), kernel hardening (v1.2) — complete security stack | v1.0 (DNS v1.1, firewall v1.1, hardening v1.2) |
| **Managed Bridges** | SC-7 (boundary protection), SC-32 (information system partitioning) | Declarative network segmentation defines system boundaries; partitioning is code, not manual configuration; satisfies OMB M-22-09 Network pillar | v1.0 |
| **Weaver** | CM-7 (least functionality), SC-32 (partitioning), SI-3 (malicious code protection) | Rootless Podman visibility (v1.1) and management (v1.2) in one ATO boundary; no privileged daemon = STIG-friendly; Apptainer for HPC/national lab workloads | v1.1 (visibility), v1.2 (management) |

### Zero Trust Architecture Mapping (EO 14028 / OMB M-22-09)

| Zero Trust Pillar | OMB M-22-09 Requirement | Weaver Capability | Available |
|------------------|------------------------|------------------------------|:---------:|
| **Identity** | Agency staff use enterprise-managed identities; MFA for all users | SSO/SAML/LDAP with MFA-capable identity providers; PIV/CAC-compatible authentication chain | v1.2+ |
| **Devices** | Government devices have security posture assessed continuously | NixOS host hardening declarative; FIPS-mode crypto; hardening plugins enforce device security baseline | v1.0 + v1.2 |
| **Networks** | Agencies must segment networks and encrypt all DNS/HTTP traffic; move away from broad network perimeters | Managed bridges create micro-perimeters per workload; deny-by-default firewall (v1.1); managed DNS (v1.1); every network boundary is declared and version-controlled | v1.0 (bridges), v1.1 (firewall + DNS) |
| **Applications / Workloads** | Treat all applications as internet-connected regardless of location; per-user, per-session authorization | Per-VM RBAC enforces per-workload authorization; no implicit trust based on network location; role assignments logged per session | v1.0 |
| **Data** | Categorize data, encrypt at rest/in-transit, access controls based on data classification | Per-VM isolation for data classification boundaries; FIPS-mode encryption; NixOS LUKS declarative; managed bridges enforce data path controls | v1.0 + NixOS native |

### Fleet Onboarding (v2.3.0)

Federal and state agencies deploying Fabrick into existing NixOS fleets — common in zero-trust modernization programs under EO 14028 — can register all hosts without manual inventory work. **CIDR probe** covers agency-managed network segments: probes only port 50051 (the Weaver agent port), accepts only RFC 1918 address space (no public IPs, no loopback), and produces an audit log entry satisfying AU-12 (audit generation) with triggering user, timestamp, CIDR input, and discovered host count. **CSV/hostname import** covers strictly segmented or air-gapped environments: admin provides the host list; Fabrick connects only to those hosts — no lateral probing. Both paths are fully air-gap compatible and require no external API calls. Discovered hosts register in Fabrick and immediately pull workload inventory from their local Weaver agent — establishing the initial CM-8 (system component inventory) baseline automatically. The registration event is audit-logged and satisfies the asset inventory control for ATO evidence packages.

Non-NixOS hosts — existing RHEL, Ubuntu, or CentOS servers still running in the agency fleet — can join as **Observed** members via `weaver-observer` (statically-linked Rust binary — memory-safe by construction, aligned with CISA/NSA memory-safe language guidance). Observed hosts contribute to the CM-8 asset inventory baseline but do not contribute to ATO compliance evidence (no declarative config, no zero-drift guarantee). Observer nodes are included free up to 5× the Managed node count. For ATO packages, the Managed vs Observed distinction provides an honest, auditable view for the Authorizing Official — observed hosts are in the fleet map but clearly outside the compliance boundary.

### Fabrick Success Programs for Government

| Program | Government Application | FM Price | Standard Price |
|---------|----------------------|:--------:|:--------------:|
| **Adopt** | NixOS + Weaver onboarding course (LMS) + 3 live sessions; FISMA-aware deployment playbook; ATO boundary architecture review; STIG-equivalent baseline configuration guidance | $5,000/yr | $15,000/yr |
| **Adopt — Compliance** | Everything in Adopt + NIST SP 800-53 control mapping session, SSP section drafting for Weaver components, ATO evidence walkthrough, OMB M-22-09 zero trust maturity baseline | — | $25,000/yr |
| **Accelerate** | All Adopt content; dedicated Slack; quarterly fleet reviews mapped to NIST SP 800-53 control families; ATO evidence package assistance; ConMon integration; OMB M-21-31 logging maturity assessment; CISA BOD response playbooks; LMS modules for zero trust architecture patterns | $15,000/yr | $45,000/yr |
| **Partner** | Named engineer with government IT experience; priority features for government-specific needs (PIV/CAC authentication, STIG-equivalent NixOS baselines, FTI/CJI isolation templates); ATO package drafting support; inter-agency architecture consulting; EO 14028 roadmap; sessions on demand | $30,000/yr | $90,000/yr |

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = $9,000/yr total compliance coverage during the FM period. Standard Adopt — Compliance ($25,000/yr) includes hands-on compliance service delivery not covered by the extension alone.

### ROI for a Mid-Size Federal Civilian Agency (25 Nodes)

| Cost Category | Current State | With Fabrick |
|-------------|--------------|----------------------------------|
| Infrastructure software | VMware: $15,000–45,000/yr | 25 nodes: **$15,500/yr** |
| ATO maintenance staff time (2 ISSOs, 40% on infrastructure evidence) | $80,000/yr | Redirect to non-infrastructure controls — infra evidence is automatic |
| Annual FISMA assessment preparation | 8 weeks/yr across team = $60,000 | < 3 weeks — config-as-code is the evidence |
| Configuration scanning / drift detection | $8,000–20,000/yr | $0 — drift impossible by construction |
| ConMon tooling and staff time | $15,000–30,000/yr | Reduced — zero-drift architecture eliminates configuration-based findings |
| Success program | N/A | Accelerate: **$15,000/yr (FM)** |
| **Total** | **$178,000–235,000/yr** | **$30,500/yr + ISSO staff redirected to higher-value controls** |

### Compliance Export Extension

**Price:** $4,000/yr flat (per organization — not per node) · stacks on Fabrick subscription
**Available:** v2.2 (NIST 800-53 export) · v3.0 (scheduled delivery + ConMon integration)

The Compliance Export extension generates NIST SP 800-53 SSP control implementation narratives and ConMon evidence packages from Weaver's existing configuration artifacts. Your ATO becomes a living document — not a snapshot that ages out the day it is signed.

| Feature | Federal Compliance Requirement Addressed | Available |
|---------|------------------------------------------|:---------:|
| **NIST SP 800-53 control mapping export** | CM-6, AU-2, AU-3, AU-12 — formatted SSP control implementation narratives for Weaver-managed components; Authorizing Official-ready | v2.2 |
| **Signed configuration attestation** | CM-3, CM-5 — cryptographically signed config snapshot proving assessed state matches running state; closes the ATO drift gap | v2.2 |
| **Audit-ready change log export** | AU-2, AU-3, OMB M-21-31 EL2 — formatted change history: who, what, when, authorized by whom; ConMon-ready | v2.2 |
| **Scheduled ConMon evidence delivery** | Continuous monitoring requirement — monthly zero-drift attestations delivered automatically to ISSO | v3.0 |
| **Annual FISMA assessment package** | ATO renewal evidence bundle; assessor-ready | v3.0 |

**Positioning:** "Your ATO is a snapshot that is outdated the day it is approved. Monthly zero-drift attestations from the Compliance Export extension make your ATO perpetually current. ConMon becomes a delivery confirmation, not a finding hunt." See [COMPLIANCE-EXPORT-EXTENSION.md](../../product/COMPLIANCE-EXPORT-EXTENSION.md) for full feature spec.

---

## 5. Deficiency Remediation Plan {#5-deficiency-remediation-plan}

Government organizations routinely carry POA&M backlogs from FISMA assessments, IG audits, and CISA reviews. Many deficiencies trace directly to infrastructure tooling that does not produce evidence, enforce policy, or maintain baselines. Weaver closes these gaps — and the fastest wins start at Weaver.

### The Sales Motion: Close POA&M Items to Justify the Purchase

Every open POA&M item is a documented risk accepted by the Authorizing Official. Accumulated POA&M items trigger IG scrutiny, delay re-authorization, and consume ISSO time. Frame Weaver as a POA&M remediation tool, not just an infrastructure platform. Each closed item reduces organizational risk and frees staff for higher-priority security work.

### Phase 1: Quick Wins at Weaver ($149/yr (FM, first 200) per node)

These controls are satisfied or substantially improved upon deploying Weaver at v1.0.

| NIST SP 800-53 Control | Requirement | How Weaver Closes It | POA&M Impact | Available |
|-----------------------|------------|----------------------|:------------:|:---------:|
| **CM-2** — Baseline Configuration | Develop, document, and maintain baseline configurations | NixOS declarative config IS the baseline. The running system is mathematically identical to the declared config. No scanning needed to verify | Closes immediately | **v1.0** |
| **CM-3** — Configuration Change Control | Track, review, and approve all changes to the system | Every change is a git commit — who, what, when, why. Unauthorized changes are impossible without a commit | Closes immediately | **v1.0** |
| **CM-6** — Configuration Settings | Establish and enforce security configuration settings | Declarative config enforces settings fleet-wide. Settings cannot drift because the declaration IS the running state | Closes immediately | **v1.0** |
| **CM-7** — Least Functionality | Configure the system to provide only essential capabilities | NixOS only runs declared software — nothing is implicit. Least functionality is the default, not a hardening exercise | Closes immediately | **v1.0** |
| **SI-2** — Flaw Remediation | Identify, report, and correct system flaws in a timely manner | NixOS declarative updates apply fleet-wide; CISA KEV patches are config commits with verifiable timestamps. Fleet-wide, not host-by-host | Substantially improves | **v1.0** |
| **SI-7** — Software, Firmware, and Information Integrity | Employ integrity verification tools on system components | Zero-drift architecture means the running state is always identical to the declared state. Integrity verification is by construction | Substantially improves | **v1.0** |
| **CP-10** — System Recovery and Reconstitution | Provide for recovery to a known state within defined RTO | Declarative config = known state by definition. Sub-second VM boot (Firecracker <125ms) provides rapid reconstitution. Recovery is deterministic | Substantially improves | **v1.0** |
| **SC-7** — Boundary Protection | Monitor and control communications at external and internal system boundaries | Managed bridges (v1.0) declaratively enforce network segmentation. nftables firewall (v1.1) adds explicit boundary rules | Substantially improves | v1.0 (bridges), v1.1 (firewall) |
| **SA-10** — Developer Configuration Management | Require configuration management for the development/integration/maintenance lifecycle | Nix declarations + git versioning provide full configuration management for infrastructure-as-code; required for DevSecOps teams running CI/CD pipelines | Substantially improves | **v1.0** |
| **MP-2** — Media Access | Restrict access to digital and physical media containing system information | Self-hosted — sensitive data never leaves the facility. NixOS supports LUKS full-disk encryption declaratively | Partially addresses | **v1.0** + NixOS native |

**POA&M Impact:** Closing CM-2, CM-3, CM-6, and CM-7 addresses the entire Configuration Management family — consistently one of the most-cited finding areas in FISMA assessments. Combined with SI and SC improvements, a typical agency closes **15–25 POA&M items** from Weaver deployment alone.

### Phase 2: Fabrick Upgrades That Close the Hard Controls

These controls require Fabrick features (RBAC, LDAP, full audit governance). Position the Fabrick upgrade as "closing the Access Control and Audit families" — the Weaver deployment already proved the platform.

| NIST SP 800-53 Control | Requirement | How Fabrick Closes It | POA&M Impact | Available |
|-----------------------|------------|-------------------------|:------------:|:---------:|
| **AC-2** — Account Management | Manage information system accounts, including authorizations | Per-VM RBAC — granular access control at the individual VM level; role lifecycle management with audit trail | Closes | **v1.0** |
| **AC-3** — Access Enforcement | Enforce approved authorizations for system access | Role-based permissions restrict what each user can do per VM (view, modify, manage, admin) | Closes | **v1.0** |
| **AC-5** — Separation of Duties | Define and enforce separation of duties to reduce organizational risk | Fabrick role model separates viewer/operator/admin functions; no single role can both configure and approve | Closes | **v1.0** |
| **AC-6** — Least Privilege | Employ the principle of least privilege for all accounts | Per-VM RBAC + role granularity enforces least privilege at infrastructure level | Closes | **v1.0** |
| **AU-2** — Audit Events | Define and generate audit events for the information system | Declarative audit log captures all infrastructure events — every VM change, access grant, configuration modification | Closes | **v1.0** |
| **AU-3** — Content of Audit Records | Audit records contain the required information (who, what, when, outcome) | Git commit history: who (author), what (diff), when (timestamp), why (commit message), outcome (build result) | Closes | **v1.0** |
| **AU-6** — Audit Review, Analysis, and Reporting | Review and analyze audit records for indicators of inappropriate activity | Searchable git history with standard tooling; integrates with existing SIEM via log export | Closes | **v1.0** |
| **IA-2** — Identification and Authentication (Organizational Users) | Uniquely identify and authenticate organizational users | SSO/SAML/LDAP integration with agency directory; PIV/CAC-compatible authentication chain | Closes fully | v1.0 (local users), **v1.2+** (SSO/PIV/CAC) |
| **IA-4** — Identifier Management | Manage information system identifiers with defined lifecycle | LDAP integration synchronizes identifiers with agency authoritative source; lifecycle-managed with directory | Closes fully | **v1.2+** (v1.0: local user management) |
| **SC-32** — Information System Partitioning | Partition the information system into components | Managed bridges + per-VM RBAC create logical partitions; each agency/program gets an isolated enclave with independent access controls | Closes | **v1.0** |
| **SC-7(5)** — Boundary Protection: Deny by Default | Deny network traffic by default; allow only by exception | Declarative firewall with deny-by-default policy; only explicitly declared traffic flows | Closes | **v1.1** |

**POA&M Impact:** Fabrick features close the Access Control (AC) and Audit (AU) control families — the two most heavily scrutinized in FISMA assessments and IG audits. A typical agency closes **20–30 additional POA&M items** from Fabrick deployment.

### Phase 3: Success Programs That Close Process Controls

Some SP 800-53 controls are process-oriented — they require documented procedures, not just technical implementation. The Fabrick success programs help agencies close these with guided documentation and structured quarterly reviews.

| NIST SP 800-53 Control | Requirement | How Success Programs Help | Program |
|-----------------------|------------|--------------------------|:-------:|
| **IR-1** — Incident Response Policy | Establish and implement an incident response capability | Accelerate includes incident response workflow integration; AI diagnostics feed triage documentation | Accelerate |
| **IR-4** — Incident Handling | Implement an incident handling capability that includes detection, analysis, containment, eradication, recovery | Accelerate includes incident response playbook tailored to declarative infrastructure; AI diagnostics accelerate triage | Accelerate |
| **CA-2** — Security Assessments | Assess the security controls in the information system periodically | Quarterly fleet reviews in Accelerate map Weaver state to SP 800-53 controls and generate assessment evidence | Accelerate |
| **CA-5** — Plan of Action and Milestones | Develop and update a plan of action and milestones for the information system | Partner program includes POA&M remediation planning; prioritized by risk and Authorizing Official concerns | Partner |
| **PL-2** — System Security Plan | Develop and maintain a system security plan | Partner program assists with SSP section drafting for Weaver components; declarative config makes SSP maintenance trivial | Partner |
| **RA-5** — Vulnerability Monitoring and Scanning | Scan for vulnerabilities and remediate | Zero-drift architecture eliminates configuration-based vulnerabilities. Partner program integrates with agency vulnerability management program and CISA KEV reporting | Partner |
| **PM-14** — Testing, Training, and Monitoring | Implement a process for testing effectiveness of security controls | Accelerate quarterly reviews serve as control effectiveness testing; declarative model means tests are deterministic | Accelerate |

### The Full Remediation Path

| Stage | Investment | Timeline | POA&M Items Addressed | Version |
|-------|-----------|----------|:---------------------:|:-------:|
| **Weaver deployment** | $149–3,725/yr (1–25 nodes) | Month 1–2 | CM family, SI, SC-7 (bridges), CP-10 — **15–25 items** | **v1.0 today** |
| **Fabrick upgrade** | $15,500/yr (25 nodes) | Month 3–4 | AC family, AU family, IA (local users), SC-32 — **20–30 items** | **v1.0 today** |
| **v1.1 firewall + DNS** | Included in tier | v1.1 release | SC-7(5) deny-by-default, managed DNS | v1.1 |
| **v1.2 security plugins** | Included in Fabrick | v1.2 release | SSO/LDAP/PIV (IA-2, IA-4, IA-5), AppArmor/Seccomp (SI-3), kernel hardening | v1.2 |
| **Accelerate program** | $15,000/yr | Month 4–6 | IR family, CA-2, PM-14 — **10–15 items** | Any version |
| **Partner program** | $30,000/yr | Ongoing | SSP (PL-2), POA&M (CA-5), vulnerability integration (RA-5) — **5–10 items** | Any version |
| **Cumulative (v1.0 today)** | | **Immediate** | **35–55 POA&M items with direct evidence** | Available now |
| **Cumulative (through v1.2)** | | ~6 months | **60–80+ POA&M items with direct evidence** | v1.2 release |

**What is available today (v1.0):** An agency deploying Weaver + Fabrick closes 35–55 POA&M items across the CM, AC, AU, SI, SC, and CP control families. For many agencies, this is the majority of infrastructure-related findings on the current POA&M.

**What v1.2 completes:** SSO/LDAP/PIV integration, declarative firewall, and hardening plugins close the remaining identity and boundary controls — enough to dramatically simplify the next FISMA assessment cycle and demonstrate OMB M-22-09 zero trust maturity.

### Positioning the Conversation

**Discovery opener:** "How many open POA&M items do you have from your last FISMA assessment? How many are infrastructure-related?"

**The bridge:** Every open POA&M item is a documented risk your Authorizing Official accepted. Every item you close before the next assessment cycle reduces organizational risk and frees your ISSO to focus on higher-priority controls. Weaver doesn't just manage VMs — it closes POA&M items, produces ATO evidence automatically, and satisfies CISA KEV patch timelines with a git commit.

**The close:** "At $149 per node, Weaver pays for itself if it closes a single Configuration Management finding. Most agencies close 15+ items in the first month."

---

## 6. Competitive Advantages {#6-competitive-advantages}

### The Self-Hosted Advantage: FedRAMP is Irrelevant

This is the single most important differentiator for government sales. Cloud-based infrastructure management tools require FedRAMP authorization — a 12–18 month process costing $500K–$2M. Weaver is self-hosted. It runs on agency hardware, in agency facilities, behind agency perimeters. No cloud component, no phone-home, no FedRAMP authorization needed. Agencies can deploy immediately and bill the purchase as a software license on existing IT budget lines — no cloud services contract vehicle required.

For state and local governments, the same logic applies to StateRAMP. Self-hosted means no cloud authorization process at any level of government.

### vs VMware (Post-Broadcom)

| Factor | VMware | Weaver |
|--------|--------|-------------------|
| Cost (federal agency, 25 nodes) | $15,000–45,000/yr (subscription-only post-Broadcom) | $15,500/yr (25 nodes Fabrick) |
| FISMA/ATO evidence | Separate audit logging, configuration scanning, change management tools — each requiring its own ATO documentation | Built-in — every change is a git commit with attribution. One tool, one ATO boundary |
| Configuration drift | Possible; requires periodic scanning to detect | Impossible by construction (NixOS declarative model) |
| Government contract vehicle | Available on many vehicles but expensive | Lower price point fits within micro-purchase thresholds at Weaver tier |
| FIPS-validated crypto | Available but requires separate configuration | NixOS supports FIPS-mode OpenSSL declaratively — provable via config audit trail |
| ATO complexity | VMware + separate audit tools + separate access tools = multiple ATO boundaries | Single platform = single ATO boundary |
| Vendor lock-in | High — Broadcom controls pricing unilaterally | Open core, offline-first license, no phone-home |
| Zero trust evidence | Requires bolt-on tooling to produce OMB M-22-09 evidence artifacts | Managed bridges + RBAC + deny-by-default firewall produce zero trust evidence natively |

### vs Proxmox

| Factor | Proxmox | Weaver |
|--------|---------|-------------------|
| FISMA audit trail | API call logs — captures actions, not intent or approval | Git diffs — captures what changed, who approved, and why |
| Per-VM RBAC | Pool-level permissions only | Per-VM role assignments — critical for multi-agency or multi-program isolation |
| Zero drift | No — imperative management allows drift between assessments | Yes — declarative by construction; assessed state = running state |
| ATO evidence | Manual documentation of system state | System state IS the documentation (NixOS config + git history) |
| STIG compliance | Manual hardening after deployment | Hardening declared at configuration time; version-controlled; drift from STIG baseline is structurally impossible |
| Air-gap support | Requires internet for subscription validation | Offline-first license (HMAC, no phone-home) |
| Government pricing | EUR-denominated, no government contract vehicles | USD pricing, fits micro-purchase thresholds at Weaver |

### vs Cloud (AWS GovCloud / Azure Government)

| Factor | GovCloud | Weaver |
|--------|----------|-------------------|
| FedRAMP requirement | Must use FedRAMP-authorized services | Self-hosted — no FedRAMP authorization needed |
| Data location | Government cloud regions — still shared infrastructure | On your premises — data never leaves your facility |
| Cost per VM | $600–6,000+/yr per VM | Unlimited VMs per node ($149–1,500/yr per node) |
| ATO process | Inherited controls simplify but do not eliminate ATO | Self-hosted with declarative config simplifies ATO for the entire infrastructure layer |
| Air-gap capability | No — cloud requires connectivity | Yes — offline-first license, no phone-home required |
| Procurement | Requires cloud services contract vehicle | Software license — simpler procurement, fits existing IT budget categories |
| Supply chain | Cloud provider infrastructure is opaque | Open-core, self-hosted, fully auditable |
| OMB M-22-09 data sovereignty | Data processed on provider infrastructure | Data stays on agency-controlled hardware |

### Weaver: The STIG-Friendly Container Story

Government agencies increasingly run containerized workloads alongside VMs. The standard answer — Docker — ships with a privileged daemon that runs as root and has broad access to host resources. This is a STIG finding waiting to happen. Rootless Podman eliminates the privileged daemon entirely. Containers run as non-root users. No SUID escalation path. This is the STIG-preferred container runtime — and it is the NixOS default.

Weaver (v1.1+) provides the management dashboard that rootless Podman has never had. One ATO boundary covers MicroVMs and containers. No separate authorization for a separate container management tool. For federal DevSecOps teams running NixOS-hosted CI/CD pipelines, Weaver surfaces Podman containers alongside MicroVMs in the same topology view — without adding another tool to the ATO boundary.

For agencies running national laboratory-scale HPC workloads, Apptainer (formerly Singularity) SIF container visibility is included at Weaver (v1.1+). One dashboard, three workload types (MicroVMs, Podman containers, Apptainer containers), one ATO boundary.

### The Air-Gap Advantage

Many government environments — law enforcement handling CJI, agencies handling FTI, classified systems, tribal governments in remote locations with limited connectivity — require or strongly prefer air-gapped infrastructure. Weaver's offline-first license validation (HMAC checksum, no phone-home) is purpose-built for disconnected environments. No competitor offers this without custom fabrick negotiation.

> **Pending differentiator — Onsite AI Model:** For classified systems and air-gapped enclaves where cloud AI is prohibited by policy, `aiPolicy: local-only` routes all AI diagnostics to an onsite inference node inside the perimeter. Hardware/deployment spec not yet defined (see NOTES.md 2026-03-26). When spec'd, every AI-assisted infrastructure diagnostic stays inside the classification boundary — a capability no cloud-dependent competitor can match. Update this section when the onsite AI model spec ships.

#### Kubernetes Complexity in Government

FedRAMP and FISMA require system boundary documentation for every component in the authorization boundary. Kubernetes clusters blur system boundaries — every namespace shares the control plane, etcd, and kubelet. Documenting access paths through shared infrastructure is audit-intensive and generates POA&M items that persist across assessment cycles. ATO reviewers must trace data flows through CNI plugins, service mesh sidecars, and shared secrets — complexity that inflates the authorization package.

| K8s Overhead | Impact in Government | Weaver Alternative |
|---|---|---|
| Shared control plane blurs system boundaries | FedRAMP/FISMA ATO requires documenting every shared component; K8s etcd, API server, and kubelet are shared across all namespaces | Each MicroVM is a clear system boundary; no shared control plane to document around; one ATO boundary |
| Network policy complexity for segmentation evidence | NIST 800-53 SC-7 requires documented network segmentation; K8s NetworkPolicy + CNI enforcement is audit-complex | Managed bridges with declarative config — segmentation is code, auditable by inspection |
| Platform team cost for government-cleared engineers | Cleared K8s engineers command $180K-$250K/yr; agencies need 3-5 for production clusters | Weaver eliminates the platform team; one cleared sysadmin manages the infrastructure |

Full competitive reference: [KUBERNETES-COMPETITIVE-POSITIONING.md](../KUBERNETES-COMPETITIVE-POSITIONING.md)

### AI-Era Threat Landscape Advantage

Anthropic's Project Glasswing (April 2026) demonstrated that frontier AI can discover **thousands of zero-day vulnerabilities** — including some that survived decades of human review — across every major operating system and browser. These capabilities will proliferate to attackers.

**Why this changes the calculus for government agencies:**

- **Shared-kernel = fleet-wide compromise.** A single kernel zero-day — exactly the kind AI is now finding by the thousands — compromises every Docker container on the host simultaneously. Weaver's hardware boundary per MicroVM contains the blast radius to one workload. For agencies managing national security infrastructure or critical citizen services, a fleet-wide container escape is not a security incident — it is a mission failure.
- **Patch at the speed of AI discovery.** FISMA continuous monitoring (OMB M-21-31, NIST 800-137) requires agencies to demonstrate timely vulnerability remediation. When Glasswing-class disclosures arrive, FedRAMP and FISMA assessors will ask how fast you converged every system to the patched state — and whether you can prove it. NixOS's `flake.lock` pins every dependency by hash. Pin the fix, rebuild, deploy via Colmena — every node converges deterministically. No "did we patch that air-gapped system?"
- **Supply-chain verifiability.** Glasswing explicitly targets open-source and supply-chain security — the same attack vector that SolarWinds exploited against federal agencies. NixOS's content-addressed store makes the entire supply chain formally verifiable — every package identified by its complete dependency tree hash, not a mutable tag. CISA Binding Operational Directives on supply chain security have a concrete answer.
- **Hypervisor diversity.** Weaver's 5 hypervisor options mean a vulnerability in one doesn't cascade to workloads on another — defense through diversity against AI-augmented exploit discovery. For agencies running critical infrastructure protection workloads, single-hypervisor concentration is exactly the risk profile AI-driven vulnerability discovery exploits at scale.

### The Micro-Purchase Advantage

Federal micro-purchase threshold: $10,000. State and local thresholds vary but are typically $5,000–$25,000. Weaver Weaver at $149/yr (FM, first 200) per node fits under every micro-purchase threshold in the country for small deployments. An IT administrator can purchase with a government credit card — no procurement office involvement, no RFP, no 6-month acquisition cycle. For budget-constrained state, local, and tribal governments, this is transformative.

---

## 7. Objection Handling {#7-objection-handling}

### "We need a FedRAMP-authorized solution"

You need FedRAMP for cloud services. Weaver is self-hosted — it runs on your hardware, in your data center, behind your perimeter. No cloud component, no phone-home, no FedRAMP requirement. Your data stays on your metal. This actually simplifies your ATO because you control the entire stack. The only cloud-adjacent concern is the licensing server — which is HMAC-based and offline-first. There is nothing to authorize.

### "NixOS isn't on the DISA STIG list"

NixOS roots go back to 2003 and it's been shipping stable releases for 12 years — 100K+ packages, ~466 companies in production. STIGs are one approach to hardening. NIST SP 800-53 CM-7 requires configuring systems to provide only essential capabilities — NixOS's declarative model is inherently least-functionality: nothing runs unless declared. The hardening plugins (AppArmor, Seccomp, kernel hardening at v1.2) enforce defense-in-depth declaratively. More importantly: STIGs define desired end state. NixOS's declarative model means that end state is declared, version-controlled, and enforced — it cannot drift between the declaration and the running system. With the Partner success program, we will work with your security team to create STIG-equivalent NixOS configurations that satisfy the intent of the STIG checklist.

### "We need PIV/CAC authentication before we can deploy"

PIV/CAC-compatible SSO integration arrives in v1.2. For v1.0, local user management with strong passwords is available. The correct approach for agencies with hard PIV requirements is: deploy Weaver on non-CAC-required workloads, prove the declarative model and close the CM/SI POA&M items immediately, then upgrade to Fabrick + SSO/PIV at v1.2. You close 15–25 POA&M items now and address the identity requirement on the v1.2 timeline — rather than waiting for perfect to be the enemy of good.

### "Our ATO process requires tools already on our approved products list"

Most APLs are for cloud services and network devices — not self-hosted infrastructure management software. Weaver runs on your existing NixOS hosts. It is a management layer, not a new network device or cloud service. The ATO process evaluates controls, not brand names. We provide a control mapping document that maps Weaver capabilities to NIST SP 800-53 controls to accelerate your ATO submission.

### "We can't justify a new tool during a continuing resolution / budget freeze"

Weaver is $149/yr (FM, first 200) per node — that is under the micro-purchase threshold everywhere. A single GS-13 ISSO spending one day per month gathering configuration evidence costs more than a full year of Weaver licensing. The tool pays for itself in the first week of deployment. And because it is a software license — not a cloud service subscription — it fits existing IT purchase authority without requiring a new contract vehicle.

### "Our IT team doesn't know NixOS"

The Adopt success program ($5,000/yr) includes a NixOS onboarding playbook tailored for government IT teams. NixOS's declarative model is actually simpler than imperative Linux administration — you declare what you want, and the system enforces it. Your team spends less time on day-to-day operations, not more. And the learning investment pays off immediately: the declarative config IS your compliance evidence from day one.

### "What about inter-agency data sharing? We need isolation between agencies"

Per-VM RBAC (Fabrick) plus managed bridges creates agency-level isolation — separate network segments, separate access controls, separate audit trails per agency or program. Each agency's workloads live in their own declarative enclave with independently auditable configurations. This is stronger isolation than most shared service environments achieve today, and it is enforced by construction rather than by manual network configuration.

### "We already use cloud for most workloads — why would we go back to on-prem?"

Not every workload belongs in the cloud. CJI, FTI, sensitive PII, and data subject to strict residency requirements often have compliance constraints that make cloud deployment complex or legally precarious. Weaver handles the on-premises workloads that cloud cannot or should not serve. For hybrid environments, the hub-agent multi-node architecture (v2.0+) manages both from one dashboard.

### "EO 14028 / OMB M-22-09 requires zero trust — does NixOS actually support that?"

Zero trust is an architecture principle, not a product. Weaver implements the infrastructure layer of zero trust: per-workload access controls that don't trust network location, managed bridge micro-segmentation, deny-by-default network policy, declarative identity-to-resource binding (v1.2+), and immutable infrastructure that cannot accumulate implicit trust via configuration drift. The OMB M-22-09 pillars are addressed systematically — see the zero trust mapping table in Section 4. The declarative model produces evidence artifacts that demonstrate zero trust maturity, not just zero trust aspiration.

### "Our agency fleet runs RHEL — we can't convert everything before the ATO deadline"

Install `weaver-observer` on existing RHEL hosts. They appear in Fabrick immediately and contribute to the CM-8 asset inventory baseline — the ATO sees a complete fleet picture from day one. Observer hosts are visually distinct from Managed hosts in the fleet map; your Authorizing Official sees an honest compliance boundary. Observer nodes are free up to 5× your Managed node count. Convert your highest-risk, most-audited systems first; observe the rest during the ConMon period. The ATO evidence package covers Managed hosts only — this is surfaced clearly in the UI.

### "EO 14028 and OMB M-22-18 require software supply chain security documentation from vendors"

EO 14028 and OMB M-22-18 require software supply chain security transparency. Weaver's supply chain evidence: SHA pinning on all 40 GitHub Actions (no dependency substitution attacks), SAST with OWASP patterns on every code push, license audit on every build, and a published testing benchmark scored A/A+ against fabrick standards (`docs/TESTING-ASSESSMENT.md`). CVD policy with 48-hour acknowledgment and 7-day critical fix SLAs — `SECURITY.md`. Documented DR/contingency procedures — `docs/setup/DISASTER-RECOVERY.md`. For NIST SP 800-53 SA-9 (external information system services) and SA-11 (developer security testing), these documents are the vendor security artifacts your ISSO can include in the ATO package without a questionnaire negotiation.

---

## 8. Buyer Personas {#8-buyer-personas}

### Civilian Agency CISO / ISSO

**Role context:** Federal civilian agency information security officers at cabinet-level departments, independent agencies, and regulatory bodies. Accountable for FISMA metrics, CISA directive compliance, and Authorizing Official relationships.

**Cares about:** FISMA assessment results, POA&M closure, ATO maintenance, CISA directive compliance timelines, OMB M-21-31 logging maturity, OMB M-22-09 zero trust reporting

**Lead with:** Zero-drift architecture eliminates configuration-related findings from FISMA assessments by construction. Declarative audit trail satisfies the entire AU control family with a git repository. Self-hosted = no FedRAMP authorization required, no data sovereignty concerns. POA&M remediation path: 35–55 items closed with v1.0 deployment. EO 14028 / OMB M-22-09 zero trust evidence produced natively by the platform.

**Tier:** Fabrick + Accelerate or Partner

---

### DoD Civilian IT (GS/SES, Non-Contractor)

**Role context:** Civilian IT personnel at DoD components (Army, Navy, Air Force, DISA, DLA, defense agencies). Subject to DISA STIGs, DoD STIG Viewer assessments, and IA controls frameworks. Not cleared contractors — this is the government-side IT workforce.

**Cares about:** STIG compliance, SCAP scanner findings, IA control implementation evidence, RMF (Risk Management Framework) ATO lifecycle, DISA-mandated hardening, CAC/PKI integration for all systems

**Lead with:** NixOS declarative hardening satisfies STIG requirements by construction — no post-install hardening scripts, no configuration drift between STIG check and running state. Hardening plugins (v1.2) add AppArmor, Seccomp, and kernel hardening declaratively. SCAP findings become fewer because the configuration is declared and enforced, not aspirational. RMF ATO evidence is the git history — always current, always attributed.

**Tier:** Fabrick + Adopt success program (NixOS / STIG baseline guidance)

---

### State/Local Government IT Director

**Role context:** IT directors at state agencies, county governments, city governments, and regional authorities. Often managing heterogeneous infrastructure with limited staff, aging VMware contracts post-Broadcom, and increasing pressure to satisfy state-level security audits.

**Cares about:** Budget efficiency, audit readiness, staff productivity, multi-department service delivery, vendor consolidation, StateRAMP (where applicable), CJIS compliance (for law enforcement components)

**Lead with:** 70–85% cost reduction vs VMware post-Broadcom. Config-as-code means audit prep is always done — no three-week evidence scramble before the state auditor arrives. Single platform replaces multiple tools — one vendor, one support relationship, one ATO boundary. Managed bridges isolate departments on shared hardware. StateRAMP authorization irrelevant because self-hosted.

**Tier:** Fabrick

---

### Federal DevSecOps Team Lead

**Role context:** Engineers and team leads on federal DevSecOps pipelines at large civilian agencies (IRS, SSA, VA, HHS) or DoD software factories (Platform One, BESPIN, Iron Bank). Running CI/CD on NixOS or NixOS-adjacent infrastructure. Managing a mix of container workloads and VM-based environments.

**Cares about:** Pipeline reproducibility, container security posture (rootless Podman as STIG requirement), unified visibility across VMs and containers, ATO boundary minimization, supply chain security, shift-left infrastructure security

**Lead with:** Weaver provides the management layer that rootless Podman has always been missing — unified topology view of MicroVMs and Podman containers in one dashboard, one ATO boundary. NixOS declarative infrastructure means the pipeline environment is reproducible and auditable. FIPS-mode crypto, hardening plugins, and git-based audit log satisfy the security requirements that DoD software factories enforce. Self-hosted = no cloud-side ATO dependency for on-premises pipeline infrastructure.

**Tier:** Fabrick (Weaver features v1.1+)

---

### County/Municipality IT Administrator (Small Team)

**Role context:** Single-person or two-person IT teams at county and municipal governments. Managing citizen-facing services, law enforcement CJI workloads (sometimes), and general administrative infrastructure. Often wearing security, networking, and help desk hats simultaneously.

**Cares about:** Budget (severely constrained), simplicity (wearing multiple hats), compliance with federal mandates passed down to local government via grants and program requirements, uptime for citizen-facing services, offline operation for rural environments

**Lead with:** $149/yr (FM, first 200) per node — fits under every micro-purchase threshold in the country. AI diagnostics for the IT team of one — natural language failure analysis at 2 AM without needing a specialist on call. Zero drift means one less thing to investigate during audit season. Offline-first license for locations with unreliable connectivity.

**Tier:** Weaver

---

### Tribal Government IT

**Role context:** IT staff (often part-time or contracted) at federally recognized tribes. Managing federal grant-funded infrastructure, facing unreliable internet connectivity, subject to federal compliance requirements tied to grant funding, and often operating with extremely limited budgets.

**Cares about:** Extreme budget constraints, federal grant compliance audit readiness, limited or no dedicated IT staff, unreliable internet connectivity, serving remote communities with limited tech support access

**Lead with:** $149/yr (FM, first 200) per node — the lowest-cost professional infrastructure management available. Offline-first license works without reliable internet connectivity. AI diagnostics reduce dependence on specialized IT expertise. Declarative config satisfies federal grant compliance requirements for infrastructure documentation. Migration services ($5,000–20,000) can be funded through federal IT modernization grants (e.g., USDA ReConnect, Tribal Broadband Connectivity Program supplemental IT allocations).

**Tier:** Weaver (Adopt success program if budget allows)

---

## 9. Discovery Questions {#9-discovery-questions}

Use these to qualify government prospects and identify pain.

### Infrastructure Pain

- How do you currently provision new VMs for department or program workloads? How long does it take from request to running VM?
- When was the last time a FISMA assessor or IG auditor found configuration drift between your SSP and running systems?
- How many infrastructure management tools does your IT team operate? How many require separate ATO documentation?
- What is your current RTO for a mission-critical citizen-facing system?
- Do any of your environments require air-gapped or disconnected operation?
- Are you running containerized workloads alongside VMs? How are those managed today — Docker, Podman, Kubernetes?

### Compliance Pain

- How many open POA&M items do you carry from your last FISMA assessment? How many are infrastructure-related?
- How long does your team spend assembling ATO evidence packages? How much of that is infrastructure configuration documentation?
- How do you currently prove to assessors that your running configurations match your SSP?
- What is your current OMB M-21-31 logging maturity level? What would it take to advance to the next level?
- How do you handle CISA Binding Operational Directives — how long does implementation take across your infrastructure?
- Where are you on the OMB M-22-09 zero trust maturity model? Which pillars have evidence artifacts and which are still aspirational?
- For DoD civilian: how do you manage STIG compliance across your infrastructure? How long does a SCAP scan and remediation cycle take?

### Budget Pain

- What are you paying annually for VMware/Proxmox licensing?
- How much of your IT staff time goes to infrastructure management vs security and compliance work?
- Have your VMware costs changed since the Broadcom acquisition?
- Does your infrastructure tooling fit under micro-purchase thresholds, or does procurement add months to acquisition?
- How much do you spend on configuration scanning and drift detection tools?

### Strategic Pain

- Are you facing ATO re-authorization in the next 12 months? How prepared is your infrastructure evidence?
- Do you share infrastructure between multiple agencies, departments, or programs? How do you enforce isolation?
- Are you considering migration off VMware? What is your timeline?
- Do you have workloads that cannot move to cloud (CJI, FTI, classified, air-gapped)? How are they managed today?
- For tribal/rural: how reliable is your internet connectivity? Does your current infrastructure tooling require cloud connectivity?
- For DevSecOps: are you running rootless Podman? Is a privileged Docker daemon on your STIG finding list?

### AI Threat Landscape
- "If a frontier AI discovered a zero-day in your host kernel tomorrow — which Project Glasswing has demonstrated is now routine — how many workloads would be compromised simultaneously? How quickly could you prove the patch propagated to every system?"
- "Glasswing's 90-day public disclosure cycle means adversaries — including nation-state actors — will know about vulnerabilities found in your stack. Can your current infrastructure prove it's patched faster than the disclosure window? For FISMA continuous monitoring, that proof needs to be automated and auditable."

---

## 10. Federal AI Workloads & Fabrick (v3.0+) {#10-federal-ai-workloads--fabrick-v30}

**Full analysis:** [business/FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md)

EO 14110 (AI Executive Order), OMB M-24-10, and the OMB AI Strategy are creating new GPU compute demand across civilian agencies. Agencies are deploying AI for fraud detection, case processing, document review, citizen-service optimization, and scientific computing (NOAA, USGS, NASA, EPA). These workloads require burst GPU capacity that self-hosted on-prem clusters cannot always satisfy. Cloud burst for federal workloads faces the same FedRAMP constraint that applies to all cloud services — except Weaver itself doesn't need it.

### The Compliance Gap

Federal agencies using cloud burst for AI workloads on agency data must:

- Use FedRAMP-authorized cloud services (adding 12–18 months and $500K–$2M if using a non-authorized provider)
- Satisfy applicable data residency, CUI handling, and classification requirements during burst
- Maintain ATO coverage that extends to burst infrastructure
- Avoid cloud concentration risk findings in their FISMA assessment

Self-hosted Weaver + Fabrick sidesteps the first three problems: the burst node runs NixOS + Weaver and registers with the on-prem Fabrick control plane. The agency controls node enrollment; the cloud provider supplies compute. The FedRAMP question narrows to "is the cloud VM itself FedRAMP authorized?" — which is already answered for AWS GovCloud, Azure Government, and Google Cloud Government. Fabrick adds the isolation layer and declarative audit trail on top of FedRAMP-authorized compute.

### The Pitch for Federal AI Teams

*"Your agency's fraud detection team needs 4 H100s for 10 days to retrain the model on current fiscal year data. GovCloud gives you FedRAMP-authorized compute. Fabrick enrolls a dedicated GovCloud burst node with MicroVM isolation — the training run produces a Fabrick audit trail that satisfies your ISSO's ATO evidence requirements. $20/node-day. When the run completes, the burst node deregisters and the node-day counter goes into your annual reporting."*

### New Buyer Persona: Federal AI/ML Infrastructure Lead

**Profile:** Infrastructure engineer or IT architect at a federal agency managing on-premises AI/ML compute alongside a mandate to deliver AI-powered services per EO 14110. Accountable to the agency CISO for data handling controls on training workloads, and to the program office for GPU availability when model updates are due.

**Cares about:** FedRAMP coverage for burst compute, ATO evidence for burst infrastructure, OMB AI reporting requirements, GPU availability for agency AI mandates, data classification handling for training workloads.

**Lead with:** Fabrick on top of FedRAMP-authorized GovCloud compute — "you get the ATO-covered hardware from AWS/Azure; Fabrick adds the isolation layer and audit trail." Self-hosted control plane means no new FedRAMP authorization for the management layer. $20/node-day licensing = a rounding error against the GovCloud compute budget.

**Tier:** Contract + Fabrick fleet license + burst consumption add-on.

### Discovery Questions (Federal AI Platform)

- Is your agency under any OMB or EO 14110 AI deployment mandates? What's the compute implication?
- How do you currently provision GPU capacity for AI training workloads? Is there a FedRAMP requirement for burst infrastructure?
- Does your ISSO require ATO coverage for burst nodes used in AI training? How do you currently satisfy that?
- Are any of your training workloads on data with CUI, FOUO, or PII classification that affects where it can be processed?

---

*This document complements the universal value proposition in [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md). For pricing details, see [TIER-MANAGEMENT.md](../../product/TIER-MANAGEMENT.md). For defense contractors and cleared facilities, see [defense-contractor.md](defense-contractor.md). For cloud burst architecture and licensing, see [FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md).*

---

## Recent Changes

- **2026-03-26** — Added fleet onboarding subsection to Section 4 (Fabrick). CIDR probe and CSV paths for air-gap/segmented environments; AU-12 and CM-8 evidence from discovery session; EO 14028 zero-trust modernization angle.
- **2026-03-21** — Added Section 10: Federal AI Workloads & Fabrick (v3.0+). Covers EO 14110 / OMB AI mandate compute implications, FedRAMP-authorized burst via GovCloud + Fabrick isolation layer, and new Federal AI/ML Infrastructure Lead buyer persona.
- **2026-03-18** — Fabrick pricing revised to $2,000/yr first node, $750/yr additional, $500/yr at 10+. Fabrick tier added at $2,500/yr (512GB RAM). Contract tier added for 512GB+ deployments (sliding scale per 512GB block). RAM coverage noted per tier. Parallel migration / no-expertise-required positioning added as primary lead.
