// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, statSync, readFileSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { Pool } from 'pg'
import { probeEngramInfrastructure } from '../services/engram-infra.js'
import { engramConfig } from '../services/engram-config.js'
// Auth deferred — RBAC gates added at Weaver Team/Fabrick integration (Decision #160).

type ProcessingStrategy = 'embed-only' | 'embed+graph' | 'full-engram'
type UpgradeMethod = 'gradual' | 'additive' | 'priorityTrickle' | 'bulkReprocess' | 'parallelAtomic'
type UpgradeStatus = 'queued' | 'running' | 'complete' | 'failed'

// Required capabilities per upgrade method (matches engram-db.ts CANONICAL logic).
const METHOD_CAPABILITIES: Record<UpgradeMethod, Record<string, boolean>> = {
  gradual:         {},
  additive:        { embedding: true },
  priorityTrickle: { embedding: true, pipeline: true },
  bulkReprocess:   { embedding: true, pipeline: true },
  parallelAtomic:  { embedding: true, pipeline: true, pgvector: true },
}

// Ordered progression: a dataset can only upgrade forward.
const STRATEGY_ORDER: ProcessingStrategy[] = ['embed-only', 'embed+graph', 'full-engram']

// Schema co-maintained with codebase-mcp/src/utils/engram-db.ts.
// Direct import is blocked by backend tsconfig rootDir: ./src — extract to a workspace
// package when both consumers stabilise.
const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS knowledge_queries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,
  tool        TEXT    NOT NULL,
  params      TEXT    NOT NULL,
  result_count INTEGER NOT NULL,
  result_ids  TEXT    NOT NULL,
  latency_ms  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,
  dataset       TEXT    NOT NULL,
  entry_count   INTEGER NOT NULL,
  success_count INTEGER NOT NULL,
  failure_count INTEGER NOT NULL,
  improved      INTEGER NOT NULL,
  duration_ms   INTEGER NOT NULL,
  flags         TEXT    NOT NULL,
  strategy      TEXT    NOT NULL DEFAULT 'embed-only'
);

