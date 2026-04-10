<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Sector Personalization Plan — v1.2.0

**Date:** 2026-03-09
**Status:** Draft
**Parent:** [EXECUTION-ROADMAP.md](EXECUTION-ROADMAP.md) | [MASTER-PLAN.md](../../MASTER-PLAN.md)
**Sales context:** [IT-FOCUS-VALUE-PROPOSITION.md](../../business/sales/IT-FOCUS-VALUE-PROPOSITION.md)

---

## Summary

Add a required sector selection to the product that enables personalized upgrade nags, sector-specific demos, and market intelligence — without telemetry or phone-home.

**Origin insight:** 81% of self-hosting sysadmins evaluate tools at home before recommending them at work. By asking "what sector do you work in?" at first-run, we can show upgrade nags that speak directly to their work compliance problems — turning the nag from a generic upsell into a vertical-market demo delivered to the person who makes (or influences) purchasing decisions.

---

## Two Questions, Two Tiers

| Question | Tier | When Asked | Changeable? | Purpose |
|----------|:----:|-----------|:-----------:|---------|
| **Q1:** "What sector do you work in?" | Free | First-run setup (required) | Yes, in profile | Personalize nags, collect market intelligence |
| **Q2:** "What sector would you like to explore?" | Weaver | After upgrade (profile setting) | Yes, anytime | Show aspirational sector demo as second demo slot |

### Why Q1 is Free-tier

Free has the largest user base. Collecting sector data before a user spends a dollar gives us:
- Segmentation for personalized nags from day one
- Market distribution data across the entire install base
- Ability to surface the *right* vertical demo in the upgrade prompt

### Why Q2 is Weaver-tier

Q2 is a personalization upgrade. The sysadmin who works in education but is curious about healthcare IT gets a second demo slot showing HIPAA compliance features. This turns the product into a career exploration tool and makes the Fabrick pitch ("your *current* sector AND your *aspirational* sector both need Fabrick") a natural escalation.

---

## Sector Dropdown Values

### Free Tier (Q1) — Full List

All sectors available. The user tells us who they are — we don't gatekeep the options.

| Sector ID | Display Label | Sales Doc | Demo Content |
|-----------|--------------|:---------:|:------------:|
| `healthcare` | Healthcare | Done | Buildable |
| `defense` | Defense / Government Contractor | Done | Buildable |
| `financial` | Financial Services | Done | Buildable |
| `pharma` | Pharma / Life Sciences | Done | Buildable |
| `education-k12` | Education (K-12) | Done | Buildable |
| `education-higher` | Education (Higher Ed) | Done (shared) | Buildable |
| `government` | Government / Public Sector | Done | Buildable |
| `manufacturing` | Manufacturing / OT | Done | Buildable |
| `research` | Research / HPC | Done | Buildable |
| `msp` | MSP / IT Consulting | Done | Buildable |
| `homelab` | Home Lab / Personal | — | Generic demo |
| `other` | Other | — | Generic demo |

### Weaver Tier (Q2) — Curated List

Only sectors with completed sales docs and built-out demo content. Fewer options, but every option delivers a real sector-specific demo experience.

| Sector ID | Display Label | Available At Launch? |
|-----------|--------------|:-------------------:|
| `healthcare` | Healthcare | Yes |
| `defense` | Defense / Government Contractor | Yes |
| `financial` | Financial Services | Yes |
| `pharma` | Pharma / Life Sciences | Yes |
| `education-k12` | Education (K-12) | Yes |
| `education-higher` | Education (Higher Ed) | Yes |
| `government` | Government / Public Sector | Yes |
| `manufacturing` | Manufacturing / OT | Yes |
| `research` | Research / HPC | Yes |
| `msp` | MSP / IT Consulting | Yes |

**All sector sales docs are now complete.** Every sector in the Q2 dropdown has a full 9-section sales document to source demo content from.

---

## Data Model

### User Profile Extension

