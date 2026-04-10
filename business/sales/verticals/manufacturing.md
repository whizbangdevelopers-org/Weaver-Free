<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Manufacturing / OT IT Sales Case
## How Weaver Secures IT/OT Convergence for Manufacturing Organizations
*Discrete Manufacturing, Process Manufacturing, Industrial Automation & Critical Infrastructure*

**Date:** 2026-03-09
**Parent doc:** [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md)

---

## Table of Contents

1. [The Manufacturing IT/OT Problem](#1-the-manufacturing-itot-problem)
2. [Regulatory Mapping: What Weaver Addresses](#2-regulatory-mapping)
3. [Weaver for Manufacturing](#3-weaver-for-manufacturing)
4. [Fabrick for Manufacturing](#4-fabrick-for-manufacturing)
5. [Deficiency Remediation Plan](#5-deficiency-remediation-plan)
6. [Manufacturing-Specific Competitive Advantages](#6-competitive-advantages)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Discovery Questions](#9-discovery-questions)

---

## 1. The Manufacturing IT/OT Problem {#1-the-manufacturing-itot-problem}

**No NixOS expertise required — ever.** Weaver runs alongside existing Docker, VMware, Proxmox, or bare-metal tooling. Migrate one workload at a time. No cutover event. No retraining. Hardware isolation for OT/IT convergence without replacing existing tooling. PLC management servers and SCADA systems isolated in MicroVMs alongside existing infrastructure.

Manufacturing IT teams face a challenge no other industry shares at scale: two separate technology worlds — IT and OT — are converging whether anyone planned for it or not. PLCs, HMIs, SCADA systems, and IIoT sensors are now connected to enterprise networks. Legacy systems that were designed for air-gapped operation now need monitoring, patching, and compliance. Production lines that cannot tolerate seconds of downtime share infrastructure with corporate systems that need regular updates.

**What manufacturing IT/OT teams should be doing:**

- Architecting defensible boundaries between IT and OT zones per IEC 62443 zone/conduit models
- Maintaining asset inventories and configuration baselines for converged environments
- Implementing NIST CSF 2.0 Identify/Protect/Detect/Respond/Recover across both IT and OT
- Managing ISO 27001 controls across production and enterprise systems
- Isolating legacy OT systems that cannot be patched but must be monitored
- Deploying and managing edge compute infrastructure across multiple plant sites with limited connectivity
- Enforcing supply chain security requirements flowing down from OEM customers and prime contractors

**What manufacturing IT/OT teams actually spend time doing:**

- Manually provisioning VMs at each plant site with no reproducible configuration baseline
- Fighting configuration drift on systems that run 24/7/365 and cannot be taken offline for maintenance windows
- Managing separate tool stacks for IT and OT with no unified visibility
- Traveling to remote plant sites to troubleshoot infrastructure because tools require connectivity
- Documenting system state after changes to satisfy ISO and customer audits
- Rebuilding environments after failures with no guarantee the rebuilt system matches production specifications
- Mediating between IT and OT teams who use different tools, different processes, and different vocabularies

**Weaver eliminates the second list so IT/OT teams can focus on the first.**

---

## 2. Regulatory Mapping: What Weaver Addresses {#2-regulatory-mapping}

### Direct Compliance Impact

> **Version key:** v1.0 = shipped today. v1.1+ / v1.2+ = on roadmap. NixOS = host OS capability (not a dashboard feature). Capabilities without a version tag are v1.0.

| Regulation / Standard | IT/OT Obligation | Weaver Capability | Tier | Available |
|----------------------|-----------------|------------------------------|:----:|:---------:|
| **IEC 62443** — Industrial Automation and Control Systems Security | Zone/conduit network segmentation; secure-by-design lifecycle; configuration management | Managed bridges with IP pools create declarative zone boundaries. Zero-drift NixOS config enforces secure-by-design principles. Git history documents the complete lifecycle | Weaver+ | v1.0 |
| **IEC 62443 — FR 1** (Identification & Authentication Control) | Authenticate all users, processes, and devices accessing IACS | Per-VM RBAC (v1.0), SSO/SAML/LDAP integration (v1.2+) — identity enforcement at every VM boundary | Fabrick | v1.0 (RBAC), v1.2+ (SSO/LDAP) |
| **IEC 62443 — FR 2** (Use Control) | Enforce authorization and least privilege | Per-VM role assignments restrict access to specific OT workloads; role granularity separates operator/engineer/admin | Fabrick | v1.0 |
| **IEC 62443 — FR 3** (System Integrity) | Ensure integrity of IACS components; detect unauthorized changes | Zero drift = integrity by construction. NixOS declarative model means unauthorized changes are impossible without a commit | Weaver+ | v1.0 |
| **IEC 62443 — FR 7** (Resource Availability) | Ensure system availability for critical operations | Sub-second VM boot (Firecracker <125ms) for rapid recovery. Resource quotas prevent cross-workload interference | Weaver+ | v1.0 |
| **NIST Cybersecurity Framework 2.0** — Identify | Asset management, risk assessment, supply chain risk | Declarative config IS the asset inventory. Every VM, bridge, and resource is declared in code — nothing is implicit | Weaver+ | v1.0 |
| **NIST CSF 2.0** — Protect | Access control, data security, platform security, technology infrastructure resilience | Managed bridges for segmentation, per-VM RBAC for access control, AppArmor/Seccomp for hardening, NixOS for infrastructure resilience | Weaver+ | v1.0 (bridges/RBAC), v1.2 (hardening) |
| **NIST CSF 2.0** — Detect | Continuous monitoring, adverse event analysis | AI diagnostics identify anomalies in natural language. Declarative audit log captures every system change with attribution | Weaver+ | v1.0 |
| **NIST CSF 2.0** — Respond | Incident management, analysis, mitigation | AI-powered triage accelerates root cause analysis. Declarative baselines enable rapid forensic comparison — you know exactly what the system should look like | Weaver+ | v1.0 |
| **NIST CSF 2.0** — Recover | Recovery planning, execution | Sub-second VM boot from declarative config. Recovery is deterministic — rebuild produces identical systems every time | Weaver+ | v1.0 |
| **ISO 27001 / ISO 27002** — Information Security Management | Annex A controls: access, asset mgmt, operations security, communications security, compliance | Per-VM RBAC (A.9), declarative audit log (A.12), managed bridges (A.13), zero drift (A.12.5), self-hosted (A.11) | Fabrick | v1.0 |
| **ISO 27001 — A.8** (Asset Management) | Inventory of assets, acceptable use, classification | Every VM and resource declared in NixOS config — asset inventory is the codebase. Classification via RBAC and bridge isolation | Weaver+ | v1.0 |
| **ISO 27001 — A.12** (Operations Security) | Change management, capacity mgmt, logging & monitoring | Every change is a git commit (A.12.1.2). Resource quotas manage capacity (A.12.1.3). Declarative audit log (A.12.4) | Fabrick | v1.0 |
| **NERC CIP** (Energy/Utilities — adjacent) | Critical cyber asset identification, security perimeters, configuration change management | Managed bridges define Electronic Security Perimeters. Zero-drift config satisfies CIP-010 (configuration change management). Applicable to manufacturers with energy/utility customers | Fabrick | v1.0 |
| **FDA 21 CFR Part 820** (Medical Device Manufacturers) | Quality system regulation, design controls, device history records | Declarative config provides reproducible build environments for device firmware/software. Git history satisfies design history file (DHF) requirements for infrastructure | Weaver+ | v1.0 |
| **EU NIS2 Directive** | Risk management measures, incident reporting, supply chain security for essential/important entities | Zero drift reduces risk surface. AI diagnostics accelerate incident detection and reporting. Single-vendor infrastructure reduces supply chain exposure | Weaver+ | v1.0 |
| **EU Cyber Resilience Act** (upcoming) | Cybersecurity requirements for products with digital elements; vulnerability handling | Declarative model ensures infrastructure supporting product development is reproducible and auditable. NixOS patching applies fleet-wide | Weaver+ | v1.0 |
| **C-TPAT** — Customs-Trade Partnership Against Terrorism | Supply chain security, IT security best practices for customs partners | Self-hosted — no cloud dependencies for sensitive manufacturing data. RBAC restricts access to supply chain systems. Network segmentation isolates customs-related workloads | Fabrick | v1.0 |
| **CMMC** (Defense Supply Chain) | When manufacturing for DoD — same NIST 800-171 requirements as defense contractors | Full CMMC support — see [defense-contractor.md](defense-contractor.md) for detailed 800-171 control mapping | Fabrick | v1.0 |

### Indirect Compliance Support

| Manufacturing Function | IT/OT Pain Today | How Weaver Helps |
|----------------------|-----------------|----------------------------|
| **IT/OT Zone Architecture** | Zones defined by VLANs and firewalls configured manually — drift between declared and actual boundaries | Managed bridges declaratively define zone boundaries. The code IS the architecture diagram — always current, always enforced |
| **Multi-Plant Consistency** | Each plant has slightly different infrastructure config — "works here, breaks there" | Declarative config guarantees identical environments. Clone a plant's VM fleet to a new facility from the same config |
| **Legacy System Isolation** | Unpatched SCADA/HMI systems connected directly to fabrick networks | Isolate legacy systems in dedicated bridge segments with explicit, auditable communication paths — no implicit connectivity |
| **Audit Evidence for Customer Requirements** | Weeks of evidence collection across multiple plants for OEM/customer security audits | Config-as-code is the evidence. Customer audit response becomes "here's the git repo for this plant" |
| **Edge Compute Management** | Remote sites run independently with no centralized management — configuration varies per site | Hub-agent architecture (v2.0+) manages all sites from one dashboard. Offline-first license works at sites with limited connectivity |
| **Change Control for 24/7 Operations** | Changes must be documented and reversible; production cannot stop | Every change is a git commit with author/timestamp/reason. Rollback is one command. Zero-drift means no undocumented changes accumulate |

---

## 3. Weaver for Manufacturing {#3-weaver-for-manufacturing}

**Target:** Single-plant manufacturers, small OEMs, contract manufacturers, manufacturing IT teams managing <50 VMs, edge computing deployments

**Price:**
- **Weaver Solo:** $149/yr (FM, first 200) (single admin, local host only, up to 128GB RAM)
- **Weaver Team:** $129/user/yr (FM, first 50 teams) — 2–4 users + 1 viewer free, up to 2 remote peer Weaver hosts (full management, v2.2.0)

**The pitch:** "Your production line runs 24/7. When a VM fails at 2 AM, do you want to SSH in and rebuild from memory, or click 'recover' and be back in production in under a second? Weaver gives you sub-second recovery, zero-drift configs, and AI diagnostics for less than the cost of one hour of production downtime."

### Key Weaver Wins for Manufacturing

| Capability | Manufacturing Value |
|-----------|-------------------|
| **Live Provisioning** | Spin up new VMs for production monitoring, edge analytics, or quality systems without SSH + rebuild cycles. New production line? VMs ready in minutes |
| **Zero Configuration Drift** | Production VM configs never change unless explicitly declared — critical for 24/7 operations where undocumented changes cause unplanned downtime |
| **AI Diagnostics** | When a production-supporting VM fails during a shift, natural language diagnosis reduces MTTR. OT staff who aren't VM experts can understand what went wrong |
| **Managed Bridges + IP Pools** | Declarative IT/OT zone segmentation — isolate SCADA/HMI networks from enterprise IT. Foundation for IEC 62443 zone/conduit architecture |
| **Sub-Second VM Boot** | Production-critical VMs recover in <125ms (Firecracker). Recovery happens faster than most monitoring systems detect the failure. Downtime measured in milliseconds, not minutes |
| **Multi-Hypervisor** | Run security-sensitive OT monitoring on Firecracker (minimal attack surface), general IT workloads on QEMU — one dashboard, one policy, right tool per workload |
| **Offline-First License** | HMAC validation, no phone-home. Works in factories with air-gapped production networks, limited internet, or strict egress policies |

### ROI for a Single-Plant Manufacturer (5 Nodes)

| Current Cost | With Weaver |
|-------------|----------------------|
| Proxmox: EUR355/socket x 5 = **EUR1,775/yr** | 5 nodes x $149 = **$745/yr** (Solo) or 5 nodes x $129/user = **$645/yr** (Team, 1 user) |
| 1 IT admin spending 8 hrs/week on VM management at $65/hr = **$27,040/yr** | Reclaim 5 hrs/week = **$16,900/yr freed** for OT security and compliance |
| Unplanned downtime (2 incidents/yr x 4 hrs x $5,000/hr production loss) = **$40,000/yr** | Sub-second recovery eliminates most downtime. Estimated reduction: 90% = **$36,000/yr saved** |
| Configuration drift investigation after production incidents = **$5,000–10,000/yr** | $0 — drift is impossible by construction |
| **Total current cost: ~$73,815–78,815/yr** | **Weaver: $745/yr (Solo) + $52,900 in labor freed and downtime avoided** |

### Weaver Team for Manufacturing

**Target:** Small manufacturers with an IT host and an OT monitoring host, or a primary plant and a secondary facility, where the IT team needs visibility into both environments without a full Fabrick deployment.

**Ships:** v2.2.0 — 2–4 users + 1 viewer free, up to 2 remote peer Weaver hosts (full management in the existing Weaver view; host badge on workload cards). Tailscale MagicDNS peer discovery + manual IP entry. Each host independently licensed at $129/user/yr (FM).

**Manufacturing use case:** A small manufacturer with an IT host and an OT monitoring host. Weaver Team lets the IT team manage OT-side workloads from their Weaver view without requiring a full Fabrick deployment — is the SCADA interface VM running? Is the historian VM consuming expected resources? Restart or provision directly from the primary view. Tailscale provides a secure IT/OT tunnel without exposing the OT network directly. The 2-peer cap covers the IT host and the OT monitoring host, plus one more (for example, an edge analytics node). Full management at Weaver Team — the IT team can observe and manage OT workload state directly.

**IEC 62443 note:** Weaver Team provides full management of up to 2 remote peers. Fleet-scale governance beyond 2 peers, per-VM RBAC, and the declarative audit log needed for IEC 62443 FR 1/FR 2/FR 6 compliance gate on Fabrick.

**Upgrade trigger:** When the team needs more than 2 remote peers, fleet-scale per-VM RBAC, or a centralized audit trail for customer security assessments, Fabrick is the next step.

---

## 4. Fabrick for Manufacturing {#4-fabrick-for-manufacturing}

**Target:** Multi-plant manufacturers, OEMs with customer compliance requirements, medical device manufacturers, defense supply chain manufacturers, manufacturers pursuing ISO 27001 certification, organizations with IT/OT convergence mandates

**Price:** $2,000/yr first node + $750/yr additional + $500/yr at 10+ nodes (up to 256GB RAM)

**The pitch:** "Your customers audit your IT security. Your insurer asks about your cyber posture. ISO 27001 certification requires evidence for 114 controls. Weaver makes your infrastructure self-documenting — every change, every access, every configuration is a git commit. Hand your auditor a repo instead of a binder."

### Fabrick Features Mapped to Manufacturing Obligations

| Fabrick Feature | Manufacturing Regulation / Requirement | Evidence Produced | Available |
|-------------------|---------------------------------------|-------------------|:---------:|
| **Per-VM RBAC** | IEC 62443 FR 1/FR 2 — identification, authentication, use control; ISO 27001 A.9 — access control | Role assignments per VM with enforcement logs; IT staff see IT VMs, OT engineers see OT VMs, no cross-domain bleed | v1.0 |
| **SSO/SAML/LDAP** | ISO 27001 A.9.2 — user access management; IEC 62443 FR 1 | Integration with Active Directory — single identity source across IT and OT management | v1.2+ |
| **Declarative Audit Log** | ISO 27001 A.12.4 — logging and monitoring; IEC 62443 FR 6 (Timely Response to Events) | Git commit history: who, what, when, why — tamper-evident, immutable. Customer auditors see every infrastructure change | v1.0 |
| **Bulk VM Operations** | ISO 27001 A.12.1.2 — change management; IEC 62443 — configuration management | Fleet-wide policy changes applied atomically — update all production monitoring VMs in one operation | v1.0 |
| **Resource Quotas** | IEC 62443 FR 7 — resource availability | Resource limits prevent one workload from starving production-critical VMs. Capacity management is declarative | v1.0 |
| **All Plugins Included** | IEC 62443 FR 5 — restricted data flow; NIST CSF Protect | Firewall (nftables), DNS, AppArmor/Seccomp, kernel hardening — complete security stack for IT/OT segmentation | v1.0 (DNS v1.1, firewall/hardening v1.2) |
| **Managed Bridges** | IEC 62443 zones and conduits; ISO 27001 A.13 — communications security | Declarative network segmentation defines IT/OT zone boundaries. Every conduit between zones is explicit, auditable, and version-controlled | v1.0 (bridges), v1.2 (firewall deny-by-default) |

### Fabrick Success Programs for Manufacturing

| Program | Manufacturing Application | FM Price | Standard Price | Response SLA |
|---------|--------------------------|:--------:|:--------------:|:------------:|
| Community | Forum + GitHub Issues | $0 | $0 | Best effort |
| **Adopt** | NixOS onboarding for plant IT/OT teams; IEC 62443 zone/conduit architecture review; IT/OT bridge design for existing plant networks | $5,000/yr | $15,000/yr | 24h business days |
| **Adopt — Compliance** | Hands-on IEC 62443 / ISO 27001 compliance evidence delivery; framework mapping, evidence walkthroughs, ATO documentation | — | $25,000/yr | 24h business days |
| **Accelerate** | Quarterly fleet reviews mapped to IEC 62443 and ISO 27001 controls; multi-plant configuration consistency audits; customer audit preparation support; OT isolation architecture optimization | $15,000/yr | $45,000/yr | 4h (24/7) |
| **Partner** | Named engineer with manufacturing IT/OT experience; priority features for manufacturing-specific needs (SCADA isolation templates, OPC UA gateway patterns, edge deployment playbooks); ISO 27001 evidence package support; multi-plant fleet architecture planning | $30,000/yr | $90,000/yr | 1h (24/7) |

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = **$9,000/yr** total compliance coverage during FM period. Standard Adopt — Compliance ($25,000/yr) includes hands-on IEC 62443 / ISO 27001 evidence delivery sessions that the extension alone does not provide.

### ROI for a Multi-Plant Manufacturer (5 Plants, 40 Nodes)

| Cost Category | Current State | With Fabrick |
|-------------|--------------|----------------------------------|
| Infrastructure software | VMware: $20,000–60,000/yr across plants | 40 nodes: $23,500/yr |
| IT/OT staff time on infrastructure (3 FTEs across plants, 30% on VM management) | $78,000/yr | Reclaim 20 hrs/week across team = $50,700/yr redirected to OT security |
| Unplanned downtime (5 plants x 3 incidents/yr x 2 hrs x $10,000/hr) | $300,000/yr | Sub-second recovery reduces to <$30,000/yr |
| Customer security audit preparation | 4 weeks/yr across compliance team = $30,000 | < 1 week — config-as-code is the evidence |
| Configuration management tools (per-plant) | $10,000–25,000/yr | $0 — drift impossible by construction |
| Success program | N/A | Accelerate: $15,000/yr |
| **Total** | **$438,000–493,000/yr** | **$38,500/yr + $350,000+ in redirected labor and avoided downtime** |

---

## 5. Deficiency Remediation Plan {#5-deficiency-remediation-plan}

Most manufacturers pursuing IEC 62443 compliance or ISO 27001 certification discover significant gaps in their IT/OT infrastructure controls. These gaps often trace to infrastructure tooling that doesn't enforce policy, produce evidence, or maintain baselines across IT and OT domains. Weaver closes these gaps — starting with the fastest wins at Weaver.

### The Sales Motion: Close Audit Findings to Justify the Purchase

Every unaddressed IEC 62443 or ISO 27001 finding is a risk: failed customer audits, delayed certifications, insurance premium increases, and supply chain disqualification. Frame Weaver as a compliance remediation tool, not just an infrastructure platform. Each closed finding strengthens the manufacturer's position with customers, insurers, and certification bodies.

### Phase 1: Quick Wins at Weaver ($149/yr (FM) per node)

These controls are satisfied or substantially improved upon deploying Weaver. Items marked **v1.0** are available today.

| Standard / Control | Requirement | How Weaver Closes It | Audit Impact | Available |
|-------------------|------------|----------------------|:------------:|:---------:|
| **IEC 62443 FR 3** — System Integrity | Ensure integrity of IACS components and communications | NixOS declarative config IS the integrity baseline. Running state = declared state. Unauthorized changes are impossible without a commit | Closes finding | **v1.0** |
| **IEC 62443 FR 7** — Resource Availability | Ensure IACS availability for time-critical processes | Sub-second VM boot (Firecracker <125ms). Resource quotas prevent cross-workload interference. Production VMs recover before operators notice | Closes finding | **v1.0** |
| **ISO 27001 A.12.1.2** — Change Management | Controlled changes to organization, business processes, systems | Every change is a git commit — who, what, when, why. No unauthorized or undocumented changes possible | Closes finding | **v1.0** |
| **ISO 27001 A.12.5** — Control of Operational Software | Procedures for installation of software on operational systems | NixOS only runs declared software. Nothing is installed implicitly. New software requires a commit and review | Closes finding | **v1.0** |
| **NIST CSF ID.AM** — Asset Management | Identify and manage assets within the organization | Declarative config IS the asset inventory — every VM, bridge, IP pool, and resource is declared in code | Closes finding | **v1.0** |
| **NIST CSF PR.IP** — Information Protection Processes | Maintain configuration baselines for systems | Zero-drift NixOS = baseline by construction. No scanning needed — the declared config IS the running config | Closes finding | **v1.0** |
| **NIST CSF PR.PT** — Protective Technology | Network segmentation, resilience requirements | Managed bridges (v1.0) create declarative zone segmentation. nftables firewall (v1.1) adds explicit boundary rules | Substantially improves | v1.0 (bridges), v1.1 (firewall) |
| **NIST CSF DE.CM** — Continuous Monitoring | Monitor systems and assets to identify cybersecurity events | AI diagnostics flag anomalies in natural language. Declarative model means any deviation from expected state is detectable | Substantially improves | **v1.0** |
| **NIST CSF RS.AN** — Analysis | Investigate and understand detected cybersecurity events | AI-powered triage accelerates root cause analysis. Declarative baselines enable rapid forensic comparison | Substantially improves | **v1.0** |
| **NIST CSF RC.RP** — Recovery Planning | Execute recovery processes and procedures | Sub-second VM boot from declarative config. Recovery is deterministic and tested — rebuild produces identical systems every time | Closes finding | **v1.0** |

**Audit Impact:** Deploying Weaver addresses the most common ISO 27001 non-conformities (change management, configuration management, asset management) and IEC 62443 foundational requirements (integrity, availability). These are typically the findings that delay certification timelines by months.

### Phase 2: Fabrick Upgrades That Close Access and Audit Controls

These controls require Fabrick features (RBAC, LDAP, audit governance). Position the Fabrick upgrade as "closing the access control and audit findings" — the Weaver deployment already proved the platform.

| Standard / Control | Requirement | How Fabrick Closes It | Audit Impact | Available |
|-------------------|------------|-------------------------|:------------:|:---------:|
| **IEC 62443 FR 1** — Identification & Authentication | Authenticate all human users, software processes, and devices | Per-VM RBAC with role enforcement at every VM boundary. SSO/SAML/LDAP ties to organizational directory (v1.2+) | Closes finding | v1.0 (RBAC), v1.2+ (SSO/LDAP) |
| **IEC 62443 FR 2** — Use Control | Enforce authorized use of IACS components | Role-based permissions restrict what each user can do per VM — OT operators get operator access, IT admins get admin access, no cross-domain escalation | Closes finding | **v1.0** |
| **IEC 62443 FR 5** — Restricted Data Flow | Segment network to restrict data flow between zones | Managed bridges + declarative firewall (v1.2) implement zone/conduit model. Deny-by-default policy — only explicitly declared traffic crosses zone boundaries | Closes finding | v1.0 (bridges), v1.2 (deny-by-default) |
| **IEC 62443 FR 6** — Timely Response to Events | Log and respond to security events | Declarative audit log captures every change with attribution. AI diagnostics accelerate event analysis and response | Closes finding | **v1.0** |
| **ISO 27001 A.9.1** — Access Control Policy | Define and enforce access control policy | Per-VM RBAC enforces access policy at granular level — not just network-level but workload-level | Closes finding | **v1.0** |
| **ISO 27001 A.9.2** — User Access Management | User registration, de-provisioning, privilege management | SSO/SAML/LDAP integration ensures user lifecycle managed from organizational directory — deprovisioning is automatic | Closes fully | v1.0 (local users), **v1.2+** (SSO/LDAP) |
| **ISO 27001 A.12.4** — Logging and Monitoring | Event logging, protection of log information, admin/operator logs | Git-based audit log: tamper-evident, immutable, attributable to individuals. Admin and operator actions fully separated by RBAC | Closes finding | **v1.0** |
| **ISO 27001 A.13.1** — Network Security Management | Network controls, segmentation, segregation in networks | Managed bridges with IP pools create declarative network segmentation. Zone boundaries are code, not manual VLAN configuration | Closes finding | **v1.0** |
| **ISO 27001 A.18.1** — Compliance with Legal/Regulatory | Identify applicable legislation and contractual requirements | Single infrastructure platform with declarative controls simplifies compliance mapping. Evidence is generated automatically, not manually | Substantially improves | **v1.0** |

**Audit Impact:** Fabrick features close the high-value IEC 62443 Foundational Requirements (FR 1, FR 2, FR 5, FR 6) and ISO 27001 access control and logging families — the areas where most manufacturers have the deepest gaps due to the IT/OT divide.

### Phase 3: Success Programs That Close Architecture and Process Controls

Some IEC 62443 and ISO 27001 requirements are architecture- and process-oriented — they require documented zone models, risk assessments, and operational procedures. The Fabrick success programs help manufacturers close these.

| Standard / Control | Requirement | How Success Programs Help | Program |
|-------------------|------------|--------------------------|:-------:|
| **IEC 62443 — Zone/Conduit Model** | Documented zone and conduit architecture for IACS | Adopt program includes IEC 62443 zone/conduit architecture review mapped to managed bridge topology. Accelerate validates quarterly | Adopt / Accelerate |
| **ISO 27001 A.12.1.1** — Documented Operating Procedures | Operating procedures documented and available | Accelerate program maps Weaver declarative configs to operational procedure requirements; generates documentation artifacts | Accelerate |
| **NIST CSF GV.RM** — Risk Management Strategy | Organizational risk management strategy and priorities | Quarterly fleet reviews in Accelerate assess risk posture across IT and OT domains; prioritize remediation | Accelerate |
| **IEC 62443 — Security Level Assessment** | Determine required security levels per zone | Partner program includes per-zone security level assessment mapped to Weaver capabilities and configuration | Partner |
| **ISO 27001 — Management Review** | Periodic management review of ISMS effectiveness | Partner program includes annual management review support — fleet state, control effectiveness, improvement recommendations | Partner |
| **Multi-Plant Standardization** | Consistent security posture across all manufacturing sites | Partner program architects fleet templates for multi-plant deployment; ensures identical security baselines at every facility | Partner |

### The Full Remediation Path: Weaver to Fabrick to Partner

| Stage | Investment | Timeline | Compliance Impact | Findings Addressed | Version Required |
|-------|-----------|----------|:-----------------:|:------------------:|:----------------:|
| **Weaver deployment** | $149–5,960/yr (1–40 nodes) | Month 1–2 | Configuration, integrity, availability controls closed | IEC 62443 FR 3/FR 7, ISO 27001 A.12, NIST CSF core functions | **v1.0 today** |
| **Fabrick upgrade** | $23,500/yr (40 nodes) | Month 3–4 | Access control, audit, segmentation controls closed | IEC 62443 FR 1/FR 2/FR 6, ISO 27001 A.9/A.12.4/A.13 | **v1.0 today** |
| **v1.1 firewall plugins** | Included in tier | With v1.1 release | Network protection strengthened | Declarative nftables firewall for zone boundary enforcement | v1.1 |
| **v1.2 security plugins** | Included in Fabrick | With v1.2 release | Identity and hardening controls closed | SSO/LDAP (FR 1 full), deny-by-default firewall (FR 5 full), AppArmor/Seccomp | v1.2 |
| **Accelerate program** | $15,000/yr | Month 4–6 | Architecture and process controls | Zone/conduit documentation, risk assessment, operational procedures | Service — any version |
| **Partner program** | $30,000/yr | Ongoing | Multi-plant consistency, management review | Security level assessment, fleet standardization, annual review support | Service — any version |
| **Cumulative (v1.0 today)** | | **Immediate** | **Core IEC 62443 FRs + ISO 27001 Annex A controls** | **20+ controls with direct evidence** | **Available now** |
| **Cumulative (through v1.2)** | | **~6 months** | **Comprehensive IEC 62443 + ISO 27001 coverage** | **35+ controls with direct evidence** | v1.2 release |

**What's available today (v1.0):** A manufacturer deploying Weaver + Fabrick right now closes 20+ IEC 62443 and ISO 27001 controls — enough to pass most customer security audits and significantly accelerate ISO 27001 certification.

**What v1.2 completes:** SSO/LDAP, declarative firewall with deny-by-default, and hardening plugins close the remaining identity, boundary, and platform security controls, enabling full IEC 62443 SL-2 compliance and comprehensive ISO 27001 Annex A coverage.

### Positioning the Conversation

**Discovery opener:** "When was your last customer security audit, and how many findings were infrastructure-related?"

**The bridge:** Every unresolved finding is a risk — delayed certifications, insurance scrutiny, customer disqualification. Weaver doesn't just manage your VMs — it closes audit findings. Start with Weaver this month, close the configuration and availability findings immediately, and build toward full IEC 62443 compliance.

**The close:** "At $149 per node, Weaver pays for itself if it prevents one hour of unplanned production downtime. Most manufacturers prevent several incidents in the first quarter."

---

## 6. Manufacturing-Specific Competitive Advantages {#6-competitive-advantages}

### vs VMware (Post-Broadcom)

| Factor | VMware | Weaver |
|--------|--------|-------------------|
| Cost (5-plant manufacturer, 40 nodes) | $20,000–60,000/yr (subscription-only post-Broadcom) | $23,500/yr (40 nodes) |
| IT/OT zone segmentation | Manual VLAN/firewall configuration per plant | Declarative managed bridges — zone architecture is code, identical across all plants |
| Configuration drift | Possible and common; requires periodic scanning | Impossible by construction (NixOS declarative model) |
| Offline / air-gap support | Requires connectivity for licensing | Offline-first HMAC license, no phone-home — works in air-gapped production networks |
| Recovery time | Minutes to hours depending on configuration complexity | Sub-second (Firecracker <125ms) — recovery before production impact |
| Multi-plant consistency | Requires manual synchronization or expensive management layers | Declarative config guarantees identical environments across all sites |
| Vendor lock-in | High — Broadcom controls pricing unilaterally | Open core, offline-first license, no phone-home |

### vs Proxmox

| Factor | Proxmox | Weaver |
|--------|---------|-------------------|
| IT/OT zone architecture | Manual network config per cluster | Declarative bridge isolation — zone/conduit model as code |
| Per-VM RBAC | Pool-level permissions only | Per-VM role assignments — IT staff and OT engineers see only their domains |
| Zero drift | No — imperative management allows drift on 24/7 production systems | Yes — declarative by construction; production configs never change silently |
| Audit evidence | API call logs — captures actions, not intent | Git diffs — captures what changed, who approved, and why |
| Recovery speed | Minutes (depends on configuration) | Sub-second — Firecracker <125ms boot |
| Offline operation | Community edition works offline; fabrick requires subscription check | Offline-first by design — HMAC license validation, no external dependency |

### vs Cloud (AWS / Azure IoT + Cloud VMs)

| Factor | Cloud | Weaver |
|--------|-------|-------------------|
| Production data location | Cloud regions — data leaves the plant | **On your premises** — production data never leaves the facility |
| Connectivity dependency | Requires internet — factory outage = management outage | Offline-first — manages plant infrastructure even with zero connectivity |
| Cost per VM | $600–6,000+/yr per VM | Unlimited VMs per node ($149–1,500/yr per node) |
| Latency for OT monitoring | Network round-trip to cloud | Local — sub-millisecond to production systems |
| Air-gap capability | No — cloud requires connectivity by definition | Yes — offline-first license, no phone-home required |
| Multi-plant management | Per-region deployment and management | Hub-agent architecture (v2.0+) — one dashboard, all plants |

### The Offline-First Advantage

Manufacturing environments frequently require air-gapped or semi-air-gapped production networks. Weaver's offline-first license validation (HMAC checksum, no phone-home) is purpose-built for disconnected environments. No competitor offers this without custom fabrick negotiation. For factories where production networks have no internet access — by policy, by geography, or by regulation — this is a fundamental requirement that Weaver satisfies out of the box.

### The Zero-Drift Production Advantage

In manufacturing, configuration drift is not just an audit finding — it is a production risk. A VM that silently changed configuration can cause unexpected behavior in production monitoring, quality systems, or SCADA interfaces. NixOS's declarative model eliminates this category of risk entirely. The configuration you declared is the configuration that runs. Period. For 24/7/365 operations where stability is worth thousands of dollars per minute, this guarantee is transformative.

#### Kubernetes Complexity in Manufacturing

OT environments need air-gapped, deterministic infrastructure with zero tolerance for unexpected behavior. Kubernetes was designed for cloud-connected environments — its control plane requires network connectivity to etcd, API server, and container registries. Running K8s offline is painful, fragile, and unsupported by most vendors. For factories where the production network has no internet access by policy, geography, or regulation, K8s is architecturally incompatible with the operating environment.

| K8s Overhead | Impact in Manufacturing | Weaver Alternative |
|---|---|---|
| K8s control plane requires network connectivity | Air-gapped production networks cannot run etcd cluster sync, container image pulls, or API server communication; offline K8s requires custom registry mirrors and manual certificate management | NixOS + Weaver works fully offline; flake inputs are pinned and cacheable; HMAC license validation has no external dependency; zero internet required at runtime |
| Non-deterministic pod scheduling on OT-adjacent systems | SCADA interfaces and historian VMs need predictable placement and resource allocation; K8s scheduler decisions change with cluster state, risking production impact | MicroVMs boot in <125ms with deterministic resource allocation; declarative config guarantees the same workload runs the same way every time |
| K8s upgrade complexity in 24/7 production environments | Rolling K8s upgrades risk node drain failures and pod disruption in environments where downtime costs thousands per minute; upgrade windows are scarce on production lines | NixOS atomic upgrades with instant rollback; no rolling node drains; configuration change = git commit → apply; rollback = revert commit |

Full competitive reference: [KUBERNETES-COMPETITIVE-POSITIONING.md](../KUBERNETES-COMPETITIVE-POSITIONING.md)

---

## 7. Objection Handling {#7-objection-handling}

### "Our OT team doesn't know NixOS"

They don't need to. Weaver provides a web UI for day-to-day operations — starting VMs, monitoring resources, viewing diagnostics. NixOS runs underneath, ensuring zero drift and reproducibility. Your IT team manages the NixOS declarations; your OT team uses the dashboard. The Adopt success program ($5,000/yr) includes onboarding for both IT and OT staff, tailored to their respective workflows.

### "We can't risk downtime on a new platform during production"

Start with non-production workloads — development environments, monitoring infrastructure, quality system test instances. Prove the platform on systems outside the production boundary. With sub-second VM boot and declarative rollback, the risk profile is actually lower than your current infrastructure. Our migration services ($5,000–20,000) run in parallel with existing deployments — zero production disruption.

### "We need something our ISO auditor recognizes"

ISO auditors audit controls, not platforms. ISO 27001 Annex A requires access control, change management, logging, and network security — Weaver makes these controls self-evidencing. Show your auditor a git log of every infrastructure change with full attribution. That is stronger evidence than any manual change management process produces.

### "Our plants have no internet — how do we get updates?"

Offline-first license means no connectivity required for operation. For updates, NixOS supports offline package deployment — download the update on a connected system, transfer via approved media, apply at the plant. The declarative model ensures the update produces identical results at every plant. The Partner success program includes guidance on air-gapped update workflows.

### "We already have separate tools for IT and OT"

That is the problem. Separate tools mean separate processes, separate audit trails, separate configuration management, and gaps at the boundaries. IT/OT convergence means the boundary between these domains is a security-critical zone that needs unified visibility. Weaver provides one management plane with RBAC-enforced domain separation — IT staff and OT engineers use the same dashboard but see only their authorized systems.

### "Our customer requires CMMC compliance for defense manufacturing"

Weaver has comprehensive CMMC/NIST 800-171 support. See our [defense contractor sales case](defense-contractor.md) for the full 110-control mapping. The short version: declarative config satisfies configuration management controls, per-VM RBAC satisfies access controls, and git-based audit logs satisfy accountability controls. Start with the manufacturing deployment and extend to cover CUI workloads.

### "What about multi-site management? Each plant runs independently today"

Hub-agent multi-node architecture (v2.0+) manages all plants from one dashboard while each plant operates independently when disconnected. This matches the manufacturing reality: centralized policy, local execution. Until v2.0, each plant runs its own Weaver instance with identical declarative configurations — clone the config to add a plant.

### "Our ISO 27001 certification requires supplier security assessments for critical infrastructure tools"

ISO 27001 Annex A.15 (supplier relationships) requires documented assessment of vendors supplying tools to managed systems. Weaver's supplier assessment package: published testing benchmark scored A/A+ against fabrick standards (`docs/TESTING-ASSESSMENT.md`), CVD policy with 48-hour acknowledgment and 7-day critical fix SLAs (`SECURITY.md`), and documented DR procedures (`docs/setup/DISASTER-RECOVERY.md`). The open-core codebase is auditable. Release process includes a legal review gate and insurance carrier touchpoint before shipping features that change the product's operational footprint. For ISO 27001 auditors, these documents fulfill Annex A.15.2 (supplier service delivery monitoring) — the vendor's security posture is observable, not self-asserted.

---

## 8. Buyer Personas {#8-buyer-personas}

### Plant IT/OT Manager

**Cares about:** Bridge between corporate IT mandates and factory floor reality; uptime above all; keeping both IT and OT teams productive; managing with limited staff and budget
**Lead with:** One dashboard for both IT and OT workloads — but RBAC-separated so each team sees their domain. Sub-second recovery prevents production impact. AI diagnostics help the 2 AM call. Offline-first works even when the plant has connectivity issues.
**Tier:** Weaver (single plant) or Fabrick (multi-plant / customer compliance requirements)

### Manufacturing CISO / Director of Cybersecurity

**Cares about:** IT/OT convergence risk; IEC 62443 compliance; customer audit readiness; supply chain security requirements; insurance cyber posture assessments
**Lead with:** Managed bridges implement IEC 62443 zone/conduit architecture declaratively. Zero drift eliminates configuration-related findings. Git-based audit trail satisfies ISO 27001 A.12.4 by construction. Self-hosted = no cloud supply chain concerns. Offline-first for air-gapped production networks.
**Tier:** Fabrick + Accelerate or Partner

### VP of Operations

**Cares about:** Uptime. Uptime. Uptime. Production throughput. Cost per unit. Anything that threatens production schedules.
**Lead with:** Sub-second VM recovery means production-critical systems recover before operators notice the failure. Zero-drift means production VM configs never change silently — the configuration you tested is the configuration that runs. Downtime cost savings alone justify the investment 10x over.
**Tier:** Fabrick (they sign the PO when shown the downtime math)

### Quality / Compliance Manager

**Cares about:** ISO 27001 certification; customer security audits; IEC 62443 assessments; FDA 21 CFR Part 820 (medical device manufacturers); documentation burden
**Lead with:** Declarative config means audit evidence is always current — not a snapshot that drifts. Git history provides control implementation evidence with timestamps. 20+ ISO 27001 Annex A controls have self-evidencing artifacts. Customer audit prep drops from weeks to days.
**Tier:** Fabrick (they champion the purchase for certification timelines)

### Edge Computing / IIoT Architect

**Cares about:** Deploying compute at the edge close to production lines; managing distributed infrastructure across sites; container and VM workloads for analytics; connectivity challenges at remote plants
**Lead with:** Live Provisioning deploys VMs to edge nodes without SSH and rebuild cycles. Offline-first license works at sites with limited connectivity. Declarative config guarantees every edge node runs identical workloads. Hub-agent architecture (v2.0+) provides centralized management with local autonomy. 5 hypervisors — run Firecracker for lightweight edge workloads, QEMU for full VMs.
**Tier:** Weaver (edge nodes) + Fabrick (central management)

---

## 9. Discovery Questions {#9-discovery-questions}

Use these to qualify manufacturing prospects and identify pain:

### Infrastructure Pain
- How do you currently provision VMs at each plant? Is the process the same everywhere?
- When was the last time a production-supporting VM failed? How long did recovery take?
- How many separate infrastructure tools do your IT and OT teams use?
- How do you manage configuration consistency across multiple plant sites?
- Do any of your production networks require air-gapped or limited-connectivity operation?

### IT/OT Convergence Pain
- How are your IT and OT networks segmented today? Manual VLANs, firewalls, or physical separation?
- Do your IT and OT teams use the same infrastructure management tools?
- How do you monitor legacy OT systems (PLCs, HMIs, SCADA) that are connected to the network but cannot be patched?
- Who is responsible for the boundary between IT and OT — IT team, OT team, or neither?
- Have you experienced a security incident that crossed the IT/OT boundary?

### Compliance Pain
- Are you pursuing ISO 27001 certification? What is your timeline?
- How do your customers audit your IT security? How frequently?
- How long does your team spend preparing evidence for customer security audits?
- Do you manufacture for defense customers? If so, are you subject to CMMC requirements?
- How do you currently document infrastructure changes for audit purposes?

### Budget Pain
- What are you paying annually for VMware/Proxmox licensing across all plants?
- How much of your IT staff time goes to infrastructure management vs security improvement?
- Have your VMware costs changed since the Broadcom acquisition?
- What is the cost per hour of unplanned production downtime at your facilities?
- How many tools would Weaver replace if it managed both IT and OT infrastructure?

### Strategic Pain
- Is IT/OT convergence on your roadmap? How are you planning the architecture?
- Do you have supply chain security requirements flowing down from your customers?
- Are you a VMware shop considering alternatives after the Broadcom pricing changes?
- How do you plan to manage edge compute as IIoT deployments grow?
- Are you expanding to new plant sites? How do you replicate infrastructure at new facilities?

---

*This document complements the universal value proposition in [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md). For pricing details, see [TIER-MANAGEMENT.md](../../product/TIER-MANAGEMENT.md). For Fabrick justification, see [FABRICK-VALUE-PROPOSITION.md](../../marketing/FABRICK-VALUE-PROPOSITION.md). For defense supply chain requirements, see [defense-contractor.md](defense-contractor.md).*

---

## Recent Changes

- **2026-03-18** — Fabrick pricing revised to $2,000/yr first node, $750/yr additional, $500/yr at 10+. Fabrick tier added at $2,500/yr (512GB RAM). Contract tier added for 512GB+ deployments (sliding scale per 512GB block). RAM coverage noted per tier. Parallel migration / no-expertise-required positioning added as primary lead.
