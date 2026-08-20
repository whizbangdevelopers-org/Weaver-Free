// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

vi.mock('../../src/services/agent.js', async () => {
  const { EventEmitter } = await import('node:events')
  return {
    runAgent: vi.fn(),
    getOperation: vi.fn(),
    hasActiveOperation: vi.fn(),
    // Real emitter, not a stub: the route hands agent output to this instead of iterating
    // WebSocket clients itself, so a test that stubbed it away would stop exercising the path.
    agentEvents: new EventEmitter(),
  }
})

import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { agentRoutes } from '../../src/routes/agent.js'
import { runAgent, getOperation, hasActiveOperation } from '../../src/services/agent.js'
import type { UserRole } from '../../src/models/user.js'

const mockRunAgent = runAgent as ReturnType<typeof vi.fn>
const mockGetOperation = getOperation as ReturnType<typeof vi.fn>
const mockHasActiveOperation = hasActiveOperation as ReturnType<typeof vi.fn>

// Starting an agent operation requires admin or operator. Tests default to 'operator' — the
// least-privileged role that may — so the suite exercises the ordinary path rather than the
// admin bypass. The viewer rejection is asserted explicitly below.
let mockUserRole: UserRole = 'operator'

describe('Agent Routes', () => {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  fastify.decorateRequest('userId', undefined)
  fastify.decorateRequest('userRole', undefined)
  fastify.decorateRequest('username', undefined)

  beforeAll(async () => {
    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)
    await fastify.register(websocket)

    // Simulate auth middleware
    fastify.addHook('onRequest', async (request) => {
      request.userRole = mockUserRole
      request.userId = 'test-user-id'
      request.username = 'test-user'
    })

    await fastify.register(agentRoutes, { prefix: '/api/workload' })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockHasActiveOperation.mockReturnValue(false)
    mockUserRole = 'operator'
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

  describe('role enforcement on POST', () => {
    // Regression: the POST carried an ACL check and a tier gate but no role guard, so `viewer` —
    // documented read-only, and cited as such in the NIST 800-171 §3.1.5 least-privilege row —
    // could start an operation that returns an LLM reading of the workload's journal and spends
    // the server's AI key.
    it('rejects viewer', async () => {
      mockUserRole = 'viewer'
      mockRunAgent.mockResolvedValue('op-id')

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: { action: 'diagnose' },
      })

      expect(response.statusCode).toBe(403)
      expect(mockRunAgent).not.toHaveBeenCalled()
    })

    // The IGNORE half: both roles that SHOULD pass must still pass, or the guard is too tight
    // and gets loosened by whoever it blocks next.
    it.each(['admin', 'operator'] as const)('allows %s', async (role) => {
      mockUserRole = role
      mockRunAgent.mockResolvedValue('op-id')

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: { action: 'diagnose' },
      })

      expect(response.statusCode).toBe(202)
      expect(mockRunAgent).toHaveBeenCalled()
    })

    // Reading a result is a read — viewers keep it.
    it('still allows viewer to read an operation', async () => {
      mockUserRole = 'viewer'
      mockGetOperation.mockReturnValue({
        operationId: '550e8400-e29b-41d4-a716-446655440000',
        vmName: 'web-nginx',
        action: 'diagnose',
        status: 'complete',
        tokens: 'text',
        startedAt: '2026-01-01T00:00:00.000Z',
      })

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload/web-nginx/agent/550e8400-e29b-41d4-a716-446655440000',
      })

      expect(response.statusCode).toBe(200)
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

    // Regression: the ACL preHandler authorises `:name`, but the operation is fetched by
    // `:operationId` — a different key. Without the cross-check a user authorised for `web-app`
    // could read an operation belonging to `web-nginx` simply by naming their own workload in
    // the path. The store returns the operation; the route must refuse it.
    it('should return 404 when the operation belongs to a different workload', async () => {
      mockGetOperation.mockReturnValue(sampleOp)   // sampleOp.vmName === 'web-nginx'

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/workload/web-app/agent/${sampleOp.operationId}`,
      })

      expect(response.statusCode).toBe(404)
      // The leak this guards is the payload, so assert the payload specifically.
      expect(response.body).not.toContain('Diagnosis result text')
      expect(response.body).not.toContain('web-nginx')
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
