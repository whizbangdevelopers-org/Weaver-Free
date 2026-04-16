<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

# SOC 2 Trust Service Criteria Readiness Mapping

**Date:** 2026-04-01
**Scope:** Weaver v1.0 — single-host NixOS workload isolation manager. This is a readiness mapping, not a SOC 2 report. These controls address Trust Service Criteria (TSC). A SOC 2 Type II audit would verify their operating effectiveness over a review period.

> **Disclaimer:** This document maps Weaver's technical controls to AICPA SOC 2 Trust Service Criteria. It is not a SOC 2 Type I or Type II report. Organizations seeking SOC 2 attestation must engage a licensed CPA firm to perform the audit. This mapping serves as preparation material.

## CC6 — Security (Common Criteria)

### CC6.1 — Logical Access Security

| TSC Point | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| CC6.1.1 | Identify and authenticate users | JWT authentication; bcrypt (cost 13); unique usernames; first-run admin setup (no defaults) | Implemented | Free |
| CC6.1.2 | Manage credentials | 14+ char passwords with complexity; multi-factor authentication (MFA); account lockout (5 attempts / 15 min) | Implemented (passwords) / Planned | Free (passwords, lockout), Solo+ (MFA) |
| CC6.1.3 | Role-based access | Admin/Operator/Viewer roles; `requireRole()` middleware on every route; per-VM ACLs (Fabrick) | Implemented | Free (RBAC), Fabrick (per-VM ACLs) |
| CC6.1.4 | Restrict physical access | NixOS host: deployer responsibility; Weaver runs as dedicated service user with minimal filesystem permissions | Deployer Responsibility | Free |
| CC6.1.5 | Remove access when no longer needed | User deletion API (`DELETE /api/users/:id`); password change invalidates all sessions | Implemented | Free |

### CC6.2 — System Access Authorization

| TSC Point | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| CC6.2.1 | Authorization prior to access | No anonymous access; all routes require JWT except health and setup-required | Implemented | Free |
| CC6.2.2 | Least privilege | Viewer: read-only; Operator: workload management; Admin: full control including user management | Implemented | Free |
| CC6.2.3 | Review access periodically | User list API for admin review; audit log tracks all role changes | Implemented (tooling) / Deployer Responsibility (review cadence) | Free |

### CC6.3 — Encryption and Key Management

| TSC Point | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| CC6.3.1 | Encrypt data in transit | HSTS max-age 31536000; TLS at nginx; CSP; CORS same-origin in production | Implemented (deployer configures TLS) | Solo+ (manual TLS), Team+ (auto-TLS) |
| CC6.3.2 | Encrypt data at rest | Encrypted secret management for application secrets via sops-nix; NixOS disk encryption (deployer) | Planned / Deployer Responsibility (disk) | Solo+ |
| CC6.3.3 | Protect cryptographic keys | NixOS filesystem permissions; dedicated service user; encrypted key management via sops-nix | Planned | Solo+ |

### CC6.6 — System Boundary Protection

| TSC Point | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| CC6.6.1 | Restrict external access | NixOS firewall default-deny; rate limiting on all Weaver API routes; body size limit 1MB | Implemented | Free |
| CC6.6.2 | Protect against malicious inputs | Zod schema validation on all API inputs; command injection prevention; path traversal defense; error sanitization | Implemented | Free |
| CC6.6.3 | Monitor boundaries | Health endpoint; WebSocket real-time status; audit log for all access events | Implemented | Free |

### CC6.8 — Prevention of Unauthorized or Malicious Software + Vulnerability Management

**Canonical TSC text (AICPA 2017):** *"The entity implements controls to prevent or detect and act upon the introduction of unauthorized or malicious software to meet the entity's objectives."*

