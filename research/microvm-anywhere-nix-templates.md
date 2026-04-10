<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# microvm-anywhere: Nix Template Patterns

**Date:** 2026-02-12 (estimated)
**Purpose:** Reference material for v2.0.0 system templating implementation. Explores Nix-native VM provisioning using microvm.nix + nixos-anywhere + disko + impermanence.
**Relates to:** [SYSTEM-TEMPLATING-PLAN.md](../plans/v2.0.0/SYSTEM-TEMPLATING-PLAN.md), [V2-MULTINODE-PLAN.md](../plans/v2.0.0/V2-MULTINODE-PLAN.md) (Track 3: Nix Template Editor)
**Edge computing path:** This pattern is the implementation method for Weaver's edge computing market entry (v3.0). The same `makeMicroVM` factory and templates that provision datacenter VMs can deploy/reprovision NixOS microVMs on remote edge nodes over SSH via `fleet-deploy.sh`. Impermanence provides boot-clean resilience for unreliable edge environments. See [FABRICK-VALUE-PROPOSITION.md](../business/FABRICK-VALUE-PROPOSITION.md) and [enterprise-bellwether-matrix.md](enterprise-bellwether-matrix.md) for market context ($22B, 37% CAGR).

---

A template-driven provisioning system for NixOS MicroVMs, inspired by the
nixos-anywhere workflow of declarative, reproducible, nuke-and-pave deployments.

---

## Project Structure

```
microvm-anywhere/
├── flake.nix                    # Top-level flake: inputs, outputs, VM manifest
├── flake.lock
│
├── lib/
│   ├── make-microvm.nix         # VM factory function
│   └── net.nix                  # MAC/IP generation helpers
│
├── templates/                   # Composable NixOS module templates
│   ├── base.nix                 # Shared baseline (SSH, monitoring, etc.)
│   ├── web.nix                  # Nginx/reverse-proxy role
│   ├── database.nix             # Postgres/MySQL role with persistent volume
│   ├── worker.nix               # Headless job-runner role
│   └── dev.nix                  # Development VM with toolchains
│
├── disko/                       # Disk layout configs (for stateful VMs)
│   ├── ephemeral.nix            # No persistent volume (pure read-only root)
│   ├── single-volume.nix        # One data volume
│   └── multi-volume.nix         # Separate data + logs volumes
│
├── hosts/                       # Per-host declarations
│   └── hypervisor-1/
│       ├── default.nix          # Host NixOS config
│       └── vms.nix              # VM manifest for this host
│
├── overlays/                    # Custom package overlays
│   └── default.nix
│
├── scripts/
│   ├── provision.sh             # Wrapper: provision a single VM
│   ├── reprovision.sh           # Wrapper: nuke-and-pave a running VM
│   └── fleet-deploy.sh          # Orchestrate across multiple hosts
│
└── tests/
    └── vm-test.nix              # NixOS VM integration test
```

---

## 1. Flake Entrypoint

