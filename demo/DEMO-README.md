<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Demo Deployment

Instructions for deploying, maintaining, and resetting the Weaver public demo.

## Overview

The live demo is hosted at **[weaver-demo.github.io](https://weaver-demo.github.io)** using GitHub Pages. It runs in demo mode with:

- Mock VM service (no real systemd interaction)
- hCaptcha-gated login to prevent abuse
- Eight sample MicroVMs with simulated status (multi-distro, multi-hypervisor, varied states)
- Tier-switcher toolbar (Free / Weaver / Fabrick toggle)
- Version-switcher toolbar (v1.0–v3.3) with version-gated mock UI at every milestone
- Full dashboard functionality (start, stop, restart in mock mode)
- TUI preview with version parity (version-gated feature indicators)

### Private Demo (Investor)

The private demo extends the public demo with:

- Full tier-switcher (all 3 tiers with stage labels: Released / User Testing / In Development)
- Version-switcher (17 versions from v1.0 to v3.3) — each step shows new mock UI sections
- Version-gated features appear per milestone: containers (v1.1), GPU/firewall (v1.2), mobile (v1.3), AI vault (v1.4), secrets (v1.5), migration (v1.6), storage/templates (v2.0), snapshots (v2.1), peer federation (v2.2), fleet clustering (v2.3), backup (v2.4), fleet templates (v2.5), enterprise backup (v2.6), multi-host fleet (v3.0), workload groups + compliance (v3.3)
- TUI preview modal reflects the current demo version
- Standalone TUI (`--demo --version 1.4`) supports version stepping with ←/→ arrow keys

## Demo Architecture

```
┌─────────────────────────────────────────────────┐
│  GitHub Pages (weaver-demo.github.io) │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │  Static SPA (Quasar build output)         │    │
│  │                                            │    │
│  │  ┌────────────┐  ┌─────────────────────┐  │    │
│  │  │  Dashboard  │  │  Mock VM Service    │  │    │
│  │  │  Pages      │  │  (client-side)      │  │    │
│  │  └────────────┘  │                     │  │    │
│  │                    │  - In-memory state  │  │    │
│  │  ┌────────────┐  │  - Simulated delays  │  │    │
│  │  │  hCaptcha   │  │  - 8 sample VMs     │  │    │
│  │  │  Login Gate │  └─────────────────────┘  │    │
│  │  └────────────┘                            │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

## Deployment Methods

### Automated (GitHub Actions)

The demo is deployed automatically when a release tag is pushed:

1. The `release.yml` workflow builds the SPA with demo mode enabled.
2. The built assets are pushed to the `weaver-demo.github.io` repository.
3. GitHub Pages serves the updated content.

### Manual Deployment

If automated deployment fails or you need to deploy manually:

```bash
# 1. Clone the demo repo
git clone git@github.com:whizbangdevelopers-org/weaver-demo.github.io.git /tmp/demo-site

# 2. Build the dashboard in demo mode
cd /path/to/Weaver-Dev
VITE_DEMO_MODE=true VITE_HCAPTCHA_SITEKEY=<your-site-key> npm run build

# 3. Copy build output to demo repo
rm -rf /tmp/demo-site/*
cp -r dist/spa/* /tmp/demo-site/

# 4. Push to deploy
cd /tmp/demo-site
git add -A
git commit -m "Deploy v<version>"
git push origin main
```

The site should be live within 1-2 minutes after the push.

## Demo Mode Configuration

### Build-Time Variables

These environment variables must be set when building the demo:

| Variable | Value | Purpose |
| -------- | ----- | ------- |
| `VITE_DEMO_MODE` | `true` | Enables mock VM service |
| `VITE_HCAPTCHA_SITEKEY` | `<site-key>` | hCaptcha widget configuration |

### Runtime Behavior

When `VITE_DEMO_MODE=true`:

- The frontend uses `src/services/mock-vm.ts` instead of real API calls.
- All VM data is generated client-side (no backend needed).
- VM actions (start/stop/restart) modify in-memory state.
- State resets on page refresh.
- No network requests to a backend API are made.

## Tier-Switcher Toolbar

The demo includes a floating tier-switcher toolbar that lets visitors toggle between **Free**, **Premium**, and **Enterprise** feature sets in real time. This is the primary sales tool for the demo site -- visitors see exactly what they get at each tier without leaving the page.

### How It Works

- The toolbar appears as a persistent floating bar at the top of the dashboard.
- Clicking a tier button immediately updates the UI: features gated behind higher tiers appear or disappear, rate limit indicators change, and premium-only sections become visible or hidden.
- The tier state is held in the Pinia `app` store and read by the `useTierFeature` composable throughout the UI.
- The tier-switcher is only rendered when `VITE_DEMO_MODE=true`. It never appears in production deployments.

### Tier Visibility in Demo

| Feature | Free | Premium | Enterprise |
|---------|:----:|:-------:|:----------:|
| Dashboard + VM lifecycle | Yes | Yes | Yes |
| AI agent diagnostics | Yes (5/min) | Yes (10/min) | Yes (30/min) |
| Serial console | Yes | Yes | Yes |
| Network topology | Yes | Yes | Yes |
| Host info strip | -- | Yes | Yes |
| VM provisioning | -- | Yes | Yes |
| Push notifications | -- | Yes | Yes |
| Bridge management | -- | Yes | Yes |
| Audit log | -- | -- | Yes |
| Per-VM ACLs | -- | -- | Yes |
| Bulk VM operations | -- | -- | Yes |
| User quotas | -- | -- | Yes |

## hCaptcha and Demo Adoption

The demo login is gated by hCaptcha to prevent bot abuse. This section documents the tradeoffs.

**Why captcha-gated:** The demo runs on GitHub Pages with no backend rate limiting. Without a captcha, bots and scrapers can hit the login endpoint at scale, inflating analytics and potentially triggering GitHub Pages abuse detection.

**Adoption tradeoff:**

| Factor | Captcha Gated | Open Access |
|--------|:------------:|:-----------:|
| Bot abuse prevention | Strong | None |
| Friction for evaluators | Low (one click) | None |
| Mobile UX | hCaptcha mobile-optimized | N/A |
| Analytics accuracy | Real humans only | Inflated by bots |
| First-impression impact | Slight negative (extra step) | Positive (instant) |

**Current decision:** Keep captcha. The demo login is a single hCaptcha challenge (not per-action), so the friction is one click before full access. This is standard for SaaS product demos. The alternative -- removing the login entirely -- would mean the demo can't showcase the auth flow, role-based UI, or the first-run admin setup experience.

## Sample Data

The demo ships with eight sample MicroVMs defined in `src/config/demo.ts`:

| VM Name | Initial Status | Distro | Hypervisor | IP Address |
| -------------- | -------------- | ------ | ---------- | ---------- |
| `web-nginx` | Running | NixOS | QEMU | 10.10.0.10 |
| `web-app` | Running | NixOS | Cloud Hypervisor | 10.10.0.11 |
| `dev-python` | Running | Ubuntu 24.04 | QEMU | 10.10.0.20 |
| `db-postgres` | Running | Rocky Linux 9 | QEMU | 10.10.0.30 |
| `ci-runner` | Stopped | NixOS | Firecracker | 10.10.0.40 |
| `staging-env` | Failed | Alma Linux 9 | QEMU | 10.10.0.50 |
| `win-desktop` | Running | Windows 11 | QEMU | 10.10.0.60 |
| `monitoring` | Running | NixOS | QEMU | 10.10.0.70 |

This set demonstrates: multiple distros, multiple hypervisors, all status types (running/stopped/failed), and Windows support.

### Sample Data Source

The demo VM definitions live in `src/config/demo.ts` as the `DEMO_VMS` constant. This TypeScript file is the single source of truth -- there is no separate JSON file. The constant is imported by `src/services/mock-vm.ts` at runtime.

## Reset Procedures

### User-Level Reset

Users can reset the demo by refreshing the browser page. The mock VM service reinitializes to its default state on every page load.

### Full Site Reset

To reset the demo site to a clean state:

```bash
# Option 1: Trigger automated deployment
gh workflow run deploy-demo.yml --repo whizbangdevelopers-org/weaver-demo.github.io

# Option 2: Manual rebuild and deploy
cd /path/to/Weaver-Dev
VITE_DEMO_MODE=true npm run build
# ... copy and push (see Manual Deployment above)
```

### Cache Busting

GitHub Pages caches aggressively. After deployment, users may see stale content. To force a cache refresh:

1. Wait 10 minutes for GitHub's CDN cache to expire.
2. Or add a cache-busting query parameter: `https://weaver-demo.github.io/?v=<version>`
3. Or ask users to hard-refresh (Ctrl+Shift+R / Cmd+Shift+R).

## hCaptcha Configuration

The demo login uses hCaptcha to prevent automated abuse.

### Production Keys

Production hCaptcha keys are stored as GitHub repository secrets:
- `HCAPTCHA_SITEKEY` -- Injected at build time via `VITE_HCAPTCHA_SITEKEY`
- `HCAPTCHA_SECRET` -- Not needed for client-side demo (verification is mocked)

### Test Keys

For local development, use hCaptcha test keys:
- Site Key: `10000000-ffff-ffff-ffff-000000000000` (always passes)

See `docs/HCAPTCHA-SETUP.md` for full hCaptcha configuration details.

## Monitoring the Demo

### Availability Check

```bash
# Simple availability check
curl -s -o /dev/null -w "%{http_code}" https://weaver-demo.github.io
# Expected: 200
```

### GitHub Pages Status

Check GitHub Pages deployment status:
- Go to the demo repository on GitHub.
- Click **Settings > Pages**.
- Verify the deployment status shows "Your site is live."

## Troubleshooting

### Demo site shows 404

- Verify the demo repository contains an `index.html` at the root.
- Check GitHub Pages settings (source branch, directory).
- Wait a few minutes for deployment to propagate.

### hCaptcha widget not appearing

- Verify `VITE_HCAPTCHA_SITEKEY` was set during the build.
- Check browser console for script loading errors.
- Verify the domain is registered in the hCaptcha dashboard.

### Demo shows stale version

- Wait for CDN cache expiration (up to 10 minutes).
- Hard refresh the browser.
- Verify the latest commit in the demo repository matches the expected version.

### Mock VMs not responding to actions

- Check browser console for JavaScript errors.
- Verify `VITE_DEMO_MODE=true` was set during the build.
- Try refreshing the page to reset mock state.

## Known Issues

### Version switcher — navigating down leaves Fabrick content stale

Navigating DOWN with the version selector is not the inverse of navigating UP. The Fabrick fleet view does not update when stepping to a lower version — host cards, workload counts, and page content remain from the higher version. The tier switcher tab changes correctly (e.g. Fabrick → Free at v1.0) but the page content does not refresh.

**Expected behavior:** version-down navigation must trigger the same content refresh as version-up.

**Workaround:** none — manually reload the page after stepping down.

---

## Cost

The demo deployment has zero ongoing cost:
- GitHub Pages hosting: Free
- hCaptcha: Free tier (1000+ verifications/day)
- Domain: Using GitHub's `*.github.io` subdomain
