// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { WorkloadDefinition, WorkloadRegistry } from './workload-registry.js'
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

  private rowToDefinition(row: Record<string, unknown>): WorkloadDefinition {
    let tags: string[] | undefined
    try {
      const raw = row.tags as string | null
      if (raw) {
        const parsed = JSON.parse(raw) as string[]
        tags = parsed.length > 0 ? parsed : undefined
      }
    } catch { /* ignore malformed JSON */ }
    return {
      ...row as WorkloadDefinition,
      distro: (row.distro as string) ?? undefined,
      autostart: !!(row.autostart as number),
      description: (row.description as string) ?? undefined,
      tags,
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
        'INSERT INTO vms (name, ip, mem, vcpu, hypervisor, distro, autostart, description, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(vm.name, vm.ip, vm.mem, vm.vcpu, vm.hypervisor, vm.distro ?? null, vm.autostart ? 1 : 0, vm.description ?? null, JSON.stringify(vm.tags ?? []))
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
    if (sets.length === 0) return true
    values.push(name)
    this.db.prepare(`UPDATE vms SET ${sets.join(', ')} WHERE name = ?`).run(...values)
    return true
  }
}
