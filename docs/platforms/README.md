<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Installing Weaver

Weaver is a NixOS module. It runs on a NixOS host and manages both MicroVMs (hardware-isolated containers) and Docker/Podman containers as workloads. The install surface is NixOS-only.

## Install paths

| Path | Directory | For |
| ---- | --------- | --- |
| NixOS (flakes) | [`nixos/SETUP-FLAKES.md`](nixos/SETUP-FLAKES.md) | NixOS 25.11+ with flakes enabled (default on recent installs) |
| NixOS (traditional channels) | [`nixos/SETUP-TRADITIONAL.md`](nixos/SETUP-TRADITIONAL.md) | NixOS hosts using channels-based configuration.nix |
| First-time walkthrough | [`nixos/FIRST-INSTALL.md`](nixos/FIRST-INSTALL.md) | New NixOS users — ISO → running Weaver |

All paths install the same `services.weaver` NixOS module. Choose based on how your host is configured, not which tier of Weaver you run — tiers (Free / Solo / Team / Fabrick) are unlocked at runtime via license key, not via a different install path.

## Why NixOS only?

Weaver manages `microvm@*.service` systemd units and `br-microvm` bridge networking at host level. Running Weaver itself inside a container would require `--privileged` or Docker-in-Docker, either of which defeats the isolation model it exists to provide. Docker and Podman are **workload types Weaver manages**, not shipping formats for Weaver itself.

If you need to manage containers but don't run NixOS, NixOS installs cleanly alongside most Linux distributions or in a VM. See [FIRST-INSTALL.md](nixos/FIRST-INSTALL.md).
