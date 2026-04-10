<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v1.1.0 (Container Visibility + Extension Infrastructure)

**Last updated:** 2026-03-06

Phase 7a — container visibility alongside VMs, plus extension infrastructure, DNS, topology, and auth extensions. For prior phases, see [v1.0.0/EXECUTION-ROADMAP.md](../v1.0.0/EXECUTION-ROADMAP.md). For full container management (v1.2.0), see [v1.2.0/EXECUTION-ROADMAP.md](../v1.2.0/EXECUTION-ROADMAP.md). For cross-resource AI agent (v1.3.0), see [v1.3.0/EXECUTION-ROADMAP.md](../v1.3.0/EXECUTION-ROADMAP.md). For the full product roadmap and decision log, see [MASTER-PLAN.md](../../MASTER-PLAN.md).

## Pre-Planning TODO

- [ ] Absorb planned features from MASTER-PLAN into this roadmap: service health probes, dashboard search & filter, API documentation (OpenAPI), WebSocket fallback polling, VirtIO drivers ISO, microvm.nix auto-import, visual regression testing, cross-browser CI, WebSocket broadcast interval config. See [MASTER-PLAN.md § Planned Features Not Yet in Roadmaps](../../MASTER-PLAN.md#planned-features-not-yet-in-roadmaps).

## Phase Overview

```
Phase 7a: Container Visibility (v1.1.0)            ░░░░░░░░░░░░░░░░░░░░  PLANNED
```

## Also Shipping in v1.1.0

- **Orthogonal elbow edge routing** — core Weaver/Fabrick topology feature, extension overlay foundation. See [TOPOLOGY-ELBOW-ROUTING-PLAN.md](TOPOLOGY-ELBOW-ROUTING-PLAN.md).
- **DNS extension infrastructure** — `requirePlugin()` middleware, dnsmasq + CoreDNS. See [DNS-PLAN.md](DNS-PLAN.md).
- **VM resource monitoring graphs** — per-VM CPU/RAM/disk sparklines. Free: 1-hour ring buffer. Weaver: 24h+ with configurable retention. #1 homelab credibility gap vs Proxmox. Backend: cgroups/systemd metric collection at 2s intervals (piggybacks on existing WebSocket broadcast). Frontend: lightweight chart library (uPlot or vue-chartjs). See [HOMELAB-CREDIBILITY-FEATURES.md](HOMELAB-CREDIBILITY-FEATURES.md).
- **VM clone/template** — Weaver-gated (requires Live Provisioning). Clone existing VM with new name/IP. `POST /api/vms/:name/clone`. Most-used Proxmox feature after start/stop. See [HOMELAB-CREDIBILITY-FEATURES.md](HOMELAB-CREDIBILITY-FEATURES.md).
- **Config export implementation** — implement documented `GET /api/vms/export` and `GET /api/vms/:name/export` endpoints. Free tier. Prerequisite for scheduled backup extension (v1.6.0+).
- **Extended keyboard shortcuts** — VM-action keys (start/stop/restart on focused VM), list navigation (j/k), shortcut overlay (Shift+?). Extends existing `useKeyboardShortcuts.ts`. Free tier.

### Payment & License Infrastructure (v1.1)

From Decisions #39 and #40 — Stripe integration and extension entitlements, built during the v1.0→v1.1 window so Weaver is purchasable at v1.1 ship.

| Task | Priority | Notes |
| --- | --- | --- |
| Stripe account setup + business verification | High | Admin task — do immediately |
| Stripe Checkout products: Weaver tier, extension bundles (DNS, Auth) | High | Products map 1:1 to plugin IDs |
| Key generation webhook service (Fastify) | High | Receives `checkout.session.completed` / `invoice.paid`, calls `generateLicenseKey()` + signs entitlements JSON |
| Extension entitlements parser in `license.ts` | High | `PLUGIN_ENTITLEMENTS` / `PLUGIN_ENTITLEMENTS_FILE` env var, HMAC validation, grace period |
| Wire `requirePlugin()` to check entitlements (Fabrick bypasses) | High | Currently checks tier only; add entitlement list check |
| WordPress user registration + "My Account" page | High | Native WP accounts = customer identity. No WooCommerce. Account ties to Stripe customer + license keys |
| Key generation webhook stores license in WordPress DB | High | Webhook calls WP REST API to write license key + entitlements to customer's account |
| "My Account" license key display | High | Custom WP page/shortcode showing license key, entitled extensions, expiry, link to Stripe portal |
| License key + entitlements delivery (email) | Medium | Stripe webhook → email with key + link to "My Account" page |
| Stripe Customer Portal integration (manage subscription, payment method) | Medium | Stripe hosted portal — linked from WordPress "My Account" page |
| Health endpoint: expose entitled extensions in response | Medium | Frontend needs to know which extensions the customer purchased |

### Auth Extensions + Technology Alliances (v1.1)

From Decisions #28, #42 — TOTP and FIDO2 auth extensions with Technology Alliance OAuth verification.

| Task | Tier | Priority | Notes |
| --- | --- | --- | --- |
| TOTP extension (`auth-totp`) — time-based one-time password (Google Authenticator, Authy, 1Password, Bitwarden) | Free add-on ($3/mo) | High | Purchasable by Free-tier users via Stripe |
| FIDO2 extension (`auth-fido2`) — hardware keys (YubiKey) + passkeys | Weaver | High | Unlocked for Yubico TA customers via OAuth |
| Technology Alliance OAuth verification module | Internal | High | Generic OAuth partner verification. Build once, plug in each TA partner. Shared by 1Password and Yubico integrations |
| 1Password TA integration — OAuth → TOTP free for verified customers | Free benefit | High | User connects 1Password account → `auth-totp` waived. Affiliate link for new 1Password signups |
| Yubico TA integration — OAuth → FIDO2 unlocked for verified customers | Weaver benefit | High | User verifies YubiKey ownership → `auth-fido2` unlocked. In-product affiliate link for additional key purchases (team provisioning) |
| Auth extension settings UI (connect TA accounts, manage 2FA method) | Free | Medium | Settings → Auth page |
| SSO/SAML/LDAP extension (`auth-sso`) — enterprise identity providers | Fabrick | Medium | No TA integration at v1.1; Kanidm first-class SSO at v2.0 |

### Nix Ecosystem Integrations (v1.1)

From the [NIX-ECOSYSTEM-INTEGRATION-PLAN.md](../cross-version/NIX-ECOSYSTEM-INTEGRATION-PLAN.md):

- **nix-ld** (Free, S effort) — Enable `programs.nix-ld.enable` in NixOS module and VM templates so unpatched binaries (CUDA toolkits, proprietary software) run without wrapping. Removes #1 NixOS guest objection.
- **nixos-generators** (Weaver, M effort) — "Export VM as image" in 12 formats (QCOW2, raw, ISO, OVA, AMI, etc.). `POST /api/vms/:name/export-image` + async job + format selector UI. Also enables appliance VM distribution (Decision #21).
- **home-manager** (Weaver, S effort) — Include as optional module in VM templates. Enables per-user environment customization (shell, editor, packages) while admins control system config. Research/HPC self-service story.

---

## Phase 7a: Container Visibility (v1.1.0)

Read-only container awareness alongside VMs. Docker + Podman are free-tier adoption attractors — every homelab already runs Docker and no competing product pairs VM + container management at zero cost. Apptainer is the Weaver/Fabrick runtime targeting the underserved institutional HPC/research market.

> **Strategic rationale:** Docker and Podman visibility are free — the entry point for homelab users who find us via NixOS. No competing dashboard pairs VM + container management at zero cost, making this a durable free-tier differentiator against Proxmox and Portainer alike. Apptainer (formerly Singularity) users are institutional (universities, national labs, pharma R&D), budget-backed (research grants include tooling line items), and NixOS-adjacent (reproducibility-minded) — the right profile for a Weaver upsell. Zero competing dashboard products exist for this audience.

| Task | Tier | Priority |
| --- | --- | --- |
| `ContainerRuntime` interface (list, inspect, logs, start, stop) | All | High |
| `DockerRuntime` implementation (Docker socket API) | Free | High |
| `PodmanRuntime` implementation (Podman-compatible API) | Free | High |
| Runtime auto-detection (probe which runtimes are installed on host) | All | High |
| `ContainerRuntimeRegistry` — aggregate across available runtimes | All | High |
| Container discovery API: `GET /api/containers`, `GET /api/containers/:id` | All | High |
| WebSocket: `container-status` message type on `/ws/status` | All | High |
| `ContainerCard` dashboard component (status, image, runtime badge) | Free | High |
| Container detail page (inspect, logs, bound paths, resource usage) | Free | Medium |
| `container-store` Pinia store with WebSocket-driven state | Free | High |
| Mock container data for demo mode | Demo | Medium |
| **Workload tag unification** — rebuild TagManagement to read from both `vm-store` and `container-store`; add `PUT /api/containers/:id/tags`; wire TagEditor into container detail panel; display unified workload count (VMs + containers) per tag. Interface: `CombinedTag` gains `containerCount`/`containerNames`. **Demo mock ships with this milestone** (see Decision #60). | Free | High |
| `ApptainerRuntime` implementation — `scanApptainerInstances()` via `apptainer instance list --json` (separate from `scanContainers()`; Apptainer has no daemon and no stopped-container state — discovery is instance-list only, not `ps -a`); `getApptainerStatus/Uptime/start/stop` dispatch in `microvm.ts`; `apptainer instance stats --json` for resource metrics | Weaver | High |
| NixOS module: `containerRuntimes` option (e.g. `["docker", "apptainer"]`) | All | Medium |
| E2E specs for container visibility (cards, detail page, runtime badges) | All | High |

---

## Release Plan

| Version | Milestone | Key Features | Status |
| --- | --- | --- | --- |
| v1.1.0 | Container Visibility + Extension Infrastructure + Homelab Credibility | ContainerRuntime interface, Docker+Podman free (adoption attractor), Apptainer premium (HPC/research), read-only cards + detail, DNS extension, elbow routing, `requirePlugin()`, auth extensions (TOTP $3/mo + FIDO2 Weaver), Technology Alliance OAuth (1Password → TOTP free, Yubico → FIDO2 unlocked), Windows UEFI, resource graphs, VM clone, config export, keyboard shortcuts, Stripe Checkout + extension entitlements (Decisions #28/#39/#40/#42/#X) | Planned |

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log.*
