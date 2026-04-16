// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkloadDefinition } from '../../src/storage/workload-registry.js'

vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], callback: (err: unknown, result: { stdout: string; stderr: string }) => void) => {
    callback(null, { stdout: '', stderr: '' })
  }),
}))

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(async () => {}),
  writeFile: vi.fn(async () => {}),
  access: vi.fn(async () => { throw new Error('ENOENT') }),
  stat: vi.fn(async () => ({ size: 0 })),
}))

// Mock the download pipeline — we don't want real HTTP in tests
vi.mock('node:fs', () => ({
  createWriteStream: vi.fn(() => ({
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  })),
  createReadStream: vi.fn(() => ({
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    pipe: vi.fn(),
    read: vi.fn(),
  })),
}))

vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn(async () => {}),
}))

vi.mock('node:https', () => ({
  get: vi.fn((_url: string, cb: (res: { statusCode: number; headers: Record<string, string>; on: () => void; pipe: () => void }) => void) => {
    const mockStream = { statusCode: 200, headers: {}, on: vi.fn(), pipe: vi.fn() }
    cb(mockStream)
    return { on: vi.fn() }
  }),
}))

vi.mock('node:http', () => ({
  get: vi.fn(),
}))

import { mkdir, writeFile, access, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { execFile } from 'node:child_process'
import { ImageManager } from '../../src/services/image-manager.js'

const DEFAULT_CONFIG = {
  dataDir: '/tmp/test-data',
  microvmsDir: '/var/lib/microvms',
  qemuImgBin: '/usr/bin/qemu-img',
  bridgeGateway: '10.10.0.1',
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

describe('ImageManager', () => {
  let mgr: ImageManager

  beforeEach(() => {
    vi.clearAllMocks()
    mgr = new ImageManager(DEFAULT_CONFIG)
  })

  describe('allocateConsolePort (static)', () => {
    it('should return a port in the range 4000-4999', () => {
      const port = ImageManager.allocateConsolePort('test-vm')
      expect(port).toBeGreaterThanOrEqual(4000)
      expect(port).toBeLessThan(5000)
    })

    it('should be deterministic for the same name', () => {
      const p1 = ImageManager.allocateConsolePort('my-vm')
      const p2 = ImageManager.allocateConsolePort('my-vm')
      expect(p1).toBe(p2)
    })

    it('should produce different ports for different names', () => {
      const p1 = ImageManager.allocateConsolePort('vm-a')
      const p2 = ImageManager.allocateConsolePort('vm-b')
      expect(p1).not.toBe(p2)
    })

    it('should return a VNC port in range 5900-6899 when consoleType is vnc', () => {
      const port = ImageManager.allocateConsolePort('desktop-vm', 'vnc')
      expect(port).toBeGreaterThanOrEqual(5900)
      expect(port).toBeLessThan(6900)
    })

    it('should default to serial range without consoleType', () => {
      const port = ImageManager.allocateConsolePort('test-vm')
      expect(port).toBeGreaterThanOrEqual(4000)
      expect(port).toBeLessThan(5000)
    })
  })

  describe('builtinDistros (static)', () => {
    it('should list all built-in cloud distros', () => {
      const distros = ImageManager.builtinDistros()
      expect(distros).toContain('arch')
      expect(distros).toContain('fedora')
      expect(distros).toContain('ubuntu')
      expect(distros).toContain('debian')
      expect(distros).toContain('alpine')
      expect(distros).not.toContain('nixos')
    })
  })

  describe('instance methods', () => {
    it('supportedDistros should list built-in distros', () => {
      const distros = mgr.supportedDistros()
      expect(distros).toContain('arch')
      expect(distros).toContain('ubuntu')
      expect(distros).not.toContain('nixos')
    })

    it('supportedDistros should include custom sources', () => {
      mgr.setCustomSources({ 'rocky': { url: 'https://example.com/rocky.qcow2', format: 'qcow2', cloudInit: true } })
      const distros = mgr.supportedDistros()
      expect(distros).toContain('rocky')
      expect(distros).toContain('arch')
      mgr.setCustomSources({})
    })

    it('supportedDistros should include catalog sources', () => {
      mgr.setCatalogSources({ 'cirros': { url: 'https://example.com/cirros.img', format: 'qcow2', cloudInit: true } })
      const distros = mgr.supportedDistros()
      expect(distros).toContain('cirros')
      expect(distros).toContain('arch')
      mgr.setCatalogSources({})
    })

    it('three-tier merge: custom overrides catalog overrides built-in', () => {
      mgr.setCatalogSources({ 'arch': { url: 'https://catalog/arch.qcow2', format: 'qcow2', cloudInit: true }, 'cirros': { url: 'https://catalog/cirros.img', format: 'qcow2', cloudInit: true } })
      mgr.setCustomSources({ 'cirros': { url: 'https://custom/cirros.img', format: 'qcow2', cloudInit: false } })

      // All three should be supported
      expect(mgr.isCloudDistro('arch')).toBe(true)
      expect(mgr.isCloudDistro('cirros')).toBe(true)

      mgr.setCatalogSources({})
      mgr.setCustomSources({})
    })

    it('isCloudDistro should return true for supported distros', () => {
      expect(mgr.isCloudDistro('arch')).toBe(true)
      expect(mgr.isCloudDistro('fedora')).toBe(true)
      expect(mgr.isCloudDistro('ubuntu')).toBe(true)
    })

    it('isCloudDistro should return false for nixos and undefined', () => {
      expect(mgr.isCloudDistro('nixos')).toBe(false)
      expect(mgr.isCloudDistro(undefined)).toBe(false)
      expect(mgr.isCloudDistro('unknown-os')).toBe(false)
    })

    it('isCloudDistro should return true for custom distros', () => {
      mgr.setCustomSources({ 'rocky': { url: 'https://example.com/rocky.qcow2', format: 'qcow2', cloudInit: true } })
      expect(mgr.isCloudDistro('rocky')).toBe(true)
      mgr.setCustomSources({})
    })

    it('isCloudDistro should return true for catalog distros', () => {
      mgr.setCatalogSources({ 'cirros': { url: 'https://example.com/cirros.img', format: 'qcow2', cloudInit: true } })
      expect(mgr.isCloudDistro('cirros')).toBe(true)
      mgr.setCatalogSources({})
    })

    it('isIsoDistro should return true for ISO-format distros', () => {
      mgr.setCatalogSources({ 'nixos-server': { url: 'https://example.com/nixos.iso', format: 'iso', cloudInit: false } })
      expect(mgr.isIsoDistro('nixos-server')).toBe(true)
      mgr.setCatalogSources({})
    })

    it('isIsoDistro should return false for cloud distros', () => {
      expect(mgr.isIsoDistro('arch')).toBe(false)
    })
  })

  describe('ensureImage', () => {
    it('should throw for unsupported distro', async () => {
      await expect(mgr.ensureImage('gentoo')).rejects.toThrow('Unsupported distro: gentoo')
    })

    it('should create images directory', async () => {
      await mgr.ensureImage('arch')
      expect(mkdir).toHaveBeenCalledWith('/tmp/test-data/images', { recursive: true })
    })

    it('should return cached image path if file exists with non-zero size', async () => {
      ;(access as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
      ;(stat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ size: 1024000 })

      const path = await mgr.ensureImage('arch')
      expect(path).toBe('/tmp/test-data/images/arch-base.qcow2')
    })

    it('should download if file does not exist', async () => {
      ;(access as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ENOENT'))

      const path = await mgr.ensureImage('ubuntu')
      expect(path).toBe('/tmp/test-data/images/ubuntu-base.qcow2')
    })

    it('should copy local file for file:// URL instead of HTTP download', async () => {
      mgr.setCustomSources({ 'local-distro': { url: 'file:///var/lib/images/custom.qcow2', format: 'qcow2', cloudInit: true } })
      ;(access as unknown as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('ENOENT')) // image not cached
        .mockResolvedValueOnce(undefined) // local source file exists

      const path = await mgr.ensureImage('local-distro')
      expect(path).toBe('/tmp/test-data/images/local-distro-base.qcow2')

      // Should have used createReadStream + pipeline, not HTTPS
      expect(createReadStream).toHaveBeenCalledWith('/var/lib/images/custom.qcow2')
      expect(pipeline).toHaveBeenCalled()

      mgr.setCustomSources({})
    })
  })

  describe('createOverlay', () => {
    it('should create VM directory', async () => {
      await mgr.createOverlay('my-vm', '/images/arch-base.qcow2')
      expect(mkdir).toHaveBeenCalledWith('/var/lib/microvms/my-vm', { recursive: true })
    })

    it('should call qemu-img create with CoW backing file', async () => {
      await mgr.createOverlay('my-vm', '/images/arch-base.qcow2')
      const calls = (execFile as unknown as ReturnType<typeof vi.fn>).mock.calls
      const createCall = calls.find((c: string[][]) => c[1]?.includes('create'))
      expect(createCall).toBeDefined()
      expect(createCall![0]).toBe('/usr/bin/qemu-img')
      expect(createCall![1]).toEqual([
        'create', '-f', 'qcow2', '-F', 'qcow2', '-b', '/images/arch-base.qcow2',
        '/var/lib/microvms/my-vm/disk.qcow2',
      ])
    })

    it('should resize overlay to 10G', async () => {
      await mgr.createOverlay('my-vm', '/images/arch-base.qcow2')
      const calls = (execFile as unknown as ReturnType<typeof vi.fn>).mock.calls
      const resizeCall = calls.find((c: string[][]) => c[1]?.includes('resize'))
      expect(resizeCall).toBeDefined()
      expect(resizeCall![1]).toEqual([
        'resize', '/var/lib/microvms/my-vm/disk.qcow2', '10G',
      ])
    })

    it('should return overlay path', async () => {
      const path = await mgr.createOverlay('my-vm', '/images/base.qcow2')
      expect(path).toBe('/var/lib/microvms/my-vm/disk.qcow2')
    })
  })

  describe('generateCloudInit', () => {
    it('should create VM directory', async () => {
      await mgr.generateCloudInit(makeVm())
      expect(mkdir).toHaveBeenCalledWith('/var/lib/microvms/test-vm', { recursive: true })
    })

    it('should write meta-data, user-data, and network-config files', async () => {
      await mgr.generateCloudInit(makeVm())
      const writeCalls = (writeFile as unknown as ReturnType<typeof vi.fn>).mock.calls
      const paths = writeCalls.map((c: string[]) => c[0])
      expect(paths).toContain('/var/lib/microvms/test-vm/meta-data')
      expect(paths).toContain('/var/lib/microvms/test-vm/user-data')
      expect(paths).toContain('/var/lib/microvms/test-vm/network-config')
    })

    it('should include VM name in meta-data', async () => {
      await mgr.generateCloudInit(makeVm({ name: 'my-arch' }))
      const writeCalls = (writeFile as unknown as ReturnType<typeof vi.fn>).mock.calls
      const metaCall = writeCalls.find((c: string[]) => c[0].endsWith('meta-data'))
      expect(metaCall![1]).toContain('my-arch')
    })

    it('should include IP and gateway in network-config', async () => {
      await mgr.generateCloudInit(makeVm({ ip: '10.10.0.77' }))
      const writeCalls = (writeFile as unknown as ReturnType<typeof vi.fn>).mock.calls
      const netCall = writeCalls.find((c: string[]) => c[0].endsWith('network-config'))
      expect(netCall![1]).toContain('10.10.0.77/24')
      expect(netCall![1]).toContain('10.10.0.1')
    })

    it('should call genisoimage to create ISO', async () => {
      await mgr.generateCloudInit(makeVm())
      const calls = (execFile as unknown as ReturnType<typeof vi.fn>).mock.calls
      const isoCall = calls.find((c: string[][]) => c[0] === 'genisoimage')
      expect(isoCall).toBeDefined()
      expect(isoCall![1]).toContain('-volid')
      expect(isoCall![1]).toContain('cidata')
    })
  })

  describe('generateQemuArgs', () => {
    it('should return bin and args for QEMU launch', () => {
      const result = mgr.generateQemuArgs(makeVm({ name: 'arch-vm', mem: 1024, vcpu: 2 }), {
        diskPath: '/disk.qcow2',
        cloudInitIso: '/ci.iso',
        qemuBin: '/usr/bin/qemu-system-x86_64',
        tapInterface: 'vm-arch-vm',
        macAddress: '02:aa:bb:cc:dd:ee',
      })
      expect(result.bin).toBe('/usr/bin/qemu-system-x86_64')
      expect(result.args).toBeInstanceOf(Array)
      expect(result.args.length).toBeGreaterThan(0)
    })

    it('should include memory and vcpu params', () => {
      const result = mgr.generateQemuArgs(makeVm({ mem: 2048, vcpu: 4 }), {
        diskPath: '/disk.qcow2',
        cloudInitIso: '/ci.iso',
        qemuBin: '/nix/store/xxx/qemu-system-x86_64',
        tapInterface: 'vm-test-vm',
        macAddress: '02:aa:bb:cc:dd:ee',
      })
      const argsStr = result.args.join(' ')
      expect(argsStr).toContain('-m 2048')
      expect(argsStr).toContain('-smp 4')
    })

    it('should include disk, cloud-init ISO, and networking params', () => {
      const result = mgr.generateQemuArgs(makeVm(), {
        diskPath: '/path/to/disk.qcow2',
        cloudInitIso: '/path/to/ci.iso',
        qemuBin: '/usr/bin/qemu-system-x86_64',
        tapInterface: 'vm-test',
        macAddress: '02:00:00:00:00:00',
      })
      const argsStr = result.args.join(' ')
      expect(argsStr).toContain('/path/to/disk.qcow2')
      expect(argsStr).toContain('/path/to/ci.iso')
      expect(argsStr).toContain('vm-test')
      expect(argsStr).toContain('02:00:00:00:00:00')
    })

    it('should use KVM acceleration', () => {
      const result = mgr.generateQemuArgs(makeVm(), {
        diskPath: '/d.qcow2',
        cloudInitIso: '/ci.iso',
        qemuBin: '/usr/bin/qemu-system-x86_64',
        tapInterface: 'vm-test',
        macAddress: '02:00:00:00:00:00',
      })
      const argsStr = result.args.join(' ')
      expect(argsStr).toContain('kvm')
      expect(argsStr).toContain('host')
    })

    it('should use -nographic and -serial tcp for server mode (default)', () => {
      const result = mgr.generateQemuArgs(makeVm(), {
        diskPath: '/d.qcow2',
        cloudInitIso: '/ci.iso',
        qemuBin: '/usr/bin/qemu-system-x86_64',
        tapInterface: 'vm-test',
        macAddress: '02:00:00:00:00:00',
      })
      const argsStr = result.args.join(' ')
      expect(argsStr).toContain('-nographic')
      expect(argsStr).toMatch(/-serial tcp:127\.0\.0\.1:\d+,server,nowait/)
      expect(argsStr).not.toContain('-vga')
      expect(argsStr).not.toContain('-vnc')
    })

    it('should use -vga and -vnc for desktop mode', () => {
      const result = mgr.generateQemuArgs(makeVm({ vmType: 'desktop', consolePort: 5910 }), {
        diskPath: '/d.qcow2',
        cloudInitIso: '/ci.iso',
        qemuBin: '/usr/bin/qemu-system-x86_64',
        tapInterface: 'vm-test',
        macAddress: '02:00:00:00:00:00',
      })
      const argsStr = result.args.join(' ')
      expect(argsStr).toContain('-vga virtio')
      expect(argsStr).toContain('-vnc :10')
      expect(argsStr).not.toContain('-nographic')
      expect(argsStr).not.toContain('-serial')
    })

    it('should use IDE disk and e1000 network for Windows guests', () => {
      const result = mgr.generateQemuArgs(makeVm({ guestOs: 'windows', vmType: 'desktop', consolePort: 5901 }), {
        diskPath: '/d.qcow2',
        bootIso: '/win.iso',
        qemuBin: '/usr/bin/qemu-system-x86_64',
        tapInterface: 'vm-test',
        macAddress: '02:00:00:00:00:00',
      })
      const argsStr = result.args.join(' ')
      expect(argsStr).toContain('if=ide')
      expect(argsStr).toContain('e1000')
      expect(argsStr).toContain('-cdrom /win.iso')
      expect(argsStr).not.toContain('virtio-net')
    })

    it('should use VirtIO disk and net for Linux ISO installs', () => {
      const result = mgr.generateQemuArgs(makeVm({ vmType: 'desktop', consolePort: 5901 }), {
        diskPath: '/d.qcow2',
        bootIso: '/linux.iso',
        qemuBin: '/usr/bin/qemu-system-x86_64',
        tapInterface: 'vm-test',
        macAddress: '02:00:00:00:00:00',
      })
      const argsStr = result.args.join(' ')
      expect(argsStr).toContain('virtio')
      expect(argsStr).toContain('-cdrom /linux.iso')
      expect(argsStr).not.toContain('if=ide')
      expect(argsStr).not.toContain('e1000')
    })
  })

  describe('ensureImageFromUrl', () => {
    it('should create images directory', async () => {
      await mgr.ensureImageFromUrl('test-vm', 'https://example.com/img.qcow2', 'qcow2')
      expect(mkdir).toHaveBeenCalledWith('/tmp/test-data/images', { recursive: true })
    })

    it('should use adhoc-{vmName}-base.{ext} cache path', async () => {
      const path = await mgr.ensureImageFromUrl('my-vm', 'https://example.com/img.qcow2', 'qcow2')
      expect(path).toBe('/tmp/test-data/images/adhoc-my-vm-base.qcow2')
    })

    it('should use iso extension for ISO format', async () => {
      const path = await mgr.ensureImageFromUrl('my-vm', 'https://example.com/installer.iso', 'iso')
      expect(path).toBe('/tmp/test-data/images/adhoc-my-vm-base.iso')
    })

    it('should return cached path if file exists with non-zero size', async () => {
      ;(access as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
      ;(stat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ size: 512000 })

      const path = await mgr.ensureImageFromUrl('cached-vm', 'https://example.com/img.qcow2', 'qcow2')
      expect(path).toBe('/tmp/test-data/images/adhoc-cached-vm-base.qcow2')
    })
  })
})
