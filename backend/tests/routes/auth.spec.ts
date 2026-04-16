// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { authRoutes } from '../../src/routes/auth.js'
import { AuthService } from '../../src/services/auth.js'
import { UserStore } from '../../src/storage/user-store.js'
import { MemorySessionStore } from '../../src/storage/memory-session-store.js'
import { createAuthMiddleware } from '../../src/middleware/auth.js'
import cookie from '@fastify/cookie'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const TEST_DIR = join('/tmp', `auth-routes-test-${randomUUID()}`)
const JWT_SECRET = 'test-secret-for-route-testing'

describe('Auth Routes', () => {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  fastify.decorateRequest('userId', undefined)
  fastify.decorateRequest('userRole', undefined)
  fastify.decorateRequest('username', undefined)
  fastify.decorateRequest('tokenId', undefined)
  fastify.decorateRequest('authRejectionReason', undefined)
  let authService: AuthService

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true })

    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    const userStore = new UserStore(join(TEST_DIR, 'users.json'))
    await userStore.init()

    const sessionStore = new MemorySessionStore()
    authService = new AuthService(userStore, sessionStore, JWT_SECRET)

    // Custom error handler matching the one in backend/src/index.ts
    fastify.setErrorHandler((error, _request, reply) => {
      if (error.validation) {
        const messages = error.validation
          .map((v: { message?: string }) => v.message ?? '')
          .filter(Boolean)
        return reply.status(400).send({
          error: 'Validation failed',
          details: messages.length > 0 ? messages : ['Invalid request data'],
        })
      }
      const statusCode = error.statusCode || 500
      reply.status(statusCode).send({ error: error.message || 'Internal Server Error' })
    })

    // Register cookie plugin (required by auth routes for httpOnly cookies)
    await fastify.register(cookie)

    // Register auth middleware
    fastify.addHook('onRequest', createAuthMiddleware(authService))

    // Register auth routes
    await fastify.register(authRoutes, { prefix: '/api/auth', authService })
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

  describe('POST /api/auth/register — validation errors', () => {
    it('should return human-readable errors for invalid username (email format)', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'user@example.com', password: 'GoodPass1!xyzAB' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.error).toBe('Validation failed')
      expect(body.details).toBeInstanceOf(Array)
      expect(body.details.length).toBeGreaterThan(0)
      // Should contain human-readable message, not raw JSON or "Bad Request"
      expect(body.details.some((d: string) => d.toLowerCase().includes('letter') || d.toLowerCase().includes('invalid'))).toBe(true)
    })

    it('should return error for password too short', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'gooduser', password: 'Ab1' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.error).toBe('Validation failed')
      expect(body.details).toBeInstanceOf(Array)
      expect(body.details.some((d: string) => d.includes('14 characters'))).toBe(true)
    })

    it('should return error for password missing uppercase', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'gooduser', password: 'alllowercase1!x' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.error).toBe('Validation failed')
      expect(body.details).toBeInstanceOf(Array)
      expect(body.details.some((d: string) => d.includes('uppercase'))).toBe(true)
    })

    it('should return error for username too short', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'ab', password: 'GoodPass1!xyzAB' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.error).toBe('Validation failed')
      expect(body.details).toBeInstanceOf(Array)
      expect(body.details.some((d: string) => d.includes('3 characters'))).toBe(true)
    })
  })

  describe('POST /api/auth/register (first user)', () => {
    it('should create admin account on first registration', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'admin', password: 'Secure#Pass123!xy' },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.user.username).toBe('admin')
      expect(body.user.role).toBe('admin')
      expect(body.token).toBeDefined()
      expect(body.refreshToken).toBeDefined()
    })
  })

  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'Secure#Pass123!xy' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.user.username).toBe('admin')
      expect(body.token).toBeDefined()
    })

    it('should return 401 for wrong password', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'wrongpassword' },
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBeDefined()
    })

    it('should return 401 for non-existent user', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'nobody', password: 'password' },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /api/auth/register (subsequent users)', () => {
    it('should require auth for subsequent registrations', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'user2', password: 'TestPass123!xyz' },
      })

      expect(response.statusCode).toBe(401)
    })

    it('should allow admin to register new users', async () => {
      // Login as admin
      const loginRes = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'Secure#Pass123!xy' },
      })
      const { token } = loginRes.json()

      // Register new user as admin
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'operator1', password: 'TestPass123!xyz', role: 'operator' },
        headers: { authorization: `Bearer ${token}` },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.user.username).toBe('operator1')
      expect(body.user.role).toBe('operator')
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens', async () => {
      const loginRes = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'Secure#Pass123!xy' },
      })
      const { refreshToken } = loginRes.json()

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.token).toBeDefined()
      expect(body.refreshToken).toBeDefined()
    })

    it('should reject invalid refresh token', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: 'invalid' },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return current user info', async () => {
      const loginRes = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'Secure#Pass123!xy' },
      })
      const { token } = loginRes.json()

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.user.username).toBe('admin')
      expect(body.user.role).toBe('admin')
    })

    it('should return 401 without token', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/auth/me',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should logout and invalidate tokens', async () => {
      const loginRes = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'Secure#Pass123!xy' },
      })
      const { token } = loginRes.json()

      // Logout
      const logoutRes = await fastify.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(logoutRes.statusCode).toBe(200)

      // Token should be invalid after logout
      const meRes = await fastify.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(meRes.statusCode).toBe(401)
    })
  })

  describe('GET /api/auth/setup-required', () => {
    it('should return false when users exist', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/auth/setup-required',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.setupRequired).toBe(false)
    })
  })
})
