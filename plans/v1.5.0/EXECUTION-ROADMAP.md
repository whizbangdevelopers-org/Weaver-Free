<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v1.5.0 (Integrated Secrets Management)

**Last updated:** 2026-03-21

Phase 8a — Weaver becomes a secure workload platform with integrated credential management. No competitor — including Proxmox — has native secrets management embedded in the workload manager. Weaver makes it the default, not a bolt-on. For cross-resource AI + vault foundation (v1.4.0), see [v1.4.0/EXECUTION-ROADMAP.md](../v1.4.0/EXECUTION-ROADMAP.md). For migration tooling (v1.6.0), see [v1.6.0/EXECUTION-ROADMAP.md](../v1.6.0/EXECUTION-ROADMAP.md). For the full product roadmap and decision log, see [MASTER-PLAN.md](../../MASTER-PLAN.md).

## Phase Overview

```
Phase 8a: Integrated Secrets Management (v1.5.0)   ░░░░░░░░░░░░░░░░░░░░  PLANNED
```

## Sales Headline

> *"Weaver enables integrated secrets management for your workload platform."*

Proxmox users manage secrets today via config files, environment variables, or external tools bolted on afterward. Weaver makes it native — encrypted, admin-controlled, Live Provisioning compliant. Fabrick (v3.0) extends this across the fleet.

---

## Architecture

```
NixOS / sops-nix          ← provisions vault master key (one-time, rebuild-time)
        ↓
SQLCipher vault           ← runtime credential store (add/rotate/delete via API, no rebuild)
        ↓
Weaver backend            ← resolveSecret(workloadId, type) — internal only
```

The vault master key is provisioned by sops-nix at first-run. All runtime operations go through the admin API — no `nixos-rebuild switch` ever required for credential management. Live Provisioning compliant by design.

Credential payload is an **encrypted blob** — the vault does not assume API key shape. Each credential type has its own payload structure (API key, token, endpoint+key pair, arbitrary key-value). The vault stores opaque blobs; the consumer (AI service, injection engine) knows the shape.

**Fabrick (v3.0):** Vault federation across the fleet. A credential added to one Weaver node becomes optionally available fleet-wide via Fabrick's control plane. Per-workload assignment extends to cross-host workloads.

---

## Phase 8a: Integrated Secrets Management (v1.5.0)

### Vault Expansion (Weaver+)

| Task | Tier | Priority |
| --- | --- | --- |
| Expand vault to general workload secrets — DB passwords, service tokens, arbitrary key-value | Weaver | High |
| Flexible credential payload schema — API key, token, endpoint+key pair, arbitrary blob | Weaver | High |
| Settings page: Credential Vault management UI (list, add, rotate, delete) — admin only | Weaver | High |
| Credential metadata display: name, type, app/vendor, created_at, rotated_at, assignment count | Weaver | High |
| Key deletion blocked if assignments exist — must unassign first, error if attempted | Weaver | High |
| Rotation atomic — old credential stays active until new one confirmed written | Weaver | High |
| Credential values never returned after write — GET returns metadata only, enforced at route layer | Weaver | High |
| Unit + backend tests: vault CRUD, payload encryption, deletion guard | Weaver | High |

### Secrets Injection (Weaver+)

| Task | Tier | Priority |
| --- | --- | --- |
| Inject credentials into workloads at boot as environment variables | Weaver | High |
| Inject credentials as files (mounted path in workload filesystem) | Weaver | Medium |
| Injection config UI on workload detail panel — admin only | Weaver | High |
| Backend: resolve + inject at workload start lifecycle hook | Weaver | High |
| Injection audit: log which credential was injected into which workload, on which admin action | Weaver | Medium |
| Unit tests: injection resolution, env var and file path modes | Weaver | High |

### Per-Workload Assignment (Fabrick)

| Task | Tier | Priority |
| --- | --- | --- |
| Admin assigns credential from vault pool to specific workload | Fabrick | High |
| Bulk assignment: assign credential to all workloads matching a tag | Fabrick | High |
| Assignment audit trail: who assigned what to which workload, timestamp | Fabrick | High |
| Assignment removal blocked while workload is running — warn + require confirm | Fabrick | Medium |
| Settings page: Fleet assignment table (workload → credential mapping, admin) | Fabrick | High |
| E2E specs: vault CRUD, injection, assignment, audit trail flows | Fabrick | High |

### API — all endpoints `requireAdmin()`

| Method | Endpoint | Tier | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/vault/credentials` | Weaver+ | Metadata only — never values |
| `POST` | `/api/vault/credentials` | Weaver+ | Add credential |
| `PUT` | `/api/vault/credentials/:id/rotate` | Weaver+ | Replace value atomically |
| `DELETE` | `/api/vault/credentials/:id` | Weaver+ | Blocked if assignments exist |
| `POST` | `/api/vault/credentials/bulk-assign` | Fabrick | Assign by tag/group |
| `POST` | `/api/workload/:name/vault-assignment` | Fabrick | Assign credential to workload |
| `DELETE` | `/api/workload/:name/vault-assignment` | Fabrick | Remove assignment |

---

## Design Decisions

### Admin-only, always

All vault operations — create, rotate, delete, assign — are admin-only at every tier. No delegation, no operator-level access. The audit trail needs a single accountability point; credential delegation chains add complexity without security benefit. See Decision #73.

### AI credential vault boundary (v1.4.0 vs v1.5.0)

The v1.4.0 vault foundation handles AI credentials only (frontier + application-specific). v1.5.0 expands to general workload secrets. The storage architecture is identical — only the allowed credential types and injection surface expand.

### Weaver vs Fabrick scope

Weaver gets vault management + secrets injection (team coordination). Fabrick gets per-workload assignment + audit trail (governance and compliance). The boundary mirrors the buyer: Weaver = shared team convenience; Fabrick = regulated environment control.

### Compliance alignment

Admin-only assignment with full audit trail satisfies credential management requirements for HIPAA, CMMC Level 2, SOC 2, and PCI DSS. The per-workload assignment model directly supports the compliance use case: admin enforces which credential (and by extension, which vendor) handles which workload, with no user override path.

---

## Release Plan

| Version | Milestone | Key Features | Status |
| --- | --- | --- | --- |
| v1.5.0 | Integrated Secrets Management | Vault expansion (general secrets), secrets injection, per-workload assignment (Fabrick), credential audit trail | Planned |

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
