<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# MSP / IT Consulting Sales Case
## How Weaver Turns Managed Service Providers into Compliance-Ready Infrastructure Machines
*MSPs, MSSPs, IT Consulting Firms & Virtual CIO Practices*

**Date:** 2026-03-09
**Parent doc:** [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md)

---

## Table of Contents

1. [The MSP IT Problem](#1-the-msp-it-problem)
2. [Regulatory Mapping: What Weaver Addresses](#2-regulatory-mapping)
3. [Weaver for MSPs](#3-weaver-for-msps)
4. [Fabrick for MSPs](#4-fabrick-for-msps)
5. [Deficiency Remediation Plan](#5-deficiency-remediation-plan)
6. [MSP-Specific Competitive Advantages](#6-competitive-advantages)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Discovery Questions](#9-discovery-questions)
10. [Fabrick for MSPs: Fleet-Wide Client Visibility (v3.0+)](#10-fabrick-for-msps-fleet-wide-client-visibility-v30)

---

## 1. The MSP IT Problem {#1-the-msp-it-problem}

**No NixOS expertise required — ever.** Weaver runs alongside existing Docker, VMware, Proxmox, or bare-metal tooling. Migrate one workload at a time. No cutover event. No retraining. MSP partners deliver NixOS-grade isolation to clients without client-side NixOS expertise. White-label the zero-expertise story — clients see VM management, not NixOS.

MSPs and IT consulting firms manage infrastructure across dozens of client environments — each with different compliance requirements, access policies, and technology stacks. The business model depends on one technician managing as many client nodes as possible. But every client environment is a snowflake, built on tribal knowledge, and documented only in the heads of senior engineers.

**What MSP technical teams should be doing:**

- Delivering standardized, auditable infrastructure services across all clients
- Generating compliance evidence as a billable deliverable (HIPAA for the clinic, PCI for the retailer, CMMC for the defense sub)
- Onboarding new clients in days, not weeks
- Scaling the ratio of nodes-per-technician to improve margins
- Building repeatable service packages that sell at premium rates
- Maintaining their own SOC 2 posture as clients and insurers demand it

**What MSP technical teams actually spend time doing:**

- Manually provisioning VMs with inconsistent tooling across 20-50 client sites
- Rebuilding client environments from scratch when the one tech who set it up leaves
- Generating compliance documentation manually — different formats for different clients' auditors
- Fighting configuration drift at every client site, unable to prove what changed or when
- Managing separate access controls per client using the same shared tools
- Justifying VMware licensing costs that Broadcom just tripled — across every single client

**Weaver eliminates the second list so MSPs can scale the first.**

The multiplier effect: one MSP adoption = deployment across 10-50+ client sites. Every efficiency gain compounds across the entire client base. A technician managing 3x more nodes means the MSP can grow revenue without proportional headcount.

---

## 2. Regulatory Mapping: What Weaver Addresses {#2-regulatory-mapping}

MSPs face a unique compliance challenge: they must satisfy their own compliance obligations AND produce evidence for clients across multiple regulatory frameworks simultaneously.

### MSP's Own Compliance

| MSP Obligation | IT Requirement | Weaver Capability | Tier | Available |
|---------------|---------------|------------------------------|:----:|:---------:|
| **SOC 2 Type II** — MSP's own attestation | Security, Availability, Confidentiality evidence across managed infrastructure | Zero-drift by construction, declarative audit log, per-VM RBAC, access governance | Fabrick | v1.0 |
| **MSP Alliance / CompTIA MSP+** | Standardized service delivery, documented processes | Config-as-code standardizes delivery; git history documents every process | Weaver+ | v1.0 |
| **Cyber Insurance Requirements** | Documented access controls, change management, incident response capability | Per-VM RBAC, git-based change history, AI diagnostics for incident triage, sub-second recovery | Fabrick | v1.0 |
| **State Data Breach Notification** (multi-state) | Incident detection, forensic evidence, notification within state-specific windows (24 hrs-60 days) | Tamper-evident audit trail, declarative config proves blast radius, AI diagnostics accelerate triage | Weaver+ | v1.0 |
| **NIST CSF** — baseline framework | Identify, Protect, Detect, Respond, Recover across all client environments | Asset inventory (VM dashboard), hardening plugins, AI diagnostics, declarative recovery | Weaver+ | v1.0 |

### Client-Inherited Compliance (Evidence MSPs Produce for Clients)

| Client's Regulation | What the MSP Must Prove | Weaver Evidence | Tier | Available |
|--------------------|------------------------|---------------------------|:----:|:---------:|
| **HIPAA** (healthcare clients) | ePHI access controls, audit trail, network segmentation, encryption | Per-VM RBAC, git audit log, managed bridges for workload isolation, NixOS LUKS | Fabrick | v1.0 |
| **PCI DSS** (retail/e-commerce clients) | Network segmentation, access controls, change management, logging | Managed bridges with IP pools, per-VM RBAC, declarative change history, audit log | Fabrick | v1.0 (firewall v1.1) |
| **CMMC 2.0 / NIST 800-171** (defense sub clients) | CUI protection, access control, audit, configuration management, air-gap | Per-VM RBAC, git audit log, zero-drift config, offline-first license (HMAC, no phone-home) | Fabrick | v1.0 |
| **FERPA** (education clients) | Student data isolation, access controls, audit trail | VM-level workload isolation, per-VM RBAC, declarative audit log | Fabrick | v1.0 |
| **SOX** (financial clients) | IT controls over financial reporting, change management, access governance | Declarative change history, per-VM RBAC, config export for auditor review | Fabrick | v1.0 |
| **CIS Controls v8** (general best practice) | Technical hardening, managed firewall, fleet-wide policy | Kernel hardening plugins (AppArmor/Seccomp), managed firewall (nftables), bulk VM operations | Weaver+ | v1.0 (firewall v1.1) |

### Indirect Compliance Support

| MSP Business Function | IT Pain Today | How Weaver Helps |
|-----------------------|--------------|----------------------------|
| **Client onboarding** | Weeks of manual setup per new client environment | Declarative config templates — clone a known-good client environment in minutes |
| **Staff turnover** | Senior tech leaves; client environments exist only in their head | Config-as-code means every environment is fully documented by construction |
| **Multi-client access isolation** | Same Proxmox/VMware instance, manual permission juggling | Per-VM RBAC (Fabrick) — different clients, different access policies, one platform |
| **Compliance evidence billing** | Manual evidence generation is time-consuming and error-prone | Automated evidence (git history, config exports) — bill for the deliverable, not the labor |

---

## 3. Weaver for MSPs {#3-weaver-for-msps}

**Target:** Small MSPs (5-15 employees), break-fix shops transitioning to managed services, IT consultants managing a handful of client environments

**Price:**
- **Weaver Solo** — $149/yr (FM, first 200) per node (admin only, local only, up to 128GB RAM). License key: `WVR-WVS-`
- **Weaver Team** — $129/user/yr (FM, first 50 teams) (2–4 users + 1 viewer free, up to 128GB RAM/host, up to 2 remote peer Weaver hosts). License key: `WVR-WVT-`

**The pitch:** "Every client environment you manage is a ticking time bomb of tribal knowledge. Weaver makes every environment reproducible — so when your senior tech quits on Friday, the new hire rebuilds everything on Monday. For $149/node Solo or $129/user/yr (FM) Team."

### Weaver Team for MSPs

Weaver Team is built for the small MSP technician scenario: a technician manages their own host running Weaver (Weaver Team license) and needs to manage up to 2 client Weaver instances from a single view — without flying blind across three separate browser sessions.

**How it works:** Each client installs Weaver on their own host with their own Weaver Solo license ($149/yr (FM, first 200)). The MSP technician holds a Weaver Team license on their machine and adds those clients as remote peers (Tailscale MagicDNS peer discovery or manual IP entry). The client hosts appear as fully manageable peer nodes in the technician's Weaver view — workload status, resource usage, alerts, and management actions are all available.

**What an MSP gets with Weaver Team:**
- Manage up to 2 client Weaver nodes alongside their own host (3 total machines in view)
- See workload status, resource usage, and alerts from client hosts on workload cards (host badge shows which peer a workload belongs to)
- Peer discovery via Tailscale MagicDNS or manual IP entry
- No Fabrick, no fleet control plane — this is lightweight multi-host management, not centralized fleet orchestration

**The 2-peer ceiling is intentional:** Weaver Team works cleanly for an MSP managing 1–2 client nodes from one seat. Beyond that, the right tool is Fabrick — which provides a full fleet control plane, per-VM RBAC across clients, resource quotas, and unlimited peers. The ceiling is not a limitation; it is the upgrade trigger.

**MSP economics:**
- Technician: 1 × Weaver Team = $129/user/yr (FM) (or $387/yr for avg 3-user team)
- Each client: 1 × Weaver Solo = $149/yr (FM) (the client pays this)
- The MSP's monitoring capability costs less than one billable hour per year

### Key Weaver Wins for MSPs

| Capability | MSP Value |
|-----------|----------|
| **Live Provisioning** | Spin up client VMs via API/UI — no SSH, no rebuild cycles. New client onboarding drops from days to hours |
| **Zero Configuration Drift** | Prove to any client's auditor that their environment matches declared policy. Config-as-code is the evidence — no scanning, no manual documentation |
| **AI Diagnostics** | 2 AM alert from a client? Natural language diagnosis means your on-call tech resolves it faster — even if they didn't build the environment. Better incident documentation for client reports |
| **Managed Bridges + IP Pools** | Declarative network segmentation per client workload type. Healthcare client needs ePHI isolation? Defense sub needs CUI segmentation? Same tool, different bridge configs |
| **Sub-Second VM Boot** | Client SLA says 4-hour RTO? Deliver sub-second. Firecracker <125ms boot means replacement VMs run before the client notices the outage. Differentiate your SLA from competitors |
| **Multi-Hypervisor** | Run security-sensitive client workloads on Firecracker (minimal attack surface), general workloads on QEMU. One dashboard, one billing line item per client |

### ROI for a 15-Person MSP Managing 30 Client Sites

| Current Cost | With Weaver |
|-------------|----------------------|
| Proxmox: EUR355/socket x 60 sockets across client sites = **EUR21,300/yr** | 60 nodes x $149 = **$8,940/yr** |
| 4 techs spending 12 hrs/week each on VM management at $55/hr = **$137,280/yr** | Reclaim 7 hrs/week each = **$80,080/yr freed** — reassign to billable client work |
| Client compliance evidence: 2 hrs/client/month x 30 clients at $125/hr billable = **manual labor, not leveraged** | Config-as-code evidence generated automatically — still bill the client $125/hr for the deliverable, near-zero labor |
| New client onboarding: avg 40 hrs per environment at $55/hr internal = **$66,000/yr (30 clients)** | Template-based deployment: avg 8 hrs per environment = **$13,200/yr** |
| **Total current cost: ~$224,580/yr + unbillable evidence labor** | **Weaver: $8,940/yr + $80K labor freed + evidence becomes pure-margin billing** |

---

## 4. Fabrick for MSPs {#4-fabrick-for-msps}

**Target:** Established MSPs (20-50+ employees), MSSPs, IT consulting firms with compliance-focused clients, vCIO practices managing regulated industries

**Price:** $2,000/yr first node + $750/yr additional + $500/yr at 10+ nodes (up to 256GB RAM)

**The pitch:** "Your healthcare client needs HIPAA evidence. Your defense sub needs CMMC evidence. Your retailer needs PCI evidence. One platform produces all three — and you bill every client for the deliverable."

### Fabrick Features Mapped to MSP Operations

| Fabrick Feature | MSP Operational Value | Client Compliance Value | Available |
|-------------------|----------------------|------------------------|:---------:|
| **Per-VM RBAC** | Different access policies per client — no more shared-tool permission headaches | Client-specific access controls satisfy HIPAA §164.312(a), CMMC AC.L2-3.1.1, PCI DSS 7.1 | v1.0 |
| **SSO/SAML/LDAP** | Integrate with your PSA/RMM identity stack; client Active Directory integration | Satisfies authentication requirements across HIPAA, PCI, CMMC, SOX | v1.2+ |
| **Declarative Audit Log** | Git commit history: who changed what, when, why — across every client environment | One evidence format serves every regulatory framework. Export per-client for auditor delivery | v1.0 |
| **Bulk VM Operations** | Fleet-wide patching/policy changes across client environments — atomic, logged | Demonstrates controlled change management for SOC 2, SOX, PCI | v1.0 |
| **Resource Quotas** | Prevent one client's workload from impacting another on shared infrastructure | Resource isolation evidence for multi-tenant compliance | v1.0 |
| **All Plugins Included** | No per-plugin licensing math across client sites — predictable cost | Complete security stack (firewall, DNS, hardening) — no compliance gaps from missing add-ons | v1.0 (firewall/DNS v1.1) |
| **AppArmor/Seccomp/Kernel Hardening** | Defense-in-depth enforced fleet-wide — standardized security posture across all clients | Satisfies hardening requirements for CIS Controls, CMMC, NIST 800-171 | v1.2 |
| **Hub-Agent Multi-Node** (v2.0+) | **One dashboard, all client sites.** Central management with per-site agents. Built for the MSP model | Single pane of glass for compliance monitoring across the entire client base | v2.0+ |

### Fleet Onboarding (v2.3.0)

For MSPs onboarding a new client's existing NixOS fleet into Fabrick, the fleet discovery wizard replaces what was previously a week of manual host registration with a single wizard session. Four discovery paths match any client topology:

| Client type | Discovery path |
|---|---|
| Healthcare / Research (Tailscale users) | **Tailscale scan** — queries Tailnet, checkbox list of discovered agents |
| Defense subs / OT manufacturing | **CIDR probe** — RFC 1918 segments only, no external calls, air-gap compatible |
| Financial services / FedRAMP | **CSV import** — admin-controlled host list, no lateral probing |
| Cloud-hybrid / SaaS-first clients | **Cloud scan** — queries Hetzner/DO/AWS account (v2.4.0+), probes for Weaver agent |

All paths share the same outcome: discovered hosts register in the client's Fabrick fleet immediately, workload inventory is pulled automatically, and the discovery session is audit-logged. The onboarding workflow — discover → register → inventory — replaces manual work that was previously billed as services hours or absorbed as overhead.

Non-NixOS client hosts — Ubuntu servers, RHEL workstations, custom Linux builds — can join as **Observed** fleet members via `weaver-observer` (statically-linked Rust binary, memory-safe, zero runtime dependencies, any Linux kernel ≥ 4.x). Observer nodes are included free up to 5× the Managed node count per client. For MSPs, this means any client has their full infrastructure visible in Fabrick from day one regardless of NixOS conversion status. The fleet map becomes a migration progress tracker per client — yellow `Observed` badges are billable conversion opportunities. Each host converted from Observed to Managed is new ARR. The migration backlog IS the revenue pipeline.

### Fabrick Success Programs for MSPs

| Program | MSP Application | FM Price | Standard Price |
|---------|----------------|:--------:|:--------------:|
| **Adopt** | NixOS onboarding for your technical team; MSP-specific deployment playbooks; client environment templating methodology | $5,000/yr | $15,000/yr |
| **Adopt — Compliance** | Everything in Adopt + multi-framework compliance mapping session (HIPAA + PCI-DSS + CMMC); client environment compliance architecture review; PSA-integrated evidence delivery workflow; sub-processor documentation package | — | $25,000/yr |
| **Accelerate** | Quarterly fleet reviews across your client base; compliance mapping assistance for multi-framework clients (HIPAA + PCI + CMMC); integration with ConnectWise/Autotask/Datto PSA | $15,000/yr | $45,000/yr |
| **Partner** | Named engineer who understands your MSP practice; priority features for MSP workflows (multi-tenant dashboards, client-level reporting); co-marketing opportunities; referral revenue share | $30,000/yr | $90,000/yr |

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = $9,000/yr total compliance coverage during the FM period. Standard Adopt — Compliance ($25,000/yr) includes hands-on compliance service delivery not covered by the extension alone.

### ROI for a 30-Person MSP Managing 50 Client Sites (200 Nodes)

| Cost Category | Current State | With Fabrick |
|-------------|--------------|----------------------------------|
| Infrastructure software | VMware across 50 clients: $75,000-200,000/yr (post-Broadcom) | 200 nodes: $103,750/yr ($2,000 + 9×$750 + 190×$500) |
| Compliance evidence labor | 2 analysts, 60% on infrastructure evidence across client base: $108,000/yr | Redirect to client advisory — evidence is automatic. Still bill clients for deliverable |
| Client onboarding | 50 hrs avg x 12 new clients/yr x $55/hr: $33,000/yr | Template-based: 10 hrs avg = $6,600/yr |
| Staff turnover recovery | 1 senior tech leaves/yr, 80 hrs to reconstruct tribal knowledge: $4,400 | Zero — config-as-code means no tribal knowledge to lose |
| Success program | N/A | Partner: $30,000/yr FM (includes co-marketing + referral revenue) |
| **Total** | **$220,400-345,400/yr** | **$140,350/yr + compliance staff redirected to advisory billing** |

### The MSP Multiplier Math

An MSP that deploys Weaver across its client base becomes a force multiplier for our sales:

| MSP Size | Typical Client Sites | Nodes Deployed | Annual License Revenue |
|----------|---------------------|---------------|----------------------|
| Small (10 employees) | 20-30 | 40-90 | $6,000-13,500 |
| Mid (25 employees) | 40-80 | 100-300 | $15,000-80,000 |
| Large (50+ employees) | 80-200 | 200-800 | $80,000-300,000+ |

One MSP relationship replaces 20-50 individual sales conversations.

---

## 5. Deficiency Remediation Plan {#5-deficiency-remediation-plan}

When an MSP has existing compliance findings — from their own SOC 2 audit, client compliance assessments, or cyber insurance reviews — Weaver addresses infrastructure-related deficiencies systematically.

### Quick Wins (Week 1-2)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|-------------------------------|
| **Audit trail gaps** | "Cannot demonstrate who made infrastructure changes across client environments" | Deploy Weaver — every VM change becomes a git commit with who/when/what/why. Per-client audit export |
| **Configuration documentation** | "Client environments are undocumented; depend on individual technician knowledge" | NixOS declarative config = running state by construction. New tech reads the config, understands the environment |
| **Inconsistent access controls** | "Same credentials used across multiple client environments" | Per-VM RBAC (Fabrick) with per-client access policies. LDAP/SSO integration ties to your identity stack |
| **Change management** | "No formal change control process for client infrastructure modifications" | Every change = Nix declaration + git commit. Change history is automatic, not a process to enforce |

### Medium-Term (Month 1-3)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|-------------------------------|
| **Network segmentation** | "Client workloads not adequately isolated from each other" | Managed bridges with IP pools — declarative per-client network isolation |
| **Incident response** | "No standardized incident response across client base" | AI diagnostics + sub-second VM recovery. Standardized triage workflow across all clients |
| **Disaster recovery** | "DR testing shows unacceptable RTO for client critical systems" | Firecracker <125ms boot + declarative rebuild from config. Document RTO improvement for every client SLA |
| **Vendor consolidation** | "Too many infrastructure vendors with inconsistent security postures" | Consolidate to single platform — 1 vendor, 1 security assessment, predictable per-node pricing |

### Strategic (Quarter 1-2)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|-------------------------------|
| **SOC 2 readiness** | "MSP lacks SOC 2 Type II attestation — clients and insurers demanding it" | Declarative infrastructure is SOC 2-ready by construction. Accelerate program ($15K/yr) maps controls to Trust Service Criteria |
| **Multi-framework compliance** | "Cannot efficiently produce evidence for clients across HIPAA, PCI, CMMC simultaneously" | One audit trail, one config-as-code system → export per-client, per-framework evidence from the same data |
| **Scalability** | "Technician-to-node ratio limits growth; can't profitably take on more clients" | Config-as-code + templates + hub-agent architecture (v2.0) = 3x more nodes per technician |
| **Cyber insurance** | "Premiums increasing due to inadequate infrastructure controls documentation" | Zero-drift architecture + declarative audit log = strongest possible evidence for underwriters |

---

## 6. MSP-Specific Competitive Advantages {#6-competitive-advantages}

### vs VMware (Post-Broadcom)

| Factor | VMware | Weaver |
|--------|--------|-------------------|
| Cost (50-client MSP, 200 nodes) | $75,000-200,000/yr (per-socket across all client sites) | $103,250/yr (200 nodes at volume pricing) |
| Per-client billing alignment | Per-socket pricing doesn't map to per-client billing | Per-node pricing maps directly to MSP per-client billing model |
| Multi-client access control | Separate vCenter instances or complex permissions | Per-VM RBAC — one platform, isolated client access policies |
| Configuration drift | Possible; requires scanning tools per client | Impossible by construction (NixOS) |
| Client compliance evidence | Requires separate audit tools per client | Git-based audit log exports per client |
| Vendor lock-in | High — Broadcom controls pricing | Open core, offline-first license, no phone-home |
| Migration cost | N/A | $5,000-20,000 per client site (our migration service) |

### vs Proxmox

| Factor | Proxmox | Weaver |
|--------|---------|-------------------|
| Multi-client management | Separate instances per client or manual permission splitting | Per-VM RBAC with client-level isolation (Fabrick); hub-agent for multi-site (v2.0) |
| Compliance evidence | API call logs — actions only, no intent | Git diffs — what changed AND why, exportable per client |
| Zero drift | No — imperative management allows drift | Yes — declarative by construction |
| Client onboarding speed | Manual setup per client | Template-based — clone a known-good environment |
| AI diagnostics | None | Built-in — reduces mean-time-to-resolution for on-call techs |
| Technician productivity | Limited by manual management | Config-as-code enables 3x more nodes per technician |

### vs RMM/PSA-Bundled Virtualization (ConnectWise, Datto, NinjaRMM)

| Factor | RMM-Bundled | Weaver |
|--------|-------------|-------------------|
| Virtualization depth | Basic monitoring; actual VM management still manual | Full lifecycle — provisioning, networking, security, diagnostics |
| Compliance evidence | Ticket history ≠ infrastructure audit trail | Declarative config history = auditor-ready evidence |
| Configuration drift | Monitored but not prevented | Prevented by construction |
| Multi-hypervisor | Single hypervisor at best | 5 hypervisors — match workload to security requirements |
| Pricing model | Per-device RMM fees + separate virtualization licensing | Per-node — replaces separate virtualization license entirely |

### vs Cloud (AWS/Azure for MSP Clients)

| Factor | Cloud VMs | Weaver |
|--------|-----------|-------------------|
| Cost per client | $600-6,000+/yr per VM; multiplied across client base | Unlimited VMs per node ($149-1,500/yr per node) |
| Data residency | Shared infrastructure; client data in vendor's cloud | **On client premises** — data never leaves the client's facility |
| Air-gap capability | No | Yes — offline-first license (HMAC, no phone-home). Critical for defense subs and regulated clients |
| MSP margin | Cloud markup is thin and transparent | Infrastructure license markup is opaque — healthy MSP margins |
| Client retention | Client can replicate your cloud setup with any provider | NixOS expertise creates MSP stickiness — declarative management is your differentiator |

#### Kubernetes Complexity in MSP Environments

Multi-tenant Kubernetes is hard. Namespace isolation is insufficient for client separation — a compromised pod in one namespace can exploit shared kernel vulnerabilities to reach another client's workloads. Virtual clusters (vcluster) add complexity without adding hardware boundaries. Dedicated clusters per client solve isolation but multiply operational overhead and cost. MSPs managing 50 clients on K8s need 50 clusters or accept the risk of shared-kernel multi-tenancy.

| K8s Overhead | Impact for MSPs | Weaver Alternative |
|---|---|---|
| Namespace isolation insufficient for client separation | Shared kernel = shared risk; one compromised client workload can affect others; not acceptable for regulated clients | Fabrick Workload Groups provide per-client isolation with hardware boundaries; one fleet, clean tenant separation |
| Per-client cluster overhead (dedicated clusters) | 50 clients = 50 control planes to maintain, upgrade, and monitor; K8s platform team scales linearly with client count | One Fabrick control plane for all clients; per-VM RBAC provides client-level isolation without separate infrastructure |
| K8s expertise cost passed to MSP clients | Platform team cost ($450K+/yr) must be absorbed by the MSP or passed through — eroding margins or pricing competitiveness | No platform team; Weaver licensing is a line item ($149-$500/node/yr) that maps directly to per-client billing |

Full competitive reference: [KUBERNETES-COMPETITIVE-POSITIONING.md](../KUBERNETES-COMPETITIVE-POSITIONING.md)

### The Tribal Knowledge Killer

The number one risk to MSP profitability is staff turnover. When a senior technician leaves, 60-80 hours of client environment reconstruction follows — if reconstruction is even possible. With Weaver:

- Every client environment is fully defined in declarative config
- A new technician reads the Nix config and understands the environment
- No reconstruction needed — the config IS the documentation
- Client environments survive any staffing change

This isn't a feature. It's the difference between an MSP that scales and one that can't grow past the number of senior techs it retains.

### AI-Era Threat Landscape Advantage

Anthropic's Project Glasswing (April 2026) demonstrated that frontier AI can discover **thousands of zero-day vulnerabilities** — including some that survived decades of human review — across every major operating system and browser. These capabilities will proliferate to attackers.

**Why this changes the calculus for MSPs:**

- **Shared-kernel = fleet-wide compromise.** A single kernel zero-day — exactly the kind AI is now finding by the thousands — compromises every Docker container on the host simultaneously. For an MSP, one compromised kernel means every client's workloads on that host are exposed — and the MSP bears the liability. Weaver's hardware boundary per MicroVM contains the blast radius to one workload. Client isolation is hardware, not a namespace promise.
- **Patch at the speed of AI discovery.** MSPs managing 50+ client environments across hundreds of nodes cannot manually track and patch the volume of zero-days AI is now surfacing. NixOS's `flake.lock` pins every dependency by hash. Pin the fix, rebuild, deploy via Colmena — every client node converges deterministically. One technician patches the entire fleet in minutes, and the git diff proves it for SOC 2 attestation.
- **Supply-chain verifiability.** Glasswing explicitly targets open-source and supply-chain security. NixOS's content-addressed store makes the entire supply chain formally verifiable — a concrete differentiator when MSP clients ask "how do you ensure your infrastructure isn't compromised?" and when cyber insurers evaluate your risk posture.
- **Hypervisor diversity.** Weaver's 5 hypervisor options mean a vulnerability in one doesn't cascade to workloads on another — reducing the blast radius of any single hypervisor CVE across your entire client base.

---

## 7. Objection Handling {#7-objection-handling}

### "We're standardized on Proxmox/VMware across our client base"

That standardization is costing you. Post-Broadcom VMware pricing means your margins shrink with every client renewal. Proxmox gives you no compliance evidence, no drift prevention, and no multi-client access isolation. Weaver replaces both AND gives you billable compliance deliverables. Migrate one client site first — prove the model, then roll it across your base.

### "Our techs don't know NixOS"

NixOS roots go back to 2003 and it's been shipping stable releases for 12 years — 100K+ packages, ~466 companies in production. The Adopt success program ($5,000/yr) includes onboarding playbooks designed for MSP teams. NixOS's declarative model is actually simpler than imperative management once learned — your techs write config instead of running commands. More importantly, new hires ramp faster because the config IS the documentation. The learning curve pays for itself in reduced onboarding time.

### "We can't migrate 50 client environments at once"

You don't have to. Start with new client onboardings — deploy them on Weaver from day one. Migrate existing clients opportunistically: when VMware contracts renew, when hardware refreshes happen, when a client has a compliance audit coming up. The hub-agent architecture (v2.0+) manages mixed environments during transition.

### "Our RMM/PSA already monitors VMs"

Monitoring and managing are different things. Your RMM tells you a VM is down. Weaver's AI diagnostics tells you why, spins up a replacement in <125ms, and logs the entire incident for the client's auditor. Your RMM monitors; Weaver operates. They're complementary — we integrate via API.

### "Per-node pricing doesn't work for our billing model"

Per-node pricing is the only model that aligns with MSP billing. You already charge clients per-device or per-user. Weaver at $149-500/node gives you a clean line item that maps to your per-client billing. Mark it up, bundle it into your managed service package, and it becomes a profit center rather than a cost center.

### "What about clients who need SOC 2 / HIPAA evidence from US?"

We're on the ISO certification path. In the interim, the Accelerate program ($15,000/yr) maps Weaver controls to SOC 2 Trust Service Criteria, HIPAA Security Rule, and other frameworks your clients require. More importantly, our declarative audit trail is stronger evidence than most certified platforms produce — because it's architectural, not procedural.

### "We already have compliance documentation processes"

Manual compliance documentation is time-consuming and doesn't scale. With 30 clients across HIPAA, PCI, and CMMC, you're generating evidence in different formats from different tools. Weaver produces one audit trail that serves every framework — export per-client, per-framework evidence from the same data. Your team bills for the deliverable, not the labor of producing it.

### "Our clients run Ubuntu/RHEL — they won't convert to NixOS on day one"

That's fine — and expected. Install `weaver-observer` on their existing hosts. Every host appears in Fabrick immediately, read-only. You now have full fleet visibility for that client before a single NixOS conversion happens. Observer nodes are free up to 5× the Managed node count per client. The compliance story (HIPAA evidence, zero drift, audit trail) activates host-by-host as each converts. Each conversion is new ARR: Observed → Managed is $0 → $750/yr per node. The migration backlog IS the revenue pipeline — and it's visible in the fleet map.

### "Our clients' security teams and cyber insurance carriers ask about the tools we use on their infrastructure"

Cyber insurance renewals and client security questionnaires increasingly include questions about MSP tooling. Weaver's published evidence package answers those questions without a lengthy vendor questionnaire: testing benchmark scored A/A+ against enterprise standards — 1,500+ tests, 24 custom static auditors including SAST/OWASP and supply chain SHA pinning (`docs/TESTING-ASSESSMENT.md`). Formal CVD policy with 48-hour acknowledgment and 7-day critical fix SLAs (`SECURITY.md`). Documented DR procedures (`docs/setup/DISASTER-RECOVERY.md`). The engineering quality bar matches what you'd expect from a tool you're putting on client infrastructure — and the evidence is public, not a vendor questionnaire response that expires in 12 months.

---

## 8. Buyer Personas {#8-buyer-personas}

### MSP Owner / Founder (10-50 Employee MSP)

**Cares about:** Margins, scalability, client retention, differentiation from commodity MSPs, VMware cost exposure
**Lead with:** Per-node pricing aligns with your billing model. 3x more nodes per technician = growth without proportional headcount. Compliance evidence becomes a billable deliverable with near-zero labor cost. VMware replacement saves $15K-140K/yr across your client base.
**Tier:** Fabrick + Accelerate or Partner (the co-marketing and referral revenue in Partner pays for itself)

### MSP Technical Director / Lead Engineer

**Cares about:** Standardization across client environments, reducing on-call burden, onboarding new techs, tooling consolidation
**Lead with:** Config-as-code means every client environment is reproducible and documented. AI diagnostics reduces 2 AM calls. New hires read configs instead of shadowing senior techs for months. One platform replaces Proxmox/VMware + compliance scanning + drift detection.
**Tier:** Fabrick

### Virtual CIO (vCIO) / IT Strategy Consultant

**Cares about:** Recommending defensible technology choices, compliance mapping, client advisory revenue, reducing client risk
**Lead with:** Recommend Weaver to clients and own the deployment relationship. Zero-drift architecture is the most defensible infrastructure recommendation you can make. Compliance evidence generation justifies your advisory fees — you're not just recommending tools, you're delivering audit-ready infrastructure.
**Tier:** Fabrick for clients + Partner program for your practice (named engineer, priority features, co-marketing)

### IT Consulting Firm Partner

**Cares about:** Billable hours, practice differentiation, recurring revenue, client stickiness
**Lead with:** NixOS declarative infrastructure becomes your firm's competitive moat. Clients can't easily replicate this with another consultancy. Compliance evidence generation is pure-margin billing. Partner success program ($30K/yr) includes co-marketing that drives client acquisition.
**Tier:** Fabrick + Partner

### Break-Fix Shop Transitioning to Managed Services

**Cares about:** Building a recurring revenue model, getting out of the break-fix cycle, establishing service standards
**Lead with:** Weaver is the infrastructure foundation for your managed services practice. $149/node Weaver gives you a standardized deployment platform from day one. As you add compliance-focused clients, upgrade to Fabrick for per-VM RBAC and audit evidence. The platform grows with your business.
**Tier:** Weaver initially, Fabrick as practice matures

---

## 9. Discovery Questions {#9-discovery-questions}

Use these to qualify MSP prospects and identify pain:

### Infrastructure Pain
- How many client environments does your team manage? How consistent is the tooling across them?
- When was the last time a technician left and you had to reconstruct a client environment from scratch?
- How long does it take to onboard a new client's infrastructure from first engagement to fully managed?
- What's your current technician-to-node ratio? Where do you need it to be for your growth plan?

### Compliance Pain
- How many of your clients are in regulated industries (healthcare, finance, defense, education)?
- How do you currently generate compliance evidence for clients? Is it billable or absorbed overhead?
- Do you have your own SOC 2 Type II attestation? Are clients or insurers asking for it?
- When a client's auditor asks "prove your infrastructure hasn't drifted from policy," what do you show them?

### Budget Pain
- What are you paying annually for VMware/Proxmox licensing across your entire client base?
- How have your infrastructure software costs changed since the Broadcom acquisition?
- What's the margin impact of per-socket licensing multiplied across 20-50 client sites?
- How much unbillable time does your team spend on infrastructure management vs billable client work?

### Strategic Pain
- Is your client base asking for more compliance-focused services? Can your current tooling support that?
- How do you differentiate from commodity MSPs who compete on price alone?
- What happens to your business if your top two technicians leave in the same quarter?
- Are cyber insurance requirements changing how you manage client infrastructure? Are premiums increasing?
- "If a frontier AI discovered a zero-day in your host kernel tomorrow — which Project Glasswing has demonstrated is now routine — how many clients' workloads would be compromised simultaneously?"
- "Glasswing's 90-day public disclosure cycle means vulnerabilities found in your stack become public knowledge. Can your current infrastructure prove it's patched faster than the disclosure window?"

---

## 10. Fabrick for MSPs: Fleet-Wide Client Visibility (v3.0+) {#10-fabrick-for-msps-fleet-wide-client-visibility-v30}

**Full analysis:** [business/FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md)
**Fleet context:** [business/FABRICK-VALUE-PROPOSITION.md](../../marketing/FABRICK-VALUE-PROPOSITION.md)

> **Tier boundary:** Weaver Team (v2.2.0) adds full management of up to 2 remote Weaver hosts via REST+WebSocket — no fleet control plane, 2-host cap. This is lightweight multi-host management for small MSPs with 1–2 client nodes. Fabrick is a separate, Fabrick-only product that ships at v3.0. Do not conflate the two: Weaver Team peer management is not Fabrick, does not expose Fabrick UI, and has no fleet orchestration capability.

The hub-agent architecture (v2.0+) gives MSPs one dashboard per client site. Fabrick (v3.0+) goes further: it is the fleet control plane that provides a topology-level view of every Weaver node across every client — grouped by client, region, and node class — in one map. For an MSP managing 200 nodes across 50 clients, this transforms multi-site management from 50 separate browser tabs to a single operational surface.

### What Fabrick Adds for MSP Operations

| Hub-Agent (v2.0) | Fabrick (v3.0+) |
|---|---|
| One dashboard per Weaver installation | Loom fleet view across all client installations |
| Per-site agent management | Loom: clients grouped, regions highlighted, node health fleet-wide |
| Aggregate view within a site | Aggregate view across the entire client base |
| Node lifecycle per site | Fleet lifecycle: spot failing nodes before clients do |
| Per-client Weaver licensing | Fabrick fleet license + per-client node count |

The operational shift: instead of checking each client site individually, the MSP's morning NOC review is a single Loom view. A node in amber anywhere in the topology surfaces a client with a problem — before they file a ticket.

### Cloud Burst as an MSP Service Offering

MSPs with healthcare, defense, financial services, or research clients face a recurring request: "Can you provision burst GPU compute for our AI training runs — and keep our compliance posture?" Standard cloud burst can't answer that question. Fabrick can.

An MSP with Fabrick can offer Managed Burst Compute as a billable service:

1. Client needs burst GPU capacity for a training run or simulation campaign
2. MSP provisions a dedicated burst node (CoreWeave, GovCloud, bare-metal GPU cloud)
3. MSP enrolls the node in the client's Fabrick fleet via WireGuard — node appears in the client's Loom
4. Slurm or K8s dispatches jobs to the burst node transparently
5. MSP tracks node-days consumed against the client's burst pool and bills accordingly
6. On campaign completion, MSP deregisters the node

The MSP captures the delta between burst licensing cost ($20/node-day) and what they bill the client for managed burst infrastructure — new service revenue on top of the base Weaver license. For regulated clients (healthcare, defense, finance) who can't use shared cloud, this is a service no competitor MSP can match without Fabrick.

### The Pitch for MSP Owners

*"You manage 200 nodes across 50 clients. You check 50 dashboards. Fabrick gives you Loom — all 200 nodes, client-grouped, health visible at a glance. When your healthcare client's cluster node goes amber at 3 AM, Fabrick surfaces it before they wake up. And when that same client's AI team needs burst GPU capacity for imaging model training, you provision and manage the burst node as a Fabrick-managed service — adding a margin layer that Proxmox and VMware will never give you."*

### New Buyer Persona: MSP Technical Director / Platform Engineer

**Profile:** Manages the technical platform for an MSP serving 20–80 client sites. Responsible for tooling standardization across all client environments, reducing per-technician workload, and building new service offerings that command premium billing. Clients are increasingly asking for cloud-adjacent services (AI infrastructure, managed compliance tooling) and need a platform that can support those offerings without rebuilding the operational model.

**Cares about:** Technician-to-node ratio, standardized tooling across all clients, new service revenue opportunities, compliance evidence automation for client billing, Fabrick as a competitive differentiator vs Proxmox/VMware MSPs who have no equivalent fleet view.

**Lead with:** Fabrick fleet visibility replaces 50 dashboards with one map — immediate operational efficiency. Managed burst as a new service line for regulated clients. Compliance-as-a-service billing model. Fabrick fleet license stacks on existing Weaver per-node contracts — no renegotiation with existing clients.

**Tier:** Fabrick across client base + Fabrick fleet license (Contract tier for clients with 512GB+ nodes) + Partner success program.

### Discovery Questions (Fabrick Fleet / MSP Platform)

- How do you currently get a fleet-wide view of all client nodes? How many dashboards or tools does that require?
- Do any of your clients run AI or ML workloads that require GPU burst capacity? How do you handle those requests today?
- If you had Loom — a single view of your entire client fleet — what's the first operational change you'd make?
- Are any of your clients in healthcare, defense, pharma, or financial services — where cloud burst has compliance constraints they can't solve themselves?
- What managed services are clients asking for that your current tooling can't support?

---

*This document complements the universal value proposition in [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md). For pricing details, see [TIER-MANAGEMENT.md](../../product/TIER-MANAGEMENT.md). For Fabrick justification, see [FABRICK-VALUE-PROPOSITION.md](../../marketing/FABRICK-VALUE-PROPOSITION.md). For cloud burst architecture and licensing, see [FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md).*

---

## Recent Changes

- **2026-03-26** — Added fleet onboarding subsection to Section 4 (Fabrick). Four discovery paths mapped to client topology types (Tailscale/CIDR/CSV/cloud scan); per-client path selection table; replaces manual host registration with single wizard session.
- **2026-03-21** — Weaver Solo/Team split: Section 3 expanded with Solo ($149/yr (FM), `WVR-WVS-`) and Team ($129/user/yr (FM), `WVR-WVT-`) pricing; added Weaver Team MSP subsection covering full peer management (2-client cap, REST+WS, no Fabrick). Section 10 tier boundary note added clarifying Weaver Team peer management vs Fabrick (Fabrick-only, v3.0+).
- **2026-03-21** — Added Section 10: Fabrick for MSPs: Fleet-Wide Client Visibility (v3.0+). Covers fleet control plane vs hub-agent, managed burst compute as an MSP service offering for regulated clients, and new MSP Technical Director / Platform Engineer buyer persona.
- **2026-03-18** — Fabrick pricing revised to $2,000/yr first node, $750/yr additional, $500/yr at 10+. Fabrick tier added at $2,500/yr (512GB RAM). Contract tier added for 512GB+ deployments (sliding scale per 512GB block). RAM coverage noted per tier. Parallel migration / no-expertise-required positioning added as primary lead. MSP-specific angle: white-label the zero-expertise story.
