// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { WorkloadDefinition, WorkloadRegistry } from './workload-registry.js'
import type { ServiceProbeSpec } from '../services/health-probe.js'
import { DEFAULT_VMS } from './seed-data.js'

export class SqliteWorkloadRegistry implements WorkloadRegistry {
  private db: import('better-sqlite3').Database

  constructor(dbPath: string) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as (filename: string) => import('better-sqlite3').Database
    this.db = Database(dbPath)
  }

  async init(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vms (
        name TEXT PRIMARY KEY,
        ip TEXT NOT NULL,
        mem INTEGER NOT NULL,
        vcpu INTEGER NOT NULL,
        hypervisor TEXT NOT NULL,
        distro TEXT
      )
    `)

    // Migrate: add new columns if missing
    const cols = this.db.prepare("PRAGMA table_info(vms)").all() as { name: string }[]
    const colNames = new Set(cols.map(c => c.name))
    if (!colNames.has('autostart')) {
      this.db.exec('ALTER TABLE vms ADD COLUMN autostart INTEGER DEFAULT 0')
    }
    if (!colNames.has('description')) {
      this.db.exec('ALTER TABLE vms ADD COLUMN description TEXT')
    }
    if (!colNames.has('tags')) {
      this.db.exec("ALTER TABLE vms ADD COLUMN tags TEXT DEFAULT '[]'")
    }
    if (!colNames.has('service_probes')) {
      this.db.exec("ALTER TABLE vms ADD COLUMN service_probes TEXT DEFAULT '[]'")
    }

    // Seed sample VMs only when explicitly requested (E2E, demo).
    // Production and dev start empty — CirrOS example VM is provisioned separately.
    const count = this.db.prepare('SELECT COUNT(*) as count FROM vms').get() as { count: number }
    if (count.count === 0 && process.env.SEED_SAMPLE_VMS === 'true') {
      const insert = this.db.prepare(
        'INSERT INTO vms (name, ip, mem, vcpu, hypervisor, distro) VALUES (?, ?, ?, ?, ?, ?)'
      )
      const seedMany = this.db.transaction((vms: WorkloadDefinition[]) => {
        for (const vm of vms) {
          insert.run(vm.name, vm.ip, vm.mem, vm.vcpu, vm.hypervisor, vm.distro ?? null)
        }
      })
      seedMany(DEFAULT_VMS)
    }
  }

  /**
   * Decode a JSON-encoded array column, or `undefined` when it holds nothing usable.
   *
   * Returns `undefined` rather than `[]` for an empty array so the field disappears from the
   * definition entirely — the same shape the JSON registry produces for a workload that never had
   * one, so the two backends cannot disagree about what "no tags" or "no probes" looks like.
   */
  private static decodeJsonArray<T>(raw: unknown): T[] | undefined {
    if (typeof raw !== 'string' || raw === '') return undefined
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed) || parsed.length === 0) return undefined
      return parsed as T[]
    } catch {
      return undefined // malformed JSON reads as absent, never as a partial list
    }
  }

  private rowToDefinition(row: Record<string, unknown>): WorkloadDefinition {
    const { service_probes: _serviceProbesColumn, ...rest } = row
    return {
      ...rest as WorkloadDefinition,
      distro: (row.distro as string) ?? undefined,
      autostart: !!(row.autostart as number),
      description: (row.description as string) ?? undefined,
      tags: SqliteWorkloadRegistry.decodeJsonArray<string>(row.tags),
      serviceProbes: SqliteWorkloadRegistry.decodeJsonArray<ServiceProbeSpec>(row.service_probes),
    }
  }

  async getAll(): Promise<Record<string, WorkloadDefinition>> {
    const rows = this.db.prepare('SELECT * FROM vms').all() as Record<string, unknown>[]
    const result: Record<string, WorkloadDefinition> = {}
    for (const row of rows) {
      const def = this.rowToDefinition(row)
      result[def.name] = def
    }
    return result
  }

  async get(name: string): Promise<WorkloadDefinition | null> {
    const row = this.db.prepare('SELECT * FROM vms WHERE name = ?').get(name) as Record<string, unknown> | undefined
    if (!row) return null
    return this.rowToDefinition(row)
  }

  async has(name: string): Promise<boolean> {
    const row = this.db.prepare('SELECT 1 FROM vms WHERE name = ?').get(name)
    return !!row
  }

  async add(vm: WorkloadDefinition): Promise<boolean> {
    try {
      this.db.prepare(
        'INSERT INTO vms (name, ip, mem, vcpu, hypervisor, distro, autostart, description, tags, service_probes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(vm.name, vm.ip, vm.mem, vm.vcpu, vm.hypervisor, vm.distro ?? null, vm.autostart ? 1 : 0, vm.description ?? null, JSON.stringify(vm.tags ?? []), JSON.stringify(vm.serviceProbes ?? []))
      return true
    } catch {
      return false
    }
  }

  async remove(name: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM vms WHERE name = ?').run(name)
    return result.changes > 0
  }

  async update(name: string, fields: Partial<WorkloadDefinition>): Promise<boolean> {
    const existing = await this.has(name)
    if (!existing) return false
    const sets: string[] = []
    const values: unknown[] = []
    if ('autostart' in fields) {
      sets.push('autostart = ?')
      values.push(fields.autostart ? 1 : 0)
    }
    if ('description' in fields) {
      sets.push('description = ?')
      values.push(fields.description ?? null)
    }
    if ('tags' in fields) {
      sets.push('tags = ?')
      values.push(JSON.stringify(fields.tags ?? []))
    }
    if ('serviceProbes' in fields) {
      sets.push('service_probes = ?')
      values.push(JSON.stringify(fields.serviceProbes ?? []))
    }
    // NOTE: a field this backend has no column for lands here and returns `true` — a silent
    // success for a write that did not happen. That is why `serviceProbes` got a column in the
    // same change that added it to WorkloadDefinition rather than in a follow-up: a Solo user
    // would have configured probes, received 200, and lost them on the next restart, with nothing
    // anywhere reporting a failure.
    if (sets.length === 0) return true
    values.push(name)
    this.db.prepare(`UPDATE vms SET ${sets.join(', ')} WHERE name = ?`).run(...values)
    return true
  }
}
