// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// IMMUTABLE CONTRACT — forge-loop fixture for sample v1.1-vm-clone.
// Implement the pure helpers in src/services/microvm.ts to satisfy this. Do NOT modify this file.
//
// v1.1.0 "Also Shipping": VM clone/template. Today the UI renders a live Clone button
// (VmDetailPanel.vue) that prompts for a name and then returns "VM clone not yet implemented" on
// any real backend — POST /api/workload/:name/clone does not exist. A button that always fails is
// worse than an absent one, because the user cannot tell a broken feature from a broken host.
//
// Everything here is a PURE function over plain values, so the suite is deterministic and needs no
// hypervisor, no registry and no filesystem.
import { describe, it, expect } from 'vitest'
import { cloneRejectionReason, deriveClonedDefinition } from '../../src/services/microvm.js'

const source = {
  name: 'web-nginx',
  ip: '10.10.0.10',
  mem: 512,
  vcpu: 2,
  hypervisor: 'qemu',
  autostart: true,
  description: 'front end',
  tags: ['web', 'prod'],
  macAddress: '52:54:00:aa:bb:cc',
  tapInterface: 'vm-web-nginx',
}

describe('cloneRejectionReason — the guard, before anything is created', () => {
  it('accepts a well-formed clone of a stopped VM', () => {
    expect(
      cloneRejectionReason({ source, targetName: 'web-nginx-clone', existingNames: ['web-nginx'], status: 'stopped' }),
    ).toBeNull()
  })

  it('rejects a target name that already exists', () => {
    const r = cloneRejectionReason({
      source,
      targetName: 'dev-node',
      existingNames: ['web-nginx', 'dev-node'],
      status: 'stopped',
    })
    expect(r).toBeTruthy()
    expect(String(r)).toMatch(/exists/i)
  })

  // The name reaches a filesystem path and a systemd unit. Anything outside the charset is a
  // rejection, never a sanitisation — silently rewriting a name creates a workload the user did
  // not ask for and cannot find.
  it.each([
    ['../etc/passwd', 'path traversal'],
    ['Web-Nginx', 'uppercase'],
    ['9lives', 'leading digit'],
    ['has space', 'space'],
    ['semi;colon', 'shell metacharacter'],
    ['', 'empty'],
  ])('rejects target name %s (%s)', (bad) => {
    expect(
      cloneRejectionReason({ source, targetName: bad, existingNames: [], status: 'stopped' }),
    ).toBeTruthy()
  })

  it('rejects cloning onto the source name itself', () => {
    expect(
      cloneRejectionReason({ source, targetName: 'web-nginx', existingNames: ['web-nginx'], status: 'stopped' }),
    ).toBeTruthy()
  })

  // Cloning a running VM would copy a disk mid-write. Refuse; do not "best effort" it.
  it('rejects cloning a running VM', () => {
    expect(
      cloneRejectionReason({ source, targetName: 'web-nginx-clone', existingNames: ['web-nginx'], status: 'running' }),
    ).toBeTruthy()
  })

  it('rejects when the source is absent', () => {
    expect(
      cloneRejectionReason({ source: null, targetName: 'anything', existingNames: [], status: 'stopped' }),
    ).toBeTruthy()
  })

  // Clone is a VM operation. A container is reproduced from its image, not by copying a disk.
  it('rejects cloning a container workload', () => {
    expect(
      cloneRejectionReason({
        source: { ...source, runtime: 'docker' },
        targetName: 'web-nginx-clone',
        existingNames: ['web-nginx'],
        status: 'stopped',
      }),
    ).toBeTruthy()
  })
})

describe('deriveClonedDefinition — what the copy inherits, and what it must not', () => {
  const clone = deriveClonedDefinition(source, 'web-nginx-clone', '10.10.0.99')

  it('takes the new name and the new IP', () => {
    expect(clone.name).toBe('web-nginx-clone')
    expect(clone.ip).toBe('10.10.0.99')
  })

  it('inherits the resource shape', () => {
    expect(clone.mem).toBe(512)
    expect(clone.vcpu).toBe(2)
    expect(clone.hypervisor).toBe('qemu')
  })

  // Identity is per-instance. A copied MAC collides on the bridge and a copied tap name collides
  // in the kernel — both fail at boot, far from the clone that caused them.
  //
  // `in`, not toBeUndefined(). Run 1 (2026-08-10) satisfied toBeUndefined() with
  // `{ ...source, macAddress: undefined }`, which leaves an own enumerable key holding undefined.
  // JSON serialisation happens to drop it, so nothing broke — but the assertion could not see the
  // difference, and a persistence layer iterating Object.entries would write a NULL.
  it('never copies per-instance identity — the keys are ABSENT, not undefined', () => {
    expect('macAddress' in clone).toBe(false)
    expect('tapInterface' in clone).toBe(false)
  })

  // THE ALLOWLIST TEST. Run 1 implemented this as a spread-then-blank denylist, which passes every
  // field-by-field assertion and still carried consolePort (a per-instance allocated port that
  // collides exactly as a copied MAC does — the very class the spec described), plus
  // provisioningState "provisioned" and a stale provisioningError from the source.
  //
  // A denylist also inherits, silently, every field added to WorkloadDefinition after this is
  // written. So the contract is the complete key set, not a sample of it.
  it('carries ONLY the allowlisted fields — nothing inherited by accident', () => {
    const full = {
      ...source,
      diskSize: 20,
      distro: 'nixos',
      guestOs: 'linux',
      vmType: 'server',
      bridge: 'br-microvm',
      consoleType: 'vnc',
      consolePort: 5901,
      cloudInit: true,
      provisioningState: 'provisioned',
      provisioningError: 'disk image fetch failed',
    }
    const c = deriveClonedDefinition(full, 'web-nginx-clone', '10.10.0.99')

    // Per-instance allocations and lifecycle state belong to the source instance alone.
    for (const forbidden of [
      'macAddress',
      'tapInterface',
      'consolePort',
      'provisioningState',
      'provisioningError',
      'containerId',
      'image',
      'ports',
    ]) {
      expect(`${forbidden}:${forbidden in c}`).toBe(`${forbidden}:false`)
    }

    // And the positive half: an allowlist that dropped something useful is also wrong.
    expect(c.mem).toBe(512)
    expect(c.vcpu).toBe(2)
    expect(c.hypervisor).toBe('qemu')
    expect(c.diskSize).toBe(20)
    expect(c.distro).toBe('nixos')
  })

  // A clone that autostarts is a surprise reboot behaviour the user never chose.
  it('does not inherit autostart', () => {
    expect(clone.autostart).toBeFalsy()
  })

  it('does not mutate the source definition', () => {
    expect(source.name).toBe('web-nginx')
    expect(source.macAddress).toBe('52:54:00:aa:bb:cc')
  })

  it('is pure — same input, same output', () => {
    expect(deriveClonedDefinition(source, 'web-nginx-clone', '10.10.0.99')).toEqual(clone)
  })
})
