// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// The API error handler and the error schema routes declare, through `fastify.inject()`.
//
// The handler answers a validation failure with `{ error, details }`, the specific messages in
// `details`. But a route's response schema is also a filter: the serializer drops any field the
// schema for that status does not declare. Every route declared its error statuses with
// `z.object({ error: z.string() })`, in thirteen copies across eight files, so on any route that
// declared a 400 — VM create and clone among them — the messages were stripped and a person was
// told "Validation failed" and not which field. Found 2026-10-07 from a Gantry session, where the
// same narrow schema did the same thing.
//
// The load-bearing assertion is that the SPECIFIC message reaches the client through a real
// route; a status-code check passes on the broken code too.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { DashboardConfig } from '../../src/config.js'

vi.mock('../../src/services/microvm.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/microvm.js')>()),
  getWorkloadDefinitions: vi.fn(async () => ({})),
  getVm: vi.fn(async () => null),
  createVm: vi.fn(),
}))

import Fastify from 'fastify'
import { z } from 'zod'
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'
import { apiErrorHandler, FALLBACK_VALIDATION_DETAIL } from '../../src/error-handler.js'
import { workloadsRoutes } from '../../src/routes/workloads.js'

async function buildApp() {
  const fastify = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>()
  fastify.decorateRequest('userId', undefined)
  fastify.decorateRequest('userRole', undefined)
  fastify.decorateRequest('username', undefined)
  fastify.setValidatorCompiler(validatorCompiler)
  fastify.setSerializerCompiler(serializerCompiler)
  fastify.setErrorHandler(apiErrorHandler)
  fastify.addHook('onRequest', async (request) => {
    request.userRole = 'admin'
    request.userId = 'test-user-id'
    request.username = 'test-user'
  })
  fastify.post(
    '/things',
    { schema: { body: z.object({ name: z.string().min(1).max(64) }) } },
    async () => ({ ok: true }),
  )
  fastify.get('/boom', async () => {
    throw new Error('ENOENT: /run/secret/path/that/must/not/leak')
  })
  await fastify.register(workloadsRoutes, {
    prefix: '/api/workload',
    config: { tier: 'solo', bridgeGateway: '10.10.0.1', bridgeInterface: 'br-microvm', provisioningEnabled: false } as unknown as DashboardConfig,
    networkManager: null,
    provisioner: null,
    auditService: undefined as never,
  })
  await fastify.ready()
  return fastify
}

describe('apiErrorHandler', () => {
  const env = process.env.NODE_ENV
  afterEach(() => { process.env.NODE_ENV = env })

  it('a validation failure answers 400 with the specific message, not the fallback', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/things', payload: { name: '' } })
    expect(res.statusCode).toBe(400)
    const body = res.json() as { error: string; details: string[] }
    expect(body.error).toBe('Validation failed')
    expect(body.details).not.toEqual([FALLBACK_VALIDATION_DETAIL])
    expect(body.details.join(' ')).toMatch(/at least 1 character/)
    await app.close()
  })

  it('in production a server error answers 500 without the raw message', async () => {
    process.env.NODE_ENV = 'production'
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/boom' })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ error: 'Internal Server Error' })
    await app.close()
  })

  it("a route's own 400 schema keeps the details the handler sends: VM clone", async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/workload/web-nginx/clone',
      payload: { name: 'x'.repeat(65) },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json() as { error: string; details?: string[] }
    expect(body.details?.join(' ')).toMatch(/at most 64 character/)
    await app.close()
  })
})

describe('one error schema', () => {
  // A retyped error shape is how thirteen copies came to agree with each other and not with the
  // handler. Each route imports `errorResponseSchema` from `schemas/errors.ts` instead.
  const RETYPED = /z\.object\(\{\s*error:\s*z\.string\(\)\s*,?\s*\}\)/

  it('the pattern catches a retyped error shape, and passes an import of the shared one', () => {
    expect(RETYPED.test('400: z.object({ error: z.string() }),')).toBe(true)
    expect(RETYPED.test('const e = z.object({\n  error: z.string(),\n})')).toBe(true)
    expect(RETYPED.test('400: errorResponseSchema,')).toBe(false)
    expect(RETYPED.test("z.object({ error: z.string(), code: z.literal('x') })")).toBe(false)
  })

  it('no route or schema module retypes it', () => {
    const src = join(import.meta.dirname, '../../src')
    const offenders: string[] = []
    for (const dir of ['routes', 'schemas']) {
      for (const f of readdirSync(join(src, dir))) {
        if (!f.endsWith('.ts') || (dir === 'schemas' && f === 'errors.ts')) continue
        if (RETYPED.test(readFileSync(join(src, dir, f), 'utf8'))) offenders.push(`${dir}/${f}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
