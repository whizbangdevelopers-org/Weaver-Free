<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver — Free Tier Feature Set at v1.3.0

**Last updated:** 2026-03-23

Cumulative Weaver Free tier capabilities at the v1.3.0 release (Remote Access + Mobile). Each feature notes the version in which it arrives. For the full release cadence see [RELEASE-ROADMAP.md](../product/RELEASE-ROADMAP.md). For tier boundaries and pricing see [TIER-MANAGEMENT.md](TIER-MANAGEMENT.md).

---

## What Free Includes

### Workload Management

| Feature | Ships |
|---------|-------|
| Register and manage existing MicroVMs | v1.0 |
| Weaver: workload cards (grid + list view, drag-and-drop sort) | v1.0 |
| Workload status badges + WebSocket live updates (2-second broadcast) | v1.0 |
| Multi-hypervisor selection: QEMU, Cloud Hypervisor, crosvm, kvmtool, Firecracker | v1.0 |
| Windows guest support (guestOs field, ISO-install path) | v1.0 |
| Curated distro catalog (NixOS, CirrOS, Rocky, Alma, openSUSE) + custom distros | v1.0 |
| Workload tags — organize VMs and containers | v1.0 |
| Docker container visibility: cards, detail page, logs | v1.1 |
| Podman container visibility: cards, detail page, logs | v1.1 |
| Container runtime auto-detection (probes installed runtimes) | v1.1 |
| Unified workload tags across VMs and containers | v1.1 |
| Sector selection at first-run (personalized experience) | v1.2 |

> **Live Provisioning** (creating new workloads dynamically via API, without `nixos-rebuild switch`) is **Weaver**. Weaver Free tier manages workloads that already exist on the host.

---

### Monitoring & Observability

| Feature | Ships |
|---------|-------|
| Real-time workload status via WebSocket | v1.0 |
| Serial console viewer (xterm.js, Console tab on workload detail) | v1.0 |
| Provisioning logs (async progress stream) | v1.0 |
| VM resource monitoring graphs — CPU, RAM, disk sparklines, 1-hour ring buffer | v1.1 |
| Service health probes | v1.1 |
| Container logs and inspect view | v1.1 |

> **24h+ monitoring retention** with configurable retention is **Weaver**.

---

### AI Diagnostics (BYOK)

| Feature | Ships |
|---------|-------|
| AI agent — per-VM diagnostics with real-time markdown streaming | v1.0 |
| BYOK (Bring Your Own Key) — Anthropic Claude provider | v1.0 |
| BYOV (Bring Your Own Vendor) — pluggable LLM provider architecture | v1.0 |
| Mock agent fallback (works without an API key) | v1.0 |
| AI Settings: vendor selection, API key input, server key toggle, mode indicator | v1.0 |
| AI Analysis tab on workload detail page | v1.0 |

> **OpenAI, Ollama, ZenCoder, and profile switching** are **Weaver**. Cross-resource AI diagnostics (VMs + containers together) arrive in v1.4 at the tier determined there.

---

### Remote Access

| Feature | Ships |
|---------|-------|
| Tailscale setup wizard — generates NixOS config, user runs one rebuild, remote access forever | v1.3 |
| Tunnel status detection (Tailscale / WireGuard / none) via backend probe | v1.3 |
| Settings: tunnel status display + wizard re-run button | v1.3 |

> **WireGuard wizard** (self-hosted, air-gap friendly, preferred for defense/healthcare/government) is **Weaver**. **Network Isolation Mode** (toggle disables tunnel without affecting VMs, NixOS rollback) is **Weaver**.

---

### Mobile App (Android v1.3.0 · iOS v1.3.x)

| Feature | Ships |
|---------|-------|
| Native Android app via Quasar Capacitor (same codebase as web) | v1.3 |
| Native iOS app | v1.3.x |
| Mobile-optimized layouts: dashboard, workload list, workload detail | v1.3 |
| Biometric auth — fingerprint / Face ID | v1.3 |
| Mobile touch targets and navigation patterns | v1.3 |
| Google Play Store listing | v1.3 |
| App Store listing | v1.3.x |

> **Push notifications** (VM state changes, resource alerts) and **deep links** (start/stop from notification) are **Weaver** — the natural in-app upgrade prompt.

---

### Security & Authentication

| Feature | Ships |
|---------|-------|
| Session auth (cookie-based, bcrypt passwords, SQLite) | v1.0 |
| Three-role RBAC: admin / operator / viewer | v1.0 |
| AI infrastructure protection — 5 requests/min per user (protects API spend, GPU compute, or host resources) | v1.0 |
| Rate limit response headers (`X-RateLimit-Remaining`, `Retry-After`) | v1.0 |
| Auth settings UI (Settings → Auth page) | v1.1 |
| TOTP MFA (`auth-totp`) — $3/mo add-on; waived for 1Password Technology Alliance users | v1.1 |

