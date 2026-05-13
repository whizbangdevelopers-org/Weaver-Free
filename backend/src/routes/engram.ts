// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Pool } from 'pg'

const execFileAsync = promisify(execFile)
// Auth deferred — RBAC gates added at Weaver Team/Fabrick integration (Decision #160).

// Processing strategy per dataset. embed-only and embed+graph bypass Cognee's
// cognify pipeline; full-cognify uses it unchanged. Registry is the source of
// truth for both the ingest script and the UI stats/graph-data endpoints.
const DATASET_STRATEGIES: Record<string, 'embed-only' | 'embed+graph' | 'full-cognify'> = {
  project_knowledge: 'embed-only',
  fom_registry: 'full-cognify',
}

interface EngramRouteOptions {
  dataDir: string
}

export const engramRoutes: FastifyPluginAsync<EngramRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const dbPath = join(opts.dataDir, 'engram.db')

  let _db: DatabaseSync | null = null
  function db(): DatabaseSync | null {
    if (_db) return _db
    if (!existsSync(dbPath)) return null
    _db = new DatabaseSync(dbPath)
    return _db
  }

  fastify.addHook('onClose', () => { _db?.close() })

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

      const handle = db()
      if (!handle) return reply.send({ queries: [], total: 0, note: 'No query log yet' })

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

      const handle = db()
      if (!handle) return reply.send({ runs: [], total: 0, note: 'No ingestion log yet' })

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
    const handle = db()
    if (!handle) return reply.send({ entries: [], total: 0 })

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
      // ingested_entries table doesn't exist yet (no ingest run)
      return reply.send({ entries: [], total: 0 })
    }
  })

  // POST /api/engram/view — filter source files by domain/type/scope, write temp file, open in VS Code
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

      if (filtered.length === 0) {
        return reply.send({ path: null, entryCount: 0, opened: false, note: 'No matching entries found' })
      }

      const tempPath = join('/tmp', `engram-view-${Date.now()}.md`)
      writeFileSync(tempPath, filtered.join('\n\n'))

      const codeBin = process.env.CODE_BIN ?? 'code'
      let opened = false
      try {
        await execFileAsync(codeBin, [tempPath], { timeout: 5_000 })
        opened = true
      } catch { /* code not in PATH — caller can open path manually */ }

      return reply.send({ path: tempPath, entryCount: filtered.length, opened })
    }
  )

  // GET /api/engram/graph-data — registry graph: entry nodes + related edges (for UI graph visualization)
  app.get('/graph-data', {}, async (_request, reply) => {
    const handle = db()
    if (!handle) return reply.send({ nodes: [], edges: [] })

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
      const handle = db()
      let totalEntries = 0
      if (handle) {
        try {
          const row = handle.prepare('SELECT COUNT(*) as n FROM ingested_entries').get() as { n: number } | undefined
          totalEntries = row?.n ?? 0
        } catch { /* table may not exist yet */ }
      }

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

      // Determine strategy for the primary dataset (project_knowledge).
      // Returns the most specific known strategy, defaulting to full-cognify.
      const strategy = DATASET_STRATEGIES['project_knowledge'] ?? 'full-cognify'

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

      const handle = db()
      if (!handle) {
        return reply.send({
          dbExists: false,
          dbSizeBytes: 0,
          lastIngestion: null,
          queryCountsByTool: [],
          totalQueries: 0,
        })
      }

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
