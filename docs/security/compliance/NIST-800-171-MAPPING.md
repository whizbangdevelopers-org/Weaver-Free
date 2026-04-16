<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

# NIST 800-171 Rev 2 Control Mapping

**Date:** 2026-04-01
**Scope:** Weaver v1.0 — single-host NixOS workload isolation manager (containers + MicroVMs).

> **Disclaimer:** This document maps Weaver's technical controls to NIST 800-171 Rev 2 requirements. It is not a certification claim. Buyers should verify controls against their specific compliance requirements.

## AC — Access Control

| 800-171 ID | Control | Weaver Implementation | Status | Tier |
|-------------|---------|----------------------|--------|------|
| 3.1.1 | Limit system access to authorized users | JWT authentication required for all API routes; first-run admin setup (no default credentials) | Implemented | Free |
| 3.1.2 | Limit system access to authorized functions | RBAC: Admin/Operator/Viewer roles enforced via `requireRole()` middleware on every route | Implemented | Free |
| 3.1.3 | Control CUI flow per authorizations | Tier gating: `requireTier()` middleware restricts features by tier (Free+); per-VM ACLs for workload-level access control (Fabrick) | Implemented | Free (basic), Fabrick (per-VM ACLs) |
| 3.1.5 | Least privilege | Viewer role is read-only; Operator cannot manage users; Admin-only routes for user/role management | Implemented | Free |
| 3.1.7 | Prevent non-privileged users from executing privileged functions | Role checks enforced server-side; frontend guards are UX-only, backend is authoritative | Implemented | Free |
| 3.1.8 | Limit unsuccessful login attempts | Account lockout after 5 failed attempts within 15 minutes; progressive delay at 3+ attempts | Implemented | Free |
| 3.1.10 | Session lock after inactivity | Idle session timeout (15 min, server-side activity tracking); sessions deleted after 15 minutes of no API requests | Implemented | Free |
| 3.1.12 | Monitor and control remote access | All access via authenticated API/WebSocket; rate limiting on all routes | Implemented | Free |
| 3.1.22 | Control CUI on publicly accessible systems | Demo mode uses mock data only; no real workload data exposed; robots.txt + noai meta tags | Implemented | Free |

## AU — Audit and Accountability

| 800-171 ID | Control | Weaver Implementation | Status | Tier |
|-------------|---------|----------------------|--------|------|
| 3.3.1 | Create and retain audit records | Audit log captures: login success/failure, logout, password change, role change, user create/delete, workload actions | Implemented | Free |
| 3.3.2 | Ensure actions are traceable to individual users | Every audit entry includes authenticated user ID, timestamp, action type, and target | Implemented | Free |
| 3.3.4 | Alert on audit process failure | Audit log write failures logged to systemd journal | Implemented | Free |
| 3.3.5 | Correlate audit review/analysis/reporting | Audit log queryable via `GET /api/audit` (Admin/Operator); filterable by event type, user, date range | Implemented | Free |
| 3.3.8 | Protect audit information | Audit log accessible only to Admin/Operator roles; no deletion API exposed | Implemented | Free |

## IA — Identification and Authentication

| 800-171 ID | Control | Weaver Implementation | Status | Tier |
|-------------|---------|----------------------|--------|------|
| 3.5.1 | Identify system users | Unique username per user; first-run setup creates initial admin (no shared accounts) | Implemented | Free |
| 3.5.2 | Authenticate users | JWT-based authentication; bcrypt cost factor 13 (~250ms/hash); constant-time comparison on missing users | Implemented | Free |
| 3.5.3 | Use multifactor authentication | Multi-factor authentication (MFA) | Planned | Solo+ |
| 3.5.7 | Enforce minimum password complexity | 14+ characters; upper + lower + digit + special character required (NIST 800-63B) | Implemented | Free |
| 3.5.8 | Prohibit password reuse | Password change invalidates all sessions | Implemented | Free |
| 3.5.10 | Store and transmit only protected passwords | Passwords stored as bcrypt hashes (cost 13); transmitted only over HTTPS (TLS at nginx) | Implemented | Free (bcrypt), Solo+ (TLS enforcement) |
| 3.5.11 | Obscure authentication feedback | Generic error: "Invalid username or password"; no username existence disclosure | Implemented | Free |

## SC — System and Communications Protection

