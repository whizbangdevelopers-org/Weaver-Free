<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Declarative Firewall Templates Plan

**Purpose:** Design a per-VM declarative firewall system that leverages NixOS's structural advantages over imperative competitors (Proxmox, ESXi). This is a Pegaprox differentiator, not just feature parity.
**Created:** 2026-03-02
**Status:** ALL DECISIONS RESOLVED (2026-03-03)
**Depends On:** NixOS module (`nixos/default.nix`), VM provisioning system, MicroVM Factory architecture

---

## Competitive Positioning

### Why This Matters

Proxmox ships the strongest firewall story in the homelab/SMB space: three-level rules (datacenter → host → VM), GUI editor, IP sets, security groups, macros. But it's fundamentally imperative — click, save, hope it's right. No version control, no rollback, no audit trail.

NixOS lets us leapfrog: every firewall rule is declarative Nix — version-controlled, diffable, atomic, rollbackable. Bad rule? `nixos-rebuild switch --rollback`. This is a structural advantage the competition cannot replicate without rebuilding their entire config model.

### Moat Analysis

| Dimension | Proxmox | Weaver |
|-----------|---------|-------------------|
| Rule storage | Config files on host | Nix expressions (git-tracked) |
| Apply model | Imperative (mutate in-place) | Declarative (atomic rebuild) |
| Rollback | Manual (hope you remember) | `--rollback` (automatic) |
| Audit trail | None built-in | Git log IS the audit trail |
| Multi-host consistency | Manual sync | Same flake applied everywhere |
| Drift detection | None | Declared state vs `nft list ruleset` |
| Preset library | Macros (flat list) | Composable Nix module profiles |
| Testing | Manual port checks | E2E: provision VM, apply rules, verify reachability |

---

## Architecture

### Three Filtering Layers

```
Layer 1: Host firewall (nftables inet family)
  └── Protects the dashboard service itself (port 3100, API, WebSocket)

Layer 2: Bridge firewall (nftables bridge family)
  └── Filters traffic between VMs on the same bridge
  └── Zone isolation (e.g., br-mgmt cannot reach br-app directly)

Layer 3: Per-VM firewall (nftables per-tap rules)
  └── Ingress/egress rules on the VM's tap interface
  └── Profile-based or custom rules
```

### NixOS Module Schema (proposed)

```nix
services.weaver = {
  # Layer 1: Host-level (already partially exists via NixOS networking.firewall)
  firewall.host = {
    allowedTCPPorts = [ 3100 ];  # Weaver API
    allowedWebSocketPorts = [ 3100 ];  # WS status stream
  };

  # Layer 2: Bridge-level zone isolation
  firewall.zones = {
    management = {
      bridge = "br-mgmt";
      allowedSources = [ "10.10.0.0/24" ];
      isolateFromZones = [ "application" ];  # No cross-zone by default
    };
    application = {
      bridge = "br-app";
      allowedSources = [ "10.20.0.0/24" ];
    };
  };

  # Layer 3: Per-VM rules
  vms.web-nginx = {
    firewall.profile = "web-server";  # Preset: 80, 443 in; deny all else
    firewall.extraRules = [
      { port = 8080; proto = "tcp"; from = "10.10.0.0/24"; action = "accept"; }
    ];
    firewall.egress = "allow-all";  # or "deny-all" + explicit allowlist
  };

  vms.svc-postgres = {
    firewall.profile = "database";  # Preset: 5432 from same zone only
    firewall.extraRules = [];
    firewall.egress = "deny-all";
    firewall.egressAllow = [
      { host = "10.10.0.10"; port = 443; comment = "apt updates via proxy"; }
    ];
  };
};
```

### Preset Profiles

Composable Nix modules. Each profile defines sane defaults that can be extended with `extraRules`.

| Profile | Ingress | Egress | Use Case |
|---------|---------|--------|----------|
| `locked-down` | Deny all | Deny all | Base — add explicit rules only |
| `web-server` | 80, 443 | Allow all | Nginx, Caddy, static sites |
| `database` | DB port from same zone | Deny all (+ explicit) | PostgreSQL, MySQL, Redis |
| `dev` | SSH (22), app port | Allow all | Development VMs |
| `monitoring` | Prometheus (9090), Grafana (3000) | Allow all | Observability stack |
| `custom` | No preset rules | No preset rules | Blank slate for power users |

