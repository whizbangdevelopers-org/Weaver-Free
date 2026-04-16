<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

# CIS Benchmark Alignment — NixOS Hosts Running Weaver

**Date:** 2026-04-01
**Scope:** Weaver v1.0 on NixOS hosts. Mapped against CIS Benchmarks for Linux (Level 1 and Level 2). Controls are categorized by who provides them: NixOS (declarative OS), Weaver (application), or Deployer (site-specific configuration).

> **Disclaimer:** This document maps Weaver's deployment posture to CIS Benchmark recommendations for Linux. It is not a certification claim. NixOS does not have an official CIS Benchmark profile; this mapping uses the general Linux benchmark as a reference. Deployers should verify controls against their specific environment.

## Filesystem Configuration

| CIS Control | Description | Implementation | Owner | Status | Tier |
|-------------|------------|----------------|-------|--------|------|
| 1.1.1 | Disable unused filesystems | NixOS: unused kernel modules not loaded by default; declarative module system | NixOS | Implemented | Free |
| 1.1.2-1.1.5 | Separate partitions for /tmp, /var, /home | NixOS: configurable via `fileSystems` declaration; not enforced by default | Deployer | Deployer Responsibility | Free |
| 1.1.8 | noexec on removable media | NixOS: declarative mount options; Weaver does not mount external media | NixOS / Deployer | Deployer Responsibility | Free |
| 1.4.1 | Ensure bootloader password | NixOS: GRUB password configurable via `boot.loader.grub.extraConfig` | Deployer | Deployer Responsibility | Free |

## User Accounts and Authentication

| CIS Control | Description | Implementation | Owner | Status | Tier |
|-------------|------------|----------------|-------|--------|------|
| 5.2.1 | Ensure sudo is installed | NixOS: sudo included; Weaver uses configurable `SUDO_PATH` (NixOS: `/run/wrappers/bin/sudo`) | NixOS | Implemented | Free |
| 5.2.2 | Ensure sudo commands use pty | NixOS: configurable via `security.sudo.extraConfig` | Deployer | Deployer Responsibility | Free |
| 5.3.1 | Ensure password creation requirements | Weaver: 14+ characters, 4 character classes (exceeds CIS minimum); enforced server-side via Zod validation | Weaver | Implemented | Free |
| 5.3.2 | Ensure lockout for failed attempts | Weaver: 5 attempts / 15 minutes; progressive delay at 3+ attempts | Weaver | Implemented | Free |
| 5.4.1 | Dedicated service account | NixOS module creates dedicated `weaver` service user; no interactive login shell | NixOS + Weaver | Implemented | Free |
| 5.4.2 | No default/shared accounts | Weaver: first-run setup (no default credentials); unique username per user | Weaver | Implemented | Free |
| 5.4.4 | Default group for root | NixOS: standard Linux group model; Weaver service user has minimal group membership | NixOS | Implemented | Free |

## Logging and Auditing

| CIS Control | Description | Implementation | Owner | Status | Tier |
|-------------|------------|----------------|-------|--------|------|
| 4.1.1 | Ensure auditing is enabled | NixOS: systemd journal enabled by default; Weaver: application-level audit log for all auth and workload events | NixOS + Weaver | Implemented | Free |
| 4.1.2 | Audit log storage | NixOS: journald persistent storage configurable; Weaver: audit log persisted to disk | NixOS + Deployer | Implemented (Weaver) / Deployer Responsibility (journald retention) | Free |
| 4.1.3 | Audit privileged commands | Weaver: all sudo/system commands logged server-side with full arguments; audit log captures workload actions | Weaver | Implemented | Free |
| 4.1.4-4.1.11 | Audit file access and modifications | NixOS: `auditd` configurable via `security.audit`; Weaver does not modify host files outside its data directory | Deployer | Deployer Responsibility | Free |
| 4.2.1 | Configure log shipping | NixOS: journald forwarding configurable; Weaver audit log is queryable via API for SIEM integration | Deployer | Deployer Responsibility | Free |

## Network Configuration

| CIS Control | Description | Implementation | Owner | Status | Tier |
|-------------|------------|----------------|-------|--------|------|
| 3.1.1 | Ensure IP forwarding is disabled (if not router) | NixOS: disabled by default; Weaver enables forwarding only for MicroVM bridge (`br-microvm`) | NixOS + Weaver | Implemented (scoped to bridge) | Solo+ |
| 3.1.2 | Ensure packet redirect not accepted | NixOS: sysctl configurable declaratively | Deployer | Deployer Responsibility | Free |
| 3.4.1 | Ensure firewall is installed/active | NixOS: `networking.firewall.enable = true` by default; Weaver NixOS module configures required port exceptions | NixOS + Weaver | Implemented | Free |
| 3.4.2 | Ensure default deny firewall policy | NixOS firewall: default deny; only explicitly opened ports allowed | NixOS | Implemented | Free |
| 3.4.3 | Ensure loopback traffic restricted | NixOS firewall: loopback allowed by default; external traffic filtered | NixOS | Implemented | Free |
| 3.5.1 | Bridge network isolation | Weaver: MicroVM bridge (`br-microvm`) with per-VM TAP interfaces; `iptables` rules for inter-VM isolation | Weaver | Implemented | Solo+ |
| 3.5.2 | CORS and origin validation | Weaver: CORS same-origin in production; explicit `CORS_ORIGIN` required for reverse proxy setups | Weaver | Implemented | Free |

## Access Control

| CIS Control | Description | Implementation | Owner | Status | Tier |
|-------------|------------|----------------|-------|--------|------|
| 5.1.1 | Ensure cron daemon is enabled | NixOS: cron/timer services declarative; Weaver does not use cron (systemd timers if needed) | NixOS | N/A (Weaver uses systemd) | Free |
| 5.1.8 | Restrict cron to authorized users | NixOS: declarative; Weaver service has no cron jobs | NixOS | N/A | Free |
| 5.2.4 | Restrict SSH access | NixOS: `services.openssh` configurable; key-only auth recommended; Weaver does not manage SSH | Deployer | Deployer Responsibility | Free |
| 5.2.5 | Ensure SSH idle timeout | NixOS: `services.openssh.extraConfig` for `ClientAliveInterval` | Deployer | Deployer Responsibility | Free |
| 5.2.15 | Ensure SSH access is limited | NixOS: `AllowUsers`/`AllowGroups` configurable declaratively | Deployer | Deployer Responsibility | Free |

## NixOS-Specific Advantages

NixOS provides several CIS-aligned properties by design that traditional Linux distributions require manual hardening for:

| Property | CIS Benefit |
|----------|------------|
| Declarative configuration | All system state defined in code; drift detection is trivial (diff `configuration.nix`) |
| Reproducible builds | Same configuration produces identical system; no undocumented manual changes |
| Atomic upgrades/rollbacks | Failed updates roll back automatically; no partial-upgrade states |
| Immutable system paths | `/nix/store` is read-only; system binaries cannot be tampered with at runtime |
| Minimal base install | NixOS includes only explicitly declared packages; no hidden default services |
| Git-tracked configuration | Full audit trail of every system change via version control |

---

**Cross-reference:** [SECURITY-BASELINES.md](../SECURITY-BASELINES.md) for application-level threshold values and standards citations.
