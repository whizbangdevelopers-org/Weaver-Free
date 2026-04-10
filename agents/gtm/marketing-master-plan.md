<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: gtm-marketing-master-plan — Marketing Master Plan

**Plan:** [GTM-LAUNCH-PLAN](../../plans/v1.0.0/GTM-LAUNCH-PLAN.md) (cross-version)
**Parallelizable:** Yes (independent of code agents)
**Blocks:** None

---

## Scope

Create `business/marketing/MARKETING-MASTER-PLAN.md` — a release-indexed marketing plan covering all waves from v1.0 through v3.3. Each release version gets a marketing implementation section: launch type, content deliverables, channel strategy, pricing change communications, vertical outreach, and partner/TA actions.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `MASTER-PLAN.md` | Release arc, decision log, tier structure |
| `business/product/RELEASE-ROADMAP.md` | Visual release chart and strategic inflection points |
| `business/product/TIER-MANAGEMENT.md` | Pricing, tiers, FM program |
| `business/sales/FOUNDING-MEMBER-PROGRAM.md` | FM gates, Design Partner commitments |
| `business/finance/PRICING-POWER-ANALYSIS.md` | Version-stepped pricing evolution |
| `business/product/FABRICK-CLOUD.md` | v4 product and Path A/B pre-sell gate |
| `business/sales/partners/TECHNOLOGY-ALLIANCES.md` | TA pipeline with version-gated outreach |
| `business/sales/partners/CHANNEL-PARTNER-PITCH.md` | Partner program economics |
| `plans/v1.0.0/GTM-LAUNCH-PLAN.md` | v1.0 launch content and channel strategy |
| `business/sales/IT-FOCUS-VALUE-PROPOSITION.md` | Vertical sales index |
| `research/self-hoster-demographics.md` | Target audience data |
| `research/competitive-landscape.md` | Competitive positioning |
| `business/finance/CASHFLOW-PROJECTION.md` | Revenue milestones for launch timing |

---

## Output

`business/marketing/MARKETING-MASTER-PLAN.md`

---

## Document Structure

### Header
- Last updated date
- Purpose statement: "Per-release marketing implementation plan. Each version section defines what marketing work must ship alongside the code."

### Release Marketing Index (table)
Columns: Version | Wave | Marketing Type | Key Deliverable | Status
One row per version v1.0 through v3.3+

### Per-Release Sections

For each version from v1.0 through v3.3, write a section with:

**Section heading:** `## vX.Y.0 — [version name]`

Sub-sections:
- **Launch Type:** (soft launch / feature launch / major launch / fabrick launch)
- **Trigger:** what must be done before marketing fires (code GA, Stripe active, TA signed, etc.)
- **Target Segments:** which personas/verticals this release speaks to
- **Key Message:** one-sentence positioning for this release
- **Content Deliverables:** list of blog posts, comparison pages, community posts, docs, video scripts, demo updates required. Include specific titles where possible.
- **Channel Strategy:** where to post, in what order, with what timing relative to release day
- **Pricing Actions:** any pricing changes that go live with this release (per PRICING-POWER-ANALYSIS.md)
- **Partner / TA Actions:** outreach, announcements, co-marketing timed to this release
- **Vertical Outreach:** which sales vertical docs activate for this release, target personas
- **Upgrade CTAs:** what free/lower-tier users should be prompted with after this release ships
- **Acceptance Criteria:** what "marketing done" means for this version

### Cross-Version Sections

After per-release sections, add:

**## Content Library** — evergreen assets that serve multiple releases (comparison pages, regulatory mapping docs, TCO calculator, demo video)

**## Channel Playbook** — canonical behavior per channel (r/NixOS, r/homelab, r/selfhosted, HN, NixOS Discourse, LinkedIn, dev.to, NixCon, partner newsletters)

**## Pricing Change Communications** — template and process for communicating tier price increases at v1.2, v2.2, v3.0

**## TA Outreach Calendar** — table of TA partners, target version, outreach owner, status

**## Design Partner Pipeline** — tracking table for Design Partner candidates (5 slots)

**## Channel Partner Pipeline** — tracking table for FM channel partner slots (5 slots)

---

## Version Coverage

Cover these versions at minimum. Derive marketing strategy from the MASTER-PLAN decisions and business docs — do not invent features not in the plan:

