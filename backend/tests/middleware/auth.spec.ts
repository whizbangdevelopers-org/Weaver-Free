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
import { authRoutes } from '../../src/routes/auth.js'
import cookie from '@fastify/cookie'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const TEST_DIR = join('/tmp', `auth-middleware-test-${randomUUID()}`)
const JWT_SECRET = 'test-secret-for-middleware-testing'

describe('Auth Middleware', () => {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  fastify.decorateRequest('userId', undefined)
  fastify.decorateRequest('userRole', undefined)
  fastify.decorateRequest('username', undefined)
  fastify.decorateRequest('tokenId', undefined)
  fastify.decorateRequest('authRejectionReason', undefined)
  let authService: AuthService
  let adminToken: string

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

    // Register auth routes (public)
    await fastify.register(authRoutes, { prefix: '/api/auth', authService })

    // Register a protected test route
    fastify.get('/api/protected', async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }
      return { userId: request.userId, role: request.userRole, username: request.username }
    })

    // Register health route (should be accessible without auth)
    fastify.get('/api/health', async () => {
      return { status: 'healthy' }
    })

    await fastify.ready()

    // Create admin user and get token
    const result = await authService.register('admin', 'T3stP@ssw0rd!X', 'admin')
    adminToken = result.token
  })

  afterAll(async () => {
    await fastify.close()
    try {
      await rm(TEST_DIR, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('should allow access with valid token', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${adminToken}` },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.username).toBe('admin')
    expect(body.role).toBe('admin')
  })

  it('should return 401 for missing token', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/protected',
    })

    expect(response.statusCode).toBe(401)
  })

  it('should return 401 for invalid token', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: 'Bearer invalid-token-here' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('should return 401 for expired/revoked token', async () => {
    // Get fresh token then invalidate it
    const result = await authService.login('admin', 'T3stP@ssw0rd!X')
    await authService.logout(result.user.id, result.user.id)

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${result.token}` },
    })

    expect(response.statusCode).toBe(401)
  })

  it('should skip auth for health check', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/health',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().status).toBe('healthy')
  })

  it('should skip auth for auth routes', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'T3stP@ssw0rd!X' },
    })

    expect(response.statusCode).toBe(200)
  })

  it('should reject malformed authorization header', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    })

    expect(response.statusCode).toBe(401)
  })
})
