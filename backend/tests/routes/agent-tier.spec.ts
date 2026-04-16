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
import { runAgent, hasActiveOperation } from '../../src/services/agent.js'
import type { DashboardConfig } from '../../src/config.js'

const mockRunAgent = runAgent as ReturnType<typeof vi.fn>
const mockHasActiveOperation = hasActiveOperation as ReturnType<typeof vi.fn>

/** Create a minimal DashboardConfig for testing */
function makeConfig(overrides: Partial<DashboardConfig> = {}): DashboardConfig {
  return {
    tier: 'demo',
    licenseExpiry: null,
    licenseGraceMode: false,
    storageBackend: 'json',
    dataDir: './data',
    provisioningEnabled: false,
    microvmsDir: '/var/lib/microvms',
    bridgeGateway: '10.10.0.1',
    bridgeInterface: 'br-microvm',
    sudoBin: 'sudo',
    systemctlBin: 'systemctl',
    iptablesBin: 'iptables',
    qemuBin: 'qemu-system-x86_64',
    qemuImgBin: 'qemu-img',
    ipBin: 'ip',
    distroCatalogUrl: null,
    jwtSecret: 'test-secret',
    sessionStoreType: 'memory',
    notify: { ntfyUrl: null, ntfyTopic: null, ntfyToken: null },
    aiApiKey: '',
    ...overrides,
  }
}

describe('Agent Tier Enforcement', () => {

  describe('Server key gating — free tier blocked from server key', () => {
    let fastify: ReturnType<typeof Fastify>

    beforeAll(async () => {
      fastify = Fastify().withTypeProvider<ZodTypeProvider>()
      fastify.setValidatorCompiler(validatorCompiler)
      fastify.setSerializerCompiler(serializerCompiler)
      await fastify.register(websocket)

      // Free tier WITH server key configured
      const config = makeConfig({ tier: 'free', aiApiKey: 'sk-ant-test-server-key' })
      await fastify.register(agentRoutes, { prefix: '/api/workload', config })
      await fastify.ready()
    })

    afterAll(async () => {
      await fastify.close()
    })

    beforeEach(() => {
      vi.clearAllMocks()
      mockHasActiveOperation.mockReturnValue(false)
    })

    it('should return 403 when free user uses server key (no BYOK)', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: { action: 'diagnose' },
      })

      expect(response.statusCode).toBe(403)
      const body = response.json()
      expect(body.error).toContain('weaver')
      expect(body.error).toContain('BYOK')
    })

    it('should allow free user WITH BYOK key', async () => {
      mockRunAgent.mockResolvedValue('op-byok')

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: { action: 'diagnose', apiKey: 'sk-ant-user-byok-key' },
      })

      expect(response.statusCode).toBe(202)
      expect(response.json().operationId).toBe('op-byok')
    })
  })

  describe('Server key gating — weaver tier allowed', () => {
    let fastify: ReturnType<typeof Fastify>

    beforeAll(async () => {
      fastify = Fastify().withTypeProvider<ZodTypeProvider>()
      fastify.setValidatorCompiler(validatorCompiler)
      fastify.setSerializerCompiler(serializerCompiler)
      await fastify.register(websocket)

      const config = makeConfig({ tier: 'weaver', aiApiKey: 'sk-ant-test-server-key' })
      await fastify.register(agentRoutes, { prefix: '/api/workload', config })
      await fastify.ready()
    })

    afterAll(async () => {
      await fastify.close()
    })

    beforeEach(() => {
      vi.clearAllMocks()
      mockHasActiveOperation.mockReturnValue(false)
    })

    it('should allow weaver user to use server key', async () => {
      mockRunAgent.mockResolvedValue('op-weaver')

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: { action: 'diagnose' },
      })

      expect(response.statusCode).toBe(202)
      expect(response.json().operationId).toBe('op-weaver')
    })
  })

  describe('Server key gating — fabrick tier allowed', () => {
    let fastify: ReturnType<typeof Fastify>

    beforeAll(async () => {
      fastify = Fastify().withTypeProvider<ZodTypeProvider>()
      fastify.setValidatorCompiler(validatorCompiler)
      fastify.setSerializerCompiler(serializerCompiler)
      await fastify.register(websocket)

      const config = makeConfig({ tier: 'fabrick', aiApiKey: 'sk-ant-test-server-key' })
      await fastify.register(agentRoutes, { prefix: '/api/workload', config })
      await fastify.ready()
    })

    afterAll(async () => {
      await fastify.close()
    })

    beforeEach(() => {
      vi.clearAllMocks()
      mockHasActiveOperation.mockReturnValue(false)
    })

    it('should allow fabrick user to use server key', async () => {
      mockRunAgent.mockResolvedValue('op-fabrick')

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: { action: 'diagnose' },
      })

      expect(response.statusCode).toBe(202)
      expect(response.json().operationId).toBe('op-fabrick')
    })
  })

  describe('Server key gating — no server key configured', () => {
    let fastify: ReturnType<typeof Fastify>

    beforeAll(async () => {
      fastify = Fastify().withTypeProvider<ZodTypeProvider>()
      fastify.setValidatorCompiler(validatorCompiler)
      fastify.setSerializerCompiler(serializerCompiler)
      await fastify.register(websocket)

      // Free tier WITHOUT server key — falls through to mock mode
      const config = makeConfig({ tier: 'free', aiApiKey: '' })
      await fastify.register(agentRoutes, { prefix: '/api/workload', config })
      await fastify.ready()
    })

    afterAll(async () => {
      await fastify.close()
    })

    beforeEach(() => {
      vi.clearAllMocks()
      mockHasActiveOperation.mockReturnValue(false)
    })

    it('should allow free user when no server key (mock mode)', async () => {
      mockRunAgent.mockResolvedValue('op-mock')

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: { action: 'diagnose' },
      })

      // No server key means no gating — falls through to mock agent
      expect(response.statusCode).toBe(202)
      expect(response.json().operationId).toBe('op-mock')
    })
  })

  describe('Server key gating — demo tier blocked', () => {
    let fastify: ReturnType<typeof Fastify>

    beforeAll(async () => {
      fastify = Fastify().withTypeProvider<ZodTypeProvider>()
      fastify.setValidatorCompiler(validatorCompiler)
      fastify.setSerializerCompiler(serializerCompiler)
      await fastify.register(websocket)

      const config = makeConfig({ tier: 'demo', aiApiKey: 'sk-ant-test-server-key' })
      await fastify.register(agentRoutes, { prefix: '/api/workload', config })
      await fastify.ready()
    })

    afterAll(async () => {
      await fastify.close()
    })

    beforeEach(() => {
      vi.clearAllMocks()
      mockHasActiveOperation.mockReturnValue(false)
    })

    it('should return 403 when demo user tries to use server key', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: { action: 'diagnose' },
      })

      expect(response.statusCode).toBe(403)
      const body = response.json()
      expect(body.error).toContain('weaver')
    })

    it('should allow demo user WITH BYOK key', async () => {
      mockRunAgent.mockResolvedValue('op-demo-byok')

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/workload/web-nginx/agent',
        payload: { action: 'diagnose', apiKey: 'sk-ant-user-key' },
      })

      expect(response.statusCode).toBe(202)
    })
  })
})
