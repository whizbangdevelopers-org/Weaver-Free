// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Firmware and guest-driver resolution — the pure half of Windows UEFI support.
 *
 * Two things a guest needs that the existing IDE+e1000 path deliberately did without:
 *
 *  - **UEFI firmware.** Windows 11 will not install on SeaBIOS at all. UEFI on QEMU means OVMF:
 *    a read-only CODE image plus a WRITABLE per-VM VARS image holding that machine's boot
 *    entries and (if Secure Boot) its key enrolment.
 *  - **VirtIO drivers.** The IDE + e1000 defaults exist so Windows installs with no driver disk,
 *    at roughly a fifth of the I/O throughput. Getting the speed back needs virtio-win attached
 *    as a second CDROM at install time.
 *
 * The rule that ties them together, and the one this module exists to make impossible to get
 * wrong: **a Windows guest gets virtio disk and network IF AND ONLY IF the virtio-win ISO is
 * attached.** Flip the disk to virtio without the drivers and Windows Setup boots, enumerates no
 * disks, and reports "we couldn't find any drives" — which reads as a broken image rather than a
 * missing driver, and is the single most common way this feature is mis-shipped.
 */

/** Where the host keeps its OVMF images. Supplied by the NixOS module; absent on non-NixOS hosts. */
export interface OvmfPaths {
  /** Read-only firmware executable, shared by every VM. */
  code: string
  /** Template variable store. COPIED per VM — never attached directly. */
  varsTemplate: string
}

export interface FirmwareRequest {
  /** 'bios' (SeaBIOS, the default) or 'uefi' (OVMF). */
  firmware?: 'bios' | 'uefi'
  guestOs?: 'linux' | 'windows'
  /** Attach the virtio-win driver ISO as a second CDROM. */
  virtioDrivers?: boolean
}

export type FirmwarePlan =
  | { mode: 'bios' }
  | {
      mode: 'uefi'
      /** Read-only, shared. */
      code: string
      /** The template to copy from on first boot. */
      varsTemplate: string
      /** The per-VM writable copy this VM must use. */
      vars: string
    }

/**
 * Why a firmware request cannot be honoured, or null when it can.
 *
 * Returns a reason string rather than throwing: the caller decides the status code, exactly as
 * the clone seam does. A missing OVMF on a non-NixOS host is a 400 the user can act on ("install
 * OVMF"), not a 500.
 */
export function firmwareRejectionReason(
  req: FirmwareRequest,
  ovmf: OvmfPaths | null,
): string | null {
  const wantsUefi = req.firmware === 'uefi'
  if (wantsUefi && !ovmf) {
    return 'UEFI firmware requested but no OVMF image is available on this host. Install OVMF (NixOS: virtualisation.weaver enables it) or use firmware: "bios".'
  }
  if (req.virtioDrivers && req.guestOs !== 'windows') {
    // Linux guests already carry virtio in-kernel; the driver ISO is inert weight and an extra
    // CDROM that shifts device ordering for no gain.
    return 'The VirtIO driver ISO applies to Windows guests only — Linux guests have VirtIO in-kernel.'
  }
  return null
}

/**
 * Resolve the firmware plan for one VM.
 *
 * `varsDir` is the VM's own directory. The VARS copy lives there and nowhere else: a VARS image
 * shared between two VMs has them overwriting each other's boot entries, which presents as one
 * VM intermittently failing to boot after the other is installed — a genuinely miserable bug to
 * track down from the symptom.
 */
export function resolveFirmware(
  req: FirmwareRequest,
  ovmf: OvmfPaths | null,
  varsDir: string,
): FirmwarePlan {
  if (req.firmware !== 'uefi' || !ovmf) return { mode: 'bios' }
  return {
    mode: 'uefi',
    code: ovmf.code,
    varsTemplate: ovmf.varsTemplate,
    vars: `${varsDir}/OVMF_VARS.fd`,
  }
}

