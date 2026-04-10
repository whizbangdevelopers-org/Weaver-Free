<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent Status — Quick Reference

**Last updated:** 2026-03-27

Agent definitions are self-contained task specs for Claude Code / Forge. Each has scope, inputs, outputs, and acceptance criteria. Agents are organized by release version — one directory per release, mirroring `plans/`.

**Sub-agent intervention threshold:** 7 estimated agent-days. Under 7 = single agent. 7-10 = evaluate. Over 10 = always split.

**Forge manifests:** Each version directory contains a `MANIFEST.md` with execution order, dependencies, quality gates, and branch strategy. Forge targets a version directory to execute all agents for that release.

---

## Directory Structure

```
agents/
├── AGENT-STATUS.md       <- This file (cross-version index)
├── templates/            <- Agent definition templates
├── v1.1.0/               <- Container visibility + extension infrastructure
│   ├── MANIFEST.md
│   └── container-visibility.md
├── v1.2.0/               <- Full container management (the closer)
│   ├── MANIFEST.md
│   ├── container-management.md
│   ├── sub-runtime-actions.md
│   ├── sub-creation-frontend.md
│   └── sub-governance-testing.md
├── v1.3.0/               <- Remote Access + Mobile
│   ├── MANIFEST.md
│   ├── networking-wizards.md
│   └── mobile-app.md
├── v1.4.0/               <- Cross-resource AI agent
│   ├── MANIFEST.md
│   └── cross-resource-agent.md
├── v1.5.0/               <- Integrated Secrets Management
│   ├── MANIFEST.md
│   └── secrets-management.md  (stub — spec TBD)
├── v1.6.0/               <- Migration Tooling Arc (config export/import + format parsers)
│   ├── MANIFEST.md
│   ├── config-export-import.md
│   └── format-parsers.md
├── v2.0.0/               <- Storage & template foundation
│   ├── MANIFEST.md
│   └── capacitor.md
├── gtm/                  <- GTM launch (parallel to v1.0.0)
│   ├── MANIFEST.md
│   ├── content.md
│   └── demo.md
├── archive/              <- Completed/superseded agents
│   ├── v1.0.0/           <- Phase 6 agents (7 agents, all implemented)
│   └── (11 pre-Phase-6 agents)
├── v2.1.0/               <- Storage & Template Weaver + Nix editor + TPM (agents TBD)
│   └── MANIFEST.md
├── v2.2.0/               <- Weaver Team — Peer Federation (agents TBD)
│   └── MANIFEST.md
├── v2.3.0/               <- Fabrick Basic Clustering (agents TBD)
│   └── MANIFEST.md
├── v2.4.0/               <- Backup Weaver (agents TBD)
│   └── MANIFEST.md
├── v2.5.0/               <- Storage & Template Fabrick (agents TBD)
│   └── MANIFEST.md
├── v2.6.0/               <- Backup Fabrick + Extensions (agents TBD)
│   └── MANIFEST.md
├── v3.0.0/               <- Fabrick — HA + Fleet Control Plane (agents TBD)
│   └── MANIFEST.md
├── v3.1.0/               <- Edge Fleet + Cloud Burst initial (agents TBD)
│   └── MANIFEST.md
├── v3.2.0/               <- Cloud Burst Self-Serve Billing (agents TBD)
│   └── MANIFEST.md
├── v3.3.0/               <- Fabrick Maturity — RBAC + Compliance Pack (agents TBD)
│   └── MANIFEST.md
└── v4.0.0/               <- Platform + Verticals (agents TBD, decision gate at v2.2)
    └── MANIFEST.md
```

---

## Active Agents by Release

### v1.1.0 — Container Visibility + Extension Infrastructure

| Agent | Est | Dependencies | Status |
|-------|-----|-------------|--------|
| [container-visibility](v1.1.0/container-visibility.md) | ~8-9d | v1.0.0 released | Pending |

### v1.2.0 — Full Container Management (the closer)

| Agent | Est | Dependencies | Status |
|-------|-----|-------------|--------|
| [container-management](v1.2.0/container-management.md) | ~16d | v1.1.0 shipped | Pending |
| - [sub-runtime-actions](v1.2.0/sub-runtime-actions.md) | ~6d | container-visibility | Pending |
| - [sub-creation-frontend](v1.2.0/sub-creation-frontend.md) | ~6d | sub-runtime-actions | Pending |
| - [sub-governance-testing](v1.2.0/sub-governance-testing.md) | ~4d | sub-creation-frontend | Pending |

