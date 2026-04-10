<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# NixOS Setup: Traditional (Channel-Based)

This guide is for **traditional NixOS configurations** that use `configuration.nix` without flakes. If you use flakes, see [SETUP-FLAKES.md](SETUP-FLAKES.md) instead.

For bridge networking, environment variables, provisioning details, and troubleshooting, see [SETUP-COMMON.md](SETUP-COMMON.md).

---

## Prerequisites

- NixOS 25.11 or newer
- KVM support (`/dev/kvm` exists)
- Internet access for downloading cloud images and Nix closures

> **Tip:** Run `./scripts/preflight-check.sh` before starting to verify hardware readiness (CPU virtualization, KVM, IOMMU, RAM, disk). See [COMPATIBILITY.md](../../COMPATIBILITY.md) for the full compatibility matrix and BIOS configuration reference.

## 1. Import microvm.nix Host Module

The microvm.nix project provides the `microvm` CLI and host-side infrastructure for running MicroVMs. Import it via `fetchTarball` in your `configuration.nix`.

### Option A: Tracking a branch (unpinned)

This always fetches the latest version from the `main` branch. Simple to set up, but builds are not reproducible across machines.

```nix
# configuration.nix
{ config, pkgs, lib, ... }:

{
  imports = [
    (import "${builtins.fetchTarball "https://github.com/astro/microvm.nix/archive/main.tar.gz"}/nixos-modules/host")
  ];

  # ... rest of your configuration
}
```

### Option B: Pinned to a specific revision (recommended)

Pinning to a commit SHA ensures reproducible builds. Update the hash when you want a newer version.

```nix
# configuration.nix
{ config, pkgs, lib, ... }:

let
  microvm-nix = builtins.fetchTarball {
    url = "https://github.com/astro/microvm.nix/archive/abc1234def5678.tar.gz";
    sha256 = "0000000000000000000000000000000000000000000000000000";
  };
in
{
  imports = [
    "${microvm-nix}/nixos-modules/host"
  ];

  # ... rest of your configuration
}
```

> **Finding the SHA256:** Run `nix-prefetch-url --unpack https://github.com/astro/microvm.nix/archive/<commit>.tar.gz` to get the correct hash. Replace `abc1234def5678` with the commit SHA you want to pin to.

## 2. Configure Bridge Networking

See [SETUP-COMMON.md -- Bridge Networking](SETUP-COMMON.md#bridge-networking) for the full bridge and NAT configuration. Choose either systemd-networkd (recommended) or `networking.bridges`.

## 3. Dashboard Service Configuration

Import the dashboard NixOS module and enable the service. The module handles user creation, data directories, sudo rules, and systemd configuration.

### Importing the Dashboard Module

Use `fetchTarball` to pull the dashboard module, similar to how you imported microvm.nix:

```nix
# configuration.nix
{ config, pkgs, lib, ... }:

let
  weaver = builtins.fetchTarball {
    url = "https://github.com/whizbangdevelopers-org/Weaver-Free/archive/v1.0.0.tar.gz";
    sha256 = "0000000000000000000000000000000000000000000000000000";
  };
in
{
  imports = [
    "${weaver}/nixos/default.nix"
  ];

  services.weaver = {
    enable = true;
    port = 3100;
    host = "0.0.0.0";
    premiumEnabled = true;
    provisioningEnabled = true;
    bridgeInterface = "br-microvm";
    bridgeGateway = "10.10.0.1";
  };
}
```

> **Tip:** Pin to a release tag (e.g. `v1.0.0`) for production, or use `main` for development.

### Service User Configuration

By default the module creates a dedicated `weaver` system user. For **development** (running from source in your home directory), override the service user to avoid EACCES permission errors:

```nix
services.weaver = {
  enable = true;
  serviceUser = "mark";        # Your dev username
  serviceGroup = "users";      # Your primary group
  provisioningEnabled = true;
};
```

| Mode | `serviceUser` | `serviceGroup` | Why |
|------|--------------|----------------|-----|
| **Production** | `"weaver"` (default) | `"weaver"` (default) | Least privilege, dedicated system user |
| **Development** | Your username (e.g. `"mark"`) | `"users"` | Needs read access to source code in home dir |

> **Gotcha:** If the tmpfiles owner doesn't match the service user, the service crashes with `EACCES` on first write to `/var/lib/weaver/vms.json`. After changing `serviceUser`, run `sudo systemd-tmpfiles --create && sudo systemctl restart weaver`.

### Combining Both Imports

Here is a complete `configuration.nix` skeleton showing both microvm.nix and the dashboard module together:

```nix
# configuration.nix
{ config, pkgs, lib, ... }:

let
  microvm-nix = builtins.fetchTarball {
    url = "https://github.com/astro/microvm.nix/archive/main.tar.gz";
    # sha256 = "...";  # Add for reproducible builds
  };

  weaver = builtins.fetchTarball {
    url = "https://github.com/whizbangdevelopers-org/Weaver-Free/archive/main.tar.gz";
    # sha256 = "...";  # Add for reproducible builds
  };
in
{
  imports = [
    ./hardware-configuration.nix
    "${microvm-nix}/nixos-modules/host"
    "${weaver}/nixos/default.nix"
  ];

  # Bridge networking (Option B from SETUP-COMMON.md)
  networking.bridges.br-microvm.interfaces = [];
  networking.interfaces.br-microvm.ipv4.addresses = [{
    address = "10.10.0.1";
    prefixLength = 24;
  }];

  # NAT for VM internet access
  networking.nat = {
    enable = true;
    internalInterfaces = [ "br-microvm" ];
    externalInterface = "enp0s25";  # Your WAN interface
  };
  boot.kernel.sysctl."net.ipv4.ip_forward" = 1;
  networking.firewall.trustedInterfaces = [ "br-microvm" ];

  # Dashboard service
  services.weaver = {
    enable = true;
    port = 3100;
    host = "0.0.0.0";
    premiumEnabled = true;
    provisioningEnabled = true;
    bridgeInterface = "br-microvm";
    bridgeGateway = "10.10.0.1";
  };
}
```

## 4. Rebuild

```bash
sudo nixos-rebuild switch
```

> **Note:** Unlike flake-based setups, you do not need the `--flake` flag. NixOS will evaluate `/etc/nixos/configuration.nix` by default.

## 5. Verify

```bash
# microvm CLI available
which microvm
# -> /run/current-system/sw/bin/microvm

# Bridge exists
ip addr show br-microvm

# KVM accessible
ls -la /dev/kvm

# Dashboard user in kvm group
id weaver

# ISO tools available (for cloud-init)
which genisoimage

# QEMU available
which qemu-system-x86_64
which qemu-img

# Dashboard service running
systemctl status weaver
curl http://localhost:3100/api/health
```

## Updating

To update either dependency, change the URL (or commit SHA) in your `fetchTarball` call and rebuild:

```bash
sudo nixos-rebuild switch
```

If you are using unpinned URLs (tracking `main`), you may need to clear the Nix tarball cache to pick up the latest version:

```bash
# Force re-download of tarball sources
sudo nix-store --delete /nix/store/*-source
sudo nixos-rebuild switch
```

## Next Steps

- [SETUP-COMMON.md](SETUP-COMMON.md) -- Networking details, provisioning internals, environment variables, and troubleshooting
- [README.md](README.md) -- Overview of all NixOS setup methods
