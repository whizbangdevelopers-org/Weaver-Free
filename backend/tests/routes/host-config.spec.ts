// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { hostConfigRoutes } from '../../src/routes/host-config.js'
import { AuthService } from '../../src/services/auth.js'
import { UserStore } from '../../src/storage/user-store.js'
import { MemorySessionStore } from '../../src/storage/memory-session-store.js'
import { createAuthMiddleware } from '../../src/middleware/auth.js'
import type { DashboardConfig } from '../../src/config.js'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const TEST_DIR = join('/tmp', `host-config-routes-test-${randomUUID()}`)
const JWT_SECRET = 'test-secret-for-host-config-testing'

function makeConfig(overrides: Partial<DashboardConfig> = {}): DashboardConfig {
  return {
    tier: 'demo',
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
    dockerBin: 'docker',
    podmanBin: 'podman',
    distroCatalogUrl: null,
    jwtSecret: JWT_SECRET,
    sessionStoreType: 'memory',
    notify: { ntfyUrl: null, ntfyTopic: null, ntfyToken: null },
    aiApiKey: '',
    nixConfigPath: '/etc/nixos/configuration.nix',
    ...overrides,
  }
}

describe('Host Config Routes', () => {
  let adminToken: string
  let viewerToken: string

  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true })

    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    const userStore = new UserStore(join(TEST_DIR, 'users.json'))
    await userStore.init()
    const sessionStore = new MemorySessionStore()
    const authService = new AuthService(userStore, sessionStore, JWT_SECRET)

    // Demo tier: returns mock config without touching filesystem
    const config = makeConfig({ tier: 'demo' })

    fastify.addHook('onRequest', createAuthMiddleware(authService))
    await fastify.register(hostConfigRoutes, { prefix: '/api/config', config })
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

  it('should return 401 without auth', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/config' })
    expect(res.statusCode).toBe(401)
  })

  it('should return config for admin user', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/config',
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.available).toBe(true)
    expect(typeof body.rawContent).toBe('string')
    expect(Array.isArray(body.sections)).toBe(true)
    expect(body.configPath).toBe('/etc/nixos/configuration.nix')
    expect(typeof body.readAt).toBe('string')
  })

  it('should return config for viewer user', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/config',
      headers: { authorization: `Bearer ${viewerToken}` },
    })
    expect(res.statusCode).toBe(200)
  })

  it('demo mode response contains microvm sections', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/config',
      headers: { authorization: `Bearer ${adminToken}` },
    })
    const body = res.json()
    const microvmSections = body.sections.filter((s: { type: string }) => s.type === 'microvm')
    expect(microvmSections.length).toBeGreaterThan(0)
  })

  it('demo mode response contains oci-container sections', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/config',
      headers: { authorization: `Bearer ${adminToken}` },
    })
    const body = res.json()
    const ociSections = body.sections.filter((s: { type: string }) => s.type === 'oci-container')
    expect(ociSections.length).toBeGreaterThan(0)
  })

  it('should return available:false when config file does not exist', async () => {
    const nonExistentFastify = Fastify().withTypeProvider<ZodTypeProvider>()
    nonExistentFastify.setValidatorCompiler(validatorCompiler)
    nonExistentFastify.setSerializerCompiler(serializerCompiler)

    const userStore2 = new UserStore(join(TEST_DIR, 'users2.json'))
    await userStore2.init()
    const sessionStore2 = new MemorySessionStore()
    const authService2 = new AuthService(userStore2, sessionStore2, JWT_SECRET)

    // Free tier with non-existent path triggers the unavailable path
    const config = makeConfig({ tier: 'free', nixConfigPath: '/nonexistent/configuration.nix' })

    nonExistentFastify.addHook('onRequest', createAuthMiddleware(authService2))
    await nonExistentFastify.register(hostConfigRoutes, { prefix: '/api/config', config })
    await nonExistentFastify.ready()

    const { token } = await authService2.register('admin2', 'adminpass123', 'admin')

    const res = await nonExistentFastify.inject({
      method: 'GET',
      url: '/api/config',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.available).toBe(false)
    expect(body.rawContent).toBeNull()
    expect(body.sections).toHaveLength(0)
    expect(body.error).toBeDefined()

    await nonExistentFastify.close()
  })
})
