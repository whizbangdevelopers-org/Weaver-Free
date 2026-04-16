<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Screenshot Images

Real-install screenshots for README, user guides, and marketing.
Captured manually from a running Weaver instance (not demo mode).

## Directory structure

```
docs/images/
  free/
    v1.0/         ← Weaver Free v1.0 experience (syncs to Weaver-Free)
    v1.1/         ← created when v1.1 ships
  solo/
    v1.0/         ← Weaver Solo v1.0 (Dev only — excluded from Free sync)
  team/
    v2.2/         ← Weaver Team ships at v2.2 (Dev only)
  fabrick/
    v2.4/         ← FabricK clustering ships at v2.4 (Dev only)
  shared/
    v1.0/         ← Tier-independent pages: login, help (syncs to Free)
```

Each tier directory has version-stamped subdirectories. README and
guides reference the CURRENT version's images (e.g. `docs/images/free/v1.0/dashboard.png`).

When a new version ships:
1. Create the new version directory (e.g. `free/v1.2/`)
2. Capture fresh screenshots from the running install
3. Update README and guide image references to the new version
4. Old version directories stay frozen (used by `docs:snapshot` archives)

## Capture convention

- **Source:** real install, not demo mode (no demo toolbar, no tier switcher)
- **Viewport:** 1280×720 (matches the E2E default)
- **Browser:** Chrome/Chromium (headless or headed)
- **When to recapture:** after any UI change that affects the pages shown

## Naming convention

| Image | Path | Used by |
|---|---|---|
| Dashboard with VMs | `free/v1.0/dashboard.png` | README hero |
| Login / first-run setup | `shared/v1.0/login.png` | README, guides |
| Settings page | `free/v1.0/settings.png` | ADMIN-GUIDE |
| Strands topology | `free/v1.0/strands.png` | README, USER-GUIDE |
| Shed page (VM creation) | `solo/v1.0/shed.png` | Solo marketing |
| Peer monitoring | `team/v2.2/peers.png` | Team marketing |
| Fleet overview | `fabrick/v2.4/fleet.png` | Fabrick marketing |

## Demo-mode screenshots

Auto-captured by `npm run e2e:demo-screenshots` into
`testing/e2e-docker/output/screenshots/`. These show the demo
toolbar and tier-switcher chrome — suitable for the pitch deck
(`business/investor/deck/img/`) but NOT for user-facing README/guides.
