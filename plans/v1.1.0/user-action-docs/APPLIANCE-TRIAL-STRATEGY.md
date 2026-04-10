<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Appliance VM & Trial Strategy

**Date:** 2026-02-25
**Status:** DECIDED — implementation deferred to post-v1.0 free release

---

## Problem

Weaver requires NixOS to demonstrate real VM provisioning. This limits evaluation to NixOS users. Sysadmins on Ubuntu, Fedora, Arch, macOS, or Windows can only see the static demo site — they can't experience the "see a real microVM spin up" moment that converts evaluators to users.

**Goal:** Let anyone on any OS experience the full product in under 60 seconds.

---

## Three Distribution Options (all ship)

### 1. Docker Image (free tier, any OS)

**Target:** Curious devs, CI pipelines, non-NixOS evaluators.

- Quasar frontend + Fastify backend in a single container
- Mock/demo data (uses existing demo mode infrastructure)
- `docker run -p 3100:3100 ghcr.io/whizbangdevelopers-org/weaver`
- First-run admin setup works, VMs are mock data
- **Ships with v1.0.0 free release** — lowest friction, widest reach
- ~200MB image (Node.js Alpine + built assets)
- 90% infrastructure already exists from E2E Docker setup (`testing/e2e-docker/`)

**What users see:** Full free-tier dashboard with mock VMs. Upgrade nags where weaver features would be. Working auth, WebSocket status, all free UI features.

**What users don't see:** Real VM provisioning, serial console, distro catalog mutations.

### 2. NixOS Appliance VM (premium trial, any OS with hypervisor)

**Target:** Serious evaluators, sysadmins considering VMware alternatives.

- QCOW2 + OVA built from NixOS config via `nixos-generators`
- Full dashboard + provisioning + CirOS pre-cached
- Boot → console shows `Weaver ready at http://localhost:3100`
- First-run admin setup → CirOS auto-provisions → real microVMs running
- ~800MB image (NixOS minimal + Node.js + dashboard + CirOS)
- **Ships as GitHub Release asset** — download link in README

**What users see:** Full premium experience with real VM provisioning, serial console, distro catalog, host info — everything.

### 3. Nix Flake (any Linux with Nix)

**Target:** Developers/power users already in the Nix ecosystem.

- `nix run github:whizbangdevelopers-org/Weaver-Free`
- Weaver-only (no provisioning without NixOS microvm.nix)
- Real backend + real auth + real data persistence
- **Deferred** — low priority, niche audience

---

## Trial Limitation Strategy (layered, data-driven)

### Research Summary (2025-2026 data)

| Strategy | Conversion Rate | Source |
|----------|----------------|--------|
| Time-limited trial (no CC) | ~18% average | First Page Sage, Userpilot |
| Calendar-based expiry alone | **-67%** vs behavioral triggers | 1Capture, Powered by Search |
| Usage-limited freemium | **+73%** vs feature-limited | ProfitWell 2025 SaaS Metrics |
| Freemium (no trial) | ~2.6% | First Page Sage 2026 Report |
| Hybrid (freemium + premium trial) | Fastest-growing model (65% of PLG SaaS) | First Page Sage, Amra & Elma |

**Key finding:** Time to first value must be under 10 minutes. CirOS auto-provision in the appliance VM achieves this in ~30 seconds.

**Key finding:** Calendar-based expiry alone underperforms by 67% vs behavioral triggers. Usage caps (e.g., max N VMs) convert 73% better than pure feature walls because the user has invested effort when they hit the wall.

### Decision: Layer All Three

Stack watermark + usage-cap + time-bomb. The order and weight matters:

**Layer 1: Watermark (always on, zero friction)**
- "PREMIUM TRIAL" badge in header bar
- `X-Trial: true` API response header
- Constant brand awareness, no UX disruption
- Implementation: CSS banner + Fastify `onSend` hook

**Layer 2: Usage-cap (primary conversion driver)**
- Max 5 VMs, 1 user, no custom distro imports
- Behavioral trigger: user hits the wall doing real work
- This is where 73% of conversion lift comes from
- Implementation: `maxVms` / `maxUsers` in trial config, checked at creation time

**Layer 3: Time-bomb (urgency layer, 30-day)**
- 30 days, not 14 — sysadmins evaluate slowly
- After expiry: drops to free tier (not dead)
- User keeps data, dashboard, free features
- Preserves freemium funnel instead of killing the install
- Implementation: `trialExpiry` ISO date in license, backend checks on startup

### Tier System Impact

```
TIER_ORDER: demo < free < trial < weaver < fabrick

tier: 'trial' behaves as:
  - All weaver features unlocked
  - Usage caps: maxVms=5, maxUsers=1, noCustomDistros=true
  - Watermark: trial banner in UI + API header
  - Expiry: trialExpiry date, auto-downgrade to 'free' on expiry
```

`requireTier(config, 'premium')` passes for trial (trial >= premium in tier order). Existing gates need no changes. Only new code: usage-cap enforcement + expiry check + watermark.

---

## Deliverables

### Docker Image (v1.0.0 free release)

| # | Item | Notes |
|---|------|-------|
| 1 | `Dockerfile` (production) | Multi-stage: build frontend+backend, copy to Node Alpine |
| 2 | `docker-compose.yml` (root) | One-command startup with health check |
| 3 | GitHub Actions workflow | Build + push to `ghcr.io` on release tag |
| 4 | README section | `docker run` quick start, screenshot |

### NixOS Appliance VM (post-v1.0)

| # | Item | Notes |
|---|------|-------|
| 1 | `nixos/appliance.nix` | VM config: dashboard + provisioning + CirOS pre-cached + MOTD |
| 2 | `scripts/build-appliance.sh` | Wraps `nixos-generators` → QCOW2 + OVA |
| 3 | Welcome MOTD | IP, dashboard URL, "premium trial" messaging |
| 4 | Trial watermark component | Banner in header + API response header |
| 5 | Usage-cap enforcement | maxVms, maxUsers checks in creation routes |
| 6 | Trial expiry logic | Backend startup check, auto-downgrade |
| 7 | GitHub Release asset | Attach OVA to release |

### Nix Flake (deferred)

| # | Item | Notes |
|---|------|-------|
| 1 | `flake.nix` outputs | `packages.x86_64-linux.default` = dashboard service |
| 2 | README section | `nix run` quick start |

---

## Sources

- [SaaS Free Trial Conversion Rate Benchmarks — First Page Sage](https://firstpagesage.com/seo-blog/saas-free-trial-conversion-rate-benchmarks/)
- [SaaS Freemium Conversion Rates: 2026 Report — First Page Sage](https://firstpagesage.com/seo-blog/saas-freemium-conversion-rates/)
- [Free Trial Conversion Benchmarks 2025 — 1Capture](https://www.1capture.io/blog/free-trial-conversion-benchmarks-2025)
- [SaaS Average Free Trial Conversion Rate — Userpilot](https://userpilot.com/blog/saas-average-conversion-rate/)
- [B2B SaaS Trial Conversion Rate Benchmarks — Powered by Search](https://www.poweredbysearch.com/learn/b2b-saas-trial-conversion-rate-benchmarks/)
- [Best Free Trial Conversion Statistics 2025 — Amra & Elma](https://www.amraandelma.com/free-trial-conversion-statistics/)
- [Optimizing SaaS Trial Conversion Rates — Nalpeiron](https://nalpeiron.com/blog/saas-trial-conversions)
