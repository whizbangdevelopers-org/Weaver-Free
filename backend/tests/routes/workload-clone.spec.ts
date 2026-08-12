// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// `POST /api/workload/:name/clone` — the route half of VM clone.
//
// The pure seam (`cloneRejectionReason` + `deriveClonedDefinition`) already has its own suite in
// services/vm-clone.spec.ts and is NOT re-tested here. What this file covers is everything the
// seam deliberately does not know about: HTTP status mapping, the tier gate, IP allocation and —
// the one that actually bites — releasing a reserved address on every failure path after the
// reservation succeeds.
//
// That last property is why this file exists rather than trusting the seam. `reserveIp` mutates
// the pool and its own docblock states the obligation: "Callers MUST releaseIp() on any failure
// path after this resolves. A reservation whose operation failed is a leaked address, and a pool
// that leaks silently exhausts." Silently is the operative word — a leaked address produces no
// error, no log and no user-visible symptom until the pool is empty, at which point the cause is
// weeks in the past. Nothing but a test can hold that line.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DashboardConfig } from '../../src/config.js'
import type { UserRole } from '../../src/models/user.js'
import type { WorkloadDefinition } from '../../src/storage/workload-registry.js'

vi.mock('../../src/services/microvm.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/microvm.js')>()),
  getWorkloadDefinitions: vi.fn(),
  getVm: vi.fn(),
  createVm: vi.fn(),
}))

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'
import { workloadsRoutes } from '../../src/routes/workloads.js'
import { getWorkloadDefinitions, getVm, createVm } from '../../src/services/microvm.js'

const mockGetDefs = getWorkloadDefinitions as ReturnType<typeof vi.fn>
const mockGetVm = getVm as ReturnType<typeof vi.fn>
const mockCreateVm = createVm as ReturnType<typeof vi.fn>

const SOURCE: WorkloadDefinition = {
  name: 'web-nginx',
  ip: '10.10.0.10',
  mem: 512,
  vcpu: 2,
  hypervisor: 'qemu',
  distro: 'ubuntu',
  bridge: 'br-microvm',
  tags: ['web'],
  description: 'source',
  // Per-instance identity the clone must NOT inherit — asserted below.
  macAddress: '02:00:00:00:00:10',
  tapInterface: 'vm-web-nginx',
  autostart: true,
} as WorkloadDefinition

let mockUserRole: UserRole = 'admin'

/** Records reserve/release so the rollback obligation is observable. */
function makeNetworkManager() {
  const calls = { reserved: [] as string[], released: [] as string[] }
  return {
    calls,
    reserveIp: vi.fn(async (_bridge: string) => {
      const ip = '10.10.0.99'
      calls.reserved.push(ip)
      return ip
    }),
    releaseIp: vi.fn(async (_bridge: string, ip: string) => {
      calls.released.push(ip)
    }),
  }
}

function makeConfig(tier: string): DashboardConfig {
  return {
    tier,
    bridgeGateway: '10.10.0.1',
    bridgeInterface: 'br-microvm',
    provisioningEnabled: false,
  } as unknown as DashboardConfig
}

async function buildApp(opts: {
  tier?: string
  networkManager?: ReturnType<typeof makeNetworkManager> | null
  provisioner?: { provision: ReturnType<typeof vi.fn>; getLog: ReturnType<typeof vi.fn> } | null
  auditService?: { log: ReturnType<typeof vi.fn> }
} = {}) {
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
  await fastify.register(workloadsRoutes, {
    prefix: '/api/workload',
    config: makeConfig(opts.tier ?? 'weaver'),
    networkManager: opts.networkManager === undefined ? makeNetworkManager() : opts.networkManager,
    provisioner: opts.provisioner ?? null,
    auditService: opts.auditService as never,
  })
  await fastify.ready()
  return fastify
}

const clone = (app: Awaited<ReturnType<typeof buildApp>>, body: unknown, source = 'web-nginx') =>
  app.inject({ method: 'POST', url: `/api/workload/${source}/clone`, payload: body })

