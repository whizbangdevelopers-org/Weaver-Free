<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Pricing Benchmarks & Competitive Positioning

> **ARCHIVED** — This document predates Decision #62 (tier rename) and Decisions #105–#108 (pricing ladder). Tier names ("Weaver Premium", "Weaver Enterprise") and prices ($99/node, $799/node) are obsolete. For current pricing see [business/product/TIER-MANAGEMENT.md](../business/product/TIER-MANAGEMENT.md) and [business/marketing/FABRICK-VALUE-PROPOSITION.md](../business/marketing/FABRICK-VALUE-PROPOSITION.md). Competitive benchmarks (Proxmox, Portainer, etc.) remain valid reference data.

**Last updated:** 2026-03-04
**Feeds:** [TIER-MANAGEMENT.md](../business/product/TIER-MANAGEMENT.md), [FABRICK-VALUE-PROPOSITION.md](../business/marketing/FABRICK-VALUE-PROPOSITION.md)
**Update cadence:** Weekly

---

## Adjacent Product Pricing (March 2026)

| Product | Model | Free Tier | Entry Paid | Mid Tier | Enterprise |
|---------|-------|-----------|------------|----------|------------|
| [Proxmox](https://www.proxmox.com/en/products/proxmox-virtual-environment/pricing) | Per-socket/yr | All features free | €115/yr/socket (Community) | €355/yr/socket (Basic) | €1,060/yr/socket (Premium) |
| [Portainer](https://www.portainer.io/pricing) | Per-node | 3 nodes free | Custom (contact sales) | Custom | Custom |
| [Netdata](https://www.netdata.cloud/pricing/) | Per-node/mo | 5 nodes free | $3/node/mo (Pro) | $4.50/node/mo (Business) | Custom |
| [Grafana Cloud](https://grafana.com/pricing/) | Usage-based | 10k metrics, 3 users | $19/mo + usage (Pro) | Volume discounts | Custom |
| [n8n](https://n8n.io/pricing/) | Per-execution | Self-host free | €20/mo (2.5K exec) | €50/mo (10K exec) | Custom |
| [Tailscale](https://tailscale.com/pricing) | Per-user/mo | 3 users, 100 devices | $6/user/mo (Starter) | $18/user/mo (Premium) | Custom |
| [JetBrains](https://sales.jetbrains.com/hc/en-gb/articles/207240845) | Subscription + perpetual fallback | — | $289/yr All Products | — | Custom |

---

## Key Market Observations

1. **Per-socket is dying** — Proxmox is the last major holdout. Broadcom killed it for VMware. Per-node or per-user is the modern standard.
2. **Free tiers are generous** — Portainer (3 nodes), Netdata (5 nodes), Tailscale (3 users). Stingy free tiers backfire in the homelab community.
3. **$3–18/mo per unit is the sweet spot** — whether that unit is a node, user, or seat. Sub-$5 is "no-brainer" adoption territory.
4. **Perpetual + fallback is beloved** — JetBrains model (subscribe → earn perpetual after 12 months) has the highest customer satisfaction in dev tools. Self-hosters especially value ownership.
5. **Subscription-only backlash is real** — VMware/Broadcom's forced subscription migration is literally driving customers to competitors. Don't repeat this.

---

## Premium Tier Competitive Positioning

| Vendor | Unit | 1-Node Cost | 3-Node Cost | Weaver Advantage |
|--------|------|:-----------:|:-----------:|---|
| Proxmox Community | Per-socket/yr | €115 | €345 | Per-host (not per-socket), unlimited VMs, AI agent, NixOS-native |
| Proxmox Basic | Per-socket/yr | €355 | €1,065 | 70% cheaper, more features at Premium tier |
| Netdata Business | Per-node/mo | $54/yr | $162/yr | Different product (monitoring vs management), but comparable price point |
| Tailscale Starter | Per-user/mo | $72/yr | $72/yr (1 user) | Different product (networking), but validates per-user pricing |
| Weaver Premium | Per-node/yr | **$99** | **$297** | Only NixOS-native VM dashboard with AI, containers (v1.2+), declarative config |

---

## Enterprise Tier Competitive Positioning

| Platform | Annual Cost | Weaver Enterprise Advantage |
|----------|:----------:|---|
| Nutanix (AHV + AOS + Prism) | $10,000–50,000+/yr | 5 hypervisors vs 2, NixOS-native declarative, Live Provisioning, 95%+ cheaper |
| Rancher / SUSE | $60,000–200,000/yr | Unified VM+container management, no K8s dependency, AI diagnostics |
| Red Hat OpenShift | $50,000–150,000/yr | NixOS declarative compliance by construction, sub-second VM boot, 99%+ cheaper |
| HashiCorp (Terraform + Nomad + Vault) | $70,000+/yr | Single dashboard vs fragmented tools, Live Provisioning, Git-native audit |
| Spectro Cloud Palette | $30,000+/yr | Multi-hypervisor breadth, intent-based migration, 88%+ cheaper |
| Canonical (MAAS + Ubuntu Pro) | $500–2,500/yr/node | VM lifecycle management (not just bare metal), AI diagnostics, multi-hypervisor |
| **Weaver Enterprise** | **$799/yr/node** | Live Provisioning, 5 hypervisors, <125ms boot, declarative compliance, all extensions |

---

## Sources

- [Proxmox Pricing](https://www.proxmox.com/en/products/proxmox-virtual-environment/pricing) — €115–1,060/yr/socket
- [Portainer Pricing](https://www.portainer.io/pricing) — 3 nodes free, custom beyond
- [Netdata Pricing](https://www.netdata.cloud/pricing/) — Free 5 nodes, $3–4.50/node/mo
- [Grafana Cloud Pricing](https://grafana.com/pricing/) — Free tier, $19/mo + usage
- [n8n Pricing](https://n8n.io/pricing/) — Self-host free, €20–50/mo cloud
- [Tailscale Pricing](https://tailscale.com/pricing) — Free 3 users, $6–18/user/mo
- [JetBrains Perpetual Fallback](https://sales.jetbrains.com/hc/en-gb/articles/207240845) — Subscribe → own after 12 months