```typescript
interface UserProfile {
  // ... existing fields ...

  /** Q1: User's work sector (required at first-run, changeable in profile) */
  sector: SectorId

  /** Q2: Aspirational sector for demo exploration (Weaver+, optional) */
  exploreSector?: SectorId
}

type SectorId =
  | 'healthcare'
  | 'defense'
  | 'financial'
  | 'pharma'
  | 'education-k12'
  | 'education-higher'
  | 'government'
  | 'manufacturing'
  | 'research'
  | 'msp'
  | 'homelab'
  | 'other'
```

### Storage

- **Stored locally** in the user profile (SQLite database, same as existing user data)
- **Never transmitted** — no telemetry, no phone-home, no analytics endpoint
- **Offline-first license** (HMAC checksum) already guarantees no network egress — this is architecturally enforced, not just policy

### Privacy Disclosure

First-run setup UI must include:

> "This helps us personalize your experience. Sector data is stored locally on this server and is never transmitted externally."

This text must be visible next to the dropdown, not buried in a settings page.

---

## UI Integration Points

### 1. First-Run Setup Flow

Current flow: Admin user creation → Weaver

New flow: Admin user creation → **Sector selection (Q1, required)** → Weaver

- Full-width dropdown with all 12 sector options
- Privacy disclosure text below the dropdown
- Cannot skip — this is required for personalization to work
- "You can change this later in your profile settings" helper text

### 2. User Profile Page

- Q1 (work sector): editable dropdown, same 12 options
- Q2 (explore sector): editable dropdown, curated list (Weaver+ only)
  - Shown with tier badge if user is Free: "Upgrade to Weaver to explore other sectors"
  - Weaver+ users see the curated dropdown

### 3. Upgrade Nag (UpgradeNag.vue)

Current: Generic "This feature requires a weaver license" with static feature list

New: Sector-aware messaging that pulls from the user's Q1 sector:

| User Sector | Nag Message Example |
|-------------|-------------------|
| `education-k12` | "See how school districts use Weaver for FERPA compliance and lab provisioning" |
| `healthcare` | "See how healthcare IT teams use Weaver for HIPAA audit trails" |
| `defense` | "See how defense contractors use Weaver for CMMC assessment readiness" |
| `homelab` | "See what Weaver adds: Live Provisioning, AI diagnostics, managed bridges" (generic) |
| `other` | Same generic message |

For Weaver → Fabrick nags, the messaging shifts to Fabrick-specific compliance features for their sector.

### 4. In-Product Demo Slots (Weaver+)

Weaver users see two demo areas (location TBD — could be a dedicated page, a drawer, or embedded in the nag):

- **Slot 1 (locked to Q1):** "Weaver for [Your Sector]" — shows sector-specific Fabrick features using mocked data
- **Slot 2 (Q2, changeable):** "Explore: Weaver for [Aspirational Sector]" — shows a different sector's Fabrick demo

Demo content is sourced from the corresponding sales doc's Section 3 (Weaver) and Section 4 (Fabrick) — regulatory mapping, ROI math, and feature tables rendered as interactive UI.

---

## Nag Content Mapping

Each sector needs a nag content bundle. For sectors with completed sales docs, the content is extracted from the doc:

```typescript
interface SectorNagContent {
  sectorId: SectorId
  /** One-liner for the nag card */
  premiumPitch: string
  enterprisePitch: string
  /** Feature bullets pulled from sales doc Section 3/4 */
  premiumFeatures: string[]
  enterpriseFeatures: string[]
  /** Key regulation names for credibility */
  regulations: string[]
  /** ROI headline from sales doc */
  roiHeadline?: string
}
```

### Content Source Per Sector

