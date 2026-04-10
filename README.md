<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver — Project

> Lightweight, mobile-first VM control plane for NixOS. Manage your entire VM fleet from your pocket.

## Status

**Pre-release** — Phase 6 (v1.0.0 Production Ready) at 95%. All code, tests, and docs complete. Remaining: release process dry run + manual gates.

See [MASTER-PLAN.md](MASTER-PLAN.md) for full execution plan and [STATUS.md](STATUS.md) for quick reference.

## Quick Start

```bash
cd code
npm install
npm run dev:full    # Frontend (9010) + Backend (3110)
```

## Structure

```
weaver-project/
├── MASTER-PLAN.md          # Master index (vision, tier model, all doc links)
├── STATUS.md               # Quick-reference pointers to canonical sources
├── agents/                 # Agent execution specs (10 active, 11 archived)
│   └── archive/
├── business/               # Business operations by function (10 functions)
│   ├── product/            # Release roadmap, tier strategy, product specs
│   ├── finance/            # Budget, cashflow, pricing
│   ├── accounting/         # Cost tracking (scaffold)
│   ├── operations/         # Infra, Forge (scaffold)
│   ├── sales/              # Verticals, partners, FM program
│   ├── marketing/          # Value props, content, announcements
│   ├── people/             # Talent strategy
│   ├── legal/              # Security audit, license evaluation
│   ├── investor/           # Pitch deck
│   ├── customer-experience/ # Feedback (scaffold)
│   ├── customer-support/   # Support, partner escalation (scaffold)
│   └── archive/
├── plans/                  # Execution plans, roadmap, GTM, release strategy
│   └── archive/
├── forge/                  # Forge assessment, progress, knowledge feed
├── docs/                   # Reference docs, how-tos, factory designs
│   └── microvm anywhere with factory templates/
├── code/                       # Source code (Vue 3 + Quasar + Fastify)
├── test-infra/             # Test infrastructure (gitignored)
└── workspaces/             # VS Code workspace configs
```

## Repositories

| Alias | Repository | Visibility |
|-------|-----------|-----------|
| Dev | `whizbangdevelopers-org/Weaver-Dev` | Private (source of truth) |
| Free | `whizbangdevelopers-org/Weaver-Free` | Public mirror |
| Demo | `weaver-demo.github.io` | Public (GitHub Pages) |

## Tech Stack

- **Frontend:** Quasar 2 + Vue 3 + TypeScript + Pinia
- **Backend:** Fastify 4 + TypeScript + Zod
- **Testing:** Vitest + Playwright (Docker)
- **Build:** Vite via Quasar CLI
- **Host:** NixOS with systemd service + nginx

---

**whizBANG! Developers LLC** — whizbangdevelopers-org

*Created: 2026-02-07*
