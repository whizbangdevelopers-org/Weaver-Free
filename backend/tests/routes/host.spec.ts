// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { hostRoutes } from '../../src/routes/host.js'
import { HostInfoService } from '../../src/services/host-info.js'
import { AuthService } from '../../src/services/auth.js'
import { UserStore } from '../../src/storage/user-store.js'
import { MemorySessionStore } from '../../src/storage/memory-session-store.js'
import { createAuthMiddleware } from '../../src/middleware/auth.js'
import type { DashboardConfig } from '../../src/config.js'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const TEST_DIR = join('/tmp', `host-routes-test-${randomUUID()}`)
const JWT_SECRET = 'test-secret-for-host-testing'

function makeConfig(overrides: Partial<DashboardConfig> = {}): DashboardConfig {
  return {
    tier: 'weaver',
    licenseExpiry: null,
    licenseGraceMode: false,
    storageBackend: 'json',
    dataDir: TEST_DIR,
    provisioningEnabled: false,
    microvmsDir: '/var/lib/microvms',
    bridgeGateway: null,
    bridgeInterface: 'br-microvm',
    sudoBin: 'sudo',
    systemctlBin: 'systemctl',
    iptablesBin: 'iptables',
    qemuBin: 'qemu-system-x86_64',
    qemuImgBin: 'qemu-img',
    ipBin: 'ip',
    lscpuBin: 'lscpu',
    dfBin: 'df',
    nixosVersionBin: 'nixos-version',
    distroCatalogUrl: null,
    jwtSecret: JWT_SECRET,
    sessionStoreType: 'memory',
    notify: { ntfyUrl: null, ntfyTopic: null, ntfyToken: null },
    aiApiKey: '',
    ...overrides,
  }
}

describe('Host Routes', () => {
  let adminToken: string
  let viewerToken: string

  describe('weaver tier', () => {
    const fastify = Fastify().withTypeProvider<ZodTypeProvider>()

    beforeAll(async () => {
      await mkdir(TEST_DIR, { recursive: true })

      fastify.setValidatorCompiler(validatorCompiler)
      fastify.setSerializerCompiler(serializerCompiler)

      const userStore = new UserStore(join(TEST_DIR, 'users.json'))
      await userStore.init()
      const sessionStore = new MemorySessionStore()
      const authService = new AuthService(userStore, sessionStore, JWT_SECRET)

      const hostInfoService = new HostInfoService({
        lscpuBin: 'lscpu', dfBin: 'df', ipBin: 'ip', nixosVersionBin: 'nixos-version',
        isDemo: true, // Use demo mode to avoid shell commands in tests
      })

      const config = makeConfig({ tier: 'weaver' })

      fastify.addHook('onRequest', createAuthMiddleware(authService))
      await fastify.register(hostRoutes, { prefix: '/api/host', config, hostInfoService })
      await fastify.ready()

      const adminResult = await authService.register('admin', 'T3stP@ssw0rd!X', 'admin')
      adminToken = adminResult.token

      const viewerResult = await authService.register('viewer', 'T3stP@ssw0rd!X', 'viewer')
      viewerToken = viewerResult.token
    })

    afterAll(async () => {
      await fastify.close()
      await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {})
    })

    it('should return detailed host info for premium admin', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/host',
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(res.statusCode).toBe(200)
      const data = res.json()
      expect(data).toHaveProperty('nixosVersion')
      expect(data).toHaveProperty('cpuTopology')
      expect(data).toHaveProperty('diskUsage')
      expect(data).toHaveProperty('networkInterfaces')
      expect(data).toHaveProperty('liveMetrics')
      expect(data.liveMetrics).toHaveProperty('freeMemMb')
      expect(data.liveMetrics).toHaveProperty('loadAvg1')
    })

    it('should reject non-admin users with 403', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/host',
        headers: { authorization: `Bearer ${viewerToken}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should reject unauthenticated requests with 401', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/host',
      })

      expect(res.statusCode).toBe(401)
    })
  })

  describe('free tier', () => {
    const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
    const freeTierDir = join(TEST_DIR, 'free')
    let freeAdminToken: string

    beforeAll(async () => {
      await mkdir(freeTierDir, { recursive: true })

      fastify.setValidatorCompiler(validatorCompiler)
      fastify.setSerializerCompiler(serializerCompiler)

      const userStore = new UserStore(join(freeTierDir, 'users.json'))
      await userStore.init()
      const sessionStore = new MemorySessionStore()
      const authService = new AuthService(userStore, sessionStore, JWT_SECRET)

      const hostInfoService = new HostInfoService({
        lscpuBin: 'lscpu', dfBin: 'df', ipBin: 'ip', nixosVersionBin: 'nixos-version',
        isDemo: true,
      })

      const config = makeConfig({ tier: 'free' })

      fastify.addHook('onRequest', createAuthMiddleware(authService))
      await fastify.register(hostRoutes, { prefix: '/api/host', config, hostInfoService })
      await fastify.ready()

      const adminResult = await authService.register('admin', 'T3stP@ssw0rd!X', 'admin')
      freeAdminToken = adminResult.token
    })

    afterAll(async () => {
      await fastify.close()
      await rm(freeTierDir, { recursive: true, force: true }).catch(() => {})
    })

    it('should reject admin on free tier with 403', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/host',
        headers: { authorization: `Bearer ${freeAdminToken}` },
      })

      expect(res.statusCode).toBe(403)
    })
  })
})
