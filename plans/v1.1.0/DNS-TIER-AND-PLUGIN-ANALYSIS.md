<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# DNS Tier Gating & Extension Model Analysis

**Purpose:** Determine the right monetization model for DNS features — and by extension, set the pattern for all future feature domains (firewall, backup, monitoring, etc.).
**Created:** 2026-03-03
**Status:** DECIDED 2026-03-03 — 3-tier + Extensions adopted for DNS and all future domains
**Depends On:** [DNS-PLAN.md](DNS-PLAN.md), [tier-matrix.json](../../code/tier-matrix.json), AI provider extension architecture (decided 2026-02-23)

---

## The Question

DNS features span from "everyone needs this" (basic resolution) to "only regulated orgs need this" (exfiltration detection, AD integration). Two models for distributing these:

- **Model A: 4-Tier Gate** — Features locked behind tier walls. Want DNSSEC? Upgrade to Weaver. Want audit logging? Upgrade to Fabrick.
- **Model B: 3-Tier + Extensions** — Tiers define who you are (scale, governance). Plugins define what capabilities you add. Available across tiers (with minimums).

AI provider extensions already established the extension pattern. DNS is the decision point: do we expand that pattern to infrastructure, or keep it AI-only?

---

## Model A: 4-Tier Gate (Current Pattern Extended)

Tiers: Weaver Free / Trial / Weaver / Fabrick (demo is showcase, trial is time-limited weaver)

### DNS Feature Distribution

| Feature | Weaver Free | Trial | Weaver | Fabrick |
|---------|------|-------|---------|------------|
| Host stub resolver (`.vm.internal` auto-zone) | Yes | Yes | Yes | Yes |
| VM hostnames in dashboard UI | Yes | Yes | Yes | Yes |
| Cloud-init DNS injection | Yes | Yes | Yes | Yes |
| DNS health indicator | Yes | Yes | Yes | Yes |
| Custom zones (beyond `.vm.internal`) | No | Yes | Yes | Yes |
| DNS resolver VM template (provision) | No | Yes | Yes | Yes |
| DNSSEC validation | No | Yes | Yes | Yes |
| DoH/DoT upstream | No | Yes | Yes | Yes |
| SRV service discovery records | No | Yes | Yes | Yes |
| Per-VM DNS query rate limiting | No | No | No | Yes |
| DNS query audit log | No | No | No | Yes |
| DNS exfiltration detection | No | No | No | Yes |
| Split-horizon DNS | No | No | No | Yes |
| Domain allowlisting (restrict VM resolution) | No | No | No | Yes |
| AD / FreeIPA integration | No | No | No | Yes |
| DNSSEC zone signing | No | No | No | Yes |
| DNS-based load balancing | No | No | No | Yes |
| DNS drift detection | No | No | No | Yes |

### Economics

| Metric | Analysis |
|--------|----------|
| **Revenue ceiling** | Capped by tier price. User who needs only DNSSEC + audit log must buy full Fabrick. |
| **Conversion friction** | High. Weaver → Fabrick is a big jump for one DNS feature. Many users stay at Weaver and do it themselves. |
| **Feature waste** | Fabrick users pay for DNS features they don't need (AD integration when they don't have AD). |
| **Marketing clarity** | Clear: "Free does X, Weaver does Y, Fabrick does Z." Easy to communicate. |
| **Support burden** | Lower: fewer configurations to support. Each tier is a known bundle. |
| **Competitive positioning** | Standard: same as Proxmox (Community/Subscription), ESXi (Standard/Enterprise). |

### Strengths
- Simple to explain, simple to implement
- Tier gates already built (`requireTier()` middleware)
- No extension infrastructure needed beyond AI providers
- Users know exactly what they get at each tier

### Weaknesses
- **Revenue leak from the "stuck in Weaver" cohort** — users who need one Fabrick feature but won't pay for the bundle
- **Fabrick bloat** — Fabrick becomes a grab bag of everything advanced, diluting its identity ("team governance")
- **Every new domain (DNS, firewall, backup, monitoring) widens the Fabrick bundle** — pricing pressure as Fabrick must be worth it for ALL included features
- No à la carte path — all or nothing

