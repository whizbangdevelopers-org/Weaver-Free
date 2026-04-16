<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

# CIS Controls v8.1 Mapping — Weaver

**Date:** 2026-04-15
**Scope:** Weaver v1.0 — single-host NixOS workload isolation manager (containers + MicroVMs). This doc maps Weaver capabilities to the CIS Critical Security Controls v8.1, the top-18 framework that replaced the older CIS Top 20.

> **Disclaimer:** This document is a best-effort technical mapping, not a certification claim. CIS Controls are organizational — each control requires both technical implementation AND organizational policy/process. Weaver provides infrastructure-level technical implementation for 10 of the 18 controls; the remaining 8 are either partial/supporting or fall outside Weaver's scope (people/process/endpoint-specific). Buyers should verify controls against their specific compliance requirements.

> **Framework distinction:** CIS Controls (the top-18 framework) is different from [CIS Benchmarks](CIS-BENCHMARK-ALIGNMENT.md) (Linux hardening checklists). Both are CIS products; they address different layers. Weaver maps to both — this file covers Controls; the sibling file covers Benchmarks.

## Implementation Groups (IG1/IG2/IG3)

CIS Controls v8.1 tiers safeguards by Implementation Group — IG1 for basic cyber hygiene, IG2 for risk-informed organizations, IG3 for mature security programs. This mapping notes the IG level per safeguard where relevant. Weaver supports all three IG levels across applicable controls.

---

## Control 1 — Inventory and Control of Enterprise Assets

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| 1.1 | Establish and maintain detailed enterprise asset inventory | NixOS declarative configuration IS the asset inventory. Every VM, container, bridge, IP pool, and resource is declared in `configuration.nix` / flake. Workload Page shows all declared and running assets | Implemented | Free |
| 1.2 | Address unauthorized assets | Zero-drift architecture — unauthorized assets cannot run unless declared. NixOS activation rejects undeclared system state | Implemented | Free |
| 1.3 | Utilize an active discovery tool | Network topology API + bridge introspection; `weaver-observer` for non-NixOS host discovery (v2.4 fleet discovery wizard) | Partial (v1.0) · Implemented fleet (v2.4) | Free (local), Fabrick (fleet) |
| 1.4 | Use DHCP logging to update enterprise asset inventory | Managed bridges with declarative IP pools; DHCP lease visibility via bridge status | Partial | Weaver Team+ |

