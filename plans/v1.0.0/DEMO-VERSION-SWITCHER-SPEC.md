<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Demo Version Switcher — Design Spec

**Status:** Implemented — version-gated mock UI for all 17 versions (v1.0–v3.3)
**Target:** Private demo (DemoTierSwitcher enhancement)
**Created:** 2026-03-25
**Related:** [TWO-DEMO-STRATEGY.md](TWO-DEMO-STRATEGY.md), [MASTER-PLAN.md](../../MASTER-PLAN.md)

---

## Overview

The private demo version switcher lets investors and internal reviewers step through mocked product versions (v1.0, v1.1, v1.2, v1.3, v2.0, ...) and see the full product state at each milestone. The tier tabs in `DemoTierSwitcher.vue` must reflect the **release status of each tier at the currently selected version** — not just the tier name.

---

## Tier Badge Design

Each tier tab label shows a release status suffix:

```
[ Weaver Free · Released ]  [ Weaver · Released ]  [ Fabrick · In Development ]
```

Status values:
- `· Released` — this tier shipped at or before the selected version
- `· In Development` — this tier is actively being built as of the selected version
- `· Planned` — this tier exists on the roadmap but work has not started

At v2.0, all three tabs show `· Planned` (nothing has shipped yet in the mock future). At v1.0, Free shows `· Released`, Weaver and Fabrick show `· Planned`.

---

## Version Registry

**Do not hard-code badge text.** Badge text must derive from a version registry so it stays accurate as new versions are added.

The version registry maps each version to the release status of each tier:

```typescript
type TierStatus = 'released' | 'in-development' | 'planned'

interface VersionEntry {
  version: string           // e.g. 'v1.0.0'
  label: string             // e.g. 'v1.0 · Mar 2026'
  tiers: {
    free: TierStatus
    weaver: TierStatus
    fabrick: TierStatus
  }
}
```

Example entries:

| Version | Free | Weaver | Fabrick |
|---------|------|--------|---------|
| v1.0.0 | released | planned | planned |
| v1.1.0 | released | in-development | planned |
| v1.2.0 | released | released | planned |
| v1.3.0 | released | released | planned |
| v2.0.0 | released | released | in-development |
| v2.1.0 | released | released | in-development |
| v3.0.0 | released | released | released |

This registry lives in a single source file (e.g. `src/config/demo-versions.ts`). When a new version is added to the master plan, the registry gets one new entry. No other component changes.

---

## Component Behavior

- When the version selector changes, the tier tab badges update immediately to reflect the new version's status
- The active tier selection is preserved when the version changes (user stays on Free if they were on Free)
- If the active tier's status is `planned` at the newly selected version, the tab still shows — it just displays `· Planned`
- Section-level show/hide (which pages and features exist at a given version) is a **separate concern** from the tier badge. Badges indicate release status; feature availability is controlled by the version's feature set registry

---

## Investor Walk-Through Value

The tab labels answer the two hardest investor questions inline:

- `v1.3 · Aug 2026` in the version selector tab → "when does this ship?"
- `Fabrick · In Development` → "how far along is enterprise?"

No separate roadmap slide needed — the version switcher IS the roadmap.

---

## Mock Architecture — Additive, Not Incremental

Each version mock represents the **complete product at that milestone** — not just the new features added in that version. A user stepping through v1.2 sees the full v1.2 product (everything from v1.0 + v1.1 + v1.2), not just the v1.2 delta.

This matters for the investor walk-through: curate 3–4 stops that tell a story arc, not a feature changelog. The stops should show visible leaps in capability (e.g., v1.0 → v1.3 → v2.0 → v3.0) rather than every incremental release.

Mocks are built version-by-version from the master plan. Each version's mock is complete and self-contained.

---

## Scope Boundary

This spec covers **tier status badges only**. Section-level feature gating (which pages appear at a given version) is a separate design problem. The two systems are independent: badge = status label on the tab; feature gate = what content renders inside the tab.

---

## Cross-References

- `TWO-DEMO-STRATEGY.md` — Public vs private demo split, VITE_DEMO_PUBLIC flag
- `plans/v1.3.0/DEMO-SPEC.md` — v1.3 wizard + mobile app mock flow
- MASTER-PLAN.md Decision #46 note: *"For investor presentations, walk 3–4 curated stops rather than every tab"*
