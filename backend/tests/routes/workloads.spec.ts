// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

vi.mock('../../src/services/microvm.js', () => ({
  listVms: vi.fn(),
  getVm: vi.fn(),
  startVm: vi.fn(),
  stopVm: vi.fn(),
  restartVm: vi.fn(),
  getWorkloadDefinitions: vi.fn(),
}))

import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { workloadsRoutes } from '../../src/routes/workloads.js'
import { listVms, getVm, startVm, stopVm, restartVm } from '../../src/services/microvm.js'
import type { UserRole } from '../../src/models/user.js'

const mockListVms = listVms as ReturnType<typeof vi.fn>
const mockGetVm = getVm as ReturnType<typeof vi.fn>
const mockStartVm = startVm as ReturnType<typeof vi.fn>
const mockStopVm = stopVm as ReturnType<typeof vi.fn>
const mockRestartVm = restartVm as ReturnType<typeof vi.fn>

const sampleVm = {
  name: 'web-nginx',
  status: 'running',
  ip: '10.10.0.10',
  mem: 256,
  vcpu: 1,
  hypervisor: 'qemu',
  uptime: '2026-01-01T00:00:00.000Z'
}

// Simulate authenticated user role via request decoration
// Tests default to 'admin' so existing tests pass; RBAC tests override per-request
let mockUserRole: UserRole = 'admin'

describe('VM Routes', () => {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  fastify.decorateRequest('userId', undefined)
  fastify.decorateRequest('userRole', undefined)
  fastify.decorateRequest('username', undefined)
  fastify.decorateRequest('tokenId', undefined)
  fastify.decorateRequest('authRejectionReason', undefined)

  beforeAll(async () => {
    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    // Simulate auth middleware: set userRole on every request
    fastify.addHook('onRequest', async (request) => {
      request.userRole = mockUserRole
      request.userId = 'test-user-id'
      request.username = 'test-user'
    })

    await fastify.register(workloadsRoutes, { prefix: '/api/workload' })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockUserRole = 'admin'
  })

  describe('GET /api/workload', () => {
    it('should list all VMs', async () => {
      mockListVms.mockResolvedValue([sampleVm])

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload'
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toHaveLength(1)
      expect(body[0].name).toBe('web-nginx')
    })

    it('should return empty array when no VMs', async () => {
      mockListVms.mockResolvedValue([])

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload'
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual([])
    })

    it('should allow viewer to list VMs', async () => {
      mockListVms.mockResolvedValue([sampleVm])
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload'
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('GET /api/workload/:name', () => {
    it('should return a specific VM', async () => {
      mockGetVm.mockResolvedValue(sampleVm)

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload/web-nginx'
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().name).toBe('web-nginx')
    })

    it('should return 404 for unknown VM', async () => {
      mockGetVm.mockResolvedValue(null)

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload/nonexistent'
      })

      expect(response.statusCode).toBe(404)
    })

    it('should reject invalid VM name format', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload/INVALID_NAME!'
      })

      expect(response.statusCode).toBe(400)
    })

    it('should allow viewer to get VM details', async () => {
      mockGetVm.mockResolvedValue(sampleVm)
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/workload/web-nginx'
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('POST /api/workload/:name/start', () => {
    it('should start a VM', async () => {
      mockStartVm.mockResolvedValue({ success: true, message: "VM 'web-nginx' started" })

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/start'
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
    })

    it('should return 400 on start failure', async () => {
      mockStartVm.mockResolvedValue({ success: false, message: 'Already running' })

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/start'
      })

      expect(response.statusCode).toBe(400)
    })

    it('should allow operator to start VM', async () => {
      mockStartVm.mockResolvedValue({ success: true, message: "VM 'web-nginx' started" })
      mockUserRole = 'operator'

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/start'
      })

      expect(response.statusCode).toBe(200)
    })

    it('should reject viewer from starting VM', async () => {
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/start'
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().error).toBe('Insufficient permissions')
    })
  })

  describe('POST /api/workload/:name/stop', () => {
    it('should stop a VM', async () => {
      mockStopVm.mockResolvedValue({ success: true, message: "VM 'web-nginx' stopped" })

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/stop'
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
    })

    it('should reject viewer from stopping VM', async () => {
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/stop'
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('POST /api/workload/:name/restart', () => {
    it('should restart a VM', async () => {
      mockRestartVm.mockResolvedValue({ success: true, message: "VM 'web-nginx' restarted" })

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/restart'
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
    })

    it('should reject viewer from restarting VM', async () => {
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/restart'
      })

      expect(response.statusCode).toBe(403)
    })
  })
})
