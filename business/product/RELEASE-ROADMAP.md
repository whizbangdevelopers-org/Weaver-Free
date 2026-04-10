<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver — Release Roadmap (v1.0.0 → v3.3.0)

**Last updated:** 2026-03-25

Visual release chart derived from [MASTER-PLAN.md](../../MASTER-PLAN.md) and version-specific execution roadmaps. For detailed task breakdowns, see the linked plans.

## Forge Leverage — Investor Context

This roadmap assumes **Forge is operational** — WhizBang Developers' autonomous development infrastructure (dedicated build server, multi-agent pipeline, automated compliance and test gates). The numbers below reflect the full five-layer accelerant stack:

| | Without Forge | With Forge | With All Accelerants |
|---|---|---|---|
| v1.0 → v2.2 (enterprise parity) | 18–20 months | ~9 months | **~6–7 months** |
| Enterprise revenue starts | Year 2 (month 18–20) | Year 1 (month 9–10) | **Year 1 (month 7–8)** |
| v1.0 → v3.3 (full fleet product) | ~4 years | ~14 months | **~11 months** |
| Parallel workstreams | 1 (sequential) | 3–4 concurrent agents | 3–4 agents, zero ramp-up, automated acceptance |

**"With Forge" reflects the delivery schedule in [forge/DELIVERY.json](../forge/DELIVERY.json)** — sequential release dates with 3–4 parallel agents running on the Foundry build server. "With All Accelerants" applies the four compounding layers below (~20% further compression per sprint from elimination of discovery, rework, and manual acceptance cycles).

**The combined velocity multiplier to fleet-scale product is ~4.4× over unassisted development** (18-20 month → 11 month path to v3.3, or ~48 months unassisted → ~11 months). To enterprise parity alone (v2.2): ~2.8–3×.

**The binding constraint is not agent throughput — it is human review velocity.** Forge produces PRs faster than one person can merge them. Mitigation: batched 2-hour morning review windows, staggered agent starts, and improving review speed as patterns become familiar (first PR on a new pattern: 30–60 min; subsequent similar PRs: 10–15 min).

### Compounding Accelerants

Four additional layers compress the review bottleneck further — all already in place:

**1. Testing strategy as a reviewer force-multiplier**
The product ships with a full automated quality pyramid: pre-commit hooks (lint + typecheck, ~10s), pre-push hooks (unit tests + security audit, ~25s), and 24 static compliance auditors (tier parity, route auth, form validation, WebSocket codes, bundle size, license, SAST, brand mark, pricing sync, and more, ~20s). Docker E2E gates verify end-to-end behaviour before any PR reaches review. 1,500+ tests run automatically on every push.

The consequence: an agent PR that passes all gates has already been verified for correctness, compliance, and regression. Human review becomes a **30-second intent and pattern check** — not a correctness exercise. The documented 10–15 min familiar-pattern review time drops further. The 24 compliance auditors alone eliminate an entire category of manual review that would otherwise require senior engineering judgement.

**2. Codebase MCP as agent context infrastructure**
A dedicated MCP server (`mcp-server/`) exposes 22 knowledge tools covering the full architectural surface: decisions log, tier model, API endpoints, component tree, storage adapters, store signatures, WebSocket conventions, tier gating patterns, known gotchas, lessons learned, testing blind spots, and more. Agents query this server instead of exploring files — they get the right architectural context instantly, produce pattern-consistent PRs on the first attempt, and require fewer correction cycles. Wrong-pattern PRs (the primary source of review friction) are structurally prevented rather than caught after the fact.

**3. Pre-specified agent definitions — zero discovery overhead**
Every release version has a fully authored agent definition before a single line of implementation code is written: `agents/vX.Y.0/MANIFEST.md` plus individual agent task specs covering scope, acceptance criteria, file targets, and quality gates. `MASTER-PLAN.md` captures 96 settled decisions — architectural choices agents would otherwise have to infer or get wrong. `tier-matrix.json` is the machine-readable source of truth for every feature gate. Agents receive a complete specification and execute against it. There is no discovery phase, no architectural ambiguity, and no back-and-forth on intent. This eliminates the largest source of wasted agent cycles in unstructured codebases.

