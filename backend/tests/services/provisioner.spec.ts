// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { WorkloadRegistry, WorkloadDefinition, ProvisioningState } from '../../src/storage/workload-registry.js'
import type { ImageManager } from '../../src/services/image-manager.js'
import type { DashboardConfig } from '../../src/config.js'

// Mock child_process before importing provisioner
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], callback: (err: unknown, result: { stdout: string; stderr: string }) => void) => {
    callback(null, { stdout: '', stderr: '' })
  }),
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((_event: string, cb: (code: number) => void) => {
      if (_event === 'close') cb(0)
    }),
  })),
}))

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(async () => {}),
  writeFile: vi.fn(async () => {}),
  rm: vi.fn(async () => {}),
  appendFile: vi.fn(async () => {}),
  readFile: vi.fn(async () => 'mock log content'),
}))

import { Provisioner, provisioningEvents } from '../../src/services/weaver/provisioner.js'
import { ImageManager as ImageManagerClass } from '../../src/services/image-manager.js'

// Built-in distro check used in routing tests
const BUILTIN_CLOUD_DISTROS = ImageManagerClass.builtinDistros()

const DEFAULT_CONFIG: DashboardConfig = {
  tier: 'free' as const,
  licenseExpiry: null,
  licenseGraceMode: false,
  storageBackend: 'json',
  dataDir: '/tmp/test-data',
  provisioningEnabled: true,
  microvmsDir: '/var/lib/microvms',
  bridgeGateway: '10.10.0.1',
  bridgeInterface: 'br-microvm',
  qemuBin: '/run/current-system/sw/bin/qemu-system-x86_64',
  qemuImgBin: '/run/current-system/sw/bin/qemu-img',
}

function makeVm(overrides: Partial<WorkloadDefinition> = {}): WorkloadDefinition {
  return {
    name: 'test-vm',
    ip: '10.10.0.50',
    mem: 512,
    vcpu: 2,
    hypervisor: 'qemu',
    distro: 'arch',
    ...overrides,
  }
}

function createMockRegistry(vms: Record<string, WorkloadDefinition> = {}): WorkloadRegistry {
  const store = { ...vms }
  return {
    init: async () => {},
    getAll: async () => ({ ...store }),
    get: async (name: string) => store[name] ?? null,
    has: async (name: string) => name in store,
    add: async (vm: WorkloadDefinition) => {
      store[vm.name] = vm
      return true
    },
    remove: async (name: string) => {
      if (!store[name]) return false
      delete store[name]
      return true
    },
  }
}

function createMockImageManager(): ImageManager {
  return {
    ensureImage: vi.fn(async () => '/tmp/test-data/images/arch-base.qcow2'),
    ensureImageFromUrl: vi.fn(async (_vmName: string, _url: string, format: string) =>
      `/tmp/test-data/images/adhoc-test-vm-base.${format}`),
    createOverlay: vi.fn(async () => '/var/lib/microvms/test-vm/disk.qcow2'),
    createBlankDisk: vi.fn(async () => '/var/lib/microvms/test-vm/disk.qcow2'),
    generateCloudInit: vi.fn(async () => '/var/lib/microvms/test-vm/cloud-init.iso'),
    generateSystemdUnit: vi.fn(() => '[Unit]\nDescription=test\n'),
    isCloudDistro: vi.fn((distro?: string) => {
      if (!distro || distro === 'nixos') return false
      return BUILTIN_CLOUD_DISTROS.includes(distro)
    }),
    isIsoDistro: vi.fn(() => false),
    isFlakeDistro: vi.fn(() => false),
    isQemuVm: vi.fn((distro?: string) => {
      if (!distro || distro === 'nixos') return false
      return BUILTIN_CLOUD_DISTROS.includes(distro)
    }),
    getDistroSource: vi.fn(() => null),
  } as unknown as ImageManager
}

