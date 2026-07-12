// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { existsSync, readFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { parse as parseYaml } from 'yaml'
import { Pool } from 'pg'
import { probeEngramInfrastructure } from '../services/engram-infra.js'
import { engramConfig } from '../services/engram-config.js'
// Auth deferred — RBAC gates added at Weaver Team/Fabrick integration (Decision WVR-160).
//
// Store: the unified Engram Postgres (WVR-198 §5.3 / convergence §10 Phase B). The SQLite
// engram.db is retired — telemetry (knowledge_queries, ingestion_runs) and the host
// inventory (hosts) live in Postgres; the Cognee dataset/strategy/upgrade machinery is
// gone with the Cognee decommission (WVR-195). Registry entries/graph are served by the
// engram-query FastAPI (/engram-query/*), not here.

// Postgres schema mirror — the tables this route reads (also created by the ingester's
// pgvector-embed ensureSchema; created-if-absent here so the route works on a fresh DB).
const POSTGRES_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS knowledge_queries (
     id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     ts BIGINT NOT NULL, tool TEXT NOT NULL, params JSONB NOT NULL,
     result_count INT NOT NULL, result_ids JSONB NOT NULL, latency_ms INT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ingestion_runs (
     id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     ts BIGINT NOT NULL, dataset TEXT NOT NULL, entry_count INT NOT NULL,
     success_count INT NOT NULL, failure_count INT NOT NULL, improved BOOLEAN NOT NULL,
     duration_ms INT NOT NULL, flags JSONB NOT NULL, strategy TEXT NOT NULL DEFAULT 'embed-only')`,
  `CREATE TABLE IF NOT EXISTS hosts (
     hostname TEXT PRIMARY KEY, role TEXT NOT NULL, os TEXT NOT NULL DEFAULT 'nixos',
     arch TEXT NOT NULL DEFAULT 'x86_64', status TEXT NOT NULL DEFAULT 'unknown',
     capacity JSONB NOT NULL DEFAULT '{}', network JSONB NOT NULL DEFAULT '{}',
     facts JSONB NOT NULL DEFAULT '{}', content_hash TEXT NOT NULL DEFAULT '',
     last_probed BIGINT, last_updated BIGINT NOT NULL)`,
]

interface EngramRouteOptions {
  dataDir: string
}

interface HostRow {
  hostname: string; role: string; os: string; arch: string; status: string
  capacity: Record<string, unknown>; network: Record<string, unknown>; facts: Record<string, unknown>
  last_probed: string | number | null; last_updated: string | number
}

function rowToHost(r: HostRow) {
  return {
    hostname:    r.hostname,
    role:        r.role,
    os:          r.os,
    arch:        r.arch,
    status:      r.status,
    capacity:    r.capacity,      // jsonb — node-postgres returns parsed objects
    network:     r.network,
    facts:       r.facts,
    lastProbed:  r.last_probed === null ? null : Number(r.last_probed),
    lastUpdated: Number(r.last_updated),
  }
}

export const engramRoutes: FastifyPluginAsync<EngramRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  void opts

  // Single shared pool to the Engram Postgres. All reads fail graceful (empty result)
  // when the DB is unreachable — matches the prior SQLite try/catch behaviour.
  const pool = new Pool({ ...engramConfig.pg, max: 4, connectionTimeoutMillis: 3000 })
  fastify.addHook('onClose', async () => { await pool.end().catch(() => {}) })

  // Ensure the tables exist (idempotent). Non-fatal if the DB is down at boot.
  try {
    const client = await pool.connect()
    try { for (const stmt of POSTGRES_SCHEMA) await client.query(stmt) }
    finally { client.release() }
  } catch (err) {
    fastify.log.warn({ err }, 'engram: could not ensure Postgres schema at boot (DB down?)')
  }

  // GET /api/engram/infrastructure — live probe of AI compute components
  app.get('/infrastructure', {}, async (_request, reply) => {
    return reply.send(await probeEngramInfrastructure())
  })

  // GET /api/engram/queries — paginated MCP tool-call / usage log
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
      try {
        const where = tool ? 'WHERE tool = $1' : ''
        const rows = await pool.query(
          `SELECT id, ts, tool, params, result_count, result_ids, latency_ms
           FROM knowledge_queries ${where}
           ORDER BY ts DESC LIMIT $${tool ? 2 : 1} OFFSET $${tool ? 3 : 2}`,
          tool ? [tool, limit, offset] : [limit, offset],
        )
        const totalRes = await pool.query(
          `SELECT COUNT(*)::int AS n FROM knowledge_queries ${where}`,
          tool ? [tool] : [],
        )
        return reply.send({ queries: rows.rows, total: totalRes.rows[0]?.n ?? 0 })
      } catch (err) {
        fastify.log.debug({ err }, 'engram/queries: db unreachable')
        return reply.send({ queries: [], total: 0 })
      }
    }
  )

  // GET /api/engram/ingestion-history — ingest-run log
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
      try {
        const where = strategy ? 'WHERE strategy = $1' : ''
        const rows = await pool.query(
          `SELECT id, ts, dataset, entry_count, success_count, failure_count, improved, duration_ms, flags
           FROM ingestion_runs ${where}
           ORDER BY ts DESC LIMIT $${strategy ? 2 : 1} OFFSET $${strategy ? 3 : 2}`,
          strategy ? [strategy, limit, offset] : [limit, offset],
        )
        const totalRes = await pool.query(
          `SELECT COUNT(*)::int AS n FROM ingestion_runs ${where}`,
          strategy ? [strategy] : [],
        )
        return reply.send({ runs: rows.rows, total: totalRes.rows[0]?.n ?? 0 })
      } catch (err) {
        fastify.log.debug({ err }, 'engram/ingestion-history: db unreachable')
        return reply.send({ runs: [], total: 0 })
      }
    }
  )

  // GET /api/engram/stats — pgvector counts + total entries (embed-only, post-Cognee)
  app.get(
    '/stats',
    {
      schema: {
        querystring: z.object({ dataset: z.string().min(1).max(128).optional() }),
        response: {
          200: z.object({
            totalEntries: z.number().int(),
            strategy: z.enum(['embed-only', 'embed+graph', 'full-engram']),
            pgvector: z.object({
              chunks: z.number().int(),
              summaries: z.number().int(),
              entities: z.number().int(),
            }).nullable(),
          }),
        },
      },
    },
    async (_request, reply) => {
      let totalEntries = 0
      let pgvector: { chunks: number; summaries: number; entities: number } | null = null
      try {
        const client = await pool.connect()
        try {
          const chunksRes = await client.query<{ n: number }>(
            `SELECT COUNT(*)::int AS n FROM engram_chunks WHERE project = 'weaver'`)
          const entriesRes = await client.query<{ n: number }>(
            `SELECT COUNT(DISTINCT entry_id)::int AS n FROM engram_chunks
             WHERE project = 'weaver' AND chunk_type = 'knowledge_entry'`)
          totalEntries = entriesRes.rows[0]?.n ?? 0
          // Post-Cognee: no graph — summaries/entities are 0; chunks is the served-store count.
          pgvector = { chunks: chunksRes.rows[0]?.n ?? 0, summaries: 0, entities: 0 }
        } finally {
          client.release()
        }
      } catch (err) {
        fastify.log.debug({ err }, 'engram/stats: pgvector unreachable')
      }
      return reply.send({ totalEntries, strategy: 'embed-only', pgvector })
    }
  )

  // GET /api/engram/status — summary: last ingest, call counts per tool, total queries
  app.get('/status', {}, async (_request, reply) => {
    try {
      const [lastRes, toolsRes, totalRes] = await Promise.all([
        pool.query(
          `SELECT ts, dataset, entry_count, success_count, failure_count, improved, duration_ms
           FROM ingestion_runs ORDER BY ts DESC LIMIT 1`),
        pool.query(
          `SELECT tool, COUNT(*)::int AS count, AVG(latency_ms)::float AS avg_latency_ms, MAX(ts) AS last_called
           FROM knowledge_queries GROUP BY tool ORDER BY count DESC`),
        pool.query(`SELECT COUNT(*)::int AS n FROM knowledge_queries`),
      ])
      const lastIngestion = lastRes.rows[0]
        ? { ...lastRes.rows[0], ts: Number(lastRes.rows[0].ts) }
        : null
      const queryCountsByTool = toolsRes.rows.map((r: Record<string, unknown>) => ({
        ...r, last_called: r.last_called === null ? null : Number(r.last_called),
      }))
      return reply.send({
        dbExists: true,
        dbSizeBytes: 0,               // unified Postgres — per-file size is not meaningful
        lastIngestion,
        queryCountsByTool,
        totalQueries: totalRes.rows[0]?.n ?? 0,
      })
    } catch (err) {
      fastify.log.debug({ err }, 'engram/status: db unreachable')
      return reply.send({ dbExists: false, dbSizeBytes: 0, lastIngestion: null, queryCountsByTool: [], totalQueries: 0 })
    }
  })

  // ── Host inventory CRUD (Postgres) ─────────────────────────────────────────

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

  // GET /api/engram/hosts
  app.get('/hosts', {}, async (_request, reply) => {
    try {
      const rows = await pool.query<HostRow>(
        `SELECT hostname, role, os, arch, status, capacity, network, facts, last_probed, last_updated
         FROM hosts ORDER BY hostname`)
      return reply.send({ hosts: rows.rows.map(rowToHost) })
    } catch {
      return reply.send({ hosts: [] })
    }
  })

  // POST /api/engram/hosts — create
  app.post('/hosts', { schema: { body: hostBodySchema } }, async (request, reply) => {
    const b = request.body
    const existing = await pool.query('SELECT hostname FROM hosts WHERE hostname = $1', [b.hostname])
    if (existing.rows.length) return reply.status(409).send({ error: `Host "${b.hostname}" already exists` })
    const row = await pool.query<HostRow>(
      `INSERT INTO hosts (hostname, role, os, arch, status, capacity, network, facts, content_hash, last_updated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'',$9)
       RETURNING hostname, role, os, arch, status, capacity, network, facts, last_probed, last_updated`,
      [b.hostname, b.role, b.os, b.arch, b.status, JSON.stringify(b.capacity), JSON.stringify(b.network), JSON.stringify(b.facts), Date.now()],
    )
    return reply.status(201).send({ host: rowToHost(row.rows[0]!) })
  })

  // PUT /api/engram/hosts/:hostname — update
  app.put('/hosts/:hostname', {
    schema: {
      params: z.object({ hostname: z.string().min(1).max(64) }),
      body: hostBodySchema.partial().omit({ hostname: true }),
    },
  }, async (request, reply) => {
    const { hostname } = request.params
    const b = request.body
    const existing = await pool.query('SELECT hostname FROM hosts WHERE hostname = $1', [hostname])
    if (!existing.rows.length) return reply.status(404).send({ error: `Host "${hostname}" not found` })
    const fields: string[] = []
    const vals: unknown[] = []
    let i = 1
    if (b.role     !== undefined) { fields.push(`role = $${i++}`);     vals.push(b.role) }
    if (b.os       !== undefined) { fields.push(`os = $${i++}`);       vals.push(b.os) }
    if (b.arch     !== undefined) { fields.push(`arch = $${i++}`);     vals.push(b.arch) }
    if (b.status   !== undefined) { fields.push(`status = $${i++}`);   vals.push(b.status) }
    if (b.capacity !== undefined) { fields.push(`capacity = $${i++}`); vals.push(JSON.stringify(b.capacity)) }
    if (b.network  !== undefined) { fields.push(`network = $${i++}`);  vals.push(JSON.stringify(b.network)) }
    if (b.facts    !== undefined) { fields.push(`facts = $${i++}`);    vals.push(JSON.stringify(b.facts)) }
    if (fields.length === 0) return reply.status(400).send({ error: 'No fields to update' })
    fields.push(`last_updated = $${i++}`); vals.push(Date.now())
    vals.push(hostname)
    const row = await pool.query<HostRow>(
      `UPDATE hosts SET ${fields.join(', ')} WHERE hostname = $${i}
       RETURNING hostname, role, os, arch, status, capacity, network, facts, last_probed, last_updated`,
      vals,
    )
    return reply.send({ host: rowToHost(row.rows[0]!) })
  })

  // DELETE /api/engram/hosts/:hostname
  app.delete('/hosts/:hostname', {
    schema: { params: z.object({ hostname: z.string().min(1).max(64) }) },
  }, async (request, reply) => {
    const { hostname } = request.params
    const res = await pool.query('DELETE FROM hosts WHERE hostname = $1', [hostname])
    if (res.rowCount === 0) return reply.status(404).send({ error: `Host "${hostname}" not found` })
    return reply.send({ deleted: hostname })
  })

  // POST /api/engram/hosts/sync — upsert all hosts from inventory YAML, check reachability
  // via TCP connect (port 22, 3s timeout). No SSH auth — just tests connectivity.
  app.post('/hosts/sync', {}, async (_request, reply) => {
    const inventoryPath = process.env.HOSTS_INVENTORY_PATH
    if (!inventoryPath) return reply.status(501).send({ error: 'HOSTS_INVENTORY_PATH not configured' })
    if (!existsSync(inventoryPath)) return reply.status(404).send({ error: `Inventory not found: ${inventoryPath}` })

    let entries: Array<Record<string, unknown>>
    try {
      const doc = parseYaml(readFileSync(inventoryPath, 'utf8')) as { hosts?: Array<Record<string, unknown>> }
      entries = doc.hosts ?? []
    } catch (err) {
      return reply.status(422).send({ error: `Failed to parse inventory: ${String(err)}` })
    }

    async function checkReachable(ip: string): Promise<boolean> {
      return new Promise((resolve) => {
        const sock = createConnection({ host: ip, port: 22 })
        const timer = setTimeout(() => { sock.destroy(); resolve(false) }, 3000)
        sock.once('connect', () => { clearTimeout(timer); sock.destroy(); resolve(true) })
        sock.once('error',   () => { clearTimeout(timer); resolve(false) })
      })
    }

    const synced: string[] = []
    const errors: string[] = []
    const now = Date.now()

    for (const entry of entries) {
      const hostname = String(entry['hostname'] ?? '')
      if (!hostname) { errors.push('Entry missing hostname — skipped'); continue }
      try {
        const probe     = String(entry['probe'] ?? 'none')
        const probeHost = String(entry['probe_host'] ?? hostname)
        const network   = (entry['network'] ?? {}) as { ips?: Record<string, string>; bridges?: Record<string, string> }

        let status: string
        if (probe === 'local')      status = 'reachable'
        else if (probe === 'ssh')   status = await checkReachable(probeHost) ? 'reachable' : 'unreachable'
        else                        status = 'unknown'

        const role  = String(entry['role']  ?? 'other')
        const os    = String(entry['os']    ?? 'nixos')
        const arch  = String(entry['arch']  ?? 'x86_64')
        const facts = (entry['facts'] ?? {}) as Record<string, unknown>
        const net_  = { ips: network.ips ?? {}, bridges: network.bridges ?? {} }

        await pool.query(
          `INSERT INTO hosts (hostname, role, os, arch, status, capacity, network, facts, content_hash, last_updated)
           VALUES ($1,$2,$3,$4,$5,'{}',$6,$7,'',$8)
           ON CONFLICT (hostname) DO UPDATE SET
             role=$2, os=$3, arch=$4, status=$5, network=$6, facts=$7, last_updated=$8`,
          [hostname, role, os, arch, status, JSON.stringify(net_), JSON.stringify(facts), now],
        )
        synced.push(hostname)
      } catch (err) {
        errors.push(`${hostname}: ${String(err)}`)
      }
    }
    return reply.send({ synced: synced.length, hosts: synced, errors })
  })
}
