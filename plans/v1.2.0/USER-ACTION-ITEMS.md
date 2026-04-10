<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# User Action Items — v1.2.0 (Full Container Management + Firewall)

**Purpose:** Manual action items requiring human intervention for v1.2.0 release.
**Last updated:** 2026-03-04
**Status:** Pre-v1.2 — collecting items

For prior version items: [v1.0.0](../v1.0.0/USER-ACTION-ITEMS.md) | [v1.1.0](../v1.1.0/USER-ACTION-ITEMS.md)

---

## DECISIONS NEEDED

### GPU Passthrough Scope
- [ ] **Define GPU passthrough testing matrix** — Which NVIDIA/AMD cards are validated? What's the minimum driver version? This affects marketing claims.

### Firewall Extension Pricing
- [ ] **Set firewall extension price** — Per Decision #22, extensions are purchasable at tier minimums. Define price point for firewall extension.

---

## PRE-RELEASE

### Licensing & Legal
- [ ] **Legal/insurance review for firewall feature domain** — Per Decision #31, firewall rules = security claims = insurance exposure. Requires ToS/ToU review + insurance carrier touchpoint.
- [ ] **Extension purchase flow for firewall** — Stripe product, pricing page update.

### Content
- [ ] **Update README** — Full container management, GPU passthrough, firewall templates.
- [ ] **Blog post** — "The Closer: Complete Container Management in One Release" (product announcement).
- [ ] **Comparison page update** — vs Portainer, vs Cockpit (now with container management).

---

## RELEASE DAY

- [ ] **Tag v1.2.0** — After all gates pass.
- [ ] **Update CHANGELOG.md** — Container management, firewall templates, GPU passthrough.
- [ ] **Verify demo site** — Container creation flow, firewall UI, GPU config visible.

---

*Cross-reference: [EXECUTION-ROADMAP.md](EXECUTION-ROADMAP.md) | [MASTER-PLAN.md](../../MASTER-PLAN.md)*
