// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// Post-Phase-B (WVR-198 §5.3): the route reads the unified Engram Postgres, not SQLite.
// These tests run against the real engram Postgres when it is reachable, so they DO NOT
// seed or delete telemetry rows (that would pollute real usage data) — read endpoints are
// asserted on shape + graceful-empty contract. Host CRUD mutates a clearly-test hostname
// and is gated on DB availability (skipped when Postgres is down, e.g. in CI).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'
import { engramRoutes } from '../../src/routes/engram.js'
import { engramConfig } from '../../src/services/engram-config.js'
import { Pool } from 'pg'

const TEST_HOST = 'test-phaseb-host'

describe('Engram Routes', () => {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  let pgUp = false

  beforeAll(async () => {
    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)
    process.env.CODE_BIN = '/nonexistent/code-bin'

    // Detect Postgres availability for the mutation tests.
    const probe = new Pool({ ...engramConfig.pg, max: 1, connectionTimeoutMillis: 2000 })
    try {
      const c = await probe.connect()
      c.release()
      pgUp = true
    } catch { pgUp = false }
    await probe.end().catch(() => {})

    await fastify.register(engramRoutes, { prefix: '/api/engram', dataDir: '/tmp' })
    await fastify.ready()
  })

  afterAll(async () => {
    // Clean up the test host if we created one.
    if (pgUp) {
      await fastify.inject({ method: 'DELETE', url: `/api/engram/hosts/${TEST_HOST}` }).catch(() => {})
    }
    await fastify.close()
  })

  describe('GET /api/engram/infrastructure', () => {
    it('returns status for all four components and method feasibility', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/infrastructure' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(typeof body.llm.available).toBe('boolean')
      expect(typeof body.embedding.available).toBe('boolean')
      expect(typeof body.pipeline.available).toBe('boolean')
      expect(typeof body.pgvector.available).toBe('boolean')
      expect(typeof body.polledAt).toBe('number')
      expect(body.methodFeasibility.gradual).toBe(true)
      expect(body.methodFeasibility.additive).toBe(body.embedding.available)
    })
  })

  describe('GET /api/engram/queries', () => {
    it('returns a well-formed query log (shape + graceful-empty)', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/queries' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(Array.isArray(body.queries)).toBe(true)
      expect(typeof body.total).toBe('number')
    })

    it('accepts the tool filter', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/queries?tool=queryKnowledge' })
      expect(res.statusCode).toBe(200)
      expect(Array.isArray(res.json().queries)).toBe(true)
    })
  })

  describe('GET /api/engram/ingestion-history', () => {
    it('returns a well-formed run log', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/ingestion-history' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(Array.isArray(body.runs)).toBe(true)
      expect(typeof body.total).toBe('number')
    })
  })

  describe('GET /api/engram/status', () => {
    it('returns a well-formed status summary', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/status' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(typeof body.dbExists).toBe('boolean')
      expect(typeof body.totalQueries).toBe('number')
      expect(Array.isArray(body.queryCountsByTool)).toBe(true)
      // lastIngestion is null (empty log) or an object with a numeric ts
      if (body.lastIngestion !== null) expect(typeof body.lastIngestion.ts).toBe('number')
    })
  })

  describe('GET /api/engram/stats', () => {
    it('returns embed-only strategy + pgvector counts (null when unreachable)', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/stats' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(typeof body.totalEntries).toBe('number')
      expect(body.strategy).toBe('embed-only')
      if (body.pgvector !== null) {
        expect(typeof body.pgvector.chunks).toBe('number')
        expect(body.pgvector.summaries).toBe(0)
        expect(body.pgvector.entities).toBe(0)
      }
    })
  })

  describe('GET /api/engram/hosts', () => {
    it('returns a well-formed host list', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/engram/hosts' })
      expect(res.statusCode).toBe(200)
      expect(Array.isArray(res.json().hosts)).toBe(true)
    })
  })

  // Mutation tests require a live Postgres — skipped when the DB is unreachable (e.g. CI).
  describe('Host CRUD (Postgres)', () => {
    it('POST creates, GET lists, PUT updates, DELETE removes a test host', async (ctx) => {
      if (!pgUp) return ctx.skip()

      const create = await fastify.inject({
        method: 'POST', url: '/api/engram/hosts',
        payload: { hostname: TEST_HOST, role: 'test', capacity: { cpus: 2 } },
      })
      expect(create.statusCode).toBe(201)
      expect(create.json().host.hostname).toBe(TEST_HOST)

      const dup = await fastify.inject({
        method: 'POST', url: '/api/engram/hosts',
        payload: { hostname: TEST_HOST, role: 'test' },
      })
      expect(dup.statusCode).toBe(409)

      const list = await fastify.inject({ method: 'GET', url: '/api/engram/hosts' })
      expect((list.json().hosts as Array<{ hostname: string }>).some((h) => h.hostname === TEST_HOST)).toBe(true)

      const put = await fastify.inject({
        method: 'PUT', url: `/api/engram/hosts/${TEST_HOST}`,
        payload: { status: 'reachable' },
      })
      expect(put.statusCode).toBe(200)
      expect(put.json().host.status).toBe('reachable')

      const del = await fastify.inject({ method: 'DELETE', url: `/api/engram/hosts/${TEST_HOST}` })
      expect(del.statusCode).toBe(200)

      const del404 = await fastify.inject({ method: 'DELETE', url: `/api/engram/hosts/${TEST_HOST}` })
      expect(del404.statusCode).toBe(404)
    })
  })
})
