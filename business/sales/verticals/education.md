<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver — Education Sector
## IT Value Proposition

> **Decision ref:** See MASTER-PLAN.md Decisions Resolved for tier and feature decisions.
> **Status:** Planned sales vertical — draft for review.

*Universities, K-12 Districts, Community Colleges & Research Institutions*

**Date:** 2026-03-13
**Parent doc:** [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md)

---

## Table of Contents

1. [Industry Problem](#1-industry-problem)
2. [Regulatory Mapping](#2-regulatory-mapping)
3. [Weaver for Education](#3-weaver-for-education)
4. [Fabrick for Education](#4-fabrick-for-education)
5. [Deficiency Remediation Plan](#5-deficiency-remediation-plan)
6. [Competitive Advantages](#6-competitive-advantages)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Discovery Questions](#9-discovery-questions)
10. [Cloud Burst & Research AI (Fabrick v3.0+)](#10-cloud-burst--research-ai-fabrick-v30)

---

## 1. Industry Problem {#1-industry-problem}

**No NixOS expertise required — ever.** Weaver runs alongside existing Docker, VMware, Proxmox, or bare-metal tooling. Migrate one workload at a time. No cutover event. No retraining. Weaver Free tier for student labs and research nodes (up to 32GB RAM). Weaver 128GB for department IT. NixOS never needs to be mentioned to faculty or administration.

Education IT operates under the harshest combination of constraints in any sector: the broadest compliance surface of any civilian industry, the tightest per-seat budgets, and the thinnest staffing ratios. A K-12 district sysadmin may be the sole technical person for 2,000 students. A community college IT team of four supports 10,000 users, three campuses, and a list of federal and state privacy obligations that expands every legislative session. University research computing teams run infrastructure that simultaneously hosts NIH-funded health data, DoD-funded CUI work, NSF open science mandates, and ITAR-controlled export research — all with different access controls, audit requirements, and funder reporting obligations.

**What education IT should be doing:**

- Enforcing FERPA-compliant access controls on student information systems and audit-logging access to education records (§99.31, §99.32)
- Managing network segmentation between student, staff, administrative, and payment processing systems to satisfy CIPA E-Rate certification and PCI DSS requirements
- Protecting under-13 data under COPPA and state equivalents (SOPIPA, Ed Law 2-d, SOPPA) with documented data isolation
- Maintaining reproducible, self-documenting compute environments for research labs — required by NSF/NIH data management plans and journal reproducibility standards
- Enforcing ITAR and EAR access restrictions on university defense research labs — foreign national exclusion at the system level
- Provisioning and deprovisioning lab environments for semester transitions, state testing windows, and grant-funded research projects on demand

**What education IT actually spends time doing:**

- Manually rebuilding computer labs every summer because no reproducible configuration exists
- Investigating which configuration changed on the SIS server before the state audit arrives
- Maintaining aging infrastructure on scripts and tribal knowledge — the sysadmin who set it up left in 2019
- Fielding tickets from faculty who need custom research environments provisioned one at a time via SSH
- Documenting E-Rate infrastructure after the fact for Form 486 and USAC audits
- Managing Apptainer/Singularity containers for HPC researchers entirely through shell scripts with no GUI or governance layer
- Recreating "it worked on my machine" computational environments that need to be reproducible for peer review

**Weaver eliminates the second list so IT can focus on the first.**

### The NixOS Advantage in Education

Education is uniquely positioned to benefit from NixOS's declarative model because the education use case is almost entirely about **reproducibility**. Every student in a lab course should get an identical environment. Every test-taker needs the same testing platform. Every research environment that produces a result that will be published needs to be exactly reproducible at the point of computation. NixOS doesn't just make this easier — it makes it the default.

When a student breaks their VM (and they will), rollback takes seconds. When a lab assignment requires a specific software stack, the declaration is the lab spec. When a journal reviewer needs to reproduce a computation from two years ago, the git history has the exact NixOS configuration that produced it. No other hypervisor management platform can make this claim.

### The Weaver Angle for University Research

University HPC environments have converged on Apptainer (formerly Singularity) as the container standard — Docker is disallowed on most HPC clusters because of its shared-kernel privilege model. Weaver (v1.1+) surfaces Apptainer container instances alongside VMs in the same dashboard and RBAC model. Research IT gets a single governance plane for both MicroVM workloads and the Apptainer jobs their researchers already run. Student sandbox isolation via MicroVM — instead of Docker — eliminates the shared-kernel risk that most K-12 and university lab environments unknowingly accept.

---

## 2. Regulatory Mapping {#2-regulatory-mapping}

### Direct Compliance Impact

| Regulation / Framework | Requirement | Weaver Capability | Tier | Available |
|------------------------|-------------|------------------------------|------|:---------:|
| **FERPA** — §99.31 (Authorized disclosure conditions) | Access controls limiting disclosure to legitimate educational interest; minimum necessary access | Per-VM RBAC (Fabrick) enforces role-based access at API level; declarative audit log (git-based) records who accessed infrastructure hosting education records | Fabrick | v1.0 |
| **FERPA** — §99.32 (Recordkeeping requirements) | Maintain records of access to education records; available to parents/students on request | Git commit history provides tamper-evident record of who had access to which systems, when granted, when revoked — exportable for FERPA requests | Fabrick | v1.0 |
| **FERPA** — §99.35 (Disclosure for institutional studies) | Infrastructure-level isolation for research using student records | Dedicated VMs with managed bridge isolation for research workloads containing student data; per-VM RBAC restricts access to approved researchers | Weaver+ | v1.0 |
| **COPPA** — §312.3 (Parental consent / data protection) | Technical isolation of under-13 data; operator accountability for data handling | VM-level isolation for applications handling K-5 student data; bridge-level network segmentation separates data flows from general systems | Weaver+ | v1.0 |
| **CIPA** — 47 U.S.C. §254(h)(5) (E-Rate certification) | Content filtering on funded networks; document filtering infrastructure for annual Form 486 | Managed bridges separate filtered student networks from unfiltered staff networks; declarative config documents segmentation for USAC auditors | Weaver+ | v1.0 |
| **California SOPIPA** — (Education Code §22584) | No targeted advertising; no data sale; data deletion on request; operator accountability | Consolidating infrastructure to single vendor (Weaver) reduces EdTech DPA surface for on-premises layer; declarative config documents operator data handling | Weaver+ | v1.0 |
| **New York Ed Law 2-d** — §2-d | Annual data security and privacy report; vendor data privacy agreements; breach notification | Tamper-evident audit trail for breach investigation; single vendor relationship for infrastructure layer reduces DPA count; declarative config = security report evidence | Weaver+ | v1.0 |
| **NSF Data Management Plan requirements** | Documented compute environments; infrastructure reproducibility; data access controls for grant reports | NixOS declarative config IS the compute environment specification. Git history documents infrastructure lifecycle across grant period for NSF DMPs | All tiers | v1.0 |
| **NIH Data Management & Sharing Policy** (2023+) | Documented data handling; access controls; environment documentation for reproducibility | Declarative config provides complete environment specification. Per-VM RBAC (Fabrick) controls data access per NIH DMS plan | Weaver+ | v1.0 |
| **ITAR** — 22 C.F.R. §120–130 (University defense research) | Foreign national access restrictions; controlled technical data confined to authorized systems | Per-VM RBAC restricts VM access to authorized personnel; managed bridges isolate ITAR-controlled research networks; self-hosted — controlled data never leaves institutional infrastructure | Fabrick | v1.0 |
| **EAR** — 15 C.F.R. §730–774 (Deemed export controls) | Access controls on export-controlled technology and data; audit of access by citizenship/status | Per-VM RBAC with LDAP attribute-based access policies (v1.2+) enforces export control status at system level; declarative audit log provides evidence for export compliance officers | Fabrick | v1.0 (LDAP v1.2+) |
| **NIST CSF v2.0** (higher education adoption) | Identify, Protect, Detect, Respond, Recover functions; documented implementation tiers | Asset inventory (VM dashboard), zero-drift protection, AI diagnostics, declarative recovery, per-VM RBAC — maps to all five NIST CSF functions | Weaver+ | v1.0 |
| **CIS Controls v8** (higher education baseline) | Technical hardening benchmarks; inventory and control of assets; access management | Kernel hardening plugins, managed firewall (nftables), fleet-wide policy enforcement, per-VM RBAC — CIS Controls 1, 2, 5, 6, 12, 13 | Weaver+ | v1.0 (firewall v1.1) |
| **E-Rate Program** — USAC Form 486 | Document technology infrastructure; demonstrate cost-effectiveness; maintain invoicing evidence | Declarative config = complete infrastructure documentation. Config-as-code proves what was deployed with E-Rate funds; git history shows deployment timeline | All tiers | v1.0 |
| **PCI DSS** (tuition/fee processing) | Isolate payment processing systems from general networks | Managed bridges with IP pools — declarative network isolation for cardholder data environments; config-as-code proves isolation to QSA | Weaver+ | v1.0 |
| **Title IX** (investigation records) | Secure infrastructure for investigation case management systems | VM-level isolation for Title IX systems; per-VM RBAC restricts access to authorized Title IX coordinators only | Fabrick | v1.0 |
| **State testing infrastructure** (PARCC, Smarter Balanced, etc.) | Reliable, isolated testing environments during assessment windows | Live Provisioning spins up testing VMs on demand; Firecracker boots VMs in <125ms; declarative teardown after testing window | Weaver+ | v1.0 |

### Indirect Compliance Support

| Education Function | IT Pain Today | How Weaver Helps |
|--------------------|--------------|----------------------------|
| **E-Rate audits** | Manually documenting what technology was purchased and deployed | Declarative config IS the deployment documentation — auditor sees exactly what's running and when it was configured |
| **Summer lab refresh** | Rebuilding lab and classroom environments during the 8-week summer window | Declarative rebuild from config — entire lab environments reproduced in minutes, not weeks |
| **Vendor DPA management** | Tracking 50-200 EdTech vendors with student data access | Consolidating infrastructure to single vendor (Weaver) reduces DPA surface for the on-premises infrastructure layer |
| **Research grant reporting** | Manually documenting infrastructure provisioned with grant funds | Git history shows exactly what systems ran during the grant period; declarative config documents compute environment for NSF/NIH reports |
| **IRB continuing reviews** | No systematic audit trail of who accessed human subjects data environments | Per-VM RBAC enforces IRB-approved access lists; declarative audit log provides evidence of access control effectiveness for IRB reviews |
| **Reproducible research** | "It worked on my machine" environments can't be cited or independently verified | NixOS declarative config IS the reproducible environment — citable, version-controlled, independently reproducible |

---

## 3. Weaver for Education {#3-weaver-for-education}

**Target:** K-12 school districts, small community colleges, career/technical education centers, education service agencies, individual school IT administrators

**Price:**
- **Weaver Solo:** $149/yr (FM, first 200) (single admin, local host only, up to 128GB RAM)
- **Weaver Team:** $129/user/yr (FM, first 50 teams) — 2–4 users + 1 viewer free, up to 2 remote peer Weaver hosts (full management, v2.2.0)

**The pitch:** "You're the only IT person for a district with 2,000 students. You can't afford to spend your week rebuilding VMs that could rebuild themselves. $149/yr (FM) buys you your evenings back — and gives your superintendent audit-ready infrastructure documentation for free."

### Key Weaver Wins for Education

| Capability | Education Value |
|-----------|---------------|
| **Live Provisioning** | Spin up computer lab VMs, testing environments, and new workloads without SSH + rebuild cycles. New semester, new labs — in minutes, not weeks |
| **Zero Configuration Drift** | When the state auditor asks "is your SIS infrastructure the same as when you filed your DPA?", the answer is provably yes. Drift is impossible by construction — declared config = running state |
| **AI Diagnostics** | When the testing system goes down during state assessments, natural language diagnosis gets it back before the principal calls. One-person IT departments need faster answers |
| **Managed Bridges + IP Pools** | Declarative network segmentation — student networks, staff networks, administrative systems, payment processing — all isolated by config, not by manual switch programming |
| **Sub-Second VM Boot** | State testing windows open Monday morning. Firecracker boots VMs in <125ms. Spin up 30 testing instances before the first bus arrives |
| **NixOS Teaching Labs** | Every student gets an identical, declaration-reproducible environment. When a student breaks their VM, rollback takes seconds. Lab specs live in version control — not the sysadmin's head |
| **Offline-First Operation** | Rural schools often have unreliable internet. Weaver manages infrastructure entirely on-premises with no cloud dependency. Offline-first license, no phone-home |

### ROI for a 3,000-Student School District

| Cost Item | Current State | With Weaver |
|-----------|--------------|----------------------|
| Infrastructure software | Proxmox: EUR355/socket x 2 sockets = approx. EUR710/yr | 2 nodes x $149 = **$298/yr** |
| Sysadmin VM management time | 12 hrs/week at $55/hr = **$34,320/yr** | Reclaim 7 hrs/week = **$20,020/yr freed** for student-facing IT |
| Summer lab rebuild | 3 weeks sysadmin time = **$6,600** | Declarative rebuild — 2 days, not 3 weeks. **$5,940 saved** |
| Infrastructure documentation | No documentation = audit risk + pre-audit scramble (est. 2 weeks/yr = **$4,400**) | Config-as-code is the documentation — audit prep is a git command |
| **Total** | **~$45,320/yr + audit risk** | **$298/yr + $26,000 labor freed** |

**The education budget reality:** At $298/yr for a 3,000-student district, Weaver Weaver Solo costs **$0.10 per student per year**. No line item is easier to justify to a school board.

### Weaver Team for Education

**Target:** University department IT teams, K-12 district IT staff supporting multiple school buildings or a separate student lab server, community college IT teams managing a second campus or specialized lab host.

**Ships:** v2.2.0 — 2–4 users + 1 viewer free, up to 2 remote peer Weaver hosts (full management in the existing Weaver view; host badge on workload cards). Tailscale MagicDNS peer discovery + manual IP entry. Each host independently licensed at $129/user/yr (FM). Upgrade to Fabrick when the team needs more than 2 remote peers, or when team size exceeds 4 staff.

**Education use case:** A university department or K-12 district IT team with a primary admin host and a separate student lab server or classroom host. Weaver Team lets the team monitor remote student workloads from their existing Weaver view — are the lab VMs running before class starts? Is the classroom server under unexpected load? — without deploying a full Fabrick infrastructure. The 2-peer cap covers the admin host, the student lab host, and one more (for example, a faculty research server). This is the right tier for teams managing up to 2 remote hosts without the overhead of a full Fabrick deployment.

**Upgrade trigger:** When the department needs more than 2 remote peers, or when the team grows beyond 4 staff, Fabrick is the next step — adding per-VM RBAC, fleet-scale audit log, resource quotas, and unlimited peers.

**ROI note (Weaver Team):** At $129/user/yr (FM) for a 3-person district IT team, Weaver Team costs $387/yr — still under $0.13/student for a 3,000-student district. The team gets full management of a second host (lab or classroom server) without a full Fabrick deployment.

---

## 4. Fabrick for Education {#4-fabrick-for-education}

**Target:** Large unified school districts, state university systems, community college networks, regional education service agencies (RESA/BOCES), university research computing

**Price:** $2,000/yr first node + $750/yr additional nodes + $500/yr at 10+ nodes (up to 256GB RAM)

**The pitch:** "Your institution processes tuition payments, stores Title IX records, manages 150 EdTech vendor relationships, runs ITAR-controlled research, and answers to FERPA, CIPA, COPPA, and whatever your state legislature passed last session. Fabrick makes all of that auditable from one place."

### Fabrick Features Mapped to Education Obligations

| Fabrick Feature | Education Requirement Addressed | Audit Evidence Produced | Available |
|-------------------|-------------------------------|------------------------|:---------:|
| **Per-VM RBAC** | FERPA §99.31 — access limited to legitimate educational interest; ITAR/EAR — citizenship-based access restrictions | Role assignments per VM, enforced at API level — proves who can access student data infrastructure and ITAR-controlled research systems | v1.0 |
| **SSO/SAML/LDAP** | State DPA requirements — single identity source for all systems; FERPA recordkeeping — identity-attributed access log | Integration with district Active Directory, Google Workspace, Azure AD, or university LDAP; one identity = one audit trail | v1.2+ |
| **Declarative Audit Log** | FERPA §99.32 audit requirements; IRB continuing review evidence; NSF/NIH grant accountability | Git commit history: who changed what, when, why, with approval — tamper-evident and exportable | v1.0 |
| **Bulk VM Operations** | Semester transitions — mass lab provisioning/deprovisioning; research cluster scaling | Fleet-wide operations: spin up 50 lab VMs, tear down 50 testing VMs, all logged atomically | v1.0 |
| **Resource Quotas** | Shared infrastructure — prevent one department or research group from consuming all resources | Per-user/per-department limits ensure the CS lab can't starve the SIS server; GPU allocation fairness for HPC workloads | v1.0 |
| **All Plugins Included** | CIPA/E-Rate — demonstrate network security controls for funded infrastructure; CIS Controls v8 baseline | Firewall (nftables), DNS, AppArmor/Seccomp, kernel hardening — complete security stack, no upsell | v1.0 (firewall/DNS v1.1) |
| **Weaver (Apptainer)** | NSF/NIH reproducibility mandates; HPC research container governance; student sandbox isolation | Apptainer/Singularity instances managed alongside VMs from one dashboard and RBAC model — eliminates shared-kernel risk from Docker in student environments | v1.1+ |

### Fabrick Success Programs for Education

| Program | Education Application | FM Price | Standard Price |
|---------|---------------------|:--------:|:--------------:|
| **Adopt** | NixOS onboarding for school or university IT staff; education-aware deployment playbook; summer migration planning; lab template library | $5,000/yr | $15,000/yr |
| **Adopt — Compliance** | Everything in Adopt + FERPA/CIPA compliance mapping session; state privacy law architecture review; E-Rate documentation package; DPA evidence walkthrough for infrastructure vendors | — | $25,000/yr |
| **Accelerate** | Quarterly fleet reviews mapped to FERPA/CIPA/state requirements; E-Rate documentation assistance; NSF/NIH DMP infrastructure section drafting; ITAR research lab architecture review; DPA compliance review for infrastructure | $15,000/yr | $45,000/yr |
| **Partner** | Named engineer who understands education IT constraints; priority features for education-specific needs (lab provisioning templates, testing environment automation, Apptainer governance); state compliance mapping as new laws pass | $30,000/yr | $90,000/yr |

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = $9,000/yr total compliance coverage during the FM period. Standard Adopt — Compliance ($25,000/yr) includes hands-on compliance service delivery not covered by the extension alone.

### ROI for a 15,000-Student Unified District or Mid-Size University (15 Nodes)

| Cost Category | Current State | With Fabrick |
|-------------|--------------|----------------------------------|
| Infrastructure software | VMware: $8,000–25,000/yr | 15 nodes: $10,500/yr |
| IT staff time on infrastructure (2 staff, 50% on VMs) | $57,200/yr | Redirect to student-facing IT and research support — infrastructure management is declarative |
| Summer lab rebuilds | 4 weeks across team = $8,800 | Less than 1 week — config-as-code reproduces entire lab environments |
| E-Rate audit preparation | 2 weeks/yr = $4,400 | Less than 2 days — infrastructure documentation is the config repo |
| Vendor DPA management (infrastructure layer) | 5+ infrastructure vendors = 5+ DPAs, 5+ security reviews | 1 vendor, 1 DPA, 1 security review |
| Success program | None | Adopt: $5,000/yr (FM) |
| **Total** | **$78,400–95,400/yr** | **$15,500/yr + IT staff redirected to classrooms and research** |

---

## 5. Deficiency Remediation Plan {#5-deficiency-remediation-plan}

When a district or institution has existing compliance findings — from state audits, E-Rate reviews, FERPA complaints, NSF/NIH post-award reviews, or internal assessments — Weaver addresses infrastructure-related deficiencies systematically.

### Quick Wins (Week 1-2)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|-------------------------------|
| **Infrastructure documentation gaps** | "Cannot demonstrate what systems are deployed or how they are configured" | Deploy Weaver — declarative config IS the documentation. Every system's configuration is version-controlled from day one |
| **Change management** | "No record of who changed infrastructure configuration or when" | Every VM change becomes a git commit with who/when/what/why — a tamper-evident audit trail exists from first deployment |
| **Network documentation** | "Network segmentation between student and administrative systems is undocumented" | Managed bridges make segmentation declarative — the config IS the network documentation for CIPA and FERPA auditors |

### Medium-Term (Month 1-3)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|-------------------------------|
| **Student data isolation** | "SIS infrastructure shares network segments with general-purpose systems (FERPA violation risk)" | Managed bridges with IP pools — declarative isolation of student data systems from general networks. Config-as-code proves the segmentation |
| **Payment processing isolation** | "Tuition payment systems not adequately segmented (PCI DSS finding)" | Dedicated bridge for payment processing VMs; declarative config proves isolation to PCI QSA |
| **Research environment reproducibility** | "Cannot reproduce computational environment from funded grant period (NSF/NIH finding)" | NixOS declarative config documents the exact environment; git history timestamps it to the grant period |
| **Disaster recovery** | "No documented DR procedure; last bare-metal recovery took 2 weeks" | Declarative config = reproducible rebuild. Sub-second VM boot (Firecracker). DR procedure becomes "apply the config" |

### Strategic (Quarter 1-2)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|-------------------------------|
| **Access governance** | "Cannot demonstrate role-based access to student data infrastructure (FERPA §99.31)" | Per-VM RBAC (Fabrick) with audit log of all access grants/revocations; LDAP integration with district or university directory |
| **ITAR research lab access controls** | "Cannot demonstrate foreign national exclusion from export-controlled research systems" | Per-VM RBAC restricts VM access by role; LDAP attribute-based policies (v1.2+) enforce export control authorization at system level |
| **E-Rate compliance posture** | "Insufficient documentation of technology infrastructure funded by E-Rate" | Declarative config provides complete, timestamped infrastructure inventory — exactly what USAC auditors require |
| **State privacy law readiness** | "Infrastructure controls not mapped to new state student privacy requirements" | Accelerate success program ($15K/yr) includes quarterly compliance mapping as state laws change |

---

## 6. Competitive Advantages {#6-competitive-advantages}

### vs VMware (Post-Broadcom)

| Factor | VMware | Weaver |
|--------|--------|-------------------|
| Cost (15-node district) | $8,000–25,000/yr (Broadcom subscription-only) | $10,500/yr (Fabrick) or $2,235/yr (Weaver 15 nodes) |
| FERPA audit evidence | Separate audit logging, manual documentation | Built-in — every change is a git commit with attribution |
| Configuration drift | Possible and common; no one has time to scan | Impossible by construction (NixOS declarative model) |
| Lab provisioning speed | Hours to days per lab environment | Minutes — declarative config reproduces entire labs |
| Budget justification | Hard to justify at Broadcom pricing | $0.10/student/yr (Weaver) — trivial line item |
| Research reproducibility | Manual documentation required | NixOS config IS the reproducible environment spec |

### vs Proxmox

| Factor | Proxmox | Weaver |
|--------|---------|-------------------|
| FERPA audit trail | API call logs only — captures actions, not intent | Git diffs — captures what changed AND why |
| Network segmentation documentation | Manual — who updated the wiki last? | Declarative — the config IS the documentation |
| Lab rebuild time | Manual process, tribal knowledge required | Declarative config reproduces labs identically |
| AI diagnostics | None | Built-in — one-person IT departments need this most |
| Per-VM access control | Pool-level only | Per-VM role assignments (Fabrick) |
| Student VM rollback | Manual snapshot management | Declarative rollback — reapply the config |

### vs Cloud (Google Workspace / Azure for Education)

| Factor | Cloud VMs | Weaver |
|--------|-----------|-------------------|
| Student data location | Cloud provider data centers — state laws restrict for many districts | On your premises — student data never leaves the district |
| Cost per VM | $600–6,000+/yr per VM | Unlimited VMs per node ($149–1,500/yr per node) |
| State privacy law compliance | Varies by provider, by state, by contract terms | Self-hosted — you control data location and access |
| ITAR research compliance | Cloud creates deemed export risk for foreign national employees at provider | Self-hosted — ITAR-controlled data stays on institutional infrastructure |
| Internet dependency | Systems unavailable during outages — fatal for rural districts | Self-hosted — works offline. Offline-first license, no phone-home |
| Research data sovereignty | International collaboration data may cross borders | Self-hosted — data stays on institutional metal |

### The NixOS Academic Credibility Angle

NixOS is not a startup project — it is one of the most technically rigorous Linux distributions, with a large academic contributor base and a formal foundation. Reproducible builds are a well-understood academic concept; NixOS implements them at the OS level. When a university department evaluates infrastructure for research computing, "NixOS declarative config as the reproducible environment" resonates with faculty who already understand reproducibility as a scientific principle. Competitors sell infrastructure management. Weaver sells reproducible, citable, version-controlled computational environments — which is what research computing actually needs.

#### Kubernetes Complexity in Education

Budget-constrained IT teams at community colleges, K-12 districts, and small universities cannot staff a platform team. Kubernetes expertise commands $150K+ for a senior engineer — headcount that education institutions simply cannot justify. Even managed K8s (EKS, GKE) requires operational knowledge that one-person IT departments do not have and cannot acquire while maintaining everything else.

| K8s Overhead | Impact in Education | Weaver Alternative |
|---|---|---|
| Platform team requirement (3-5 engineers at $150K+/yr) | Schools have 1-2 IT staff total; K8s expertise is unaffordable | Weaver Solo at $149/yr; one sysadmin manages the entire infrastructure through the dashboard |
| YAML complexity and operational burden | IT generalists cannot maintain Helm charts, CNI configs, and pod security policies alongside help desk and AV support | Declarative NixOS config: one language, one tool, reproducible labs from a single config file |
| Ongoing upgrade and security patching cycle | K8s control plane upgrades are projects; schools skip them and accumulate CVEs | NixOS declarative upgrades: declare new version, rebuild. Zero drift between security patches |

Full competitive reference: [KUBERNETES-COMPETITIVE-POSITIONING.md](../KUBERNETES-COMPETITIVE-POSITIONING.md)

### The Offline-First Advantage for Rural Schools

Rural school districts often have unreliable internet connectivity. Weaver's offline-first architecture means infrastructure management works without an internet connection — VM provisioning, management, monitoring, and AI diagnostics (with local BYOK models) function entirely on-premises. The offline-first license (HMAC checksum, no phone-home) is designed for exactly these environments. No cloud-dependent competitor can match this for rural K-12.

### AI-Era Threat Landscape Advantage

Anthropic's Project Glasswing (April 2026) demonstrated that frontier AI can discover **thousands of zero-day vulnerabilities** — including some that survived decades of human review — across every major operating system and browser. These capabilities will proliferate to attackers.

**Why this changes the calculus for education:**

- **Shared-kernel = fleet-wide compromise.** A single kernel zero-day — exactly the kind AI is now finding by the thousands — compromises every Docker container on the host simultaneously. A single compromised host exposes every student record system on it. Weaver's hardware boundary per MicroVM contains the blast radius to one workload — FERPA student records, SIS databases, and testing platforms stay isolated even when an adjacent VM is breached.
- **Patch at the speed of AI discovery.** Underfunded K-12 and university IT teams cannot manually track and patch the volume of zero-days AI is now surfacing. NixOS's `flake.lock` pins every dependency by hash. Pin the fix, rebuild, deploy via Colmena — every node converges deterministically. One sysadmin patches the entire district in minutes, not weeks.
- **Supply-chain verifiability.** Glasswing explicitly targets open-source and supply-chain security. NixOS's content-addressed store makes the entire supply chain formally verifiable — critical for institutions subject to state breach notification laws that impose penalties for negligent security practices.
- **Hypervisor diversity.** Weaver's 5 hypervisor options mean a vulnerability in one doesn't cascade to workloads on another — a meaningful defense-in-depth layer for institutions that can't afford dedicated security staff.

---

## 7. Objection Handling {#7-objection-handling}

### "We don't have the budget for new infrastructure software"

At $149/yr (FM) per node, Weaver costs less than a single day of substitute teacher pay. For a 3,000-student district, that's $0.10/student/year. The budget conversation is not "can we afford this" — it is "we can't justify spending $34,000/yr in sysadmin time on manual VM management when $298/yr eliminates it." The ROI pays back in the first week of summer lab rebuild alone.

### "We're a Google/Microsoft school — we use their cloud tools"

Google Workspace and Azure handle applications. Weaver handles the on-premises infrastructure underneath — SIS servers, testing platforms, lab environments, payment processing, network segmentation, and research compute. These are workloads that cloud tools don't replace. Many districts run hybrid; Weaver manages the on-premises portion declaratively. ITAR-controlled research and student data with state data residency requirements must stay on-premises regardless of which productivity suite the school uses.

### "Our sysadmin hasn't used NixOS before"

That's common — and expected. NixOS roots go back to 2003 and it's been shipping stable releases for 12 years — 100K+ packages, ~466 companies in production. The declarative model is simpler than imperative Linux administration because you describe what you want, not the steps to get there. The Adopt success program ($5,000/yr) includes hands-on onboarding. And practically speaking: if your sysadmin runs a homelab, they've likely already heard of NixOS. This is the tool they've been wanting to use at work.

### "Our researchers use Apptainer/Singularity — we can't change that"

You don't need to. Weaver (v1.1+) surfaces Apptainer instances in the same dashboard and RBAC model as VMs — researchers keep their existing container workflows, IT gets governance visibility and access control they've never had. This is the first time HPC research IT has had a management layer for Apptainer that isn't the command line.

### "We need to go through procurement / competitive bidding"

Weaver Weaver ($149/yr (FM)) falls below most district procurement thresholds. For Fabrick, we provide W-9, sole-source justification templates (NixOS-native declarative management is a unique capability with no direct equivalent), and E-Rate-compatible invoicing where applicable.

### "What about our existing VMs and infrastructure?"

We offer migration services ($5,000–20,000) that run in parallel with your existing setup. Start with lab environments or new workloads, prove the model over a summer, and migrate remaining infrastructure on your schedule. Hub-agent multi-node architecture (v2.0+) manages both environments from one dashboard during transition.

### "Our state just passed a new student privacy law — how do we know you'll stay compliant?"

State student privacy laws change every legislative session. Weaver's compliance value is architectural, not feature-specific: declarative config, tamper-evident audit trails, network segmentation, and access governance are the building blocks every state law requires. The Accelerate success program ($15K/yr) includes quarterly compliance mapping as new laws pass, so your infrastructure controls stay current without your sysadmin becoming a lawyer.

### "Our university defense research lab is ITAR-registered — can we really run this on-premises?"

Yes — and on-premises is the only acceptable answer for ITAR. Weaver is self-hosted; ITAR-controlled technical data never leaves your facility. Per-VM RBAC enforces authorized-personnel-only access at the system level. With LDAP integration (v1.2+), access policies can enforce export control authorization status pulled from your institutional directory. The offline-first license means no data leaves for license validation either.

### "Our IT security committee requires a vendor security review before approving new tools"

Lean education IT teams need vendor security documentation that doesn't require a dedicated security analyst to evaluate. Weaver's package is designed to be readable without a CISO: published testing benchmark scored A/A+ against enterprise standards (`docs/TESTING-ASSESSMENT.md`), formal CVD policy with 48-hour acknowledgment and 7-day critical fix SLAs (`SECURITY.md`), and documented contingency/DR procedures (`docs/setup/DISASTER-RECOVERY.md`). Supply chain SHA pinning on all 40 CI/CD steps and SAST on every push. For FERPA data governance reviews, state student privacy compliance checklists, and research security reviews, the self-hosted architecture combined with this vendor security documentation covers the typical software approval checklist in one package.

---

## 8. Buyer Personas {#8-buyer-personas}

### University IT / Research Computing (HPC, Lab Environments, Reproducible Research)

**Context:** Research computing director or HPC sysadmin at a university with 5,000–50,000 students. Manages shared cluster infrastructure serving multiple PIs, departments, and funding sources. Simultaneously subject to NIH/NSF data management requirements, IRB controls on human subjects data, ITAR for defense research labs, and FERPA for any research using student records. Currently runs Apptainer containers for HPC workloads with no management interface beyond the command line.

**Cares about:** Reproducibility mandates (NSF/NIH), multi-funding-source isolation, Weaver for Apptainer governance, GPU allocation fairness, ITAR research lab compliance, reducing the snowflake VM problem where every PI has a unique environment built by a grad student who left

**Lead with:** Weaver gives you a governance layer for Apptainer — the first real management interface for the containers your researchers already run. NixOS declarative config solves the reproducibility mandate: the config IS the citable environment. ITAR research labs get per-VM RBAC with LDAP-enforced export control status. GPU resource quotas end the allocation spreadsheet.

**Tier:** Fabrick + Accelerate (research institutions typically need the quarterly compliance mapping for evolving grant requirements)

---

### K-12 District IT (Cost-Constrained, Compliance-Heavy, Student Data Sensitivity)

**Context:** District technology coordinator or sole sysadmin for a district of 500–5,000 students. Budget is measured in dollars per student per year. Compliance obligations include FERPA, CIPA (E-Rate certification), COPPA (if district serves K-5), state student privacy laws, and PCI DSS for online payment systems. Spends significant time on summer lab rebuilds and annual E-Rate Form 486 documentation. May serve rural schools with unreliable connectivity.

**Cares about:** Budget ($0.10/student/yr makes this a non-decision for the board), E-Rate documentation, CIPA network segmentation, summer lab rebuild time, not being the only person who understands the infrastructure, offline operation for rural sites

**Lead with:** $0.10/student/yr. Declarative config means your summer lab rebuild goes from three weeks to two days. Managed bridges document your CIPA network segmentation for E-Rate Form 486 automatically. Offline-first means rural schools work when the internet doesn't. When you leave, the next sysadmin has the config repo — not your tribal knowledge.

**Tier:** Weaver (small district) or Fabrick (large unified district or RESA/BOCES managing multiple districts)

---

### Community College IT (Budget-Limited, Vocationally-Oriented, Workforce Development)

**Context:** IT team of 2–6 people supporting 3,000–15,000 students across one or more campuses. Community colleges serve non-traditional students, run vocational and CTE programs, and frequently partner with local employers for workforce development programs. Infrastructure must support traditional coursework, hands-on lab environments for CTE programs (networking, cybersecurity, healthcare IT), and often a combination of on-premises and cloud resources. Budget is constrained; E-Rate funding is critical.

**Cares about:** Cost, E-Rate compliance, supporting CTE lab environments (networking, cybersecurity, healthcare IT courses require realistic lab infrastructure), workforce development partnerships with local employers that may impose their own data requirements

**Lead with:** CTE and cybersecurity courses need real infrastructure for hands-on labs — not simulations. Weaver lets you spin up isolated lab environments per course per semester, tear them down after finals, and spin them up again identically next term. The cybersecurity program students can safely break VMs without affecting anyone else. Declarative config means the lab spec lives in version control, not the instructor's head.

**NixOS as curriculum:** For community colleges with IT and networking programs, NixOS declarative infrastructure is itself curriculum material. Students who learn declarative infrastructure management on Weaver are learning skills that transfer directly to fabrick NixOS deployments, GitOps workflows, and infrastructure-as-code practices. This is workforce development content built into the infrastructure tool.

**Tier:** Weaver (2-5 nodes typical), with a path to Fabrick when workforce development partnerships create fabrick-level compliance requirements

---

### University DevOps / Cloud Computing Curriculum (Teaching Lab Environments)

**Context:** Faculty member or instructional lab administrator for a computer science, IT, or cloud computing program at a university. Responsible for provisioning and maintaining student lab environments for courses in operating systems, networking, cloud infrastructure, DevOps/GitOps, and cybersecurity. Currently manages student VMs through a combination of VMware, Proxmox, or cloud provider academic credits — all of which create "works on my machine" problems, drift between assignment environments, and significant provisioning toil each semester.

**Cares about:** Every student having an identical environment (reproducibility = gradeable), fast provisioning at semester start, student VM rollback when they break things, the lab spec living in version control so the TA can reproduce the grading environment, and teaching modern infrastructure tooling (NixOS, declarative config, GitOps) as part of the curriculum

**Lead with:** NixOS declarative config means every student's VM is defined by the same file — no "it worked on my machine" disputes in grading. When a student breaks their VM, rollback is reapplying the declaration. The lab specification is a NixOS config file that lives in the course repo alongside the assignments. Students who learn Weaver and NixOS are learning the declarative infrastructure model that forward-looking employers want — GitOps for VMs, not just Kubernetes.

**The academic credibility point:** For computer science and IT programs, using NixOS and declarative infrastructure management as teaching infrastructure is itself a curriculum statement. It signals that the program teaches modern, reproducible infrastructure rather than imperative shell-script administration. This matters for faculty, department chairs, and accreditation reviewers.

**Tier:** Weaver (single instructor lab node) or Fabrick (department-level deployment with per-student RBAC and resource quotas)

---

## 9. Discovery Questions {#9-discovery-questions}

Use these to qualify education prospects and identify infrastructure and compliance pain:

### Infrastructure Pain
- How long does it take your team to rebuild computer labs at the start of a new semester or academic year?
- What happens when a student breaks their VM in a lab course? How do you restore it?
- How many different tools does your IT team use to manage infrastructure?
- When your sysadmin leaves, how does the next person learn what's running and how it was configured?
- Do you manage Apptainer or Singularity containers for research workloads? What does that management look like today?
- When was the last time you had to rebuild a critical server from scratch? How long did it take?

### Compliance Pain
- How does your district or institution demonstrate FERPA compliance for infrastructure access controls today?
- How do you document your CIPA-compliant network segmentation for E-Rate Form 486?
- If your state passed a new student privacy law last session, what infrastructure changes are you making to comply?
- Does your university have ITAR-registered research programs? How do you enforce foreign national access restrictions at the infrastructure level today?
- Do your researchers have NSF or NIH data management plans? What do those plans say about compute environment documentation?
- How do you handle the IRB's requirement to restrict access to human subjects data environments?
- How many EdTech or infrastructure vendor DPAs does your institution currently manage?

### Budget Pain
- What are you currently spending on infrastructure management software (VMware, Proxmox, or nothing)?
- How much of your IT staff time goes to infrastructure provisioning and maintenance vs student/faculty-facing support?
- What does your summer infrastructure refresh cost in staff time?
- Has your institution's IT budget kept pace with the number of systems and compliance requirements you manage?
- Are you currently receiving E-Rate discounts? What category of service?

### Strategic Pain
- Is your district serving rural schools with unreliable internet connectivity?
- Are you planning any infrastructure modernization projects this academic year? What's driving them?
- How do you handle infrastructure provisioning for state assessment testing windows?
- Does your CS or IT curriculum teach students declarative infrastructure management or cloud-native DevOps patterns?
- Are you considering moving more infrastructure on-premises due to state data residency concerns or student data privacy laws?
- Has your institution had any student data breach notifications or state audit findings in the last two years?
- "If a frontier AI discovered a zero-day in your host kernel tomorrow — which Project Glasswing has demonstrated is now routine — how many student record systems would be compromised simultaneously?"
- "Glasswing's 90-day public disclosure cycle means vulnerabilities found in your stack become public knowledge. Can your current infrastructure prove it's patched faster than the disclosure window?"

---

## 10. Cloud Burst & Research AI (Fabrick v3.0+) {#10-cloud-burst--research-ai-fabrick-v30}

**Full analysis:** [business/FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md)
**Research/HPC detail:** [research-hpc.md](research-hpc.md) — Section 10 covers cloud burst comprehensively for university HPC and AI/ML research teams.

For universities with research computing and HPC workloads — AI/ML training for funded research projects, genomics pipelines, molecular dynamics, climate simulation — the Fabrick cloud burst architecture and buyer personas are fully developed in [research-hpc.md](research-hpc.md) Section 10. The compliance constraints (NIH/NSF-funded data under HIPAA for clinical research, ITAR for export-controlled work, CUI for DoD-funded projects) are the same constraints that block standard shared-tenancy cloud burst. Fabrick enrolls dedicated burst nodes that extend the on-prem compliance posture to cloud compute.

**For K-12 districts and community colleges:** Fabrick is not relevant for standard K-12 or community college infrastructure workloads. Research universities and institutions with HPC should reference [research-hpc.md](research-hpc.md).

---

*This document complements the universal value proposition in [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md). For pricing details, see [TIER-MANAGEMENT.md](../../product/TIER-MANAGEMENT.md). For Fabrick justification, see [FABRICK-VALUE-PROPOSITION.md](../../marketing/FABRICK-VALUE-PROPOSITION.md). For research computing and cloud burst detail, see [research-hpc.md](research-hpc.md) and [FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md).*

---

## Recent Changes

- **2026-03-21** — Added Section 10: Cloud Burst & Research AI (Fabrick v3.0+). Cross-references research-hpc.md Section 10 for universities with HPC/AI workloads; clarifies Fabrick is not relevant for K-12/community college infrastructure.
- **2026-03-18** — Fabrick pricing revised to $2,000/yr first node, $750/yr additional, $500/yr at 10+. Fabrick tier added at $2,500/yr (512GB RAM). Contract tier added for 512GB+ deployments (sliding scale per 512GB block). RAM coverage noted per tier. Parallel migration / no-expertise-required positioning added as primary lead.
