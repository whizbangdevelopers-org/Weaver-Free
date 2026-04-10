<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Paid Tier License Draft (BSL 1.1)

**Status:** DRAFT — Not yet active. Will be finalized before Solo/Team ship.
**Applies to:** Weaver Solo, Weaver Team, and Fabrick (Decision #137)
**Template:** Business Source License 1.1 (MariaDB format, used by HashiCorp, CockroachDB, Sentry)
**Full template text:** https://mariadb.com/bsl11/

---

## License Parameters

These are the project-specific values that plug into the standard BSL 1.1 template.

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Licensed Work** | Weaver Solo, Weaver Team, Fabrick | All paid tiers (Decision #137) |
| **Licensor** | whizBANG Developers LLC | Same entity as free/premium tiers |
| **Change Date** | 4 years from each release | e.g., v1.0.0 released 2026 converts 2030 |
| **Change License** | AGPL-3.0 | Matches free tier license for consistency |
| **Additional Use Grant** | Non-production use | See details below |

---

## Additional Use Grant (what is allowed without a commercial license)

You may use the Licensed Work for any purpose **other than** a Production Use.

**Permitted without a license:**
- Personal evaluation and testing
- Development and staging environments
- Academic and research use
- Contributing patches back to the project
- Running in non-production CI/CD pipelines

**Requires a valid license key (`WVR-WVS-*`, `WVR-WVT-*`, or `WVR-FAB-*`):**
- Any production deployment serving real users or workloads
- Using enterprise features in a revenue-generating service
- Embedding enterprise features in a product offered to third parties

---

## What Constitutes "Paid Features"

BSL-licensed features are those gated to Solo, Team, or Fabrick tiers in the product's tier matrix.
At v1.0.0, these include:

| Feature | Description |
|---------|-------------|
| Per-VM ACL | Fine-grained access control per virtual machine |
| Audit Log | Queryable log of all user and system actions |
| Bulk Operations | Select and act on multiple VMs simultaneously |
| Per-User Quotas | Resource limits per user (vCPU, memory, VM count) |
| LDAP/SSO | External identity provider integration (future) |

The definitive list is maintained in the tier matrix configuration and enforced
at runtime by the `requireTier()` middleware (weaver, fabrick).

---

## License Stack (All Tiers — Decision #137)

| Tier | License | Source Visibility | Commercial Use |
|------|---------|-------------------|----------------|
| **Weaver Free** | AGPL-3.0 + Commons Clause + AI Restriction | Public (free repo) | No (Commons Clause) |
| **Weaver Solo** | BSL-1.1 (this document) | Private (dev repo, key-gated) | Yes, with valid license |
| **Weaver Team** | BSL-1.1 (this document) | Private (dev repo, key-gated) | Yes, with valid license |
| **Fabrick** | BSL-1.1 (this document) | Private (dev repo, key-gated) | Yes, with valid license |
| **Demo** | N/A (showcase only) | Public (GitHub Pages) | N/A |

---

## Change Date Mechanics

The BSL 1.1 includes a "Change Date" after which the code automatically converts
to the Change License (AGPL-3.0). This means:

- Enterprise v1.0.0 (released 2026) becomes AGPL-3.0 in 2030
- Enterprise v1.5.0 (released 2027) becomes AGPL-3.0 in 2031
- Each release has its own independent change date
- Customers always have access to the latest features under BSL
- After 4 years, anyone can use that version under AGPL-3.0

This is the same model used by MariaDB, CockroachDB, and HashiCorp Terraform.

### Sales Dynamics of the Change Date

**Why the change date helps close deals:**

- **Eliminates vendor lock-in objection.** Enterprise buyers evaluating a solo-dev product
  fear abandonment. The change date guarantees: worst case, your version becomes AGPL-3.0
  in 4 years. You're never stranded with unusable software. This is a major objection
  killer for procurement teams.
- **Pattern recognition in legal review.** Legal teams that have approved HashiCorp or
  CockroachDB have already approved BSL 1.1. No novel legal review needed — just
  parameter substitution. This shortens the procurement cycle.
- **Open source community credibility.** The NixOS audience cares about open source
  principles. "Every release becomes AGPL eventually" preserves community standing
  while still monetizing enterprise features.

**The version treadmill it creates:**

A customer who buys Enterprise v1.0.0 in 2026 could theoretically pay for 1 year, stop
paying, and wait until 2030 when v1.0.0 converts to AGPL-3.0. This means the product
must ship enough new value every year that staying on a 3-year-old version is unacceptable.
The change date is a forcing function on feature velocity.

In practice, this is not a risk if the roadmap executes. If clustering ships in v2.2.0
(2027), backup extensions in v2.5.0, and storage pools in v2.4.0 — no enterprise customer
will sit on v1.0.0 waiting for 2030 when their competitors have clustering and they don't.

**Implications for pricing and packaging:**

- **Bundle support/SLA into Enterprise, not just a license key.** As a version ages toward
  the change date, code access becomes less valuable — but ongoing support, priority fixes,
  and upgrade assistance stay valuable. Customers renew for support, not just code.
- **Prefer annual contracts over monthly.** Monthly lets customers subscribe, grab the
  version, and unsubscribe. Annual locks in revenue across the upgrade cycle.
- **Maintain at least one major enterprise release per year.** This keeps the treadmill
  compelling. The current roadmap (v1.1–v1.5 in year 1, v2.0–v2.5 in year 2) satisfies
  this comfortably.
- **Customers who can wait 4 years were never going to pay.** Enterprise buyers need
  governance, audit logs, and ACLs now — they have compliance deadlines, not 4-year
  horizons. The change date filters out tire-kickers without losing real buyers.

---

## Enforcement Strategy

Enterprise features are enforced at two levels:

1. **Runtime gate** — `requireTier('enterprise')` middleware checks the license key
   on every enterprise API route. No valid key = HTTP 403.
2. **Source separation** — Enterprise code lives in a separate private repo
   (`Weaver-Dev-Premium`). The free and premium repos never contain
   enterprise source code.

License keys follow the format: `WVR-ENT-{PAYLOAD}-{CHECKSUM}`
Generated via Stripe webhook on payment verification.

---

## Compatibility Notes

- The BSL 1.1 is **not** an open source license (per OSI definition) until the Change Date
- It is source-available: customers can read, audit, and modify the code
- The AGPL-3.0 Change License ensures eventual open source conversion
- The AI Training Restriction from the free/premium tiers carries over
- The Commons Clause does NOT apply to Enterprise (customers pay for commercial rights)

---

## Prior Art

Companies using BSL 1.1 with similar parameters:
- **HashiCorp** (Terraform, Vault) — BSL 1.1, 4-year change date, MPL 2.0 change license
- **CockroachDB** — BSL 1.1, 3-year change date, Apache 2.0 change license
- **Sentry** — BSL 1.1, 3-year change date, Apache 2.0 change license
- **MariaDB** — BSL 1.1 (original creator), 4-year change date, GPL change license

---

## Open Questions (resolve before activation)

- [ ] Final change date duration: 3 years or 4 years?
- [ ] Should the AI Training Restriction be a separate addendum or incorporated into the BSL grant?
- [ ] Legal review: have an attorney review the final license text before publishing
- [ ] Should "hosted service" use (SaaS) require Enterprise even for non-enterprise features?

---

## Activation Process

When it's time to stand up the paid tiers, follow these steps in order.

### 1. Resolve Open Questions (above)

Decide the 4 open items. The change date and SaaS clause have pricing implications —
resolve these before touching Stripe or license key generation.

### 2. Legal Review

Send this draft plus the BSL 1.1 template (https://mariadb.com/bsl11/) to an attorney.
Ask them to:
- Fill in the 5 parameters from the table at the top of this document
- Draft the AI Training Restriction as a BSL addendum (or confirm it can be appended verbatim)
- Review the Additional Use Grant language for enforceability
- Confirm the Commons Clause exclusion for Enterprise is clear

Deliverable: a final `LICENSE` file ready for the Enterprise repo.

### 3. Create the Enterprise Repo

```bash
gh repo create whizbangdevelopers-org/Weaver-Dev-Premium \
  --private \
  --description "Weaver Enterprise (BSL 1.1)"
```

Copy the reviewed LICENSE file to the repo root. This repo holds only the
enterprise-exclusive source code (per-VM ACL, audit log, bulk ops, quotas).
Shared code stays in the Dev repo — Enterprise imports it as a dependency.

### 4. Set Up License Key Infrastructure

- Create Stripe products: Premium ($15/mo or $150/yr), Enterprise (custom ~$200+/mo)
- Build the license key generator: `WVR-{TIER}-{PAYLOAD}-{CHECKSUM}` format
- Wire the Stripe webhook: payment verified > generate key > email to customer
- Add key validation to the backend `requireTier('enterprise')` middleware

### 5. Build Pipeline

- Enterprise builds pull from both Dev (shared) and Premium (enterprise-only) repos
- CI runs the same test suite plus enterprise-specific integration tests
- Release tags on Premium trigger Enterprise builds only (no sync-to-free)

### 6. Update Public-Facing Docs

- Add paid tiers to the pricing page
- Update the free repo README with Enterprise upgrade path
- Add BSL 1.1 badge/notice to the Enterprise repo README

---

*This draft will become the LICENSE file in the Enterprise repo when that repo is created.*
*Cross-reference: [USER-ACTION-ITEMS.md](../../plans/v1.0.0/USER-ACTION-ITEMS.md) | [MASTER-PLAN.md](../../MASTER-PLAN.md)*
