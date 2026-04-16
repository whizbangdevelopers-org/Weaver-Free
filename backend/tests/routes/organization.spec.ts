// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { organizationRoutes } from '../../src/routes/organization.js'
import { OrganizationStore } from '../../src/storage/organization-store.js'
import type { DashboardConfig } from '../../src/config.js'
import type { UserRole } from '../../src/models/user.js'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const TEST_DIR = join('/tmp', `org-routes-test-${randomUUID()}`)

function makeConfig(tier: 'demo' | 'free' | 'weaver' | 'fabrick'): DashboardConfig {
  return {
    tier,
    licenseExpiry: null,
    licenseGraceMode: false,
    storageBackend: 'json',
    dataDir: TEST_DIR,
    provisioningEnabled: false,
    microvmsDir: '/var/lib/microvms',
    bridgeGateway: '10.10.0.1',
    bridgeInterface: 'br-microvm',
    sudoBin: 'sudo',
    systemctlBin: 'systemctl',
    iptablesBin: 'iptables',
    qemuBin: 'qemu-system-x86_64',
    qemuImgBin: 'qemu-img',
    ipBin: 'ip',
    distroCatalogUrl: null,
    jwtSecret: 'test-secret',
    sessionStoreType: 'memory',
    notify: { ntfyUrl: null, ntfyTopic: null, ntfyToken: null },
    aiApiKey: '',
  }
}

let mockUserRole: UserRole = 'admin'
let mockUserId = 'test-admin-id'

describe('Organization Routes', () => {
  let fastify: ReturnType<typeof Fastify>
  let organizationStore: OrganizationStore

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true })

    fastify = Fastify().withTypeProvider<ZodTypeProvider>()
    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    fastify.addHook('onRequest', async (request) => {
      request.userRole = mockUserRole
      request.userId = mockUserId
      request.username = 'test-admin'
    })

    organizationStore = new OrganizationStore(join(TEST_DIR, 'organization.json'))
    await organizationStore.init()

    await fastify.register(organizationRoutes, {
      prefix: '/api/organization',
      organizationStore,
      config: makeConfig('weaver'),
    })

    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  beforeEach(() => {
    mockUserRole = 'admin'
    mockUserId = 'test-admin-id'
  })

  describe('GET /api/organization', () => {
    it('returns default empty identity', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/organization' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.name).toBe('')
      expect(body.logoUrl).toBeNull()
      expect(body.contactEmail).toBeNull()
      expect(body.contactPhone).toBeNull()
    })

    it('is accessible by any authenticated user', async () => {
      mockUserRole = 'viewer'
      const res = await fastify.inject({ method: 'GET', url: '/api/organization' })
      expect(res.statusCode).toBe(200)
    })
  })

  describe('PUT /api/organization', () => {
    it('updates identity for admin', async () => {
      const res = await fastify.inject({
        method: 'PUT',
        url: '/api/organization',
        payload: {
          name: 'Acme Corp',
          contactEmail: 'admin@acme.com',
        },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.name).toBe('Acme Corp')
      expect(body.contactEmail).toBe('admin@acme.com')
    })

    it('persists across reads', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/organization' })
      expect(res.json().name).toBe('Acme Corp')
    })

    it('rejects non-admin users', async () => {
      mockUserRole = 'operator'
      const res = await fastify.inject({
        method: 'PUT',
        url: '/api/organization',
        payload: { name: 'Hacker Corp' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('rejects viewer role', async () => {
      mockUserRole = 'viewer'
      const res = await fastify.inject({
        method: 'PUT',
        url: '/api/organization',
        payload: { name: 'Hacker Corp' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('validates email format', async () => {
      const res = await fastify.inject({
        method: 'PUT',
        url: '/api/organization',
        payload: { contactEmail: 'not-an-email' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('enforces name max length', async () => {
      const res = await fastify.inject({
        method: 'PUT',
        url: '/api/organization',
        payload: { name: 'A'.repeat(101) },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('PUT /api/organization (free tier)', () => {
    let freeFastify: ReturnType<typeof Fastify>

    beforeAll(async () => {
      freeFastify = Fastify().withTypeProvider<ZodTypeProvider>()
      freeFastify.setValidatorCompiler(validatorCompiler)
      freeFastify.setSerializerCompiler(serializerCompiler)

      freeFastify.addHook('onRequest', async (request) => {
        request.userRole = 'admin'
        request.userId = 'test-admin-id'
        request.username = 'test-admin'
      })

      const freeStore = new OrganizationStore(join(TEST_DIR, 'org-free.json'))
      await freeStore.init()

      await freeFastify.register(organizationRoutes, {
        prefix: '/api/organization',
        organizationStore: freeStore,
        config: makeConfig('free'),
      })

      await freeFastify.ready()
    })

    afterAll(async () => {
      await freeFastify.close()
    })

    it('rejects PUT for free tier', async () => {
      const res = await freeFastify.inject({
        method: 'PUT',
        url: '/api/organization',
        payload: { name: 'Free User Corp' },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().error).toContain('Weaver tier')
    })
  })
})
