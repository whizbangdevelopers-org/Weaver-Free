// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { healthRoutes } from '../../src/routes/health.js'

describe('Health Routes', () => {
  const fastify = Fastify()

  beforeAll(async () => {
    await fastify.register(healthRoutes, { prefix: '/api/health' })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
  })

  it('should return healthy status', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/health'
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.status).toBe('healthy')
    expect(body.service).toBe('weaver')
    expect(body.timestamp).toBeDefined()
  })

  it('should return valid ISO timestamp', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/health'
    })

    const body = response.json()
    const parsed = new Date(body.timestamp)
    expect(parsed.getTime()).not.toBeNaN()
  })
})
