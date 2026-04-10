<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Energy & Utilities Sales Case
## How Weaver Turns NERC CIP Configuration Management from a Compliance Burden into a Construction Property
*Electric Utilities, Pipeline Operators, Water/Wastewater Utilities & Critical Infrastructure Operators*

**Date:** 2026-03-26
**Parent doc:** [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md)

---

## Table of Contents

1. [The Energy Utility IT/OT Problem](#1-the-energy-utility-itot-problem)
2. [Regulatory Mapping: What Weaver Addresses](#2-regulatory-mapping)
3. [Weaver for Energy Utilities](#3-weaver-for-energy-utilities)
4. [Fabrick for Energy Utilities](#4-fabrick-for-energy-utilities)
5. [Deficiency Remediation Plan](#5-deficiency-remediation-plan)
6. [Energy-Specific Competitive Advantages](#6-competitive-advantages)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Discovery Questions](#9-discovery-questions)
10. [Substation & Grid Edge Fleet (Fabrick v3.0+)](#10-substation--grid-edge-fleet-fabrick-v30)

---

## 1. The Energy Utility IT/OT Problem {#1-the-energy-utility-itot-problem}

**No NixOS expertise required — ever.** Weaver runs alongside existing VMware, Proxmox, or bare-metal OT tooling. Migrate one workload at a time. No cutover event. No retraining. NERC CIP configuration baselines enforced by construction — not by scan, not by procedure.

Energy and utility operators face a compliance burden unlike any other sector: NERC CIP is not a best-practice framework. It is a mandatory standard with $1M+/day fines for violations. Duke Energy paid $10M. American Electric Power paid $2.7M. The audits are continuous, the evidence requirements are exhaustive, and the underlying problem — proving that BES Cyber Systems' running configurations match their authorized baseline at every point in time — is one that conventional VM platforms cannot answer cleanly.

**What energy IT/OT teams should be doing:**

- Maintaining NERC CIP CIP-010-4 configuration baselines that provably reflect running BES Cyber System state
- Enforcing Electronic Security Perimeter boundaries (CIP-005-7) with documented, auditable conduit rules
- Managing CIP-007-6 port/service controls with evidence that only authorized services execute
- Documenting and authorizing every configuration change per CIP-010-4 requirements — with pre/post comparison and approval trail
- Operating CIP-013-2 supply chain risk management for software components running on CIP-impacted systems
- Running substation and edge compute infrastructure as a managed fleet — not as 200 independent SSH sessions

**What energy IT/OT teams actually spend time doing:**

- Manually documenting configuration baselines in spreadsheets and comparing them against running systems during audit prep
- Investigating configuration drift on BES Cyber Systems — CIP-010 requires detecting unauthorized changes, but conventional platforms can only detect them after the fact
- Maintaining separate evidence archives for each CIP standard: patch logs for CIP-007, change management records for CIP-010, access logs for CIP-005
- Traveling to remote substations for infrastructure changes that should be handled from a central management plane
- Building and maintaining custom scripts to generate the evidence packages NERC auditors require
- Managing VMware or OpenStack infrastructure whose licensing costs are compounding post-Broadcom while the compliance burden remains unchanged

**Weaver eliminates the gap between these two lists — CIP-010 configuration baseline compliance becomes a construction property of the platform, not a documentation exercise.**

### The Compliance Evidence Gap

The core NERC CIP problem Weaver solves: CIP-010-4 requires that utilities detect and respond to unauthorized configuration changes on BES Cyber Systems within 35 days. Conventional platforms — VMware, Proxmox, OpenStack — manage workloads imperatively. Running state can diverge from baseline without detection. The utility must continuously scan for drift and maintain separate evidence of what "baseline" means.

NixOS declarative configuration makes unauthorized change detection a non-problem: running state equals declared state by construction. You cannot have unauthorized drift because the platform rebuilds to declared state on every change. The git history of every change — who authorized it, what changed, when — is the CIP-010 evidence package. Auditors get a git log, not a manually assembled spreadsheet.

---

## 2. Regulatory Mapping: What Weaver Addresses {#2-regulatory-mapping}

### NERC CIP (Bulk Electric System — Mandatory)

| NERC CIP Standard | Requirement | Weaver Capability | Tier | Available |
|------------------|------------|------------------------------|:----:|:---------:|
| **CIP-002-5.1a** — BES Cyber System Categorization | Identify and categorize BES Cyber Systems and associated assets | Declarative config is the asset inventory — every VM, container, bridge, and IP pool is declared; nothing is implicit. Weaver topology map provides zone-aware visibility | All tiers | v1.0 |
| **CIP-003-8** — Security Management Controls | Documented security policies; evidence of policy enforcement across BES Cyber Systems | Config-as-code: policy IS the configuration. Every declared control is enforced at boot and maintained for life. Git history proves policy was in place at any audit point | Weaver+ | v1.0 |
| **CIP-005-7** — Electronic Security Perimeters | Define ESPs; document and control inbound/outbound access points; protect against unauthorized access at ESP boundaries | Managed bridges with IP pools define ESPs declaratively. Every inter-zone communication path is an explicit bridge rule — no implicit routing across perimeters. Firewall (nftables) enforces deny-by-default at conduit boundaries | Fabrick | v1.0 (bridges), v1.1 (firewall) |
| **CIP-007-6** — Systems Security Management | Manage security patches; disable unused ports/services; monitor security events | NixOS declarative model: only declared ports and services execute — unused services cannot exist unless declared. Patch management applies fleet-wide from a single config change. AI diagnostics surface security events | Fabrick | v1.0 |
| **CIP-010-4** — Configuration Change Management & Vulnerability Assessments | Develop and maintain configuration baselines; detect and respond to unauthorized changes within 35 days; document all authorized changes with pre/post comparison | **Zero-drift by construction** — running state equals declared baseline always. Unauthorized change is architecturally impossible. Every authorized change is a git commit: who approved it, what changed, when, why. Pre/post diff is the git diff. 35-day detection window becomes irrelevant | Weaver+ | v1.0 |
| **CIP-011-3** — Information Protection | Protect BES Cyber System Information; control access to BCSI; manage media containing BCSI | Per-VM RBAC restricts access to BCSI-containing systems. Audit log records every access event. NixOS LUKS full-disk encryption for BCSI at rest | Fabrick | v1.0 |
| **CIP-013-2** — Supply Chain Risk Management | Identify and manage cybersecurity risks in supply chain for industrial control systems hardware, software, and services | AI agent vendor controls (Decision #73) enforce per-resource-type software vendor restrictions. No software installs implicitly — every component is declared and version-pinned in Nix | Fabrick | v1.0 (AI vendor controls); supply chain tooling planned v2.x |

### Pipeline Operators (TSA Security Directives)

| TSA Directive | Requirement | Weaver Capability | Tier | Available |
|--------------|------------|------------------------------|:----:|:---------:|
| **SD-02D** — Network Segmentation | Segment OT networks from IT networks; implement access controls at network boundaries | Managed bridges define IT/OT segment boundaries declaratively. Conduit rules are explicit and auditable — no implicit cross-segment routing | Fabrick | v1.0 |
| **SD-02D** — Access Controls | Implement access controls to OT/ICS systems; limit access to least-privilege | Per-VM RBAC enforces least-privilege at the platform level. LDAP/SSO integration ties access to organizational identity | Fabrick | v1.0 |
| **SD-02D** — Continuous Monitoring | Monitor OT systems for cybersecurity threats and anomalies; establish a baseline and detect deviations | Zero-drift NixOS: baseline IS the running state. No scan required to verify baseline adherence. AI diagnostics surface deviations from expected behavior | Fabrick | v1.0 |
| **SD-02D** — Incident Reporting (CISA) | Report cybersecurity incidents to CISA within 24 hours | Tamper-evident audit log provides the incident timeline: what changed, when, which system, who had access — ready for CISA submission | Fabrick | v1.0 |

### Water/Wastewater (AWIA 2018 / EPA)

| Requirement | Obligation | Weaver Capability | Tier | Available |
|------------|-----------|------------------------------|:----:|:---------:|
| **AWIA 2018** — Risk and Resilience Assessment | Assess cybersecurity risks for operational technology and associated IT; document current state | Declarative config is the documented baseline. Asset inventory is the config. Zero-drift proves current state matches risk assessment at all times | All tiers | v1.0 |
| **AWIA 2018** — Emergency Response Plan | Maintain emergency response plan addressing cybersecurity incidents; test recovery procedures | Declarative config = reproducible rebuild from any failure state. Recovery plan is: re-apply config. Sub-second Firecracker boot is the RTO | Weaver+ | v1.0 |
| **EPA Cybersecurity Guidance** | Follow NIST CSF; implement access controls, change management, and incident response for OT systems | NIST CSF Protect/Detect/Respond/Recover covered by Weaver's zero-drift architecture, RBAC, AI diagnostics, and declarative recovery | Weaver+ | v1.0 |

### Cross-Sector

| Framework | Requirement | Weaver Capability | Tier | Available |
|----------|------------|------------------------------|:----:|:---------:|
| **NIST SP 800-82 Rev. 3** — ICS Security | Asset management, configuration baselines, network architecture, access control, patch management | Declarative asset inventory, zero-drift config baseline, managed bridge network architecture, per-VM RBAC, fleet-wide patch management | Weaver+ / Fabrick | v1.0 |
| **NIST CSF** (FERC-recommended) | Identify, Protect, Detect, Respond, Recover across OT/IT infrastructure | Asset inventory (dashboard), hardening (AppArmor/Seccomp), AI diagnostics, declarative recovery | Weaver+ | v1.0 |
| **IEC 62443-3-3** — Zone/Conduit | Zone boundary protection, access control, audit log, software integrity | Managed bridges (zones), per-VM RBAC (access), git audit log, immutable Nix store (integrity) | Fabrick | v1.0 |
| **SOC 2 Type II** (utility managed services) | Security, Availability, Confidentiality evidence | Zero-drift by construction, audit log, access governance, sub-second Firecracker recovery | Fabrick | v1.0 |

---

## 3. Weaver for Energy Utilities {#3-weaver-for-energy-utilities}

**Target:** Rural electric cooperatives, municipal utilities (water/wastewater/electric), small pipeline operators, independent power producers, community broadband + utility convergences

**Price:**
- **Weaver Solo** — $149/yr (FM, first 200) per node, admin only, local management, up to 128GB RAM
- **Weaver Team** — $129/user/yr (FM, first 50 teams) (2–4 users + 1 viewer free), up to 2 remote peer Weaver hosts (full management), up to 128GB RAM/host. Ships v2.2.0.

**The pitch:** "Your NERC CIP audit asks 'show me your CIP-010 configuration baseline and prove nothing has drifted.' With VMware, that's a two-week evidence assembly project. With Weaver, it's a git log."

### Key Weaver Wins for Energy Utilities

| Capability | Utility Value |
|-----------|--------------|
| **Zero Configuration Drift** | CIP-010-4 baseline compliance is a construction property — running state equals declared baseline always. Auditors see a git log, not a spreadsheet comparison |
| **Managed Bridges + IP Pools** | Declare Electronic Security Perimeters and IT/OT zone boundaries in code. Every conduit is explicit. Deny-by-default firewall enforces zone boundaries |
| **Live Provisioning** | Spin up historian, SCADA gateway, or MES VMs without SSH + rebuild cycles. New compute at a substation or plant site in minutes |
| **Declarative Port/Service Control** | CIP-007-6 requires disabling unused ports and services. NixOS declarative model: only declared services run. Unused services cannot exist unless explicitly added |
| **Sub-Second VM Boot** | Electric utilities need fast failover for SCADA and historian systems. Firecracker <125ms boot means replacement VMs are running before the next scan cycle |
| **Offline-First License** | Air-gap support for ESP-connected systems — HMAC license validation, no phone-home. OT environments frequently prohibit outbound internet from ESP |
| **AI Diagnostics** | Natural language failure analysis for OT-adjacent compute. When the process historian VM fails at 3 AM, diagnosis in plain language reduces mean-time-to-resolution |

### ROI for a Rural Electric Cooperative (5 Nodes)

| Current Cost | With Weaver |
|-------------|----------------------|
| VMware vSphere: EUR355/socket × 8 sockets = **EUR2,840/yr** | 5 nodes × $149 (Solo) = **$745/yr** |
| CIP-010 evidence prep: 3 weeks/yr at $75/hr (engineer) = **$11,250/yr** | Near zero — git history is the evidence; no manual assembly |
| Configuration drift investigation: 4 incidents/yr × 6hrs × $75/hr = **$1,800/yr** | Zero — drift is impossible; incidents are hardware failures |
| **Total current cost: ~$15,890/yr** | **Weaver: $745/yr + $13,050 labor freed** |

### Weaver Team for Utilities

**Target:** Multi-site water districts, small electric cooperatives with a primary control center plus remote pump stations or substations, municipal utilities monitoring distributed infrastructure.

**Price:** $129/user/yr (FM), 2–4 users + 1 viewer free. Each host needs its own Weaver key. Ships v2.2.0.

**The use case:** A water district operates a primary treatment facility running SCADA and historian VMs plus three remote pump stations with local compute. Weaver Team lets the operations team monitor all four hosts in the same view — see whether the remote historian VM is running and healthy — and take action directly when needed. Full remote workload management across the district without Fabrick.

**Upgrade trigger:** When the team needs more than 2 remote peers, fleet-scale governance, per-VM RBAC, or resource quotas — that's a Fabrick conversation.

---

## 4. Fabrick for Energy Utilities {#4-fabrick-for-energy-utilities}

**Target:** Investor-owned utilities (IOUs), large electric cooperatives, pipeline operators, multi-site water authorities, independent system operators (ISOs/RTOs), nuclear plant operators

**Price:** $2,000/yr first node + $750/yr additional + $500/yr at 10+ nodes (up to 256GB RAM)

**The pitch:** "You have 80 substations, 3 control centers, and a NERC CIP audit every year. You have 80 different CIP-010 baselines, 80 change management records to maintain, and no single view of what's actually running. Fabrick is the fleet control plane that turns 80 compliance problems into one."

### Fabrick Features Mapped to NERC CIP Obligations

| Fabrick Feature | CIP Standard Addressed | Evidence Produced | Available |
|-------------------|----------------------|------------------|:---------:|
| **Zero Configuration Drift** | CIP-010-4 — baseline maintenance and change detection | Git history proves baseline adherence at every audit point; drift detection SLA (35 days) is irrelevant | v1.0 |
| **Per-VM RBAC** | CIP-011-3 — BCSI access control; CIP-005-7 — ESP access management | Role assignments per VM; every access attempt audit-logged | v1.0 |
| **SSO/SAML/LDAP** | CIP-004-7 — personnel access management | Single identity source; access lifecycle tied to HR/identity system; access revocation is atomic | v1.0 |
| **Declarative Audit Log** | CIP-010-4 — authorized change documentation; CIP-005-7 — ESP access logging | Git commit history: who authorized each change, what changed, when, pre/post diff | v1.0 |
| **Managed Bridges + Firewall** | CIP-005-7 — ESP definition and boundary enforcement | Declarative ESP boundaries; deny-by-default conduit rules; every communication path explicit | v1.0 (bridges), v1.1 (firewall) |
| **Bulk VM Operations** | CIP-007-6 — fleet-wide patch management; CIP-010-4 — authorized changes applied uniformly | Fleet-wide changes applied atomically, logged; patch applied to 80 substations in one operation | v1.0 |
| **Resource Quotas** | CIP-007-6 — resource management for CIP systems | Resource limits prevent co-located workloads from starving SCADA or historian VMs | v1.0 |
| **AppArmor/Seccomp/Kernel Hardening** | CIP-007-6 — security hardening; NIST SP 800-82 — defense-in-depth | Hardening policy fleet-wide; config-as-code proves enforcement | v1.0 |

### Fleet Onboarding (v2.3.0)

Large utilities arrive at Fabrick with existing infrastructure — control centers, substations, remote sites — each already running Weaver. The fleet discovery wizard inventories existing Weaver agents across your operational network in a single session. **CIDR probe** is the primary path for utility environments: operational networks run on known RFC 1918 management segments — specify your management plane CIDR blocks and Fabrick probes each for a Weaver agent response, presenting a checkbox list for one-click bulk registration. **CSV/hostname import** is the primary path for air-gapped ESP environments where network probing is prohibited by CIP-005-7 policy — upload the authorized host list and Fabrick connects only to listed hosts, no lateral probing. All discovery sessions are audit-logged with triggering user, timestamp, and discovered host count — satisfying CIP-010-4 change documentation from the first day of deployment.

Non-NixOS infrastructure — existing RHEL historian servers, Windows SCADA workstations running alongside Linux VMs, legacy control system compute on vendor-supplied Linux distributions — can join as **Observed** fleet members by installing `weaver-observer` (statically-linked Rust binary, memory-safe, zero runtime dependencies, any Linux kernel ≥ 4.x). Observed hosts appear in the Fabrick fleet map with a yellow `Observed` badge showing running containers and VMs read-only. NERC CIP compliance posture — zero-drift baselines, CIP-010 evidence, CIP-005 ESP enforcement — applies only to Managed (NixOS + Weaver) hosts. Observer nodes are included free up to 5× the Managed node count. The fleet map is a live CIP migration tracker: yellow badges show which systems are in the compliance posture and which are not, each with a "Convert to Managed" CTA.

**Note on ESP-connected systems:** Observer hosts within an ESP are in the fleet map for visibility only. CIP-011 BCSI protection and CIP-005 access controls apply to Managed hosts only. The compliance boundary is explicit in the UI — auditors see an unmistakable distinction between systems inside and outside the compliance posture.

### Fabrick Success Programs for Energy Utilities

| Program | Utility Application | FM Price | Standard Price |
|---------|-------------------|:--------:|:--------------:|
| **Adopt** | NixOS + Weaver onboarding + 3 live sessions; NERC CIP-aware deployment playbook; ESP and zone configuration templates; email/chat support | $5,000/yr | $15,000/yr |
| **Adopt — Compliance** | Everything in Adopt + CIP-010 evidence walkthrough, ESP configuration review, CIP-007 port/service control mapping, NERC audit readiness session | — | $25,000/yr |
| **Accelerate** | All Adopt content; dedicated Slack; quarterly fleet reviews mapped to NERC CIP standards; SIEM integration help; LMS modules for substation fleet management | $15,000/yr | $45,000/yr |
| **Partner** | Named engineer who understands utility OT environments; priority features for utility-specific needs (CIP-010 baseline export, substation provisioning automation); NERC audit preparation sessions | $30,000/yr | $90,000/yr |

### ROI for a Regional Electric Utility (30 Nodes, 15 Sites)

| Cost Category | Current State | With Fabrick |
|-------------|--------------|----------------------------------|
| VMware vSphere licensing | $80,000–150,000/yr (post-Broadcom) | 30 nodes: $18,000/yr |
| NERC CIP compliance staff | 2–3 FTE × $95,000 = $190,000–285,000/yr dedicated to CIP evidence | Redirect to compliance strategy — CIP-010 evidence is automatic |
| CIP-010 evidence assembly | 4 weeks/yr per audit cycle × 2 compliance engineers = $30,400 | Near zero — git history is the evidence |
| Configuration change incidents (post-drift) | 6 incidents/yr × 8hrs × $95/hr = $4,560 | Zero — drift is impossible |
| Success program | N/A | Accelerate: $15,000/yr (FM) |
| **Total** | **$304,000–469,000/yr** | **$33,000/yr + compliance FTE redirected** |

### Compliance Export Extension

**Price:** $4,000/yr flat (per organization) · stacks on Fabrick subscription
**Available:** v2.2 (NIST CSF, SOC 2 export) · v3.0 (scheduled delivery; NERC CIP-specific export planned)

| Feature | NERC CIP Requirement Addressed | Available |
|---------|-------------------------------|:---------:|
| **Configuration baseline export** | CIP-010-4 — auditor-ready baseline documentation with git provenance | v2.2 |
| **Signed configuration attestation** | CIP-010-4 — cryptographically signed snapshot proving running state matched declared baseline at attestation timestamp | v2.2 |
| **Change log export** | CIP-010-4 — formatted change history: who authorized, what changed, pre/post diff, timestamp | v2.2 |
| **NERC CIP control mapping export** | CIP-003-8 through CIP-013-2 — evidence package mapping Weaver controls to relevant CIP requirements | Planned v3.0 |
| **Scheduled export delivery** | Annual/quarterly evidence delivery to S3-compatible endpoint or encrypted email | v3.0 |

---

## 5. Deficiency Remediation Plan {#5-deficiency-remediation-plan}

When a utility has existing NERC CIP findings — from NERC/FERC audits, spot checks, or internal assessments — Weaver addresses infrastructure-related deficiencies systematically.

### Quick Wins (Week 1–2)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|--------------------|
| **CIP-010 baseline drift** | "Running configuration of BES Cyber System does not match authorized baseline" | Deploy Weaver — NixOS declarative config makes drift architecturally impossible. Running state = declared baseline, always |
| **CIP-007 unauthorized services** | "Services running on BES Cyber Systems that are not in the authorized service list" | NixOS declarative model: only declared services execute. Unauthorized services cannot appear unless added to config |
| **CIP-005 ESP access documentation** | "ESP conduit rules not documented or do not match enforced policy" | Managed bridges: every ESP boundary and conduit rule is declared in code. Policy IS the documentation |

### Medium-Term (Month 1–3)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|--------------------|
| **CIP-010 change management** | "Authorized configuration changes not documented with pre/post comparison" | Every Weaver change is a git commit with author, timestamp, diff, and reason. Pre/post comparison is the git diff |
| **CIP-011 BCSI access logging** | "Access to BES Cyber System Information not fully audit-logged" | Per-VM RBAC with audit log of every access grant, revocation, and attempt. Tamper-evident git history |
| **CIP-007 patch management** | "Security patch management process not documented or not consistently applied" | Fleet-wide patch management via Fabrick bulk operations: single config change applies patches to all BES Cyber Systems atomically, logged |

### Strategic (Quarter 1–2)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|--------------------|
| **CIP-013 supply chain** | "Software component supply chain risks not identified or managed" | AI vendor controls restrict which software components can run on CIP-impacted systems; NixOS version-pins all packages |
| **CIP-005 ESP architecture** | "ESP boundaries not enforced by technical controls — relying on process controls only" | Managed bridges + deny-by-default firewall enforce ESP boundaries technically. Conduit rules in code are the technical control |
| **Multi-site CIP consistency** | "CIP controls inconsistently applied across substations and control centers" | Fabrick fleet-wide operations enforce consistent CIP policy across all sites. One change applies everywhere |

---

## 6. Energy-Specific Competitive Advantages {#6-competitive-advantages}

### vs VMware vSphere (Post-Broadcom)

| Factor | VMware | Weaver |
|--------|--------|--------|
| CIP-010 baseline compliance | Requires separate drift scanning tools; scan-then-compare process | Zero drift by construction — no scanning required; running state IS the baseline |
| ESP boundary enforcement | vSwitch/NSX configuration; can drift from policy | Managed bridges declared in code; cannot diverge from policy |
| Post-Broadcom licensing | $80,000–150,000/yr for equivalent scale | $18,000/yr (30 nodes) |
| Air-gap support | Requires license server or complex activation | HMAC offline-first license — no phone-home; purpose-built for ESP |
| CIP-010 evidence | Manual assembly from vCenter change logs + external tooling | Git history is the evidence; no assembly required |

### vs Manual Baseline Documentation

Most utilities still manage CIP-010 baselines via spreadsheets, scripts, and periodic scanning. The operational reality:

| Aspect | Spreadsheet + Scan | Weaver |
|--------|-------------------|--------|
| Baseline accuracy | Point-in-time snapshot; can be stale within hours | Continuous — running state equals declared state by construction |
| Change documentation | Manual entry, after-the-fact | Automatic — every change is a git commit with full provenance |
| 35-day drift detection | Requires scheduled scans + manual comparison | Not applicable — drift is impossible; there is nothing to detect |
| Audit prep time | 2–4 weeks annually | Near zero — evidence is already in git history |
| FERC inquiry response | Days to assemble evidence | Minutes — query the git log |

### The Offline-First / ESP Advantage

NERC CIP Electronic Security Perimeters frequently prohibit internet egress from CIP-impacted systems. Weaver's offline-first license validation (HMAC, no phone-home) is purpose-built for these environments — the ESP boundary does not affect license operation. No competitor offers this without fabrick negotiation.

> **Pending differentiator — Onsite AI Model:** For ESP-connected systems and nuclear plant IT/OT DMZ environments where cloud AI is prohibited by CIP policy or NRC cybersecurity plan, `aiPolicy: local-only` routes all AI diagnostics to an onsite inference node inside the ESP. Hardware/deployment spec not yet defined (see NOTES.md 2026-03-26). When spec'd, AI-assisted configuration analysis and incident diagnostics stay inside the ESP boundary — the only infrastructure management platform that can make this claim. Update this section when the onsite AI model spec ships.

### vs Claroty/Dragos/Nozomi (OT Monitoring)

These are not competitors — they are complementary. OT monitoring platforms (Claroty, Dragos, Nozomi) solve the passive protocol analysis and threat intelligence problem at Levels 0–2 of the Purdue model. Weaver manages the compute infrastructure at Level 3 (site operations) and the IT/OT DMZ.

**The positioning:** *"Claroty monitors what's on your OT network. Weaver manages the VMs and containers that run on your OT-adjacent compute. They watch your PLCs; we manage the historian that records what those PLCs are doing."*

Weaver is what runs the VMs that Dragos monitors. The two tools do not overlap.

#### Kubernetes Complexity in Energy & Utilities

NERC CIP requires documented network segmentation between IT and OT zones, with auditable evidence that Electronic Security Perimeter (ESP) boundaries are enforced. Kubernetes network policies are software-defined and audit-complex — proving isolation to NERC auditors requires network flow logs, policy documentation, and evidence that shared-kernel containers haven't breached zone boundaries. The K8s abstraction layer becomes a compliance liability in an industry where auditors need clear, physical-equivalent boundaries.

| K8s Overhead | Impact in Energy & Utilities | Weaver Alternative |
|---|---|---|
| Software-defined network policies for ESP/IT-OT segmentation | NERC CIP-005 requires documented ESP boundaries; K8s network policies are YAML abstractions that auditors can't verify without deep K8s expertise; proving pod isolation requires flow logs + policy export + compensating controls documentation | MicroVM hardware isolation + bridge segmentation — each zone is a hardware boundary; bridge ACLs are declarative and auditable; NERC auditors verify boundaries without K8s translation |
| K8s control plane inside or adjacent to ESP | etcd, API server, and kubelet create shared infrastructure that blurs CIP system boundaries; every shared component must be documented as a BES Cyber Asset or exempted with justification | Each MicroVM is a clear system boundary; no shared control plane to document around; Weaver's audit log captures all access per CIP-007 requirements |
| Container registry dependency for CIP-impacted systems | K8s pulls images from registries at runtime; ESP-connected systems with no internet egress require complex internal registry mirrors and image signing chains | NixOS flake inputs are pinned and cached locally; offline-first by design; no runtime registry dependency — purpose-built for ESP-connected infrastructure |

Full competitive reference: [KUBERNETES-COMPETITIVE-POSITIONING.md](../KUBERNETES-COMPETITIVE-POSITIONING.md)

### AI-Era Threat Landscape Advantage

Anthropic's Project Glasswing (April 2026) demonstrated that frontier AI can discover **thousands of zero-day vulnerabilities** — including some that survived decades of human review — across every major operating system and browser. These capabilities will proliferate to attackers.

**Why this changes the calculus for energy and utilities:**

- **Shared-kernel = fleet-wide compromise.** A single kernel zero-day — exactly the kind AI is now finding by the thousands — compromises every Docker container on the host simultaneously. In OT-adjacent environments, a container escape from an IT workload into a SCADA gateway or historian VM is not a data breach — it is a grid reliability event. Weaver's hardware boundary per MicroVM contains the blast radius to one workload and enforces the IT/OT segmentation that NERC CIP-005 ESP boundaries require.
- **Patch at the speed of AI discovery.** NERC CIP-007-6 requires documented patch management for BES Cyber Systems, with evidence of patch evaluation and implementation timelines. When Glasswing-class disclosures arrive targeting the Linux kernels running your substation compute, NERC auditors will ask how fast you evaluated and deployed the fix — and whether every substation converged to the patched state. NixOS's `flake.lock` pins every dependency by hash. Pin the fix, rebuild, deploy via Colmena — every node converges deterministically. No "did we patch that remote substation?"
- **Supply-chain verifiability.** Glasswing explicitly targets open-source and supply-chain security. For utilities operating inside Electronic Security Perimeters where a compromised dependency could bridge IT and OT zones, NixOS's content-addressed store makes the entire supply chain formally verifiable — every package identified by its complete dependency tree hash, not a mutable tag.
- **Hypervisor diversity.** Weaver's 5 hypervisor options mean a vulnerability in one doesn't cascade to workloads on another — defense through diversity against AI-augmented exploit discovery. For critical infrastructure where FERC and NERC treat cybersecurity events as reliability threats, single-hypervisor concentration is exactly the risk profile that AI-driven vulnerability discovery exploits.

---

## 7. Objection Handling {#7-objection-handling}

### "NERC CIP requires formal change management approval before any system change"

Correct — and Weaver makes the approval process faster and the evidence automatic. Every Weaver change is a git commit that requires an authorized user to make. The commit message is the change reason. Pre/post diff is automatic. The approval workflow (PR review, change ticket) operates on git commits — auditors see exactly what changed, who approved it, and when it was applied. The CIP-010 evidence is a byproduct of the normal change process, not a separate documentation exercise.

### "Our BES Cyber Systems run on RHEL/Windows — we can't convert to NixOS"

NixOS roots go back to 2003 and it's been shipping stable releases for 12 years — 100K+ packages, ~466 companies in production. You don't have to convert everything at once. Install `weaver-observer` on Linux hosts. Existing RHEL historian servers, Linux SCADA gateways, and OT compute appear in your Fabrick fleet map as Observed nodes — running processes and resource utilization visible read-only. CIP-010 baselines, CIP-005 ESP enforcement, and zero-drift compliance apply only to Managed (NixOS + Weaver) hosts — the fleet map makes this unmistakable. Convert your highest-CIP-impact systems first; observe the rest while migration runs. Each Observed host has a "Convert to Managed" button. The compliance boundary is explicit; there is no audit risk from running both states simultaneously.

### "We can't change software on ESP-connected systems without a CIP-010 authorized change process"

The CIP-010 authorized change process applies to the systems you manage with Weaver, not to deploying Weaver itself. Deploying Weaver on a new host that then manages CIP-impacted VMs requires a standard change ticket — no different from deploying any other management platform. Once Weaver is deployed, subsequent changes go through git-based authorization, which is a stricter and more auditable process than what most utilities currently use.

### "Our NERC CIP audit is in 90 days — this isn't the time to change platforms"

You're right that a full platform migration before an audit is the wrong move. Use this: deploy Weaver on new or non-critical infrastructure now, generate 90 days of CIP-010-compliant evidence, and show the auditor what the new baseline looks like. The audit cycle becomes a forcing function for migration rather than a barrier to it. Post-audit, migration of production BES Cyber Systems has a clean runway.

### "Nuclear systems require NRC approval under 10 CFR 73.54 before software changes"

Nuclear power is a separate market with its own regulatory regime — see [deferred/nuclear-power.md](deferred/nuclear-power.md). For this doc: Weaver manages non-safety OT-adjacent compute infrastructure at nuclear sites (historians, IT/OT DMZ systems, engineering workstations) — not safety-related or safety-significant systems, which require NRC-qualified tooling outside Weaver's scope. Consult the plant's 10 CFR 73.54 cybersecurity coordinator to confirm applicability before any proposal.

### "We have vendor-supplied OT appliances we can't modify"

Vendor-supplied PLCs, RTUs, and embedded OT devices are out of scope for Weaver. Weaver manages the Linux-based compute infrastructure adjacent to them — SCADA servers, historians, HMI containers, IT/OT DMZ systems. The vendor appliances stay on their existing platforms; Weaver manages the infrastructure that communicates with them.

### "Our operations team is skeptical of anything that touches production OT infrastructure"

Start outside the ESP. Deploy Weaver on IT-side infrastructure first — corporate servers, management workstations, development systems. Generate 6 months of CIP-010-compliant evidence. Then bring the OT team in to see what the evidence looks like before asking them to accept it on production systems. The OT team's concern is "change risk to production" — zero-drift NixOS answers that concern better than any other platform, but you have to show them the evidence first.

### "NERC CIP-013 requires us to document software supply chain risk for tools in our BES Cyber System environment"

CIP-013-1 requires documented supply chain risk management for vendors supplying software to BES Cyber Systems. Weaver's CIP-013 evidence: supply chain SHA pinning on all 40 GitHub Actions (no dependency substitution attacks), SAST with OWASP patterns on every code push, published CVD policy with 48-hour acknowledgment and 7-day critical fix SLAs (`SECURITY.md`), and documented DR/recovery procedures directly relevant to CIP-009 recovery plan requirements (`docs/setup/DISASTER-RECOVERY.md`). Testing benchmark scored A/A+ against enterprise standards — `docs/TESTING-ASSESSMENT.md`. This package addresses CIP-013 Attachment 1 Part 1.2 (vendor notification of known vulnerabilities) and Part 1.3 (vendor security testing and response) from a single vendor documentation request.

---

## 8. Buyer Personas {#8-buyer-personas}

### NERC CIP Compliance Manager

**Cares about:** CIP-010 baseline documentation burden, audit readiness, violation exposure, FERC inquiry response time
**Lead with:** Zero-drift NixOS makes CIP-010 compliance a construction property — running state equals declared baseline by construction. Git history is the evidence package. 35-day detection window becomes irrelevant. Last NERC audit took 4 weeks to prep; with Weaver it's a git log query.
**Tier:** Fabrick + Accelerate (compliance program) or Partner

### Director of Grid Operations Technology / VP of OT

**Cares about:** Substation fleet management, OT/IT convergence, uptime, change control for production systems
**Lead with:** Fabrick manages 80 substations from one control plane. Zero-drift means the vConfig on substation 47 in rural Montana matches declared policy — without a site visit. Firecracker sub-second boot means SCADA VM failover completes before the monitoring alarm escalates.
**Tier:** Fabrick

### CISO / VP Security

**Cares about:** CIP-005 ESP integrity, CIP-013 supply chain risk, TSA directive compliance (pipeline), incident evidence for CISA reporting
**Lead with:** Managed bridges define ESPs in code — the technical control is the declaration, not a process. CIP-013 software supply chain: NixOS version-pins all packages; nothing installs implicitly. CISA 24-hour reporting: the audit log is the timeline.
**Tier:** Fabrick + Accelerate or Partner

### VP of IT Operations (Water/Wastewater Authority)

**Cares about:** AWIA risk assessment documentation, SCADA system uptime, budget constraints, small team managing large physical footprint
**Lead with:** AWIA risk assessment: declarative config IS the documented baseline. SCADA uptime: Firecracker <125ms failover. Budget: $149/yr per node vs VMware licensing. Small team: one dashboard for all pump stations and treatment facilities.
**Tier:** Weaver or Fabrick depending on site count

### OT/ICS Security Engineer

**Cares about:** Zone/conduit architecture, IEC 62443 compliance, patch management without production impact, air-gap capability
**Lead with:** Managed bridges model the zone/conduit architecture declaratively. NixOS patch management: apply patch to a test clone first (identical config, different host), validate, then apply fleet-wide — no production risk. Offline-first license: HMAC validation, no phone-home, works inside the ESP.
**Tier:** Fabrick

---

## 9. Discovery Questions {#9-discovery-questions}

### Compliance Pain
- How do you currently prove to NERC auditors that your BES Cyber System configurations match their authorized baselines? How long does that evidence assembly take?
- When was the last time a CIP-010 audit found a deviation between your documented baseline and the running system? How long did it take to identify when the deviation occurred?
- How many person-hours does your team spend per audit cycle preparing CIP-010 configuration baseline evidence?
- How do you currently document that only authorized ports and services are running on CIP-impacted systems (CIP-007-6)? Is that process manual or automated?

### Infrastructure Pain
- How many substations, control centers, or remote sites does your team manage? How do you push configuration changes across all of them?
- How long does it take to provision a new historian or SCADA gateway VM at a remote substation?
- When a SCADA gateway VM fails at a remote site, what is your current mean-time-to-recovery?
- How many separate management tools does your team use to manage OT-adjacent compute infrastructure?

### Budget Pain
- What are you paying annually for VMware vSphere or your current hypervisor platform?
- How has your VMware cost changed since the Broadcom acquisition?
- How many FTEs are dedicated to NERC CIP compliance work that is primarily evidence documentation vs strategic compliance?

### Strategic Pain
- Are you planning to expand substation or remote site automation in the next 2–3 years? How are you planning to manage the compute fleet at those sites?
- Is air-gap capability required for your ESP-connected systems? How do you currently handle software updates in those environments?
- What is your current timeline for migrating off any vendor-supported platforms that are approaching end-of-support?

### AI Threat Landscape
- "If a frontier AI discovered a zero-day in your host kernel tomorrow — which Project Glasswing has demonstrated is now routine — how many workloads would be compromised simultaneously? Could a container escape bridge your IT/OT boundary and affect BES Cyber Systems?"
- "Glasswing's 90-day public disclosure cycle means vulnerabilities found in your stack will become public knowledge. Can your current infrastructure prove to NERC auditors that every CIP-impacted system was patched within your CIP-007 compliance window?"

---

## 10. Substation & Grid Edge Fleet (Fabrick v3.0+) {#10-substation--grid-edge-fleet-fabrick-v30}

**Full context:** [MASTER-PLAN.md](../../../MASTER-PLAN.md) — Decisions #97–#101, v2.3.0 fleet discovery

Large electric utilities operate tens to hundreds of substations, each running compute infrastructure for protection relays, SCADA communications, phasor measurement units (PMUs), intelligent electronic devices (IEDs), and local historian functions. Managing this distributed fleet — each node a potential CIP-impacted system — as 200 independent systems is operationally and compliance-wise untenable. Fabrick is the fleet control plane that should have come with grid modernization.

### The Substation Fleet Problem

| Requirement | Per-Substation Management | Fabrick Fleet Management |
|------------|--------------------------|--------------------------|
| CIP-010 baseline for 100 substations | 100 separate baseline documents; 100 change records per audit cycle | One fleet policy; git history covers all 100 substations from a single view |
| CIP-007 patch management | Individual patch cycles per site; travel for air-gapped substations | Single fleet-wide patch operation; air-gapped substations pull from local mirror |
| New substation commissioning | Engineer travel + manual OS install + VMware/Proxmox setup | nixos-anywhere + Fabrick auto-enrollment: site is managed within hours of power-on |
| Security policy consistency | Policy drift across sites is inevitable and undetectable | Zero drift by construction; fleet-wide policy enforced at every site |
| Incident response | SSH to individual substations; no fleet-level incident view | Fabrick fleet view: which substations are affected, what changed, AI diagnostics across the fleet |

### The Pitch for Grid Operations Technology Teams

*"You're deploying grid automation at 50 new substations over the next 3 years. Each one runs a historian, a SCADA communications gateway, and a local protection relay management VM. Today that's 50 CIP-010 baselines to maintain, 50 CIP-007 patch management records, and 50 potential drift sources — each requiring a NERC CIP audit trail. Fabrick enrolls each substation automatically when the node boots. The zero-drift architecture means substation 47 in rural Montana has exactly the same CIP-010-compliant configuration as substation 1 at your primary control center — by construction. One NERC CIP compliance team manages the entire fleet from one control plane."*

### Substation Fleet Economics

| Deployment | Nodes | Annual Cost |
|-----------|-------|------------|
| Pilot (5 substations) | 5 | $4,500/yr ($750/node × 5) |
| Regional rollout (25 substations) | 25 | $16,500/yr ($750/node × 25, sliding scale) |
| Full fleet (100 substations) | 100 | $50,000/yr ($500/node at 10+) |
| VMware equivalent (100 substations) | 100 | $200,000–400,000/yr (post-Broadcom) |

**NERC CIP compliance labor saved at 100 substations:** 3 compliance FTE × $95,000 = $285,000/yr — dwarfs the Fabrick subscription cost.

### New Buyer Persona: Grid Modernization / SCADA Infrastructure Lead

**Profile:** Owns the compute infrastructure strategy for the utility's grid modernization program. Responsible for deploying and managing compute at substations and remote sites as part of smart grid, AMI, and DERMS rollouts. Accountable for CIP-010 compliance across an expanding footprint. Frustrated by the gap between the pace of grid modernization and the operational burden of managing CIP-compliant compute at each new site.

**Cares about:** Substation commissioning speed (nixos-anywhere + Fabrick auto-enrollment), CIP-010 compliance at scale (zero-drift fleet), air-gap capability for ESP-connected sites (offline-first license), security policy consistency across hundreds of sites (Fabrick fleet enforcement).

**Lead with:** Fabrick turns each new substation from a separate CIP compliance problem into a fleet member with automatic baseline compliance from day one. nixos-anywhere + Fabrick enrollment means a new substation is managed within hours of power-on. Zero-drift architecture means the NERC auditor's question — "does the running config match the baseline?" — is answered by construction across all 100 sites.

**Tier:** Fabrick (large node count → likely Contract tier for high-RAM nodes) + Partner success program.

### Discovery Questions (Substation Fleet)

- How many substations or remote sites are you planning to add compute infrastructure at over the next 3 years?
- What does your current CIP-010 baseline management process look like across your substation fleet — how many separate baselines are you maintaining, and how?
- How do you currently handle software patching at air-gapped substations within the ESP?
- What is your current commissioning time from site power-on to a fully managed and CIP-compliant substation compute node?
- How do you detect unauthorized changes to compute infrastructure at substations between audit cycles?

---

*This document complements the universal value proposition in [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md). For OT manufacturing context, see [manufacturing-ot.md](manufacturing-ot.md). For pricing details, see [TIER-MANAGEMENT.md](../../product/TIER-MANAGEMENT.md). For Fabrick justification, see [FABRICK-VALUE-PROPOSITION.md](../../marketing/FABRICK-VALUE-PROPOSITION.md).*

---

## Recent Changes

- **2026-03-26** — Initial document. Covers NERC CIP regulatory mapping (CIP-002 through CIP-013), TSA pipeline directives, AWIA water utilities, Fabrick fleet management for distributed substations, Fleet Onboarding with Observer for non-NixOS OT-adjacent infrastructure, competitive analysis vs VMware and manual baseline documentation, and Substation & Grid Edge Fleet section (Section 10).
