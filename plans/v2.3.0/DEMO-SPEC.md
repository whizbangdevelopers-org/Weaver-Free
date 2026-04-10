<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Demo Spec — v2.3.0 (Fabrick Basic Clustering)

**Status:** Spec Only — Not Yet Built
**Target:** v2.3.0
**Created:** 2026-03-26
**Related:** [EXECUTION-ROADMAP.md](EXECUTION-ROADMAP.md)

---

## Overview

The v2.3.0 private demo mocks the Fabrick fleet onboarding flow for an enterprise client who arrives with an existing NixOS fleet. No real agent connections are made. The demo simulates fleet discovery, host registration, workload scan, and the Fabrick host roster — giving a presenter a complete walkthrough of the enterprise onboarding moment.

The version switcher activates the v2.3.0 / Fabrick tier demo state. All mock data is pre-seeded.

---

## Mock Fleet State

The demo pre-seeds a 3-host fleet:

| Host | Role | Workloads |
|------|------|-----------|
| `weaver-01` | Primary (local hub) | 3 MicroVMs: `web-nginx`, `web-app`, `svc-postgres` |
| `weaver-02` | Remote agent (Tailscale) | 2 MicroVMs: `dev-node`, `dev-python` |
| `weaver-03` | Remote agent (CIDR) | 1 MicroVM: `analytics-engine`, 1 container: `redis-cache` |

---

## Discovery Wizard Mock Flow

Launched from Fabrick page → "Add Hosts" button → wizard opens.

### Step 1 — Choose discovery method

Three tabs displayed:
- **Tailscale** (default, highlighted)
- **CIDR Range**
- **Manual / CSV**

### Step 2a — Tailscale path (default)

1. Text field: "Tailscale API key" with `tskey-api-...` placeholder
2. Admin enters key (or demo auto-fills a mock key)
3. "Scan Tailnet" button → animated spinner (1.5s simulated)
4. Result list appears:

```
✓ weaver-02   10.20.0.2   NixOS   Weaver agent detected
✓ weaver-03   10.20.0.3   NixOS   Weaver agent detected
  laptop-mark  10.20.0.5   macOS   No agent
```

5. Checkboxes pre-checked on agent-detected hosts only
6. "Register 2 hosts" button

### Step 2b — CIDR path

1. Text field: "CIDR range" with `10.20.0.0/24` placeholder
2. "Probe" button → animated scan progress bar (2s simulated)
3. Same result list as Tailscale, filtered to hosts responding on port 50051

### Step 2c — Manual / CSV path

1. Text area for hostname/IP list OR file upload button
2. "Connect" button → validates each entry

### Step 3 — Registration confirmation

- Progress: "Registering weaver-02... done. Registering weaver-03... done."
- Summary: "2 hosts registered. Scanning workloads..."

### Step 4 — Workload scan

- Animated: "Scanning weaver-02... 2 workloads found. Scanning weaver-03... 2 workloads found."
- "Done — view your fleet" button

### Step 5 — Fabrick host roster

Wizard closes. `/fabrick` view now shows all 3 hosts:

```
weaver-01  ●  Local hub    3 workloads   CPU 22%  MEM 48%
weaver-02  ●  Remote       2 workloads   CPU 11%  MEM 31%
weaver-03  ●  Remote       2 workloads   CPU 44%  MEM 62%
```

---

## Drill-Down Mock Flow

From the Fabrick host roster, clicking any host opens that host's **Weaver view** scoped to that host.

- Click `weaver-02` → Weaver view shows `dev-node`, `dev-python` with host badge `weaver-02`
- All normal Weaver workload actions available (start/stop/restart)
- Back button returns to `/fabrick`

---

## Rescan Mock Flow

In the Weaver view for `weaver-03`, a **Rescan** button appears in the host sub-toolbar.

1. Click Rescan → spinner (1s)
2. A fourth workload appears: `metrics-agent` (simulating drift — a container started outside Weaver)
3. Toast: "Rescan complete — 1 new workload found"

---

## Replay Button Behavior

The demo toolbar Replay button replays the discovery wizard flow (Steps 1–5) only:

- Replays: wizard open, Tailscale tab, scan animation, result list, registration, workload scan, host roster reveal
- Does NOT reset: existing `weaver-01` workload data, tier mock state, version switcher position

---

## Per-Tier Demo State

| Tier | Fabrick page behavior |
|------|-----------------------|
| Weaver Free | `/fabrick` route hidden (no nav entry) |
| Weaver Solo | `/fabrick` route hidden |
| Weaver Team | `/fabrick` shows upgrade prompt — "Fleet management requires Fabrick" |
| Fabrick | Full fleet roster + discovery wizard |

---

## Notes

- The discovery wizard never makes real network calls in the demo. All scan results, registration steps, and workload counts are pre-seeded mock data.
- The Tailscale API key field accepts any input in demo mode — no real API call is made.
- CIDR probe animation is cosmetic — result list is the same pre-seeded data regardless of input.
- The 3-host fleet is the minimum to make the fleet roster feel real. A single host would look like Weaver Solo, not Fabrick.
