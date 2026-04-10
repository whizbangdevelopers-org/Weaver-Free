<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Homelab Credibility Features — v1.1.0
## Low-Effort, High-Recognition Features for the 81% Pipeline

**Date:** 2026-03-09
**Status:** Planned
**Related:** [EXECUTION-ROADMAP.md](EXECUTION-ROADMAP.md) (Also Shipping), [../../business/sales/IT-FOCUS-VALUE-PROPOSITION.md](../../business/sales/IT-FOCUS-VALUE-PROPOSITION.md)

---

## Context

81% of home lab users evaluate technology at home before recommending it at their employer. These features target that pipeline — they're what home lab users immediately compare when evaluating any VM management dashboard. Missing them signals "toy project"; having them signals "real product."

**Already implemented (v1.0.0):** Dark mode (auto/light/dark), host system overview (HostInfoStrip), VM uptime display, basic keyboard shortcuts (5 global keys), PWA/mobile responsive.

**Remaining credibility gaps addressed here:** Resource monitoring graphs, VM clone/template, config export, extended keyboard shortcuts.

---

## 1. VM Resource Monitoring Graphs

### The Gap

Home lab users open Proxmox → see CPU/RAM/disk/network graphs per VM. Open Weaver → no graphs. This is the single biggest credibility gap. Even basic sparklines close it.

### Design

**Tier model:**
- **Free:** 1-hour rolling window, 30-second resolution (120 data points per metric)
- **Weaver:** 24-hour rolling window, 30-second resolution (2,880 data points). Configurable retention via settings
- **Fabrick:** Fleet-wide resource dashboard (v2.2.0 — deferred to clustering release)

**Backend — Metric Collection:**

Source: systemd cgroups for MicroVM processes. Each MicroVM runs as `microvm@{name}.service` — systemd tracks CPU and memory automatically.