describe('Provisioner', () => {
  let registry: WorkloadRegistry
  let imgMgr: ImageManager
  let provisioner: Provisioner
  let emittedEvents: Array<{ name: string; state: ProvisioningState; progress?: string; error?: string }>

  beforeEach(() => {
    vi.clearAllMocks()
    emittedEvents = []
    provisioningEvents.removeAllListeners()
    provisioningEvents.on('state-change', (event) => {
      emittedEvents.push(event)
    })

    registry = createMockRegistry({
      'arch-vm': makeVm({ name: 'arch-vm', distro: 'arch' }),
      'ubuntu-vm': makeVm({ name: 'ubuntu-vm', distro: 'ubuntu' }),
      'no-distro-vm': makeVm({ name: 'no-distro-vm', distro: undefined }),
    })
    imgMgr = createMockImageManager()
    provisioner = new Provisioner(registry, imgMgr, DEFAULT_CONFIG)
  })

  afterEach(() => {
    provisioningEvents.removeAllListeners()
  })

  describe('provision — Cloud path', () => {
    it('should use image manager for cloud distros', async () => {
      await provisioner.provision('arch-vm')
      expect(imgMgr.ensureImage).toHaveBeenCalledWith('arch')
      expect(imgMgr.createOverlay).toHaveBeenCalled()
      expect(imgMgr.generateCloudInit).toHaveBeenCalled()
    })

    it('should set state to provisioned on success', async () => {
      await provisioner.provision('arch-vm')
      const vm = await registry.get('arch-vm')
      expect(vm!.provisioningState).toBe('provisioned')
    })

    it('should emit provisioning events', async () => {
      await provisioner.provision('arch-vm')
      const states = emittedEvents
        .filter(e => e.name === 'arch-vm')
        .map(e => e.state)
      expect(states).toContain('provisioning')
      expect(states).toContain('provisioned')
    })

    it('should generate MAC address', async () => {
      await provisioner.provision('arch-vm')
      const vm = await registry.get('arch-vm')
      expect(vm!.macAddress).toBeDefined()
      expect(vm!.macAddress!.startsWith('02:')).toBe(true)
    })

    it('should generate TAP name', async () => {
      await provisioner.provision('arch-vm')
      const vm = await registry.get('arch-vm')
      expect(vm!.tapInterface).toBeDefined()
      expect(vm!.tapInterface!.startsWith('vm-')).toBe(true)
    })
  })

  describe('provision — error handling', () => {
    it('should throw for unknown VM', async () => {
      await expect(provisioner.provision('nonexistent')).rejects.toThrow("VM 'nonexistent' not found")
    })

    it('should set state to provision-failed on image download error', async () => {
      ;(imgMgr.ensureImage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('download failed'))
      await provisioner.provision('arch-vm')
      const vm = await registry.get('arch-vm')
      expect(vm!.provisioningState).toBe('provision-failed')
    })

    it('should emit error event on failure', async () => {
      ;(imgMgr.ensureImage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('download error'))
      await provisioner.provision('arch-vm')
      const failEvent = emittedEvents.find(e => e.state === 'provision-failed')
      expect(failEvent).toBeDefined()
      expect(failEvent!.error).toBe('download error')
    })

    it('should set provision-failed when distro is not recognized as cloud, ISO, or flake', async () => {
      await provisioner.provision('no-distro-vm')
      const vm = await registry.get('no-distro-vm')
      expect(vm!.provisioningState).toBe('provision-failed')
      expect(vm!.provisioningError).toContain('Unknown distro type')
    })
  })

  describe('destroy', () => {
    it('should remove VM from registry', async () => {
      await provisioner.destroy('arch-vm')
      const vm = await registry.get('arch-vm')
      expect(vm).toBeNull()
    })

    it('should emit destroying state', async () => {
      await provisioner.destroy('arch-vm')
      const destroyEvent = emittedEvents.find(e => e.name === 'arch-vm' && e.state === 'destroying')
      expect(destroyEvent).toBeDefined()
    })

    it('should throw for unknown VM', async () => {
      await expect(provisioner.destroy('nonexistent')).rejects.toThrow("VM 'nonexistent' not found")
    })
  })

  describe('getLog', () => {
    it('should return log content for a VM', async () => {
      const log = await provisioner.getLog('arch-vm')
      expect(log).toBe('mock log content')
    })

    it('should return empty string if log file does not exist', async () => {
      const { readFile } = await import('node:fs/promises')
      ;(readFile as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ENOENT'))
      const log = await provisioner.getLog('nonexistent')
      expect(log).toBe('')
    })
  })

  describe('provision — console port allocation', () => {
    it('should allocate console port for cloud VMs', async () => {
      const spy = vi.spyOn(ImageManagerClass, 'allocateConsolePort').mockReturnValue(4567)
      await provisioner.provision('arch-vm')
      expect(spy).toHaveBeenCalledWith('arch-vm', 'serial')
      const vm = await registry.get('arch-vm')
      expect(vm!.consolePort).toBe(4567)
      spy.mockRestore()
    })

    it('should set consoleType to serial for server VMs (default)', async () => {
      const spy = vi.spyOn(ImageManagerClass, 'allocateConsolePort').mockReturnValue(4567)
      await provisioner.provision('arch-vm')
      const vm = await registry.get('arch-vm')
      expect(vm!.consoleType).toBe('serial')
      spy.mockRestore()
    })

    it('should set consoleType to vnc for desktop VMs', async () => {
      registry = createMockRegistry({
        'desktop-vm': makeVm({ name: 'desktop-vm', distro: 'arch', vmType: 'desktop' }),
      })
      provisioner = new Provisioner(registry, imgMgr, DEFAULT_CONFIG)

      const spy = vi.spyOn(ImageManagerClass, 'allocateConsolePort').mockReturnValue(5910)
      await provisioner.provision('desktop-vm')
      expect(spy).toHaveBeenCalledWith('desktop-vm', 'vnc')
      const vm = await registry.get('desktop-vm')
      expect(vm!.consoleType).toBe('vnc')
      expect(vm!.consolePort).toBe(5910)
      spy.mockRestore()
    })

    it('should not re-allocate console port if already set', async () => {
      registry = createMockRegistry({
        'prealloc-vm': makeVm({ name: 'prealloc-vm', distro: 'arch', consolePort: 4999 }),
      })
      provisioner = new Provisioner(registry, imgMgr, DEFAULT_CONFIG)

      const spy = vi.spyOn(ImageManagerClass, 'allocateConsolePort')
      await provisioner.provision('prealloc-vm')
      expect(spy).not.toHaveBeenCalled()
      const vm = await registry.get('prealloc-vm')
      expect(vm!.consolePort).toBe(4999)
      spy.mockRestore()
    })
  })

  describe('getConsolePort', () => {
    it('should return null for non-running VM', async () => {
      const port = await provisioner.getConsolePort('arch-vm')
      expect(port).toBeNull()
    })

    it('should return null for unknown VM', async () => {
      const port = await provisioner.getConsolePort('nonexistent')
      expect(port).toBeNull()
    })
  })

  describe('isCloudDistro routing', () => {
    it('should route nixos to non-cloud', () => {
      expect(provisioner.isCloudDistro('nixos')).toBe(false)
    })

    it('should route arch to cloud path', () => {
      expect(provisioner.isCloudDistro('arch')).toBe(true)
    })

    it('should route undefined to non-cloud', () => {
      expect(provisioner.isCloudDistro(undefined)).toBe(false)
    })

    it('should route fedora to cloud path', () => {
      expect(provisioner.isCloudDistro('fedora')).toBe(true)
    })
  })

  describe('isQemuVm — ad-hoc', () => {
    it('should return true for distro "other"', () => {
      expect(provisioner.isQemuVm('other')).toBe(true)
    })
  })

  describe('provision — Ad-hoc path (distro: "other")', () => {
    beforeEach(() => {
      registry = createMockRegistry({
        'adhoc-cloud': makeVm({
          name: 'adhoc-cloud',
          distro: 'other',
          imageUrl: 'https://example.com/my-image.qcow2',
          imageFormat: 'qcow2',
          cloudInit: true,
        }),
        'adhoc-iso': makeVm({
          name: 'adhoc-iso',
          distro: 'other',
          imageUrl: 'https://example.com/installer.iso',
          imageFormat: 'iso',
          cloudInit: false,
        }),
        'adhoc-no-cloudinit': makeVm({
          name: 'adhoc-no-cloudinit',
          distro: 'other',
          imageUrl: 'https://example.com/custom.qcow2',
          imageFormat: 'qcow2',
          cloudInit: false,
        }),
      })
      provisioner = new Provisioner(registry, imgMgr, DEFAULT_CONFIG)
    })

    it('should use ensureImageFromUrl for ad-hoc cloud image', async () => {
      await provisioner.provision('adhoc-cloud')
      expect(imgMgr.ensureImageFromUrl).toHaveBeenCalledWith(
        'adhoc-cloud',
        'https://example.com/my-image.qcow2',
        'qcow2'
      )
      expect(imgMgr.ensureImage).not.toHaveBeenCalled()
    })

    it('should create overlay and cloud-init for ad-hoc cloud image', async () => {
      await provisioner.provision('adhoc-cloud')
      expect(imgMgr.createOverlay).toHaveBeenCalled()
      expect(imgMgr.generateCloudInit).toHaveBeenCalled()
    })

    it('should set state to provisioned on ad-hoc cloud success', async () => {
      await provisioner.provision('adhoc-cloud')
      const vm = await registry.get('adhoc-cloud')
      expect(vm!.provisioningState).toBe('provisioned')
    })

    it('should use ensureImageFromUrl for ad-hoc ISO', async () => {
      await provisioner.provision('adhoc-iso')
      expect(imgMgr.ensureImageFromUrl).toHaveBeenCalledWith(
        'adhoc-iso',
        'https://example.com/installer.iso',
        'iso'
      )
    })

    it('should create blank disk for ad-hoc ISO', async () => {
      await provisioner.provision('adhoc-iso')
      expect(imgMgr.createBlankDisk).toHaveBeenCalled()
      expect(imgMgr.createOverlay).not.toHaveBeenCalled()
    })

    it('should force desktop mode for ad-hoc ISO', async () => {
      await provisioner.provision('adhoc-iso')
      const vm = await registry.get('adhoc-iso')
      expect(vm!.vmType).toBe('desktop')
      expect(vm!.consoleType).toBe('vnc')
    })

    it('should skip cloud-init when cloudInit is false', async () => {
      await provisioner.provision('adhoc-no-cloudinit')
      expect(imgMgr.createOverlay).toHaveBeenCalled()
      expect(imgMgr.generateCloudInit).not.toHaveBeenCalled()
    })

    it('should set provision-failed on download error', async () => {
      ;(imgMgr.ensureImageFromUrl as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('download failed'))
      await provisioner.provision('adhoc-cloud')
      const vm = await registry.get('adhoc-cloud')
      expect(vm!.provisioningState).toBe('provision-failed')
      expect(vm!.provisioningError).toContain('download failed')
    })
  })
})