**4. Mock demo as visual specification + Playwright acceptance test**
The private demo (version switcher, all tiers mocked, every planned version through v3.3 navigable) is not just a sales tool — it is a **visual acceptance specification**. Every feature that will be built has already been mocked and is live in the demo. Agents implement against a known target; Playwright E2E tests run against both the demo and the production build and compare. The expected output is already defined, renderable, and testable before implementation begins. This collapses the feedback loop between "built" and "accepted" to a single automated Playwright run — no manual QA pass, no ambiguous acceptance criteria, no "that's not what I meant."

**Combined effect:** the Forge velocity multiplier (~2.2× to enterprise parity) operates on top of four structural compounding layers — testing infrastructure, codebase MCP, pre-specified agent definitions, and a live visual specification with automated acceptance tests. Together they push the combined multiplier to ~2.8–3× to enterprise parity and ~4.4× to full fleet product. Each layer independently reduces a different bottleneck; together they are structural and self-reinforcing.

**The "With All Accelerants" column in the table above is the target the roadmap is planned to.** Sprint week estimates in [forge/DELIVERY.json](../forge/DELIVERY.json) incorporate all five layers. Source: [Forge/infrastructure/timeline.md](../../Forge/infrastructure/timeline.md), [Forge/AGENT-ALLOCATION.md](../../Forge/AGENT-ALLOCATION.md).

---

## Release Timeline

