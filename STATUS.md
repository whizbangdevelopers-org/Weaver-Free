<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver — Quick Reference

**Last updated:** 2026-03-06

This file is a pointer to canonical sources. Detailed information lives in the documents linked below.

---

## Where to Find Things

| What | Where |
|------|-------|
| **Master index** (vision, tier model, all doc links) | [MASTER-PLAN.md](MASTER-PLAN.md) |
| **Release roadmap** (v1.0→v3.0 timeline, tier revenue ramp) | [business/product/RELEASE-ROADMAP.md](business/product/RELEASE-ROADMAP.md) |
| **Execution plans** (per-version, 1 dir per release) | [plans/](plans/) — v1.0.0 through v3.0.0 |
| **Agent definitions** (per-version, Forge manifests) | [agents/](agents/) — see [AGENT-STATUS.md](agents/AGENT-STATUS.md) |
| **GTM & marketing** | [plans/v1.0.0/GTM-LAUNCH-PLAN.md](plans/v1.0.0/GTM-LAUNCH-PLAN.md) |
| **Forge assessment** | [forge/PROJECT-ASSESSMENT.md](forge/PROJECT-ASSESSMENT.md) |
| **Forge status** (machine-readable) | [forge/STATUS.json](forge/STATUS.json) |
| **Project agents** (orchestration) | [.claude/agents/](.claude/agents/) — forge-sync, plan-reviewer, release-prep |
| **Code agents** (execution) | [code/.claude/agents/](code/.claude/agents/) — test, e2e, security, gtm |
| **Code repo** | [code/](code/) |
| **Developer guide** (in-repo) | [code/docs/DEVELOPER-GUIDE.md](code/docs/DEVELOPER-GUIDE.md) |
| **Business strategy** | [business/](business/) (market, pricing, tiers, demographics) |
| **Security audit** (red team) | [business/legal/SECURITY-AUDIT.md](business/legal/SECURITY-AUDIT.md) |
| **Nix template patterns** | [research/microvm-anywhere-nix-templates.md](research/microvm-anywhere-nix-templates.md) (v2.0.0 reference) |
| **NixOS config** | `/home/mark/etc/nixos/` |

---

## Current Phase

**Phases 1–5d: COMPLETE** — Core dashboard, AI agent, provisioning, distros, console, help, network, notifications, tags, auth, security hardening.

**Phase 6: Production Ready (v1.0.0) — 95% COMPLETE**
- All implementation done: tier gating, auth, RBAC, audit, rate limiting, demo site, security hardening, documentation, release pipeline
- TUI first-class client implemented (React/Ink, 97% feature parity with web)
- Brand system finalized (amber product + green company frame)
- Security audit complete (5 domains: legal/IP, secrets, supply chain, deployment, org governance)
- Red team security audit baselined (21 findings across backend, frontend, infra — [SECURITY-AUDIT.md](business/legal/SECURITY-AUDIT.md))
- 3-tier + Integrated Extensions model decided (2026-03-03): extensions for all future feature domains
- Test suite: 1,338 tests all green (269 unit + 582 backend + 183 TUI + 304 E2E)
- 27 compliance auditors in CI (vocabulary, forms, routes, e2e-coverage, e2e-selectors, legal, doc-freshness, tier-parity, tui-parity, cli-args, ws-codes, bundle, license, lockfile, sast, doc-parity, demo-parity, demo-guards, decision-parity, compliance-parity, attribution, compatibility, license-parity, test-coverage, docs-links, nixos-version, project-parity)
- **Remaining:** Release process dry run (v1.0.0-rc1 tag) + cross-bridge routing edges in demo topology
- **Release gates:** NixOS fresh-install smoke test, legal/insurance review

> Full task table: [EXECUTION-ROADMAP.md § Phase 6](plans/v1.0.0/EXECUTION-ROADMAP.md)

---

## Project Structure

