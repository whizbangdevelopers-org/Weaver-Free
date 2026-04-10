<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->

# Bridge AI — TCO Analysis & Pricing Implications

**Created:** 2026-04-07
**Status:** Research — feeds pricing decision + pitch deck update
**Context:** Bridge AI (automated fleet virtual bridge operations) is currently priced as a separate extension (AI Pro $99/yr, AI Fleet $499/yr/node per Decision #120). This analysis evaluates whether bridge AI should be baked into the base tier price instead.

---

## What Bridge AI Does

Bridge AI automates the operation of Weaver/FabricK virtual bridges — the single primitive that replaces three K8s components (CNI plugin, ingress controller, Argo Rollouts).

**Capabilities by tier:**

| Tier | Bridges Available | Bridge AI Capabilities |
|------|-------------------|----------------------|
| **Free** | Auto-detected, read-only | None |
| **Solo** | Managed bridges, IP pools, firewall | None — manual operations only |
| **Team** | Managed + peer bridges (2 hosts) | Blue/green on local + peer bridges, weight shifting, automated health-based routing |
| **FabricK** | Fleet virtual bridges (overlay, unlimited) | Fleet-scale routing, inference routing, cordon/uncordon, auto-scaling, GPU scheduling |

---

## TCO Without Bridge AI (Manual Bridge Operations)

### Small Team (Weaver Team — 2-3 hosts, 2-4 users)

| Task | Frequency | Staff Time | Annual Cost (@$75/hr) |
|------|-----------|-----------|----------------------|
| Blue/green deployment coordination | 2-4×/month | 2-4 hrs each | $3,600–$14,400/yr |
| Load monitoring + weight adjustment | Continuous | 1-2 hrs/week | $3,900–$7,800/yr |
| Cordon/drain for maintenance | Monthly | 1-2 hrs each | $900–$1,800/yr |
| Incident response — traffic rerouting | ~6×/yr | 1-3 hrs each | $450–$1,350/yr |
| Capacity planning + rebalancing | Quarterly | 4-8 hrs each | $1,200–$2,400/yr |
| Model rollout coordination (if AI workloads) | 2-4×/month | 2-4 hrs each | $3,600–$14,400/yr |
| **Total** | | | **$13,650–$42,150/yr** |

### Enterprise Fleet (FabricK — 10+ nodes)

| What They Pay For Today | Annual Cost | Bridge AI Replaces |
|------------------------|-------------|-------------------|
| Platform engineer to operate K8s (CNI + ingress + Argo) | $150K–$200K/yr | FabricK AI operates the bridge autonomously |
| ArgoCD/Spinnaker + Argo Rollouts licensing + maintenance | $10K–$50K/yr | Bridge weight API + AI |
| Load balancer (MetalLB, F5, AWS ALB) | $5K–$20K/yr | Bridge routing |
| Monitoring stack for deployment health (Datadog, etc.) | $15K–$50K/yr | Inference metrics built in |
| **Total** | **$180K–$320K/yr** | |

---

## ROI by Tier

### Weaver Team (bridge AI included in base)

- Manual cost replaced: ~$13K–$20K/yr in staff time
- Team license: $149–$449/user/yr (2-4 users)
- **ROI: 30–45×**

### FabricK (bridge AI included in base)

- Platform team + tooling replaced: $175K–$270K/yr
- FabricK license (10 nodes, blended): ~$8K–$10K/yr
- **ROI: 18–27×**

### FabricK (AI/inference fleet — 10 GPU nodes)

- K8s platform + GPU Operator + Run:ai/Determined: $200K–$350K/yr
- FabricK license + GPU scheduling: ~$10K/yr
- **ROI: 20–35×**

---

## The Core Argument: AI Is the Product, Not a Bolt-On

Bridge AI isn't an optional feature — it's what makes "3 K8s components → 1 bridge" actually work. Without bridge AI:
- Blue/green requires manual weight shifting via API calls
- Cordon/drain requires manual intervention during maintenance windows
- Inference routing requires manual configuration per model rollout
- The "K8s killer" pitch collapses to "K8s alternative that still needs a human operator"

**With bridge AI included in the base price:**
- The value proposition is complete — autonomous bridge operations from day one
- "You don't need a platform team" is the sales line, and it's true without asterisks
- Every bridge-capable tier gets the AI that makes bridges valuable
- Compliance Export ($4K/yr) remains the only vertical-specific add-on — clean separation

---

## Pricing Impact Assessment

### Previous Model (Decision #120)

| Extension | Price | Gate |
|-----------|-------|------|
| AI Pro | $99/yr | Solo/Team |
| AI Fleet | $499/yr/node | FabricK |

### Resolved Model: Smart Bridges Baked Into Base Price

Smart Bridges is a toggleable feature included in the tier price. The ROI (18–45×) justifies a price increase. AI diagnostics (explain, diagnose, suggest) remain in all tiers including Solo.

**Pricing changes:**

| Tier | Previous Standard | New Standard | Previous FM | New FM | Change Rationale |
|------|:-:|:-:|:-:|:-:|---|
| Free | $0 | $0 | — | — | No change |
| Solo | $249/yr | $249/yr | $149/yr | $149/yr | No change — no Smart Bridges (manual bridges only) |
| **Team** | $149/user/yr | **$199/user/yr** | $99/user/yr | **$129/user/yr** | +$50/user — Smart Bridges (blue/green, health routing) |
| **FabricK 256GB first** | $1,500/yr | **$2,000/yr** | $999/yr | **$1,299/yr** | +$500 — Smart Bridges + inference + GPU scheduling |
| **FabricK add'l 2–4** | $750/yr | **$1,250/yr** | — | — | +$500 — reflects Smart Bridge value |
| **FabricK add'l 5–9** | $750/yr | **$1,000/yr** | — | — | +$250 — volume starts reducing |
| **FabricK add'l 10+** | $500/yr | **$750/yr** | — | — | +$250 — large fleet discount |
| FabricK 512GB | $2,500/yr | $2,500/yr | $1,750/yr | $1,750/yr | No change |
| Contract (512GB+) | Sliding scale | Sliding scale | — | — | No change |

**Blended deal examples (FabricK 256GB):**

| Fleet Size | Previous | New | Δ |
|:---:|:---:|:---:|:---:|
| 5 nodes | $4,500/yr | $7,000/yr | +$2,500 |
| 10 nodes | $8,000/yr | $12,000/yr | +$4,000 |
| 20 nodes | $12,500/yr | $19,500/yr | +$7,000 |

**Revenue impact vs AI extension model:**
- Previous: base license + AI Pro ($99) + AI Fleet ($499/node) as add-ons
- New: higher base price, no add-ons (except Compliance Export $4K/yr)
- Net: higher ARPU, simpler story, "Smart Bridges included" headline

---

## Feature: Smart Bridges

**Smart Bridges** is the product name for AI-operated bridge automation. It's a toggleable feature — customers can disable it and operate bridges manually. Included in the tier price, not a separate add-on.

**Scope by tier:**

| Tier | Smart Bridges | Capabilities |
|------|:---:|---|
| Free | — | Auto-detected bridges, read-only |
| Solo | — | Managed bridges, IP pools, firewall — manual operations only |
| **Team** | **Basic** | Automated blue/green on local + peer bridges, health-based routing, weight shifting |
| **FabricK** | **Full** | Everything in Team + inference routing, GPU-aware placement, model rollout, fleet metrics, cordon, auto-scale |

**Solo → Team upgrade trigger:** "Your bridges are manual. Upgrade to Team and they operate themselves."

---

## Naming Convention: [Product] AI

Portfolio-wide pattern where AI follows the product name:

| Product | AI Capability | What It Operates |
|---------|-------------|-----------------|
| **Weaver AI** | Included in Team base | Smart Bridges (basic), diagnostics, model deployment |
| **FabricK AI** | Included in FabricK base | Smart Bridges (full), GPU scheduling, fleet inference routing, fleet auto-scaling |
| **Forge AI** | Future product | Autonomous development pipeline intelligence |
| **Gantry AI** | Future product | Spatial planning intelligence |

**Solo tier:** Gets AI diagnostics (explain, diagnose, suggest) but NOT Smart Bridges. Bridge AI starts at Team where peer bridges make it valuable.

**Supersedes:** Decision #120 naming (AI Pro → Weaver AI, AI Fleet → FabricK AI) and pricing (separate add-ons → baked into base price).

---

## Competitive Positioning with Smart Bridges Included

| Competitor | Their Stack | Annual Cost | Weaver/FabricK |
|-----------|------------|-------------|---------------|
| K8s + Argo + MetalLB + Datadog | 4 tools + platform engineer | $180K–$320K/yr | FabricK: ~$12K/yr |
| Run:ai (GPU scheduling) | Proprietary + K8s dependency | $5K–$50K/yr/node | FabricK AI: included |
| Proxmox + manual ops | Web UI + SSH scripts | Staff time + license | Weaver Team: ~$800/yr (4 users) |
| VMware vCenter + vRealize | Enterprise stack | $50K–$500K/yr | FabricK: ~$12K/yr |

**Sales line:** "Smart Bridges included. You don't need a platform team. The bridge operates itself."

---

## Decision Summary

**Resolved:** Smart Bridges baked into base tier pricing. Price increases justified by 18–45× ROI.

| Change | Detail |
|--------|--------|
| Team: $149 → $199/user/yr ($129 FM) | Smart Bridges (basic) included |
| FabricK first: $1,500 → $2,000/yr ($1,299 FM) | Smart Bridges (full) + inference included |
| FabricK add'l: $750 → $1,250/$1,000/$750 tiered | Three-tier volume discount (2-4 / 5-9 / 10+) |
| Solo: unchanged | No Smart Bridges — manual bridges only |
| AI Pro / AI Fleet add-ons: retired | Replaced by base-price inclusion |
| Compliance Export: unchanged ($4K/yr) | Only remaining paid extension |
| [Product] AI naming convention | Portfolio-wide: Weaver AI, FabricK AI, Forge AI, Gantry AI |

**Next steps:**
1. ~~Research doc~~ (this file)
2. Draft master plan decision (supersedes #120 pricing, amends #63 node pricing)
3. Update value prop docs (IT-FOCUS, AI-INFERENCE)
4. Update pitch deck (Slides 5, 7, 8)
5. Update pricing.ts + FM Program doc
6. Update TIER-MANAGEMENT.md
