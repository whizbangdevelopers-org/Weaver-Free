<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
<string>:60: SyntaxWarning: invalid escape sequence '\|'
MicroVM in NixOS
Architecture, Networking, Storage, and Multi-VM Flake Patterns

**Last updated:** 2026-03-21

# 1. What Is MicroVM.nix?
MicroVM.nix is a NixOS flake that lets you declaratively define and run lightweight virtual machines using hypervisors optimized for speed and minimal overhead. Unlike full QEMU/KVM VMs (heavy, slow to start) or containers (shared kernel), MicroVMs use hardware virtualization with stripped-down firmware, no BIOS/UEFI boot sequence, and a minimal device model. They boot in milliseconds.

The key insight: the guest root filesystem is a Nix store path. The entire OS is built by Nix, immutable, and can be shared read-only across multiple VMs. No disk image management, no stale state, no configuration drift.

# 2. Supported Hypervisors
MicroVM.nix supports several backends. Choose based on your use case:

| Hypervisor | Boot Speed | Primary Use Case | Notes |
| --- | --- | --- | --- |
| cloud-hypervisor | Very fast | Production workloads | Rust-based, actively maintained |
| firecracker | Fastest (~125ms) | Lambda-style isolation | AWS origin, minimal attack surface |
| qemu | Moderate | Most compatible | Best for debugging, broadest device support |
| kvmtool | Fast | Minimal footprint | Simpler than QEMU, good for dev |
| stratovirt | Fast | Embedded/edge | Huawei's Firecracker alternative |
| crosvm | Fast | Sandboxed services | ChromeOS origin, good security model |

# 3. Architecture Deep Dive
Understanding how MicroVM.nix works internally is key to using it effectively.

## 3.1 Build-Time vs. Run-Time
At build time, Nix evaluates your VM configuration and produces a derivation: a complete NixOS system closure. This includes the kernel, initrd, and root filesystem (squashfs, erofs, or ext4). These are immutable Nix store paths.

At run time, the hypervisor is launched with this pre-built image. No package installation, no firstboot scripts, no mutable state in the rootfs. The VM either works or it doesn’t — reproducibly.

## 3.2 System Diagram

```
Host NixOS (e.g., king / Forge)
│
├── microvm.nix flake module
│   ├── Evaluates VM NixOS configurations at build time
│   ├── Produces squashfs/erofs/ext4 rootfs as Nix store paths
│   └── Generates systemd units: microvm@<name>.service
│
└── Hypervisor process (cloud-hypervisor / firecracker / qemu)
├── Launches guest kernel directly (no firmware/BIOS boot)
├── Shares /nix/store via virtiofs (read-only)
├── Writable volumes as image files on host
└── Guest NixOS runs in full kernel isolation

```

## 3.3 Root Filesystem Formats

| Format | Type | Best For |
| --- | --- | --- |
| squashfs | Read-only compressed | Minimal RAM usage, read-heavy workloads |
| erofs | Read-only, faster | Better random-access performance than squashfs |
| ext4 | Read-write | Mutable rootfs (less common, breaks immutability model) |

The recommended pattern is a read-only rootfs format (squashfs or erofs) combined with writable volumes for /var, /etc, and other mutable paths.

# 4. Filesystem Strategy
This is one of MicroVM’s cleverest aspects. The host Nix store is shared into every VM, so closures are not duplicated.

## 4.1 Store Sharing via virtiofs
```
/nix/store  (host)  ──virtiofs──▶  /nix/.ro-store  (guest, read-only)
│
overlay mount
│
/nix/store (guest, writable overlay)

/var, /etc  ────────────────  guest-owned writable volume
(ext4 image file on host filesystem)

```

A NixOS system that would take 1.2GB on disk costs nearly zero additional storage per VM when store sharing is active. Ten VMs running NixOS do not cost ten times the disk space.

