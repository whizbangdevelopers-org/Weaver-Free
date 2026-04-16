// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CatalogStore } from '../../src/storage/catalog-store.js'

describe('CatalogStore', () => {
  let testDir: string
  let persistPath: string
  let defaultPath: string

  const sampleCatalog = {
    version: 1,
    entries: [
      { name: 'cirros', label: 'CirrOS 0.6.3', description: 'Test image', url: 'https://example.com/cirros.qcow2', format: 'qcow2' as const, cloudInit: true },
      { name: 'rocky', label: 'Rocky Linux 9', url: 'https://example.com/rocky.qcow2', format: 'qcow2' as const, cloudInit: true },
    ],
  }

  beforeEach(async () => {
    testDir = join(tmpdir(), `catalog-store-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
    persistPath = join(testDir, 'persist', 'distro-catalog.json')
    defaultPath = join(testDir, 'default', 'distro-catalog.json')
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('init', () => {
    it('should load from persist path when available', async () => {
      await mkdir(join(testDir, 'persist'), { recursive: true })
      await writeFile(persistPath, JSON.stringify(sampleCatalog), 'utf-8')

      const store = new CatalogStore(persistPath, defaultPath)
      await store.init()

      const all = store.getAll()
      expect(Object.keys(all)).toHaveLength(2)
      expect(all['cirros'].label).toBe('CirrOS 0.6.3')
    })

    it('should fall back to default path when persist path missing', async () => {
      await mkdir(join(testDir, 'default'), { recursive: true })
      await writeFile(defaultPath, JSON.stringify(sampleCatalog), 'utf-8')

      const store = new CatalogStore(persistPath, defaultPath)
      await store.init()

      expect(Object.keys(store.getAll())).toHaveLength(2)
    })

    it('should be empty when neither path exists', async () => {
      const store = new CatalogStore(persistPath, defaultPath)
      await store.init()

      expect(Object.keys(store.getAll())).toHaveLength(0)
    })

    it('should be empty when file has invalid JSON', async () => {
      await mkdir(join(testDir, 'persist'), { recursive: true })
      await writeFile(persistPath, 'not json', 'utf-8')

      const store = new CatalogStore(persistPath, defaultPath)
      await store.init()

      expect(Object.keys(store.getAll())).toHaveLength(0)
    })

    it('should be empty when file has no entries array', async () => {
      await mkdir(join(testDir, 'persist'), { recursive: true })
      await writeFile(persistPath, JSON.stringify({ version: 1 }), 'utf-8')

      const store = new CatalogStore(persistPath, defaultPath)
      await store.init()

      expect(Object.keys(store.getAll())).toHaveLength(0)
    })

    it('should skip entries without name or url', async () => {
      const catalog = {
        version: 1,
        entries: [
          { name: 'valid', label: 'Valid', url: 'https://example.com/valid.qcow2', format: 'qcow2', cloudInit: true },
          { name: '', label: 'No Name', url: 'https://example.com/noname.qcow2', format: 'qcow2', cloudInit: true },
          { name: 'no-url', label: 'No URL', url: '', format: 'qcow2', cloudInit: true },
        ],
      }
      await mkdir(join(testDir, 'persist'), { recursive: true })
      await writeFile(persistPath, JSON.stringify(catalog), 'utf-8')

      const store = new CatalogStore(persistPath, defaultPath)
      await store.init()

      expect(Object.keys(store.getAll())).toHaveLength(1)
      expect(store.has('valid')).toBe(true)
    })

    it('should accept flake entries without url', async () => {
      const catalog = {
        version: 1,
        entries: [
          { name: 'nixos-microvm', label: 'NixOS 25.11 (microvm.nix)', format: 'flake', cloudInit: false },
          { name: 'cirros', label: 'CirrOS', url: 'https://example.com/cirros.qcow2', format: 'qcow2', cloudInit: true },
        ],
      }
      await mkdir(join(testDir, 'persist'), { recursive: true })
      await writeFile(persistPath, JSON.stringify(catalog), 'utf-8')

      const store = new CatalogStore(persistPath, defaultPath)
      await store.init()

      expect(Object.keys(store.getAll())).toHaveLength(2)
      expect(store.has('nixos-microvm')).toBe(true)
      expect(store.get('nixos-microvm')!.format).toBe('flake')
    })
  })

  describe('get / has / names', () => {
    it('should return a catalog distro by name', async () => {
      await mkdir(join(testDir, 'persist'), { recursive: true })
      await writeFile(persistPath, JSON.stringify(sampleCatalog), 'utf-8')

      const store = new CatalogStore(persistPath, defaultPath)
      await store.init()

      const cirros = store.get('cirros')
      expect(cirros).not.toBeNull()
      expect(cirros!.label).toBe('CirrOS 0.6.3')
      expect(cirros!.description).toBe('Test image')
    })

    it('should return null for nonexistent distro', async () => {
      const store = new CatalogStore(persistPath, defaultPath)
      await store.init()

      expect(store.get('nonexistent')).toBeNull()
    })

    it('should check existence with has()', async () => {
      await mkdir(join(testDir, 'persist'), { recursive: true })
      await writeFile(persistPath, JSON.stringify(sampleCatalog), 'utf-8')

      const store = new CatalogStore(persistPath, defaultPath)
      await store.init()

      expect(store.has('cirros')).toBe(true)
      expect(store.has('nonexistent')).toBe(false)
    })

    it('should return distro names', async () => {
      await mkdir(join(testDir, 'persist'), { recursive: true })
      await writeFile(persistPath, JSON.stringify(sampleCatalog), 'utf-8')

      const store = new CatalogStore(persistPath, defaultPath)
      await store.init()

      expect(store.names().sort()).toEqual(['cirros', 'rocky'])
    })
  })

  describe('toImageSources', () => {
    it('should convert to ImageManager source format', async () => {
      await mkdir(join(testDir, 'persist'), { recursive: true })
      await writeFile(persistPath, JSON.stringify(sampleCatalog), 'utf-8')

      const store = new CatalogStore(persistPath, defaultPath)
      await store.init()

      const sources = store.toImageSources()
      expect(sources['cirros']).toEqual({
        url: 'https://example.com/cirros.qcow2',
        format: 'qcow2',
        cloudInit: true,
      })
      expect(sources['rocky']).toBeDefined()
    })
  })

  describe('hasRemoteUrl', () => {
    it('should return false when no remote URL', () => {
      const store = new CatalogStore(persistPath, defaultPath)
      expect(store.hasRemoteUrl()).toBe(false)
    })

    it('should return true when remote URL is set', () => {
      const store = new CatalogStore(persistPath, defaultPath, 'https://example.com/catalog.json')
      expect(store.hasRemoteUrl()).toBe(true)
    })
  })

  describe('refresh', () => {
    it('should throw when no remote URL is configured', async () => {
      const store = new CatalogStore(persistPath, defaultPath)
      await store.init()

      await expect(store.refresh()).rejects.toThrow('No remote URL configured')
    })
  })
})