---

## Model B: 3-Tier + Extensions

Tiers: Weaver Free / Weaver / Fabrick (trial is time-limited Weaver + extension previews)

**Tiers define scale and governance:**

| Dimension | Weaver Free | Weaver | Fabrick |
|-----------|------|---------|------------|
| **Identity** | "Use what you have" | "Create and control" | "Team governance" |
| **VM limit** | Unlimited (existing only) | Unlimited (provision) | Unlimited + quotas |
| **Users** | 1 | Unlimited | Unlimited + RBAC |
| **Audit** | No | No | Yes (all operations) |
| **Governance policies** | No | No | Yes (enforcement, compliance) |
| **Extension access** | Core only | Install + configure | All + policy routing |
| **Extension pricing** | N/A | Per-extension | All extensions included |

**Extensions define capabilities (available at tier minimums):**

### DNS Extension Family

| Extension | Minimum Tier | What It Adds | Price Position |
|--------|-------------|--------------|----------------|
| **DNS Core** (built-in, not an extension) | Free | Host stub, `.vm.internal` auto-zone, hostnames in UI, cloud-init injection | Free — everyone needs this |
| **DNS Resolver** | Weaver | CoreDNS VM template, custom zones, SRV service discovery | Low — basic managed DNS |
| **DNS Security** | Weaver | DNSSEC validation, DoH/DoT upstream, rebinding protection hardened, query rate limiting | Medium — security-conscious users |
| **DNS Audit** | Fabrick | Query logging, exfiltration detection, drift detection, domain allowlisting | Medium — compliance requirement |
| **DNS Fabrick** | Fabrick | Split-horizon, AD/FreeIPA integration, DNSSEC zone signing, DNS-based load balancing | High — large org infrastructure |

### How It Works Mechanically

```
User has: Weaver tier + DNS Resolver plugin + DNS Security plugin

requireTier(config, 'weaver')     → PASS (tier check)
requirePlugin(config, 'dns-resolver') → PASS (plugin installed)
requirePlugin(config, 'dns-security') → PASS (plugin installed)
requirePlugin(config, 'dns-audit')    → FAIL (not installed, returns 402 + upgrade prompt)
```

Backend enforcement:
```typescript
// New middleware alongside existing requireTier()
function requirePlugin(config: AppConfig, pluginId: string) {
  return (request: FastifyRequest, reply: FastifyReply, done: Function) => {
    if (!config.plugins.includes(pluginId)) {
      reply.code(402).send({
        error: 'Plugin required',
        plugin: pluginId,
        message: `This feature requires the ${pluginId} plugin`,
        upgradeUrl: '/settings/plugins'
      });
      return;
    }
    done();
  };
}
```

### Extension Infrastructure Pattern

Extends the existing AI provider extension architecture:

```typescript
// Existing (AI providers)
interface LlmProvider {
  name: string;
  chat(messages: Message[]): AsyncIterable<string>;
}

// New (DNS — same pattern)
interface DnsPlugin {
  id: string;
  name: string;
  minimumTier: 'free' | 'weaver' | 'fabrick';
  features: string[];
  configure(config: PluginConfig): void;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
}

// Generic plugin interface (all domains)
interface Plugin {
  id: string;
  category: 'ai-provider' | 'dns' | 'firewall' | 'backup' | 'monitoring';
  minimumTier: Tier;
  // ...
}
```

### Extension Categories (Roadmap)

| Category | Extensions | Version |
|----------|---------|---------|
| **AI Providers** (existing) | Anthropic, OpenAI, Ollama, ZenCoder, Custom | v1.0.0 |
| **DNS** | Resolver, Security, Audit, Fabrick | v1.1.0 |
| **Firewall** | Custom Rules, Zones, Drift Detection, Audit | v1.2.0 |
| **Backup** | Disk Backup, Scheduled Backup, Remote Targets, Encryption | v1.6.0+ |
| **Monitoring** | Prometheus, Grafana, Alerting, SLA Tracking | v2.0.0+ |
| **Auth** | MFA/TOTP, FIDO2/WebAuthn, SSO/SAML, LDAP | v1.1.0+ |

