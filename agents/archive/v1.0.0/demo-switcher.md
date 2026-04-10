<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-M-3-demo-switcher — Demo Tier-Switcher Toolbar

**Priority:** Medium #3
**Tier:** Demo
**Parallelizable:** After v1-H-1-tier-enforcement (needs tier gates in place to switch between)
**Plan:** [EXECUTION-ROADMAP Phase 6 — Demo Site](../../../plans/v1.0.0/EXECUTION-ROADMAP.md)

---

## Scope

Add a floating toolbar to the demo site that lets visitors toggle between Free/Premium/Enterprise tier views in real time. Same gating middleware as production — the switcher just overrides the tier at runtime. This is the demo site's primary selling feature: see exactly what each tier unlocks.

### What's Already Done

- `scripts/build-demo.sh` — builds PWA in demo mode
- `.github/workflows/demo-deploy.yml` — deploys to GitHub Pages
- `.github/workflows/demo-reset.yml` — weekly data reset
- `config.tier` resolved from license key (production) or defaults to `demo`
- `useTierFeature.ts` — frontend tier gating (reads `appStore.tier` → `appStore.isPremium` / `appStore.isEnterprise`)
- `UpgradeNag.vue` — upgrade prompt component
- App store `tier` state with `isPremium`, `isEnterprise`, `isDemo` getters

### What's Missing

- Demo tier-switcher toolbar component
- Runtime tier override in demo mode
- Visual indicator of current demo tier
- Tier-switcher only renders when `VITE_DEMO_MODE=true`

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `src/stores/app.ts` | `tier` state and getters — override strategy must work with existing getters |
| `src/composables/useTierFeature.ts` | Reads tier from app store — verify it reacts to tier changes |
| `src/layouts/MainLayout.vue` | Layout — toolbar placement |
| `scripts/build-demo.sh` | Sets `VITE_DEMO_MODE=true` |
| `src/router/index.ts` | Router guards that check tier — ensure override propagates |

---

## Key Decision: Frontend-Only Override

**Decision:** The demo tier-switcher is **frontend-only**. The backend continues running at its configured tier (demo). This means:

- UI elements correctly show/hide based on the overridden tier
- API calls from the demo site still succeed (backend is permissive in demo mode)
- Rate limiting reflects the backend's actual tier, not the frontend override
- This is acceptable because the demo's purpose is to **showcase UI/UX per tier**, not to simulate backend enforcement

If full-stack simulation is needed later, it can be added as a `?tier=free` query param that the backend reads in demo mode. But for v1.0.0, frontend-only is sufficient.

---

## Outputs

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/components/demo/DemoTierSwitcher.vue` | New | Floating toolbar: 3 toggle buttons (Free/Premium/Enterprise) + current tier badge |
| `src/stores/app.ts` | Modify | Add `demoTierOverride` state + `setDemoTier()` action; modify `tier` getter to check override |
| `src/layouts/MainLayout.vue` | Modify | Conditionally render `<DemoTierSwitcher />` when `import.meta.env.VITE_DEMO_MODE` |

### Tests

| File | Type | Description |
|------|------|-------------|
| `src/__tests__/demo-tier-override.spec.ts` | New | Unit test: override tier in app store, verify getters react |
| `testing/e2e/demo-switcher.spec.ts` | New | E2E: switch tiers, verify features lock/unlock (see E2E Notes) |

---

## Implementation Strategy: Override the Getter, Not the State

The original approach (`effectiveTier` getter + rename all `appStore.tier` reads) would touch 10+ files. Instead:

**Override `tier` itself at the getter level:**

```typescript
// In app store state
demoTierOverride: null as Tier | null,

// Modify the existing tier getter behavior using a computed-style approach:
// The tier property already exists as state. Instead of a getter rename,
// add a computed getter that checks the override:

get activeTier(): Tier {
  if (import.meta.env.VITE_DEMO_MODE && this.demoTierOverride) {
    return this.demoTierOverride
  }
  return this.tier
}
```

**Wait — this still requires renaming reads.** Better approach: use a watcher in the switcher component that actually mutates `this.tier` when in demo mode, and guard `initialize()` against overwriting the demo override:

```typescript
setDemoTier(tier: Tier) {
  if (!import.meta.env.VITE_DEMO_MODE) return
  this.demoTierOverride = tier
},
```

Then modify the existing getters to check `demoTierOverride` first:

```typescript
getters: {
  // All existing getters use effectiveTier internally
  effectiveTier: (state): Tier => {
    if (import.meta.env.VITE_DEMO_MODE && state.demoTierOverride) {
      return state.demoTierOverride
    }
    return state.tier
  },
  isDemo(): boolean { return this.effectiveTier === 'demo' },
  isFree(): boolean { return this.effectiveTier === 'free' },
  isPremium(): boolean { return TIER_ORDER[this.effectiveTier] >= TIER_ORDER.premium },
  isEnterprise(): boolean { return this.effectiveTier === 'enterprise' },
  isLicensed(): boolean { return this.effectiveTier !== 'demo' },
  serverKeyAllowed(): boolean {
    return this.hasServerKey && TIER_ORDER[this.effectiveTier] >= TIER_ORDER.premium
  },
}
```

This confines all changes to `app.ts` getters. No other files change. All existing `appStore.isPremium`, `appStore.isEnterprise`, etc. reads automatically react to the demo override.

**Key:** `effectiveTier` is internal to the store getters. External code continues using `isPremium`, `isEnterprise`, etc. Zero rename burden.

---

## UI Design

```
┌─────────────────────────────────────────────────────────────────┐
│  [MainLayout toolbar]                                            │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────┐
                    │  View as:                      │
                    │  [Free] [Premium●] [Enterprise]│
                    └──────────────────────────────┘
                         ↑ floating bottom toolbar
