<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver — Founding Member Program

**Created:** 2026-03-22
**Revised:** 2026-04-07 — Decision #142: Team $199/user/yr ($129 FM), FabricK $2,000/yr first node ($1,299 FM). AI Pro/AI Fleet retired — Smart Bridges included in base price. Champion Credit section removed (consider standalone Champion Program).
**Status:** Active — Weaver Solo FM open at v1.0 launch. Fabrick FM open at v1.0 launch (20 seats). Weaver Team FM opens at v2.1.

---

## Overview

Standard pricing reflects the fully delivered product. Founding Member pricing is available while key capability milestones remain unshipped — it prices roadmap trust, not delivered software. Each tier's window is tied to a specific version cap. The window closes when that version ships; all active Founding Members are grandfathered at their purchase price for life.

**The version execution cap** is the version at which:
1. The feature gap justifying the discount is closed
2. Standard pricing activates for all new customers
3. Existing Founding Members receive permanent price lock

This is a one-time founding window per tier, not a recurring sale.

---

## Pricing Table

| Tier | Standard Price (at cap) | Founding Member Price | Cap Version | Quantity Cap | FM Discount | Availability |
|------|:-----------------------:|:-------------------:|:-----------:|:------------:|:-----------:|:------------:|
| Weaver Solo | $249/yr | **$149/yr** | v1.2 "The Closer" | **First 100** | **40% off forever** | Open at v1.0 launch |
| Weaver Team | $199/user/yr | **$129/user/yr** | v2.2 Multi-Host | **First 50 teams** | **35% off forever** | Opens at v2.1 |
| Fabrick (256GB) | $2,000/yr/node | **$1,299/yr/node** | v2.2 Multi-Host | **First 20** | **35% off forever** | Open at v1.0 launch |
| Fabrick (512GB) | $2,500/yr/node | **$1,750/yr/node** | v2.2 Multi-Host | **First 10** | **30% off forever** | Open at v1.2 launch |

**Window closes when EITHER triggers first:** the quantity cap is reached OR the cap version ships. Whichever comes first permanently closes the FM window for that tier.

---

## Success Program Pricing (FM vs Standard)

Success Programs follow the same FM logic as software licenses: FM pricing is available while WBD is building the service delivery capability and case studies needed to justify standard rates. The FM window closes when sufficient delivery capacity exists — no version cap, closes by internal decision.

| Program | FM Price | Standard Price | Response SLA |
|---------|:--------:|:--------------:|:-----------:|
| Community (included) | $0 | $0 | Best effort |
| Adopt | $5,000/yr | $15,000/yr | 24h (business days) |
| Adopt — Compliance | — | $25,000/yr | 24h (business days) |
| Accelerate | $15,000/yr | $45,000/yr | 4h (24/7) |
| Partner | $30,000/yr | $90,000/yr | 1h (24/7) |

**Adopt — Compliance** has no FM price. During the FM period, compliance evidence needs are served by the flat-rate Compliance Export Extension ($4,000/yr) instead:

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = **$9,000/yr** total compliance coverage. Standard Adopt — Compliance ($25,000/yr) includes hands-on compliance service delivery — framework mapping sessions, evidence walkthroughs, BAA/SSP/ATO documentation — that the extension alone does not provide.

Vertical-specific service content for each program is documented in the [sales/](sales/) vertical docs.

---

## Cap Rationale (Version + Quantity)

Each FM tier has two closing triggers — a **version cap** (closes when features ship) and a **quantity cap** (closes when founding slots fill). Whichever fires first ends the window.

### Weaver Solo — v1.2 OR 100 customers

**Version cap (v1.2):** v1.0 ships Live Provisioning, 5-hypervisor support, AI diagnostics, mobile, and the core dashboard. These are genuine differentiators. But the container management story — the feature that closes the "I need Portainer AND a VM dashboard" objection — doesn't land until v1.2. Before The Closer, a buyer comparing Weaver to Proxmox + Portainer is evaluating an incomplete unified-management claim.

After v1.2: "MicroVMs + Apptainer + Docker + GPU from one pane" is the complete pitch. At that point $249/yr is well-justified and still 35% below Proxmox Community (€355/yr). Before that, $149/yr rewards roadmap trust and equals the pre-v1.2 standard price. The FM program does not discount below the market — it freezes the price at the pre-feature-complete level.