CREATE TABLE IF NOT EXISTS ingested_entries (
  entry_id      TEXT    PRIMARY KEY,
  content_hash  TEXT    NOT NULL,
  data_id       TEXT    NOT NULL,
  dataset_id    TEXT    NOT NULL,
  domain        TEXT    NOT NULL,
  type          TEXT    NOT NULL,
  scope         TEXT    NOT NULL,
  status        TEXT    NOT NULL,
  tags          TEXT    NOT NULL,
  since_version TEXT    NOT NULL,
  title         TEXT    NOT NULL,
  related       TEXT    NOT NULL DEFAULT '[]',
  ingested_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dataset_config (
  dataset_name     TEXT PRIMARY KEY,
  strategy         TEXT NOT NULL,
  pending_strategy TEXT,
  upgrade_method   TEXT,
  upgraded_at      INTEGER
);

CREATE TABLE IF NOT EXISTS upgrade_queue (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_name        TEXT    NOT NULL,
  target_strategy     TEXT    NOT NULL,
  method              TEXT    NOT NULL,
  required_capability TEXT    NOT NULL DEFAULT '{}',
  queued_at           INTEGER NOT NULL,
  status              TEXT    NOT NULL DEFAULT 'queued',
  started_at          INTEGER
);

CREATE INDEX IF NOT EXISTS idx_kq_ts     ON knowledge_queries (ts DESC);
CREATE INDEX IF NOT EXISTS idx_kq_tool   ON knowledge_queries (tool);
CREATE INDEX IF NOT EXISTS idx_ir_ts     ON ingestion_runs (ts DESC);
CREATE INDEX IF NOT EXISTS idx_ie_domain ON ingested_entries (domain);
CREATE INDEX IF NOT EXISTS idx_uq_status ON upgrade_queue (status);
`

// Canonical dataset → strategy mapping. Must match CANONICAL_STRATEGIES in engram-db.ts.
const CANONICAL_STRATEGIES: Record<string, ProcessingStrategy> = {
  project_knowledge: 'embed-only',
  fom_registry:      'full-engram',
}

// Mirrors openEngramDb() from codebase-mcp/src/utils/engram-db.ts.
// Creates the file if absent, applies full schema, seeds CANONICAL_STRATEGIES.
function initEngramDb(dbPath: string): DatabaseSync {
  const dir = dirname(dbPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const handle = new DatabaseSync(dbPath)
  handle.exec(SCHEMA)
  // Migrations for columns added after the initial schema.
  try { handle.exec(`ALTER TABLE ingested_entries ADD COLUMN related TEXT NOT NULL DEFAULT '[]';`) } catch { /* already exists */ }
  try { handle.exec(`ALTER TABLE ingestion_runs ADD COLUMN strategy TEXT NOT NULL DEFAULT 'embed-only';`) } catch { /* already exists */ }
  // Strategy rename migration: 'full-cognify' → 'full-engram'
  handle.exec(`UPDATE dataset_config SET strategy = 'full-engram' WHERE strategy = 'full-cognify'`)
  handle.exec(`UPDATE ingestion_runs SET strategy = 'full-engram' WHERE strategy = 'full-cognify'`)
  // Seed dataset_config (no-op if already present).
  const seed = handle.prepare(`INSERT OR IGNORE INTO dataset_config (dataset_name, strategy) VALUES (?, ?)`)
  for (const [name, strategy] of Object.entries(CANONICAL_STRATEGIES)) seed.run(name, strategy)
  return handle
}

function readDatasetConfigs(handle: DatabaseSync): Record<string, ProcessingStrategy> {
  try {
    const rows = handle.prepare('SELECT dataset_name, strategy FROM dataset_config').all() as Array<{ dataset_name: string; strategy: string }>
    const out: Record<string, ProcessingStrategy> = {}
    for (const r of rows) out[r.dataset_name] = r.strategy as ProcessingStrategy
    return out
  } catch { return {} }
}

function readDatasetConfig(handle: DatabaseSync, datasetName: string) {
  try {
    type Row = { dataset_name: string; strategy: string; pending_strategy: string | null; upgrade_method: string | null; upgraded_at: number | null }
    return handle.prepare('SELECT * FROM dataset_config WHERE dataset_name = ?').get(datasetName) as Row | undefined
  } catch { return undefined }
}

function readDatasetStrategy(handle: DatabaseSync, datasetName: string): ProcessingStrategy | null {
  try {
    const row = handle.prepare('SELECT strategy FROM dataset_config WHERE dataset_name = ?').get(datasetName) as { strategy: string } | undefined
    return row ? row.strategy as ProcessingStrategy : null
  } catch { return null }
}

function writeDatasetConfig(handle: DatabaseSync, datasetName: string, fields: {
  strategy?: ProcessingStrategy; pendingStrategy?: ProcessingStrategy | null;
  upgradeMethod?: string | null; upgradedAt?: number | null
}): void {
  const existing = readDatasetConfig(handle, datasetName)
  if (!existing) {
    handle.prepare(`INSERT INTO dataset_config (dataset_name, strategy, pending_strategy, upgrade_method, upgraded_at) VALUES (?, ?, ?, ?, ?)`)
      .run(datasetName, fields.strategy ?? 'full-engram', fields.pendingStrategy ?? null, fields.upgradeMethod ?? null, fields.upgradedAt ?? null)
  } else {
    const updates: string[] = []
    const params: unknown[] = []
    if (fields.strategy !== undefined) { updates.push('strategy = ?'); params.push(fields.strategy) }
    if ('pendingStrategy' in fields) { updates.push('pending_strategy = ?'); params.push(fields.pendingStrategy ?? null) }
    if ('upgradeMethod' in fields) { updates.push('upgrade_method = ?'); params.push(fields.upgradeMethod ?? null) }
    if ('upgradedAt' in fields) { updates.push('upgraded_at = ?'); params.push(fields.upgradedAt ?? null) }
    if (!updates.length) return
    params.push(datasetName)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handle.prepare(`UPDATE dataset_config SET ${updates.join(', ')} WHERE dataset_name = ?`).run(...(params as any[]))
  }
}

function insertQueueEntry(handle: DatabaseSync, datasetName: string, targetStrategy: ProcessingStrategy, method: UpgradeMethod, capability: Record<string, boolean>, status: UpgradeStatus): number {
  const res = handle.prepare(
    `INSERT INTO upgrade_queue (dataset_name, target_strategy, method, required_capability, queued_at, status) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(datasetName, targetStrategy, method, JSON.stringify(capability), Date.now(), status)
  return res.lastInsertRowid as number
}

