<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# How Weaver Lets IT Focus on Core Business
## The Universal Sales Case Across Weaver and Fabrick

**Date:** 2026-03-09
**Purpose:** Master sales document — how Weaver eliminates infrastructure toil so IT teams focus on governance, compliance, and business-critical work. Industry-specific versions reference this document.
**Companion docs:** [WEAVER-VALUE-PROPOSITION.md](../marketing/WEAVER-VALUE-PROPOSITION.md) | [FABRICK-VALUE-PROPOSITION.md](../marketing/FABRICK-VALUE-PROPOSITION.md) | [TIER-MANAGEMENT.md](../product/TIER-MANAGEMENT.md)

---

> **The One-Sentence Pitch:** Weaver delivers the security and compliance benefits of immutable infrastructure to any IT team — without requiring NixOS expertise, without replacing existing tooling, and without a cutover event.

---

## Table of Contents

1. [The Problem: Infrastructure Toil Crowds Out Strategic Work](#1-the-problem)
2. [Weaver: Eliminate the Rebuild-Drift-Diagnosis Loop](#2-premium)
3. [Unified Container + VM Visibility (v1.1.0)](#3-unified-visibility)
4. [Fabrick: Automate Compliance Operations](#4-fabrick)
5. [Fabrick Success Programs: The Focus Multiplier](#5-success-programs)
6. [Industry-Specific Applications](#6-industry-specific)
7. [Competitive Positioning Summary](#7-competitive-positioning)

---

## 1. The Problem: Infrastructure Toil Crowds Out Strategic Work {#1-the-problem}

**No NixOS expertise required — ever.** NixOS roots go back to 2003 and it's been shipping stable releases for 12 years — 100K+ packages, ~466 companies in production. This isn't experimental infrastructure; it's the most mature declarative OS available. Weaver runs alongside existing Docker, VMware, Proxmox, or bare-metal tooling. Migrate one workload at a time. No cutover event. No retraining.

> **81% of self-hosters work in tech professionally** (selfh.st 2025 survey). They evaluate Weaver at home and champion it at work. The pitch that converts them is not "NixOS compliance tool" — it's "zero-expertise parallel migration that runs alongside what you already have."

IT departments exist to enable the business. Their highest-value work is:

- **Access governance** — who can access what, enforced by policy
- **Audit & compliance** — proving controls work to regulators and auditors
- **Change management** — controlled, documented, reversible changes
- **Incident response** — fast detection, containment, recovery
- **Vendor risk management** — controlling third-party exposure
- **Security posture** — hardening, monitoring, threat response

But most IT teams spend the majority of their time on **infrastructure plumbing**:

- Provisioning VMs manually (SSH, scripts, rebuild cycles)
- Investigating configuration drift ("who changed this?")
- Troubleshooting without adequate diagnostics
- Managing multiple tools that don't talk to each other
- Documenting changes after the fact for audit evidence
- Rebuilding environments after failures with no reproducible config

**Weaver eliminates the plumbing layer** so IT works on what actually matters to the business.

---

## 2. Weaver: Eliminate the Rebuild-Drift-Diagnosis Loop {#2-premium}

**Target buyer:** Sysadmin, self-hoster (Solo) · Small technical teams, 2–4 people with multiple hosts (Team)
**Price:** $149/yr (FM, first 200) — Weaver Solo (1 admin, local only, up to 128GB RAM) · $129/user/yr (FM, first 50 teams) — Weaver Team (2–4 users + 1 viewer free, up to 2 remote peer hosts, up to 128GB RAM/host) · vs Proxmox at EUR355-1,060/yr/socket
**Pitch:** "Cheaper AND better than Proxmox"

### Infrastructure Toil Eliminated

| IT Toil | How Weaver Removes It | Business Time Freed Up |
|---------|----------------------------------|------------------------|
| **Manual VM provisioning** | Live Provisioning — create VMs via API/UI, zero `nixos-rebuild switch` | Shift from "build the VM" to "govern the VM" |
| **Configuration drift investigation** | NixOS makes drift mathematically impossible — declared config = running state | Audit evidence becomes trivial; no more "who changed this?" fire drills |
| **Troubleshooting blind spots** | AI diagnostics built into the dashboard — natural language failure analysis | Faster root cause identification, better incident documentation |
| **Multi-tool sprawl** | 5 hypervisors (QEMU, Cloud Hypervisor, crosvm, kvmtool, Firecracker) + containers from one pane | Fewer tools to learn, license, and maintain |
| **Network plumbing** | Smart Bridges (AI-operated bridge automation), IP pools, DNS auto-zones as declarative SDN | Network segmentation becomes config, not manual work |
| **Disaster recovery complexity** | Sub-second VM boot (Firecracker <125ms), declarative rebuild from config | RTO drops from hours to seconds |
| **Environment inconsistency** | Nix-guaranteed reproducibility — identical builds every time | Dev/staging/prod parity without manual synchronization |

### The Math

A sysadmin spending 10 hrs/week on VM provisioning, drift investigation, and troubleshooting at $75/hr effective cost = **$39,000/yr** in infrastructure toil. Weaver costs $149/yr (FM) and eliminates the majority of that.

Even reclaiming 2 hrs/week = **$7,800/yr value** from a **$149/yr (Solo FM)** investment = **~52x ROI**.

### Weaver Team

**Target buyer:** Small technical teams (2–4 people) running distributed infrastructure — the remote LLM box, the backup server, the secondary site.
**Price:** $129/user/yr (FM) · 2–4 users + 1 viewer free · Ships v2.2.0

Weaver Team extends Solo's value across multiple hosts without requiring Fabrick. The defining feature: **remote peer management**. Up to 2 remote Weaver hosts appear inside the local Weaver view with full management access — workload cards carry a host badge showing which node the workload lives on, and Weaver shows peer workloads alongside local ones. All management actions are available on remote peers.

**Peer discovery is zero-config with Tailscale MagicDNS** — Weaver finds peer hosts automatically from your existing Tailscale network. Manual IP entry is available for non-Tailscale setups. Peer protocol: REST + WebSocket.

**The upgrade trigger:** When a team says "I need more than 2 remote peers," that's the push to Fabrick. The 2-peer cap is the natural ceiling — along with the need for fleet-scale governance, per-VM RBAC, and resource quotas — that converts distributed teams into Fabrick contracts.

| IT Toil (Team) | How Weaver Removes It | Business Time Freed Up |
|----------------|----------------------|------------------------|
| **Checking multiple hosts** | Remote peer workloads appear in local Weaver view — one tab instead of N SSH sessions | Stop context-switching between hosts |
| **"What's running on the LLM box?"** | Host badge on workload cards, peer Weaver view with real-time state | Instant answer without logging into the remote node |
| **Peer discovery overhead** | Tailscale MagicDNS auto-discovery — zero config if Tailscale is already running | No manual inventory maintenance for small fleets |
| **Distributed team coordination** | Shared viewer seat free — one person watches, team members act | No extra seat cost for the monitoring role |

---

## 3. Unified Container + VM Visibility (v1.1.0) {#3-unified-visibility}

Weaver provides unified container + VM management — Docker, Podman, and Apptainer visible in one dashboard alongside your MicroVMs.

Most NixOS systems run containers alongside VMs. `virtualisation.oci-containers` defaults to Podman — and until now, there has been no dashboard for it. Weaver discovers your containers automatically from the same systemd services NixOS already manages. No agent. No configuration. Docker and Podman visibility are Free. Apptainer (SIF images, HPC job containers, institutional research workloads) is Weaver.

At v1.2, Weaver extends Strands: `docker0` and `podman0` bridge clusters appear alongside your VM bridges. Podman pods render as single topology nodes with service labels — the same pod model Kubernetes uses, without the orchestration overhead. VM nodes show their container service ports inline.

No competitor — Proxmox, Portainer, Cockpit — provides this combination for NixOS.

### Weaver IT Toil Eliminated

| IT Toil | How Weaver Removes It | Business Time Freed Up |
|---------|-------------------------------|------------------------|
| **Container discovery overhead** | Zero-config autodiscovery from `virtualisation.oci-containers` systemd services | No manual agent installs or inventory maintenance |
| **Multi-runtime sprawl** | Docker + Podman + Apptainer in one view alongside MicroVMs | Single pane replaces `podman ps`, `docker ps`, `systemctl` context-switching |
| **"Which container is eating memory?"** | Per-container resource history (1h Free / 24h Weaver) | Answer in 3 clicks, not `ssh + podman stats` |
| **No network picture for containers** | `docker0`/`podman0` bridge topology in Strands (v1.2 Weaver) | Instant visibility into container-VM network relationships |
| **Kubernetes complexity for pod workloads** | Podman pods as topology nodes — Kubernetes semantics without the platform engineering cost | Pod-based workloads visible without a k8s cluster |

### Availability

| Capability | Tier | Version |
|---|---|---|
| Docker + Podman container visibility | Weaver Free | v1.1.0 |
| Resource history (CPU, memory, disk I/O) | Weaver Free (1h) / Weaver (24h) | v1.1.0 |
| Apptainer / SIF container visibility | Weaver | v1.1.0 |
| Container network topology (`docker0`/`podman0`) | Weaver | v1.2.0 |
| Podman pod grouping in topology | Weaver | v1.2.0 |
| Container management (start/stop/create/delete) | Weaver | v1.2.0 |

---

## 4. Fabrick: Automate Compliance Operations {#4-fabrick}

**Target buyer:** IT department, compliance-driven organization
**Price:** $2,000/yr first node + $1,250/yr additional (2–4) + $1,000/yr (5–9) + $750/yr at 10+ nodes (up to 256GB RAM)
**Pitch:** "We compete on features, not price"

Fabrick maps directly to the compliance domains IT manages. Each feature eliminates manual compliance work:

### Compliance Domain Mapping

| Compliance Domain | Regulatory Framework | Fabrick Feature | Manual Work Eliminated |
|-------------------|----------------------|-------------------|------------------------|
| **Identity & Access Management** | HIPAA, ISO 27001 A.9, SOC 2 CC6, NIST AC | Per-VM RBAC, SSO/SAML, LDAP integration | No manual per-VM access provisioning; policy-driven enforcement |
| **Audit, Logging & Monitoring** | HIPAA Security Rule, ISO 27001 A.12, SOC 2 CC7, NIST AU | Declarative audit log — every VM change is a git commit (who/when/what/why/approval) | Tamper-evident trail baked in, not bolted on |
| **Change Management** | ISO 27001 A.12.1.2, SOC 2 CC8, ITIL | Every change = Nix declaration + commit; rollback is one command | Change advisory boards review diffs, not tickets |
| **Configuration Management** | NIST CM, CIS Controls, ISO 27001 A.12.5 | Zero configuration drift — mathematically impossible with NixOS | No drift scanning tools, no remediation workflows |
| **Vendor & Third-Party Risk** | ISO 27036, SOC 2 CC9, HIPAA BAA | All plugins included, single vendor, offline-first license (no phone-home) | Fewer BAAs, no DRM complications for air-gapped environments |
| **Endpoint & Device Management** | FDA guidance, HHS HPH, CIS Controls | Bulk VM operations, resource quotas, AppArmor/Seccomp/kernel hardening | Fleet-wide policy enforcement from one console |
| **Incident Response & BC** | HIPAA breach notification, ISO 22301, SOC 2 CC9 | Sub-second VM boot, declarative rebuild, config-as-code recovery | Replacement VMs spin up in milliseconds, not hours |
| **Records & Information Management** | NIST 800-88, state retention laws | Config export, git-based state history, deterministic builds | Retention and e-discovery = `git log` |
| **Physical & Environmental Security** | ISO 27001 Annex A.11 | Self-hosted — data never leaves your premises | No cloud egress concerns, full physical control |
| **Fleet Onboarding & Host Inventory** | All frameworks — asset inventory is a baseline control (NIST CM-8, ISO 27001 A.8.1, CIS Control 1) | Fleet discovery wizard — Tailscale scan, CIDR probe, CSV import, cloud scan (v2.4.0) — registers existing Weaver agents in one session; workload inventory pulled automatically on registration; each session audit-logged | Week-long manual host registration replaced by one wizard session; initial asset inventory established on day one |

### Fleet Onboarding: Arrive with a Fleet, Leave with Full Control

Enterprise buyers arrive at Fabrick with infrastructure already running — 30, 100, or 200 hosts that need to be registered and inventoried. The Fabrick fleet discovery wizard handles this in a single session across four paths matched to different network topologies:

| Topology | Discovery path | Typical buyer |
|---|---|---|
| Tailscale network | **Tailscale scan** — queries Tailnet, checkbox list of discovered agents | Healthcare, research/HPC |
| Internal network segments, air-gap | **CIDR probe** — RFC 1918 only, no external API calls | Defense, government, OT manufacturing |
| Strict access controls, FedRAMP | **CSV/hostname import** — admin-controlled list, no lateral probing | Financial services, government |
| Cloud VMs running Weaver | **Cloud scan** — queries provider API (Hetzner + DO v2.4.0; AWS v3.0) | Hybrid HPC, MSPs |

Discovered hosts land in Fabrick automatically; workload inventory is pulled from each Weaver agent on registration — no separate scan step. Each discovery session is audit-logged. The wizard removes what is otherwise a week-long manual task from every Fabrick deployment, and establishes the initial host inventory baseline (NIST CM-8, ISO 27001 A.8.1) on day one.

Non-NixOS hosts (Ubuntu, RHEL, Alpine, Yocto) can join the fleet as **Observed** members by installing `weaver-observer` — a statically-linked Rust binary, memory-safe by construction, zero runtime dependencies, any Linux kernel ≥ 4.x. Observer hosts appear in the fleet map with a yellow `Observed` badge, showing running containers and VMs read-only. No provisioning, no compliance evidence — those require a Managed (NixOS + Weaver) host. Observer nodes are included free up to **5× the Managed node count**: 10 Managed nodes → up to 50 Observer nodes. To observe more, convert more. Every Observed host has a "Convert to Managed" CTA linking to the nixos-anywhere wizard.

### The Zero-Drift Audit Advantage

Traditional infrastructure audit:
1. Scan all hosts for configuration drift (takes days)
2. Investigate deviations (takes weeks)
3. Document remediations (takes days)
4. Prove to auditor that current state matches policy (uncertain)

NixOS + Weaver audit:
1. Show the auditor the Nix config (git repo)
2. Running state = declared state, by construction
3. Done

**This alone can save 2-4 weeks of audit preparation per year** — time IT can spend on actual security improvements instead of proving they did the basics.

**Host configuration transparency.** The Host Configuration Viewer exposes the running NixOS `configuration.nix` read-only in the Weaver UI — workloads categorized by type (MicroVMs, OCI containers, Slurm nodes, infrastructure). Every authenticated user can see exactly what the host is running. No SSH required, no guesswork.

### The Math

An fabrick with 30 nodes, 2 compliance analysts ($90K/yr each) spending 40% of their time on infrastructure compliance evidence = **$72,000/yr** in compliance labor. Weaver at 30 nodes ($26,500/yr) with Accelerate success program ($45,000/yr standard) = **$71,500/yr** total, redirecting compliance staff to higher-value work.

---

### Fabrick and Contract Tiers

For organizations with large memory footprints:

| Tier | Price | RAM Coverage |
|------|:-----:|-------------|
| **Fabrick** | $2,000/yr first node, $1,250/yr additional (2–4), $1,000/yr (5–9), $750/yr at 10+ | Up to 256GB RAM per node |
| **Fabrick** | $2,500/yr per node | Up to 512GB RAM per node |
| **Contract** | Sliding scale per 512GB block | Above 512GB RAM — cloud or self-hosted |

**Contract tier block pricing (above 512GB RAM):**

| Block | Price per 512GB block/yr |
|-------|:------------------------:|
| Block 1 | $2,000 |
| Blocks 2–3 | $1,750 each |
| Blocks 4–7 | $1,500 each |
| Block 8+ | $1,250 each |

Contract tier applies to both cloud-hosted and self-hosted deployments above 512GB RAM and requires a signed contract. This tier serves AI/HPC nodes, large memory databases, and high-density virtualization hosts where Weaver licensing is a rounding error against hardware and compute costs.

---

### Parallel Migration ROI

Unlike lift-and-shift migrations, Weaver runs alongside existing infrastructure:

| Migration Type | Cost | Timeline |
|---------------|:----:|:--------:|
| VMware → Proxmox | $50,000–$200,000 | 3–12 months |
| VMware → Cloud | $100,000–$500,000+ | 6–18 months |
| **Weaver (parallel migration)** | **$5,000–$20,000** | **1–3 months** |

No cutover event. Migrate one workload at a time. Existing tools keep running. The migration services fee covers the transition; ongoing licensing is per-node.

---

## 5. Fabrick Success Programs: The Focus Multiplier {#5-success-programs}

The real unlock at Fabrick isn't just features — it's offloading infrastructure knowledge burden to the Weaver team.

| Program | Standard Price | FM Price | What IT Stops Doing |
|---------|:-------------:|:--------:|---------------------|
| **Adopt** | $15,000/yr | $5,000/yr | Fumbling through NixOS learning curve — onboarding playbook provided |
| **Accelerate** | $45,000/yr | $15,000/yr | Mapping infrastructure controls to compliance frameworks — we do the mapping. Quarterly architecture reviews — we drive fleet optimization |
| **Partner** | $90,000/yr | $30,000/yr | Infrastructure architecture planning — named engineer handles it. Roadmap prioritization — your needs influence the product |

### Professional Services (One-Time)

| Service | What IT Stops Doing | Price |
|---------|---------------------|:-----:|
| **Migration** (Proxmox/VMware/libvirt) | Multi-month migration project planning and execution | $5,000-20,000 |
| **Fleet Architecture Design** | Infrastructure topology decisions and documentation | $2,000-5,000/day |
| **NixOS Adoption Training** | Internal training program development and delivery | $3,000-5,000/cohort |
| **Custom Plugin Development** | In-house feature development for niche requirements | $5,000-15,000 |

---

## 6. Industry-Specific Applications {#6-industry-specific}

The core value proposition applies universally. Industry-specific documents detail regulatory mapping and buyer personas for each vertical:

| Industry | Primary Regulations | Key Buyer Pain | Sales Doc |
|----------|--------------------|--------------------|-----------|
| **Healthcare** | HIPAA, HITECH, 42 CFR Part 2, Joint Commission, FDA Device Cybersecurity, ONC/Cures Act | PHI protection + audit burden + BAA management + medical device isolation | [healthcare.md](verticals/healthcare.md) |
| **Defense Contractors** | CMMC 2.0, NIST 800-171, DFARS 252.204-7012, ITAR/EAR, FedRAMP | CUI protection + CMMC assessment readiness + air-gap requirements | [defense-contractor.md](verticals/defense-contractor.md) |
| **Financial Services** | SOX, PCI DSS, GLBA, FFIEC, Basel III ORM | Transaction integrity + examiner evidence + vendor risk | [financial-services.md](verticals/financial-services.md) |
| **Pharma / Life Sciences** | 21 CFR Part 11, GxP (GMP/GLP/GCP), ALCOA+, EU GMP Annex 11, DEA EPCS | Electronic records integrity + validation lifecycle + data integrity | [pharma-life-sciences.md](verticals/pharma-life-sciences.md) |
| **Government / Public Sector** | FedRAMP, FISMA, NIST 800-53, CMMC | Accreditation evidence + air-gap requirements + supply chain | [government.md](verticals/government.md) |
| **Education** | FERPA, state privacy laws, CIPA, COPPA, E-Rate | Student data protection + budget constraints + legacy infrastructure + one-person IT teams | [education.md](verticals/education.md) |
| **Manufacturing / IT** | IEC 62443, NIST CSF, ISO 27001 | IT/OT convergence + edge deployment + uptime requirements | [manufacturing.md](verticals/manufacturing.md) |
| **Manufacturing / OT (Industrial)** | IEC 62443, NERC CIP, ISA/IEC 62443-3-3, NIST 800-82 | SCADA/ICS isolation + air-gap + uptime + OT/IT network segmentation | [manufacturing-ot.md](verticals/manufacturing-ot.md) |
| **MSP / IT Consulting** | SOC 2, client-inherited compliance (HIPAA, PCI, CMMC, SOX, FERPA), cyber insurance, state breach notification | Multi-client management + compliance evidence at scale + tribal knowledge loss + VMware cost across client base | [msp.md](verticals/msp.md) |
| **Research / HPC** | NIH DMS, NSF DMP, NIST 800-171, ITAR/EAR, IRB, journal reproducibility mandates | Apptainer management + computational reproducibility + GPU governance + multi-compliance-regime isolation | [research-hpc.md](verticals/research-hpc.md) |
| **AI Inference** | HIPAA, NIST 800-53/171, CMMC, 21 CFR Part 11, GDPR, EU AI Act | GPU passthrough (VFIO-PCI) + NixOS reproducible model environments + bridge-as-inference-LB + blue/green model deployment + edge AI fleet management. Self-hosted inference without the Kubernetes tax | [AI-INFERENCE-VALUE-PROPOSITION.md](AI-INFERENCE-VALUE-PROPOSITION.md) |
| **Kubernetes Competitive** | All frameworks (cross-cutting) | Microservices without K8s — bridge convergence (3 K8s components → 1), platform team elimination, per-industry compliance gap analysis, incremental K8s-to-Fabrick migration | [KUBERNETES-COMPETITIVE-POSITIONING.md](KUBERNETES-COMPETITIVE-POSITIONING.md) |
| **Open-Source Projects** | Supply chain security, community trust, sponsor accountability | Build farm management (Hydra/Koji/buildd) + burst capacity + GPU builder economics + volunteer time reclamation | [opensource-support.md](verticals/opensource-support.md) |
| **DNS Security** | HIPAA § 164.312(b), CMMC AC.3.022, PCI-DSS Req 1.3, SOC 2 CC6.1, NIST SP 800-53 SC-20 | VM fleet DNS auto-zone + LAN-wide ad blocking + compliance audit logging vs Infoblox $12K+ | [dns-security.md](verticals/dns-security.md) |
| **Telecommunications** | CALEA (47 U.S.C. §1001–1010), CPNI (47 CFR §222), FCC Cybersecurity/NIST CSF, PCI-DSS, SOC 2, NIST SP 800-53 | NFV platform replacement (vs VMware/OpenStack) + CALEA hardware isolation + distributed PoP fleet management + 5G edge | [telecommunications.md](verticals/telecommunications.md) |
| **Energy & Utilities** | NERC CIP (mandatory, $1M+/day fines), TSA Security Directives (pipeline), AWIA 2018 (water), IEC 62443, NIST SP 800-82, NIST CSF | CIP-010 baseline compliance by construction + ESP boundary enforcement + substation fleet management + zero-drift for BES Cyber Systems | [energy-utilities.md](verticals/energy-utilities.md) |
| **Nuclear Power** *(deferred)* | 10 CFR 73.54 (NRC), NEI 08-09, IAEA NSS 17; fusion: no commercial regulation yet | Non-safety compute + IT/OT DMZ + onsite-only AI model (no cloud egress from plant boundary) + fission now / fusion future arc | [deferred/nuclear-power.md](verticals/deferred/nuclear-power.md) |
| **State & Local Government** *(deferred)* | CJIS Security Policy, state privacy laws, CIS Controls v8, NIST CSF, SLCGP grant eligibility | Small-team municipal IT + CJIS access control/audit trail + SLCGP grant procurement lever | [deferred/state-local-government.md](verticals/deferred/state-local-government.md) |

**Program Documents** (not verticals — cross-cutting sales resources):

| Document | Purpose | Sales Doc |
|----------|---------|-----------|
| **Founding Member Program** | FM pricing, quantity caps, grandfathering terms, Champion Credit, Design Partner terms | [FOUNDING-MEMBER-PROGRAM.md](FOUNDING-MEMBER-PROGRAM.md) |
| **Migration Guide** | Migration helpers by source system (Proxmox, VMware, Docker, Podman, LDAP/AD), access control migration, fleet enrollment | [MIGRATION-GUIDE.md](MIGRATION-GUIDE.md) |

---

## 7. Competitive Positioning Summary {#7-competitive-positioning}

### Why Customers Switch to Weaver

| Switching From | Cost They Escape | What They Gain | Our Tier |
|---------------|:----------------:|----------------|:--------:|
| **VMware/vCenter** | $5,000-50,000+/yr (Broadcom pricing) | Zero drift, declarative audit, 5 hypervisors, 90%+ cost savings | Fabrick |
| **Proxmox** | EUR355-1,060/yr/socket | Modern UI, Live Provisioning, AI diagnostics, NixOS reproducibility | Weaver |
| **Manual (SSH + scripts)** | Staff time + error risk | Workload management, automation, audit trail, AI diagnostics | Weaver |
| **Cloud VMs** | $600-6,000+/yr per VM | Self-hosted, no vendor lock-in, sub-second boot, privacy | Weaver/Fabrick |
| **Red Hat Virtualization** | $5,000-15,000/yr (EOL) | Active product, NixOS-native, modern architecture | Fabrick |

**The parallel migration advantage:** Weaver does not require a cutover event. Run it alongside VMware, Proxmox, or bare metal. Migrate one workload at a time. No retraining. No NixOS expertise required from end users or compliance teams.

**Declarative networking, not imperative plumbing.** Weaver's networking is declarative by construction — managed bridges, IP pools, firewall rules, and fleet overlays (VXLAN/WireGuard) are all defined in NixOS configuration. Unlike Proxmox's imperative Open vSwitch or manual iptables, Weaver's network state is always exactly what's declared. Drift is impossible.

### Software Quality Benchmark

FabricK buyers evaluating young software ask the question directly: *"Is this production-ready, or are we beta testers?"* Weaver's answer is published, graded, and repeatable:

| Dimension | Our Approach | Industry Standard | Rating |
|-----------|--------------|-------------------|--------|
| Test coverage | 1,500+ tests across 4 layers (unit, backend, TUI, E2E) | Wide base, narrow top | A |
| Static analysis | 24 custom auditors (forms, routes, SAST, tier parity, license, bundle, doc freshness) + lint + typecheck | 1–2 generic tools | A+ |
| E2E isolation | Docker-containerized, seed data, pre-auth, 5 browsers | Docker or CI-managed | A |
| Tier enforcement | Machine-readable feature matrix + bidirectional code scanning | Manual review or none | A+ |
| Security testing | Custom SAST + supply chain SHA pinning + license audit + OWASP patterns | npm audit or Snyk | A |
| Gate enforcement | Git hooks + CI on every push — unit, backend, TUI, compliance, build in parallel | CI blocks merge | A |
| Reproducibility | Deterministic Docker E2E + `.nvmrc` + lockfile verification | Hermetic CI containers | A |
| **Overall** | | | **A** |

The A+ ratings are the unusual ones: 24 custom static auditors (industry standard is 1–2 generic tools) and a machine-readable tier matrix cross-checked bidirectionally against the codebase on every push. Most fabrick software vendors don't publish this. We do because the numbers are good — and because IT buyers who ask "show me your test coverage" deserve a real answer.

Full benchmark: `code/docs/TESTING-ASSESSMENT.md`. Path from A to A+: `code/docs/TESTING-MATURITY-ROADMAP.md`.

### Why Trust Weaver — Enterprise-Grade Process at Indie Pricing

FabricK buyers pay $50,000+/yr to VMware, $15,000+/yr to Red Hat, for vendors that have documented vulnerability disclosure policies, disaster recovery runbooks, legal review gates before shipping, and architecture documentation designed to survive staff turnover. Weaver has all of it — and charges $2,000/yr.

| What Enterprise Procurement Asks For | What Weaver Has |
|--------------------------------------|----------------|
| **Formal CVD policy with response SLAs** | 48-hour acknowledgment, 7-day critical fix SLA, defined supported versions — `SECURITY.md` |
| **Documented DR / contingency plan** | Backup scope, recovery runbooks, service continuity procedures — `docs/setup/DISASTER-RECOVERY.md` |
| **Controlled release process** | 16-gate release checklist including legal/ToS review gate and insurance carrier touchpoint before features that change the liability surface — `CLAUDE.md` |
| **Architecture documentation for longevity** | 3,150-line Developer Guide: component hierarchy, WebSocket protocol spec, tier parity system, E2E policy — all current — `docs/DEVELOPER-GUIDE.md` |
| **Software quality evidence** | Published testing benchmark: A/A+ against fabrick standards. 24 custom static auditors. Machine-readable tier matrix cross-checked bidirectionally on every push — `docs/TESTING-ASSESSMENT.md` |
| **Security audit evidence** | Red team audit completed — 21 findings, all dispositioned, 4 hardening fixes applied. SAST + supply chain SHA pinning on every push |

Most of this table is populated by large, established vendors — and used to justify their pricing. Weaver built it because the engineering discipline was the right call, not because a sales team asked for a procurement checklist response. The prices stayed indie anyway.

### AI-Era Threat Landscape: Project Glasswing Validation

In April 2026, Anthropic launched **Project Glasswing** — a coalition with AWS, Google, Microsoft, NVIDIA, CrowdStrike, and 40+ other organizations using AI to discover zero-day vulnerabilities at scale. The results were immediate: thousands of zero-day vulnerabilities discovered, including some that survived decades of human code review. Anthropic committed $100M in credits and established a 90-day public disclosure cycle.

**The key quote:** *"AI cyber capabilities at this level will proliferate over the coming months, and not every actor who gets access to them will be focused on defense."*

This changes the security calculus for every infrastructure decision.

**Why shared-kernel architectures are now a documented liability.** Container-only platforms (Docker, Podman, Kubernetes) rely on Linux namespace isolation — all containers share the host kernel. A single kernel zero-day discovered by AI-powered vulnerability hunting compromises every container on the host. Before Glasswing, kernel zero-days were rare enough that shared-kernel isolation was a reasonable trade-off. When AI discovers thousands of zero-days per cycle, "rare" is no longer operative.

**Weaver's response to this new reality:**

- **Hardware isolation by default.** MicroVMs run separate kernels. A kernel zero-day compromises one workload, not the host and not every peer workload. The blast radius is one VM, not the entire fleet.
- **Hypervisor diversity.** Five hypervisors (QEMU, Cloud Hypervisor, crosvm, kvmtool, Firecracker) mean a hypervisor-specific exploit doesn't cascade across the fleet. Different workloads can run on different hypervisors — defense in depth at the virtualization layer.
- **NixOS declarative patching.** When a Glasswing-disclosed vulnerability triggers a patch, NixOS applies it fleet-wide in one declaration. No drift. No "which hosts are patched?" uncertainty. The 90-day disclosure clock starts, and the fleet is patched before it expires — declaratively, reproducibly, verifiably.
- **Offline-first architecture.** Air-gapped deployments can't phone home for patches. NixOS flake inputs are pinned and cacheable — patches are applied from local cache, not pulled from the internet during an active exploit window.

**Glasswing's 7 practice areas map directly to Weaver capabilities:**

| Glasswing Practice Area | Weaver Capability | Available |
|------------------------|-------------------|:---------:|
| **Vulnerability disclosure** (90-day cycle) | NixOS declarative patching — fleet-wide patch deployment in one commit, reproducible rollback if patch breaks | v1.0 |
| **Software update processes** | NixOS atomic upgrades — `nixos-rebuild switch` is transactional, no partial-update states | v1.0 |
| **Open-source / supply-chain security** | NixOS flake.lock pins every dependency by hash — supply chain is auditable and reproducible | v1.0 |
| **SDLC / secure-by-design** | MicroVM hardware isolation — security boundary is the hypervisor, not a kernel namespace | v1.0 |
| **Standards for regulated industries** | Compliance domain mapping (§4) — HIPAA, PCI-DSS, CMMC, FedRAMP controls satisfied by construction | v1.0 |
| **Triage scaling / automation** | AI diagnostics + notification system — AI-assisted root cause analysis and alerting | v1.0 |
| **Patching automation** | NixOS declarative config — `git commit` the patch, `colmena apply` across the fleet, done | v1.0 (Solo) / v2.3+ (Fabrick fleet) |

**The 90-day disclosure cycle and patch velocity.** Glasswing's 90-day public disclosure window means every disclosed vulnerability becomes a race: patch before the exploit is weaponized. Traditional infrastructure requires scanning each host for the vulnerable package, testing the patch, rolling it out incrementally, and verifying. NixOS collapses this to: update the flake input, rebuild, verify the hash, deploy. The entire fleet reaches the patched state atomically. For Fabrick fleets, `colmena apply` pushes the patched config to every node in parallel.

**Sales line:** *"AI is now discovering thousands of zero-days per quarter. Shared-kernel containers are a documented liability. Hardware isolation isn't optional anymore — it's the new baseline."*

### The One-Liner by Tier

| Tier | The Pitch |
|------|-----------|
| **Free** (up to 32GB RAM) | "See what you already have — dashboard for existing VMs" |
| **Weaver Solo** (up to 128GB RAM) | "Stop babysitting infrastructure — Live Provisioning, AI diagnostics, modern UI for $149/yr (FM)" |
| **Weaver Team** (up to 128GB RAM/host) | "Manage all your hosts in one view — full management across up to 2 remote nodes for $129/user/yr (FM)" |
| **Fabrick** (up to 256GB RAM) | "Turn compliance from a manual audit exercise into a declarative, git-verifiable system — and see your entire fleet, NixOS and non-NixOS, in one map" |
| **Fabrick** (up to 512GB RAM) | "Full Fabrick features for large-memory workloads — $2,500/yr per node" |
| **Contract** (above 512GB RAM) | "Sliding-scale block pricing for AI/HPC nodes — Weaver is a rounding error vs compute costs" |

---

## Using This Document

- **For sales calls:** Lead with Section 1 (the problem), then jump to the tier that matches the buyer (Section 2 or 4)
- **For container/Podman leads:** Lead with Section 1, then Section 3 (Weaver), then convert to Weaver or Fabrick
- **For proposals:** Include the compliance domain mapping (Section 4) and relevant industry doc (Section 6)
- **For pitch decks:** Use the one-liners (Section 7) and ROI math (Sections 2, 4)
- **For RFPs:** Map compliance requirements from Section 4 to the specific framework requested

---

*See also: [BUDGET-AND-ENTITY-PLAN.md](../finance/BUDGET-AND-ENTITY-PLAN.md) Section 9 for how this value proposition integrates with financial planning.*

---

## Recent Changes

- **2026-03-26** — Added Observer node model to Fleet Onboarding subsection: `weaver-observer` (any Linux), Observed vs Managed distinction, 5× headroom rule, compliance boundary. Updated Fabrick one-liner. Added fleet onboarding to compliance domain mapping table (CM-8/A.8.1 baseline) and new "Fleet Onboarding" subsection in Section 4 covering all four discovery paths (Tailscale, CIDR, CSV, cloud scan) with per-vertical topology mapping.
- **2026-04-06** — Decision #142 (Smart Bridges): Weaver Team pricing updated to $199/user/yr standard / $129/user/yr FM. Fabrick 256GB first node updated to $2,000/yr standard / $1,299/yr FM. Fabrick additional nodes now tiered: $1,250/yr (2–4), $1,000/yr (5–9), $750/yr (10+). AI Pro ($99/yr) and AI Fleet ($499/yr/node) extensions retired — Smart Bridges (AI-operated bridge automation) included in base Team and Fabrick pricing. Compliance Export ($4,000/yr) remains the only paid extension. 30-node math recalculated.
- **2026-03-21** — Weaver split into Solo ($149/yr (FM), 1 admin, local only) and Team ($129/user/yr (FM), 2–4 users + 1 viewer free, up to 2 remote peer hosts with full management, ships v2.2.0). ROI math corrected: $7,800/$149 = ~52x (was $99/79x). Weaver Team subsection added covering peer management, Tailscale discovery, host badge, and upgrade trigger.
- **2026-03-18** — Fabrick pricing revised to $2,000/yr first node, $1,250/yr additional (2–4), $1,000/yr (5–9), $750/yr at 10+. Fabrick tier added at $2,500/yr (512GB RAM). Contract tier added for 512GB+ deployments (sliding scale per 512GB block). RAM coverage noted per tier. Parallel migration / no-expertise-required positioning added as primary lead.