**Quantity cap (100):** Base case projects ~10 Solo customers before v1.2 ships. Best case: ~15. The 100-cap protects against a viral launch spike (front-page HN, Reddit) locking 500+ customers at $149 forever. 100 is enough to seed a community of potential enterprise champions. Cost: 100 × ($249 − $149) = $10K/yr maximum foregone revenue — the price of 100 sysop-as-champion pipeline entries. Without the cap, the foregone revenue is unbounded.

### Fabrick (256GB) — v2.2 OR 20 customers

**Version cap (v2.2):** Fabrick buyers expect a specific capability checklist. Multi-node visibility + manual VM migration ships at v2.2. Before v2.2, an enterprise buyer receives RBAC, quotas, bulk ops, audit log, all extensions — on a single-host product. That justifies $1,299/yr from early believers who want to shape the roadmap.

After v2.2: the product is a fleet management tool, not a single-host dashboard. That justifies $2,000/yr from the open market — approaching Canonical MAAS ($2,500/yr) while remaining far below OpenShift ($3,000–9,200/yr).

**Quantity cap (20):** Fabrick Founding Members are also **Design Partners** — the 20 who help build the v2.2–v3.0 clustering roadmap. The pricing discount is partial payment for that contribution. 20 is the right number: enough for meaningful feedback diversity, small enough that each design partner gets genuine roadmap influence.

### Fabrick (512GB) — v2.2 OR 10 customers

Same version rationale as 256GB. **Quantity cap (10):** High-RAM nodes are AI/HPC deployments. Fewer customers, higher stakes. 10 design partners is sufficient for this segment.

### Weaver Team — v2.2 OR 50 teams (opens at v2.1)

**Version cap (v2.2):** Weaver Team doesn't exist until v2.2. Offering FM pricing for a non-existent tier at v1.0 launch is selling vapor — buyers would be committing 18–24 months early with no delivery guarantee. The Team FM window opens at v2.1 (one version before Team launches), close enough to delivery to be credible, early enough to capture demand. Do not offer Team FM at launch.

**Quantity cap (50 teams):** The window is short (v2.1→v2.2, maybe 2–3 months). 50 teams is generous for that window. Cost: 50 × 3 users × ($199 − $129) = $10.5K/yr maximum foregone revenue — immaterial. The cap creates scarcity and makes "founding team" status feel valuable.

---

## Base Product Scope (What the FM Lock Covers)

The FM price lock applies to the **base product** — workload management, networking, storage, clustering, HA, RBAC, audit, and all features in the Integrated Extensions Catalog that are listed as "included" (DNS, auth, hardening, secrets, backup at tier level). This is the product as designed at FM program launch.

