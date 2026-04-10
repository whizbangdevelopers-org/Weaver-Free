<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v1.4.0 (Cross-Resource AI Agent)

**Last updated:** 2026-03-27

Phase 7c — the enterprise differentiator. AI agent gains awareness of both VMs and containers, enabling cross-resource diagnostics and topology visualization. For container visibility (v1.1.0), see [v1.1.0/EXECUTION-ROADMAP.md](../v1.1.0/EXECUTION-ROADMAP.md). For full container management (v1.2.0), see [v1.2.0/EXECUTION-ROADMAP.md](../v1.2.0/EXECUTION-ROADMAP.md). For remote access + mobile (v1.3.0), see [v1.3.0/EXECUTION-ROADMAP.md](../v1.3.0/EXECUTION-ROADMAP.md). For the full product roadmap and decision log, see [MASTER-PLAN.md](../../MASTER-PLAN.md).

## Phase Overview

```
Phase 7c: Cross-Resource AI Agent (v1.4.0)         ░░░░░░░░░░░░░░░░░░░░  PLANNED
```

---

## Phase 7c: Cross-Resource AI Agent (v1.4.0)

| Task | Tier | Priority |
| --- | --- | --- |
| Agent context injection: VM state + container state in prompt | Weaver | High |
| Cross-resource diagnostics ("why can't container X reach VM Y?") | Weaver | High |
| Agent actions on containers (restart, inspect, read logs) | Weaver | High |
| Network topology view: VMs + containers + bridges + relationships | Fabrick | High |
| Agent-suggested resource placement ("this workload fits a MicroVM better") | Fabrick | Medium |
| Resource dependency mapping (which containers depend on which VMs) | Fabrick | Medium |
| Unified search across VMs and containers | Weaver | Medium |
| Weaver: combined resource stats (total VMs, total containers, by runtime) | Free | Medium |
| E2E specs for cross-resource agent and topology view | Fabrick | High |

> **Deferred:** Kubernetes/Nomad cluster orchestration (Phase 9+ if demand exists — stays single-node for now).

**Agent:** [cross-resource-agent](../../agents/v1.4.0/cross-resource-agent.md)

---

## AI Credential Vault Foundation (v1.4.0)

The cross-resource AI agent requires managed credential storage at Weaver. The vault foundation ships here and is consumed by the AI layer in the same release. Architecture established once; v1.5.0 expands the credential types and injection surface.

| Task | Tier | Priority |
| --- | --- | --- |
| SQLCipher encrypted credential store — separate DB from main app data | Weaver | High |
| sops-nix master key provisioning — vault unlocked at backend startup, no rebuild to rotate credentials | Weaver | High |
| Credential schema: id, name, type, vendor/app, encrypted payload blob, metadata | Weaver | High |
| Admin-only CRUD API: `GET/POST /api/vault/credentials`, `PUT /api/vault/credentials/:id/rotate`, `DELETE /api/vault/credentials/:id` | Weaver | High |
| Credential values never returned after write — list endpoint returns metadata only | Weaver | High |
| Settings page: Credential Vault section — add, rotate, delete (admin only) | Weaver | High |
| AI agent resolves credentials from vault instead of request body (server-side key path) | Weaver | High |
| Weaver: single globally-applied AI credential — all workloads use admin-set key | Weaver | High |
| BYOK (Free): user-supplied key in request body — unchanged, vault not involved | Free | — |
| Unit + backend tests for vault CRUD and key resolution | Weaver | High |

> **Vault scope at v1.4.0:** AI credentials only — frontier model keys (Anthropic, OpenAI) and application-specific AI credentials (marketing tools, fine-tuned models, any vendor, any auth shape). General workload secrets (DB passwords, service tokens) and secrets injection ship in v1.5.0.

---

## Bridge Active Routing (v1.4.0) — Decision #112

Infrastructure layer. Marginal cost — bridge and AI code are already being touched in this release.

| Task | Tier | Priority |
| --- | --- | --- |
| Bridge weighted routing backend — weight attribute on bridge, proportional traffic distribution across registered endpoints | Weaver | High |
| Bridge routing API — `PUT /api/bridges/:name/weights` endpoint weight map | Weaver | High |
| Bridges-not-as-nodes designation locked in architecture — bridge cert carries `weaverRole=bridge`, Fabrick ignores for node count | Weaver | High |
| AI bridge awareness — cross-resource agent reads bridge routing state, can suggest and execute weight changes on request | Weaver | Medium |
| Bridge weight controls in Bridge Management UI (Weaver Solo) | Weaver | Medium |

> **Note:** Full AI blue/green workflow (clone → configure → test → shift → confirm/rollback) productized at v2.2.0 Weaver Team. This release lays the infrastructure; Solo power users get AI-assisted weight management.

---

## Release Plan

| Version | Milestone | Key Features | Status |
| --- | --- | --- | --- |
| v1.4.0 | Cross-Resource AI Agent | VM+container agent context, topology view, cross-resource diagnostics, unified search, bridge active routing (Decision #112) | Planned |

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
