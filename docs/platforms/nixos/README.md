<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# NixOS Platform Guides

Weaver runs natively on NixOS as a systemd service managed by a NixOS module. These guides walk you through host setup, bridge networking, and service configuration.

## Choose Your Configuration Method

NixOS supports two primary configuration styles. Pick the guide that matches your setup:

| Guide | Configuration Style | Best For |
|-------|-------------------|----------|
| [SETUP-FLAKES.md](SETUP-FLAKES.md) | Nix flakes (`flake.nix`) | Most NixOS users on 25.11+; reproducible by default |
| [SETUP-TRADITIONAL.md](SETUP-TRADITIONAL.md) | Channel-based (`configuration.nix` with `fetchTarball`) | Systems without flakes enabled; simpler to get started |

Both methods use the same NixOS module and produce identical results. The only difference is how you import the module and microvm.nix.

## Shared Reference

| Guide | Contents |
|-------|----------|
| [SETUP-COMMON.md](SETUP-COMMON.md) | Bridge networking, NAT/routing, network layout diagram, how provisioning works, environment variables reference, troubleshooting |

The method-specific guides reference SETUP-COMMON.md for these shared topics so you don't have to read them twice.

## Planned

- **deploy-rs / Colmena guide** -- For users who deploy NixOS configurations remotely via deploy-rs or Colmena. Coming in a future release.

## Quick Start

If you are unsure which guide to use:

1. Run `nix --version` on your NixOS host.
2. Check whether `/etc/nixos/flake.nix` exists.
   - **Yes** -- Follow [SETUP-FLAKES.md](SETUP-FLAKES.md).
   - **No** -- Follow [SETUP-TRADITIONAL.md](SETUP-TRADITIONAL.md).

## What the NixOS Module Provides

When you enable `services.weaver`, the module automatically configures:

- **System user and group** (`weaver`) with KVM access
- **Data directories** (`/var/lib/weaver`, `/var/lib/microvms`)
- **Passwordless sudo rules** for managing `microvm@*` systemd units
- **Systemd service** with restart-on-failure, correct tool paths, and environment
- **Bridge networking and NAT** (when `provisioningEnabled = true`)
- **Firewall rules** (when `openFirewall = true`)

All module options are documented in `nixos/default.nix` and summarized in each setup guide.