## 4.2 Configuring Shares and Volumes
```
microvm = {
# Share host Nix store read-only into guest
shares = [
{
source = "/nix/store";
mountPoint = "/nix/.ro-store";
tag = "ro-store";
proto = "virtiofs";   # or "9p" (slower but more compatible)
}
# Additional host directories can be shared the same way
{
source = "/srv/data";
mountPoint = "/data";
tag = "data";
proto = "virtiofs";
}
];

# Writable volumes (persisted across reboots)
volumes = [
{
image = "var.img";       # path relative to stateDir
mountPoint = "/var";
size = 2048;             # MB
}
];

# Writable tmpfs mounts (lost on reboot, no disk cost)
writableStoreOverlay = "/nix/.rw-store";
};

```

## 4.3 virtiofs vs. 9p

| Protocol | Performance | Compatibility | Recommendation |
| --- | --- | --- | --- |
| virtiofs | Excellent | Requires recent kernel (5.4+) | Use for production |
| 9p | Poor at scale | Very broad | Use only if virtiofs unavailable |

# 5. Networking In Depth
Networking is the area where most MicroVM configuration effort is spent. The right approach depends on your isolation requirements and host network topology.

## 5.1 Networking Options Overview

| Method | Isolation | Performance | Host Config Needed | Use Case |
| --- | --- | --- | --- | --- |
| TAP + bridge | Network-level | Good | Yes (bridge interface) | Most service VMs |
| macvtap | L2 direct | Excellent | Minimal | High-throughput workloads |
| user-mode (SLIRP) | Full NAT | Poor | None | Quick dev/testing |
| vhost-vsock | VM↔host only | Excellent | Minimal | Host↔guest IPC only |
| passt | User-space | Good | None | Rootless networking |

## 5.2 TAP + Bridge Setup (Recommended)
TAP is the most common approach for service VMs that need to participate in your local network or communicate with other VMs.

### Host Bridge Configuration
First, configure a bridge on the host in your NixOS configuration:

```
# In your host NixOS configuration.nix
networking = {
bridges.virbr0.interfaces = [];   # empty = software-only bridge
interfaces.virbr0 = {
ipv4.addresses = [{
address = "10.0.0.1";
prefixLength = 24;
}];
};
};

# Or attach a physical interface to the bridge:
networking.bridges.br0.interfaces = [ "enp3s0" ];

```

### MicroVM TAP Interface Configuration
```
microvm.interfaces = [
{
type = "tap";
id = "vm-myservice";     # TAP device name on host (max 15 chars)
mac = "02:00:00:00:00:01"; # Must be unique per VM
}
];

# Then in the guest NixOS config, configure the interface:
networking = {
interfaces.eth0.ipv4.addresses = [{
address = "10.0.0.10";
prefixLength = 24;
}];
defaultGateway = "10.0.0.1";
nameservers = [ "1.1.1.1" "8.8.8.8" ];
};

```

### Attaching TAP to Bridge
The TAP device created by MicroVM must be added to the bridge. This is done via a systemd service or networkd:

```
# /etc/systemd/network/10-vm-myservice.network  (host)
[Match]
Name = vm-myservice

[Network]
Bridge = virbr0

```

## 5.3 macvtap Setup
macvtap gives each VM its own MAC address on the physical network, with near-native performance. The host and VM cannot directly communicate via macvtap (a macvtap limitation), so use this when VMs need external network access but not host↔VM communication.

```
microvm.interfaces = [
{
type = "macvtap";
id = "vm-myservice";
mac = "02:00:00:00:00:02";
}
];

```

## 5.4 DHCP vs. Static Addressing

```
# Static (recommended for services):
networking.interfaces.eth0.ipv4.addresses = [{
address = "10.0.0.10";
prefixLength = 24;
}];

# DHCP (simpler for dev VMs):
networking.interfaces.eth0.useDHCP = true;

# Or use systemd-networkd (more modern):
systemd.network.enable = true;
systemd.network.networks."10-eth" = {
matchConfig.Name = "eth0";
networkConfig.DHCP = "yes";
};

```

## 5.5 VM-to-VM Networking
Multiple VMs on the same bridge can communicate directly. For more complex topologies, you can create multiple bridges and attach VMs to specific bridges for network segmentation:

