// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

vi.mock('../../src/services/agent.js', () => ({
  runAgent: vi.fn(),
  getOperation: vi.fn(),
  hasActiveOperation: vi.fn(),
}))

import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { agentRoutes } from '../../src/routes/agent.js'
import { runAgent, getOperation, hasActiveOperation } from '../../src/services/agent.js'

const mockRunAgent = runAgent as ReturnType<typeof vi.fn>
const mockGetOperation = getOperation as ReturnType<typeof vi.fn>
const mockHasActiveOperation = hasActiveOperation as ReturnType<typeof vi.fn>

describe('Agent Routes', () => {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()

  beforeAll(async () => {
    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)
    await fastify.register(websocket)
    await fastify.register(agentRoutes, { prefix: '/api/workload' })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockHasActiveOperation.mockReturnValue(false)
  })

  describe('POST /api/workload/:name/agent', () => {
    it('should start an agent operation and return 202', async () => {
      mockRunAgent.mockResolvedValue('test-operation-id')

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: { action: 'diagnose' },
      })

      expect(response.statusCode).toBe(202)
      const body = response.json()
      expect(body.operationId).toBe('test-operation-id')
      expect(body.vmName).toBe('web-nginx')
      expect(body.action).toBe('diagnose')
      expect(body.status).toBe('started')
    })

    it('should accept explain action', async () => {
      mockRunAgent.mockResolvedValue('op-2')

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: { action: 'explain' },
      })

      expect(response.statusCode).toBe(202)
      expect(response.json().action).toBe('explain')
    })

    it('should accept suggest action', async () => {
      mockRunAgent.mockResolvedValue('op-3')

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/dev-node/agent',
        payload: { action: 'suggest' },
      })

      expect(response.statusCode).toBe(202)
      expect(response.json().vmName).toBe('dev-node')
    })

    it('should accept optional apiKey and vendor (BYOK/BYOV)', async () => {
      mockRunAgent.mockResolvedValue('op-4')

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: { action: 'diagnose', apiKey: 'sk-test-key', vendor: 'anthropic' },
      })

      expect(response.statusCode).toBe(202)
      expect(mockRunAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          vmName: 'web-nginx',
          action: 'diagnose',
          apiKey: 'sk-test-key',
          vendor: 'anthropic',
        })
      )
    })

    it('should reject invalid VM name format', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/INVALID!/agent',
        payload: { action: 'diagnose' },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject invalid action', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: { action: 'destroy' },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject missing action', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: {},
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 429 when an operation is already running', async () => {
      mockHasActiveOperation.mockReturnValue(true)

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: { action: 'diagnose' },
      })

      expect(response.statusCode).toBe(429)
      expect(response.json().error).toContain('already running')
    })

    it('should reject invalid vendor', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: { action: 'diagnose', vendor: 'openai' },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /api/workload/:name/agent/:operationId', () => {
    const sampleOp = {
      operationId: '550e8400-e29b-41d4-a716-446655440000',
      vmName: 'web-nginx',
      action: 'diagnose',
      status: 'complete',
      tokens: 'Diagnosis result text',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:05.000Z',
    }

    it('should return an operation by ID', async () => {
      mockGetOperation.mockReturnValue(sampleOp)

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/workload/web-nginx/agent/${sampleOp.operationId}`,
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.operationId).toBe(sampleOp.operationId)
      expect(body.status).toBe('complete')
      expect(body.tokens).toBe('Diagnosis result text')
    })

    it('should return 404 for unknown operation', async () => {
      mockGetOperation.mockReturnValue(undefined)

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload/web-nginx/agent/550e8400-e29b-41d4-a716-446655440000',
      })

      expect(response.statusCode).toBe(404)
    })

    it('should reject invalid operation ID format', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload/web-nginx/agent/not-a-uuid',
      })

      expect(response.statusCode).toBe(400)
    })
  })
})