```
WAVE 1: PRODUCTION LAUNCH
══════════════════════════════════════════════════════════════════════════

v1.0.0  ██████████████████████████████████████████████████  95%
│  Production Ready — Soft Market Entry
│  ├── Tier gating (requireTier(), 5/10/30 rate gradient)
│  ├── Auth (JWT, 3-role RBAC, per-VM ACL, quotas)
│  ├── Demo site (GitHub Pages, tier-switcher, hCaptcha)
│  ├── TUI client (React/Ink, 97% web parity, 183 tests)
│  ├── Brand system, release pipeline, NixOS flake
│  ├── 1,522 tests green (266 unit + 643 backend + 183 TUI + 430 E2E)
│  └── REMAINING: RC1 dry run, cross-bridge routing, NixOS smoke test
│
│  + GTM Launch (parallel): README, blog, SEO, demo enhancement
│
WAVE 2: CONTAINER ORCHESTRATION ARC — "THE HAMMER"
══════════════════════════════════════════════════════════════════════════

v1.1.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Container Visibility + Extension Infrastructure
│  ├── ContainerRuntime interface (Apptainer-first, HPC/research market)
│  ├── Docker/Podman adapters (Weaver-gated)
│  ├── Container cards, detail page, WebSocket status
│  ├── requirePlugin() middleware (plugin model foundation)
│  ├── DNS extension (dnsmasq + CoreDNS, .vm.internal)
│  ├── Orthogonal elbow edge routing (Weaver/Fabrick core)
│  ├── Auth extensions: TOTP ($3 from Free), FIDO2 (Weaver)
│  ├── Windows UEFI/OVMF + VirtIO drivers ISO
│  ├── Service health probes, search/filter, OpenAPI docs
│  └── microvm.nix auto-import, visual regression, cross-browser CI
│
v1.2.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Full Container Management — THE HAMMER (market-defining release)
│  ├── Apptainer: start/stop/restart, SIF pull/build, GPU (--nv/--rocm)
│  ├── Docker/Podman: full lifecycle, image registry, volumes
│  ├── CreateContainerDialog (SIF or OCI, runtime selector, resource limits)
│  ├── Container RBAC (Fabrick), bulk actions, audit logging
│  ├── Firewall plugins (nftables, profile egress, zones)
│  ├── Hardening plugins (AppArmor, Seccomp, Kernel)
│  ├── Cloud-init userdata editor, SSH key management, webhooks
│  ├── Tailscale setup wizard (Free) — NixOS config, one rebuild, remote access forever
│  ├── WireGuard setup wizard (Weaver) — self-hosted, air-gap friendly
│  └── Windows autounattend.xml injection
│
v1.3.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Remote Access + Mobile
│  ├── Network Isolation Mode — toggle disables tunnel, NixOS rollback, VMs unaffected
│  ├── Tunnel status + wizard re-run in Settings
│  ├── Capacitor mobile app — native iOS + Android (same Quasar codebase)
│  ├── Mobile-optimized layouts (dashboard, VM list, VM detail)
│  ├── Push notifications: VM state changes, resource alerts
│  ├── Biometric auth (Face ID / fingerprint)
│  └── App Store + Google Play submission
│
v1.4.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Cross-Resource AI Agent
│  ├── VM + container context injection in AI prompts
│  ├── Cross-resource diagnostics ("why can't container X reach VM Y?")
│  ├── Network topology: VMs + containers + bridges unified
│  ├── Resource dependency mapping, placement suggestions
│  └── Unified search across VMs and containers
│  └── AI credential vault foundation (SQLCipher + sops-nix master key, admin-only CRUD)
│
WAVE 3: SECURE WORKLOAD PLATFORM
══════════════════════════════════════════════════════════════════════════

v1.5.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Integrated Secrets Management
│  ├── Vault expansion: general workload secrets (DB passwords, service tokens)
│  ├── Secrets injection into workloads (env vars, files)
│  ├── Per-workload credential assignment (Fabrick)
│  └── Credential audit trail (Fabrick)
│
WAVE 4: MIGRATION TOOLING ARC
══════════════════════════════════════════════════════════════════════════

v1.6.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Migration Tooling — Export, Import + Format Parsers
│  ├── VM + container config export (.tar.gz archive: manifest + JSON + Nix)
│  ├── Import with preview/dry-run + round-trip integrity test
│  ├── Proxmox .conf parser → Nix generation
│  ├── Libvirt XML parser → Nix generation
│  ├── Dockerfile → dual output: Nix VM OR Apptainer SIF
│  └── Import orchestrator (detect → parse → preview → choose target)
│
══════════════════════════════════════  v1.x ends at v1.6.0  ═══════════

WAVE 4+5: STORAGE, TEMPLATES, MULTI-NODE, BACKUP
══════════════════════════════════════════════════════════════════════════

v2.0.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Storage & Template Foundation
│  ├── Disk lifecycle (create, attach, detach, resize, hotplug, I/O limits)
│  ├── Built-in templates, cloud-init integration
│  ├── Capacitor mobile app + push notifications
│  └── i18n / multi-language
│
v2.1.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Storage & Template Weaver
│  ├── Snapshots, cloning, save-as-template
│  ├── Template library, YAML cloud-init editor
│  ├── "Create from template" workflow
│  ├── Nix template editor (visual NixOS module composition)
│  ├── TPM support (swtpm) for Windows 11
│  └── cloudbase-init (Windows cloud-init equivalent)
│
v2.2.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Weaver Team — Peer Federation
│  ├── Peer host enrollment (Tailscale MagicDNS + manual IP)
│  ├── Full management of up to 2 remote Weaver hosts
│  ├── Host badge on workload cards, REST+WS peer protocol
│  └── Solo → Team upgrade prompt on peer limit
│
v2.3.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Fabrick Basic Clustering
│  ├── Agent extraction (hub-spoke gRPC architecture, multi-node prep)
│  ├── Multi-node workload list + node management UI
│  ├── Cold VM migration between nodes + config sync
│  ├── nixos-anywhere + disko fleet provisioning
│  ├── Colmena fleet config management
│  ├── Attic binary cache
│  ├── nixos-facter hardware discovery
│  ├── weaver-observer (Rust, any Linux) — Observed vs Managed fleet model
│  ├── Fleet discovery wizard (Tailscale/CIDR/CSV/cloud)
│  └── Observer 5× headroom — TAM expansion beyond NixOS
│
v2.4.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Backup Weaver
│  ├── Backup jobs, adapter interface
│  ├── Local/NFS backup adapters
│  └── Restore workflows
│
v2.5.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Storage & Template Fabrick
│  ├── Copy-on-write, storage pools, quotas
│  ├── Template versioning, fleet updates
│  └── Advanced disk management
│
v2.6.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Backup Fabrick + Extensions
│  ├── Multi-target backup, retention policies
│  ├── S3 / restic / borg plugins
│  └── File-level restore, encryption
│
WAVE 6: ADVANCED CLUSTERING + EDGE
══════════════════════════════════════════════════════════════════════════

v3.0.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Fabrick — HA Clustering + Live Migration
│  ├── HA failover, live migration, shared storage
│  ├── Resource scheduling across cluster
│  └── Fencing / STONITH, cluster events log
│
v3.1.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Edge Fleet + Cloud Burst (invoice-based)
│  ├── Edge management (NixOS devices only)
│  │   ├── makeMicroVM factory → deploy to edge nodes over SSH
│  │   ├── Fleet orchestration (fleet-deploy.sh + nixos-anywhere)
│  │   ├── Impermanence (boot-clean edge resilience)
│  │   └── Fleet manifest history, API-triggered deployments
│  ├── Cloud burst node enrollment (AI/HPC, off-premise, invoice billing)
│  │   ├── GPU/InfiniBand passthrough for MicroVMs
│  │   ├── Weaver agent + WireGuard registration for cloud nodes
│  │   ├── Fleet map: on-prem vs cloud visual distinction
│  │   ├── GPU inventory aggregation (H100 count, utilization, InfiniBand)
│  │   ├── Burst node lifecycle (active → retiring → deregistered)
│  │   └── Per-node-day consumption tracking (billing via monthly invoice)
│  ├── Target: $22B edge software market (37% CAGR)
│  │   Manufacturing (23%), cameras (29%), retail, IoT (27%)
│  └── Target: AI/HPC cloud burst — regulated orgs needing hardware isolation
│
v3.2.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PLANNED
│  Cloud Burst Self-Serve Billing
│  ├── Stripe metered billing API (automated per-node-day charging)
│  ├── Pre-purchase day pools + self-serve draw-down
│  ├── Automated pool renewal notifications (20% alert, auto-renew)
│  ├── GPU-aware scheduling hint API (Slurm/K8s bridge)
│  └── Pre-warmed node pool management (reduce cold-start latency)
```

