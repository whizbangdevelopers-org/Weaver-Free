// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// `PUT /api/workload/:name/probes` — service-probe configuration.
//
// The probe ENGINE has its own suite (services/health-probe.spec.ts) and is not re-tested here.
// What this file covers is the seam between an HTTP caller and that engine, and specifically the
// three things a caller could otherwise get past it:
//
//   1. the tier gate — configuring is Solo, SEEING health is Free, and the asymmetry is the
//      feature's whole tier story;
//   2. `health` reaching the registry from a client — the field is computed on the host every
//      broadcast cycle, and a caller that could persist it could paint the dashboard green for a
//      service that is down;
//   3. a URL outside the private range — the SSRF control lives at egress, and this route's job is
//      to turn that refusal into a 400 with a reason rather than a silent `unreachable` badge.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DashboardConfig } from '../../src/config.js'
import type { UserRole } from '../../src/models/user.js'

vi.mock('../../src/services/microvm.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/microvm.js')>()),
  updateVmField: vi.fn(),
}))

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'
import { workloadsRoutes } from '../../src/routes/workloads.js'
import { updateVmField } from '../../src/services/microvm.js'

const mockUpdate = updateVmField as ReturnType<typeof vi.fn>

let mockUserRole: UserRole = 'admin'

function makeConfig(tier: string): DashboardConfig {
  return { tier, bridgeInterface: 'br-microvm', provisioningEnabled: false } as unknown as DashboardConfig
}

async function buildApp(tier = 'solo') {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  fastify.decorateRequest('userId', undefined)
  fastify.decorateRequest('userRole', undefined)
  fastify.decorateRequest('username', undefined)
  fastify.setValidatorCompiler(validatorCompiler)
  fastify.setSerializerCompiler(serializerCompiler)
  fastify.addHook('onRequest', async (request) => {
    request.userRole = mockUserRole
    request.userId = 'test-user-id'
    request.username = 'test-user'
  })
  await fastify.register(workloadsRoutes, { prefix: '/api/workload', config: makeConfig(tier) })
  await fastify.ready()
  return fastify
}

const put = async (app: Awaited<ReturnType<typeof buildApp>>, payload: unknown, name = 'web-nginx') =>
  // `await` matters: un-awaited, inject() types as its chainable union and `res.statusCode` fails
  // to resolve.
  await app.inject({ method: 'PUT', url: `/api/workload/${name}/probes`, payload: payload as never })

