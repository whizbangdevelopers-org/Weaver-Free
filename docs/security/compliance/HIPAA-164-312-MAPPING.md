<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

# HIPAA Section 164.312 Technical Safeguards Mapping

**Date:** 2026-04-01
**Scope:** Weaver v1.0 — single-host NixOS workload isolation manager. This mapping covers Technical Safeguards only (Section 164.312). Administrative Safeguards (Section 164.308) and Physical Safeguards (Section 164.310) are organizational responsibilities, not software controls.

> **Disclaimer:** This document maps Weaver's technical controls to HIPAA Section 164.312 requirements. It is not a certification claim. Covered entities must verify controls against their specific compliance requirements and conduct their own risk analysis per Section 164.308(a)(1).

## Section 164.312(a) — Access Control

| Requirement | HIPAA Spec | Weaver Implementation | Status | Tier |
|-------------|-----------|----------------------|--------|------|
| Unique User Identification | 164.312(a)(2)(i) Required | Unique username per user account; first-run admin setup (no shared/default credentials); user ID in all audit entries | Implemented | Free |
| Emergency Access Procedure | 164.312(a)(2)(ii) Required | `scripts/reset-admin-password.sh` (requires root/sudo access to host); NixOS declarative config enables system recovery | Implemented | Free |
| Automatic Logoff | 164.312(a)(2)(iii) Addressable | Access token TTL: 15 minutes max; refresh token TTL: 7 days max with one-time-use rotation; idle session timeout (15 min, server-side) | Implemented | Free |
| Encryption and Decryption | 164.312(a)(2)(iv) Addressable | Encrypted secret management at rest via sops-nix; TLS for data in transit (nginx layer); bcrypt for stored passwords | Planned / Deployer Responsibility (TLS at nginx) | Free (bcrypt), Solo+ (sops-nix, TLS) |

## Section 164.312(b) — Audit Controls

| Requirement | HIPAA Spec | Weaver Implementation | Status | Tier |
|-------------|-----------|----------------------|--------|------|
| Implement audit mechanisms | 164.312(b) Required | Comprehensive audit log: login success/failure, logout, password change, role change, user create/delete, workload start/stop/restart | Implemented | Free |
| Record examination activity | 164.312(b) Required | All audit entries include: timestamp, authenticated user ID, action type, target resource, source IP | Implemented | Free |
| Audit log access control | 164.312(b) Required | Audit log queryable only by Admin/Operator roles via `GET /api/audit`; no delete/modify API exposed | Implemented | Free |
| Audit log retention | 164.312(b) Required | Log persistence to disk; retention period configurable by deployer | Deployer Responsibility (retention policy) | Free |

## Section 164.312(c) — Integrity

| Requirement | HIPAA Spec | Weaver Implementation | Status | Tier |
|-------------|-----------|----------------------|--------|------|
| Protect ePHI from improper alteration/destruction | 164.312(c)(1) Required | Zod schema validation on all API inputs; path traversal prevention; command injection prevention (`execFileAsync` with argument arrays) | Implemented | Free |
| Software integrity verification on ePHI-processing systems | 164.312(c)(1) Required | **Private Nix Cache + Approved Packages .** Attic-based substituter cache with signed derivations — software installed on ePHI-processing hosts has verified integrity and approved origin. Add-only signing-key rotation; tamper-evident approval audit log. Shed Builder (internal reference) with two-person rule at Team+ for binary drops prevents unauthorized software introduction that could alter or destroy ePHI processing integrity. | Planned (v2.3.0) | Weaver Team+ |
| Authenticate ePHI | 164.312(c)(2) Addressable | All data modifications require authenticated JWT; role-based write permissions; audit trail for all changes | Implemented | Free |

**Note:** Weaver manages workload infrastructure, not ePHI directly. ePHI integrity within workloads (VMs/containers) is the deployer's responsibility. Weaver ensures the management plane cannot be used to tamper with workload data.

## Section 164.312(d) — Person or Entity Authentication

| Requirement | HIPAA Spec | Weaver Implementation | Status | Tier |
|-------------|-----------|----------------------|--------|------|
| Verify identity of persons seeking access | 164.312(d) Required | JWT authentication with bcrypt (cost 13); 14-character minimum password with complexity requirements (NIST 800-63B) | Implemented | Free |
| Multi-factor authentication | 164.312(d) Required | Multi-factor authentication (MFA) | Planned | Solo+ |
| Account lockout | 164.312(d) Required | Lockout after 5 failed attempts within 15 minutes; progressive delay (1s at 3, 3s at 4 attempts) | Implemented | Free |
| Timing-safe authentication | 164.312(d) Required | Constant-time bcrypt comparison on missing users prevents user enumeration; generic error messages only | Implemented | Free |
| Single-session enforcement | 164.312(d) Required | Last login revokes prior sessions (configurable; disabled in test mode for parallel E2E) | Implemented | Free |

## Section 164.312(e) — Transmission Security

| Requirement | HIPAA Spec | Weaver Implementation | Status | Tier |
|-------------|-----------|----------------------|--------|------|
| Integrity controls for transmitted ePHI | 164.312(e)(1) Required | HSTS max-age 31536000 with includeSubDomains; CSP headers; CORS same-origin in production | Implemented | Free |
| Encryption of transmitted ePHI | 164.312(e)(2)(ii) Addressable | TLS termination at nginx reverse proxy; Weaver sets HSTS to enforce HTTPS | Deployer Responsibility (TLS certificate + nginx config) | Solo+ (manual TLS), Team+ (auto-TLS) |
| WebSocket security | 164.312(e)(2)(ii) Addressable | WebSocket (`/ws/status`) requires authenticated connection; same-origin policy applies | Implemented | Free |

## Deployer Responsibilities Summary

Weaver provides the application-level controls listed above. The following are outside Weaver's scope and must be configured by the deployer:

| Area | Deployer Action Required |
|------|-------------------------|
| TLS certificates | Configure nginx with valid TLS certificates for HTTPS termination |
| Disk encryption | Enable NixOS LUKS or equivalent full-disk encryption for ePHI at rest |
| Backup and recovery | Implement backup procedures for workload data and Weaver configuration |
| Network segmentation | Configure host firewall and network isolation appropriate to the environment |
| Log retention | Configure audit log retention period per organizational policy (HIPAA requires 6 years) |
| Physical security | Physical access controls to the NixOS host are organizational responsibilities |
| BAA | Execute Business Associate Agreement with whizBANG Developers LLC if applicable |

---

**Cross-reference:** [SECURITY-BASELINES.md](../SECURITY-BASELINES.md) for threshold values and standards citations.
