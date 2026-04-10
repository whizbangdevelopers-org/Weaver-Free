<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver — Business & Marketing Analysis

**Last updated:** 2026-03-27

**Recent Changes:** 2026-03-18 — Fabrick repriced $799→$1,500/yr first node ($750/yr add'l, $500/yr at 10+, Decisions #63); Fabrick tier added ($2,500/yr, 512GB RAM/node, Decision #64); Contract tier added above 512GB (sliding-scale 512GB blocks, Decision #65); RAM-based license unit adopted (Decision #62); NixOS company count updated 293→466; Sysop-as-Champion segment (E) added; Bottom-Up GTM Motion section added; revenue projections updated. See [TIER-MANAGEMENT.md](TIER-MANAGEMENT.md) for full tier matrix.

---

## Executive Summary

Weaver sits at the intersection of three growing markets: the VMware exodus ($70B+ market in flux), the NixOS/declarative infrastructure wave (~466 companies in production, 23k+ GitHub stars), and the homelab/self-hosting boom ($15.6B market growing at 18.5% CAGR). The product occupies a unique niche — no other tool provides a web UI for NixOS-native declarative VM management — and the template system + Live Provisioning creates features no competitor has.

The model is **open core + SaaS**: a free open-source self-hosted edition (Weaver repo), Weaver ($149/yr) and Fabrick ($1,500/yr first node) self-hosted tiers, and a future hosted SaaS offering. This mirrors successful infrastructure companies like Grafana ($270M ARR, $6B valuation), Portainer (650k+ users), and Netdata (1.5M+ daily downloads). See [TIER-MANAGEMENT.md](TIER-MANAGEMENT.md) for the current tier matrix.

---

## Market Opportunity

### 1. The VMware Exodus (Immediate Tailwind)

Broadcom's acquisition of VMware has triggered the largest virtualization migration in a decade:

- **50% of enterprises** will initiate POCs for VMware alternatives by 2026 (Gartner)
- **70% of enterprise customers** will migrate 50% of virtual workloads by 2028 (Gartner)
- **47% of VMware customers** actively evaluating alternatives (Civo 2024 survey)
- **VMware market share** projected to drop from 70% (2024) to 40% (2029)
- Price increases of 350–1,050% reported (AT&T: up to 1,050%)

**Proxmox is the primary beneficiary**: 1.5M+ hosts deployed, 650% growth over 7 years, 16.1% global mindshare (up from ~10% in 2023). But Proxmox requires Debian and imperative management — there's no NixOS option in this migration wave.

**Weaver opportunity**: Capture the subset of organizations that are both leaving VMware *and* adopting NixOS for infrastructure management. This is a small but high-value niche today that grows as NixOS adoption increases.

### 2. NixOS Adoption (Growing Foundation)

NixOS is transitioning from hobby project to production infrastructure:

- **~466 companies** using NixOS in production (up from ~293 in early 2026)
- **nixpkgs**: 23.2k GitHub stars, 4,560 contributors, 120k+ packages, 350k+ builds/week
- **Industries**: Software (17%), IT Services (14%), Financial Services (9%), Internet (7%)
- **Company sizes**: 31% small (<50), 26% medium, 31% large (>1000 employees)
- **Geography**: 31% US, strong European presence

The NixOS ecosystem lacks GUI tooling. Most NixOS infrastructure is managed via terminal. This creates an opening for tools that make NixOS accessible to non-expert users within organizations.

### 3. Infrastructure as Code Market (Secular Trend)

- **2025 market size**: $1.6B
- **CAGR**: 23.7–27.4%
- **2034 projection**: $2.3–9.4B (varies by research firm)
- **Enterprise adoption**: 96% of organizations increased or maintained IaC use in 2025

Weaver's Live Provisioning and Nix code generation are IaC tools — they just output Nix instead of Terraform/Pulumi. This positions the product within the broader IaC market, not just the virtualization market.

### 4. Homelab & Self-Hosting (Community Flywheel)

- **r/homelab**: 903k members (3.6x growth in 6 years)
- **r/selfhosted**: 136k+ members (62% growth in 1 year)
- **Self-hosting market**: $15.6B (2024) → $85.2B projected (2034), 18.5% CAGR
- **Homelab market**: $6.8B (2025) → $13.4B projected (2035)
- **OS preference**: 81% of self-hosters run Linux
- **Professional crossover**: 81% of self-hosters work in tech professionally (selfh.st 2025 survey) — the homelab community IS the sysadmin community
- **Workload distribution**: 98.3% of self-hosters run containers; a growing fraction run VMs or both

Self-hosters are the early adopters and evangelists. They discover tools, blog about them, create YouTube content, and recommend them to their employers. A free tier that serves this community creates organic marketing. More importantly, 81% of this audience are professional sysadmins — a $149 Weaver home-lab evaluation is the entry point to an fabrick contract.

---

## Target Segments

### Segment A: NixOS Homelab Users

| Attribute | Detail |
|---|---|
| **Size** | ~5,000–15,000 individuals (estimated from NixOS survey + homelab overlap) |
| **Profile** | Technical, Linux-experienced, values declarative config, runs 1–3 machines |
| **Willingness to pay** | $0–10/month for convenience, prefers self-hosting |
| **Value proposition** | "See and control your microVMs without memorizing systemctl commands" |
| **Acquisition** | r/NixOS, r/homelab, NixOS Discourse, YouTube, blog posts |
| **Role** | Evangelists and community builders — low revenue, high marketing value |

### Segment B: Small Teams & Startups Using NixOS

| Attribute | Detail |
|---|---|
| **Size** | ~500–2,000 teams (estimated from 466 NixOS companies, subset using VMs) |
| **Profile** | 2–20 developers, NixOS in CI/dev/production, needs collaboration features |
| **Willingness to pay** | $50–200/month for team features and hosted service |
| **Value proposition** | "Team VM management with audit trail, templates, and no Nix expertise required" |
| **Acquisition** | NixOS Discourse, GitHub, NixCon talks, tech blog content |
| **Role** | Core paying customers — sustainable revenue |

### Segment C: Enterprises Adopting NixOS

| Attribute | Detail |
|---|---|
| **Size** | ~50–200 organizations (31% of NixOS companies are >1000 employees) |
| **Profile** | Large org, NixOS in production, compliance/audit requirements, multiple hosts |
| **Willingness to pay** | $500–2,000/month for fabrick features and support |
| **Value proposition** | "Declarative VM management with compliance, multi-host, and SSO" |
| **Acquisition** | Direct outreach, NixCon sponsorship, case studies, partner channels |
| **Role** | High-value accounts — primary revenue driver at scale |

### Segment D: VMware Refugees Evaluating NixOS

| Attribute | Detail |
|---|---|
| **Size** | ~1,000–5,000 organizations (subset of 47% evaluating alternatives who consider NixOS) |
| **Profile** | Currently on VMware, exploring alternatives, may not know NixOS yet |
| **Willingness to pay** | High (already paying VMware licensing) |
| **Value proposition** | "Deploy alongside VMware with no cutover risk. Zero drift, declarative audit trail, 90%+ cost reduction." |
| **Acquisition** | SEO ("VMware alternative"), comparison content, migration guides |
| **Role** | Growth opportunity — parallel migration removes the "requires NixOS" barrier |

### Segment E: Sysop-as-Champion (Bottom-Up GTM)

| Attribute | Detail |
|---|---|
| **Size** | Subset of Segments A–D — the individual within any organization who evaluates first |
| **Profile** | Sysadmin or DevOps engineer; runs a home lab; 81% work in tech professionally (selfh.st 2025 survey); evaluates Weaver on personal hardware before recommending to employer |
| **Willingness to pay** | $149/yr out of pocket — frequently a personal professional investment |
| **Value proposition** | "Everything Proxmox charges €355/socket for — plus Live Provisioning, AI diagnostics, and a modern UI. $149/yr. Evaluate it tonight." |
| **Acquisition** | r/homelab, r/selfhosted, r/NixOS, YouTube, personal blogs, word of mouth |
| **Role** | **Primary acquisition channel into Fabrick.** A $149 Weaver purchase that converts to a 10-node Fabrick deployment is a 53× return on acquisition cost. Low friction at the evaluation stage is the highest-leverage pricing decision in the model. |

### Recommended Primary Focus

**Build community with Segment A (homelab), capture Segment E (sysop-as-champion) as the Fabrick acquisition engine, monetize Segment B (small teams) for near-term revenue.**

Rationale: Segment E is the mechanism — the professional sysadmin who evaluates at home and champions internally. This is the bottom-up GTM motion. Segment A creates word-of-mouth and template contributions. Segment B pays directly. Segment C (enterprises) is reached *through* Segment E, not by cold outreach. Segment D (VMware refugees) enters via parallel migration — no NixOS ramp required, just deploy alongside.

This follows the **Grafana playbook**: free open-source tool beloved by individual developers → team/hosted offering → enterprise sales. Grafana went from open source to $270M ARR using exactly this progression.

---

## Product Tiers

> **Canonical tier matrix:** [TIER-MANAGEMENT.md](TIER-MANAGEMENT.md) is the source of truth for the full feature matrix. This section summarizes the tier philosophy and key differentiators.

### Free: Weaver Community Edition (Self-Hosted)

**Repository**: `whizbangdevelopers-org/Weaver-Free` (public)

| Feature | Included |
|---|---|
| VM dashboard (list, status, start/stop/restart) | Yes |
| WebSocket real-time status | Yes |
| CPU/memory metrics per VM | Yes |
| Network topology visualization (read-only) | Yes |
| Distro catalog (browse + create VMs) | Yes |
| AI agent (BYOK — Weaver Free tier only) | Yes |
| Serial console | Yes |
| Logs viewer | Yes |
| Single host | Yes |
| Single user | Yes |
| TUI (terminal dashboard) | Yes |

**Purpose**: Serve Segment A, build community, generate organic marketing. Every feature needed for a single NixOS user managing their own VMs is free.

### Weaver ($149/yr Self-Hosted)

**Repository**: `whizbangdevelopers-org/Weaver-Dev` (private)

| Feature | Weaver Free | Weaver |
|---|---|---|
| All Free features | Yes | Yes |
| Live Provisioning (create/manage VMs without nixos-rebuild) | — | Yes |
| Managed bridges + IP pools | — | Yes |
| Host system info panel | — | Yes |
| Distro catalog mutations (add/remove/custom) | — | Yes |
| DNS plugin (.vm.internal) | — | Yes (v1.1) |
| Firewall presets + custom rules | — | Yes (v1.2) |
| Health probes (TCP/HTTP per VM service) | — | Yes (v1.1) |
| Container visibility (Docker/Podman/Apptainer) | — | Yes (v1.1) |

### Fabrick ($1,500/yr Self-Hosted, 256GB RAM/node)

| Feature | Weaver | Fabrick |
|---|---|---|
| All Weaver features | Yes | Yes |
| Multi-user auth (local + SSO/OIDC) | — | Yes |
| Per-VM RBAC + user quotas | — | Yes |
| Audit log with git integration | — | Yes |
| Firewall zones + drift audit | — | Yes (v1.2) |
| Multi-host management (Colmena) | — | Yes (v2.0) |
| Template versioning + fleet updates | — | Yes (v2.0) |

### SaaS (Future — Post v2.0)

A managed dashboard instance that connects to the user's NixOS host(s) via secure agent. Pricing TBD. See [SaaS Architecture](#saas-architecture) below for technical approach.

### Why This Split Works

The free tier is genuinely useful — it's not crippled. A solo NixOS user gets everything they need. The paid tiers add:

1. **Operational power** (Live Provisioning, managed bridges, DNS, firewall) — Weaver unlocks production workflows
2. **Collaboration + compliance** (multi-user, RBAC, audit log) — Fabrick unlocks team operations
3. **Scale** (multi-host, fleet management) — Fabrick unlocks infrastructure-at-scale
4. **Plugins** bridge the gap between Weaver and Fabrick — extending core features with optional capabilities

This mirrors the splits that work for comparable companies:
- **Grafana**: Free self-hosted → Grafana Cloud (SaaS) → Fabrick
- **Portainer**: Community Edition → Business Edition
- **Netdata**: Free (5 nodes) → Homelab ($90/yr) → Fabrick
- **Proxmox**: All features free → paid support subscriptions

---

## Pricing Strategy

### Benchmarks

| Product | Free Tier | Entry Paid | Mid Tier | Fabrick |
|---|---|---|---|---|
| **Proxmox** | All features | EUR 95/yr/socket (support) | EUR 340/yr/socket | EUR 510/yr/socket |
| **Grafana Cloud** | 10k metrics, 50GB logs | $29/mo (usage-based) | $299/mo | Custom |
| **n8n Cloud** | Self-host free | $20/mo (2.5k executions) | $50/mo (10k exec) | Custom |
| **Portainer** | 3 nodes free | ~$10/node/yr (scaled) | Business tier | Custom |
| **Netdata** | 5 nodes | $90/yr (homelab) | $228/yr (business) | Custom |

### Recommended Pricing (Decisions #33, #63–65)

| Tier | Price | RAM Coverage | Target | Includes |
|---|---|---|---|---|
| **Free** | Free forever | 32GB | Homelab (Segment A/E) | Full single-user, single-host dashboard |
| **Weaver** | $149/yr | 128GB/node | Power users + small teams (Segment A/B/E) | Live Provisioning, managed bridges, DNS, firewall, health probes, container visibility |
| **Fabrick** | $1,500/yr first node · $750/yr add'l · $500/yr at 10+ | 256GB/node | Teams + enterprises (Segment B/C) | Multi-user, RBAC, audit, quotas, multi-host (v2.0), all plugins, fleet management |
| **Fabrick** | $2,500/yr/node | 512GB/node | Memory-intensive workloads, AI/ML | All Fabrick features, 512GB RAM coverage |
| **Contract** | Block pricing above 512GB | 512GB+ sliding scale | AI/HPC, national labs, pharma clusters | Contract-based, per 512GB block, cloud and self-hosted uniform |
| **SaaS** | TBD (post v2.0) | Same tiers | Teams wanting convenience | Managed hosting + all Fabrick features |

Fabrick Success Programs are available as add-ons: Adopt ($15k/yr standard, $5k/yr FM), Accelerate ($45k/yr standard, $15k/yr FM), Partner ($90k/yr standard, $30k/yr FM). See [FABRICK-VALUE-PROPOSITION.md](FABRICK-VALUE-PROPOSITION.md).

### Pricing Rationale

- **$149/yr Weaver** is comparable to Proxmox Basic subscription (EUR 95/yr/socket) but includes features Proxmox doesn't have (Live Provisioning, AI agent, Strands)
- **$1,500/yr Fabrick first node** is competitive against Proxmox Standard (EUR 340–1,060/yr/socket) and far below VMware ($5K+). Raised from $799/yr to avoid "why so cheap?" skepticism at enterprise sales cycles. v1.x customers grandfathered at $799 named rate.
- **Fabrick ($2,500/yr)** covers 512GB RAM — addresses memory-optimized server class (128–512GB enterprise workloads) without contract friction
- **Contract above 512GB** addresses AI/HPC nodes (1TB+) as a rounding error vs cloud costs: a 1.1TB node is $4,500/yr Weaver vs ~$280K/yr AWS equivalent
- **RAM-based license unit** (not VM count) closes the nesting loophole and applies identically to cloud and self-hosted. Agent reads `/proc/meminfo` at host registration.
- **Weaver Free tier** is generous enough that self-hosters never feel pressured — this protects community goodwill and the Segment E acquisition pathway
- **Annual-only pricing** simplifies billing and improves cash flow predictability

---

## SaaS Architecture

### How the Hosted Offering Works

The user doesn't expose their NixOS machine directly. Instead:

```
┌──────────────────┐         ┌─────────────────────────┐
│  User's browser  │ ←─────→ │  Weaver      │
│                  │  HTTPS   │  Cloud (SaaS)           │
└──────────────────┘         │                         │
                             │  - Weaver UI            │
                             │  - Template editor      │
                             │  - AI agent             │
                             │  - User management      │
                             └────────┬────────────────┘
                                      │ Secure tunnel
                                      │ (WireGuard/SSH)
                             ┌────────▼────────────────┐
                             │  User's NixOS host(s)   │
                             │                         │
                             │  weaver-agent │
                             │  (lightweight daemon)    │
                             │                         │
                             │  microvm.nix VMs        │
                             └─────────────────────────┘
```

**Agent model**: A small NixOS-packaged agent runs on the user's host. It:
- Reports VM status to the cloud dashboard
- Receives deployment commands (validated in the cloud)
- Executes `nixos-rebuild` locally (the cloud never has direct sudo)
- Sends metrics (CPU, memory, network) to the dashboard

This is similar to how Grafana Agent, Netdata Agent, and Portainer Edge Agent work.

### NixOS Module for Agent

The agent would be a NixOS module the user adds to their config:

```nix
{
  services.weaver-agent = {
    enable = true;
    cloudUrl = "https://dashboard.microvm.dev";
    apiKey = "sk-..."; # or read from sops-nix secret
  };
}
```

One `nixos-rebuild switch` and they're connected. This is the NixOS-native onboarding experience.

---

## Go-to-Market Strategy

### Phase 1: Community Building (Months 1–6)

**Goal**: 500+ GitHub stars, 50+ active users, community template contributions.

| Action | Channel | Cost |
|---|---|---|
| Launch on r/NixOS, r/homelab, r/selfhosted | Reddit | Weaver Free |
| Submit to NixOS Discourse | Discourse | Weaver Free |
| Write "Why I Built Weaver for microvm.nix" blog post | Personal blog / dev.to | Weaver Free |
| Create demo video (3–5 min) | YouTube | Weaver Free |
| Submit to Hacker News | HN | Weaver Free |
| Present at NixCon (lightning talk) | Conference | Travel cost |
| List on awesome-nix, awesome-selfhosted | GitHub | Weaver Free |
| Publish 3 community templates | GitHub | Weaver Free |

**Content strategy**: Focus on "VMware alternative" and "NixOS VM management" SEO keywords. Every blog post targets one of these search intents:
- "How to manage VMs on NixOS"
- "microvm.nix tutorial"
- "Proxmox alternative for NixOS"
- "Declarative VM management"
- "VMware migration to open source"

### Phase 2: Monetization (Months 6–12)

**Goal**: Launch Weaver/Fabrick tiers, first 20 paying customers.

| Action | Channel | Cost |
|---|---|---|
| Launch Weaver tier ($149/yr) | Website + GitHub | Stripe/Keygen integration |
| Launch Fabrick tier ($1,500/yr first node) | Website + GitHub | License key system |
| Channel outreach: Numtide, Nixcademy (Decision #38) | Direct | Relationship building |
| Write case study with Founding Member / Design Partner | Blog | Weaver Free |
| Create "Migrate from VMware" guide | SEO content | Weaver Free |
| Create "Migrate from Proxmox" guide | SEO content | Weaver Free |

### Phase 3: Scale (Months 12–24)

**Goal**: 50+ paying customers, enterprise pilots, channel partnerships active.

| Action | Channel | Cost |
|---|---|---|
| Channel outreach: Tweag (needs v1.1 container visibility for credibility) | Direct | Revenue share |
| Sponsor NixCon | Conference | ~$2–5k |
| Design Partner program: 3–5 prominent NixOS companies (Decision #38) | Direct | Partner tier ($30k/yr) |
| Publish comparison: "Weaver vs Proxmox vs Incus" | SEO content | Weaver Free |
| FlakeHub listing + Determinate integration docs | Ecosystem | Dev time |
| SOC 2 / security audit (if enterprise requires) | Compliance | $10–30k |

---

## Marketing Positioning

### Tagline Options

1. **"Declarative VMs, visible."** — Emphasizes the core value: you define VMs in Nix, we show them.
2. **"The dashboard NixOS deserves."** — Community-first, positions as filling a gap.
3. **"VMs as code. Finally, a UI."** — Bridges the IaC world with the need for visibility.
4. **"From Nix expression to running VM. See everything."** — Descriptive, clear.

### Bottom-Up GTM Motion

The sysop-as-champion acquisition path is the core enterprise GTM motion:

1. **Segment E sysadmin** evaluates Weaver on home lab hardware — $149/yr Weaver, out of pocket, no procurement friction
2. **Proves value** — AI diagnostics, Live Provisioning, multi-hypervisor, zero drift. Builds conviction.
3. **Champions internally** — presents to IT leadership as a VMware/Proxmox alternative or complement
4. **Fabrick contract** — $1,500/yr first node, $750/yr add'l. 10-node deployment = $8,000–13,000/yr

**The math:** A $149 Weaver purchase that converts to a 10-node Fabrick deployment is a **53× return on acquisition cost** (Decision #63). Friction at the $149 evaluation stage destroys the enterprise funnel — every unnecessary barrier is a missed $8,000/yr deal.

**Why this works for Weaver specifically:** 81% of self-hosters work in tech professionally (selfh.st 2025 survey). The homelab community IS the sysadmin community. The home lab is the pre-sales evaluation environment. Free and Weaver tiers aren't just community plays — they are the fabrick acquisition channel.

**Implication for pricing:** Weaver pricing must remain frictionless ($149/yr, no per-seat complexity, instant license key delivery). Fabrick pricing can be higher because the champion has already validated the product before procurement is involved.

### Positioning Statement

> Weaver manages your entire workload isolation stack — MicroVMs and containers — from one dashboard, on your hardware, with declarative config and zero drift. Deploy alongside your existing infrastructure with no cutover risk. No NixOS expertise required. Free for individuals, Weaver for power users, Fabrick for teams.

### Key Messages by Segment

**Homelab (Segment A):**
> "Stop memorizing systemctl commands. See all your microVMs in one place, start and stop them with a click, and create new ones from the distro catalog without writing Nix from scratch."

**Small Teams (Segment B):**
> "Give your team a shared dashboard for VM management. Live Provisioning lowers the Nix learning curve, audit logs track who changed what, and declarative config means every change is reproducible and rollback-safe."

**Fabrick (Segment C):**
> "Declarative, reproducible, auditable VM infrastructure. Zero configuration drift. Git-based audit trail. SSO integration. Multi-host management via Colmena. Deploy in parallel — no migration required, no cutover risk. $1,500/yr first node. Your first sysadmin already evaluated it on their home lab."

**VMware Refugees (Segment D):**
> "Run Weaver alongside VMware today. No migration, no cutover, no risk. Prove value in parallel, then migrate at your pace. Zero configuration drift. Declarative audit trail. One tool for VMs and containers. $1,500/yr per node replaces $5K–50K+/yr VMware licensing."

**Sysop-as-Champion (Segment E):**
> "Everything Proxmox charges €355/socket for — plus Live Provisioning, multi-hypervisor, AI diagnostics, and a modern UI. $149/yr. Evaluate it on your home lab tonight. Champion it at work next quarter."

### NixOS-Native SDN Positioning (Decision #34)

Starting at v1.2 (when managed bridges + DNS + firewall are all shipping), position the networking stack as **"NixOS-native Software-Defined Networking"** in marketing materials.

**What this means:**
- No new code — this is a marketing umbrella for features already on the roadmap
- Managed bridges (v1.1 Weaver), DNS plugin (v1.1), firewall plugin (v1.2), and the topology visualization collectively constitute SDN functionality
- Cross-node overlay networking (VXLAN/WireGuard) arrives with multi-node in v2.0, completing the SDN story

**Why it works:**
- Proxmox's SDN is OVS bolted onto Debian — imperative, fragile, and hard to reproduce across hosts
- Weaver's networking is declarative Nix all the way down: reproducible, auditable, version-controlled, and rollback-safe
- "NixOS-native SDN" is a genuine differentiator, not just branding — the reproducibility guarantee is something OVS/OVN on Proxmox structurally cannot offer

**Competitive messaging:**

| Capability | Proxmox SDN | Weaver SDN |
|---|---|---|
| Configuration | OVS CLI / imperative API | Declarative Nix expressions |
| Reproducibility | Manual recreation per host | `nixos-rebuild switch` replicates exactly |
| Drift detection | None | Nix guarantees no drift by design |
| Rollback | Manual | `nixos-rebuild switch --rollback` |
| Audit trail | Limited logs | Git history of every networking change |
| Firewall integration | Separate subsystem (pve-firewall) | Unified nftables, same Nix config tree |
| DNS integration | External | Built-in plugin (dnsmasq + CoreDNS) |

**Tier mapping for SDN features:**

| Feature | Weaver Free | Weaver | Fabrick |
|---|---|---|---|
| Network topology visualization | Yes | Yes | Yes |
| Auto-detected bridges (read-only) | Yes | Yes | Yes |
| Managed bridges + IP pools | — | Yes | Yes |
| DNS plugin (`.vm.internal`) | — | Yes | Yes |
| Firewall presets + custom rules | — | Yes | Yes |
| Firewall zones + drift audit | — | — | Yes |
| Cross-node overlay (VXLAN/WireGuard) | — | — | Yes (v2.0) |

**When to activate:** Begin using "SDN" language in marketing copy, comparison pages, and pitch materials once v1.2 ships with the firewall plugin. Before that, the feature set is too thin to credibly claim SDN.

### "Run Your Own Cloud" Positioning (Decision #36)

The core value proposition isn't K8s replacement — it's that customers can **be their own cloud provider** without K8s complexity. K8s is a means to an end. The end is: I control my infrastructure, my apps run reliably, and I don't need a platform team to manage it.

**The pitch:** "Run your own cloud, declaratively, without the complexity tax."

**Maturity milestones — what a customer can do at each version:**

| Version | Customer Capability | Competitive Equivalent |
|---|---|---|
| v1.0 | Manage existing VMs, provision new ones via UI | Basic Proxmox single-node |
| v1.2 | Basic private cloud: isolated networks (SDN), access control (RBAC), health monitoring, DNS | Proxmox + manual networking setup |
| v2.0 | **Production private cloud**: multi-host, disk lifecycle, ingress (nginx template), load balancing (HAProxy template), storage pools | Self-hosted cloud platform (CloudStack, OpenNebula) |
| v3.0 | **Enterprise cloud**: auto-scaling, HA failover, live migration | Managed cloud competitor (lighter-weight OpenStack) |

**Why this framing beats "K8s alternative":**
- K8s is polarizing — some love it, some hate it. "Run your own cloud" appeals to both camps
- Positions Weaver as infrastructure, not as an orchestrator competing with K8s
- Customers running K8s on VMs (extremely common) would run K8s *on Weaver* — we're the layer below, not beside
- "Your own cloud" resonates with the sovereignty/self-hosting trend ($15.6B market, 18.5% CAGR)
- **"Reduce your YAML dependencies"** — K8s infrastructure is thousands of lines of YAML with no type checking, no module system, and silent misconfiguration. Nix replaces YAML with a typed, composable language where errors are caught at build time, not in production at 3 AM. Every Helm chart, every Kustomize overlay, every ArgoCD manifest — replaced by Nix expressions that the compiler actually validates

**SaaS angle:** The same features that let customers run their own private cloud are what power the hosted SaaS offering. Every feature built for self-hosted private cloud users directly improves the SaaS product. No feature divergence.

**Per-segment messaging:**

| Segment | Message |
|---|---|
| Homelab (A) | "Your home cloud. No AWS bill, no K8s YAML, no complexity." |
| Small Teams (B) | "Your team's private cloud. Deploy apps, not infrastructure." |
| Fabrick (C) | "Sovereign cloud infrastructure. Declarative, auditable, yours." |
| VMware Refugees (D) | "Your cloud, your hardware, your rules. No vendor lock-in, ever." |

**When to activate:** Begin using "your own cloud" language at v2.0 when multi-node + templates + storage make it credible. Use "private cloud foundation" language from v1.2 onward.

### Integrated Product Narrative — "One Product, Two Scopes" (Decision #109)

We are building two products simultaneously: Weaver (per-host workload management) and Fabrick (fleet control plane). The strategic framing is not "two products" — it is **one product expressed at two scales**. This distinction is load-bearing: it changes how we pitch to every audience.

**The core claim:** Every Weaver installation is a Fabrick node waiting to be enrolled. The gRPC agent (port 50051), mTLS certificates, workload data model, and tier gate system are all Fabrick-ready from v1.0. The upgrade from Weaver to Fabrick is enrollment, not migration.

This is verifiably true and structurally impossible for competitors to replicate retroactively:
- Proxmox VE existed for years before Proxmox Datacenter Manager — separate product, seams throughout
- VMware ESXi + vCenter — retrofitted integration, permanently awkward
- Weaver + Fabrick — co-designed from v1.0, same codebase, same data model, same release cadence

**The one-sentence frame by audience:**

| Audience | Frame |
|----------|-------|
| Technical buyer (Fabrick) | "You're not buying a second product. You're buying scale for a product your team is already running." |
| Developer / homelab (Weaver) | "Start with one host. When you have more, Fabrick is there. You never have to migrate." |
| Investor / analyst | "Two revenue streams, one codebase. Weaver generates qualified Fabrick pipeline at near-zero CAC." |
| Channel partner | "Install Weaver for a developer at client X. When IT sees it, Fabrick closes the deal. You earn commission on the Fabrick contract." |

**The flywheel:**

```
Weaver Free (homelab download)
        ↓
Sysop installs at home, learns the product
        ↓
Champions it at work (81% of self-hosters are tech professionals)
        ↓
Team deploys Weaver Solo/Team
        ↓
Visceral upgrade trigger: sees stopped remote workload, can't restart it
        ↓
Fabrick closes — CAC ≈ $149 home license
```

This flywheel is not a sales strategy bolted onto the product. It is built into the product architecture: the Weaver Team tier deliberately shows remote workloads you can't act on. The friction is the conversion mechanism.

**Competitive moat this creates:**

A competitor can copy features. They cannot copy simultaneous co-design. Any fleet product built after a host product will always have seams — retrofitted APIs, protocol translations, data model mismatches. Our absence of seams is a structural moat that grows wider the longer we ship and the more Weaver installations exist in the wild.

**What "no migration" means in practice:**

When a Weaver Solo customer upgrades to Fabrick, the experience is: enroll your existing host. The agent is already running. The workload inventory is already there. The mTLS certificates are provisioned at enrollment. There is no "export your Weaver config and import into Fabrick." There is no reimplementation. The fleet control plane connects to the agent that was already installed and begins managing it. This is the correct product demo for enterprise evaluators.

**Per-version activation:**

| Version | Narrative activation |
|---------|---------------------|
| v1.0 | Introduce Fabrick as the destination in the demo — show the fleet map teaser. "This is where you're going." Every v1.0 install is already standing on the Fabrick floor. |
| v2.3 | Fabrick Basic Clustering ships. Reframe externally: "The product you've been using just became fleet-aware. Nothing to migrate." This is the Proxmox moat-breaker moment. |
| v3.0 | Full Fabrick fleet control. Position against Rancher/OpenShift/vCenter: "Your team already knows this product. They installed it at home." |

**What NOT to say:**

- Never say "we built two products." It signals split focus and split team.
- Never present Weaver and Fabrick as separate purchase decisions in the same conversation. The question is always "how many hosts" — the tier follows from that.
- Never show Fabrick without Weaver context. The power of Fabrick is that you already have Weaver — without that frame, it's just another fleet product.

**When to activate this framing:** Immediately and permanently. The narrative is true from v1.0. Use it in the demo, in blog posts, in the channel partner pitch, and in enterprise conversations. The "one product, two scopes" frame is not a future aspiration — it is the current architectural reality.

### K8s Feature Parity — Why It Matters and Where We Stand

Kubernetes is the de facto standard for production infrastructure. Buyers — especially enterprise — will benchmark any infrastructure product against K8s capabilities, even if they don't use K8s themselves. This scorecard tracks where Weaver covers the same ground, and where NixOS gives us a structural advantage K8s can't match.

**Structural advantages (things K8s does poorly that NixOS does by design):**

| Capability | K8s Reality | Weaver (NixOS) |
|---|---|---|
| Declarative state | YAML manifests, but runtime drifts from declared state constantly | Nix guarantees build = deploy. No drift, ever. |
| Reproducibility | "Works on my cluster" — environment-dependent | `nixos-rebuild switch` produces identical output everywhere |
| Rollback | `kubectl rollout undo` — partial, risky, doesn't cover infra | `nixos-rebuild switch --rollback` — atomic, complete, includes everything |
| Secrets management | External tools required (Vault, sealed-secrets, SOPS) | sops-nix (host secrets, native + declarative) + integrated credential vault (runtime app secrets, v1.5.0) |
| Configuration audit | Limited to API server audit log | Full git history of every infrastructure change |
| Complexity | 50+ CRDs in a typical cluster, dedicated platform team required | Single Nix config tree, no platform team needed |
| Configuration language | YAML — no types, no modules, silent misconfiguration. Helm/Kustomize/ArgoCD bolt-ons | Nix — typed, composable, errors caught at build time. One language for everything |

**Feature parity scorecard:**

The left column is what K8s provides. The right columns show how Weaver covers each capability, which version delivers it, and whether it's needed for SaaS or private cloud use cases.

| What customers need | K8s feature | Weaver solution | Version | SaaS critical? | Private cloud critical? |
|---|---|---|---|---|---|
| Deploy workloads | Pod scheduling | Live Provisioning (create VMs via UI/API) | v1.0 | Yes | Yes |
| Apps find each other | Service discovery | DNS plugin — SRV records, `.vm.internal` | v1.1 | Yes | Yes |
| Monitor app health | Liveness/readiness probes | Health probes — TCP/HTTP per VM service | v1.1 | Yes | Yes |
| Name resolution | CoreDNS | dnsmasq + CoreDNS plugin | v1.1 | Yes | Yes |
| Route external traffic in | Ingress controller | nginx reverse proxy (built-in template) | v2.0 | Yes | Yes |
| Distribute load | Service load balancing | HAProxy (built-in template) | v2.0 | At scale | Nice-to-have |
| Network isolation | NetworkPolicy | nftables firewall plugin + zones | v1.2 | Yes (multi-tenant) | Yes (compliance) |
| Access control | RBAC | Per-VM RBAC | v1.2 | Yes (multi-tenant) | Yes (teams) |
| Run containers | Container runtime | Apptainer/Docker/Podman visibility + management | v1.1–1.2 | Yes | Yes |
| Zero-downtime deploys | Rolling updates | VM update strategy | v2.0 | Yes | Nice-to-have |
| Multi-host | Node scheduling | Colmena/deploy-rs multi-host management | v2.0 | Yes | Yes |
| Persistent storage | PV/PVC | Disk provisioning — pools, tier tags, lifecycle | v2.0 | Yes | Yes |
| Scale on demand | HPA/VPA auto-scaling | LB-triggered VM auto-provisioning | v3.0 | Eventually | Rare |
| Survive failures | HA, pod rescheduling | HA failover, automatic VM rescheduling | v3.0 | Yes (production) | Yes (production) |
| Move workloads live | N/A (pod recreation) | Live migration between hosts | v3.0 | Nice-to-have | Nice-to-have |
| Manage secrets | External (Vault, etc.) | sops-nix (host secrets) + credential vault (app secrets, v1.5.0) | v1.5.0 | Yes | Yes |
| Reproducible infra | Weak (YAML + Helm + drift) | Nix — strongest guarantee in the industry | **Already done** | Yes | Yes |

**The conclusion:**

By **v2.0**, Weaver covers **15 of 17** K8s-equivalent capabilities. The remaining two (auto-scaling, HA failover) arrive at v3.0 — and most K8s users never configure either.

But the real story isn't parity — it's that **7 of these capabilities are structurally better on NixOS than on K8s** (declarative state, reproducibility, rollback, secrets, audit, complexity, configuration language). K8s bolts these on with external tools, YAML layering, and operational discipline. NixOS provides them by construction — and eliminates thousands of lines of untyped YAML in the process.

**Bottom line:** We're not chasing K8s. We're building a private cloud platform that happens to cover the same ground — with stronger guarantees and without the complexity tax. By v2.0, no customer needs K8s unless they specifically need container orchestration at massive scale. And even then, they'd run K8s *on top of* Weaver.

---

## Revenue Model & Projections

> **Detailed revenue modeling:** See [TIER-MANAGEMENT.md](TIER-MANAGEMENT.md) and [FABRICK-VALUE-PROPOSITION.md](FABRICK-VALUE-PROPOSITION.md) for granular tier-by-tier projections and Fabrick Success Programs pricing.

### Assumptions

- **Year 1**: Focus on community + first paying customers + channel partner relationships
- **Conversion rate**: 2–5% of active free users → paid (industry benchmark for dev tools)
- **Churn**: 5–8% annually for self-serve, 2–3% for enterprise (annual billing reduces churn vs monthly)
- **Blended ARPU**: ~$420/yr per customer (weighted: mostly Weaver at $149/yr, some Fabrick at $1,500+/yr); enterprise blended deal value ~$8,000/yr (10-node avg: 1×$1,500 + 7×$750)

### Conservative Projection

| Metric | Month 6 | Month 12 | Month 18 | Month 24 |
|---|---|---|---|---|
| GitHub stars | 500 | 1,500 | 3,000 | 5,000 |
| Active free users | 100 | 500 | 1,500 | 3,000 |
| Weaver customers | 5 | 20 | 50 | 100 |
| Fabrick customers | 0 | 3 | 10 | 25 |
| ARR | $745 | $11,877 | $32,450 | $64,875 |

> Fabrick ARR calculation uses $1,500/yr first node × 1 node avg for early customers. Month 24: 100×$149 + 25×$1,500 = $14,900 + $37,500 = $52,400 (3 nodes avg ≈ $64,875 at $750 add'l node rate).

### Optimistic Projection (VMware tailwind + channel partners + viral NixOS content)

| Metric | Month 6 | Month 12 | Month 18 | Month 24 |
|---|---|---|---|---|
| GitHub stars | 1,000 | 5,000 | 10,000 | 20,000 |
| Active free users | 300 | 2,000 | 5,000 | 10,000 |
| Weaver customers | 15 | 80 | 200 | 400 |
| Fabrick customers | 0 | 10 | 30 | 60 |
| Design Partners (Decision #38) | 0 | 2 | 3 | 5 |
| ARR | $2,235 | $41,910 | $109,700 | $179,550 |

> Month 24 optimistic: 400×$149 + 60×$8,000 blended = $59,600 + $480,000 = $539,600 at full enterprise scale; $179,550 represents early-stage ramp (avg 2-node enterprise).

### Path to Sustainability

At blended ~$420/yr ARPU (Weaver-weighted):
- **Break-even on hosting costs** (~$2,400/yr): 6 customers
- **Ramen profitable** (~$36k/yr): 86 customers (or 25 Fabrick single-node + misc Weaver)
- **Sustainable indie business** (~$120k/yr): 2 Design Partners ($60k) + 8 Fabrick (avg 3-node) + misc Weaver
- **Venture-scale** ($1M+/yr): ~125 Fabrick customers at $8,000/yr blended deal (likely requires basic clustering at v2.2.0+)

The Netdata model is instructive: they serve 74k GitHub stars and 1.5M+ daily downloads with a freemium model. Even at low conversion rates, a large community generates meaningful revenue. Channel partners (Decision #38) accelerate enterprise adoption — one Tweag or Numtide relationship is worth dozens of cold outreach attempts. The sysop-as-champion model (Segment E) means every active Weaver user is a potential enterprise referral — not just a $149 customer.

---

## Competitive Moat

### Product Moats (Now → v1.2)

1. **Only NixOS-native VM dashboard** — No competitor exists in this niche
2. **Declarative-first architecture** — Can't be easily bolted onto Proxmox or Incus
3. **Firecracker support** — Sub-second VM boot, unique among VM dashboards
4. **Live Provisioning** — Create and manage VMs via API/UI without `nixos-rebuild switch`. Core differentiator no NixOS tool offers
5. **NixOS-native SDN** (Decision #34) — Declarative networking stack that Proxmox structurally cannot match

### Integration Moat: NixOS Ecosystem (v1.1 → v3.0)

*Source of truth: [NIX-ECOSYSTEM-INTEGRATION-PLAN.md](../../plans/cross-version/NIX-ECOSYSTEM-INTEGRATION-PLAN.md)*

12 NixOS-native packages that competitors **cannot use** without adopting NixOS:

| Layer | Version | Integrations | Competitive effect |
|-------|---------|-------------|-------------------|
| **Foundation** | v1.1–1.2 | nix-ld, nixos-generators, home-manager, sops-nix, impermanence, lanzaboote | "NixOS VMs that just work, with secrets encrypted at rest, roots that reset every boot, and Secure Boot chain from firmware to userspace" |
| **Fleet** | v2.3 | nixos-anywhere + disko, Colmena, Attic, nixos-facter | "Point us at bare metal, we'll install NixOS, configure it, cache the builds, and manage the fleet — zero touch" |
| **Topology** | v3.0 | nix-topology + impermanence (edge) | "Topology that's provably correct by construction, edge nodes that reset to clean state on every power cycle" |

Each layer builds on the previous. By v3.0, switching to Weaver means switching to a fundamentally different (better) infrastructure model — not just a different dashboard. Proxmox, VMware, Rancher, and Incus cannot access this ecosystem without a ground-up NixOS rewrite.

### Integration Moat: AI & GPU Infrastructure (v1.2 → v3.0)

*Source of truth: [AI-GPU-INFRASTRUCTURE-PLAN.md](../../plans/cross-version/AI-GPU-INFRASTRUCTURE-PLAN.md)*

26 AI/GPU integrations that competitors **haven't built** — they could, but haven't:

| Layer | Version | Integrations | Competitive effect |
|-------|---------|-------------|-------------------|
| **GPU Foundation** | v1.2 | Multi-vendor GPU (NVIDIA/AMD/Intel), VFIO-PCI passthrough, container GPU, CPU-only inference, basic scheduling | "Three GPU vendors, three workload paths (VM + container + CPU-only), one management plane" |
| **Inference** | v2.0–2.2 | Ollama, vLLM, TGI health probes, model library, snapshot provisioning, inference metrics, GPU scheduling, AI rate limits | "Deploy a model in 30 seconds from snapshot, with production metrics and per-user rate limits from day one" |
| **Fleet AI** | v3.0 | Fleet GPU scheduling, fleet inference routing, blue/green model deployment, fleet snapshot distribution | "AI replaces the scheduler — MCP server instead of Slurm/K8s GPU operator" (Decision #94) |

Key differentiator: unified VM + container + GPU management. Competitors do VMs (Proxmox) **or** containers (K8s) **or** GPU scheduling (Slurm) — never all three. Weaver manages the full spectrum under one tier model.

### Compounding Moat: Both Pillars Combined

The two integration pillars compound:
- **NixOS ecosystem** creates platform lock-in (they can't copy it)
- **AI/GPU infrastructure** creates integration depth (they haven't copied it)
- Combined: a regulated fabrick running AI inference on NixOS gets secrets management (sops-nix), ephemeral root (impermanence), Secure Boot (lanzaboote), multi-vendor GPU scheduling, inference metrics, model deployment, and fleet management — from one product with one license key. Assembling this from open-source components takes 12–18 months of engineering. Weaver ships it.

### Community & Channel Moats (18+ months)

6. **Community and brand** — "The NixOS VM dashboard" becomes the category definition
7. **Channel partnerships** (Decision #38) — Embedded in NixOS consulting ecosystem (Tweag, Numtide, Nixcademy)
8. **Template ecosystem** — Network effects as community contributes templates
9. **Forge development velocity** — Autonomous agent infrastructure ships features faster than competitors can copy them (Decision #94, MCP server)

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| NixOS remains too niche to support a business | Medium | High | Target IaC market broadly, not just NixOS users. Template editor works for anyone learning Nix. |
| Incus adds NixOS-native VM support | Low–Medium | High | Move fast on Live Provisioning + template system — features Incus is unlikely to build. |
| Proxmox adds declarative config | Low | Medium | Proxmox is committed to Debian and imperative model. Declarative would require a ground-up rewrite. |
| microvm.nix project becomes unmaintained | Low | Critical | Contribute upstream, maintain a fork if necessary. Weaver value exists independent of microvm.nix (could wrap libvirt too). |
| Open-source competitors emerge | Medium | Medium | Community moat + hosted offering. Hard to compete with established community and template library. |
| AI makes Nix generation trivial (everyone can do it) | Medium | Low | AI generation *is* the feature — if everyone can generate Nix, more people need a workload manager to manage the results. |
| Weaver Free tier is too generous, nobody upgrades | Medium | Medium | Monitor conversion. Adjust free tier limits if needed (e.g., max 5 VMs free). |

---

## Comparable Company Analysis

| Company | Model | Free Users | Paying | Revenue | Valuation | Lesson |
|---|---|---|---|---|---|---|
| **Grafana** | Open core + SaaS | 20M | 5,000+ | $270M ARR | $6B | Free tool → massive community → cloud monetization |
| **n8n** | Fair-code + SaaS | 230,000+ | 3,000+ | $40M ARR | $2.5B | Workflow automation + self-host → cloud upsell |
| **Portainer** | Freemium | 650,000+ | Undisclosed | Undisclosed | Private | Container dashboard → business edition for teams |
| **Netdata** | Open source + SaaS | 1.5M+ daily | Undisclosed | Undisclosed | $34.9M raised | Monitoring agent → cloud + fabrick tiers |
| **GitLab** | Open core + SaaS | Millions | 30,000+ | $580M | Public | DevOps platform, 33% YoY growth |

**Pattern**: Every successful infrastructure open-source company follows the same arc:
1. Build a genuinely useful free tool
2. Cultivate a passionate community
3. Add hosted/managed offering for convenience
4. Add team/fabrick features for collaboration and compliance
5. Revenue follows community size with a 1–5% conversion rate

Weaver is at step 1. The architecture (two repos, demo mode, NUR packaging) already anticipates steps 2–4.

---

## Next Steps

1. **Ship v1.0.0** — Clear remaining release gate (NixOS fresh-install smoke test). Legal/insurance review deferred to v1.1.0 — v1.0 ships no security-posture feature domains (Decision #30)
2. **Launch on NixOS community channels** — Reddit, Discourse, HN (see [GTM-LAUNCH-PLAN.md](../../plans/v1.0.0/GTM-LAUNCH-PLAN.md))
3. **Channel outreach** — Numtide + Nixcademy post-launch, Tweag at v1.1 (Decision #38)
4. **Set up billing** — Stripe/Keygen, pricing page, license key system for Weaver/Fabrick
5. **Instrument for analytics** — Track active users, feature adoption, conversion funnel
6. **Begin v1.1 development** — Container visibility, DNS plugin, health probes (see [STATUS.md](../../STATUS.md))

---

## Sources

### Market Data
- [Gartner: 35% VMware Workload Migration](https://www.webpronews.com/gartner-forecasts-35-vmware-workload-migration-after-broadcom-buyout/)
- [Proxmox Adoption in 2025](https://www.saturnme.com/proxmox-adoption-in-2025-global-growth-trends-and-why-its-replacing-vmware/)
- [Infrastructure as Code Market Size](https://www.precedenceresearch.com/infrastructure-as-code-market)
- [Self-Hosting Market Size](https://market.us/report/self-hosting-market/)
- [Homelab Market Size](https://www.marketresearchfuture.com/reports/homelab-market-21555)

### NixOS
- [NixOS Corporate Adoption List](https://discourse.nixos.org/t/corporate-adoption-list/47578)
- [Companies Using NixOS (theirstack)](https://theirstack.com/en/technology/nixos)
- [Nix Companies GitHub List](https://github.com/ad-si/nix-companies)
- Note: ~466 company figure as of 2026-03 (updated from ~293); count accelerating as NixOS Cloud, microvm.nix, NixVirt launched 2024–2025

### Comparable Companies
- [Grafana Labs Revenue & Valuation (Sacra)](https://sacra.com/c/grafana-labs/)
- [n8n Revenue & Valuation (Sacra)](https://sacra.com/c/n8n/)
- [GitLab Revenue (Statista)](https://www.statista.com/statistics/1478273/total-revenue-gitlab/)
- [Netdata Company Profile](https://tracxn.com/d/companies/netdata/__186sdPpIdkrynrYk0ouTOZDyHwtA8MWBuGMr0A0oQeY)
- [Portainer Pricing](https://www.portainer.io/pricing)

### Business Model
- [Open Core Business Model (OCV Handbook)](https://handbook.opencoreventures.com/open-core-business-model/)
- [Open Source Business Models 2026](https://technews180.com/blog/open-source-models-that-work/)
- [Open Source Services Market Growth](https://www.grandviewresearch.com/industry-analysis/infrastructure-as-code-market-report)

### Homelab Community
- [r/homelab Stats](https://gummysearch.com/r/homelab/)
- [r/selfhosted Stats](https://subredditstats.com/r/selfhosted)
- [Linux Dominates Homelab OS Space](https://linuxiac.com/self-hosters-confirm-it-again-linux-dominates-the-homelab-os-space)
- selfh.st 2025 Survey: 81% of self-hosters work in tech professionally; 98.3% run containers
