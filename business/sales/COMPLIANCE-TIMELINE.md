<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->

# Compliance Feature Timeline — Sales Reference

**Last updated:** 2026-04-02
**Classification:** Internal — do not share externally. Provide verbal timelines to prospects; do not distribute this document.

## Purpose

When a prospect asks "when will you have MFA?" or "when does encryption at rest ship?", this document provides the version target and approximate date. Use the public compliance mappings (code/docs/security/compliance/) to show what's implemented today; use this document for timeline conversations.

## Planned Compliance Features

| Feature | Public Status | Version Target | Target Date | Standard References | Notes |
|---------|--------------|---------------|-------------|--------------------|----|
| Idle session timeout (15 min, server-side) | Planned | v1.1.0 | 2026-04-25 | NIST 800-171 3.1.10, HIPAA §164.312(a)(2)(iii) | Requires server-side activity tracking |
| Token storage migration (httpOnly cookies) | Planned | v1.1.0 | 2026-04-25 | OWASP ASVS V3.4.5 | Significant refactor from localStorage |
| TOTP MFA (Weaver Solo/Team) | Planned | v1.2.0 | 2026-05-30 | NIST 800-171 3.5.3, HIPAA §164.312(d), PCI DSS 8.4.2, SOC 2 CC6.1 | Decision #96 — bundled in Weaver tier |
| sops-nix encrypted secrets at rest | Planned | v1.2.0 | 2026-05-30 | NIST 800-171 3.13.10/3.13.16/3.8.1, HIPAA §164.312(a)(2)(iv), PCI DSS 3.5.1, SOC 2 CC6.3 | Decision #73 — vault master key provisioned at first-run |
| Impermanence (ephemeral root) | Planned | v1.2.0 | 2026-05-30 | NIST 800-171 SI-7, CIS benchmark | No competitor offers this |
| Lanzaboote (Secure Boot) | Planned | v1.2.0 | 2026-05-30 | CMMC SC.L2-3.13.11, NIST 800-171 | Defense/gov checkbox |
| AI credential vault | Planned | v1.4.0 | 2026-07-11 | NIST 800-171 AC-3, SOC 2 CC6.3 | Decision #73 — SQLCipher encrypted store |

## Talking Points

- "All v1.0 security controls are implemented and enforced today — password policy, JWT sessions, RBAC, audit logging, rate limiting, HSTS, CSP."
- "MFA and encryption at rest are shipping in the next release cycle. Happy to provide a specific timeline under NDA."
- "Our compliance control mappings are published in the product — you can evaluate them in the Free tier right now."
