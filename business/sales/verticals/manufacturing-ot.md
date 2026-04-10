<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver — Manufacturing & OT Sector
## IT Value Proposition

> **Decision ref:** See MASTER-PLAN.md Decisions Resolved for tier and feature decisions.
> **Status:** Planned sales vertical — draft for review.

**Date:** 2026-03-13
**Parent doc:** [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md)
*Discrete Manufacturing, Process Manufacturing, Industrial Automation, Critical Infrastructure, Pharmaceutical Manufacturing*

---

## Table of Contents

1. [Industry Problem](#1-industry-problem)
2. [Regulatory Mapping](#2-regulatory-mapping)
3. [Weaver for Manufacturing/OT](#3-weaver-for-manufacturingot)
4. [Fabrick for Manufacturing/OT](#4-fabrick-for-manufacturingot)
5. [Deficiency Remediation Plan](#5-deficiency-remediation-plan)
6. [Competitive Advantages](#6-competitive-advantages)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Discovery Questions](#9-discovery-questions)

---

## 1. Industry Problem {#1-industry-problem}

**No NixOS expertise required — ever.** Weaver runs alongside existing Docker, VMware, Proxmox, or bare-metal tooling. Migrate one workload at a time. No cutover event. No retraining. Hardware isolation for OT/IT convergence without replacing existing tooling. PLC management servers and SCADA systems isolated in MicroVMs alongside existing infrastructure.

### The IT/OT Convergence Tension

Manufacturing IT teams are caught between two organizational forces that do not resolve quietly. The IT team wants modern tooling, centralized visibility, and auditable configurations. The OT team's position is simpler: do not touch the production line. Both are right. The problem is that convergence is already happening whether anyone sanctioned it or not.

PLCs, HMIs, historians, SCADA systems, and IIoT sensors are now connected to fabrick networks — not because OT engineers planned it that way, but because remote access, ERP integration, and predictive maintenance analytics created connectivity one exception at a time. The result is a flat network where a corporate laptop can route to a Rockwell ControlLogix PLC, where Windows XP HMIs share broadcast domains with Exchange servers, and where the Purdue model exists in architecture diagrams but not in actual network topology.

**What this means in practice:**

- Legacy OT systems that cannot be patched (vendor-unsupported OS, proprietary protocols, no patch windows) sit exposed on networks that were designed for IT
- IT teams manage OT networks with no OT-native visibility — Wireshark is a forensic tool, not an operational one
- OT teams resist IT-driven changes, and correctly so: an ill-timed patch cycle on a production historian can stop a line
- The IT/OT boundary is where incidents propagate: Colonial Pipeline, Triton/TRISIS, and Industroyer all crossed this boundary
- Claroty, Dragos, and Nozomi solve the passive monitoring and threat detection problem — but they start at $50K+ and are enterprise-only. Mid-market manufacturers have no native visibility layer for what VMs and containers are running in each OT zone

**What manufacturing IT/OT teams should be doing:**

- Architecting zone/conduit segmentation per IEC 62443-3-3, creating software-defined Purdue model boundaries between Level 0 (field devices), Level 1 (basic control), Level 2 (supervisory), Level 3 (site operations), and the DMZ separating OT from IT
- Enforcing NIST SP 800-82 Rev. 3 guidance for ICS security: inventorying assets, baseline configurations, and managing access at zone boundaries
- Managing NIS2-mandated risk measures across OT systems in scope as essential or important entities (effective October 2024 — EU manufacturers are now legally obligated)
- Satisfying IEC 62443-4-2 component requirements for software components hosting process historian, MES, or SCADA gateway functions
- Running containerized HMI and SCADA interfaces with process isolation — rootless Podman for historian containers, no privileged daemon in the OT DMZ
- Maintaining configuration baselines for edge compute nodes deployed at each production line

**What manufacturing IT/OT teams actually spend time doing:**

- SSH-ing to individual plant servers to manually provision monitoring VMs, with no reproducible baseline — so every node is slightly different
- Firefighting configuration drift on 24/7 systems that cannot enter maintenance windows; undocumented changes accumulate until something breaks
- Mediating between IT and OT when a security audit finding requires a change that OT is unwilling to make without guaranteed rollback
- Responding to customer security audits with screenshots and spreadsheets because infrastructure state is not documented in any machine-readable form
- Traveling to remote plant sites for infrastructure troubleshooting that should be a dashboard operation
- Running Wireshark during incidents to understand what is actually running — because there is no operational topology map for the OT zone

**Weaver closes the gap between these two lists — and does it without requiring nixos-rebuild switch on production systems.**

### The Tools Gap

The incumbent OT security platforms are category leaders for a reason — Claroty, Dragos, and Nozomi deliver passive protocol-level analysis, threat intelligence, and OT asset discovery that no VM management dashboard attempts to replace. This is not competition; it is a different layer.

The gap Weaver fills: IT teams managing OT-adjacent infrastructure — process historian servers, SCADA gateway VMs, MES application nodes, HMI containers, edge compute at the plant — have no dedicated management layer. They use the same Proxmox or vSphere stack they use everywhere else, with none of the OT-specific context: zone assignment, conduit awareness, immutable baseline enforcement, or topology visibility per zone.

Weaver is the NixOS-native VM and container management layer that IT teams deploy alongside OT monitoring tools. It is not a Dragos replacement. It is what runs the VMs and containers that Dragos monitors.

---

## 2. Regulatory Mapping {#2-regulatory-mapping}

### Direct Compliance Impact

> **Version key:** Weaver Free / v1.0 = available now. Weaver / v1.1+ = roadmap. Fabrick / v1.x = as noted. NixOS = host OS capability. Capabilities without a version note are v1.0.

| Regulation / Framework | Requirement | Weaver Capability | Tier | Available |
|----------------------|------------|------------------------------|------|:---------:|
| **IEC 62443-3-3 SR 1.1** — Human User Identification and Authentication | Uniquely identify and authenticate human users at the control system level | Per-VM RBAC enforces unique identity at every VM boundary. SSO/SAML/LDAP integration (v1.2+) ties authentication to organizational directory | Fabrick | v1.0 (RBAC), v1.2+ (SSO/LDAP) |
| **IEC 62443-3-3 SR 1.2** — Software Process and Device Identification and Authentication | Identify and authenticate software processes and devices communicating across conduits | Managed bridge declarations make each inter-zone conduit explicit and auditable — no implicit device-to-device paths | Weaver | v1.0 |
| **IEC 62443-3-3 SR 2.1** — Authorization Enforcement | Enforce authorization decisions for all requests by users and devices | Per-VM role assignments (viewer / operator / admin) enforced at the API level. Requests outside assigned role are denied at the platform layer | Fabrick | v1.0 |
| **IEC 62443-3-3 SR 2.4** — Mobile Code | Restrict and control use of mobile code in the IACS | NixOS declarative model permits only declared software to execute. Nothing installs implicitly — mobile code or unauthorized software requires a git commit and review | Weaver | v1.0 |
| **IEC 62443-3-3 SR 3.3** — Security Functionality Verification | Verify security functionality of IACS at startup and after changes | Zero-drift NixOS: running state equals declared state at every boot. Security configuration verified by construction — not by post-boot scanning | Weaver | v1.0 |
| **IEC 62443-3-3 SR 3.4** — Software and Information Integrity | Detect and protect against unauthorized changes to software and data | Immutable NixOS store: no in-place modification. Every change is a derivation producing a new store path. Git history is the integrity manifest | Weaver | v1.0 |
| **IEC 62443-3-3 SR 5.2** — Zone Boundary Protection | Protect the boundary of each zone to restrict data flow as defined by the zone/conduit model | Managed bridges with IP pools create declarative zone boundaries. Weaver topology map provides per-zone visibility. Declarative firewall (v1.2) enforces deny-by-default at zone conduits | Fabrick | v1.0 (bridges), v1.2 (deny-by-default firewall) |
| **IEC 62443-3-3 SR 6.1** — Audit Log Accessibility | Create and protect audit log records that support audit review and forensic investigation | Git-based declarative audit log: every infrastructure change is a commit with author, timestamp, diff, and reason. Tamper-evident by construction. Available for forensic comparison during incident response | Fabrick | v1.0 |
| **IEC 62443-3-3 SR 7.1** — Denial-of-Service Protection | Protect against denial-of-service events | Resource quotas per VM prevent cross-workload interference. Production-critical VMs cannot be starved by co-located workloads. Firecracker <125ms boot provides rapid recovery from DoS-induced failure | Weaver | v1.0 |
| **IEC 62443-3-3 SR 7.3** — Control System Backup | Maintain backups of IACS programs, configuration data, and state | Declarative NixOS config IS the backup — any system is reproducible from the declared configuration. Sub-second boot from backup config eliminates lengthy restore procedures | Weaver | v1.0 |
| **IEC 62443-4-2 CR 2.1** (Component Requirement) — Authorization Enforcement | Software component enforces authorization for all users and devices | Platform-level RBAC applies uniformly to all hosted components — historian VMs, SCADA gateway containers, MES instances — without per-application integration | Fabrick | v1.0 |
| **IEC 62443-4-2 CR 7.2** — Resource Management | Software component manages its resources to prevent resource exhaustion | Resource quotas declared per VM/container. Weaver enforces limits on historian and SCADA gateway containers. No component can exhaust shared resources silently | Weaver | v1.0 |
| **NIST SP 800-82 Rev. 3 — Section 5.2** (ICS Network Architecture) | Design ICS network to minimize exposure through DMZ between IT and OT | Managed bridges model the IT/OT DMZ declaratively. Strands shows what runs in each zone. Explicit conduit declarations replace implicit flat-network connectivity | Weaver | v1.0 |
| **NIST SP 800-82 Rev. 3 — Section 6.1** (Asset Management) | Maintain asset inventories for all ICS components | Declarative config is the asset inventory. Every VM, container, bridge, and IP pool is declared in code — nothing is implicit. Strands maps running containers to their zone assignments | All tiers | v1.0 |
| **NIST SP 800-82 Rev. 3 — Section 6.2** (Configuration Management) | Establish and maintain configuration baselines; control and monitor all changes | NixOS declarative model: baseline = running state, always. Git history provides complete change provenance for every ICS-adjacent compute node | Weaver | v1.0 |
| **NIST SP 800-82 Rev. 3 — Section 6.4** (Patching) | Apply patches to ICS components; test in equivalent environment before production deployment | Declarative NixOS patch management applies fleet-wide. Non-production identical-config clone enables tested rollout — same config, different host — before touching production-adjacent nodes | Weaver | v1.0 |
| **NERC CIP-005-7** — Electronic Security Perimeters | Define and document Electronic Security Perimeters (ESPs); control and monitor access at ESP boundaries | Managed bridges define ESP boundaries declaratively. Every inter-zone communication path is an explicit bridge rule — no implicit routing across perimeters. Applicable to manufacturers operating bulk electric system assets | Fabrick | v1.0 |
| **NERC CIP-007-6** — Systems Security Management | Manage security patches, control ports/services, monitor security events for CIP systems | NixOS declarative model controls which ports and services run per VM. Only declared services execute. AI diagnostics surface security events in natural language for operators without OT-specific tooling | Fabrick | v1.0 |
| **NERC CIP-010-4** — Configuration Change Management | Document baseline configurations; control and monitor changes; detect unauthorized changes | Zero-drift NixOS: detected unauthorized change = impossible by construction. Every configuration variation requires a git commit. Baselines are always current — the running system is the baseline | Fabrick | v1.0 |
| **EU NIS2 Directive — Art. 21** (Risk Management Measures, effective Oct 2024) | Implement technical measures covering: risk analysis, incident handling, business continuity, supply chain security, network security, access control, asset management, cryptography | Zero drift addresses risk analysis (known state = known attack surface). AI diagnostics accelerate incident handling. Declarative config satisfies asset management and access control. Self-hosted eliminates cloud supply chain exposure. Applicable to essential and important entities in manufacturing | Fabrick | v1.0 (core measures), v1.2 (network hardening) |
| **EU NIS2 Directive — Art. 23** (Incident Reporting Obligation) | Report significant incidents to national CSIRT within 24 hours (early warning), 72 hours (notification), 1 month (final report) | AI diagnostics accelerate incident detection and root cause identification. Declarative baselines enable rapid forensic comparison — the known-good state is always available for comparison against incident state | Weaver | v1.0 |
| **EU NIS2 — Supply Chain Security** | Assess and manage cybersecurity risks in the supply chain, including direct suppliers | Self-hosted — no cloud dependencies. Single-vendor infrastructure for VM/container management reduces supply chain surface. Open-core codebase is auditable | Fabrick | v1.0 |
| **FDA 21 CFR Part 11** — Electronic Records (pharmaceutical manufacturing) | Computer-generated, tamper-evident audit trails; unique user IDs; access controls; electronic record integrity | Git-based audit log satisfies 21 CFR Part 11 §11.10(e) (audit trail) and §11.10(d) (access controls). Per-VM RBAC enforces unique identity at every system boundary. Declarative config ensures validated system state is reproducible | Fabrick | v1.0 |
| **FDA 21 CFR Part 11 §11.10(a)** — Validation of Systems | Validate systems to ensure accuracy, reliability, consistent performance, and ability to discern invalid records | NixOS declarative model: identical config = identical system behavior, guaranteed. Validation of the NixOS configuration validates every system built from it — validate once, deploy consistently | Fabrick | v1.0 |
| **ISO 27001:2022 — A.8.8** (Management of Technical Vulnerabilities) | Timely identification and remediation of technical vulnerabilities in information systems | Fleet-wide declarative patch application — one NixOS config change updates all nodes. Zero-drift means no vulnerability can be introduced via configuration drift | Fabrick | v1.0 |
| **ISO 27001:2022 — A.8.22** (Segregation of Networks) | Networks shall be segregated based on information classification and security requirements | Managed bridges implement declarative network segregation. IT/OT zones are code, not manual VLAN configuration. Topology is always current — the declared bridges ARE the network architecture | Weaver | v1.0 |
| **ISO 27001:2022 — A.8.9** (Configuration Management) | Security configurations shall be established, documented, implemented, and reviewed | NixOS declarative config IS the documented security configuration. Review = code review. Implementation = deployment. No gap between documentation and running state | Weaver | v1.0 |
| **ISO 27001:2022 — A.5.33** (Protection of Records) | Records shall be protected from loss, destruction, falsification, unauthorized access | Git-based immutable audit log. Cryptographic hash chain prevents falsification. Access controls prevent unauthorized modification. Declarative backup restores records infrastructure from declared config | Fabrick | v1.0 |

### Indirect Compliance Support

| Manufacturing Function | Pain Today | How Weaver Helps |
|----------------------|-----------|----------------------------|
| **Software-Defined Purdue Model** | Purdue model exists in diagrams; actual network is flat or partially segmented via manual VLANs that drift | Managed bridges create declarative Purdue-model zone boundaries. Level 2 (supervisory) and Level 3 (site operations) separation is code — enforced and version-controlled |
| **IT/OT DMZ Management** | DMZ between IT and OT is a firewall rule set maintained manually — no version control, no audit trail | Declarative bridge rules and managed IP pools define DMZ conduits. Every rule change is a git commit. Rollback is one command |
| **Legacy System Isolation** | Unpatched Windows XP HMIs and 20-year-old PLCs cannot be taken offline for patching — they must be isolated and monitored | Isolate legacy OT hosts in dedicated bridge segments. Explicit, auditable conduit declarations define every allowed communication path. Nothing implicit |
| **Weaver — OT Zone Visibility** | No operational topology map exists for OT zone containers; Wireshark is forensic, not operational | Weaver topology map shows every container in every zone in real time. Rootless Podman for historian containers — no privileged daemon in the OT DMZ |
| **Process Historian Containers** | Historians run on Windows VMs managed separately; no declarative baseline; high attack surface from privileged processes | Weaver manages historian containers with rootless Podman. No privileged daemon. Declarative config. CPU/memory quotas prevent runaway processes from affecting adjacent OT workloads |
| **Edge Compute at Production Lines** | Edge nodes at individual lines run independently — each with slightly different config, no centralized baseline | Declarative NixOS config guarantees every edge node runs identical baseline. Clone config to deploy to new line. Offline-first license works with no connectivity to central site |
| **Patch Testing Without Production Risk** | Patches cannot be tested on production OT systems; test environments diverge from production over time | Declarative config enables identical-config test clone. Test the patch on a declaratively identical non-production system. Deploy to production with confidence |

---

## 3. Weaver for Manufacturing/OT {#3-weaver-for-manufacturingot}

**Target:** Single-plant manufacturers, small OEM suppliers, contract manufacturers, manufacturing IT teams managing <50 VMs, edge compute deployments at production lines, pharmaceutical manufacturing sites with CSV/validation requirements

**Price:**
- **Weaver Solo:** $149/yr (FM, first 200) (single admin, local host only, up to 128GB RAM)
- **Weaver Team:** $129/user/yr (FM, first 50 teams) — 2–4 users + 1 viewer free, up to 2 remote peer Weaver hosts (full management, v2.2.0)

**The pitch:** "Your production line runs 24/7. When the process historian VM fails at 2 AM, do you want to SSH in and rebuild from memory — or have it back online in under a second? Weaver gives OT-adjacent infrastructure the same sub-second recovery and zero-drift guarantees that production lines require. For less than the cost of twenty minutes of unplanned downtime."

### Key Weaver Wins for Manufacturing/OT

| Capability | OT/IT Convergence Value |
|-----------|------------------------|
| **Live Provisioning** | Spin up monitoring VMs, historian replicas, or edge analytics containers without SSH and rebuild cycles. New production line addition means new VMs in minutes, not maintenance window scheduling |
| **Zero Configuration Drift** | Production-adjacent VM configs never change unless declared. The config running on a Thursday midnight shift is identical to what was tested and approved. NixOS: no silent changes, ever |
| **Maintenance Manager** (v2.1.0) | Host OS updates on 24/7 production systems — without a maintenance window. Path B (Weaver Team): clone OT-adjacent VMs to standby via LP API (seconds), shift bridge traffic to standby, update the host, AI validates rebuilt VMs, commit only when healthy. Process historian and SCADA gateway VMs serve traffic throughout the host rebuild. AI remediation loop fixes failures automatically before the operator sees them |
| **Managed Bridges — IT/OT Zone Segmentation** | Declarative bridge rules create the software-defined Purdue model. Level 2/Level 3 boundary is a NixOS declaration, not a manually maintained firewall ruleset. Foundation for IEC 62443-3-3 SR 5.2 zone boundary protection |
| **Weaver — OT Zone Topology** | Real-time topology map of all containers in each OT zone. Know exactly what is running in the supervisory network segment without running Wireshark. Rootless Podman for historian and SCADA gateway containers — no privileged daemon in the OT DMZ |
| **Sub-Second VM Boot** | Firecracker boots in <125ms. Process historian or SCADA gateway VMs recover before operators notice the failure. Production impact measured in milliseconds, not maintenance windows |
| **Offline-First License** | HMAC validation, no phone-home. Works in factories with air-gapped production networks. OT networks with no internet egress operate Weaver without connectivity. No cloud dependency in the OT zone |
| **Multi-Hypervisor** | Firecracker for lightweight, minimal-attack-surface OT monitoring containers. QEMU for full-VM workloads (Windows HMI VMs, historian servers). One dashboard, one security policy, right isolation model per workload |
| **Declarative Patch Testing** | Clone production VM config to identical test environment. Test ICS patches on a system that is mathematically identical to production. No production exposure until the patch is validated |

### ROI — Single Plant, 5 OT-Adjacent Nodes

| Cost Category | Current State | With Weaver |
|-------------|--------------|-------------------------------|
| Proxmox: EUR355/socket x 5 = **EUR1,775/yr** | — | 5 nodes x $149 = **$745/yr** (Solo) or $129/user/yr (FM) (Team) |
| IT admin time on OT-adjacent VM management (8 hrs/week, $65/hr) | **$27,040/yr** | Reclaim 5 hrs/week = **$16,900/yr freed** for IEC 62443 compliance work |
| Unplanned production downtime (2 incidents/yr x 4 hrs x $5,000/hr) | **$40,000/yr** | Sub-second recovery eliminates most process historian/gateway downtime. Estimated 90% reduction = **$36,000/yr saved** |
| Configuration drift investigation after production incidents | **$5,000–10,000/yr** | $0 — drift is impossible by construction |
| OT segmentation audit prep (manual evidence collection) | **$8,000–15,000/yr** | Config-as-code is the evidence — preparation drops from weeks to hours |
| **Total current burden** | **~$80,040–92,040/yr** | **$745/yr (Solo) + $52,900+ in labor freed and downtime avoided** |

### Weaver Team for Manufacturing/OT

**Target:** Small OT engineering teams with a primary engineering host and a separate HMI/SCADA server or edge compute host on the plant floor, where the team needs cross-host visibility without a full Fabrick deployment.

**Ships:** v2.2.0 — 2–4 users + 1 viewer free, up to 2 remote peer Weaver hosts (full management in the existing Weaver view; host badge on workload cards). Tailscale MagicDNS peer discovery + manual IP entry (for isolated OT networks with no Tailscale). Each host independently licensed at $129/user/yr (FM).

**OT use case:** A small OT engineering team with a primary engineering host and a separate HMI/SCADA server or edge compute host on the plant floor. Weaver Team lets the team manage plant-floor workloads from the engineering station — is the HMI VM running? Is the edge compute node consuming expected resources? Restart or provision directly from the primary view — via Tailscale or direct IP entry for isolated OT networks where Tailscale is not permitted. The 2-peer cap covers the engineering host, the plant floor host, and one more (for example, a quality system server). Full management at Weaver Team — the engineering team can observe and manage workload state on the remote host directly.

**IEC 62443 note:** Weaver Team provides full management of up to 2 remote peers. Centralized OT fleet management beyond 2 peers, fleet-scale governance, and compliance audit trail for IEC 62443 FR 1/FR 2/FR 6 all gate on Fabrick. Weaver Team is the starting point for organizations building toward a full OT management posture without the immediate overhead of a Fabrick deployment.

**Upgrade trigger:** More than 2 remote peers, fleet-scale governance, per-VM RBAC, or compliance audit trail requires Fabrick.

---

## 4. Fabrick for Manufacturing/OT {#4-fabrick-for-manufacturingot}

**Target:** Multi-plant manufacturers, OEMs with tier-1 customer compliance requirements, pharmaceutical manufacturers under FDA 21 CFR Part 11 and CSV validation, energy/utility manufacturers under NERC CIP, organizations pursuing NIS2 compliance, ISO 27001 certification programs with IT/OT scope

**Price:** $2,000/yr first node + $750/yr additional + $500/yr at 10+ nodes (up to 256GB RAM)

**The pitch:** "Your NIS2 deadline passed in October 2024. Your tier-1 OEM customer just sent a supplier security assessment with IEC 62443 questions. Your cyber insurer wants evidence of IT/OT segmentation. Weaver makes your OT-adjacent infrastructure self-documenting — every zone boundary, every access control, every configuration change is a git commit. Hand your auditor the repo instead of scheduling a site visit."

### Fabrick Features Mapped to Manufacturing/OT Obligations

| Fabrick Feature | OT Regulation / Requirement | Evidence Produced | Available |
|-------------------|----------------------------|-------------------|:---------:|
| **Per-VM RBAC** | IEC 62443-3-3 SR 1.1 / SR 2.1 — identification, use control; ISO 27001 A.5.15 | Role assignments per VM enforce OT engineer vs IT staff vs admin separation. OT operators see Level 2 VMs; IT staff see Level 3/DMZ VMs; no cross-domain escalation | v1.0 |
| **SSO/SAML/LDAP** | IEC 62443-3-3 SR 1.1 — software process identification; ISO 27001 A.5.16 | Active Directory integration — single identity source across IT and OT management plane. Deprovisioning is automatic | v1.2+ |
| **Declarative Audit Log** | IEC 62443-3-3 SR 6.1 — audit log accessibility; FDA 21 CFR Part 11 §11.10(e); NIS2 Art. 23 | Git commit history: who, what, when, why — tamper-evident, immutable. Satisfies IEC 62443 FR 6 timely response to events. Forensic baseline for incident reporting | v1.0 |
| **Managed Bridges + IP Pools** | IEC 62443-3-3 SR 5.2 — zone boundary protection; NERC CIP-005-7 — ESP definition; ISO 27001 A.8.22 | Declarative zone/conduit model. IT/OT DMZ boundary is code, not manual config. NERC CIP ESP perimeter defined in version-controlled declarations | v1.0 |
| **Weaver — Rootless Podman** | IEC 62443-4-2 CR 7.2 — resource management; NIS2 Art. 21 — network security | Historian and SCADA gateway containers with rootless Podman — no privileged daemon in OT DMZ. CPU/memory quotas per container declared in config | v1.0 |
| **Resource Quotas** | IEC 62443-3-3 SR 7.1 — DoS protection; IEC 62443-4-2 CR 7.2 | Resource limits prevent production historian containers from being starved by co-located workloads. Availability is declarative | v1.0 |
| **Bulk VM Operations** | NIS2 Art. 21 — risk management; ISO 27001 A.8.8 — patch management | Fleet-wide policy changes applied atomically. Update all SCADA gateway VMs across all plants in one operation | v1.0 |
| **All Plugins Included** | IEC 62443-3-3 SR 5.2 (firewall); NERC CIP-007-6 (port/service control); NIS2 Art. 21 | nftables declarative firewall (v1.2), DNS auto-zones (v1.1), AppArmor/Seccomp for container hardening (v1.2) — complete OT DMZ security stack | v1.0 (DNS v1.1, firewall/hardening v1.2) |

### Fleet Onboarding (v2.3.0)

Multi-plant manufacturers arriving at Fabrick with existing NixOS hosts on OT-adjacent networks use the **CIDR probe** path: admin specifies plant network segments; Fabrick probes only the Weaver agent port (50051) — not a general port scan — on those segments. RFC 1918 enforcement is built in; public IPs are rejected at input. Each plant's compute hosts — SCADA gateway servers, HMI hosts, historian servers, edge Linux nodes — are discoverable this way without any external API calls or internet traffic.

**Scope boundary:** Fabrick discovers and manages Linux compute hosts, not PLCs, sensors, or embedded OT endpoints. This is the architecturally correct model for IEC 62443: Weaver enforces the zone boundary at the compute layer (Level 2–3 DMZ); below it is Level 0–1 OT device territory. The boundary is not a limitation — it is the compliance architecture. A Fabrick deployment that claims to manage PLCs alongside Linux hosts would blur the zone boundary that IEC 62443 zone/conduit separation requires. Weaver keeps the boundary clean and auditable.

Discovered hosts land in Fabrick; workload inventory (SCADA containers, historian VMs, gateway workloads) is pulled from each Weaver agent automatically on registration. Each discovery session is audit-logged with triggering user, timestamp, and CIDR input — evidence for IEC 62443-3-3 SR 6.1 (audit log accessibility).

OT-adjacent Linux hosts that cannot be immediately converted — Yocto/Buildroot edge nodes, Ubuntu historian servers, custom OT gateway builds — can join as **Observed** fleet members via `weaver-observer` (statically-linked Rust binary, memory-safe, zero runtime dependencies, any Linux kernel ≥ 4.x). Observed hosts show running containers and processes read-only. They do not contribute to IEC 62443 compliance evidence. Observer nodes are included free up to 5× the Managed node count. The fleet map distinguishes Managed hosts (full compliance evidence, within the IEC 62443 zone boundary) from Observed hosts — the zone boundary remains honest and auditable for customer and OEM security assessments.

### Fabrick Success Programs for Manufacturing/OT

| Program | OT Application | FM Price | Standard Price |
|---------|---------------|:--------:|:--------------:|
| **Adopt** | NixOS onboarding for plant IT/OT teams; IEC 62443 zone/conduit architecture design mapped to managed bridges; Weaver deployment for OT zone topology; NERC CIP ESP boundary review | $5,000/yr | $15,000/yr |
| **Adopt — Compliance** | Everything in Adopt + IEC 62443-3-3 system requirements mapping session; NERC CIP ESP boundary evidence walkthrough; NIS2 Art. 21 risk measure documentation; OT asset register architecture review | — | $25,000/yr |
| **Accelerate** | Quarterly fleet reviews mapped to IEC 62443-3-3 System Requirements and NIST SP 800-82 controls; multi-plant configuration consistency audits; NIS2 Art. 21 risk measure documentation; customer/OEM audit preparation support | $15,000/yr | $45,000/yr |
| **Partner** | Named engineer with manufacturing IT/OT experience; priority features for OT-specific needs (SCADA isolation templates, OPC UA gateway patterns, historian container playbooks, NERC CIP evidence packages); FDA CSV infrastructure validation support; ISO 27001 OT scope certification | $30,000/yr | $90,000/yr |

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = $9,000/yr total compliance coverage during the FM period. Standard Adopt — Compliance ($25,000/yr) includes hands-on compliance service delivery not covered by the extension alone.

### ROI — Multi-Plant Manufacturer (5 Plants, 40 Nodes)

| Cost Category | Current State | With Fabrick |
|-------------|--------------|----------------------------------|
| Infrastructure software (VMware across plants) | $20,000–60,000/yr | 40 nodes: $23,500/yr |
| IT/OT staff on infrastructure (3 FTEs, 30% on VM/container management) | $78,000/yr | Reclaim 20 hrs/week = $50,700/yr redirected to IEC 62443 compliance and OT security |
| Production downtime (5 plants x 3 incidents/yr x 2 hrs x $10,000/hr) | $300,000/yr | Sub-second recovery: estimated 90% reduction = **$270,000/yr saved** |
| OT segmentation audit prep (per customer/OEM audit cycle) | $30,000/yr across compliance team | < 1 week — config-as-code is the evidence |
| NIS2 / ISO 27001 evidence collection (IT/OT scope) | $15,000–25,000/yr | Declarative config produces evidence continuously — not periodically |
| OT visibility tooling (Claroty/Dragos are overkill for VM/container layer) | $0 (no tool exists at this price point) | Weaver fills the gap — included |
| Success program | N/A | Accelerate: $15,000/yr (FM) |
| **Total** | **$443,000–513,000/yr** | **$38,500/yr + $370,000+ in redirected labor and avoided downtime** |

---

## 5. Deficiency Remediation Plan {#5-deficiency-remediation-plan}

Most manufacturers pursuing IEC 62443 compliance, NIS2 conformance, or ISO 27001 certification for IT/OT scope discover that their infrastructure tooling cannot produce the evidence required. Configuration baselines do not exist. Zone boundaries are maintained manually. Audit logs are API exports, not tamper-evident records. Weaver closes these gaps systematically — starting with the fastest wins at Weaver.

### The Sales Motion: Frame Every Audit Finding as a Revenue Risk

Every IEC 62443 non-conformance is a risk on the next customer security questionnaire. Every NIS2 gap is a regulatory exposure with Article 34 penalty potential (up to €10M or 2% of global turnover for essential entities). Every ISO 27001 non-conformity delays certification and delays the supplier approvals that depend on it. Frame Weaver as a compliance remediation tool. Each closed finding strengthens the manufacturer's position with customers, insurers, and regulators.

### Phase 1: Quick Wins at Weaver ($149/yr (FM) per node)

| Standard / Control | Requirement | How Weaver Closes It | Audit Impact | Available |
|-------------------|------------|----------------------|:------------:|:---------:|
| **IEC 62443-3-3 SR 3.4** — Software Integrity | Detect and protect against unauthorized changes to software | NixOS immutable store: unauthorized software changes are structurally impossible without a git commit | Closes finding | v1.0 |
| **IEC 62443-3-3 SR 7.1** — DoS Protection | Protect IACS availability against denial-of-service | Resource quotas per VM, Firecracker <125ms recovery, production VMs recover before operators notice | Closes finding | v1.0 |
| **IEC 62443-3-3 SR 7.3** — Control System Backup | Backup and restore IACS configuration | Declarative NixOS config IS the backup — deterministic rebuild from declaration, not from tape | Closes finding | v1.0 |
| **NIST SP 800-82 §6.2** — Configuration Management | Establish baselines; control changes | NixOS declarative model: baseline = running state, always. Change = git commit. Auditable by construction | Closes finding | v1.0 |
| **IEC 62443-3-3 SR 5.2** — Zone Boundary (foundation) | Define and enforce zone boundaries | Managed bridges create declarative zone/conduit architecture. DMZ boundary is code, not manual VLANs | Substantially improves | v1.0 |
| **NIS2 Art. 21 — Asset Management** | Identify and inventory OT assets under risk management measures | Declarative config IS the asset inventory — every VM, container, bridge, and IP pool declared explicitly | Closes finding | v1.0 |
| **NIS2 Art. 21 — Business Continuity** | Implement measures for system availability and recovery | Sub-second VM boot, declarative rebuild, offline-first operation — business continuity by construction | Substantially improves | v1.0 |
| **ISO 27001:2022 A.8.9** — Configuration Management | Establish, document, and review security configurations | NixOS declarative config: documentation = code, always current. Review = pull request. No documentation-to-reality gap | Closes finding | v1.0 |
| **ISO 27001:2022 A.8.22** — Network Segregation | Segregate networks by classification and security requirement | Managed bridges create IT/OT zone segregation declaratively. Conduit declarations define allowed cross-zone paths | Closes finding | v1.0 |
| **NIST SP 800-82 §6.4** — Patch Management | Patch ICS systems; test before production deployment | Declarative patch application fleet-wide. Identical-config test clone enables safe pre-production validation | Substantially improves | v1.0 |

**Audit Impact:** Weaver deployment closes the configuration management, integrity, availability, and asset inventory findings that appear on virtually every IEC 62443 assessment and ISO 27001 Stage 1 audit. These are the findings that delay certification timelines.

### Phase 2: Fabrick Upgrades That Close Access, Boundary, and Audit Controls

| Standard / Control | Requirement | How Fabrick Closes It | Audit Impact | Available |
|-------------------|------------|-------------------------|:------------:|:---------:|
| **IEC 62443-3-3 SR 1.1** — Human User Identification | Uniquely identify and authenticate users | Per-VM RBAC enforces unique identity. SSO/LDAP (v1.2+) ties identity to organizational directory with lifecycle management | Closes finding | v1.0 (RBAC), v1.2+ (SSO/LDAP) |
| **IEC 62443-3-3 SR 2.1** — Authorization Enforcement | Enforce authorization decisions | Per-VM role assignments enforce least privilege at every OT-adjacent VM boundary | Closes finding | v1.0 |
| **IEC 62443-3-3 SR 5.2** — Zone Boundary (full) | Deny-by-default inter-zone traffic; explicit conduit rules only | Declarative firewall (v1.2) with deny-by-default. Only explicitly declared conduits pass traffic between zones | Closes finding | v1.0 (bridges), v1.2 (deny-by-default) |
| **IEC 62443-3-3 SR 6.1** — Audit Log | Create and protect audit log records | Git-based immutable audit log. Tamper-evident. Attributable to individual users. Available for forensic investigation | Closes finding | v1.0 |
| **NERC CIP-005-7** — Electronic Security Perimeter | Define and control ESP; monitor access at perimeter | Managed bridges define ESP boundaries declaratively. Every inter-zone path is a declared conduit. Audit log captures all boundary interactions | Closes finding | v1.0 |
| **NERC CIP-007-6** — Systems Security Management | Control ports/services; manage security events | NixOS declarative model controls which ports and services run. AI diagnostics surface security events. Only declared services execute | Closes finding | v1.0 |
| **NERC CIP-010-4** — Configuration Change Management | Baseline configurations; detect unauthorized changes | Zero-drift: unauthorized change = impossible. Every config variation is a git commit with attribution and reason | Closes finding | v1.0 |
| **FDA 21 CFR Part 11 §11.10(e)** — Audit Trails | Computer-generated, tamper-evident audit trails | Git commit history satisfies §11.10(e) directly — immutable, tamper-evident, captures original value and change attribution | Closes finding | v1.0 |
| **FDA 21 CFR Part 11 §11.10(a)** — System Validation | Validate systems for accuracy, reliability, consistent performance | Declarative NixOS: identical config = identical system. Validate the configuration, not each instance. Validated state is reproducible | Closes finding | v1.0 |
| **NIS2 Art. 21 — Access Control** | Implement access control measures as part of risk management | Per-VM RBAC enforces access policy at OT-zone granularity. Fabrick RBAC satisfies NIS2 access control obligations | Closes finding | v1.0 |
| **ISO 27001:2022 A.5.15** — Access Control | Manage access rights based on business and security requirements | Per-VM RBAC with role hierarchy — OT operators, IT admins, and security personnel see only their authorized systems | Closes finding | v1.0 |

**Audit Impact:** Fabrick closes the access control, boundary enforcement, and audit trail findings — the IEC 62443 Foundational Requirements 1, 2, 5, and 6 that most manufacturers have the deepest gaps on due to the IT/OT divide.

### Phase 3: Success Programs That Close Architecture and Process Controls

Some IEC 62443 and NIS2 requirements are architecture- and process-oriented: documented zone models, risk assessments, incident response procedures. The Fabrick success programs close these.

| Standard / Control | Requirement | How Success Programs Help | Program |
|-------------------|------------|--------------------------|:-------:|
| **IEC 62443-3-3 — Zone/Conduit Model** | Documented zone and conduit architecture for IACS | Adopt program: IEC 62443 zone/conduit architecture review mapped to managed bridge topology. Accelerate: quarterly validation | Adopt / Accelerate |
| **NIS2 Art. 21 — Risk Analysis** | Perform and document risk analysis for OT systems in scope | Accelerate: quarterly fleet review maps Weaver state to NIS2 risk management measures; generates documentation for national authority reporting | Accelerate |
| **NIS2 Art. 23 — Incident Reporting** | Establish procedures for 24-hr early warning, 72-hr notification, 1-month final report | Accelerate: incident response workflow integration; AI diagnostics feed triage documentation aligned to NIS2 reporting timelines | Accelerate |
| **IEC 62443 — Security Level Assessment** | Determine required Security Levels (SL-T) per zone; demonstrate achieved SL | Partner: per-zone security level assessment mapped to Weaver capabilities; SL-2 architecture design for critical zones | Partner |
| **ISO 27001 — OT Scope ISMS** | Extend ISMS scope to OT systems; management review covering OT controls | Partner: ISO 27001 OT scope certification support; annual management review covering IT/OT fleet state and control effectiveness | Partner |

### The Full Remediation Path

| Stage | Investment | Timeline | Compliance Impact | Findings Addressed | Version Required |
|-------|-----------|----------|:-----------------:|:------------------:|:----------------:|
| **Weaver deployment** | $745–5,960/yr (5–40 nodes) | Month 1–2 | Configuration, integrity, availability, asset inventory closed | IEC 62443-3-3 SR 3.4/7.1/7.3, ISO 27001 A.8.9/A.8.22, NIS2 asset management | v1.0 today |
| **Fabrick upgrade** | $23,500/yr (40 nodes) | Month 3–4 | Access control, audit, NERC CIP, FDA Part 11 closed | IEC 62443 SR 1.1/SR 2.1/SR 6.1, NERC CIP-005/007/010, FDA §11.10 | v1.0 today |
| **v1.1 plugins** | Included in tier | v1.1 release | DNS auto-zones for OT zone isolation | DNS-based zone segmentation | v1.1 |
| **v1.2 security plugins** | Included in Fabrick | v1.2 release | Deny-by-default firewall closes IEC 62443 SR 5.2 fully; AppArmor/Seccomp for container hardening | IEC 62443-3-3 SR 5.2, NIS2 Art. 21 network security | v1.2 |
| **Accelerate program** | $15,000/yr | Month 4–6 | NIS2 Art. 21 risk documentation, IEC 62443 zone documentation, ISO 27001 OT scope controls | Architecture and process controls | Service |
| **Partner program** | $30,000/yr | Ongoing | SL-2 certification path, multi-plant standardization, ISO 27001 OT certification | Security level assessment, ISMS management review | Service |
| **Cumulative (v1.0 today)** | | Immediate | Core IEC 62443 FRs, NERC CIP, NIS2, FDA Part 11 | 25+ controls with direct evidence | Available now |
| **Cumulative (through v1.2)** | | ~6 months | Comprehensive IEC 62443 SL-2, full NIS2 Art. 21, ISO 27001 IT/OT scope | 40+ controls with direct evidence | v1.2 release |

---

## 6. Competitive Advantages {#6-competitive-advantages}

### vs Claroty / Dragos / Nozomi (OT Security Platforms)

This is not a replacement play. Claroty, Dragos, and Nozomi are passive protocol analyzers and threat intelligence platforms that operate at the network and device level — they detect what is happening on OT networks. Weaver manages the VMs and containers that those tools monitor. The comparison is additive, not substitution.

| Factor | Claroty / Dragos / Nozomi | Weaver |
|--------|--------------------------|-------------------|
| What it does | Passive OT protocol analysis, asset discovery, threat detection at network/device layer | VM and container lifecycle management, zone segmentation, configuration baseline, topology visibility |
| Entry price | $50,000–200,000+ per site; enterprise-only | $745–23,500/yr for 5–40 nodes |
| Who can afford it | Enterprise manufacturers (500+ employees, dedicated OT security team) | Any manufacturer running OT-adjacent VMs or containers |
| VM/container management | Not in scope | Core function |
| IEC 62443 configuration management | Not addressed | Closed by declarative NixOS model |
| Configuration baseline enforcement | Not addressed | Zero-drift — impossible by construction |
| Recovery capability | Not in scope | Sub-second Firecracker boot |
| Deployment model | Requires dedicated appliance/sensor infrastructure | Runs on existing plant servers |
| **Positioning** | "Tell me what's wrong on the OT network" | "Manage what runs in the OT zone and prove it never drifted" |

For mid-market manufacturers who cannot justify $50K+ for an OT security platform, Weaver delivers the infrastructure management and configuration compliance layer that the OT security tools assume you have built — at a price that does not require a capital budget.

For enterprise manufacturers who already run Claroty or Dragos: Weaver is the management layer for the OT-adjacent VMs and containers that those platforms monitor. Strands gives the IT team the same zone-level visibility they get from the OT security platform — for the infrastructure layer.

### vs VMware (Post-Broadcom)

| Factor | VMware | Weaver |
|--------|--------|-------------------|
| Cost (40 nodes, 5 plants) | $20,000–60,000/yr (subscription-only) | $23,500/yr |
| OT zone segmentation | Manual VLAN/firewall configuration per plant; drifts | Declarative managed bridges — zone architecture is code, enforced identically across all plants |
| Configuration drift | Possible and common; requires periodic scanning | Impossible by construction (NixOS) |
| Offline / air-gap support | Requires connectivity for licensing | Offline-first HMAC license, no phone-home |
| Recovery time | Minutes to hours | Sub-second (Firecracker <125ms) |
| IEC 62443 / NIS2 evidence | Requires separate audit logging and change management tools | Built-in — every change is a git commit |
| Container management (OT historian, SCADA gateway) | Requires separate Kubernetes or container platform | Weaver built-in with rootless Podman |

### vs Proxmox

| Factor | Proxmox | Weaver |
|--------|---------|-------------------|
| OT zone architecture | Manual network config per cluster; no zone model | Declarative bridge isolation — zone/conduit model as code |
| Per-VM RBAC | Pool-level permissions only | Per-VM role assignments — IT staff and OT engineers see only their authorized domains |
| Zero drift | No — imperative management allows silent changes on 24/7 systems | Yes — declarative by construction |
| Audit evidence for IEC 62443 | API call logs — actions, not intent or approval | Git diffs — what changed, who approved, and why |
| Weaver / topology | Not available | Topology map per zone, rootless Podman, CPU/memory quotas |
| NIS2 / ISO 27001 evidence | Manual documentation required | Self-documenting config-as-code |

### The Offline-First Advantage

OT production networks frequently have no internet egress — by policy, by architecture, or by regulation. Weaver's offline-first license validation (HMAC, no phone-home) is designed for disconnected environments. No competitor at this price point offers offline-first licensing. For OT networks where internet access is restricted or prohibited, this is not a convenience feature — it is a requirement.

> **Pending differentiator — Onsite AI Model:** For ESP-connected and air-gapped OT zones where cloud AI is prohibited by architecture or IEC 62443 policy, `aiPolicy: local-only` routes all AI diagnostics to an onsite inference node inside the OT zone. Hardware/deployment spec not yet defined (see NOTES.md 2026-03-26). When spec'd, this closes the gap in the OT AI story: AI-assisted diagnostics and configuration analysis stay inside the zone boundary. Update this section when the onsite AI model spec ships.

### The Zero-Drift Production Advantage

Configuration drift in OT environments is not an audit finding — it is a production risk. A process historian VM that silently changed its network interface configuration can cause data gaps that invalidate a batch record. A SCADA gateway that was modified during a maintenance window without documentation can fail an IEC 62443 assessment and a customer audit simultaneously. NixOS eliminates this category of risk structurally. What was declared is what runs. The configuration you validated on Tuesday afternoon is the configuration running at 3 AM on Saturday. That guarantee is worth more to OT-adjacent infrastructure than any feature list.

#### Kubernetes Complexity in Manufacturing/OT

OT environments need air-gapped, deterministic infrastructure with zero external dependencies at runtime. Kubernetes control plane requires persistent network connectivity to etcd, the API server, and container registries — offline K8s is painful and fragile. For manufacturers with IEC 62443 zone segmentation requirements, K8s network policies are software-defined and audit-complex compared to hardware boundaries.

| K8s Overhead | Impact in Manufacturing/OT | Weaver Alternative |
|---|---|---|
| Control plane connectivity requirement (etcd, API server, registry) | OT zones are air-gapped by policy or regulation — K8s cannot operate disconnected | NixOS + Weaver works fully offline; flake inputs are pinned and cacheable; no container registry dependency at runtime |
| Platform team staffing (3-5 K8s engineers at $150K+/yr each) | Mid-market manufacturers cannot justify a platform team for OT-adjacent infrastructure | One sysadmin manages Weaver; $149/yr Solo vs $450K+/yr in K8s engineering headcount |
| Non-deterministic pod scheduling | OT requires deterministic, predictable infrastructure — K8s scheduler introduces variability | NixOS declarative config: what was declared is what runs, always. Firecracker boots in <125ms to a known state |

Full competitive reference: [KUBERNETES-COMPETITIVE-POSITIONING.md](../KUBERNETES-COMPETITIVE-POSITIONING.md)

### AI-Era Threat Landscape Advantage

Anthropic's Project Glasswing (April 2026) demonstrated that frontier AI can discover **thousands of zero-day vulnerabilities** — including some that survived decades of human review — across every major operating system and browser. These capabilities will proliferate to attackers.

**Why this changes the calculus for manufacturing and OT:**

- **Shared-kernel = fleet-wide compromise.** A single kernel zero-day — exactly the kind AI is now finding by the thousands — compromises every Docker container on the host simultaneously. In OT environments, that means a single exploit on a converged IT/OT server could pivot from a historian container to a SCADA gateway to a safety system interface — all sharing the same kernel. Weaver's hardware boundary per MicroVM enforces IEC 62443 zone separation at the hypervisor level, containing the blast radius to one workload.
- **Patch at the speed of AI discovery.** OT systems resist patching because downtime is measured in production losses per hour. But AI-discovered zero-days targeting SCADA and ICS infrastructure don't wait for your next maintenance window. NixOS's `flake.lock` pins every dependency by hash. Pin the fix, rebuild, deploy via Colmena — every node converges deterministically. Firecracker's sub-second boot means the patched VM is running before the production line notices. No "did we patch that plant server?" across 5 facilities.
- **Supply-chain verifiability.** Glasswing explicitly targets open-source and supply-chain security. OT-adjacent infrastructure increasingly depends on open-source components (protocol converters, data collectors, edge analytics). NixOS's content-addressed store makes the entire supply chain formally verifiable — every package identified by its complete dependency tree hash, not a mutable tag. When an IEC 62443 assessor or OEM customer audit asks about supply-chain integrity, the answer is a cryptographic hash comparison — not a spreadsheet of vendor attestations.
- **Hypervisor diversity.** Weaver's 5 hypervisor options mean a vulnerability in one doesn't cascade to workloads on another — defense through diversity against AI-augmented exploit discovery. Safety-critical SCADA gateway VMs can run on a different hypervisor than general OT monitoring workloads, ensuring a zero-day in one hypervisor doesn't compromise safety-instrumented systems.

### The Firecracker Advantage for OT Edge

Firecracker microVMs have approximately 5MB of memory overhead per VM. For industrial edge compute — production line monitoring nodes, quality inspection computers, IIoT analytics at the edge — this means dozens of isolated workloads can run on commodity industrial hardware. Traditional hypervisors impose 200–500MB overhead per VM. For edge nodes with 8–16GB RAM, Weaver runs 100+ isolated monitoring containers where VMware runs 15.

---

## 7. Objection Handling {#7-objection-handling}

### "Our OT team will not allow changes to production-adjacent infrastructure"

Correct, and Weaver works within that constraint. Start with the IT-side OT infrastructure: the IT/OT DMZ servers, the historian backup nodes, the SCADA gateway VMs that IT already owns. Prove zero-drift and sub-second recovery on systems the IT team controls. OT adoption follows when the OT team sees that rollback is one command and that the platform cannot silently change a running configuration. The Adopt success program ($5,000/yr) includes joint IT/OT onboarding workshops designed for exactly this tension.

### "We don't know NixOS"

NixOS roots go back to 2003 and it's been shipping stable releases for 12 years — 100K+ packages, ~466 companies in production. OT engineers do not need to know NixOS. Weaver provides a web UI for day-to-day operations. NixOS runs underneath, enforcing zero-drift and declarative configuration. Your IT team manages the NixOS declarations; your OT engineers use the dashboard to monitor their systems. The Adopt program includes onboarding tailored to IT teams who are new to NixOS — typically 2–4 weeks to productive use.

### "We already have Claroty / Dragos for OT visibility"

Good. Weaver is not replacing it — it is the management layer for the VMs and containers those tools monitor. Claroty shows you what is traversing the OT network. Weaver manages and baseline-enforces the compute infrastructure that generates that traffic. Weaver gives the IT team the same topology visibility for the VM/container layer that Claroty gives for the network layer. They are complementary.

### "We can't afford downtime to migrate platforms"

No migration required during production. Start with non-production OT-adjacent workloads — development historian, test SCADA gateway, staging MES. Run Weaver in parallel with existing infrastructure. Migrate workloads one at a time during planned maintenance windows. Sub-second boot and declarative rollback mean the cutover risk is lower than any other platform change you have made. Migration services ($5,000–20,000) run in parallel with zero production disruption.

### "We need NIS2 compliance — but we don't know what that requires from IT infrastructure"

NIS2 Article 21 requires risk management measures covering: network security, access control, asset management, incident handling, and supply chain security. Weaver addresses all five directly: managed bridges for network security, RBAC for access control, declarative config as asset inventory, AI diagnostics for incident handling, and self-hosted architecture for supply chain. The Accelerate success program ($15,000/yr) includes quarterly reviews mapped to NIS2 Art. 21 obligations and documentation for national authority reporting.

### "Our FDA auditor needs to validate our infrastructure systems before using them in GxP processes"

Weaver's NixOS declarative model means validation is performed on the configuration, not the instance. Validate the NixOS configuration file that describes your GxP infrastructure. Every system built from that configuration is identical — validate once, deploy consistently. The Partner success program includes FDA CSV infrastructure validation support, including validation protocols (IQ/OQ/PQ equivalent for infrastructure) and NixOS-specific validation rationale documentation.

### "Our plants have no internet — how do we license and update?"

Offline-first HMAC license requires no connectivity for operation. For updates: download the NixOS update package on a connected system, transfer via approved media to the plant, apply declaratively. The declarative model guarantees the update produces identical results at every plant. Hub-agent multi-site architecture (v2.0+) supports offline-first operation at each site while providing centralized management when connectivity is available.

### "Proxmox is cheaper"

Proxmox Community Edition is EUR 0 upfront. The real cost is the IT staff time managing configuration drift on 24/7 OT-adjacent systems ($27,040+/yr for 8 hrs/week at $65/hr), the unplanned downtime when those undocumented drift changes cause failures ($40,000/yr at 2 incidents), and the audit preparation time when a customer asks you to prove your IEC 62443 zone boundaries ($8,000–15,000/yr). Weaver at $745/yr eliminates the majority of that. The comparison is not license fee vs license fee — it is total cost of ownership including the compliance work that Proxmox cannot do and that your team currently does manually.

### "Our OT gateway hosts run custom Yocto/Buildroot — we can't convert them to NixOS"

Install `weaver-observer` on them. Any Linux host with kernel ≥ 4.x runs the observer agent — including Yocto and Buildroot builds. Those hosts appear in the Fabrick fleet map immediately with workload visibility. Observer nodes are free up to 5× your Managed node count. Convert your IT/DMZ hosts (historian servers, SCADA gateway hosts on standard Linux) to NixOS first to establish the IEC 62443 compliance story; observe the custom embedded builds while you evaluate NixOS on those platforms. The fleet map shows the zone boundary clearly: Managed hosts are in posture, Observed hosts are visible but outside the compliance boundary.

### "IEC 62443-2-4 requires us to assess the security practices of software suppliers to our OT infrastructure"

IEC 62443-2-4 (security for IACS service providers) and NIS2 Article 21 both require documented vendor security assessment. Weaver's IEC 62443-2-4 supplier evidence: SAST with OWASP patterns and supply chain SHA pinning on every push (SR 3.4 — software development practices), CVD policy with 48-hour acknowledgment and 7-day critical fix SLAs (SR 6.2 — patch and vulnerability management), documented DR procedures (SR 7.1 — availability), and a testing benchmark scored A/A+ against fabrick standards (`docs/TESTING-ASSESSMENT.md`). The release process includes a legal review gate and insurance carrier touchpoint before shipping features that materially change the product's operational footprint — the change control discipline OT assessors expect from infrastructure tool suppliers.

---

## 8. Buyer Personas {#8-buyer-personas}

### OT Security Engineer / Plant IT

**Company profile:** Mid-market manufacturer (100–2,000 employees), one or two IT staff managing OT-adjacent infrastructure, no dedicated OT security team
**Cares about:** Getting IT/OT segmentation right without triggering OT team resistance; having operational visibility without Wireshark; maintaining IEC 62443 zone architecture without a $200/hr consultant

**Pain:** IT/OT boundary is a manually maintained VLAN that nobody fully understands. No operational topology map of what is running in the supervisory zone. Customer security questionnaire just arrived with IEC 62443 questions that require documentation that does not exist.

**Lead with:** Managed bridges turn your IT/OT DMZ from a manually maintained VLAN into a version-controlled declaration. Weaver gives you zone-level topology visibility today — no passive network tap required. Zero-drift means your IEC 62443 SR 3.4 software integrity finding closes itself.

**Tier:** Weaver (start with DMZ infrastructure and historian VMs); Fabrick (when RBAC and audit evidence are needed for customer audit response)

### Manufacturing IT Director

**Company profile:** Multi-plant manufacturer (500–5,000 employees), IT team managing VMware/Proxmox across 3–10 plants, OT convergence is recent and painful
**Cares about:** Cost of VMware post-Broadcom, tool consolidation across IT and OT infrastructure, consistency across plants, audit preparation cost reduction

**Pain:** Each plant runs slightly different infrastructure because nobody can reproduce exactly what another plant did. Customer security audits take 4–6 weeks of evidence collection across all plants. VMware licensing just doubled.

**Lead with:** Declarative config guarantees identical environments across all plants — clone the config to add a facility. Customer audit response becomes "here is the git repo for this plant." At 40 nodes, Weaver costs $23,500/yr vs $20,000–60,000/yr for VMware. The savings fund the Accelerate success program and reduce total cost of compliance evidence.

**Tier:** Fabrick + Accelerate

### CISO — Mid-Market Manufacturer

**Company profile:** Manufacturer classified as important or essential entity under NIS2; CISO recently hired to address IT/OT convergence risk; cyber insurance renewal approaching
**Cares about:** NIS2 Article 21 compliance before national authority enforcement begins, IEC 62443 assessment readiness, cyber insurance posture documentation, IT/OT segmentation evidence for board-level risk reporting

**Pain:** NIS2 deadline passed in October 2024. Article 21 requires documented risk management measures for OT systems. Current infrastructure has no declarative configuration management, no tamper-evident audit trail, and no zone boundary documentation that would satisfy a national CSIRT inquiry.

**Lead with:** Weaver closes NIS2 Art. 21 obligations across five of the six technical measure categories — network security (managed bridges), access control (RBAC), asset management (declarative config), incident handling (AI diagnostics), and supply chain (self-hosted). Git-based audit log satisfies Art. 23 incident reporting evidence requirements. The Accelerate program produces the NIS2 documentation your national authority will ask for.

**Tier:** Fabrick + Accelerate (NIS2 documentation support)

### Pharmaceutical / FDA-Regulated Manufacturing IT

**Company profile:** Drug manufacturer or CDMO with 21 CFR Part 11 and CSV/CSA obligations for infrastructure supporting GxP systems (LIMS, MES, process historian, batch management)
**Cares about:** FDA 21 CFR Part 11 §11.10 audit trail and access control compliance for infrastructure systems, computer system validation (CSV) lifecycle for GxP-supporting infrastructure, data integrity per ALCOA+ principles, GAMP 5 risk-based approach to infrastructure validation

**Pain:** Infrastructure systems supporting GxP processes are increasingly scrutinized by FDA. Traditional VM management tools do not produce 21 CFR Part 11-compliant audit trails. Every infrastructure change requires a change control record that takes hours to generate manually. Validation binders for infrastructure systems are maintained by hand and quickly become inaccurate.

**Lead with:** Git-based declarative audit log satisfies 21 CFR Part 11 §11.10(e) directly — computer-generated, tamper-evident, captures who changed what and when, cannot be disabled. NixOS declarative model satisfies §11.10(a) validation requirements — identical config produces identical system behavior, validate the configuration once and deploy to all GxP-supporting nodes consistently. The Partner program includes CSV infrastructure validation support.

**Tier:** Fabrick + Partner (FDA CSV support)

---

## 9. Discovery Questions {#9-discovery-questions}

Use these to qualify manufacturing/OT prospects and identify pain.

### IT/OT Convergence Pain

- How are your IT and OT networks segmented today — physical separation, VLANs, or firewalls? Who is responsible for maintaining that boundary?
- Can you describe the path from your corporate network to your process historian? Is that path documented?
- Do your IT and OT teams use the same infrastructure management tools, or do they manage their domains separately?
- Who is responsible for the IT/OT boundary when an incident crosses from enterprise to production-adjacent systems?
- Have you experienced a security incident or unexpected behavior that crossed the IT/OT boundary?

### OT Visibility Pain

- How do you know what VMs and containers are running in your OT zone right now?
- When a process historian VM fails, how long does it take to diagnose the cause? Who gets the 2 AM call?
- Do you have an operational topology map of your OT-adjacent infrastructure, or is Wireshark your visibility tool?
- How do you verify that the SCADA gateway VM or historian container running today is identical to what was configured and tested?

### Compliance and Audit Pain

- Are you working toward IEC 62443 compliance? Which zones are in scope, and what is the customer or certification timeline?
- Have you received a supplier security questionnaire from an OEM customer with IEC 62443 or ISO 27001 questions?
- Are you classified as an essential or important entity under NIS2? What is your current posture on Article 21 risk management measures?
- Do you manufacture for defense customers? Are CMMC or ITAR requirements flowing down to your OT infrastructure?
- For pharmaceutical manufacturing: are your infrastructure systems supporting GxP processes subject to 21 CFR Part 11 validation?
- How long does it take your team to prepare infrastructure evidence for a customer security audit?

### Production Risk Pain

- What is the cost per hour of unplanned production downtime at your facility?
- How many production-impacting incidents in the last year traced to infrastructure failures on OT-adjacent systems?
- When was the last time a configuration change on an OT-adjacent VM caused unexpected production behavior?
- How do you test patches before applying them to production-adjacent OT infrastructure? Do you have a test environment that matches production?

### Budget and Strategic Pain

- What are you paying annually for VMware or Proxmox licensing across your plants?
- How much IT staff time goes to manual VM/container provisioning and configuration drift investigation vs proactive OT security work?
- Have your VMware costs changed since the Broadcom acquisition?
- Are you planning to add new production lines or plant sites in the next 18 months? How do you replicate infrastructure to new facilities?
- What OT security tooling do you have today — passive monitoring, threat detection? What gap exists in the VM/container management layer that those tools assume is covered?

### AI Threat Landscape
- "If a frontier AI discovered a zero-day in your host kernel tomorrow — which Project Glasswing has demonstrated is now routine — how many OT-adjacent workloads would be compromised simultaneously? Could a single exploit pivot from your historian to your SCADA gateway because they share a kernel?"
- "Glasswing's 90-day public disclosure cycle means vulnerabilities found in your OT stack will become public knowledge. Can your current infrastructure prove it's patched faster than the disclosure window — before an IEC 62443 assessment or customer security audit?"

---

*This document covers the OT security and IT/OT convergence angle in depth. For general manufacturing infrastructure ROI, see [manufacturing.md](manufacturing.md). For pharmaceutical manufacturing with full GxP regulatory mapping, see [pharma-life-sciences.md](pharma-life-sciences.md). For defense supply chain manufacturing with CMMC requirements, see [defense-contractor.md](defense-contractor.md). For pricing details, see [TIER-MANAGEMENT.md](../../product/TIER-MANAGEMENT.md). For Fabrick justification, see [FABRICK-VALUE-PROPOSITION.md](../../marketing/FABRICK-VALUE-PROPOSITION.md).*

---

## Recent Changes

- **2026-03-26** — Added fleet onboarding subsection to Section 4 (Fabrick). CIDR probe for OT network segments; IoT/PLC scope boundary explicitly defined and framed as IEC 62443 architectural correctness, not a limitation; IEC 62443-3-3 SR 6.1 audit evidence from discovery session.
- **2026-03-18** — Fabrick pricing revised to $2,000/yr first node, $750/yr additional, $500/yr at 10+. Fabrick tier added at $2,500/yr (512GB RAM). Contract tier added for 512GB+ deployments (sliding scale per 512GB block). RAM coverage noted per tier. Parallel migration / no-expertise-required positioning added as primary lead.
