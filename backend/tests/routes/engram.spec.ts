// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'
import { engramRoutes } from '../../src/routes/engram.js'
import { openEngramDb, logQuery, logIngestionRun, resolveEngramDbPath } from '../../../codebase-mcp/src/utils/engram-db.js'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const TEST_DIR = join('/tmp', `engram-routes-test-${randomUUID()}`)
const DATA_DIR = join(TEST_DIR, 'data')

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
})
