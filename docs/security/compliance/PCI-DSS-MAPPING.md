<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

# PCI DSS v4.0 Control Mapping

**Date:** 2026-04-01
**Scope:** Weaver v1.0 — single-host NixOS workload isolation manager. This mapping covers PCI DSS v4.0 requirements relevant to infrastructure management software. Requirements related to payment processing, cardholder data handling, and physical security are outside Weaver's scope.

> **Disclaimer:** This document maps Weaver's technical controls to PCI DSS v4.0 requirements. It is not a certification claim. Merchants and service providers must verify controls against their specific PCI DSS scope and conduct their own assessments with a QSA.

## Requirement 2 — Apply Secure Configurations

| PCI DSS ID | Requirement | Weaver Implementation | Status | Tier |
|------------|------------|----------------------|--------|------|
| 2.2.1 | Develop configuration standards | NixOS declarative configuration (`flake.nix`); security baselines document (NIST 800-63B / OWASP ASVS 4.0); reproducible builds | Implemented | Free |
| 2.2.2 | Manage vendor default accounts | No default credentials; first-run setup requires creating initial admin account; `setup-required` endpoint detects unconfigured state | Implemented | Free |
| 2.2.5 | Remove unnecessary services/functions | Minimal attack surface: mock mode activates without API keys; NixOS minimal service profile; body limit 1MB | Implemented | Free |
| 2.2.7 | Encrypt non-console administrative access | HSTS enforced; all management via authenticated HTTPS API; WebSocket requires authentication | Implemented (deployer configures TLS) | Solo+ (manual TLS), Team+ (auto-TLS) |

## Requirement 3 — Protect Stored Account Data

| PCI DSS ID | Requirement | Weaver Implementation | Status | Tier |
|------------|------------|----------------------|--------|------|
| 3.5.1 | Protect stored cryptographic keys | Encrypted secret management at rest on NixOS hosts via sops-nix; JWT signing keys in application config | Planned | Solo+ |
| 3.5.1.2 | Restrict access to cryptographic keys | NixOS filesystem permissions; service runs as dedicated user; secrets accessible only by service account | Implemented (NixOS) / Planned | Solo+ |

**Note:** Weaver does not store, process, or transmit cardholder data. These controls apply to Weaver's own secrets (JWT keys, API keys). Cardholder data protection within workloads is the deployer's responsibility.

## Requirement 6 — Develop and Maintain Secure Systems

