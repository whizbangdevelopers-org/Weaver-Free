<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Topology Elbow Routing Plan

**Purpose:** Orthogonal (90-degree) edge routing in the network topology diagram — a core Weaver/Fabrick visual feature that differentiates paid tiers and provides the rendering foundation for extension overlays.
**Created:** 2026-03-04
**Status:** DECIDED — implementation staged for v1.1.0
**Decision:** #32 in MASTER-PLAN.md
**Depends On:** v1.0 code reorganization (in progress), existing licensing infrastructure (v1.0 complete)

---

## Business Case

### Why This Matters

The network topology diagram is the first thing a prospect sees when evaluating Weaver. It communicates competence at a glance. Today, all tiers render identical straight diagonal lines between nodes — the same visual you'd get from a student project.

**Orthogonal elbow routing** — clean 90-degree turns connecting nodes through horizontal and vertical segments — is the visual language of professional network diagrams. Cisco, Juniper, VMware, and Proxmox's competitors all use this style. It signals "this tool understands infrastructure."

### Competitive Position (Pegaprox)

Proxmox's network view is flat — a simple list of interfaces with no topology visualization at all. Our topology diagram already beats it. Orthogonal routing makes the gap embarrassing:

| Product | Network Visualization |
|---------|----------------------|
| Proxmox VE | Flat list of bridges/interfaces — no topology |
| Weaver (Free) | Interactive topology with straight edges |
| Weaver (Weaver) | Orthogonal elbow routing + managed bridge visualization |
| Weaver (Fabrick) | Orthogonal routing + cross-segment traffic flow visualization |

### Investor Pitch Angle

This feature demonstrates three things investors care about:

1. **Visual tier differentiation** — switching between Free and Weaver in the demo produces an immediate, visceral upgrade. The diagram transforms from basic to professional in one click. This is the kind of "show don't tell" moment that closes deals.

2. **Platform thinking** — the elbow routing utility (`elbow-routing.ts`) is designed as a composable API that extensions consume. It's not a one-off visual tweak; it's infrastructure that the Firewall extension, DNS extension, and future overlays build on. This demonstrates architectural foresight.

3. **Monetization surface** — the feature is gated by license tier, not by extension purchase. It's part of the core value proposition of paying for Weaver. Extension overlays (firewall indicators, DNS paths) add additional value on top. Two revenue layers from one visual system.

---

## Tier Differentiation

| Tier | What the User Sees | What It Signals |
|------|-------------------|-----------------|
| **Free** | Straight diagonal lines, 1 bridge, 3 VMs | "Basic but functional" — the hook |
| **Weaver** | Orthogonal elbows, 2 managed bridges, 6 VMs, traffic flow arrows | "This admin knows their network" — professional credibility |
| **Fabrick** | Orthogonal elbows, 5 segmented bridges, 10 VMs, cross-segment routing | "This is a datacenter operations tool" — enterprise trust |

### Weaver Demo Upgrade

The current weaver demo has all 6 VMs on a single bridge, which doesn't showcase bridge management (a core weaver feature). This plan splits weaver into 2 bridges:

```
br-prod    10.10.0.0/24  — web-nginx, app-server, db-postgres
br-dev     10.10.1.0/24  — dev-python, ci-runner, staging-env
```

This makes the topology visually distinct from free and accurately represents a premium user's infrastructure.

Weaver also gets `PREMIUM_ROUTES` — a simple traffic flow (nginx → app-server → db-postgres) rendered as dashed amber directional edges. This gives weaver a taste of the fabrick route visualization.

---

## Extension Overlay Foundation

This feature is **not an extension** — it's a core tier capability. But it's designed as the visual foundation that purchased extensions build on:

| Extension | Version | Overlay Behavior |
|--------|---------|-----------------|
| **Firewall** | v1.2 | Shield/lock icons positioned at edge midpoints along elbow paths |
| **DNS** | v1.1 | Dotted DNS resolution lines following elbow geometry |
| **Hardening** | v1.2+ | Security policy indicators on path segments |

The `elbow-routing.ts` utility exposes:
- `computeElbowPath()` — SVG path string for rendering
- `getElbowWaypoints()` — array of elbow points for overlay positioning
- `pointAlongElbow()` — place a decoration at any fraction (0–1) along the path

Extensions import these functions directly — no dependency on the graph component.

---

## Technical Summary

**Library:** v-network-graph 0.9.22 (Vue 3)
**Mechanism:** `edge-overlay` slot renders custom SVG per edge
**Approach:** Make default straight edges transparent for premium/enterprise; draw orthogonal `<path>` elements in the overlay slot

### Visual Architecture

**Infrastructure edges** (host → bridge, bridge → VM):
```
    [Host]
      │              ← vertical drop
      ├────┐         ← horizontal at midpoint
      │    │
  [br-A]  [br-B]
   │  │    │  │
   ├──┤    ├──┤     ← horizontal spread at midpoint
   vm vm   vm vm
```

**Cross-bridge route edges** (VM → VM, fabrick):
```
  [br-edge]        [br-app]         [br-data]
   lb   api-gw    fe1 fe2 ord pay    db-p
   │     │         ▲   ▲   │   │      ▲
   └─────┼─────────┘   │   │   │      │    ← routing channel
         └─────────────┘   └───┼──────┘      above VM layer
                               └──────┘
```

### Files Modified

| File | Change |
|------|--------|
| `code/src/utils/elbow-routing.ts` | **New** — reusable path computation utility |
| `code/src/pages/NetworkMapPage.vue` | Add `edge-overlay` slot, tier-gated rendering |
| `code/src/config/demo.ts` | Split premium to 2 bridges, add `PREMIUM_ROUTES` |

### Production Scope

Licensing is already wired in v1.0 (`requireTier()`, HMAC license keys). Elbow rendering is gated by `appStore.isPremium` — works in both demo and production. No additional backend changes required.

Route edges (PREMIUM_ROUTES, ENTERPRISE_ROUTES) are demo-only mock data. In production, route data would come from actual network configuration or extension-generated topology.

---

## Implementation Plan

Full implementation details documented below.

**Steps:**
1. Update weaver demo data — split to 2 bridges, add PREMIUM_ROUTES
2. Create `elbow-routing.ts` utility with extension-friendly API
3. Add `edge-overlay` slot to NetworkMapPage.vue
4. Tier-gate rendering via `appStore.isPremium`
5. Make default edges transparent when elbows active
6. Wire weaver routes into edge graph

**Verification:** Demo tier switcher toggles Weaver Free → Weaver → Fabrick with visible rendering transitions. Drag, dark mode, and zoom all work with elbow paths.

---

## Timeline

| Milestone | When |
|-----------|------|
| v1.0.0 release | Current (code reorg in progress) |
| Implementation | Post-v1.0, pre-v1.1 |
| Ships with | **v1.1.0** (alongside DNS plugin, `requirePlugin()` middleware) |
| Pitch deck inclusion | Between v1.0 and v1.1 — demo screenshots available from dev branch |