```
# Host: two isolated segments
networking.bridges = {
virbr-frontend.interfaces = [];  # 10.0.1.0/24
virbr-backend.interfaces = [];   # 10.0.2.0/24
};

# Frontend VM: only on frontend bridge
# microvm.interfaces -> TAP attached to virbr-frontend

# Backend VM: only on backend bridge
# microvm.interfaces -> TAP attached to virbr-backend

# Gateway VM: two interfaces, one on each bridge
# Acts as router between segments

```

# 6. systemd Integration
MicroVM.nix generates systemd service units on the host to manage VM lifecycle. Understanding this layer lets you control, monitor, and automate your VMs just like any other service.

## 6.1 Generated Unit Structure
```
# MicroVM creates these units for each VM named <name>:

microvm@<name>.service      # Main VM process unit
microvm-tap-<id>@<name>.service  # TAP interface setup (if networking)
microvm-virtiofs-<tag>@<name>.service  # virtiofsd daemon (if shares)

```

## 6.2 Common systemd Commands

| Command | Purpose |
| --- | --- |
| systemctl start microvm@myservice.service | Start a VM |
| systemctl stop microvm@myservice.service | Gracefully stop a VM |
| systemctl restart microvm@myservice.service | Restart a VM |
| systemctl status microvm@myservice.service | Check VM status |
| journalctl -u microvm@myservice.service -f | Follow VM console/logs |
| systemctl enable microvm@myservice.service | Start VM at host boot |

## 6.3 Auto-Start Configuration
To start specific VMs automatically at host boot, use the microvm.autostart option in your host configuration:

```
# In host configuration.nix:
microvm.autostart = [ "myservice" "database" "proxy" ];

```

## 6.4 Updating a Running VM
When you change a VM’s NixOS configuration, the update workflow is:

```
# Rebuild and update the VM (generates new store path, restarts unit)
microvm -u myservice

# Or manually:
nixos-rebuild build --flake .#microvm-myservice
systemctl restart microvm@myservice.service

```

Because the rootfs is immutable, updates are atomic: either the new image boots, or the old one is still there. No partial upgrade state.

## 6.5 Resource Constraints
CPU and memory limits are set in the MicroVM configuration and enforced by the hypervisor, not cgroups. This gives stronger guarantees than container resource limits:

```
microvm = {
vcpu = 2;        # vCPU count
mem = 1024;      # RAM in MB

# For Firecracker: balloon memory (dynamic adjustment):
balloonMem = 256;  # MB that can be reclaimed by host
};

```

# 7. Multi-VM Flake Structure
For a homelab or production setup running multiple VMs, organizing the flake well makes the difference between manageable and chaotic. Here are proven patterns.

## 7.1 Recommended Directory Layout
```
flake.nix
hosts/
king/                   # Host NixOS config
configuration.nix
hardware-configuration.nix
forge/                  # Another host
configuration.nix
microvms/
_base/                  # Shared base module
default.nix
nginx/                  # Individual VM configs
default.nix
database/
default.nix
monitoring/
default.nix
modules/
common.nix              # Shared NixOS options
networking.nix

```

## 7.2 Base Module Pattern
Define a shared base module that all VMs inherit, then override per-VM:

```
# microvms/_base/default.nix
{ config, lib, pkgs, ... }:
{
# Common to all VMs
microvm = {
hypervisor = lib.mkDefault "cloud-hypervisor";
vcpu = lib.mkDefault 1;
mem = lib.mkDefault 512;

shares = [{
source = "/nix/store";
mountPoint = "/nix/.ro-store";
tag = "ro-store";
proto = "virtiofs";
}];
};

# Guest-side: activate the writable store overlay
fileSystems."/nix/.rw-store" = {
fsType = "tmpfs";
options = [ "mode=0755" ];
};

# Every VM gets SSH for management
services.openssh = {
enable = true;
settings.PasswordAuthentication = false;
};

# Common packages
environment.systemPackages = with pkgs; [ htop tcpdump ];

system.stateVersion = "25.11";
}

```