describe('POST /api/workload/:name/clone', () => {
  beforeEach(() => {
    // resetAllMocks, not clearAllMocks — clearAllMocks clears recorded calls but LEAVES an
    // unconsumed mockResolvedValueOnce queued, so it is handed to the next test's first call and
    // that test silently runs against the previous one's arrangement.
    vi.resetAllMocks()
    mockUserRole = 'admin'
    mockGetDefs.mockResolvedValue({ 'web-nginx': SOURCE })
    mockGetVm.mockResolvedValue({ name: 'web-nginx', status: 'stopped', ip: '10.10.0.10' })
    mockCreateVm.mockResolvedValue({ success: true, message: "VM 'web-nginx-clone' registered" })
  })
  afterEach(() => { vi.resetAllMocks() })

  describe('tier gate', () => {
    it('403s below Solo — cloning creates a VM, which is Live Provisioning', async () => {
      const app = await buildApp({ tier: 'free' })
      const res = await clone(app, { name: 'web-nginx-clone' })
      expect(res.statusCode).toBe(403)
      expect(mockCreateVm).not.toHaveBeenCalled()
      await app.close()
    })

    it('does not reserve an address before the tier check', async () => {
      const nm = makeNetworkManager()
      const app = await buildApp({ tier: 'free', networkManager: nm })
      await clone(app, { name: 'web-nginx-clone' })
      // A reservation taken before a 403 is a leak with no failure path to release it.
      expect(nm.calls.reserved).toEqual([])
      await app.close()
    })
  })

  describe('status mapping — the seam returns a reason, the route picks the code', () => {
    it('404s when the source does not exist', async () => {
      mockGetDefs.mockResolvedValue({})
      mockGetVm.mockResolvedValue(null)
      const app = await buildApp()
      const res = await clone(app, { name: 'anything' }, 'no-such-vm')
      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('409s when the target name is taken', async () => {
      mockGetDefs.mockResolvedValue({ 'web-nginx': SOURCE, taken: SOURCE })
      const app = await buildApp()
      const res = await clone(app, { name: 'taken' })
      expect(res.statusCode).toBe(409)
      await app.close()
    })

    it('400s when the source is running — copying a live disk is corruption', async () => {
      mockGetVm.mockResolvedValue({ name: 'web-nginx', status: 'running', ip: '10.10.0.10' })
      const app = await buildApp()
      const res = await clone(app, { name: 'web-nginx-clone' })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/running/i)
      await app.close()
    })

    it('400s when the source is a container — reproduced from an image, not cloned', async () => {
      mockGetDefs.mockResolvedValue({
        'web-nginx': { ...SOURCE, runtime: 'docker', containerId: 'abc', image: 'nginx' },
      })
      const app = await buildApp()
      const res = await clone(app, { name: 'web-nginx-clone' })
      expect(res.statusCode).toBe(400)
      await app.close()
    })

    it('400s on a target name the source name would also be rejected for', async () => {
      const app = await buildApp()
      const res = await clone(app, { name: 'Web_Nginx_Clone' })
      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })

  describe('address allocation', () => {
    it('reserves from the pool when ip is omitted', async () => {
      const nm = makeNetworkManager()
      const app = await buildApp({ networkManager: nm })
      const res = await clone(app, { name: 'web-nginx-clone' })
      expect(res.statusCode).toBe(201)
      expect(nm.reserveIp).toHaveBeenCalledWith('br-microvm')
      expect(mockCreateVm.mock.calls[0][0].ip).toBe('10.10.0.99')
      await app.close()
    })

    it('uses an explicit ip without touching the pool', async () => {
      const nm = makeNetworkManager()
      const app = await buildApp({ networkManager: nm })
      const res = await clone(app, { name: 'web-nginx-clone', ip: '10.10.0.50' })
      expect(res.statusCode).toBe(201)
      expect(nm.reserveIp).not.toHaveBeenCalled()
      expect(mockCreateVm.mock.calls[0][0].ip).toBe('10.10.0.50')
      await app.close()
    })

    it('409s on an explicit ip already in use', async () => {
      const app = await buildApp()
      const res = await clone(app, { name: 'web-nginx-clone', ip: '10.10.0.10' })
      expect(res.statusCode).toBe(409)
      await app.close()
    })

    it('400s on an explicit ip outside the bridge subnet', async () => {
      const app = await buildApp()
      const res = await clone(app, { name: 'web-nginx-clone', ip: '192.168.7.5' })
      expect(res.statusCode).toBe(400)
      await app.close()
    })

    it('400s when the pool is exhausted and no ip was given', async () => {
      const nm = makeNetworkManager()
      nm.reserveIp.mockResolvedValue(null)
      const app = await buildApp({ networkManager: nm })
      const res = await clone(app, { name: 'web-nginx-clone' })
      expect(res.statusCode).toBe(400)
      await app.close()
    })

    it('400s when ip is omitted and there is no allocator (Free build has no NetworkManager)', async () => {
      const app = await buildApp({ networkManager: null })
      const res = await clone(app, { name: 'web-nginx-clone' })
      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })

  // The reason this file exists. Each case takes a reservation and then fails; the address must
  // come back. A leak here is invisible until the pool exhausts, so "it returned an error" is not
  // sufficient evidence — the released list is.
  describe('reserved address is released on every post-reservation failure', () => {
    it('releases when registration reports failure', async () => {
      mockCreateVm.mockResolvedValue({ success: false, message: 'already exists' })
      const nm = makeNetworkManager()
      const app = await buildApp({ networkManager: nm })
      const res = await clone(app, { name: 'web-nginx-clone' })
      expect(res.statusCode).toBe(409)
      expect(nm.calls.released).toEqual(['10.10.0.99'])
      await app.close()
    })

    it('releases when registration throws', async () => {
      mockCreateVm.mockRejectedValue(new Error('registry write failed'))
      const nm = makeNetworkManager()
      const app = await buildApp({ networkManager: nm })
      const res = await clone(app, { name: 'web-nginx-clone' })
      expect(res.statusCode).toBe(500)
      expect(nm.calls.released).toEqual(['10.10.0.99'])
      await app.close()
    })

    it('does NOT release on success', async () => {
      const nm = makeNetworkManager()
      const app = await buildApp({ networkManager: nm })
      const res = await clone(app, { name: 'web-nginx-clone' })
      expect(res.statusCode).toBe(201)
      expect(nm.calls.released).toEqual([])
      await app.close()
    })

    it('does not release an address it never reserved', async () => {
      mockCreateVm.mockResolvedValue({ success: false, message: 'nope' })
      const nm = makeNetworkManager()
      const app = await buildApp({ networkManager: nm })
      await clone(app, { name: 'web-nginx-clone', ip: '10.10.0.50' })
      expect(nm.calls.released).toEqual([])
      await app.close()
    })
  })

  describe('the derived definition', () => {
    it('carries the spec and drops per-instance identity', async () => {
      const app = await buildApp()
      await clone(app, { name: 'web-nginx-clone', ip: '10.10.0.50' })
      const derived = mockCreateVm.mock.calls[0][0]

      expect(derived).toMatchObject({ name: 'web-nginx-clone', ip: '10.10.0.50', mem: 512, vcpu: 2, hypervisor: 'qemu', distro: 'ubuntu' })
      // ABSENT, not undefined — `'x' in obj` must be false, or a downstream spread reintroduces it.
      for (const key of ['macAddress', 'tapInterface', 'consolePort', 'provisioningState', 'provisioningError', 'autostart']) {
        expect(key in derived, `${key} must be absent from a clone`).toBe(false)
      }
    })

    it('does not mutate the source', async () => {
      const app = await buildApp()
      await clone(app, { name: 'web-nginx-clone', ip: '10.10.0.50' })
      expect(SOURCE.name).toBe('web-nginx')
      expect(SOURCE.ip).toBe('10.10.0.10')
      await app.close()
    })

    it('inherits source tags and description by default', async () => {
      const app = await buildApp()
      await clone(app, { name: 'web-nginx-clone', ip: '10.10.0.50' })
      const derived = mockCreateVm.mock.calls[0][0]
      expect(derived.tags).toEqual(['web'])
      expect(derived.description).toBe('source')
      await app.close()
    })

    it('accepts tag and description overrides', async () => {
      const app = await buildApp()
      await clone(app, { name: 'web-nginx-clone', ip: '10.10.0.50', tags: ['cloned'], description: 'Cloned from web-nginx' })
      const derived = mockCreateVm.mock.calls[0][0]
      expect(derived.tags).toEqual(['cloned'])
      expect(derived.description).toBe('Cloned from web-nginx')
      await app.close()
    })
  })

  describe('provisioning and audit', () => {
    it('202s and provisions when provisioning is enabled', async () => {
      const provisioner = { provision: vi.fn().mockResolvedValue(undefined), getLog: vi.fn() }
      const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
      fastify.decorateRequest('userId', undefined)
      fastify.decorateRequest('userRole', undefined)
      fastify.decorateRequest('username', undefined)
      fastify.setValidatorCompiler(validatorCompiler)
      fastify.setSerializerCompiler(serializerCompiler)
      fastify.addHook('onRequest', async (request) => {
        request.userRole = 'admin'
        request.userId = 'u'
        request.username = 'u'
      })
      await fastify.register(workloadsRoutes, {
        prefix: '/api/workload',
        config: { ...makeConfig('weaver'), provisioningEnabled: true } as DashboardConfig,
        networkManager: makeNetworkManager(),
        provisioner: provisioner as never,
      })
      await fastify.ready()
      const res = await fastify.inject({ method: 'POST', url: '/api/workload/web-nginx/clone', payload: { name: 'web-nginx-clone', ip: '10.10.0.50' } })
      expect(res.statusCode).toBe(202)
      expect(provisioner.provision).toHaveBeenCalledWith('web-nginx-clone')
      await fastify.close()
    })

    it('writes an audit entry naming both source and clone', async () => {
      const auditService = { log: vi.fn().mockResolvedValue(undefined) }
      const app = await buildApp({ auditService })
      await clone(app, { name: 'web-nginx-clone', ip: '10.10.0.50' })
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'vm.clone',
          resource: 'web-nginx-clone',
          details: expect.objectContaining({ source: 'web-nginx' }),
        }),
      )
      await app.close()
    })
  })

  describe('authorization', () => {
    it('rejects a viewer', async () => {
      mockUserRole = 'viewer'
      const app = await buildApp()
      const res = await clone(app, { name: 'web-nginx-clone', ip: '10.10.0.50' })
      expect(res.statusCode).toBe(403)
      expect(mockCreateVm).not.toHaveBeenCalled()
      await app.close()
    })
  })
})
