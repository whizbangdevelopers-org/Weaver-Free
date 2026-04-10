<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Financial Services IT Sales Case
## How Weaver Eliminates Infrastructure Burden for Financial Organizations
*Banks, Credit Unions, Fintechs, Broker-Dealers & Payment Processors*

**Date:** 2026-03-09
**Parent doc:** [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md)
**Regulatory reference:** Financial-Services-IT-Compliance.md (source material)

---

## Table of Contents

1. [The Financial Services IT Problem](#1-the-financial-services-it-problem)
2. [Regulatory Mapping: What Weaver Addresses](#2-regulatory-mapping)
3. [Weaver for Financial Services](#3-weaver-for-financial-services)
4. [Fabrick for Financial Services](#4-fabrick-for-financial-services)
5. [Compliance Deficiency Remediation Plan](#5-deficiency-remediation-plan)
6. [Financial Services Competitive Advantages](#6-competitive-advantages)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Discovery Questions](#9-discovery-questions)
10. [Quant AI & Cloud Burst (Fabrick v3.0+)](#10-quant-ai--cloud-burst-fabrick-v30)

---

## 1. The Financial Services IT Problem {#1-the-financial-services-it-problem}

**No NixOS expertise required — ever.** Weaver runs alongside existing Docker, VMware, Proxmox, or bare-metal tooling. Migrate one workload at a time. No cutover event. No retraining.

Migrate trading and settlement workloads to MicroVM hardware isolation without downtime. Runs alongside existing trading infrastructure. No cutover event.

Financial services IT teams operate under the most exam-driven compliance environment outside of healthcare. FFIEC examiners directly test IT systems and documentation. SOX auditors scrutinize access controls over financial reporting. PCI-DSS assessors scope your cardholder data environment. NYDFS requires annual CISO certification. Every documentation gap that would be advisory in other industries is a cited deficiency requiring remediation commitment and examiner follow-up.

**What financial services IT should be doing:**

- Maintaining continuous audit trails for FFIEC examiner evidence packages
- Enforcing segregation of duties and privileged access management for SOX 404
- Scoping and segmenting cardholder data environments for PCI-DSS
- Running quarterly vulnerability scans and annual penetration tests
- Managing vendor risk lifecycle across OCC third-party guidance requirements
- Operating incident response with 36-hour federal regulator notification capability

**What financial services IT actually spends time doing:**

- Manually provisioning and rebuilding VMs with no reproducible configuration baseline
- Investigating configuration drift on systems examiners will inspect
- Generating audit evidence by exporting logs from multiple disconnected systems
- Documenting changes after the fact for examination binders
- Rebuilding environments after failures with no guarantee the rebuilt system matches documentation
- Managing separate tools for access control, audit logging, network segmentation, and encryption

**Weaver eliminates the second list so IT can focus on the first.**

---

## 2. Regulatory Mapping: What Weaver Addresses {#2-regulatory-mapping}

### Direct Compliance Impact

> **Version key:** v1.0 = shipped today. v1.1/v1.2+ = on roadmap. NixOS = host OS capability (not a dashboard feature). Capabilities without a version tag are v1.0.

| Regulation / Standard | IT Obligation | Weaver Capability | Tier | Available |
|----------------------|--------------|------------------------------|:----:|:---------:|
| **GLBA Safeguards Rule** (2023 amendments) | Written infosec program; MFA; encryption in transit and at rest | Self-hosted (data never leaves facility); declarative config = documented security program; TOTP/FIDO2 MFA; NixOS supports LUKS encryption declaratively | Weaver+ | v1.0 (self-hosted, config), v1.1 (MFA) |
| **NYDFS 23 NYCRR 500** | CISO program; annual pen test; quarterly vuln scan; MFA; audit trails; 72-hour notification | Zero-drift eliminates config-based vulns; declarative audit trail (git-based); AI diagnostics accelerate incident triage for 72-hour window; MFA plugins | Fabrick | v1.0 (audit, drift), v1.1 (MFA), v1.2+ (SSO) |
| **PCI-DSS v4.0** | CDE scoping; network segmentation; access control; logging; quarterly scans | Managed bridges declaratively segment CDE from corporate network; per-VM RBAC restricts CDE access; git-based audit log; zero drift eliminates scan findings from config issues | Fabrick | v1.0 (RBAC, bridges, audit), v1.2 (firewall) |
| **FFIEC IT Examination Handbooks** | All IT control domains: security, BCP, architecture, audit, management | Declarative config = architecture documentation by construction; git history = change management evidence; zero drift = continuous security posture; sub-second recovery for BCP | Weaver+ | v1.0 |
| **SOX Section 302/404** | Access controls over financial reporting systems; audit trails | Per-VM RBAC enforces access controls at VM granularity; declarative audit log traces who changed what, when, why; role separation enforced at API level | Fabrick | v1.0 (RBAC, audit), v1.2+ (SSO/LDAP for SoD) |
| **BSA/AML Systems** | Transaction monitoring system integrity; audit trails of alert dispositions | Infrastructure-level audit trail proves system integrity; zero drift ensures monitoring systems run as documented | Weaver+ | v1.0 |
| **OCC 36-Hour Notification** | 36-hour incident notification to federal regulator | AI diagnostics accelerate triage; declarative baselines enable rapid forensic comparison — you know exactly what the system should have looked like vs. what happened | Weaver+ | v1.0 |
| **SEC Rule 17a-4** | Non-erasable, non-rewritable record storage (WORM) | Git-based audit log is append-only by construction; commit history is tamper-evident. Not a WORM replacement but provides strong evidence trail | Fabrick | v1.0 |
| **OCC Third-Party Guidance** | Vendor lifecycle management; concentration risk | Single infrastructure vendor replaces 5+ tools = reduced vendor surface; open-core model = auditable codebase; self-hosted eliminates cloud concentration risk | All tiers | v1.0 |
| **FINRA Rule 4370** | Business continuity plan; annual testing; recovery capability | Declarative config = reproducible rebuild; sub-second VM boot (Firecracker) for BCP testing; config-as-code means DR is provable, not aspirational | Weaver+ | v1.0 |
| **State Privacy Laws** (CCPA/CPRA, etc.) | Data inventory; deletion workflows; access controls | Self-hosted = customer data stays on premises; per-VM isolation enables data classification at infrastructure level; RBAC restricts access per data category | Fabrick | v1.0 |

### Indirect Compliance Support

| Financial Function | IT Pain Today | How Weaver Helps |
|-------------------|--------------|----------------------------|
| **Examiner Evidence Packages** | Weeks of compilation from multiple systems; screenshots and manual documentation | Config-as-code is the evidence. Pull a git log — every change, every author, every timestamp, every reason |
| **Annual Certification** (NYDFS 500.17) | CISO must certify compliance; relies on manual verification of system state | Declarative config means system state = documented state at all times. Certification evidence is always current |
| **Segregation of Duties** | Manual RBAC configuration across multiple tools; audit trail gaps | Per-VM RBAC + role-based API enforcement; SSO/LDAP integration (v1.2+) ties to organizational identity for provable SoD |
| **CDE Scoping** (PCI-DSS) | Documenting which systems are in scope for cardholder data | Declarative managed bridges make CDE boundaries explicit in code; network segmentation is auditable and reproducible |
| **Vendor Risk Reduction** | 5+ infrastructure vendors = 5+ security assessments, 5+ contracts | 1 vendor, 1 assessment, 1 contract. Open-core codebase is auditable. Self-hosted eliminates cloud vendor dependencies |
| **BCP/DR Testing** | Annual DR tests often reveal "drift" between documented and actual recovery procedures | Declarative config means recovery procedure = redeploy config. Tested every time you deploy, not once a year |

---

## 3. Weaver for Financial Services {#3-weaver-for-financial-services}

**Target:** Community banks, credit unions, small fintechs, payment processors under 50 employees, financial IT consultants

**Price:**
- **Weaver Solo** — $149/yr (FM, first 200) per node, admin only, local management, up to 128GB RAM
- **Weaver Team** — $129/user/yr (FM, first 50 teams) (2–4 users + 1 viewer free), up to 2 remote peer Weaver hosts (full management), up to 128GB RAM/host. Ships v2.2.0.

**The pitch:** "Your FFIEC examiner asks 'show me your change management process and audit trail.' With Proxmox, you scramble for screenshots. With Weaver, you hand them a git repo — every change, every author, every timestamp, every approval."

### Key Weaver Wins for Financial Services

| Capability | Financial Services Value |
|-----------|------------------------|
| **Live Provisioning** | Spin up isolated VMs for new banking applications without SSH + rebuild cycles. CDE boundary expansion in minutes, not days |
| **Zero Configuration Drift** | FFIEC examiners test running config against documentation. With NixOS, they are mathematically identical — by construction, not by scan |
| **AI Diagnostics** | When a core banking system VM fails at 2 AM, natural language diagnosis reduces MTTR. Better incident documentation for the 36-hour notification window |
| **Managed Bridges + IP Pools** | Declarative CDE boundary — isolate payment processing from corporate and customer-facing networks. Foundation for PCI-DSS network segmentation |
| **Sub-Second VM Boot** | Core banking system recovery in <125ms. BCP/DR testing becomes routine, not an annual fire drill |
| **Multi-Hypervisor** | Run payment processing on Firecracker (minimal attack surface), general operations on QEMU — one dashboard, one policy, one audit trail |

### ROI for a Community Bank (4 Nodes)

| Current Cost | With Weaver |
|-------------|----------------------|
| Proxmox: EUR355/socket x 4 sockets = **EUR1,420/yr** | 4 nodes x $149 (Solo) = **$596/yr** |
| 1 IT admin spending 15 hrs/week on VM management at $70/hr = **$54,600/yr** | Reclaim 8 hrs/week = **$29,120/yr freed** for compliance work |
| Examiner prep: 3 weeks/yr evidence gathering = **$8,400** | < 1 week — config-as-code is the evidence |
| Configuration scanning tools (drift detection): **$3,000–6,000/yr** | $0 — drift is impossible by construction |
| **Total current cost: ~$67,420–70,420/yr** | **Weaver: $596/yr (Solo) + $37,520 labor freed** |

### Weaver Team for Financial Services

**Target:** Boutique investment firms, small trading operations, community banks with a primary trading/operations host and a separate risk or compliance analysis host.

**Price:** $129/user/yr (FM), 2–4 users + 1 viewer free. Each host needs its own Weaver key. Ships v2.2.0.

**The use case:** A boutique trading firm runs primary trading workloads on one host and maintains a separate host dedicated to quantitative risk models or LLM-powered compliance analysis. Weaver Team lets the IT team monitor both from the same Weaver view — see whether the risk model VM is running, current resource usage, and status — without the overhead of Fabrick. The secondary host appears with a host badge on workload cards; management actions are fully available on both hosts. The team can monitor and manage both environments from one view.

**Upgrade trigger:** When the team needs more than 2 remote peers, fleet-scale governance, per-VM RBAC, or resource quotas — including scenarios where a FFIEC examiner would expect centralized audit trail across the fleet — that's a Fabrick conversation.

---

## 4. Fabrick for Financial Services {#4-fabrick-for-financial-services}

**Target:** Regional/national banks, broker-dealers, large fintechs, payment processors, organizations subject to NYDFS 500 or SOX compliance

**Price:** $2,000/yr first node + $750/yr additional + $500/yr at 10+ nodes (up to 256GB RAM)

**The pitch:** "Every FFIEC examiner finding is a board-level item. Every SOX deficiency is a material weakness risk. Weaver makes your infrastructure self-evidencing — the examiner sees what the system sees, because they're the same thing."

### Fabrick Features Mapped to Financial Obligations

| Fabrick Feature | Regulatory Requirement | Examiner Evidence Produced | Available |
|-------------------|----------------------|---------------------------|:---------:|
| **Per-VM RBAC** | SOX 404 — access controls; FFIEC — privileged access management | Role assignments per VM with enforcement logs; least-privilege demonstrated at VM granularity; SoD enforceable per system | **v1.0** |
| **SSO/SAML/LDAP** | NYDFS 500 — centralized identity; PCI-DSS — unique user IDs | Integration with Active Directory; single identity source eliminates orphan accounts | v1.2+ |
| **Declarative Audit Log** | FFIEC — tamper-evident audit trails; SOX — change documentation; SEC 17a-4 — record integrity | Git commit history: who, what, when, why — tamper-evident, immutable, granular. 7-year retention via git archive | **v1.0** |
| **Bulk VM Operations** | FFIEC — change management; SOX — controlled changes | Fleet-wide policy changes applied atomically with approval workflow in git | **v1.0** |
| **Resource Quotas** | FFIEC — capacity management; PCI-DSS — resource isolation | Resource limits prevent payment processing systems from being starved by other workloads | **v1.0** |
| **All Plugins Included** | PCI-DSS — network security; NYDFS — encryption; GLBA — technical safeguards | Firewall (nftables), DNS, AppArmor/Seccomp, kernel hardening — complete security stack | v1.0 (DNS v1.1, firewall/hardening v1.2) |
| **Managed Bridges** | PCI-DSS — CDE network segmentation; FFIEC — network architecture | Declarative network segmentation defines CDE boundary; isolation is code, not manual config | **v1.0** |

### Fleet Onboarding (v2.3.0)

Financial institutions arriving at Fabrick with existing infrastructure use the **CSV/hostname import** path: admin provides an explicit list of host IPs or hostnames; Fabrick connects only to those hosts — no lateral probing, no CIDR scanning of the network. This satisfies the strict network access controls common in PCI-DSS CDE environments and FedRAMP boundaries. Each session is audit-logged with the host list, triggering user, and timestamp — evidence for FFIEC change management requirements.

Non-NixOS hosts — existing RHEL production servers, Ubuntu back-office systems, legacy infrastructure — can join as **Observed** fleet members via `weaver-observer` (statically-linked Rust binary, memory-safe, zero runtime dependencies, any Linux kernel ≥ 4.x). Observed hosts appear in the Fabrick fleet map with a yellow `Observed` badge showing running containers and VMs read-only. They do not contribute to PCI-DSS, SOX, or FFIEC compliance evidence — the fleet map clearly distinguishes `Managed` (in compliance boundary) from `Observed` (not in boundary). Observer nodes are included free up to 5× the Managed node count.

### Fabrick Success Programs for Financial Services

| Program | Financial Services Application | FM Price | Standard Price |
|---------|-------------------------------|:--------:|:--------------:|
| **Adopt** | NixOS + Weaver onboarding course (LMS) + 3 live sessions; FFIEC-aware deployment playbook; CDE boundary architecture review | $5,000/yr | $15,000/yr |
| **Adopt — Compliance** | Everything in Adopt + SOX/PCI-DSS/FFIEC config mapping session, examiner evidence walkthrough, CDE scoping assistance for Weaver environment | — | $25,000/yr |
| **Accelerate** | All Adopt content; dedicated Slack; quarterly fleet reviews mapped to FFIEC examination domains; SOX access control documentation; PCI-DSS scoping; LMS modules for SSO/LDAP/monitoring integrations | $15,000/yr | $45,000/yr |
| **Partner** | Named engineer who understands banking IT; priority features for financial-specific needs (WORM-compatible audit export, ACH system isolation templates); examination preparation support; incident response workflow integration; sessions on demand | $30,000/yr | $90,000/yr |

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = $9,000/yr total compliance coverage during the FM period. Standard Adopt — Compliance ($25,000/yr) includes hands-on compliance service delivery not covered by the extension alone.

### ROI for a Regional Bank (25 Nodes)

| Cost Category | Current State | With Fabrick |
|-------------|--------------|----------------------------------|
| Infrastructure software | VMware: $15,000–45,000/yr | 25 nodes: $15,500/yr |
| Compliance staff time (2 analysts, 40% on infra evidence) | $72,000/yr | Redirect to non-infra compliance — infra evidence is automatic |
| Examination preparation | 4 weeks/yr across team = $32,000 | < 1 week — config-as-code is the evidence |
| Configuration scanning / drift detection | $5,000–12,000/yr | $0 — drift impossible by construction |
| Success program | N/A | Accelerate: $15,000/yr (FM) |
| Vendor risk management | 5+ infra vendors = 5+ assessments, 5+ contracts | 1 vendor, 1 assessment, open-core codebase |
| **Total** | **$124,000–161,000/yr** | **$30,500/yr + compliance staff redirected** |

### Compliance Export Extension

**Price:** $4,000/yr flat (per organization — not per node) · stacks on Fabrick subscription
**Available:** v2.2 (SOC 2, PCI-DSS, FFIEC audit log export) · v3.0 (scheduled delivery)

The Compliance Export extension generates SOC 2, PCI-DSS, and FFIEC evidence packages from Weaver's existing configuration artifacts. Examination prep that takes 4 weeks takes 4 hours.

| Feature | Regulatory Requirement Addressed | Available |
|---------|----------------------------------|:---------:|
| **SOC 2 Trust Services Criteria mapping export** | CC6.1 (logical access), CC7.2 (system monitoring) — formatted evidence document showing control satisfaction with config citations | v2.2 |
| **PCI-DSS Req 2 + Req 10 export** | Configuration standards documentation (Req 2) and audit log export (Req 10) — formatted for QSA consumption | v2.2 |
| **Signed configuration attestation** | SOX 404, FFIEC — cryptographically signed config snapshot proving running state matched declared state; WORM-equivalent record | v2.2 |
| **Audit-ready change log export** | SOX, FFIEC — formatted change history with authorization chain; 7-year retention model via git archive | v2.2 |
| **Scheduled export delivery** | Annual/quarterly evidence packages to S3-compatible endpoint; automated delivery before examination cycle | v3.0 |

**Positioning:** "Examination prep takes 4 weeks. With the Compliance Export extension, it takes 4 hours. The examiner gets a formatted package. You get your team back." See [COMPLIANCE-EXPORT-EXTENSION.md](../../product/COMPLIANCE-EXPORT-EXTENSION.md) for full feature spec.

---

## 5. Compliance Deficiency Remediation Plan {#5-deficiency-remediation-plan}

Financial institutions face examination findings that must be remediated on a regulator-imposed timeline. Unresolved findings escalate — from matters requiring attention (MRA) to matters requiring immediate attention (MRIA) to consent orders. Weaver closes infrastructure-related findings at the root.

### The Sales Motion: Close Examination Findings to Justify the Purchase

Every open examiner finding is a board-reported item. Repeated findings in the same domain signal systemic weakness and invite escalated enforcement. Frame Weaver as an examination remediation tool — it doesn't just manage VMs, it closes findings.

### Phase 1: Quick Wins at Weaver ($149/yr (FM, first 200) per node)

These controls are satisfied upon deploying Weaver. Items marked **v1.0** are available today.

| Examination Domain | Common Finding | How Weaver Closes It | Status | Available |
|-------------------|---------------|----------------------|:------:|:---------:|
| **FFIEC — Configuration Management** | "Baseline configurations not documented" / "Change management process lacks audit trail" | NixOS declarative config IS the baseline. Every change is a git commit with author, timestamp, approval. Drift is impossible | Closes | **v1.0** |
| **FFIEC — Information Security** | "Vulnerability scanning reveals configuration drift" | Zero-drift architecture eliminates configuration-based findings entirely. Running state = documented state by construction | Closes | **v1.0** |
| **FFIEC — Business Continuity** | "DR recovery procedures not tested" / "RTO not demonstrably achievable" | Declarative config = reproducible rebuild. Sub-second Firecracker boot. Recovery is provable — deploy the config, system is identical | Substantially improves | **v1.0** |
| **FFIEC — Architecture** | "Network segmentation between production and development insufficient" | Managed bridges declaratively segment environments. Segmentation is code — auditable, reproducible, version-controlled | Substantially improves | **v1.0** |
| **OCC — Vendor Concentration** | "Over-reliance on single cloud/infrastructure vendor without contingency" | Self-hosted, open-core, offline-first license. No cloud dependency, no vendor lock-in, no phone-home | Addresses | **v1.0** |
| **PCI-DSS — Requirement 1** | "Network segmentation of CDE not adequately documented" | Managed bridges define CDE boundary in code. Network architecture IS the documentation | Substantially improves | **v1.0** |
| **PCI-DSS — Requirement 10** | "Audit trail does not capture all required events" / "Log integrity not assured" | Git-based audit log is append-only, tamper-evident. Every infrastructure change is captured with full attribution | Substantially improves | **v1.0** |
| **GLBA — Technical Safeguards** | "Patch management process inconsistent" | NixOS declarative updates apply fleet-wide. Patches are code — version-controlled, reviewed, atomically deployed | Substantially improves | **v1.0** |

### Phase 2: Fabrick Upgrades That Close Access & Audit Findings

| Examination Domain | Common Finding | How Fabrick Closes It | Status | Available |
|-------------------|---------------|-------------------------|:------:|:---------:|
| **SOX 404 — Access Controls** | "Access to financial reporting systems not restricted to authorized users" | Per-VM RBAC — granular access at individual VM level; role-based enforcement at API level | Closes | **v1.0** |
| **FFIEC — Privileged Access** | "Privileged activity not logged" / "Admin accounts shared" | Every action is a git commit tied to an individual identity. Fabrick audit log captures all privileged operations | Closes | **v1.0** |
| **SOX — Segregation of Duties** | "Single user can modify and approve changes to financial systems" | Per-VM RBAC enforces role separation (viewer/operator/admin). SSO/LDAP integration (v1.2+) ties to organizational identity for provable SoD | Closes partially; fully at v1.2 | v1.0 (RBAC), **v1.2+** (SSO/LDAP) |
| **NYDFS 500.7 — Access Privileges** | "Periodic review of access privileges not documented" | RBAC state is declarative — the current state IS the documentation. Access review = `git diff` between review dates | Closes | **v1.0** |
| **PCI-DSS — Requirement 7** | "Access to CDE not restricted on a need-to-know basis" | Per-VM RBAC restricts CDE VM access to authorized roles only. Enforcement is at API level, not policy level | Closes | **v1.0** |
| **PCI-DSS — Requirement 8** | "User authentication not unique per user" / "MFA not enforced" | Individual user accounts with JWT auth (v1.0). TOTP/FIDO2 MFA (v1.1). SSO integration (v1.2+) | Closes fully | v1.0 (unique IDs), v1.1 (MFA), **v1.2+** (SSO) |
| **FFIEC — Audit** | "Audit trail gaps — not all system changes captured" | Declarative model means ALL changes go through git. No out-of-band changes possible. Audit trail is complete by construction | Closes | **v1.0** |

### Phase 3: Success Programs That Close Process Findings

| Examination Domain | Common Finding | How Success Programs Help | Program |
|-------------------|---------------|--------------------------|:-------:|
| **FFIEC — Incident Response** | "Incident response plan not tested" / "36-hour notification workflow not documented" | Accelerate includes incident response workflow integration; AI diagnostics feed triage documentation; regulator notification templates | Accelerate |
| **FFIEC — BCP Testing** | "BCP/DR test results not documented" / "Recovery did not meet stated RTO" | Accelerate includes quarterly DR validation; declarative config makes recovery demonstrable and repeatable | Accelerate |
| **OCC — Vendor Risk** | "Vendor security assessments not current" / "Critical vendor contingency plan missing" | Partner program includes vendor risk documentation for Weaver; open-core codebase enables deeper assessment than proprietary alternatives | Partner |
| **SOX — IT General Controls** | "ITGC documentation incomplete for infrastructure layer" | Partner program includes ITGC documentation assistance; declarative config generates most evidence automatically | Partner |
| **PCI-DSS — Requirement 12** | "Information security policy does not address all PCI-DSS requirements" | Partner program includes PCI-DSS gap analysis for Weaver environments; policy template assistance | Partner |

### The Full Remediation Path

| Stage | Investment | Timeline | Findings Addressed | Version Required |
|-------|-----------|----------|:------------------:|:----------------:|
| **Weaver deployment** | $149–3,725/yr (1–25 nodes) | Month 1–2 | Config management, drift, BCP, network segmentation, vendor concentration | **v1.0 today** |
| **Fabrick upgrade** | $15,500/yr (25 nodes) | Month 3–4 | Access controls (SOX/FFIEC), privileged access, audit completeness, CDE access restriction | **v1.0 today** |
| **v1.1 auth plugins** | Included in tier | With v1.1 release | MFA findings (PCI-DSS Req 8, GLBA, NYDFS) | v1.1 |
| **v1.2 security plugins** | Included in Fabrick | With v1.2 release | SSO/LDAP (SoD provability), firewall (CDE boundary hardening), hardening plugins | v1.2 |
| **Accelerate program** | $15,000/yr | Month 4–6 | Incident response, BCP testing, examination preparation | Service — any version |
| **Partner program** | $30,000/yr | Ongoing | ITGC documentation, vendor risk, PCI-DSS policy gaps | Service — any version |
| **Cumulative (v1.0 today)** | | **Immediate** | **15+ common examination findings addressable** | **Available now** |
| **Cumulative (through v1.2)** | | **~6 months** | **25+ findings across FFIEC, SOX, PCI-DSS, NYDFS** | v1.2 release |

### Positioning the Conversation

**Discovery opener:** "When was your last FFIEC examination, and how many open findings involve infrastructure configuration, access controls, or audit trail gaps?"

**The bridge:** Every open examiner finding is a board-reported item. Repeated findings invite escalated enforcement. Weaver doesn't just manage your VMs — it closes examination findings. Start with Weaver this month, eliminate configuration and drift findings immediately, and build toward full examination readiness.

**The close:** "At $149 per node, Weaver pays for itself if it closes a single examination finding that was costing you remediation staff time. Most institutions close 8+ infrastructure findings in the first month."

---

## 6. Financial Services Competitive Advantages {#6-competitive-advantages}

### vs VMware (Post-Broadcom)

| Factor | VMware | Weaver |
|--------|--------|-------------------|
| Cost (regional bank, 25 nodes) | $15,000–45,000/yr (subscription-only post-Broadcom) | $15,500/yr |
| Examiner evidence | Separate audit logging, config scanning, change management tools | Built-in — every change is a git commit with attribution |
| Configuration drift | Possible and common; requires periodic scanning to detect | Impossible by construction (NixOS declarative model) |
| CDE segmentation (PCI) | Manual VLAN/firewall configuration | Declarative managed bridges with IP pools — boundary is code |
| Vendor lock-in | High — Broadcom controls pricing; concentration risk finding potential | Open core, offline-first license, no phone-home |
| BCP/DR evidence | DR tested annually; recovery procedure documentation often stale | Declarative config = recovery procedure. Tested every deployment |

### vs Proxmox

| Factor | Proxmox | Weaver |
|--------|---------|-------------------|
| Audit trail quality | API call logs — captures actions, not intent or approval | Git diffs — captures what changed, who approved, and why |
| Per-VM RBAC | Pool-level permissions only | Per-VM role assignments — critical for CDE isolation and SoD |
| Zero drift | No — imperative management allows drift between examinations | Yes — declarative by construction; examined state = running state |
| SOX evidence | Manual documentation of access controls and changes | RBAC state is the documentation; git history is the change evidence |
| Examiner readiness | Manual evidence compilation | Config-as-code generates evidence continuously |

### vs Cloud (AWS/Azure/GCP)

| Factor | Cloud VMs | Weaver |
|--------|-----------|-------------------|
| Customer data location | Shared infrastructure; depends on config and agreements | **On your premises** — customer data never leaves your facility |
| Vendor concentration risk | Major OCC concern — single cloud provider dependency | Self-hosted — no cloud dependency; open-core eliminates lock-in |
| Cost per VM | $600–6,000+/yr per VM | Unlimited VMs per node ($149–1,500/yr per node) |
| Audit trail ownership | Cloud provider controls log infrastructure | You own the git repo — full audit trail sovereignty |
| FedRAMP requirement | Required for cloud services used by regulated entities | Self-hosted — no FedRAMP requirement |
| WORM compliance (17a-4) | Requires careful S3/Glacier WORM config | Git history is append-only by construction; exportable to WORM storage |

### The Self-Hosted Advantage

Financial regulators increasingly scrutinize cloud concentration risk. OCC, FFIEC, and NYDFS all flag single-vendor cloud dependency as a material risk. Weaver's self-hosted, offline-first architecture eliminates this finding category entirely. Customer data stays on your hardware, in your facility, under your control. No cloud egress, no shared infrastructure, no vendor lock-in.

#### Kubernetes Complexity in Financial Services

PCI-DSS requires provable network segmentation of the cardholder data environment (CDE). Kubernetes containers share a kernel, meaning pod-to-pod isolation relies on software-defined network policies — necessary but insufficient for CDE boundary enforcement. QSAs and examiners require compensating controls documentation for every shared-kernel boundary, turning K8s network policy into a recurring audit cost that grows with every microservice.

| K8s Overhead | Impact in Financial Services | Weaver Alternative |
|---|---|---|
| Shared-kernel container isolation for CDE workloads | PCI-DSS requires compensating controls to prove cardholder data isolation; each network policy change triggers re-assessment by the QSA | MicroVM hardware isolation satisfies PCI-DSS segmentation natively — each workload has its own kernel; no compensating controls needed |
| K8s namespace boundaries for SOX-regulated systems | FFIEC examiners must trace access paths through shared control plane, etcd, and kubelet to verify separation of duties; documentation is audit-intensive | Per-VM RBAC with git-tracked access changes — examiners verify access controls directly without navigating K8s abstraction layers |
| Platform team to maintain K8s + service mesh for regulated workloads | 3–5 engineers at $150K+ each; every K8s upgrade cycle requires re-validation of PCI/SOX controls across the shared infrastructure | NixOS declarative config eliminates the platform team; configuration changes are git commits with attribution — examiner evidence is generated automatically |

Full competitive reference: [KUBERNETES-COMPETITIVE-POSITIONING.md](../KUBERNETES-COMPETITIVE-POSITIONING.md)

### AI-Era Threat Landscape Advantage

Anthropic's Project Glasswing (April 2026) demonstrated that frontier AI can discover **thousands of zero-day vulnerabilities** — including some that survived decades of human review — across every major operating system and browser. These capabilities will proliferate to attackers.

**Why this changes the calculus for financial services:**

- **Shared-kernel = fleet-wide compromise.** A single kernel zero-day — exactly the kind AI is now finding by the thousands — compromises every Docker container on the host simultaneously. A compromised kernel means every trading system, risk engine, and transaction processor on that host is exposed. Weaver's hardware boundary per MicroVM contains the blast radius to one workload — a breach in one service does not cascade to the CDE or core banking systems on the same node.
- **Patch at the speed of AI discovery.** FFIEC CAT expects patch management processes that keep pace with threat velocity. When AI discovers vulnerabilities faster than quarterly patch cycles, examiners will ask "how quickly did you deploy this fix across your fleet?" NixOS's `flake.lock` pins every dependency by hash. Pin the fix, rebuild, deploy via Colmena — every node converges deterministically. SOX audit trails capture exactly when every system was patched, not "we believe it was patched."
- **Supply-chain verifiability.** Glasswing explicitly targets open-source and supply-chain security. Financial services infrastructure depends on open-source components throughout the stack. NixOS's content-addressed store makes the entire supply chain formally verifiable — every package identified by its complete dependency tree hash, not a mutable tag. When an examiner asks "was this component compromised?", the answer is a hash comparison that satisfies both PCI-DSS patch verification and SOX change control requirements.
- **Hypervisor diversity.** Weaver's 5 hypervisor options mean a vulnerability in one doesn't cascade to workloads on another — defense through diversity against AI-augmented exploit discovery. CDE workloads can run on a different hypervisor than general banking applications, reducing the blast radius of any single hypervisor zero-day.

---

## 7. Objection Handling {#7-objection-handling}

### "We need a platform our FFIEC examiner has seen before"

Examiners assess controls, not platforms. FFIEC IT handbooks define requirements around configuration management, access controls, audit trails, and business continuity — not around specific vendor products. Weaver's declarative model produces stronger evidence than any imperative platform because the documentation IS the system. Show your examiner a `git log` — that's stronger than any screenshot.

### "Our SOX auditors require specific tooling"

SOX 404 requires access controls and change documentation — not specific tools. Per-VM RBAC produces access control evidence at finer granularity than VMware or Proxmox. Git-based audit logs produce change documentation that is tamper-evident by construction. Your external auditors will see better evidence, not different evidence.

### "We're PCI-DSS certified — we can't change our CDE infrastructure"

You don't have to change your CDE infrastructure on day one. Start with non-CDE workloads — development, testing, back-office systems. Prove the declarative model, then plan CDE migration with your QSA. Our Accelerate program ($15,000/yr) includes PCI-DSS scoping assistance. The managed bridges make CDE boundary definition explicit in code — QSAs prefer auditable boundaries over manually documented ones.

### "NixOS isn't in the FFIEC technology stack guidance"

NixOS roots go back to 2003 and it's been shipping stable releases for 12 years — 100K+ packages, ~466 companies in production. FFIEC doesn't prescribe technology stacks — it prescribes control outcomes. NixOS's declarative model satisfies configuration management controls (baseline documentation, change control, drift prevention) more completely than any imperative OS. The FFIEC IT Examination Handbook tests whether controls are implemented and documented, not whether you use a specific OS.

### "What about regulatory record retention requirements?"

Git history provides tamper-evident, append-only records of all infrastructure changes. For SEC Rule 17a-4 WORM requirements, git archives can be exported to WORM-compliant storage. The Accelerate program includes assistance mapping Weaver's audit capabilities to your specific retention requirements. The declarative audit trail is stronger than most purpose-built compliance tools.

### "We can't migrate off VMware mid-audit cycle"

We offer migration services ($5,000–20,000) that run in parallel with your existing deployment. Start with non-examined workloads, prove the model, and plan the full migration to align with your next examination cycle. Our hub-agent multi-node architecture (v2.0+) manages both environments from one dashboard during transition.

### "Our board requires SOC 2 from all vendors"

We're on the certification path. In the interim, the Accelerate success program ($15,000/yr) includes compliance mapping documenting how Weaver controls satisfy SOC 2 Trust Service Criteria. Our declarative audit trail is stronger than most SOC 2-certified competitors because it's architectural, not process-dependent.

### "We have existing RHEL/Ubuntu servers we can't immediately convert"

Install `weaver-observer` on them. Existing infrastructure appears in Fabrick immediately — container and VM visibility, no NixOS required. Observer nodes are free up to 5× your Managed node count. Convert your most compliance-sensitive systems first (payment processing, SOX-scoped workloads, CDE infrastructure); observe the rest during planned migration cycles. The compliance evidence (SOX access controls, FFIEC audit trail, PCI-DSS segmentation) applies only to Managed hosts — the fleet map makes this explicit for examiners. `Observed` badge means outside the compliance boundary; no examiner confusion.

### "OCC/FFIEC third-party risk management requires us to assess vendor software security practices"

OCC Bulletin 2013-29 and FFIEC guidance require documented third-party risk assessment covering software security. Weaver's vendor assessment package: testing benchmark scored A/A+ against fabrick standards — 1,500+ tests, 24 custom static auditors including SAST/OWASP patterns and supply chain SHA pinning on every push (`docs/TESTING-ASSESSMENT.md`). Formal CVD policy with 48-hour acknowledgment and 7-day critical fix SLAs — `SECURITY.md`. Documented disaster recovery procedures — `docs/setup/DISASTER-RECOVERY.md`. Release process with legal review gate and insurance carrier touchpoint before shipping features that change the liability surface. For NYDFS 23 NYCRR 500.11 third-party service provider assessments, these documents fulfill the security assessment requirement directly.

---

## 8. Buyer Personas {#8-buyer-personas}

### CISO / VP of Information Security

**Cares about:** Examination readiness, incident response capability, regulatory notification windows, vendor risk, board reporting
**Lead with:** Zero-drift architecture eliminates an entire class of examination findings. Declarative audit trail satisfies FFIEC, SOX, and PCI-DSS audit requirements by construction. 36-hour notification readiness via AI diagnostics. Self-hosted = no vendor concentration risk finding.
**Tier:** Fabrick + Accelerate or Partner

### Chief Compliance Officer

**Cares about:** Examination findings, remediation timelines, annual certifications (NYDFS), board reporting
**Lead with:** Every infrastructure examination finding Weaver can close is one fewer board-reported item. Declarative config means NYDFS annual certification evidence is always current — not a pre-certification scramble. SOX 404 access control documentation is generated automatically.
**Tier:** Fabrick (they'll champion the purchase internally)

### VP of IT Infrastructure / CTO

**Cares about:** Operational efficiency, VMware cost post-Broadcom, staff time on compliance vs innovation, BCP/DR readiness
**Lead with:** Live Provisioning eliminates rebuild cycles. 60–80% cost reduction vs VMware. Staff time redirected from evidence compilation to actual security work. BCP testing becomes routine — deploy the config, system is identical.
**Tier:** Fabrick

### IT Manager (Community Bank / Credit Union)

**Cares about:** Budget, simplicity, FFIEC examination prep, wearing multiple hats
**Lead with:** $149/yr (FM) vs EUR355+/socket for Proxmox. AI diagnostics for the 2 AM call. Config-as-code means your examination evidence is already done. Zero drift = one less thing the examiner can cite.
**Tier:** Weaver

### QSA / PCI Assessor (Influencer)

**Cares about:** Clear CDE scope, documented network segmentation, audit trail completeness, evidence quality
**Lead with:** Managed bridges make CDE boundaries explicit in code — no ambiguity in scoping. Git-based audit trail captures every change with attribution. Zero drift means the assessed environment matches the documented environment. Makes their job easier.
**Tier:** Fabrick (they'll recommend it to their banking clients)

### Internal Audit Director

**Cares about:** ITGC testing, access control evidence, change management documentation, evidence quality for external auditors
**Lead with:** RBAC state is the documentation — no manual access review compilation. Git history is the change management evidence — no after-the-fact documentation. Declarative config means ITGC evidence is continuous, not periodic.
**Tier:** Fabrick

---

## 9. Discovery Questions {#9-discovery-questions}

Use these to qualify financial services prospects and identify pain:

### Infrastructure Pain
- How do you currently provision new VMs for banking applications? How long does it take?
- When was the last time an examiner cited configuration drift between your documentation and running systems?
- How many infrastructure management tools does your IT team use daily?
- What's your current RTO for core banking system recovery? Can you demonstrate it?

### Compliance Pain
- How many open FFIEC examination findings involve infrastructure configuration, access controls, or audit trails?
- How long does your team spend preparing infrastructure evidence for FFIEC examinations or SOX audits?
- How do you currently prove to examiners that your running configurations match your documented baselines?
- How do you enforce and document CDE network segmentation for PCI-DSS?
- Are you subject to NYDFS 23 NYCRR 500? How do you prepare for annual CISO certification?

### Budget Pain
- What are you paying annually for VMware/Proxmox licensing?
- How much of your IT staff time goes to infrastructure management vs compliance/security work?
- Have your VMware costs changed since the Broadcom acquisition?
- What do you spend on configuration scanning / drift detection tools?

### Strategic Pain
- Are you preparing for a PCI-DSS v4.0 assessment? What's your timeline?
- How concerned is your board about cloud vendor concentration risk?
- Have your examiners raised vendor risk or concentration risk as a finding?
- Are you considering alternatives to VMware after the Broadcom pricing changes?

### AI Threat Landscape
- "If a frontier AI discovered a zero-day in your host kernel tomorrow — which Project Glasswing has demonstrated is now routine — how many trading systems and transaction processors would be compromised simultaneously? How quickly could you prove to FFIEC examiners that the patch propagated to every node in your CDE?"
- "Glasswing's 90-day public disclosure cycle means your competitors will know about vulnerabilities found in your stack. Can your current infrastructure prove it's patched faster than the disclosure window — before the next PCI-DSS scan or FFIEC examination?"

---

## 10. Quant AI & Cloud Burst (Fabrick v3.0+) {#10-quant-ai--cloud-burst-fabrick-v30}

**Full analysis:** [business/FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md)

Financial services organizations are among the largest ML/AI compute consumers outside of Big Tech: quantitative trading strategy development, risk model training (Monte Carlo simulations, VaR models), fraud detection pattern recognition, credit scoring model updates, and customer analytics. These are GPU-intensive, burst-heavy workloads — a quant team might need 8 H100s for 10 days to train a new strategy model, then nothing for six weeks. Standard cloud burst (shared tenancy) is blocked by the compliance constraints that define financial services IT.

### The Compliance Gap Cloud HPC Doesn't Solve

For financial institutions, shared-tenancy cloud burst creates regulatory exposure on multiple fronts:

- **OCC/FFIEC vendor concentration risk** — Examiners flag single-cloud dependency as a material risk. Burst training runs that create operational dependency on a shared cloud provider generate exactly this finding
- **PCI DSS CDE isolation** — Any burst node that processes or connects to systems holding cardholder data must satisfy PCI DSS segmentation requirements; shared cloud tenancy creates scope expansion and audit complexity
- **SEC/FINRA books and records (17a-4)** — Training runs on financial data (order flow, customer behavior) create data handling questions that shared tenancy does not cleanly answer
- **NYDFS 23 NYCRR 500** — Multi-tenancy cloud for training on nonpublic financial information requires documented controls that satisfy NYDFS §500.14; dedicated tenancy is the easier path but eliminates cost savings

Large banks and trading firms also face internal model risk management requirements (SR 11-7) that require documented, reproducible model development environments — something that ephemeral shared cloud instances cannot provide by construction.

**Fabrick + Weaver burst nodes resolve this:** MicroVM hardware isolation satisfies the data isolation requirements that shared tenancy cannot. The burst node enrolls via WireGuard tunnel into the firm's controlled fabric — data stays in-network, isolated from other tenants by hardware boundary rather than namespace. Fabrick's declarative audit trail documents the entire burst node lifecycle for SR 11-7 model risk governance.

### The Pitch for Quant / Risk AI Teams

*"Your quant team's risk model needs 4 H100s for 10 days to train on your order flow data. Your compliance team says that data can't go on a shared cloud instance without creating a PCI scope problem and a vendor concentration finding. Fabrick enrolls a dedicated burst node with hardware-isolated MicroVMs — your training run stays inside your compliance boundary while CoreWeave provides the compute. $20/node-day Fabrick licensing. When the run completes, the node deregisters and the audit trail is in your git history for SR 11-7."*

### Licensing for Burst Nodes

Quant AI burst nodes (1–2TB RAM tier) use per-node-day consumption stacking on the Contract tier base:

| License component | Coverage |
|---|---|
| Contract base (Fabrick $2,500/yr) | Fabrick control plane + persistent nodes |
| Contract block ($2,000 first block) | 512GB+ RAM per burst node |
| Burst add-on (~$20/node-day) | Per-day charge while burst node is enrolled |

**Example:** Quant team, 4 burst nodes, 4 strategy training runs/yr (10 days each):
- Cloud compute (dedicated): 4 × 40 days × $600/day = $96,000/yr
- Fabrick burst licensing: 160 node-days × $20 = $3,200/yr
- **Fabrick as % of compute: 3.3%** — compliance posture and SR 11-7 audit trail at rounding-error cost

### New Buyer Persona: Head of Quant Technology / Model Risk IT Engineer

**Profile:** Manages the compute infrastructure for a bank's quantitative research team or model risk management function. Owns the on-prem GPU cluster, burst provisioning strategy, and the compliance controls for training on proprietary financial data. The intersection of "my AI team needs more GPU capacity" and "compliance says we can't just spin up cloud instances" is their daily frustration.

**Cares about:** PCI scope control, SR 11-7 model documentation requirements, OCC vendor concentration risk, GPU utilization efficiency, reproducible training environments for model validation, burst capacity without creating new regulatory exposure.

**Lead with:** Fabrick as the layer that makes cloud burst compliant rather than risky — "the burst node extends your controlled fabric, not your exam findings." Hardware isolation satisfies the data isolation requirements shared tenancy cannot. Declarative audit trail satisfies SR 11-7 model governance documentation by construction. $20/node-day vs $600/day dedicated tenancy.

**Tier:** Contract (1TB+ nodes) + Fabrick fleet license + burst consumption add-on + Partner success program.

### Discovery Questions (Quant AI / Risk Model Platform)

- Does your quant team burst to cloud for training runs? What compliance controls are in place for those runs?
- Have your examiners raised concerns about cloud burst creating vendor concentration risk?
- How do you currently satisfy SR 11-7 model documentation requirements for ML models trained on cloud infrastructure?
- Do any of your AI training workloads touch PCI-scoped financial data? How do you manage scope during burst?
- What's the cost premium you're paying for dedicated cloud tenancy vs shared, to satisfy compliance requirements?

---

*This document complements the universal value proposition in [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md). For pricing details, see [TIER-MANAGEMENT.md](../../product/TIER-MANAGEMENT.md). For Fabrick justification, see [FABRICK-VALUE-PROPOSITION.md](../../marketing/FABRICK-VALUE-PROPOSITION.md). For cloud burst architecture and licensing, see [FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md).*

---

## Recent Changes

- **2026-03-21** — Weaver split into Solo ($149/yr (FM)) and Team ($129/user/yr (FM), 2 remote peers, v2.2.0). Added Weaver Team financial services use case: boutique firm managing primary trading host + separate risk/compliance analysis host.
- **2026-03-21** — Added Section 10: Quant AI & Cloud Burst (Fabrick v3.0+). Covers OCC/FFIEC/PCI/SR 11-7 compliance gaps that block shared-tenancy cloud burst, per-node-day licensing economics, and new Head of Quant Technology / Model Risk IT Engineer buyer persona.
- **2026-03-18** — Fabrick pricing revised to $2,000/yr first node, $750/yr additional, $500/yr at 10+. Fabrick tier added at $2,500/yr (512GB RAM). Contract tier added for 512GB+ deployments (sliding scale per 512GB block). RAM coverage noted per tier. Parallel migration / no-expertise-required positioning added as primary lead.
