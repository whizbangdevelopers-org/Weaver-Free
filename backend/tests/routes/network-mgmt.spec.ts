// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { networkMgmtRoutes } from '../../src/routes/weaver/network-mgmt.js'
import { NetworkStore } from '../../src/storage/network-store.js'
import { NetworkManager } from '../../src/services/weaver/network-manager.js'
import type { DashboardConfig } from '../../src/config.js'
import type { UserRole } from '../../src/models/user.js'

// Simulate authenticated user role
let mockUserRole: UserRole = 'admin'

// Mock execFile so bridge/iptables commands don't actually run
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
    cb(null, { stdout: '', stderr: '' })
  }),
}))

const baseConfig: DashboardConfig = {
  tier: 'weaver' as const,
  licenseExpiry: null,
  licenseGraceMode: false,
  storageBackend: 'json',
  dataDir: './data',
  provisioningEnabled: false,
  microvmsDir: '/var/lib/microvms',
  bridgeGateway: '10.10.0.1',
  bridgeInterface: 'br-microvm',
  microvmBin: '/run/current-system/sw/bin/microvm',
  qemuBin: '/run/current-system/sw/bin/qemu-system-x86_64',
  qemuImgBin: '/run/current-system/sw/bin/qemu-img',
  ipBin: '/run/current-system/sw/bin/ip',
  distroCatalogUrl: null,
}

describe('Network Management Routes', () => {
  let tempDir: string
  let networkStore: NetworkStore
  let networkManager: NetworkManager

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'net-mgmt-'))
    networkStore = new NetworkStore(join(tempDir, 'network-config.json'))
    await networkStore.init()
    networkManager = new NetworkManager(networkStore, baseConfig)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('weaver tier enabled', () => {
    let fastify: ReturnType<typeof Fastify>

    beforeEach(async () => {
      mockUserRole = 'admin'
      fastify = Fastify().withTypeProvider<ZodTypeProvider>()
      fastify.decorateRequest('userId', undefined)
      fastify.decorateRequest('userRole', undefined)
      fastify.decorateRequest('username', undefined)
      fastify.decorateRequest('tokenId', undefined)
      fastify.decorateRequest('authRejectionReason', undefined)
      fastify.setValidatorCompiler(validatorCompiler)
      fastify.setSerializerCompiler(serializerCompiler)

      // Simulate auth middleware
      fastify.addHook('onRequest', async (request) => {
        request.userRole = mockUserRole
        request.userId = 'test-user-id'
        request.username = 'test-user'
      })

      await fastify.register(networkMgmtRoutes, {
        prefix: '/api/network',
        config: { ...baseConfig, tier: 'weaver' as const },
        networkManager,
      })
      await fastify.ready()
    })

    afterEach(async () => {
      await fastify.close()
    })

    // --- Bridges ---

    it('GET /bridges should return empty list', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/api/network/bridges' })
      expect(response.statusCode).toBe(200)
      expect(response.json().bridges).toEqual([])
    })

    it('POST /bridges should create a bridge', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/network/bridges',
        payload: { name: 'br-test', subnet: '10.20.0.0/24', gateway: '10.20.0.1' },
      })
      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      const list = await fastify.inject({ method: 'GET', url: '/api/network/bridges' })
      expect(list.json().bridges).toHaveLength(1)
    })

    it('DELETE /bridges/:name should delete a bridge', async () => {
      await networkStore.addBridge({ name: 'br-del', subnet: '10.30.0.0/24', gateway: '10.30.0.1' })

      const response = await fastify.inject({ method: 'DELETE', url: '/api/network/bridges/br-del' })
      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
    })

    // --- IP Pool ---

    it('GET /ip-pool/:name should return 404 when not configured', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/api/network/ip-pool/br-test' })
      expect(response.statusCode).toBe(404)
    })

    it('PUT /ip-pool/:name should set IP pool', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/network/ip-pool/br-test',
        payload: { start: '10.20.0.10', end: '10.20.0.100' },
      })
      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      const get = await fastify.inject({ method: 'GET', url: '/api/network/ip-pool/br-test' })
      expect(get.statusCode).toBe(200)
      expect(get.json().start).toBe('10.20.0.10')
    })

    // --- Firewall ---

    it('GET /firewall should return empty list', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/api/network/firewall' })
      expect(response.statusCode).toBe(200)
      expect(response.json().rules).toEqual([])
    })

    it('POST /firewall should add a rule', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/network/firewall',
        payload: { source: '10.10.0.10', destination: '10.10.0.20', port: 80, protocol: 'tcp', action: 'allow' },
      })
      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
      expect(response.json().rule.id).toBeDefined()

      const list = await fastify.inject({ method: 'GET', url: '/api/network/firewall' })
      expect(list.json().rules).toHaveLength(1)
    })

    it('DELETE /firewall/:id should delete a rule', async () => {
      // Create a rule first
      const create = await fastify.inject({
        method: 'POST',
        url: '/api/network/firewall',
        payload: { source: '10.10.0.10', destination: '10.10.0.20', port: 443, protocol: 'tcp', action: 'deny' },
      })
      const ruleId = create.json().rule.id

      const response = await fastify.inject({ method: 'DELETE', url: `/api/network/firewall/${ruleId}` })
      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
    })

    it('DELETE /firewall/:id should return 404 for unknown rule', async () => {
      const response = await fastify.inject({ method: 'DELETE', url: '/api/network/firewall/00000000-0000-0000-0000-000000000000' })
      expect(response.statusCode).toBe(404)
    })
  })

  describe('weaver tier disabled (demo)', () => {
    let fastify: ReturnType<typeof Fastify>

    beforeEach(async () => {
      mockUserRole = 'admin'
      fastify = Fastify().withTypeProvider<ZodTypeProvider>()
      fastify.decorateRequest('userId', undefined)
      fastify.decorateRequest('userRole', undefined)
      fastify.decorateRequest('username', undefined)
      fastify.decorateRequest('tokenId', undefined)
      fastify.decorateRequest('authRejectionReason', undefined)
      fastify.setValidatorCompiler(validatorCompiler)
      fastify.setSerializerCompiler(serializerCompiler)

      // Simulate auth middleware
      fastify.addHook('onRequest', async (request) => {
        request.userRole = mockUserRole
        request.userId = 'test-user-id'
        request.username = 'test-user'
      })

      await fastify.register(networkMgmtRoutes, {
        prefix: '/api/network',
        config: { ...baseConfig, tier: 'demo' as const },
        networkManager,
      })
      await fastify.ready()
    })

    afterEach(async () => {
      await fastify.close()
    })

    it('GET /bridges should return 403', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/api/network/bridges' })
      expect(response.statusCode).toBe(403)
      expect(response.json().error).toContain('weaver')
    })

    it('POST /bridges should return 403', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/network/bridges',
        payload: { name: 'br-test', subnet: '10.20.0.0/24', gateway: '10.20.0.1' },
      })
      expect(response.statusCode).toBe(403)
    })

    it('GET /firewall should return 403', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/api/network/firewall' })
      expect(response.statusCode).toBe(403)
    })
  })
})
