// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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

  // Every store built by a test, so afterEach can settle their debounced writes before the
  // directory goes away. Without this, a test that logs an entry and does not call flush() leaves
  // a live setTimeout pointing at a path afterEach is about to delete; the timer fires into a
  // missing directory and the write rejects. It surfaced on 2026-08-24 as ten unhandled errors on
  // a 1605/1605 green run, load-dependent and therefore invisible on an idle machine.
  //
  // The store's own guard is the real fix (an unhandled rejection in a timer kills the process);
  // this is the other half — a test must not manufacture the failure it is not testing for.
  let stores: AuditStore[]
  const makeStore = (path: string = filePath, maxEntries?: number): AuditStore => {
    const s = maxEntries === undefined ? new AuditStore(path) : new AuditStore(path, maxEntries)
    stores.push(s)
    return s
  }

  beforeEach(async () => {
    stores = []
    // randomUUID, not Date.now(): vitest runs spec files in parallel workers, and two of them
    // entering this hook in the same millisecond would share a directory and delete each other's.
    testDir = join(tmpdir(), `audit-store-test-${randomUUID()}`)
    await mkdir(testDir, { recursive: true })
    filePath = join(testDir, 'audit-log.json')
  })

  afterEach(async () => {
    // Settle every pending debounce BEFORE the directory is removed. flush() is a no-op on a
    // store with no timer pending, so this is safe to call on all of them.
    await Promise.all(stores.map(s => s.flush().catch(() => undefined)))
    await rm(testDir, { recursive: true, force: true })
  })

  describe('init', () => {
    it('should create empty audit log when file does not exist', async () => {
      const store = makeStore()
      await store.init()

      expect(store.count()).toBe(0)
    })

    it('should load existing data when file exists', async () => {
      const entries = [makeEntry(), makeEntry()]
      const { writeFile } = await import('node:fs/promises')
      await writeFile(filePath, JSON.stringify(entries), 'utf-8')

      const store = makeStore()
      await store.init()

      expect(store.count()).toBe(2)
    })
  })

  describe('append', () => {
    it('should append an entry and persist to disk', async () => {
      const store = makeStore()
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
      const store = makeStore(filePath, 10)
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
      const store = makeStore()
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
      const store = makeStore()
      await store.init()

      await store.append(makeEntry({ id: 'first', timestamp: '2026-01-01T00:00:00.000Z' }))
      await store.append(makeEntry({ id: 'second', timestamp: '2026-01-02T00:00:00.000Z' }))
      await store.append(makeEntry({ id: 'third', timestamp: '2026-01-03T00:00:00.000Z' }))

      const result = store.query()
      expect(result.entries[0].id).toBe('third')
      expect(result.entries[2].id).toBe('first')
    })

    it('should filter by userId', async () => {
      const store = makeStore()
      await store.init()

      await store.append(makeEntry({ userId: 'user-a' }))
      await store.append(makeEntry({ userId: 'user-b' }))
      await store.append(makeEntry({ userId: 'user-a' }))

      const result = store.query({ userId: 'user-a' })
      expect(result.entries).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('should filter by action', async () => {
      const store = makeStore()
      await store.init()

      await store.append(makeEntry({ action: 'vm.start' }))
      await store.append(makeEntry({ action: 'vm.stop' }))
      await store.append(makeEntry({ action: 'vm.start' }))

      const result = store.query({ action: 'vm.start' })
      expect(result.entries).toHaveLength(2)
    })

    it('should filter by resource', async () => {
      const store = makeStore()
      await store.init()

      await store.append(makeEntry({ resource: 'web-nginx' }))
      await store.append(makeEntry({ resource: 'dev-node' }))

      const result = store.query({ resource: 'web-nginx' })
      expect(result.entries).toHaveLength(1)
    })

    it('should filter by since/until', async () => {
      const store = makeStore()
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
      const store = makeStore()
      await store.init()

      await store.append(makeEntry({ success: true }))
      await store.append(makeEntry({ success: false }))
      await store.append(makeEntry({ success: true }))

      const result = store.query({ success: false })
      expect(result.entries).toHaveLength(1)
    })

    it('should paginate with limit and offset', async () => {
      const store = makeStore()
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
      const store = makeStore()
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
      const store1 = makeStore()
      await store1.init()

      await store1.append(makeEntry({ id: 'persist-test' }))
      await store1.flush()

      const store2 = makeStore()
      await store2.init()

      expect(store2.count()).toBe(1)
      const result = store2.query()
      expect(result.entries[0].id).toBe('persist-test')
    })

    // The DEBOUNCED write is the only persist path with nobody to catch it: every other caller
    // sits in a promise chain a caller can await. A rejection in a timer callback is an unhandled
    // rejection, and Node has terminated the process on those since v15 — so before 2026-08-24 a
    // single failed audit-log write took the backend down, in the one subsystem where a silent
    // death is least acceptable.
    //
    // This asserts the CONSUMER-side fact, not the provider-side one: that the process is still
    // alive and the store still works after the write has been made to fail. Asserting only that
    // persist() rejects would prove nothing about who catches it.
    it('survives a failing deferred write instead of crashing the process', async () => {
      const store = makeStore()
      await store.init()

      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const unhandled: unknown[] = []
      const onUnhandled = (e: unknown) => unhandled.push(e)
      process.on('unhandledRejection', onUnhandled)
      try {
        // Make the write fail the way the real failure does: the directory stops existing.
        await store.append(makeEntry({ id: 'doomed' }))
        await rm(testDir, { recursive: true, force: true })

        // Outlast PERSIST_DEBOUNCE_MS, which is 500 in audit-store.ts — read, not assumed. The
        // first draft of this test waited 400ms on a guessed 100ms debounce and passed its
        // "no unhandled rejection" assertion for the wrong reason: the timer had not fired at
        // all. Only the console.error assertion caught that, which is the argument for asserting
        // the positive fact (the guard RAN) beside the negative one (nothing crashed).
        await new Promise(r => setTimeout(r, 900))

        expect(unhandled).toHaveLength(0)
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('[audit-store] deferred persist'))
        // Entries are RETAINED, not dropped — the next write retries them.
        expect(store.count()).toBe(1)
      } finally {
        process.off('unhandledRejection', onUnhandled)
        spy.mockRestore()
        await mkdir(testDir, { recursive: true })
      }
    })
  })
})
