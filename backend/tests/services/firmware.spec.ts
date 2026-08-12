// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect } from 'vitest'
import {
  firmwareRejectionReason,
  resolveFirmware,
  resolveGuestDevices,
  machineFlags,
  pflashArgs,
  tpmPaths,
  swtpmArgs,
  tpmArgs,
  type OvmfPaths,
} from '../../src/services/firmware.js'

const OVMF: OvmfPaths = {
  code: '/nix/store/xxx-OVMF/FV/OVMF_CODE.fd',
  varsTemplate: '/nix/store/xxx-OVMF/FV/OVMF_VARS.fd',
}

describe('firmwareRejectionReason', () => {
  it('accepts BIOS on a host with no OVMF at all', () => {
    expect(firmwareRejectionReason({ firmware: 'bios' }, null)).toBeNull()
  })

  it('accepts an absent firmware field — BIOS is the default, not an error', () => {
    expect(firmwareRejectionReason({}, null)).toBeNull()
  })

  it('rejects UEFI when the host has no OVMF, and names the fix', () => {
    const reason = firmwareRejectionReason({ firmware: 'uefi' }, null)
    expect(reason).toContain('OVMF')
    // The message has to be actionable: a user on a non-NixOS host needs to know both escapes.
    expect(reason).toContain('bios')
  })

  it('accepts UEFI once OVMF is available', () => {
    expect(firmwareRejectionReason({ firmware: 'uefi' }, OVMF)).toBeNull()
  })

  it('rejects the VirtIO driver ISO on a Linux guest', () => {
    const reason = firmwareRejectionReason({ guestOs: 'linux', virtioDrivers: true }, OVMF)
    expect(reason).toContain('Windows')
  })

  it('rejects the VirtIO driver ISO when no guest OS is declared', () => {
    // Absent guestOs means Linux everywhere else in the provisioner; it must mean Linux here too,
    // or the default silently becomes the Windows path.
    expect(firmwareRejectionReason({ virtioDrivers: true }, OVMF)).not.toBeNull()
  })

  it('accepts the VirtIO driver ISO on a Windows guest', () => {
    expect(firmwareRejectionReason({ guestOs: 'windows', virtioDrivers: true }, OVMF)).toBeNull()
  })
})

describe('resolveFirmware', () => {
  it('returns BIOS when UEFI was not asked for', () => {
    expect(resolveFirmware({ firmware: 'bios' }, OVMF, '/var/lib/microvms/win11')).toEqual({
      mode: 'bios',
    })
  })

  it('falls back to BIOS when OVMF is absent rather than emitting an unusable UEFI plan', () => {
    // The rejection above is what stops a UEFI request reaching here. If one ever does, a BIOS
    // plan boots something; a UEFI plan naming files that do not exist fails inside QEMU with a
    // message the user cannot act on.
    expect(resolveFirmware({ firmware: 'uefi' }, null, '/var/lib/microvms/win11')).toEqual({
      mode: 'bios',
    })
  })

  it('puts the writable VARS copy inside the VM directory, never the shared template', () => {
    const plan = resolveFirmware({ firmware: 'uefi' }, OVMF, '/var/lib/microvms/win11')
    expect(plan).toMatchObject({ mode: 'uefi', code: OVMF.code, varsTemplate: OVMF.varsTemplate })
    if (plan.mode !== 'uefi') throw new Error('expected uefi')
    expect(plan.vars).toBe('/var/lib/microvms/win11/OVMF_VARS.fd')
    expect(plan.vars).not.toBe(plan.varsTemplate)
  })

  it('gives two VMs two different VARS files', () => {
    // A shared VARS store has each VM overwriting the other's boot entries — presenting as one VM
    // intermittently failing to boot after the other is installed.
    const a = resolveFirmware({ firmware: 'uefi' }, OVMF, '/var/lib/microvms/a')
    const b = resolveFirmware({ firmware: 'uefi' }, OVMF, '/var/lib/microvms/b')
    if (a.mode !== 'uefi' || b.mode !== 'uefi') throw new Error('expected uefi')
    expect(a.vars).not.toBe(b.vars)
  })
})