## Control 2 — Inventory and Control of Software Assets

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| 2.1 | Establish and maintain a software inventory | **Approved Packages catalog (Decision #147).** Every software package installable on approved hosts is recorded with derivation hash, approver, timestamp, attestation metadata. Query-able via `GET /api/cache/approvals` and Shed "Approved Packages" page. | Planned (v2.3.0) | Weaver Team+ |
| 2.2 | Ensure authorized software is currently supported | Approval records include declared-origin attestation (vendor, source URL). v3.1 automated pipeline adds CVE scan + SBOM extraction to flag unsupported software | Planned (v2.3.0 basic, v3.1 automated) | Weaver Team+ |
| 2.3 | Address unauthorized software | **Private Nix Cache (Decision #147)** locks host `nix.settings.substituters` to the private cache — unauthorized (unapproved) software cannot be installed because the derivation hash isn't in the signed allowlist. Deny-by-default at install time, not detect-after-the-fact | Planned (v2.3.0) | Weaver Team+ |
| 2.4 | Utilize automated software inventory tools | NixOS declarative config + Approved Packages table is the software inventory; queryable programmatically | Planned (v2.3.0) | Weaver Team+ |
| 2.5 | Allowlist authorized software | **Exact match.** Approved Packages allowlist (Decision #147) with manual approval at Solo/Team entry, automated approval pipeline at v3.1/v3.2 | Planned (v2.3.0) | Weaver Team+ |
| 2.6 | Allowlist authorized libraries | v3.1 SBOM extraction (Decision #149 Shed Builder automated pipeline) identifies library dependencies; approval applies at derivation level | Planned (v3.1.0) | Fabrick |
| 2.7 | Allowlist authorized scripts | **Shed Builder Lane 4 (Decision #149)** handles native Nix derivations — scripts installed via the cache are subject to the same approval flow | Planned (v2.3.0) | Weaver Team+ |

## Control 3 — Data Protection

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| 3.1 | Establish and maintain data management process | Weaver manages workload infrastructure, not application data directly. Declarative config documents where data lives (per-VM disk paths, bind mounts, storage pool references) | Partial (infrastructure layer) | Free |
| 3.3 | Configure data access control lists | Per-VM RBAC; tier-gated access; audit log for all data-access infrastructure events | Implemented | Fabrick (per-VM ACLs) |
| 3.6 | Encrypt data on end-user devices | NixOS LUKS full-disk encryption (deployer responsibility). Weaver does not manage endpoint devices | Deployer Responsibility | Free |
| 3.11 | Encrypt sensitive data at rest | sops-nix for application secrets; NixOS LUKS for disk encryption (deployer) | Planned (sops-nix) / Deployer (disk) | Solo+ |

## Control 4 — Secure Configuration of Enterprise Assets and Software

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| 4.1 | Establish and maintain a secure configuration process | **NixOS declarative configuration IS the secure configuration process.** Every setting is declared in code, git-tracked, change-controlled. Zero drift means configured state equals running state | Implemented | Free |
| 4.2 | Establish and maintain a secure configuration for network infrastructure | Managed bridges (Decision #32); declarative firewall rules (v1.2); network topology in code | Implemented | Solo+ |
| 4.4 | Implement and manage a firewall on servers | NixOS firewall default-deny; Weaver firewall plugin (v1.2) for per-VM policy | Implemented (v1.0 host), Solo+ (per-VM) | Free (host), Solo+ (per-VM) |
| 4.5 | Implement and manage a firewall on end-user devices | N/A — Weaver is infrastructure, not endpoint | N/A | — |
| 4.6 | Securely manage enterprise assets and software | Zero-drift declarative config; git-tracked change control; reproducible builds | Implemented | Free |
| 4.7 | Manage default accounts | First-run admin setup (no default credentials, Decision #30); dedicated `weaver` service user with no interactive shell | Implemented | Free |
| 4.8 | Uninstall or disable unnecessary services | NixOS least-functionality by construction — only declared services run. Nothing installs unless declared | Implemented | Free |
| 4.9 | Configure trusted DNS servers | DNS plugin (v1.1) with declarative zone configuration | Implemented | Solo+ |

## Control 5 — Account Management

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| 5.1 | Establish and maintain an inventory of accounts | User list API (`GET /api/users`); RBAC roles; audit log tracks all account lifecycle events | Implemented | Free |
| 5.2 | Use unique passwords | 14+ character complex passwords required (NIST 800-63B); bcrypt cost 13; password reuse prevention | Implemented | Free |
| 5.3 | Disable dormant accounts | User deletion API; role change audit trail; deployer responsibility for inactive-user review cadence | Implemented (tooling) / Deployer Responsibility (cadence) | Free |
| 5.4 | Restrict administrator privileges to dedicated administrator accounts | Admin/Operator/Viewer role separation; per-VM ACLs at Fabrick | Implemented | Free (roles), Fabrick (per-VM) |
| 5.5 | Establish and maintain an inventory of service accounts | Dedicated `weaver` service user; sops-nix credential management (Solo+) | Implemented | Free (basic), Solo+ (sops-nix) |
| 5.6 | Centralize account management | SSO/SAML/LDAP integration via auth plugin | Planned | Solo+ (v1.2), Fabrick (SAML/LDAP) |

## Control 6 — Access Control Management

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| 6.1 | Establish an access granting process | First-run admin setup; role assignment via Users page; audit log of role grants | Implemented | Free |
| 6.2 | Establish an access revoking process | User deletion API; role demotion; password change invalidates all sessions; single-session enforcement | Implemented | Free |
| 6.3 | Require MFA for externally exposed applications | MFA (TOTP/FIDO2) via auth plugin | Planned | Solo+ |
| 6.5 | Require MFA for administrative access | MFA required for Admin role at Solo+ | Planned | Solo+ |
| 6.7 | Centralize access control | SSO/SAML/LDAP integration | Planned | Solo+ / Fabrick |
| 6.8 | Define and maintain role-based access control | Admin/Operator/Viewer roles implemented; per-VM ACLs at Fabrick | Implemented | Free (roles), Fabrick (per-VM) |

## Control 7 — Continuous Vulnerability Management

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| 7.1 | Establish and maintain a vulnerability management process | `npm audit` in CI; pre-push security hook; SECURITY-AUDIT.md with disposition tracking; 28-auditor compliance suite | Implemented | Free |
| 7.2 | Establish and maintain a remediation process | Dependabot alerts; pre-release security audit checklist; red team audit cadence | Implemented | Free |
| 7.3 | Perform automated operating system patch management | NixOS declarative OS updates — patches are git commits, fleet-wide rollout via Colmena (v2.4). Automated upstream channel bumps | Implemented (single host) · Planned fleet (v2.4) | Solo+ (host), Fabrick (fleet) |
| 7.4 | Perform automated application patch management | Weaver app updates via NixOS module; automatic upgrade on `nixos-rebuild switch` | Implemented | Free |
| 7.5 | Perform automated vulnerability scans of internal enterprise assets | SAST auditor (v1.0); pre-release dependency audit | Implemented | Free |
| 7.6 | Perform automated vulnerability scans of externally-exposed enterprise assets | Deployer responsibility (external scanning is outside Weaver scope) | Deployer Responsibility | — |
| 7.7 | Remediate detected vulnerabilities | Git-commit-based patch workflow; SECURITY-AUDIT.md tracks each finding to disposition | Implemented | Free |

## Control 8 — Audit Log Management

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| 8.1 | Establish and maintain an audit log management process | **Declarative audit log (Decision #103).** Every auth event, user lifecycle event, workload action, and config change is captured in SQLite audit store. Retention and access policy documented | Implemented | Free |
| 8.2 | Collect audit logs | `audit-store.ts` captures: login, logout, password change, role change, user create/delete, workload start/stop/restart, config change, approval (v2.3) | Implemented | Free |
| 8.3 | Ensure adequate audit log storage | SQLite-backed with configurable retention; git-based declarative config change log is append-only by construction | Implemented | Free |
| 8.4 | Standardize time synchronization | NixOS NTP configuration (deployer); timestamps in audit log use UTC | Deployer Responsibility (NTP) · Implemented (UTC) | Free |
| 8.5 | Collect detailed audit logs | Audit entries include: timestamp, user ID, action, target, source IP, outcome | Implemented | Free |
| 8.6 | Collect DNS query audit logs | DNS plugin (v1.1) with query logging at Fabrick | Implemented | Fabrick |
| 8.8 | Collect command-line audit logs | Declarative config is the command-line equivalent — git log captures every config change | Implemented | Free |
| 8.9 | Centralize audit logs | Single Weaver host audit log at v1.0; fleet-wide audit aggregation at v2.4 Fabrick clustering | Implemented (single) · Planned fleet (v2.4) | Free (single), Fabrick (fleet) |

## Control 9 — Email and Web Browser Protections

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| All safeguards | Email and web browser protections | **N/A** — Weaver is infrastructure management, not endpoint/browser protection. Deployers should use dedicated email/browser security tools | N/A | — |

## Control 10 — Malware Defenses

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| 10.1 | Deploy and maintain anti-malware software | N/A at host level — Weaver doesn't manage endpoints. **However:** the v2.3 Private Nix Cache (Decision #147) with signed approved-package allowlist provides **preventive** malware defense for software installed on managed hosts — unapproved/unsigned software cannot install. This is a stronger control than detective anti-malware (signature-based) because it's deny-by-default at install time | Partial (v1.0 infrastructure) · Preventive software control (v2.3 Decision #147) | N/A (host AV) · Weaver Team+ (v2.3 prevention) |
| 10.3 | Disable autorun and autoplay for removable media | NixOS: no autorun by default; deployer responsibility for removable media policy | Deployer Responsibility | — |

## Control 11 — Data Recovery

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| 11.1 | Establish and maintain a data recovery process | **Decision #148 two-layer backup.** v1.0: declarative NixOS config = infrastructure state reproducible from git. v2.5: encrypted cloud-native backup (6 adapters: local FS, NFS, restic, borg at Solo; S3/Azure/GCS at Team) with retention, file-level restore, integrity verification. v2.7: Fabrick fleet-scale multi-target + cross-site replication + automated test restores | Implemented (infrastructure v1.0) · Planned data layer (v2.5) | Free (v1.0 config) · Weaver Team+ (v2.5 data) |
| 11.2 | Perform automated backups | v2.5 Backup Weaver includes backup job scheduler with systemd timers; per-job retention policies | Planned (v2.5.0) | Solo+ |
| 11.3 | Protect recovery data | AES-256-GCM encryption with client-side key management (sops-nix); integrity verification on write and restore | Planned (v2.5.0) | Solo+ |
| 11.4 | Establish and maintain an isolated instance of recovery data | S3/Azure/GCS off-site copy adapters (Team) + cross-site replication (Fabrick v2.7) | Planned (v2.5 Team) · Planned fleet (v2.7) | Team+ / Fabrick |
| 11.5 | Test data recovery | Automated test restores at v2.7 Fabrick (random backup verification on standby workload, on schedule) | Planned (v2.7.0) | Fabrick |

## Control 12 — Network Infrastructure Management

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| 12.1 | Ensure network infrastructure is up-to-date | NixOS declarative network configuration; git-tracked change history; fleet-wide rollout via Colmena (v2.4) | Implemented | Solo+ |
| 12.2 | Establish and maintain a secure network architecture | **Managed bridges (Decision #32, #114)** provide declarative network segmentation; IP pools; zone-aware topology map (Strands at v1.x, Loom at v3.0+) | Implemented | Solo+ |
| 12.3 | Securely manage network infrastructure | Declarative firewall rules (v1.2); Smart Bridges (v2.2+) for automated routing; per-VM network policies | Implemented | Solo+ |
| 12.4 | Establish and maintain architecture diagram(s) | Network topology map (Strands) — live, config-driven, always current. No manual Visio diagrams | Implemented | Free |
| 12.5 | Centralize network authentication, authorization, and auditing (AAA) | Per-VM RBAC; centralized audit log; SSO/SAML/LDAP (Solo+ / Fabrick) | Implemented (roles) · Planned (SSO) | Fabrick |
| 12.6 | Use of secure network management and communication protocols | TLS at nginx; WebSocket over authenticated TLS; internal IPC over Unix sockets | Implemented | Free |
| 12.7 | Ensure remote devices utilize a VPN and are connecting to an enterprise's AAA infrastructure | Tailscale integration for remote access (v1.3); Tailscale MagicDNS for peer discovery (v2.2) | Implemented | Solo+ |
| 12.8 | Establish and maintain dedicated computing resources for all administrative work | Dedicated `weaver` service user with minimal permissions; admin role separation; NixOS service isolation | Implemented | Free |

## Control 13 — Network Monitoring and Defense

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| 13.1 | Centralize security event alerting | Audit log with real-time WebSocket streaming; AI diagnostics surface anomalies | Implemented | Free |
| 13.2 | Deploy a host-based intrusion detection solution | N/A host-level (deployer responsibility for HIDS). Weaver's zero-drift architecture provides equivalent protection — unauthorized changes are architecturally impossible without a git commit | Partial (zero-drift substitute) / Deployer Responsibility (HIDS) | — |
| 13.3 | Deploy a network intrusion detection solution | Deployer responsibility (NIDS is outside Weaver scope) | Deployer Responsibility | — |
| 13.6 | Collect network traffic flow logs | Bridge flow visibility via Weaver topology; declarative firewall logging | Partial | Solo+ |
| 13.11 | Tune security event alerting thresholds | AI diagnostics + audit log query API for custom alerting | Implemented | Solo+ |

## Control 14 — Security Awareness and Skills Training

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| All safeguards | Security awareness training | **N/A** — this is a people/process control, not a software feature. Organizations using Weaver should run their own security awareness program | N/A | — |

## Control 15 — Service Provider Management

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| All safeguards | Service provider management | **N/A (governance).** Weaver is self-hosted — no cloud service provider relationship. For organizations using Fabrick Cloud (v4.0), WBD publishes its own SOC 2 / SLA documentation. Weaver's open-core code base + NixOS declarative supply chain supports customer due diligence | N/A (infrastructure) | — |

## Control 16 — Application Software Security

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| 16.1 | Establish and maintain a secure application development process | Weaver's own development: pre-commit + pre-push hooks, 29 compliance auditors, E2E suite, SAST auditor, red team audit cadence. Public via open-core repo | Implemented | Free |
| 16.2 | Establish and maintain a process to accept and address software vulnerabilities | Published SECURITY.md; GitHub advisory process; Dependabot triage workflow | Implemented | Free |
| 16.4 | Establish and manage an inventory of third-party software components | `package.json` + lock files in git; Decision #147 + Shed Builder v2.3 provides the *customer's* software-component inventory at install time | Implemented (Weaver deps) · Planned customer inventory (v2.3.0) | Free (Weaver) · Weaver Team+ (customer) |
| 16.5 | Use up-to-date and trusted third-party software components | Dependabot alerts; SHA-pinned GitHub Actions; lock file review in SECURITY-AUDIT.md. For customer-installed software: Private Nix Cache ensures only approved packages can install (Decision #147) | Implemented (Weaver) · Planned customer side (v2.3.0) | Free / Weaver Team+ |
| 16.9 | Train developers in application security | N/A — customer-side developer training is outside Weaver scope. Weaver's LESSONS-LEARNED.md + KNOWN-GOTCHAS.md provide pattern references for developers building on Weaver | Deployer Responsibility | — |
| 16.11 | Leverage vetted modules or services for application security components | sops-nix for secrets; Nix package manager for dependencies; Fastify + Zod for validation. All published upstream projects with security review | Implemented | Free |

## Control 17 — Incident Response Management

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| 17.1 | Designate personnel to manage incident handling | Deployer responsibility (organizational control) | Deployer Responsibility | — |
| 17.2 | Establish and maintain contact information for reporting security incidents | `docs/SECURITY.md` with disclosure contact | Implemented | Free |
| 17.3 | Establish and maintain an enterprise process for reporting incidents | Weaver audit log + AI diagnostics provide incident timeline reconstruction. DFARS 72-hour reporting workflow supported in defense-contractor vertical doc | Implemented (tooling) | Free |
| 17.4 | Establish and maintain an incident response process | **Compromise runbook** (cache-key-compromise-runbook.md — to be written at v2.3 under `docs/operations/`) provides cache-key compromise response procedure. Declarative baselines enable rapid forensic comparison | Partial (v1.0 baseline) · Planned runbook (v2.3.0) | Free (baseline) · Weaver Team+ (cache runbook) |
| 17.5 | Assign key roles and responsibilities | Deployer responsibility (organizational) | Deployer Responsibility | — |
| 17.8 | Conduct post-incident reviews | Git-based audit trail provides immutable evidence for post-incident review | Implemented | Free |

## Control 18 — Penetration Testing

| Safeguard | Requirement | Weaver Implementation | Status | Tier |
|-----------|------------|----------------------|--------|------|
| All safeguards | Penetration testing program | **N/A (process).** This is an organizational program, not a software feature. Weaver itself is subject to red team audit as part of the release process (see internal development notes on Forge Security Audit Domains). | Deployer Responsibility (customer pen test) | — |

---

## Summary Table

| Control | Weaver Fit | Primary Status | Tier Entry |
|---|---|---|---|
| **1. Asset Inventory** | Exact (declarative = inventory) | Implemented | Free |
| **2. Software Asset Control** | Exact | Planned (v2.3.0) | Weaver Team+ |
| **3. Data Protection** | Partial | Partial / Planned | Solo+ |
| **4. Secure Configuration** | Exact (NixOS) | Implemented | Free |
| **5. Account Management** | Good | Implemented | Free |
| **6. Access Control Management** | Good | Implemented | Free / Fabrick |
| **7. Vulnerability Management** | Good | Implemented | Free |
| **8. Audit Log Management** | Exact (git + audit store) | Implemented | Free |
| **9. Email/Web Protection** | N/A | N/A | — |
| **10. Malware Defenses** | Partial (v2.3 preventive) | Partial / Planned | Weaver Team+ |
| **11. Data Recovery** | Good | Planned (v2.5.0) | Weaver Team+ |
| **12. Network Infrastructure** | Exact | Implemented | Solo+ |
| **13. Network Monitoring** | Decent | Partial | Solo+ |
| **14. Security Awareness** | N/A (people) | N/A | — |
| **15. Service Provider Mgmt** | N/A (governance) | N/A | — |
| **16. Application Software Security** | Good | Implemented / Planned | Free / Weaver Team+ |
| **17. Incident Response** | Partial | Partial / Planned | Free / Weaver Team+ |
| **18. Penetration Testing** | N/A (process) | N/A | — |

**Applicable controls (excluding 5 N/A):** 13
**Implemented at v1.0:** 7 (Controls 1, 4, 5, 6, 7, 8, 12)
**Partial at v1.0 / fully implemented v2.3+:** 6 (Controls 2, 3, 10, 11, 13, 16)
**Full compliance version:** v2.7.0 (after Backup Fabrick fleet-scale ships)

---

**Cross-reference:** [CIS-BENCHMARK-ALIGNMENT.md](CIS-BENCHMARK-ALIGNMENT.md) for OS hardening alignment. CIS Controls (this doc) and CIS Benchmarks are complementary — Controls specify *what* to protect; Benchmarks specify *how* to harden the underlying OS.
