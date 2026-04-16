// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * E2E API tests — exercise the full Fastify stack with a real JSON registry.
 *
 * Only external system calls (systemctl, ip) are mocked.
 * Everything else (routes, services, registry, validation) runs for real.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Mock child_process before any import that uses it
vi.mock('node:child_process', () => {
  const actual = vi.importActual('node:child_process')
  return {
    ...actual,
    execFile: vi.fn((_cmd: string, _args: string[], cb: (...args: unknown[]) => void) => {
      // Default: systemctl is-active → inactive
      cb(new Error('inactive'), '', '')
    }),
    spawn: vi.fn(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { EventEmitter } = require('node:events')
      const proc = new EventEmitter()
      proc.stdout = new EventEmitter()
      proc.stderr = new EventEmitter()
      proc.kill = vi.fn()
      proc.pid = 12345
      return proc
    }),
  }
})

import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { workloadsRoutes } from '../../src/routes/workloads.js'
import { healthRoutes } from '../../src/routes/health.js'
import { setRegistry } from '../../src/services/microvm.js'
import { JsonWorkloadRegistry } from '../../src/storage/json-registry.js'
import type { DashboardConfig } from '../../src/config.js'

let tmpDir: string
let registry: JsonWorkloadRegistry

const config: DashboardConfig = {
  tier: 'weaver' as const,
  licenseExpiry: null,
  licenseGraceMode: false,
  storageBackend: 'json',
  dataDir: '', // set in beforeAll
  sudoBin: '/run/current-system/sw/bin/sudo',
  systemctlBin: '/run/current-system/sw/bin/systemctl',
  iptablesBin: '/run/current-system/sw/bin/iptables',
  ipBin: '/run/current-system/sw/bin/ip',
  bridgeInterface: 'br-microvm',
  bridgeGateway: '10.10.0.1',
  jwtSecret: 'test-secret',
  sessionStoreType: 'memory',
  notify: { ntfyUrl: null, ntfyTopic: null, ntfyToken: null },
}

function buildApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>()
  app.decorateRequest('userId', undefined)
  app.decorateRequest('userRole', undefined)
  app.decorateRequest('username', undefined)
  app.decorateRequest('tokenId', undefined)
  app.decorateRequest('authRejectionReason', undefined)
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  return app
}

