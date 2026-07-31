// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// Gap 3 of agents/v1.1.0/container-visibility.md — the NixOS module declares which container
// runtimes Weaver scans. The UNSET-vs-EMPTY distinction below is the load-bearing part: get it
// wrong in either direction and either a dev box silently stops scanning containers, or a NixOS
// host that declared none scans two it does not have.
import { describe, it, expect } from 'vitest'
import { parseContainerRuntimes } from '../../src/config.js'

describe('parseContainerRuntimes', () => {
  it('UNSET keeps the historical behaviour — docker + podman', () => {
    // A dev box or non-NixOS install has no CONTAINER_RUNTIMES; it must keep scanning as before.
    expect(parseContainerRuntimes(undefined)).toEqual(['docker', 'podman'])
  })

  it('SET BUT EMPTY means none — MicroVMs only', () => {
    // The NixOS module always exports the var, even as "". An operator who declared no runtimes
    // must not get the legacy fallback: that would scan two binaries the host may not have.
    expect(parseContainerRuntimes('')).toEqual([])
  })

  it('parses a declared list, trimming and lower-casing', () => {
    expect(parseContainerRuntimes('docker,podman')).toEqual(['docker', 'podman'])
    expect(parseContainerRuntimes(' Docker , APPTAINER ')).toEqual(['docker', 'apptainer'])
  })

  it('accepts apptainer — it is declarable even before the scan branch exists', () => {
    expect(parseContainerRuntimes('apptainer')).toEqual(['apptainer'])
  })

  it('drops an unknown name rather than throwing', () => {
    // Read at startup: refusing to boot because a config names a runtime this build does not
    // know is a worse failure than scanning one fewer runtime.
    expect(parseContainerRuntimes('docker,kubernetes,podman')).toEqual(['docker', 'podman'])
    expect(parseContainerRuntimes('nonsense')).toEqual([])
  })

  it('preserves declared order and is pure', () => {
    expect(parseContainerRuntimes('podman,docker')).toEqual(['podman', 'docker'])
    expect(parseContainerRuntimes('docker')).toEqual(parseContainerRuntimes('docker'))
  })
})
