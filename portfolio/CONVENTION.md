<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->

# Document Flow Convention

**Last updated:** 2026-03-28

How documents flow between product repos and the corporate repo (`wbd-corp-project`), and how business functions are organized for KPI drill-down.

---

## Classification Test

When evaluating whether a document belongs in the product repo or corp:

> **"If a second product shipped tomorrow, would this doc need to change?"**

- **Yes** → it's company-level → migrate to corp
- **No** → it's product-specific → stays here

| Question | If Yes | If No |
|----------|--------|-------|
| Does it model revenue/costs across multiple products? | Corp `portfolio/` | Stays in product |
| Does it represent the company to external parties (investors, partners, hires)? | Corp `business/<function>/` | Stays in product |
| Is it about company operations (entity, legal, people)? | Corp `business/<function>/` | Stays in product |
| Is it product-specific analysis (verticals, product marketing, product security)? | Stays in product | — |

---

## Business Function Hierarchy (10 Functions)

This product repo uses the same 10-function hierarchy as the corporate repo. Product-level business docs live here; company-level docs live in corp.

```
business/
├── finance/                # Product-level financial projections, pricing
├── accounting/             # Product-level cost tracking
├── operations/             # Product infra, Forge allocation
├── sales/                  # Product sales materials
│   ├── partners/           # Partner enablement (product-specific)
│   └── verticals/          # Vertical market cases (product-specific)
├── marketing/              # Product marketing, value props, content
│   └── announcements/      # Release announcements
├── people/                 # Product-specific roles (rare — usually company-level)
├── legal/                  # Product security audits, license evaluation
├── investor/               # Product-specific investor materials (rare)
├── customer-experience/    # Product feedback loops
├── customer-support/       # Product support materials
│   └── partner-escalation/ # Escalation paths for partner-sourced customers
├── product/                # Release roadmap, tier strategy, tier management
└── archive/                # Superseded business docs
```

### What stays here vs migrates to corp

| Stays in Product Repo | Migrates to Corp |
|----------------------|------------------|
| Sales verticals (product-specific value props) | Cashflow projections (spans products) |
| Product marketing (feature announcements, TCO) | Funding gap analysis (company investment) |
| Security audit (product code review) | Pricing philosophy (spans products) |
| Release roadmap (product versions) | Talent strategy (company hiring) |
| Tier management (product enforcement) | Pitch deck (company fundraising) |
| Partner enablement (product-specific) | Partner agreements (company relationship) |

---

## Sync Points

This product repo feeds data to the corporate repo:

```
Product Repo                          Corp Repo
════════════                          ═════════
forge/STATUS.json        ──sync──→    portfolio/products/<name>/
forge/DELIVERY.json      ──sync──→    docs/PRODUCT-DELIVERY.md (auto-generated)
                                      portfolio/PORTFOLIO-DELIVERY.md (strategic layer)
```

### Sync triggers

- Every major release (version ships)
- When a doc is edited and fails the classification test
- Quarterly review (once portfolio is large enough)

### Migration rename convention

When a doc migrates from product to corp:

1. Drop the product prefix ("{{PRODUCT_NAME}} — Cashflow" → "Cashflow Projection")
2. Generalize the title (version-specific → version-neutral)
3. Leave a stub here pointing to the corp canonical copy

---

## Future: KPI Dashboard

The corporate repo's `portfolio/products/<name>/` and `business/<function>/products/<name>/` directories are designed for per-product KPI drill-down. This product repo is the source of truth; corp maintains thin summaries for dashboard aggregation.

Full convention details: `wbd-corp-project/portfolio/CONVENTION.md`
