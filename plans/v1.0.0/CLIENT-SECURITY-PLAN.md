<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Client & User-Facing Security Plan

**Purpose:** Address security gaps that NixOS's unique posture exposes at the client/user level. Complements the 5 existing [Security Audit Domains](SECURITY-AUDIT-DOMAINS.md) which cover infrastructure, supply chain, and org governance.
**Created:** 2026-03-02
**Status:** ALL DECISIONS RESOLVED (2026-03-03)

---

## Why NixOS Changes the Playing Field

NixOS gives us things most platforms don't: immutable `/nix/store`, declarative config, reproducible builds, atomic rollbacks. But it also means:

1. **No nginx by default** — users run bare Fastify. No TLS termination unless they configure it themselves.
2. **Single-host focus** — NixOS module deploys one node. Network isolation is the user's responsibility.
3. **Declarative = auditable** — but only if we expose the right knobs in our NixOS module options.
4. **Target audience is power users** — they expect hardening options, not hand-holding.

---

## Gap Inventory

### Tier: All (affects every deployment)

| # | Area | Current State | Risk | Version Target |
|---|------|---------------|------|----------------|
| A1 | **TLS/HTTPS enforcement** | App doesn't enforce TLS. Tokens sent in plaintext over HTTP. Docs say "configure via nginx" but NixOS users may not. | **HIGH** — credential interception on LAN | v1.0.0 |
| A2 | **NixOS service hardening** | Module sets sudo rules. Missing: `ProtectSystem`, `PrivateTmp`, `NoNewPrivileges`, `CapabilityBoundingSet`, `ReadWritePaths` | **MEDIUM** — relies on NixOS defaults | v1.0.0 |
| A3 | **CSRF documentation** | JSON API + Bearer auth headers mitigate CSRF. Not explicitly documented as a design decision. | **LOW** — mitigated by design | v1.0.0 |
| A4 | **DNS rebinding protection** | Localhost binding default. No `Host` header validation. | **LOW** — mitigated by binding | v1.1.0 |
| A5 | **WebSocket connection limits** | No per-connection DoS protection. Relies on `@fastify/websocket` defaults. | **LOW** — rate limiting applies at HTTP level | v1.1.0 |

### Tier: Weaver+

| # | Area | Current State | Risk | Version Target |
|---|------|---------------|------|----------------|
| P1 | **Password complexity enforcement** | No min-length, no complexity rules, no expiry, no reuse prevention | **MEDIUM** — lockout mitigates brute force but doesn't prevent weak passwords | v1.0.0 |
| P2 | **Per-user rate limiting** | Global 120/min bucket only. One account can exhaust entire limit. | **MEDIUM** — DoS per account | v1.1.0 |
| P3 | **Cloud-init injection prevention** | Template system accepts user YAML. No validation against dangerous directives. | **MEDIUM** — arbitrary code via `runcmd` | v2.0.0 |
| P4 | **Machine-to-machine API keys** | TUI/external tools use Bearer tokens. No service account or long-lived token pattern. | **LOW** — workaround exists | v1.1.0 |

### Tier: Fabrick

| # | Area | Current State | Risk | Version Target |
|---|------|---------------|------|----------------|
| E1 | **MFA/2FA** | Single factor only. No TOTP/FIDO2. | **HIGH** — org admin credential theft | v1.1.0 |
| E2 | **Secret rotation strategy** | JWT secret, hCaptcha key — no rotation path. Compromise = full reset. | **MEDIUM** — manual recovery only | v1.1.0 |
| E3 | **Backup encryption at rest** | Listed in BACKUP-RECOVERY-PLAN as Fabrick (B6). Not designed. | **HIGH** — data confidentiality | v2.0.0 |
| E4 | **Data retention policy** | Audit logs grow unbounded. No pruning, no archival. | **MEDIUM** — compliance gap | v1.1.0 |
| E5 | **Centralized audit logging** | Logs on disk only. Disk loss = audit history gone. | **MEDIUM** — no syslog/Loki integration | v2.0.0 |
| E6 | **Audit log immutability** | SQLite-backed. Root can modify. No WORM. | **LOW** — database-level protection exists | v2.0.0 |
| E7 | **GDPR / privacy policy** | Not documented. Required if EU-accessible. | **HIGH** — legal requirement | v1.0.0 |

