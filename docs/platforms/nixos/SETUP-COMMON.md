<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Common Setup: Networking, Provisioning, and Reference

This document covers the shared configuration steps that apply to all NixOS setup methods. Your method-specific guide ([Flakes](SETUP-FLAKES.md) or [Traditional](SETUP-TRADITIONAL.md)) will reference sections here.

---

## Bridge Networking

MicroVMs connect to the host via TAP interfaces attached to a bridge. Choose one of the two approaches below.

### Option A: systemd-networkd bridge (recommended)

```nix
systemd.network = {
  enable = true;
  netdevs."10-br-microvm" = {
    netdevConfig = {
      Name = "br-microvm";
      Kind = "bridge";
    };
  };
  networks."10-br-microvm" = {
    matchConfig.Name = "br-microvm";
    networkConfig = {
      Address = "10.10.0.1/24";
      DHCPServer = false;
    };
  };
};

# Disable wait-online -- bridge has no carrier until VMs start
systemd.network.wait-online.enable = false;
```

### Option B: networking.bridges (simpler)

```nix
networking.bridges.br-microvm.interfaces = [];
networking.interfaces.br-microvm.ipv4.addresses = [{
  address = "10.10.0.1";
  prefixLength = 24;
}];
```

> **Note:** The NixOS module with `provisioningEnabled = true` automatically configures Option B using the `bridgeInterface` and `bridgeGateway` settings. You only need to add bridge configuration manually if you want the systemd-networkd approach or if you are setting things up without the module.

### NAT and Routing (required for both options)

```nix
networking.nat = {
  enable = true;
  internalInterfaces = [ "br-microvm" ];
  externalInterface = "enp0s25";  # Set to your WAN interface
};

boot.kernel.sysctl."net.ipv4.ip_forward" = 1;

# Trust bridge traffic through firewall
networking.firewall.trustedInterfaces = [ "br-microvm" ];
```

> Replace `enp0s25` with your actual WAN interface name. Find it with `ip route show default`.

---

## Network Layout

```
Host (10.10.0.1) --- br-microvm --+-- vm-web-nginx  (10.10.0.10)  TAP
                                   +-- vm-web-app    (10.10.0.11)  TAP
                                   +-- vm-dev-node   (10.10.0.20)  TAP
                                   +-- vm-my-arch    (10.10.0.50)  TAP
                      NAT -------- Internet (via enp0s25)
```

Each VM gets a TAP interface (`vm-<name>`, max 15 chars) attached to the bridge. The dashboard assigns static IPs within the `10.10.0.0/24` subnet.

---

## How Provisioning Works

The dashboard provisioner supports two backends. Both produce `microvm@<name>.service` systemd units, so start/stop/restart works identically regardless of guest type.

### NixOS VMs (distro = `nixos` or unset)

1. Dashboard generates `flake.nix` in `/var/lib/microvms/<name>/`
2. Runs `sudo microvm -c <name> -f /var/lib/microvms/<name>/`
3. This creates `microvm@<name>.service` via the microvm.nix host module
4. VM is started/stopped via `systemctl start/stop microvm@<name>`

Supported hypervisors: qemu, cloud-hypervisor, firecracker, crosvm, kvmtool, stratovirt, alioth

### Non-NixOS VMs (distro = arch, fedora, ubuntu, debian, alpine)

1. Dashboard downloads the cloud image to `/var/lib/weaver/images/`
2. Creates a CoW overlay disk in `/var/lib/microvms/<name>/`
3. Generates cloud-init ISO (hostname, networking, SSH)
4. Writes a custom `microvm@<name>.service` unit that runs QEMU directly
5. Installs unit to `/etc/systemd/system/` via sudo, reloads systemd

These VMs use QEMU only (not microvm.nix hypervisors).

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PREMIUM_ENABLED` | `false` | Enable VM registration CRUD |
| `PROVISIONING_ENABLED` | `true` | Enable actual VM provisioning |
| `MICROVMS_DIR` | `/var/lib/microvms` | VM data directory |
| `BRIDGE_GATEWAY` | `10.10.0.1` | Bridge IP (VM default gateway) |
| `BRIDGE_INTERFACE` | `br-microvm` | Bridge interface name |
| `SUDO_PATH` | `sudo` | Path to sudo binary (NixOS: `/run/wrappers/bin/sudo`) |
| `SYSTEMCTL_PATH` | `systemctl` | Path to systemctl binary (NixOS: `/run/current-system/sw/bin/systemctl`) |
| `IPTABLES_PATH` | `iptables` | Path to iptables binary (NixOS: `/run/current-system/sw/bin/iptables`) |
| `MICROVM_BIN` | `/run/current-system/sw/bin/microvm` | microvm CLI path |
| `QEMU_BIN` | `/run/current-system/sw/bin/qemu-system-x86_64` | QEMU binary path |
| `QEMU_IMG_BIN` | `/run/current-system/sw/bin/qemu-img` | qemu-img binary path |
| `IP_BIN` | `/run/current-system/sw/bin/ip` | ip command path |
| `VM_STORAGE_BACKEND` | `json` | Registry backend (`json` or `sqlite`) |
| `VM_DATA_DIR` | `./data` | Dashboard data directory |

> **Note:** The NixOS module automatically sets `SUDO_PATH`, `SYSTEMCTL_PATH`, and `IPTABLES_PATH` to NixOS-specific store paths. These are configured in the module — no manual override needed.

---

## Troubleshooting

### EACCES: permission denied on data directory

```
errno: -13, code: 'EACCES', path: '/var/lib/weaver/vms.json'
```

The data directory owner doesn't match the service user. This happens when switching between dev and production modes. Fix:

1. Set `serviceUser` and `serviceGroup` to match the account running the service (see your method-specific guide for the Service User Configuration section)
2. After changing, run: `sudo systemd-tmpfiles --create && sudo systemctl restart weaver`

### "microvm: command not found"

The `microvm.nix` host module is not imported. See the setup guide for your configuration method:
- **Flakes:** Import `microvm.nixosModules.host` in your flake modules ([SETUP-FLAKES.md](SETUP-FLAKES.md))
- **Traditional:** Import the microvm.nix module via `fetchTarball` ([SETUP-TRADITIONAL.md](SETUP-TRADITIONAL.md))

### Bridge has no IP / NO-CARRIER

Normal when no VMs are running. The bridge gets a carrier when the first TAP interface comes up. Verify the IP is assigned: `ip addr show br-microvm`.

### Permission denied on /dev/kvm

Ensure the dashboard user is in the `kvm` group. Check with `id weaver`.

### VMs can't reach the internet

1. Verify `networking.nat.externalInterface` is set to your WAN interface
2. Check IP forwarding: `sysctl net.ipv4.ip_forward` should return `1`
3. Check NAT rules: `sudo iptables -t nat -L POSTROUTING`

### "genisoimage: command not found"

The `cdrkit` package must be in the service's `path`. This is required for generating cloud-init ISOs. If using the NixOS module, this is handled automatically when `provisioningEnabled = true`.

### Provisioning stuck at "Building MicroVM"

NixOS VM builds download and compile Nix closures. First build can take 10+ minutes. Check the provisioning log in the dashboard's Logs tab, or `cat /var/lib/weaver/logs/<name>.log`.