```
weaver-project/
├── .claude/                 ← Project-level MCP (orchestration agents, rules)
│   ├── agents/              ← forge-sync, plan-reviewer, release-prep
│   └── rules/               ← versioning convention
├── MASTER-PLAN.md           ← Vision, tier model, all doc links
├── STATUS.md                ← This file
├── code/                    ← All application code (git subtree)
│   └── .claude/             ← Code-level MCP (test, e2e, security agents)
├── plans/                   ← Execution roadmaps (1 dir per release)
│   ├── v1.0.0/              ← Phase 6 + GTM launch
│   ├── v1.1.0/              ← Container visibility + extension infra
│   ├── v1.2.0/              ← Full container management
│   ├── v1.3.0/              ← Remote access + mobile
│   ├── v1.4.0/              ← Cross-resource AI + vault foundation
│   ├── v1.5.0/              ← Integrated Secrets Management
│   ├── v1.6.0/              ← Migration Tooling (config export/import + format parsers)
│   ├── v2.0.0/              ← Storage & template foundation + mobile
│   ├── v2.1.0/              ← Storage & Template Weaver + Nix editor
│   ├── v2.2.0/              ← Weaver Team peer federation
│   ├── v2.3.0/              ← Fabrick Basic Clustering (moat-breaker)
│   ├── v2.4.0/              ← Backup Weaver
│   ├── v2.5.0/              ← Storage & Template Fabrick
│   ├── v2.6.0/              ← Backup Fabrick + Extensions
│   ├── v3.1.0/              ← Edge Fleet + Cloud Burst (AI/HPC, invoice)
│   ├── v3.2.0/              ← Cloud Burst Self-Serve Billing
│   ├── v3.3.0/              ← Fabrick Maturity (RBAC, Compliance Pack)
│   └── archive/             ← Monolithic roadmaps (historical)
├── agents/                  ← Agent task specs + Forge manifests
│   ├── AGENT-STATUS.md      ← Cross-version index
│   ├── v1.1.0–v2.0.0/      ← Active agent directories
│   ├── gtm/                 ← GTM launch agents
│   └── archive/             ← Completed agents (v1.0.0 + pre-Phase-6)
├── business/                ← Business operations by function (10 functions)
│   ├── product/             ← Release roadmap, tier strategy, product specs
│   ├── finance/             ← Budget, cashflow, pricing
│   ├── sales/               ← Verticals, partners, FM program
│   ├── marketing/           ← Value props, content, announcements
│   ├── legal/               ← Security audit, license evaluation
│   ├── investor/            ← Pitch deck
│   ├── people/              ← Talent strategy
│   ├── accounting/          ← Cost tracking (scaffold)
│   ├── operations/          ← Infra, Forge (scaffold)
│   ├── customer-experience/ ← Feedback (scaffold)
│   └── customer-support/    ← Support, partner escalation (scaffold)
├── research/                ← Technical research (microvm-anywhere, etc.)
└── forge/                   ← Forge integration (assessment, STATUS.json)
```

---

## Release Pipeline

| Release | Theme | Status |
|---------|-------|--------|
| v1.0.0 | Production ready (auth, RBAC, tiers, audit) | 95% — gates remaining |
| v1.1.0 | Container visibility + extension infrastructure | Planned |
| v1.2.0 | Full container management | Planned |
| v1.3.0 | Remote access + mobile (Tailscale/WireGuard wizards, Capacitor iOS/Android) | Planned |
| v1.4.0 | Cross-resource AI + vault foundation (Decision #73) | Planned |
| v1.5.0 | Integrated Secrets Management — vault expansion, injection, per-workload assignment (Decision #73, #74) | Planned |
| v1.6.0 | Migration Tooling Arc — config export/import + Proxmox/libvirt/Dockerfile parsers (Decision #74) | Planned |
| v2.0.0 | Storage & template foundation + mobile | Planned |
| v2.1.0 | Storage & Template Weaver — storage pools, CoW, Nix template editor, Host Maintenance Manager (Decision #111) | Planned |
| v2.2.0 | Weaver Team peer federation | Planned |
| v2.3.0 | Fabrick Basic Clustering — multi-node, manual migration, Nix fleet | Planned |
| v2.4.0 | Backup Weaver | Planned |
| v2.5.0 | Storage & Template Fabrick | Planned |
| v2.6.0 | Backup Fabrick + Extensions | Planned |
| v3.0.0 | Fabrick fleet control plane, HA, live migration | Planned |
| v3.1.0 | Edge Fleet + Cloud Burst (AI/HPC nodes, invoice-based) | Planned |
| v3.2.0 | Cloud Burst Self-Serve Billing (Stripe, pre-purchase pools) | Planned |
| v3.3.0 | Fabrick Maturity — RBAC, Workload Groups, Compliance Pack | Planning |
| v4.0.0 | Platform + Verticals (decision gate at v2.2) | Horizon |

> Full timeline with tier revenue ramp: [RELEASE-ROADMAP.md](business/product/RELEASE-ROADMAP.md)

---

## How to Resume

Start a new Claude Code session in the Dev repo directory. The project's `CLAUDE.md` and memory files provide all operational context automatically.

---

## Repository Map

| Alias | Repository | Visibility |
|-------|-----------|-----------|
| Dev | `whizbangdevelopers-org/Weaver-Dev` | Private |
| Free | `whizbangdevelopers-org/Weaver-Free` | Public mirror |
| Demo | `weaver-demo.github.io` | Public (GitHub Pages) |

---

## Historical Notes

The original STATUS.md (created 2026-02-08) tracked individual commits and build notes from the initial implementation sprint (phases 1–14). That content is now captured in the EXECUTION-ROADMAP completed phases and git history. Key historical commits:

| Commit | Description |
|--------|-------------|
| `2b46a24` | feat: implement Weaver (phases 1–7) |
| `257e5bc` | docs: complete 34-file documentation suite |
| `b09cdb5` | test: add unit and E2E tests |
| `v0.1.0` | Tagged MVP release |
