// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// `GET /api/workload/:name/metrics`.
//
// The service suite covers the arithmetic. What this file covers is the wire: nullability
// surviving Fastify's response validation, the tier clamp being REPORTED and not just applied,
// and an absent collector degrading to an empty series rather than an error.
//
// The nullability case is the one that cannot be caught anywhere else. Zod strips unknown keys
// and coerces what it does not expect, so a schema written with `z.number()` instead of
// `z.number().nullable()` turns every "could not determine" into a validation failure — or worse,
// into a 0 — at the last hop, after the service layer spent real effort keeping the two apart.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DashboardConfig } from '../../src/config.js'
import type { UserRole } from '../../src/models/user.js'
import type { WorkloadDefinition } from '../../src/storage/workload-registry.js'

vi.mock('../../src/services/microvm.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/microvm.js')>()),
  getWorkloadDefinitions: vi.fn(),
}))

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'
import { workloadsRoutes } from '../../src/routes/workloads.js'
import { getWorkloadDefinitions } from '../../src/services/microvm.js'
import { MetricsCollector, SAMPLE_INTERVAL_MS } from '../../src/services/metrics.js'

const mockGetDefs = getWorkloadDefinitions as ReturnType<typeof vi.fn>

const VM = { name: 'web-nginx', ip: '10.10.0.10', mem: 512, vcpu: 2, hypervisor: 'qemu' } as WorkloadDefinition

let mockUserRole: UserRole = 'admin'

/** A collector fed from a fake cgroupfs, so no real filesystem is involved. */
function collectorWith(files: Record<string, string>, now: () => number) {
  return new MetricsCollector({
    read: async (p: string) => (p in files ? files[p]! : null),
    now,
    cgroupRoot: '/fake',
  })
}

async function buildApp(opts: { tier?: string; collector?: MetricsCollector | null } = {}) {
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
  await fastify.register(workloadsRoutes, {
    prefix: '/api/workload',
    config: { tier: opts.tier ?? 'weaver' } as unknown as DashboardConfig,
    metricsCollector: opts.collector === undefined ? null : opts.collector,
  })
  await fastify.ready()
  return fastify
}

const get = (app: Awaited<ReturnType<typeof buildApp>>, url: string) =>
  app.inject({ method: 'GET', url })

