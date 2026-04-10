<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Template Catalog Plan

**Status:** Decisions Finalized
**Target:** v2.0.0 (Wave 1), v2.1.0 (Wave 2), v2.x (Wave 3)
**Created:** 2026-03-25
**Last Updated:** 2026-03-25
**Depends On:** [SYSTEM-TEMPLATING-PLAN.md](SYSTEM-TEMPLATING-PLAN.md) (T1–T4), [DISK-PROVISIONING-PLAN.md](DISK-PROVISIONING-PLAN.md)
**Referenced By:** MASTER-PLAN.md Decisions #44, #45, #46, #67, #68, #69, #70

---

## Overview

This document defines the built-in VM template catalog — the curated set of pre-built VM configurations that ship with the product. It covers catalog content, tier access rules, the wizard/template distinction, composed templates, and license handling.

This is **not** the system templating architecture (see SYSTEM-TEMPLATING-PLAN.md for disk layer, schema, cloud-init depth, and user-created templates).

---

## Wizard vs Template — Critical Distinction

These are two different product constructs. Do not conflate them.

| Construct | Definition | Ships | Examples |
|-----------|------------|-------|---------|
| **Template** | Pre-built VM image with software pre-installed. User launches a VM from it — disk + compute + cloud-init all pre-configured. | v2.0.0 | nginx, PostgreSQL, Pi-hole, Nextcloud |
| **Wizard** | Guided, step-by-step NixOS configuration generator. Produces a `configuration.nix` fragment the user applies once via `nixos-rebuild switch`. No VM is created. | v1.3.0 | Tailscale, WireGuard |

