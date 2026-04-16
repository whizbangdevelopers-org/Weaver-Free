// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { VmAclStore } from '../../src/storage/vm-acl-store.js'
import { createVmAclCheck } from '../../src/middleware/vm-acl.js'
import type { DashboardConfig } from '../../src/config.js'
import type { FastifyRequest, FastifyReply } from 'fastify'

const TEST_DIR = join('/tmp', `vm-acl-mw-test-${randomUUID()}`)

function makeConfig(tier: 'demo' | 'free' | 'weaver' | 'fabrick'): DashboardConfig {
  return {
    tier,
    licenseExpiry: null,
    licenseGraceMode: false,
    storageBackend: 'json',
    dataDir: TEST_DIR,
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
  }
}

function makeRequest(overrides: Partial<FastifyRequest & { params: Record<string, string> }> = {}): FastifyRequest {
  return {
    userId: 'user-1',
    userRole: 'operator',
    params: { name: 'web-nginx' },
    ...overrides,
  } as unknown as FastifyRequest
}

function makeReply(): FastifyReply {
  const reply = {
    statusCode: 200,
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  }
  return reply as unknown as FastifyReply
}

describe('createVmAclCheck middleware', () => {
  let aclStore: VmAclStore

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true })
    aclStore = new VmAclStore(join(TEST_DIR, 'vm-acls.json'))
    await aclStore.init()
  })

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {})
  })

  it('should pass through on non-fabrick tier', async () => {
    const check = createVmAclCheck(aclStore, makeConfig('weaver'))
    const reply = makeReply()
    await check(makeRequest(), reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  it('should pass through for admin users', async () => {
    const check = createVmAclCheck(aclStore, makeConfig('fabrick'))
    const reply = makeReply()
    await check(makeRequest({ userRole: 'admin' }), reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  it('should pass through when user has no ACL entries', async () => {
    const check = createVmAclCheck(aclStore, makeConfig('fabrick'))
    const reply = makeReply()
    await check(makeRequest({ userId: 'no-acl-user' }), reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  it('should pass through when user is allowed to access VM', async () => {
    await aclStore.set('allowed-user', ['web-nginx', 'dev-node'])
    const check = createVmAclCheck(aclStore, makeConfig('fabrick'))
    const reply = makeReply()
    await check(makeRequest({ userId: 'allowed-user' }), reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  it('should block access to non-assigned VM', async () => {
    await aclStore.set('restricted-user', ['dev-node'])
    const check = createVmAclCheck(aclStore, makeConfig('fabrick'))
    const reply = makeReply()
    await check(makeRequest({ userId: 'restricted-user' }), reply)
    expect(reply.status).toHaveBeenCalledWith(403)
    expect(reply.send).toHaveBeenCalledWith({ error: 'You do not have access to this VM' })
  })

  it('should pass through when route has no :name param', async () => {
    await aclStore.set('restricted-user', ['dev-node'])
    const check = createVmAclCheck(aclStore, makeConfig('fabrick'))
    const reply = makeReply()
    await check(makeRequest({ userId: 'restricted-user', params: {} as Record<string, string> }), reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  it('should pass through when no userId', async () => {
    const check = createVmAclCheck(aclStore, makeConfig('fabrick'))
    const reply = makeReply()
    await check(makeRequest({ userId: undefined }), reply)
    expect(reply.status).not.toHaveBeenCalled()
  })
})
