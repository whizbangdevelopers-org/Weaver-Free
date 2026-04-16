// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { tagRoutes } from '../../src/routes/tags.js'
import { PresetTagStore } from '../../src/storage/preset-tag-store.js'
import { AuthService } from '../../src/services/auth.js'
import { UserStore } from '../../src/storage/user-store.js'
import { MemorySessionStore } from '../../src/storage/memory-session-store.js'
import { createAuthMiddleware } from '../../src/middleware/auth.js'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const TEST_DIR = join('/tmp', `tag-routes-test-${randomUUID()}`)
const JWT_SECRET = 'test-secret-for-tag-testing'

describe('Tag Routes', () => {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  let adminToken: string
  let viewerToken: string

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true })

    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    const userStore = new UserStore(join(TEST_DIR, 'users.json'))
    await userStore.init()
    const sessionStore = new MemorySessionStore()
    const authService = new AuthService(userStore, sessionStore, JWT_SECRET)

    const presetTagStore = new PresetTagStore(join(TEST_DIR, 'preset-tags.json'))
    await presetTagStore.init()

    fastify.addHook('onRequest', createAuthMiddleware(authService))
    await fastify.register(tagRoutes, { prefix: '/api/tags', presetTagStore })
    await fastify.ready()

    const adminResult = await authService.register('admin', 'adminpass123', 'admin')
    adminToken = adminResult.token

    const viewerResult = await authService.register('viewer', 'viewerpass123', 'viewer')
    viewerToken = viewerResult.token
  })

  afterAll(async () => {
    await fastify.close()
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {})
  })

  describe('GET /api/tags', () => {
    it('should return empty array initially', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { authorization: `Bearer ${adminToken}` },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ tags: [] })
    })

    it('should be accessible by viewer', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { authorization: `Bearer ${viewerToken}` },
      })
      expect(res.statusCode).toBe(200)
    })

    it('should return 401 without auth', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/tags',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('PUT /api/tags', () => {
    it('should allow admin to set preset tags', async () => {
      const res = await fastify.inject({
        method: 'PUT',
        url: '/api/tags',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { tags: ['production', 'staging', 'database'] },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().tags).toEqual(['database', 'production', 'staging'])
    })

    it('should reject non-admin', async () => {
      const res = await fastify.inject({
        method: 'PUT',
        url: '/api/tags',
        headers: { authorization: `Bearer ${viewerToken}` },
        payload: { tags: ['test'] },
      })
      expect(res.statusCode).toBe(403)
    })

    it('should validate tag format', async () => {
      const res = await fastify.inject({
        method: 'PUT',
        url: '/api/tags',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { tags: ['INVALID'] },
      })
      expect(res.statusCode).toBe(400)
    })

    it('should reject tags exceeding max length', async () => {
      const res = await fastify.inject({
        method: 'PUT',
        url: '/api/tags',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { tags: ['a'.repeat(31)] },
      })
      expect(res.statusCode).toBe(400)
    })

    it('should reject more than 50 tags', async () => {
      const tags = Array.from({ length: 51 }, (_, i) => `tag-${i}`)
      const res = await fastify.inject({
        method: 'PUT',
        url: '/api/tags',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { tags },
      })
      expect(res.statusCode).toBe(400)
    })

    it('should persist tags for subsequent GET', async () => {
      await fastify.inject({
        method: 'PUT',
        url: '/api/tags',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { tags: ['web-tier', 'db-tier'] },
      })

      const res = await fastify.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { authorization: `Bearer ${adminToken}` },
      })
      expect(res.json().tags).toEqual(['db-tier', 'web-tier'])
    })
  })
})
