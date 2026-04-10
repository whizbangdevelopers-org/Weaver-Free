<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Tier Management Plan

**Last updated:** 2026-03-24

How Weaver Free, Weaver Solo, Weaver Team, and Fabrick tiers are gated, licensed, and enforced. (Tier naming: Decision #87)

Canonical tier matrix: [MASTER-PLAN.md § 3-Tier + Integrated Extensions Model](../../MASTER-PLAN.md)
Canonical decision log: [MASTER-PLAN.md § Decisions Resolved](../../MASTER-PLAN.md)

---

## Recent Changes

_Delete this section once pricing decisions are finalized._

- **2026-03-26** — Observer node pricing added: `weaver-observer` (any Linux, read-only) included free up to 5× Managed node count. No separate SKU. FM customers same ratio at no charge. Decisions #101, #102.
- **2026-03-21** — Navigation vocabulary settled (Decision #75): "Network" renamed to "Strands" (local topology, route `/network`); "Loom" added as fleet topology view (Fabrick, route `/loom`); sidebar order: Fabrick → Loom → Weaver → Strands. Textile metaphor: Strands → Loom → Weaver → Fabrick. Weaver tier split into Solo and Team with distinct capabilities (Decision #76): WVR-WVS (Solo), WVR-WVT (Team). Remote workload display for Weaver Team — remote workloads appear with full management in existing Weaver view with host badge, no new nav surface (Decision #77, amended by #130). Tailscale-first peer discovery for Weaver Team + manual IP/hostname fallback (Decision #78).
- **2026-03-18** — License unit changed from "unlimited VMs per node" to RAM-based coverage (Decision #62). Fabrick pricing raised from $799 to $2,000/yr first node (Decision #63). Fabrick tier added at $2,500/yr, 512GB RAM (Decision #64). Contract tier added for 512GB+ deployments, sliding scale per 512GB block (Decision #65). v1.x founding-member cohort grandfathered at $799/yr named rate. Revenue modeling updated with new ARPU figures.
- **2026-03-04** — Extracted competitive pricing benchmarks and positioning tables to [pricing-benchmarks.md](../../research/pricing-benchmarks.md). Summaries retained inline; raw data now updated independently.
- **2026-03-04** — Added Fabrick Success Programs (Adopt/Accelerate/Partner) replacing "Support Tiers". Revenue modeling revised with realistic fleet sizes (10/30/100 nodes).

---

## Current State (Implemented in Code)

The 3-tier model is fully implemented as of Phase 6:

| Component | Implementation | Status |
|-----------|---------------|--------|
| Tier config model (`free` / `premium` / `enterprise`) | `backend/src/config.ts` | Done |
| `requireTier()` Fastify route decorator | All tier-gated routes | Done |
| `useTierFeature()` frontend composable | All tier-gated UI | Done |
| Rate limit gradient (5 / 10 / 30 per min) | Per-user middleware | Done |
| Demo tier-switcher (toolbar toggle) | `DemoTierSwitcher.vue` | Done |
| TUI tier gating (same middleware) | React/Ink TUI | Done |
| License key validation (HMAC, offline) | `backend/src/license.ts` | Done |
| `LICENSE_KEY` / `LICENSE_KEY_FILE` env vars | Backend config + NixOS module | Done |

---

## 3-Tier + Integrated Extensions Model (Decided 2026-03-03)

Three tiers define **scale and governance**. Integrated Extensions define **capabilities per domain**, purchasable à la carte at tier minimums. Fabrick includes all extensions.

### License by Tier (Decision #137)

| Tier | License | Distribution |
|------|---------|-------------|
| **Weaver Free** | AGPL-3.0 + Commons Clause + AI Training Restriction | Public repo |
| **Weaver Solo** | BSL-1.1 + AI Training Restriction | Private repo, key-gated |
| **Weaver Team** | BSL-1.1 + AI Training Restriction | Private repo, key-gated |
| **Fabrick** | BSL-1.1 + AI Training Restriction | Private repo, key-gated |

### Tier Matrix (Canonical — from MASTER-PLAN)

| Feature | Weaver Free | Weaver Solo | Weaver Team | Fabrick |
|---------|:-----------:|:-----------:|:-----------:|:-------:|
| Multi-user (additional users beyond the admin) | — | Admin only | Up to 4 paying + 1 viewer free | Unlimited |
| **Remote workload management** | — | — | Yes — up to 2 peer hosts, host badge, full management | Full management (unlimited peers) |
| **Peer Weaver discovery** | — | — | Tailscale MagicDNS + manual IP/hostname | Fabrick enrollment |
| **Peer host limit** | — | — | 2 remote peers max | Unlimited (Fabrick) |
| **Non-NixOS host observation** | — | — | — | Included — up to 5× Managed node count. Read-only workload visibility (containers, VMs, resource stats). No compliance evidence. `weaver-observer` binary, any Linux. Decisions #101, #102 |
| Weaver (workload list — VMs + containers), workload detail, WebSocket, help, settings | Yes | Yes | Yes | Yes |
| Strands — local topology (read-only) + auto-detected bridges | Yes | Yes | Yes | Yes |
| Start / stop / restart VMs | Yes | Yes | Yes | Yes |
| Scan + register existing VMs | Yes | Yes | Yes | Yes |
| Serial console, tags, logs, AI tab, metadata | Yes | Yes | Yes | Yes |
| In-app notification bell + history | Yes | Yes | Yes | Yes |
| Config export (JSON via API) | Yes | Yes | Yes | Yes |
| AI agent: mock + Anthropic BYOK | 5/min | — | — | — |
| AI credential vault — admin-managed frontier + application-specific AI credentials (v1.4.0) | — | Yes | Yes | Yes |
| AI provider extensions (OpenAI, Ollama, ZenCoder, Custom) | — | Yes (profile switching) | Yes (profile switching) | Yes (policy routing) |
| Integrated secrets management — general workload secrets, injection, per-workload assignment, credential audit trail (v1.5.0) | — | Vault + injection | Vault + injection | Full (+ per-workload assignment + audit) |
| Container visibility: Docker + Podman (start/stop/logs) | Yes | Yes | Yes | Yes |
| Container visibility: Apptainer (HPC/research runtime) | — | Yes | Yes | Yes |
| Container management (create/delete, Compose stacks, `oci-containers` Live Provisioning) | — | Yes | Yes | Yes |
| **Host Config viewer** (`configuration.nix`) — read-only, workload definitions categorized by type (MicroVMs, OCI containers, Slurm nodes); infrastructure layer shown separately | Yes | Yes | Yes | Yes |
| Container registry + multi-host orchestration | — | — | — | Yes |
| **Live Provisioning** (create / provision / delete VMs — no `nixos-rebuild switch`) | — | Yes | Yes | Yes |
| Distro mutations (add/delete/refresh/URL mgmt) | — | Yes | Yes | Yes |
| Distro smoke testing ("will it boot?" UI + CLI) | — | Yes | Yes | Yes |
| Create/delete managed bridges + IP pools | — | Yes | Yes | Yes |
| Push notification channels + resource alerts | — | Yes | Yes | Yes |
| **Mobile app** (Android GA · iOS v1.3.x): dashboard, VM control, Tailscale remote, biometric auth | Yes | Yes | Yes | Yes |
| Mobile push notifications + deep-link VM actions | — | Yes | Yes | Yes |
| Per-VM access control | — | — | — | Yes |
| User management (Users page) | — | — | Yes (capped) | Yes |
| Bulk VM operations | — | — | — | Yes |
| VM resource quotas | — | — | — | Yes |
| Audit log | — | — | — | Yes |

### Integrated Extensions Catalog (Roadmap)

| Category | Core (Weaver Free) | Weaver Extensions | Fabrick Extensions | Version |
|----------|------------|-----------------|-------------------|---------|
| AI Providers | Anthropic BYOK (Weaver Free only) | AI credential vault + OpenAI, Ollama, ZenCoder, Custom (incl.) | + policy routing | v1.0.0 / v1.4.0 |
| **AI Pro Extension** | — | Model library in Shed, model deployment workflow (7-step), snapshot provisioning (memory 2–5 sec + disk 10–30 sec), GPU templates (CUDA/ROCm/oneAPI), inference metrics (latency, tokens/sec, queue depth), auto-restart on VRAM OOM, model status lifecycle. **$99/yr (now included in base, Decision #142).** Not included in base FM lock — separate extension pricing (Decision #120). **Champion Credit:** waived ($0) for FM customers who have championed Weaver (enterprise referral, testimonial, community contribution, or org has active Fabrick subscription). See FOUNDING-MEMBER-PROGRAM.md. | — | v2.0 |
| **AI Fleet Extension** | — | — | GPU reservation/queue/preemption, MIG partitioning, multi-GPU topology-aware assignment, snapshot-based auto-scaling, fleet-bridge aggregated inference metrics, per-workload-group GPU utilization, set point auto-scaling triggers, fleet inference routing, fleet model deployment, fleet snapshot distribution, fleet GPU scheduling (cross-host). **$499/yr/node (now included in base, Decision #142).** Not included in base FM lock — separate extension pricing (Decision #120). | v2.2 (scheduling) · v3.0 (fleet) |
| Secrets | — | General workload secrets, injection at boot | + per-workload assignment, credential audit trail, HashiCorp Vault integration (inject from existing Vault into any workload at provision) | v1.5.0 |
| DNS | Host stub | Zero-config VM zones — `.vm.internal` auto-zones, DHCP, no manual dnsmasq config | Fabrick DNS — split-horizon for compliance isolation, AD integration, zone audit trail | v1.1.0 |
| DNS | — | Encrypted resolver — DNSSEC validation, DoH/DoT upstream, per-zone caching | — | v1.1.0 |
| Firewall | None (zero liability) | Per-VM firewall automation — apply profiles at provision, custom nftables rules, egress control per workload | Zone-based enforcement, automated drift detection, rule audit trail | v1.2.0 |
| Auth | Password | TOTP (incl.), FIDO2 (incl.) | SSO/SAML (incl.), LDAP (incl.) | v1.1.0+ |
| Hardening | Systemd sandbox | AppArmor, Seccomp, Kernel (from Weaver) | All included | v1.2.0+ |
| Backup | Config export | Disk Backup, Scheduled | Remote Targets, Encryption | v1.6.0+ |
| **Compliance Export** | — | — | Auditor-ready evidence packages: framework control mapping (HIPAA, SOC 2, PCI-DSS, NIST 800-53, CMMC), signed config attestation, formatted audit log export, scheduled delivery. **$4,000/yr flat per org** (not per node). See [COMPLIANCE-EXPORT-EXTENSION.md](COMPLIANCE-EXPORT-EXTENSION.md). | v2.2 (core) · v2.4 (CMMC) · v3.0 (scheduled) |
| **Fabrick Cloud** | — | — | WBD-hosted Fabrick control plane. Customer nodes connect outbound to WBD-managed hub — no self-hosted hub to maintain. Fleet dashboard, centralized audit log, AI fleet diagnostics, SLA-backed uptime. Additive to Fabrick subscription (per node). **$150/yr/node FM (Founding Member, locked forever, closes at v4.0 GA) · $200–250/yr/node standard.** Pre-sell opens at v3.0 GA; 20-customer pre-sell is the Path A validation gate. See [FABRICK-CLOUD.md](FABRICK-CLOUD.md). | v4.0 |

### Tier Positioning

- **Weaver Free** = "Use the VMs you already have, from anywhere" — dashboard, manage existing VMs, native mobile app (Android GA · iOS v1.3.x), Tailscale remote access, adoption hook
- **Weaver Solo** = "Live Provisioning on your machine" — create VMs without `nixos-rebuild switch`, distros, bridges, push notifications, mobile deep links, extension system. Single operator.
- **Weaver Team** = "Live Provisioning + manage your whole team's infrastructure" — everything Solo has, plus full management of up to 2 peer Weaver hosts in the existing Weaver view. Remote workloads appear with a host badge; all management actions available. Peer discovery via Tailscale MagicDNS or manual IP entry. Each peer host needs its own Weaver key.
- **Fabrick** = "Full fleet governance + all extensions included" — full remote management via Fabrick and Loom, Live Provisioning across nodes, per-VM RBAC, quotas, bulk ops, audit log, policy routing, gRPC clustering

### Weaver Solo vs Weaver Team

| Capability | Weaver Solo | Weaver Team |
|-----------|:------------:|:------------:|
| Users | Admin only | 2–4 paying + 1 viewer free |
| Remote workload management | — | Full management in Weaver (host badge, up to 2 peers) |
| Peer discovery | — | Tailscale MagicDNS + manual IP/hostname |
| Peer protocol | — | REST + WebSocket |
| Price | $149/yr | $129/user/yr |
| Peer host limit | — | 2 (encoded in key payload) |
| License key prefix | `WVR-WVS-` | `WVR-WVT-` |
| Version available | v1.0+ | v2.2+ |

### Insurance Principle (Decision #30)

Weaver Free tier = zero security features, zero liability exposure. No scanning, no display, no implied security posture for unpaid users. Features behind paywall = insurable claims backed by audit trails.

---

## License Key System

### Key Format

```
WVR-<tier>-<payload>-<checksum>

Examples:
  WVR-FRE-Z1A2B3C4D5E6-W7X8      # Weaver Free (from registration)
  WVR-WVS-A1B2C3D4E5F6-X7Y8      # Weaver Solo
  WVR-WVT-B2C3D4E5F6G7-Y8Z9      # Weaver Team
  WVR-ENT-G9H0I1J2K3L4-M5N6      # Fabrick
  WVR-ENP-H0I1J2K3L4M5-N6O7      # Fabrick
```

- **Prefix**: `WVR-` (Weaver)
- **Tier indicator**: `FRE` / `WVS` (Weaver Solo) / `WVT` (Weaver Team) / `ENT` (Fabrick) / `ENP` (Fabrick 512GB config)
- **Payload**: 12-character alphanumeric (base36), encodes: issue date, expiry, customer ID
- **Checksum**: 4-character HMAC suffix for offline validation

### Validation Strategy

**Offline-first** — the key is self-validating. No phone-home, no license server, no internet required.

| Check | Method | When |
|-------|--------|------|
| Format validation | Regex + checksum | On key entry |
| Tier extraction | Parse tier indicator | On key entry |
| Expiry check | Decode date from payload | On startup + daily |
| Tampering detection | HMAC checksum with embedded secret | On key entry |

**Why offline-first:**
- NixOS servers may be air-gapped or behind firewalls
- Self-hosters hate phone-home DRM
- Reduces infrastructure burden (no license server to maintain)
- Aligns with open-source ethos — respect the user

**Trade-off:** Offline keys can be shared. Mitigation: per-customer keys with revocation list (optional, checked if internet available). Accept some sharing as cost of good UX.

### Key Storage

```
# backend/.env
LICENSE_KEY=WVR-WVS-A1B2C3D4E5F6-X7Y8

# nixos/default.nix
services.weaver = {
  licenseKey = "WVR-WVS-A1B2C3D4E5F6-X7Y8";
  # OR
  licenseKeyFile = "/run/secrets/weaver-key";  # sops-nix
};
```

### Key Lifecycle

```
Purchase → Generate key → Email to customer → Customer enters in Settings or .env
                                                         ↓
                                               Backend validates on startup
                                                         ↓
                                            Tier stored in config, exposed via /api/health
                                                         ↓
                                               Frontend renders tier badge
                                                         ↓
                                            Routes enforce tier-based access
```

---

## Node Definition

A **node** is one NixOS host whose microVMs are managed by Weaver.

### What Counts as a Node

| Counts as a node | Does NOT count as a node |
|---|---|
| Any NixOS host running the `weaver` backend service (standalone or hub) | The microVMs themselves (guests are unlimited per node) |
| Any remote NixOS host registered as a managed endpoint in multi-node mode | Failover/standby replicas that aren't actively managing VMs |
| A host running both hub + local VMs (counts as 1 node, not 2) | Development/staging instances (honor system, or separate dev key) |

### Design Principles

1. **RAM-based coverage** — the license unit is GB of RAM readable from `/proc/meminfo` at host registration. All workload types — MicroVMs, containers, Apptainer instances, nested or not — consume RAM at the host level. No nesting loophole (a VM stuffed with 20 containers still consumes host RAM). Applies uniformly to self-hosted and cloud deployments.
2. **Hub counts as a node** — prevents "free hub + paid workers" loophole
3. **Per-host, not per-socket/per-CPU** — simpler than Proxmox's per-socket model
4. **Contract above 512GB** — the 512GB boundary is a contract tier boundary, not a deployment model boundary. AI/HPC nodes (1TB+), large memory-optimized cloud instances, and high-RAM bare-metal servers all follow the same 512GB block model. Those buyers expect contracts.

### RAM Coverage by Tier

| Tier | RAM Coverage | Standard Price | Founding Member | Contract? |
|---|---|---|---|---|
| Weaver Free | Up to 32GB | $0 | — | No |
| Weaver Solo | Up to 128GB | $249/yr (post-v1.2) · $149/yr (v1.0–v1.1) | $149/yr locked forever (cap: v1.2) | No |
| Weaver Team | Up to 128GB/host | $199/user/yr (post-v2.2) | $129/user/yr locked forever (cap: v2.2) | No |
| Fabrick (256GB/node) | Up to 256GB/node | $2,000 (v1.0–v2.1) · $2,000 (v2.2+) · $3,500 (v3.0+) /yr first node; $1,750/yr all add'l nodes (v3.0+, flat) | $1,299/yr/node locked forever (first 20, cap: v2.2) | No |
| Fabrick (512GB/node) | Up to 512GB/node | $2,500 (v1.0–v2.1) · $3,000 (v2.2+) · $3,500 (v3.0+) /yr | $1,750/yr/node locked forever (first 10, cap: v2.2) | No |
| Contract (512GB+) | Per 512GB block above ceiling | $2,000 block 1 · $1,750 (2–3) · $1,500 (4–7) · $1,250 (8+) | — | Yes |

Cloud and self-hosted deployments use identical RAM measurement — the agent reads `/proc/meminfo` at registration regardless of deployment type. SMB cloud instances (8–64GB) fall in Weaver Free/Weaver. Cloud memory-optimized instances (128–512GB) fall in Fabrick (256GB) or Fabrick (512GB). AI/HPC nodes (1TB+) use the contract block model.

**Burst / ephemeral cloud nodes (Fabrick v3.0+, Decision #66):** Cloud burst nodes provisioned for days-long training runs (3–14 days typical for LLM workloads) cannot sensibly carry annual per-node licensing. For Fabrick-enrolled burst nodes, a **per-node-day consumption add-on** stacks on the customer's existing Contract tier base license. Rate: $15–25/node-day (1TB node = 1 Contract block), with volume tiers at 100+ and 500+ node-days/month. **v3.0 (large enterprise):** Fabrick dashboard shows node-days consumed; billing via monthly invoice — aligns with procurement-cycle buyers. **v3.1 (self-serve):** Stripe metered API, pre-purchase day pools with self-serve draw-down, automated renewal — targets AI-native labs. Full analysis: [FABRICK-CLOUD-BURST.md](FABRICK-CLOUD-BURST.md).

### Node Allowance per Tier

| Tier | Node Allowance | RAM/Node | Multi-Node Capability |
|---|---|---|---|
| Weaver Free | 1 node | 32GB | No |
| Weaver Solo/Team | 1 node per key | 128GB | Hub + N remote nodes via REST+WS (each remote needs own key) |
| Fabrick (256GB) | N nodes (count encoded in key) | 256GB | Hub + N remote nodes via REST+WS + gRPC, single key |
| Fabrick (512GB) | N nodes (count encoded in key) | 512GB | Same as Fabrick |
| Contract | Custom | 512GB+ per block | Negotiated |

---

## Pricing — ALL TIERS DECIDED

> **Status:** Revised 2026-03-22. Standard prices step up at major version milestones; FM buyers are grandfathered at purchase price forever. See [PRICING-POWER-ANALYSIS.md](PRICING-POWER-ANALYSIS.md) and [FOUNDING-MEMBER-PROGRAM.md](FOUNDING-MEMBER-PROGRAM.md).
>
> **Weaver Free:** $0 · 1 node · up to 32GB RAM
>
> **Weaver Solo standard:** $249/yr annual · $69/quarter ($276/yr) quarterly · up to 128GB RAM · TOTP MFA included. *Effective when v1.2 ships. Pre-v1.2 price was $149/yr.*
> **Weaver Solo Founding Member:** $149/yr locked forever (= pre-v1.2 standard). **First 200 customers.** Window closes when v1.2 ships OR 200 cap reached, whichever first (Decision #121).
>
> **Weaver Team standard:** $199/user/yr (2–4 users + 1 viewer free) · up to 128GB/host · annual only. *Effective when v2.2 ships.*
> **Weaver Team Founding Member:** $129/user/yr locked forever. **First 50 teams.** FM window opens at v2.1, closes when v2.2 ships OR 50 cap reached, whichever first (Decision #121).
>
> **Firewall add-on:** $69/yr, annual only (à la carte, insurance principle — Decision #47).
> **TOTP MFA:** Included in Weaver. Free for 1Password TA customers (OAuth-unlocked on Weaver Free tier via Technology Alliance — Decision #42).
>
> **Fabrick standard (256GB/node):** $2,000/yr first node · $750 add'l · $500 at 10+ (v1.0–v2.1) → $2,000 · $1,000 · $700 (v2.2+) → $3,500/yr first node · $1,750/yr all add'l nodes (v3.0+, flat rate) · up to 256GB RAM/node. 10-node deal at v3.0: $19,250/yr. 20-node deal: $36,750/yr. See [FABRICK-VALUE-PROPOSITION.md](FABRICK-VALUE-PROPOSITION.md).
> **Fabrick Founding Member (256GB/node):** $1,299/yr/node locked forever. First 20 customers. Design Partner status included. Window closes when v2.2 ships. Direct outreach only.
>
> **Fabrick standard (512GB/node — high-RAM config):** $2,500/yr/node (v1.0–v2.1) · $3,000 (v2.2+) · $3,500 (v3.0+) · up to 512GB RAM/node.
> **Fabrick Founding Member (512GB/node):** $1,750/yr/node locked forever. First 10 customers. Window closes when v2.2 ships.
>
> **Contract (512GB+):** $2,000/block (first) · $1,750 (blocks 2–3) · $1,500 (blocks 4–7) · $1,250 (8+) · negotiated above. Per 512GB block above Fabrick ceiling. Cloud and self-hosted.
> **Technology Alliances (Decision #42):** TOTP unlocked for 1Password customers (OAuth, Weaver Free tier); FIDO2 unlocked for Yubico customers (OAuth).
>
> **Observer nodes (Fabrick, v2.3.0):** Included free with any Fabrick subscription — up to 5× the account's Managed node count. No separate SKU; no way to purchase beyond the ratio. Convert Observer hosts to Managed to expand headroom. FM customers: same 5× ratio, no additional charge — included in FM agreement terms. If Managed count is reduced, excess Observed hosts enter `inactive` state. See Decisions #101, #102.
>
> **AI Pro Extension (v2.0, add-on):** $99/yr (now included in base, Decision #142). Solo and Team tiers. Model library, deployment workflow, snapshot provisioning, GPU templates, inference metrics. **Not included in base FM lock** — AI capabilities are new product scope (Decisions #113–#119, designed after FM program). **Champion Credit:** FM customers who have championed Weaver (enterprise referral, published testimonial, community contribution, or org has Fabrick subscription) receive AI Pro **free** via Stripe coupon `CHAMPION-AI-PRO` (permanent, non-revocable). Non-champion FM customers and all standard customers pay $99/yr. Market equivalent: Run:ai $6,000/yr, Anyscale $7,200/yr — AI Pro is 98% below market. Decision #120.
>
> **AI Fleet Extension (v2.2/v3.0, add-on):** $499/yr/node (now included in base, Decision #142). Fabrick only. Additive to Fabrick base subscription. GPU reservation/queue/preemption, MIG partitioning, snapshot-based auto-scaling, fleet inference metrics, fleet inference routing, fleet model deployment, fleet snapshot distribution, fleet GPU scheduling. **Not included in base FM lock** — same rationale as AI Pro. Market equivalent: Run:ai $5,000/yr/node — AI Fleet is 90% below market. Decision #120.
>
> **Fabrick Cloud (v4.0, add-on):** $150/yr/node FM (locked forever, window opens at v3.0 GA, closes at v4.0 GA) · $200–250/yr/node standard (rate finalized at v4.0 GA). Fabrick only. Additive to Fabrick base subscription. 20-customer pre-sell gate determines Path A vs Path B at v3.0 GA. See [FABRICK-CLOUD.md](FABRICK-CLOUD.md).

### Competitive Benchmarks

Adjacent product pricing and market observations: [pricing-benchmarks.md](../../research/pricing-benchmarks.md)

Key takeaways: Per-socket dying (per-node is modern standard), free tiers must be generous, $3–18/mo per unit is the sweet spot, perpetual fallback beloved (JetBrains model), subscription-only backlash is real (Broadcom).

### Pricing Options for Discussion

#### Option A: Subscription-Only (SaaS Standard)

| Tier | Price | Unit | Billing |
|------|:-----:|------|---------|
| Weaver Free | $0 | 1 node, unlimited VMs | — |
| Weaver | $9/mo or $90/yr | Per node | Monthly or annual |
| Fabrick | $25/mo or $250/yr | Per node (first), $15/mo each additional | Annual |
| Plugins | $3–5/mo each | Per plugin, per node | Monthly or annual |

**Pros:** Predictable recurring revenue, SaaS investors love it, easy to model.
**Cons:** Self-hosters hate subscriptions. "Another subscription" fatigue. Post-Broadcom, subscription-only is a negative signal in the VM management space.

#### Option B: Perpetual + Optional Support/Updates (JetBrains Model)

| Tier | Price | Unit | Renewal |
|------|:-----:|------|---------|
| Weaver Free | $0 | 1 node, unlimited VMs | — |
| Weaver | $149 one-time | Per node | +$79/yr for updates + standard support (optional) |
| Fabrick | $399/yr | Per node (first), $199/yr additional | Annual subscription |
| Plugins | $29–49 one-time each | Per plugin, per node | Included in update renewal |

**Pros:** Self-hosters buy once and love you forever. Clear differentiation from Broadcom's subscription-only model. Perpetual fallback after 12 months of renewal = JetBrains goodwill.
**Cons:** Less predictable revenue. Investors prefer recurring. Renewal rates for optional updates are typically 40–60%.

#### Option C: Hybrid — Free Forever + Subscription for Teams

**Two-track positioning (Decision #33 (superseded by #63), revised Decision #63):**
- **Weaver** anchored against VMware/Proxmox: "We're cheaper — and better"
- **Fabrick** anchored against Rancher/OpenShift/Nutanix/Spectro Cloud/HashiCorp: "We compete on features, not price"

| Tier | RAM Coverage | Price | Unit | Model |
|------|:-----------:|:-----:|------|-------|
| Weaver Free | 32GB | $0 | 1 node | Forever |
| Weaver Solo | 128GB | **$149/yr** | Per node | Annual only (quarterly: $45/quarter) |
| Weaver Team | 128GB/host | **$129/user/yr** (2–4 users, +1 viewer free) | Per user | Annual only |
| **Fabrick (256GB/node)** | 256GB/node | **$2,000/yr first node · $750/yr additional ($500/yr at 10+)** | Per node, unlimited users | Annual (Decision #63) |
| **Fabrick (512GB/node)** | 512GB/node | **$2,500/yr** | Per node, unlimited users | Annual (Decision #64) |
| **Contract (512GB+)** | Per 512GB block | **$2,000 · $1,750 · $1,500 · $1,250** (sliding) | Per block above 512GB | Annual contract (Decision #65) |
| Extensions (à la carte) | — | $3–5/mo or $29–49/yr each | Per extension | Monthly or annual |
| TOTP auth extension | — | **$3/mo** | Per user | Free for 1Password TA customers (OAuth) |
| FIDO2 auth extension | — | Weaver-gated | Per user | Free for Yubico TA customers (OAuth) |

**Why this works:**
- **Weaver Free** is genuinely generous (1 node, 32GB RAM, unlimited containers) — wins the homelab community; 81% of self-hosters work in tech professionally (selfh.st 2025 survey) making every free user a potential enterprise champion
- **Weaver Solo** at $249/yr standard (post-v1.2) is still 35% below Proxmox Community (€355/yr/socket) while including more features. FM price ($149/yr) is below even Proxmox Basic (€115/yr) — rewarding founding members without anchoring the standard price at commodity levels
- **Perpetual fallback** after 12 months = JetBrains goodwill, "you'll never lose what you paid for"
- **TOTP included in Weaver** = MFA enforcement becomes a Weaver Free → Weaver upgrade trigger. No standalone SKU — commodity features at any price add friction, not revenue.
- **Team pricing per-user** aligns with Tailscale/modern SaaS expectations
- **Fabrick at $2,000/yr/node** competes on features vs platforms charging $10K–200K/yr (Nutanix, Rancher, OpenShift). Canonical MAAS validates per-node pricing at $500–2,500. v1.x founding members grandfathered at $799 named founding-member rate
- **Fabrick at $2,500/yr/node** (512GB) covers high-RAM self-hosted servers and cloud memory-optimized instances; natural upsell for growing deployments
- **Contract tier above 512GB** handles AI/HPC nodes (1TB+) and large cloud instances at sliding scale block pricing — Weaver licensing remains a rounding error vs cloud compute costs at this scale
- **Extensions à la carte** at tier minimums = incremental revenue without tier pressure
- **Growth math:** 100 enterprise customers × 15 nodes avg = $948,100/yr software + $500K–1.5M/yr success programs. Funds SaaS platform + portfolio

### Fabrick Success Programs

**Tier gate: Fabrick only.** At Weaver Solo ($249/yr) and Weaver Team ($447/yr avg), the success program investment exceeds the annual subscription by 33–60×. These programs are not offered to Weaver Solo/Team customers. Weaver Solo/Team customers who need guided onboarding use Weaver Onboarding (see Professional Services below).

Software licenses are **one revenue stream**. The second is **adoption partnership** — not break-fix support (we design that out), but NixOS adoption guidance, fleet architecture, integration, and compliance mapping.

**Why this isn't "support":** The product is declarative, reproducible, and self-healing. Enterprises don't call us because something broke — they engage us because NixOS is a paradigm shift and they want to get it right. Competitors charge $30K–200K/yr for break-fix. We charge for success.

**Delivery model:** Structured programs blend LMS-delivered curriculum (self-paced NixOS + Weaver courses, architecture pattern modules, compliance mapping walkthroughs) with live engineer sessions. The LMS carries the foundational content; live sessions apply it to the customer's specific environment. This makes programs economically viable to deliver at scale without proportionally increasing engineer hours. LMS content is a WBD internal asset — customer-facing framing is "onboarding playbook" and "guided adoption," not "take this course."

| Program | Annual Price | Tier | Response SLA | Delivery model | What You Get |
|---------|:-----------:|:----:|:-----------:|----------------|-------------|
| **Community** (included) | $0 | All | Best effort | Self-serve | GitHub issues, docs, community forum |
| **Adopt** | $15,000/yr | Fabrick | 24h (business days) | LMS curriculum + 3 live sessions | NixOS + Weaver onboarding course (LMS), deployment playbook, 3 guided setup sessions, release briefings, email/chat async support |
| **Adopt — Compliance variant** | $25,000/yr | Fabrick (regulated) | 24h (business days) | LMS curriculum + 4 live sessions + compliance mapping | Everything in Adopt + HIPAA/CMMC/SOC 2 config mapping session, control evidence walkthrough, compliance architecture review |
| **Accelerate** | $45,000/yr | Fabrick | 4h (24/7) | LMS modules + quarterly live sessions | All Adopt content, dedicated Slack, quarterly fleet architecture reviews (live), LMS modules for SSO/LDAP/CI/CD/monitoring integrations, compliance mapping, priority issue queue |
| **Partner** | $90,000/yr | Fabrick | 1h (24/7) | Named engineer + LMS + live sessions on demand | Named engineer, roadmap influence, priority feature requests, annual on-site architecture review, early access, all LMS content, sessions on demand |
| **Fabrick Partner** | Fabrick cluster pricing + $90,000/yr | Fabrick | 1h (24/7) | Named engineer (domain-specialist) | Fabrick licensing (10+ node pricing) + Partner program — one contract, one named engineer, one renewal date. Institutional cluster buyers: HPC centers, national labs, research orgs. Min 20 nodes. Engineer owns SLURM + Weaver integration end-to-end. See [research-hpc.md](sales/research-hpc.md). |

### Professional Services (One-Time)

| Service | Tier | Price Range | Delivery | Scope |
|---------|:----:|:----------:|----------|-------|
| **Weaver Onboarding** | Weaver Team | $750–$1,500 | LMS access (self-paced) + 1 deployment call (60 min) | NixOS + Weaver setup for small teams. LMS covers NixOS fundamentals, Weaver configuration, peer discovery setup. Live call covers environment-specific questions. Bridge for Weaver Team customers who are not yet Fabrick. |
| Migration assistance | Fabrick | $5,000–20,000 | Live sessions + async | Proxmox/VMware/libvirt → NixOS + Weaver |
| Fleet architecture design | Fabrick | $2,000–5,000/day | Live | Hypervisor selection, networking, HA planning, security posture |
| NixOS adoption training | Fabrick | $3,000–5,000/cohort | Live, 2-day intensive | For ops teams — the product works, they need to understand the paradigm. Supplemented by LMS pre-work to reduce live session time. |
| Custom plugin development | Fabrick | $5,000–15,000 | Engineering | Bespoke plugin for specific Fabrick customer needs |

### Revenue Modeling (Option C)

**Per-customer revenue by segment:**

| Customer Type | Software | Success Program | Services (Y1) | **Annual Recurring** | Mix (Y1) | Mix (Y2) |
|---------------|:-------:|:--------------:|:-------------:|:-------------------:|:--------:|:--------:|
| Weaver Free | $0 | — | — | **$0** | 80% | 60% |
| Weaver Solo — FM (1 node) | $149/yr | — | — | **$149** | 8% | 5% |
| Weaver Solo — Standard (1 node, post-v1.2) | $249/yr | — | — | **$249** | 3% | 13% |
| Weaver Team — FM (3 users avg) | $297/yr | — | — | **$297** | 1% | 5% |
| Weaver Team — Standard (3 users avg, post-v2.2) | $447/yr | — | — | **$447** | 1% | 5% |
| Fabrick Small (10 nodes) | $8,000/yr | $15,000/yr (Adopt) | $5,000 | **$28,000** | 1% | 3% |
| Fabrick Mid (30 nodes) | $18,000/yr | $45,000/yr (Accelerate) | $10,000 | **$73,000** | 0.5% | 2% |
| Fabrick Large (100 nodes) | $53,000/yr | $90,000/yr (Partner) | $20,000 | **$163,000** | 0.5% | 2% |
| **Fabrick Partner** (40-node HPC cluster) | $21,000/yr | $90,000/yr (Partner, bundled) | $5,000 | **$116,000** | — | — |
| **Fabrick Partner** (100-node + 8 GPU cluster) | $67,500/yr | $90,000/yr (Partner, bundled) | $5,000 | **$162,500** | — | — |
| Plugins (avg 1.5 per paid user) | $67/yr avg | — | — | included above | — | — |

**Blended enterprise ARPU:** Assuming 60% small / 30% mid / 10% large enterprise mix:
- Recurring ARPU: (0.6 × $23,000) + (0.3 × $63,000) + (0.1 × $143,000) = **$47,000/yr**
- With Y1 services: **$55,000/yr** first year

**Y2 revenue at scale (1,000 users, Option C mix):**

| Segment | Customers | Recurring Revenue |
|---------|:---------:|:-----------------:|
| TOTP | 100 | $3,600 |
| Weaver Solo | 150 | $22,350 |
| Weaver Team | 80 | $23,760 |
| Fabrick (blended) | 70 | **$3,290,000** |
| **Total recurring** | — | **$3,338,710/yr** |

vs original model (3-node avg, software-only, $799 base): 70 enterprise × $1,597 = $111,790. Success programs + realistic fleet sizes + V4 success program repricing: **30×**. Blended ARPU at revised success program pricing: 70 × $47,000 = **$3,290,000 ARR**.

### Competitive Positioning

Full positioning tables (Weaver vs Proxmox/Netdata/Tailscale, Fabrick vs Nutanix/Rancher/OpenShift/HashiCorp/Spectro Cloud/Canonical): [pricing-benchmarks.md](../../research/pricing-benchmarks.md)

Full feature comparison matrix (18 capabilities × 7 platforms): [fabrick-bellwether-matrix.md](../../research/fabrick-bellwether-matrix.md)

---

## Demo Mode

**Demo is a mode, not a tier.** The demo site and `--demo` CLI flag showcase all three tiers:

- Toolbar toggle switches between Weaver Free / Weaver / Fabrick views
- Same `requireTier()` and `useTierFeature()` gating as production
- Mock data (8 VMs, simulated WebSocket updates)
- Runtime tier switching via `demoTierOverride` in app store

**Two-demo strategy (Decision #31, planned post-v1.0):**
- **Public demo** — curated Weaver Free features + Weaver/Fabrick teasers
- **Private demo** — full tier-switcher with development stage labels

---

## Implementation Status

| Phase | Scope | Status |
|-------|-------|--------|
| License key infrastructure | Key format, HMAC, env vars, NixOS module | **Done** |
| 3-tier route enforcement | `requireTier()` on all gated routes | **Done** |
| Frontend tier composable | `useTierFeature()`, `UpgradeNag` | **Done** |
| Rate limit gradient | 5/10/30 per tier | **Done** |
| Demo tier-switcher | Toolbar toggle, mock data | **Done** |
| TUI tier gating | Same middleware, demo mode | **Done** |
| Integrated Extensions system (`requirePlugin()`) | Planned v1.1.0 | **Planned** |
| Purchase flow (Stripe/LemonSqueezy) | Post-v1.0 | **Planned** |
| Customer portal | Post-v1.0 | **Planned** |

---

## Open Questions

| Question | Options | Status |
|----------|---------|--------|
| Pricing model | Option C (hybrid), RAM-based license unit, $2,000 Fabrick base | **Decided** (Decisions #50–53, 2026-03-18) |
| Extension pricing | À la carte vs bundled vs included in tier | **Leaning à la carte** at tier minimums |
| TOTP pricing | Bundled into Weaver (no standalone SKU) | **Revised** — standalone TOTP is a commodity add friction. TOTP MFA is a Weaver Free → Weaver conversion trigger. 1Password TA = TOTP unlocked on Weaver Free via OAuth. |
| Perpetual fallback? | After 12 months of renewal | **Proposed** in Option C |
| Grace period after expiry | 30 days read-only, then downgrade | **Decided** |
| Payment processor | Stripe vs LemonSqueezy | **Leaning Stripe** — better API, webhook support |

---

---

*Cross-reference: [MASTER-PLAN.md](../../MASTER-PLAN.md) | [competitive-landscape.md](../../research/competitive-landscape.md) | [BUDGET-AND-ENTITY-PLAN.md](BUDGET-AND-ENTITY-PLAN.md)*