| 800-171 ID | Control | Weaver Implementation | Status | Tier |
|-------------|---------|----------------------|--------|------|
| 3.13.1 | Monitor/control communications at boundaries | Network topology API; bridge isolation for MicroVMs; firewall rules (Weaver) | Implemented | Solo+ |
| 3.13.5 | Implement subnetworks for CUI components | MicroVM bridge isolation (`br-microvm`); per-VM networking with TAP interfaces | Implemented | Solo+ |
| 3.13.8 | Implement cryptographic mechanisms for CUI in transit | HSTS max-age 31536000 with includeSubDomains; TLS termination at nginx reverse proxy | Implemented (deployer configures TLS) | Solo+ (manual TLS), Team+ (auto-TLS) |
| 3.13.10 | Establish and manage cryptographic keys | Encrypted secret management at rest via sops-nix; JWT signing keys | Planned | Solo+ |
| 3.13.11 | Employ FIPS-validated cryptography | bcrypt for passwords; JWT HS256/RS256; TLS 1.2+ at nginx layer | Deployer Responsibility (FIPS-mode OpenSSL) | Solo+ |
| 3.13.15 | Protect authenticity of communications | CORS: same-origin in production (no wildcard); CSP frame-ancestors 'none'; X-Frame-Options DENY | Implemented | Free |
| 3.13.16 | Protect CUI at rest | Encrypted secret management via sops-nix; NixOS declarative filesystem permissions | Planned | Solo+ |

## SI — System and Information Integrity

| 800-171 ID | Control | Weaver Implementation | Status | Tier |
|-------------|---------|----------------------|--------|------|
| 3.14.1 | Identify and remediate flaws | `npm audit` in CI; SHA-pinned GitHub Actions (44/44); pre-release security audit checklist | Implemented | Free |
| 3.14.2 | Provide protection from malicious code | Zod input validation on all API endpoints; command injection prevention (`execFileAsync`, no `shell: true`) | Implemented | Free |
| 3.14.3 | Monitor security alerts | Dependabot alerts enabled; `npm run test:security` in pre-push hooks | Implemented | Free |
| 3.14.6 | Monitor system security | Health endpoint (`GET /api/health`); systemd service management; WebSocket real-time status | Implemented | Free |
| 3.14.7 | Identify unauthorized use | Audit log captures all auth events; account lockout on repeated failures | Implemented | Free |

## CM — Configuration Management

| 800-171 ID | Control | Weaver Implementation | Status | Tier |
|-------------|---------|----------------------|--------|------|
| 3.4.1 | Establish and maintain baseline configurations | NixOS declarative configuration; git-tracked flake.nix; reproducible builds | Implemented | Free |
| 3.4.2 | Establish and enforce security configuration settings | Security baselines document (NIST 800-63B / OWASP ASVS 4.0); automated `audit:security` threshold checks | Implemented | Free |
| 3.4.5 | Define and enforce access restrictions for change | Git-based change control; pre-commit lint + typecheck hooks; pre-push security audit | Implemented | Free |
| 3.4.6 | Employ least functionality | No default credentials; mock mode auto-activates without API keys; minimal service surface | Implemented | Free |
| 3.4.8 | Apply deny-by-exception (blacklist) policy to prevent use of unauthorized software or deny-all, permit-by-exception (whitelist) policy to allow the execution of authorized software | **Private Nix Cache + Approved Packages .** Attic-based substituter cache with manually-curated allowlist — no software can execute on approved hosts unless the derivation hash is in the approval table. Add-only signing-key rotation + audit log of every approval/revocation. Shed Builder (internal reference) provides custom software ingestion with two-person rule at Team+ for binary drops (separation-of-duties per 3.1.4). | Planned (v2.3.0) | Weaver Team+ |

## MP — Media Protection

| 800-171 ID | Control | Weaver Implementation | Status | Tier |
|-------------|---------|----------------------|--------|------|
| 3.8.1 | Protect CUI on system media | Encrypted secret management at rest on NixOS hosts via sops-nix | Planned | Solo+ |
| 3.8.6 | Implement cryptographic mechanisms for CUI on portable media | NixOS filesystem encryption (deployer responsibility); encrypted secret management for application secrets | Planned / Deployer Responsibility (disk encryption) | Solo+ |

---

**Cross-reference:** [SECURITY-BASELINES.md](../SECURITY-BASELINES.md) for threshold values and standards citations.
