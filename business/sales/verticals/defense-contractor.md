<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Defense Contractor IT Sales Case
## How Weaver Eliminates Infrastructure Burden for Defense Organizations
*DoD Contractors, Subcontractors & Organizations Handling CUI*

**Date:** 2026-03-09
**Parent doc:** [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md)
**Regulatory reference:** Defense-Contractor-IT-Compliance.md (source material)

---

## Table of Contents

1. [The Defense Contractor IT Problem](#1-the-defense-contractor-it-problem)
2. [Regulatory Mapping: What Weaver Addresses](#2-regulatory-mapping)
3. [Weaver for Defense Contractors](#3-weaver-for-defense-contractors)
4. [Fabrick for Defense Contractors](#4-fabrick-for-defense-contractors)
5. [CMMC Deficiency Remediation Plan](#5-deficiency-remediation-plan)
6. [Defense-Specific Competitive Advantages](#6-competitive-advantages)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Discovery Questions](#9-discovery-questions)
10. [Simulation Burst & ITAR-Compliant Cloud Compute (Fabrick v3.0+)](#10-simulation-burst--itar-compliant-cloud-compute-fabrick-v30)

---

## 1. The Defense Contractor IT Problem {#1-the-defense-contractor-it-problem}

**No NixOS expertise required — ever.** Weaver runs alongside existing Docker, VMware, Proxmox, or bare-metal tooling. Migrate one workload at a time. No cutover event. No retraining.

Air-gapped deployment. No cloud egress, no vendor-managed keys. CMMC workload isolation without requiring NixOS expertise from cleared personnel.

Defense contractor IT teams operate under the most prescriptive compliance regime in any industry. Non-compliance isn't a risk — it's a contract disqualifier. CMMC 2.0, NIST SP 800-171's 110 controls, DFARS 7012's 72-hour reporting window, ITAR access restrictions, and FedRAMP cloud requirements all map directly to IT systems, configurations, and processes.

**What defense contractor IT should be doing:**

- Implementing and documenting all 110 NIST SP 800-171 controls for CMMC Level 2 assessment
- Maintaining the System Security Plan (SSP) as a living document reflecting actual system state
- Enforcing CUI boundary controls, RBAC, and MFA across all covered systems
- Managing ITAR/EAR access restrictions — preventing foreign national access to controlled technical data
- Operating incident response with 72-hour DC3 reporting capability and 90-day forensic preservation
- Running continuous monitoring, vulnerability scanning, and POA&M remediation to maintain SPRS scores

**What defense contractor IT actually spends time doing:**

- Manually provisioning and rebuilding VMs with no reproducible configuration baseline
- Investigating configuration drift on systems that C3PAO assessors will examine
- Generating SSP evidence by exporting logs from multiple disconnected systems
- Documenting changes after the fact to satisfy assessment evidence requirements
- Rebuilding environments after failures with no guarantee the rebuilt system matches the SSP
- Managing separate tools for access control, audit logging, network segmentation, and hardening

**Weaver eliminates the second list so IT can focus on the first.**

---

## 2. Regulatory Mapping: What Weaver Addresses {#2-regulatory-mapping}

### Direct Compliance Impact

> **Version key:** v1.0 = shipped today. v1.2+ = on roadmap. NixOS = host OS capability (not a dashboard feature). Capabilities without a version tag are v1.0.

| Regulation / Standard | IT Obligation | Weaver Capability | Tier | Available |
|----------------------|--------------|------------------------------|:----:|:---------:|
| **CMMC 2.0 Level 2** — 110 practices (NIST 800-171) | Document all control implementations in SSP; pass C3PAO assessment | Declarative config = the SSP evidence. Git history proves control implementation timeline. Zero drift means assessed state = running state | Fabrick | v1.0 |
| **NIST 800-171 — Access Control** (22 controls) | RBAC, least privilege, remote access with MFA, session management | Per-VM RBAC (v1.0), SSO/SAML/LDAP integration (v1.2+), role-based access enforced at API level | Fabrick | v1.0 (RBAC), v1.2+ (SSO/LDAP) |
| **NIST 800-171 — Audit & Accountability** (9 controls) | Create and retain audit logs; enable monitoring, analysis, investigation | Declarative audit log (git-based) — every change is a commit with who/when/what/why. Tamper-evident by construction | Fabrick | v1.0 |
| **NIST 800-171 — Configuration Management** (9 controls) | Baseline configurations; control and monitor changes | NixOS declarative model = configuration baseline is the running state. Change control is git workflow | Weaver+ | v1.0 |
| **NIST 800-171 — System & Comms Protection** (16 controls) | Network segmentation, boundary protection, FIPS-validated encryption | Managed bridges with IP pools for CUI boundary enforcement (v1.0); declarative firewall/nftables (v1.2+); NixOS supports FIPS-mode OpenSSL (NixOS native) | Weaver+ | v1.0 (bridges), v1.2+ (firewall) |
| **NIST 800-171 — System & Info Integrity** (7 controls) | Patch management, malware protection, integrity monitoring | Zero drift = integrity monitoring by construction. Fleet-wide policy enforcement for patching. AppArmor/Seccomp hardening (v1.2+) | Weaver+ | v1.0 (drift/patching), v1.2+ (hardening plugins) |
| **DFARS 252.204-7012** | 72-hour DC3 incident reporting; 90-day image preservation | AI-powered incident diagnostics accelerate triage; declarative config enables rapid forensic baselining — you know exactly what the system should have looked like | Weaver+ | v1.0 |
| **ITAR / EAR** — Export control | Foreign national access restrictions on controlled technical data | Per-VM RBAC (v1.0) with LDAP attribute-based access policies (v1.2+) — restrict VM access by citizenship/clearance status | Fabrick | v1.0 (RBAC), v1.2+ (LDAP attributes) |
| **FedRAMP** — Cloud authorization | Use only FedRAMP-authorized cloud for CUI | **Self-hosted — CUI never leaves your facility.** No cloud authorization required for on-premises Weaver deployment | All tiers | v1.0 |
| **DoD CC SRG IL4/IL5** | Cloud impact level classification and controls | Self-hosted eliminates cloud impact level concerns entirely. For hybrid environments, Weaver manages the on-premises portion declaratively | All tiers | v1.0 |
| **Section 889 / NDAA** | Prohibited technology removal (Huawei, ZTE, etc.) | NixOS declarative model makes hardware/software inventory auditable — every component is declared, nothing is implicit | Weaver+ | v1.0 |
| **NIST SP 800-161** — Supply Chain Risk Management | Vendor technology inventory, subcontractor compliance | Single infrastructure vendor replaces multiple tools = reduced supply chain surface. Open-core model = auditable codebase | All tiers | v1.0 |

### Indirect Compliance Support

| Defense Function | IT Pain Today | How Weaver Helps |
|-----------------|--------------|----------------------------|
| **SSP Maintenance** | SSP is a snapshot that drifts from reality between assessments | Declarative config IS the system state. SSP evidence is always current — pull a git log |
| **SPRS Score Improvement** | Each unimplemented 800-171 control reduces score | Weaver directly implements or supports evidence for 40+ of the 110 controls |
| **POA&M Remediation** | Tracking and remediating control gaps across disconnected systems | Fleet-wide policy enforcement closes gaps across all nodes simultaneously |
| **C3PAO Assessment Prep** | Weeks of evidence collection across multiple systems | Config-as-code is the evidence. Assessment prep becomes "here's the git repo" |
| **Subcontractor Flow-Down** | Ensuring subs meet CMMC requirements on shared infrastructure | Managed bridges isolate subcontractor workloads; per-VM RBAC enforces need-to-know boundaries |
| **CUI Boundary Definition** | Documenting what's in-scope vs out-of-scope for CUI handling | Declarative network segmentation makes the CUI enclave boundary explicit and auditable |

---

## 3. Weaver for Defense Contractors {#3-weaver-for-defense-contractors}

**Target:** Small defense subcontractors, cleared facilities with <50 employees, CMMC Level 1 (self-assessment) organizations, defense IT consultants

**Price:**
- **Weaver Solo** — $149/yr (FM, first 200 customers) per node, admin only, local management, up to 128GB RAM
- **Weaver Team** — $129/user/yr (FM, first 50 teams) (2–4 users + 1 viewer free), up to 2 remote peer Weaver hosts (full management), up to 128GB RAM/host. Ships v2.2.0.

**The pitch:** "Your C3PAO assessor asks 'show me your baseline configurations and change control process.' With Proxmox, you scramble for screenshots. With Weaver, you hand them a git repo — every change, every author, every timestamp, every reason."

### Key Weaver Wins for Defense

| Capability | Defense Value |
|-----------|-------------|
| **Live Provisioning** | Spin up isolated VMs for new CUI workloads without SSH + rebuild cycles. CUI boundary expansion in minutes, not days |
| **Zero Configuration Drift** | NIST 800-171 3.4.1 (baseline configurations) and 3.4.2 (configuration change control) satisfied by construction — not by process |
| **AI Diagnostics** | When a CUI system fails during a critical program milestone, natural language diagnosis reduces MTTR. Better incident documentation for DC3 reporting |
| **Maintenance Manager** (v2.1.0) | NIST-required patching (SI.L2-3.14.1) without CUI system downtime. Every config change is staged (`nixos-rebuild test`), AI health-checked, and confirmed before committing (`switch`) — giving C3PAO assessors proof of controlled change management by construction. AI remediation loop attempts to fix CUI VM service failures before presenting a rollback decision. Path B (Weaver Team): CUI systems stay online behind standby clones during the host rebuild |
| **Managed Bridges + IP Pools** | Declarative CUI enclave boundary — isolate CUI networks from corporate networks. Foundation for ITAR-controlled data segmentation |
| **Sub-Second VM Boot** | Mission-critical systems recover before the incident becomes a reportable event. Continuity of operations for classified programs |
| **Multi-Hypervisor** | Run high-security CUI workloads on Firecracker (minimal attack surface), general corporate workloads on QEMU — one dashboard, one policy |

### ROI for a 30-Person Defense Subcontractor

| Current Cost | With Weaver |
|-------------|----------------------|
| Proxmox: EUR355/socket x 2 sockets = **EUR710/yr** | 2 nodes x $149 (Solo) = **$298/yr** |
| 1 IT admin spending 12 hrs/week on VM management at $75/hr = **$46,800/yr** | Reclaim 7 hrs/week = **$27,300/yr freed** for CMMC compliance work |
| CMMC assessment prep: 4 weeks/yr evidence gathering = **$12,000** | < 1 week — declarative config is the evidence |
| Configuration scanning tools (to detect drift): **$3,000–8,000/yr** | $0 — drift is impossible by construction |
| **Total current cost: ~$62,510–67,510/yr** | **Weaver: $298/yr (Solo) + $39,300 labor freed** |

### Weaver Team for Defense Contractors

**Target:** Small cleared teams with a primary workstation host and a separate isolated facility or air-gapped host. CMMC Level 1 organizations operating across two physical locations.

**Price:** $129/user/yr (FM), 2–4 users + 1 viewer free. Each host needs its own Weaver key. Ships v2.2.0.

**The use case:** A small defense subcontractor runs their primary CUI workloads on one host and maintains a separate isolated host at a second facility or air-gapped enclave. Weaver Team monitors both from the same Weaver view — see whether CUI VMs on the remote host are running, resource status, current state — with full management access to remote workloads. For connected scenarios, Tailscale MagicDNS handles peer discovery automatically. For isolated or classified networks, manual IP entry replaces Tailscale — no external DNS required. The 2-peer cap fits the typical small contractor topology (primary + one additional site).

**Upgrade trigger:** When the team needs more than 2 remote peers, fleet-scale governance, per-VM RBAC, or resource quotas across the fleet — that's a Fabrick conversation. Weaver Team gives full management of up to 2 peers; Fabrick gives fleet-scale control.

---

## 4. Fabrick for Defense Contractors {#4-fabrick-for-defense-contractors}

**Target:** Prime contractors, large defense subcontractors, organizations pursuing CMMC Level 2/3, multi-program cleared facilities, ITAR-registered manufacturers

**Price:** $2,000/yr first node + $750/yr additional + $500/yr at 10+ nodes (up to 256GB RAM)

**The pitch:** "Your SPRS score is visible to every contracting officer reviewing your bids. Every 800-171 control you can't evidence costs you points — and points cost you contracts. Weaver makes 40+ controls self-evidencing."

### Fabrick Features Mapped to Defense Obligations

| Fabrick Feature | NIST 800-171 / CMMC Requirement | Assessment Evidence Produced | Available |
|-------------------|--------------------------------|------------------------------|:---------:|
| **Per-VM RBAC** | 3.1.1 — Limit system access to authorized users; 3.1.2 — Limit to authorized transactions/functions | Role assignments per VM with enforcement logs; least-privilege demonstrated at VM granularity | v1.0 |
| **SSO/SAML/LDAP** | 3.5.1 — Identify system users; 3.5.2 — Authenticate identities | Integration with Active Directory/PKI; CAC-compatible authentication chain | v1.2+ |
| **Declarative Audit Log** | 3.3.1 — Create audit records; 3.3.2 — Ensure actions traceable to individual users | Git commit history: who, what, when, why — tamper-evident, immutable, granular | v1.0 |
| **Bulk VM Operations** | 3.4.3 — Track, review, approve/disapprove changes | Fleet-wide policy changes applied atomically with approval workflow in git | v1.0 |
| **Resource Quotas** | 3.13.13 — Control and monitor use of mobile code / system resources | Resource limits prevent cross-program interference | v1.0 |
| **All Plugins Included** | 3.13.1 — Monitor, control, protect communications at boundary; 3.14.2 — Provide protection from malicious code | Firewall (nftables), DNS, AppArmor/Seccomp, kernel hardening — complete security stack | v1.0 (DNS v1.1, firewall/hardening v1.2) |
| **Managed Bridges** | 3.13.1 — Boundary protection; 3.13.6 — Deny by default | Declarative network segmentation defines CUI enclave boundary; deny-by-default firewall rules | v1.0 (bridges), v1.2 (firewall deny-by-default) |

### Fleet Onboarding (v2.3.0)

Defense contractors and multi-site cleared facilities arriving at Fabrick with existing NixOS hosts cannot use Tailscale or cloud-dependent discovery paths in restricted environments. The **CIDR range probe** is the right path: admin specifies one or more RFC 1918 CIDR blocks; Fabrick probes only the known Weaver agent port (50051) — no general port scanning, no external API calls, no traffic outside your network boundary. Public IPs, loopback, and link-local addresses are rejected at input. Each probe session is audit-logged with the CIDR input, triggering user, and timestamp — satisfying NIST 800-171 3.3.1 audit record requirements. For strictly air-gapped environments, the **CSV/hostname import** path requires no network connectivity beyond the listed hosts: upload a list of IPs or hostnames; Fabrick connects only to those hosts, confirms the Weaver agent responds, and registers. All hub–agent communication uses mutual TLS (mTLS) on port 50051 — no plaintext gRPC. The fleet registration session itself is evidence for CMMC AC.L2-3.1.1 (authorized user enumeration) and CM.L2-3.4.1 (configuration baseline establishment).

Non-NixOS hosts — existing RHEL servers, CentOS workstations, Ubuntu build nodes — can join as **Observed** fleet members via `weaver-observer` (statically-linked Rust binary — memory-safe by construction, consistent with DoD and NSA guidance on memory-safe languages). Observed hosts provide read-only container and VM visibility only. They do not contribute to CMMC or NIST 800-171 compliance evidence. Observer nodes are included free up to 5× the Managed node count. For CMMC assessments, the fleet map clearly separates Managed hosts (in compliance posture) from Observed hosts (not in posture) — assessors see an honest picture, not an inflated boundary.

### Fabrick Success Programs for Defense

| Program | Defense Application | FM Price | Standard Price |
|---------|-------------------|:--------:|:--------------:|
| **Adopt** | NixOS + Weaver onboarding course (LMS) + 3 live sessions; CMMC-aware deployment playbook; CUI boundary architecture review | $5,000/yr | $15,000/yr |
| **Adopt — Compliance** | Everything in Adopt + NIST 800-171 control mapping session, SPRS baseline assessment, SSP section drafting for Weaver components, PoA&M gap identification | — | $25,000/yr |
| **Accelerate** | All Adopt content; dedicated Slack; quarterly fleet reviews mapped to NIST 800-171 controls; SPRS score optimization; DC3 reporting workflow integration; LMS modules for SSO/LDAP/STIG | $15,000/yr | $45,000/yr |
| **Partner** | Named engineer with defense IT experience; priority features for defense-specific needs (STIG templates, CAC integration, FIPS-mode hardening); CMMC C3PAO assessment preparation; PoA&M remediation planning; sessions on demand | $30,000/yr | $90,000/yr |

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = $9,000/yr total compliance coverage during the FM period. Standard Adopt — Compliance ($25,000/yr) includes hands-on compliance service delivery not covered by the extension alone.

### ROI for a 150-Person Prime Contractor (20 Nodes)

| Cost Category | Current State | With Fabrick |
|-------------|--------------|----------------------------------|
| Infrastructure software | VMware: $12,000–40,000/yr | 20 nodes: $12,500/yr |
| CMMC compliance staff time (2 analysts, 50% on infra evidence) | $90,000/yr | Redirect to non-infra controls — infra evidence is automatic |
| Assessment preparation | 6 weeks/yr across team = $45,000 | < 2 weeks — config-as-code is the evidence |
| Configuration scanning / drift detection | $5,000–15,000/yr | $0 — drift impossible by construction |
| Success program | N/A | Accelerate: $15,000/yr (FM) |
| Vendor risk management | 5+ infra vendors = 5+ security assessments, 5+ supply chain reviews | 1 vendor, 1 assessment, open-core codebase |
| **Total** | **$152,000–190,000/yr** | **$27,500/yr + compliance staff redirected** |

### Compliance Export Extension

**Price:** $4,000/yr flat (per organization — not per node) · stacks on Fabrick subscription
**Available:** v2.2 (signed attestation, audit log export) · v2.4 (CMMC full mapping + gap analysis) · v3.0 (scheduled delivery)

The Compliance Export extension generates CMMC/NIST 800-171 evidence packages and SPRS-ready gap analysis from Weaver's existing configuration artifacts. Builds the C3PAO evidence package automatically.

| Feature | CMMC/NIST 800-171 Requirement Addressed | Available |
|---------|----------------------------------------|:---------:|
| **Signed configuration attestation** | CM.L2-3.4.1 — cryptographically signed config snapshot proving running state matched SSP baseline at attestation timestamp | v2.2 |
| **Audit-ready change log export** | AU.L2-3.3.1 — formatted change history: who, what system, when, changed, authorized by whom | v2.2 |
| **CMMC Level 2 control mapping export** | All 110 NIST SP 800-171 controls — formatted evidence document showing which controls are satisfied by Weaver config, with citations | v2.4 |
| **SPRS-ready gap analysis** | Identifies which controls are satisfied by Weaver, which require external tooling, and which are out-of-scope — pre-C3PAO assessment evidence | v2.4 |
| **Scheduled export delivery** | Annual SSP evidence package delivery; C3PAO assessment preparation package | v3.0 |

**Positioning:** "Your SPRS score is computed from 110 controls. Weaver closes 40+ by construction. This extension packages that evidence for your C3PAO — automatically." See [COMPLIANCE-EXPORT-EXTENSION.md](../../product/COMPLIANCE-EXPORT-EXTENSION.md) for full feature spec.

---

## 5. CMMC Deficiency Remediation Plan {#5-deficiency-remediation-plan}

Most defense contractors pursuing CMMC Level 2 have significant POA&M backlogs across NIST SP 800-171's 110 controls. Many deficiencies trace directly to infrastructure tooling that doesn't produce evidence, enforce policy, or maintain baselines. Weaver closes these gaps — and the fastest wins start at Weaver.

### The Sales Motion: Close POA&M Items to Justify the Purchase

Every control deficiency on a contractor's POA&M is a quantifiable risk: lower SPRS score → fewer contract awards → lost revenue. Frame Weaver as a POA&M remediation tool, not just an infrastructure platform. Each closed POA&M item raises the SPRS score, which directly improves contract competitiveness.

### Phase 1: Quick Wins at Weaver ($149/yr (FM) per node)

These controls are satisfied or substantially improved upon deploying Weaver. Items marked **v1.0** are available today; items with a version note ship in that release and further strengthen the control.

| NIST 800-171 Control | Requirement | How Weaver Closes It | POA&M Impact | Available |
|----------------------|------------|----------------------|:------------:|:---------:|
| **3.4.1** — Establish baseline configurations | Document baseline configs for all systems | NixOS declarative config IS the baseline. The running system is mathematically identical to the declared config. No scanning needed | Closes immediately | **v1.0** |
| **3.4.2** — Establish and enforce security config settings | Track and control changes to configurations | Every change is a git commit — who, what, when, why. Unauthorized changes are impossible without a commit | Closes immediately | **v1.0** |
| **3.4.3** — Track, review, approve/disapprove changes | Change control process with approval | Git workflow enforces review before deployment; commit history is the audit trail | Closes immediately | **v1.0** |
| **3.14.1** — Identify, report, correct system flaws | Timely patching and flaw remediation | NixOS declarative updates apply fleet-wide; AI diagnostics identify issues in natural language | Substantially improves | **v1.0** |
| **3.14.2** — Provide protection from malicious code | Endpoint/system-level malware protection | Firecracker's minimal attack surface (v1.0). AppArmor/Seccomp hardening plugins further reduce exploit surface (v1.2) | Substantially improves | v1.0 + v1.2 |
| **3.14.3** — Monitor security alerts and advisories | Act on security advisories | AI-powered diagnostics flag anomalies; declarative model means patches apply consistently | Substantially improves | **v1.0** |
| **3.13.1** — Monitor, control, protect communications at boundaries | Network boundary protection | Managed bridges (v1.0) declaratively enforce network segmentation. nftables firewall (v1.2) adds explicit boundary rules. CUI boundary is code, not manual config | Substantially improves | v1.0 (bridges), v1.2 (firewall) |
| **3.8.1** — Protect system media (digital) | Protect CUI on system storage | Self-hosted — CUI never leaves your facility. NixOS supports LUKS full-disk encryption declaratively | Partially addresses | **v1.0** + NixOS native |
| **3.11.2** — Scan for vulnerabilities periodically | Vulnerability scanning and remediation | Zero-drift architecture eliminates configuration-based vulnerabilities entirely. No scan needed for config drift — it can't exist | Reduces scope | **v1.0** |
| **3.12.3** — Monitor security controls continuously | Ongoing control effectiveness monitoring | Declarative config means control implementation is continuous by construction — not periodic scan-based | Substantially improves | **v1.0** |

**SPRS Score Impact:** Closing 3.4.1, 3.4.2, and 3.4.3 alone recovers **15 points** on the SPRS scale (5 points each). Combined with substantial improvement on 3.13.1 and 3.14.x controls, a typical contractor gains **25–40 SPRS points** from Weaver deployment alone.

### Phase 2: Fabrick Upgrades That Close the Hard Controls

These controls require Fabrick features (RBAC, LDAP, audit governance). Position the Fabrick upgrade as "closing the rest of your POA&M" — the Weaver deployment already proved the platform.

| NIST 800-171 Control | Requirement | How Fabrick Closes It | POA&M Impact | Available |
|----------------------|------------|-------------------------|:------------:|:---------:|
| **3.1.1** — Limit system access to authorized users | Account management, access enforcement | Per-VM RBAC — granular access control at the individual VM level, not just pool/cluster | Closes | **v1.0** |
| **3.1.2** — Limit access to authorized transactions/functions | Function-level access control | Role-based permissions restrict what each user can do per VM (view, modify, manage, admin) | Closes | **v1.0** |
| **3.1.5** — Employ principle of least privilege | Minimum necessary access | Per-VM RBAC + role granularity enforces least privilege at infrastructure level | Closes | **v1.0** |
| **3.1.7** — Prevent non-privileged users from executing privileged functions | Privilege separation | Fabrick role model separates viewer/operator/admin functions with enforcement | Closes | **v1.0** |
| **3.3.1** — Create and retain audit records | Comprehensive audit logging | Declarative audit log with git-based immutable history; who/when/what/why on every change | Closes | **v1.0** |
| **3.3.2** — Ensure actions traceable to individual users | User-attributable audit trails | SSO/SAML/LDAP integration ties every action to a named identity from the organization's directory | Closes fully | v1.0 (local users), **v1.2+** (SSO/LDAP) |
| **3.5.1** — Identify system users, processes, devices | Identity management | LDAP/SAML integration with organizational directory — single source of identity truth | Closes fully | **v1.2+** (v1.0: local user management) |
| **3.5.2** — Authenticate identities before access | Authentication enforcement | SSO with MFA-capable identity providers; CAC-compatible authentication chain | Closes fully | v1.0 (password+JWT), v1.1 (TOTP/FIDO2), **v1.2+** (SSO/CAC) |
| **3.1.12** — Monitor and control remote access sessions | Remote access management | API-level access controls with session management; all remote operations logged | Closes | **v1.0** |
| **3.1.20** — Verify and control connections to external systems | External connection management | Managed bridges declaratively define what connects to what; no implicit connectivity | Closes | **v1.0** |
| **3.13.6** — Deny network traffic by default | Default-deny networking | Declarative firewall with deny-by-default policy; only explicitly declared traffic flows | Closes | **v1.2** |

**SPRS Score Impact:** Fabrick features close the high-value Access Control (3.1.x) and Audit (3.3.x) families — among the most heavily weighted in SPRS scoring. A contractor who was deficient on access control and audit controls typically gains **30–45 additional SPRS points** from Fabrick deployment.

### Phase 3: Success Programs That Close Process Controls

Some 800-171 controls are process-oriented — they require documented procedures, not just technical implementation. The Fabrick success programs help contractors close these with guided documentation and review.

| NIST 800-171 Control | Requirement | How Success Programs Help | Program |
|----------------------|------------|--------------------------|:-------:|
| **3.6.1** — Establish incident handling capability | IRP with defined procedures | Accelerate program includes incident response workflow integration; AI diagnostics feed triage documentation | Accelerate |
| **3.6.2** — Track, document, report incidents | Incident documentation and DC3 reporting | Accelerate includes DC3 reporting workflow setup; declarative baselines enable rapid forensic comparison | Accelerate |
| **3.12.1** — Periodically assess security controls | Control effectiveness assessment | Quarterly fleet reviews in Accelerate map Weaver state to 800-171 controls; generates assessment evidence | Accelerate |
| **3.12.2** — Develop and implement POA&M | Remediation planning and tracking | Partner program includes POA&M remediation planning; prioritized by SPRS impact | Partner |
| **3.4.6** — Employ principle of least functionality | Disable unnecessary functions/ports/services | Partner program reviews fleet for unnecessary services; NixOS declarative model makes least-functionality auditable | Partner |
| **3.4.7** — Restrict, disable, prevent nonessential programs | Application whitelisting / restriction | NixOS only runs declared software — nothing implicit. Partner program validates fleet against least-functionality | Partner |
| **3.4.9** — Control and monitor user-installed software | Software installation governance | Declarative model prevents unauthorized software installation by construction; Partner program documents the control narrative for SSP | Partner |

### The Full Remediation Path: Weaver → Fabrick → Partner

| Stage | Investment | Timeline | SPRS Impact | POA&M Items Addressed | Version Required |
|-------|-----------|----------|:-----------:|:---------------------:|:----------------:|
| **Weaver deployment** | $149–2,980/yr (1–20 nodes) | Month 1–2 | +25–40 points | Configuration Management (3.4.x), System Integrity (3.14.x), boundary controls (3.13.1) | **v1.0 today** |
| **Fabrick upgrade** | $12,500/yr (20 nodes) | Month 3–4 | +20–30 points | Access Control (3.1.x via RBAC), Audit (3.3.x), session mgmt (3.1.12) | **v1.0 today** |
| **v1.1 auth plugins** | Included in tier | With v1.1 release | +5–10 points | MFA for 3.5.2 (TOTP/FIDO2) | v1.1 |
| **v1.2 security plugins** | Included in Fabrick | With v1.2 release | +10–15 points | SSO/LDAP (3.5.x, 3.3.2), firewall deny-by-default (3.13.6), hardening (3.14.2) | v1.2 |
| **Accelerate program** | $15,000/yr | Month 4–6 | +10–15 points | Incident Response (3.6.x), Security Assessment (3.12.x) | Service — any version |
| **Partner program** | $30,000/yr | Ongoing | +5–10 points | Process controls, SSP maintenance, assessment preparation | Service — any version |
| **Cumulative (v1.0 today)** | | **Immediate** | **+45–70 points** | **25+ controls with direct evidence** | **Available now** |
| **Cumulative (through v1.2)** | | **~6 months** | **+70–110 points** | **40+ controls with direct evidence** | v1.2 release |

**What's available today (v1.0):** A contractor deploying Weaver + Fabrick right now closes 25+ controls and gains 45–70 SPRS points — enough to move a SPRS-50 contractor to 95–120, which is competitive for most contract bids.

**What v1.2 completes:** SSO/LDAP, declarative firewall, and hardening plugins close the remaining identity and boundary controls, bringing the total to 40+ controls addressed and a path to a perfect 110 SPRS score.

### Positioning the Conversation

**Discovery opener:** "What's your current SPRS score, and how many controls are on your POA&M?"

**The bridge:** Every POA&M item has a SPRS point value. Every SPRS point below 110 is a competitive disadvantage on every bid. Weaver doesn't just manage your VMs — it closes POA&M items. Start with Weaver this month, close 10+ configuration and integrity controls immediately, and build toward full assessment readiness.

**The close:** "At $149 per node, Weaver pays for itself if it closes a single POA&M item that was going to cost you a contract bid. Most contractors close 10+ items in the first month."

---

## 6. Defense-Specific Competitive Advantages {#6-competitive-advantages}

### vs VMware (Post-Broadcom)

| Factor | VMware | Weaver |
|--------|--------|-------------------|
| Cost (150-person contractor) | $12,000–40,000/yr (subscription-only post-Broadcom) | $12,500/yr (20 nodes) |
| CMMC assessment evidence | Separate audit logging, configuration scanning, change management tools | Built-in — every change is a git commit with attribution |
| Configuration drift | Possible and common; requires periodic scanning to detect | Impossible by construction (NixOS declarative model) |
| CUI boundary enforcement | Manual VLAN/firewall configuration | Declarative managed bridges with IP pools — boundary is code |
| FIPS-validated crypto | Available but requires separate configuration and validation | NixOS supports FIPS-mode OpenSSL declaratively |
| Vendor lock-in | High — Broadcom controls pricing unilaterally | Open core, offline-first license, no phone-home |
| Supply chain risk | Broadcom is multinational; some DoD programs scrutinize vendor origin | Open-core codebase is auditable; self-hosted eliminates cloud supply chain concerns |

### vs Proxmox

| Factor | Proxmox | Weaver |
|--------|---------|-------------------|
| CMMC audit trail | API call logs — captures actions, not intent or approval | Git diffs — captures what changed, who approved, and why |
| Per-VM RBAC | Pool-level permissions only | Per-VM role assignments — critical for multi-program isolation |
| Zero drift | No — imperative management allows drift between assessments | Yes — declarative by construction; assessed state = running state |
| CUI enclave isolation | Manual network config | Declarative bridge isolation per security domain |
| STIG compliance | Manual hardening | Declarative hardening plugins — STIG-aligned baselines as code |
| SSP evidence | Manual documentation of system state | System state IS the documentation (NixOS config + git history) |

### vs Cloud (AWS GovCloud / Azure Government)

| Factor | GovCloud | Weaver |
|--------|----------|-------------------|
| CUI data location | Government cloud regions — still shared infrastructure | **On your premises** — CUI never leaves your cleared facility |
| FedRAMP requirement | Must use FedRAMP-authorized services (IL4/IL5) | Self-hosted — no FedRAMP authorization needed |
| Cost per VM | $600–6,000+/yr per VM | Unlimited VMs per node ($149–1,500/yr per node) |
| Air-gap capability | No — cloud requires connectivity | Yes — offline-first license, no phone-home required |
| ITAR compliance | Requires careful IAM configuration for foreign national restrictions | Self-hosted RBAC with LDAP attributes — physically and logically within your control |
| Supply chain | Cloud provider infrastructure is opaque | Open-core, self-hosted, fully auditable |

### The Air-Gap Advantage

Many defense programs — especially ITAR-controlled, SAP/SAR, and SCIF environments — require or strongly prefer air-gapped infrastructure. Weaver's offline-first license validation (HMAC checksum, no phone-home) is purpose-built for disconnected environments. No competitor offers this without custom fabrick negotiation. For cleared facilities processing CUI in isolated enclaves, this is a disqualifying requirement that Weaver satisfies out of the box.

> **Pending differentiator — Onsite AI Model:** For enclave and SCIF environments where cloud AI is prohibited by classification policy, `aiPolicy: local-only` routes all AI diagnostics to an onsite inference node inside the enclave. Hardware/deployment spec not yet defined (see NOTES.md 2026-03-26). When spec'd, this closes the remaining gap in the air-gap AI story: every AI-assisted infrastructure diagnostic stays inside the classification boundary. Update this section when the onsite AI model spec ships.

### SLURM Integration for Defense R&D and Simulation

Defense contractors running simulation-heavy workloads — FEA (ANSYS, NASTRAN), CFD (aerodynamics, propulsion), electromagnetic/radar modeling, and signals processing — often run SLURM or PBS alongside their general IT infrastructure. SLURM ships as a NixOS package, making co-deployment with Weaver declarative and zero-friction.

The defense-specific value: each simulation job runs in a hardware-isolated MicroVM, not in a shared namespace on a bare cluster node. A compromised simulation job cannot escape to the host or affect adjacent program workloads. Different programs requiring separate CUI enclaves can share the same physical cluster with hardware-enforced isolation per job — the managed bridge per compliance regime applies at the MicroVM level. Combined with Weaver's declarative audit trail, simulation infrastructure satisfies NIST 800-171 configuration management controls by construction, not by process.

#### Kubernetes Complexity in Defense

CMMC Level 2+ requires controlled unclassified information (CUI) isolation that maps to NIST 800-171 controls. Kubernetes namespace boundaries do not meet these isolation requirements without extensive hardening — Pod Security Standards, OPA/Gatekeeper policies, runtime security agents, and custom admission controllers. Each layer adds attack surface and audit complexity that C3PAO assessors must evaluate, turning a container orchestrator into a compliance liability for CUI-handling programs.

| K8s Overhead | Impact in Defense | Weaver Alternative |
|---|---|---|
| K8s namespace isolation for CUI enclaves | Namespaces share a kernel — NIST 800-171 SC-7 boundary protection requires compensating controls (Pod Security Standards + OPA + runtime security) to prove CUI isolation; C3PAO assessors must evaluate each layer | MicroVM hardware boundaries satisfy NIST 800-171 isolation controls natively — each CUI enclave runs on its own kernel; no compensating controls for assessors to evaluate |
| K8s control plane in air-gapped / SCIF environments | etcd, API server, and container registries require network connectivity; offline K8s is painful and fragile; SCIF/SAP environments cannot tolerate external dependencies | NixOS + Weaver works fully offline with HMAC license validation; flake inputs are pinned and cacheable; no container registry dependency at runtime |
| Platform team to harden K8s for CMMC assessment | Pod Security Standards, network policies, admission controllers, and STIG-aligned node hardening require dedicated K8s security engineers ($180K+ each) that small subs can't staff | NixOS declarative hardening as code — STIG-aligned baselines are a flake input, not a manual hardening project; one sysadmin manages the infrastructure |

Full competitive reference: [KUBERNETES-COMPETITIVE-POSITIONING.md](../KUBERNETES-COMPETITIVE-POSITIONING.md)

### AI-Era Threat Landscape Advantage

Anthropic's Project Glasswing (April 2026) demonstrated that frontier AI can discover **thousands of zero-day vulnerabilities** — including some that survived decades of human review — across every major operating system and browser. These capabilities will proliferate to attackers.

**Why this changes the calculus for defense contractors:**

- **Shared-kernel = fleet-wide compromise.** A single kernel zero-day — exactly the kind AI is now finding by the thousands — compromises every Docker container on the host simultaneously. Weaver's hardware boundary per MicroVM contains the blast radius to one workload. NIST 800-171 SC-4 (covert channel analysis) and SC-7 (boundary protection) assume isolation that shared-kernel containers cannot provide against AI-augmented exploit discovery.
- **Patch at the speed of AI discovery.** CMMC assessors will ask how fast you can patch a Glasswing-class disclosure. DFARS 252.204-7012 requires 72-hour incident reporting — but the real question is whether you can prove the patch propagated before the report is due. NixOS's `flake.lock` pins every dependency by hash. Pin the fix, rebuild, deploy via Colmena — every node converges deterministically. No "did we patch that SCIF server?"
- **Supply-chain verifiability.** Glasswing explicitly targets open-source and supply-chain security. NixOS's content-addressed store makes the entire supply chain formally verifiable — every package identified by its complete dependency tree hash, not a mutable tag. For ITAR-controlled environments where foreign-origin supply chain compromise is a national security concern, this is the only infrastructure model that can prove its provenance chain.
- **Hypervisor diversity.** Weaver's 5 hypervisor options mean a vulnerability in one doesn't cascade to workloads on another — defense through diversity against AI-augmented exploit discovery. A C3PAO assessor evaluating your CMMC boundary protection controls will note that a single-hypervisor environment concentrates risk in exactly the way AI-driven vulnerability discovery exploits.

---

## 7. Objection Handling {#7-objection-handling}

### "We need a platform our C3PAO assessor has seen before"

C3PAOs assess controls, not platforms. CMMC 2.0 is based on NIST SP 800-171 — 110 controls about access, audit, configuration, and protection. Weaver doesn't just satisfy these controls — it makes them self-evidencing. Show your assessor a `git log` of every infrastructure change with attribution, approval, and rollback capability. That's stronger evidence than any platform-specific tool produces.

### "NixOS isn't on the DISA STIG list"

NixOS roots go back to 2003 and it's been shipping stable releases for 12 years — 100K+ packages, ~466 companies in production. STIGs are one hardening approach. NIST 800-171 3.4.8 requires applying deny-by-exception policies — NixOS's declarative model is inherently deny-by-exception: nothing runs unless declared. The hardening plugins (AppArmor, Seccomp, kernel hardening) enforce defense-in-depth declaratively. With the Partner success program, we'll work with you to create STIG-equivalent baselines as NixOS configurations.

### "Our FSO / security team won't approve a new platform"

Start with non-CUI workloads — corporate IT, development environments, testing infrastructure. Prove the declarative model on systems outside the CUI boundary. Once the security team sees zero-drift architecture and git-based audit trails, they'll want it inside the boundary. Our Adopt program ($5,000/yr) includes a CUI boundary architecture review to plan the transition.

### "We can't migrate off VMware mid-contract / mid-assessment"

We offer migration services ($5,000–20,000) that run in parallel with your existing deployment. Start with new program workloads on Weaver while VMware handles legacy. Our hub-agent multi-node architecture (v2.0+) can manage both environments from one dashboard during transition. Time the full migration to your next CMMC assessment cycle.

### "What about multi-program isolation? Different programs can't share infrastructure"

Per-VM RBAC (Fabrick) plus managed bridges creates program-level isolation — separate network segments, separate access controls, separate audit trails per program. Each program's VMs live in their own declarative enclave with independently auditable configurations. This is stronger isolation than most VMware deployments achieve, and it's enforced by construction rather than by policy.

### "DoD requires FIPS-validated cryptography"

NixOS supports FIPS-mode OpenSSL configured declaratively. Weaver's configuration management ensures FIPS mode is enforced consistently across all nodes — no manual per-system configuration. The declarative model means you can prove to assessors that FIPS was enabled on every system, and exactly when it was configured.

### "You're a small vendor — how do we know this code won't fail under operational load or a C3PAO assessment?"

Defense contractors are right to ask this. Here's the verifiable answer. Weaver publishes a testing benchmark scored against enterprise standards (`code/docs/TESTING-ASSESSMENT.md`):

- **1,500+ tests** across 4 layers (unit, backend, TUI, E2E) — A rating
- **24 custom static auditors** on every push, including SAST with OWASP patterns, supply chain license audit, and bidirectional tier parity enforcement — A+ rating (industry standard is 1–2 generic tools)
- **Supply chain SHA pinning** — all 40 GitHub Actions SHA-pinned across 10 workflows. No supply chain surprises.
- **5-browser E2E** — Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari passing on every release
- **Red team audit completed** — 21 findings, all dispositioned, 4 hardening fixes applied. Full audit disposition log available in `business/legal/SECURITY-AUDIT.md`

The SAST auditor specifically checks OWASP Top 10 patterns on every push. The route guard auditor verifies every API endpoint has auth and tier enforcement — no accidentally public endpoint ships. For CMMC assessors who ask about software supply chain risk (NIST 800-161), this level of automated verification is the answer.

Overall engineering discipline benchmark: **A** against enterprise standards.

### "We need FedRAMP for any cloud-based tool"

Weaver is self-hosted. It runs on your hardware, in your facility, behind your perimeter. No cloud component, no phone-home, no FedRAMP requirement. Your CUI stays on your metal.

### "Do you have a formal vulnerability disclosure program? CMMC/NIST requires incident response capability."

Yes — `SECURITY.md` defines a 48-hour acknowledgment SLA and 7-day critical fix SLA for critical vulnerabilities, with documented supported versions. NIST SP 800-171 3.6.1–3.6.2 requires incident-handling capability and incident reporting. A vendor without a formal CVD policy is itself a supply chain risk. Weaver's CVD policy is published, not buried in a contract clause.

### "What about business continuity / disaster recovery documentation?"

`docs/setup/DISASTER-RECOVERY.md` covers backup scope, recovery runbooks, and service continuity procedures for the Weaver management layer. NIST SP 800-171 3.6.x and the DFARS 252.204-7012 72-hour reporting window both require documented incident response and recovery capability from covered contractors. For C3PAO assessments, the DR doc is a direct evidence artifact for 3.6.1 (establish incident-handling capability).

### "We have existing RHEL/CentOS infrastructure we can't immediately convert"

Install `weaver-observer` on it. Existing RHEL and CentOS hosts appear in Fabrick immediately — workload visibility without NixOS. Observer nodes are free up to 5× your Managed node count. For CMMC purposes, Observed hosts are visually distinct from Managed hosts in the fleet map — your C3PAO assessor sees an honest compliance boundary, not an inflated one. The plan: convert all CUI-scoped hosts to Managed before your assessment; observe non-CUI infrastructure on your own timeline. Every Observed host has a "Convert to Managed" CTA linking to the nixos-anywhere wizard.

---

## 8. Buyer Personas {#8-buyer-personas}

### CISO / VP of Cybersecurity

**Cares about:** SPRS score, CMMC assessment readiness, CUI protection, incident response capability, supply chain risk
**Lead with:** Zero-drift architecture eliminates configuration-related findings. Declarative audit trail satisfies 800-171 3.3.x controls by construction. Self-hosted = no cloud supply chain concerns. Air-gap support for SCIF/SAP environments.
**Tier:** Fabrick + Accelerate or Partner

### Facility Security Officer (FSO)

**Cares about:** DCSA compliance, cleared personnel access controls, foreign national restrictions, physical/logical boundary alignment
**Lead with:** Per-VM RBAC with LDAP attribute-based policies enforces clearance-level access restrictions. Managed bridges align logical network boundaries with physical security domains. Self-hosted means CUI stays within the cleared facility.
**Tier:** Fabrick

### Director of IT / Infrastructure Manager

**Cares about:** Operational efficiency, tool consolidation, migration from VMware, uptime for mission-critical systems
**Lead with:** Live Provisioning eliminates rebuild cycles. 5 hypervisors from one dashboard. Sub-second recovery. 60–80% cost reduction vs VMware post-Broadcom.
**Tier:** Fabrick

### CMMC Compliance Manager / ISSO

**Cares about:** SSP accuracy, POA&M closure, assessment evidence, SPRS score optimization
**Lead with:** Declarative config means the SSP reflects reality at all times — not just at assessment. Git history provides control implementation evidence with timestamps. 40+ controls have self-evidencing artifacts. POA&M items close faster with fleet-wide policy enforcement.
**Tier:** Fabrick (they'll champion the purchase internally)

### Program Manager (Individual DoD Program)

**Cares about:** Program-level isolation, cost efficiency, schedule (can't afford infrastructure delays)
**Lead with:** Per-VM RBAC and managed bridges create program-specific enclaves. Live Provisioning delivers VMs in minutes, not days. Declarative config means reproducible environments for testing and deployment.
**Tier:** Weaver or Fabrick depending on program requirements

### Small Sub IT Administrator (Wearing Multiple Hats)

**Cares about:** Budget, simplicity, CMMC Level 1 self-assessment, not spending all day on infrastructure
**Lead with:** $149/yr (FM) vs EUR355+/socket for Proxmox. AI diagnostics for the 2 AM call. Config-as-code means your self-assessment evidence is already done. Zero drift = one less thing to worry about.
**Tier:** Weaver

---

## 9. Discovery Questions {#9-discovery-questions}

Use these to qualify defense contractor prospects and identify pain:

### Infrastructure Pain
- How do you currently provision new VMs for program workloads? How long does it take?
- When was the last time a C3PAO assessor found configuration drift between your SSP and running systems?
- How many infrastructure management tools does your IT team use daily?
- What's your current RTO for a mission-critical system failure?
- How do you handle multi-program isolation on shared hardware today?

### Compliance Pain
- What's your current SPRS score? How many 800-171 controls are on your POA&M?
- How long did your team spend preparing infrastructure evidence for your last CMMC assessment (or readiness review)?
- How do you currently prove to assessors that your running configurations match your SSP?
- How do you enforce CUI boundary separation between covered and non-covered systems?
- Do you have ITAR-controlled technical data? How do you enforce foreign national access restrictions at the system level?

### Budget Pain
- What are you paying annually for VMware/Proxmox licensing?
- How much of your IT staff time goes to infrastructure management vs CMMC compliance work?
- Have your VMware costs changed since the Broadcom acquisition?
- What do you spend on configuration scanning / drift detection tools?

### Strategic Pain
- Are you preparing for CMMC Level 2 assessment? What's your timeline?
- Do any of your programs require air-gapped or disconnected infrastructure?
- How do you manage flow-down requirements to your subcontractors?
- Are you a VMware shop considering alternatives after the Broadcom pricing changes?

### AI Threat Landscape
- "If a frontier AI discovered a zero-day in your host kernel tomorrow — which Project Glasswing has demonstrated is now routine — how many workloads would be compromised simultaneously? How quickly could you prove the patch propagated to every system?"
- "Glasswing's 90-day public disclosure cycle means your competitors will know about vulnerabilities found in your stack. Can your current infrastructure prove it's patched faster than the disclosure window? DFARS 72-hour reporting starts when you discover the incident — not when you finish patching."

---

## 10. Simulation Burst & ITAR-Compliant Cloud Compute (Fabrick v3.0+) {#10-simulation-burst--itar-compliant-cloud-compute-fabrick-v30}

**Full analysis:** [business/FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md)

Defense contractors running engineering simulation and R&D workloads — FEA (ANSYS, NASTRAN), CFD (aerodynamics, propulsion, thermal), electromagnetic/radar modeling, signals processing, and materials simulation — face the most constrained version of the cloud burst problem. These workloads max out on-prem cluster capacity seasonally (proposal season, test campaign crunch, delivery milestones) but the underlying data — propulsion models, radar cross-section signatures, guidance system parameters — is ITAR-controlled. Standard commercial cloud burst is blocked entirely.

### The Compliance Gap Cloud HPC Doesn't Solve

ITAR's Export Administration Regulations create hard constraints on where controlled technical data can be processed:

- **ITAR §22 CFR 120–130** — Technical data related to defense articles cannot be transmitted to or stored on systems accessible to foreign nationals without an export license. Shared commercial cloud infrastructure cannot guarantee this separation
- **CUI / NIST 800-171 3.13.x** — Network access control requirements for Covered Defense Information. Shared tenancy fails the data isolation requirements that NIST 800-171 3.13.6 and 3.13.1 impose on CUI
- **DFARS 252.204-7012** — Cloud computing used for covered defense information must meet FedRAMP Moderate baseline or equivalent controls. AWS GovCloud/Azure Government dedicated tenancy satisfies this; shared commercial cloud does not
- **Program Protection Plans (PPPs)** — Many programs impose additional controls beyond 800-171 that effectively require dedicated compute for any engineering simulation involving controlled design parameters

These contractors either don't burst at all (simulation queues back up by weeks at peak times, program schedules slip) or absorb GovCloud dedicated tenancy rates that approach on-demand pricing.

**Fabrick + Weaver burst nodes resolve this:** Fabrick enrolls dedicated burst nodes (GovCloud dedicated instances or bare-metal providers with dedicated tenancy) and manages them as extensions of the on-prem controlled fabric. SLURM dispatches simulation jobs to Fabrick-managed burst nodes over a WireGuard tunnel as if they were additional racks in the cleared facility. CUI stays in-network with hardware-level isolation. The Fabrick audit trail documents which cleared personnel had access to which burst node — exactly what a C3PAO assessor or DCSA auditor would require.

### The Pitch for Defense R&D Teams

*"Your propulsion CFD team's simulation queue is 3 weeks backed up heading into the critical design review. ITAR says the combustor model data can't go on a commercial shared instance. Fabrick enrolls a GovCloud dedicated burst node — your Slurm jobs run on it like it's another rack in the lab. When the CDR deliverable ships, the node deregisters. $20/node-day Fabrick licensing. Your ITAR posture doesn't change; your queue does."*

### Licensing for Burst Nodes

Defense simulation burst nodes (typically 512GB–2TB RAM) use per-node-day consumption stacking on the Contract tier base:

| License component | Coverage |
|---|---|
| Contract base (Fabrick $2,500/yr) | Fabrick control plane + persistent nodes |
| Contract block ($2,000 first block) | 512GB+ RAM per burst node |
| Burst add-on (~$20/node-day) | Per-day charge while burst node is enrolled |

**Example:** Defense R&D team, 2 burst nodes, 6 simulation crunch periods/yr (10 days each):
- GovCloud dedicated compute: 2 × 60 days × $500/day = $60,000/yr
- Fabrick burst licensing: 120 node-days × $20 = $2,400/yr
- **Fabrick as % of compute: 4%** — ITAR-compliant isolation and audit trail at negligible overhead

### New Buyer Persona: Defense R&D Infrastructure Engineer / Simulation IT Lead

**Profile:** Manages the on-prem HPC cluster for a defense contractor's engineering simulation team. Owns the Slurm/PBS cluster, ITAR data handling controls, and burst provisioning when proposal season or program milestones create queue backlogs. The gap between "we need more compute this quarter" and "ITAR says we can't just spin up cloud nodes" is a persistent scheduling problem.

**Cares about:** ITAR compliance on simulation data, CUI boundary controls for burst nodes, Slurm integration for burst job dispatch, C3PAO assessment evidence for cloud-connected nodes, program schedule impact from simulation queue backlogs.

**Lead with:** Fabrick as the ITAR-compliant burst layer — "dedicated GovCloud node enrolled in your controlled fabric via WireGuard, managed by Slurm exactly like your on-prem cluster." Hardware isolation satisfies 800-171 data isolation requirements. Fabrick audit trail documents CUI access on burst nodes for C3PAO evidence. $20/node-day vs paying for idle dedicated tenancy year-round.

**Tier:** Contract (512GB+ nodes) + Fabrick fleet license + burst consumption add-on + Partner success program.

### Discovery Questions (Simulation Burst / ITAR Cloud Compute)

- Do your simulation queues back up at program milestones or proposal season? How does that affect schedules?
- How do you currently handle burst compute demand for ITAR-controlled simulation workloads?
- Are you using GovCloud dedicated tenancy for any cloud burst today? What's the cost vs shared instances?
- What's the C3PAO assessor's current guidance on cloud burst for CUI simulation data in your contract vehicle?
- How do you document access controls for burst nodes that handle controlled technical data? Is that evidence in your current SSP?

---

*This document complements the universal value proposition in [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md). For pricing details, see [TIER-MANAGEMENT.md](../../product/TIER-MANAGEMENT.md). For Fabrick justification, see [FABRICK-VALUE-PROPOSITION.md](../../marketing/FABRICK-VALUE-PROPOSITION.md). For cloud burst architecture and licensing, see [FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md).*

---

## Recent Changes

- **2026-03-26** — Added fleet onboarding subsection to Section 4 (Fabrick). CIDR probe primary path for defense/air-gap; RFC 1918 enforcement; CSV import for strictly air-gapped environments; NIST 800-171 3.3.1 and CMMC AC/CM evidence from discovery session.
- **2026-03-21** — Weaver split into Solo ($149/yr (FM)) and Team ($129/user/yr (FM), 2 remote peers, v2.2.0). Added Weaver Team defense use case: small cleared team monitoring primary + isolated/air-gapped host, Tailscale for connected or manual IP for air-gapped topologies.
- **2026-03-21** — Added Section 10: Simulation Burst & ITAR-Compliant Cloud Compute (Fabrick v3.0+). Covers ITAR/CUI/DFARS constraints that block standard cloud burst, GovCloud dedicated tenancy economics, per-node-day licensing, and new Defense R&D Infrastructure Engineer buyer persona.
- **2026-03-19** — Added "SLURM Integration for Defense R&D and Simulation" to competitive advantages section. Covers FEA/CFD/EW simulation workloads, hardware-isolated MicroVM per job, multi-program CUI isolation on shared cluster hardware.
- **2026-03-18** — Fabrick pricing revised to $2,000/yr first node, $750/yr additional, $500/yr at 10+. Fabrick tier added at $2,500/yr (512GB RAM). Contract tier added for 512GB+ deployments (sliding scale per 512GB block). RAM coverage noted per tier. Parallel migration / no-expertise-required positioning added as primary lead.