describe('PUT /api/workload/:name/probes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockUserRole = 'admin'
    mockUpdate.mockResolvedValue({ success: true, message: 'ok' })
  })
  afterEach(() => { vi.resetAllMocks() })

  describe('tier gate — configuring is Solo, seeing is Free', () => {
    it('403s below Solo', async () => {
      const app = await buildApp('free')
      const res = await put(app, { serviceProbes: [{ port: 80, type: 'tcp' }] })
      expect(res.statusCode).toBe(403)
      expect(mockUpdate).not.toHaveBeenCalled()
      await app.close()
    })

    it('accepts at Solo', async () => {
      const app = await buildApp('solo')
      const res = await put(app, { serviceProbes: [{ port: 80, type: 'tcp' }] })
      expect(res.statusCode).toBe(200)
      await app.close()
    })

    it('accepts at Fabrick — the gate is a floor, not an equality', async () => {
      const app = await buildApp('fabrick')
      const res = await put(app, { serviceProbes: [{ port: 80, type: 'tcp' }] })
      expect(res.statusCode).toBe(200)
      await app.close()
    })
  })

  describe('role gate — a tier gate is not an authorization gate', () => {
    it('403s a viewer even at Solo', async () => {
      mockUserRole = 'viewer'
      const app = await buildApp('solo')
      const res = await put(app, { serviceProbes: [{ port: 80, type: 'tcp' }] })
      expect(res.statusCode).toBe(403)
      expect(mockUpdate).not.toHaveBeenCalled()
      await app.close()
    })

    it('allows an operator', async () => {
      mockUserRole = 'operator'
      const app = await buildApp('solo')
      const res = await put(app, { serviceProbes: [{ port: 80, type: 'tcp' }] })
      expect(res.statusCode).toBe(200)
      await app.close()
    })
  })

  describe('health is never accepted from a client', () => {
    it('strips a posted `health` before it reaches the registry', async () => {
      const app = await buildApp()
      // A client claiming its dead service is healthy. If this survived to storage, `listVms`
      // would spread it back out on the next broadcast and the card would go green for a service
      // nobody contacted.
      const res = await put(app, {
        serviceProbes: [{ port: 80, type: 'tcp', health: 'healthy' }],
      })
      expect(res.statusCode).toBe(200)
      const stored = mockUpdate.mock.calls[0]?.[1] as { serviceProbes?: unknown[] }
      expect(stored.serviceProbes?.[0]).not.toHaveProperty('health')
      expect(JSON.parse(res.body).serviceProbes[0]).not.toHaveProperty('health')
      await app.close()
    })
  })

  describe('URL validation — the SSRF rule, surfaced as a 400', () => {
    it('rejects a public address', async () => {
      const app = await buildApp()
      const res = await put(app, {
        serviceProbes: [{ port: 80, type: 'http', url: 'http://93.184.216.34/' }],
      })
      expect(res.statusCode).toBe(400)
      expect(mockUpdate).not.toHaveBeenCalled()
      await app.close()
    })

    it('rejects the cloud metadata endpoint specifically', async () => {
      const app = await buildApp()
      const res = await put(app, {
        serviceProbes: [{ port: 80, type: 'http', url: 'http://169.254.169.254/latest/meta-data/' }],
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })

    it('rejects a HOSTNAME even one that would resolve privately', async () => {
      // DNS resolves at request time, so a name check is a TOCTOU gap: the answer at validation is
      // not the answer at connect. Names are refused outright.
      const app = await buildApp()
      const res = await put(app, {
        serviceProbes: [{ port: 80, type: 'http', url: 'http://localhost/' }],
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })

    it('rejects a non-http scheme', async () => {
      const app = await buildApp()
      const res = await put(app, {
        serviceProbes: [{ port: 80, type: 'http', url: 'file:///etc/passwd' }],
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })

    it('accepts an RFC1918 literal', async () => {
      const app = await buildApp()
      const res = await put(app, {
        serviceProbes: [{ port: 8080, type: 'http', url: 'http://10.10.0.10:8080/health' }],
      })
      expect(res.statusCode).toBe(200)
      await app.close()
    })
  })

  describe('shape', () => {
    it('rejects two probes on one port', async () => {
      const app = await buildApp()
      const res = await put(app, {
        serviceProbes: [{ port: 8080, type: 'tcp' }, { port: 8080, type: 'http' }],
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toContain('8080')
      expect(mockUpdate).not.toHaveBeenCalled()
      await app.close()
    })

    it('rejects a port outside 1–65535', async () => {
      const app = await buildApp()
      expect((await put(app, { serviceProbes: [{ port: 0, type: 'tcp' }] })).statusCode).toBe(400)
      expect((await put(app, { serviceProbes: [{ port: 70000, type: 'tcp' }] })).statusCode).toBe(400)
      await app.close()
    })

    it('rejects more than ten probes', async () => {
      const app = await buildApp()
      const many = Array.from({ length: 11 }, (_, i) => ({ port: 1000 + i, type: 'tcp' as const }))
      const res = await put(app, { serviceProbes: many })
      expect(res.statusCode).toBe(400)
      await app.close()
    })

    it('stores `undefined`, not `[]`, when the list is emptied', async () => {
      // The two are NOT equivalent downstream: `[]` renders as "probes configured, none healthy"
      // in any consumer that tests only for the key's presence, where `undefined` renders as
      // "no probes". Clearing must mean the second.
      const app = await buildApp()
      const res = await put(app, { serviceProbes: [] })
      expect(res.statusCode).toBe(200)
      expect((mockUpdate.mock.calls[0]?.[1] as { serviceProbes?: unknown }).serviceProbes).toBeUndefined()
      await app.close()
    })
  })

  describe('unknown workload', () => {
    it('404s when the registry has no such name', async () => {
      mockUpdate.mockResolvedValue({ success: false, message: "VM 'ghost' not found" })
      const app = await buildApp()
      const res = await put(app, { serviceProbes: [{ port: 80, type: 'tcp' }] }, 'ghost')
      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('checks the tier BEFORE the workload exists — a Free caller learns the real reason', async () => {
      mockUpdate.mockResolvedValue({ success: false, message: "VM 'ghost' not found" })
      const app = await buildApp('free')
      const res = await put(app, { serviceProbes: [{ port: 80, type: 'tcp' }] }, 'ghost')
      expect(res.statusCode).toBe(403)
      await app.close()
    })
  })
})