describe('E2E: API Integration', () => {
  const fastify = buildApp()

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'microvm-e2e-'))
    config.dataDir = tmpDir

    registry = new JsonWorkloadRegistry(join(tmpDir, 'vms.json'))
    await registry.init()
    // Seed test VMs (registry starts empty by default)
    for (const vm of [
      { name: 'web-nginx', ip: '10.10.0.10', mem: 256, vcpu: 1, hypervisor: 'qemu', distro: 'nixos' },
      { name: 'web-app', ip: '10.10.0.11', mem: 512, vcpu: 1, hypervisor: 'qemu', distro: 'nixos' },
      { name: 'dev-node', ip: '10.10.0.20', mem: 512, vcpu: 1, hypervisor: 'qemu', distro: 'nixos' },
      { name: 'dev-python', ip: '10.10.0.21', mem: 512, vcpu: 1, hypervisor: 'qemu', distro: 'nixos' },
      { name: 'svc-postgres', ip: '10.10.0.30', mem: 512, vcpu: 1, hypervisor: 'qemu', distro: 'nixos' },
    ]) { await registry.add(vm) }
    setRegistry(registry)

    // Simulate auth middleware: all requests run as admin by default
    fastify.addHook('onRequest', async (request) => {
      request.userRole = 'admin'
      request.userId = 'test-admin-id'
      request.username = 'test-admin'
    })

    await fastify.register(healthRoutes, { prefix: '/api/health' })
    await fastify.register(workloadsRoutes, { prefix: '/api/workload' })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
    await rm(tmpDir, { recursive: true, force: true })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    config.tier = 'weaver'
  })

  // --- Health ---

  describe('GET /api/health', () => {
    it('returns healthy status', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/health' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.status).toBe('healthy')
      expect(body.service).toBe('weaver')
      expect(body.timestamp).toBeDefined()
    })
  })

  // --- List VMs ---

  describe('GET /api/workload', () => {
    it('returns seeded VMs', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/workload' })
      expect(res.statusCode).toBe(200)
      const vms = res.json()
      expect(vms.length).toBeGreaterThanOrEqual(5)
      const names = vms.map((v: { name: string }) => v.name)
      expect(names).toContain('web-nginx')
      expect(names).toContain('svc-postgres')
    })

    it('each VM has required fields', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/workload' })
      const vms = res.json()
      for (const vm of vms) {
        expect(vm).toHaveProperty('name')
        expect(vm).toHaveProperty('status')
        expect(vm).toHaveProperty('ip')
        expect(vm).toHaveProperty('mem')
        expect(vm).toHaveProperty('vcpu')
        expect(vm).toHaveProperty('hypervisor')
      }
    })
  })

  // --- Get single VM ---

  describe('GET /api/workload/:name', () => {
    it('returns a known VM', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/workload/web-nginx' })
      expect(res.statusCode).toBe(200)
      expect(res.json().name).toBe('web-nginx')
    })

    it('returns 404 for unknown VM', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/workload/does-not-exist' })
      expect(res.statusCode).toBe(404)
    })

    it('returns 400 for invalid name format', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/workload/UPPER_CASE!' })
      expect(res.statusCode).toBe(400)
    })
  })

  // --- VM Actions ---

  describe('POST /api/workload/:name/start', () => {
    it('returns 400 for nonexistent VM', async () => {
      const res = await fastify.inject({ method: 'POST', url: '/api/workload/ghost/start' })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('POST /api/workload/:name/stop', () => {
    it('returns 400 for nonexistent VM', async () => {
      const res = await fastify.inject({ method: 'POST', url: '/api/workload/ghost/stop' })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('POST /api/workload/:name/restart', () => {
    it('returns 400 for nonexistent VM', async () => {
      const res = await fastify.inject({ method: 'POST', url: '/api/workload/ghost/restart' })
      expect(res.statusCode).toBe(400)
    })
  })

  // --- VM name validation across endpoints ---

  describe('VM name validation', () => {
    const invalidNames = ['UPPER', '1start', 'has space', 'has_underscore!', '../escape']
    for (const name of invalidNames) {
      it(`rejects invalid name "${name}" on GET`, async () => {
        const res = await fastify.inject({ method: 'GET', url: `/api/workload/${encodeURIComponent(name)}` })
        expect(res.statusCode).toBe(400)
      })
    }
  })
})

// --- Firecracker + NixOS flake rejection (separate app with imageManager mock) ---

describe('E2E: Firecracker NixOS rejection', () => {
  let app: ReturnType<typeof buildApp>
  let tmpDir2: string

  beforeAll(async () => {
    tmpDir2 = await mkdtemp(join(tmpdir(), 'microvm-fc-'))
    const fakeConfig = { ...config, dataDir: tmpDir2 }

    const reg = new JsonWorkloadRegistry(join(tmpDir2, 'vms.json'))
    await reg.init()
    setRegistry(reg)

    const mockImageManager = {
      isFlakeDistro: (distro?: string) => distro === 'nixos-microvm',
      isCloudDistro: (distro?: string) => ['ubuntu', 'fedora'].includes(distro ?? ''),
      isIsoDistro: (distro?: string) => ['nixos-server'].includes(distro ?? ''),
      getDistroSource: () => ({ format: 'flake', cloudInit: false }),
      isQemuVm: () => false,
    }

    app = buildApp()
    app.addHook('onRequest', async (request) => {
      request.userRole = 'admin'
      request.userId = 'test-admin-id'
      request.username = 'test-admin'
    })
    await app.register(workloadsRoutes, {
      prefix: '/api/workload',
      config: fakeConfig,
      imageManager: mockImageManager as never,
    })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await rm(tmpDir2, { recursive: true, force: true })
  })

  it('rejects Firecracker for NixOS flake distros', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workload',
      payload: {
        name: 'test-fc-reject',
        ip: '10.10.0.99',
        mem: 256,
        vcpu: 1,
        hypervisor: 'firecracker',
        distro: 'nixos-microvm',
      },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('Firecracker is incompatible')
  })

  it('allows cloud-hypervisor for NixOS flake distros', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workload',
      payload: {
        name: 'test-ch-allow',
        ip: '10.10.0.98',
        mem: 256,
        vcpu: 1,
        hypervisor: 'cloud-hypervisor',
        distro: 'nixos-microvm',
      },
    })
    // Should pass distro validation (may fail later on provisioning, but not 400 for hypervisor)
    expect(res.statusCode).not.toBe(400)
  })
})