```nix
# flake.nix
{
  description = "microvm-anywhere: template-driven MicroVM provisioning";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

    microvm = {
      url = "github:microvm-nix/microvm.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    disko = {
      url = "github:nix-community/disko";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    impermanence.url = "github:nix-community/impermanence";
  };

  outputs = { self, nixpkgs, microvm, disko, impermanence, ... }:
  let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};

    # The VM factory — this is the core abstraction
    makeMicroVM = import ./lib/make-microvm.nix {
      inherit nixpkgs microvm disko impermanence system;
    };

    # VM manifest: define your fleet here
    vmManifest = import ./hosts/hypervisor-1/vms.nix {
      inherit makeMicroVM;
    };

  in {
    # --- Guest VM configurations ---
    nixosConfigurations = vmManifest.vms;

    # --- Host configuration (runs the VMs) ---
    nixosConfigurations.hypervisor-1 = nixpkgs.lib.nixosSystem {
      inherit system;
      modules = [
        microvm.nixosModules.host
        ./hosts/hypervisor-1/default.nix
        {
          # Declaratively register all VMs on this host
          microvm.vms = builtins.mapAttrs (name: vm: {
            flake = self;
            updateFlake = "git+file:///etc/microvm-anywhere";
          }) vmManifest.vms;
        }
      ];
    };

    # --- Packages: provisioning scripts ---
    packages.${system} = {
      provision = pkgs.writeShellApplication {
        name = "microvm-provision";
        runtimeInputs = with pkgs; [ nix openssh ];
        text = builtins.readFile ./scripts/provision.sh;
      };
      reprovision = pkgs.writeShellApplication {
        name = "microvm-reprovision";
        runtimeInputs = with pkgs; [ nix openssh ];
        text = builtins.readFile ./scripts/reprovision.sh;
      };
    };

    # --- Dev shell for working on this repo ---
    devShells.${system}.default = pkgs.mkShell {
      packages = with pkgs; [
        nix
        nixos-rebuild
        self.packages.${system}.provision
        self.packages.${system}.reprovision
      ];
    };
  };
}
```

---

## 2. VM Factory Function

This is the heart of the template system. It takes a spec and produces a
full `nixosSystem` configuration.

```nix
# lib/make-microvm.nix
{ nixpkgs, microvm, disko, impermanence, system }:

{
  name,
  template,                          # Path to a template module
  ip,
  mac,
  hypervisor ? "cloud-hypervisor",   # qemu | cloud-hypervisor | firecracker | ...
  mem ? 512,
  vcpu ? 1,
  diskoLayout ? null,                # Optional: path to a disko layout
  persistent ? true,                 # Enable impermanence?
  extraModules ? [],                 # Arbitrary additional NixOS modules
  volumes ? [],                      # Additional microvm volumes
  shares ? [],                       # Additional microvm shares
}:

nixpkgs.lib.nixosSystem {
  inherit system;
  modules = [
    # --- Core: microvm guest module ---
    microvm.nixosModules.microvm

    # --- Template: role-specific config ---
    template

    # --- Disko (optional): declarative disk layout ---
    (nixpkgs.lib.optionalAttrs (diskoLayout != null) {
      imports = [ disko.nixosModules.disko diskoLayout ];
    })

    # --- Impermanence (optional): boot-clean pattern ---
    (nixpkgs.lib.optionalAttrs persistent {
      imports = [ impermanence.nixosModules.impermanence ];
      environment.persistence."/persistent" = {
        hideMounts = true;
        directories = [
          "/var/log"
          "/var/lib/nixos"
          "/var/lib/systemd"
        ];
        files = [
          "/etc/machine-id"
        ];
      };
    })

    # --- Instance-specific overrides ---
    {
      networking.hostName = name;
      networking.interfaces.eth0.ipv4.addresses = [{
        address = ip;
        prefixLength = 24;
      }];

      microvm = {
        inherit hypervisor mem vcpu;
        interfaces = [{
          type = "tap";
          id = "vm-${name}";
          inherit mac;
        }];
        # Host nix store share (standard pattern)
        shares = [{
          proto = "virtiofs";
          tag = "ro-store";
          source = "/nix/store";
          mountPoint = "/nix/.ro-store";
        }] ++ shares;
        volumes = volumes;
      };
    }
  ] ++ extraModules;
}
```

---

## 3. Templates

### Base Template (all VMs inherit this)

```nix
# templates/base.nix
{ config, lib, pkgs, ... }:
{
  # --- Security baseline ---
  services.openssh = {
    enable = true;
    settings = {
      PermitRootLogin = "prohibit-password";
      PasswordAuthentication = false;
    };
  };

  # --- Common packages ---
  environment.systemPackages = with pkgs; [
    htop
    curl
    jq
  ];

  # --- Firewall default ---
  networking.firewall = {
    enable = true;
    allowedTCPPorts = [ 22 ];
  };

  # --- NTP ---
  services.chrony.enable = true;

  # --- Logging to host via journal ---
  services.journald.extraConfig = ''
    SystemMaxUse=100M
    MaxRetentionSec=7day
  '';

  # --- Nix settings inside the guest ---
  nix.settings = {
    experimental-features = [ "nix-command" "flakes" ];
    auto-optimise-store = true;
  };

  system.stateVersion = "25.11";
}
```