export interface GuestDeviceModel {
  /** QEMU `if=` value for the primary disk. */
  diskInterface: 'ide' | 'virtio'
  /** QEMU `-device` model for the NIC. */
  netDevice: 'e1000' | 'virtio-net-pci'
  /** Attach the virtio-win ISO as an additional CDROM. */
  attachVirtioIso: boolean
}

/**
 * Pick the disk and network device models.
 *
 * Windows is the only guest with a choice to make, and the choice is not free-standing — see the
 * iff above. Linux is always virtio: every supported cloud image carries the drivers in-kernel,
 * so there has never been a reason to hand it emulated hardware.
 */
export function resolveGuestDevices(req: FirmwareRequest): GuestDeviceModel {
  if (req.guestOs !== 'windows') {
    return { diskInterface: 'virtio', netDevice: 'virtio-net-pci', attachVirtioIso: false }
  }
  if (req.virtioDrivers) {
    return { diskInterface: 'virtio', netDevice: 'virtio-net-pci', attachVirtioIso: true }
  }
  return { diskInterface: 'ide', netDevice: 'e1000', attachVirtioIso: false }
}

/**
 * The `-machine` value.
 *
 * `smm=on` is not cosmetic and is not optional-with-a-warning: without System Management Mode the
 * firmware cannot protect the variable store, so an OVMF built for Secure Boot will either refuse
 * to enrol keys or accept writes from the guest — which is Secure Boot that reports success and
 * enforces nothing. Turning it on for every UEFI VM costs nothing and removes the possibility.
 */
export function machineFlags(plan: FirmwarePlan): string {
  return plan.mode === 'uefi' ? 'q35,accel=kvm,smm=on' : 'q35,accel=kvm'
}

/**
 * The pflash pair, in order. Empty for BIOS.
 *
 * Order is load-bearing — QEMU assigns unit numbers by position, and firmware expects CODE at
 * unit 0 and VARS at unit 1. Swapped, the VM boots to a blank screen with no diagnostic.
 */
export function pflashArgs(plan: FirmwarePlan): string[] {
  if (plan.mode === 'bios') return []
  return [
    '-drive', `if=pflash,format=raw,unit=0,readonly=on,file=${plan.code}`,
    '-drive', `if=pflash,format=raw,unit=1,file=${plan.vars}`,
  ]
}

/** Where one VM's emulated TPM lives. */
export interface TpmPaths {
  /** swtpm's persistent state — NVRAM, EK, the enrolment a BitLocker key is sealed against. */
  stateDir: string
  /** The control socket QEMU connects to. */
  socketPath: string
}

export function tpmPaths(vmDir: string): TpmPaths {
  return { stateDir: `${vmDir}/tpm`, socketPath: `${vmDir}/tpm/swtpm-sock` }
}

/**
 * Argv for the swtpm process backing one VM.
 *
 * `--tpm2` is not a default — swtpm speaks TPM **1.2** without it, and Windows 11 requires 2.0.
 * The failure is exact and unhelpful: the device appears, the guest enumerates it, and Setup
 * still reports the machine unsupported.
 */
export function swtpmArgs(paths: TpmPaths): string[] {
  return [
    'socket',
    '--tpmstate', `dir=${paths.stateDir}`,
    '--ctrl', `type=unixio,path=${paths.socketPath}`,
    '--tpm2',
  ]
}

/**
 * QEMU args attaching the emulated TPM. Empty when there is none.
 *
 * `tpm-tis` rather than `tpm-crb`: both are TPM 2.0 interfaces and Windows accepts either, but
 * TIS is what OVMF's TCG driver probes first, so it is the combination with the fewest ways to
 * present as a missing TPM.
 */
export function tpmArgs(paths: TpmPaths | null): string[] {
  if (!paths) return []
  return [
    '-chardev', `socket,id=chrtpm,path=${paths.socketPath}`,
    '-tpmdev', 'emulator,id=tpm0,chardev=chrtpm',
    '-device', 'tpm-tis,tpmdev=tpm0',
  ]
}