## 7.3 Individual VM Configuration
```
# microvms/nginx/default.nix
{ config, lib, pkgs, ... }:
{
imports = [ ../_base ];

microvm = {
vcpu = 2;
mem = 1024;
interfaces = [{
type = "tap";
id = "vm-nginx";
mac = "02:00:00:00:00:10";
}];
volumes = [{
image = "nginx-var.img";
mountPoint = "/var";
size = 4096;
}];
};

networking = {
hostName = "nginx-vm";
interfaces.eth0.ipv4.addresses = [{
address = "10.0.0.10";
prefixLength = 24;
}];
defaultGateway = "10.0.0.1";
};

services.nginx.enable = true;
}

```

## 7.4 Flake.nix Wiring
The flake ties everything together. This pattern scales to many VMs without repetition:

```
# flake.nix
{
inputs = {
nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
microvm = {
url = "github:astro/microvm.nix";
inputs.nixpkgs.follows = "nixpkgs";
};
};

outputs = { self, nixpkgs, microvm }:
let
system = "x86_64-linux";
pkgs = nixpkgs.legacyPackages.${system};

# Helper: build a MicroVM NixOS config
mkVM = name: extraModules: microvm.lib.microvm {
inherit pkgs;
config.imports = [ ./microvms/${name} ] ++ extraModules;
};
in {

# Host configurations (include microvm host module)
nixosConfigurations.king = nixpkgs.lib.nixosSystem {
inherit system;
modules = [
microvm.nixosModules.host
./hosts/king/configuration.nix
{
microvm.autostart = [ "nginx" "database" "monitoring" ];
microvm.vms = {
nginx     = mkVM "nginx" [];
database  = mkVM "database" [];
monitoring = mkVM "monitoring" [];
};
}
];
};
};
}

```

## 7.5 Running VMs on Multiple Hosts
If you have multiple NixOS hosts (e.g., king and forge), each host defines its own subset of VMs. Share VM configurations via the common microvms/ directory:

```
nixosConfigurations.forge = nixpkgs.lib.nixosSystem {
inherit system;
modules = [
microvm.nixosModules.host
./hosts/forge/configuration.nix
{
# Forge runs different VMs than king
microvm.autostart = [ "cicd" "registry" ];
microvm.vms = {
cicd     = mkVM "cicd" [];
registry = mkVM "registry" [];
};
}
];
};

```

# 8. Practical Tips and Gotchas

## 8.1 Debugging a Failed VM
```
# Check systemd logs for the VM unit
journalctl -u microvm@myservice.service -n 100 --no-pager

# Check virtiofsd if the VM can't find its Nix store
journalctl -u microvm-virtiofs-ro-store@myservice.service

# Run the hypervisor manually for interactive debugging (QEMU example):
$(cat /var/lib/microvms/myservice/current/bin/microvm-run)

```

## 8.2 SSH Into a VM
After the VM has an IP (either static or via DHCP), SSH in normally. Use your host’s authorized_keys in the VM config:

```
# In VM config: pull authorized keys from your user on the host
users.users.root.openssh.authorizedKeys.keyFiles =
[ /etc/ssh/authorized_keys.d/mark ];

# Or hardcode keys:
users.users.root.openssh.authorizedKeys.keys = [
"ssh-ed25519 AAAA... mark@king"
];

```

## 8.3 State Directory
Each VM’s state (writable volume images, current symlink) lives at:

```
/var/lib/microvms/<name>/
current -> /nix/store/...-microvm-<name>/   # symlink to current build
var.img                                      # writable volume
<name>.sock                                  # hypervisor control socket

```

## 8.4 MAC Address Management
MAC addresses must be unique per VM on a given network. Use a consistent scheme:
```
# Suggested scheme: 02:00:00:00:<host-id>:<vm-id>
# 02:xx means locally administered, avoiding conflicts with hardware MACs

# Host 01, VMs 01-FF:
02:00:00:00:01:01   # host 1, vm 1 (nginx)
02:00:00:00:01:02   # host 1, vm 2 (database)
02:00:00:00:02:01   # host 2, vm 1 (cicd)

```

