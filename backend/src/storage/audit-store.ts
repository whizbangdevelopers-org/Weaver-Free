// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, mkdir, rename, appendFile } from 'node:fs/promises'
import { atomicWriteJson } from './lib/atomic-write.js'
import { dirname } from 'node:path'

// ---------------------------------------------------------------------------
// Typed action catalogue
//
// Every audit event emitted by the system must appear here.
// New domains (group.*, access.*) are pre-registered so compliance queries
// can filter by action type the moment those features ship — no schema change
// required at v3.3. Entries marked "v3.3" are not yet emitted; they exist to
// lock the naming convention before implementation begins.
// ---------------------------------------------------------------------------

export type AuditAction =
  // ── Auth / user lifecycle ────────────────────────────────────────────────
  | 'user.register'
  | 'user.login'
  | 'user.logout'
  | 'user.delete'
  | 'user.role-change'
  | 'user.password-change'
  | 'user.acl-update'
  | 'user.acl-clear'
  // ── Workloads ────────────────────────────────────────────────────────────
  | 'vm.create'
  | 'vm.clone'
  | 'vm.delete'
  | 'vm.start'
  | 'vm.stop'
  | 'vm.restart'
  | 'vm.scan'
  // ── AI agent ─────────────────────────────────────────────────────────────
  | 'agent.run'
  // ── Distro catalog ───────────────────────────────────────────────────────
  | 'distro.create'
  | 'distro.delete'
  | 'distro.test'
  | 'distro.update-url'
  | 'distro.reset-url'
  | 'distro.refresh-catalog'
  | 'distro.validate-urls'
  | 'distro.resolve-url'
  // ── Quotas ───────────────────────────────────────────────────────────────
  | 'quota.update'
  // ── Workload groups (v3.3) ───────────────────────────────────────────────
  | 'group.create'
  | 'group.update'
  | 'group.delete'
  | 'group.member.add'
  | 'group.member.remove'
  | 'group.owner.add'
  | 'group.owner.remove'
  | 'group.idp.link'
  | 'group.idp.unlink'
  // ── Access request workflow (v3.3 Compliance Pack) ───────────────────────
  | 'access.request'
  | 'access.approve'
  | 'access.deny'
  | 'access.revoke'
  | 'access.expire'
  // ── Licensing / Stripe ───────────────────────────────────────────────────
  | 'license.generated'
  | 'license.generation-failed'
  | 'license.revoked'
  | 'license.email-sent'
  | 'license.email-failed'
  // Renewal push + runtime re-read
  | 'license.renewed'
  | 'license.renewal-failed'
  | 'license.tier-changed'

// Resource category — enables query filtering by domain without string parsing
export type AuditResourceType =
  | 'user'
  | 'vm'
  | 'agent'
  | 'distro'
  | 'quota'
  | 'group'           // v3.3
  | 'access-request'  // v3.3 Compliance Pack
  | 'license'

export interface AuditEntry {
  id: string
  timestamp: string
  userId: string | null
  username: string
  action: AuditAction
  resourceType?: AuditResourceType
  resource?: string
  details?: Record<string, unknown>
  ip?: string
  success: boolean
}

export interface AuditQueryFilters {
  userId?: string
  action?: AuditAction
  resourceType?: AuditResourceType
  resource?: string
  since?: string
  until?: string
  success?: boolean
  limit?: number
  offset?: number
}

export interface AuditQueryResult {
  entries: AuditEntry[]
  total: number
  limit: number
  offset: number
}

const DEFAULT_MAX_ENTRIES = 10_000
const DEFAULT_LIMIT = 100

/**
 * Where entries older than the live window are kept: `audit-log.json` → `audit-log.archive.jsonl`.
 * One JSON entry per line, appended and never rewritten. Exported so a reader (and the tests)
 * derive the path rather than restating it.
 */
export function archivePathFor(filePath: string): string {
  return filePath.replace(/\.json$/, '') + '.archive.jsonl'
}

/**
 * The audit log: a live window of the newest `maxEntries` entries in a JSON file, which query()
 * reads from memory, and an append-only archive holding everything older.
 *
 * ── WHAT THIS GUARANTEES, AND WHY EACH ONE IS HERE (all 2026-10-01) ─────────────────────────
 * 1. Nothing is deleted. Past `maxEntries` the oldest entries are appended to the archive FIRST
 *    and only then removed from the live window. If the archive cannot be written they stay in
 *    the live window. Before this the overflow was spliced off and gone, with no record.
 * 2. A file that cannot be read is never overwritten. It is moved aside, byte for byte, to
 *    `<file>.unreadable-<time>`, and a new log starts beside it. Before this a damaged file
 *    fell into the same catch as a missing one, and `[]` was written over it.
 * 3. append() resolves only after its entry is written. Before this the write waited on a
 *    500 ms timer and nothing in production called flush(), so a crash or an ordinary shutdown
 *    inside the window lost entries for actions already reported as done. "Written" means the
 *    atomic rename has happened; there is no fsync, so a power cut can still lose recent writes.
 *
 * ── A FAILED WRITE IS LOGGED, NEVER THROWN, FROM append() ───────────────────────────────────
 * Nine callers do not await or catch AuditService.log(): the Stripe webhook's eight and the
 * licence applier's `void auditService.log(entry)`. A rejection there is unhandled, and Node
 * terminates the process on those, which is how one failed write took the backend down before
 * 2026-08-24. So a write failure keeps the entries in memory, says so on stderr, and the next
 * write carries them. flush() is the exception: its callers can catch, so it rejects.
 *
 * The format stays a JSON array: the store is kept as it is until a SQL store replaces it. The
 * archive file is new beside it, not a migration of it.
 */
