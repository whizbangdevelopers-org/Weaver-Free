<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Fabrick Cloud — Managed SaaS Control Plane

**Created:** 2026-03-22
**Type:** Managed SaaS add-on (additive to Fabrick subscription, v4 Path A)
**Status:** Planned — product spec stub. Pre-sell gate opens at v3.0 GA. Engineering: v4.0 target.

---

## What Fabrick Cloud Is

Fabrick Cloud is the WBD-hosted version of the Fabrick control plane. The customer's on-prem Weaver nodes connect outbound to a WBD-managed hub; WBD operates the fleet orchestration infrastructure so the customer does not have to.

**What the customer already has without Fabrick Cloud:**
- Weaver on each node (per-host workload management)
- Fabrick self-hosted (Fabrick, included): the customer runs their own Fabrick hub on one of their nodes, orchestrating the fleet themselves

**What Fabrick Cloud adds:**
- WBD runs the hub infrastructure — the customer's on-prem nodes connect to it
- No single node is also the control plane; no hub failover to manage
- SLA-backed uptime for the control plane (customer nodes run independently if cloud connection is lost)
- Fleet-level telemetry, alerting, and AI diagnostics backed by WBD infrastructure
- Foundation for marketplace and SDK platform (Path A) — the hub becomes the integration point for third-party extensions and ISV tooling

**What Fabrick Cloud is not:**
- A replacement for on-prem Weaver (each node still runs Weaver)
- A replacement for on-prem Fabrick (customers can run both)
- A data residency play — customer workloads run on-prem; only control-plane metadata (config state, metrics, events) transits to the WBD hub
- A competitor to the self-hosted option — it is an operational convenience tier for customers who do not want to manage hub infrastructure

---

## Stack Relationship

```
Customer infrastructure:
  Node 1: Weaver (on-prem) ─┐
  Node 2: Weaver (on-prem) ─┤──→ Fabrick Cloud (WBD-hosted hub)
  Node N: Weaver (on-prem) ─┘

Without Fabrick Cloud:
  Node 1: Weaver + Fabrick hub (self-hosted) ─┐
  Node 2: Weaver (on-prem)                    ├── local gRPC mesh
  Node N: Weaver (on-prem)                    ┘
```

Fabrick subscription pays for per-node Weaver. Fabrick Cloud is a per-node-per-year add-on for the managed hub.

---

## Pricing

| SKU | Price | Billing | Tier requirement |
|---|---|---|---|
| Fabrick Cloud — Founding Member (FM) | **$150/yr/node** | Annual, per node enrolled in cloud hub | Fabrick only |
| Fabrick Cloud — standard | **$200–250/yr/node** | Annual, per node | Fabrick only |

**FM window:** Opens at v3.0 GA. Closes at v4.0 GA. Founding Member rate locked forever for enrolled nodes at time of signup.

**Standard pricing range:** $200–$250/yr/node. Final standard rate set before v4.0 GA based on infrastructure cost actuals and demand signal from the pre-sell cohort.

**Revenue model note:** Per-node billing mirrors the Fabrick base subscription. A customer with 10 nodes adding Fabrick Cloud adds $1,500/yr (at $150/node FM) on top of their existing Fabrick subscription. The add-on is approximately 4–8% of the Fabrick base at v3.0 pricing — positioned as a low-friction upgrade, not a second major purchase.

---

## Pre-Sell Mechanism

The Fabrick Cloud pre-sell at v3.0 GA is the Path A demand validation gate. This is not a marketing exercise — it is the primary signal that determines whether v4.0 engineering proceeds on the Platform SaaS path.

### How it works

1. **At v3.0 GA:** Fabrick Cloud pre-sell opens to existing Fabrick customers and new prospects
2. **Customer commits:** Signs up at $150/yr/node FM rate, billed upon v4.0 GA delivery
3. **WBD commits:** Delivers Fabrick Cloud v4.0 within 24 months of v3.0 GA, or issues full pre-sell refunds
4. **Customer receives:** Founding Member rate locked forever + Design Partner status during v4.0 development
5. **At v4.0 GA:** Billing begins; pre-sell converts to active subscriptions

