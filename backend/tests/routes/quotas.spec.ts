// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

vi.mock('../../src/services/microvm.js', () => ({
  getWorkloadDefinitions: vi.fn(),
}))

import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { quotaRoutes } from '../../src/routes/quotas.js'
import { QuotaStore } from '../../src/storage/quota-store.js'
import { UserStore } from '../../src/storage/user-store.js'
import { getWorkloadDefinitions } from '../../src/services/microvm.js'
import type { DashboardConfig } from '../../src/config.js'
import type { UserRole } from '../../src/models/user.js'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const mockGetVmDefinitions = getWorkloadDefinitions as ReturnType<typeof vi.fn>

const TEST_DIR = join('/tmp', `quota-routes-test-${randomUUID()}`)

// Minimal DashboardConfig for testing
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

const sampleVms = {
  'web-nginx': { name: 'web-nginx', ip: '10.10.0.10', mem: 256, vcpu: 1, hypervisor: 'qemu' },
  'dev-node': { name: 'dev-node', ip: '10.10.0.20', mem: 512, vcpu: 2, hypervisor: 'qemu' },
}

let mockUserRole: UserRole = 'admin'
let mockUserId = 'test-admin-id'

describe('Quota Routes', () => {
  let fastify: ReturnType<typeof Fastify> & { withTypeProvider: () => unknown }
  let quotaStore: QuotaStore
  let userStore: UserStore
  let testUserId: string

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true })

    fastify = Fastify().withTypeProvider<ZodTypeProvider>()
    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    // Simulate auth middleware
    fastify.addHook('onRequest', async (request) => {
      request.userRole = mockUserRole
      request.userId = mockUserId
      request.username = 'test-user'
    })

    // Initialize stores
    userStore = new UserStore(join(TEST_DIR, 'users.json'))
    await userStore.init()
    quotaStore = new QuotaStore(join(TEST_DIR, 'quotas.json'))
    await quotaStore.init()

    // Create a test user to set quotas on
    const testUser = await userStore.create('operator1', 'hash', 'operator')
    testUserId = testUser.id

    const config = makeConfig('fabrick')

    await fastify.register(quotaRoutes, {
      prefix: '/api/users',
      config,
      quotaStore,
      userStore,
    })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
    try {
      await rm(TEST_DIR, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockUserRole = 'admin'
    mockUserId = 'test-admin-id'
    mockGetVmDefinitions.mockResolvedValue(sampleVms)
  })

  describe('GET /api/users/:id/quotas', () => {
    it('should return default unlimited quotas for user with no quotas set', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/users/${testUserId}/quotas`,
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.userId).toBe(testUserId)
      expect(body.maxVms).toBeNull()
      expect(body.maxMemoryMB).toBeNull()
      expect(body.maxVcpus).toBeNull()
      expect(body.currentVms).toBe(2)
      expect(body.currentMemoryMB).toBe(768) // 256 + 512
      expect(body.currentVcpus).toBe(3)      // 1 + 2
    })

    it('should return 403 for non-admin', async () => {
      mockUserRole = 'operator'
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/users/${testUserId}/quotas`,
      })
      expect(response.statusCode).toBe(403)
    })

    it('should return 404 for non-existent user', async () => {
      const fakeId = randomUUID()
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/users/${fakeId}/quotas`,
      })
      expect(response.statusCode).toBe(404)
    })
  })

  describe('PUT /api/users/:id/quotas', () => {
    it('should set quotas for a user', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${testUserId}/quotas`,
        payload: {
          maxVms: 5,
          maxMemoryMB: 2048,
          maxVcpus: 8,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.userId).toBe(testUserId)
      expect(body.maxVms).toBe(5)
      expect(body.maxMemoryMB).toBe(2048)
      expect(body.maxVcpus).toBe(8)
    })

    it('should allow setting null (unlimited) quotas', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${testUserId}/quotas`,
        payload: {
          maxVms: null,
          maxMemoryMB: 1024,
          maxVcpus: null,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.maxVms).toBeNull()
      expect(body.maxMemoryMB).toBe(1024)
      expect(body.maxVcpus).toBeNull()
    })

    it('should return 403 for non-admin', async () => {
      mockUserRole = 'viewer'
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${testUserId}/quotas`,
        payload: { maxVms: 5, maxMemoryMB: 2048, maxVcpus: 8 },
      })
      expect(response.statusCode).toBe(403)
    })

    it('should return 404 for non-existent user', async () => {
      const fakeId = randomUUID()
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${fakeId}/quotas`,
        payload: { maxVms: 5, maxMemoryMB: 2048, maxVcpus: 8 },
      })
      expect(response.statusCode).toBe(404)
    })

    it('should validate negative values', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${testUserId}/quotas`,
        payload: { maxVms: -1, maxMemoryMB: 1024, maxVcpus: 4 },
      })
      expect(response.statusCode).toBe(400)
    })
  })

  describe('Quota GET reflects PUT changes', () => {
    it('should reflect updated quotas with current usage', async () => {
      // Set quotas
      await fastify.inject({
        method: 'PUT',
        url: `/api/users/${testUserId}/quotas`,
        payload: { maxVms: 10, maxMemoryMB: 4096, maxVcpus: 16 },
      })

      // Get quotas with usage
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/users/${testUserId}/quotas`,
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.maxVms).toBe(10)
      expect(body.maxMemoryMB).toBe(4096)
      expect(body.maxVcpus).toBe(16)
      expect(body.currentVms).toBe(2)
      expect(body.currentMemoryMB).toBe(768)
      expect(body.currentVcpus).toBe(3)
    })
  })
})

describe('Quota Routes — Tier Gating', () => {
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
    const quotaStore = new QuotaStore(join(TEST_DIR, 'quotas-tier.json'))
    await quotaStore.init()

    const testUser = await userStore.create('testuser', 'hash', 'operator')
    testUserId = testUser.id

    // Register with weaver tier (NOT fabrick) — quotas should be blocked
    const config = makeConfig('weaver')

    await fastify.register(quotaRoutes, {
      prefix: '/api/users',
      config,
      quotaStore,
      userStore,
    })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
    try {
      await rm(TEST_DIR, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('should return 403 when tier is below fabrick for GET', async () => {
    mockGetVmDefinitions.mockResolvedValue({})
    const response = await fastify.inject({
      method: 'GET',
      url: `/api/users/${testUserId}/quotas`,
    })
    expect(response.statusCode).toBe(403)
    expect(response.json().error).toContain('fabrick')
  })

  it('should return 403 when tier is below fabrick for PUT', async () => {
    const response = await fastify.inject({
      method: 'PUT',
      url: `/api/users/${testUserId}/quotas`,
      payload: { maxVms: 5, maxMemoryMB: 2048, maxVcpus: 8 },
    })
    expect(response.statusCode).toBe(403)
    expect(response.json().error).toContain('fabrick')
  })
})

describe('QuotaStore.checkQuota', () => {
  let quotaStore: QuotaStore

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true })
    quotaStore = new QuotaStore(join(TEST_DIR, 'quotas-check.json'))
    await quotaStore.init()
  })

  afterAll(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('should allow creation when no quotas are set (all null)', () => {
    const result = quotaStore.checkQuota('user-1', 512, 2, {
      totalVms: 10,
      totalMemoryMB: 10000,
      totalVcpus: 50,
    })
    expect(result.allowed).toBe(true)
  })

  it('should reject when VM count at limit', async () => {
    await quotaStore.set('user-2', { maxVms: 5, maxMemoryMB: null, maxVcpus: null })

    const result = quotaStore.checkQuota('user-2', 256, 1, {
      totalVms: 5,
      totalMemoryMB: 1024,
      totalVcpus: 5,
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('VM quota exceeded')
    expect(result.reason).toContain('5 of 5')
  })

  it('should allow when VM count below limit', async () => {
    await quotaStore.set('user-3', { maxVms: 10, maxMemoryMB: null, maxVcpus: null })

    const result = quotaStore.checkQuota('user-3', 256, 1, {
      totalVms: 5,
      totalMemoryMB: 1024,
      totalVcpus: 5,
    })
    expect(result.allowed).toBe(true)
  })

  it('should reject when memory would exceed limit', async () => {
    await quotaStore.set('user-4', { maxVms: null, maxMemoryMB: 2048, maxVcpus: null })

    const result = quotaStore.checkQuota('user-4', 1024, 1, {
      totalVms: 2,
      totalMemoryMB: 1536,
      totalVcpus: 2,
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Memory quota exceeded')
    expect(result.reason).toContain('1536')
    expect(result.reason).toContain('1024')
    expect(result.reason).toContain('2048')
  })

  it('should reject when vCPUs would exceed limit', async () => {
    await quotaStore.set('user-5', { maxVms: null, maxMemoryMB: null, maxVcpus: 8 })

    const result = quotaStore.checkQuota('user-5', 256, 4, {
      totalVms: 2,
      totalMemoryMB: 512,
      totalVcpus: 6,
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('vCPU quota exceeded')
    expect(result.reason).toContain('6')
    expect(result.reason).toContain('4')
    expect(result.reason).toContain('8')
  })

  it('should check all limits and fail on first exceeded', async () => {
    await quotaStore.set('user-6', { maxVms: 3, maxMemoryMB: 1024, maxVcpus: 4 })

    // VM count at limit — should fail on VMs first
    const result = quotaStore.checkQuota('user-6', 256, 1, {
      totalVms: 3,
      totalMemoryMB: 768,
      totalVcpus: 3,
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('VM quota exceeded')
  })
})
