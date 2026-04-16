// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { auditRoutes } from '../../src/routes/audit.js'
import { AuditService } from '../../src/services/audit.js'
import { AuditStore } from '../../src/storage/audit-store.js'
import { AuthService } from '../../src/services/auth.js'
import { UserStore } from '../../src/storage/user-store.js'
import { MemorySessionStore } from '../../src/storage/memory-session-store.js'
import { createAuthMiddleware } from '../../src/middleware/auth.js'
import type { DashboardConfig } from '../../src/config.js'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const TEST_DIR = join('/tmp', `audit-routes-test-${randomUUID()}`)
const JWT_SECRET = 'test-secret-for-audit-testing'

/** Minimal config stub — only `tier` matters for audit route gating */
function makeConfig(tier: 'fabrick' | 'weaver' = 'fabrick'): DashboardConfig {
  return { tier } as DashboardConfig
}

describe('Audit Routes', () => {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  let auditService: AuditService
  let authService: AuthService
  let adminToken: string
  let operatorToken: string
  let viewerToken: string

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true })

    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    // Set up auth
    const userStore = new UserStore(join(TEST_DIR, 'users.json'))
    await userStore.init()
    const sessionStore = new MemorySessionStore()
    authService = new AuthService(userStore, sessionStore, JWT_SECRET)

    // Set up audit
    const auditStore = new AuditStore(join(TEST_DIR, 'audit-log.json'))
    await auditStore.init()
    auditService = new AuditService(auditStore)

    // Add sample audit entries
    await auditService.log({
      userId: 'user-1',
      username: 'admin',
      action: 'vm.start',
      resource: 'web-nginx',
      ip: '127.0.0.1',
      success: true,
    })
    await auditService.log({
      userId: 'user-2',
      username: 'operator',
      action: 'vm.stop',
      resource: 'dev-node',
      ip: '10.0.0.1',
      success: true,
    })
    await auditService.log({
      userId: null,
      username: 'baduser',
      action: 'user.login',
      ip: '10.0.0.2',
      success: false,
    })

    // Register auth middleware
    fastify.addHook('onRequest', createAuthMiddleware(authService))

    // Register audit routes (fabrick tier for main test suite)
    await fastify.register(auditRoutes, { prefix: '/api/audit', auditService, config: makeConfig('fabrick') })
    await fastify.ready()

    // Create test users and get tokens
    const adminResult = await authService.register('admin', 'adminpass123', 'admin')
    adminToken = adminResult.token

    const operatorResult = await authService.register('operator', 'operatorpass123', 'operator')
    operatorToken = operatorResult.token

    const viewerResult = await authService.register('viewer', 'viewerpass123', 'viewer')
    viewerToken = viewerResult.token
  })

  afterAll(async () => {
    await fastify.close()
    try {
      await rm(TEST_DIR, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe('GET /api/audit', () => {
    it('should return audit entries for admin', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/audit',
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.entries).toBeInstanceOf(Array)
      expect(body.entries.length).toBeGreaterThanOrEqual(3)
      expect(body.total).toBeGreaterThanOrEqual(3)
      expect(body.limit).toBeDefined()
      expect(body.offset).toBeDefined()
    })

    it('should return audit entries for operator', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/audit',
        headers: { authorization: `Bearer ${operatorToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.entries).toBeInstanceOf(Array)
    })

    it('should return 403 for viewer role', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/audit',
        headers: { authorization: `Bearer ${viewerToken}` },
      })

      expect(response.statusCode).toBe(403)
    })

    it('should return 401 without auth', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/audit',
      })

      expect(response.statusCode).toBe(401)
    })

    it('should filter by action', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/audit?action=vm.start',
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.entries.every((e: { action: string }) => e.action === 'vm.start')).toBe(true)
    })

    it('should filter by userId', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/audit?userId=user-1',
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.entries.every((e: { userId: string }) => e.userId === 'user-1')).toBe(true)
    })

    it('should filter by resource', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/audit?resource=web-nginx',
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.entries.every((e: { resource: string }) => e.resource === 'web-nginx')).toBe(true)
    })

    it('should support pagination', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/audit?limit=1&offset=0',
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.entries).toHaveLength(1)
      expect(body.limit).toBe(1)
      expect(body.offset).toBe(0)
    })

    it('should return entries in newest-first order', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/audit',
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      const timestamps = body.entries.map((e: { timestamp: string }) => e.timestamp)
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i] >= timestamps[i + 1]).toBe(true)
      }
    })
  })
})

describe('Audit Routes — Tier Gating', () => {
  const premiumFastify = Fastify().withTypeProvider<ZodTypeProvider>()
  let adminToken: string

  beforeAll(async () => {
    const dir = join('/tmp', `audit-tier-test-${randomUUID()}`)
    await mkdir(dir, { recursive: true })

    premiumFastify.setValidatorCompiler(validatorCompiler)
    premiumFastify.setSerializerCompiler(serializerCompiler)

    const userStore = new UserStore(join(dir, 'users.json'))
    await userStore.init()
    const sessionStore = new MemorySessionStore()
    const authService = new AuthService(userStore, sessionStore, JWT_SECRET)

    const auditStore = new AuditStore(join(dir, 'audit-log.json'))
    await auditStore.init()
    const auditService = new AuditService(auditStore)

    premiumFastify.addHook('onRequest', createAuthMiddleware(authService))
    await premiumFastify.register(auditRoutes, { prefix: '/api/audit', auditService, config: makeConfig('weaver') })
    await premiumFastify.ready()

    const result = await authService.register('admin', 'adminpass123', 'admin')
    adminToken = result.token
  })

  afterAll(async () => {
    await premiumFastify.close()
  })

  it('should return 403 on weaver tier', async () => {
    const response = await premiumFastify.inject({
      method: 'GET',
      url: '/api/audit',
      headers: { authorization: `Bearer ${adminToken}` },
    })

    expect(response.statusCode).toBe(403)
    const body = response.json()
    expect(body.error).toContain('fabrick')
  })
})