## 8.5 Firecracker Limitations
Firecracker is the fastest hypervisor but has the strictest constraints:
Only virtio-net and virtio-block devices (no virtiofs support)
Store sharing requires 9p instead of virtiofs, which is slower
No USB, no GPU passthrough
Linux guests only
Best suited for short-lived, stateless workloads

## 8.6 Proxmox Coexistence
MicroVM.nix VMs and Proxmox VMs can coexist on the same host. MicroVMs are just processes managed by systemd; they don’t conflict with Proxmox unless they compete for network bridges (virbr0 naming) or CPU/RAM resources. Keep bridge names distinct and monitor host memory pressure.

# 9. Quick Reference

## Minimum Working VM Example
```
# In flake.nix outputs:
microVMs.myvm = microvm.lib.microvm {
pkgs = nixpkgs.legacyPackages.x86_64-linux;
config = {
microvm = {
hypervisor = "cloud-hypervisor";
vcpu = 1;
mem = 512;
shares = [{
source = "/nix/store";
mountPoint = "/nix/.ro-store";
tag = "ro-store";
proto = "virtiofs";
}];
};
fileSystems."/nix/.rw-store" = {
fsType = "tmpfs";
options = [ "mode=0755" ];
};
system.stateVersion = "25.11";
};
};

```

## Key NixOS Options

| Option | Description |
| --- | --- |
| microvm.hypervisor | Backend: cloud-hypervisor, firecracker, qemu, kvmtool, crosvm |
| microvm.vcpu | Number of vCPUs |
| microvm.mem | RAM in MB |
| microvm.shares | List of host directories shared into VM (virtiofs/9p) |
| microvm.volumes | List of writable disk image volumes |
| microvm.interfaces | Network interfaces (tap, macvtap, user) |
| microvm.autostart | List of VM names to auto-start at host boot |
| microvm.stateDir | Host path for VM state (default: /var/lib/microvms) |

# 10. MicroVMs vs Docker Containers
The fundamental difference is the kernel boundary. Docker containers are processes that share the host kernel and rely on Linux namespaces to look isolated. MicroVMs run a separate guest kernel under a hypervisor, so a compromise inside the VM cannot reach the host kernel directly.
The /nix/store virtiofs sharing is a key advantage that Docker cannot match: ten VMs running identical NixOS closures cost essentially the same disk space as one. Docker layer dedup is good, but each container still has a mutable writable layer that can accumulate state. MicroVM’s immutable rootfs combined with explicitly declared writable volumes makes that impossible by construction.
| Category | NixOS MicroVM | Docker Container |
| --- | --- | --- |
| Kernel isolation | Separate guest kernel per VM via hypervisor (KVM) — hardware boundary | All containers share host kernel — namespaces only, no hardware boundary |
| Syscall exposure | Guest kernel mediates all syscalls — host kernel not exposed | Host kernel handles all container syscalls directly (seccomp reduces, not eliminates) |
| Boot time | ~100–500ms — no BIOS/UEFI, kernel boots directly from Nix store path | <100ms — process start only, no kernel boot |
| Memory overhead | Per-VM guest kernel + hypervisor process — minimum ~64–128 MB | Shared kernel — overhead is just the process footprint |
| Resource limits | Hard limits set at hypervisor level (vcpu + mem) — cannot be exceeded | cgroup limits — soft enforcement; misconfiguration allows over-commitment |
| Root filesystem | Immutable squashfs/erofs from Nix store — shared read-only across all VMs via virtiofs | Layered overlayfs — writable top layer per container |
| Storage deduplication | Automatic — /nix/store shared into every VM, 10 VMs cost ~same disk as 1 | Partial — image layers shared, but each container adds its own writable layer |
| Update atomicity | Atomic — new Nix store path built; old one untouched until restart | Pull + restart — partial layer download can leave inconsistent state |
| Reproducibility | Bit-for-bit — Nix pins every dependency; identical builds guaranteed | Good with pinned base images, but apt/pip still hit network at build time |
| Config drift | Impossible — rootfs is read-only; all mutations are in declared volumes | Possible via exec into container; mutable layer persists unexpected changes |
| Networking | TAP/macvtap — VM gets a real virtio NIC, can participate in physical LAN | veth pair into network namespace — NAT by default, host-net mode breaks isolation |
| Lifecycle management | systemd units (microvm@name.service) — journalctl, systemctl | Docker daemon / containerd — docker ps/logs/exec |
| Ecosystem | Nix-native — no registry, no image pull, no Compose files | Vast — Docker Hub, Compose, Swarm, Kubernetes-compatible |
| Ideal workload | Long-running services needing strong isolation, reproducible infra, shared Nix store | Stateless apps, CI runners, microservices, fast horizontal scale |

