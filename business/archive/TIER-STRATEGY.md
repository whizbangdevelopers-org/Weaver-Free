<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Feature Tier Strategy

## Guest OS Tiering

### Recommendation: macOS Guests → Premium (not Enterprise)

**Why Premium makes sense:**

- Niche feature — only useful on Apple hardware running Linux (small audience)
- Significant implementation complexity (OpenCore, OSK key, UEFI, macOS-specific QEMU flags) adds maintenance burden
- Parallels Windows guest support — macOS is a step up in specialization
- Premium users are more likely to be power users / homelabbers with this kind of setup

**Why NOT Enterprise:**

- Still a single-user feature, not multi-tenant or organizational
- No RBAC, audit, or compliance implications
- Enterprise tier should be reserved for team/org features: SSO/LDAP, RBAC, audit logging, multi-node management
- Gating a guest OS type behind enterprise feels too restrictive for what is ultimately "QEMU with different flags"

### Proposed Tier Split

| Tier | Guest OS Support |
|------|-----------------|
| Demo | Linux guests (all distros, limited eval) |
| Free | Linux guests (all distros) |
| Premium | + Windows guests, + macOS guests |
| Enterprise | + enterprise features (auth, RBAC, audit) |

### Broader Tier Guidelines

| Tier | Activation | Target User | Feature Characteristics |
|------|-----------|-------------|------------------------|
| Demo | No key (default) | Evaluators | Limited eval mode, no license required |
| Free | License key (registration) | Hobbyists | Core VM management, Linux guests, mock AI mode, community support |
| Premium | License key (purchased) | Power users, homelabbers | Extended guest OS (Windows, macOS), AI diagnostics with BYOK, serial console, curated distro catalog, SQLite sessions |
| Enterprise | License key (purchased/contract) | Teams, organizations | Authentication (SSO/LDAP), RBAC, audit logging, multi-node management, gRPC protocol, all notification adapters, Redis sessions, SLA support |

### Infrastructure Tiering

| Component | Demo | Free | Premium | Enterprise |
|-----------|:----:|:----:|:-------:|:----------:|
| Session storage | In-memory | In-memory | SQLite (persistent) | Redis (shared, multi-node) |
| Push notifications | None | In-app only | BYON (ntfy.sh adapter) | BYON (all adapters: ntfy, Firebase, Gotify, Pushover) |
| Multi-node | Single (1 node) | Single (1 node) | Hub + N nodes via REST+WS (each remote needs own premium key) | N nodes via REST+WS + gRPC (count encoded in single key, 50% volume discount) |
| Agent protocol | REST+WS | REST+WS | REST+WS | REST+WS + gRPC |

> **Guiding principle:** Demo is for evaluation. Free (with registration key) enables adoption tracking. Premium adds power-user features. Enterprise adds team/org governance and infrastructure scale.
