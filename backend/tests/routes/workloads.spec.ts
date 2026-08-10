// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

// Spread the REAL module before overriding. An enumerated factory silently yields `undefined` for
// any export it forgets, so it goes stale the moment the route imports something new — and it fails
// as `x is not a function` inside the handler, far from the omission. The route's log dispatch
// imports isContainerLogSource / containerLogArgs / apptainerLogPaths, none of which were listed
// here; nothing broke only because no test reached that path yet. Pure helpers are better exercised
// real anyway — only the I/O-touching calls below need stubbing.
vi.mock('../../src/services/microvm.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/microvm.js')>()),
  listVms: vi.fn(),
  getVm: vi.fn(),
  startVm: vi.fn(),
  stopVm: vi.fn(),
  restartVm: vi.fn(),
  getWorkloadDefinitions: vi.fn(),
}))

import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { workloadsRoutes } from '../../src/routes/workloads.js'
import { listVms, getVm, startVm, stopVm, restartVm } from '../../src/services/microvm.js'
import type { UserRole } from '../../src/models/user.js'

const mockListVms = listVms as ReturnType<typeof vi.fn>
const mockGetVm = getVm as ReturnType<typeof vi.fn>
const mockStartVm = startVm as ReturnType<typeof vi.fn>
const mockStopVm = stopVm as ReturnType<typeof vi.fn>
const mockRestartVm = restartVm as ReturnType<typeof vi.fn>

const sampleVm = {
  name: 'web-nginx',
  status: 'running',
  ip: '10.10.0.10',
  mem: 256,
  vcpu: 1,
  hypervisor: 'qemu',
  uptime: '2026-01-01T00:00:00.000Z'
}

// Simulate authenticated user role via request decoration
// Tests default to 'admin' so existing tests pass; RBAC tests override per-request
let mockUserRole: UserRole = 'admin'

describe('VM Routes', () => {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  fastify.decorateRequest('userId', undefined)
  fastify.decorateRequest('userRole', undefined)
  fastify.decorateRequest('username', undefined)
  fastify.decorateRequest('tokenId', undefined)
  fastify.decorateRequest('authRejectionReason', undefined)

  beforeAll(async () => {
    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    // Simulate auth middleware: set userRole on every request
    fastify.addHook('onRequest', async (request) => {
      request.userRole = mockUserRole
      request.userId = 'test-user-id'
      request.username = 'test-user'
    })

    await fastify.register(workloadsRoutes, { prefix: '/api/workload' })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockUserRole = 'admin'
  })

  describe('GET /api/workload', () => {
    it('should list all VMs', async () => {
      mockListVms.mockResolvedValue([sampleVm])

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload'
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toHaveLength(1)
      expect(body[0].name).toBe('web-nginx')
    })

    it('should return empty array when no VMs', async () => {
      mockListVms.mockResolvedValue([])

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload'
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual([])
    })

    it('should allow viewer to list VMs', async () => {
      mockListVms.mockResolvedValue([sampleVm])
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload'
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('GET /api/workload/:name', () => {
    it('should return a specific VM', async () => {
      mockGetVm.mockResolvedValue(sampleVm)

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload/web-nginx'
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().name).toBe('web-nginx')
    })

    it('should return 404 for unknown VM', async () => {
      mockGetVm.mockResolvedValue(null)

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload/nonexistent'
      })

      expect(response.statusCode).toBe(404)
    })

    it('should reject invalid VM name format', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload/INVALID_NAME!'
      })

      expect(response.statusCode).toBe(400)
    })

    it('should allow viewer to get VM details', async () => {
      mockGetVm.mockResolvedValue(sampleVm)
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload/web-nginx'
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('POST /api/workload/:name/start', () => {
    it('should start a VM', async () => {
      mockStartVm.mockResolvedValue({ success: true, message: "VM 'web-nginx' started" })

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/start'
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
    })

    it('should return 400 on start failure', async () => {
      mockStartVm.mockResolvedValue({ success: false, message: 'Already running' })

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/start'
      })

      expect(response.statusCode).toBe(400)
    })

    it('should allow operator to start VM', async () => {
      mockStartVm.mockResolvedValue({ success: true, message: "VM 'web-nginx' started" })
      mockUserRole = 'operator'

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/start'
      })

      expect(response.statusCode).toBe(200)
    })

    it('should reject viewer from starting VM', async () => {
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/start'
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().error).toBe('Insufficient permissions')
    })
  })

  describe('POST /api/workload/:name/stop', () => {
    it('should stop a VM', async () => {
      mockStopVm.mockResolvedValue({ success: true, message: "VM 'web-nginx' stopped" })

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/stop'
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
    })

    it('should reject viewer from stopping VM', async () => {
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/stop'
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('POST /api/workload/:name/restart', () => {
    it('should restart a VM', async () => {
      mockRestartVm.mockResolvedValue({ success: true, message: "VM 'web-nginx' restarted" })

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/restart'
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
    })

    it('should reject viewer from restarting VM', async () => {
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/restart'
      })

      expect(response.statusCode).toBe(403)
    })
  })
})

