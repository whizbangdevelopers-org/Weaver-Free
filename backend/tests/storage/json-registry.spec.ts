// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { JsonWorkloadRegistry } from '../../src/storage/json-registry.js'
import { DEFAULT_VMS } from '../../src/storage/seed-data.js'

describe('JsonWorkloadRegistry', () => {
  let testDir: string
  let filePath: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `vm-registry-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
    filePath = join(testDir, 'vms.json')
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('init', () => {
    it('should create empty registry when file does not exist', async () => {
      const registry = new JsonWorkloadRegistry(filePath)
      await registry.init()

      const all = await registry.getAll()
      expect(Object.keys(all)).toHaveLength(0)
    })

    it('should seed sample VMs when SEED_SAMPLE_VMS is set', async () => {
      const orig = process.env.SEED_SAMPLE_VMS
      process.env.SEED_SAMPLE_VMS = 'true'
      try {
        const registry = new JsonWorkloadRegistry(filePath)
        await registry.init()

        const all = await registry.getAll()
        expect(Object.keys(all)).toHaveLength(DEFAULT_VMS.length)
      } finally {
        if (orig === undefined) delete process.env.SEED_SAMPLE_VMS
        else process.env.SEED_SAMPLE_VMS = orig
      }
    })

    it('should load existing data when file exists', async () => {
      const existing = {
        'test-vm': { name: 'test-vm', ip: '10.0.0.1', mem: 256, vcpu: 1, hypervisor: 'qemu', distro: 'arch' }
      }
      await writeFile(filePath, JSON.stringify(existing), 'utf-8')

      const registry = new JsonWorkloadRegistry(filePath)
      await registry.init()

      const all = await registry.getAll()
      expect(Object.keys(all)).toHaveLength(1)
      expect(all['test-vm'].distro).toBe('arch')
    })
  })

  describe('add', () => {
    it('should add a new VM and persist', async () => {
      const registry = new JsonWorkloadRegistry(filePath)
      await registry.init()

      const result = await registry.add({
        name: 'test-new', ip: '10.0.0.99', mem: 1024, vcpu: 2, hypervisor: 'qemu', distro: 'fedora'
      })
      expect(result).toBe(true)

      const vm = await registry.get('test-new')
      expect(vm).not.toBeNull()
      expect(vm!.distro).toBe('fedora')
    })

    it('should return false for duplicate name', async () => {
      const registry = new JsonWorkloadRegistry(filePath)
      await registry.init()

      await registry.add({ name: 'dup-test', ip: '10.0.0.1', mem: 256, vcpu: 1, hypervisor: 'qemu' })
      const result = await registry.add({ name: 'dup-test', ip: '10.0.0.99', mem: 256, vcpu: 1, hypervisor: 'qemu' })
      expect(result).toBe(false)
    })
  })

  describe('remove', () => {
    it('should remove a VM and persist', async () => {
      const registry = new JsonWorkloadRegistry(filePath)
      await registry.init()

      await registry.add({ name: 'to-remove', ip: '10.0.0.1', mem: 256, vcpu: 1, hypervisor: 'qemu' })
      const result = await registry.remove('to-remove')
      expect(result).toBe(true)

      const vm = await registry.get('to-remove')
      expect(vm).toBeNull()
    })

    it('should return false for nonexistent VM', async () => {
      const registry = new JsonWorkloadRegistry(filePath)
      await registry.init()

      const result = await registry.remove('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('has', () => {
    it('should return true for existing VM', async () => {
      const registry = new JsonWorkloadRegistry(filePath)
      await registry.init()

      await registry.add({ name: 'has-test', ip: '10.0.0.1', mem: 256, vcpu: 1, hypervisor: 'qemu' })
      expect(await registry.has('has-test')).toBe(true)
    })

    it('should return false for nonexistent VM', async () => {
      const registry = new JsonWorkloadRegistry(filePath)
      await registry.init()

      expect(await registry.has('nonexistent')).toBe(false)
    })
  })

  describe('persistence', () => {
    it('should persist changes across instances', async () => {
      const registry1 = new JsonWorkloadRegistry(filePath)
      await registry1.init()

      await registry1.add({
        name: 'persist-test', ip: '10.0.0.50', mem: 256, vcpu: 1, hypervisor: 'qemu'
      })

      // Create a new instance pointing to the same file
      const registry2 = new JsonWorkloadRegistry(filePath)
      await registry2.init()

      const vm = await registry2.get('persist-test')
      expect(vm).not.toBeNull()
      expect(vm!.name).toBe('persist-test')
    })
  })
})