describe('GET /api/workload/:name/metrics', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockUserRole = 'admin'
    mockGetDefs.mockResolvedValue({ 'web-nginx': VM })
  })
  afterEach(() => { vi.resetAllMocks() })

  it('404s an unknown workload', async () => {
    mockGetDefs.mockResolvedValue({})
    const app = await buildApp()
    expect((await get(app, '/api/workload/no-such/metrics')).statusCode).toBe(404)
    await app.close()
  })

  it('returns an empty series — not an error — when no collector is running', async () => {
    // "Metrics are not being collected" and "this workload does not exist" are different facts,
    // and the second already has a 404. A 500 here would render a broken page for a feature that
    // is merely switched off.
    const app = await buildApp({ collector: null })
    const res = await get(app, '/api/workload/web-nginx/metrics')
    expect(res.statusCode).toBe(200)
    expect(res.json().samples).toEqual([])
    await app.close()
  })

  it('reports the interval alongside the samples', async () => {
    const app = await buildApp({ collector: null })
    expect((await get(app, '/api/workload/web-nginx/metrics')).json().intervalMs).toBe(SAMPLE_INTERVAL_MS)
    await app.close()
  })

  describe('nullability survives response validation', () => {
    it('serves a null cpuPercent as null, not 0 and not a validation error', async () => {
      let t = 1_000_000
      // Only memory is readable: cpu.stat is absent, so cpuPercent is null by construction.
      const collector = collectorWith({ '/fake/system.slice/microvm@web-nginx.service/memory.current': '4096' }, () => t)
      await collector.sampleOne('web-nginx', 2)

      const app = await buildApp({ collector })
      const res = await get(app, '/api/workload/web-nginx/metrics')
      expect(res.statusCode).toBe(200)

      const [s] = res.json().samples
      // The whole service layer works to keep "unknown" apart from "idle". A z.number() schema
      // here would collapse them at the very last hop.
      expect(s.cpuPercent).toBeNull()
      expect(s.memoryBytes).toBe(4096)
      await app.close()
    })

    it('serves a real 0 as 0', async () => {
      let t = 1_000_000
      const files = {
        '/fake/system.slice/microvm@web-nginx.service/cpu.stat': 'usage_usec 500',
        '/fake/system.slice/microvm@web-nginx.service/memory.current': '4096',
      }
      const collector = collectorWith(files, () => t)
      await collector.sampleOne('web-nginx', 2)
      t += 30_000
      await collector.sampleOne('web-nginx', 2) // counter unchanged → genuinely idle

      const app = await buildApp({ collector })
      const samples = (await get(app, '/api/workload/web-nginx/metrics')).json().samples
      expect(samples.at(-1).cpuPercent).toBe(0)
      await app.close()
    })
  })

  describe('tier windows', () => {
    it('defaults a paid tier to 24 hours', async () => {
      const app = await buildApp({ tier: 'weaver', collector: null })
      expect((await get(app, '/api/workload/web-nginx/metrics')).json().windowMs).toBe(86_400_000)
      await app.close()
    })

    it('defaults Free to one hour', async () => {
      const app = await buildApp({ tier: 'free', collector: null })
      expect((await get(app, '/api/workload/web-nginx/metrics')).json().windowMs).toBe(3_600_000)
      await app.close()
    })

    it('clamps a Free request for 24h and REPORTS the hour it served', async () => {
      // Reporting is the load-bearing half. Serving an hour under a caption the client wrote as
      // "24 hours" is a lie the user cannot detect from the chart.
      const app = await buildApp({ tier: 'free', collector: null })
      const res = await get(app, '/api/workload/web-nginx/metrics?window=24h')
      expect(res.statusCode).toBe(200)
      expect(res.json().windowMs).toBe(3_600_000)
      await app.close()
    })

    it('honours a narrower request from a paid tier', async () => {
      const app = await buildApp({ tier: 'weaver', collector: null })
      expect((await get(app, '/api/workload/web-nginx/metrics?window=30m')).json().windowMs).toBe(1_800_000)
      await app.close()
    })

    it('falls back to the tier maximum on a malformed window', async () => {
      const app = await buildApp({ tier: 'weaver', collector: null })
      expect((await get(app, '/api/workload/web-nginx/metrics?window=bogus')).json().windowMs).toBe(86_400_000)
      await app.close()
    })

    it('actually excludes samples outside the window', async () => {
      let t = 1_000_000
      const files = {
        '/fake/system.slice/microvm@web-nginx.service/cpu.stat': 'usage_usec 0',
        '/fake/system.slice/microvm@web-nginx.service/memory.current': '4096',
      }
      const collector = collectorWith(files, () => t)
      await collector.sampleOne('web-nginx', 2)   // t0
      t += 7_200_000                              // two hours pass
      await collector.sampleOne('web-nginx', 2)   // t0 + 2h

      const app = await buildApp({ tier: 'free', collector })
      // Free window is one hour, so only the recent sample qualifies. A count-based window would
      // return both and present a two-hour-old reading as current.
      expect((await get(app, '/api/workload/web-nginx/metrics')).json().samples).toHaveLength(1)
      await app.close()
    })
  })

  describe('access', () => {
    it('lets a viewer read metrics — this is a Free-tier adoption feature', async () => {
      mockUserRole = 'viewer'
      const app = await buildApp({ tier: 'free', collector: null })
      expect((await get(app, '/api/workload/web-nginx/metrics')).statusCode).toBe(200)
      await app.close()
    })
  })
})
