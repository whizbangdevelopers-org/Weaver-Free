<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

# Security Baselines

Minimum security parameter thresholds every WBD product must meet, based on **NIST 800-63B (2024)** and **OWASP ASVS 4.0**.

## Authentication

| Parameter | Minimum | Standard | Notes |
|-----------|---------|----------|-------|
| Password minimum length | 14 characters | NIST 800-63B | Infrastructure management requires stronger than consumer-grade 8-char |
| Password complexity | Upper + lower + digit + special character | OWASP ASVS V2.1 | All four character classes required |
| Password max length | 128 characters | OWASP ASVS V2.1 | Allow long passphrases |
| Bcrypt cost factor | 13 | OWASP 2024 | ~250ms per hash at cost 13 |
| Account lockout threshold | 5 attempts / 15 min | NIST 800-63B | Time-based reset, persisted to disk |
| Login error messages | Generic ("Invalid username or password") | OWASP ASVS V2.2 | Never reveal whether username exists |
| Login timing | Constant-time (dummy hash on missing user) | OWASP ASVS V2.2 | Prevent user enumeration via timing |

## Sessions & Tokens

| Parameter | Minimum | Standard | Notes |
|-----------|---------|----------|-------|
| Access token TTL | 15 minutes max | NIST 800-63B | Short-lived, non-renewable |
| Refresh token TTL | 7 days max | OWASP ASVS V3.5 | One-time use, rotated on refresh |
| Refresh token rotation | Required | OWASP ASVS V3.5.2 | Old token deleted before new issued |
| Password change | Invalidate all sessions | OWASP ASVS V3.3 | Force re-authentication |
| Token storage | httpOnly cookies preferred | OWASP ASVS V3.4.5 | localStorage is XSS-vulnerable |

## HTTP Security

| Parameter | Minimum | Standard | Notes |
|-----------|---------|----------|-------|
| HSTS max-age | 31536000 (1 year) | OWASP | Include includeSubDomains |
| CSP script-src | No unsafe-inline, no unsafe-eval | OWASP | Nonce or hash preferred |
| CSP style-src | unsafe-inline acceptable (framework requirement) | -- | Quasar/Vue runtime styles |
| CORS production | Explicit origin or same-origin only | OWASP | Never reflect arbitrary origins with credentials |
| X-Frame-Options | DENY or SAMEORIGIN | OWASP | Clickjacking protection |

## Audit Logging

| Event | Required | Standard |
|-------|----------|----------|
| Login success | Yes | OWASP ASVS V7.1 |
| Login failure | Yes | OWASP ASVS V7.1 |
| Logout | Yes | OWASP ASVS V7.1 |
| Password change | Yes | OWASP ASVS V7.1 |
| Role change | Yes | OWASP ASVS V7.1 |
| User creation/deletion | Yes | OWASP ASVS V7.1 |

## Command Execution

| Parameter | Requirement | Notes |
|-----------|-------------|-------|
| System commands | execFileAsync with argument arrays only | Never shell: true |
| User input in commands | Validated against strict regex before use | e.g., ^[a-z][a-z0-9-]*$ for VM names |
| Error messages from system commands | Sanitized before returning to client | Log full error server-side |

## Planned Improvements

No outstanding planned improvements — all baselines are implemented.

---

This document is the source of truth for the `audit:security` threshold checks. See `scripts/audit-security.ts`.
