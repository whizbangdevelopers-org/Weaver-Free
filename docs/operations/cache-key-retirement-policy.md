<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

---
policy: cache-key-retirement
status: draft
version_target: v2.3.0
audience: customer-operator
effective_date: "2026-04-15"
review_cadence: annually
decision_refs: ["#147"]
compliance_refs:
  - framework: NIST 800-53
    controls: ["SC-12", "SC-17"]
  - framework: NIST 800-171
    controls: ["3.13.10"]
  - framework: HIPAA 164.312
    controls: ["(a)(2)(iv)"]
  - framework: PCI DSS v4.0
    controls: ["3.6", "3.7"]
  - framework: SOC 2
    controls: ["CC6.1", "CC6.3"]
  - framework: CIS Controls v8.1
    controls: ["3.11"]
config_keys_referenced:
  - services.weaver.cache.signingKey.rotation.policy
  - services.weaver.cache.signingKey.rotation.interval
---

# Policy: Private Nix Cache Signing Key Retirement

> **⚠ DRAFT — v2.3 feature.** This policy documents customer responsibilities and recommended procedures for routine retirement of Private Nix Cache signing keys. The v2.3 Private Nix Cache feature (Decision #147) is planned for v2.3.0 and NOT YET IMPLEMENTED. This policy will be rehearsed against the v2.3 automation layer (v2.4 scheduled rotation per the foundation-early prep model) before taking effect.

---

## 1. Purpose

This document establishes the **recommended policy** for routine retirement of cache signing keys used by the Weaver Private Nix Cache (Decision #147). It distinguishes **routine retirement** (this policy) from **compromise response** (see `cache-key-compromise-runbook.md`), explains the add-only rotation model's trade-offs, and defines customer vs WBD responsibilities.

**This is a recommendation, not a contractual obligation.** Weaver's add-only signing-key model allows keys to be rotated routinely or left in place indefinitely — the product mechanics do not enforce any particular retirement cadence. This policy exists so that compliance-vertical customers have a defensible "we have a documented key retirement policy" answer during audit.

---

## 2. Audience

**This policy is for:**

- **Weaver Solo/Team administrators** responsible for host cache configuration
- **Compliance officers** evaluating Weaver against NIST SP 800-57, HIPAA §164.312(a)(2)(iv), PCI DSS 3.6–3.7, SOC 2 CC6.3, CIS Controls 3.11
- **Auditors** reviewing customer deployments of Weaver

**This policy is NOT for:**

- WBD as a company — WBD does not rotate or retire customer signing keys. That's a customer responsibility by design (self-hosted, no phone-home, no key escrow).
- The compromise response scenario — see the compromise runbook, not this policy.

---

## 3. Background — Add-Only Rotation Model

Weaver's Private Nix Cache uses an **add-only signing-key trust list** (Decision #147). Here's what that means operationally:

- Each rotation generates a new `ed25519` signing key. The new key is added to `nix.settings.trusted-public-keys` on all hosts that pull from the cache.
- The old key **stays in the trust list**. Cached objects signed by the old key remain verifiable indefinitely.
- No re-signing is required at rotation — "rotation" is just a signer change, not a trust change.
- Over time, the trust list grows: 1 key at v2.3 ship, 2 keys after the first rotation, N+1 keys after N rotations.

**Why this design (Decision #147 investigation, 2026-04-14):**

- Re-signing a large cache is a multi-hour operation. Forcing re-sign on every rotation would make routine rotation prohibitively expensive and would incentivize customers to skip rotation entirely.
- Upgrade migrations (v2.3 → v2.4 fleet-scope expansion → v2.6 storage pool reconfig) would require re-signing every object at each upgrade, destroying cache warmth and breaking audit history continuity.
- The add-only model eliminates re-sign as a routine requirement and preserves audit integrity across the full cache lifetime.

**The trade-off:**

- Trust list grows over time. At 10 rotations, your hosts trust 10 historical keys. 
- Any compromised historical key can still sign objects unless explicitly retired. 
- Retirement requires re-signing any objects signed by the retired key — which is exactly the expensive operation we avoided at rotation time.

**The policy question this document addresses:** given the trade-off, how often should customers retire old keys? When is retirement worth the cost?

---

## 4. Recommended Cadence

### 4.1 — WBD default recommendation

**Retire keys older than 2 rotation cycles, on a routine schedule aligned to your regulatory framework.**

Concretely:

- **Minimum recommended rotation interval:** 12 months (annually)
- **Minimum recommended retirement interval:** 24 months (rotate annually, retire the key that's 2 rotations old)
- **Trust list steady state:** 2 active keys (current + previous), plus however many pending retirement

At 12/24-month cadence, an organization's trust list contains exactly 2 keys in steady state. That matches NIST SP 800-57 recommendations for ed25519 cryptoperiod (1–2 year operational use, effective retirement after the cryptoperiod ends).

### 4.2 — Framework-specific guidance

Some compliance frameworks prescribe stricter retirement cadence:

| Framework | Control | Recommended cadence | Notes |
|---|---|---|---|
| NIST 800-53 SC-12 | Cryptographic Key Establishment and Management | Per cryptoperiod in NIST SP 800-57; typically 1–2 years for ed25519 | Align rotation schedule with organizational key management policy |
| NIST 800-171 3.13.10 | Establish and manage cryptographic keys | Cite SP 800-57; document cadence in customer's system security plan | Key management is customer responsibility |
| HIPAA §164.312(a)(2)(iv) | Encryption and Decryption | No prescribed interval, but "reasonable and appropriate" per risk assessment. Annually is the typical industry default. | Document rationale in customer's risk analysis |
| PCI DSS 3.6–3.7 | Cryptographic Key Management | Minimum annually for secret/private key retirement; document in the organization's key management policy | PCI is explicit: "at least once annually" |
| SOC 2 CC6.3 | Protect Cryptographic Keys | No prescribed interval; auditor will look for documented cadence + evidence of adherence | Document the cadence in the SOC 2 control description |
| CIS Controls v8.1 Safeguard 3.11 | Encrypt Sensitive Data at Rest | References NIST SP 800-57 key management | Defer to SP 800-57 guidance |
| CMMC Level 2 | 800-171 inheritance | Inherits 3.13.10 | Same as NIST 800-171 |

**The common denominator:** annually. An organization rotating on a 12-month cycle and retiring on a 24-month cycle satisfies PCI DSS explicitly and every other framework's "reasonable and appropriate" test.

### 4.3 — When to deviate from the default

**Shorter cadence (rotate more often than 12 months):**

- Your threat model includes a high risk of insider compromise
- Regulatory requirement mandates quarterly rotation (rare)
- Compliance audit finding requires a tighter cycle
- Post-incident follow-up after a compromise response

**Longer cadence (rotate less often than 12 months):**

- Small deployment (single Weaver Solo host, low object count)
- Documented risk acceptance from your compliance officer
- Regulatory framework that allows longer cryptoperiods (few do for signing keys)

Any deviation from the 12/24-month default should be documented in your key management policy with justification.

---

## 5. Customer Responsibility

**WBD does not rotate or retire customer cache signing keys.** The Weaver software provides the *mechanism* for rotation and retirement; the customer is responsible for the *policy*.

Specifically:

| Action | Responsibility | How |
|---|---|---|
| Generate initial signing key | WBD (first-run) | Automatic during v2.3 cache provisioning |
| Rotate signing key (routine) | **Customer** | Manual: Shed UI button (v2.3) · Automated: NixOS option `services.weaver.cache.signingKey.rotation.policy = "scheduled"` with `interval = "365d"` (v2.4+) |
| Retire old signing key | **Customer** | Shed UI (v2.4) or `POST /api/cache/keys/:id/retire` with re-sign preflight |
| Rotate on compromise | **Customer** | Follow the compromise runbook — this is incident response, not routine |
| Store retired public keys | **Customer** | Retained in `cache_signing_keys` table; `retired_at` and `retire_reason` fields populated |
| Store retired private keys | **N/A** | Retired private keys are **physically deleted from sops-nix** on retirement — neither WBD nor the customer retains them |
| Document rotation policy for audit | **Customer** | This policy doc is a template; customize for your organization |
| Rehearse compromise response | **Customer (recommended annually)** | Follow the compromise runbook against a dev cache |

---

## 6. Retired-Key Storage

**Retired private keys are physically deleted from sops-nix at retirement.** This is intentional per Decision #147 — eliminates the "sops recipient separation" concern (there's nothing to compromise in the sops file for a retired key).

Retained about each retired key:

- Public key material (still in `cache_signing_keys.public_key`)
- `created_at` timestamp
- `retired_at` timestamp
- `retire_reason` (`rotation` | `compromise`)
- The public key remains in `/etc/nix/nix.conf` `trusted-public-keys` until explicit removal

NOT retained:

- Private key material (deleted from sops-nix on retirement)

**Implication for audit evidence:** after retirement, you can *verify* that a historical object was signed by a specific retired key (using the retained public key), but you cannot *produce new signatures* with the retired key. This is the correct audit posture — signatures are verifiable forever, but replay attacks are impossible after retirement.

---

## 7. Rotation vs Retirement — Quick Decision Guide

Use this guide to decide whether a given event calls for rotation, retirement, or both:

| Event | Action |
|---|---|
| Annual rotation schedule reached | Rotate (new key, old key stays trusted) |
| Former admin retained key material | Treat as compromise — rotate + retire via compromise runbook |
| Old key is 2+ rotations ago | Retire (removes from trust list, deletes sops private material) |
| Upgrading v2.3 → v2.4 | Neither — upgrade doesn't trigger rotation or retirement |
| Compromise detected | Rotate + atomic re-sign + retire (compromise runbook) |
| Re-signing all historical objects for some reason | Use the compromise runbook's atomic re-sign flow; then optionally retire the old key |

---

## 8. Compliance Evidence Trail

For audit purposes, customers should maintain the following evidence of adherence to their documented retirement policy:

1. **This policy document** (customized with your organization's cadence and framework citations)
2. **Rotation schedule** (calendar entries, systemd timer state if automated)
3. **Rotation history** (`GET /api/audit?type=cache.key.rotate`)
4. **Retirement history** (`GET /api/audit?type=cache.key.retire`)
5. **Current trust list state** (`GET /api/cache/keys`) — snapshot at audit time
6. **Cache health metrics** (`GET /api/cache/health`) — days-since-last-rotation, trust list size
7. **Policy review history** — annual review signatures on this document

---

## 9. Automation (v2.4 Scheduled Rotation)

At v2.4, scheduled rotation becomes available via NixOS module option:

```nix
services.weaver.cache.signingKey.rotation = {
  policy = "scheduled";  # "manual" (default at v2.3) | "scheduled"
  interval = "365d";      # Recommended default per this policy
};
```

When `policy = "scheduled"`, a systemd timer fires every `interval` and calls the same rotation API the Shed button would call. The customer still retains responsibility for *retirement* — scheduled rotation does not automatically retire the previous key.

**For v2.4 deployments:** enable scheduled rotation at the default interval, then add a calendar reminder to retire old keys annually on the anniversary of their rotation-plus-24-months.

---

## 10. Revision History

| Date | Change | Author |
|---|---|---|
| 2026-04-15 | Initial draft — policy recommendations drawn from Decision #147, NIST SP 800-57, and framework surveys | Claude (session 2026-04-14/15) |

When v2.3 ships and this policy is validated against real automation, the DRAFT banner is removed and this revision history gains an entry.
