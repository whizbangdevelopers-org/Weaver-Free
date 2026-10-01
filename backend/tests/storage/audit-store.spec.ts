// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rm, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { AuditStore, archivePathFor } from '../../src/storage/audit-store.js'
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

    // Until 2026-10-01 every read failure, a parse failure included, fell into one catch that
    // started an empty log AND WROTE IT over the file. A damaged audit log was replaced by `[]`,
    // which destroyed the history the file still held. The contract now: whatever cannot be read
    // is moved aside byte-for-byte, and a new log starts beside it.
    it('moves an unparseable file aside unchanged instead of overwriting it', async () => {
      const { writeFile, readdir } = await import('node:fs/promises')
      const original = '[{"id":"half-written"'
      await writeFile(filePath, original, 'utf-8')
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      try {
        const store = makeStore()
        await store.init()

        expect(store.count()).toBe(0)
        const aside = (await readdir(testDir)).filter(f => f.startsWith('audit-log.json.unreadable-'))
        expect(aside).toHaveLength(1)
        expect(await readFile(join(testDir, aside[0]), 'utf-8')).toBe(original)
        expect(JSON.parse(await readFile(filePath, 'utf-8'))).toEqual([])
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('[audit-store]'))
      } finally {
        spy.mockRestore()
      }
    })

    it('moves aside a file that parses but is not a list of entries', async () => {
      const { writeFile, readdir } = await import('node:fs/promises')
      await writeFile(filePath, '{"entries":[]}', 'utf-8')
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      try {
        const store = makeStore()
        await store.init()

        expect(store.count()).toBe(0)
        expect((await readdir(testDir)).some(f => f.startsWith('audit-log.json.unreadable-'))).toBe(true)
      } finally {
        spy.mockRestore()
      }
    })

    it('moves aside a path it cannot read for any reason other than absence', async () => {
      const { readdir } = await import('node:fs/promises')
      // A directory where the file should be: readFile fails with EISDIR, not ENOENT.
      await mkdir(filePath)
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      try {
        const store = makeStore()
        await store.init()

        expect(store.count()).toBe(0)
        expect((await readdir(testDir)).some(f => f.startsWith('audit-log.json.unreadable-'))).toBe(true)
        expect(JSON.parse(await readFile(filePath, 'utf-8'))).toEqual([])
      } finally {
        spy.mockRestore()
      }
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

    // Until 2026-10-01 this test asserted that entries 0-4 were GONE: the store spliced the oldest
    // entries off past maxEntries and wrote the shortened list, with no record anywhere that they
    // had existed. The live log is still capped, because it is rewritten whole on every write and
    // the query reads it from memory; what changed is that the overflow is kept.
    it('moves the oldest entries to the archive instead of deleting them', async () => {
      const store = makeStore(filePath, 10)
      await store.init()

      for (let i = 0; i < 15; i++) {
        await store.append(makeEntry({ id: `entry-${i}` }))
      }

      expect(store.count()).toBe(10)
      const result = store.query({ limit: 1, offset: 9 })
      expect(result.entries[0].id).toBe('entry-5')

      const archived = (await readFile(archivePathFor(filePath), 'utf-8'))
        .split('\n')
        .filter(l => l.trim())
        .map(l => (JSON.parse(l) as AuditEntry).id)
      expect(archived).toEqual(['entry-0', 'entry-1', 'entry-2', 'entry-3', 'entry-4'])

      const live = (JSON.parse(await readFile(filePath, 'utf-8')) as AuditEntry[]).map(e => e.id)
      expect([...archived, ...live]).toEqual(Array.from({ length: 15 }, (_, i) => `entry-${i}`))
    })

    it('keeps entries in the live log when the archive cannot be written', async () => {
      // A directory at the archive path: appendFile fails with EISDIR.
      await mkdir(archivePathFor(filePath))
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      try {
        const store = makeStore(filePath, 10)
        await store.init()

        for (let i = 0; i < 15; i++) {
          await store.append(makeEntry({ id: `entry-${i}` }))
        }

        // Nothing is dropped when it cannot first be kept somewhere else.
        expect(store.count()).toBe(15)
        expect(JSON.parse(await readFile(filePath, 'utf-8'))).toHaveLength(15)
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('[audit-store] could not archive'))
      } finally {
        spy.mockRestore()
      }
    })

    // Until 2026-10-01 append() resolved before anything was written: the write waited on a
    // 500 ms timer, nothing in production ever called flush(), so a crash or an ordinary shutdown
    // inside that window lost entries whose actions had already been reported as done.
    it('resolves only after its entry has been written', async () => {
      const store = makeStore()
      await store.init()

      await store.append(makeEntry({ id: 'written-before-resolve' }))

      const data = JSON.parse(await readFile(filePath, 'utf-8')) as AuditEntry[]
      expect(data.map(e => e.id)).toContain('written-before-resolve')
    })

    it('writes every one of a burst of concurrent appends by the time each resolves', async () => {
      const store = makeStore()
      await store.init()

      const ids = Array.from({ length: 25 }, (_, i) => `burst-${i}`)
      await Promise.all(
        ids.map(id =>
          store.append(makeEntry({ id })).then(async () => {
            const data = JSON.parse(await readFile(filePath, 'utf-8')) as AuditEntry[]
            expect(data.map(e => e.id)).toContain(id)
          }),
        ),
      )
      expect(store.count()).toBe(25)
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

    // A failed write must not reject append(). Nine callers do not await or catch log(): the
    // Stripe webhook's eight calls and the licence applier's `void auditService.log(entry)` in
    // index.ts. A rejection there is an unhandled rejection, and Node has terminated the process on
    // those since v15. Before 2026-08-24 one failed write took the backend down that way, from a
    // timer callback; with the write now inside append(), the same guard has to live there.
    //
    // This asserts the CONSUMER-side fact, not the provider-side one: that the process is still
    // alive, the entry is retained, and the next write carries it. Asserting only that a write
    // failed would prove nothing about who catches it.
    it('survives a failing write without rejecting, and the next write carries the entry', async () => {
      const store = makeStore()
      await store.init()

      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const unhandled: unknown[] = []
      const onUnhandled = (e: unknown) => unhandled.push(e)
      process.on('unhandledRejection', onUnhandled)
      try {
        // Make the write fail the way the real failure does: the directory stops existing.
        await rm(testDir, { recursive: true, force: true })
        await expect(store.append(makeEntry({ id: 'doomed' }))).resolves.toBeUndefined()

        expect(unhandled).toHaveLength(0)
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('[audit-store] write'))
        // Entries are RETAINED, not dropped.
        expect(store.count()).toBe(1)

        await mkdir(testDir, { recursive: true })
        await store.append(makeEntry({ id: 'after-recovery' }))
        const ids = (JSON.parse(await readFile(filePath, 'utf-8')) as AuditEntry[]).map(e => e.id)
        expect(ids).toEqual(['doomed', 'after-recovery'])
      } finally {
        process.off('unhandledRejection', onUnhandled)
        spy.mockRestore()
        await mkdir(testDir, { recursive: true })
      }
    })

    // flush() is the one path that may reject: graceful shutdown and tests call it and can catch,
    // and a shutdown that cannot write the log should say so rather than exit as if it had.
    it('flush() rejects when the retained entries still cannot be written', async () => {
      const store = makeStore()
      await store.init()

      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      try {
        await rm(testDir, { recursive: true, force: true })
        await store.append(makeEntry({ id: 'unwritten' }))
        await expect(store.flush()).rejects.toThrow(/audit/i)
      } finally {
        spy.mockRestore()
        await mkdir(testDir, { recursive: true })
      }
    })
  })
})
