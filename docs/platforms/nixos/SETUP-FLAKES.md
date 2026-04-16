<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# NixOS Setup: Flakes

This guide is for **flake-based NixOS configurations** (the default on NixOS 25.11+). If you use a traditional `configuration.nix` without flakes, see [SETUP-TRADITIONAL.md](SETUP-TRADITIONAL.md) instead.

For bridge networking, environment variables, provisioning details, and troubleshooting, see [SETUP-COMMON.md](SETUP-COMMON.md).

---

## Prerequisites

- NixOS with flakes enabled
- KVM support (`/dev/kvm` exists)
- Internet access for downloading cloud images and Nix closures

> **Tip:** Run `./scripts/preflight-check.sh` before starting to verify hardware readiness (CPU virtualization, KVM, IOMMU, RAM, disk). See [COMPATIBILITY.md](../../COMPATIBILITY.md) for the full compatibility matrix and BIOS configuration reference.

## 1. Add Flake Inputs

In your system `flake.nix`, add the Weaver input (and optionally microvm.nix if you want the `microvm` CLI):

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";

    # Weaver — NixOS workload management
    weaver.url = "github:whizbangdevelopers-org/Weaver-Free";
    weaver.inputs.nixpkgs.follows = "nixpkgs";

    # Optional: microvm.nix host infrastructure (for microvm CLI)
    # microvm.url = "github:astro/microvm.nix";
    # microvm.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, weaver, ... }@inputs: {
    nixosConfigurations.your-hostname = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ./configuration.nix
        weaver.nixosModules.default     # ← loads the services.weaver option
        # microvm.nixosModules.host     # ← optional, for microvm CLI
      ];
      specialArgs = { inherit inputs; };
    };
  };
}
```

> **Important:** Nix flakes only see git-tracked files. After creating or modifying any `.nix` file, run `git add <file>` before `nixos-rebuild`.

A complete sample `flake.nix` is available at [`nixos/examples/flake.nix`](../../nixos/examples/flake.nix) in the Weaver repo.

## 2. Configure Bridge Networking

See [SETUP-COMMON.md -- Bridge Networking](SETUP-COMMON.md#bridge-networking) for the full bridge and NAT configuration. Choose either systemd-networkd (recommended) or `networking.bridges`.

## 3. Dashboard Service Configuration

The dashboard NixOS module handles user creation, data directories, sudo rules, and service configuration. Add `weaver.nixosModules.default` to your `flake.nix` modules list (see Step 1), then configure the service:

```nix
services.weaver = {
  enable = true;
  port = 3100;
  host = "0.0.0.0";
  openFirewall = true;
  provisioningEnabled = true;       # Create VMs from the UI
  bridgeInterface = "br-microvm";
  bridgeGateway = "10.10.0.1";
  # licenseKey = "WVR-...";         # Solo/Team/Fabrick features (optional)
};
```

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

### Manual Configuration (without the NixOS module)

If you prefer not to use the NixOS module, you can configure the service manually. See the collapsed example below.

<details>
<summary>Manual systemd service configuration</summary>

```nix
{ config, pkgs, lib, ... }:

{
  # System user with KVM access
  users.users.weaver = {
    isSystemUser = true;
    group = "weaver";
    home = "/var/lib/weaver";
    createHome = true;
    extraGroups = [ "kvm" ];
  };
  users.groups.weaver = {};

  # Data + microvms directories
  systemd.tmpfiles.rules = [
    "d /var/lib/weaver 0750 weaver weaver -"
    "d /var/lib/microvms 0755 weaver weaver -"
  ];

  # Sudo rules: VM management + provisioning
  security.sudo.extraRules = [{
    users = [ "weaver" ];
    commands = [
      # Manage microvm@ systemd units
      { command = "/run/current-system/sw/bin/systemctl start microvm@*"; options = [ "NOPASSWD" ]; }
      { command = "/run/current-system/sw/bin/systemctl stop microvm@*"; options = [ "NOPASSWD" ]; }
      { command = "/run/current-system/sw/bin/systemctl restart microvm@*"; options = [ "NOPASSWD" ]; }
      { command = "/run/current-system/sw/bin/systemctl is-active microvm@*"; options = [ "NOPASSWD" ]; }
      { command = "/run/current-system/sw/bin/systemctl show microvm@*"; options = [ "NOPASSWD" ]; }
      { command = "/run/current-system/sw/bin/systemctl status microvm@*"; options = [ "NOPASSWD" ]; }

      # Provisioning: microvm CLI for NixOS guests
      { command = "/run/current-system/sw/bin/microvm *"; options = [ "NOPASSWD" ]; }

      # Provisioning: install cloud VM units + reload
      { command = "/run/current-system/sw/bin/systemctl daemon-reload"; options = [ "NOPASSWD" ]; }
      { command = "/run/current-system/sw/bin/cp * /etc/systemd/system/microvm@*.service"; options = [ "NOPASSWD" ]; }
    ];
  }];

  # Dashboard service
  systemd.services.weaver = {
    description = "Weaver";
    after = [ "network.target" ];
    wantedBy = [ "multi-user.target" ];

    # cdrkit: genisoimage for cloud-init ISOs
    # qemu: qemu-system-x86_64 + qemu-img for non-NixOS VMs
    path = [ pkgs.cdrkit pkgs.qemu ];

    environment = {
      NODE_ENV = "production";
      PORT = "3100";
      HOST = "0.0.0.0";

      # Provisioning
      PROVISIONING_ENABLED = "true";
      MICROVMS_DIR = "/var/lib/microvms";
      BRIDGE_GATEWAY = "10.10.0.1";
      BRIDGE_INTERFACE = "br-microvm";

      # System command paths (NixOS-specific)
      SUDO_PATH = "/run/wrappers/bin/sudo";
      SYSTEMCTL_PATH = "/run/current-system/sw/bin/systemctl";
      IPTABLES_PATH = "/run/current-system/sw/bin/iptables";

      # Tool paths
      MICROVM_BIN = "/run/current-system/sw/bin/microvm";
      QEMU_BIN = "${pkgs.qemu}/bin/qemu-system-x86_64";
      QEMU_IMG_BIN = "${pkgs.qemu}/bin/qemu-img";
    };

    serviceConfig = {
      Type = "simple";
      User = "weaver";
      Group = "weaver";
      ExecStart = "${pkgs.nodejs_24}/bin/node /path/to/backend/dist/index.js";
      Restart = "on-failure";
      RestartSec = "10s";
      WorkingDirectory = "/path/to/backend";
    };
  };
}
```

</details>

## 4. Rebuild

```bash
sudo nixos-rebuild switch --flake /etc/nixos#your-hostname
```

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

## Next Steps

- [SETUP-COMMON.md](SETUP-COMMON.md) -- Networking details, provisioning internals, environment variables, and troubleshooting
- [README.md](README.md) -- Overview of all NixOS setup methods