```

- Fixed position bottom-center, semi-transparent background
- Active tier button highlighted with primary color
- Switching tier immediately updates all `useTierFeature` gates
- Tooltip: "Switch tier view to see what each plan unlocks"
- Only rendered when `VITE_DEMO_MODE=true` (never in production)

---

## Persistence

**Selected demo tier persists in sessionStorage** (not localStorage). On new tab, starts at Premium. This prevents a visitor who switched to Free from getting a broken experience on return.

Implementation: `DemoTierSwitcher.vue` reads `sessionStorage.getItem('demo-tier')` on mount and calls `appStore.setDemoTier()`. On switch, writes to sessionStorage.

---

## Health Endpoint Override Guard

`appStore.initialize()` fetches `/api/health` and sets `this.tier`. In demo mode, this would overwrite the demo override. Guard:

```typescript
async initialize() {
  // ... existing fetch logic ...
  this.tier = (data.tier ?? 'demo') as Tier
  // Don't clear demo override — it's separate state
  // effectiveTier getter handles priority: demoTierOverride > tier
}
```

Since `effectiveTier` checks `demoTierOverride` first, `initialize()` can safely set `this.tier` without affecting the demo experience. No guard needed — the architecture handles it.

---

## Flow Notes

`DemoTierSwitcher.vue` calls `appStore.setDemoTier('free')` → sets `demoTierOverride` in store.
All getters (`isPremium`, `isEnterprise`, etc.) read `effectiveTier` which checks `demoTierOverride` first.
`useTierFeature.ts` reads `appStore.isPremium` / `appStore.isEnterprise` — automatically reactive.
Components using `v-if="appStore.isEnterprise"` re-render immediately.
Router guards checking tier re-evaluate on next navigation.

---

## Acceptance Criteria (Concrete Feature Assertions)

1. Demo site shows floating tier-switcher toolbar at bottom-center
2. Clicking Free/Premium/Enterprise switches tier view instantly
3. **Free view**: Create VM button hidden, bulk actions hidden, server AI key disabled, Audit nav hidden, distro/bridge management hidden, push notifications hidden
4. **Premium view**: Create VM button visible, server AI key enabled, Audit nav hidden, bulk actions hidden
5. **Enterprise view**: All features visible including Audit nav, bulk actions, quotas
6. UpgradeNag shows when viewing features gated above current demo tier
7. Tier-switcher never renders in production builds (`VITE_DEMO_MODE` absent)
8. Tier-switcher never renders in dev mode (unless `VITE_DEMO_MODE=true`)
9. Selected tier persists in sessionStorage within a tab session
10. Health endpoint refresh does not reset the demo tier override
11. All existing tests pass
12. `npm run test:precommit` passes

---

## E2E Notes

E2E Docker does **not** set `VITE_DEMO_MODE=true` by default. Two approaches:

**Option A: Separate demo E2E build** — Build with `VITE_DEMO_MODE=true`, run demo-specific specs against it. Heavier but accurate.

**Option B: Unit test only** — Test the app store override logic and component rendering via Vitest. Skip E2E for demo-specific UI. The demo site has its own deploy workflow that validates it.

**Recommended: Option B for v1.0.0.** The demo site is a marketing tool, not a production feature. Unit tests for the store override + component rendering cover the logic. The demo deploy workflow (`demo-deploy.yml`) serves as integration validation. If demo E2E becomes valuable later, add it as a separate CI job.

---

## Tier Blind Spot Mitigation

This is a **demo-only** feature. It cannot be tested on premium localhost or in standard E2E.

**Mitigation:**
- Unit tests verify `effectiveTier` getter, `setDemoTier()` action, and getter reactivity
- Component unit test verifies DemoTierSwitcher renders only when `VITE_DEMO_MODE=true`
- Manual verification: `VITE_DEMO_MODE=true npm run dev` to test locally before commit
- Demo deploy workflow validates the full build and deploy pipeline

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| App store override (effectiveTier + getters) | 20 min |
| DemoTierSwitcher component | 30 min |
| MainLayout conditional render | 5 min |
| Unit tests (store + component) | 20 min |
| Manual demo mode verification | 15 min |
| **Total** | **~1.5 hours** |

---

## Documentation

| Target | Updates |
|--------|----------|
| `src/pages/HelpPage.vue` | Update demo mode description with tier-switcher |
| `docs/DEVELOPER-GUIDE.md` | Add demo mode section: VITE_DEMO_MODE, effectiveTier, DemoTierSwitcher |