| PCI DSS ID | Requirement | Weaver Implementation | Status | Tier |
|------------|------------|----------------------|--------|------|
| 6.2.1 | Secure development lifecycle | Pre-commit lint + typecheck; pre-push security audit; 18 static compliance auditors; E2E test suite | Implemented | Free |
| 6.2.3 | Review custom code before release | Pre-release security audit checklist: dependency audit, source scan, git history verification, red team review | Implemented | Free |
| 6.2.4 | Prevent common coding vulnerabilities | Zod input validation on all API endpoints; command injection prevention (`execFileAsync`, no `shell: true`); path traversal defense; error sanitization | Implemented | Free |
| 6.3.1 | Identify security vulnerabilities | `npm audit` in CI pipeline; Dependabot alerts; SHA-pinned GitHub Actions (44/44); `npm run test:security` in pre-push | Implemented | Free |
| 6.3.2 | Maintain inventory of custom software | `package.json` with `engines` field (Node >= 24, npm >= 10); lock files tracked in git; SBOM via npm | Implemented | Free |
| 6.4.1 | Protect public-facing web applications | CSP (script-src no unsafe-inline/eval); CORS same-origin in production; X-Frame-Options DENY; Helmet security headers; rate limiting | Implemented | Free |
| 6.4.2 | Detect and prevent web-based attacks | Zod schema validation rejects malformed input; rate limiting on all routes; body size limit 1MB | Implemented | Free |
| 6.4.5 | Changes to critical software are documented and approved | **Private Nix Cache + Approved Packages (Decision #147).** Every software package installable on hosts requires explicit admin approval via Shed "Approved Packages" catalog. Approval records are append-only in SQLite with uploader identity, approver identity, timestamp, attestation metadata (declared origin, scan results, risk acknowledgment). Add-only signing-key rotation provides audit-integrity for the approval chain. Shed Builder (Decision #149) with two-person rule at Team+ for binary drops satisfies separation-of-duties expected in PCI DSS change-management workflows. | Planned (v2.3.0) | Weaver Team+ |

## Requirement 11 — Test Security of Systems and Networks Regularly

| PCI DSS ID | Requirement | Weaver Implementation | Status | Tier |
|------------|------------|----------------------|--------|------|
| 11.5.1 | Deploy change-detection mechanism to alert personnel to unauthorized modification of critical files | **Private Nix Cache + Approved Packages (Decision #147).** Signed approved-package cache + add-only key rotation provides file-integrity monitoring for software installed on in-scope systems. Any derivation not matching an approved signed hash is rejected at install time — equivalent to FIM alerting on unauthorized changes, but preventive rather than detective. Git-based declarative config provides change-detection for host configuration; `cache.build` / `cache.fetch` audit events record every software-install event. | Planned (v2.3.0) | Weaver Team+ |

## Requirement 7 — Restrict Access by Business Need to Know

| PCI DSS ID | Requirement | Weaver Implementation | Status | Tier |
|------------|------------|----------------------|--------|------|
| 7.2.1 | Access control model defined | Three roles: Admin (full), Operator (workload management), Viewer (read-only); documented in DEVELOPER-GUIDE | Implemented | Free |
| 7.2.2 | Access assigned based on job function | `requireRole()` middleware enforces role on every route; per-VM ACLs for fine-grained access (Fabrick) | Implemented | Free (RBAC), Fabrick (per-VM ACLs) |
| 7.2.5 | Access rights reviewed periodically | User management UI (`GET /api/users`); Admin can view/modify all user roles | Implemented (tooling provided; review schedule is deployer responsibility) | Free |

## Requirement 8 — Identify Users and Authenticate Access

| PCI DSS ID | Requirement | Weaver Implementation | Status | Tier |
|------------|------------|----------------------|--------|------|
| 8.2.1 | Unique ID for each user | Unique username required; no shared accounts; user ID in all audit entries | Implemented | Free |
| 8.2.2 | Shared/group accounts prohibited | First-run setup creates named admin; no anonymous or shared access paths | Implemented | Free |
| 8.3.1 | Authenticate all user access | JWT required for all API and WebSocket connections; no unauthenticated routes except health and setup-required | Implemented | Free |
| 8.3.4 | Limit repeated access attempts | Account lockout after 5 failures within 15 minutes; progressive delay at 3+ attempts | Implemented | Free |
| 8.3.6 | Minimum password complexity | 14+ characters; upper + lower + digit + special character (exceeds PCI DSS 12-char minimum) | Implemented | Free |
| 8.3.9 | Passwords changed at least every 90 days | Password change API available; enforced expiry is deployer policy | Deployer Responsibility | Free |
| 8.4.2 | MFA for access to CDE | Multi-factor authentication (MFA) | Planned | Solo+ |
| 8.6.1 | System/service account management | NixOS dedicated service user; minimal filesystem permissions; no interactive login | Implemented | Free |

## Requirement 10 — Log and Monitor All Access

| PCI DSS ID | Requirement | Weaver Implementation | Status | Tier |
|------------|------------|----------------------|--------|------|
| 10.2.1 | Audit logs capture access events | All auth events logged: login success/failure, logout, password change, role change, user create/delete | Implemented | Free |
| 10.2.1.2 | Log all actions by admin accounts | All API actions audited regardless of role; admin actions explicitly logged | Implemented | Free |
| 10.2.1.5 | Log all changes to authentication mechanisms | Password changes, role changes, user creation/deletion logged with user ID and timestamp | Implemented | Free |
| 10.2.2 | Log fields include required data | Timestamp, user ID, event type, target resource, source context | Implemented | Free |
| 10.3.1 | Protect audit logs from modification | No audit log delete/modify API; logs accessible read-only to Admin/Operator | Implemented | Free |
| 10.4.1 | Review logs at least daily | Audit log queryable via API with filtering; automated alerting is deployer responsibility | Implemented (query tool) / Deployer Responsibility (review schedule) | Free |

---

**Cross-reference:** [SECURITY-BASELINES.md](../SECURITY-BASELINES.md) for threshold values and standards citations.
