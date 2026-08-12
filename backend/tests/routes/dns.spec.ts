// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// `GET /api/dns/zone` and `/zone/:name`.
//
// The property under test is that the three "no records" states stay distinguishable on the wire:
// below Solo there is no zone, at Solo the resolver may be disabled, and with both there may
// simply be nothing to publish yet. A client that has to infer which from `records.length === 0`
// will get it wrong — most visibly by showing an upgrade prompt to someone who has already paid.
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'
import { dnsRoutes } from '../../src/routes/dns.js'
import { buildZone } from '../../src/services/dns-zone.js'
import type { DashboardConfig } from '../../src/config.js'
import type { UserRole } from '../../src/models/user.js'

let mockUserRole: UserRole = 'admin'

const ZONE = buildZone(
  [
    { name: 'web', ip: '10.10.0.10' },
    { name: 'db', ip: '10.10.0.20' },
    { name: 'ghost' }, // no address — skipped, with a reason
  ],
  { serial: 4 },
)

async function buildApp(opts: { tier?: string; zone?: ReturnType<typeof buildZone> | null } = {}) {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  fastify.decorateRequest('userId', undefined)
  fastify.decorateRequest('userRole', undefined)
  fastify.decorateRequest('username', undefined)
  fastify.setValidatorCompiler(validatorCompiler)
  fastify.setSerializerCompiler(serializerCompiler)
  fastify.addHook('onRequest', async (request) => {
    request.userRole = mockUserRole
    request.userId = 'u'
    request.username = 'u'
  })
  await fastify.register(dnsRoutes, {
    prefix: '/api/dns',
    config: { tier: opts.tier ?? 'weaver', dnsDomain: 'vm.internal' } as unknown as DashboardConfig,
    getZone: () => (opts.zone === undefined ? ZONE : opts.zone),
  })
  await fastify.ready()
  return fastify
}

const get = (app: Awaited<ReturnType<typeof buildApp>>, url: string) =>
  app.inject({ method: 'GET', url })

describe('GET /api/dns/zone', () => {
  beforeEach(() => { mockUserRole = 'admin' })

  it('serves the zone at Solo', async () => {
    const app = await buildApp({ tier: 'weaver' })
    const body = (await get(app, '/api/dns/zone')).json()

    expect(body.available).toBe(true)
    expect(body.domain).toBe('vm.internal')
    expect(body.serial).toBe(4)
    expect(body.records.filter((r: { type: string }) => r.type === 'A')).toHaveLength(2)
    await app.close()
  })

  describe('the three empty states stay distinguishable', () => {
    it('below Solo: unavailable, with the tier as the reason', async () => {
      const app = await buildApp({ tier: 'free' })
      const body = (await get(app, '/api/dns/zone')).json()

      // 200 and not 403: "what does DNS resolve here" has a true answer at Free — nothing —
      // and an error would force the UI to special-case a state that is not an error.
      expect(body.available).toBe(false)
      expect(body.reason).toMatch(/Solo/)
      expect(body.records).toEqual([])
      await app.close()
    })

    it('at Solo with no writer: unavailable, with a different reason', async () => {
      const app = await buildApp({ tier: 'weaver', zone: null })
      const body = (await get(app, '/api/dns/zone')).json()

      expect(body.available).toBe(false)
      expect(body.reason).toMatch(/not enabled/)
      // Distinct from the tier reason above. Showing an upgrade prompt to a paying customer
      // whose resolver is merely switched off is the failure this separation prevents.
      expect(body.reason).not.toMatch(/Solo/)
      await app.close()
    })

    it('at Solo with an empty zone: AVAILABLE and empty', async () => {
      const app = await buildApp({ tier: 'weaver', zone: buildZone([], { serial: 1 }) })
      const body = (await get(app, '/api/dns/zone')).json()

      // The state a client must not confuse with either of the two above: DNS Core is working
      // and there is simply nothing to publish yet.
      expect(body.available).toBe(true)
      expect(body.records).toEqual([])
      expect(body.reason).toBeUndefined()
      await app.close()
    })
  })

  it('reports skipped workloads with their reason', async () => {
    const app = await buildApp()
    const body = (await get(app, '/api/dns/zone')).json()
    expect(body.skipped).toEqual([{ name: 'ghost', reason: 'no IPv4 address' }])
    await app.close()
  })

  it('lets a viewer read the zone', async () => {
    mockUserRole = 'viewer'
    const app = await buildApp()
    expect((await get(app, '/api/dns/zone')).statusCode).toBe(200)
    await app.close()
  })
})

describe('GET /api/dns/zone/:name', () => {
  beforeEach(() => { mockUserRole = 'admin' })

  it('returns only that workload records', async () => {
    const app = await buildApp()
    const body = (await get(app, '/api/dns/zone/web')).json()

    expect(body.records.every((r: { vmName: string }) => r.vmName === 'web')).toBe(true)
    expect(body.records.filter((r: { type: string }) => r.type === 'A')).toHaveLength(1)
    await app.close()
  })

  it('404s a workload with no records and no reason', async () => {
    const app = await buildApp()
    expect((await get(app, '/api/dns/zone/nonexistent')).statusCode).toBe(404)
    await app.close()
  })

  it('200s a SKIPPED workload, carrying why it has no record', async () => {
    // A 404 here would discard the reason, which is the only useful thing to say about a
    // workload that was deliberately excluded.
    const app = await buildApp()
    const res = await get(app, '/api/dns/zone/ghost')

    expect(res.statusCode).toBe(200)
    expect(res.json().records).toEqual([])
    expect(res.json().skipped).toEqual([{ name: 'ghost', reason: 'no IPv4 address' }])
    await app.close()
  })

  it('reports unavailability rather than 404 below Solo', async () => {
    // The workload may well exist; DNS just is not running. A 404 would say the wrong thing.
    const app = await buildApp({ tier: 'free' })
    const res = await get(app, '/api/dns/zone/web')

    expect(res.statusCode).toBe(200)
    expect(res.json().available).toBe(false)
    await app.close()
  })

  it('rejects a malformed workload name at the schema', async () => {
    const app = await buildApp()
    expect((await get(app, '/api/dns/zone/Bad_Name')).statusCode).toBe(400)
    await app.close()
  })
})