### Web Service Template

```nix
# templates/web.nix
{ config, lib, pkgs, ... }:
{
  imports = [ ./base.nix ];

  microvm.mem = lib.mkDefault 1024;

  services.nginx = {
    enable = true;
    recommendedGzipSettings = true;
    recommendedOptimisation = true;
    recommendedProxySettings = true;
    recommendedTlsSettings = true;
  };

  networking.firewall.allowedTCPPorts = [ 80 443 ];

  # Placeholder vhost — overridden per-instance
  services.nginx.virtualHosts."default" = {
    default = true;
    root = pkgs.writeTextDir "index.html" "<h1>microvm-anywhere</h1>";
  };
}
```

### Database Template

```nix
# templates/database.nix
{ config, lib, pkgs, ... }:
{
  imports = [ ./base.nix ];

  microvm.mem = lib.mkDefault 2048;

  # Expect a persistent volume mounted at /var/lib/data
  # (provisioned via microvm.volumes or disko)
  services.postgresql = {
    enable = true;
    dataDir = "/var/lib/data/postgresql";
    settings = {
      shared_buffers = "256MB";
      effective_cache_size = "1GB";
    };
  };

  networking.firewall.allowedTCPPorts = [ 5432 ];
}
```

---

## 4. VM Manifest (Per-Host)

```nix
# hosts/hypervisor-1/vms.nix
{ makeMicroVM }:

{
  vms = {

    # --- Web frontends ---
    web-1 = makeMicroVM {
      name = "web-1";
      template = ../../templates/web.nix;
      ip = "192.168.50.10";
      mac = "02:00:00:00:01:01";
      mem = 1024;
      extraModules = [{
        services.nginx.virtualHosts."app.example.com" = {
          forceSSL = true;
          enableACME = true;
          locations."/" = {
            proxyPass = "http://192.168.50.20:8080";
          };
        };
      }];
    };

    web-2 = makeMicroVM {
      name = "web-2";
      template = ../../templates/web.nix;
      ip = "192.168.50.11";
      mac = "02:00:00:00:01:02";
      mem = 1024;
    };

    # --- Database ---
    db-primary = makeMicroVM {
      name = "db-primary";
      template = ../../templates/database.nix;
      ip = "192.168.50.20";
      mac = "02:00:00:00:02:01";
      mem = 4096;
      vcpu = 2;
      diskoLayout = ../../disko/single-volume.nix;
      volumes = [{
        image = "data.img";
        mountPoint = "/var/lib/data";
        size = 20480;  # 20 GB
      }];
    };

    # --- Workers (generated from a list) ---
  } // builtins.listToAttrs (
    builtins.genList (i:
      let
        idx = toString i;
        padded = if i < 10 then "0${idx}" else idx;
      in {
        name = "worker-${padded}";
        value = makeMicroVM {
          name = "worker-${padded}";
          template = ../../templates/worker.nix;
          ip = "192.168.50.${toString (100 + i)}";
          mac = "02:00:00:00:03:${padded}";
          mem = 512;
        };
      }
    ) 5  # Generate 5 workers
  );
}
```

---

## 5. Provisioning Scripts

### Initial Provision (host-side)

