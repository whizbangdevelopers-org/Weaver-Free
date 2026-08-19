// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// `GET /api/workload/export` and `GET /api/workload/:name/export`.
//
// Two properties here cannot be established by reading the code, and both fail silently:
//
//  1. ROUTE SHADOWING. `export` satisfies the `:name` pattern exactly, so `/api/workload/export`
//     is also a legal single-workload GET. Fastify's radix router prefers the static segment, but
//     that is a property of the ROUTER and not of our source — it can change under a major
//     upgrade with no diff in this repo. If it ever flips, the endpoint starts 404ing (or worse,
//     returns a workload that happens to be named "export") and every scripted consumer breaks.
//
//  2. FIELD LOSS THROUGH THE RESPONSE SCHEMA. Fastify validates responses and Zod strips unknown
//     keys, so a field the service exports but the schema omits vanishes between the service and
//     the downloaded file. Nothing errors. The user gets a valid-looking JSON document that is
//     quietly missing a field they will need when they re-import it.
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
import { getWorkloadDefinitions, toExportedDefinition } from '../../src/services/microvm.js'

const mockGetDefs = getWorkloadDefinitions as ReturnType<typeof vi.fn>

/** A definition carrying BOTH exportable config and the runtime state an export must drop. */
const FULL: WorkloadDefinition = {
  name: 'web-nginx',
  ip: '10.10.0.10',
  mem: 512,
  vcpu: 2,
  hypervisor: 'qemu',
  diskSize: 20,
  distro: 'ubuntu',
  guestOs: 'linux',
  vmType: 'server',
  macAddress: '02:00:00:00:00:10',
  autostart: true,
  description: 'the web front end',
  tags: ['web', 'prod'],
  bridge: 'br-microvm',
  consoleType: 'serial',
  imageUrl: 'https://example.invalid/img.qcow2',
  imageFormat: 'qcow2',
  cloudInit: true,
  // Runtime state — none of this may appear in an export.
  provisioningState: 'provisioned',
  provisioningError: 'a stale error from a previous attempt',
  tapInterface: 'vm-web-nginx',
  consolePort: 5901,
  containerId: 'deadbeef',
} as WorkloadDefinition

let mockUserRole: UserRole = 'admin'
let mockUserId = 'test-user-id'

async function buildApp(opts: { tier?: string; aclStore?: unknown } = {}) {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  fastify.decorateRequest('userId', undefined)
  fastify.decorateRequest('userRole', undefined)
  fastify.decorateRequest('username', undefined)
  fastify.setValidatorCompiler(validatorCompiler)
  fastify.setSerializerCompiler(serializerCompiler)
  fastify.addHook('onRequest', async (request) => {
    request.userRole = mockUserRole
    request.userId = mockUserId
    request.username = 'test-user'
  })
  await fastify.register(workloadsRoutes, {
    prefix: '/api/workload',
    config: { tier: opts.tier ?? 'solo', bridgeGateway: '10.10.0.1' } as unknown as DashboardConfig,
    aclStore: opts.aclStore as never,
  })
  await fastify.ready()
  return fastify
}

