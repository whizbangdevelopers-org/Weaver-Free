<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# User Action Items — v1.1.0 (Container Visibility + DNS + Topology)

**Purpose:** Manual action items requiring human intervention for v1.1.0 release.
**Last updated:** 2026-03-04
**Status:** Pre-v1.1 — collecting items

For v1.0 action items, see [v1.0.0/USER-ACTION-ITEMS.md](../v1.0.0/USER-ACTION-ITEMS.md).

---

## DECISIONS NEEDED

Full analysis: [APPLIANCE-TRIAL-REVIEW.md](user-action-docs/APPLIANCE-TRIAL-REVIEW.md) (6 findings from strategy review)

### Trial Tier vs Extension Model
The [APPLIANCE-TRIAL-STRATEGY.md](user-action-docs/APPLIANCE-TRIAL-STRATEGY.md) defines trial as "all premium features unlocked." Decision #22 established the plugin model at v1.1.0 (`requirePlugin()` middleware). Unresolved:
- [ ] **Define trial extension scope** — Does trial include all purchasable extensions, or just core weaver features? If a Weaver user must buy Firewall/DNS extensions separately, does a trial user get them free?
- [ ] **Extension trial mechanics** — Should trial unlock all extensions (maximum "wow" factor) or only core premium (accurate representation of what Weaver costs)?
- [ ] **Define `requirePlugin()` behavior for trial tier** — Code architecture: does trial pass `requirePlugin('dns')` checks? Tier ordering (`trial >= premium`) handles `requireTier()` but plugin checks are a separate middleware path.

### Appliance VM Version Target
- [ ] **Assign appliance VM to a release** — Currently "post-v1.0" with no specific version. Does it ship with v1.1.0 alongside containers? Or later? If v1.1, it should include Apptainer pre-installed for the container visibility demo.
- [ ] **Update appliance strategy with container runtimes** — Pre-install Apptainer in appliance VM, include sample SIF containers alongside CirOS VMs. The "single pane of glass" pitch needs both VMs and containers visible.

### Container Demo Data
- [ ] **Design mock container data for demo mode** — Define which container runtimes, images, and states appear in demo. Coordinate with `PREMIUM_VMS` / `ENTERPRISE_VMS` in `demo.ts`.

### Appliance Distribution & Marketing
- [ ] **Reframe time-to-value claims** — Docker = "60 seconds to dashboard" (quick look). Appliance = "10 minutes to real provisioning" (full experience). Current doc claims "under 60 seconds" for all paths, which oversells the appliance.
- [ ] **Design trial acquisition flow** — Is the OVA publicly downloadable from GitHub Release, or email-gated for lead capture? Keyless trial vs trial license key? Affects sales pipeline and license infrastructure.

---

## PRE-RELEASE

### Stripe Setup (Decision #39 — depends on entity formation from v1.0.0 action items)
- [ ] **Create Stripe account + verify business** — Requires LLC + EIN + bank account from v1.0.0 entity formation. Business verification can take days after submission.
- [ ] **Configure Stripe Tax** — Enable automated sales tax / VAT calculation for international sales.
- [ ] **Create Stripe products** — Weaver tier (subscription), DNS extension bundle, Auth extension bundle. Product IDs map to plugin IDs in entitlements.
- [ ] **Define extension bundle pricing** — Individual extensions vs category bundles. DNS bundle (dns-core + dns-resolver): $X/yr. Fabrick includes all.

### WordPress Customer Identity (Decision #39 — no WooCommerce, native accounts)
- [ ] **Enable WordPress user registration** — Native WP accounts or simple membership plugin (WP Members). This is the customer record linking Stripe + license keys + support.
- [ ] **Build "My Account" page** — Custom page template showing: license key, entitled extensions, expiry date, tier, link to Stripe Customer Portal for billing.
- [ ] **License key storage in WordPress** — Custom post type or DB table. Written by key generation webhook via WP REST API.
- [ ] **Two identity systems documentation** — Document for customers: WordPress account (purchase/support) vs Weaver account (product). They don't connect — self-hosted, no phone-home.

### Licensing & Legal
- [ ] **Legal/insurance review for container feature domain** — Per Decision #31, new feature domains require ToS/ToU review + insurance carrier touchpoint before release.
- [ ] **Extension purchase flow** — Stripe Checkout integration ready for Weaver launch. Key generation webhook delivers license key + signed entitlements (Decision #40).

### Content
- [ ] **Update README** — Container visibility features, Apptainer-first messaging.
- [ ] **Blog post** — "Managing Apptainer Containers Alongside MicroVMs" (target: HPC/research audience).
- [ ] **Update demo site** — Container cards, runtime badges, topology with elbows.

---

## RELEASE DAY

- [ ] **Tag v1.1.0** — After all gates pass.
- [ ] **Update CHANGELOG.md** — Container visibility, DNS extension, topology elbows.
- [ ] **Verify demo site** — Container mock data visible, topology elbows render, DNS features shown.

---

*Cross-reference: [EXECUTION-ROADMAP.md](EXECUTION-ROADMAP.md) | [MASTER-PLAN.md](../../MASTER-PLAN.md)*
