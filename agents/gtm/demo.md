<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: gtm-demo — Demo Site Deployment

**Plan:** [GTM-LAUNCH-PLAN](../../plans/v1.0.0/GTM-LAUNCH-PLAN.md) (Track 2)
**Parallelizable:** Yes (independent of content)
**Blocks:** None

---

## Scope

Deploy a live demo site at `weaver-demo.github.io` that showcases the dashboard in mock mode. Visitors see a realistic dashboard with sample VMs, can interact with read-only features, and get a clear call-to-action to install.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `src/services/mock-vm.ts` | Existing mock VM service |
| `demo/sample-vms/` | Existing sample VM data |
| `src/config/` | Frontend configuration |
| `quasar.config.cjs` | Build configuration |
| `.github/workflows/sync-to-free.yml` | Workflow pattern for deploy-demo |
| `plans/GTM-LAUNCH-PLAN.md` | Demo requirements |

---

## Inputs

- Existing mock VM service with canned responses
- Existing PWA build target
- GitHub Pages for hosting (free, auto-SSL)
- Demo repo: `weaver-demo.github.io`

---

## Outputs

### Build & Deploy

| File | Type | Description |
|------|------|-------------|
| `scripts/build-demo.sh` | New | Build PWA with DEMO_MODE=true env flag |
| `src/config/demo.ts` | New | Demo-specific config (mock API base, sample data) |
| `.github/workflows/deploy-demo.yml` | New | GitHub Actions: build on release tag → push to demo repo |
| `demo/sample-vms/extended.json` | New | Enhanced sample VM set (8 VMs) |

### Demo Mode Features

| Component | File(s) | Description |
|-----------|---------|-------------|
| Demo banner | `src/components/DemoBanner.vue` | New — sticky top bar: "Demo Mode — [Install →] [GitHub →]" |
| Demo detection | `src/config/demo.ts` | `DEMO_MODE` env var check |
| Mock API routing | `src/services/api.ts` | Modify — when demo mode, use mock responses instead of HTTP |
| Demo auth bypass | `src/stores/auth-store.ts` | Modify — auto-login as "demo" user, viewer role |
| Mutation blocking | Various components | Show "Demo mode — install to use this feature" toast on mutations |

### Sample VM Set

| VM Name | Status | Distro | Hypervisor | IP | Guest OS |
|---------|--------|--------|------------|-----|----------|
| web-nginx | running | NixOS | QEMU | 10.10.0.10 | linux |
| web-app | running | NixOS | Cloud Hypervisor | 10.10.0.11 | linux |
| dev-python | running | Ubuntu 24.04 | QEMU | 10.10.0.20 | linux |
| db-postgres | running | Rocky Linux 9 | QEMU | 10.10.0.30 | linux |
| ci-runner | stopped | NixOS | Firecracker | 10.10.0.40 | linux |
| staging-env | failed | Alma Linux 9 | QEMU | 10.10.0.50 | linux |
| win-desktop | running | Windows 11 | QEMU | 10.10.0.60 | windows |
| monitoring | running | openSUSE Leap | QEMU | 10.10.0.70 | linux |

This set showcases: multiple distros, multiple hypervisors, all three status types (running/stopped/failed), Windows guest, varied use cases.

### Mock Behavior

| Feature | Demo Behavior |
|---------|--------------|
| Weaver | Sample VMs with simulated 2-second WebSocket updates |
| VM detail | Full detail pages with mock data |
| Network map | Topology graph with bridge + all 8 VMs |
| Status changes | Simulated: VMs randomly flicker status to show real-time updates |
| Start/Stop | Show confirmation dialog, then toast: "Demo mode — install for real VM control" |
| Create VM | Show form, validate, then toast: "Demo mode" |
| Serial console | Simulated terminal output (mock session) |
| AI diagnostics | Mock agent responses (existing mock mode) |
| Help system | Fully functional (no backend needed) |
| Settings | Viewable, edits show demo toast |
| Network management | Viewable, mutations show demo toast |

### GitHub Pages Deployment

```yaml
# .github/workflows/deploy-demo.yml
name: Deploy Demo Site
on:
  release:
    types: [published]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: DEMO_MODE=true npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          deploy_key: ${{ secrets.DEMO_DEPLOY_KEY }}
          external_repository: whizbangdevelopers-org/weaver-demo.github.io
          publish_branch: main
          publish_dir: dist/pwa
```

---

## Demo Banner Design

```
┌────────────────────────────────────────────────────────────┐
│ 🔍 You're viewing a demo  |  [Install] [GitHub] [Docs]    │
└────────────────────────────────────────────────────────────┘
```

- Fixed to top of page, above MainLayout header
- Accent color background (not intrusive but visible)
- Links: Install guide, GitHub repo, documentation
- Dismissible (per session)

---

## Build Script

```bash
#!/usr/bin/env bash
# scripts/build-demo.sh
set -euo pipefail

echo "Building demo site..."
export DEMO_MODE=true
export NODE_ENV=production

# Build PWA (static, no backend needed)
npx quasar build -m pwa

echo "Demo build complete: dist/pwa/"
echo "Deploy to GitHub Pages or serve statically"
```

---

## Tests

| File | Type | Description |
|------|------|-------------|
| `testing/unit/config/demo.spec.ts` | New | Demo mode detection, mock routing |
| `testing/e2e/demo.spec.ts` | New | Demo banner visible, mutations show toast, mock data loads |

---

## Acceptance Criteria

1. `DEMO_MODE=true npm run build` produces a working PWA
2. Demo site loads in browser with no backend required
3. Demo banner visible at top with Install/GitHub/Docs links
4. All 8 sample VMs visible on dashboard
5. Network map renders with bridge + VM topology
6. VM detail pages show full mock data
7. Start/Stop/Restart buttons show "demo mode" toast
8. Create VM form works but shows demo toast on submit
9. Mock AI diagnostics work (existing mock mode)
10. Help system fully functional
11. Mobile responsive layout works in demo
12. Simulated WebSocket updates show status changes
13. GitHub Actions workflow deploys to demo repo on release

---

## Estimated Effort

Demo mode infrastructure (config, mock routing): 1 day
Enhanced sample data: 0.5 days
Demo banner + mutation blocking: 0.5 days
Build script + GitHub Actions: 0.5 days
Testing: 0.5 days
Total: **3 days**
