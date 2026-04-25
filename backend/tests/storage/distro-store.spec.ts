// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () => { throw new Error('ENOENT') }),
  writeFile: vi.fn(async () => {}),
  rename: vi.fn(async () => {}),
  unlink: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
}))

import { DistroStore } from '../../src/storage/distro-store.js'
import { readFile, writeFile } from 'node:fs/promises'

const mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>
const mockWriteFile = writeFile as unknown as ReturnType<typeof vi.fn>

describe('DistroStore', () => {
  let store: DistroStore

  beforeEach(() => {
    vi.clearAllMocks()
    store = new DistroStore('/tmp/test-distros.json')
  })

  it('should initialize with empty store when no file exists', async () => {
    await store.init()
    expect(store.getAll()).toEqual({})
  })

  it('should load existing data from file', async () => {
    const existing = {
      rocky: { name: 'rocky', label: 'Rocky Linux 9', url: 'https://example.com/rocky.qcow2', format: 'qcow2', cloudInit: true }
    }
    mockReadFile.mockResolvedValueOnce(JSON.stringify(existing))

    await store.init()
    expect(store.getAll()).toEqual(existing)
  })

  it('should add a custom distro', async () => {
    await store.init()

    const result = await store.add({
      name: 'rocky',
      label: 'Rocky Linux 9',
      url: 'https://example.com/rocky.qcow2',
      format: 'qcow2',
      cloudInit: true,
    })

    expect(result).toBe(true)
    expect(store.get('rocky')).toBeDefined()
    expect(store.get('rocky')!.label).toBe('Rocky Linux 9')
    expect(mockWriteFile).toHaveBeenCalled()
  })

  it('should reject duplicate name', async () => {
    await store.init()
    await store.add({ name: 'rocky', label: 'Rocky Linux 9', url: 'https://example.com/r.qcow2', format: 'qcow2', cloudInit: true })

    const result = await store.add({ name: 'rocky', label: 'Duplicate', url: 'https://example.com/dup.qcow2', format: 'qcow2', cloudInit: true })
    expect(result).toBe(false)
  })

  it('should remove a custom distro', async () => {
    await store.init()
    await store.add({ name: 'rocky', label: 'Rocky Linux 9', url: 'https://example.com/r.qcow2', format: 'qcow2', cloudInit: true })

    const result = await store.remove('rocky')
    expect(result).toBe(true)
    expect(store.get('rocky')).toBeNull()
  })

  it('should return false when removing non-existent distro', async () => {
    await store.init()
    const result = await store.remove('nonexistent')
    expect(result).toBe(false)
  })

  it('should report has() correctly', async () => {
    await store.init()
    await store.add({ name: 'rocky', label: 'Rocky', url: 'https://ex.com/r.qcow2', format: 'qcow2', cloudInit: true })

    expect(store.has('rocky')).toBe(true)
    expect(store.has('nonexistent')).toBe(false)
  })

  it('should update an existing custom distro', async () => {
    await store.init()
    await store.add({ name: 'rocky', label: 'Rocky Linux 9', url: 'https://example.com/rocky.qcow2', format: 'qcow2', cloudInit: true })

    const result = await store.update('rocky', { url: 'https://example.com/rocky-updated.qcow2' })
    expect(result).toBe(true)
    expect(store.get('rocky')!.url).toBe('https://example.com/rocky-updated.qcow2')
    expect(store.get('rocky')!.label).toBe('Rocky Linux 9') // unchanged fields preserved
    expect(mockWriteFile).toHaveBeenCalled()
  })

  it('should return false when updating non-existent distro', async () => {
    await store.init()
    const result = await store.update('nonexistent', { url: 'https://example.com/new.qcow2' })
    expect(result).toBe(false)
  })

  it('should convert to image sources', async () => {
    await store.init()
    await store.add({ name: 'rocky', label: 'Rocky', url: 'https://ex.com/r.qcow2', format: 'qcow2', cloudInit: true })

    const sources = store.toImageSources()
    expect(sources.rocky).toBeDefined()
    expect(sources.rocky.url).toBe('https://ex.com/r.qcow2')
    expect(sources.rocky.format).toBe('qcow2')
    expect(sources.rocky.cloudInit).toBe(true)
  })
})
