<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Compatibility Matrix

This document is the **single source of truth** for Weaver's hardware, platform, and BIOS compatibility. The README contains a condensed summary table synced from this document — run `npm run audit:compatibility` to verify parity.

---

## Table of Contents

- [Platform Support](#platform-support)
- [Architecture Support](#architecture-support)
- [Hardware Feature Requirements](#hardware-feature-requirements)
- [NixOS Version Support](#nixos-version-support)
- [Cloud Provider Compatibility](#cloud-provider-compatibility)
- [BIOS Configuration Reference](#bios-configuration-reference)
- [Pre-Installation Verification](#pre-installation-verification)

---

## Platform Support

<!-- SYNC:PLATFORM_TABLE:START -->
| Platform | Architecture | Dashboard | Provisioning | Device Passthrough | Status |
|----------|-------------|-----------|-------------|-------------------|--------|
| NixOS 25.11+ bare metal | x86_64 | Full | Full | Full (IOMMU required) | Supported |
| NixOS 25.11+ VM (cloud/nested) | x86_64 | Full | Nested virt required | No | Supported |
| NixOS 25.11+ bare metal | aarch64 | Full | Experimental | No | Community |
| Docker (any Linux) | x86_64 | Full | Dashboard only | No | Supported |
| Docker (any Linux) | aarch64 | Full | Dashboard only | No | Community |
<!-- SYNC:PLATFORM_TABLE:END -->

**Status definitions:**

| Status | Meaning |
|--------|---------|
| **Supported** | Tested in CI, covered by release checklist, eligible for support |
| **Community** | Known to work, not tested in CI, community-contributed fixes accepted |
| **Experimental** | May work, no guarantees, breaking changes possible |
| **Unsupported** | Known incompatible or untested — use at your own risk |

---

## Architecture Support

| Architecture | Dashboard | MicroVM Provisioning | Notes |
|-------------|-----------|---------------------|-------|
| **x86_64** (Intel/AMD 64-bit) | Yes | Yes | Primary target. Full KVM + QEMU support |
| **aarch64** (ARM 64-bit) | Yes | Experimental | NixOS aarch64 builds work; QEMU guest support varies by hypervisor |
| **RISC-V** | No | No | NixOS has early RISC-V support; Weaver is untested. Not recommended |
| **i686** (32-bit x86) | No | No | Unsupported. NixOS has dropped most i686 support |

---

## Hardware Feature Requirements

| Feature | Required For | How to Check | Impact If Missing |
|---------|-------------|-------------|-------------------|
| **Intel VT-x / AMD-V** | KVM acceleration | `grep -cE 'vmx\|svm' /proc/cpuinfo` | VMs run 10-50x slower (QEMU TCG fallback) |
| **Intel VT-d / AMD-Vi (IOMMU)** | Device passthrough | `ls /sys/class/iommu/` or `dmesg \| grep -i iommu` | No GPU/NIC/USB passthrough to VMs |
| **Nested virtualization** | Running inside a VM | `cat /sys/module/kvm_intel/parameters/nested` | Cannot provision VMs from a cloud VPS without enabling nested virt |
| **AES-NI** | Encrypted workloads | `grep -c aes /proc/cpuinfo` | Slower disk encryption; no functional impact on Weaver |
| **KVM kernel module** | VM provisioning | `lsmod \| grep kvm` | `/dev/kvm` unavailable; provisioning disabled |
| **Bridge networking** | VM connectivity | `modprobe bridge && echo OK` | VMs cannot communicate with host or external network |

### Minimum Hardware

| Resource | Dashboard Only | With Provisioning |
|----------|---------------|-------------------|
| CPU | 1 vCPU | 2+ vCPU |
| RAM | 1 GB | 2 GB + VM memory |
| Disk | 500 MB | 500 MB + VM images |
| Network | Port 3100 | Port 3100 + bridge interface |

---

## NixOS Version Support

| NixOS Version | Status | Notes |
|--------------|--------|-------|
| **25.11** | Supported (minimum) | Current stable baseline |
| **26.05** | Supported (when released) | Tested on release; docs updated |
| **26.11** | Future | Minimum bumps to 26.05 when 26.11 drops |
| **nixpkgs-unstable** | Unsupported | May work; pin to specific commit for reproducibility |
| **24.11 and older** | Unsupported | May work but no testing or fixes |

**Upgrade cadence:** NixOS publishes two stable releases per year (May and November). Weaver supports the current stable + previous stable, giving users a 6-month overlap to upgrade.

---

## Cloud Provider Compatibility

Running Weaver inside a cloud VM requires **nested virtualization** for MicroVM provisioning. Dashboard-only mode works everywhere.

| Provider | Nested Virt | How to Enable | Provisioning Works |
|----------|------------|---------------|-------------------|
| **Hetzner Cloud** | Yes (dedicated) | Dedicated CPU instances only; shared vCPU lacks KVM | Yes (dedicated CPU) |
| **Hetzner Bare Metal** | N/A (native) | Native KVM, no nesting needed | Yes |
| **DigitalOcean** | No | Not available on standard droplets | Dashboard only |
| **AWS EC2** | Yes (metal/bare) | `.metal` instance types, or enable nested virt on Nitro | Yes (`.metal` instances) |
| **AWS EC2 (standard)** | Limited | Nitro-based instances with `--cpu-options` | Check instance type |
| **Vultr** | Yes (bare metal) | Bare metal plans only | Yes (bare metal) |
| **OVHcloud** | Yes (dedicated) | Dedicated servers with KVM | Yes |
| **Proxmox (self-hosted)** | Yes | Enable in VM config: `cpu: host`, `args: -cpu host` | Yes |

> **Tip:** If you only need the dashboard (no provisioning), any cloud VM with NixOS or Docker works. Nested virt is only required for creating and running MicroVMs.

---

## BIOS Configuration Reference

MicroVM provisioning requires hardware virtualization support enabled in BIOS/UEFI. Device passthrough additionally requires IOMMU.

### Intel Systems — Enable VT-x

| Vendor | BIOS Path | Setting Name |
|--------|-----------|-------------|
| **Dell** | BIOS Setup → Advanced → Virtualization Support | Virtualization → **Enabled** |
| **HP / HPE** | BIOS Setup → Security → System Security | Virtualization Technology (VTx) → **Enabled** |
| **Lenovo** | BIOS Setup → Security → Virtualization | Intel Virtualization Technology → **Enabled** |
| **Supermicro** | Advanced → CPU Configuration | Intel Virtualization Technology → **Enabled** |
| **ASUS** | Advanced → CPU Configuration | Intel Virtualization Technology → **Enabled** |
| **Gigabyte** | BIOS → Tweaker → Advanced CPU Settings | Intel VT-x → **Enabled** |
| **MSI** | OC → CPU Features | Intel Virtualization Tech → **Enabled** |
| **ASRock** | Advanced → CPU Configuration | Intel Virtualization Technology → **Enabled** |
| **AMI BIOS (generic)** | Advanced → Processor Configuration | Intel Virtualization Technology → **Enabled** |

### AMD Systems — Enable AMD-V (SVM)

| Vendor | BIOS Path | Setting Name |
|--------|-----------|-------------|
| **Dell** | BIOS Setup → Advanced → Virtualization Support | Virtualization → **Enabled** |
| **HP / HPE** | BIOS Setup → Security → System Security | Virtualization Technology (AMD-V) → **Enabled** |
| **Lenovo** | BIOS Setup → Security → Virtualization | AMD SVM Technology → **Enabled** |
| **Supermicro** | Advanced → CPU Configuration | SVM Mode → **Enabled** |
| **ASUS** | Advanced → CPU Configuration | SVM Mode → **Enabled** |
| **Gigabyte** | BIOS → Tweaker → Advanced CPU Settings | SVM Mode → **Enabled** |
| **MSI** | OC → CPU Features | SVM Mode → **Enabled** |
| **ASRock** | Advanced → CPU Configuration | SVM Mode → **Enabled** |

### Enable IOMMU (VT-d / AMD-Vi) — Required for Device Passthrough

| Vendor | BIOS Path | Setting Name |
|--------|-----------|-------------|
| **Dell** | BIOS Setup → Advanced → Virtualization Support | VT for Direct I/O → **Enabled** |
| **HP / HPE** | BIOS Setup → Security → Device Security | VT-d / IOMMU → **Enabled** |
| **Lenovo** | BIOS Setup → Security → Virtualization | VT-d / AMD-Vi → **Enabled** |
| **Supermicro** | Advanced → Chipset Configuration → NB Configuration | VT-d → **Enabled** |
| **ASUS** | Advanced → System Agent (SA) Configuration | VT-d → **Enabled** |
| **Gigabyte** | BIOS → Settings → Miscellaneous | IOMMU → **Enabled** |
| **MSI** | OC → CPU Features | Intel VT-d / AMD IOMMU → **Enabled** |
| **ASRock** | Advanced → Chipset Configuration | VT-d / IOMMU → **Enabled** |

> **After enabling IOMMU in BIOS**, also add `intel_iommu=on` (Intel) or `amd_iommu=on` (AMD) to your kernel boot parameters. On NixOS: `boot.kernelParams = [ "intel_iommu=on" ];`

### Secure Boot

NixOS supports Secure Boot via [Lanzaboote](https://github.com/nix-community/lanzaboote). Weaver has no Secure Boot dependency — it works with Secure Boot enabled or disabled. If your BIOS requires Secure Boot for compliance, enable it independently of Weaver.

---

## Pre-Installation Verification

### Automated Pre-Flight Check

Run the pre-flight script before installing Weaver to verify hardware readiness:

```bash
# Download and run (no installation required)
curl -fsSL https://raw.githubusercontent.com/whizbangdevelopers-org/Weaver-Free/main/scripts/preflight-check.sh | bash
```

Or clone the repo and run locally:

```bash
./scripts/preflight-check.sh
```

The script checks: CPU architecture, virtualization extensions, KVM availability, IOMMU, RAM, disk space, NixOS version, and network bridge support. Each check reports PASS, WARN, or FAIL with actionable remediation steps.

### Post-Installation Diagnostics

After installing Weaver, use the built-in doctor endpoint to verify system health:

```bash
# Via API (requires admin authentication)
curl -H "Authorization: Bearer <token>" http://localhost:3100/api/system/doctor

# Via the web UI: Settings → System Health → Run Diagnostics
```

The doctor runs all pre-flight checks plus Weaver-specific checks: SQLite connectivity, WebSocket health, bridge reachability, QEMU availability, license status, and tier-capability alignment.

### Manual Verification

```bash
# CPU virtualization
grep -cE 'vmx|svm' /proc/cpuinfo          # Should be > 0

# KVM
ls -la /dev/kvm                             # Should exist and be readable
lsmod | grep kvm                            # kvm_intel or kvm_amd loaded

# IOMMU (optional — for device passthrough)
ls /sys/class/iommu/ 2>/dev/null            # Non-empty if IOMMU active
dmesg | grep -i iommu                       # Look for "IOMMU enabled"

# NixOS version
nixos-version                               # Should be 25.11+

# Memory
free -h                                     # 2 GB+ recommended

# Disk
df -h /                                     # 500 MB+ free

# Bridge support
modprobe bridge && echo "Bridge support OK" # Should print OK
```
