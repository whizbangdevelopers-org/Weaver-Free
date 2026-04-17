// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { QuotaStore } from '../../src/storage/quota-store.js'
import type { ResourceUsage } from '../../src/storage/quota-store.js'

describe('QuotaStore', () => {
  let tmpDir: string
  let filePath: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'quota-store-'))
    filePath = join(tmpDir, 'quotas.json')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('initializes and creates the file', async () => {
    const store = new QuotaStore(filePath)
    await store.init()
    expect(store.getAll()).toEqual([])
  })

  it('get returns all-null defaults for an unset user', async () => {
    const store = new QuotaStore(filePath)
    await store.init()

    const quota = store.get('user-1')
    expect(quota.userId).toBe('user-1')
    expect(quota.maxVms).toBeNull()
    expect(quota.maxMemoryMB).toBeNull()
    expect(quota.maxVcpus).toBeNull()
  })

  it('set persists and returns the quota', async () => {
    const store = new QuotaStore(filePath)
    await store.init()

    const result = await store.set('user-1', { maxVms: 5, maxMemoryMB: 2048, maxVcpus: 4 })

    expect(result.userId).toBe('user-1')
    expect(result.maxVms).toBe(5)
    expect(result.maxMemoryMB).toBe(2048)
    expect(result.maxVcpus).toBe(4)

    const got = store.get('user-1')
    expect(got.maxVms).toBe(5)
    expect(got.maxMemoryMB).toBe(2048)
    expect(got.maxVcpus).toBe(4)
  })

  it('checkQuota allows creation when within all limits', async () => {
    const store = new QuotaStore(filePath)
    await store.init()
    await store.set('user-1', { maxVms: 10, maxMemoryMB: 4096, maxVcpus: 8 })

    const usage: ResourceUsage = { totalVms: 3, totalMemoryMB: 1024, totalVcpus: 3 }
    const result = store.checkQuota('user-1', 512, 1, usage)

    expect(result.allowed).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('checkQuota allows creation when quota is all-null (unlimited)', async () => {
    const store = new QuotaStore(filePath)
    await store.init()

    // No quota set — all defaults are null
    const usage: ResourceUsage = { totalVms: 999, totalMemoryMB: 999999, totalVcpus: 999 }
    const result = store.checkQuota('user-unlimited', 512, 2, usage)

    expect(result.allowed).toBe(true)
  })

  it('checkQuota blocks when VM count limit is reached', async () => {
    const store = new QuotaStore(filePath)
    await store.init()
    await store.set('user-1', { maxVms: 3, maxMemoryMB: null, maxVcpus: null })

    const usage: ResourceUsage = { totalVms: 3, totalMemoryMB: 0, totalVcpus: 0 }
    const result = store.checkQuota('user-1', 256, 1, usage)

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('VM quota exceeded')
  })

  it('checkQuota blocks when adding VM would exceed memory limit', async () => {
    const store = new QuotaStore(filePath)
    await store.init()
    await store.set('user-1', { maxVms: null, maxMemoryMB: 1024, maxVcpus: null })

    const usage: ResourceUsage = { totalVms: 1, totalMemoryMB: 800, totalVcpus: 1 }
    // 800 + 512 = 1312 > 1024
    const result = store.checkQuota('user-1', 512, 1, usage)

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Memory quota exceeded')
  })

  it('checkQuota blocks when adding VM would exceed vCPU limit', async () => {
    const store = new QuotaStore(filePath)
    await store.init()
    await store.set('user-1', { maxVms: null, maxMemoryMB: null, maxVcpus: 4 })

    const usage: ResourceUsage = { totalVms: 2, totalMemoryMB: 1024, totalVcpus: 3 }
    // 3 + 2 = 5 > 4
    const result = store.checkQuota('user-1', 256, 2, usage)

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('vCPU quota exceeded')
  })

  it('checkQuota VM check fires before memory check', async () => {
    const store = new QuotaStore(filePath)
    await store.init()
    await store.set('user-1', { maxVms: 2, maxMemoryMB: 512, maxVcpus: null })

    const usage: ResourceUsage = { totalVms: 2, totalMemoryMB: 600, totalVcpus: 2 }
    const result = store.checkQuota('user-1', 512, 1, usage)

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('VM quota exceeded')
  })

  it('remove deletes quota and returns true', async () => {
    const store = new QuotaStore(filePath)
    await store.init()
    await store.set('user-1', { maxVms: 5, maxMemoryMB: null, maxVcpus: null })

    const removed = await store.remove('user-1')
    expect(removed).toBe(true)

    // After removal, get returns all-null defaults
    const quota = store.get('user-1')
    expect(quota.maxVms).toBeNull()
    expect(quota.maxMemoryMB).toBeNull()
    expect(quota.maxVcpus).toBeNull()
  })

  it('remove returns false for a user with no quota', async () => {
    const store = new QuotaStore(filePath)
    await store.init()

    expect(await store.remove('no-such-user')).toBe(false)
  })

  it('getAll returns all stored quotas', async () => {
    const store = new QuotaStore(filePath)
    await store.init()

    await store.set('user-1', { maxVms: 5, maxMemoryMB: 2048, maxVcpus: 4 })
    await store.set('user-2', { maxVms: 10, maxMemoryMB: null, maxVcpus: 8 })

    const all = store.getAll()
    expect(all).toHaveLength(2)
    expect(all.map(q => q.userId).sort()).toEqual(['user-1', 'user-2'])
  })

  it('persists across instances', async () => {
    const storeA = new QuotaStore(filePath)
    await storeA.init()
    await storeA.set('user-1', { maxVms: 7, maxMemoryMB: 4096, maxVcpus: 6 })

    const storeB = new QuotaStore(filePath)
    await storeB.init()

    const quota = storeB.get('user-1')
    expect(quota.maxVms).toBe(7)
    expect(quota.maxMemoryMB).toBe(4096)
    expect(quota.maxVcpus).toBe(6)
  })

  it('allows null fields within a quota (partial limits)', async () => {
    const store = new QuotaStore(filePath)
    await store.init()

    await store.set('user-1', { maxVms: 5, maxMemoryMB: null, maxVcpus: null })

    const quota = store.get('user-1')
    expect(quota.maxVms).toBe(5)
    expect(quota.maxMemoryMB).toBeNull()
    expect(quota.maxVcpus).toBeNull()
  })
})