### v1.3.0 — Remote Access + Mobile

| Agent | Est | Dependencies | Status |
|-------|-----|-------------|--------|
| [networking-wizards](v1.3.0/networking-wizards.md) | ~4-5d | v1.2.0 shipped | Pending |
| [mobile-app](v1.3.0/mobile-app.md) | ~8-10d | networking-wizards complete | Pending |

### v1.4.0 — Cross-Resource AI Agent

| Agent | Est | Dependencies | Status |
|-------|-----|-------------|--------|
| [cross-resource-agent](v1.4.0/cross-resource-agent.md) | ~10-11d | v1.2.0 shipped | Pending — Decision #73 (AI vault) + Decision #112 (bridge active routing, bridges-not-as-nodes) |

### v1.5.0 — Integrated Secrets Management

| Agent | Est | Dependencies | Status |
|-------|-----|-------------|--------|
| [secrets-management](v1.5.0/secrets-management.md) (stub) | ~6-8d | v1.4.0 shipped | Pending |

### v1.6.0 — Migration Tooling Arc

| Agent | Est | Dependencies | Status |
|-------|-----|-------------|--------|
| [config-export-import](v1.6.0/config-export-import.md) | ~5-6d | v1.5.0 shipped | Pending |
| [format-parsers](v1.6.0/format-parsers.md) | ~8d | config-export-import complete | Pending |

### v2.0.0 — Storage & Template Foundation

| Agent | Est | Dependencies | Status |
|-------|-----|-------------|--------|
| [capacitor](v2.0.0/capacitor.md) | TBD | v1.0.0 released | Pending |

### v2.1.0 — Storage & Template Weaver + Nix Editor + Host Maintenance Manager

| Agent | Est | Dependencies | Status |
|-------|-----|-------------|--------|
| [template-editor](v2.1.0/template-editor.md) | TBD | v2.0.0 shipped | Pending |
| `maintenance-manager` (agent TBD) | TBD | v2.0.0 shipped | Pending |

### v2.2.0–v3.3.0

Agent definitions TBD — created using v1.x playbook lessons. See [IMPLEMENTATION-PHASING-PLAN.md](../plans/v2.0.0/IMPLEMENTATION-PHASING-PLAN.md).

Note: v2.x arc is 7 releases — v2.0 (storage foundation), v2.1 (Weaver snapshots/templates/Nix editor/TPM/Host Maintenance Manager), v2.2 (Weaver Team peer federation), v2.3 (Fabrick Basic Clustering + Nix ecosystem), v2.4 (Backup Weaver), v2.5 (Storage Fabrick), v2.6 (Backup Fabrick + Extensions). v3.x is restructured into 4 releases — v3.0 (HA), v3.1 (Edge + Cloud Burst), v3.2 (Cloud Burst self-serve billing), v3.3 (Fabrick Maturity / Compliance Pack). Each version has its own plan directory.

### GTM Launch (alongside v1.0.0)

| Agent | Dependencies | Status |
|-------|-------------|--------|
| [content](gtm/content.md) | v1.0.0 near-complete | Pending — can run NOW |
| [demo](gtm/demo.md) | v1.0.0 near-complete | Pending — can run NOW |

---

## Archived Agents

### `archive/v1.0.0/` — Phase 6 (7 agents, all implemented)

| Agent | What Was Implemented |
|-------|---------------------|
| [tier-enforcement](archive/v1.0.0/tier-enforcement.md) | Rate limit tiers (5/10/30), fabrick gates, requireTier() on all routes |
| [user-management](archive/v1.0.0/user-management.md) | UsersPage.vue (586 lines), user CRUD routes, role management |
| [audit-ui](archive/v1.0.0/audit-ui.md) | AuditPage.vue (378 lines), filters, pagination, fabrick gate |
| [release](archive/v1.0.0/release.md) | CHANGELOG.md, RELEASE-PROCESS.md, PRODUCTION-DEPLOYMENT.md, release checklist |
| [per-vm-acl](archive/v1.0.0/per-vm-acl.md) | vm-acl.ts routes, ACL middleware, UsersPage ACL dialog (fabrick) |
| [vm-quotas](archive/v1.0.0/vm-quotas.md) | quotas.ts routes, QuotaSection component (fabrick) |
| [demo-switcher](archive/v1.0.0/demo-switcher.md) | DemoTierSwitcher.vue, effectiveTier getter, toolbar toggle |

