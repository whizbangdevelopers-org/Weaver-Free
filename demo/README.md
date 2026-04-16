<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Weaver - Demo Mode

Demo mode allows users to explore the Weaver without requiring a real backend or hypervisor infrastructure. All VM operations are simulated with mock data and realistic delays.

## How It Works

### Tier Switcher (`src/components/demo/DemoTierSwitcher.vue`)

A toolbar fixed at the bottom of the screen lets demo visitors toggle between Free, Premium, and Enterprise tiers. Switching tiers reactively shows/hides features:

- **Free**: Start/stop/restart, register existing VMs, read-only network topology, BYOK AI agent
- **Premium**: + Create/delete VMs, distro management, network management, push notifications, server AI key
- **Enterprise**: + Bulk operations, audit log, per-VM ACL, resource quotas

This uses `appStore.effectiveTier` which respects the `demoTierOverride` state in demo mode.

### Mock VM Service (`src/services/mock-vm.ts`)

The mock VM service provides an in-memory simulation of VM operations:

- **mockListVms()** - Returns all mock VMs with simulated network delay (200-500ms)
- **mockGetVm(name)** - Fetches a single VM by name (100-300ms delay)
- **mockStartVm(name)** - Simulates starting a stopped VM (500-1500ms delay)
- **mockStopVm(name)** - Simulates stopping a running VM (500-1500ms delay)
- **mockRestartVm(name)** - Simulates restarting a VM (1000-2500ms delay)
- **mockCreateVm(input)** - Simulates provisioning a new VM (500-1000ms delay)
- **mockDeleteVm(name)** - Simulates deleting a VM (300-800ms delay)
- **getMockVmState()** - Returns deep clone of current mock VM array
- **resetMockVms()** - Resets all VMs to their initial state

State mutations persist in memory for the session, so starting/stopping/creating/deleting VMs will be reflected in subsequent list calls.

### Demo Login Page (`src/pages/DemoLoginPage.vue`)

A standalone login page that gates demo access:

- Displays a branded entry card with project information
- Optionally shows an hCaptcha widget if `VITE_HCAPTCHA_SITEKEY` is configured
- If no captcha site key is set, the "Enter Demo" button is immediately available
- On entry, sets `localStorage['microvm-demo-mode']` to `'true'`, initializes the app store with demo defaults (provisioning enabled, server AI key present, bridge gateway), and navigates to `/dashboard`

### Demo Banner (`src/components/DemoBanner.vue`)

A persistent notification banner shown during demo mode:

- Renders when `VITE_DEMO_MODE` env var is `'true'` OR `localStorage['microvm-demo-mode']` is `'true'`
- Fixed position at the top of the viewport (z-index 9999)
- Orange/amber background with white text
- Shows "Demo Mode | Data resets weekly | Get Full Version" with a link to the GitHub repository
- Dismissible via a close button

### Sample VM Data (`src/config/demo.ts`)

The `DEMO_VMS` constant in `src/config/demo.ts` is the single source of truth for demo VM definitions. It is imported by `mock-vm.ts` at runtime. There is no separate JSON file -- keeping the data in TypeScript ensures type safety and prevents drift.

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `VITE_DEMO_MODE` | Set to `'true'` to enable demo mode globally | No |
| `VITE_DEMO_PUBLIC` | Set to `'true'` for public demo (hides tier-switcher, shows curated roadmap panel, locks to Free tier) | No |
| `VITE_HCAPTCHA_SITEKEY` | hCaptcha site key for the demo login page | No |

## Running the Demo

Two demo variants exist — see `plans/v1.0.0/TWO-DEMO-STRATEGY.md` for full rationale.

### Public demo (curated Free tier + "Coming Soon" teasers)

Port **9030** — for prospective users, community, search traffic:

```bash
VITE_DEMO_MODE=true VITE_DEMO_PUBLIC=true npx quasar dev --port 9030
```

### Private demo (full tier-switcher with stage labels)

Port **9040** — for investors, internal team, Forge accountability:

```bash
VITE_DEMO_MODE=true npx quasar dev --port 9040
```

No backend is needed for either variant — all API calls are handled by the mock service.

Optionally configure hCaptcha for public deployments:

```bash
VITE_HCAPTCHA_SITEKEY=your-site-key VITE_DEMO_MODE=true VITE_DEMO_PUBLIC=true npx quasar dev --port 9030
```

Navigate to `http://localhost:9030` (public) or `http://localhost:9040` (private) and click "Enter Demo".

## Integration Notes

- The mock service functions follow the same return types (`VmInfo`, `VmActionResult`) as the real API service, making it straightforward to swap between demo and production modes
- The `DemoBanner` component should be included in the root layout (e.g., `App.vue` or `MainLayout.vue`) so it appears on all pages during demo mode
- Demo login state persists in localStorage, so users remain in demo mode across page refreshes until they clear their storage
