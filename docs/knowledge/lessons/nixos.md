<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — nixos

Lessons learned in the **nixos** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-nixos-2026-05-13-001 -->
---
id: L-nixos-2026-05-13-001
type: lesson
domain: nixos
tags: [kuzu, native-module, npm, nix-sandbox]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## Kuzu npm package is Nix build-safe without removal — 2026-05-13 · Claude

**Root cause:** Kuzu bundles a pre-built `.node` native addon in its npm tarball. Unlike sass-embedded (which Vite actively tries to load during the frontend build, causing sandbox failures), kuzu's native binary is never executed during `npm run build` or `npx quasar build`. It's only loaded at runtime by Node processes that `require('kuzu')`.

**Rule:** Do NOT remove kuzu from `node_modules` in the Nix `buildPhase`. Just update `npmDepsHash` and `lockfile-marker` after `npm install`. Removal is only needed for packages that Vite/esbuild tries to bundle at build time.

**Why this shape wins:** The `buildPhase` script already has a pattern for removing build-time-executed native binaries (`rm -rf node_modules/sass-embedded`). kuzu doesn't belong in that list — adding it would break the script that generates kuzu-powered ingest outputs.

<!-- /entry -->

<!-- entry:L-nixos-2026-06-01-001 -->
---
id: L-nixos-2026-06-01-001
type: lesson
domain: nixos
tags: [infrastructure, flake, config-management, reproducibility]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## All infrastructure machines must be in a flake repo from day one — 2026-06-01 · Claude

**Root cause:** weaver-lab had been managed imperatively over 10 generations — `nixos-rebuild switch` called with configs that were never committed. When we went to reconstruct the config, `/etc/nixos/` was empty. We recovered by reading running systemd unit files, disk UUIDs from `lsblk`, network files from `/etc/systemd/network/`, and service configs from the nix store — a 45-minute forensic exercise that could have been a 5-second git checkout.

**Rule:** Every NixOS machine in the fleet gets an entry in the Foundry flake (`hosts/<hostname>/default.nix` + `hardware-configuration.nix`) from the moment it's provisioned. The Foundry repo is synced to the machine's `/etc/nixos/` and all rebuilds use `--flake /etc/nixos#<hostname>`. No machine should have more generations than it has commits.

**Why this shape wins:** Config-as-code means any machine can be rebuilt from scratch in one command. Forensic reconstruction from running state is error-prone (services may have been manually patched since the last rebuild) and doesn't capture intent. The Foundry repo also serves as the audit trail — you can see exactly what changed between generations.

<!-- /entry -->

<!-- entry:L-nixos-2026-06-01-002 -->
---
id: L-nixos-2026-06-01-002
type: lesson
domain: nixos
tags: [networking, nat, iptables, gateway, multi-nic]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-nixos-2026-06-01-001, G-nixos-2026-06-01-002]
graduated_to: ""
---

## Dedicated iptables oneshot service is the reliable NAT pattern for systemd-networkd hosts — 2026-06-01 · Claude

**Root cause:** Both `networking.nat` (NixOS module) and `IPMasquerade` (systemd-networkd option) failed silently on a dual-NIC NixOS 25.11 host with `networking.useNetworkd = true`. After three failed attempts with native options, an explicit systemd oneshot service applying iptables rules directly worked on the first try and has been stable since.

**Rule:** For a NixOS host acting as a NAT gateway with `networking.useNetworkd = true`: write a `systemd.services.<name>` oneshot with `after = ["network.target"]`, `wantedBy = ["multi-user.target"]`, `RemainAfterExit = true`, and explicit `iptables -t nat -A POSTROUTING ... -j MASQUERADE` + FORWARD rules. Use `iptables -C` (check) before `-A` (append) to prevent duplicate rules on service restart. Set `boot.kernel.sysctl."net.ipv4.ip_forward" = 1` separately.

**Why this shape wins:** The iptables rules are explicit, testable, and version-controlled. You can read the service script and know exactly what rules will be applied. The native NixOS/networkd options are opaque — when they don't work, there's no visibility into why. The oneshot pattern also survives reboots without a restart (RemainAfterExit keeps it "active" for dependency ordering).

<!-- /entry -->
