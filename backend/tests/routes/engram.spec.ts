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
    // Dedicated test dataset for write/upgrade tests (isolated from canonical datasets)
    db.prepare("INSERT OR IGNORE INTO dataset_config (dataset_name, strategy) VALUES ('test_write_dataset', 'embed-only')").run()

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

  describe('GET /api/engram/infrastructure', () => {
    it('returns status for all four components and method feasibility', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/infrastructure' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      // All services unreachable in test env — shape still correct
      expect(typeof body.llm.available).toBe('boolean')
      expect(typeof body.embedding.available).toBe('boolean')
      expect(typeof body.pipeline.available).toBe('boolean')
      expect(typeof body.pgvector.available).toBe('boolean')
      expect(typeof body.embedding.headroomPer15s === 'number' || body.embedding.headroomPer15s === null).toBe(true)
      expect(typeof body.polledAt).toBe('number')
      // gradual is always feasible
      expect(body.methodFeasibility.gradual).toBe(true)
      // all other methods require embedding — which is down in test env
      expect(body.methodFeasibility.additive).toBe(body.embedding.available)
      expect(body.methodFeasibility.priorityTrickle).toBe(body.embedding.available && body.pipeline.available)
      expect(body.methodFeasibility.bulkReprocess).toBe(body.embedding.available && body.pipeline.available)
      expect(body.methodFeasibility.parallelAtomic).toBe(body.embedding.available && body.pipeline.available && body.pgvector.available)
    })
  })

  describe('GET /api/engram/strategies', () => {
    it('returns the seeded strategy map from dataset_config', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/strategies' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.project_knowledge).toBe('embed-only')
      expect(body.fom_registry).toBe('full-cognify')
    })
  })

  describe('Dataset config API', () => {
    it('GET /datasets/:name/config returns 404 for unknown dataset', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/datasets/nonexistent/config' })
      expect(res.statusCode).toBe(404)
    })

    it('GET /datasets/:name/config returns config for seeded dataset', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/datasets/project_knowledge/config' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.datasetName).toBe('project_knowledge')
      expect(body.strategy).toBe('embed-only')
      expect(body.pendingStrategy).toBeNull()
    })

    it('PUT /datasets/:name/config updates test dataset strategy forward', async () => {
      const res = await fastify.inject({
        method: 'PUT', url: '/api/engram/datasets/test_write_dataset/config',
        payload: { strategy: 'embed+graph' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().strategy).toBe('embed+graph')
    })

    it('PUT /datasets/:name/config rejects downgrade', async () => {
      const res = await fastify.inject({
        method: 'PUT', url: '/api/engram/datasets/fom_registry/config',
        payload: { strategy: 'embed-only' },
      })
      expect(res.statusCode).toBe(422)
    })

    it('PUT /datasets/:name/config returns 400 for invalid dataset name', async () => {
      const res = await fastify.inject({
        method: 'PUT', url: '/api/engram/datasets/INVALID/config',
        payload: { strategy: 'embed+graph' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('Upgrade queue API', () => {
    it('POST /datasets/:name/upgrade enqueues a job for test dataset', async () => {
      // test_write_dataset is now at embed+graph (updated by Dataset config API test above)
      const res = await fastify.inject({
        method: 'POST', url: '/api/engram/datasets/test_write_dataset/upgrade',
        payload: { target_strategy: 'full-cognify', method: 'gradual' },
      })
      expect(res.statusCode).toBe(202)
      const body = res.json()
      expect(body.datasetName).toBe('test_write_dataset')
      expect(body.targetStrategy).toBe('full-cognify')
      expect(typeof body.id).toBe('number')
      expect(['running', 'queued']).toContain(body.status)
    })

    it('POST /datasets/:name/upgrade rejects same-level target', async () => {
      const res = await fastify.inject({
        method: 'POST', url: '/api/engram/datasets/fom_registry/upgrade',
        payload: { target_strategy: 'full-cognify', method: 'gradual' },
      })
      expect(res.statusCode).toBe(422)
    })

    it('GET /api/engram/queue returns queue entries', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/queue' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(Array.isArray(body.queue)).toBe(true)
      expect(body.queue.length).toBeGreaterThan(0)
    })

    it('GET /datasets/:name/upgrade/status returns current + latest job', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/datasets/test_write_dataset/upgrade/status' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.datasetName).toBe('test_write_dataset')
      expect(typeof body.currentStrategy).toBe('string')
      expect(body.latestJob).not.toBeNull()
    })

    it('DELETE /api/engram/queue/:id removes an entry', async () => {
      const qRes = await fastify.inject({ method: 'GET', url: '/api/engram/queue' })
      const { queue } = qRes.json()
      const id = (queue[0] as { id: number }).id
      const del = await fastify.inject({ method: 'DELETE', url: `/api/engram/queue/${id}` })
      expect(del.statusCode).toBe(204)
      const qRes2 = await fastify.inject({ method: 'GET', url: '/api/engram/queue' })
      const ids2 = (qRes2.json().queue as Array<{ id: number }>).map((e) => e.id)
      expect(ids2).not.toContain(id)
    })
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
    it('returns entryCount and inline content for all entries in domain', async () => {
      const res = await fastify.inject({
        method: 'POST', url: '/api/engram/view',
        payload: { domain: 'backend' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.entryCount).toBe(2)
      expect(typeof body.content).toBe('string')
      expect(body.content).toContain('Use Zod for validation')
      expect(body.content).toContain('Never return raw errors')
    })

    it('filters to transferable scope only', async () => {
      const res = await fastify.inject({
        method: 'POST', url: '/api/engram/view',
        payload: { domain: 'backend', scope: 'transferable' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().entryCount).toBe(1)
    })

    it('returns entryCount=0 and content=null for unknown domain', async () => {
      const res = await fastify.inject({
        method: 'POST', url: '/api/engram/view',
        payload: { domain: 'nonexistent' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.entryCount).toBe(0)
      expect(body.content).toBeNull()
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