### Design Partner status (Founding Members)

Founding Member customers (pre-sell cohort) receive:
- Direct input into Fabrick Cloud feature prioritization
- Early access to v4.0 beta builds (private beta, direct NDA)
- Named acknowledgment in release notes (opt-in)
- Founding Member rate locked forever, independent of future standard pricing increases

### WBD delivery commitment

If Fabrick Cloud v4.0 is not delivered within 24 months of v3.0 GA:
- Full pre-sell fee refunded (no pro-ration, no deductions)
- FM rate offer renewed for an additional 12 months
- Public acknowledgment of the delay and revised timeline

The 24-month window is intentionally conservative relative to the v4.0 estimated engineering timeline. It exists to make the pre-sell an honest commitment, not a speculative deposit.

---

## Path A Validation Criteria

The pre-sell cohort size at v3.0 GA is the binary decision gate for v4.0 architecture:

| Pre-sell signal | Decision |
|---|---|
| **≥ 20 Founding Member customers by v3.0 GA** | Proceed with Path A (Platform SaaS + SDK + marketplace) |
| **< 20 Founding Member customers by v3.0 GA** | Pivot to Path B (AI vertical: CUDA/ROCm inference fleet, or K-12 deployment) |

20 customers is the floor, not the target. At $150/yr/node × 5-node average × 20 customers = $15,000/yr pre-sell ARR. The revenue is not the validation signal — the commitment rate is. 20 paying commitments from Fabrick customers who understand the product roadmap is a strong signal; fewer than that indicates insufficient demand to justify the platform engineering investment.

The pre-sell gate must be evaluated honestly. Reaching 18 customers and calling it "close enough" defeats the purpose of the gate. The gate exists to protect the engineering investment — Path B has its own strong economics and should not be treated as a fallback.

---

## Feature Specifications by Version

### v4.0 — Core Managed Plane

| Feature | Description |
|---|---|
| WBD-hosted Fabrick hub | TLS-authenticated, Weaver nodes connect outbound (no inbound firewall changes required) |
| Fleet overview dashboard | All enrolled nodes: status, health, active workloads, recent events |
| Multi-node workload management | Create, start, stop, migrate workloads across enrolled nodes |
| Centralized audit log | Unified event stream across all nodes, queryable by time, node, user |
| SLA-backed uptime | 99.9% control plane uptime. Node operations continue independently if cloud connection drops (local-first architecture) |
| AI diagnostics — fleet scope | Pattern detection across nodes: correlated failures, fleet-wide anomalies, predictive alerts |
| Access control | SSO/SAML backed by WBD authentication layer; customer controls user roles |

### v4.1 — Platform Foundation

| Feature | Description |
|---|---|
| Marketplace (read-only) | Browse certified third-party extensions from ISVs |
| SDK beta (invite-only) | Extension development kit for ISV partners; documented API contracts |
| Webhook delivery | Fleet events delivered to customer endpoints (PagerDuty, Datadog, custom) |

### v4.2 — Marketplace GA

| Feature | Description |
|---|---|
| Marketplace GA | Publish and install certified extensions; per-extension revenue share with ISVs |
| API platform | Public API for customer-built integrations; rate-limited by plan |
| Multi-tenant isolation | Separate fleet namespaces for MSP customers managing multiple client fleets |

---

## What Fabrick Cloud Does Not Do

| Capability | Status | Notes |
|---|---|---|
| Host customer workloads | Not in scope | Workloads run on customer's on-prem nodes, not in WBD infrastructure |
| Replace on-prem Weaver per node | Not in scope | Each node still requires an Fabrick license |
| Replace on-prem Fabrick hub | Not in scope | Customers can continue using self-hosted Fabrick if preferred |
| Air-gap deployments | Not applicable | Air-gapped customers use on-prem Fabrick; Fabrick Cloud requires outbound connectivity |
| Data residency guarantees | v4.1+ | Control-plane metadata stored in WBD infrastructure (US region initially); regional data residency options targeted for v4.1 |

---

## Implementation Notes

### Engineering Scope Estimate

