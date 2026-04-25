// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { AuthService } from '../../src/services/auth.js'
import { UserStore } from '../../src/storage/user-store.js'
import { MemorySessionStore } from '../../src/storage/memory-session-store.js'
import { createAuthMiddleware } from '../../src/middleware/auth.js'
import { requireRole } from '../../src/middleware/rbac.js'
import { authRoutes } from '../../src/routes/auth.js'
import cookie from '@fastify/cookie'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const TEST_DIR = join('/tmp', `rbac-middleware-test-${randomUUID()}`)
const JWT_SECRET = 'test-secret-for-rbac-testing'

describe('RBAC Middleware', () => {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  let authService: AuthService
  let adminToken: string
  let operatorToken: string
  let viewerToken: string

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true })

    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    const userStore = new UserStore(join(TEST_DIR, 'users.json'))
    await userStore.init()

    const sessionStore = new MemorySessionStore()
    authService = new AuthService(userStore, sessionStore, JWT_SECRET)

    // Register cookie plugin (required by auth routes for httpOnly cookies)
    await fastify.register(cookie)

    // Register auth middleware
    fastify.addHook('onRequest', createAuthMiddleware(authService))

    // Register auth routes (for login/register)
    await fastify.register(authRoutes, { prefix: '/api/auth', authService })

    // Register test routes with different role requirements
    fastify.get('/api/open', async () => {
      return { message: 'open to all authenticated users' }
    })

    fastify.post('/api/admin-only', {
      preHandler: [requireRole('admin')],
    }, async () => {
      return { message: 'admin only' }
    })

    fastify.post('/api/operator-plus', {
      preHandler: [requireRole('admin', 'operator')],
    }, async () => {
      return { message: 'operator or admin' }
    })

    fastify.post('/api/all-roles', {
      preHandler: [requireRole('admin', 'operator', 'viewer')],
    }, async () => {
      return { message: 'any role' }
    })

    await fastify.ready()

    // Create users with different roles
    const adminResult = await authService.register('admin', 'T3stP@ssw0rd!X', 'admin')
    adminToken = adminResult.token

    const operatorResult = await authService.register('operator', 'T3stP@ssw0rd!X', 'operator')
    operatorToken = operatorResult.token

    const viewerResult = await authService.register('viewer', 'T3stP@ssw0rd!X', 'viewer')
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

  describe('requireRole("admin")', () => {
    it('should allow admin access', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/admin-only',
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().message).toBe('admin only')
    })

    it('should reject operator', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/admin-only',
        headers: { authorization: `Bearer ${operatorToken}` },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().error).toBe('Insufficient permissions')
    })

    it('should reject viewer', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/admin-only',
        headers: { authorization: `Bearer ${viewerToken}` },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().error).toBe('Insufficient permissions')
    })
  })

  describe('requireRole("admin", "operator")', () => {
    it('should allow admin access', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/operator-plus',
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
    })

    it('should allow operator access', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/operator-plus',
        headers: { authorization: `Bearer ${operatorToken}` },
      })

      expect(response.statusCode).toBe(200)
    })

    it('should reject viewer', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/operator-plus',
        headers: { authorization: `Bearer ${viewerToken}` },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().error).toBe('Insufficient permissions')
    })
  })

  describe('requireRole("admin", "operator", "viewer")', () => {
    it('should allow all roles', async () => {
      for (const token of [adminToken, operatorToken, viewerToken]) {
        const response = await fastify.inject({
          method: 'POST',
          url: '/api/all-roles',
          headers: { authorization: `Bearer ${token}` },
        })

        expect(response.statusCode).toBe(200)
      }
    })
  })

  describe('unauthenticated request', () => {
    it('should return 401 before RBAC can check (auth middleware rejects first)', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/admin-only',
      })

      // Auth middleware rejects with 401 before RBAC runs
      expect(response.statusCode).toBe(401)
    })
  })

  describe('open routes (no RBAC)', () => {
    it('should allow any authenticated user', async () => {
      for (const token of [adminToken, operatorToken, viewerToken]) {
        const response = await fastify.inject({
          method: 'GET',
          url: '/api/open',
          headers: { authorization: `Bearer ${token}` },
        })

        expect(response.statusCode).toBe(200)
      }
    })
  })
})
