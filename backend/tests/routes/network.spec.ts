// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

vi.mock('../../src/services/microvm.js', () => ({
  listVms: vi.fn(),
}))

import Fastify from 'fastify'
import { networkRoutes } from '../../src/routes/network.js'
import { listVms } from '../../src/services/microvm.js'
import type { DashboardConfig } from '../../src/config.js'

const mockListVms = listVms as ReturnType<typeof vi.fn>

const testConfig = {
  tier: 'demo' as const,
  licenseExpiry: null,
  licenseGraceMode: false,
  storageBackend: 'json' as const,
  dataDir: './data',
  bridgeGateway: '10.10.0.1',
  bridgeInterface: 'br-microvm',
  ipBin: '/run/current-system/sw/bin/ip',
  sudoBin: 'sudo',
  systemctlBin: 'systemctl',
  iptablesBin: 'iptables',
  jwtSecret: 'test-secret',
  sessionStoreType: 'memory' as const,
  notify: { ntfyUrl: null, ntfyTopic: null, ntfyToken: null },
} satisfies DashboardConfig

describe('Network Routes', () => {
  const fastify = Fastify()
  fastify.decorateRequest('userId', undefined)
  fastify.decorateRequest('userRole', undefined)
  fastify.decorateRequest('username', undefined)
  fastify.decorateRequest('tokenId', undefined)
  fastify.decorateRequest('authRejectionReason', undefined)

  beforeAll(async () => {
    // Simulate auth middleware: set userRole on every request
    fastify.addHook('onRequest', async (request) => {
      request.userRole = 'admin'
      request.userId = 'test-user-id'
      request.username = 'test-user'
    })

    await fastify.register(networkRoutes, { prefix: '/api/network', config: testConfig })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return topology with bridges and nodes', async () => {
    mockListVms.mockResolvedValue([
      {
        name: 'web-nginx',
        status: 'running',
        ip: '10.10.0.10',
        mem: 256,
        vcpu: 1,
        hypervisor: 'qemu',
        uptime: '2026-01-01T00:00:00Z',
        distro: 'ubuntu',
      },
    ])

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/network/topology',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    // VMs without bridge field default to config.bridgeInterface
    expect(body.bridges).toHaveLength(1)
    expect(body.bridges[0]).toEqual({
      name: 'br-microvm',
      gateway: '10.10.0.1',
      subnet: '10.10.0.0/24',
    })

    expect(body.nodes).toHaveLength(1)
    expect(body.nodes[0]).toEqual({
      name: 'web-nginx',
      ip: '10.10.0.10',
      status: 'running',
      hypervisor: 'qemu',
      distro: 'ubuntu',
      bridge: 'br-microvm',
      mem: 256,
      vcpu: 1,
      uptime: '2026-01-01T00:00:00Z',
    })
  })

  it('should group VMs by bridge', async () => {
    mockListVms.mockResolvedValue([
      { name: 'vm-a', status: 'running', ip: '10.10.1.10', mem: 256, vcpu: 1, hypervisor: 'qemu', uptime: null, bridge: 'br-web' },
      { name: 'vm-b', status: 'stopped', ip: '10.10.2.20', mem: 512, vcpu: 1, hypervisor: 'qemu', uptime: null, bridge: 'br-dev' },
    ])

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/network/topology',
    })

    const body = response.json()
    expect(body.bridges).toHaveLength(2)

    const bridgeNames = body.bridges.map((b: { name: string }) => b.name)
    expect(bridgeNames).toContain('br-web')
    expect(bridgeNames).toContain('br-dev')

    expect(body.nodes[0].bridge).toBe('br-web')
    expect(body.nodes[1].bridge).toBe('br-dev')
  })

  it('should return empty nodes and no bridges for no VMs', async () => {
    mockListVms.mockResolvedValue([])

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/network/topology',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body.bridges).toEqual([])
    expect(body.nodes).toEqual([])
  })

  it('should handle nodes without optional fields', async () => {
    mockListVms.mockResolvedValue([
      {
        name: 'test-vm',
        status: 'stopped',
        ip: '10.10.0.50',
        mem: 256,
        vcpu: 1,
        hypervisor: 'microvm',
        uptime: null,
      },
    ])

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/network/topology',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body.nodes).toHaveLength(1)
    expect(body.nodes[0].name).toBe('test-vm')
    expect(body.nodes[0].bridge).toBe('br-microvm') // defaults to config
    expect(body.nodes[0].distro).toBeUndefined()
  })

  it('should derive subnet correctly from VM IPs', async () => {
    mockListVms.mockResolvedValue([
      { name: 'vm-1', status: 'running', ip: '192.168.5.100', mem: 256, vcpu: 1, hypervisor: 'qemu', uptime: null, bridge: 'br-custom' },
    ])

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/network/topology',
    })

    const body = response.json()
    expect(body.bridges[0].subnet).toBe('192.168.5.0/24')
    expect(body.bridges[0].gateway).toBe('192.168.5.1')
  })
})