export class AuditStore {
  private filePath: string
  private archivePath: string
  private entries: AuditEntry[] = []
  private maxEntries: number
  // Group commit. `appended` counts entries added since init; `written` is how many of them the
  // last successful write covered. Every append waits until `written` reaches its own count, and
  // concurrent appends share whichever write is in flight instead of each rewriting the file.
  private appended = 0
  private written = 0
  private writing: Promise<boolean> | null = null

  constructor(filePath: string, maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.filePath = filePath
    this.archivePath = archivePathFor(filePath)
    this.maxEntries = maxEntries
  }

  async init(): Promise<void> {
    let data: string
    try {
      data = await readFile(this.filePath, 'utf-8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        await mkdir(dirname(this.filePath), { recursive: true })
        this.entries = []
        await atomicWriteJson(this.filePath, this.entries)
        return
      }
      await this.setAside(err)
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch (err) {
      await this.setAside(err)
      return
    }
    if (!Array.isArray(parsed)) {
      await this.setAside(new Error('the file is JSON but not a list of entries'))
      return
    }
    this.entries = parsed as AuditEntry[]
  }

  async append(entry: AuditEntry): Promise<void> {
    this.entries.push(entry)
    const mine = ++this.appended
    await this.writeThrough(mine)
  }

  query(filters: AuditQueryFilters = {}): AuditQueryResult {
    const limit = filters.limit ?? DEFAULT_LIMIT
    const offset = filters.offset ?? 0

    let filtered = this.entries

    if (filters.userId) {
      filtered = filtered.filter(e => e.userId === filters.userId)
    }
    if (filters.action) {
      filtered = filtered.filter(e => e.action === filters.action)
    }
    if (filters.resourceType) {
      filtered = filtered.filter(e => e.resourceType === filters.resourceType)
    }
    if (filters.resource) {
      filtered = filtered.filter(e => e.resource === filters.resource)
    }
    if (filters.since) {
      const since = filters.since
      filtered = filtered.filter(e => e.timestamp >= since)
    }
    if (filters.until) {
      const until = filters.until
      filtered = filtered.filter(e => e.timestamp <= until)
    }
    if (filters.success !== undefined) {
      filtered = filtered.filter(e => e.success === filters.success)
    }

    // Paginate newest-first without copying the entire array:
    // slice from the end of the filtered list, then reverse the small page
    const total = filtered.length
    const end = Math.max(0, total - offset)
    const start = Math.max(0, end - limit)
    const paged = filtered.slice(start, end).reverse()

    return { entries: paged, total, limit, offset }
  }

  /** Returns the total number of entries (for testing) */
  count(): number {
    return this.entries.length
  }

  /**
   * Wait until every appended entry is written. Rejects if they still cannot be, because its
   * callers (graceful shutdown, tests) can catch, and a shutdown that could not write the log
   * should say so rather than exit as if it had.
   */
  async flush(): Promise<void> {
    await this.writeThrough(this.appended)
    if (this.written < this.appended) {
      throw new Error(
        `audit log ${this.filePath}: ${this.appended - this.written} entries could not be written ` +
          `and are held only in memory`,
      )
    }
  }

  /** Resolve once the write covering entry number `target` has happened, or a write has failed. */
  private async writeThrough(target: number): Promise<void> {
    while (this.written < target) {
      if (!this.writing) this.writing = this.writeOnce()
      const ok = await this.writing
      if (!ok) return // logged in writeOnce; the entries stay in memory for the next write
    }
  }

  /**
   * One write: move any overflow to the archive, then rewrite the live file. Only one runs at a
   * time (writeThrough starts it only when `writing` is empty), which is what makes the eviction
   * below safe: nothing else ever removes entries from the head of the array.
   */
  private async writeOnce(): Promise<boolean> {
    try {
      await this.archiveOverflow()
      // Read the count immediately before the call: atomicWriteJson serialises `entries`
      // synchronously, so every entry counted here is in the bytes it writes.
      const covers = this.appended
      await atomicWriteJson(this.filePath, this.entries)
      this.written = covers
      return true
    } catch (err) {
      console.error(
        `[audit-store] write to ${this.filePath} failed; ${this.appended - this.written} entries are ` +
          `retained in memory and the next write will carry them: ${messageOf(err)}`,
      )
      return false
    } finally {
      this.writing = null
    }
  }

  /**
   * Append the entries past `maxEntries` to the archive, then drop them from the live window.
   * If the append fails they stay in the live window, which only makes the file larger.
   * A failure part-way through can leave a partial last line or, on the retry, a repeated entry;
   * a reader of the archive skips a line that does not parse and keys entries by `id`.
   */
  private async archiveOverflow(): Promise<void> {
    const excess = this.entries.length - this.maxEntries
    if (excess <= 0) return
    const leaving = this.entries.slice(0, excess)
    try {
      await appendFile(this.archivePath, leaving.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf-8')
    } catch (err) {
      console.error(
        `[audit-store] could not archive ${excess} entries to ${this.archivePath}; they stay in ` +
          `the live log until the archive can be written: ${messageOf(err)}`,
      )
      return
    }
    this.entries.splice(0, excess)
  }

  /**
   * Move an unreadable log aside unchanged and start a new one. If the move itself fails this
   * throws, and startup fails: the only way left to continue would be to write over the file.
   */
  private async setAside(cause: unknown): Promise<void> {
    const aside = `${this.filePath}.unreadable-${new Date().toISOString().replace(/[:.]/g, '-')}`
    await rename(this.filePath, aside)
    console.error(
      `[audit-store] ${this.filePath} could not be read (${messageOf(cause)}). It was moved, ` +
        `unchanged, to ${aside}, and a new audit log was started. Nothing was deleted.`,
    )
    this.entries = []
    await atomicWriteJson(this.filePath, this.entries)
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