| Metric | Source | Method |
|--------|--------|--------|
| CPU usage (%) | `/sys/fs/cgroup/system.slice/microvm@{name}.service/cpu.stat` | Delta `usage_usec` between samples ÷ elapsed time |
| Memory usage (MB) | `/sys/fs/cgroup/system.slice/microvm@{name}.service/memory.current` | Direct read |
| Memory limit (MB) | `/sys/fs/cgroup/system.slice/microvm@{name}.service/memory.max` | Direct read (or VM's declared mem) |
| Disk usage (MB) | `du -s /var/lib/microvms/{name}/` | Periodic (every 60s, not every sample) |

Collection interval: 30 seconds (independent of the 2s WebSocket broadcast — metrics are heavier).

**Backend — Storage:**

In-memory ring buffer per VM, per metric. No database required for the 1-hour Free tier window.

```
MetricBuffer {
  vmName: string
  metric: 'cpu' | 'memory' | 'disk'
  samples: Array<{ timestamp: number, value: number }>  // fixed-size circular buffer
  maxSamples: 120 (Weaver Free) | 2880 (Weaver)
}
```

API endpoint: `GET /api/vms/:name/metrics?window=1h` (Free) or `?window=24h` (Weaver).

**Frontend — Visualization:**

Library: **uPlot** (lightweight, ~35KB, fast canvas rendering, time-series optimized). Alternative: vue-chartjs (heavier but more familiar).

Components:
- `VmMetricSparkline.vue` — inline sparkline on VmCard (CPU + RAM mini-charts)
- `VmMetricChart.vue` — full chart on VmDetailPage (CPU, RAM, disk with time axis)
- `useVmMetrics` composable — fetches metric data, manages polling interval

VmCard enhancement: two small sparklines (CPU %, RAM %) to the right of existing uptime display. Hover shows value. Click navigates to detail page metrics tab.

**Demo mode:** Generate realistic-looking synthetic metric data (sinusoidal with noise) so screenshots and demos show populated graphs.

### Effort Estimate

| Component | Effort |
|-----------|--------|
| Backend: cgroups metric collection service | 1.5d |
| Backend: ring buffer + API endpoint | 1d |
| Frontend: uPlot integration + sparkline component | 1.5d |
| Frontend: detail page chart component | 1d |
| Demo mode: synthetic metric data | 0.5d |
| Tests: unit + E2E for metrics flow | 1d |
| **Total** | **~6.5d** |

### Downstream Impact

- v2.2.0 clustering: node health monitoring builds on this metric infrastructure
- Resource alerts (Weaver notification feature): triggered by metric thresholds
- Fleet-wide dashboard (Fabrick): aggregates per-VM metrics across nodes

---

## 2. VM Clone/Template

### The Gap

"Clone this VM" is the most-used Proxmox feature after start/stop. Home lab users iterate by cloning — spin up a base config, clone it, tweak the clone. In a declarative system this is actually easier than imperative — duplicate the NixOS config, assign new name/IP, provision.

### Design

**Tier:** Weaver (requires Live Provisioning — cloning creates a new VM).

**Backend:**

New endpoint: `POST /api/vms/:name/clone`

Request body:
```json
{
  "name": "web-nginx-clone",       // required, validated unique
  "ip": "10.10.0.20",              // optional, auto-assign from bridge pool if omitted
  "tags": ["cloned"],              // optional, defaults to source VM tags
  "description": "Cloned from web-nginx"  // optional
}
```

Clone logic:
1. Read source VM's full config (distro, memory, vcpu, hypervisor, bridge, etc.)
2. Generate new NixOS config with new name + IP (reuse existing provisioner)
3. Validate uniqueness (name, IP, MAC)
4. Generate new MAC address
5. Provision via standard Live Provisioning pipeline
6. Return new VmInfo

**Frontend:**

- Clone button on VmDetailPage action bar + VmCard context menu (three-dot menu)
- `CloneVmDialog.vue` — pre-populated from source VM, editable name/IP/tags
- IP field: auto-suggest next available IP from bridge pool, or manual entry
- Name field: auto-suggest `{source}-clone` or `{source}-2`

**Does NOT clone disk state** — clones the VM definition and provisions a fresh instance from the same distro. This matches the declarative model: the config is the source of truth, not the disk. Users who need disk-level clones use NixOS tooling directly.

### Effort Estimate

| Component | Effort |
|-----------|--------|
| Backend: clone endpoint + validation | 1.5d |
| Frontend: CloneVmDialog component | 1.5d |
| Frontend: clone button integration (detail + card) | 0.5d |
| Tests: unit + E2E | 1d |
| **Total** | **~4.5d** |

---

## 3. Config Export Implementation

### The Gap

The help page documents `GET /api/vms/export` and `GET /api/vms/:name/export` with curl examples, but the endpoints don't exist yet. Self-hosters who script everything will try these immediately. Broken docs = credibility loss.

### Design

**Tier:** Free (already declared as Free-tier feature).

**Backend:**

Two endpoints in `vms.ts`:

`GET /api/vms/export` — returns JSON array of all VM configs (sanitized — no secrets, no runtime state).

`GET /api/vms/:name/export` — returns single VM config.

Export format: the same VmInfo shape used in the API, minus transient fields (status, uptime). Include: name, ip, mem, vcpu, hypervisor, distro, bridge, macAddress, tags, description, autostart, guestOs.

Response headers: `Content-Disposition: attachment; filename="microvm-export-{timestamp}.json"` for download.

**Frontend:**

- "Export" button on SettingsPage (export all) and VmDetailPage (export single)
- Triggers download via standard blob download pattern

### Effort Estimate

| Component | Effort |
|-----------|--------|
| Backend: two endpoints + serialization | 0.5d |
| Frontend: export buttons + download trigger | 0.5d |
| Tests | 0.5d |
| **Total** | **~1.5d** |

---

## 4. Extended Keyboard Shortcuts

### The Gap

Self-hosters keyboard-navigate everything. The existing 5 shortcuts (`?` `d` `s` `t` `n`) are a good start but missing the power-user essentials: navigating the workload list and acting on workloads without touching the mouse.

### Design

**Tier:** Free (adoption feature, not monetization).

**New shortcuts (extend `useKeyboardShortcuts.ts`):**

| Key | Context | Action |
|-----|---------|--------|
| `j` / `k` | Weaver workload list | Move focus down / up in workload list |
| `Enter` | Weaver, workload focused | Open focused workload detail page |
| `Shift+S` | VM detail or focused VM | Start VM |
| `Shift+X` | VM detail or focused VM | Stop VM |
| `Shift+R` | VM detail or focused VM | Restart VM |
| `Shift+?` | Global | Open keyboard shortcut overlay |
| `Escape` | Overlay/dialog open | Close overlay/dialog |
| `/` | Weaver | Focus search/filter input (when search ships) |

**Shortcut overlay:** Semi-transparent modal showing all available shortcuts, grouped by context (Global, Weaver, Workload Detail). Triggered by `Shift+?`. Dismisses on `Escape` or click-outside.

**Implementation:** Extend existing `useKeyboardShortcuts.ts` composable. Add focus-tracking state to workload list (currently no concept of "focused workload" without mouse hover — needs a `focusedWorkloadIndex` ref in the store).

### Effort Estimate

| Component | Effort |
|-----------|--------|
| Workload list focus management (j/k navigation) | 0.5d |
| Workload action shortcuts (Shift+S/X/R) | 0.5d |
| Shortcut overlay component | 0.5d |
| Tests | 0.5d |
| **Total** | **~2d** |

---

## Implementation Priority

| # | Feature | Effort | Credibility Impact | Why This Order |
|---|---------|:------:|:------------------:|----------------|
| 1 | **Resource monitoring graphs** | ~6.5d | Highest | #1 thing home lab users compare. Every screenshot needs this |
| 2 | **Config export** | ~1.5d | Medium | Broken docs are worse than no docs. Quick fix, unblocks scripting users |
| 3 | **Extended keyboard shortcuts** | ~2d | Medium | Power-user signal. Low effort, high "this person gets it" vibes |
| 4 | **VM clone/template** | ~4.5d | High | Most-used Proxmox feature. Requires Weaver = natural upsell |

**Total: ~14.5 days.** Can parallelize 2+3 (no overlap with 1). Critical path: resource graphs (6.5d) → clone (4.5d) = 11d sequential minimum.

---

## Tier Impact Summary

| Feature | Weaver Free | Weaver | Fabrick |
|---------|:----:|:-------:|:----------:|
| Resource graphs (1h) | ✓ | ✓ | ✓ |
| Resource graphs (24h+) | — | ✓ | ✓ |
| VM clone | — | ✓ | ✓ |
| Config export | ✓ | ✓ | ✓ |
| Keyboard shortcuts | ✓ | ✓ | ✓ |

Three of four features are Free-tier — this is deliberate. These are adoption gates, not revenue features. They make home lab users take the product seriously enough to recommend it at work, where Weaver and Fabrick close.

---

*See [EXECUTION-ROADMAP.md](EXECUTION-ROADMAP.md) for the full v1.1.0 scope. See [../../MASTER-PLAN.md](../../MASTER-PLAN.md) Future Feature Pipeline for the complete feature backlog.*
