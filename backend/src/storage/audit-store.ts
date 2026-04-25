// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, mkdir } from 'node:fs/promises'
import { atomicWriteJson } from './lib/atomic-write.js'
import { dirname } from 'node:path'

// ---------------------------------------------------------------------------
// Typed action catalogue                          plans/v3.3.0/EXECUTION-ROADMAP.md
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
const PERSIST_DEBOUNCE_MS = 500

export class AuditStore {
  private filePath: string
  private entries: AuditEntry[] = []
  private maxEntries: number
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  constructor(filePath: string, maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.filePath = filePath
    this.maxEntries = maxEntries
  }

  async init(): Promise<void> {
    try {
      const data = await readFile(this.filePath, 'utf-8')
      this.entries = JSON.parse(data) as AuditEntry[]
    } catch {
      await mkdir(dirname(this.filePath), { recursive: true })
      this.entries = []
      await this.persist()
    }
  }

  async append(entry: AuditEntry): Promise<void> {
    this.entries.push(entry)

    // Rotate: remove oldest entries when exceeding max
    if (this.entries.length > this.maxEntries) {
      const excess = this.entries.length - this.maxEntries
      this.entries.splice(0, excess)
    }

    this.schedulePersist()
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

  /** Flush any pending writes immediately (for graceful shutdown / tests) */
  async flush(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
      await this.persist()
    }
  }

  /**
   * Debounced persist: coalesces rapid writes (e.g., burst of audit entries)
   * into a single file write within PERSIST_DEBOUNCE_MS.
   */
  private schedulePersist(): void {
    if (this.persistTimer) return
    this.persistTimer = setTimeout(async () => {
      this.persistTimer = null
      await this.persist()
    }, PERSIST_DEBOUNCE_MS)
  }

  private async persist(): Promise<void> {
    await atomicWriteJson(this.filePath, this.entries)
  }
}
