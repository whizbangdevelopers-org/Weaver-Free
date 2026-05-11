// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'
import { engramRoutes } from '../../src/routes/engram.js'
import { AuthService } from '../../src/services/auth.js'
import { UserStore } from '../../src/storage/user-store.js'
import { MemorySessionStore } from '../../src/storage/memory-session-store.js'
import { createAuthMiddleware } from '../../src/middleware/auth.js'
import { openEngramDb, logQuery, logIngestionRun, resolveEngramDbPath } from '../../../codebase-mcp/src/utils/engram-db.js'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const TEST_DIR = join('/tmp', `engram-routes-test-${randomUUID()}`)
const DATA_DIR = join(TEST_DIR, 'data')
const JWT_SECRET = 'test-secret-for-engram-testing'

describe('Engram Routes', () => {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  let authService: AuthService
  let adminToken: string
  let operatorToken: string

  beforeAll(async () => {
    await mkdir(DATA_DIR, { recursive: true })

    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    // Pre-populate engram.db with test data (resolveEngramDbPath → DATA_DIR/engram.db)
    const db = openEngramDb(resolveEngramDbPath(TEST_DIR))
    logQuery(db, { tool: 'queryKnowledge', params: { domain: 'backend' }, resultCount: 3, resultIds: ['L-backend-2026-05-01-001'], latencyMs: 12 })
    logQuery(db, { tool: 'getLessonsLearned', params: { category: 'E2E' }, resultCount: 1, resultIds: [], latencyMs: 8 })
    logIngestionRun(db, { dataset: 'knowledge_entries', entryCount: 5, successCount: 5, failureCount: 0, improved: true, durationMs: 3200, flags: { dryRun: false, noReset: false } })

    // Set up auth
    const userStore = new UserStore(join(TEST_DIR, 'users.json'))
    await userStore.init()
    const sessionStore = new MemorySessionStore()
    authService = new AuthService(userStore, sessionStore, JWT_SECRET)

    fastify.addHook('onRequest', createAuthMiddleware(authService))
    await fastify.register(engramRoutes, { prefix: '/api/engram', dataDir: DATA_DIR })
    await fastify.ready()

    adminToken = (await authService.register('admin', 'T3stP@ssw0rd!X', 'admin')).token
    operatorToken = (await authService.register('operator', 'T3stP@ssw0rd!X', 'operator')).token
  })

  afterAll(async () => {
    await fastify.close()
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {})
  })

  describe('GET /api/engram/queries', () => {
    it('returns query log for admin', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/queries', headers: { authorization: `Bearer ${adminToken}` } })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(2)
      expect(body.queries).toHaveLength(2)
    })

    it('filters by tool', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/queries?tool=queryKnowledge', headers: { authorization: `Bearer ${adminToken}` } })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(1)
      expect(body.queries[0].tool).toBe('queryKnowledge')
    })

    it('returns 401 without auth', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/queries' })
      expect(res.statusCode).toBe(401)
    })

    it('returns 403 for non-admin', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/queries', headers: { authorization: `Bearer ${operatorToken}` } })
      expect(res.statusCode).toBe(403)
    })
  })

  describe('GET /api/engram/ingestion-history', () => {
    it('returns ingestion runs for admin', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/ingestion-history', headers: { authorization: `Bearer ${adminToken}` } })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(1)
      expect(body.runs[0].dataset).toBe('knowledge_entries')
      expect(body.runs[0].success_count).toBe(5)
    })

    it('returns 403 for non-admin', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/ingestion-history', headers: { authorization: `Bearer ${operatorToken}` } })
      expect(res.statusCode).toBe(403)
    })
  })

  describe('GET /api/engram/status', () => {
    it('returns status summary for admin', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/status', headers: { authorization: `Bearer ${adminToken}` } })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.dbExists).toBe(true)
      expect(body.totalQueries).toBe(2)
      expect(body.queryCountsByTool).toHaveLength(2)
      expect(body.lastIngestion).not.toBeNull()
      expect(body.dbSizeBytes).toBeGreaterThan(0)
    })

    it('returns 401 without auth', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/status' })
      expect(res.statusCode).toBe(401)
    })
  })
})
