<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Forge Build Infrastructure — Why It Matters for Weaver

**Date:** 2026-03-04
**Purpose:** Revenue acceleration justification for the Forge build server investment.

---

## Business Case

Without Forge: v1.0 → 18-20 months → v2.2, enterprise revenue year 2.
With Forge: v1.0 → 8-10 months → v2.2, enterprise revenue year 1.

Hardware investment: ~$120-210 (NVMe + PSU if needed). Everything else already in hand.
ROI: pays for itself month 1 of enterprise sales.

## What Forge Enables for Weaver

- **3 parallel agent sessions** on dedicated 128GB build server (darkfactory)
- **Live integration testing** on dedicated NixOS server (proxlab) with real microVMs
- **Docker E2E + real provisioning validation** — closes the testing gap mocked backends can't
- **v2.2 clustering test bed** — two NixOS machines as a natural cluster

## Revenue Timeline

| Milestone | Without Forge | With Forge |
|-----------|:------------:|:----------:|
| v1.1-v1.5 feature sprint | 12-14 months | 4-6 months |
| v2.0-v2.2 (disk, snapshots, clustering) | 18-20 months | 8-10 months |
| Enterprise revenue | Year 2 | Year 1 (month 10-12) |
| VMware migration window | Catches the tail | Catches the peak |

## Velocity Gate (Month 4-5)

If v1.2.0 lands by month 4-5 → triggers enterprise prep (Stripe, BSL, pricing page).
If not → fall back to single-agent pace, reassess.

---

## Detailed Documentation

All infrastructure specs, provisioning runbooks, agent allocation, and timelines live in the Forge repo:

| Topic | Forge Doc |
|-------|-----------|
| darkfactory hardware & NixOS setup | `Forge/infrastructure/darkfactory.md` |
| proxlab integration server | `Forge/infrastructure/proxlab.md` |
| Disk budget | `Forge/infrastructure/disk-budget.md` |
| Acceleration timeline | `Forge/infrastructure/timeline.md` |
| Agent allocation (all projects) | `Forge/AGENT-ALLOCATION.md` |
| ROCm / local LLM | `Forge/research/rocm-status.md` |
| CL-specific interaction | `Forge/projects/weaver.md` |

---

*Cross-reference: [market-conditions.md](../research/market-conditions.md) § Forge Acceleration Scenario*