Profiles are **additive**: `profile = "web-server"` + `extraRules = [...]` merges both rulesets.

---

## Tier Gating (Revised 2026-03-03)

**Insurance principle:** Free tier = zero firewall features, zero liability exposure. No scanning, no display, no modification of existing VMs. The firewall feature simply doesn't exist at free tier.

| Capability | Weaver Free | Weaver | Fabrick |
|------------|------|---------|------------|
| Firewall feature existence | **No** | Yes | Yes |
| Scan/display VM firewall status | **No** | Yes | Yes |
| Preset profiles (apply by name) | No | Yes | Yes |
| Per-VM custom rules (extension) | No | Extension | Extension (included) |
| Egress control (extension) | No | Extension | Extension (included) |
| Cross-VM security groups | No | Yes | Yes |
| Zone isolation — bridge-level (extension) | No | No | Extension (included) |
| Drift detection (extension) | No | No | Extension (included) |
| Firewall audit log (extension) | No | No | Extension (included) |
| Rule change history | N/A | Nix/git | Nix/git |
| Weaver firewall UI | N/A | Full editor | Full + bulk ops |

**Free tier:** "Firewall Management — Available with Weaver" in nav/feature list. No scanning, no display, no implied security posture. Zero liability, zero insurance exposure.

**Weaver pitch:** "Weaver secures every VM you provision with preset firewall profiles. Custom rules and egress control available as extensions."

**Fabrick pitch:** "All firewall extensions included: zones, drift detection, audit logging. Policy-grade network security."

---

## Implementation Layers

### Layer 1: nftables Rule Generation (Backend)

Nix module → nftables ruleset compiler:
- Input: VM definitions with firewall options from NixOS module evaluation
- Output: nftables rules applied to tap interfaces and bridges
- Pattern: similar to NixOS `networking.firewall` but scoped to microvm tap devices

### Layer 2: Weaver API

| Method | Endpoint | Description | Tier |
|--------|----------|-------------|------|
| GET | `/api/vms/:name/firewall` | Get active rules for VM | Free |
| PUT | `/api/vms/:name/firewall` | Update rules (applies on next rebuild) | Weaver |
| GET | `/api/firewall/profiles` | List available preset profiles | Free |
| GET | `/api/firewall/drift` | Compare declared vs actual rules | Fabrick |
| GET | `/api/firewall/zones` | List zone definitions and membership | Fabrick |

### Layer 3: Weaver UI

- **VM Detail Page → Firewall tab**: Shows active profile, current rules, ingress/egress summary
- **Free**: Read-only view of active preset
- **Weaver**: Inline rule editor (add/remove/reorder)
- **Fabrick**: Zone visualizer, drift indicator, audit log integration

### Layer 4: TUI

- `microvm firewall show <vm>` — current rules
- `microvm firewall set-profile <vm> <profile>` — apply preset
- `microvm firewall add-rule <vm> ...` — custom rule (Weaver+)
- `microvm firewall drift` — drift report (Fabrick)

---

## Drift Detection (Fabrick)

```
Declared state (Nix evaluation) → expected nftables ruleset
Actual state (nft list ruleset) → current nftables ruleset
Diff → drift report
```

Drift can happen if:
- Someone runs `nft add rule` manually (bypassing Nix)
- A NixOS rebuild failed partway through
- A VM's tap interface didn't get its rules applied

The drift detector runs as:
1. **On-demand**: `npm run audit:firewall-drift` / API endpoint / TUI command
2. **Scheduled**: Optional systemd timer (enterprise config option)
3. **Weaver indicator**: Green (clean) / Yellow (drift detected) / Red (rules missing)

---

## Forge Template Extraction

This pattern generalizes to any product that manages VMs/containers on NixOS:

| Template Component | Location | Reusable? |
|--------------------|----------|-----------|
| NixOS firewall module schema (`firewall.profile`, `extraRules`, `zones`) | `quasar-project-template/nixos/firewall/` | Yes — any VM management product |
| Preset profile library (Nix modules) | `quasar-project-template/nixos/firewall/profiles/` | Yes — composable, product-agnostic |
| nftables rule compiler (Nix → ruleset) | `quasar-project-template/nixos/firewall/nftables.nix` | Yes — generic Nix→nft |
| Drift detection script | `quasar-project-template/scripts/audit-firewall-drift.ts` | Yes — pattern: declared vs actual |
| E2E test pattern (provision, apply, verify reachability) | `quasar-project-template/testing/e2e/firewall.spec.ts` | Yes — template for port-check tests |
| API route pattern (GET/PUT firewall per resource) | `quasar-project-template/backend/routes/firewall.ts` | Yes — CRUD + drift endpoint |