// ── Apptainer log access is tier-gated and HIDDEN ─────────────────────────────────────────────
// Apptainer requires Solo and is "hidden on Free rather than nagged" — a Free user must
// never see an Apptainer workload OR an upgrade prompt for one. The gate therefore answers 404
// (indistinguishable from an unknown workload), never requireTier()'s 403, which would name the
// tier and advertise the very feature it is meant to conceal.
//
// Both directions are asserted. A gate only ever tested in its blocking direction is
// indistinguishable from a route that is broken for everyone.
describe('GET /:name/logs — Apptainer tier gate (WVR-206)', () => {
  const apptainerWorkload = {
    name: 'sif-hpc', status: 'running', ip: '', mem: 512, vcpu: 1,
    hypervisor: 'apptainer', uptime: null, runtime: 'apptainer',
  }

  async function appWithTier(tier: string | undefined) {
    const f = Fastify().withTypeProvider<ZodTypeProvider>()
    f.decorateRequest('userId', undefined)
    f.decorateRequest('userRole', undefined)
    f.decorateRequest('username', undefined)
    f.decorateRequest('tokenId', undefined)
    f.decorateRequest('authRejectionReason', undefined)
    f.setValidatorCompiler(validatorCompiler)
    f.setSerializerCompiler(serializerCompiler)
    f.addHook('onRequest', async (request) => {
      request.userRole = 'admin'
      request.userId = 'test-user-id'
      request.username = 'test-user'
    })
    await f.register(workloadsRoutes, {
      prefix: '/api/workload',
      // Only `tier` is read on this path; the rest of DashboardConfig is irrelevant here.
      ...(tier === undefined ? {} : { config: { tier } as never }),
    })
    await f.ready()
    return f
  }

  beforeEach(() => {
    mockGetVm.mockReset()
    mockGetVm.mockResolvedValue(apptainerWorkload)
  })

  it('hides an Apptainer workload log below Solo — 404, not 403', async () => {
    const f = await appWithTier('free')
    const res = await f.inject({ method: 'GET', url: '/api/workload/sif-hpc/logs' })
    expect(res.statusCode).toBe(404)
    // The body must not name a tier or hint that upgrading would help.
    expect(res.body.toLowerCase()).not.toContain('tier')
    expect(res.body.toLowerCase()).not.toContain('apptainer')
    await f.close()
  })

  it('fails CLOSED when no config is present — an indeterminate tier is not Solo', async () => {
    const f = await appWithTier(undefined)
    const res = await f.inject({ method: 'GET', url: '/api/workload/sif-hpc/logs' })
    expect(res.statusCode).toBe(404)
    await f.close()
  })

  // The IGNORE half: at Solo the gate must let the request THROUGH to the log lookup. It still
  // 404s here (no apptainer binary in the test environment, so `instance list` finds nothing) —
  // the distinguishing evidence is the error body, which is the lookup's message and not the
  // gate's. Without this case, a gate that rejected every tier would look identical.
  it('lets Solo through the gate to the instance lookup', async () => {
    const f = await appWithTier('weaver')
    const res = await f.inject({ method: 'GET', url: '/api/workload/sif-hpc/logs' })
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toBe(JSON.stringify({ error: "No logs found for workload 'sif-hpc'" }))
    await f.close()
  })

  it('never applies the Apptainer gate to docker or podman', async () => {
    for (const runtime of ['docker', 'podman']) {
      mockGetVm.mockResolvedValue({ ...apptainerWorkload, runtime })
      const f = await appWithTier('free')
      const res = await f.inject({ method: 'GET', url: `/api/workload/sif-hpc/logs` })
      // Reaches the runtime binary (and fails there) rather than being hidden by the tier gate.
      expect(res.body).not.toBe(JSON.stringify({ error: "No logs found for workload 'sif-hpc'" }))
      await f.close()
    }
  })
})

// The logs route shells out (docker logs / apptainer instance list + file reads). It must carry an
// AGGRESSIVE per-route limit, not the global 120/min default that suits ordinary reads.
// G-backend-2026-06-02-01KYSBXCJ6TK3E22T062RD230G. Asserted here because it was missed once: the
// route gained its subprocess in the container-logs slice and kept the read-shaped default.
describe('GET /:name/logs — rate limit (subprocess endpoint)', () => {
  it('declares its own limit, well below the global default', async () => {
    const src = await import('node:fs/promises')
      .then(fs => fs.readFile(new URL('../../src/routes/workloads.ts', import.meta.url), 'utf-8'))
    // the /:name/logs registration block, up to its handler
    const block = src.slice(src.indexOf("'/:name/logs'"), src.indexOf("'/:name/logs'") + 2000)
    const m = block.match(/rateLimit:\s*createRateLimit\((\d+)\)/)
    expect(m, '/:name/logs must declare config.rateLimit').not.toBeNull()
    const max = Number(m![1])
    expect(max).toBeLessThan(120)   // the global default it would otherwise inherit
    expect(max).toBeLessThanOrEqual(30)
    expect(max).toBeGreaterThan(0)
  })
})