Each category follows the same pattern: core features free, extensions extend at tier minimums.

### Economics

| Metric | Analysis |
|--------|----------|
| **Revenue ceiling** | Higher. Weaver users buy extensions à la carte. Revenue = tier + sum(extensions). A Weaver user with 3 DNS extensions pays more than bare Weaver. |
| **Conversion friction** | Lower. "Add DNSSEC for $X/mo" is easier than "upgrade to Fabrick for $$$." Incremental spend, not cliff jumps. |
| **Feature waste** | Eliminated. Users buy what they need. No paying for AD integration when you don't have AD. |
| **Marketing clarity** | Moderate. Tiers are simpler (3 vs 4). But extension catalog adds complexity. Mitigated by: "Fabrick includes everything." |
| **Support burden** | Higher. More permutations of installed extensions. Mitigated by: extension dependencies declared (DNS Audit requires DNS Resolver). |
| **Competitive positioning** | Differentiated. Proxmox has no extension model. This is a marketplace play. |
| **Fabrick value prop** | Strengthened. "Fabrick = all extensions included + governance." Fabrick users don't think about extensions — they just work. Fabrick is the simplification tier. |

### Revenue Model Comparison

Scenario: 100 users, price assumptions for illustration only.

**Model A (4-tier):**
```
40 Weaver Free ($0)  = $0
35 Weaver ($20)      = $700
20 Fabrick ($50)     = $1,000
5  Stuck-at-Weaver-wanting-one-Fabrick-feature ($20) = $100
Total: $1,800/mo
```

**Model B (3-tier + extensions):**
```
40 Weaver Free ($0)          = $0
30 Weaver ($15)              = $450      (base price lower — plugins are the upsell)
 5 Weaver + 1 plugin ($15+$5)  = $100
 5 Weaver + 3 plugins ($15+$12) = $135
15 Fabrick ($50, all included) = $750
 5 Fabrick (were stuck-at-Weaver, now bought 1 plugin) → already counted
Total: $1,435/mo base... but:
  + plugin revenue from Weaver users who'd never upgrade = incremental
  + higher conversion from Weaver Free→Weaver (lower entry price + "just add what you need")
  + plugin marketplace revenue grows with catalog
```

The 3-tier model has lower base revenue but higher **ceiling** and better **conversion dynamics**. The extension tail grows with every feature domain we ship.

**The killer metric:** In Model A, "stuck at Weaver" users are pure revenue leak — they want one feature but won't pay 2.5x for the full Fabrick bundle. In Model B, those users each buy a $5 extension. Small per-user, large in aggregate.

---

## Addressing Open Questions Through the Extension Lens

### 1. DHCP Integration

**Decision:** DHCP is part of **DNS Core** (free, built-in). The host stub resolver can also serve DHCP on the bridge network, enabling dynamic IP assignment instead of static-only.

**Rationale:** DHCP + DNS are inseparable in practice. Splitting them creates a paid wall in front of basic networking. Dynamic IPs feed into the auto-generated `.vm.internal` zone — they must be coupled.

```nix
services.weaver.dns = {
  enable = true;          # Enables host stub resolver
  dhcp.enable = true;     # Also serve DHCP on bridge (default: true)
  dhcp.range = "10.10.0.100-10.10.0.200";  # Dynamic range
  # Static assignments from VM definitions still take priority
};
```

### 2. DNS for Multi-Node

**Decision:** Multi-node DNS is part of the **DNS Fabrick** extension (Fabrick-only). Single-node DNS works via the host stub or DNS Resolver extension.

Multi-node zone management:
- **Designated leader:** One node's DNS resolver VM is authoritative. Others forward to it.
- **Zone transfer:** AXFR/IXFR from leader to follower DNS resolvers.
- **Ties into v2.0+ multi-node plan** — not v1.x scope.

This is naturally Fabrick because multi-node itself is Fabrick.

### 3. Wildcard Records

**Decision:** Part of **DNS Resolver** extension (Weaver). Configurable per-VM:

```nix
vms.web-nginx.dns.wildcard = true;  # *.web-nginx.vm.internal → 10.10.0.10
```

