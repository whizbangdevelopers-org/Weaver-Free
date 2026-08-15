// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// Where `scan` reads a discovered MicroVM's specs from.
//
// This file exists because the directory was HARDCODED to `/var/lib/microvms` while every other
// consumer of that path already read `config.microvmsDir`. On a host that moved its state
// directory, the read failed, the catch returned defaults, and the workload registered as
// `0 vCPU / 0 MB / unknown` — with no error anywhere. The VM appeared in the UI with no specs,
// and its CPU chart was empty forever, because `weaver_workload_vcpus` is only published for a
// positive vCPU count and the CPU rate has nothing to normalise by.
//
// The assertion that matters is therefore about the PATH REQUESTED, not just the parsed result:
// a test that only checked the returned vcpu would pass against the hardcoded version whenever
// the fixture happened to use the default directory.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkloadRegistry, WorkloadDefinition } from '../../src/storage/workload-registry.js'

vi.mock('node:child_process', () => ({ execFile: vi.fn() }))
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  readFile: vi.fn(),
}))

import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { scanMicrovms, setRegistry, setConfig } from '../../src/services/microvm.js'
import type { DashboardConfig } from '../../src/config.js'

const mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>

/** A QEMU run script as microvm.nix generates it — only the flags the parser reads. */
const RUN_SCRIPT = [
  '#!/nix/store/xxx-bash/bin/bash',
  'exec /nix/store/yyy-qemu/bin/qemu-system-x86_64 \\',
  '  -smp 4 \\',
  '  -m 2048 \\',
  '  -nographic',
].join('\n')

function mockUnitList(names: string[]) {
  const stdout = names.map(n => `microvm@${n}.service loaded active running MicroVM '${n}'`).join('\n')
  ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (_cmd: string, _args: string[], callback: (e: unknown, r: { stdout: string; stderr: string }) => void) => {
      callback(null, { stdout, stderr: '' })
    }
  )
}

function makeRegistry(): WorkloadRegistry & { added: WorkloadDefinition[] } {
  const vms: Record<string, WorkloadDefinition> = {}
  const added: WorkloadDefinition[] = []
  return {
    added,
    init: async () => {},
    getAll: async () => ({ ...vms }),
    get: async (n: string) => vms[n] ?? null,
    has: async (n: string) => n in vms,
    add: async (vm: WorkloadDefinition) => { vms[vm.name] = vm; added.push(vm); return true },
    remove: async () => true,
    update: async () => true,
  } as unknown as WorkloadRegistry & { added: WorkloadDefinition[] }
}

const configWith = (microvmsDir: string) => ({
  microvmsDir,
  systemctlBin: 'systemctl',
}) as unknown as DashboardConfig

describe('scanMicrovms — reading specs from the configured state directory', () => {
  let registry: ReturnType<typeof makeRegistry>

  beforeEach(() => {
    vi.resetAllMocks()
    registry = makeRegistry()
    setRegistry(registry)
    mockUnitList(['probe'])
  })

  it('reads the run script from config.microvmsDir, NOT a hardcoded /var/lib/microvms', async () => {
    // The regression assertion. Checking only the parsed vcpu below would pass against the
    // hardcoded version too, because this fixture returns the same script for any path.
    setConfig(configWith('/data/microvms'))
    mockReadFile.mockResolvedValue(RUN_SCRIPT)

    await scanMicrovms()

    expect(mockReadFile).toHaveBeenCalledWith(
      '/data/microvms/probe/current/bin/microvm-run',
      'utf-8'
    )
    expect(mockReadFile).not.toHaveBeenCalledWith(
      expect.stringContaining('/var/lib/microvms/'),
      expect.anything()
    )
  })

  it('parses vCPU, memory and hypervisor off the run script', async () => {
    setConfig(configWith('/data/microvms'))
    mockReadFile.mockResolvedValue(RUN_SCRIPT)

    await scanMicrovms()

    expect(registry.added[0]).toMatchObject({
      name: 'probe', vcpu: 4, mem: 2048, hypervisor: 'qemu',
    })
  })

  it('still uses /var/lib/microvms when that IS the configured directory', async () => {
    // The IGNORE half: the default must keep working, or the fix trades one wrong path for another.
    setConfig(configWith('/var/lib/microvms'))
    mockReadFile.mockResolvedValue(RUN_SCRIPT)

    await scanMicrovms()

    expect(mockReadFile).toHaveBeenCalledWith(
      '/var/lib/microvms/probe/current/bin/microvm-run',
      'utf-8'
    )
  })

  it('falls back to the default directory when no config has been set', async () => {
    // `setConfig` is called at startup, but the service is importable without it and the old
    // code had no config dependency at all. Absent config must not crash the scan.
    setConfig(undefined as unknown as DashboardConfig)
    mockReadFile.mockResolvedValue(RUN_SCRIPT)

    await scanMicrovms()

    expect(mockReadFile).toHaveBeenCalledWith(
      '/var/lib/microvms/probe/current/bin/microvm-run',
      'utf-8'
    )
  })

  it('registers 0/0/unknown when the script is unreadable — and that is the silent failure', async () => {
    // Documents the behaviour rather than endorsing it: an unreadable script is indistinguishable
    // from a VM that genuinely has no specs. It is why a WRONG path produced no error for as long
    // as it did, and why the path assertion above is the real guard.
    setConfig(configWith('/data/microvms'))
    mockReadFile.mockRejectedValue(new Error('ENOENT'))

    await scanMicrovms()

    expect(registry.added[0]).toMatchObject({ vcpu: 0, mem: 0, hypervisor: 'unknown' })
  })

  it('parses a cloud-hypervisor script too', async () => {
    setConfig(configWith('/data/microvms'))
    mockReadFile.mockResolvedValue(
      'exec /nix/store/z-cloud-hypervisor/bin/cloud-hypervisor --cpus boot=2 --memory size=512M'
    )

    await scanMicrovms()

    expect(registry.added[0]).toMatchObject({ vcpu: 2, mem: 512, hypervisor: 'cloud-hypervisor' })
  })
})
