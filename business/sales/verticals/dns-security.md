<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# DNS Security Competitive Positioning
## Weaver vs Fabrick DNS Market

**Date:** 2026-03-12
**Decisions:** [#45](../../../MASTER-PLAN.md#decisions-resolved) (DNS plugin tiers + Pi-hole)
**Parent doc:** [IT-FOCUS-VALUE-PROPOSITION.md](../IT-FOCUS-VALUE-PROPOSITION.md)
**Feeds into:** healthcare.md, defense-contractor.md, financial-services.md, government.md

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [Regulatory Mapping](#2-regulatory-mapping)
3. [Weaver DNS Story](#3-weaver)
4. [Fabrick DNS Story](#4-fabrick)
5. [Deficiency Remediation](#5-deficiency-remediation)
6. [Competitive Advantages](#6-competitive-advantages)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Discovery Questions](#9-discovery-questions)

---

## 1. The Problem {#1-the-problem}

**No NixOS expertise required — ever.** Weaver's DNS stack deploys alongside existing DNS infrastructure. Add vm.internal resolution incrementally — no cutover, no migration event. The dns-core plugin activates per VM; existing DNS infrastructure is untouched until you are ready to extend it.

DNS is the invisible layer that either holds an infrastructure together or silently breaks it. Most organizations are in one of two failure modes:

**Underserved (homelab / SMB):** No DNS story at all. VMs are IPs. `/etc/hosts` files. Manual updates when anything changes. Configuration drift is invisible until something breaks.

**Overserved (enterprise):** Paying Cisco, Zscaler, or Infoblox prices for capabilities that are 80% unused. Locked into platforms that require dedicated DNS specialists to operate.

The gap between "nothing" and "$12,000/yr minimum" is where Weaver lives.

### What Enterprises Use Today

#### Tier 1 — Large Fabrick SASE / Zero Trust

DNS filtering is bundled inside a broader Secure Access Service Edge platform. DNS is one layer — the real product is traffic inspection, DLP, and zero-trust network access.

| Product | What it is | Price |
|---------|-----------|-------|
| **Cisco Umbrella** | DNS security + Secure Web Gateway + cloud firewall. Cisco Talos threat intelligence. Market reference point. | ~$2.25–$8/user/mo |
| **Zscaler ZIA** | Full traffic proxy. SSL inspection, DLP, CASB, sandboxing. DNS is a component, not the product. | FabricK quote only |
| **Cloudflare Gateway** | DNS + SWG + ZTNA on Cloudflare's anycast network. Most cost-competitive. | Free ≤50 users, ~$7/user/mo |
| **Palo Alto DNS Security** | Add-on to Palo Alto NGFW. ML-based DGA and tunneling detection. | Quote (PA shops only) |

**Who buys these:** Fortune 500, organizations on Cisco/PA/Zscaler stacks already. The sales motion is expand-within-existing-contract, not net-new purchase.

#### Tier 2 — Mid-Market / MSP: Standalone DNS Security

| Product | What it is | Price |
|---------|-----------|-------|
| **DNSFilter** | Pure-play DNS security. AI domain classification, real-time threat feeds. MSP multi-tenant. | ~$1.15–$3/user/mo |
| **TitanHQ WebTitan** | DNS filtering for MSPs, schools, SMBs. Cloud or virtual appliance. AD integration. | ~$1–$3/user/mo |
| **NextDNS** | "Pi-hole as a service." No SLA, no compliance tooling. Not enterprise-grade. | $1.99/mo flat |

**Who buys these:** MSPs managing multiple clients, mid-market IT teams, education, healthcare — anyone who needs DNS security but can't justify Cisco Umbrella pricing.

#### Tier 3 — Air-Gapped / Infrastructure Ownership: Fabrick DDI

Full DNS/DHCP/IPAM ownership. Heavily regulated industries, government, finance — anywhere SaaS DNS is unacceptable.

| Product | What it is | Price |
|---------|-----------|-------|
| **Infoblox** | Market leader in fabrick DDI. DNS firewalling, DDoS mitigation, threat intel. | $12,000+ entry point |
| **BlueCat** | Direct Infoblox competitor. Better APIs, more flexible licensing. | ~$14,000+ |
| **EfficientIP SOLIDserver** | DDI with strong security. Positions as cost-effective Infoblox alternative. | Quote, below Infoblox |

**Who buys these:** Large enterprises, government, finance, healthcare — organizations where DNS infrastructure ownership is non-negotiable and budget is not the primary constraint.

### Our DNS Stack

Weaver's DNS is a layered stack. Each layer serves a distinct purpose and is independently valuable.

```
┌─────────────────────────────────────────────────────┐
│  All LAN clients (phones, laptops, IoT, smart TVs)  │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│  Pi-hole VM  (Weaver template, v2.0.0)             │
│  • LAN-wide ad / tracker / malware domain blocking  │
│  • Per-device query log and analytics               │
│  • Blocklist management (oisd, Steven Black, etc.)  │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│  dns-resolver plugin (Weaver, ~$5/mo)              │
│  • DNSSEC validation                                │
│  • DoH / DoT encrypted upstream                     │
│  • Caching layer                                    │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│  dns-core plugin (Weaver, included)                │
│  • vm.internal auto-zone: web-nginx.vm.internal     │
│  • Per-VM DNS records, DHCP for VM bridge           │
│  • Foundation for all VM fleet DNS                  │
└─────────────────────────────────────────────────────┘

Fabrick adds (dns-enterprise, included):
  • Split-horizon DNS (internal vs external views)
  • Active Directory / LDAP integration
  • Compliance-grade audit log (every query, immutable)
  • Zone delegation
  • Multi-node fleet DNS (v2.2+, Colmena)
```

**The two layers serve different problems:**

> **DNS plugins** = VM service discovery and compliance logging for your VM fleet.
> **Pi-hole template** = network-wide privacy and ad blocking for every device on your LAN.
> Most users want both. They stack cleanly.

---

## 2. Regulatory Mapping {#2-regulatory-mapping}

DNS security is a compliance requirement in most regulated verticals. Each regulation maps to a specific layer of the Weaver DNS stack.

| Vertical | Regulation | DNS Requirement | Our Answer | Tier | Available |
|---------|-----------|----------------|-----------|------|:---------:|
| Healthcare | HIPAA § 164.312(b) | Audit controls on all network activity | dns-enterprise audit log | Fabrick | v1.1.0 |
| Healthcare | HIPAA § 164.312(e)(1) | Transmission security | dns-resolver DoH/DoT | Weaver | v1.1.0 |
| Defense | CMMC AC.3.022 | Control remote access via managed access points | dns-enterprise split-horizon | Fabrick | v1.1.0 |
| Defense | CMMC SC.3.177 | Employ FIPS-validated cryptography | dns-resolver DNSSEC | Weaver | v1.1.0 |
| Financial | PCI-DSS Req 1.3 | Restrict inbound/outbound traffic | Pi-hole + dns-enterprise zones | Weaver+ | v2.0.0 |
| Financial | SOC 2 CC6.1 | Logical and physical access controls | dns-enterprise audit log | Fabrick | v1.1.0 |
| Government | NIST SP 800-53 SC-20 | Secure name/address resolution service | dns-enterprise full stack | Fabrick | v1.1.0 |
| Government | FedRAMP DNS Protection | DNS sinkholing for malicious domains | Pi-hole + dns-enterprise | Fabrick | v2.0.0 |

---

## 3. Weaver DNS Story {#3-premium}

**Buyer:** Sys admin homelab, small team, SMB

**What they get:**

| Capability | Available | Version |
|-----------|:---------:|---------|
| vm.internal auto-zone (dns-core, included) | ✓ Weaver | v1.1.0 |
| DNSSEC + DoH/DoT upstream (dns-resolver plugin) | ✓ Weaver ~$5/mo | v1.1.0 |
| Pi-hole VM — LAN-wide ad/tracker blocking | ✓ Weaver template | v2.0.0 |

**The pitch:** "Every VM gets a hostname automatically. Your entire LAN gets ad blocking. DNSSEC validates every upstream query. All managed from one dashboard — no separate DNS server to configure, no /etc/hosts files, no IP memorization."

**vs. DNSFilter (~$1.15–$3/user/mo):** DNSFilter is cloud-only, no VM fleet integration, no self-hosted option, no Pi-hole-style LAN coverage. Our dns-core + Pi-hole stack is self-hosted, NixOS-native, and doesn't phone home.

---

## 4. Fabrick DNS Story {#4-fabrick}

**Buyer:** Corporate IT, compliance officer, MSP managing regulated clients

**What they get above Weaver:**

| Capability | Available | Version |
|-----------|:---------:|---------|
| Split-horizon DNS | ✓ Fabrick | v1.1.0 |
| Active Directory / LDAP integration | ✓ Fabrick | v1.1.0 |
| Compliance audit log (every DNS query, immutable) | ✓ Fabrick | v1.1.0 |
| Zone delegation | ✓ Fabrick | v1.1.0 |
| Pi-hole HA pair (Gravity Sync — DNS survives VM failure) | ✓ Fabrick | v2.0.0 |
| Pi-hole audit log integration (query data → dashboard audit trail) | ✓ Fabrick | v2.0.0 |
| Pi-hole SSO gating (Authentik / auth-sso) | ✓ Fabrick | v2.0.0 |
| Pi-hole Gravity DB backup (backup-enterprise) | ✓ Fabrick | v2.3.0 |
| Per-segment Pi-hole instances (IoT VLAN vs VM net vs home LAN) | ✓ Fabrick | v2.0.0 |
| Multi-node fleet DNS (Colmena) | ✓ Fabrick | v2.2.0 |

**The pitch:** "Fabrick DNS governance — split-horizon, AD integration, immutable audit logs — for a fraction of what Infoblox charges. Self-hosted, air-gap capable, NixOS-declarative. The same DNS architecture that Fortune 500 companies run, without the $12,000 entry point."

**vs. Infoblox ($12,000+ entry):** Infoblox requires DDI specialists to operate. Our dns-enterprise is declarative NixOS config — the same `nixos-rebuild switch` pattern your team already knows. No vendor lock-in. No proprietary appliance.

**vs. Cisco Umbrella ($2–8/user/mo):** Umbrella is cloud-only DNS. For air-gapped environments (defense, healthcare on-prem, CMMC Level 2+), cloud DNS is not acceptable. Our dns-enterprise runs entirely on-premises with no external DNS dependency.

### Weaver Success Programs for DNS

| Program | DNS Application | FM Price | Standard Price | Response SLA |
|---------|----------------|:--------:|:--------------:|:------------:|
| Community | Forum + GitHub Issues | $0 | $0 | Best effort |
| **Adopt** | NixOS DNS stack onboarding; Pi-hole HA and Gravity Sync setup; split-horizon zone design; DNSSEC + DoH/DoT configuration | $5,000/yr | $15,000/yr | 24h business days |
| **Adopt — Compliance** | Hands-on DNS compliance evidence delivery; audit log review sessions; CMMC / HIPAA / PCI-DSS DNS control mapping and evidence walkthroughs | — | $25,000/yr | 24h business days |
| **Accelerate** | Quarterly DNS audit reviews; AD/LDAP integration validation; compliance evidence package support; multi-segment Pi-hole architecture reviews | $15,000/yr | $45,000/yr | 4h (24/7) |
| **Partner** | Named engineer with fabrick DNS expertise; priority features for DNS-specific needs; multi-node fleet DNS architecture planning; compliance program support | $30,000/yr | $90,000/yr | 1h (24/7) |

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = **$9,000/yr** total compliance coverage during FM period. Standard Adopt — Compliance ($25,000/yr) includes hands-on DNS control mapping sessions that the extension alone does not provide.

---

## 5. Deficiency Remediation {#5-deficiency-remediation}

Organizations arriving from each incumbent have specific gaps that Weaver closes.

### Coming from No DNS Management (Manual / /etc/hosts)

| Current Deficiency | Remediation | Timeline |
|--------------------|-------------|----------|
| VMs reachable by IP only | dns-core auto-zone: every VM gets `name.vm.internal` immediately on provision | Day 1 — Weaver v1.1.0 |
| No upstream encryption | dns-resolver plugin: DNSSEC + DoH/DoT | Day 1 — Weaver v1.1.0 |
| No network-wide filtering | Pi-hole VM template: LAN-wide ad/tracker blocking | v2.0.0 Weaver template |
| No audit evidence | dns-enterprise: immutable query log | Fabrick v1.1.0 |

### Coming from Pi-hole Only (DIY)

| Current Deficiency | Remediation | Timeline |
|--------------------|-------------|----------|
| No VM fleet integration | dns-core: auto-zone for every VM provisioned via dashboard | Weaver v1.1.0 |
| No HA — single point of failure | Fabrick: Pi-hole HA pair with Gravity Sync | Fabrick v2.0.0 |
| No compliance audit trail | dns-enterprise audit log + Pi-hole query integration | Fabrick v2.0.0 |
| Manual config management | NixOS-declarative Pi-hole config, reproducible state | Weaver v2.0.0 |

### Coming from Infoblox / BlueCat (DDI Overkill)

| Current Deficiency | Remediation | Timeline |
|--------------------|-------------|----------|
| $12,000–14,000+ annual cost | Fabrick subscription — DNS included | Immediate |
| Proprietary appliance lock-in | Standard NixOS modules, no vendor hardware | Immediate |
| Specialist-dependent operations | Declarative config — same pattern as rest of NixOS fleet | Immediate |
| No VM-native integration | dns-core/enterprise built into the provisioning layer | v1.1.0 |

---

## 6. Competitive Advantages {#6-competitive-advantages}

| Capability | Pi-hole (DIY) | NextDNS | DNSFilter | Cisco Umbrella | Infoblox | **Weaver** |
|-----------|:------------:|:-------:|:---------:|:--------------:|:--------:|:---------------------:|
| Self-hosted | ✓ | — | — | — | ✓ | ✓ |
| VM fleet DNS (auto-zone) | — | — | — | — | ✓ | ✓ |
| LAN-wide ad blocking | ✓ | ✓ | ✓ | ✓ | — | ✓ (Pi-hole template) |
| DNSSEC / DoH / DoT | partial | ✓ | ✓ | ✓ | ✓ | ✓ |
| Split-horizon DNS | — | — | — | ✓ | ✓ | ✓ Fabrick |
| AD / LDAP integration | — | — | ✓ | ✓ | ✓ | ✓ Fabrick |
| Compliance audit log | — | — | ✓ | ✓ | ✓ | ✓ Fabrick |
| Air-gap capable | ✓ | — | — | — | ✓ | ✓ |
| Weaver-integrated | — | — | — | — | — | ✓ |
| NixOS-declarative | — | — | — | — | — | ✓ |
| HA / failover | manual | — | ✓ | ✓ | ✓ | ✓ Fabrick |
| **Entry price** | free | $1.99/mo | ~$1.15/user/mo | ~$2.25/user/mo | **$12,000+** | **Included in tier** |

**Our defensible position:** The only self-hosted, VM-fleet-integrated, NixOS-declarative DNS stack with compliance audit logging and air-gap capability — at a fraction of DDI vendor pricing.

---

## 7. Objection Handling {#7-objection-handling}

**"We already have Pi-hole — why do we need the dashboard's DNS plugins?"**

Pi-hole handles LAN-wide filtering for all devices. dns-core handles VM service discovery — every VM gets a hostname automatically on provision, and VM-to-VM traffic uses names not IPs. They solve different problems and stack cleanly. Pi-hole forwards allowed queries to dns-resolver, which routes `.vm.internal` to dns-core. Without dns-core, Live Provisioning creates VMs reachable only by IP.

**"We use Cisco Umbrella — why switch?"**

You don't switch Umbrella for the dashboard's DNS stack — they're complementary. Umbrella handles internet-bound traffic filtering. dns-core/enterprise handles your VM fleet's internal name resolution and compliance logging. If you're in an air-gapped environment or need on-prem query logging for HIPAA/CMMC, Umbrella can't help — that's where dns-enterprise fills the gap.

**"Why not just use Infoblox?"**

Infoblox is purpose-built DDI — if you have a DDI specialist and $12,000/yr budget, it's a serious product. But: (1) it requires proprietary appliances with vendor lock-in, (2) config changes require DDI expertise, not declarative NixOS patterns your team already uses, (3) it has no integration with your VM provisioning workflow. For most regulated organizations, dns-enterprise delivers 80% of Infoblox's compliance capabilities at a fraction of the cost and operational burden.

**"DNS audit logs — we already have firewall logs."**

Firewall logs show traffic at the network layer. dns-enterprise audit logs show *which VM* resolved *which hostname* at *what time* — before the connection was made. For HIPAA § 164.312(b) and SOC 2 CC6.1, DNS-level query logging is a distinct control from network-layer logging. They complement each other; neither replaces the other.

**"We're a homelab — we don't need enterprise DNS."**

Weaver's dns-core is included in the subscription. The moment you provision a VM via the dashboard, it gets a hostname. No additional config. The dns-resolver plugin (~$5/mo) adds DNSSEC + DoH/DoT upstream. Pi-hole as a VM template ships v2.0.0 — full LAN ad blocking managed from the dashboard. Fabrick DNS features are opt-in for when your homelab graduates to business use.

**"If I'm using this for compliance-relevant DNS audit logging, my auditor will ask about the tool's own security practices."**

A DNS management tool handling compliance audit logs should itself be auditable. Weaver's security evidence: CVD policy with 48-hour acknowledgment and 7-day critical fix SLAs (`SECURITY.md`), SAST with OWASP patterns and supply chain SHA pinning on every push, testing benchmark scored A/A+ against enterprise standards (`docs/TESTING-ASSESSMENT.md`), and documented DR procedures (`docs/setup/DISASTER-RECOVERY.md`). For HIPAA §164.312(b) and CMMC AC.3.022 buyers whose auditors ask "what tool generates these logs and what's its security posture?" — this is the answer.

---

## 8. Buyer Personas {#8-buyer-personas}

### The Sys Admin Homelab Demo (Weaver)

> "I run this at home. Every VM gets a hostname automatically — I haven't touched /etc/hosts in months. I added Pi-hole last week and now my entire network is ad-free, including my phone. The whole thing is managed from one UI. My IT director saw it and asked how much it would cost to run at work."

This is the conversion funnel: homelab Weaver → workplace Fabrick evaluation.

### The IT Director Pitch (Fabrick)

> "You're paying Infoblox $15,000/year for DDI that requires a specialist to manage. We give you split-horizon DNS, AD integration, and immutable audit logs — self-hosted, air-gap capable, declarative config — as part of your Weaver Fabrick subscription. No proprietary appliance. No vendor lock-in. The same config your team already knows."

### The MSP Pitch

> "For each client node, your Fabrick subscription includes the full DNS stack — vm.internal resolution, Pi-hole for network hygiene, split-horizon for internal/external isolation, and audit logs for compliance reporting. One platform, one subscription, all clients. DNSFilter charges you per user per month. We charge per node per year."

### The Compliance Officer Pitch (Healthcare / Defense / Finance)

> "Every DNS query from every VM, logged immutably, timestamped, correlated to the VM that made it. HIPAA § 164.312(b) technical safeguard: check. CMMC AC.3.022 split-horizon: check. SOC 2 CC6.1 network monitoring: check. All from the same audit log you're already using for VM access and provisioning events."

---

## 9. Discovery Questions {#9-discovery-questions}

### Qualifying DNS Pain

1. How do you currently resolve hostnames for VMs in your environment — /etc/hosts, internal DNS server, or by IP?
2. When a new VM is provisioned, how long until it has a usable hostname that other systems can reach?
3. Do you have any regulatory requirement to log DNS queries — HIPAA, CMMC, SOC 2, or PCI?
4. Have you had an incident where DNS misconfiguration caused a production outage? What was the resolution process?
5. Do you operate in any air-gapped or limited-internet environments where cloud-based DNS filtering isn't an option?

### Qualifying Competitive Displacement

6. Are you currently paying for Cisco Umbrella, Zscaler, DNSFilter, or similar DNS security products? What does that cost annually?
7. Do you have Infoblox or BlueCat DDI? Who manages it, and what does a config change process look like?
8. Do you run Pi-hole in your environment? If so, how is it managed — manually, Ansible, or something else?

### Sizing the Opportunity

9. How many VMs or nodes would be covered under a Weaver deployment?
10. Is DNS audit logging currently a gap in your compliance evidence, or are you covered by other controls?
11. Would per-segment DNS isolation (IoT vs VM network vs corporate LAN) be useful in your environment?
12. Is your environment air-gap capable or planning to be — defense, healthcare on-prem, or financial services?

---

*Decisions: [#45](../../../MASTER-PLAN.md) (DNS plugin tier assignment + Pi-hole). See also [DNS-PLAN.md](../../../plans/v1.1.0/DNS-PLAN.md) for implementation spec.*

---

## Recent Changes

- **2026-03-18** — Fabrick pricing revised to $2,000/yr first node, $750/yr additional, $500/yr at 10+. Fabrick tier added at $2,500/yr (512GB RAM). Contract tier added for 512GB+ deployments (sliding scale per 512GB block). Parallel migration / no-expertise-required positioning added as primary lead.
