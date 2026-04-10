<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Open-Source Project Support Strategy
## How Weaver Serves Large Open-Source Build Infrastructure
*NixOS/Hydra, Linux Distro Build Farms, CI-Heavy Open-Source Projects*

**Date:** 2026-03-10
**Parent doc:** [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md)
**Related:** [research-hpc.md](research-hpc.md) (Hydra integration details)

---

## Table of Contents

1. [The Open-Source Infrastructure Problem](#1-the-problem)
2. [Target Organizations](#2-target-organizations)
3. [The Economic Case for Hydra Build Farms](#3-hydra-economics)
4. [Beyond Hydra: General Open-Source CI Infrastructure](#4-beyond-hydra)
5. [Sponsorship & Community Licensing Models](#5-sponsorship-models)
6. [Strategic Value of Open-Source Adoption](#6-strategic-value)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Discovery Questions](#9-discovery-questions)

---

## 1. The Open-Source Infrastructure Problem {#1-the-problem}

**No NixOS expertise required — ever.** Weaver runs alongside existing Docker, VMware, Proxmox, or bare-metal tooling. Migrate one workload at a time. No cutover event. No retraining.

Weaver Free tier covers 32GB RAM — adequate for CI/CD runners and dev nodes. Weaver 128GB for active project infrastructure.

Large open-source projects operate build and CI infrastructure that rivals mid-size enterprises — but with a fraction of the budget and staff. The NixOS project alone maintains hundreds of build machines through Hydra to produce binary caches for tens of thousands of packages across multiple architectures. Linux distributions (Fedora/Koji, Debian/buildd, Arch), language ecosystems (crates.io, PyPI builders), and infrastructure projects (Kubernetes test-infra) all face the same challenge:

**What open-source infrastructure teams should be doing:**

- Shipping packages, releases, and security patches faster
- Improving build reproducibility and supply chain security
- Supporting contributors and downstream users
- Reducing time-to-binary-cache for end users

**What they actually spend time doing:**

- Provisioning and reprovisioning build workers manually
- Diagnosing builder failures via SSH and log files
- Managing GPU builders for CUDA/ML packages with no scheduling tools
- Mediating capacity between architecture targets (x86_64, aarch64, cross-compilation)
- Begging sponsors for more donated hardware, then manually onboarding each machine
- Firefighting during staging merges when build queues spike to hours

**Weaver eliminates the infrastructure management layer so build teams focus on packages.**

---

## 2. Target Organizations {#2-target-organizations}

### Tier 1: NixOS Ecosystem (Highest Intent)

| Organization | Infrastructure | Why Weaver Fits |
|-------------|---------------|---------------------------|
| **NixOS Foundation** | Hydra build farm (100+ builders), binary cache (cache.nixos.org) | Already NixOS — zero adoption friction. Hydra workers as managed MicroVMs with burst capacity |
| **Cachix** | Commercial binary cache service; customer build infrastructure | Manages build workers for paying customers — Weaver adds governance, monitoring, burst |
| **Determinate Systems** | FlakeHub, Nix installer, enterprise Nix tooling | NixOS-native infrastructure; potential integration partner |
| **Corporate Nix adopters** (Shopify, Mercury, Anduril, Replit-class) | Private Hydra instances, internal binary caches | Enterprise budgets, compliance requirements, GPU build needs |

### Tier 2: Linux Distribution Build Farms

| Organization | Build System | Pain Point |
|-------------|-------------|------------|
| **Fedora / Red Hat** | Koji | Massive build farm; manual worker management at scale |
| **Debian** | buildd / wanna-build | Distributed volunteer builders; inconsistent hardware; no centralized management |
| **Arch Linux** | devtools / dbscripts | Smaller team, manual infrastructure |
| **openSUSE** | Open Build Service (OBS) | Multi-distro, multi-arch builds; complex worker management |

### Tier 3: Language Ecosystem & Infrastructure Projects

| Organization | Infrastructure Need |
|-------------|-------------------|
| **Rust / crates.io** | CI infrastructure for crate builds, docs.rs rendering |
| **Python / PyPI** | Wheel building infrastructure (manylinux builders) |
| **Kubernetes SIG Testing** | Large-scale test infrastructure (kind clusters, e2e farms) |
| **GitHub Actions self-hosted runners** | Organizations running their own runner fleets |

---

## 3. The Economic Case for Hydra Build Farms {#3-hydra-economics}

### The Cost Structure of a Large Hydra Deployment

A NixOS-scale Hydra farm (100 builders, 8 GPU nodes, multiple architectures) has costs that are largely invisible because they're paid in volunteer time and donated hardware — but they're real:

| Cost Category | Current Reality | With Weaver |
|-------------|----------------|----------------------|
| **Builder admin labor** (1 FTE equivalent, 60% on infra) | ~$60,000/yr (or equivalent volunteer hours) | Reclaim 40%+ → **$24,000/yr freed** for package maintenance |
| **GPU idle cost** (8 nodes at ~20% utilization) | 80% waste on hardware worth $200K+ | Shared scheduling pushes utilization to 60-80% — equivalent to **3-5 fewer GPU nodes (~$60-100K avoided)** |
| **Build queue delays** (nixpkgs staging merges) | Hours of queued builds → delayed security patches reaching users | Burst workers absorb spikes; critical builds (security, release-blocking) get priority scheduling |
| **Builder failure recovery** | SSH in, diagnose, reprovision manually; builds stalled meanwhile | AI diagnostics + zero-drift reprovisioning = minutes not hours |
| **Donated hardware onboarding** | Each donated machine requires manual NixOS install, Hydra registration, testing | Live Provisioning template: declare the builder spec, point at the hardware, done |
| **Architecture management** (x86_64, aarch64, cross-compilation) | Separate builder pools, manually balanced | Weaver shows utilization per architecture; resource quotas balance capacity across targets |
| **Weaver licensing** | N/A | 100 nodes × $149 = **$14,900/yr** (Weaver Solo; community sponsorship at 50% = $7,500/yr) |

**Bottom line:** $14,900/yr in Solo licensing eliminates $24K+ in admin labor, avoids $60-100K in GPU hardware, and unblocks security patches that currently queue for hours during staging merges.

> **Note — Weaver Team for small open-source teams:** For open-source projects with 2–4 active infrastructure contributors managing multiple hosts (e.g., primary build host + CI host), Weaver Team ($129/user/yr (FM)) is available. See the [Weaver Team](#premium-team-for-open-source-teams) subsection below.

### Why $149/Node Works for Open Source

The $149/yr (FM) per node Weaver price point is deliberately accessible for open-source projects:

- **NixOS Foundation budget context:** The Foundation's annual budget is modest. $14,900/yr for 100 nodes is feasible — especially when it demonstrably frees volunteer capacity and reduces hardware sponsor asks (community sponsorship pricing at 50% off brings this to $7,500/yr)
- **Corporate sponsor pass-through:** Companies sponsoring NixOS build infrastructure (e.g., Hetzner, AWS credits) can add Weaver licensing as a line item — negligible vs the hardware donation
- **Per-node simplicity:** No per-build, per-user, or per-evaluation pricing surprises. Fixed annual cost regardless of how hard the farm works

### Weaver Team for Open-Source Teams {#premium-team-for-open-source-teams}

Small open-source projects often run more than one Weaver host — a primary development/staging host and a dedicated CI/build host, or a primary host plus a mirror for a geographically distributed team. Weaver Solo covers one admin on one host. Weaver Team ($129/user/yr (FM), 2–4 users + 1 viewer free, ships v2.2.0) adds:

- Multi-user access on the same host (2–4 team members, each with their own login)
- Full remote management of up to 2 additional Weaver hosts (e.g., the CI host or a contributor's mirror)
- Peer discovery via Tailscale MagicDNS or manual IP entry

**Scenario:** A small open-source project runs a primary Weaver host for development and a separate CI build host. Two core contributors hold Weaver Team licenses. From either contributor's Weaver view, they can see both hosts — is the CI build VM running? Is the build host's CPU saturated? — without needing to SSH in or open a separate browser tab. Management actions on the remote CI host are fully available from the primary view. Upgrading to Fabrick is needed when the team exceeds the 2-peer cap or needs fleet-scale governance.

**Economics:** For a 3-contributor team: 3 × $129/user/yr (FM) = $387/yr. Community sponsorship pricing (50% off for qualifying non-profits) brings this to $193.50/yr for a 3-person team — less than one Solo license.

---

## 4. Beyond Hydra: General Open-Source CI Infrastructure {#4-beyond-hydra}

### Self-Hosted CI Runner Farms

Any organization running self-hosted CI runners (GitHub Actions, GitLab CI, Buildkite, Jenkins) at scale faces the same economics:

| Pain | Weaver Solution |
|------|---------------------------|
| Runners provisioned manually or with bespoke automation | Live Provisioning from declared templates — ephemeral or persistent runners |
| Runner contamination (state leaks between jobs) | Firecracker-based ephemeral runners: boot in <125ms, run the job, destroy. Zero contamination by construction |
| GPU runners expensive and underutilized | Resource quotas share GPU hardware across runner pools; dashboard shows utilization |
| No visibility into runner fleet health | Weaver monitoring across all runners — CPU, memory, disk, GPU, uptime |
| Runner scaling is manual or requires custom auto-scaling infrastructure | Burst capacity built into the platform — no custom Lambda/CloudWatch/ASG plumbing |

### Supply Chain Security Angle

Post-SolarWinds, post-xz, build infrastructure security is a board-level concern for major open-source projects. Weaver contributes:

- **Isolated build environments:** Each builder is a MicroVM with its own network segment — a compromised builder can't lateral-move to others
- **Zero drift:** Builders are declarative — no accumulated state for an attacker to hide in. Reprovisioning from the declared spec is routine, not exceptional
- **Audit trail:** Every infrastructure change is a git commit — who changed the builder config, when, why. Tamper-evident by construction
- **Managed bridges:** Build workers handling security-sensitive packages (crypto, auth, kernel) can run on isolated network segments

#### Kubernetes Complexity in CI Infrastructure

Large open-source projects running self-hosted CI on Kubernetes face a paradox: K8s was designed for long-running services, not ephemeral build jobs. CI runners on K8s require custom operators (actions-runner-controller, GitLab Runner Operator), pod security policies for build isolation, and persistent volume management for build caches. The result is a K8s cluster dedicated to CI that requires its own platform team — infrastructure overhead that open-source projects with volunteer maintainers cannot sustain.

| K8s Overhead | Impact on CI Infrastructure | Weaver Alternative |
|---|---|---|
| Custom operators for runner lifecycle (actions-runner-controller, etc.) | Each CI platform requires a separate operator with its own CRDs, upgrade cycle, and failure modes | Live Provisioning from templates — ephemeral Firecracker runners boot in <125ms, run the job, destroy. No operator |
| Shared kernel between CI jobs (namespace isolation only) | Build contamination across jobs; a compromised dependency in one build can affect co-resident builds | Each build runs in its own MicroVM with a hardware boundary — zero contamination by construction |
| GPU runner management (device plugin + resource limits + node affinity) | GPU CI builds (CUDA packages, ML model tests) require K8s device plugin chain; underutilized GPUs between builds | GPU passthrough with resource quotas; dashboard shows utilization; GPU shared across build and interactive workloads |

Full competitive reference: [KUBERNETES-COMPETITIVE-POSITIONING.md](../KUBERNETES-COMPETITIVE-POSITIONING.md)

---

## 5. Sponsorship & Community Licensing Models {#5-sponsorship-models}

### Model 1: Free Tier for Qualifying Open-Source Projects

**Criteria:** Non-profit foundation, public build infrastructure, open-source output
**Offer:** Free Community tier (up to 32GB RAM per node, already free) + discounted Weaver at $75/node/yr (50% off)
**Example:** NixOS Foundation gets 100 nodes at $7,500/yr instead of $14,900

**Business rationale:**
- NixOS community adoption creates organic word-of-mouth to every NixOS user (our highest-intent market)
- "Powered by Weaver" on cache.nixos.org build status = permanent visibility to the entire Nix ecosystem
- Foundation blog post / NixCon talk about the migration = credibility that money can't buy

### Model 2: Corporate Sponsor Licensing

**How it works:** A corporate sponsor (e.g., Hetzner, AWS, Shopify) funds Weaver licensing for an open-source project as part of their existing sponsorship
**Pricing:** Standard Weaver ($149/node) or Fabrick ($2,000+$750/node) — billed to the sponsor
**Value to sponsor:** Tax-deductible contribution; visible support; their engineers benefit from faster builds

### Model 3: In-Kind Infrastructure Partnership

**How it works:** Weaver provides free or deeply discounted licensing in exchange for:
- Logo placement on the project's infrastructure status page
- Case study / testimonial for marketing
- Conference talk at NixCon, FOSDEM, or similar
- Feedback loop on HPC/build-farm-specific features

**This is not charity — it's customer development.** Open-source build farms are the most demanding, highest-visibility use case for Weaver. If we can manage Hydra's build farm well, we can manage anything. The case study writes itself.

---

## 6. Strategic Value of Open-Source Adoption {#6-strategic-value}

### Why NixOS Foundation Adoption Is a Force Multiplier

```
NixOS Foundation uses Weaver for Hydra
    → Every NixOS user sees "built by Weaver-managed infrastructure"
    → NixOS sysadmins (our core market) adopt for their own infrastructure
    → Corporate NixOS adopters see foundation endorsement → Enterprise sales
    → NixCon talks, blog posts, community trust = organic marketing
```

### The Halo Effect

| Adoption | Downstream Impact |
|----------|------------------|
| NixOS Hydra farm | Every `nix-shell` user benefits; community awareness |
| Cachix build infrastructure | Every Cachix customer (commercial Nix users) sees the value |
| Corporate Nix adopter (Shopify-class) | FabricK reference customer; validates Weaver/Fabrick tiers |
| Linux distro build farm (Fedora/Koji) | Cross-ecosystem credibility; "not just a NixOS tool" positioning |

### Community Goodwill as Marketing

The NixOS community is tight-knit and vocal. Supporting the project's infrastructure creates genuine goodwill that translates directly to:

- **Discourse/Matrix recommendations:** "We use Weaver for Hydra, it's great" from Foundation infrastructure team members
- **Conference visibility:** NixCon, FOSDEM NixOS devroom, SCaLE — talks about build infrastructure improvements
- **Blog posts:** Foundation blog, community blogs, planet.nixos.org syndication
- **Package inclusion:** Potential NixOS package / module for Weaver agent — makes installation trivial for every NixOS user

This is marketing that money literally cannot buy — it has to be earned by actually serving the community well.

### AI-Era Threat Landscape Advantage

Anthropic's Project Glasswing (April 2026) demonstrated that frontier AI can discover **thousands of zero-day vulnerabilities** — including some that survived decades of human review — across every major operating system and browser. These capabilities will proliferate to attackers.

**Why this changes the calculus for open-source infrastructure:**

- **Shared-kernel = fleet-wide compromise.** A single kernel zero-day — exactly the kind AI is now finding by the thousands — compromises every Docker container on the host simultaneously. On a shared build farm, that means every builder, every binary cache artifact, and every signing key on the host is exposed. Weaver's hardware boundary per MicroVM contains the blast radius to one builder.
- **Patch at the speed of AI discovery.** Glasswing directly funds open-source security — $2.5M to Alpha-Omega/OpenSSF, $1.5M to Apache Software Foundation — accelerating the rate at which vulnerabilities are found in the very packages these build farms produce. NixOS's `flake.lock` pins every dependency by hash. Pin the fix, rebuild, deploy via Colmena — every builder converges deterministically. nixpkgs maintainers participating in these OpenSSF programs benefit from the same supply-chain tooling Weaver leverages.
- **Supply-chain verifiability.** Glasswing explicitly targets open-source and supply-chain security — the exact domain these projects operate in. NixOS's content-addressed store makes the entire supply chain formally verifiable. Open-source projects hosting build infrastructure on Weaver benefit from the same supply-chain verifiability that Glasswing recommends as a baseline defense. Post-xz, this is not theoretical — it is the community's most pressing infrastructure concern.
- **Hypervisor diversity.** Weaver's 5 hypervisor options mean a vulnerability in one doesn't cascade to workloads on another — defense-in-depth for build farms where a single compromised builder could inject malicious artifacts into thousands of downstream packages.

---

## 7. Objection Handling {#7-objection-handling}

### "We can't spend money — we're a non-profit / volunteer-run"

That's exactly why the economics matter. At $149/node, the licensing costs less than the volunteer hours you'll save in the first month. If budget is genuinely zero, we offer community sponsorship pricing (Model 1) or can work with your corporate sponsors to include licensing in their donation (Model 2). We want this to be a net positive for your project's budget, not a burden.

### "We've built our own provisioning automation — it works fine"

How much time does your infrastructure team spend maintaining that automation? When a builder fails at 2 AM during a staging merge, how long until it's back? Weaver replaces bespoke scripts with a maintained product — your automation engineers can work on packages instead of infrastructure tooling. And you get burst capacity, GPU scheduling, and monitoring that your scripts don't provide.

### "Why would we pay for infrastructure management when our infrastructure is donated?"

The hardware is donated; the human time to manage it is not. Every hour a volunteer spends reprovisioning a builder or diagnosing a failure is an hour not spent on package maintenance, security patches, or reviewer support. $149/node/yr buys back volunteer capacity — which is your scarcest resource.

### "We need to run on heterogeneous donated hardware — can you handle that?"

Yes. Weaver manages whatever hardware you point it at. Each node gets a declarative config appropriate to its capabilities — a donated 64-core Epyc gets a different builder template than a donated 8-core Xeon. Live Provisioning templates adapt to the hardware; the dashboard provides a unified view regardless of heterogeneity.

### "We're worried about vendor lock-in for critical infrastructure"

Weaver manages NixOS MicroVMs — your builder configs are standard NixOS declarations. If you ever stop using the dashboard, your NixOS configs still work. The dashboard is a management layer, not a proprietary runtime. Your infrastructure is NixOS all the way down.

### "Our build infrastructure needs to be transparent and auditable by the community"

Weaver's declarative config lives in git — it's as transparent as you make it. The audit trail (who changed what builder config, when, why) is git history. This actually *improves* transparency vs the current state where builder provisioning is tribal knowledge held by a few infrastructure volunteers.

### "The community will scrutinize this tool's own supply chain and security practices — we need to be able to defend using it"

Fair question — and the right one to ask post-xz. Weaver's own engineering practices are public and verifiable: SAST with OWASP patterns on every push, supply chain SHA pinning on all 40 GitHub Actions, license audit on every build, 24 custom static auditors, and a published testing benchmark scored A/A+ against fabrick standards (`docs/TESTING-ASSESSMENT.md`). CVD policy with 48-hour acknowledgment and 7-day critical fix SLAs — `SECURITY.md`. The irony of build infrastructure that can't account for its own supply chain is not lost on the community. Weaver can. The open-core codebase is auditable by anyone who wants to look.

---

## 8. Buyer Personas {#8-buyer-personas}

### NixOS Foundation Infrastructure Team

**Cares about:** Build throughput, volunteer time efficiency, binary cache freshness, community trust, budget constraints
**Lead with:** Hydra builder management eliminates manual provisioning. Burst capacity during staging merges. GPU builder sharing. $149/node (or $75/node with community sponsorship pricing) is feasible within Foundation budget — or sponsor-fundable. "You're already NixOS; this is the management layer Hydra is missing."
**Tier:** Weaver (community sponsorship pricing) or sponsor-funded Fabrick
**Decision maker:** Infrastructure team lead + Foundation board for budget approval

### Corporate Nix Adopter (DevOps/Platform Engineering)

**Cares about:** Build speed, developer productivity, compliance (SOC 2, HIPAA if applicable), cost vs cloud CI
**Lead with:** Private Hydra/binary cache with managed builders. Fabrick RBAC for multi-team access. Declarative audit trail for compliance. Fixed annual cost vs per-minute cloud CI pricing. GPU builders for ML model training pipelines.
**Tier:** Fabrick + Adopt or Accelerate success program
**Decision maker:** VP Engineering or Head of Platform Engineering

### Open-Source Infrastructure Volunteer

**Cares about:** Reducing personal toil, making infrastructure maintainable by others, not being a single point of failure
**Lead with:** Declarative builder management means anyone on the team can provision, monitor, and recover builders — not just the one person who knows the SSH commands. Weaver visibility replaces tribal knowledge. Your infra becomes a team capability, not a bus-factor-one dependency.
**Tier:** Weaver
**Note:** Infrastructure volunteers are the strongest internal champions. They experience the pain daily and will advocate to foundation leadership for anything that reduces it.

### Hardware Sponsor Representative

**Cares about:** Visibility for their donation, efficient use of donated resources, measurable impact
**Lead with:** Weaver shows real-time utilization of their donated hardware — they can see their investment working. GPU scheduling ensures their donated GPUs aren't sitting idle. Case study opportunity: "[Sponsor] hardware, managed by Weaver, builds the packages that power NixOS."
**Tier:** Sponsor funds Weaver or Fabrick licensing as part of their donation
**Decision maker:** Developer relations / open-source program office

---

## 9. Discovery Questions {#9-discovery-questions}

### Infrastructure Pain

- How many build workers does your Hydra/CI farm maintain? How are they provisioned today?
- What happens when a builder fails during a critical build evaluation? How long until it's recovered?
- How do you handle build queue spikes (staging merges, mass rebuilds, security patches)?
- How many people on your team can provision a new builder from scratch? Is that documented?
- Do you have GPU builders? How is GPU time allocated between CUDA package builds and other uses?

### Capacity & Economics

- How much of your infrastructure team's time goes to builder management vs package/release work?
- How do you onboard donated hardware? How long from "server arrives" to "builder producing packages"?
- Have you estimated the volunteer-hour cost of your current infrastructure management approach?
- Are build queues ever the bottleneck for shipping security patches to users?

### Supply Chain & Trust

- How do you ensure build environment integrity across your builder fleet?
- Is builder configuration documented and version-controlled, or is it tribal knowledge?
- How would you detect if a builder had been tampered with?
- Do different package categories (crypto, auth, kernel) build on isolated infrastructure?

### Strategic

- Has your project considered the supply chain security implications of build infrastructure management?
- Would community sponsorship pricing (discounted licensing for qualifying open-source projects) be interesting to your Foundation/governance body?
- Are any of your corporate sponsors interested in funding infrastructure tooling as part of their contribution?
- Would a case study or conference talk about your infrastructure improvements be valuable for your project's visibility?
- "If a frontier AI discovered a zero-day in your host kernel tomorrow — which Project Glasswing has demonstrated is now routine — how many builders and binary cache artifacts would be compromised simultaneously?"
- "Glasswing's 90-day public disclosure cycle means vulnerabilities found in your stack become public knowledge. Can your current build infrastructure prove it's patched faster than the disclosure window?"

---

*This document complements the Hydra-specific sections in [research-hpc.md](research-hpc.md) and the universal value proposition in [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md). For pricing details, see [TIER-MANAGEMENT.md](../../product/TIER-MANAGEMENT.md).*

---

## Recent Changes

- **2026-03-21** — Weaver Solo/Team split: Hydra economics table note clarifies $14,900/yr calculation is Weaver Solo; added cross-reference to Weaver Team subsection. Added "Weaver Team for Open-Source Teams" subsection covering multi-contributor + multi-host scenarios (2–4 users, 2-peer monitoring, ships v2.2.0). Community sponsorship pricing for Team noted.
- **2026-03-18** — Fabrick pricing revised to $2,000/yr first node, $750/yr additional, $500/yr at 10+. Fabrick tier added at $2,500/yr (512GB RAM). Contract tier added for 512GB+ deployments (sliding scale per 512GB block). RAM coverage noted per tier. Parallel migration / no-expertise-required positioning added as primary lead.
