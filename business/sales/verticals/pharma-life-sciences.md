<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Pharmaceutical & Life Sciences IT Sales Case
## How Weaver Eliminates Infrastructure Burden for Pharma Organizations
*Drug Manufacturers, Medical Device Companies, CROs, CDMOs & Biotech*

**Date:** 2026-03-09
**Parent doc:** [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md)
**Regulatory reference:** Pharma-Life-Sciences-IT-Compliance.md (source material)

---

## Table of Contents

1. [The Pharma IT Problem](#1-the-pharma-it-problem)
2. [Regulatory Mapping: What Weaver Addresses](#2-regulatory-mapping)
3. [Weaver for Pharma](#3-weaver-for-pharma)
4. [Fabrick for Pharma](#4-fabrick-for-pharma)
5. [GxP Deficiency Remediation Plan](#5-deficiency-remediation-plan)
6. [Pharma-Specific Competitive Advantages](#6-competitive-advantages)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Discovery Questions](#9-discovery-questions)
10. [Drug Discovery AI & Cloud Burst (Fabrick v3.0+)](#10-drug-discovery-ai--cloud-burst-fabrick-v30)

---

## 1. The Pharma IT Problem {#1-the-pharma-it-problem}

**No NixOS expertise required — ever.** Weaver runs alongside existing Docker, VMware, Proxmox, or bare-metal tooling. Migrate one workload at a time. No cutover event. No retraining.

Migrate GxP lab containers to hardware isolation with declarative audit trail by construction. 21 CFR Part 11 compliance evidence without NixOS expertise from validation teams.

Pharmaceutical and life sciences IT operates under the most technically demanding compliance regime in any industry. Regulators don't just ask "who had access?" — they ask "can you prove this data was never altered without authorization and that your systems are capable of producing trustworthy results?" That standard — codified in 21 CFR Part 11, ALCOA+ data integrity principles, and GxP validation requirements — demands a level of system validation, audit trail rigor, and change control that no other industry fully matches.

**What pharma IT should be doing:**

- Maintaining validated-state GxP systems (MES, LIMS, CDS, EDC, CTMS, eTMF) per CSV/CSA
- Enforcing ALCOA+ data integrity across every computerized system that touches regulated data
- Generating computer-generated, tamper-evident audit trails that cannot be disabled or modified
- Managing 21 CFR Part 11 compliant electronic records and electronic signatures
- Running change control processes for every infrastructure modification in GxP environments
- Qualifying instruments, validating data transfers, and maintaining periodic review schedules

**What pharma IT actually spends time doing:**

- Manually provisioning and rebuilding VMs for GxP workloads with no reproducible configuration
- Investigating configuration drift on validated systems — any change could invalidate the validated state
- Generating validation evidence by exporting logs from disconnected systems into change control binders
- Documenting infrastructure changes after the fact for GxP change control records
- Rebuilding environments after failures with no guarantee the rebuilt system matches the validated state
- Managing separate tools for access control, audit logging, and change management — each requiring its own validation

**Weaver eliminates the second list so IT can focus on the first.**

---

## 2. Regulatory Mapping: What Weaver Addresses {#2-regulatory-mapping}

### Direct Compliance Impact

> **Version key:** v1.0 = shipped today. v1.1+ / v1.2+ = on roadmap. NixOS = host OS capability (not a dashboard feature). Capabilities without a version tag are v1.0.

| Regulation / Standard | IT Obligation | Weaver Capability | Tier | Available |
|----------------------|--------------|------------------------------|:----:|:---------:|
| **21 CFR Part 11** — Audit Trails | Computer-generated, tamper-proof audit trails; capture who/what/when/original value; available for FDA inspection | Git-based declarative audit log — every change is a commit with author, timestamp, diff, and reason. Tamper-evident by construction (cryptographic hash chain). Cannot be disabled | Fabrick | v1.0 |
| **21 CFR Part 11** — Access Controls | Unique user IDs, appropriate authority levels, periodic review | Per-VM RBAC with role-based authority (viewer/operator/admin); unique user accounts enforced at API level; SSO/SAML/LDAP for centralized identity | Fabrick | v1.0 (RBAC), v1.2+ (SSO/LDAP) |
| **21 CFR Part 11** — System Validation | Validated before use; maintained in validated state | NixOS declarative model = system state is code. IQ/OQ/PQ can be expressed as reproducible builds. The validated state is maintained by construction — drift is impossible | Weaver+ | v1.0 |
| **GMP — 21 CFR 210/211 / EU Annex 11** | Validated manufacturing systems; backup & recovery; complete batch record infrastructure | Declarative config = reproducible infrastructure state. Sub-second VM recovery (Firecracker). Git history proves every change to manufacturing system infrastructure | Weaver+ | v1.0 |
| **EU GMP Annex 11** — Computerised Systems | Supplier assessment, validation, audit trails, change & configuration management, periodic evaluation | Single-vendor infrastructure (reduces supplier qualification scope). Built-in audit trail, declarative change control, configuration management by construction | Fabrick | v1.0 |
| **ALCOA+ Data Integrity** | Attributable, Legible, Contemporaneous, Original, Accurate, Complete, Consistent, Enduring, Available | Git commits = Attributable (author) + Contemporaneous (timestamp) + Original (immutable hash chain) + Complete (full diff) + Enduring (persistent history). Zero drift = Accurate + Consistent | Weaver+ | v1.0 |
| **GLP — 21 CFR Part 58** | Validated LIMS; ALCOA+ for raw data; instrument data system qualification | Infrastructure-level ALCOA+ enforcement — the platform hosting LIMS is itself audit-trailed and change-controlled | Weaver+ | v1.0 |
| **GCP — ICH E6(R2)** | Clinical trial system validation; data transfer validation; Part 11 compliance for clinical systems | Validated infrastructure hosting for EDC, CTMS, eTMF systems. Declarative config means clinical system infrastructure is reproducible across sites | Weaver+ | v1.0 |
| **FDA Data Integrity Guidance (2018)** | Audit trails cannot be disabled; no shared credentials; no unjustified deletions | Git-based audit trail is architecturally non-disableable. Per-user accounts enforced. Declarative model prevents ad-hoc deletions — every state is explicitly declared | Fabrick | v1.0 |
| **FDA Medical Device Cybersecurity** | SBOM, vulnerability management, coordinated disclosure | Self-hosted infrastructure reduces attack surface for connected device networks. Managed bridges isolate device VLANs declaratively. NixOS declarative model = auditable component inventory | Weaver+ | v1.0 |
| **GxP Change Control** | Every change to validated systems must go through change control; emergency changes need retrospective documentation | Git workflow IS the change control process — every change requires a commit (documenting what/who/why), review is built into the workflow, history is immutable | Weaver+ | v1.0 |
| **DEA EPCS** (if applicable) | Two-factor authentication, identity proofing to IAL2/AAL2, audit logs | TOTP/FIDO2 MFA (v1.1). SSO integration with IAL2-capable identity providers (v1.2+). Per-user audit trail for all actions | Fabrick | v1.1 (MFA), v1.2+ (SSO) |

### Indirect Compliance Support

| Pharma IT Function | IT Pain Today | How Weaver Helps |
|-------------------|--------------|----------------------------|
| **CSV/CSA Validation Lifecycle** | IQ/OQ/PQ documentation for infrastructure is manual, labor-intensive, and version-fragile | Declarative config is self-documenting IQ (install = declare). OQ/PQ evidence is reproducible. Re-validation after changes is trivial — the diff IS the change impact assessment |
| **Periodic Reviews** | Annual reviews of validated systems require proving nothing changed (or that changes were controlled) | Git log between review dates shows exactly what changed, who approved, and why. No changes = empty diff = review complete |
| **Multi-Site Consistency** | Ensuring manufacturing/lab infrastructure is identical across sites | Declarative configs are portable — same NixOS config = identical system state at every site |
| **Vendor Qualification** | Each infrastructure tool requires supplier assessment per Annex 11 | Single vendor (Weaver) replaces multiple tools = one supplier assessment instead of five |
| **CRO/CDMO Client Isolation** | Contract organizations must isolate client data and environments | Per-VM RBAC + managed bridges create client-specific enclaves with independent access controls and audit trails |
| **Instrument Data Integrity** | Chromatography data systems, LIMS — high FDA scrutiny | Weaver manages the infrastructure hosting these systems, not the instruments themselves. Infrastructure-level audit trail + zero drift provides a trusted foundation |

---

## 3. Weaver for Pharma {#3-weaver-for-pharma}

**Target:** Small biotech, CROs with <50 staff, pharmaceutical startups, medical device companies, lab IT teams

**Price:**
- **Weaver Solo** — $149/yr (FM, first 200) per node (admin only, local only, up to 128GB RAM)
- **Weaver Team** — $129/user/yr (FM, first 50 teams) (2–4 users + 1 viewer free, up to 2 remote peer Weaver hosts with full management, up to 128GB RAM/host). Ships v2.2.0.

**The pitch:** "An FDA investigator asks 'show me your change control records for this system's infrastructure.' With Proxmox, you pull up a spreadsheet. With Weaver, you show them a git log — every change, every author, every timestamp, every reason — and tell them 'drift is architecturally impossible.' That's a conversation you want to have."

### Key Weaver Wins for Pharma

| Capability | Pharma Value |
|-----------|-------------|
| **Live Provisioning** | Spin up isolated VMs for new GxP workloads without SSH + rebuild cycles. Validated-state environments in minutes, not days |
| **Zero Configuration Drift** | The single biggest Part 11 / Annex 11 compliance win. Once a system is validated, it stays validated — by construction, not by process. No periodic drift scans needed |
| **AI Diagnostics** | When a GxP system fails during a batch run, natural language diagnosis accelerates root cause analysis. Better deviation documentation for quality investigations |
| **Managed Bridges + IP Pools** | Declarative network segmentation — isolate GMP manufacturing systems from R&D, lab systems from office networks. Foundation for client isolation at CROs/CDMOs |
| **Sub-Second VM Boot** | Manufacturing system downtime = batch failure. Firecracker <125ms boot means replacement VMs are running before the deviation timer starts |
| **Multi-Hypervisor** | Run high-security GxP workloads on Firecracker (minimal attack surface), development workloads on QEMU — one dashboard, one change control process |
| **SLURM-Native Integration** (computational pharma) | Biotech and pharma companies running computational pipelines — molecular dynamics (GROMACS, AMBER), genomics/NGS, QSAR modeling, protein structure prediction — can co-deploy SLURM alongside Weaver on the same NixOS host. Each batch job runs in a hardware-isolated MicroVM; the node returns to a GxP-validated baseline at job end. Computational HPC workloads share hardware with GxP systems without compliance isolation concerns. CROs benefit particularly: each client's pipeline jobs run in client-isolated MicroVMs with independent audit trails |

### ROI for a 40-Person Biotech

| Current Cost | With Weaver |
|-------------|----------------------|
| Proxmox: EUR355/socket x 3 sockets = **EUR1,065/yr** | 3 nodes x $149 = **$447/yr (Solo)** |
| 1 IT admin spending 12 hrs/week on VM management at $70/hr = **$43,680/yr** | Reclaim 7 hrs/week = **$25,480/yr freed** for validation and compliance work |
| CSV documentation for infrastructure: 3 weeks/yr = **$8,400** | Declarative config is self-documenting — infrastructure IQ/OQ evidence is the git repo |
| Change control documentation (retrospective): **$5,000–10,000/yr** | $0 — git workflow IS the change control process |
| **Total current cost: ~$58,145–63,145/yr** | **Weaver: $447/yr + $33,880 labor freed** |

### Weaver Team for Pharma

**The scenario:** A small CRO or biotech team runs a primary compute host alongside a dedicated GPU host for AI/ML workloads or LLM-based drug discovery pipelines. The team wants to monitor both from a single Weaver view — confirming the AI workload VM is consuming expected RAM, checking whether the pipeline is still running — without the overhead and cost of an Fabrick deployment.

Weaver Team (v2.2.0) shows remote peer workloads in the existing Weaver view with a host badge on each workload card. Researchers see resource utilization and job status across both hosts. Management actions on the remote host (restart, provision, stop) are fully available — the team can manage both hosts from one view.

| Team Use Case | Weaver Team Capability |
|--------------|------------------------|
| **Primary compute + GPU host monitoring** | See GPU host workloads in the Weaver view — RAM consumption, run state, host badge — from the primary node's dashboard |
| **Drug discovery pipeline oversight** | Confirm LLM inference VMs and ML training pipelines are running and within expected resource bounds without SSH access to the GPU node |
| **Peer discovery** | Tailscale MagicDNS peer discovery or manual IP entry — no infrastructure change required to connect a second host |
| **2-peer cap** | Covers primary host + GPU host + one additional (storage node, secondary compute) — sufficient for most small CRO/biotech setups without a full Fabrick deployment |

**21 CFR Part 11 note:** Full management of up to 2 remote peers is included in Weaver Team. When the team needs more than 2 remote peers, fleet-scale governance, per-VM RBAC, or centralized audit trail aggregation across the fleet, that requires Fabrick. Upgrade trigger: the team outgrows the 2-peer cap or needs fleet-scale compliance controls.

**ROI for a 2-person CRO team (primary + GPU host, Weaver Team):**

| | Current | With Weaver Weaver Team |
|---|---|---|
| Primary host | Manual monitoring via SSH | Weaver dashboard with full local management |
| GPU host | Separate SSH session, no unified view | Appears in Weaver view with host badge — one pane of glass |
| Team cost | $0 licensing + untracked admin time | 3 users × $129/user/yr (FM) = **$387/yr** |
| GPU host oversight | Ad-hoc; easy to miss runaway jobs | Weaver alerts on resource anomalies across both hosts |

---

## 4. Fabrick for Pharma {#4-fabrick-for-pharma}

**Target:** Mid-to-large pharma manufacturers, multi-site organizations, CROs/CDMOs with client isolation requirements, medical device companies with connected device infrastructure, organizations pursuing EU GMP Annex 11 compliance

**Price:** $2,000/yr first node + $750/yr additional + $500/yr at 10+ nodes (up to 256GB RAM)

**The pitch:** "Your next FDA inspection will start with 'show me your audit trail.' With Weaver, the audit trail is the system — every configuration change, who made it, who approved it, and why, in a cryptographic hash chain that no one can tamper with. That's not just compliance — that's data integrity by design."

### Fabrick Features Mapped to Pharma Obligations

| Fabrick Feature | Pharma Requirement Addressed | Evidence Produced | Available |
|-------------------|------------------------------|-------------------|:---------:|
| **Per-VM RBAC** | 21 CFR Part 11 — access limited to authorized individuals; unique user IDs; authority levels | Role assignments per VM; per-user activity logs; least-privilege enforcement at infrastructure level | v1.0 |
| **SSO/SAML/LDAP** | 21 CFR Part 11 — unique individual identification; no shared credentials; periodic access review | Integration with corporate Active Directory; single identity source; automated provisioning/deprovisioning tied to HR systems | v1.2+ |
| **Declarative Audit Log** | 21 CFR Part 11 — computer-generated audit trail; ALCOA+ Attributable/Contemporaneous/Original | Git commit history: who, what, when, why, original value — cryptographic hash chain, non-disableable, immutable | v1.0 |
| **Bulk VM Operations** | GxP change control — fleet-wide changes must be controlled and documented | Fleet-wide policy changes applied atomically, each documented as a single auditable change record | v1.0 |
| **Resource Quotas** | GMP — manufacturing systems must not be affected by other workloads | Resource limits prevent non-GxP workloads from starving manufacturing system VMs | v1.0 |
| **All Plugins Included** | EU Annex 11 — security, incident management, configuration management | Firewall (nftables), DNS, AppArmor/Seccomp, kernel hardening — complete security stack validated as one unit | v1.0 (DNS v1.1, firewall/hardening v1.2) |
| **Managed Bridges** | 21 CFR Part 11 — closed vs open systems; network boundary enforcement | Declarative network segmentation defines GxP system boundaries. Closed-system controls enforced at the network level | v1.0 |

### Fabrick Success Programs for Pharma

| Program | Pharma Application | FM Price | Standard Price |
|---------|-------------------|:--------:|:--------------:|
| **Adopt** | NixOS + Weaver onboarding course (LMS) + 3 live sessions; 21 CFR Part 11-aware deployment playbook; GxP infrastructure qualification guidance | $5,000/yr | $15,000/yr |
| **Adopt — Compliance** | Everything in Adopt + Part 11 / Annex 11 config mapping session, ALCOA+ evidence walkthrough, CSV/CSA IQ documentation for Weaver infrastructure | — | $25,000/yr |
| **Accelerate** | All Adopt content; dedicated Slack; quarterly fleet reviews mapped to Part 11 and Annex 11 requirements; CSV/CSA documentation templates; audit trail review procedures; QMS integration; LMS modules for periodic review workflows | $15,000/yr | $45,000/yr |
| **Partner** | Named engineer who understands GxP environments; priority features for pharma-specific needs (LIMS hosting templates, CDS isolation patterns, multi-site consistency tooling); FDA inspection preparation; Annex 11 supplier assessment documentation; sessions on demand | $30,000/yr | $90,000/yr |

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = $9,000/yr total compliance coverage during the FM period. Standard Adopt — Compliance ($25,000/yr) includes hands-on compliance service delivery not covered by the extension alone.

### ROI for a Mid-Size Pharma Manufacturer (25 Nodes)

| Cost Category | Current State | With Fabrick |
|-------------|--------------|----------------------------------|
| Infrastructure software | VMware: $15,000–45,000/yr | 25 nodes: $15,500/yr |
| CSV/validation staff time (2 analysts, 40% on infrastructure validation) | $80,000/yr | Redirect to application-layer validation — infrastructure validation is declarative |
| Change control documentation | 5 weeks/yr across team = $25,000 | < 1 week — git workflow IS change control |
| Periodic review effort | 3 weeks/yr per system x multiple systems = $30,000 | Git diff between review dates — hours instead of weeks |
| Supplier qualification | 5+ infrastructure vendors = 5+ supplier assessments | 1 vendor, 1 assessment, open-core codebase auditable |
| Success program | N/A | Accelerate: $15,000/yr (FM) |
| **Total** | **$150,000–180,000/yr** | **$30,500/yr + validation staff redirected** |

### Compliance Export Extension

**Price:** $4,000/yr flat (per organization — not per node) · stacks on Fabrick subscription
**Available:** v2.2 (21 CFR Part 11, EU Annex 11 export) · v3.0 (scheduled delivery)

The Compliance Export extension generates 21 CFR Part 11 and EU GMP Annex 11 evidence packages from Weaver's existing configuration artifacts. Periodic review that takes weeks takes hours. FDA inspection readiness is perpetually current.

| Feature | GxP Requirement Addressed | Available |
|---------|--------------------------|:---------:|
| **21 CFR Part 11 audit trail export** | §11.10(e) — computer-generated, time-stamped audit trail with original values; formatted for FDA inspection | v2.2 |
| **EU Annex 11 audit trail export** | §9 — change log with author, date, reason; formatted for EU GMP inspector | v2.2 |
| **Signed configuration attestation** | ALCOA+ (Original, Accurate) — cryptographically signed config snapshot proving running validated state at attestation timestamp | v2.2 |
| **Periodic review export** | Annex 11 §11 — git diff between review dates generates the periodic review evidence in hours, not weeks | v2.2 |
| **Scheduled export delivery** | Annual validation review package delivery; FDA inspection preparation package | v3.0 |

**Positioning:** "Your next 483 observation will not be about configuration drift. It can't be. When the FDA inspector asks for your change record, you hand them a signed package — not a binder assembled over 3 weeks." See [COMPLIANCE-EXPORT-EXTENSION.md](../../product/COMPLIANCE-EXPORT-EXTENSION.md) for full feature spec.

---

## 5. GxP Deficiency Remediation Plan {#5-deficiency-remediation-plan}

FDA Warning Letters, 483 observations, and EU GMP non-compliances frequently trace to infrastructure that doesn't produce adequate audit trails, enforce change control, or maintain validated state. Weaver closes these gaps — and the fastest wins start at Weaver.

### The Sales Motion: Close Audit Findings to Justify the Purchase

Every unresolved 483 observation is a step closer to a Warning Letter. Every Warning Letter is visible on the FDA's public database — damaging to partnerships, investor confidence, and market credibility. Frame Weaver as a CAPA (Corrective and Preventive Action) implementation tool for infrastructure-related findings.

### Phase 1: 21 CFR Part 11 & Data Integrity Quick Wins (Weaver)

These are the findings FDA investigators cite most frequently. Weaver addresses the infrastructure layer — the foundation on which all GxP systems sit.

| Common Finding Category | FDA/EMA Citation | How Weaver Closes It | CAPA Impact | Available |
|------------------------|-----------------|----------------------|:-----------:|:---------:|
| **Audit trails disabled or not reviewed** | 21 CFR 11.10(e); MHRA DI Guidance | Git-based audit trail is architecturally non-disableable. Every infrastructure change generates a commit automatically. Trail exists by construction, not configuration | Closes for infrastructure layer | **v1.0** |
| **Configuration changes not documented** | 21 CFR 11.10(e); EU Annex 11 §10 | Every change is a git commit — who, what, when, why, and the complete diff. Retrospective documentation is impossible to forget because the documentation IS the change mechanism | Closes immediately | **v1.0** |
| **Shared login credentials** | 21 CFR 11.10(d); 21 CFR 11.300 | Per-user accounts enforced at API level. No shared credentials possible — each action traced to individual user. LDAP integration (v1.2+) syncs with corporate directory | Closes (local), fully closes (LDAP) | v1.0, **v1.2+** (LDAP) |
| **System not maintained in validated state** | 21 CFR 11.10(a); EU Annex 11 §4 | NixOS declarative model = the running system is mathematically identical to the declared configuration. Drift is impossible. The validated state is permanent by construction | Closes immediately | **v1.0** |
| **Inadequate backup and recovery** | EU Annex 11 §7.2; 21 CFR 211.68 | Declarative config = full system state is version-controlled. Sub-second VM recovery (Firecracker). Restored system is guaranteed identical to pre-failure state | Substantially improves | **v1.0** |
| **No baseline configuration documented** | 21 CFR 11.10(a); ICH Q9 | NixOS config IS the baseline documentation — human-readable, version-controlled, and always current. No separate baseline document needed | Closes immediately | **v1.0** |
| **Change control not followed for infrastructure** | EU Annex 11 §10; 21 CFR 211.68 | Git workflow enforces change control by construction. No change can be made without a commit. Review/approval is built into the git workflow, not bolted on as a separate process | Closes immediately | **v1.0** |

**Audit Impact:** A pharma company with infrastructure-related 483 observations can close 5–7 finding categories by deploying Weaver. These findings are disproportionately common because legacy infrastructure (VMware, Proxmox, bare metal) has no built-in mechanism to enforce audit trails or prevent drift.

### Phase 2: Access Governance & Identity Controls (Fabrick)

These findings require granular access management and integration with corporate identity systems. Fabrick features close the access-related Part 11 requirements.

| Common Finding Category | FDA/EMA Citation | How Fabrick Closes It | CAPA Impact | Available |
|------------------------|-----------------|-------------------------|:-----------:|:---------:|
| **Access not limited to authorized individuals** | 21 CFR 11.10(d) | Per-VM RBAC — granular access control at individual VM level. Viewer/operator/admin roles enforce least privilege | Closes | **v1.0** |
| **No authority checks for privileged functions** | 21 CFR 11.10(f) | Fabrick role model separates read-only, operational, and administrative functions with API-level enforcement | Closes | **v1.0** |
| **Access not periodically reviewed** | 21 CFR 11.10(d); EU Annex 11 §12.1 | RBAC assignments are declarative and auditable. SSO/LDAP integration (v1.2+) enables automated access review against HR/directory source | Closes fully | v1.0 (manual review), **v1.2+** (automated) |
| **Electronic signatures not linked to records** | 21 CFR 11.70 | Git commits cryptographically link the author (signature) to the change record (diff). The linkage is inherent in the data structure, not a software feature that can be misconfigured | Closes for infrastructure changes | **v1.0** |
| **No mechanism to detect unauthorized access** | 21 CFR 11.10(d); EU Annex 11 §12.3 | All API access is authenticated and logged. Failed access attempts recorded. RBAC enforcement means unauthorized actions are prevented, not just detected | Closes | **v1.0** |
| **Closed/open system controls inadequate** | 21 CFR 11.10 / 11.30 | Managed bridges declaratively define closed-system network boundaries. Self-hosted deployment = no open-system exposure unless explicitly configured | Closes | **v1.0** |
| **User identity not verified before system access** | 21 CFR 11.300(b) | Local authentication (v1.0), TOTP/FIDO2 MFA (v1.1), SSO with corporate identity provider and MFA (v1.2+) | Closes fully | v1.0 → v1.1 → **v1.2+** |

**Audit Impact:** Fabrick closes the access control and electronic signature findings that drive the most severe FDA enforcement actions. These are the findings that escalate from 483 observations to Warning Letters because they call into question whether data was generated by authorized personnel.

### Phase 3: Validation Lifecycle & Process Controls (Success Programs)

Some GxP requirements are process-oriented — they require documented procedures, periodic activities, and organizational capabilities. Success programs help pharma organizations close these.

| GxP Requirement | Regulatory Reference | How Success Programs Help | Program |
|----------------|---------------------|--------------------------|:-------:|
| **System validation (IQ/OQ/PQ)** | 21 CFR 11.10(a); EU Annex 11 §4 | Accelerate includes infrastructure qualification templates and guidance. Declarative config simplifies IQ (install = declare) and OQ (config = specification) | Accelerate |
| **Periodic review of validated systems** | EU Annex 11 §11 | Quarterly fleet reviews in Accelerate generate periodic review evidence. Git diff between review dates documents all changes | Accelerate |
| **Supplier assessment / qualification** | EU Annex 11 §3.2 | Partner program provides Annex 11 supplier assessment documentation for Weaver. Open-core codebase supports audit requirements | Partner |
| **Business continuity / disaster recovery** | EU Annex 11 §16; 21 CFR 211.68 | Partner program includes DR planning for GxP infrastructure. Declarative config means recovery produces identical systems, provably | Partner |
| **Incident management procedures** | EU Annex 11 §13 | Accelerate includes incident classification framework for GxP infrastructure events. AI diagnostics support root cause analysis for deviation reports | Accelerate |
| **Data migration validation** | EU Annex 11 §17 | Partner program supports infrastructure migration validation — declarative config makes source/target comparison deterministic | Partner |
| **Training and competency records** | EU Annex 11 §2; 21 CFR 211.25 | Adopt program includes NixOS training for pharma IT teams. Accelerate includes ongoing competency development | Adopt / Accelerate |

### The Full Remediation Path: Weaver → Fabrick → Partner

| Stage | Investment | Timeline | Findings Addressed | Version Required |
|-------|-----------|----------|:------------------:|:----------------:|
| **Weaver deployment** | $149–3,725/yr (1–25 nodes) | Month 1–2 | Audit trail, drift, change control, baseline config, backup/recovery (5–7 finding categories) | **v1.0 today** |
| **Fabrick upgrade** | $15,500/yr (25 nodes) | Month 3–4 | Access controls, authority checks, e-signatures, unauthorized access detection (5–7 additional categories) | **v1.0 today** |
| **v1.1 auth plugins** | Included in tier | With v1.1 release | MFA for electronic signatures (TOTP/FIDO2) — strengthens 21 CFR 11.300 | v1.1 |
| **v1.2 security plugins** | Included in Fabrick | With v1.2 release | SSO/LDAP (automated access review), firewall (closed-system boundary enforcement), hardening | v1.2 |
| **Accelerate program** | $15,000/yr | Month 4–6 | Validation lifecycle (IQ/OQ/PQ templates), periodic review, incident management | Service — any version |
| **Partner program** | $30,000/yr | Ongoing | Supplier assessment, DR planning, data migration validation, FDA inspection preparation | Service — any version |
| **Cumulative (v1.0 today)** | | **Immediate** | **10–14 finding categories with direct evidence** | **Available now** |
| **Cumulative (through v1.2)** | | **~6 months** | **15–20+ finding categories fully closed** | v1.2 release |

**What's available today (v1.0):** A pharma company deploying Weaver + Fabrick right now closes 10–14 of the most commonly cited finding categories — audit trails, drift, change control, access governance, and electronic signatures. These are the findings that drive Warning Letters.

**What v1.2 completes:** SSO/LDAP, MFA, and firewall plugins close the remaining identity, authentication, and boundary controls, bringing comprehensive Part 11 and Annex 11 compliance for the infrastructure layer.

### Positioning the Conversation

**Discovery opener:** "When was your last FDA inspection? Were there any infrastructure-related 483 observations?"

**The bridge:** Every 483 observation that becomes a Warning Letter is on the FDA's public database — visible to partners, investors, and competitors. Weaver doesn't just manage your VMs — it closes the infrastructure findings that 483s are made of. Start with Weaver this month, close audit trail and drift findings immediately, and build toward full Part 11 compliance.

**The close:** "At $149 per node, Weaver pays for itself if it prevents a single 483 observation. Most pharma companies close 5+ finding categories in the first month."

---

## 6. Pharma-Specific Competitive Advantages {#6-competitive-advantages}

### vs VMware (Post-Broadcom)

| Factor | VMware | Weaver |
|--------|--------|-------------------|
| Cost (mid-size manufacturer) | $15,000–45,000/yr (subscription-only post-Broadcom) | $15,500/yr (25 nodes) |
| 21 CFR Part 11 audit trail | Separate audit logging, requires additional tools + validation | Built-in — every change is a git commit. Non-disableable by design |
| Configuration drift | Possible and common; requires periodic scanning and deviation reports | Impossible by construction (NixOS declarative model) |
| Validated state maintenance | Manual — any change may invalidate; re-validation required | Automatic — validated state maintained by construction; drift cannot occur |
| Change control | Process-dependent — relies on humans following procedures | Architecture-enforced — no change possible without a documented commit |
| GxP supplier qualification | Broadcom is a large, complex vendor; assessment is non-trivial | Open core, single-purpose tool, auditable codebase |
| Vendor lock-in | High — Broadcom controls pricing unilaterally | Open core, offline-first license, no phone-home |

### vs Proxmox

| Factor | Proxmox | Weaver |
|--------|---------|-------------------|
| Part 11 audit trail | API call logs — captures actions, not intent or approval | Git diffs — captures what changed, who approved, and why |
| Validated state | No — imperative management allows drift; re-validation after every change | Yes — declarative by construction; validated state is permanent |
| Change control | Manual process bolted onto tool | Built into the architecture — git workflow IS change control |
| ALCOA+ compliance | Partial — logs exist but aren't tamper-evident or linked to identity | Full — commits are attributable, contemporaneous, original, complete, enduring |
| Per-VM RBAC | Pool-level permissions only | Per-VM role assignments — critical for GxP/non-GxP isolation |
| Periodic review evidence | Manual comparison of current state to baseline document | `git log --since` between review dates — automated, complete, auditable |

### vs Cloud (AWS/Azure/GCP)

| Factor | Cloud VMs | Weaver |
|--------|-----------|-------------------|
| Data location | Shared infrastructure, requires careful configuration for regulated data | **On your premises** — regulated data never leaves your facility |
| GxP qualification | Cloud infrastructure is a shared service — your IQ/OQ doesn't control the underlying platform | Self-hosted — full control over the validated infrastructure stack |
| Cost per VM | $600–6,000+/yr per VM | Unlimited VMs per node ($149–1,500/yr per node) |
| Audit trail integrity | Cloud provider controls the logging infrastructure; you trust their implementation | Self-hosted, git-based — you control the audit trail end-to-end |
| Multi-site reproducibility | Region-specific configurations; cross-region consistency requires tooling | Declarative config is portable — same NixOS config = identical system at every site |
| Vendor qualification | Cloud providers are complex vendors; Annex 11 supplier assessment is substantial | Single-purpose infrastructure tool; open-core codebase; simpler assessment |

### Software Validation Posture (IQ/OQ/PQ)

GxP supplier qualification requires evidence that vendor software is developed and tested to a standard your QA team can assess. Weaver publishes a testing benchmark scored against enterprise standards — not buried in a supplier questionnaire, publicly available at `code/docs/TESTING-ASSESSMENT.md`:

| CSV/CSA Concern | Weaver Evidence |
|----------------|----------------|
| **IQ — does it install as specified?** | Deterministic NixOS module: same config = identical install every time. Lockfile verification auditor on every build. |
| **OQ — does it operate as specified?** | 1,500+ tests across 4 layers (unit, backend, TUI, E2E). Route guard auditor verifies every API endpoint has auth + tier enforcement. Bidirectional tier matrix enforcement — no undocumented feature gating. |
| **PQ — does it perform in production?** | 5-browser E2E (Chromium, Firefox, WebKit, Mobile, Safari) on every release. Docker-isolated, seed-data-reproducible test environment. Red team security audit completed — 21 findings, all dispositioned. |
| **Audit trail integrity** | SAST (OWASP patterns) on every push. 24 custom static auditors. Supply chain SHA pinning on all 40 GitHub Actions. |
| **Change control evidence** | Every code change triggers full test suite before merge. Git-based — change history is the test run history. |

Overall engineering benchmark: **A** against fabrick standards — A+ on static analysis depth and tier parity enforcement. Path from A to A+: `code/docs/TESTING-MATURITY-ROADMAP.md`.

For pharma QA teams preparing supplier qualification files: the benchmark document provides the structured evidence base. The Partner success program ($30,000/yr) includes supplier qualification documentation prepared for your QA team's format requirements.

### The Air-Gap Advantage

Pharmaceutical manufacturing facilities — especially those producing controlled substances (DEA Schedule I–V) or operating in high-containment environments — frequently require or prefer air-gapped infrastructure. Clinical trial sites in regions without reliable connectivity also benefit. Weaver's offline-first license validation (HMAC checksum, no phone-home) is purpose-built for disconnected environments. No competitor offers this without fabrick negotiation.

#### Kubernetes Complexity in Pharma

21 CFR Part 11 requires validated, reproducible compute environments with complete audit trails. Kubernetes pod scheduling is non-deterministic — proving that the same workload ran on the same node with the same configuration requires extensive tooling bolted onto K8s. Every K8s upgrade invalidates the validated state, triggering re-qualification cycles that cost weeks and thousands of dollars. The platform that's supposed to simplify infrastructure becomes the largest validation burden in the stack.

| K8s Overhead | Impact in Pharma | Weaver Alternative |
|---|---|---|
| Non-deterministic pod scheduling | 21 CFR Part 11 requires proof that validated compute environments are reproducible; K8s scheduler decisions are opaque and change with cluster state, requiring custom tooling to document placement for each audit | NixOS builds are bit-for-bit reproducible; snapshot provisioning produces identical VMs every time; validation = `nix build` hash comparison |
| K8s upgrade cycles invalidate validated state | Every control plane or node upgrade triggers IQ/OQ re-qualification; GxP validation teams spend weeks re-testing after routine K8s patches | NixOS declarative config maintains validated state by construction — configuration drift is impossible; upgrades are atomic and rollbackable |
| Audit trail gaps in shared K8s control plane | Part 11 requires attributable, contemporaneous, original records (ALCOA+); K8s API server logs capture actions but not intent or approval context | Git-based audit trail captures what changed, who approved, and why — ALCOA+ compliant by architecture, not by bolted-on logging |

Full competitive reference: [KUBERNETES-COMPETITIVE-POSITIONING.md](../KUBERNETES-COMPETITIVE-POSITIONING.md)

### AI-Era Threat Landscape Advantage

Anthropic's Project Glasswing (April 2026) demonstrated that frontier AI can discover **thousands of zero-day vulnerabilities** — including some that survived decades of human review — across every major operating system and browser. These capabilities will proliferate to attackers.

**Why this changes the calculus for pharma and life sciences:**

- **Shared-kernel = fleet-wide compromise.** A single kernel zero-day — exactly the kind AI is now finding by the thousands — compromises every Docker container on the host simultaneously. In pharma, that means a single exploit could breach clinical trial databases, GxP electronic records, and proprietary formulation data in one lateral move. Weaver's hardware boundary per MicroVM contains the blast radius to one workload — a compromise in one VM does not invalidate the integrity of 21 CFR Part 11 electronic records in another.
- **Patch at the speed of AI discovery.** GxP validated environments resist patching because every change triggers re-qualification. But AI-discovered zero-days don't wait for your next validation cycle. NixOS's `flake.lock` pins every dependency by hash — pin the fix, rebuild, deploy via Colmena. The rebuild produces a bit-for-bit identical system with only the patched component changed, minimizing re-validation scope. Every node converges deterministically. No "did we patch that server?" during an FDA pre-approval inspection.
- **Supply-chain verifiability.** Glasswing explicitly targets open-source and supply-chain security. Pharma relies on open-source components across LIMS, ELN, and bioinformatics pipelines. NixOS's content-addressed store makes the entire supply chain formally verifiable — every package identified by its complete dependency tree hash, not a mutable tag. When an FDA investigator asks about supply-chain integrity, the answer is a cryptographic hash comparison — not a vendor questionnaire.
- **Hypervisor diversity.** Weaver's 5 hypervisor options mean a vulnerability in one doesn't cascade to workloads on another — defense through diversity against AI-augmented exploit discovery. GxP-validated workloads can run on a different hypervisor than research and development systems, ensuring a zero-day in one hypervisor doesn't compromise validated production environments.

---

## 7. Objection Handling {#7-objection-handling}

### "We need a platform our QA team has seen before for validation"

QA validates systems, not brands. NixOS roots go back to 2003 and it's been shipping stable releases for 12 years — 100K+ packages, ~466 companies in production. CSV/CSA is about proving the system does what it claims — and NixOS's declarative model makes that proof trivial. The running state IS the specification. IQ is "deploy the declared config." OQ is "confirm the declared config matches requirements." PQ is "run in production — if it drifts, it fails." With Weaver, it can't drift. The FDA's 2022 CSA guidance explicitly encourages risk-based approaches over documentation volume — a declarative, zero-drift platform is the embodiment of that guidance.

### "Our validated systems can't change — we'll lose validated state"

That's the problem Weaver solves. On legacy platforms, any infrastructure change risks invalidating the validated state, so teams avoid changes — and accumulate technical debt. With NixOS, the validated state is maintained by construction. Changes go through git (change control by design), the new state is the new validated state, and the diff between versions is the change impact assessment. You'll actually change more confidently, not less.

### "21 CFR Part 11 compliance requires specific software features we haven't evaluated"

Weaver manages the infrastructure layer, not the GxP applications themselves. But the infrastructure layer is where the most common Part 11 findings originate — audit trails, access controls, change control, and validated state. Your LIMS, CDS, EDC, and MES still run on their validated platforms. Weaver makes the foundation under them audit-proof.

### "We can't migrate manufacturing systems mid-validation cycle"

Start with non-GxP workloads — development, office IT, non-regulated systems. Prove the declarative model on systems outside the validation boundary. When your next periodic review cycle arrives, migrate GxP workloads with a qualification protocol that leverages the declarative config as IQ/OQ evidence. Our Adopt program ($5,000/yr) includes GxP infrastructure qualification guidance.

### "Our EU sites need Annex 11 compliance — is NixOS recognized in Europe?"

Annex 11 assesses system capabilities, not vendor names. Weaver's declarative audit trail, change control, configuration management, and validation maintenance satisfy Annex 11 sections 7–13 at the infrastructure level. The Partner program ($30,000/yr) includes Annex 11 supplier assessment documentation that your EU quality team can use directly in their supplier qualification file.

### "What about our CDS and LIMS data integrity?"

Chromatography data systems and LIMS are application-layer concerns — Weaver doesn't replace them. But the infrastructure hosting those systems is often where data integrity breaks down: shared server credentials, undocumented changes, drift from validated state. Weaver makes the infrastructure layer ALCOA+-compliant so your application-layer data integrity controls have a trustworthy foundation.

### "Our supplier qualification requires documented DR/BC procedures and a vulnerability disclosure policy."

Both exist. `docs/setup/DISASTER-RECOVERY.md` covers backup scope, recovery procedures, and service continuity for the Weaver management layer — directly usable as a supplier qualification artifact for GxP BC/DR requirements. `SECURITY.md` defines a formal CVD policy: 48-hour acknowledgment SLA, 7-day critical fix SLA, documented supported versions. For EU GMP Annex 11 §16 (business continuity) and 21 CFR Part 11 infrastructure qualification, these documents are the supplier-side evidence your QA team needs.

The release process also includes a legal/ToS review gate and an insurance carrier touchpoint before shipping features that materially change the product's liability surface — a level of release discipline that most commercial software vendors don't have in writing, let alone publish.

### "We need SOC 2 / ISO 27001 from our infrastructure vendors"

We're on the ISO certification path. In the interim, the Accelerate program ($15,000/yr) includes compliance mapping that documents how Weaver controls satisfy SOC 2 Trust Service Criteria. The declarative audit trail and zero-drift architecture provide stronger evidence than most SOC 2-certified competitors, because the controls are enforced by construction rather than by process.

---

## 8. Buyer Personas {#8-buyer-personas}

### VP of IT / Head of IT Infrastructure

**Cares about:** Uptime for manufacturing and lab systems, tool consolidation, migration from VMware, staff efficiency, validation burden reduction
**Lead with:** Live Provisioning eliminates rebuild cycles. Zero drift = validated state maintained by construction. 5 hypervisors from one dashboard. 60–80% cost reduction vs VMware post-Broadcom. Staff freed from infrastructure documentation to focus on GxP system validation.
**Tier:** Fabrick

### Director of Quality Assurance / Head of CSV

**Cares about:** Validated state maintenance, audit trail integrity, change control compliance, FDA inspection readiness, Annex 11 compliance
**Lead with:** Drift is impossible by construction — validated state is permanent. Every infrastructure change is a git commit with author/timestamp/reason/approval. Change control is the architecture, not a bolted-on process. Periodic reviews reduce from weeks to hours.
**Tier:** Fabrick + Accelerate (they'll champion the purchase internally)

### CISO / Head of Information Security

**Cares about:** Data integrity, IP protection (drug formulas, clinical data), vendor risk, network segmentation, incident response
**Lead with:** Zero-drift architecture eliminates configuration-based vulnerabilities. Self-hosted = IP never leaves your facility. Managed bridges isolate GxP networks from corporate. Single vendor replaces multiple infrastructure tools = reduced attack surface and vendor risk.
**Tier:** Fabrick + Accelerate or Partner

### Lab IT Manager

**Cares about:** LIMS and CDS hosting, instrument data system qualification, lab network isolation, balancing IT operations with validation requirements
**Lead with:** Managed bridges isolate lab networks declaratively. Zero drift means the infrastructure hosting your LIMS stays validated without constant monitoring. AI diagnostics for 2 AM failures during batch runs. $149/yr (FM, first 200) per node vs EUR355+ for Proxmox.
**Tier:** Weaver or Fabrick depending on facility size

### Head of Regulatory Affairs

**Cares about:** FDA submission integrity (eCTD), inspection readiness, 483/Warning Letter risk, clinical trial data integrity, global regulatory consistency
**Lead with:** Infrastructure-layer ALCOA+ compliance provides a trustworthy foundation for regulated data. Git-based audit trail satisfies Part 11 by construction. Declarative config enables multi-site consistency for global operations.
**Tier:** Fabrick (they'll advocate for it to reduce inspection risk)

### IT Director at CRO/CDMO

**Cares about:** Multi-client isolation, audit readiness for multiple sponsors' audits, operational efficiency across client programs, cost per client engagement
**Lead with:** Per-VM RBAC + managed bridges create client-specific enclaves — each sponsor's workloads isolated with independent access controls and audit trails. One infrastructure, multiple auditable client environments. Declarative config means sponsor audits are a git log query.
**Tier:** Fabrick + Partner

---

## 9. Discovery Questions {#9-discovery-questions}

Use these to qualify pharma prospects and identify pain:

### Infrastructure Pain
- How do you currently provision new VMs for GxP workloads? How long does it take?
- When was the last time an infrastructure change invalidated a validated system state?
- How many infrastructure management tools does your IT team use daily? How many are validated?
- What's your current RTO for a critical manufacturing or lab system VM failure?

### Compliance Pain
- How long does your team spend on infrastructure IQ/OQ/PQ documentation per system?
- How do you prove to FDA investigators that your infrastructure audit trails are computer-generated and tamper-proof?
- How do you enforce change control for infrastructure changes to GxP system hosting?
- How do you handle periodic reviews — can you quickly show what changed between review dates?
- Have you received any 483 observations or Warning Letter citations related to infrastructure audit trails, access controls, or validated state maintenance?

### Data Integrity Pain
- How do you prevent shared credentials on infrastructure hosting GxP systems?
- Can your current infrastructure prove ALCOA+ compliance at the platform level?
- How do you isolate GxP-classified systems from non-GxP workloads at the network level?

### Budget Pain
- What are you paying annually for VMware/Proxmox licensing?
- How much of your IT staff time goes to infrastructure management vs GxP system validation?
- How many infrastructure vendors require supplier assessment / qualification?
- Have your VMware costs changed since the Broadcom acquisition?

### Strategic Pain
- Are your EU operations subject to Annex 11? How do you maintain consistency across sites?
- Do any of your facilities require air-gapped or disconnected infrastructure?
- If you're a CRO/CDMO — how do you isolate client environments and demonstrate that isolation during sponsor audits?
- Is your organization pursuing CSA (Computer Software Assurance) over traditional CSV? How is that affecting your validation strategy?

### AI Threat Landscape
- "If a frontier AI discovered a zero-day in your host kernel tomorrow — which Project Glasswing has demonstrated is now routine — how many GxP workloads would be compromised simultaneously? Could you prove to an FDA investigator that clinical trial data integrity was maintained — and that your 21 CFR Part 11 electronic records were not tampered with?"
- "Glasswing's 90-day public disclosure cycle means vulnerabilities found in your stack will become public knowledge. Can your current infrastructure prove it's patched faster than the disclosure window — before your next FDA pre-approval inspection or sponsor audit?"

---

## 10. Drug Discovery AI & Cloud Burst (Fabrick v3.0+) {#10-drug-discovery-ai--cloud-burst-fabrick-v30}

**Full analysis:** [business/FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md)

Pharmaceutical and life sciences organizations run some of the most GPU-intensive scientific workloads in existence: molecular dynamics simulation (GROMACS, AMBER, NAMD), protein structure prediction (AlphaFold2, ESMFold), virtual screening (Glide, AutoDock Vina GPU), generative chemistry (diffusion models, graph neural networks), and genomics pipelines (WGS variant calling, single-cell RNA-seq). These workloads burst dramatically — a drug discovery campaign might require 4 H100 nodes for 14 days to run a molecular dynamics sweep, then nothing for two months. Standard cloud burst is complicated by GxP validation requirements and IP protection concerns.

### The Compliance Gap Cloud HPC Doesn't Solve

For pharma/biotech organizations, cloud burst creates GxP and regulatory compliance problems:

- **21 CFR Part 11** — Electronic records and electronic signatures require that computer systems used for regulated data operate in a validated state. A standard cloud burst node is not part of a validated infrastructure — FDA expects the compute environment to be documented, reproducible, and controlled
- **EU Annex 11** — Computerized systems used in GxP contexts must have a system validation approach. Ephemeral shared cloud nodes that spin up and disappear are structurally incompatible with Annex 11's lifecycle validation requirements
- **FDA AI/ML Action Plan** — FDA's framework for AI/ML-based software as a medical device (SaMD) and AI-assisted drug development increasingly expects audit-ready infrastructure documentation for training environments
- **IP protection** — Training data for drug discovery AI includes proprietary molecular structures, clinical trial results, and formulation data. Shared cloud tenancy raises IP exposure concerns, separate from regulatory requirements
- **CRO/CDMO multi-sponsor isolation** — Contract research organizations running burst compute for multiple sponsors must demonstrate client data isolation; shared tenancy makes this auditable isolation very difficult

**Fabrick + Weaver burst nodes resolve this:** NixOS's declarative model extends the validated compute environment to burst nodes — the same NixOS configuration as the on-prem validated cluster is deployed to the burst node declaratively, making it part of the validated environment by construction. The Fabrick audit trail documents the full lifecycle of every burst node — enrollment, configuration, jobs run, and deregistration — providing the computer system lifecycle evidence that GxP validation requires.

### The Pitch for Drug Discovery AI Teams

*"Your computational chemistry team's AlphaFold2 sweep takes 14 days on 4 H100s. Your validation team asks: 'Is that burst node in your validated infrastructure?' With standard cloud burst, the answer is no — and your QA director says that's a 483 risk. Fabrick enrolls the burst node with the same NixOS configuration as your on-prem cluster — the validated environment extends to the cloud node by construction. Same audit trail, same GxP posture, no re-validation event. $20/node-day. When the run finishes, the node lifecycle evidence goes into your Part 11 audit trail automatically."*

### Licensing for Burst Nodes

Drug discovery AI burst nodes (1–2TB RAM tier, H100-class) use per-node-day consumption stacking on the Contract tier base:

| License component | Coverage |
|---|---|
| Contract base (Fabrick $2,500/yr) | Fabrick control plane + persistent nodes |
| Contract block ($2,000 first block) | 512GB+ RAM per burst node |
| Burst add-on (~$20/node-day) | Per-day charge while burst node is enrolled |

**Example:** Drug discovery team, 4 burst nodes, 3 campaign training runs/yr (14 days each):
- Cloud compute: 4 × 42 days × $400/day = $67,200/yr
- Fabrick burst licensing: 168 node-days × $20 = $3,360/yr
- **Fabrick as % of compute: 5%** — GxP validation coverage and Part 11 audit trail at negligible cost

### New Buyer Persona: Computational Drug Discovery IT / Validation Engineering Lead

**Profile:** Manages the GPU infrastructure for a pharma company's drug discovery AI function or a CRO's computational science platform. Sits at the intersection of IT infrastructure, GxP validation, and scientific computing. Their core tension: the AI team wants burst cloud capacity; the validation team requires documented, reproducible compute environments; the IP team wants data to stay on-premises.

**Cares about:** 21 CFR Part 11 compliance for training runs on regulated data, Annex 11 validation lifecycle for compute infrastructure, IP protection of molecular structures and formulations, CRO multi-sponsor isolation for burst nodes, FDA audit readiness for AI-assisted submissions.

**Lead with:** Fabrick as the extension of the validated compute environment to burst nodes — "the burst node gets the same NixOS config as your on-prem cluster, so it's validated by construction rather than requiring a separate IQ/OQ." Declarative audit trail satisfies Part 11 computer system lifecycle requirements. Hardware isolation satisfies multi-sponsor data isolation for CROs. $20/node-day vs the validation overhead of qualifying each cloud instance separately.

**Tier:** Contract (1TB+ nodes) + Fabrick fleet license + burst consumption add-on + Partner success program.

### Discovery Questions (Computational Drug Discovery AI Platform)

- Does your drug discovery AI team burst to cloud for molecular dynamics or other GPU-intensive workloads?
- How does your validation team classify burst cloud compute nodes — are they within your validated infrastructure boundary or outside it?
- Has your QA organization raised concerns about using cloud burst for computations that feed into regulatory submissions?
- How do you currently provide 21 CFR Part 11 audit trails for training runs on proprietary compound data?
- For CROs: How do you demonstrate to sponsors that their molecular data is isolated from other clients on shared burst infrastructure?

---

*This document complements the universal value proposition in [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md). For pricing details, see [TIER-MANAGEMENT.md](../../product/TIER-MANAGEMENT.md). For Fabrick justification, see [FABRICK-VALUE-PROPOSITION.md](../../marketing/FABRICK-VALUE-PROPOSITION.md). For cloud burst architecture and licensing, see [FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md).*

---

## Recent Changes

- **2026-03-21** — Added Section 10: Drug Discovery AI & Cloud Burst (Fabrick v3.0+). Covers 21 CFR Part 11 / Annex 11 / FDA AI-ML constraints on shared-tenancy cloud burst, per-node-day licensing, and new Computational Drug Discovery IT / Validation Engineering Lead buyer persona.
- **2026-03-19** — Added SLURM-native integration row to Weaver capabilities table for computational pharma workloads (molecular dynamics, genomics/NGS, QSAR, protein structure prediction). CRO client isolation angle included.
- **2026-03-18** — Fabrick pricing revised to $2,000/yr first node, $750/yr additional, $500/yr at 10+. Fabrick tier added at $2,500/yr (512GB RAM). Contract tier added for 512GB+ deployments (sliding scale per 512GB block). RAM coverage noted per tier. Parallel migration / no-expertise-required positioning added as primary lead.