## 10.1 When to Choose MicroVMs
Choose MicroVMs when security isolation is paramount (multi-tenant workloads, untrusted code execution), when you want the reproducibility guarantees of NixOS applied to your entire service layer, or when running persistent services that benefit from a real kernel boundary. If you are already living in the NixOS/Nix ecosystem and want declarative everything — OS, config, and service definition — MicroVMs are the natural choice.
## 10.2 When to Choose Docker
Choose Docker when you need the fastest possible cold-start or massive horizontal scale. Docker wins decisively if your team expects standard Docker tooling, registries, and Compose workflows, or if workloads are stateless and disposable. Broad ecosystem compatibility with Kubernetes, CI systems, and third-party images is another strong reason to stay with containers.
## 10.3 The Hybrid Pattern
MicroVM processes coexist with Proxmox VMs on the same host (see section 8.6). A practical hybrid for the whizBang! homelab: use MicroVMs for long-running services requiring real isolation (databases, auth services, internal APIs) and Docker or Podman for stateless build and deploy workloads where the Docker ecosystem adds value. This gives the security boundary where it matters without sacrificing Docker’s tooling gravity where isolation is not critical.

# 11. virtiofs DAX and the Docker Advantage
DAX (Direct Access) mode for virtiofs maps Nix store files directly into a shared memory window that the guest reads at CPU speed, with no virtio protocol round-trips. This eliminates the remaining filesystem performance gap between MicroVMs and Docker containers, while preserving full store deduplication across all VMs.
## 11.1 Enabling DAX
Add the dax option to the ro-store share. Requires cloud-hypervisor or QEMU as the hypervisor (Firecracker does not support DAX). cloud-hypervisor is already the recommended backend in section 2.
## 11.2 What DAX Changes in the Comparison
With DAX enabled, store read performance and storage deduplication are no longer meaningful Docker advantages. The remaining Docker wins narrow to cold-start latency (containers are still a process fork, not a kernel boot) and per-instance kernel memory overhead at high VM counts. The table below reflects the updated comparison.
| Category | MicroVM + DAX virtiofs | Docker Container |
| --- | --- | --- |
| Store read performance | RAM speed — host maps store files directly into guest address space via DAX window, no virtio round-trips | RAM speed via host page cache — hot paths served from memory after first read |
| Storage deduplication | Full — /nix/store shared into all VMs; DAX does not duplicate the store into per-VM RAM | Partial — image layers shared, but each container adds a writable layer |
| Kernel isolation | Hard — separate guest kernel, hardware boundary via KVM. Unchanged by DAX. | Soft — shared host kernel, namespaces only |
| Boot time | ~100–500ms — guest kernel still boots regardless of DAX. Docker advantage remains. | <100ms — process fork only, no kernel boot. Docker retains clear advantage. |
| Memory per instance | Guest kernel overhead ~10–20 MB RSS per VM. Significant at 100+ instances. Docker advantage remains. | Near zero — shared kernel, overhead is the process footprint only |
| Reproducibility | Bit-for-bit — Nix pins every dependency. Unchanged by DAX. | Good with pinned images; apt/pip still hit network at build time |
| Ecosystem | Nix-native — no registry, no image pull. DAX does not change this. | Vast — Docker Hub, Compose, Kubernetes. Remains a Docker strength. |
| Hypervisor requirement | DAX requires cloud-hypervisor or QEMU — Firecracker not supported | No hypervisor — containerd / Docker daemon only |