| Component | Scope | Notes |
|---|---|---|
| WBD hub infrastructure (multi-tenant Fabrick) | 6–8 weeks | Kubernetes-hosted; multi-tenant isolation; TLS mutual auth |
| Weaver node cloud enrollment agent | 2–3 weeks | Outbound-only connection; local-first (node operates independently if cloud unreachable) |
| Fleet dashboard UI | 3–4 weeks | New SaaS frontend; multi-node view; audit log query |
| AI fleet diagnostics | 2–3 weeks | Builds on existing per-node AI (§6/§12 TCO); aggregates cross-node |
| Billing integration (Stripe metered) | 1–2 weeks | Per-node enrollment count; monthly invoice for large fleets |

**Total v4.0 core estimate:** 14–20 weeks engineering.

### Pre-Sell Requirements (Before Gate Opens at v3.0 GA)

The following must exist before the pre-sell window opens:

- [ ] This product definition (this document)
- [ ] Pre-sell terms page: delivery commitment, refund policy, what Founding Member status includes
- [ ] Stripe product: `prod_fabrick_cloud_ea` with pre-sell price `price_fabrick_cloud_ea_150`
- [ ] Landing page (minimal): what Fabrick Cloud is, Founding Member rate, commit button
- [ ] Internal communication to existing Fabrick customers (direct outreach, not blast)
- [ ] Path A/B decision tracking: live counter of pre-sell commitments vs. 20-customer gate

### License Key Integration

Fabrick Cloud enrollment is node-level, verified at the WBD hub against the node's Fabrick license key. No new key prefix. The cloud enrollment flag is server-side (WBD controls it), not key-encoded — avoids key reissue when customers add/remove nodes from cloud management.

### Stripe Billing

Separate Stripe Product: `prod_fabrick_cloud`. Pre-sell price: `price_fabrick_cloud_ea_150` (deferred billing — charges when v4.0 ships). Standard price: `price_fabrick_cloud_std` (set at v4.0 GA based on final rate decision).

---

## Revenue Model

### Pre-sell scenario (at v3.0 GA gate)

| Pre-sell size | Avg nodes/customer | ARR on conversion |
|---|---|---|
| 20 customers (gate) | 5 nodes | $15,000/yr at $150/node |
| 20 customers (gate) | 10 nodes | $30,000/yr at $150/node |
| 50 customers (upside) | 10 nodes | $75,000/yr at $150/node |

### Standard scenario (post-v4.0, 24 months)

| Scale | Avg nodes | ARR at $200/node std |
|---|---|---|
| 50 customers | 8 nodes | $80,000/yr |
| 100 customers | 8 nodes | $160,000/yr |
| 200 customers | 10 nodes | $400,000/yr |

At 200 customers × 10 nodes × $200/yr = $400,000/yr incremental ARR on top of Fabrick base subscription — a meaningful platform revenue layer without requiring any new Fabrick customers. Existing Fabrick customers upgrading to Fabrick Cloud convert to a higher ARPU with no additional sales cost beyond the initial offer.

---

## Relationship to V4-FUNDING-GAP-ANALYSIS.md

The V4 funding analysis (Change 5) models Fabrick Cloud pre-sell as a demand signal and revenue contributor at v3.0 GA. Key numbers from that analysis:

- Pre-sell target: 20 Founding Members × 5-node avg × $150/yr = $15,000/yr → $30,000/yr (with expansion at v4.0)
- Full platform ARR at Year 4 base case: included in V4 projections
- The pre-sell gate directly determines v4.0 engineering resource allocation

If the gate is not reached, the $400K+ platform ARR scenario does not materialize — but Path B (AI vertical) has its own independent revenue model that does not depend on Fabrick Cloud adoption.

---

*Cross-reference: [TIER-MANAGEMENT.md](TIER-MANAGEMENT.md) | [FABRICK-CLOUD-BURST.md](FABRICK-CLOUD-BURST.md) | [V4-FUNDING-GAP-ANALYSIS.md](V4-FUNDING-GAP-ANALYSIS.md) | [FABRICK-VALUE-PROPOSITION.md](FABRICK-VALUE-PROPOSITION.md) | [RELEASE-ROADMAP.md](RELEASE-ROADMAP.md)*
