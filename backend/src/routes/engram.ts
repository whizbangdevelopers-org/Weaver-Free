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
// Auth deferred — RBAC gates added at Weaver Team/Fabrick integration (Decision #160).

type ProcessingStrategy = 'embed-only' | 'embed+graph' | 'full-cognify'
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
const STRATEGY_ORDER: ProcessingStrategy[] = ['embed-only', 'embed+graph', 'full-cognify']

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
  fom_registry:      'full-cognify',
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
      .run(datasetName, fields.strategy ?? 'full-cognify', fields.pendingStrategy ?? null, fields.upgradeMethod ?? null, fields.upgradedAt ?? null)
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
      body: z.object({ strategy: z.enum(['embed-only', 'embed+graph', 'full-cognify']) }),
    },
  }, async (request, reply) => {
    const { name } = request.params
    const { strategy } = request.body
    const existing = readDatasetConfig(handle, name)
    if (!existing) return reply.status(404).send({ error: `Dataset '${name}' not found` })
    const curIdx = STRATEGY_ORDER.indexOf(existing.strategy as ProcessingStrategy)
    const newIdx = STRATEGY_ORDER.indexOf(strategy)
    if (newIdx < curIdx) return reply.status(422).send({ error: 'Strategy can only be upgraded forward (embed-only → embed+graph → full-cognify)' })
    writeDatasetConfig(handle, name, { strategy })
    return reply.send({ datasetName: name, strategy })
  })

  // POST /api/engram/datasets/:name/upgrade — enqueue or start an upgrade job
  app.post('/datasets/:name/upgrade', {
    schema: {
      params: z.object({ name: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_-]*$/) }),
      body: z.object({
        target_strategy: z.enum(['embed-only', 'embed+graph', 'full-cognify']),
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
        }),
      },
    },
    async (request, reply) => {

      const { limit, offset } = request.query
      const rows = handle.prepare(
        `SELECT id, ts, dataset, entry_count, success_count, failure_count, improved, duration_ms, flags
         FROM ingestion_runs
         ORDER BY ts DESC LIMIT ? OFFSET ?`
      ).all(limit, offset)

      const { n } = handle.prepare('SELECT COUNT(*) as n FROM ingestion_runs').get() as { n: number }

      return reply.send({ runs: rows, total: n })
    }
  )

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
        response: {
          200: z.object({
            totalEntries: z.number().int(),
            strategy: z.enum(['embed-only', 'embed+graph', 'full-cognify']),
            pgvector: pgvectorStatsSchema,
          }),
        },
      },
    },
    async (_request, reply) => {
      // Total entries from SQLite ingested_entries table
      let totalEntries = 0
      try {
        const row = handle.prepare('SELECT COUNT(*) as n FROM ingested_entries').get() as { n: number } | undefined
        totalEntries = row?.n ?? 0
      } catch { /* table may not exist yet */ }

      // pgvector counts — connect to cognee PostgreSQL
      let pgvector: { chunks: number; summaries: number; entities: number } | null = null
      const pool = new Pool({
        host: '127.0.0.1',
        port: 5432,
        user: 'cognee',
        password: 'cognee-local',
        database: 'cognee',
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

      // Determine strategy for the primary dataset from dataset_config table.
      const strategy = readDatasetStrategy(handle, 'project_knowledge') ?? 'full-cognify'

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
