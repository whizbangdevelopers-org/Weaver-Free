<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Healthcare IT Sales Case
## How Weaver Eliminates Infrastructure Burden for Healthcare Organizations
*Hospitals, Health Systems, Clinics & Healthcare Enterprises*

**Date:** 2026-03-09
**Parent doc:** [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md)
**Regulatory reference:** Healthcare-IT-Compliance.md (source material)

---

## Table of Contents

1. [The Healthcare IT Problem](#1-the-healthcare-it-problem)
2. [Regulatory Mapping: What Weaver Addresses](#2-regulatory-mapping)
3. [Weaver for Healthcare](#3-weaver-for-healthcare)
4. [Fabrick for Healthcare](#4-fabrick-for-healthcare)
5. [Deficiency Remediation Plan](#5-deficiency-remediation-plan)
6. [Healthcare-Specific Competitive Advantages](#6-competitive-advantages)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Discovery Questions](#9-discovery-questions)
10. [Clinical AI & Cloud Burst (Fabrick v3.0+)](#10-clinical-ai--cloud-burst-fabrick-v30)

---

## 1. The Healthcare IT Problem {#1-the-healthcare-it-problem}

**No NixOS expertise required — ever.** Weaver runs alongside existing Docker, VMware, Proxmox, or bare-metal tooling. Migrate one workload at a time. No cutover event. No retraining.

Weaver's parallel migration model is particularly valuable in healthcare: run it alongside existing VMware/Proxmox, migrate ePHI-adjacent workloads to hardware-isolated MicroVMs one at a time. No cutover, no risk to running systems, no NixOS expertise required from compliance teams.

Healthcare IT teams manage the densest compliance surface of any industry. Twelve regulatory domains — from HIPAA to FDA device cybersecurity to ONC interoperability mandates — all require IT-managed evidence, controls, and documentation.

**What healthcare IT should be doing:**

- Enforcing ePHI access controls and minimum necessary policies
- Maintaining tamper-evident audit logs for OCR investigations and Joint Commission surveys
- Segmenting medical device networks (infusion pumps on legacy OS, imaging equipment, IoT)
- Managing FHIR API compliance for 21st Century Cures / CMS interoperability
- Running breach notification workflows within 60-day HIPAA / tighter state windows
- Tracking BAAs across every vendor touching ePHI

**What healthcare IT actually spends time doing:**

- Manually provisioning and rebuilding VMs for clinical and administrative workloads
- Investigating configuration drift on systems that auditors will examine
- Maintaining multiple management tools with separate access policies
- Generating audit evidence by exporting logs from five different systems
- Rebuilding environments after failures with no reproducible configuration
- Documenting changes after the fact for compliance binders

**Weaver eliminates the second list so IT can focus on the first.**

---

## 2. Regulatory Mapping: What Weaver Addresses {#2-regulatory-mapping}

### Direct Compliance Impact

| Healthcare Regulation | IT Obligation | Weaver Capability | Tier | Available |
|----------------------|--------------|------------------------------|:----:|:---------:|
| **HIPAA Security Rule** — Technical Safeguards (§164.312) | Access controls, audit controls, transmission security, encryption | Per-VM RBAC, declarative audit log (git-based), config export, SSO/SAML/LDAP | Fabrick | v1.0 (config export v1.1) |
| **HIPAA Security Rule** — Administrative Safeguards (§164.308) | Access management, incident procedures, contingency planning | Role-based access, AI-powered incident diagnostics, sub-second VM recovery (Firecracker) | Weaver+ | v1.0 |
| **HIPAA Security Rule** — Physical Safeguards (§164.310) | Workstation/device controls | Self-hosted — ePHI never leaves your premises; no cloud egress | All tiers | v1.0 |
| **HITECH Act** | Breach detection, risk assessment documentation | Tamper-evident audit trail, change history with who/when/what/why | Fabrick | v1.0 |
| **42 CFR Part 2** — SUD Record Segmentation | System-level isolation of substance use disorder records | VM-level isolation — dedicated VMs for SUD workloads, network-segmented via managed bridges | Weaver+ | v1.0 |
| **NIST CSF / HHS 405(d)** | Identify, Protect, Detect, Respond, Recover | Asset inventory (VM dashboard), hardening plugins (AppArmor/Seccomp), AI diagnostics, declarative recovery | Weaver+ | v1.0 |
| **CIS Controls v8** | Technical hardening benchmarks | Kernel hardening plugins, managed firewall (nftables), fleet-wide policy enforcement | Weaver+ | v1.0 (firewall v1.1) |
| **SOC 2 Type II** | Security, Availability, Confidentiality evidence | Zero-drift by construction, audit log, access governance, uptime via Firecracker fast recovery | Fabrick | v1.0 |
| **FDA Device Cybersecurity** | Network segmentation for connected medical devices | Managed bridges with IP pools — isolate medical device VLANs declaratively | Weaver+ | v1.0 |
| **CMS Emergency Preparedness** (42 CFR 482.15) | Documented contingency planning, DR exercises | Declarative config = reproducible rebuild; RTO drops from hours to sub-second | Weaver+ | v1.0 |

### Indirect Compliance Support

| Healthcare Function | IT Pain Today | How Weaver Helps |
|--------------------|--------------|----------------------------|
| **ONC / 21st Century Cures** — FHIR API hosting | Managing infrastructure for interoperability endpoints | Live Provisioning spins up FHIR server VMs on demand; reproducible config ensures API availability |
| **BAA Management** | Tracking vendors with ePHI access | Single vendor relationship (Weaver) replaces multiple infrastructure tools = fewer BAAs |
| **Revenue Cycle** — billing system integrity | System configuration errors create False Claims Act exposure | Zero drift = system config matches documented state; git history proves it |
| **Provider Credentialing** | HR/IT integration for access provisioning/deprovisioning | LDAP integration automates access lifecycle tied to credentialing status |

---

## 3. Weaver for Healthcare {#3-weaver-for-healthcare}

**Target:** Small clinics, independent practices, rural health systems, healthcare IT consultants

**Price:**
- **Weaver Solo** — $149/yr (FM, first 200) per node, admin only, local management, up to 128GB RAM
- **Weaver Team** — $129/user/yr (FM, first 50 teams) (2–4 users + 1 viewer free), up to 2 remote peer Weaver hosts (full management), up to 128GB RAM/host. Ships v2.2.0.

**The pitch:** "Your compliance auditor asks 'can you prove your VM configs haven't drifted?' With Proxmox, you can't. With Weaver, the answer is 'drift is mathematically impossible' — and it costs less."

### Key Weaver Wins for Healthcare

| Capability | Healthcare Value |
|-----------|-----------------|
| **Live Provisioning** | Spin up isolated VMs for new clinical applications without SSH + rebuild cycles. HIPAA-compliant workload isolation in minutes, not days |
| **Zero Configuration Drift** | Prove to OCR investigators and Joint Commission surveyors that running systems match declared policy — by construction, not by scan |
| **AI Diagnostics** | When a clinical system VM fails at 2 AM, natural language diagnosis reduces mean-time-to-resolution. Better incident documentation for HIPAA |
| **Maintenance Manager** (v2.1.0) | Host OS updates — kernel patches, flake transitions — without a maintenance window. Path A: `test → AI health check → confirm → switch` with auto-revert; AI remediation loop fixes clinical VM service failures before committing. Path B (Team): standby clones serve live traffic during the host rebuild — EHR and clinical systems stay online while the host updates |
| **Managed Bridges + IP Pools** | Declarative network segmentation — isolate clinical, administrative, and medical device networks. Foundation for 42 CFR Part 2 SUD record isolation |
| **Sub-Second VM Boot** | Clinical downtime procedures require fast recovery. Firecracker <125ms boot means replacement VMs are running before the pager goes off |
| **Multi-Hypervisor** | Run security-sensitive workloads on Firecracker (minimal attack surface), general workloads on QEMU — one dashboard, one policy |

### ROI for a 50-Bed Community Hospital

| Current Cost | With Weaver |
|-------------|----------------------|
| Proxmox: EUR355/socket x 4 sockets = **EUR1,420/yr** | 4 nodes x $149 (Solo) = **$596/yr** |
| 1 sysadmin spending 15 hrs/week on VM management at $65/hr = **$50,700/yr** | Reclaim 8 hrs/week = **$27,040/yr freed** for compliance work |
| Audit prep: 3 weeks/yr of configuration evidence gathering = **$7,800** | Zero — config-as-code is the evidence |
| **Total current cost: ~$59,920/yr** | **Weaver: $596/yr (Solo) + $27,040 labor freed** |

### Weaver Team for Healthcare

**Target:** Small multi-location clinics, physician groups with a primary site and offsite backup/DR server, practice management teams monitoring distributed clinical workloads.

**Price:** $129/user/yr (FM), 2–4 users + 1 viewer free. Each host needs its own Weaver key. Ships v2.2.0.

**The use case:** A multi-location practice has a primary site running EHR and clinical VMs plus an offsite backup/DR server. Weaver Team lets the IT team manage both hosts from the same Weaver view — see whether the remote EHR VM is running, its resource usage, and current status — and take action directly. Full remote workload management across sites without requiring Fabrick. The remote peer appears in the Weaver view with a host badge on workload cards; all management actions are fully available on remote peers.

**Upgrade trigger:** When the team needs more than 2 remote peers, fleet-scale governance, per-VM RBAC, or resource quotas across the fleet — that's a Fabrick conversation.

---

## 4. Fabrick for Healthcare {#4-fabrick-for-healthcare}

**Target:** Health systems, large hospital groups, IDNs, compliance-driven organizations, organizations pursuing ISO 27001

**Price:** $2,000/yr first node + $750/yr additional + $500/yr at 10+ nodes (up to 256GB RAM)

**The pitch:** "Every OCR investigation starts with 'show me your audit logs and access controls.' Weaver makes that a 5-minute exercise, not a 5-week project."

### Fabrick Features Mapped to Healthcare Obligations

| Fabrick Feature | HIPAA Requirement Addressed | Audit Evidence Produced | Available |
|-------------------|----------------------------|------------------------|:---------:|
| **Per-VM RBAC** | §164.312(a)(1) — Access control | Role assignments per VM, enforced at API level | v1.0 |
| **SSO/SAML/LDAP** | §164.312(d) — Person or entity authentication | Integration with hospital Active Directory; single identity source | v1.0 |
| **Declarative Audit Log** | §164.312(b) — Audit controls | Git commit history: who changed what, when, why, with approval | v1.0 |
| **Bulk VM Operations** | §164.308(a)(4) — Information access management | Fleet-wide policy changes applied atomically, logged | v1.0 |
| **Resource Quotas** | §164.308(a)(1)(ii)(B) — Risk management | Resource limits prevent runaway processes from affecting clinical systems | v1.0 |
| **All Plugins Included** | §164.312(e)(1) — Transmission security | Firewall, DNS, hardening — complete security stack, no upsell | v1.0 (firewall/DNS v1.1) |
| **AppArmor/Seccomp/Kernel Hardening** | §164.306(a) — Security standards, general | Defense-in-depth enforced at VM level across entire fleet | v1.0 |

### Fleet Onboarding (v2.3.0)

Enterprise health systems rarely arrive at Fabrick with an empty fleet. The fleet discovery wizard inventories existing Weaver agents across your network in a single session — no manual host registration. **Tailscale scan** is the primary path for healthcare: if your hosts are already on a Tailnet (common for multi-site systems using Tailscale for secure remote access), Fabrick queries the Tailnet and presents a checkbox list of all discovered Weaver agents; full fleet inventory in under 5 minutes, with a complete audit trail from day one. CIDR probe and CSV import are available for non-Tailscale setups. Discovered hosts land in Fabrick automatically; workload inventory is pulled from each host on registration without a separate scan step. All discovery sessions are audit-logged with triggering user, timestamp, and discovered host count — satisfying HIPAA §164.312(b) audit controls from the first day of deployment.

Non-NixOS hosts — existing Ubuntu EHR servers, RHEL administrative workstations, legacy infrastructure running alongside the NixOS migration — can join as **Observed** fleet members by installing `weaver-observer` (statically-linked Rust binary, memory-safe, zero runtime dependencies, any Linux kernel ≥ 4.x). Observed hosts appear in the Fabrick fleet map with a yellow `Observed` badge showing running containers and VMs read-only. They do not contribute to HIPAA compliance evidence — that requires Managed (NixOS + Weaver) hosts. Observer nodes are included free up to 5× the Managed node count. The fleet map becomes a live migration tracker: yellow badges are the remaining migration roadmap, each with a "Convert to Managed" CTA linked to the nixos-anywhere wizard.

### Fabrick Success Programs for Healthcare

| Program | Healthcare Application | FM Price | Standard Price |
|---------|----------------------|:--------:|:--------------:|
| **Adopt** | NixOS + Weaver onboarding course (LMS) + 3 live sessions; HIPAA-aware deployment playbook; email/chat async support | $5,000/yr | $15,000/yr |
| **Adopt — Compliance** | Everything in Adopt + HIPAA §164.312 config mapping session, OCR evidence walkthrough, BAA documentation review, ISO 27001 certification path mapping | — | $25,000/yr |
| **Accelerate** | All Adopt content; dedicated Slack; quarterly fleet reviews mapped to HIPAA Security Rule controls; SIEM integration help; LMS modules for SSO/LDAP/CI/CD | $15,000/yr | $45,000/yr |
| **Partner** | Named engineer who understands clinical environments; priority features for healthcare-specific needs (SUD segmentation, device isolation templates); compliance mapping for ISO 27001; sessions on demand | $30,000/yr | $90,000/yr |

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = $9,000/yr total compliance coverage during the FM period. Standard Adopt — Compliance ($25,000/yr) includes hands-on compliance service delivery not covered by the extension alone.

### ROI for a 200-Bed Health System (30 Nodes)

| Cost Category | Current State | With Fabrick |
|-------------|--------------|----------------------------------|
| Infrastructure software | VMware: $15,000-50,000/yr | 30 nodes: $18,750/yr |
| Compliance staff time (2 analysts, 40% on infra evidence) | $72,000/yr | Redirect to clinical compliance — infra evidence is automatic |
| Audit preparation | 4 weeks/yr across team = $30,000 | < 1 week — config-as-code is the evidence |
| Success program | N/A | Accelerate: $15,000/yr (FM) |
| Vendor risk management | 5+ infrastructure vendors = 5+ BAAs, 5+ security assessments | 1 vendor, 1 BAA, 1 assessment |
| **Total** | **$117,000-152,000/yr** | **$33,750/yr + compliance staff redirected** |

### Compliance Export Extension

**Price:** $4,000/yr flat (per organization — not per node) · stacks on Fabrick subscription
**Available:** v2.2 (HIPAA, SOC 2 export) · v3.0 (scheduled delivery)

The Compliance Export extension generates auditor-ready HIPAA evidence packages from Weaver's existing configuration artifacts. No separate compliance tooling required.

| Feature | HIPAA Requirement Addressed | Available |
|---------|----------------------------|:---------:|
| **HIPAA Security Rule control mapping export** | §164.308–§164.316 — formatted evidence document showing control satisfaction with config citations | v2.2 |
| **Signed configuration attestation** | §164.312(b) — cryptographically signed config snapshot proving running state matched declared state at attestation timestamp | v2.2 |
| **Audit-ready change log export** | §164.312(b) — formatted change history: who, what system, when, what changed, approved by whom | v2.2 |
| **Scheduled export delivery** | Annual/quarterly evidence package delivery to S3-compatible endpoint or encrypted email | v3.0 |

**Positioning:** "The compliance supplement in the TCO is $20,500/yr. The extension costs $4,000/yr. You capture $16,500/yr net from day one." See [COMPLIANCE-EXPORT-EXTENSION.md](../../product/COMPLIANCE-EXPORT-EXTENSION.md) for full feature spec.

---

## 5. Deficiency Remediation Plan {#5-deficiency-remediation-plan}

When a healthcare organization has existing compliance findings — from OCR audits, Joint Commission surveys, or internal risk assessments — Weaver can address infrastructure-related deficiencies systematically.

### Quick Wins (Week 1-2)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|-------------------------------|
| **Audit trail gaps** | "Cannot demonstrate who made infrastructure changes" | Deploy Weaver — every VM change becomes a git commit with who/when/what/why |
| **Configuration documentation** | "Running systems do not match documented configuration" | NixOS declarative config = running state by construction; drift is impossible |
| **Access control evidence** | "Cannot demonstrate role-based access to infrastructure" | Per-VM RBAC (Fabrick) with audit log of all access grants/revocations |

### Medium-Term (Month 1-3)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|-------------------------------|
| **Network segmentation** | "Medical devices share network with general workloads" | Managed bridges with IP pools — declarative network isolation per workload type |
| **Contingency planning** | "DR testing shows unacceptable RTO for critical systems" | Sub-second VM boot (Firecracker <125ms) + declarative rebuild from config |
| **Vendor risk** | "Multiple infrastructure vendors with inconsistent BAAs" | Consolidate to single vendor (Weaver) — 1 BAA, 1 security assessment |

### Strategic (Quarter 1-2)

| Finding Category | Typical Deficiency | Weaver Remediation |
|-----------------|-------------------|-------------------------------|
| **42 CFR Part 2 isolation** | "SUD records not adequately segmented at infrastructure level" | Dedicated VMs with bridge-level network isolation; config-as-code proves segmentation |
| **ISO 27001 readiness** | "Infrastructure controls not mapped to Annex A requirements" | Accelerate success program ($15K/yr) includes quarterly compliance mapping reviews |
| **Continuous monitoring** | "No automated detection of infrastructure security changes" | Zero-drift architecture eliminates the need for drift detection — there is nothing to detect |

---

## 6. Healthcare-Specific Competitive Advantages {#6-competitive-advantages}

### vs VMware (Post-Broadcom)

| Factor | VMware | Weaver |
|--------|--------|-------------------|
| Cost (200-bed system) | $15,000-50,000/yr (72-core min, subscription-only) | $18,000/yr (30 nodes) |
| HIPAA audit evidence | Separate audit logging, configuration scanning tools | Built-in — every change is a git commit |
| Configuration drift | Possible and common; requires periodic scanning | Impossible by construction (NixOS) |
| Medical device isolation | Manual VLAN configuration | Declarative managed bridges with IP pools |
| Vendor lock-in | High — Broadcom controls pricing unilaterally | Open core, offline-first license, no phone-home |
| Migration cost from VMware | N/A | $5,000-20,000 one-time (our migration service) |

### vs Proxmox

| Factor | Proxmox | Weaver |
|--------|---------|-------------------|
| HIPAA audit trail | API call logs only — captures actions, not intent | Git diffs — captures what changed AND why |
| Per-VM RBAC | Pool-level permissions only | Per-VM role assignments (Fabrick) |
| Zero drift | No — imperative management allows drift | Yes — declarative by construction |
| AI diagnostics | None | Built-in natural language failure analysis |
| SUD record isolation (42 CFR Part 2) | Manual network config | Declarative bridge isolation per workload type |

### vs Cloud (AWS/Azure/GCP)

| Factor | Cloud VMs | Weaver |
|--------|-----------|-------------------|
| ePHI location | Shared infrastructure, depends on BAA + config | **On your premises** — ePHI never leaves your facility |
| Cost per VM | $600-6,000+/yr per VM | Unlimited VMs per node ($149-2,000/yr per node) |
| BAA complexity | Must sign cloud provider BAA + configure correctly | Self-hosted — BAA is with Weaver only |
| Air-gap capability | No | Yes — offline-first license, no phone-home required |
| 42 CFR Part 2 isolation | Requires careful VPC/subnet configuration | Declarative bridge isolation — config is the proof |

### The Air-Gap Advantage

Many healthcare systems — especially those handling SUD records under 42 CFR Part 2 or operating in sensitive research environments — require or prefer air-gapped infrastructure. Weaver's offline-first license validation (HMAC checksum, no phone-home) is purpose-built for these environments. No competitor offers this without fabrick negotiation.

#### Kubernetes Complexity in Healthcare

Healthcare organizations that adopted Kubernetes for microservices face a compounding compliance burden: HIPAA auditors must verify access controls, network segmentation, and audit trails across K8s namespaces, pod security policies, and network policies — concepts that don't map to any language auditors use. The result is expensive translation layers between K8s configuration and HIPAA documentation, maintained by a platform team that most health systems can't afford.

| K8s Overhead | Impact in Healthcare | Weaver Alternative |
|---|---|---|
| Pod security policies + namespace isolation | Auditors can't verify HIPAA access controls without K8s expertise; requires costly translation documentation for every audit cycle | Weaver RBAC + per-VM ACLs map directly to HIPAA access control requirements — auditors understand "VM access" without a translation layer |
| Network policies for ePHI segmentation | Shared-kernel containers require compensating controls to prove ePHI isolation; network policy YAML doesn't satisfy auditors as boundary evidence | MicroVM hardware isolation provides ePHI boundaries auditors can verify — each workload has its own kernel, no compensating controls needed |
| Platform team to operate K8s control plane | 3–5 engineers at $150K+ each to maintain infrastructure that a 50-bed hospital can't justify; K8s expertise is scarce in healthcare IT | One sysadmin manages Weaver; NixOS declarative config eliminates the platform team role entirely; Weaver Solo starts at $249/yr |

Full competitive reference: [KUBERNETES-COMPETITIVE-POSITIONING.md](../KUBERNETES-COMPETITIVE-POSITIONING.md)

### AI-Era Threat Landscape Advantage

Anthropic's Project Glasswing (April 2026) demonstrated that frontier AI can discover **thousands of zero-day vulnerabilities** — including some that survived decades of human review — across every major operating system and browser. These capabilities will proliferate to attackers.

**Why this changes the calculus for healthcare:**

- **Shared-kernel = fleet-wide compromise.** A single kernel zero-day — exactly the kind AI is now finding by the thousands — compromises every Docker container on the host simultaneously. An ePHI breach triggered by a container escape affects every patient record on that server. Weaver's hardware boundary per MicroVM contains the blast radius to one workload — one compromised VM does not expose the entire patient database.
- **Patch at the speed of AI discovery.** HIPAA's 60-day breach notification window assumes you can detect, contain, and remediate. When AI-discovered vulnerabilities drop faster than human patch cycles, the question becomes "how quickly can you prove every system is patched?" NixOS's `flake.lock` pins every dependency by hash. Pin the fix, rebuild, deploy via Colmena — every node converges deterministically. No "did we patch that server?" during an OCR investigation.
- **Supply-chain verifiability.** Glasswing explicitly targets open-source and supply-chain security. Healthcare runs on open-source stacks (FHIR servers, clinical databases, imaging tools). NixOS's content-addressed store makes the entire supply chain formally verifiable — every package identified by its complete dependency tree hash, not a mutable tag. When an OCR investigator asks "was this component compromised?", the answer is a hash comparison, not a manual audit.
- **Hypervisor diversity.** Weaver's 5 hypervisor options mean a vulnerability in one doesn't cascade to workloads on another — defense through diversity against AI-augmented exploit discovery. Medical device isolation VMs can run on a different hypervisor than clinical application VMs, limiting cross-workload attack surface.

---

## 7. Objection Handling {#7-objection-handling}

### "We need to stay on a supported, established platform"

NixOS roots go back to 2003 and it's been shipping stable releases for 12 years — 100K+ packages, ~466 companies in production. Weaver adds a management layer — it doesn't replace the OS. The declarative model means your infrastructure is more supportable than imperative platforms, because the entire state is version-controlled and reproducible. With the Partner success program, you get a named engineer who understands your environment.

### "Our compliance team hasn't heard of NixOS"

That's an advantage. NixOS's declarative model means configuration drift is impossible by construction — no other OS can make that claim. Show your compliance team a `git diff` of every infrastructure change with who/when/what/why. That's stronger evidence than any scanning tool produces.

### "We can't migrate off VMware mid-contract"

We offer migration services ($5,000-20,000) that can run in parallel with your existing VMware deployment. Start with non-critical workloads, prove the model, and migrate remaining VMs as your VMware contract expires. Our hub-agent multi-node architecture (v2.0+) manages both environments from one dashboard during transition.

### "What about our medical devices on legacy OS?"

Medical devices stay on their existing platforms — Weaver manages the infrastructure around them. Use managed bridges to create dedicated, isolated network segments for device VLANs. The dashboard provides visibility into these segments without requiring changes to the devices themselves.

### "We need SOC 2 / ISO 27001 from our vendors"

We're on the ISO certification path. In the interim, the Accelerate success program ($15,000/yr) includes compliance mapping that documents how Weaver controls satisfy SOC 2 Trust Service Criteria and ISO 27001 Annex A controls. Our audit trail is stronger than most SOC 2-certified competitors because it's declarative by construction, not process-dependent.

### "How do we know this is production-ready software from an independent vendor?"

A fair question for any compliance-sensitive environment. Weaver publishes a testing benchmark scored against enterprise standards (`code/docs/TESTING-ASSESSMENT.md`):

- **1,500+ tests** across unit, backend, TUI, and E2E layers — A rating
- **24 custom static auditors** on every push: SAST (OWASP patterns), supply chain license audit, route auth guard verification (every API endpoint verified for auth enforcement), and bidirectional tier parity checking — A+ on static analysis depth
- **5-browser E2E** — Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari on every release
- **Red team security audit** — 21 findings, all dispositioned, 4 hardening fixes applied. Audit log available.
- **Gate enforcement** — Git hooks + GitHub Actions CI; nothing merges without passing unit tests, backend tests, compliance suite, and build

For healthcare IT buyers asking vendors for evidence of software quality controls: this is the evidence. Overall engineering benchmark: **A** against enterprise standards — not typical for a product at this stage.

### "HIPAA requires encryption — does Weaver handle that?"

NixOS supports full-disk encryption (LUKS) and encrypted VM storage declaratively. Weaver's config export uses standard formats. All API communication uses TLS. The declarative model means encryption configuration is version-controlled and auditable — you can prove to an investigator that encryption was enabled on every VM, and when it was configured.

### "Does Weaver have documented contingency / disaster recovery procedures? HIPAA requires this."

Yes — `docs/setup/DISASTER-RECOVERY.md` covers backup scope (code, secrets, configs, NixOS configurations), recovery procedures for service disruption, and local backup restoration. HIPAA §164.312(a)(2)(i) requires a data backup plan and §164.312(a)(2)(iv) requires an emergency mode operation plan. Weaver's self-hosted architecture means your ePHI never enters Weaver's infrastructure — your DR obligation is to your own hardware, and Weaver's DR doc covers the Weaver service layer specifically.

### "Do you have a vulnerability disclosure policy?"

Yes — `SECURITY.md` defines a 48-hour acknowledgment SLA, 7-day critical fix SLA for critical vulnerabilities, and documented supported versions. Healthcare procurement checklists and cyber insurance carriers increasingly require vendor CVD policies as part of BAA due diligence. Ours is published, specific, and enforced.

### "We have Ubuntu/VMware servers we can't immediately convert"

Install `weaver-observer` on them. Existing Ubuntu or VMware-hosted Linux VMs appear in your Fabrick fleet map immediately — containers and workloads visible, read-only. Convert your most compliance-sensitive workloads first (ePHI systems, clinical applications); observe the rest while migration runs. Observer nodes are free up to 5× your Managed node count. The HIPAA compliance story — zero drift, declarative audit trail, §164.312(b) evidence — applies only to Managed (NixOS + Weaver) hosts. The fleet map makes this unmistakable: `Observed` badge means "not in compliance posture." Every Observed host has a "Convert to Managed" button. Your migration roadmap is visible in the UI.

---

## 8. Buyer Personas {#8-buyer-personas}

### CISO / VP of Information Security

**Cares about:** Risk reduction, audit readiness, breach prevention, regulatory exposure
**Lead with:** Zero-drift architecture eliminates an entire class of compliance findings. Declarative audit trail satisfies HIPAA §164.312(b) by construction. Air-gap support for sensitive workloads.
**Tier:** Fabrick + Accelerate or Partner

### Director of IT Infrastructure

**Cares about:** Uptime, staff efficiency, tool consolidation, migration from VMware
**Lead with:** Live Provisioning eliminates rebuild cycles. 5 hypervisors from one dashboard. Sub-second recovery. 80%+ cost reduction vs VMware post-Broadcom.
**Tier:** Fabrick

### IT Manager (Community Hospital / Rural Health)

**Cares about:** Budget, simplicity, audit prep time, staff wearing multiple hats
**Lead with:** $149/yr (FM) vs EUR355+/socket for Proxmox. AI diagnostics for the 2 AM call. Config-as-code means audit prep is already done.
**Tier:** Weaver

### Compliance Officer / Privacy Officer

**Cares about:** Evidence for OCR investigations, Joint Commission surveys, breach notification readiness
**Lead with:** Every infrastructure change is a git commit. Zero drift means running state = declared policy. SUD record isolation via declarative network segmentation.
**Tier:** Fabrick (they'll champion the purchase internally)

### CTO / VP of Engineering (Health Tech Company)

**Cares about:** Developer velocity, infrastructure cost, multi-environment consistency
**Lead with:** Reproducible builds, CI-testable VM configs, multi-hypervisor support (5 hypervisors), GPU passthrough for ML workloads. Container management coming v1.1+.
**Tier:** Weaver or Fabrick depending on team size

---

## 9. Discovery Questions {#9-discovery-questions}

Use these to qualify healthcare prospects and identify pain:

### Infrastructure Pain
- How do you currently provision new VMs for clinical workloads? How long does it take?
- When was the last time you discovered a configuration change that wasn't documented?
- How many infrastructure management tools does your team use daily?
- What's your current RTO for a critical clinical system VM failure?

### Compliance Pain
- How long does your team spend preparing infrastructure evidence for Joint Commission surveys?
- How do you currently prove to auditors that your running VM configurations match your documented policies?
- How do you handle network segmentation for 42 CFR Part 2 (SUD) workloads?
- How many BAAs do you currently manage for infrastructure vendors?

### Budget Pain
- What are you paying annually for VMware/Proxmox licensing?
- How much of your IT staff time goes to infrastructure management vs compliance/security work?
- Have your VMware costs changed since the Broadcom acquisition?

### Strategic Pain
- Are you pursuing ISO 27001 certification? What's your timeline?
- How do you handle medical device network isolation today?
- Is air-gap capability important for any of your workloads?

### AI Threat Landscape
- "If a frontier AI discovered a zero-day in your host kernel tomorrow — which Project Glasswing has demonstrated is now routine — how many ePHI workloads would be compromised simultaneously? How quickly could you prove the patch propagated to every clinical system?"
- "Glasswing's 90-day public disclosure cycle means your competitors will know about vulnerabilities found in your stack. Can your current infrastructure prove it's patched faster than the disclosure window — before HIPAA's 60-day breach notification clock even starts?"

---

## 10. Clinical AI & Cloud Burst (Fabrick v3.0+) {#10-clinical-ai--cloud-burst-fabrick-v30}

**Full analysis:** [business/FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md)

Health systems and academic medical centers are building clinical AI at scale: medical imaging models (radiology, pathology, ophthalmology), clinical NLP on EHR text, genomics/bioinformatics pipelines, and real-world data analytics on population health datasets. These workloads are GPU-intensive, burst-heavy, and — critically — run on ePHI. Standard cloud burst (shared tenancy) either fails HIPAA's technical safeguards or requires complex BAA negotiations and additional controls that eliminate most cost savings.

### The Compliance Gap Cloud HPC Doesn't Solve

For healthcare AI workloads, shared-tenancy cloud burst presents a compliance problem:

- **HIPAA §164.312(a)(1)** — Access control requirements for systems processing ePHI; shared cloud instances cannot guarantee hardware-level isolation between tenants
- **HIPAA §164.312(e)** — Transmission security: ePHI in a multi-tenant cloud training environment requires extensive additional controls to satisfy the transmission and storage security requirements
- **BAA complexity** — Training on ePHI requires a signed BAA with the cloud provider. AWS, Azure, and GCP offer HIPAA-eligible services, but the burden of ensuring ePHI is processed only on compliant infrastructure falls entirely on the health system
- **CISO risk posture** — Most healthcare CISOs simply prohibit training on ePHI on shared cloud, treating dedicated tenancy as the minimum. Dedicated tenancy eliminates most cost savings: $800–$1,600/day for an 8× H100 dedicated instance vs $320–450/day shared

These organizations either avoid cloud burst entirely (lost throughput on clinical AI model development) or absorb dedicated tenancy costs that make burst economically painful.

**Fabrick + Weaver burst nodes resolve this:** MicroVM hardware isolation provides the boundary that satisfies HIPAA's technical safeguards — the same isolation that makes Weaver the right choice for ePHI workloads on-premises extends to burst nodes. The burst node appears as an extension of the health system's controlled fabric, not "cloud data processing."

### The Pitch for Healthcare AI Teams

*"Your clinical AI team's imaging model needs 4 H100s for 10 days to train on your radiology archive. Your CISO says ePHI can't go on a shared cloud instance without a full BAA review and additional controls. Fabrick enrolls a dedicated burst node with hardware-isolated MicroVMs — the same isolation model that covers your on-prem ePHI infrastructure. The burst node appears as an extension of your network via WireGuard tunnel. $20/node-day Fabrick licensing on top of whatever AWS charges for the dedicated instance. Your compliance posture doesn't change; your throughput does."*

### Licensing for Burst Nodes

Clinical AI burst nodes typically fall in the 1–2TB RAM tier (H100 nodes). Per-node-day consumption stacks on the Contract tier base:

| License component | Coverage |
|---|---|
| Contract base (Fabrick $2,500/yr) | Fabrick control plane + persistent nodes |
| Contract block ($2,000 first block) | 512GB+ RAM per burst node |
| Burst add-on (~$20/node-day) | Per-day charge while burst node is enrolled |

**Example:** Imaging AI team, 4 burst nodes, 3 training cycles/yr (10 days each):
- Cloud compute (dedicated): 4 × 30 days × $600/day = $72,000/yr
- Fabrick burst licensing: 120 node-days × $20 = $2,400/yr
- **Fabrick as % of compute: 3.3%** — HIPAA compliance posture and audit trail come at no material cost

### New Buyer Persona: Clinical AI Platform Engineer / Healthcare ML Infrastructure Lead

**Profile:** Manages the GPU infrastructure for a health system's AI/ML team or a clinical research center's computational pipeline. Owns the on-prem GPU cluster, burst provisioning strategy, and the compliance posture for training on ePHI. Frustrated by the gap between what the AI team needs (fast burst capacity) and what the CISO allows (no ePHI on shared cloud).

**Cares about:** HIPAA compliance during model training, GPU utilization efficiency, declarative audit trails for training runs on regulated data, dedicated tenancy costs vs hardware isolation alternatives, pipeline reproducibility for clinical model validation.

**Lead with:** Fabrick as the isolation layer that extends on-prem HIPAA compliance posture to burst nodes — "the burst node is just another node in your controlled fabric." Hardware-isolated MicroVMs satisfy the technical safeguard requirements that shared tenancy cannot. $20/node-day vs $600/day dedicated tenancy means hardware isolation is no longer a cost constraint.

**Tier:** Contract (1TB+ nodes) + Fabrick fleet license + burst consumption add-on + Partner success program.

### Discovery Questions (Clinical AI Platform)

- Does your health system train AI models on ePHI? How do you currently provision compute for those training runs?
- What constraints does your CISO impose on cloud burst for workloads that touch ePHI or patient data?
- Are you paying for dedicated cloud tenancy to satisfy HIPAA requirements? What's the cost premium over shared?
- How long does a typical training cycle run on your current on-prem GPU cluster? Do you have queue backlogs?
- How do you currently provide audit trails for training runs that use ePHI — does your existing infrastructure produce evidence suitable for a HIPAA audit?

---

*This document complements the universal value proposition in [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md). For pricing details, see [TIER-MANAGEMENT.md](../../product/TIER-MANAGEMENT.md). For Fabrick justification, see [FABRICK-VALUE-PROPOSITION.md](../../marketing/FABRICK-VALUE-PROPOSITION.md). For cloud burst architecture and licensing, see [FABRICK-CLOUD-BURST.md](../../product/FABRICK-CLOUD-BURST.md).*

---

## Recent Changes

- **2026-03-26** — Added fleet onboarding subsection to Section 4 (Fabrick). Tailscale scan primary path for healthcare; HIPAA §164.312(b) audit trail from day one; workload inventory pulled on registration.
- **2026-03-21** — Weaver split into Solo ($149/yr (FM)) and Team ($129/user/yr (FM), 2 remote peers, v2.2.0). Added Weaver Team healthcare use case: multi-location practice managing remote EHR/clinical VMs.
- **2026-03-21** — Added Section 10: Clinical AI & Cloud Burst (Fabrick v3.0+). Covers HIPAA §164.312 constraints on shared-tenancy cloud burst, dedicated tenancy economics, per-node-day licensing, and new Clinical AI Platform Engineer buyer persona.
- **2026-03-18** — Fabrick pricing revised to $2,000/yr first node, $750/yr additional, $500/yr at 10+. Fabrick tier added at $2,500/yr (512GB RAM). Contract tier added for 512GB+ deployments (sliding scale per 512GB block). RAM coverage noted per tier. Parallel migration / no-expertise-required positioning added as primary lead.
