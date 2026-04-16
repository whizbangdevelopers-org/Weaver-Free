// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PresetTagStore } from '../../src/storage/preset-tag-store.js'

const TEST_DIR = join('/tmp', `preset-tag-store-test-${randomUUID()}`)

describe('PresetTagStore', () => {
  let store: PresetTagStore

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true })
    store = new PresetTagStore(join(TEST_DIR, 'preset-tags.json'))
    await store.init()
  })

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {})
  })

  it('should start with empty tags', () => {
    expect(store.getAll()).toEqual([])
  })

  it('should set and retrieve tags', async () => {
    await store.set(['web', 'database', 'staging'])
    expect(store.getAll()).toEqual(['database', 'staging', 'web'])
  })

  it('should deduplicate tags', async () => {
    await store.set(['web', 'web', 'db', 'web'])
    expect(store.getAll()).toEqual(['db', 'web'])
  })

  it('should sort tags alphabetically', async () => {
    await store.set(['zeta', 'alpha', 'middle'])
    expect(store.getAll()).toEqual(['alpha', 'middle', 'zeta'])
  })

  it('should return a copy, not a reference', async () => {
    await store.set(['prod', 'staging'])
    const result = store.getAll()
    result.push('injected')
    expect(store.getAll()).toEqual(['prod', 'staging'])
  })

  it('should persist across instances', async () => {
    await store.set(['persist-test'])
    const store2 = new PresetTagStore(join(TEST_DIR, 'preset-tags.json'))
    await store2.init()
    expect(store2.getAll()).toEqual(['persist-test'])
  })

  it('should handle empty set', async () => {
    await store.set([])
    expect(store.getAll()).toEqual([])
  })
})
