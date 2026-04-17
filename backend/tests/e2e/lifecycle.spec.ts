// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * E2E: VM lifecycle test — start → stop → restart with seeded VMs.
 *
 * Uses a real registry in a temp directory. System calls (systemctl) are
 * mocked to simulate VM status transitions without requiring actual VMs.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Track which VMs are "running" in our mock
const runningVms = new Set<string>()

/** Route a mocked systemctl call and return { stdout, stderr } */
function handleExecFile(cmd: string, args: string[]): { stdout: string; stderr: string } {
  const argsStr = args?.join(' ') ?? ''

  // systemctl is-active
  if (argsStr.includes('is-active')) {
    const match = argsStr.match(/microvm@(.+)\.service/)
    const vmName = match?.[1]
    if (vmName && runningVms.has(vmName)) {
      return { stdout: 'active\n', stderr: '' }
    }
    throw Object.assign(new Error('inactive'), { stdout: 'inactive\n', stderr: '' })
  }

  // systemctl start
  if (argsStr.includes('systemctl') && argsStr.includes(' start ')) {
    const match = argsStr.match(/microvm@(.+)\.service/)
    const vmName = match?.[1]
    if (vmName) runningVms.add(vmName)
    return { stdout: '', stderr: '' }
  }

  // systemctl stop
  if (argsStr.includes('systemctl') && argsStr.includes(' stop ')) {
    const match = argsStr.match(/microvm@(.+)\.service/)
    const vmName = match?.[1]
    if (vmName) runningVms.delete(vmName)
    return { stdout: '', stderr: '' }
  }

  // systemctl restart
  if (argsStr.includes('systemctl') && argsStr.includes(' restart ')) {
    const match = argsStr.match(/microvm@(.+)\.service/)
    const vmName = match?.[1]
    if (vmName) runningVms.add(vmName)
    return { stdout: '', stderr: '' }
  }

  // systemctl is-enabled — seeded/registered VMs are enabled (should autostart)
  if (argsStr.includes('is-enabled')) {
    return { stdout: 'enabled\n', stderr: '' }
  }

  // systemctl show (uptime)
  if (argsStr.includes('show')) {
    return { stdout: new Date().toISOString() + '\n', stderr: '' }
  }

  throw new Error(`unmocked command: ${cmd} ${argsStr}`)
}

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>

  // Build a mock execFile with Node's custom promisify symbol so that
  // `promisify(execFile)` returns { stdout, stderr } like the real one.
  const mockExecFile = vi.fn((...fnArgs: unknown[]) => {
    const cb = fnArgs[fnArgs.length - 1] as (...args: unknown[]) => void
    const cmd = fnArgs[0] as string
    const args = (fnArgs[1] ?? []) as string[]
    try {
      const result = handleExecFile(cmd, args)
      cb(null, result.stdout, result.stderr)
    } catch (err) {
      cb(err, '', '')
    }
  })

  // Custom promisify — this is what `util.promisify(execFile)` actually uses
  const { promisify: nodePromisify } = await import('node:util')
  const asyncExecFile = async (cmd: string, args: string[]) => {
    return handleExecFile(cmd, args)
  }
  ;(mockExecFile as unknown as Record<symbol, unknown>)[nodePromisify.custom] = asyncExecFile

  return {
    ...actual,
    execFile: mockExecFile,
    spawn: vi.fn(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { EventEmitter } = require('node:events')
      const proc = new EventEmitter()
      proc.stdout = new EventEmitter()
      proc.stderr = new EventEmitter()
      proc.kill = vi.fn()
      proc.pid = 99999
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

describe('E2E: VM Lifecycle', () => {
  const fastify = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>()
  fastify.decorateRequest('userId', undefined)
  fastify.decorateRequest('userRole', undefined)
  fastify.decorateRequest('username', undefined)
  fastify.decorateRequest('tokenId', undefined)
  fastify.decorateRequest('authRejectionReason', undefined)

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'microvm-lifecycle-'))
    config.dataDir = tmpDir

    const registry = new JsonWorkloadRegistry(join(tmpDir, 'vms.json'))
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

    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    // Simulate auth middleware: all requests run as admin
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
    runningVms.clear()
  })

  it('seeded VM lifecycle: start → status → stop → restart', async () => {
    // 1. Verify the seeded VM exists and is stopped
    let getRes = await fastify.inject({ method: 'GET', url: '/api/workload/web-nginx' })
    expect(getRes.statusCode).toBe(200)
    expect(getRes.json().status).toBe('stopped')
    expect(getRes.json().ip).toBe('10.10.0.10')
    expect(getRes.json().mem).toBe(256)
    expect(getRes.json().vcpu).toBe(1)

    // 2. Start
    const startRes = await fastify.inject({ method: 'POST', url: '/api/workload/web-nginx/start' })
    expect(startRes.statusCode).toBe(200)
    expect(startRes.json().success).toBe(true)

    // 3. Verify it shows running
    getRes = await fastify.inject({ method: 'GET', url: '/api/workload/web-nginx' })
    expect(getRes.json().status).toBe('running')
    expect(getRes.json().uptime).toBeDefined()

    // 4. Stop
    const stopRes = await fastify.inject({ method: 'POST', url: '/api/workload/web-nginx/stop' })
    expect(stopRes.statusCode).toBe(200)
    expect(stopRes.json().success).toBe(true)

    // 5. Verify stopped
    getRes = await fastify.inject({ method: 'GET', url: '/api/workload/web-nginx' })
    expect(getRes.json().status).toBe('stopped')
    expect(getRes.json().uptime).toBeNull()

    // 6. Restart (start from stopped)
    const restartRes = await fastify.inject({ method: 'POST', url: '/api/workload/web-nginx/restart' })
    expect(restartRes.statusCode).toBe(200)
    expect(restartRes.json().success).toBe(true)

    // 7. Verify running again
    getRes = await fastify.inject({ method: 'GET', url: '/api/workload/web-nginx' })
    expect(getRes.json().status).toBe('running')
  })

  it('seeded VMs appear in listing', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/workload' })
    const names = res.json().map((v: { name: string }) => v.name)
    expect(names).toContain('web-nginx')
    expect(names).toContain('web-app')
    expect(names).toContain('dev-node')
    expect(names).toContain('dev-python')
    expect(names).toContain('svc-postgres')
  })

  it('start and stop are idempotent-safe for known VMs', async () => {
    // Stop an already-stopped seeded VM
    const stopRes = await fastify.inject({ method: 'POST', url: '/api/workload/web-nginx/stop' })
    expect(stopRes.statusCode).toBe(200)

    // Start a seeded VM
    const startRes = await fastify.inject({ method: 'POST', url: '/api/workload/web-nginx/start' })
    expect(startRes.statusCode).toBe(200)
    expect(startRes.json().success).toBe(true)

    // Clean up
    runningVms.delete('web-nginx')
  })
})