```bash
#!/usr/bin/env bash
# scripts/provision.sh
# Usage: microvm-provision <vm-name> [--host <host-ip>]

set -euo pipefail

VM_NAME="${1:?Usage: microvm-provision <vm-name>}"
HOST="${2:-localhost}"

echo "==> Building VM configuration for ${VM_NAME}..."
nix build ".#nixosConfigurations.${VM_NAME}.config.system.build.toplevel" \
  --no-link --print-out-paths

if [ "$HOST" != "localhost" ]; then
  echo "==> Deploying to remote host ${HOST}..."
  nixos-rebuild switch \
    --flake ".#hypervisor-1" \
    --target-host "root@${HOST}" \
    --build-host "root@${HOST}"
else
  echo "==> Applying locally..."
  sudo nixos-rebuild switch --flake ".#hypervisor-1"
fi

echo "==> Checking VM status..."
systemctl status "microvm@${VM_NAME}" --no-pager || true

echo "==> Done. VM ${VM_NAME} is provisioned."
```

### Reprovision (nixos-anywhere style nuke-and-pave)

```bash
#!/usr/bin/env bash
# scripts/reprovision.sh
# Usage: microvm-reprovision <vm-name> [--host <host-ip>]
#
# Stops the VM, wipes its state, rebuilds from template, restarts.
# This is the "nixos-anywhere thought process" applied to MicroVMs.

set -euo pipefail

VM_NAME="${1:?Usage: microvm-reprovision <vm-name>}"
HOST="${2:-localhost}"

run_on_host() {
  if [ "$HOST" = "localhost" ]; then
    sudo bash -c "$1"
  else
    ssh "root@${HOST}" "$1"
  fi
}

echo "==> Phase 1/4: Stop VM ${VM_NAME}"
run_on_host "systemctl stop microvm@${VM_NAME}" || true

echo "==> Phase 2/4: Wipe stateful data"
STATE_DIR="/var/lib/microvms/${VM_NAME}"
run_on_host "
  if [ -d '${STATE_DIR}' ]; then
    echo '  Removing ${STATE_DIR}...'
    rm -rf '${STATE_DIR}'
    mkdir -p '${STATE_DIR}'
  fi
"

echo "==> Phase 3/4: Rebuild configuration"
if [ "$HOST" != "localhost" ]; then
  nixos-rebuild switch \
    --flake ".#hypervisor-1" \
    --target-host "root@${HOST}" \
    --build-host "root@${HOST}"
else
  sudo nixos-rebuild switch --flake ".#hypervisor-1"
fi

echo "==> Phase 4/4: Start VM ${VM_NAME}"
run_on_host "systemctl start microvm@${VM_NAME}"

echo "==> Reprovision complete. VM ${VM_NAME} is fresh."
```

### SSH-into-guest reprovision (true nixos-anywhere mode)

```bash
#!/usr/bin/env bash
# scripts/reprovision-via-ssh.sh
# For VMs with their own block devices and SSH access.
# Uses nixos-anywhere to completely reinstall the guest OS.

set -euo pipefail

VM_NAME="${1:?Usage: reprovision-via-ssh <vm-name> <guest-ip>}"
GUEST_IP="${2:?Provide guest IP address}"

echo "==> Running nixos-anywhere against guest ${VM_NAME} @ ${GUEST_IP}"
nix run github:nix-community/nixos-anywhere -- \
  --flake ".#${VM_NAME}" \
  "root@${GUEST_IP}" \
  --build-on-remote

echo "==> Guest ${VM_NAME} has been reprovisioned via nixos-anywhere."
```

---

## 6. Disko Layouts (for Stateful VMs)

```nix
# disko/single-volume.nix
{ lib, ... }:
{
  disko.devices.disk.data = {
    type = "disk";
    device = lib.mkDefault "/dev/vdb";
    content = {
      type = "gpt";
      partitions = {
        data = {
          size = "100%";
          content = {
            type = "filesystem";
            format = "ext4";
            mountpoint = "/var/lib/data";
            mountOptions = [ "noatime" ];
          };
        };
      };
    };
  };
}
```

---

## 7. Host Configuration