function mapQueueRow(r: { id: number; dataset_name: string; target_strategy: string; method: string; required_capability: string; queued_at: number; status: string; started_at: number | null }) {
  return { id: r.id, datasetName: r.dataset_name, targetStrategy: r.target_strategy, method: r.method, requiredCapability: JSON.parse(r.required_capability) as Record<string, boolean>, queuedAt: r.queued_at, status: r.status, startedAt: r.started_at }
}

function getQueueRows(handle: DatabaseSync) {
  type Row = { id: number; dataset_name: string; target_strategy: string; method: string; required_capability: string; queued_at: number; status: string; started_at: number | null }
  return (handle.prepare(`SELECT * FROM upgrade_queue ORDER BY queued_at ASC`).all() as Row[]).map(mapQueueRow)
}

function getLatestQueueEntry(handle: DatabaseSync, datasetName: string) {
  type Row = { id: number; dataset_name: string; target_strategy: string; method: string; required_capability: string; queued_at: number; status: string; started_at: number | null }
  const row = handle.prepare(`SELECT * FROM upgrade_queue WHERE dataset_name = ? ORDER BY queued_at DESC LIMIT 1`).get(datasetName) as Row | undefined
  return row ? mapQueueRow(row) : null
}

interface EngramRouteOptions {
  dataDir: string
}

