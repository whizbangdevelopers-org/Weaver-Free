<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Telecommunications Sales Case
## How Weaver Manages the Network Function Virtualization Stack — Without the Complexity
*Carriers, ISPs, MVNOs, Neutral Hosts & Telecom Infrastructure Operators*

**Date:** 2026-03-26
**Parent doc:** [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md)

---

## Table of Contents

1. [The Telecommunications IT Problem](#1-the-telecommunications-it-problem)
2. [Regulatory Mapping: What Weaver Addresses](#2-regulatory-mapping)
3. [Weaver for Telecommunications](#3-weaver-for-telecommunications)
4. [Fabrick for Telecommunications](#4-fabrick-for-telecommunications)
5. [Deficiency Remediation Plan](#5-deficiency-remediation-plan)
6. [Telecommunications-Specific Competitive Advantages](#6-competitive-advantages)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Discovery Questions](#9-discovery-questions)
10. [5G Edge & Distributed PoP Fleet (Fabrick v3.0+)](#10-5g-edge--distributed-pop-fleet-fabrick-v30)

---

## 1. The Telecommunications IT Problem {#1-the-telecommunications-it-problem}

**No NixOS expertise required — ever.** Weaver runs alongside existing VMware, OpenStack, Proxmox, or bare-metal NFV tooling. Migrate one network function at a time. No cutover event. No retraining.

Telecom infrastructure teams operate at the intersection of two hard problems: carrier-grade reliability requirements and the operational complexity of network function virtualization. Moving from dedicated hardware appliances to software-defined network functions promised cost savings and flexibility — and delivered both, wrapped in a layer of operational burden the original promise never accounted for.

**What telecom infrastructure teams should be doing:**

- Deploying and scaling virtual network functions (vEPC, vIMS, vFirewall, vRouter, vBNG) with confidence
- Maintaining CALEA lawful intercept infrastructure with hardware-level isolation from general network traffic
- Managing distributed edge PoP sites as a unified fleet, not 200 individual SSH sessions
- Proving CPNI access controls and audit trails to FCC examiners on demand
- Achieving five-nines (99.999%) availability for core network functions
- Enforcing consistent security policy across on-prem, edge, and cloud network infrastructure

**What telecom infrastructure teams actually spend time doing:**

- Running OpenStack operations as a full-time job: 2–3 FTE just to keep the NFV platform operational
- Managing VMware NFV licenses that Broadcom repriced to claw back every dollar NFV was supposed to save
- Debugging configuration drift in virtual network functions — the vRouter on PoP-7 in Atlanta has a slightly different config than PoP-7 in Dallas, and nobody knows why or when it changed
- Maintaining separate management planes for on-prem NFV, edge PoPs, and cloud workloads
- Manually provisioning new network function instances when traffic spikes, because the workflow requires three approval steps and an SSH session
- Generating CALEA compliance documentation from systems that were never designed to produce it

**Weaver eliminates the second list so infrastructure teams can focus on the first.**

---

## 2. Regulatory Mapping: What Weaver Addresses {#2-regulatory-mapping}

### Direct Compliance Impact

| Telecom Regulation | IT Obligation | Weaver Capability | Tier | Available |
|-------------------|--------------|------------------------------|:----:|:---------:|
| **CALEA** (47 U.S.C. §1001–1010) — Lawful Intercept | Isolate lawful intercept infrastructure from general network traffic; maintain audit trail of intercept system access | MicroVM hardware isolation — CALEA infrastructure runs in dedicated hardware-isolated VMs, not namespaces; per-VM RBAC limits who can touch intercept systems; declarative audit log | Weaver+ | v1.0 |
| **CPNI** (47 CFR §222) — Customer Proprietary Network Information | Access controls for systems processing customer network usage data; access logging; breach notification | Per-VM RBAC, declarative audit log (who accessed what system, when, what changed), tamper-evident git history | Fabrick | v1.0 |
| **FCC Cybersecurity Requirements** (NIST CSF alignment) | Identify, Protect, Detect, Respond, Recover controls across network infrastructure; documented configuration management | Asset inventory (VM dashboard), kernel hardening (AppArmor/Seccomp), AI diagnostics, declarative recovery from config | Weaver+ | v1.0 |
| **NIST SP 800-53** (federal telecom contractors) | Access control (AC), audit and accountability (AU), configuration management (CM), system protection (SC) | Per-VM RBAC (AC), git audit log (AU), zero-drift declarative config (CM), managed bridges + kernel hardening (SC) | Fabrick | v1.0 |
| **PCI-DSS** (billing systems) | Network segmentation of cardholder data environment, access controls, change management, logging | Managed bridges with IP pools isolate billing CDE; per-VM RBAC; declarative change history; audit log | Fabrick | v1.0 (firewall v1.1) |
| **SOC 2 Type II** (managed/cloud services) | Security, Availability, Confidentiality evidence across service infrastructure | Zero-drift by construction, audit log, access governance, sub-second recovery via Firecracker | Fabrick | v1.0 |
| **ISO 27001** (enterprise security) | Asset management, access control, cryptography, operations security, incident management | Declarative asset inventory, per-VM RBAC, NixOS LUKS encryption, AI diagnostics for incident triage | Fabrick | v1.0 |
| **CIS Controls v8** | Technical hardening, managed firewall, fleet-wide policy enforcement | Kernel hardening plugins, managed firewall (nftables), bulk VM operations across fleet | Weaver+ | v1.0 (firewall v1.1) |

### Indirect Compliance Support

| Telecom Function | IT Pain Today | How Weaver Helps |
|-----------------|--------------|----------------------------|
| **Network Operations Center** — SLA evidence | Proving uptime and change history for carrier SLA disputes | Git audit log with timestamped config changes; AI diagnostics document incident timelines |
| **Peering / Transit agreements** | Configuration consistency requirements for BGP/routing policy at peering points | Zero-drift NixOS config means declared routing policy = running policy; no silent drift |
| **GDPR / CCPA** — subscriber data | Infrastructure hosting subscriber data must have demonstrable access controls | Per-VM RBAC scopes access to billing/subscriber VMs; audit log proves access history |
| **Carrier interconnect** | Configuration documentation required for interconnect audits | Config-as-code is the documentation; git history proves who made changes and when |

---

## 3. Weaver for Telecommunications {#3-weaver-for-telecommunications}

**Target:** Regional ISPs, MVNOs, WISPs (wireless ISPs), neutral host operators, campus/private network operators, independent broadband providers

**Price:**
- **Weaver Solo** — $149/yr (FM, first 200) per node, admin only, local management, up to 128GB RAM
- **Weaver Team** — $129/user/yr (FM, first 50 teams) (2–4 users + 1 viewer free), up to 2 remote peer Weaver hosts (full management), up to 128GB RAM/host. Ships v2.2.0.

**The pitch:** "Your NFV platform costs more to operate than the hardware it replaced. Weaver manages your virtual network functions with one dashboard, zero configuration drift, and no OpenStack operations team required."

### Key Weaver Wins for Telecom

| Capability | Telecom Value |
|-----------|--------------|
| **Live Provisioning** | Spin up new vRouter, vFirewall, or vBNG instances without SSH + rebuild cycles. Traffic spikes handled in seconds, not the length of a change management ticket |
| **Zero Configuration Drift** | NixOS declarative config means the vEPC on node 3 in Seattle has exactly the same running config as the declared policy — always. No silent drift. No "works on node 1 but not node 7" |
| **MicroVM Hardware Isolation** | CALEA lawful intercept infrastructure requires hardware-level isolation from general network traffic. MicroVM hardware boundary satisfies this requirement by construction — not by process |
| **Managed Bridges + IP Pools** | Declarative network segmentation for multi-tenant infrastructure: per-customer VLANs, management plane separation, CDE isolation — configured once in code, enforced forever |
| **Multi-Hypervisor** | Run latency-sensitive network functions on Firecracker (minimal attack surface, <125ms boot), compute-heavy functions on QEMU — one dashboard, one policy |
| **Sub-Second VM Boot** | Five-nines means fast failover. Firecracker <125ms boot time means a failed network function is replaced before the monitoring pager finishes its first cycle |
| **AI Diagnostics** | When vIMS call routing breaks at 3 AM, natural language failure analysis reduces mean-time-to-resolution. Better incident documentation for SLA evidence and post-mortems |

### ROI for a Regional ISP (5 Nodes)

| Current Cost | With Weaver |
|-------------|----------------------|
| VMware vSphere: EUR355/socket × 10 sockets = **EUR3,550/yr** | 5 nodes × $149 (Solo) = **$745/yr** |
| 1 network engineer spending 10 hrs/week on NFV platform ops at $85/hr = **$44,200/yr** | Reclaim 7 hrs/week = **$30,940/yr freed** for network design |
| OpenStack/VMware troubleshooting incidents: 8/yr × 4hrs × $85/hr = **$2,720/yr** | Near zero — drift is impossible; incidents are VM failures, not config mysteries |
| **Total current cost: ~$50,470/yr** | **Weaver: $745/yr + $30,940 labor freed** |

### Weaver Team for Telecom

**Target:** Regional ISPs with a primary data center plus remote PoP(s) or co-location sites, WISPs with hub and remote tower sites, small MVNOs monitoring distributed infrastructure.

**Price:** $129/user/yr (FM), 2–4 users + 1 viewer free. Each host needs its own Weaver key. Ships v2.2.0.

**The use case:** A regional ISP operates a primary data center running core routing and subscriber management VMs plus two remote PoP sites. Weaver Team lets the NOC team manage all three hosts from one view — see whether the remote vRouter VM is running, its resource utilization, and current status — and take action directly. Full remote workload management across sites without Fabrick.

**Upgrade trigger:** When the team needs more than 2 remote peers, fleet-scale governance, per-VM RBAC, or resource quotas across the fleet — that's a Fabrick conversation.

---

## 4. Fabrick for Telecommunications {#4-fabrick-for-telecommunications}

**Target:** Carriers, CLECs, IXPs, multi-PoP operators, national ISPs, telecom infrastructure companies managing distributed edge sites

**Price:** $2,000/yr first node + $750/yr additional + $500/yr at 10+ nodes (up to 256GB RAM)

**The pitch:** "You operate 50 PoP sites. You have 50 slightly different configs, 50 SSH sessions to open when something breaks, and no single view of the fleet. Fabrick is the control plane that should have come with NFV."

### Fabrick Features Mapped to Telecom Obligations

| Fabrick Feature | Telecom Requirement Addressed | Evidence Produced | Available |
|-------------------|------------------------------|------------------|:---------:|
| **Per-VM RBAC** | CPNI access controls — only authorized personnel access subscriber data systems | Role assignments per VM, enforced at API level; access attempt audit log | v1.0 |
| **SSO/SAML/LDAP** | Carrier identity governance — single identity source across all NOC tooling | Integration with carrier Active Directory; lifecycle tied to HR provisioning | v1.0 |
| **Declarative Audit Log** | CALEA / CPNI — documented access to lawful intercept and subscriber data infrastructure | Git commit history: who changed what intercept system, when, and why | v1.0 |
| **Bulk VM Operations** | Fleet-wide policy changes — push routing policy update to all 50 PoP nodes atomically | Fleet-wide changes applied atomically, logged; rollback via git revert | v1.0 |
| **AppArmor/Seccomp/Kernel Hardening** | FCC cybersecurity / NIST CSF Protect function — defense-in-depth at network function level | Hardening policy enforced fleet-wide; config-as-code proves it | v1.0 |
| **All Plugins Included** | CIS Controls v8 — firewall, DNS, hardening required across all fleet nodes | Complete security stack, no per-site upsell or licensing gap | v1.0 (firewall/DNS v1.1) |
| **Resource Quotas** | Multi-tenant isolation — prevent one tenant's workloads from starving another's network functions | Resource limits enforced at VM level; configuration is the proof | v1.0 |

### Fleet Onboarding (v2.3.0)

Carriers and multi-PoP operators arrive at Fabrick with existing infrastructure — sometimes dozens of sites, each already running Weaver. The fleet discovery wizard inventories existing Weaver agents across your network in a single session. **CIDR probe** is the primary path for telecom: PoP sites typically run on known RFC 1918 address segments — specify your management plane CIDR blocks and Fabrick probes each for a Weaver agent response, presenting a checkbox list of discovered nodes for one-click bulk registration. Tailscale scan is available for operators already using Tailscale for out-of-band management. CSV/hostname import covers strictly segmented environments where probing is not permitted. All discovery sessions are audit-logged with triggering user, timestamp, and discovered host count — CPNI compliance requires you to know who touched your subscriber infrastructure and when, from day one.

Non-NixOS infrastructure — existing RHEL core routers, Ubuntu OSS/BSS servers, legacy packet core equipment on vendor-supplied Linux — can join as **Observed** fleet members by installing `weaver-observer` (statically-linked Rust binary, memory-safe, zero runtime dependencies, any Linux kernel ≥ 4.x). Observed hosts appear in the Fabrick fleet map with a yellow `Observed` badge showing running containers and VMs read-only. CALEA isolation, CPNI audit trail, and zero-drift compliance apply only to Managed (NixOS + Weaver) hosts. Observer nodes are included free up to 5× the Managed node count. The fleet map is a live migration tracker: yellow badges are the remaining migration roadmap, each with a "Convert to Managed" CTA. For carriers migrating from legacy NFV platforms, the Observed state provides full fleet visibility from day one — before a single host has been converted.

### Fabrick Success Programs for Telecom

| Program | Telecom Application | FM Price | Standard Price |
|---------|-------------------|:--------:|:--------------:|
| **Adopt** | NixOS + Weaver onboarding course (LMS) + 3 live sessions; NFV-aware deployment playbook; email/chat async support | $5,000/yr | $15,000/yr |
| **Adopt — Compliance** | Everything in Adopt + CALEA isolation configuration review, CPNI evidence walkthrough, FCC cybersecurity framework mapping | — | $25,000/yr |
| **Accelerate** | All Adopt content; dedicated Slack; quarterly fleet reviews mapped to FCC/NIST CSF controls; SIEM integration help; LMS modules for SSO/LDAP/PoP onboarding | $15,000/yr | $45,000/yr |
| **Partner** | Named engineer who understands carrier environments; priority features for telecom-specific needs (vNF templates, PoP provisioning automation); CALEA architecture review; sessions on demand | $30,000/yr | $90,000/yr |

### ROI for a Multi-PoP Carrier (30 Nodes, 15 Sites)

| Cost Category | Current State | With Fabrick |
|-------------|--------------|----------------------------------|
| VMware vSphere NFV | $80,000–200,000/yr (post-Broadcom repricing) | 30 nodes: $18,000/yr |
| NFV platform operations | 2 FTE × $120,000 = $240,000/yr just to run the platform | Redirect to network engineering — Fabrick is self-managing |
| PoP provisioning (new site) | 2–3 days of engineering time per site at $120/hr | 4-hour Fabrick wizard + Live Provisioning = same day |
| Incident mean-time-to-resolution (NFV config drift) | 4 hrs × 12 incidents/yr = $5,760 in labor | Zero — drift is impossible; incidents are hardware failures |
| Success program | N/A | Accelerate: $15,000/yr (FM) |
| **Total** | **$325,000–445,000/yr** | **$33,000/yr + 2 FTE redirected to network engineering** |

### Compliance Export Extension

**Price:** $4,000/yr flat (per organization) · stacks on Fabrick subscription
**Available:** v2.2 (SOC 2, NIST CSF export) · v3.0 (scheduled delivery)

| Feature | Telecom Requirement Addressed | Available |
|---------|------------------------------|:---------:|
| **NIST CSF control mapping export** | FCC cybersecurity — formatted evidence document mapping Weaver controls to NIST CSF Identify/Protect/Detect/Respond/Recover | v2.2 |
| **Signed configuration attestation** | CALEA / CPNI audit — cryptographically signed config snapshot proving intercept system running state matched declared state | v2.2 |
| **Audit-ready change log export** | CPNI §222 — formatted change history: who, which subscriber data system, when, what changed | v2.2 |
| **Scheduled export delivery** | Annual/quarterly evidence package delivery to S3-compatible endpoint or encrypted email | v3.0 |

---

## 5. Deficiency Remediation Plan {#5-deficiency-remediation-plan}

When a telecom operator has existing compliance findings — from FCC audits, CALEA implementation reviews, or internal security assessments — Weaver addresses infrastructure-related deficiencies systematically.

### Quick Wins (Week 1–2)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|--------------------|
| **CALEA isolation gap** | "Lawful intercept infrastructure shares a hypervisor with general network functions" | MicroVM hardware isolation creates a hardware boundary between intercept and general VMs — by construction, not configuration |
| **Configuration drift** | "Running NFV configurations do not match documented policy" | NixOS declarative config means running state = declared policy; git diff proves it to any auditor |
| **CPNI access control evidence** | "Cannot demonstrate who has access to subscriber data systems" | Per-VM RBAC (Fabrick) with audit log of all access grants/revocations; every access attempt logged |

### Medium-Term (Month 1–3)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|--------------------|
| **Fleet consistency** | "PoP site configurations diverge from standard; no automated enforcement" | Fabrick fleet-wide bulk operations push policy updates atomically; zero-drift ensures they hold |
| **Change management evidence** | "Infrastructure changes not systematically documented" | Every change is a git commit: who, what, when, why — from first deployment onward |
| **Network segmentation** | "Management plane not isolated from data plane in NFV infrastructure" | Managed bridges with IP pools — declarative management plane separation, config-as-code proves it |

### Strategic (Quarter 1–2)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|--------------------|
| **NIST CSF maturity** | "No documented framework mapping for infrastructure controls" | Accelerate success program ($15K/yr) includes quarterly NIST CSF mapping reviews |
| **Multi-PoP policy enforcement** | "Security policy inconsistently applied across remote sites" | Fabrick fleet groups with compliance tags enforce policy fleet-wide; Access Inspector verifies coverage |
| **Incident response documentation** | "Network function incident timelines not documented for SLA evidence" | AI diagnostics produce natural-language incident narratives; audit log timestamps every change |

---

## 6. Telecommunications-Specific Competitive Advantages {#6-competitive-advantages}

### vs VMware vSphere / vCloud (NFV Platform)

| Factor | VMware (post-Broadcom) | Weaver |
|--------|----------------------|--------|
| NFV platform licensing | $80,000–200,000/yr (repriced post-acquisition) | $18,000/yr (30 nodes) |
| Configuration drift | Possible and common; requires drift scanning tools | Impossible by construction (NixOS) |
| CALEA isolation | Separate VLAN/vSwitch configuration required; namespace-level only | Hardware-isolated MicroVMs — isolation is at the hardware boundary |
| PoP management | Per-cluster management; no unified fleet plane | Fabrick fleet control plane: 50 PoPs, one view |
| Provisioning speed | VM template + manual or scripted workflow | Live Provisioning: new network function instance in under a minute |
| Vendor risk | Broadcom controls pricing unilaterally | Open core, offline-first license, no phone-home |

### vs OpenStack (NFV Infrastructure)

| Factor | OpenStack | Weaver |
|--------|-----------|--------|
| Operations overhead | 2–3 FTE to operate the platform | 0 FTE for platform ops — Weaver is self-managing |
| Configuration drift | Nova/Neutron state can diverge from intended config | Zero drift by construction |
| CALEA isolation | Requires specific Neutron network policy and tenant configuration | MicroVM hardware boundary — not a configuration |
| Upgrade complexity | Major OpenStack upgrades are projects, not maintenance | NixOS declarative upgrades: declare new version, rebuild |
| Onboarding a new PoP | Multiple OpenStack services to deploy and configure | nixos-anywhere wizard + Fabrick enrollment: hours, not days |
| Total cost | Cloud or hardware + 2–3 FTE = $400,000+/yr | $18,000/yr (30 nodes) + no operations FTE |

### vs Kubernetes (CNF Workloads)

| Factor | Kubernetes | Weaver |
|--------|-----------|--------|
| Hardware isolation | Namespace-level only — shared kernel | MicroVM hardware boundary — separate kernel per VNF |
| CALEA boundary | Must configure network policies and PSPs/PSAs; namespace is not a hardware boundary | Hardware boundary is the default; no configuration required |
| Operations complexity | Full K8s control plane + CNI plugins + storage CSI + security policies | Single Weaver agent per host; Fabrick is the control plane |
| Zero drift | Deployment manifests can diverge from running state | NixOS: running state is the declared state |
| Firewall integration | Requires NetworkPolicy objects + CNI enforcement | Managed firewall (nftables) declaratively configured per VM |
| Five-nines readiness | Scheduler adds latency; cold starts on pod failure | Firecracker <125ms boot; replacement VNF running before pager fires |

Full competitive reference: [KUBERNETES-COMPETITIVE-POSITIONING.md](../KUBERNETES-COMPETITIVE-POSITIONING.md)

### The CALEA Argument

No other NFV platform can make this claim cleanly: MicroVM hardware isolation means CALEA lawful intercept infrastructure runs behind a hardware boundary — not a software namespace, not a vSwitch policy, not a Neutron tenant. The separation is enforced at the hardware level by the Firecracker hypervisor. The NixOS declarative config proves the isolation configuration matches declared policy at every point in time. This is the answer your CALEA compliance officer actually wants.

### AI-Era Threat Landscape Advantage

Anthropic's Project Glasswing (April 2026) demonstrated that frontier AI can discover **thousands of zero-day vulnerabilities** — including some that survived decades of human review — across every major operating system and browser. These capabilities will proliferate to attackers.

**Why this changes the calculus for telecommunications:**

- **Shared-kernel = fleet-wide compromise.** A single kernel zero-day — exactly the kind AI is now finding by the thousands — compromises every Docker container on the host simultaneously. For carriers running CALEA lawful intercept infrastructure alongside general network functions, a container escape doesn't just breach data — it compromises lawful intercept integrity and potentially exposes classified surveillance operations. Weaver's hardware boundary per MicroVM contains the blast radius to one workload and maintains the CALEA isolation boundary that regulators require.
- **Patch at the speed of AI discovery.** When Glasswing-class disclosures target the Linux kernels running your 5G core, edge PoPs, and signaling infrastructure, FCC cybersecurity requirements demand documented remediation timelines. NixOS's `flake.lock` pins every dependency by hash. Pin the fix, rebuild, deploy via Colmena — every node across 200 PoP sites converges deterministically. No "did we patch that edge node in Spokane?"
- **Supply-chain verifiability.** Glasswing explicitly targets open-source and supply-chain security. For carriers operating critical national infrastructure where a supply-chain compromise could affect signaling security or lawful intercept systems, NixOS's content-addressed store makes the entire supply chain formally verifiable — every package identified by its complete dependency tree hash, not a mutable tag.
- **Hypervisor diversity.** Weaver's 5 hypervisor options mean a vulnerability in one doesn't cascade to workloads on another — defense through diversity against AI-augmented exploit discovery. For carriers where a single hypervisor vulnerability could compromise network functions across hundreds of PoP sites, diversity is not a luxury — it is a resilience strategy.

---

## 7. Objection Handling {#7-objection-handling}

### "We need carrier-grade reliability — NixOS is too new"

NixOS roots go back to 2003 and it's been shipping stable releases for 12 years — 100K+ packages, ~466 companies in production. Weaver adds a management layer — it doesn't replace the OS. The declarative model means your infrastructure is *more* reliable than imperative platforms: running state matches declared policy by construction, no configuration drift to cause mysterious failures, and sub-second VM recovery via Firecracker means replacement VNFs are running before the pager finishes its first cycle.

### "Our network engineers don't know NixOS"

That's by design. Weaver is a management UI over the NixOS declarative model — your engineers interact with Weaver, not with NixOS configuration files. Live Provisioning means deploying a new network function instance requires no NixOS expertise. The Adopt success program ($5,000/yr FM) includes NixOS + Weaver onboarding for your team and a telecom-aware deployment playbook.

### "We can't migrate off our NFV platform mid-deployment"

Weaver's parallel migration model is purpose-built for this. Run Weaver alongside your existing VMware or OpenStack deployment. Migrate one virtual network function at a time — start with non-critical or new deployments, prove the model, and migrate remaining VNFs as platform contracts expire. Fabrick manages both environments from one dashboard during transition.

### "CALEA compliance requires a formal implementation review — we can't just switch platforms"

Correct — and Weaver makes that review faster and cleaner. The MicroVM hardware isolation boundary is architecturally cleaner than namespace isolation or vSwitch policy. The declarative config produces an unambiguous paper trail: here is the declared isolation configuration, here is the git history proving it has been in place since deployment, here is the audit log of every access to the intercept infrastructure. The Partner success program ($30,000/yr) includes a CALEA architecture review session.

### "Five-nines means we can't afford any migration risk"

Live Provisioning means new Weaver-managed VNFs spin up alongside existing ones. You route a percentage of traffic to new instances, validate, then decommission old ones — no cutover, no risk window. Firecracker's <125ms boot means the failover story is actually better on Weaver than on VMware or OpenStack.

### "Our existing NFV runs on RHEL/Ubuntu — we can't convert everything immediately"

Install `weaver-observer` on them. Existing RHEL or Ubuntu NFV hosts appear in your Fabrick fleet map immediately — running containers and VMs visible, read-only. Convert your most critical network functions first; observe the rest while migration runs. Observer nodes are free up to 5× your Managed node count. CALEA isolation, CPNI compliance, and zero-drift guarantees apply only to Managed (NixOS + Weaver) hosts — the fleet map makes this unmistakable: `Observed` badge means "not in compliance posture." Each Observed host has a "Convert to Managed" button. Your migration roadmap is the fleet map.

### "We have vendor-supplied network appliances running proprietary Linux"

Same answer as above: `weaver-observer` on any Linux host (kernel ≥ 4.x) brings vendor appliances into the fleet map as Observed nodes. Visibility into running processes and resource utilization without requiring OS conversion. When the appliance contract expires and you're evaluating replacements, the Convert-to-Managed button is already there.

### "FCC cybersecurity requirements and our CALEA compliance program require vendor security documentation for tools managing network infrastructure"

FCC cybersecurity requirements (aligned with NIST CSF) and CALEA compliance programs require documented vendor security practices for tools touching lawful intercept or network management infrastructure. Weaver's documentation package: CVD policy with 48-hour acknowledgment and 7-day critical fix SLAs (`SECURITY.md`), DR procedures (`docs/setup/DISASTER-RECOVERY.md`), and testing benchmark scored A/A+ against enterprise standards including SAST/OWASP and supply chain SHA pinning (`docs/TESTING-ASSESSMENT.md`). For CPNI §222 access controls, the RBAC audit trail is declarative by construction — every access policy change is a git commit with attribution. Your FCC compliance officer's question about vendor security posture has a documented, verifiable answer.

---

## 8. Buyer Personas {#8-buyer-personas}

### VP of Network Engineering / Director of Network Operations

**Cares about:** Five-nines availability, configuration consistency across sites, MTTR for network function failures, staff leverage on PoP deployments
**Lead with:** Zero configuration drift eliminates an entire class of outage — the "works on node 7 but not node 3" failure mode disappears. Firecracker sub-second boot means failed VNFs are replaced before SLA violations start. One Fabrick control plane for all 50 PoPs.
**Tier:** Fabrick + Accelerate

### CISO / VP Security

**Cares about:** CALEA isolation integrity, CPNI access controls, FCC cybersecurity compliance, audit trail completeness
**Lead with:** MicroVM hardware isolation is the strongest available CALEA boundary — hardware, not software. Declarative audit trail satisfies CPNI access logging requirements by construction. Accelerate program maps controls to NIST CSF for FCC alignment.
**Tier:** Fabrick + Accelerate or Partner

### Director of NFV / SDN Engineering

**Cares about:** NFV platform operational overhead, vNF deployment speed, multi-hypervisor flexibility, OpenStack/VMware migration path
**Lead with:** Zero OpenStack operations burden. Live Provisioning deploys new VNF instances in under a minute. Parallel migration means no cutover. Multi-hypervisor: Firecracker for latency-sensitive network functions, QEMU for compute-heavy ones — one dashboard.
**Tier:** Fabrick

### VP of IT Operations (OSS/BSS)

**Cares about:** Billing system uptime and PCI compliance, CPNI data access controls, staff efficiency, audit documentation burden
**Lead with:** PCI-CDE isolation via managed bridges with IP pools — declarative, config-as-code, proves itself to auditors. CPNI audit trail built into the platform. Zero-drift means OSS/BSS configuration matches documented policy for every SOC 2 audit window.
**Tier:** Fabrick

### CTO (Regional ISP / MVNO)

**Cares about:** Total cost of infrastructure, vendor lock-in, platform longevity, engineering team productivity
**Lead with:** $18,000/yr vs $80,000–200,000/yr for VMware at equivalent scale. Offline-first license — no phone-home, no Broadcom-style repricing risk. Open core model. The 2 FTE you're spending on OpenStack operations can be engineers building the network instead.
**Tier:** Fabrick (likely also exploring Contract tier for large-scale deployments)

---

## 9. Discovery Questions {#9-discovery-questions}

### Infrastructure Pain
- How many distinct PoP sites or edge locations does your team manage? How do you push configuration changes across all of them?
- When was the last time a network function failed because the running config on one node didn't match the expected configuration?
- How long does it take to provision a new VNF instance — from ticket to running?
- How many separate management planes does your team operate today (VMware vCenter, OpenStack Horizon, cloud consoles, individual SSH sessions)?

### Compliance Pain
- How is your CALEA lawful intercept infrastructure isolated from your general NFV platform today? Is that isolation at the hardware level, namespace level, or network policy level?
- How do you currently prove to FCC examiners that access to CPNI-touching systems was access-controlled and logged?
- How long does your team spend preparing infrastructure evidence for FCC inquiries or CALEA audits?
- What's your current NIST CSF maturity level for the Protect and Detect functions across your NFV infrastructure?

### Budget Pain
- What are you paying annually for VMware vSphere or your OpenStack platform, including the operations team that keeps it running?
- Has your VMware cost changed since the Broadcom acquisition?
- How much engineering time goes to NFV platform maintenance vs actually building the network?

### Strategic Pain
- Are you planning a 5G edge / MEC deployment? How are you planning to manage compute at cell sites or central offices?
- What's your timeline for migrating off any hardware appliances to software-defined network functions?
- Is air-gap capability important for any of your infrastructure — edge sites with no reliable management plane uplink?

### AI Threat Landscape
- "If a frontier AI discovered a zero-day in your host kernel tomorrow — which Project Glasswing has demonstrated is now routine — how many network functions would be compromised simultaneously? If your CALEA lawful intercept infrastructure shares a kernel with general VNFs, does a kernel exploit compromise intercept integrity?"
- "Glasswing's 90-day public disclosure cycle means vulnerabilities found in your NFV stack will become public knowledge. Can your current infrastructure prove every PoP site is patched faster than the disclosure window? For carriers operating critical national infrastructure, that proof needs to cover hundreds of distributed nodes."

---

## 10. 5G Edge & Distributed PoP Fleet (Fabrick v3.0+) {#10-5g-edge--distributed-pop-fleet-fabrick-v30}

**Full context:** [MASTER-PLAN.md](../../../MASTER-PLAN.md) — Decisions #97–#101, v2.3.0 fleet discovery; Decision #80, v2.4.0 cloud workloads

Carriers deploying 5G and MEC (Multi-access Edge Computing) face a management problem that existing NFV platforms were not designed for: not a handful of large data centers, but hundreds of small edge nodes deployed at cell sites, central offices, and customer premises — each running a handful of containerized or VM-based workloads, each needing consistent configuration management and security policy, and each needing to be managed as part of a coherent fleet without requiring an on-site technician.

### The Edge Management Gap

Traditional NFV platforms were designed for centralized data center deployments. OpenStack and VMware are poor fits for edge:

| Requirement | OpenStack / VMware | Fabrick |
|------------|-------------------|---------|
| Per-site management overhead | Each site is a separate OpenStack region or vCenter cluster | Single Fabrick control plane for 200 edge nodes |
| Deployment at cell site scale | Full OpenStack stack at each site: impractical | Single Weaver agent + NixOS; nixos-anywhere provisions a new site in minutes |
| Configuration consistency | Drift possible across sites; no fleet-wide enforcement | Zero drift by construction; Fabrick enforces policy fleet-wide |
| Disconnected operation | OpenStack control plane dependency | Weaver operates standalone if management uplink is lost; reconnects and syncs on restore |
| Cost per edge node | Full hypervisor licensing per node | $500/yr per node at 10+ nodes; designed for fleet economics |
| K8s at the edge | Full control plane per site or centralized with latency. Multus CNI + SR-IOV + DPDK custom builds per edge node | Single Weaver agent per site; NixOS kernel config is declarative — real-time patches are a flake input, not a custom K8s node image |

### The Pitch for 5G Edge Teams

*"You're deploying 200 edge nodes at cell sites over the next 18 months. Each one runs a UPF instance, a local breakout firewall, and a caching CDN workload. Today that's 200 site deployments, 200 configuration management problems, and 200 potential drift sources. Fabrick enrolls each site automatically when the node boots — the fleet discovery wizard (cloud scan or CIDR probe) registers nodes as they come online. The zero-drift architecture means PoP-197 in Spokane has exactly the same running configuration as PoP-1 in Seattle — by construction. A single operations team manages the entire fleet from one control plane."*

### Edge Deployment Economics

| Deployment | Nodes | Annual Cost |
|-----------|-------|------------|
| Pilot (5 cell sites) | 5 | $4,500/yr ($750/node × 5) |
| Regional rollout (50 sites) | 50 | $27,500/yr ($500/node at 10+) |
| National deployment (200 sites) | 200 | $100,000/yr ($500/node) |
| VMware equivalent (200 sites) | 200 | $400,000–1,000,000/yr (post-Broadcom) |

**Fabrick as % of total edge compute cost at 200 sites:** typically 2–5%, depending on hardware. The management plane cost becomes a rounding error.

### New Buyer Persona: Head of Edge Infrastructure / 5G Platform Engineering Lead

**Profile:** Owns the compute infrastructure for the carrier's MEC/edge strategy. Responsible for deploying and operating hundreds of edge nodes, each running containerized UPF, CDN, or enterprise application workloads. Frustrated by the gap between the speed at which the business wants edge nodes deployed and the operational burden of managing them consistently at scale.

**Cares about:** Deployment speed at scale (nixos-anywhere + Fabrick auto-enrollment), configuration consistency across hundreds of sites (zero drift), disconnected operation (Weaver standalone mode), total cost of edge compute management, security policy enforcement at the edge.

**Lead with:** Fabrick is the management plane that was missing from the edge compute story. Zero drift means 200 edge nodes have the same policy as the declared standard. nixos-anywhere + Fabrick enrollment means a new cell site goes from bare metal to managed in under an hour. Disconnected operation means a loss of management uplink doesn't affect the running workloads.

**Tier:** Fabrick (large node count → likely Contract tier for 512GB+ nodes) + Partner success program.

### Discovery Questions (5G Edge)

- How many edge nodes are you planning to deploy in the next 12–18 months? What's your current plan for managing configuration consistency across all of them?
- What happens to a running edge workload if it loses its connection to the central management plane?
- How are you handling security policy enforcement at edge sites where there's no on-site technician?
- What does your current deployment workflow look like for a new cell site — from bare metal to running workloads?
- How do you currently detect and remediate configuration drift between edge nodes?

---

*This document complements the universal value proposition in [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md). For pricing details, see [TIER-MANAGEMENT.md](../../product/TIER-MANAGEMENT.md). For Fabrick justification, see [FABRICK-VALUE-PROPOSITION.md](../../marketing/FABRICK-VALUE-PROPOSITION.md).*

---

## Recent Changes

- **2026-03-26** — Initial document. Covers CALEA/CPNI regulatory mapping, NFV platform replacement positioning, Fabrick fleet management for distributed PoPs, Fleet Onboarding with Observer for non-NixOS NFV infrastructure, competitive analysis vs VMware/OpenStack/Kubernetes, and 5G edge/MEC fleet section.