---

## Tier Revenue Ramp by Release

| Release | Weaver Free (adoption) | Weaver (revenue) | Fabrick (moat) |
|---------|----------------|-------------------|-------------------|
| **v1.0** | Weaver, VM manage, BYOK AI, console, tags | Live Provisioning, distros, bridges | RBAC, quotas, bulk ops, audit |
| **v1.1** | Apptainer visibility, health probes, search | DNS extension, Docker/Podman, TOTP, Windows UEFI | Elbow routing, topology |
| **v1.2** | — | Full container mgmt, GPU, firewall, hardening, Tailscale wizard | Container RBAC, firewall zones |
| **v1.3** | Tailscale wizard, Android app (dashboard, VM control, biometric auth) | WireGuard wizard, Network Isolation Mode, push notifications, deep links | — |
| **v1.4** | Combined stats | Cross-resource AI, unified search, AI credential vault | Topology + dependency mapping |
| **v1.5** | — | AI credential vault expansion, secrets injection | Full secrets management, per-workload assignment, credential audit trail |
| **v1.6** | Dockerfile→SIF (onboarding funnel) | Config export/import, Proxmox/libvirt parsers | Full audit trail |
| **v2.0–2.1** | Disk basics, templates | Snapshots, cloning, save-as-template | Template versioning |
| **v2.2** | — | **Weaver Team** peer federation (full management of up to 2 remote Weaver hosts, REST+WS, host badge on workload cards, Tailscale MagicDNS + manual IP, upgrade prompt on peer limit) | — |
| **v2.3** | — | — | FabricK Basic Clustering (agent extraction, hub-spoke gRPC, cold migration, nixos-anywhere/Colmena/Attic/nixos-facter, `weaver-observer` for any-Linux fleet visibility — fleet management + TAM expansion) |
| **v2.4–2.6** | Config export | Backup jobs, local/NFS | Multi-target, S3/restic/borg, encryption |
| **v3.0** | — | — | HA, live migration |
| **v3.1** | — | — | Edge fleet management, cloud burst node enrollment (AI/HPC, invoice-based) |
| **v3.2** | — | — | Cloud burst self-serve billing (Stripe, pre-purchase pools) |

---

## Strategic Inflection Points

### 1. v1.0 — Soft Market Entry
Prove the product exists and works. Weaver Free tier drives adoption. Demo site converts visitors. GTM content establishes presence.