| Version | Name / Theme |
|---------|-------------|
| v1.0.0 | Soft Market Entry — NixOS community seeding |
| v1.1.0 | Container Visibility + DNS — homelab credibility |
| v1.2.0 | The Closer — full container management + firewall |
| v1.3.0 | Remote Access + Mobile — Android GA |
| v1.4.0 | Cross-resource AI Agent |
| v1.5.0 | Integrated Secrets Management |
| v1.6.0 | Migration Tooling Arc |
| v2.0.0 | Storage + Templates Wave 1 |
| v2.1.0 | Templates Premium + Snapshots |
| v2.2.0 | Weaver Team — Peer Federation (Team tier opens FM) |
| v2.3.0 | Fabrick Basic Clustering — Proxmox moat-breaker |
| v2.4.0 | Backup Weaver + Cloud Workloads |
| v2.5.0 | Storage Enterprise |
| v2.6.0 | Backup Enterprise |
| v3.0.0 | Fabrick Fleet Control Plane — enterprise launch |
| v3.1.0 | Edge Fleet + Cloud Burst (invoice) |
| v3.2.0 | Cloud Burst Self-Serve Billing |
| v3.3.0 | Fabrick Maturity + Compliance Pack + Fabrick Cloud pre-sell gate |

---

## Key Marketing Facts to Incorporate

From the business docs (use these, do not invent alternatives):

**Pricing evolution (PRICING-POWER-ANALYSIS.md):**
- Weaver Solo: $149/yr (v1.0–v1.1) → $249/yr (v1.2+) → $299/yr (v3.0+)
- Weaver Team: $129/user/yr FM → $199/user/yr standard post-v2.2
- Fabrick: $2,000/yr (v1.x FM) → $2,000/yr (v2.2) → $3,500/yr (v3.0+)
- Pricing changes require advance notice communications

**Fabrick Cloud pre-sell gate (FABRICK-CLOUD.md):**
- Must collect ≥20 Founding Members (at $150/yr/node) by v3.0 GA
- Gate opens at v3.3.0 marketing push
- Path A (≥20) = Platform SaaS; Path B (<20) = AI vertical or K-12 pivot
- Pre-sell landing page must be live before v3.3 ships

**TA outreach timing (TECHNOLOGY-ALLIANCES.md):**
- Tailscale: v1.3.0
- NVIDIA: v2.0.0
- Hetzner + DigitalOcean + Backblaze B2: v2.3.0–v2.4.0
- Anthropic/BAA: v3.0.0

**Channel partner (CHANNEL-PARTNER-PITCH.md):**
- 5 FM slots, 3% locked commission, $30K/yr fee
- Target: Tweag, Numtide, Serokell, Nixcademy + one emerging firm
- Gate: top 5 signed by end of v1.1; announcement letters go out on v1.1 release day

**Sysop-as-champion model:**
- 81% of self-hosters are professional tech workers
- $149/yr home eval → enterprise champion → $8K/yr Fabrick = 53× ROI on acquisition
- Every homelab user is a potential enterprise deal

**Weaver Team FM:**
- Does NOT open at v1.0 launch
- Opens at v2.1 — do not promote Team FM before then

---

## Tone and Content Standards

- No vaporware: only market features that are in the release shipping now or already shipped
- Pricing change comms: 60-day advance notice for all tier price increases
- Community posts: honest, developer-written tone — not corporate
- Regulatory/compliance copy: cite specific regulation sections (§ level), do not make claims that can't be backed by the compliance docs
- Competitive comparisons: fair and factual, acknowledge competitor strengths

---

## Acceptance Criteria

1. All 17+ versions have complete marketing sections
2. Pricing change communications are planned for all three step-up events (v1.2, v2.2, v3.0)
3. TA outreach calendar table is complete with version gates
4. Design Partner pipeline table has 5 slots with candidate names from the business docs
5. Channel Partner pipeline table has 5 slots with target firm names
6. Fabrick Cloud pre-sell section at v3.3 includes the ≥20 Founding Member gate and Path A/B outcome
7. No features marketed before their version ships
8. Content deliverable lists are specific (titled blog posts, named comparison pages) not generic

---

## Estimated Effort

Research + outline: 1 day
Per-release sections (17 versions): 3 days
Cross-version sections: 1 day
Review for accuracy vs master plan: 0.5 days
Total: **5–6 days**