Use case: VM runs nginx with virtual hosts. `app1.web-nginx.vm.internal` and `app2.web-nginx.vm.internal` both resolve to the VM, nginx routes by Host header.

### 4. PTR Delegation

**Decision:** Part of **DNS Fabrick** extension. Internal PTR records (reverse resolution within `.vm.internal`) are covered by DNS Core (free). Delegation to external reverse DNS requires coordination with network infrastructure — Fabrick territory.

### 5. mDNS/Avahi Coexistence

**Decision:** Built into **DNS Core** (free). The host stub resolver:
- Binds to bridge interfaces only, not `0.0.0.0`
- Uses `.vm.internal` (not `.local`) — no mDNS conflict
- Documents Avahi coexistence in NixOS module options
- If user has Avahi: both work, different domains, different interfaces

```nix
services.weaver.dns = {
  domain = "vm.internal";    # Default — never .local
  listenInterfaces = [ "br-mgmt" "br-app" ];  # Not host LAN interface
};
```

This is a configuration concern, not a feature gate. Free users need it to work.

---

## The Verdict: 3-Tier + Extensions Wins

### Economic Argument

| Factor | 4-Tier | 3-Tier + Extensions | Winner |
|--------|--------|-------------------|--------|
| Revenue from "stuck at Weaver" users | $0 (they don't upgrade) | $5-15/mo each (they buy extensions) | Extensions |
| Fabrick perceived value | Diluted (grab bag of features) | Clear ("governance + all included") | Extensions |
| Free → Weaver conversion | Higher barrier (fixed price for fixed bundle) | Lower barrier (cheaper base + "add what you need") | Extensions |
| Revenue ceiling per user | Capped at tier price | Tier + N extensions (grows with catalog) | Extensions |
| Marketing simplicity | Simpler (3 feature lists) | Moderate (3 tiers + catalog) | 4-Tier |
| Support complexity | Lower (fewer permutations) | Higher (extension combos) | 4-Tier |
| Implementation effort | Lower (only `requireTier`) | Higher (extension registry + `requirePlugin`) | 4-Tier |
| Competitive moat | Commodity (everyone does tiers) | Differentiated (extension marketplace) | Extensions |
| Scaling to new domains | Each domain widens Fabrick bloat | Each domain is a new extension category | Extensions |

**Score: Extensions 6, 4-Tier 3.** The three wins for 4-tier are all implementation/effort concerns that diminish over time. The six wins for extensions are structural revenue and market advantages that compound.

### Marketing Argument

**4-Tier pitch:** "Weaver Free, Weaver ($20), Fabrick ($50). Here's what each tier includes."
- Problem: Fabrick list grows unwieldy. "Fabrick includes: per-VM RBAC, quotas, bulk ops, audit log, DNSSEC, DoH, exfiltration detection, split-horizon, AD integration, zone signing, DNS load balancing, firewall zones, drift detection, backup encryption, scheduled backups, remote targets, ..." → wall of text
- Problem: Weaver users see features they want locked behind a 2.5x price jump

**3-Tier + Plugins pitch:** "Weaver Free, Weaver ($15), Fabrick ($50). Add what you need."
- Tier page: 3 clean columns focused on scale/governance
- Extension catalog: browse by category, see what each adds, install with one click
- Fabrick: "Everything included. No extension decisions. Just works."
- Weaver: "Start lean. Add DNS security when you need it. Add monitoring when you're ready."

The extension model tells a **growth story**: "Start with what you need, add capabilities as you grow." The tier model tells a **ceiling story**: "Pick your tier, that's what you get."

Growth stories convert better.

### Architectural Argument

AI provider extensions already proved the pattern works:
- `LlmProvider` interface → extensions register implementations
- Tier gates which extensions are available
- Fabrick adds policy routing on top

DNS extensions follow the identical pattern:
- `DnsPlugin` interface → extensions register capabilities
- Tier gates which extensions are installable
- Fabrick adds governance (audit, compliance, policy)

Every future domain (firewall, backup, monitoring, auth) slots into the same framework. **The extension infrastructure is a one-time investment that pays dividends on every feature domain.**

---

## The Path Forward: DNS on 3-Tier + Extensions

### Phase 1: DNS Core (v1.1.0) — Free, Built-In

**Not an extension. Ships with every installation.**

| Feature | Implementation |
|---------|---------------|
| Host stub resolver (dnsmasq) | NixOS module: `services.weaver.dns.enable` |
| `.vm.internal` auto-zone | Backend generates zone from VM registry on add/remove |
| DHCP on bridge (optional) | `dns.dhcp.enable` — dynamic IPs for VMs without static assignment |
| Cloud-init DNS injection | All provisioned VMs auto-configured to use host stub |
| VM hostnames in dashboard UI | VM detail shows `hostname.vm.internal`, copy button |
| Reverse resolution (PTR) | Auto-generated from forward records |
| DNS health indicator | Weaver header: green/yellow/red |
| DNS rebinding protection | Host header validation middleware (Fastify) |
| mDNS/Avahi coexistence | `.vm.internal` domain, bridge-only binding |
| API: `GET /api/dns/zone` | Read-only zone view |
| API: `GET /api/dns/health` | Resolver status |
| TUI: `microvm dns show` | Zone + status |

**Deliverables:** NixOS module changes, dnsmasq config generation, backend zone management, frontend hostname display, Fastify middleware, 2 API endpoints, TUI commands.

### Phase 2: Extension Infrastructure (v1.1.0) — Ships Alongside DNS Core

**Generalizes the AI provider extension pattern to all domains.**

| Component | Description |
|-----------|-------------|
| `Plugin` interface | Generic: id, category, minimumTier, features, configure/activate/deactivate |
| Extension registry | Backend service: installed extensions, license validation, dependency resolution |
| `requirePlugin()` middleware | Route-level enforcement (alongside existing `requireTier()`) |
| Extensions settings page | Frontend: browse catalog, install, configure, see tier requirements |
| Extensions API | `GET /api/plugins` (catalog), `POST /api/plugins/:id/install`, `PUT /api/plugins/:id/config` |
| Extension dependency graph | DNS Audit requires DNS Resolver. Declared in extension metadata. |
| AI providers migrated | Existing `LlmProvider` extensions registered through new generic system |

**This is the strategic investment.** Every future feature domain drops into this framework.

### Phase 3: DNS Resolver Extension (v1.1.0) — Weaver

| Feature | Implementation |
|---------|---------------|
| CoreDNS VM template in catalog | Distro catalog entry with auto-provision |
| Custom zones (beyond `.vm.internal`) | API + UI zone editor |
| SRV service discovery records | Auto-generated from template metadata + firewall profiles |
| Wildcard records per VM | NixOS option: `vms.<name>.dns.wildcard = true` |
| CoreDNS Corefile generation | Weaver backend → zone file → Corefile |
| Infrastructure page: zone browser | New UI page (or tab in existing Settings) |
| API: CRUD zones | `POST/PUT/DELETE /api/dns/zones` |
| TUI: `microvm dns zones` | Zone management commands |

### Phase 4: DNS Security Extension (v1.1.0–v1.2.0) — Weaver

| Feature | Implementation |
|---------|---------------|
| DNSSEC validation | CoreDNS dnssec plugin configuration |
| DoH/DoT upstream | CoreDNS forward plugin with TLS |
| Per-VM DNS query rate limiting | nftables rate limit on port 53 per tap interface |
| DNS health: upstream latency | Prometheus metrics from CoreDNS |

### Phase 5: DNS Audit Extension (v1.2.0–v2.0.0) — Fabrick

| Feature | Implementation |
|---------|---------------|
| DNS query logging | CoreDNS log plugin → audit store |
| Exfiltration detection | Query analysis: entropy scoring, volume anomaly, long labels |
| DNS drift detection | Declared zone vs `dig @resolver` actual |
| Domain allowlisting | Per-VM/per-zone resolution restriction |
| Query log viewer in dashboard | Fabrick infrastructure page tab |

### Phase 6: DNS Fabrick Extension (v2.0.0+) — Fabrick

| Feature | Implementation |
|---------|---------------|
| Split-horizon DNS | CoreDNS view/ACL plugin |
| AD / FreeIPA integration | CoreDNS LDAP plugin + Kerberos |
| DNSSEC zone signing | CoreDNS dnssec signing plugin |
| DNS-based load balancing | Weighted round-robin zone records |
| Multi-node zone management | Zone transfer (AXFR/IXFR) between nodes |

---

## Impact on Existing Plans

### Tier Matrix Update

Current `tier-matrix.json` gates features by tier only. Needs a second dimension:

```json
{
  "features": {
    "dns-core": { "tier": "free", "plugin": null },
    "dns-resolver": { "tier": "weaver", "plugin": "dns-resolver" },
    "dns-security": { "tier": "weaver", "plugin": "dns-security" },
    "dns-audit": { "tier": "fabrick", "plugin": "dns-audit" },
    "dns-fabrick": { "tier": "fabrick", "plugin": "dns-fabrick" }
  }
}
```

`audit:tier-parity` script needs updating to check `requirePlugin()` gates alongside `requireTier()` gates.

### Firewall Plan Update

Firewall features follow the same extension model:

| Extension | Minimum Tier |
|--------|-------------|
| Firewall Core (presets) | Free (built-in) |
| Firewall Custom Rules | Weaver |
| Firewall Zones | Fabrick |
| Firewall Audit | Fabrick |

### Backup Plan Update

Same pattern:

| Extension | Minimum Tier |
|--------|-------------|
| Config Export | Free (built-in) |
| Disk Backup | Weaver |
| Scheduled Backup | Weaver |
| Remote Targets | Fabrick |
| Backup Encryption | Fabrick |

### Trial Tier

Trial = time-limited Weaver + **all Weaver-tier extensions preview-enabled**. Trial users experience the full extension catalog at Weaver level. Usage caps still apply.

Fabrick extensions show as "Fabrick Preview" in trial — visible, explorable, but with a banner: "Available with Fabrick."

---

## Extension Marketplace (v2.0.0+ Vision)

The extension infrastructure enables a future marketplace:

1. **First-party extensions** (us) — DNS, Firewall, Backup, Monitoring, Auth
2. **Community extensions** (open source) — Custom hypervisor adapters, notification channels, dashboard themes
3. **Third-party extensions** (partners) — Vendor-specific integrations (Ceph storage adapter, Cloudflare DNS, PagerDuty alerts)

This is the Proxmox-killer move. Proxmox has no extension ecosystem. Weaver becomes a **platform**, not just a product.

**Not in scope for v1.x.** But the architecture we build now must not prevent this. Extension interface, registry, and dependency resolution are the foundation.

---

## Decision Required

This is a single decision with cascading impact:

**Adopt the 3-Tier + Extension model for DNS and all future feature domains?**

If yes:
1. DNS Core ships as built-in (v1.1.0)
2. Extension infrastructure ships alongside (v1.1.0)
3. AI providers migrate to generic extension system
4. DNS Resolver + DNS Security as first infrastructure extensions (v1.1.0)
5. All future plans (firewall, backup, monitoring) follow the same pattern
6. `tier-matrix.json` gains an extension dimension
7. `requirePlugin()` middleware added alongside `requireTier()`
8. Trial tier previews Weaver extensions

If no (stay with 4-tier):
1. DNS features gated purely by tier
2. No extension infrastructure beyond AI providers
3. Fabrick continues to absorb all advanced features
4. Simpler implementation, lower ceiling

**Recommendation:** Yes. The extension pattern is already proven (AI providers). DNS is the natural second category. The architectural investment is moderate and pays dividends on every future feature domain. The revenue and conversion advantages compound. The marketplace vision is the Pegaprox endgame.

---

*Cross-reference: [DNS-PLAN.md](DNS-PLAN.md) | [FIREWALL-TEMPLATE-PLAN.md](../v1.2.0/FIREWALL-TEMPLATE-PLAN.md) | [GIT-FORGE-TEMPLATE-PLAN.md](../GIT-FORGE-TEMPLATE-PLAN.md) | [CLIENT-SECURITY-PLAN.md](../v1.0.0/CLIENT-SECURITY-PLAN.md) | [APPLIANCE-TRIAL-STRATEGY.md](user-action-docs/APPLIANCE-TRIAL-STRATEGY.md)*