Rows where Docker’s advantage is eliminated with DAX: store read performance, storage deduplication. Rows where Docker retains a meaningful advantage: boot time, per-instance memory overhead at scale, ecosystem.

# 12. Preloading and Hot Reloads
Preloading the DAX window eliminates the remaining I/O component of MicroVM boot time. Combined with DAX virtiofs (section 11), this reduces Docker’s concrete advantages to two: truly cold-start latency at scale, and ecosystem tooling. For persistent-service deployments these are rarely meaningful objections.
## 12.1 Pre-warming the Host Page Cache
The DAX window is backed by the host page cache, so locking store paths into host memory before any VM boots ensures even the first read is served at RAM speed. Use vmtouch for this. To warm the entire store:
```
vmtouch -l -d /nix/store
```

Or more surgically, warm only the closure paths the VMs will actually use:
```
vmtouch -l -d $(nix-store -qR /run/current-system)
```

Wire this into a systemd service ordered before your microvm units:
```
[Unit]
Description=Pre-warm Nix store into page cache
Before=microvm@nginx.service microvm@database.service

[Service]
ExecStart=vmtouch -l -d /nix/store
Type=forking
```

## 12.2 Hot Reloads
MicroVM’s immutable rootfs makes service-level updates faster and safer than Docker image pulls, but live rootfs patching is not supported by design.
Service-level reload (works well): microvm -u myservice builds a new Nix store path on the host, updates the symlink, and restarts the systemd unit atomically. The new store path appears in the DAX window immediately — no image copying or layer rebuilding. This is faster than a Docker pull + restart for any non-trivial image.
Live rootfs patching (not supported): A running squashfs/erofs rootfs cannot be hot-patched — it is read-only by design and the running kernel has pages from it mapped. The MicroVM answer to zero-downtime updates is to run two VMs behind a load balancer and roll one at a time, not to mutate a running image.
## 12.3 Revised Comparison with Preloading
With DAX virtiofs and host page cache pre-warming both active, the comparison shifts further. Docker’s remaining concrete advantages are cold-start latency at scale and ecosystem tooling only.
| Scenario | MicroVM + DAX + Preload | Docker Container |
| --- | --- | --- |
| Warm start I/O | Eliminated — store pre-cached in host memory before VM boots, DAX serves at RAM speed | Fast — host page cache serves hot paths from memory |
| Cold start (no preload) | ~100–500ms kernel boot — Docker retains clear advantage for ephemeral/burst workloads | <100ms process fork — no kernel boot required |
| Service update | Atomic Nix store path swap via microvm -u — new path appears in DAX window instantly, no layer pull | docker pull + restart — partial layer download possible; not atomic |
| Live rootfs patch | Not supported — rootfs is read-only by design; use rolling two-VM pattern for zero-downtime | Possible via exec into container — risky, creates config drift |
| Ecosystem tooling | Nix-native — no registry, no Compose files. Preloading does not change this. | Vast — Docker Hub, Compose, Kubernetes. Remains a Docker strength. |

With DAX + preloading active, Docker’s concrete remaining advantages reduce to cold-start latency at scale and ecosystem tooling. For persistent-service homelab deployments neither is a meaningful objection.