export const engramRoutes: FastifyPluginAsync<EngramRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const dbPath = join(opts.dataDir, 'engram.db')

  // Eagerly open (and create if absent) — ensures CANONICAL_STRATEGIES are seeded
  // before any request arrives. db() returning null on first request was the root
  // cause of empty /strategies and 503 on /datasets/:name/config.
  const handle = initEngramDb(dbPath)
  fastify.addHook('onClose', () => { handle.close() })

  // GET /api/engram/strategies — processing strategy map from dataset_config table
  app.get('/strategies', {}, async (_request, reply) => {
    return reply.send(readDatasetConfigs(handle))
  })

  // GET /api/engram/infrastructure — live probe of AI compute components; promotes queued jobs when feasible
  app.get('/infrastructure', {}, async (_request, reply) => {
    const infra = await probeEngramInfrastructure()
    // Promote queued upgrade jobs whose required capabilities are now met.
    type QRow = { id: number; required_capability: string }
    const queued = handle.prepare(`SELECT id, required_capability FROM upgrade_queue WHERE status = 'queued'`).all() as QRow[]
    for (const row of queued) {
      let required: Record<string, boolean> = {}
      try { required = JSON.parse(row.required_capability) as Record<string, boolean> } catch { /* skip */ }
      const canRun = Object.entries(required).every(([k, v]) => !v || infra.methodFeasibility[k as keyof typeof infra.methodFeasibility])
      if (canRun) handle.prepare(`UPDATE upgrade_queue SET status = 'running', started_at = ? WHERE id = ?`).run(Date.now(), row.id)
    }
    return reply.send(infra)
  })

  // GET /api/engram/datasets/:name/config
  app.get('/datasets/:name/config', {
    schema: { params: z.object({ name: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_-]*$/) }) },
  }, async (request, reply) => {
    const { name } = request.params
    const row = readDatasetConfig(handle, name)
    if (!row) return reply.status(404).send({ error: `Dataset '${name}' not found` })
    return reply.send({ datasetName: row.dataset_name, strategy: row.strategy, pendingStrategy: row.pending_strategy, upgradeMethod: row.upgrade_method, upgradedAt: row.upgraded_at })
  })

  // PUT /api/engram/datasets/:name/config — update strategy
  app.put('/datasets/:name/config', {
    schema: {
      params: z.object({ name: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_-]*$/) }),
      body: z.object({ strategy: z.enum(['embed-only', 'embed+graph', 'full-engram']) }),
    },
  }, async (request, reply) => {
    const { name } = request.params
    const { strategy } = request.body
    const existing = readDatasetConfig(handle, name)
    if (!existing) return reply.status(404).send({ error: `Dataset '${name}' not found` })
    const curIdx = STRATEGY_ORDER.indexOf(existing.strategy as ProcessingStrategy)
    const newIdx = STRATEGY_ORDER.indexOf(strategy)
    if (newIdx < curIdx) return reply.status(422).send({ error: 'Strategy can only be upgraded forward (embed-only → embed+graph → full-engram)' })
    writeDatasetConfig(handle, name, { strategy })
    return reply.send({ datasetName: name, strategy })
  })

  // POST /api/engram/datasets/:name/upgrade — enqueue or start an upgrade job
  app.post('/datasets/:name/upgrade', {
    schema: {
      params: z.object({ name: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_-]*$/) }),
      body: z.object({
        target_strategy: z.enum(['embed-only', 'embed+graph', 'full-engram']),
        method: z.enum(['gradual', 'additive', 'priorityTrickle', 'bulkReprocess', 'parallelAtomic']),
      }),
    },
  }, async (request, reply) => {
    const { name } = request.params
    const { target_strategy, method } = request.body
    const existing = readDatasetConfig(handle, name)
    if (!existing) return reply.status(404).send({ error: `Dataset '${name}' not found` })
    const curIdx = STRATEGY_ORDER.indexOf(existing.strategy as ProcessingStrategy)
    const tgtIdx = STRATEGY_ORDER.indexOf(target_strategy)
    if (tgtIdx <= curIdx) return reply.status(422).send({ error: 'Target strategy must be ahead of current strategy' })

    const capability = METHOD_CAPABILITIES[method]
    const infra = await probeEngramInfrastructure()
    const feasible = Object.entries(capability).every(([k, v]) => !v || infra.methodFeasibility[k as keyof typeof infra.methodFeasibility])
    const status: UpgradeStatus = feasible ? 'running' : 'queued'

    writeDatasetConfig(handle, name, { pendingStrategy: target_strategy, upgradeMethod: method })
    const id = insertQueueEntry(handle, name, target_strategy, method, capability, status)

    return reply.status(202).send({ id, datasetName: name, targetStrategy: target_strategy, method, status })
  })

  // GET /api/engram/datasets/:name/upgrade/status
  app.get('/datasets/:name/upgrade/status', {
    schema: { params: z.object({ name: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_-]*$/) }) },
  }, async (request, reply) => {
    const { name } = request.params
    const config = readDatasetConfig(handle, name)
    if (!config) return reply.status(404).send({ error: `Dataset '${name}' not found` })
    const latest = getLatestQueueEntry(handle, name)
    return reply.send({
      datasetName: name,
      currentStrategy: config.strategy,
      pendingStrategy: config.pending_strategy,
      latestJob: latest,
    })
  })

  // GET /api/engram/queue — all queue entries
  app.get('/queue', {}, async (_request, reply) => {
    return reply.send({ queue: getQueueRows(handle) })
  })

  // DELETE /api/engram/queue/:id — remove a queue entry
  app.delete('/queue/:id', {
    schema: { params: z.object({ id: z.coerce.number().int().positive() }) },
  }, async (request, reply) => {
    const { id } = request.params
    handle.prepare('DELETE FROM upgrade_queue WHERE id = ?').run(id)
    return reply.status(204).send()
  })

  // GET /api/engram/queries — paginated MCP tool call log, admin only
  app.get(
    '/queries',
    {
      schema: {
        querystring: z.object({
          tool: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(500).default(100),
          offset: z.coerce.number().int().min(0).default(0),
        }),
      },
    },
    async (request, reply) => {

      const { tool, limit, offset } = request.query
      const where = tool ? 'WHERE tool = ?' : ''
      const rows = handle.prepare(
        `SELECT id, ts, tool, params, result_count, result_ids, latency_ms
         FROM knowledge_queries ${where}
         ORDER BY ts DESC LIMIT ? OFFSET ?`
      ).all(...(tool ? [tool, limit, offset] : [limit, offset]))

      const { n } = handle.prepare(
        `SELECT COUNT(*) as n FROM knowledge_queries ${where}`
      ).get(...(tool ? [tool] : [])) as { n: number }

      return reply.send({ queries: rows, total: n })
    }
  )

  // GET /api/engram/ingestion-history — ingestion run log, admin only
  app.get(
    '/ingestion-history',
    {
      schema: {
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(200).default(50),
          offset: z.coerce.number().int().min(0).default(0),
          strategy: z.enum(['embed-only', 'embed+graph', 'full-engram']).optional(),
        }),
      },
    },
    async (request, reply) => {

      const { limit, offset, strategy } = request.query
      const where = strategy ? 'WHERE strategy = ?' : ''
      const rows = handle.prepare(
        `SELECT id, ts, dataset, entry_count, success_count, failure_count, improved, duration_ms, flags
         FROM ingestion_runs ${where}
         ORDER BY ts DESC LIMIT ? OFFSET ?`
      ).all(...(strategy ? [strategy, limit, offset] : [limit, offset]))

      const { n } = handle.prepare(
        `SELECT COUNT(*) as n FROM ingestion_runs ${where}`
      ).get(...(strategy ? [strategy] : [])) as { n: number }

      return reply.send({ runs: rows, total: n })
    }
  )

  // ── Host inventory CRUD ────────────────────────────────────────────────────
  // Table populated by anvil tools/sync_hosts.py (SSH probe) or manual entry here.
  // Future: ingest pipeline will auto-sync on schedule.

  const hostBodySchema = z.object({
    hostname: z.string().min(1).max(64).regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/),
    role:     z.string().min(1).max(64),
    os:       z.string().max(32).default('nixos'),
    arch:     z.string().max(32).default('x86_64'),
    status:   z.string().max(32).default('unknown'),
    capacity: z.object({
      cpus:      z.number().int().min(0).default(0),
      cpu_model: z.string().max(128).default(''),
      memory_mb: z.number().int().min(0).default(0),
      disk_gb:   z.number().int().min(0).default(0),
    }).default({}),
    network: z.object({
      ips:     z.record(z.string()).default({}),
      bridges: z.record(z.string()).default({}),
    }).default({}),
    facts: z.record(z.unknown()).default({}),
  })

  function rowToHost(r: { hostname: string; role: string; os: string; arch: string; status: string; capacity: string; network: string; facts: string; last_probed: number | null; last_updated: number }) {
    return {
      hostname:    r.hostname,
      role:        r.role,
      os:          r.os,
      arch:        r.arch,
      status:      r.status,
      capacity:    JSON.parse(r.capacity)  as Record<string, unknown>,
      network:     JSON.parse(r.network)   as Record<string, unknown>,
      facts:       JSON.parse(r.facts)     as Record<string, unknown>,
      lastProbed:  r.last_probed,
      lastUpdated: r.last_updated,
    }
  }

  // GET /api/engram/hosts
  app.get('/hosts', {}, async (_request, reply) => {
    try {
      const rows = handle.prepare(
        `SELECT hostname, role, os, arch, status, capacity, network, facts, last_probed, last_updated
         FROM hosts ORDER BY hostname`
      ).all() as Parameters<typeof rowToHost>[0][]
      return reply.send({ hosts: rows.map(rowToHost) })
    } catch {
      return reply.send({ hosts: [] })
    }
  })

  // POST /api/engram/hosts — create
  app.post('/hosts', { schema: { body: hostBodySchema } }, async (request, reply) => {
    const b = request.body
    const existing = handle.prepare('SELECT hostname FROM hosts WHERE hostname = ?').get(b.hostname)
    if (existing) return reply.status(409).send({ error: `Host "${b.hostname}" already exists` })
    handle.prepare(`
      INSERT INTO hosts (hostname, role, os, arch, status, capacity, network, facts, content_hash, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?)
    `).run(b.hostname, b.role, b.os, b.arch, b.status,
           JSON.stringify(b.capacity), JSON.stringify(b.network), JSON.stringify(b.facts),
           Date.now())
    const row = handle.prepare(
      `SELECT hostname, role, os, arch, status, capacity, network, facts, last_probed, last_updated
       FROM hosts WHERE hostname = ?`
    ).get(b.hostname) as Parameters<typeof rowToHost>[0]
    return reply.status(201).send({ host: rowToHost(row) })
  })

  // PUT /api/engram/hosts/:hostname — update
  app.put('/hosts/:hostname', {
    schema: {
      params: z.object({ hostname: z.string().min(1).max(64) }),
      body: hostBodySchema.partial().omit({ hostname: true }),
    },
  }, async (request, reply) => {
    const { hostname } = request.params as { hostname: string }
    const b = request.body as Partial<typeof hostBodySchema._type>
    const existing = handle.prepare('SELECT hostname FROM hosts WHERE hostname = ?').get(hostname)
    if (!existing) return reply.status(404).send({ error: `Host "${hostname}" not found` })
    const fields: string[] = []
    const vals: unknown[] = []
    if (b.role     !== undefined) { fields.push('role = ?');     vals.push(b.role) }
    if (b.os       !== undefined) { fields.push('os = ?');       vals.push(b.os) }
    if (b.arch     !== undefined) { fields.push('arch = ?');     vals.push(b.arch) }
    if (b.status   !== undefined) { fields.push('status = ?');   vals.push(b.status) }
    if (b.capacity !== undefined) { fields.push('capacity = ?'); vals.push(JSON.stringify(b.capacity)) }
    if (b.network  !== undefined) { fields.push('network = ?');  vals.push(JSON.stringify(b.network)) }
    if (b.facts    !== undefined) { fields.push('facts = ?');    vals.push(JSON.stringify(b.facts)) }
    if (fields.length === 0) return reply.status(400).send({ error: 'No fields to update' })
    fields.push('last_updated = ?'); vals.push(Date.now())
    vals.push(hostname)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(handle.prepare(`UPDATE hosts SET ${fields.join(', ')} WHERE hostname = ?`) as any).run(...vals)
    const row = handle.prepare(
      `SELECT hostname, role, os, arch, status, capacity, network, facts, last_probed, last_updated
       FROM hosts WHERE hostname = ?`
    ).get(hostname) as Parameters<typeof rowToHost>[0]
    return reply.send({ host: rowToHost(row) })
  })

  // DELETE /api/engram/hosts/:hostname
  app.delete('/hosts/:hostname', {
    schema: { params: z.object({ hostname: z.string().min(1).max(64) }) },
  }, async (request, reply) => {
    const { hostname } = request.params as { hostname: string }
    const result = handle.prepare('DELETE FROM hosts WHERE hostname = ?').run(hostname)
    if (result.changes === 0) return reply.status(404).send({ error: `Host "${hostname}" not found` })
    return reply.send({ deleted: hostname })
  })

  // GET /api/engram/entries — registry breakdown by domain/type/scope
  app.get('/entries', {}, async (request, reply) => {
    try {
      const rows = handle.prepare(`
        SELECT domain, type, scope, COUNT(*) as count
        FROM ingested_entries
        GROUP BY domain, type, scope
        ORDER BY domain, type, scope
      `).all() as Array<{ domain: string; type: string; scope: string; count: number }>

      const total = rows.reduce((sum, r) => sum + r.count, 0)
      return reply.send({ entries: rows, total })
    } catch {
      // ingested_entries table exists but may be empty before first ingest run
      return reply.send({ entries: [], total: 0 })
    }
  })

  // POST /api/engram/view — filter source files by domain/type/scope, return content for browser dialog
  app.post(
    '/view',
    {
      schema: {
        body: z.object({
          domain: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_-]*$/),
          type: z.enum(['lesson', 'gotcha']).optional(),
          scope: z.string().max(64).regex(/^[a-z][a-z0-9_-]*$/).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { domain, type, scope } = request.body

      const knowledgeRoot = resolve(opts.dataDir, '..', 'docs', 'knowledge')

      const filesToRead: string[] = []
      if (!type || type === 'lesson') filesToRead.push(join(knowledgeRoot, 'lessons', `${domain}.md`))
      if (!type || type === 'gotcha') filesToRead.push(join(knowledgeRoot, 'gotchas', `${domain}.md`))

      const ENTRY_RE = new RegExp('<!--\\s*entry:([\\w-]+)\\s*-->([\\s\\S]*?)<!--\\s*/entry\\s*-->', 'g')
      const filtered: string[] = []

      for (const filePath of filesToRead) {
        if (!existsSync(filePath)) continue
        const content = readFileSync(filePath, 'utf8')
        let match: RegExpExecArray | null
        while ((match = ENTRY_RE.exec(content)) !== null) {
          const block = match[0]!
          if (scope) {
            const scopeMatch = block.match(/^scope:\s*(.+)$/m)
            const blockScope = scopeMatch ? scopeMatch[1]!.trim() : 'project'
            if (blockScope !== scope) continue
          }
          filtered.push(block)
        }
      }

      const content = filtered.join('\n\n')

      if (filtered.length === 0) {
        return reply.send({ entryCount: 0, content: null, note: 'No matching entries found' })
      }

      return reply.send({ entryCount: filtered.length, content })
    }
  )

  // GET /api/engram/graph-data — registry graph: entry nodes + related edges (for UI graph visualization)
  app.get('/graph-data', {}, async (_request, reply) => {
    try {
      const rows = handle.prepare(`
        SELECT entry_id, title, domain, type, scope, status, related
        FROM ingested_entries
        ORDER BY domain, entry_id
      `).all() as Array<{
        entry_id: string; title: string; domain: string;
        type: string; scope: string; status: string; related: string
      }>

      const nodes = rows.map((r) => ({
        id: r.entry_id,
        title: r.title,
        domain: r.domain,
        type: r.type,
        scope: r.scope,
        status: r.status,
      }))

      const edges: Array<{ source: string; target: string }> = []
      const knownIds = new Set(rows.map((r) => r.entry_id))
      const seenPairs = new Set<string>()
      for (const r of rows) {
        let related: string[] = []
        try { related = JSON.parse(r.related) as string[] } catch { /* skip */ }
        for (const targetId of related) {
          if (!knownIds.has(targetId)) continue
          // Deduplicate bidirectional pairs — keep back-links in data, show one line in UI
          const pairKey = [r.entry_id, targetId].sort().join('|')
          if (seenPairs.has(pairKey)) continue
          seenPairs.add(pairKey)
          edges.push({ source: r.entry_id, target: targetId })
        }
      }

      return reply.send({ nodes, edges })
    } catch {
      return reply.send({ nodes: [], edges: [] })
    }
  })

  // GET /api/engram/stats — processing strategy indicator + pgvector counts, admin only
  const pgvectorStatsSchema = z.object({
    chunks: z.number().int(),
    summaries: z.number().int(),
    entities: z.number().int(),
  }).nullable()

  app.get(
    '/stats',
    {
      schema: {
        querystring: z.object({
          dataset: z.string().min(1).max(128).optional(),
        }),
        response: {
          200: z.object({
            totalEntries: z.number().int(),
            strategy: z.enum(['embed-only', 'embed+graph', 'full-engram']),
            pgvector: pgvectorStatsSchema,
          }),
        },
      },
    },
    async (request, reply) => {
      const { dataset } = request.query

      // Total entries: when a dataset is specified, use last run's entry_count as proxy
      // (ingested_entries doesn't have a dataset_id column queryable by name).
      // When no dataset, fall back to full ingested_entries count.
      let totalEntries = 0
      try {
        if (dataset) {
          const row = handle.prepare(
            'SELECT entry_count FROM ingestion_runs WHERE dataset = ? ORDER BY ts DESC LIMIT 1'
          ).get(dataset) as { entry_count: number } | undefined
          totalEntries = row?.entry_count ?? 0
        } else {
          const row = handle.prepare('SELECT COUNT(*) as n FROM ingested_entries').get() as { n: number } | undefined
          totalEntries = row?.n ?? 0
        }
      } catch { /* table may not exist yet */ }

      // pgvector counts — connect to Engram PostgreSQL
      let pgvector: { chunks: number; summaries: number; entities: number } | null = null
      const pool = new Pool({
        ...engramConfig.pg,
        connectionTimeoutMillis: 3000,
        max: 1,
      })
      try {
        const client = await pool.connect()
        try {
          const [chunksRes, summariesRes, entitiesRes] = await Promise.all([
            client.query<{ n: string }>('SELECT COUNT(*) as n FROM "DocumentChunk_text"'),
            client.query<{ n: string }>('SELECT COUNT(*) as n FROM "TextSummary_text"'),
            client.query<{ n: string }>('SELECT COUNT(*) as n FROM "Entity_name"'),
          ])
          pgvector = {
            chunks: parseInt(chunksRes.rows[0]?.n ?? '0', 10),
            summaries: parseInt(summariesRes.rows[0]?.n ?? '0', 10),
            entities: parseInt(entitiesRes.rows[0]?.n ?? '0', 10),
          }
        } finally {
          client.release()
        }
      } catch (err) {
        // pgvector unreachable — return null; this is expected when cognee is not running
        fastify.log.debug({ err }, 'engram/stats: pgvector unreachable')
      } finally {
        await pool.end().catch(() => {})
      }

      // Determine strategy from dataset_config; fall back to full-engram when unknown.
      const strategySource = dataset ?? 'project_knowledge'
      const strategy = readDatasetStrategy(handle, strategySource) ?? 'full-engram'

      return reply.send({
        totalEntries,
        strategy,
        pgvector,
      })
    }
  )

  // GET /api/engram/status — summary: last ingest, call counts per tool, DB size, admin only
  app.get(
    '/status',
    {},
    async (request, reply) => {

      const dbSizeBytes = existsSync(dbPath) ? statSync(dbPath).size : 0

      const lastIngestion = handle.prepare(
        `SELECT ts, dataset, entry_count, success_count, failure_count, improved, duration_ms
         FROM ingestion_runs ORDER BY ts DESC LIMIT 1`
      ).get() ?? null

      const queryCountsByTool = handle.prepare(
        `SELECT tool, COUNT(*) as count, AVG(latency_ms) as avg_latency_ms, MAX(ts) as last_called
         FROM knowledge_queries GROUP BY tool ORDER BY count DESC`
      ).all()

      const { n: totalQueries } = handle.prepare(
        'SELECT COUNT(*) as n FROM knowledge_queries'
      ).get() as { n: number }

      return reply.send({
        dbExists: true,
        dbSizeBytes,
        lastIngestion,
        queryCountsByTool,
        totalQueries,
      })
    }
  )
}