| Sector | Weaver Pitch Source | Fabrick Pitch Source |
|--------|---------------------|----------------------|
| Healthcare | healthcare.md §3 | healthcare.md §4 |
| Defense | defense-contractor.md §3 | defense-contractor.md §4 |
| Financial | financial-services.md §3 | financial-services.md §4 |
| Pharma | pharma-life-sciences.md §3 | pharma-life-sciences.md §4 |
| Education (K-12) | education.md §3 | education.md §4 |
| Education (Higher Ed) | education.md §4 (university CIO persona) | education.md §4 |
| Government | government.md §3 | government.md §4 |
| Manufacturing | manufacturing.md §3 | manufacturing.md §4 |
| Research | research-hpc.md §3 | research-hpc.md §4 |
| MSP | msp.md §3 | msp.md §4 |
| Homelab | Generic | Generic |
| Other | Generic | Generic |

---

## Downstream Work Required

### Sales Docs — Complete

All 9 sector sales docs are written and follow the established 9-section pattern:

| Doc | Status |
|-----|:------:|
| `healthcare.md` | Done |
| `defense-contractor.md` | Done |
| `financial-services.md` | Done |
| `pharma-life-sciences.md` | Done |
| `education.md` | Done |
| `government.md` | Done |
| `manufacturing.md` | Done |
| `research-hpc.md` | Done |
| `msp.md` | Done |

### Code Changes

| Component | Change | Scope |
|-----------|--------|-------|
| First-run setup page | Add sector dropdown (Q1) + privacy disclosure | Frontend |
| User profile page | Add sector (Q1) + explore sector (Q2, tier-gated) | Frontend + Backend |
| User model / DB schema | Add `sector` and `explore_sector` columns | Backend |
| `UpgradeNag.vue` | Accept sector prop, render sector-specific messaging | Frontend |
| Sector nag content | Static content module with per-sector pitch/features/regulations | Frontend |
| Demo slot UI | New component for sector-specific demo previews (Weaver+) | Frontend |
| Health endpoint | Include sector in user profile response (local only) | Backend |
| E2E tests | First-run with sector, profile sector change, nag content verification | Testing |

### Documentation Updates

| Doc | Update |
|-----|--------|
| DEVELOPER-GUIDE.md | Sector field: storage, usage, privacy guarantees |
| Help page | Mention sector personalization, privacy disclosure |
| TIER-MANAGEMENT.md | Q1 (Free) vs Q2 (Weaver) tier gating |
| tier-matrix.json | Add sector personalization as a tier-gated feature |

---

## Language Policy: No "Hobbyist"

**Effective immediately:** The word "hobbyist" must not appear in any user-facing UI, nag text, demo content, or new documentation. The term diminishes users who are evaluating the product for professional use.

**Replacements:**
- "hobbyist" → remove or replace with role descriptor ("sysadmin," "self-hoster," "IT administrator")
- "home lab hobbyist" → "home lab" or "single node"
- "Hobbyists and evaluators" → "Evaluators and self-hosters"

**Existing instances** in business/planning docs should be cleaned up in a separate pass. User-facing code has been updated in this session.

---

## Open Questions

1. **"Home Lab / Personal" label** — is this the right label for users who genuinely aren't using the product at work? Alternatives: "Independent / Personal," "Self-Hosting," "Not work-related." Parking this for now.

2. **Multi-user sector** — Q1 is per-user. In a multi-user Fabrick deployment, different users may work in different sectors. The nag system should respect the *viewing* user's sector, not the admin's.

3. **Demo slot rendering** — is the sector demo a dedicated page (`/demo/sector`), a drawer triggered from the nag, or an overlay? Needs UX decision.

4. **Sector migration tracking** — Q1 changes over time (user changes jobs). Should we log sector changes for internal analytics? Conflicts with privacy-first posture. Leaning no.

---

*See [EXECUTION-ROADMAP.md](EXECUTION-ROADMAP.md) for the full v1.2.0 scope. See [IT-FOCUS-VALUE-PROPOSITION.md](../../business/sales/IT-FOCUS-VALUE-PROPOSITION.md) for the sales content that feeds sector demos.*
