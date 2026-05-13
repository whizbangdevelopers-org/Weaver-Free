// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'
import { engramRoutes } from '../../src/routes/engram.js'
import {
  openEngramDb, logQuery, logIngestionRun, upsertIngestedEntry,
  resolveEngramDbPath, type IngestedEntryRecord,
} from '../../../codebase-mcp/src/utils/engram-db.js'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const TEST_DIR = join('/tmp', `engram-routes-test-${randomUUID()}`)
const DATA_DIR = join(TEST_DIR, 'data')

const ENTRY_A: IngestedEntryRecord = {
  entryId: 'L-backend-2026-05-01-001',
  contentHash: 'abc', dataId: 'data-001', datasetId: 'project_knowledge',
  domain: 'backend', type: 'lesson', scope: 'transferable', status: 'active',
  tags: '["fastify"]', sinceVersion: '1.0.0', title: 'Use Zod for validation',
  related: '["L-backend-2026-05-01-002"]', ingestedAt: Date.now(),
}
const ENTRY_B: IngestedEntryRecord = {
  entryId: 'L-backend-2026-05-01-002',
  contentHash: 'def', dataId: 'data-002', datasetId: 'project_knowledge',
  domain: 'backend', type: 'gotcha', scope: 'project', status: 'active',
  tags: '["errors"]', sinceVersion: '1.0.0', title: 'Never return raw errors',
  related: '["L-backend-2026-05-01-001"]', ingestedAt: Date.now(),
}

const BACKEND_LESSONS_MD = `\
<!-- entry:L-backend-2026-05-01-001 -->
---
id: L-backend-2026-05-01-001
scope: transferable
---

## Use Zod for validation

content one

<!-- /entry -->
<!-- entry:L-backend-2026-05-01-002 -->
---
id: L-backend-2026-05-01-002
scope: project
---

## Never return raw errors

content two

<!-- /entry -->`

describe('Engram Routes', () => {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()

  beforeAll(async () => {
    await mkdir(DATA_DIR, { recursive: true })

    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    // Pre-populate engram.db with test data (resolveEngramDbPath → DATA_DIR/engram.db)
    const db = openEngramDb(resolveEngramDbPath(TEST_DIR))
    logQuery(db, { tool: 'queryKnowledge', params: { domain: 'backend' }, resultCount: 3, resultIds: ['L-backend-2026-05-01-001'], latencyMs: 12 })
    logQuery(db, { tool: 'getLessonsLearned', params: { category: 'E2E' }, resultCount: 1, resultIds: [], latencyMs: 8 })
    logIngestionRun(db, { dataset: 'knowledge_entries', entryCount: 5, successCount: 5, failureCount: 0, improved: true, durationMs: 3200, flags: { dryRun: false, noReset: false } })
    upsertIngestedEntry(db, ENTRY_A)
    upsertIngestedEntry(db, ENTRY_B)

    // Knowledge files for POST /view tests
    await mkdir(join(TEST_DIR, 'docs', 'knowledge', 'lessons'), { recursive: true })
    await mkdir(join(TEST_DIR, 'docs', 'knowledge', 'gotchas'), { recursive: true })
    await writeFile(join(TEST_DIR, 'docs', 'knowledge', 'lessons', 'backend.md'), BACKEND_LESSONS_MD)

    // Guarantee 'code' is not found — prevents editor popping open during tests
    process.env.CODE_BIN = '/nonexistent/code-bin'

    await fastify.register(engramRoutes, { prefix: '/api/engram', dataDir: DATA_DIR })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {})
  })

  describe('GET /api/engram/queries', () => {
    it('returns query log', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/queries' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(2)
      expect(body.queries).toHaveLength(2)
    })

    it('filters by tool', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/queries?tool=queryKnowledge' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(1)
      expect(body.queries[0].tool).toBe('queryKnowledge')
    })
  })

  describe('GET /api/engram/ingestion-history', () => {
    it('returns ingestion runs', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/ingestion-history' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(1)
      expect(body.runs[0].dataset).toBe('knowledge_entries')
      expect(body.runs[0].success_count).toBe(5)
    })
  })

  describe('GET /api/engram/status', () => {
    it('returns status summary', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/status' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.dbExists).toBe(true)
      expect(body.totalQueries).toBe(2)
      expect(body.queryCountsByTool).toHaveLength(2)
      expect(body.lastIngestion).not.toBeNull()
      expect(body.dbSizeBytes).toBeGreaterThan(0)
    })
  })

  describe('GET /api/engram/entries', () => {
    it('returns domain breakdown from ingested_entries', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/entries' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      // ENTRY_A: (backend, lesson, transferable), ENTRY_B: (backend, gotcha, project) — 2 groups, 2 total
      expect(body.total).toBe(2)
      expect(body.entries).toHaveLength(2)
      expect(body.entries.every((e: { domain: string }) => e.domain === 'backend')).toBe(true)
      expect(body.entries.map((e: { type: string }) => e.type).sort()).toEqual(['gotcha', 'lesson'])
    })
  })

  describe('GET /api/engram/graph-data', () => {
    it('returns nodes for all ingested entries', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/graph-data' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.nodes).toHaveLength(2)
      const ids = body.nodes.map((n: { id: string }) => n.id)
      expect(ids).toContain(ENTRY_A.entryId)
      expect(ids).toContain(ENTRY_B.entryId)
    })

    it('deduplicates bidirectional related edges to one edge', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/graph-data' })
      const body = res.json()
      // Both entries point to each other (bidirectional) → deduplicated to 1 edge
      expect(body.edges).toHaveLength(1)
      const edge = body.edges[0]
      expect(edge).toHaveProperty('source')
      expect(edge).toHaveProperty('target')
    })
  })

  describe('GET /api/engram/stats', () => {
    it('returns totalEntries from SQLite and embed-only strategy', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/stats' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.totalEntries).toBe(2)
      expect(body.strategy).toBe('embed-only')
      // pgvector is null when Postgres unreachable, or an object when available — both valid
      if (body.pgvector !== null) {
        expect(typeof body.pgvector.chunks).toBe('number')
        expect(typeof body.pgvector.summaries).toBe('number')
        expect(typeof body.pgvector.entities).toBe('number')
      }
    })
  })

  describe('POST /api/engram/view', () => {
    it('returns entryCount and temp path for all entries in domain', async () => {
      const res = await fastify.inject({
        method: 'POST', url: '/api/engram/view',
        payload: { domain: 'backend' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.entryCount).toBe(2)
      expect(typeof body.path).toBe('string')
      expect(body.path).toMatch(/\/tmp\/engram-view-\d+\.md/)
      expect(body.opened).toBe(false)  // CODE_BIN set to nonexistent path
    })

    it('filters to transferable scope only', async () => {
      const res = await fastify.inject({
        method: 'POST', url: '/api/engram/view',
        payload: { domain: 'backend', scope: 'transferable' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().entryCount).toBe(1)
    })

    it('returns entryCount=0 and path=null for unknown domain', async () => {
      const res = await fastify.inject({
        method: 'POST', url: '/api/engram/view',
        payload: { domain: 'nonexistent' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.entryCount).toBe(0)
      expect(body.path).toBeNull()
    })

    it('returns 400 for domain failing regex validation', async () => {
      const res = await fastify.inject({
        method: 'POST', url: '/api/engram/view',
        payload: { domain: 'INVALID-UPPER' },
      })
      expect(res.statusCode).toBe(400)
    })
  })
})