**Tailscale and WireGuard are wizards, not templates.** (Decisions #44, #46.) They generate host-level networking config; they do not launch VMs. Future contributors must not re-add them to the template catalog by instinct — the wizard path is intentional.

Rule: if it creates a running VM, it is a template. If it generates a NixOS config fragment for the host, it is a wizard.

---

## Tier Access

Decision #44 overrides SYSTEM-TEMPLATING-PLAN.md T3 (which had Free=consume built-ins).

| Tier | Catalog Access |
|------|---------------|
| **Free** | Catalog is visible in the UI but templates cannot be launched. Available in the advanced demo only. |
| **Weaver** | Full catalog — all built-in templates are launchable. "Save as template" and template library also unlock at this tier. |
| **Fabrick** | Same templates as Weaver plus versioning, fleet push, sharing, and export. CoW disk layer per DISK-PROVISIONING-PLAN. |

---

## Catalog Waves

### Wave 1 — v2.0.0

**Headlines:** "Deploy GitHub in 30 seconds" (sysadmin pitch) + "Drop Google, one click" (mainstream privacy pitch).

| Template | Category | Tier Gate | Notes |
|----------|----------|-----------|-------|
| nginx | Infrastructure | Weaver | Reverse proxy / load balancer. Replaces K8s ingress controller use case. |
| PostgreSQL | Database | Weaver | Primary relational DB. Dependency of Nextcloud. |
| Valkey | Database | Free | BSD-3-Clause (Linux Foundation Redis 7.2 fork). Free tier inclusion: utility positioning, not an upsell. Weaver/Fabrick: optional add-to-node-cost. **Redis is not offered at any tier — SSPL license blocked by CI gate.** |
| Forgejo | Dev Tools | Weaver | Self-hosted Git. "Deploy GitHub in 30 seconds" headline. |
| Nextcloud | Productivity | Weaver | Composed template — see Composed Templates section. "Drop Google, one click" headline. |
| Pi-hole | Networking | Weaver | LAN-wide ad/tracker/malware blocking. Distinct from dns extension stack (see Decision #45). |
| Home Assistant | Automation | Weaver | Home automation hub. |
| Media Stack | Media | Weaver | Composed template: Jellyfin + Navidrome + Immich + Audiobookshelf as a single launchable stack. |
| Authentik | Identity | Weaver | SSO/IdP hub. Positioning: "Run one Authentik VM — every application gets SSO." FabricK auth-sso extension connects the dashboard itself at FabricK tier. |

**Pi-hole Fabrick enhancements** (Decision #45): HA pair via Gravity Sync, audit log integration, SSO gating, backup, per-segment instances.

---

### Wave 2 — v2.1.0

| Template | Category | Tier Gate | Notes |
|----------|----------|-----------|-------|
| Prometheus + Grafana | Observability | Weaver | Monitoring stack. Shipped together. |
| Vaultwarden | Security | Weaver | Self-hosted Bitwarden-compatible password manager. |
| Node-RED | Automation | Weaver | Transition bridge until Gantry-Automation ships. Will be deprecated once Gantry-Automation covers the space. n8n is not offered — Gantry-Automation covers that use case. |
| HAProxy | Infrastructure | Weaver | TCP/HTTP load balancer. Complements nginx (layer 4 vs layer 7). |

---

### Wave 3 — v2.x

| Template | Category | Tier Gate | Notes |
|----------|----------|-----------|-------|
| Loki | Observability | Weaver | Log aggregation. Pairs with Prometheus + Grafana from Wave 2. |
| MQTT (EMQX) | IoT | Weaver | EMQX chosen (Apache-2.0). See MQTT section below. |
| CI/CD Runner | Dev Tools | Weaver | Self-hosted runner (target runner platform TBD at planning time). |
| Kanidm | Identity | Weaver | Rust-native IdP. **Pending dev watch** — see Watch Items. May supersede Authentik. |
| AI VM templates | AI | Weaver (gated) | CUDA, ROCm, Ollama. **Extension-gated** under ai-infrastructure extension. Not in the base catalog. See License Handling section. |

---

## Composed Templates

A composed template orchestrates multiple VMs as a single launchable unit. The user launches one template; multiple VMs are provisioned as dependencies.

### Nextcloud (Wave 1)

Orchestrates: `nginx` + `PostgreSQL` + `Valkey`

Nextcloud is the first composed template and the reference implementation for multi-VM stacks. The three dependencies are also available as standalone templates — the composed template does not replace them.

### Media Stack (Wave 1)

Orchestrates: `Jellyfin` + `Navidrome` + `Immich` + `Audiobookshelf`

Positioned as a single-click Google Photos + Plex + music library replacement. Individual components are not broken out as standalone templates in Wave 1; standalone variants are deferred.

---

## MQTT Broker — EMQX

Decision #67 and #70.

- **Default for all tiers:** EMQX (Apache-2.0). Actively maintained, full MQTT 5.0, production-grade clustering (relevant to Fabrick multi-host).
- **Mosquitto (EPL-2.0):** Available as an optional add-to-node-cost item at **Fabrick only**, for customers with existing Mosquitto infrastructure. Not promoted; EMQX is the recommendation. EPL-2.0 copyleft compliance is the deploying customer's obligation.
- **VerneMQ:** Rejected — maintenance stalled post-acquisition, MQTT 5.0 support lagging.

---

## License Handling

### AI VM Templates (CUDA)

Decision #69.

NVIDIA CUDA Toolkit is proprietary (NVIDIA EULA) and cannot be auto-installed without explicit acceptance.

| Tier | Handling |
|------|---------|
| Free / Weaver | In-product deployment acknowledgment gate fires before provisioning any AI VM template containing CUDA. One-time per user per template; result stored in audit log. |
| Fabrick | `nixpkgs.config.allowUnfree = true` set automatically for Fabrick AI workload nodes. NVIDIA EULA acceptance captured at contract signing — no in-product gate friction. |

ROCm (MIT/Apache-2.0) requires no special handling at any tier.

Full user communication model: `SOFTWARE-LICENSE-EVALUATION.md § 9e`.

### Valkey vs Redis

Decision #68. Redis 7.4+ is SSPL. The license audit CI gate blocks SSPL-licensed software. Valkey (BSD-3-Clause, Linux Foundation fork of Redis 7.2) is the sole key-value store in the catalog. "Redis/Valkey" wording in earlier decisions is superseded — use "Valkey" only.

---

## Watch Items

### Kanidm

Rust-native IdP with built-in OAuth2/OIDC, LDAP, TOTP, WebAuthn, and credential storage. If credential storage matures, Kanidm may collapse Vaultwarden + Authentik into a single VM — simpler stack, easier migration path. Monitor releases before finalizing Wave 3 ship list. If Kanidm is ready, evaluate whether Authentik remains the Wave 1 recommendation or becomes an alternative.

### Node-RED Sunset

Node-RED ships in Wave 2 as a transition bridge. Once Gantry-Automation covers the automation space, Node-RED will be deprecated from the catalog. Track Gantry-Automation readiness before planning Wave 2 catalog finalization.

---

## Decisions Log

| # | Decision | Source |
|---|----------|--------|
| #44 | Free=catalog visible/no launch; Weaver=launchable; Fabrick=versioning+fleet; Tailscale+WireGuard are wizards NOT templates; AI templates extension-gated | MASTER-PLAN.md |
| #45 | Pi-hole = Weaver template v2.0.0; Fabrick adds HA pair + Gravity Sync + audit + SSO | MASTER-PLAN.md |
| #46 | 18 templates, 3 waves; Nextcloud=composed; WireGuard/Tailscale=wizards; n8n dropped; catalog doc = this file | MASTER-PLAN.md |
| #67 | EMQX chosen for MQTT (Wave 3); VerneMQ rejected | MASTER-PLAN.md |
| #68 | Valkey only — no Redis (SSPL blocked); Free tier inclusion | MASTER-PLAN.md |
| #69 | CUDA: in-product gate at Free/Weaver; contract acceptance at Fabrick | MASTER-PLAN.md |
| #70 | EMQX default all tiers; Mosquitto optional at Fabrick only | MASTER-PLAN.md |
