// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'

describe('Rate Limiting', () => {
  describe('global defaults and headers', () => {
    const fastify = Fastify()

    beforeAll(async () => {
      await fastify.register(rateLimit, {
        global: true,
        max: 5,
        timeWindow: '1 minute',
        addHeaders: {
          'x-ratelimit-limit': true,
          'x-ratelimit-remaining': true,
          'x-ratelimit-reset': true,
        },
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: 'Too many requests. Please try again later.',
        }),
      })

      fastify.get('/api/test', async () => ({ ok: true }))

      await fastify.ready()
    })

    afterAll(async () => {
      await fastify.close()
    })

    it('should include X-RateLimit headers in responses', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/test',
        remoteAddress: '10.0.0.1',
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['x-ratelimit-limit']).toBe('5')
      expect(response.headers['x-ratelimit-remaining']).toBeDefined()
      expect(response.headers['x-ratelimit-reset']).toBeDefined()
    })

    it('should return 429 after exceeding the global limit', async () => {
      const ip = '10.1.0.1'

      // Exhaust the limit (5 requests)
      for (let i = 0; i < 5; i++) {
        const res = await fastify.inject({
          method: 'GET',
          url: '/api/test',
          remoteAddress: ip,
        })
        expect(res.statusCode).toBe(200)
      }

      // 6th request should be rate limited
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/test',
        remoteAddress: ip,
      })

      expect(response.statusCode).toBe(429)
      const body = response.json()
      expect(body.error).toBe('Too many requests. Please try again later.')
    })

    it('should return standard error format and Retry-After header on 429', async () => {
      const ip = '10.2.0.1'

      for (let i = 0; i < 5; i++) {
        await fastify.inject({
          method: 'GET',
          url: '/api/test',
          remoteAddress: ip,
        })
      }

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/test',
        remoteAddress: ip,
      })

      expect(response.statusCode).toBe(429)
      const body = response.json()
      expect(body).toHaveProperty('error')
      expect(body.error).toBe('Too many requests. Please try again later.')
      expect(response.headers['retry-after']).toBeDefined()
    })

    it('should track different IPs independently', async () => {
      const ipA = '10.3.0.1'
      const ipB = '10.3.0.2'

      // Exhaust ipA
      for (let i = 0; i < 5; i++) {
        await fastify.inject({
          method: 'GET',
          url: '/api/test',
          remoteAddress: ipA,
        })
      }

      // ipA should be limited
      const resA = await fastify.inject({
        method: 'GET',
        url: '/api/test',
        remoteAddress: ipA,
      })
      expect(resA.statusCode).toBe(429)

      // ipB should still work
      const resB = await fastify.inject({
        method: 'GET',
        url: '/api/test',
        remoteAddress: ipB,
      })
      expect(resB.statusCode).toBe(200)
    })
  })

  describe('per-route rate limit overrides', () => {
    const fastify = Fastify()

    beforeAll(async () => {
      await fastify.register(rateLimit, {
        global: true,
        max: 10,
        timeWindow: '1 minute',
        addHeaders: {
          'x-ratelimit-limit': true,
          'x-ratelimit-remaining': true,
          'x-ratelimit-reset': true,
        },
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: 'Too many requests. Please try again later.',
        }),
      })

      // Auth-like route: 3 req/min
      fastify.post('/api/auth/login', {
        config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
      }, async () => ({ ok: true }))

      // VM mutation-like route: 6 req/min
      fastify.post('/api/workload/start', {
        config: { rateLimit: { max: 6, timeWindow: '1 minute' } },
      }, async () => ({ ok: true }))

      // Agent-like route: 3 req/min
      fastify.post('/api/agent', {
        config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
      }, async () => ({ ok: true }))

      // General GET route: uses global default (10 req/min)
      fastify.get('/api/workload', async () => ({ ok: true }))

      await fastify.ready()
    })

    afterAll(async () => {
      await fastify.close()
    })

    it('should enforce auth-like route limit (3 req/min)', async () => {
      const ip = '10.10.0.1'

      for (let i = 0; i < 3; i++) {
        const res = await fastify.inject({
          method: 'POST',
          url: '/api/auth/login',
          remoteAddress: ip,
        })
        expect(res.statusCode).toBe(200)
      }

      const res = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: ip,
      })
      expect(res.statusCode).toBe(429)
      expect(res.headers['x-ratelimit-limit']).toBe('3')
    })

    it('should enforce VM mutation route limit (6 req/min)', async () => {
      const ip = '10.11.0.1'

      for (let i = 0; i < 6; i++) {
        const res = await fastify.inject({
          method: 'POST',
          url: '/api/workload/start',
          remoteAddress: ip,
        })
        expect(res.statusCode).toBe(200)
      }

      const res = await fastify.inject({
        method: 'POST',
        url: '/api/workload/start',
        remoteAddress: ip,
      })
      expect(res.statusCode).toBe(429)
    })

    it('should enforce agent route limit (3 req/min)', async () => {
      const ip = '10.12.0.1'

      for (let i = 0; i < 3; i++) {
        const res = await fastify.inject({
          method: 'POST',
          url: '/api/agent',
          remoteAddress: ip,
        })
        expect(res.statusCode).toBe(200)
      }

      const res = await fastify.inject({
        method: 'POST',
        url: '/api/agent',
        remoteAddress: ip,
      })
      expect(res.statusCode).toBe(429)
    })

    it('should allow more requests on general GET than on auth routes', async () => {
      const ip = '10.13.0.1'

      // General GET allows 10
      for (let i = 0; i < 10; i++) {
        const res = await fastify.inject({
          method: 'GET',
          url: '/api/workload',
          remoteAddress: ip,
        })
        expect(res.statusCode).toBe(200)
      }

      const resGet = await fastify.inject({
        method: 'GET',
        url: '/api/workload',
        remoteAddress: ip,
      })
      expect(resGet.statusCode).toBe(429)

      // Same IP: auth route has its own counter (3 req/min)
      for (let i = 0; i < 3; i++) {
        const res = await fastify.inject({
          method: 'POST',
          url: '/api/auth/login',
          remoteAddress: ip,
        })
        expect(res.statusCode).toBe(200)
      }

      const resAuth = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: ip,
      })
      expect(resAuth.statusCode).toBe(429)
    })
  })

  describe('per-user key generation', () => {
    const fastify = Fastify()

    beforeAll(async () => {
      await fastify.register(rateLimit, {
        global: true,
        max: 3,
        timeWindow: '1 minute',
        keyGenerator: (request) => (request as Record<string, unknown>).userId as string ?? request.ip,
        addHeaders: {
          'x-ratelimit-limit': true,
          'x-ratelimit-remaining': true,
          'x-ratelimit-reset': true,
        },
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: 'Too many requests. Please try again later.',
        }),
      })

      // Simulate auth middleware that sets userId from header
      fastify.addHook('onRequest', async (request) => {
        const userId = request.headers['x-test-user-id']
        if (userId && typeof userId === 'string') {
          ;(request as Record<string, unknown>).userId = userId
        }
      })

      fastify.get('/api/test', async () => ({ ok: true }))

      await fastify.ready()
    })

    afterAll(async () => {
      await fastify.close()
    })

    it('should key by userId for authenticated requests (shared across IPs)', async () => {
      const userId = 'user-abc-123'

      // 2 requests from IP A
      for (let i = 0; i < 2; i++) {
        const res = await fastify.inject({
          method: 'GET',
          url: '/api/test',
          remoteAddress: '10.20.0.1',
          headers: { 'x-test-user-id': userId },
        })
        expect(res.statusCode).toBe(200)
      }

      // 1 request from IP B — same user
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/test',
        remoteAddress: '10.20.0.2',
        headers: { 'x-test-user-id': userId },
      })
      expect(res.statusCode).toBe(200)

      // 4th request (from any IP) should be rate limited
      const limited = await fastify.inject({
        method: 'GET',
        url: '/api/test',
        remoteAddress: '10.20.0.3',
        headers: { 'x-test-user-id': userId },
      })
      expect(limited.statusCode).toBe(429)
    })

    it('should key by IP for unauthenticated requests', async () => {
      const ip = '10.21.0.1'

      for (let i = 0; i < 3; i++) {
        const res = await fastify.inject({
          method: 'GET',
          url: '/api/test',
          remoteAddress: ip,
        })
        expect(res.statusCode).toBe(200)
      }

      const limited = await fastify.inject({
        method: 'GET',
        url: '/api/test',
        remoteAddress: ip,
      })
      expect(limited.statusCode).toBe(429)

      // Different IP should still work
      const other = await fastify.inject({
        method: 'GET',
        url: '/api/test',
        remoteAddress: '10.21.0.2',
      })
      expect(other.statusCode).toBe(200)
    })
  })

  describe('test environment bypass', () => {
    it('should allow extremely high limit when configured for test mode', async () => {
      const fastify = Fastify()

      await fastify.register(rateLimit, {
        global: true,
        max: 1_000_000, // simulating test env config
        timeWindow: '1 minute',
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: 'Too many requests. Please try again later.',
        }),
      })

      fastify.get('/api/test', async () => ({ ok: true }))

      await fastify.ready()

      // Should never hit rate limit with reasonable request counts
      const ip = '10.30.0.1'
      for (let i = 0; i < 50; i++) {
        const res = await fastify.inject({
          method: 'GET',
          url: '/api/test',
          remoteAddress: ip,
        })
        expect(res.statusCode).toBe(200)
      }

      await fastify.close()
    })
  })
})