---

## Decisions (All Resolved 2026-03-03)

### Decision 1: Default Egress Policy — DECIDED: Profile-dependent

Each preset defines the egress posture that makes sense for its use case. `web-server` = allow-all egress, `database` = deny-all egress. Custom profile starts deny-all. Users override per-VM with explicit allowlists.

### Decision 2: Rule Application Model — DECIDED: Hybrid factory-aware

**Insurance-driven revision:** Free tier has zero firewall features (no scanning, no display, no modification). No liability exposure for unpaid users.

| Tier | Behavior |
|------|----------|
| **Free** | No firewall features. Feature listed as Weaver in UI. Zero code paths. Zero insurance exposure. |
| **Weaver** | Factory bakes preset profiles into new VM images. Hot-apply via `nft` for immediate changes on provisioned VMs. Nix config updated, next factory deploy reconciles. |
| **Fabrick** | Same + drift detection (factory-declared state vs runtime `nft list ruleset`), audit log, zone policies via extensions. |

Leverages the MicroVM Factory architecture: factory evaluates + builds once, pushes to binary cache, hosts pull pre-built images by content hash, swap symlinks. No `nixos-rebuild switch` on hosts.

### Decision 3: Bridge Filtering Implementation — DECIDED: nftables bridge family

- Per-VM tap rules (nftables `inet` family) at Weaver — controls what enters/leaves each VM
- Bridge filtering (nftables `bridge` family) at Fabrick (Zones extension) — VM-to-VM microsegmentation
- Bridge filtering implies network-wide security policy claims → requires audit trail to back it up → Fabrick only

### Decision 4: Version Target — DECIDED: v1.2.0

Firewall ships at v1.2.0, after DNS (v1.1.0) establishes the plugin infrastructure via `requirePlugin()`. Plugin categories:

| Extension | Tier Minimum | v1.2.0 |
|--------|-------------|--------|
| Preset Profiles | Weaver (core) | Yes |
| Custom Rules | Weaver (extension) | Yes |
| Egress Control | Weaver (extension) | Yes |
| Zones | Fabrick (extension, included) | Yes |
| Drift Detection | Fabrick (extension, included) | Yes |
| Firewall Audit | Fabrick (extension, included) | Yes |

---

## Testing Strategy

| Layer | Test Type | How |
|-------|-----------|-----|
| Nix module evaluation | Unit | `nix eval` — module produces expected nftables rules |
| nftables rule generation | Unit | TypeScript: input VM config → expected rule string |
| Profile composition | Unit | Profile A + extraRules = merged ruleset |
| API endpoints | Backend | Vitest: CRUD firewall rules, tier gating |
| Drift detection | Integration | Apply rules via nft, compare to declared, verify diff |
| Port reachability | E2E (live) | Provision VM, apply profile, `nc -z` from host to verify open/closed ports |
| UI rule editor | E2E (Docker) | Playwright: view rules, add rule (weaver), verify tier gate (free) |

---

## Open Questions

1. **Interaction with cloud-init**: If a VM's cloud-init configures its own internal firewall (e.g., `ufw`), how do we document the relationship between host-level nftables and guest-level firewall?
2. **IPv6**: Do we support IPv6 filtering from day one, or IPv4 only initially?
3. **Logging**: nftables can log matched packets. Do we expose this as a feature (fabrick), and where do logs go?
4. **Rate limiting at nftables level**: nftables supports per-rule rate limiting (e.g., SYN flood protection). Is this a preset profile option or a custom rule?

---

*Cross-reference: [CLIENT-SECURITY-PLAN.md](../v1.0.0/CLIENT-SECURITY-PLAN.md) | [EXECUTION-ROADMAP.md](../v1.2.0/EXECUTION-ROADMAP.md) | [DISK-PROVISIONING-PLAN.md](../v2.0.0/DISK-PROVISIONING-PLAN.md) | [IMPLEMENTATION-PHASING-PLAN.md](../v2.0.0/IMPLEMENTATION-PHASING-PLAN.md)*
