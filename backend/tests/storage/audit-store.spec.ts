// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { rm, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { AuditStore } from '../../src/storage/audit-store.js'
import type { AuditEntry } from '../../src/storage/audit-store.js'

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    userId: 'user-1',
    username: 'admin',
    action: 'vm.start',
    resource: 'web-nginx',
    ip: '127.0.0.1',
    success: true,
    ...overrides,
  }
}

describe('AuditStore', () => {
  let testDir: string
  let filePath: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `audit-store-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
    filePath = join(testDir, 'audit-log.json')
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('init', () => {
    it('should create empty audit log when file does not exist', async () => {
      const store = new AuditStore(filePath)
      await store.init()

      expect(store.count()).toBe(0)
    })

    it('should load existing data when file exists', async () => {
      const entries = [makeEntry(), makeEntry()]
      const { writeFile } = await import('node:fs/promises')
      await writeFile(filePath, JSON.stringify(entries), 'utf-8')

      const store = new AuditStore(filePath)
      await store.init()

      expect(store.count()).toBe(2)
    })
  })

  describe('append', () => {
    it('should append an entry and persist to disk', async () => {
      const store = new AuditStore(filePath)
      await store.init()

      const entry = makeEntry()
      await store.append(entry)
      await store.flush()

      expect(store.count()).toBe(1)

      // Verify persistence
      const data = JSON.parse(await readFile(filePath, 'utf-8'))
      expect(data).toHaveLength(1)
      expect(data[0].id).toBe(entry.id)
    })

    it('should rotate oldest entries when exceeding max', async () => {
      // Use a small maxEntries to test rotation without timeout
      const store = new AuditStore(filePath, 10)
      await store.init()

      // Add 15 entries (exceeds max of 10)
      for (let i = 0; i < 15; i++) {
        await store.append(makeEntry({ id: `entry-${i}` }))
      }

      // Should be capped at 10
      expect(store.count()).toBe(10)

      // Oldest entries should have been removed (entries 0-4 rotated out)
      const result = store.query({ limit: 1, offset: 9 })
      expect(result.entries[0].id).toBe('entry-5')
    })
  })

  describe('query', () => {
    it('should return all entries with default pagination', async () => {
      const store = new AuditStore(filePath)
      await store.init()

      for (let i = 0; i < 5; i++) {
        await store.append(makeEntry())
      }

      const result = store.query()
      expect(result.entries).toHaveLength(5)
      expect(result.total).toBe(5)
      expect(result.limit).toBe(100)
      expect(result.offset).toBe(0)
    })

    it('should return entries in newest-first order', async () => {
      const store = new AuditStore(filePath)
      await store.init()

      await store.append(makeEntry({ id: 'first', timestamp: '2026-01-01T00:00:00.000Z' }))
      await store.append(makeEntry({ id: 'second', timestamp: '2026-01-02T00:00:00.000Z' }))
      await store.append(makeEntry({ id: 'third', timestamp: '2026-01-03T00:00:00.000Z' }))

      const result = store.query()
      expect(result.entries[0].id).toBe('third')
      expect(result.entries[2].id).toBe('first')
    })

    it('should filter by userId', async () => {
      const store = new AuditStore(filePath)
      await store.init()

      await store.append(makeEntry({ userId: 'user-a' }))
      await store.append(makeEntry({ userId: 'user-b' }))
      await store.append(makeEntry({ userId: 'user-a' }))

      const result = store.query({ userId: 'user-a' })
      expect(result.entries).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('should filter by action', async () => {
      const store = new AuditStore(filePath)
      await store.init()

      await store.append(makeEntry({ action: 'vm.start' }))
      await store.append(makeEntry({ action: 'vm.stop' }))
      await store.append(makeEntry({ action: 'vm.start' }))

      const result = store.query({ action: 'vm.start' })
      expect(result.entries).toHaveLength(2)
    })

    it('should filter by resource', async () => {
      const store = new AuditStore(filePath)
      await store.init()

      await store.append(makeEntry({ resource: 'web-nginx' }))
      await store.append(makeEntry({ resource: 'dev-node' }))

      const result = store.query({ resource: 'web-nginx' })
      expect(result.entries).toHaveLength(1)
    })

    it('should filter by since/until', async () => {
      const store = new AuditStore(filePath)
      await store.init()

      await store.append(makeEntry({ timestamp: '2026-01-01T00:00:00.000Z' }))
      await store.append(makeEntry({ timestamp: '2026-01-15T00:00:00.000Z' }))
      await store.append(makeEntry({ timestamp: '2026-02-01T00:00:00.000Z' }))

      const result = store.query({
        since: '2026-01-10T00:00:00.000Z',
        until: '2026-01-20T00:00:00.000Z',
      })
      expect(result.entries).toHaveLength(1)
    })

    it('should filter by success', async () => {
      const store = new AuditStore(filePath)
      await store.init()

      await store.append(makeEntry({ success: true }))
      await store.append(makeEntry({ success: false }))
      await store.append(makeEntry({ success: true }))

      const result = store.query({ success: false })
      expect(result.entries).toHaveLength(1)
    })

    it('should paginate with limit and offset', async () => {
      const store = new AuditStore(filePath)
      await store.init()

      for (let i = 0; i < 10; i++) {
        await store.append(makeEntry({ id: `entry-${i}` }))
      }

      const page1 = store.query({ limit: 3, offset: 0 })
      expect(page1.entries).toHaveLength(3)
      expect(page1.total).toBe(10)

      const page2 = store.query({ limit: 3, offset: 3 })
      expect(page2.entries).toHaveLength(3)
      expect(page2.entries[0].id).not.toBe(page1.entries[0].id)
    })

    it('should combine multiple filters', async () => {
      const store = new AuditStore(filePath)
      await store.init()

      await store.append(makeEntry({ userId: 'user-a', action: 'vm.start', success: true }))
      await store.append(makeEntry({ userId: 'user-a', action: 'vm.stop', success: true }))
      await store.append(makeEntry({ userId: 'user-b', action: 'vm.start', success: false }))

      const result = store.query({ userId: 'user-a', action: 'vm.start' })
      expect(result.entries).toHaveLength(1)
    })
  })

  describe('persistence', () => {
    it('should persist changes across instances', async () => {
      const store1 = new AuditStore(filePath)
      await store1.init()

      await store1.append(makeEntry({ id: 'persist-test' }))
      await store1.flush()

      const store2 = new AuditStore(filePath)
      await store2.init()

      expect(store2.count()).toBe(1)
      const result = store2.query()
      expect(result.entries[0].id).toBe('persist-test')
    })
  })
})