| TSC Point | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| CC6.8.1 | Assess vulnerabilities | `npm audit` in CI; SHA-pinned GitHub Actions (44/44); pre-release security audit checklist; SAST auditor | Implemented | Free |
| CC6.8.2 | Remediate vulnerabilities | Dependabot alerts; pre-push `test:security` hook; known vulns tracked with disposition (SECURITY-AUDIT.md) | Implemented | Free |
| CC6.8.3 | Test security controls | 18 static compliance auditors; E2E test suite; route auth coverage auditor (68 routes) | Implemented | Free |
| CC6.8.4 | Prevent introduction of unauthorized or malicious software | **Private Nix Cache + Approved Packages (Decision #147).** Attic-based substituter cache with manually-curated allowlist — deny-all-permit-by-exception software execution policy. Every derivation hash must be explicitly approved by an admin before any software can install on approved hosts. Add-only signing-key rotation with tamper-evident approval audit log. Shed Builder (Decision #149) custom software ingestion with two-person rule at Team+ for binary drops prevents single-person introduction of unauthorized software (separation-of-duties). v3.1 automated approval pipeline adds CVE scan + SBOM + license + signature verification. Direct implementation of the canonical CC6.8 text above. | Planned (v2.3.0) | Weaver Team+ |

## A1 — Availability

| TSC Point | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| A1.1 | Maintain availability commitments | Health endpoint (`GET /api/health`); systemd service with auto-restart; NixOS atomic rollback on failed updates | Implemented | Free |
| A1.2 | Environmental protections | NixOS declarative config ensures reproducible deployments; infrastructure as code | Implemented (software) / Deployer Responsibility (hardware) | Free |
| A1.3 | Backup and recovery | NixOS configuration is git-tracked (full rebuild from source); `fresh-install` script for clean-slate recovery; emergency admin password reset | Implemented (config recovery) / Deployer Responsibility (data backup) | Free |

## PI1 — Processing Integrity

| TSC Point | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| PI1.1 | Process data completely and accurately | Zod schema validation on all inputs; typed API responses; WebSocket broadcasts validated state | Implemented | Free |
| PI1.2 | Detect and correct processing errors | Error sanitization: raw system errors logged server-side, user-safe messages returned to clients; health monitoring | Implemented | Free |
| PI1.3 | Input validation | Zod schemas on all request bodies, params, and query strings; VM name regex `^[a-z][a-z0-9-]*$`; path traversal prevention | Implemented | Free |
| PI1.4 | Output completeness | Typed API response schemas; Zod response validation (Fastify validates all status codes including errors) | Implemented | Free |

## C1 — Confidentiality

| TSC Point | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| C1.1 | Identify confidential information | Tier gating separates feature access; Weaver/Fabrick features require `requireTier()` middleware | Implemented | Free |
| C1.2 | Protect confidential information | RBAC prevents unauthorized access; error sanitization prevents information leakage (no internal paths in responses) | Implemented | Free |
| C1.3 | Dispose of confidential information | User deletion removes account data; workload deletion removes VM configuration | Implemented | Free |
| C1.4 | Restrict access to confidential data | Per-VM ACLs (Fabrick); role-based API access; audit log restricted to Admin/Operator | Implemented | Free (RBAC), Fabrick (per-VM ACLs) |

## Privacy

| TSC Point | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| P1-P8 | Privacy criteria | N/A — Weaver is infrastructure management software. It does not process, store, or transmit personal information (PII). User accounts contain only username and role. Privacy obligations for data within managed workloads are the deployer's responsibility. | N/A | N/A |

## Audit Evidence Summary

For a SOC 2 Type II audit, the following evidence artifacts exist:

| Evidence Type | Location |
|--------------|----------|
| Security baselines and thresholds | `docs/security/SECURITY-BASELINES.md` |
| Automated compliance auditors (18) | `npm run test:compliance` |
| Route auth coverage report | `npm run audit:routes` (68 routes) |
| Dependency vulnerability tracking | `npm run test:security` |
| Pre-release security checklist | `CLAUDE.md` Release Checklist |
| Audit log implementation | `backend/src/routes/` (auth events) + `GET /api/audit` |
| Change management trail | Git history with pre-commit hooks (lint + typecheck + tests) |
| Access control model | RBAC implementation in `requireRole()` / `requireTier()` |

---

**Cross-reference:** [SECURITY-BASELINES.md](../SECURITY-BASELINES.md) for threshold values and standards citations.