### `archive/` — Pre-Phase-6 (11 agents, all implemented or superseded)

| Agent | What Was Implemented |
|-------|---------------------|
| [v1-auth](archive/v1-auth.md) | JWT sessions, login, admin setup, password complexity, lockout |
| [v1-security](archive/v1-security.md) | CSP, SSRF validation, error sanitization, global rate limiting |
| [v1-license](archive/v1-license.md) | HMAC keys, requireTier(), useTierFeature, UpgradeNag, config resolution |
| [v1-rbac](archive/v1-rbac.md) | admin/operator/viewer, requireRole() middleware on all routes |
| [v1-audit](archive/v1-audit.md) | audit store, service, GET /api/audit with filtering |
| [v1-dark-mode](archive/v1-dark-mode.md) | boot file, settings store, toolbar toggle, auto/light/dark |
| [v1-autostart](archive/v1-autostart.md) | API endpoint, startup logic, VmCard icon, VmDetail toggle |
| [v1-vm-notes](archive/v1-vm-notes.md) | API endpoint, click-to-edit, card subtitle |
| [v1x-notifications](archive/v1x-notifications.md) | notification panel, bulk actions, ntfy/email/webhook/web-push adapters |
| [v1x-tags-search](archive/v1x-tags-search.md) | tag CRUD, per-VM tagging, search/filter, BulkActionBar |
| [v1x-import-export](archive/v1x-import-export.md) | Superseded — config-export-import → v1.6.0, format-parsers → v1.6.0 (Decision #74) |

---

## Execution Flow

```
v1.0.0: COMPLETE — 7 agents implemented (archived)

v1.1.0: container-visibility (~8-9d)
  Gate: precommit + Docker E2E + NixOS smoke test

v1.2.0: container-management — 3 sub-agents, sequential
  sub-runtime-actions (~6d) -> sub-creation-frontend (~6d) -> sub-governance-testing (~4d)
  Gate: FULL version gate after sub-agent #3

v1.3.0: networking-wizards (~4-5d) -> mobile-app (~8-10d)
  Gate: precommit + Docker E2E + NixOS smoke test + App Store/Play approval

v1.4.0: cross-resource-agent (~10-11d)
  Gate: precommit + Docker E2E + NixOS smoke test

v1.5.0: secrets-management (~6-8d)     [vault expansion — builds on v1.4 vault foundation]
  Gate: precommit + Docker E2E + NixOS smoke test

v1.6.0: config-export-import (~5-6d) -> format-parsers (~8d)
  Gate: precommit + Docker E2E + NixOS smoke test
  -- v1.x arc complete --

v2.0.0: capacitor agent (storage foundation + mobile)
  Gate: Docker E2E + NixOS smoke test

v2.1.0-v3.3.0: agents TBD (forge playbook — v2.x 7-release arc, v3.x split into v3.0/v3.1/v3.2/v3.3)

GTM: content + demo (parallel, alongside v1.0.0 release)
  Gate: visual review only
```

---

## Forge Integration

Each version directory is a self-contained Forge execution unit:

1. **Forge reads `MANIFEST.md`** in the target version directory
2. **Creates feature branch(es)** per the branch strategy
3. **Executes agents in order** — each agent definition is a complete task spec
4. **Runs quality gates** after each agent and at version boundaries
5. **On version gate pass**, merges to main and tags the release

**Lifecycle:** When a version ships, move its `agents/vX.Y.0/` contents to `agents/archive/vX.Y.0/`.

---

*Cross-reference: [MASTER-PLAN.md](../MASTER-PLAN.md) | [RELEASE-ROADMAP.md](../business/product/RELEASE-ROADMAP.md) | [IMPLEMENTATION-PHASING-PLAN.md](../plans/v2.0.0/IMPLEMENTATION-PHASING-PLAN.md)*