**AI/Inference capabilities are included in the base tier pricing (Decision #142).** AI Pro and AI Fleet were originally designed as separate extensions (Decision #120) but were retired when Smart Bridges was baked into the Team and FabricK base price. FM customers receive all AI capabilities — diagnostics, Smart Bridges, model deployment, GPU scheduling, inference routing — at their locked FM rate. No additional extension cost.

The only remaining paid extension is **Compliance Export** ($4,000/yr flat, Decision #104) — vertical-specific, not horizontal.

> **TODO:** Consider a formal Champion Program — referral credits, testimonial recognition, community contribution rewards — as a standalone initiative independent of AI extension pricing. The sysop-as-champion pipeline mechanics (referrals, case studies, conference talks, merged PRs) are valuable regardless of what benefit they unlock. Evaluate when FM program is active and referral data exists.

---

## Grandfathering Terms

**Price lock:** Founding Member price is locked at the purchase rate, for the node/user count at purchase. Annual renewal stays at FM price indefinitely while the subscription remains active. **Extension pricing is independent** — extensions (Compliance Export, Fabrick Cloud) are purchased at published extension pricing regardless of base product FM status. AI capabilities (Smart Bridges, model deployment, GPU scheduling, inference routing) are included in the base tier price per Decision #142.

**Expansion:** Additional nodes or users above the original purchase count are priced at **standard pricing** at time of expansion — not at FM rate. The FM lock covers the initial commitment; growth is priced at market. (Exception: Fabrick FM customers adding nodes within 12 months of initial purchase pay a published FM expansion rate of **$1,600/yr/node** — Stripe self-serve, no negotiation required. After 12 months or v3.0 GA, whichever comes first, standard additional node pricing applies — $1,250/yr (2-4), $1,000/yr (5-9), $750/yr (10+).)

**Lapse:** If an FM subscription lapses past the 30-day grace period, re-activation is at standard pricing. The FM lock is permanently lost on lapse.

**Upgrade path:** An FM Weaver Solo customer moving to Fabrick is offered the FM Fabrick price if the Fabrick FM window is still open; otherwise standard Fabrick.

---

## Fabrick Design Partner Terms

Fabrick Founding Members receive Design Partner status automatically.

### What WBD provides:

| Benefit | Details |
|---------|---------|
| Roadmap influence | Quarterly roadmap review call. Design partner feature requests weighted in v2.2–v3.0 planning. |
| Direct Slack channel | `#design-partners` — async access to founding engineers |
| Release notes credit | Named in release notes for features shaped by their input (or private, if preferred) |
| Early access | RC builds available 2 weeks before GA on all v1.x–v2.x releases |
| Architecture review | 1 session (up to 4 hours) included at onboarding |
| Compliance mapping | NixOS → SOC 2 / HIPAA / CMMC mapping session included |

### What design partners commit to:

- Respond to 2 roadmap surveys/year (async, ~15 min each)
- Provide 1 written testimonial or case study within 12 months (private case study acceptable)
- 30 minutes for an optional reference call/year (may decline any specific call)

---

## License Key Changes

No new tier prefix is required. FM pricing is a Stripe billing variant of an existing tier, not a capability change. An FM Weaver Solo key (`WVR-WVS-`) grants identical features to a standard Weaver Solo key.

**Billing:** FM pricing is implemented via a separate Stripe Price ID (e.g., `price_fm_premium_solo`) attached to the standard product. Stripe subscriptions on FM price IDs remain on that price ID at renewal indefinitely — Stripe does not auto-migrate price IDs. This is the mechanism that enforces lifetime grandfathering.

**Analytics:** The payload byte reserved for future use in the key format flags FM customers for internal reporting. No customer-facing change.

---

## Revenue Impact Analysis

### TOTP SKU removal (related change)

The red team identified the $36/yr TOTP standalone SKU as a conversion-friction liability with no standalone value. Resolution: TOTP is bundled into Weaver (no separate charge); 1Password TA customers get TOTP unlocked on Weaver Free tier via OAuth.

| Factor | Impact |
|--------|--------|
| Lost TOTP-only revenue | −$36/yr × TOTP-only customers (small; most TOTP buyers are also evaluating Weaver) |
| Weaver conversion gain | TOTP becomes a Weaver upgrade driver ("MFA requires Weaver") — estimated +3–5% conversion lift |
| Net | Positive at any Weaver conversion rate above 0.8% |

Cashflow inputs (`cashflow-inputs.json`) updated: `totp` revenue line removed, generator interface updated to match.

### Weaver Solo FM ($149/yr vs $249/yr standard post-v1.2)

Delta: −$100/yr per FM customer, locked for life.

| FM Cohort Size | Annual Delta vs Post-v1.2 Standard | 5-Year Cumulative Delta |
|:--------------:|:----------------------------------:|:-----------------------:|
| 50 customers | −$5,000/yr | −$25,000 |
| 100 customers | −$10,000/yr | −$50,000 |
| 200 customers | −$20,000/yr | −$100,000 |

**Offset:** Each Weaver Solo FM customer is a sysop-as-champion candidate (53× ROI if they become an enterprise referral). 200 FM customers paying $29,800/yr who generate one 10-node enterprise contract ($10,700/yr post-v2.2 + $5,000 Adopt) outperform 200 standard-price customers who generate zero referrals. No explicit cap on Weaver Solo FM — let the v1.2 ship date close the window naturally.

### Fabrick FM ($1,299/yr vs $2,000/yr standard post-v2.2, 20 customers)

Delta: −$701/yr/node vs. v2.2 standard first node ($2,000 − $1,299), locked for life. At avg 5 nodes per FM customer (FM rate applies to all nodes):

| Metric | Value |
|--------|-------|
| FM annual revenue (20 customers × 5 nodes × $1,299) | $129,900/yr |
| Post-v2.2 standard annual revenue (same cohort, blended: $2,000 first + 4×$1,250) | $140,000/yr |
| Annual delta | −$10,100/yr |
| 5-year revenue cost of FM program | ~$50,500 |

**Return:** If 50% of FM enterprise customers (10) convert to Accelerate or Partner success programs:
- 7 × $15,000 (Accelerate) + 3 × $30,000 (Partner) = $195,000/yr additional ARR
- Net by Year 1: $195,000 − $10,100 = **+$184,900/yr** vs standard pricing with zero success program conversions

The FM delta is much smaller with the new pricing ($10K/yr vs the old $100K/yr gap). The success program return covers it immediately. FM enterprise buyers remain the highest-value customer acquisition investment in the model.

---

## Red Team: This Model

### Vulnerability 1: Perverse shipping incentive

The FM window being open generates revenue at a lower rate. Theoretically, delaying v1.2 keeps the window open longer. This incentive is real.

**Counter:** The FM window closing is a revenue acceleration event — standard pricing at $249/yr vs $149/yr. Shipping v1.2 fast opens the full-price market. Delay is a mistake by any revenue model.

### Vulnerability 2: Expansion nodes priced at standard create friction

FM customers at $1,299/yr adding nodes later pay $2,000/yr on new nodes. When they ask "why are these more expensive?", the answer ("your original commitment is locked; expansion is market rate") is accurate but can feel arbitrary.

**Mitigation:** Communicate this explicitly at purchase (in the checkout flow and welcome email). Add the 12-month FM expansion rate ($1,400/yr/node) as a documented option so there's a graceful path. Train this expectation before it becomes a support issue.

### Vulnerability 3: Permanent FM pricing signals the standard price is wrong

If Founding Members keep $149/yr forever while v3.0 HA ships and the product becomes 5× more capable, market-price customers paying $249/yr will notice the disparity. "They pay $149 for the same product I pay $249 for" creates resentment.

**Mitigation:** Frame FM customers as "Founding Members" with a visible badge in product settings and named credit in release notes. New customers understand they missed the founding window — the discount is community recognition, not a pricing signal. This framing is established at launch and reinforced at every major release.

### Vulnerability 4: Fabrick FM at $1,299/yr undercuts the "credible, not scary" positioning anchor

The two-track strategy anchors Fabrick against Rancher/OpenShift at $2,000/yr. The FM program tells early buyers the actual floor is $1,299/yr. This could train Fabrick buyers to negotiate down toward $1,299 even after the window closes, or to wait for the "next FM round."

**Mitigation:** The FM program has explicit, published hard limits — 20 customers, v2.2 cap, no exceptions, no future rounds. "The founding round is closed. Standard pricing applies." Hard documented scarcity prevents the negotiation training problem. **The program must close publicly and permanently.** Post-v2.2: no new FM Fabrick offers, no exceptions. This must be enforced — a single "special deal" after the cap undercuts the entire model.

### Vulnerability 5: Version cap language confuses buyers

Internally "version execution cap" is clean strategy. Externally, "price valid until version X ships" sounds like a threat. "Buy now before we ship our big feature" is technically accurate and tonally wrong.

**Mitigation:** Lead with the value, not the cap. Customer-facing copy: *"Founding Member pricing — $149/yr, locked for life."* The cap is a footnote in T&Cs, not the headline. Buyers self-select the urgency; do not manufacture it with countdown language.

### Vulnerability 6: Weaver Team FM at $129/user/yr is not offered at launch (by design)

Offering FM on a non-existent tier 24 months before delivery is vapor. The fix (open Team FM at v2.1) is the right call — this is a resolved vulnerability, not an open one.

### Vulnerability 7: Fabrick FM competitors can see the floor

Competitors reading the public FM terms know the enterprise price floor is $1,299/yr/node. This could be used in competitive sales ("Weaver themselves offered $1,299/yr at launch").

**Mitigation:** FM program framing explicitly positions $1,299 as "founding" not "floor." The argument is: you're getting $2,000/yr software at $1,299/yr because you're committing before the clustering release. After v2.2, $1,299 ceases to exist. This is defensible in competitive positioning. Alternative: keep Fabrick FM pricing non-public (only disclosed in direct design partner outreach, not on the website). Recommended approach for Fabrick tier.

---

## Summary: What to Do at Launch

| Action | Timing |
|--------|--------|
| Publish Weaver Solo FM at $149/yr on pricing page | v1.0 launch |
| Open Fabrick FM at $1,299/yr via direct outreach only (not public pricing page) | v1.0 launch |
| Close both windows on the day v1.2 ships (Weaver Solo) / v2.2 ships (Fabrick) | When those versions GA |
| Open Weaver Team FM at $129/user/yr on pricing page | v2.1 launch |
| Close Weaver Team FM when v2.2 ships | v2.2 GA |
| Update cashflow-inputs.json: remove TOTP line, adjust premium conversion rate | Before regenerating cashflow |

---

*Cross-reference: [TIER-MANAGEMENT.md](../product/TIER-MANAGEMENT.md) | [WEAVER-VALUE-PROPOSITION.md](../marketing/WEAVER-VALUE-PROPOSITION.md) | [FABRICK-VALUE-PROPOSITION.md](../marketing/FABRICK-VALUE-PROPOSITION.md)*