### Tier: Organizational (operator responsibility, we provide the tools)

| # | Area | Current State | Risk | Version Target |
|---|------|---------------|------|----------------|
| O1 | **VM escape / hypervisor hardening docs** | Rely on cloud-hypervisor defaults. Zero documentation. | **HIGH** — user has no visibility into isolation guarantees | v1.0.0 |
| O2 | **Incident response runbook** | Only vulnerability reporting process (SECURITY.md). No IR playbook. | **MEDIUM** — no containment guide | v1.1.0 |
| O3 | **Service worker offline data** | PWA caches to localStorage unencrypted. Auth tokens in plaintext. | **LOW** — CSP mitigates XSS vector | v1.1.0 |

---

## Decisions (All Resolved 2026-03-03)

### Decision 1: TLS Enforcement — DECIDED: Tiered

| Tier | Behavior |
|------|----------|
| **Free** | HTTP works. No warning, no TLS code paths. Zero liability — same insurance principle as firewall. |
| **Weaver** | HTTP works but UI shows "unsecured" badge. Setup wizard offers one-click self-signed cert or Let's Encrypt. TLS docs prominent. |
| **Fabrick** | TLS required. First-run generates self-signed cert automatically. Admin can replace with org cert. HTTP → HTTPS redirect. Audit logs all connections. |

Free has no TLS feature = no implied security. Weaver nudges but doesn't promise. Fabrick enforces and audits.

### Decision 2: Password Policy — DECIDED: 14-char minimum, tiered complexity

| Rule | Weaver Free | Weaver | Fabrick |
|------|------|---------|------------|
| Minimum length (14 chars) | Yes | Yes | Yes |
| Password manager recommendation | Yes | Yes | Yes |
| Configurable complexity rules | No | Yes | Yes |
| Enforced expiry policy | No | No | Yes |
| Password history (no reuse) | No | No | Yes |
| Lockout after N failed attempts | No | No | Yes |
| Admin-set minimum per role | No | No | Yes |

14-char pushes users toward passphrases. Password manager recommended in first-run setup and help page (not brand-specific). **1Password partnership** is a business development opportunity (they use Nix internally) — saved as open item.

### Decision 3: GDPR / Privacy — DECIDED: Product scope only + license verification disclosure

**Product (self-hosted):** We collect nothing. No telemetry, no phone-home, no analytics. All data stays on user's machine. Account deletion + data export built in. Fabrick audit log has configurable retention + auto-purge.

**License verification (the one phone-home):**
- Sends: license key, tier, machine identifier, version, timestamp
- Machine ID + timestamp = personal data under GDPR
- Privacy policy in-product must disclose what verification sends, how often, retention
- Air-gapped Fabrick: signed license file with expiry date, renewed out-of-band — no phone-home needed
- Rollback on unpaid: ToS must explicitly state downgrade behavior, user consented at activation
- Data Processing Agreement template available for Fabrick

**Ecommerce/website GDPR is a separate workstream** — different codebase, different legal review, different insurance surface.

### Decision 4: Hypervisor Hardening — DECIDED: Extensions (Fabrick minimum, à la carte at Weaver)

**Base (all tiers, NixOS module):**
- Weaver runs as dedicated `weaver` user
- Strict filesystem permissions (700)
- Systemd sandboxing: `ProtectSystem=strict`, `PrivateTmp=yes`, `NoNewPrivileges=yes`
- VM isolation via cgroup + namespace (microvm.nix inherent)

**Hardening extensions (Fabrick minimum, purchasable at Weaver for home lab learning):**