### 2. v1.2 — "The Closer" (market-defining)
Ships complete container story in one release. *"The only dashboard that manages MicroVMs, Apptainer, and Docker from a single pane."* Apptainer-first targets the zero-competition HPC/research market with institutional budgets and grant-backed purchasing.

### 3. v1.3 — Mobile + Remote Access (Pegaprox differentiator)
Proxmox has no mobile app. v1.3 ships native Android via Quasar Capacitor — same codebase, zero duplication. iOS follows at v1.3.x. Network Isolation Mode closes the compliance gap (CMMC, HIPAA audit periods). No competitor has any of this.

**Mobile app is Weaver Free tier (Decision #50):** The core app — dashboard, VM control, biometric auth, Tailscale remote access — is available to all users at no cost. This is a deliberate marketing decision: App Store/Play Store presence is organic discovery; no competitor (including Proxmox) offers a free native mobile app; and giving Free users a pocket control plane dramatically raises perceived product value and drives top-of-funnel growth. Push notifications and deep-link VM actions are Weaver — the natural in-app upgrade prompt that converts engaged free users.

**Android-first:** Android ships at v1.3.0 GA. $25 one-time Google Play fee, 2–7 day review, fastest to market. The NixOS/homelab audience skews Linux/Android. iOS follows at v1.3.x after Apple Developer Program enrollment ($99/year) and a 4–6 week TestFlight beta + 1–2 week App Store review cycle. For v1.3.0 targeting August 2026 GA: Google Play submission mid-July. For iOS v1.3.x: TestFlight beta starts late August, App Store submission September.

**Why the wizards ship in v1.2:** The Tailscale and WireGuard setup wizards land one version early — in v1.2 — because they are the prerequisite for the mobile app. The wizard generates a NixOS config, the user runs one rebuild, and the remote-access tunnel is established permanently. The v1.3 mobile app then uses that tunnel to reach the backend from anywhere, forever. Tailscale wizard = Free; WireGuard wizard = Weaver (self-hosted, air-gap friendly, preferred for defense/healthcare/government).

**Revenue model — no IAP:** All subscriptions are sold through microvm.dev via Stripe. The mobile app is a client to the user's self-hosted node; it does not sell anything inside the app. Apple's 30% cut does not apply. Apple's 2024 developer agreement updates permit external purchase links for B2B SaaS clients in this category.

**Conversion uplift:** The mobile app transforms Weaver from "web dashboard with advanced features" into "pocket control plane." Free users who install the Android app, set up Tailscale, and enable biometric auth are significantly more engaged and encounter the push-notification Weaver upgrade prompt at a moment of high intent — they already love the product and want more. Scenario revenue projections model a ~15% uplift in monthly new Weaver customer increments from one month after v1.3 ships. Free-tier mobile additionally expands the top-of-funnel through Play Store discovery, a channel not reflected in the current model — upside not yet quantified.

### 4. v1.5 — Secure Workload Platform

> *"Weaver enables integrated secrets management for your workload platform."*

No competitor — including Proxmox — has native credential management embedded in the workload manager. v1.5 ships the full vault: general workload secrets (DB passwords, service tokens, AI credentials), secrets injection at workload boot, and per-workload assignment for Fabrick. Admin-only at every tier. Compliance-aligned: HIPAA, CMMC Level 2, SOC 2, PCI DSS credential management requirements addressed in a single release. Fabrick (v3.0) federates the vault across the fleet.

**Why not an extension:** Secrets management is foundational infrastructure, not a feature module. Making it an extension implies Weaver without vault is complete — it isn't, not at the compliance level Fabrick buyers require. Weaver gets vault management + injection (team coordination). Fabrick gets per-workload assignment + audit trail (governance). The boundary is the upgrade path.

### 5. v1.6 — Migration Funnel Closes
Proxmox/libvirt/Docker users can import configs and switch. Dockerfile dual-output (Nix VM or Apptainer SIF) is a unique onboarding funnel no competitor offers. Config export/import combined with format parsers in one release — complete migration tooling. Pegaprox territory begins.

### 7. v2.2 — Multi-Host Visibility + Weaver Team Federation
Basic clustering is the feature that opens the fabrick fleet-management conversation. Multi-node visibility and manual migration establish the product as a fleet management tool, not a single-host dashboard. v3.0 adds HA failover and live migration — that is the full Proxmox clustering story. v2.2 earns fabrick evaluators; v3.0 closes them.

v2.2.0 also ships **Weaver Team** peer federation: 2–4 users share a Weaver host, with full management of up to 2 remote peer Weaver hosts (REST+WebSocket, Tailscale MagicDNS peer discovery + manual IP, host badge on workload cards, upgrade prompt on peer limit). This is a Weaver revenue unlock — not Fabrick (Fabrick-only, v3.0+). Weaver Team ARPU: avg 3 users × $99/user/yr (FM) = **$297/yr per team**. License key prefix: `WVR-WVT-`.

### 8. v3.0 — Full HA Clustering
Competes with Rancher/Nutanix/Spectro Cloud tier on HA. v3.0 closes the initial fabrick deal with HA failover and live migration. Edge management and cloud burst ship at v3.1 — isolated for testing and accelerated deployment.

### 9. v3.1 — Edge Fleet + Cloud Burst
NixOS edge management via microvm-anywhere pattern. Entry into the $22B edge software market (37% CAGR). Manufacturing floors (23%), video/camera nodes (29%), retail, IoT automation (27%). Cloud burst node enrollment opens the AI/HPC regulated workload market (finance, defense research, healthcare, national labs). Invoice-based for large enterprise.

### 10. v3.2 — Cloud Burst Self-Serve
Stripe metered billing opens the self-serve AI-native lab market. Pre-purchase day pools let smaller AI teams buy burst capacity without a sales call. GPU-aware scheduling hints bridge to customers' existing Slurm/K8s schedulers.

---

## Extension Revenue Layering

Plugins are purchasable a la carte at tier minimums. Fabrick includes all plugins.

| Plugin Category | Ships In | Weaver Free | Weaver | Fabrick |
|----------------|----------|------|---------|------------|
| AI Providers | v1.0 | Anthropic BYOK | OpenAI, Ollama, ZenCoder, Custom + profile switching | + policy routing |
| DNS | v1.1 | Host stub + auto-zone + DHCP | Resolver, Security | Audit, Fabrick (split-horizon, AD) |
| Auth | v1.1+ | Password (14-char) · TOTP unlocked via 1Password TA (OAuth) | TOTP (incl.), FIDO2 (incl.) | SSO/SAML, LDAP |
| Firewall | v1.2 | None (zero liability) | Presets, Custom Rules, Egress | Zones, Drift, Audit |
| Hardening | v1.2+ | Systemd sandbox | AppArmor, Seccomp, Kernel (from Weaver) | All included |
| Backup | v2.4+ | Config export | Disk Backup, Scheduled | Remote Targets, Encryption |

---

## Competitive Positioning by Version

| Version | Competes With | Our Advantage |
|---------|--------------|---------------|
| v1.0 | Cockpit, basic webmin | NixOS-native, mobile-first, AI diagnostics, TUI |
| v1.2 | Portainer (containers only) | Unified VM + container management, Apptainer support |
| v1.3 | Proxmox (no mobile) | Native iOS/Android app, remote access wizards, Network Isolation Mode |
| v1.6 | Proxmox (migration path) | Import Proxmox configs directly, NixOS reproducibility |
| v2.2 | Proxmox clusters | Declarative, immutable infrastructure, plugin model |
| v3.0 | Rancher, Nutanix (HA clustering) | NixOS HA with declarative config, atomic rollbacks |
| v3.1 | Rancher, Nutanix, Spectro Cloud | NixOS edge with zero drift, $22B edge market + AI/HPC burst |

---

## Pricing Reference

- **Weaver Free** = "Use the VMs you already have" — adoption hook
- **Weaver** = "Live Provisioning" — anchored against Proxmox Community (€355/yr) with more features at a competitive price
  - **Solo** (`WVR-WVS-`): **$249/yr** standard (post-v1.2) · **$149/yr FM** (locked forever, first 200 customers OR v1.2, Decision #121) · **$299/yr** (post-v3.0). Quarterly: $69. Admin only, local only, up to 128GB RAM.
  - **Team** (`WVR-WVT-`): **$149/user/yr** standard (post-v2.2) · **$99/user/yr FM** (locked forever, first 50 teams OR v2.2, Decision #121). 2–4 users + 1 viewer free, up to 2 remote peer Weaver hosts (full management). Ships v2.2.0. Standard ARPU: avg 3 users × $149 = **$447/yr per team**
  - TOTP MFA included in Weaver. 1Password TA = TOTP unlocked on Weaver Free tier via OAuth.
- **Fabrick** = "Team governance + all plugins" — anchored against Rancher/OpenShift/Nutanix/Canonical ("features, not price")
  - **v1.0–v2.1 standard:** $1,500/yr first node · $750 add'l · $500 at 10+
  - **v2.2+ standard:** $2,000/yr first node · $1,000 add'l · $700 at 10+ (10-node: $10,700/yr)
  - **v3.0+ standard:** $3,500/yr first node · $1,750/yr all add'l nodes (flat) · 10-node: $19,250/yr · 20-node: $36,750/yr
  - **Founding Member:** $999/yr/node (locked forever, first 20 seats, cap: v2.2) — 50% off post-v2.2 standard. Design Partner status. Direct outreach only.
  - Fabrick: $2,500→$3,000→$3,500/yr (v1.0/v2.2/v3.0 steps) · $1,750/yr FM (first 10, cap: v2.2) · 512GB+ RAM
  - Contract tier: block pricing from $2,000/512GB block, sliding scale (512GB+ deployments)
  - See [TIER-MANAGEMENT.md](TIER-MANAGEMENT.md), [FOUNDING-MEMBER-PROGRAM.md](FOUNDING-MEMBER-PROGRAM.md), [PRICING-POWER-ANALYSIS.md](PRICING-POWER-ANALYSIS.md)
- **Technology Alliances:** TOTP unlocked for 1Password customers (OAuth, Weaver Free tier); FIDO2 unlocked for Yubico customers (OAuth). Decision #42.

---

## Source Documents

| Document | Location |
|----------|----------|
| Master Plan | [MASTER-PLAN.md](../../MASTER-PLAN.md) |
| v1.0 Execution Roadmap | [plans/v1.0.0/EXECUTION-ROADMAP.md](../../plans/v1.0.0/EXECUTION-ROADMAP.md) |
| v1.1–1.2 Execution Roadmap | [plans/v1.1.0/EXECUTION-ROADMAP.md](../../plans/v1.1.0/EXECUTION-ROADMAP.md) |
| v1.3 Execution Roadmap (Remote Access + Mobile) | [plans/v1.3.0/EXECUTION-ROADMAP.md](../../plans/v1.3.0/EXECUTION-ROADMAP.md) |
| v1.4 Execution Roadmap (Cross-Resource AI) | [plans/v1.4.0/EXECUTION-ROADMAP.md](../../plans/v1.4.0/EXECUTION-ROADMAP.md) |
| v1.5–1.6 / v2.x Execution Roadmap | [plans/v2.0.0/EXECUTION-ROADMAP.md](../../plans/v2.0.0/EXECUTION-ROADMAP.md) |
| v3.1 Execution Roadmap (Edge Fleet + Cloud Burst) | [plans/v3.1.0/EXECUTION-ROADMAP.md](../../plans/v3.1.0/EXECUTION-ROADMAP.md) |
| v3.2 Execution Roadmap (Cloud Burst Self-Serve) | [plans/v3.2.0/EXECUTION-ROADMAP.md](../../plans/v3.2.0/EXECUTION-ROADMAP.md) |
| Weaver Value Proposition | [WEAVER-VALUE-PROPOSITION.md](WEAVER-VALUE-PROPOSITION.md) |
| Fabrick Value Proposition | [FABRICK-VALUE-PROPOSITION.md](FABRICK-VALUE-PROPOSITION.md) |
| Budget & Entity Plan | [BUDGET-AND-ENTITY-PLAN.md](BUDGET-AND-ENTITY-PLAN.md) |

---

*This document is a business-facing summary. For implementation details, see the execution roadmaps. For the canonical decision log, see [MASTER-PLAN.md](../../MASTER-PLAN.md).*