# 13. Eliminating the Cold Boot and Ecosystem Tooling Advantages
After applying DAX virtiofs and host page cache preloading (sections 11 and 12), Docker’s remaining concrete advantages are cold-start latency and ecosystem tooling. Both can be addressed directly.
## 13.1 Eliminating Cold Boot Latency: VM Snapshots
Hypervisor-level memory snapshots are the most powerful technique. Boot the VM once, snapshot its full memory state, then restore from that snapshot for every subsequent start. Restoring from a snapshot is essentially a memory copy, bringing MicroVM start time down to the same order of magnitude as a container fork. This is literally how AWS Lambda works under the hood using Firecracker snapshotting.
Both Firecracker and cloud-hypervisor support snapshotting. The workflow: boot once, allow the guest to complete initialization, then snapshot. All future starts restore from the snapshot rather than booting.
```
# Boot once, finish init, then snapshot
curl -X PUT http://localhost:8080/snapshot/create \
-d '{"snapshot_path": "/var/lib/microvms/myvm/snap.mem",
"mem_file_path": "/var/lib/microvms/myvm/snap.state"}'

# All future starts restore from snapshot
curl -X PUT http://localhost:8080/snapshot/load \
-d '{"snapshot_path": "/var/lib/microvms/myvm/snap.mem",
"mem_file_path": "/var/lib/microvms/myvm/snap.state"}'
```

The snapshot file itself can be pre-warmed into the host page cache with vmtouch alongside the Nix store. At that point cold-start latency for a MicroVM is measured in single-digit milliseconds. One caveat: snapshot state includes network interface and clock state, so interface re-initialization and NTP clock sync are required on restore. cloud-hypervisor provides hooks for both.
## 13.2 Reducing the Ecosystem Tooling Gap
Three complementary approaches address Docker’s tooling ecosystem advantage.
1. Build OCI images from Nix (nix2container / dockerTools)
Nix can produce fully OCI-compatible images, meaning anything built for a MicroVM can also be pushed to Docker Hub or pulled by Kubernetes. The same artifact serves both worlds.
```
pkgs.dockerTools.buildImage {
name     = "myservice";
tag      = "latest";
contents = [ pkgs.nginx ];
}
```

nix2container additionally builds layered OCI images where each Nix store path is a separate layer, so updates push only the changed derivations. This is more efficient than traditional Dockerfile layer caching and fully reproducible.
2. MicroVMs as a container runtime (Kata Containers)
Kata Containers is the most complete ecosystem bridge. It presents itself to Kubernetes as a standard containerd runtime, but each “container” is actually a MicroVM under the hood. The full Kubernetes and Docker Compose toolchain works unchanged — standard kubectl, Docker Hub images, existing CI pipelines — with VM-level isolation underneath. AWS uses this model in EKS Fargate. On a NixOS host, the Kata shim runs as the containerd runtime alongside MicroVM.nix for native NixOS-defined services.
3. Run OCI images inside MicroVM guests (youki / crun)
For teams that need to pull third-party Docker Hub images, a lightweight OCI runtime such as youki or crun can run inside the MicroVM guest. You retain VM-level isolation from the host while consuming any standard OCI image.
## 13.3 Resulting Picture
After applying all techniques across sections 11, 12, and 13, Docker’s remaining advantages are organizational rather than technical: teams already trained on Docker workflows, existing CI pipelines, and third-party vendors shipping Dockerfiles. Those are real friction points but not performance or security arguments.
| Remaining Docker advantage | Technique | Result |
| --- | --- | --- |
| Cold boot latency | VM snapshots (cloud-hypervisor / Firecracker) | Reduced to low single-digit ms — Docker cold-start advantage eliminated |
| Docker Hub / registries | dockerTools.buildImage / nix2container | MicroVM artifacts pushable to any OCI registry — same artifact for both worlds |
| Kubernetes / Compose | Kata Containers containerd shim | Full K8s toolchain with VM isolation underneath — used by AWS EKS Fargate |
| Third-party Docker Hub images | OCI runtime inside guest (youki / crun) | Any OCI image runs inside the VM guest — host isolation fully preserved |
| Organizational familiarity | Training, CI pipeline migration | Organizational friction only — not a performance or security argument |

With sections 11–13 applied in full, every technical Docker advantage has a direct MicroVM countermeasure. What remains is organizational inertia — a migration cost, not a capability gap.

whizBang! Developers LLC — Internal Reference