| Extension | What it does |
|--------|-------------|
| **AppArmor Profiles** | MAC policy for dashboard + VM processes |
| **Seccomp Profiles** | Syscall restriction for dashboard process |
| **Kernel Hardening** | Sysctl lockdowns, dmesg restriction, forwarding control |

**Home lab → corporate pipeline:** Weaver user buys AppArmor extension at home to learn MAC policies → gets comfortable → advocates for Fabrick at work where all extensions are included. Extension model creates skilled advocates who pull Fabrick deals.

### Decision 5: MFA — DECIDED: Auth extensions, TOTP purchasable from Free tier

| Method | Tier Minimum | Extension? |
|--------|-------------|---------|
| **Password only** | Free | No (core) |
| **TOTP** | Free | Yes (Auth extension) — paranoid free user buys $3 extension |
| **FIDO2/WebAuthn** | Weaver | Yes (Auth extension) — YubiKey home-labbers |
| **SSO/SAML** | Fabrick | Yes (Auth extension, included) — org identity provider |
| **LDAP** | Fabrick | Yes (Auth extension, included) — corporate directory |

TOTP as a Free-minimum extension breaks the payment barrier. First transaction, card on file, in the upgrade funnel. FIDO2 at Weaver (not Fabrick) because hardware keys are a personal security choice, not a governance requirement. SSO/LDAP stay Fabrick — org-level integrations.

---

## Implementation Phases

### v1.0.0 (pre-release blockers)

| Item | Effort | Depends On |
|------|--------|------------|
| A1: Built-in TLS support (Option B) | Medium | NixOS module update |
| A2: NixOS service hardening options | Small | NixOS module update |
| A3: CSRF design decision documented | Trivial | None |
| P1: Password complexity (basic: min-length all tiers) | Small | Auth service |
| E7: Privacy policy page (Option A) | Small | HelpPage |
| O1: Hypervisor hardening module options (Option C) | Medium | NixOS module |

### v1.1.0

| Item | Effort | Depends On |
|------|--------|------------|
| E1: MFA/TOTP | Large | Auth service overhaul |
| E2: Secret rotation strategy | Medium | Auth + deployment docs |
| E4: Data retention policy + auto-pruning | Medium | Audit store |
| P2: Per-user rate limiting | Medium | Rate limit middleware |
| P4: Service account / API key pattern | Medium | Auth service |
| O2: Incident response runbook | Small | Docs only |
| A4: DNS rebinding — Host header validation | Small | Fastify middleware |
| A5: WebSocket connection limits | Small | WS config |
| O3: Service worker data protection | Small | PWA config |

### v2.0.0+

| Item | Effort | Depends On |
|------|--------|------------|
| P3: Cloud-init injection prevention | Medium | Template system (v2.0.0) |
| E3: Backup encryption at rest | Large | Backup system (v2.0.0) |
| E5: Centralized audit logging (syslog/Loki) | Medium | Audit store refactor |
| E6: Audit log immutability (WORM) | Large | Storage architecture |

---

## Relationship to Existing Security Work

| Existing Domain | What It Covers | What This Plan Adds |
|-----------------|---------------|---------------------|
| Domain 1: Legal & IP | LICENSE, copyright, AI opt-out | GDPR/privacy policy (E7) |
| Domain 2: Secrets & Access | Hardcoded secrets, workflow permissions | Secret rotation (E2), MFA (E1) |
| Domain 3: Supply Chain | SHA-pinned actions, npm audit | — (covered) |
| Domain 4: Deployment | Helmet, CSP, CORS, error sanitization | TLS enforcement (A1), service hardening (A2) |
| Domain 5: Org Governance | CODEOWNERS, templates, CoC | Incident response (O2) |

---

*Cross-reference: [SECURITY-AUDIT-DOMAINS.md](SECURITY-AUDIT-DOMAINS.md) | [EXECUTION-ROADMAP.md](EXECUTION-ROADMAP.md) | [BACKUP-RECOVERY-PLAN.md](../v2.0.0/BACKUP-RECOVERY-PLAN.md)*
