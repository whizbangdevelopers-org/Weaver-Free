<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v3.2.0 (Cloud Burst Self-Serve Billing)

**Last updated:** 2026-03-25
**Status:** Planned

Depends on: Cloud burst node enrollment infrastructure (v3.1.0).

v3.2 is a focused billing sprint. The node enrollment, GPU passthrough, and fleet management infrastructure already shipped at v3.1. v3.2 adds the self-serve commercial layer on top: Stripe metered billing, pre-purchase day pools, and scheduling integrations that open the AI-native lab market (self-serve buyers who want to spin up burst capacity without a sales call).

---

## Strategic Position

```
v3.1  Cloud burst node enrollment (large enterprise, invoice-based)
v3.2  Cloud burst self-serve billing (AI-native labs, self-serve)
```

v3.1 targets large fabrick accounts via direct sales (monthly invoice, account management). v3.2 opens self-serve: an AI lab buys a pool of 500 node-days, draws down as needed, gets automated renewal alerts. No sales call required. This is the expansion path from fabrick to PLG-style cloud burst purchasing.

---

## Scope

**Self-serve billing capabilities:**

| Task | Tier | Priority |
|------|------|----------|
| Stripe metered billing API integration — automated per-node-day charging | Fabrick | High |
| Pre-purchase day pools — customer buys N days, draws down as workloads run | Fabrick | High |
| Pool balance display in Fabrick dashboard (days remaining, burn rate) | Fabrick | High |
| Automated pool renewal notifications — alert at 20% remaining, auto-renew option | Fabrick | High |
| Self-serve pool purchase flow (Stripe checkout → license update) | Fabrick | High |
| GPU-aware scheduling hint API (Slurm/K8s bridge) — expose burst capacity to customer's scheduler | Fabrick | Medium |
| Pre-warmed node pool management — reduce cold-start latency for frequent burst users | Fabrick | Medium |
| Usage history and billing reports in Fabrick dashboard | Fabrick | Medium |

**Decisions resolved:** Decision #66 — v3.2 is the self-serve billing tier of the cloud burst split. Large enterprise stays on invoice (v3.1). Self-serve targets AI-native labs and research groups. See [FABRICK-CLOUD-BURST.md](../../business/product/FABRICK-CLOUD-BURST.md).

---

## Testing Strategy

v3.2 can be tested independently of edge fleet (v3.1 Phase 1). The Stripe integration requires sandbox testing with mock webhook payloads. The pre-purchase pool draw-down logic is pure backend with deterministic state transitions — well-suited for unit + integration test coverage without hardware dependencies.

---

## Release Plan

| Version | Milestone | Key Features | Status |
|---------|-----------|--------------|--------|
| v3.2.0 | Cloud Burst Self-Serve | Stripe metered billing, pre-purchase pools, GPU scheduling hints | Planned |

---

## Reference Plans

- Cloud burst infrastructure (prerequisite): [plans/v3.1.0/EXECUTION-ROADMAP.md](../v3.1.0/EXECUTION-ROADMAP.md)
- Fabrick Maturity (successor): [plans/v3.3.0/EXECUTION-ROADMAP.md](../v3.3.0/EXECUTION-ROADMAP.md)
- Cloud burst & AI/HPC analysis: [business/product/FABRICK-CLOUD-BURST.md](../../business/product/FABRICK-CLOUD-BURST.md)

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