```nix
# hosts/hypervisor-1/default.nix
{ config, lib, pkgs, ... }:
{
  networking.hostName = "hypervisor-1";

  # Bridge for MicroVM TAP interfaces
  networking.bridges.br0.interfaces = [ "eno1" ];
  networking.interfaces.br0.ipv4.addresses = [{
    address = "192.168.50.1";
    prefixLength = 24;
  }];

  # NAT for VM internet access
  networking.nat = {
    enable = true;
    internalInterfaces = [ "br0" ];
    externalInterface = "eno1";
  };

  # Enable virtiofs for nix store sharing
  virtualisation.microvm.host.enable = true;

  # Auto-start all declared VMs
  systemd.services = lib.mapAttrs' (name: _: {
    name = "microvm@${name}";
    value = { wantedBy = [ "multi-user.target" ]; };
  }) config.microvm.vms;

  system.stateVersion = "25.11";
}
```

---

## 8. Integration Test

```nix
# tests/vm-test.nix
{ self, nixpkgs, ... }:

nixpkgs.lib.nixos.runTest {
  name = "microvm-anywhere-basic";

  nodes.host = { config, ... }: {
    imports = [ self.nixosConfigurations.hypervisor-1.config ];
  };

  testScript = ''
    host.wait_for_unit("multi-user.target")

    # Verify web VM started
    host.wait_for_unit("microvm@web-1")
    host.succeed("ping -c1 192.168.50.10")

    # Verify db VM started
    host.wait_for_unit("microvm@db-primary")
    host.succeed("ping -c1 192.168.50.20")

    # Verify nginx is responding inside web VM
    host.succeed("curl -sf http://192.168.50.10/ | grep microvm-anywhere")
  '';
}
```

---

## Workflow Summary

```
                  ┌─────────────────────────────────┐
                  │         Template Modules         │
                  │  base.nix → web.nix / db.nix ... │
                  └──────────┬──────────────────────┘
                             │
                             ▼
                  ┌─────────────────────────────────┐
                  │     lib/make-microvm.nix         │
                  │  (factory function: name, ip,    │
                  │   mac, template, disko, ...)     │
                  └──────────┬──────────────────────┘
                             │
                             ▼
                  ┌─────────────────────────────────┐
                  │    hosts/*/vms.nix               │
                  │  (VM manifest per host)          │
                  └──────────┬──────────────────────┘
                             │
              ┌──────────────┼───────────────┐
              ▼              ▼               ▼
    ┌──────────────┐ ┌─────────────┐ ┌──────────────┐
    │   Provision  │ │ Reprovision │ │ Reprovision  │
    │  (host-side  │ │ (host-side  │ │ (SSH into    │
    │  rebuild)    │ │ wipe+start) │ │  guest, run  │
    │              │ │             │ │  nixos-       │
    │ nixos-rebuild│ │ stop → rm → │ │  anywhere)   │
    │ switch       │ │ rebuild →   │ │              │
    │              │ │ start       │ │              │
    └──────────────┘ └─────────────┘ └──────────────┘
```

---

## Key Design Decisions

**Why templates as NixOS modules (not Packer/OCI images)?**
Templates are evaluated at build time, not baked as snapshots. Changing
a template and rebuilding produces a bit-for-bit reproducible new image.
No drift, no stale base images.

**Why `lib.mkDefault` in templates?**
Allows instance-level overrides without conflicts. A template sets
sensible defaults; the VM manifest can override any of them.

**Why three reprovision paths?**
Different situations call for different approaches. Host-side rebuild
is fastest (no SSH into guest). Host-side wipe is the full nuke-and-pave.
SSH-via-nixos-anywhere is for VMs with real block devices that need
repartitioning via disko.

**Why impermanence?**
Ensures VMs boot clean every time. Only explicitly declared state
persists. This makes reprovisioning safe — you know exactly what
you're wiping and what you're keeping.

**Why generate workers with `genList`?**
Demonstrates that Nix's functional nature lets you treat VMs as
data. A fleet of 50 identical workers is one number change.
