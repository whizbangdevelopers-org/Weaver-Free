<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Screenshot Images

Real-install screenshots for README, user guides, and marketing.
Captured manually from a running Weaver instance (not demo mode).

## Directory structure

```
docs/images/
  free/       ← Weaver Free experience (syncs to Weaver-Free repo)
  solo/       ← Weaver Solo experience (Dev only — excluded from Free sync)
  team/       ← Weaver Team experience (Dev only)
  fabrick/    ← FabricK fleet experience (Dev only)
  shared/     ← Tier-independent pages: login, help, compliance (syncs to Free)
```

## Capture convention

- **Source:** real install, not demo mode (no demo toolbar, no tier switcher)
- **Viewport:** 1280×720 (matches the E2E default)
- **Browser:** Chrome/Chromium (headless or headed)
- **When to recapture:** after any UI change that affects the pages shown in README or guides

## What goes where

| Image | Directory | Used by |
|---|---|---|
| Dashboard with VMs running | `free/dashboard.png` | README hero |
| Login page | `shared/login.png` | README, guides |
| Settings page | `free/settings.png` | ADMIN-GUIDE |
| Strands topology | `free/strands.png` | README, USER-GUIDE |
| Shed page (VM creation) | `solo/shed.png` | Solo marketing |
| FabricK fleet overview | `fabrick/fleet.png` | Fabrick marketing |

## Demo-mode screenshots

Auto-captured by `npm run e2e:demo-screenshots` into
`testing/e2e-docker/output/screenshots/`. These show the demo
toolbar and tier-switcher chrome — suitable for the pitch deck
(`business/investor/deck/img/`) but NOT for user-facing README/guides.
