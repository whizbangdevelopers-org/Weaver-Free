// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
// Auth deferred — RBAC gates added at Weaver Team/Fabrick integration (Decision #160).

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