describe('resolveGuestDevices — the iff', () => {
  it('gives Linux virtio and never the driver ISO', () => {
    expect(resolveGuestDevices({ guestOs: 'linux' })).toEqual({
      diskInterface: 'virtio',
      netDevice: 'virtio-net-pci',
      attachVirtioIso: false,
    })
  })

  it('gives Windows IDE + e1000 when the driver ISO is not attached', () => {
    // Slow, and the only combination that installs with no driver disk.
    expect(resolveGuestDevices({ guestOs: 'windows' })).toEqual({
      diskInterface: 'ide',
      netDevice: 'e1000',
      attachVirtioIso: false,
    })
  })

  it('gives Windows virtio ONLY together with the driver ISO', () => {
    expect(resolveGuestDevices({ guestOs: 'windows', virtioDrivers: true })).toEqual({
      diskInterface: 'virtio',
      netDevice: 'virtio-net-pci',
      attachVirtioIso: true,
    })
  })

  it('never produces a virtio disk for Windows without the ISO, across every input shape', () => {
    // The iff, asserted as a property rather than as three examples — this is the combination
    // that boots Windows Setup to "we couldn't find any drives", and it must be unreachable.
    for (const firmware of ['bios', 'uefi'] as const) {
      for (const virtioDrivers of [true, false, undefined]) {
        const d = resolveGuestDevices({ guestOs: 'windows', firmware, virtioDrivers })
        expect(d.diskInterface === 'virtio').toBe(d.attachVirtioIso)
        expect(d.netDevice === 'virtio-net-pci').toBe(d.attachVirtioIso)
      }
    }
  })
})

describe('machineFlags', () => {
  it('leaves SMM off for BIOS', () => {
    expect(machineFlags({ mode: 'bios' })).toBe('q35,accel=kvm')
  })

  it('turns SMM on for UEFI', () => {
    // Without SMM the firmware cannot protect the variable store, so Secure Boot reports success
    // and enforces nothing.
    const flags = machineFlags({
      mode: 'uefi',
      code: OVMF.code,
      varsTemplate: OVMF.varsTemplate,
      vars: '/v/OVMF_VARS.fd',
    })
    expect(flags).toContain('smm=on')
    expect(flags).toContain('q35')
  })
})

describe('pflashArgs', () => {
  it('emits nothing for BIOS', () => {
    expect(pflashArgs({ mode: 'bios' })).toEqual([])
  })

  it('emits CODE at unit 0 read-only and VARS at unit 1 writable, in that order', () => {
    const args = pflashArgs({
      mode: 'uefi',
      code: OVMF.code,
      varsTemplate: OVMF.varsTemplate,
      vars: '/v/OVMF_VARS.fd',
    })
    expect(args).toEqual([
      '-drive', `if=pflash,format=raw,unit=0,readonly=on,file=${OVMF.code}`,
      '-drive', 'if=pflash,format=raw,unit=1,file=/v/OVMF_VARS.fd',
    ])
  })

  it('never marks the VARS store read-only', () => {
    // A read-only VARS store makes the firmware unable to persist a boot entry, so the VM
    // installs Windows successfully and then boots to the UEFI shell forever after.
    const args = pflashArgs({
      mode: 'uefi',
      code: OVMF.code,
      varsTemplate: OVMF.varsTemplate,
      vars: '/v/OVMF_VARS.fd',
    })
    const varsArg = args.find(a => a.includes('unit=1'))
    expect(varsArg).toBeDefined()
    expect(varsArg).not.toContain('readonly')
  })
})

describe('TPM', () => {
  it('keeps state and socket inside the VM directory', () => {
    const p = tpmPaths('/var/lib/microvms/win11')
    expect(p.stateDir).toBe('/var/lib/microvms/win11/tpm')
    expect(p.socketPath).toBe('/var/lib/microvms/win11/tpm/swtpm-sock')
  })

  it('gives two VMs separate TPM state', () => {
    // Sharing NVRAM between guests would share the endorsement key — and a BitLocker volume
    // sealed against it would unseal on the wrong machine.
    expect(tpmPaths('/m/a').stateDir).not.toBe(tpmPaths('/m/b').stateDir)
  })

  it('always asks swtpm for TPM 2.0', () => {
    // Without --tpm2 swtpm speaks 1.2, the device still appears, and Windows 11 Setup still
    // reports the machine unsupported — a failure that looks like no TPM at all.
    expect(swtpmArgs(tpmPaths('/m/a'))).toContain('--tpm2')
  })

  it('points swtpm at the VM state dir and control socket', () => {
    const args = swtpmArgs(tpmPaths('/m/a'))
    expect(args[0]).toBe('socket')
    expect(args).toContain('dir=/m/a/tpm')
    expect(args).toContain('type=unixio,path=/m/a/tpm/swtpm-sock')
  })

  it('emits nothing when there is no TPM', () => {
    expect(tpmArgs(null)).toEqual([])
  })

  it('wires the chardev, tpmdev and device to each other', () => {
    const args = tpmArgs(tpmPaths('/m/a'))
    expect(args.join(' ')).toBe(
      '-chardev socket,id=chrtpm,path=/m/a/tpm/swtpm-sock ' +
      '-tpmdev emulator,id=tpm0,chardev=chrtpm ' +
      '-device tpm-tis,tpmdev=tpm0',
    )
  })
})