> **FIDO2 / hardware keys** (`auth-fido2`) are **Weaver** (free via Yubico Technology Alliance). **SSO/SAML/LDAP** is **Fabrick**. **Per-VM access control** and **resource quotas** are **Fabrick**.

---

### Configuration & Host Integration

| Feature | Ships |
|---------|-------|
| Host Config viewer — Settings > Host Config, Nix syntax-highlighted, categorized sections (MicroVMs, OCI containers, infrastructure) | v1.0 |
| NixOS module — declarative host integration | v1.0 |
| nix-ld support in NixOS module (unpatched binaries run without wrapping) | v1.1 |
| Config export (`GET /api/vms/export`, `GET /api/vms/:name/export`) | v1.1 |

> **sops-nix** (secrets at rest), **impermanence** (ephemeral root), **lanzaboote** (UEFI Secure Boot), and **nixos-generators** (multi-format image export) are **Fabrick** extensions.

---

### Developer Experience

| Feature | Ships |
|---------|-------|
| Help system — searchable content, HelpTooltip global toggle, Getting Started wizard | v1.0 |
| Keyboard shortcuts: `?`, `D`, `S`, `N`, and extended VM-action + list navigation keys | v1.0 + v1.1 |
| Shortcut overlay (`Shift+?`) | v1.1 |
| TUI client — React/Ink terminal UI, ~97% web feature parity | v1.0 |
| Search and filter across workloads | v1.1 |

---

### Platform

| Feature | Ships |
|---------|-------|
| Demo site (GitHub Pages, tier-switcher showing Free / Weaver/Fabrick) | v1.0 |
| GitHub release pipeline (tag-triggered build, GitHub Release, sync-to-free workflow) | v1.0 |
| Stripe license infrastructure (required for add-on purchases like TOTP) | v1.1 |

---

## What Weaver Free Does Not Include (Weaver/Fabrick)

For contrast — features gated above Free at v1.3:

| Feature | Tier | Ships |
|---------|------|-------|
| Live Provisioning — create/manage workloads via API without host rebuild | Weaver | v1.0 |
| VM clone / template | Weaver | v1.1 |
| Docker/Podman management actions (start/stop/create/pull) | Weaver | v1.2 |
| Apptainer (HPC/research runtime) | Weaver | v1.1 |
| GPU passthrough (`--nv` / `--rocm`) | Weaver | v1.2 |
| DNS extension (dnsmasq + CoreDNS) | Weaver | v1.1 |
| Firewall templates (nftables, profile egress, zones) | Weaver | v1.2 |
| VM resource monitoring — 24h+ retention | Weaver | v1.1 |
| FIDO2 / YubiKey (`auth-fido2`) | Weaver | v1.1 |
| nixos-generators — export VM as image (12 formats) | Weaver | v1.1 |
| home-manager integration in VM templates | Weaver | v1.1 |
| WireGuard setup wizard | Weaver | v1.3 |
| Network Isolation Mode | Weaver | v1.3 |
| Push notifications (VM state changes, resource alerts) | Weaver | v1.3 |
| Deep links for VM actions from notifications | Weaver | v1.3 |
| Per-VM access control | Fabrick | v1.0 |
| VM resource quotas | Fabrick | v1.0 |
| Bulk VM operations | Fabrick | v1.0 |
| Container RBAC (permissions separate from VM permissions) | Fabrick | v1.2 |

---

## Strategic Rationale

**Weaver Free tier = adoption engine.** Every feature in the Weaver Free tier serves one goal: make Weaver the obvious choice before money changes hands.

- **Docker/Podman visibility (Free)** — every homelab already runs Docker. No competing dashboard pairs VM + container management at zero cost. This is a durable differentiator against Proxmox and Portainer alike.
- **BYOK AI diagnostics (Free)** — users who connect their own API key own the value. Switching cost is immediate. The mock fallback removes the key requirement entirely for evaluation.
- **Tailscale wizard (Free)** — zero-friction remote access is the onboarding funnel for the mobile app. One rebuild, remote access forever. Good demo moment: install Weaver, activate Tailscale, open mobile app.
- **Mobile app (Free, Decision #50)** — Proxmox has no mobile app. App Store / Play Store presence is organic discovery that costs nothing per install. Biometric auth + pocket control plane dramatically raises perceived product value. Push notifications (Weaver) are the in-app upgrade prompt encountered at maximum engagement.

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the canonical decision log. See [RELEASE-ROADMAP.md](../product/RELEASE-ROADMAP.md) for the full tier revenue ramp by version.*
