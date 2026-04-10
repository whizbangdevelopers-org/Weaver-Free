<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Two-Demo Strategy: Public & Private

**Last updated:** 2026-04-03
**Status:** Superseded by Decision #135 — rolling reveal funnel replaces static tier roadmap panel; private demo unchanged
**Decided:** 2026-03-04
**Depends on:** v1.0.0 release
**Superseded by:** [MASTER-PLAN.md Decision #135](../../MASTER-PLAN.md) — public demo becomes a marketing funnel with rolling reveal pattern, competitive TCO pricing page, identity/vision tier pages (no feature lists), tag-based deployment, and lead capture via WBD website Divi forms. The tier roadmap panel concept (§ Tier presentation on public demo) and evolution strategy table (§ Evolution strategy) are replaced.

---

## Summary

Split the demo into two instances: a **public marketing demo** (curated, Free-focused) and a **private strategic demo** (full tier-switcher, investor/internal use). The existing demo infrastructure becomes the private demo with minimal changes. The public demo is a new curated build deployed to GitHub Pages.

---

## Strategic Rationale

| Concern | Public Demo | Private Demo |
|---------|-------------|--------------|
| Competitive intelligence | Reveals only shipped Free features | Full roadmap visible — no leak risk |
| Expectation management | Users see what's ready; no "promises" for unshipped tiers | Investors see ambition + velocity |
| Perceived completeness | Polished, complete experience at Free tier | "In Development" labels are a feature, showing systematic progress |
| Pricing pressure | No premature tier price anchoring | Full tier economics visible for fundraising |

---

## Private Demo (existing infrastructure)

**Audience:** Investors, internal team, Forge accountability
**URL:** Internal/unlisted (not linked from public materials)
**Source:** Current demo build — no changes to codebase needed

### What it shows

- Full tier-switcher toolbar (Weaver Free / Weaver / Fabrick)
- All 3 VM data sets (3 / 6 / 10 VMs)
- All gated features visible when switching tiers
- Development stage labels on each tier button:

| Tier | Label |
|------|-------|
| Free | **Released** |
| Weaver | **User Testing** |
| Fabrick | **Fully Planned — In Development** |

### Implementation

1. Add stage labels to `DemoTierSwitcher.vue` buttons (subtitle text under each tier name)
2. Keep hCaptcha gate (prevents casual discovery)
3. Deploy to a separate unlisted URL or share as a local build
4. This is a **live running instance**, not a slide deck — investors see real data flowing through real gating middleware

### Value as internal tool

- If a feature doesn't have a slot on the private demo, it doesn't exist
- If a feature hasn't moved status in two sprints, that's visible
- Accountability infrastructure, not just a pitch deck

---

## Public Demo (new curated build)

**Audience:** Prospective users, community, search traffic
**URL:** `https://weaver-demo.github.io` (existing GitHub Pages target)
**Source:** Same codebase, different build configuration

### What it shows

| Section | Treatment |
|---------|-----------|
| **Free tier** | Fully functional — all Free features interactive with mock data |
| **Weaver tier** | Feature *categories* shown with descriptions + "Join the Beta" CTA |
| **Fabrick tier** | One-liner: "Fabrick tier coming — contact us for early access" |

### What it does NOT show

- No tier-switcher toolbar (users don't toggle between tiers)
- No granular Weaver/Fabrick feature lists (preserves flexibility, blocks competitor spec-reading)
- No "In Development" labels (avoids perceived incompleteness)

### Tier presentation on public demo

Instead of the tier-switcher, the public demo gets a **tier roadmap panel** (accessible from a menu item or banner CTA):

```
┌─────────────────────────────────────────────────────────┐
│  Weaver Editions                              │
│                                                          │
│  ✅ Free — Released                                      │
│     Weaver, VM management, network topology,          │
│     AI diagnostics (BYOK), real-time WebSocket           │
│     [You're using the Free demo now]                     │
│                                                          │
│  🔶 Weaver — Coming Soon                                 │
│     VM creation & provisioning, distro management,       │
│     managed bridges, push notifications, AI extensions   │
│     [Join the beta →]                                    │
│                                                          │
│  🏢 Fabrick — Contact Us                                 │
│     Team governance, access control, audit logging        │
│     [Request early access →]                             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Build configuration

| Flag | Value | Effect |
|------|-------|--------|
| `VITE_DEMO_MODE` | `true` | Enables demo mode (existing) |
| `VITE_DEMO_PUBLIC` | `true` | **New flag** — hides tier-switcher, shows curated tier panel |

The `VITE_DEMO_PUBLIC` flag controls:
- Hide `DemoTierSwitcher.vue` toolbar
- Show `DemoTierRoadmap.vue` panel (new component)
- Lock demo to Free tier only (no runtime tier switching)
- Replace Weaver/Fabrick gated features with "Coming Soon" placeholders instead of lock icons
- Add "Join the Beta" and "Request Early Access" CTAs with email capture or link targets

### Port assignments

Per project port strategy (registered in `.env.example` and `mcp-server/src/tools/port-layout.ts`):

| Purpose | Frontend | Backend |
|---------|----------|---------|
| Public demo (local testing) | 9030 | — (SPA-only) |
| Private demo (local testing) | 9040 | — (SPA-only) |

Both demos are pure SPA builds (mock data, no backend). Pre-allocated ports prevent collisions during Forge agent parallelism — agents can spin up either demo variant without port-conflict checks.

Local testing commands:
```bash
# Public demo
VITE_DEMO_MODE=true VITE_DEMO_PUBLIC=true QUASAR_DEV_PORT=9030 npx quasar dev

# Private demo
VITE_DEMO_MODE=true QUASAR_DEV_PORT=9040 npx quasar dev
```

### Deployment

- Public demo deploys via existing `demo-deploy.yml` workflow with `VITE_DEMO_PUBLIC=true`
- Private demo deploys separately (unlisted URL or local) without the public flag
- Same build script (`scripts/build-demo.sh`) handles both — flag determines which variant

---

## Evolution strategy

> "Keep the current demo as private and edit the public one as we move along"

**Yes.** The workflow is:

1. **Feature ships in a tier** → update public demo to show it as available
2. **Weaver launches** → public demo gains Weaver features (still curated, no Fabrick details)
3. **Fabrick launches** → public demo shows full product (at this point, consider merging back to single demo with tier-switcher)

The private demo always stays ahead — it shows the full roadmap including features still in development. The public demo is always a subset: only what's shipped or nearly shipped.

### Migration path

| Milestone | Public Demo Shows | Private Demo Shows |
|-----------|-------------------|-------------------|
| v1.0 launch | Free (full) + Weaver/Fabrick teasers | All three tiers with stage labels |
| Weaver beta | Weaver Free (full) + Weaver (beta CTA) + Fabrick teaser | All three tiers, Weaver label → "User Testing" |
| Weaver GA | Free + Weaver (full) + Fabrick teaser | All three tiers, Weaver label → "Released" |
| Fabrick beta | Free + Weaver + Fabrick (beta CTA) | All three, Fabrick → "User Testing" |
| Fabrick GA | Full tier-switcher (merge to single demo) | Retired or becomes next-version roadmap demo |

---

## New components needed

| Component | Purpose | Scope |
|-----------|---------|-------|
| `DemoTierRoadmap.vue` | Curated tier panel for public demo (replaces tier-switcher) | ~100 lines, static layout with CTA buttons |
| `DemoTierSwitcher.vue` update | Add stage subtitle labels to existing tier buttons | ~10 line edit |
| `build-demo.sh` update | Accept `VITE_DEMO_PUBLIC` flag, pass to Vite build | ~5 line edit |
| Conditional rendering | Check `VITE_DEMO_PUBLIC` to show roadmap panel vs tier-switcher | ~10 lines in layout |

### Email capture / CTA targets

| CTA | Target | Implementation |
|-----|--------|----------------|
| "Join the beta" | Google Form, Typeform, or GitHub Discussion link | External link — no backend needed |
| "Request early access" | Email link or same form with "Fabrick" tag | External link — no backend needed |

No email infrastructure needed at v1. External form services handle collection.

---

## Integration with existing plans

### MASTER-PLAN.md

Add to "In Progress" table:
```
| Two-demo strategy (public + private) | Planned — post v1.0 release |
```

### GTM-LAUNCH-PLAN.md

The public demo replaces the current single-demo concept in Track 2. The GTM plan's demo site deployment section should reference this plan for the two-demo split. All existing GTM content (README, blog, comparison pages) links to the **public** demo URL.

### EXECUTION-ROADMAP.md

Add decision log entry:
```
| #32 | Two-Demo Strategy | Public (curated Free + teasers) + Private (full tier-switcher + stage labels). Current demo → private. Public demo adds VITE_DEMO_PUBLIC flag. | 2026-03-04 |
```

---

## Priority relative to other v1 work

This is a **post-code, pre-launch** task. Sequence:

1. Clear remaining v1 release gates (smoke test, legal review) — **blocking**
2. Tag v1.0.0-rc1, verify workflows — **blocking**
3. **Implement two-demo split** — this plan
4. Deploy public demo to GitHub Pages
5. Execute GTM launch (content, community posts, blog)

Estimated effort: ~2 hours implementation (new component + flag wiring + build script update).

---

*Cross-reference: [GTM-LAUNCH-PLAN.md](GTM-LAUNCH-PLAN.md) | [MASTER-PLAN.md](../../MASTER-PLAN.md) | [EXECUTION-ROADMAP.md](EXECUTION-ROADMAP.md)*
