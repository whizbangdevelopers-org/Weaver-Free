// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { vmAclRoutes } from '../../src/routes/vm-acl.js'
import { VmAclStore } from '../../src/storage/vm-acl-store.js'
import { UserStore } from '../../src/storage/user-store.js'
import { AuditStore } from '../../src/storage/audit-store.js'
import { AuditService } from '../../src/services/audit.js'
import type { DashboardConfig } from '../../src/config.js'
import type { UserRole } from '../../src/models/user.js'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const TEST_DIR = join('/tmp', `vm-acl-routes-test-${randomUUID()}`)

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

describe('VM ACL Routes (fabrick)', () => {
  let fastify: ReturnType<typeof Fastify> & { withTypeProvider: () => unknown }
  let aclStore: VmAclStore
  let userStore: UserStore
  let testUserId: string

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true })

    fastify = Fastify().withTypeProvider<ZodTypeProvider>()
    fastify.decorateRequest('userId', undefined)
    fastify.decorateRequest('userRole', undefined)
    fastify.decorateRequest('username', undefined)
    fastify.decorateRequest('tokenId', undefined)
    fastify.decorateRequest('authRejectionReason', undefined)
    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    fastify.addHook('onRequest', async (request) => {
      request.userRole = mockUserRole
      request.userId = mockUserId
      request.username = 'test-user'
    })

    userStore = new UserStore(join(TEST_DIR, 'users.json'))
    await userStore.init()
    aclStore = new VmAclStore(join(TEST_DIR, 'vm-acls.json'))
    await aclStore.init()
    const auditStore = new AuditStore(join(TEST_DIR, 'audit.json'))
    await auditStore.init()
    const auditService = new AuditService(auditStore)

    const testUser = await userStore.create('operator1', 'hash', 'operator')
    testUserId = testUser.id

    await fastify.register(vmAclRoutes, {
      prefix: '/api/users',
      aclStore,
      config: makeConfig('fabrick'),
      userStore,
      auditService,
    })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {})
  })

  beforeEach(() => {
    mockUserRole = 'admin'
    mockUserId = 'test-admin-id'
  })

  describe('GET /api/users/:id/vms', () => {
    it('should return empty VM list for user with no ACL', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: `/api/users/${testUserId}/vms`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ userId: testUserId, vmNames: [] })
    })

    it('should return assigned VMs after setting ACL', async () => {
      await aclStore.set(testUserId, ['web-nginx', 'dev-node'])
      const res = await fastify.inject({
        method: 'GET',
        url: `/api/users/${testUserId}/vms`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().vmNames).toEqual(['dev-node', 'web-nginx'])
    })

    it('should return 403 for non-admin', async () => {
      mockUserRole = 'operator'
      const res = await fastify.inject({
        method: 'GET',
        url: `/api/users/${testUserId}/vms`,
      })
      expect(res.statusCode).toBe(403)
    })

    it('should return 404 for non-existent user', async () => {
      const fakeId = randomUUID()
      const res = await fastify.inject({
        method: 'GET',
        url: `/api/users/${fakeId}/vms`,
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('PUT /api/users/:id/vms', () => {
    it('should set VM ACL for a user', async () => {
      const res = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${testUserId}/vms`,
        payload: { vmNames: ['svc-postgres', 'web-nginx'] },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().vmNames).toEqual(['svc-postgres', 'web-nginx'])
    })

    it('should return 403 for non-admin', async () => {
      mockUserRole = 'viewer'
      const res = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${testUserId}/vms`,
        payload: { vmNames: ['web-nginx'] },
      })
      expect(res.statusCode).toBe(403)
    })

    it('should return 404 for non-existent user', async () => {
      const fakeId = randomUUID()
      const res = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${fakeId}/vms`,
        payload: { vmNames: ['web-nginx'] },
      })
      expect(res.statusCode).toBe(404)
    })

    it('should validate VM name format', async () => {
      const res = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${testUserId}/vms`,
        payload: { vmNames: ['INVALID-VM'] },
      })
      expect(res.statusCode).toBe(400)
    })

    it('should enforce max 200 VM names', async () => {
      const tooMany = Array.from({ length: 201 }, (_, i) => `vm-${String(i).padStart(4, '0')}`)
      const res = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${testUserId}/vms`,
        payload: { vmNames: tooMany },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('DELETE /api/users/:id/vms', () => {
    it('should clear VM ACL for a user', async () => {
      await aclStore.set(testUserId, ['web-nginx'])
      const res = await fastify.inject({
        method: 'DELETE',
        url: `/api/users/${testUserId}/vms`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
      expect(aclStore.hasAcl(testUserId)).toBe(false)
    })

    it('should return 403 for non-admin', async () => {
      mockUserRole = 'operator'
      const res = await fastify.inject({
        method: 'DELETE',
        url: `/api/users/${testUserId}/vms`,
      })
      expect(res.statusCode).toBe(403)
    })

    it('should return 404 for non-existent user', async () => {
      const fakeId = randomUUID()
      const res = await fastify.inject({
        method: 'DELETE',
        url: `/api/users/${fakeId}/vms`,
      })
      expect(res.statusCode).toBe(404)
    })
  })
})

describe('VM ACL Routes — Tier Gating', () => {
  let fastify: ReturnType<typeof Fastify> & { withTypeProvider: () => unknown }
  let testUserId: string

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true })

    fastify = Fastify().withTypeProvider<ZodTypeProvider>()
    fastify.decorateRequest('userId', undefined)
    fastify.decorateRequest('userRole', undefined)
    fastify.decorateRequest('username', undefined)
    fastify.decorateRequest('tokenId', undefined)
    fastify.decorateRequest('authRejectionReason', undefined)
    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    fastify.addHook('onRequest', async (request) => {
      request.userRole = 'admin'
      request.userId = 'admin-id'
      request.username = 'admin'
    })

    const userStore = new UserStore(join(TEST_DIR, 'users-tier.json'))
    await userStore.init()
    const aclStore = new VmAclStore(join(TEST_DIR, 'vm-acls-tier.json'))
    await aclStore.init()
    const auditStore = new AuditStore(join(TEST_DIR, 'audit-tier.json'))
    await auditStore.init()
    const auditService = new AuditService(auditStore)

    const testUser = await userStore.create('testuser', 'hash', 'operator')
    testUserId = testUser.id

    // Register with weaver tier (NOT fabrick) — ACL routes should be blocked
    await fastify.register(vmAclRoutes, {
      prefix: '/api/users',
      aclStore,
      config: makeConfig('weaver'),
      userStore,
      auditService,
    })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {})
  })

  it('should return 403 for GET on non-fabrick tier', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: `/api/users/${testUserId}/vms`,
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toContain('fabrick')
  })

  it('should return 403 for PUT on non-fabrick tier', async () => {
    const res = await fastify.inject({
      method: 'PUT',
      url: `/api/users/${testUserId}/vms`,
      payload: { vmNames: ['web-nginx'] },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toContain('fabrick')
  })

  it('should return 403 for DELETE on non-fabrick tier', async () => {
    const res = await fastify.inject({
      method: 'DELETE',
      url: `/api/users/${testUserId}/vms`,
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toContain('fabrick')
  })
})