describe('workload export', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockUserRole = 'admin'
    mockUserId = 'test-user-id'
    mockGetDefs.mockResolvedValue({ 'web-nginx': FULL })
  })
  afterEach(() => { vi.resetAllMocks() })

  describe('route shadowing — /export must not be read as a workload named "export"', () => {
    it('serves the collection endpoint, not a 404 for a missing workload', async () => {
      const app = await buildApp()
      const res = await app.inject({ method: 'GET', url: '/api/workload/export' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toHaveProperty('workloads')
      await app.close()
    })

    it('a workload actually named "export" does not shadow the endpoint', async () => {
      // The nastiest version of the collision: the name is real, so a param match would succeed
      // and return 200 with a plausible body. Only the SHAPE distinguishes them.
      mockGetDefs.mockResolvedValue({
        'web-nginx': FULL,
        export: { ...FULL, name: 'export', ip: '10.10.0.77' } as WorkloadDefinition,
      })
      const app = await buildApp()
      const res = await app.inject({ method: 'GET', url: '/api/workload/export' })
      expect(res.statusCode).toBe(200)
      // The collection contains BOTH workloads. A shadowed route would return only the one
      // named "export", which is a single-element array and could pass a sloppier assertion.
      const names = res.json().workloads.map((w: { name: string }) => w.name).sort()
      expect(names).toEqual(['export', 'web-nginx'])
      await app.close()
    })

    it('still serves the single-workload form', async () => {
      const app = await buildApp()
      const res = await app.inject({ method: 'GET', url: '/api/workload/web-nginx/export' })
      expect(res.statusCode).toBe(200)
      expect(res.json().workloads).toHaveLength(1)
      await app.close()
    })
  })

  describe('the exported document', () => {
    it('carries every configuration field through the response schema', async () => {
      const app = await buildApp()
      const res = await app.inject({ method: 'GET', url: '/api/workload/web-nginx/export' })
      const [exported] = res.json().workloads

      // Asserted against the SERVICE's own output rather than a hand-written list, so a field
      // added to EXPORT_FIELDS but forgotten in the Zod schema fails here instead of vanishing.
      // This is the check that catches silent Zod stripping.
      expect(exported).toEqual(toExportedDefinition(FULL))
      await app.close()
    })

    it('drops runtime state that is not configuration', async () => {
      const app = await buildApp()
      const res = await app.inject({ method: 'GET', url: '/api/workload/web-nginx/export' })
      const [exported] = res.json().workloads
      for (const key of ['provisioningState', 'provisioningError', 'tapInterface', 'consolePort', 'containerId']) {
        expect(key in exported, `${key} is runtime state and must not be exported`).toBe(false)
      }
      await app.close()
    })

    it('keeps macAddress — an export records THIS vm, unlike a clone which creates a new one', async () => {
      const app = await buildApp()
      const res = await app.inject({ method: 'GET', url: '/api/workload/web-nginx/export' })
      expect(res.json().workloads[0].macAddress).toBe('02:00:00:00:00:10')
      await app.close()
    })

    it('carries a version and a timestamp', async () => {
      const app = await buildApp()
      const doc = (await app.inject({ method: 'GET', url: '/api/workload/export' })).json()
      expect(doc.version).toBe('1.0')
      expect(() => new Date(doc.exportedAt).toISOString()).not.toThrow()
      await app.close()
    })

    it('does not mutate the source definition', async () => {
      const app = await buildApp()
      await app.inject({ method: 'GET', url: '/api/workload/web-nginx/export' })
      expect(FULL.provisioningState).toBe('provisioned')
      expect(FULL.tags).toEqual(['web', 'prod'])
      await app.close()
    })

    it('offers the document as a download', async () => {
      const app = await buildApp()
      const res = await app.inject({ method: 'GET', url: '/api/workload/export' })
      expect(res.headers['content-disposition']).toMatch(/^attachment; filename="weaver-export-\d{4}-\d{2}-\d{2}\.json"$/)
      await app.close()
    })
  })

  describe('access', () => {
    it('404s an unknown workload', async () => {
      mockGetDefs.mockResolvedValue({})
      const app = await buildApp()
      const res = await app.inject({ method: 'GET', url: '/api/workload/no-such-vm/export' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('a viewer can export — this is a Free-tier read the docs have always advertised', async () => {
      mockUserRole = 'viewer'
      const app = await buildApp({ tier: 'free' })
      const res = await app.inject({ method: 'GET', url: '/api/workload/export' })
      expect(res.statusCode).toBe(200)
      await app.close()
    })

    it('applies Fabrick per-VM ACLs, so export is not a way around them', async () => {
      mockGetDefs.mockResolvedValue({
        'web-nginx': FULL,
        secret: { ...FULL, name: 'secret' } as WorkloadDefinition,
      })
      mockUserRole = 'operator'
      const aclStore = {
        filterVms: vi.fn((_userId: string, vms: { name: string }[]) => vms.filter(v => v.name !== 'secret')),
      }
      const app = await buildApp({ tier: 'fabrick', aclStore })
      const res = await app.inject({ method: 'GET', url: '/api/workload/export' })
      const names = res.json().workloads.map((w: { name: string }) => w.name)
      expect(aclStore.filterVms).toHaveBeenCalled()
      expect(names).toEqual(['web-nginx'])
      await app.close()
    })

    it('does not filter for an admin', async () => {
      mockGetDefs.mockResolvedValue({
        'web-nginx': FULL,
        secret: { ...FULL, name: 'secret' } as WorkloadDefinition,
      })
      mockUserRole = 'admin'
      const aclStore = { filterVms: vi.fn() }
      const app = await buildApp({ tier: 'fabrick', aclStore })
      const res = await app.inject({ method: 'GET', url: '/api/workload/export' })
      expect(aclStore.filterVms).not.toHaveBeenCalled()
      expect(res.json().workloads).toHaveLength(2)
      await app.close()
    })
  })
})
