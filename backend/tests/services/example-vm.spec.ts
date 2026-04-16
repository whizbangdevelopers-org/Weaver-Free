// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkloadRegistry, WorkloadDefinition } from '../../src/storage/workload-registry.js'
import type { Provisioner } from '../../src/services/provisioner-types.js'
import type { DashboardConfig } from '../../src/config.js'
import { provisionExampleVm, EXAMPLE_VM_NAME } from '../../src/services/example-vm.js'

function createMockRegistry(vms: Record<string, WorkloadDefinition> = {}): WorkloadRegistry {
  const store = { ...vms }
  return {
    init: async () => {},
    getAll: async () => ({ ...store }),
    get: async (name: string) => store[name] ?? null,
    has: async (name: string) => name in store,
    add: async (vm: WorkloadDefinition) => { store[vm.name] = vm; return true },
    remove: async (name: string) => { if (!store[name]) return false; delete store[name]; return true },
    update: async () => true,
  }
}

function createMockProvisioner(): Provisioner {
  return {
    provision: vi.fn(async () => {}),
    destroy: vi.fn(async () => {}),
    autostartCloudVms: vi.fn(async () => {}),
    startCloudVm: vi.fn(async () => ({ success: true, message: 'ok' })),
    stopCloudVm: vi.fn(async () => ({ success: true, message: 'ok' })),
    getCloudVmStatus: vi.fn(() => 'stopped' as const),
    getCloudVmUptime: vi.fn(() => null),
    isCloudDistro: vi.fn(() => true),
    isIsoDistro: vi.fn(() => false),
    isFlakeDistro: vi.fn(() => false),
    isQemuVm: vi.fn(() => true),
    getConsolePort: vi.fn(async () => null),
    getLog: vi.fn(async () => ''),
  }
}

const baseConfig: DashboardConfig = {
  tier: 'weaver',
  licenseExpiry: null,
  licenseGraceMode: false,
  storageBackend: 'json',
  dataDir: '/tmp/test-data',
  provisioningEnabled: true,
  microvmsDir: '/var/lib/microvms',
  bridgeGateway: '10.10.0.1',
  bridgeInterface: 'br-microvm',
  sudoBin: '/usr/bin/sudo',
  systemctlBin: '/usr/bin/systemctl',
  iptablesBin: '/usr/bin/iptables',
  qemuBin: '/usr/bin/qemu-system-x86_64',
  qemuImgBin: '/usr/bin/qemu-img',
  ipBin: '/usr/bin/ip',
  distroCatalogUrl: null,
  jwtSecret: 'test-secret',
  sessionStoreType: 'memory',
  notify: { ntfyUrl: null, ntfyTopic: null, ntfyToken: null },
}

const log = { info: vi.fn(), error: vi.fn() }

describe('provisionExampleVm', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('skips when provisioning is disabled', async () => {
    const registry = createMockRegistry()
    const provisioner = createMockProvisioner()
    await provisionExampleVm(registry, provisioner, { ...baseConfig, provisioningEnabled: false }, log)
    expect(provisioner.provision).not.toHaveBeenCalled()
  })

  it('skips when example VM already exists in registry', async () => {
    const registry = createMockRegistry({
      [EXAMPLE_VM_NAME]: { name: EXAMPLE_VM_NAME, ip: '10.10.0.100', mem: 128, vcpu: 1, hypervisor: 'qemu' },
    })
    const provisioner = createMockProvisioner()
    await provisionExampleVm(registry, provisioner, baseConfig, log)
    expect(provisioner.provision).not.toHaveBeenCalled()
  })

  it('skips when IP 10.10.0.100 is already allocated', async () => {
    const registry = createMockRegistry({
      'other-vm': { name: 'other-vm', ip: '10.10.0.100', mem: 512, vcpu: 1, hypervisor: 'qemu' },
    })
    const provisioner = createMockProvisioner()
    await provisionExampleVm(registry, provisioner, baseConfig, log)
    expect(provisioner.provision).not.toHaveBeenCalled()
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('IP'))
  })

  it('registers, provisions, and starts when all conditions met', async () => {
    const registry = createMockRegistry()
    const provisioner = createMockProvisioner()
    await provisionExampleVm(registry, provisioner, baseConfig, log)
    // Let fire-and-forget promise chain settle
    await vi.waitFor(() => {
      expect(provisioner.startCloudVm).toHaveBeenCalledWith(EXAMPLE_VM_NAME)
    })
    expect(await registry.has(EXAMPLE_VM_NAME)).toBe(true)
    expect(provisioner.provision).toHaveBeenCalledWith(EXAMPLE_VM_NAME)
  })

  it('sets correct VM definition fields', async () => {
    const registry = createMockRegistry()
    const provisioner = createMockProvisioner()
    await provisionExampleVm(registry, provisioner, baseConfig, log)
    const vm = await registry.get(EXAMPLE_VM_NAME)
    expect(vm).toMatchObject({
      name: EXAMPLE_VM_NAME,
      ip: '10.10.0.100',
      mem: 128,
      vcpu: 1,
      distro: 'cirros',
      autostart: true,
      provisioningState: 'provisioning',
      bridge: 'br-microvm',
    })
  })

  it('handles provisioner.provision rejection gracefully', async () => {
    const registry = createMockRegistry()
    const provisioner = createMockProvisioner()
    ;(provisioner.provision as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('QEMU not found'))
    // Should not throw — fire-and-forget with catch
    await provisionExampleVm(registry, provisioner, baseConfig, log)
    expect(await registry.has(EXAMPLE_VM_NAME)).toBe(true)
  })
})
