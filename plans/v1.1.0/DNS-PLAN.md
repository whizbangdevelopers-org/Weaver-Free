<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# DNS Plan — The Evil Question

**Purpose:** Address DNS across all three dimensions: internal VM resolution, security posture, and managed DNS service template. DNS is the invisible layer that breaks everything when wrong and gets zero credit when right.
**Created:** 2026-03-02
**Status:** ALL DECISIONS RESOLVED (2026-03-03) — ready for implementation phasing
**Depends On:** VM provisioning, firewall templates (`FIREWALL-TEMPLATE-PLAN.md`), network bridge architecture

---

## Why DNS Is Evil in the MicroVM Context

### The Problem

Weaver currently has **no DNS story at all**. VMs get static IPs defined in `backend/src/services/microvm.ts` and that's it. Users must:

- Remember IP addresses (or write them down)
- Hardcode IPs in VM configs (fragile — IP changes break everything)
- Manage `/etc/hosts` manually on the host and inside every VM
- Have no service discovery (VM A can't find VM B by name)

This works for 5 demo VMs. It does not work for:
- 20+ VMs where nobody remembers which IP is which
- Dynamic provisioning where IPs aren't predetermined
- Multi-node deployments where VMs move between hosts
- Any environment where a non-expert needs to manage things

### The Resolution Chain

```
Guest VM process
  → Guest /etc/resolv.conf (points where?)
    → Bridge-local DNS? (doesn't exist yet)
      → Host systemd-resolved / NetworkManager
        → Upstream DNS (ISP, Cloudflare, corporate resolver)
```

Every arrow is a potential failure point, leak point, or attack surface.

---

## Dimension 1: Internal DNS for VMs

### Current State: Nothing

VMs are defined with static IPs. No hostnames. No forward or reverse resolution. No service discovery.

```typescript
// backend/src/services/microvm.ts — current
{ name: 'web-nginx', ip: '10.10.0.10', memory: 256, vcpus: 1 }
```

A VM that wants to reach `svc-postgres` must hardcode `10.10.0.10`. If that IP changes, everything breaks.

### Target State: Automatic Internal DNS

Every VM gets a hostname that resolves within the microVM network:

```
web-nginx.vm.local      → 10.10.0.10
web-app.vm.local        → 10.10.0.11
dev-node.vm.local       → 10.10.0.20
svc-postgres.vm.local   → 10.10.0.30
```

Reverse resolution too:
```
10.10.0.10 → web-nginx.vm.local
```

### Implementation Options

#### Option A: Host-Side Resolver (Lightweight)

Run a lightweight DNS resolver on the host that serves the `.vm.local` zone and forwards everything else upstream.

```
Guest /etc/resolv.conf → bridge gateway IP (host) → dnsmasq/CoreDNS on host
  ├── *.vm.local → answer from VM registry
  └── everything else → forward to upstream
```

**Pros:** Simple. No extra VM. Host already knows all VM IPs.
**Cons:** Host is a single point of failure. DNS config mixed into host system.

NixOS implementation:
```nix
services.weaver.dns = {
  enable = true;
  domain = "vm.local";
  resolver = "coredns";  # or "dnsmasq"
  # Auto-generates zone from VM registry
  upstream = [ "1.1.1.1" "8.8.8.8" ];
};
```

#### Option B: DNS Resolver VM (Managed Service)

Dedicate a microVM to running CoreDNS. Weaver maintains the zone file. VMs point at the resolver VM.

```
Guest /etc/resolv.conf → dns-resolver.vm.local (10.10.0.2) → CoreDNS
  ├── *.vm.local → answer from zone file (pushed by dashboard)
  └── everything else → forward to upstream
```

**Pros:** Isolated. Can apply firewall rules. Matches the "managed service template" vision.
**Cons:** Extra VM consuming resources. Chicken-and-egg: how does the DNS VM resolve itself?

#### Option C: Hybrid (Recommended)

Host runs a minimal stub resolver (dnsmasq) that:
1. Answers `*.vm.local` from the VM registry (always available, even if DNS VM is down)
2. Forwards everything else to the DNS resolver VM (if present) or upstream (if not)

Weaver/Fabrick users can deploy a full CoreDNS VM for advanced features (DNSSEC validation, split-horizon, custom zones). The stub resolver on the host is always the fallback.

```
Guest → Host stub (dnsmasq) → DNS VM (CoreDNS, optional) → Upstream
         ├── *.vm.local: answer locally (always works)
         └── *: forward to DNS VM or upstream
```

**This is the only option that doesn't have a circular dependency.** The DNS VM can't resolve itself, but the host stub can.

### Zone Management

Weaver backend maintains the zone:

```typescript
// Auto-generated from VM registry
interface DnsZone {
  domain: string;              // "vm.local"
  records: DnsRecord[];
  serial: number;              // Increments on VM add/remove/IP change
  ttl: number;                 // Default 60s (low for dynamic environments)
}

interface DnsRecord {
  name: string;                // "web-nginx"
  type: 'A' | 'AAAA' | 'PTR' | 'SRV' | 'CNAME';
  value: string;               // "10.10.0.10"
  metadata?: {
    vmName: string;
    port?: number;             // For SRV records (service discovery)
  };
}
```

Zone updates trigger:
1. Write zone file / update dnsmasq hosts
2. Signal resolver to reload (HUP or API)
3. WebSocket broadcast: `{ type: "dns-update", serial: N }`

### Service Discovery (SRV Records)

Beyond A records, VMs that expose services get SRV records:

```
_http._tcp.web-nginx.vm.local  SRV 0 0 80 web-nginx.vm.local
_postgresql._tcp.svc-postgres.vm.local  SRV 0 0 5432 svc-postgres.vm.local
_ssh._tcp.dev-node.vm.local  SRV 0 0 22 dev-node.vm.local
```

This enables proper service discovery — a VM can find the PostgreSQL server by querying `_postgresql._tcp.vm.local` without knowing which VM runs it.

---

## Dimension 2: DNS Security

### Threat Model

| Threat | Vector | Impact | Layer |
|--------|--------|--------|-------|
| **DNS rebinding** | Attacker's DNS returns internal IP on second query | Browser accesses dashboard API from attacker's origin | Host |
| **DNS exfiltration** | Malicious VM encodes data in DNS queries (`secret.evil.com`) | Data leak from guest to internet via DNS | Guest → Host |
| **DNS spoofing** | MITM on upstream resolver path | VM gets wrong IP, connects to attacker | Host → Upstream |
| **Zone poisoning** | Compromised dashboard writes bad records | VMs resolve wrong IPs for internal services | Weaver → Zone |
| **Resolver DoS** | VM floods DNS queries | Host resolver overwhelmed, all VMs lose resolution | Guest → Host |
| **Cache poisoning** | Attacker injects false records into resolver cache | Long-lived bad resolution | Host resolver |
| **Privacy leak** | VM DNS queries visible to ISP/upstream | Traffic analysis, surveillance | Host → Upstream |

### Mitigations by Tier

| Mitigation | Weaver Free | Weaver | Fabrick |
|------------|------|---------|------------|
| **Internal-only zone** (`.vm.local` never leaves the host) | Yes | Yes | Yes |
| **DNS rebinding protection** (reject private IPs from external DNS) | Yes | Yes | Yes |
| **Query rate limiting** (per-VM DNS query cap) | No | Yes | Yes |
| **DNS exfiltration detection** (flag unusual query patterns) | No | No | Yes |
| **DNSSEC validation** (verify upstream responses) | No | Yes | Yes |
| **DoH/DoT upstream** (encrypted DNS to upstream) | No | Yes | Yes |
| **Split-horizon DNS** (different answers internal vs external) | No | No | Yes |
| **DNS query audit log** (who queried what, when) | No | No | Yes |
| **Zone change audit** (who modified DNS records) | No | No | Yes |
| **Allowlist upstream domains** (VMs can only resolve approved domains) | No | No | Yes |

### DNS Rebinding Protection (All Tiers)

This is the one that bites hardest and costs nothing to fix:

```
1. Attacker registers evil.com
2. evil.com DNS returns 1.2.3.4 (attacker server)
3. User visits evil.com, JavaScript loads
4. evil.com DNS TTL expires, now returns 10.10.0.1 (dashboard internal IP)
5. Browser still thinks origin is evil.com, but requests go to dashboard API
6. Weaver responds (CORS allows? depends on config)
```

**Fix:** Validate `Host` header on all requests. Reject requests where `Host` doesn't match expected hostname.

```typescript
// Fastify middleware
fastify.addHook('onRequest', (request, reply, done) => {
  const host = request.hostname;
  const allowed = ['localhost', '127.0.0.1', config.hostname, config.domain];
  if (!allowed.includes(host)) {
    reply.code(421).send({ error: 'Misdirected request' });
    return;
  }
  done();
});
```

NixOS module option:
```nix
services.weaver.security.allowedHosts = [
  "localhost"
  "mgmt.example.com"
];
```

### DNS Exfiltration Detection (Fabrick)

A compromised or malicious VM can leak data by encoding it in DNS queries:

```
YWRtaW46cGFzc3dvcmQ.evil.com  → base64-encoded "admin:password"
```

Detection heuristics:
- Query entropy analysis (random-looking subdomains)
- Query volume per VM (baseline + anomaly)
- Unusual TLD patterns
- Long subdomain labels (>30 chars)

This feeds into the audit log, not an automatic block (too many false positives with CDNs and anti-tracking DNS).

### DNSSEC Validation (Weaver+)

The host resolver validates DNSSEC signatures on upstream responses:

```nix
services.weaver.dns.dnssec = {
  enable = true;       # Validate upstream DNSSEC
  trustAnchors = "auto";  # Use IANA root trust anchor
  # Reject responses that fail validation
  policy = "strict";   # or "permissive" (log but allow)
};
```

### DoH/DoT (Weaver+)

Encrypt DNS queries to upstream:

```nix
services.weaver.dns.upstream = {
  protocol = "dot";         # or "doh"
  servers = [
    "1.1.1.1"              # Cloudflare
    "9.9.9.9"              # Quad9
  ];
  # Fabrick: custom corporate resolver
};
```

Prevents ISP/network-level DNS surveillance. Particularly relevant for the self-hosted/privacy audience that chooses NixOS.

---

## Dimension 3: Managed DNS Service Template

Like the Git Forge template — a catalog entry that provisions a full-featured DNS resolver as a microVM.

### Why a Separate DNS VM?

The host stub resolver covers basic `*.vm.local` resolution. But power users and enterprises need:

- Custom zones (internal domains beyond `.vm.local`)
- Split-horizon DNS (different answers for internal vs VPN vs external)
- DNS-based load balancing (round-robin, weighted, geo)
- Central DNS logging and analytics
- DNSSEC signing (not just validation — signing your own zones)
- Integration with external DNS (Active Directory, FreeIPA)

This is too much to bolt onto the host. It belongs in a dedicated VM.

### Template Specification

```nix
services.weaver.templates.dns-resolver = {
  name = "dns-resolver";
  displayName = "DNS Resolver (CoreDNS)";
  description = "Internal DNS resolution, DNSSEC validation, DoH/DoT, custom zones";
  category = "infrastructure";
  icon = "dns";

  vm = {
    memory = 256;    # CoreDNS is lightweight
    vcpus = 1;
    diskSize = 1024; # 1GB — logs are the main consumer
  };

  network = {
    firewall.profile = "dns-resolver";
    ip = "10.10.0.2";  # Conventionally second IP on management bridge
  };

  cloudInit = {
    packages = [ "coredns" ];
  };

  ports = {
    dns = 53;        # UDP + TCP
    doh = 443;       # DNS over HTTPS (optional)
    metrics = 9153;  # Prometheus metrics
  };

  healthCheck = {
    command = "dig @localhost version.bind chaos txt +short";
    interval = 15;
  };
};
```

### Firewall Profile: `dns-resolver`

```nix
# profiles/dns-resolver.nix
{
  ingress = [
    { port = 53; proto = "udp"; comment = "DNS queries"; }
    { port = 53; proto = "tcp"; comment = "DNS queries (TCP fallback)"; }
    { port = 443; proto = "tcp"; from = "management-zone"; comment = "DoH (internal only)"; }
    { port = 9153; proto = "tcp"; from = "management-zone"; comment = "Prometheus metrics"; }
  ];
  egress = [
    { port = 53; proto = "udp"; comment = "Upstream DNS forwarding"; }
    { port = 53; proto = "tcp"; comment = "Upstream DNS (TCP)"; }
    { port = 853; proto = "tcp"; comment = "DoT to upstream"; }
    { port = 443; proto = "tcp"; comment = "DoH to upstream"; }
  ];
  # Deny all other egress — DNS resolver has no business reaching HTTP, SSH, etc.
}
```

### CoreDNS Corefile (Auto-Generated)

Weaver generates and pushes the CoreDNS configuration:

```
vm.local {
    file /etc/coredns/zones/vm.local.zone
    reload 10s
    log
}

. {
    forward . tls://1.1.1.1 tls://9.9.9.9 {
        tls_servername cloudflare-dns.com
        health_check 30s
    }
    dnssec
    cache 300
    prometheus :9153
}
```

### Tier Gating

| Capability | Weaver Free | Weaver | Fabrick |
|------------|------|---------|------------|
| Host stub resolver (`.vm.local` only) | Yes | Yes | Yes |
| DNS resolver VM template (visible in catalog) | Yes | Yes | Yes |
| One-click DNS VM provisioning | No | Yes | Yes |
| Custom zones (beyond `.vm.local`) | No | Yes | Yes |
| DNSSEC validation | No | Yes | Yes |
| DoH/DoT upstream | No | Yes | Yes |
| Split-horizon DNS | No | No | Yes |
| DNS query audit log | No | No | Yes |
| DNS exfiltration detection | No | No | Yes |
| Domain allowlisting (restrict VM DNS resolution) | No | No | Yes |
| Active Directory / FreeIPA integration | No | No | Yes |
| DNS-based load balancing | No | No | Yes |
| DNSSEC zone signing | No | No | Fabrick |

---

## Weaver Integration

### API Endpoints

| Method | Endpoint | Description | Tier |
|--------|----------|-------------|------|
| GET | `/api/dns/zone` | Get current internal zone (all records) | Free |
| GET | `/api/dns/zone/:name` | Get records for specific VM | Free |
| GET | `/api/dns/config` | Get DNS configuration (resolver, upstream, features) | Weaver |
| PUT | `/api/dns/config` | Update DNS configuration | Weaver |
| POST | `/api/dns/zones` | Create custom zone | Weaver |
| PUT | `/api/dns/zones/:zone` | Update custom zone | Weaver |
| DELETE | `/api/dns/zones/:zone` | Delete custom zone | Weaver |
| GET | `/api/dns/query-log` | Query DNS audit log | Fabrick |
| GET | `/api/dns/drift` | Compare declared zone vs actual resolution | Fabrick |
| GET | `/api/dns/health` | Resolver health + upstream latency | Free |

### UI Components

**VM Detail Page → Network Tab:**
- Shows VM's hostname (`web-nginx.vm.local`)
- Resolved IP (forward + reverse confirmation)
- DNS records associated with this VM (A, SRV)
- "Copy hostname" button

**Infrastructure Page (new):**
- DNS resolver status (host stub + optional DNS VM)
- Zone browser (list all records, search)
- Upstream resolver latency graph
- Weaver: zone editor
- Fabrick: query log viewer, exfiltration alerts, drift indicator

**Weaver Header:**
- DNS health indicator (green/yellow/red) alongside existing system health

### TUI Commands

```
microvm dns show                    # Current zone + resolver status
microvm dns show <vm>               # Records for specific VM
microvm dns resolve <hostname>      # Manual resolution test
microvm dns config                  # Show DNS configuration
microvm dns config set-upstream ... # Change upstream (Weaver)
microvm dns zones                   # List custom zones (Weaver)
microvm dns query-log               # Recent queries (Fabrick)
microvm dns drift                   # Drift report (Fabrick)
```

---

## Cloud-Init DNS Integration

When a VM is provisioned, cloud-init must configure the guest's DNS:

```yaml
# Auto-injected into every VM's cloud-init
manage_resolv_conf: true
resolv_conf:
  nameservers:
    - 10.10.0.1          # Host stub resolver (bridge gateway)
  searchdomains:
    - vm.local
  options:
    ndots: 1
    timeout: 2
    attempts: 3
```

This means:
- Every VM automatically resolves `web-nginx` → `web-nginx.vm.local` → `10.10.0.10`
- No manual `/etc/resolv.conf` editing
- If DNS VM is deployed, host stub forwards to it transparently

---

## Implementation Phases

### Phase 1: Host Stub Resolver (v1.1.0)

| Task | Effort | Notes |
|------|--------|-------|
| dnsmasq on host serving `.vm.local` zone | Medium | NixOS module option |
| Auto-generate zone from VM registry | Small | Backend writes hosts file on VM add/remove |
| Signal dnsmasq on zone change (SIGHUP) | Small | Systemd integration |
| Cloud-init DNS injection | Small | All VMs point at host gateway |
| DNS health API endpoint | Small | Check resolver responds |
| VM detail: show hostname + resolved IP | Small | Frontend component |
| DNS rebinding protection (Host header validation) | Small | Fastify middleware |

### Phase 2: DNS Resolver VM Template (v2.0.0)

| Task | Effort | Notes |
|------|--------|-------|
| CoreDNS catalog entry | Small | Extends distro catalog |
| CoreDNS Corefile generation | Medium | Weaver → zone file → Corefile |
| DNSSEC validation | Medium | CoreDNS plugin config |
| DoH/DoT upstream | Small | CoreDNS forward plugin |
| Custom zone support (Weaver) | Medium | API + UI + CoreDNS multi-zone |
| DNS config API endpoints | Medium | CRUD zones, update config |
| Infrastructure page (UI) | Large | New page: zone browser, resolver status |

### Phase 3: Fabrick DNS (v2.5.0)

| Task | Effort | Notes |
|------|--------|-------|
| DNS query logging | Medium | CoreDNS log plugin → audit store |
| Exfiltration detection | Large | Query analysis engine, entropy scoring |
| Split-horizon DNS | Medium | CoreDNS view plugin or ACL-based |
| Domain allowlisting | Medium | Restrict resolution per VM/zone |
| DNS drift detection | Medium | Declared zone vs `dig` actual |
| AD/FreeIPA integration | Large | LDAP/Kerberos plugin for CoreDNS |
| DNSSEC zone signing | Medium | CoreDNS dnssec plugin |
| DNS-based load balancing | Medium | Weighted round-robin in zone records |

---

## Forge Integration

### Forge + DNS = Complete Internal Infrastructure

With both the Git Forge and DNS templates deployed:

```
forge.vm.local     → 10.10.0.3    (Forgejo — Git hosting)
dns.vm.local       → 10.10.0.2    (CoreDNS — resolution)
runner-01.vm.local → 10.10.0.4    (CI runner)
```

Foundry agents resolve everything by name. No hardcoded IPs in pipeline configs. Add a new runner VM → it appears in DNS automatically → pipelines discover it via SRV records.

### Air-Gapped DNS

In air-gapped deployments:
- DNS resolver VM is the only resolver (no upstream forwarding)
- All internal services resolved via `.vm.local` zone
- External resolution denied (or allowlisted to specific mirrors)
- Updates pulled via sneakernet or scheduled mirror sync

---

## Competitive Comparison

| Feature | Proxmox | ESXi/vCenter | Weaver |
|---------|---------|-------------|-------------------|
| Internal VM DNS | Manual (edit /etc/hosts or run own DNS) | vCenter integrated DNS | Auto-generated zone from VM registry |
| Service discovery | None | None built-in | SRV records per VM service |
| DNS security | None | None | Rebinding protection, DNSSEC, DoH/DoT |
| Exfiltration detection | None | None (need NSX) | Fabrick query analysis |
| DNS config model | Imperative | Imperative | Declarative Nix (git-tracked, rollbackable) |
| Zone management | Manual | Manual | Auto-maintained by dashboard |
| DNS as managed service | N/A | N/A | One-click CoreDNS template |

The pitch: **"Every VM gets a hostname. Every hostname resolves. Zero configuration. Your DNS is code — version it, audit it, roll it back."**

---

## Decisions (Resolved 2026-03-03)

### Decision 1: Resolver Software — DECIDED

| Option | Footprint | Features | NixOS Integration |
|--------|-----------|----------|-------------------|
| **dnsmasq** (host stub) | Tiny (~500KB) | DNS + DHCP, hosts-file based, no plugins | Excellent — `services.dnsmasq` |
| **CoreDNS** (DNS VM) | Small (~30MB) | Plugin-based, Prometheus metrics, DNSSEC, DoH | Good — available in nixpkgs |
| **Unbound** (alternative) | Small (~10MB) | Validating resolver, DNSSEC, DoT | Excellent — `services.unbound` |
| **Knot Resolver** | Medium | DNSSEC, DoH, aggressive caching | Good — in nixpkgs |

**Decision:** dnsmasq for host stub (simplest, always available). CoreDNS for DNS VM (plugin ecosystem, Prometheus metrics, most flexible). Hybrid architecture — host stub is always the fallback.

### Decision 2: Internal Domain — DECIDED

| Option | Description | Tradeoff |
|--------|-------------|----------|
| `.vm.local` | Descriptive, `.local` is familiar | Conflicts with mDNS/Avahi (`.local` is reserved for mDNS per RFC 6762) |
| `.vm.internal` | RFC 6762 safe, descriptive | `.internal` is proposed but not yet standardized (IETF draft) |
| `.vm.lan` | Common in home routers | No RFC backing, could conflict with router DNS |
| `.<configurable>` | User chooses | Most flexible, but adds setup friction |

**Decision:** `.vm.internal` as default (IETF standardizing `.internal` for private infrastructure), configurable via NixOS option. Warn if user picks `.local` (mDNS conflict).

### Decision 3: DNS VM Auto-Deploy — DECIDED

| Option | Description |
|--------|-------------|
| **Manual** | DNS VM is a catalog template. User deploys if they want it. Host stub always works. |
| **Auto-provision at Weaver** | When Weaver is activated, dashboard auto-deploys the DNS VM alongside existing VMs. |
| **Recommend but don't force** | Weaver suggests deploying DNS VM after 5+ VMs. Notification/banner, not auto-deploy. |

**Decision:** Recommend but don't force. Banner after 5+ VMs promotes DNS Resolver extension. Auto-deploying without consent violates declarative philosophy.

### Decision 4: SRV Record Source — DECIDED

How does the dashboard know which services a VM exposes?

| Option | Description |
|--------|-------------|
| **From firewall profile** | If `web-server` profile opens port 80, generate `_http._tcp` SRV record automatically |
| **From template metadata** | Template defines exposed services (Git Forge: `http:3000`, `ssh:2222`) |
| **Manual annotation** | User tags VM services in dashboard UI |
| **Port scan** | Weaver probes VM ports to discover services |

**Decision:** Template metadata first (automatic for provisioned VMs), firewall profile second (fallback for manual VMs), manual annotation third (escape hatch). Never port scan — hostile behavior from a management tool.

---

## Open Questions (Resolved 2026-03-03)

Resolved via DNS-TIER-AND-PLUGIN-ANALYSIS.md decision session:

1. **DHCP integration** — **DECIDED:** DHCP is part of DNS Core (free, built-in). Host stub serves DHCP on bridge. Dynamic IPs feed into auto-generated zone. DNS + DHCP are inseparable in practice.
2. **DNS for multi-node** — **DECIDED:** Fabrick-only (DNS Fabrick extension). Designated leader node is authoritative, others forward. Zone transfer (AXFR/IXFR). Ties into v2.0+ multi-node plan.
3. **Wildcard records** — **DECIDED:** Part of DNS Resolver extension (Weaver). Per-VM config: `vms.<name>.dns.wildcard = true`. Use case: nginx virtual hosts.
4. **PTR delegation** — **DECIDED:** Internal PTR is free (auto-generated). External/public PTR delegation is Fabrick (DNS Fabrick extension) for users who own their IP block. See also: email deliverability below.
5. **mDNS/Avahi coexistence** — **DECIDED:** Built into DNS Core (free). Use `.vm.internal` (not `.local`), bind to bridge interfaces only. Documented in NixOS module. Configuration concern, not feature gate.

### 6. Email Deliverability & Reverse DNS (Added 2026-03-03)

**Problem:** VMs running email services need correct public PTR records. Cloud providers (Digital Ocean, etc.) control PTR for their IP blocks. One IP = one PTR = one domain's email works, multi-domain email on shared IP is broken. Users don't know it's wrong until email bounces.

**Decision:** Fold into existing extensions. Detection and guidance, not PTR management (we can't control external PTR).

| Feature | Extension | Tier | What It Does |
|---------|--------|------|-------------|
| PTR mismatch detection | DNS Resolver | Weaver | Weaver warns: "VM runs email service but public PTR doesn't match. Here's what to configure with your provider." Health check flags it. |
| SPF/DKIM/DMARC record management | DNS Resolver | Weaver | Zone editor supports email auth records for custom zones. |
| Multi-domain PTR conflict detection | DNS Audit | Fabrick | "3 VMs sending email on 1 public IP. Only 1 PTR possible. Options: dedicated IPs, relay through one mailhost, or use a smarthost." |
| External reverse zone management | DNS Fabrick | Fabrick | For self-hosted users who own their IP block — manage public PTR in our zone editor. |

**Strategic note:** Use cloud providers (DO, etc.) as hosting platform now. Compete with them Q1 2027+ if funded — Weaver as an alternative hosting platform with native PTR/DNS control, not just a management tool on someone else's infra.

---

*Cross-reference: [CLIENT-SECURITY-PLAN.md](../v1.0.0/CLIENT-SECURITY-PLAN.md) | [FIREWALL-TEMPLATE-PLAN.md](../v1.2.0/FIREWALL-TEMPLATE-PLAN.md) | [GIT-FORGE-TEMPLATE-PLAN.md](../GIT-FORGE-TEMPLATE-PLAN.md) | [V2-MULTINODE-PLAN.md](../v2.0.0/V2-MULTINODE-PLAN.md)*
