// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// The per-VM ACL, asserted from the CONSUMER side.
//
// `tests/middleware/vm-acl.spec.ts` covers what the ACL hook DECIDES, and covers it well. It
// cannot cover what this file does, because every one of its cases inspects the provider — the
// hook's own verdict on a request. Nothing asserted what a *second connected socket* receives,
// and that is precisely where the ACL was absent: four separate WebSocket fan-outs (notifications,
// provisioning relay, agent output, VM list) each made their own decision about who to send to,
// and only the VM list got it right.
//
// The principle, stated inline rather than cited: a check that only observes your own side of a
// seam is not a control. For any dependency you wire up, assert something only the CONSUMER can
// produce. These tests connect two clients with different ACLs and assert on the bytes the
// restricted one actually receives.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebSocket } from 'ws'

vi.mock('../../src/services/microvm.js', () => ({
  listVms: vi.fn(async () => []),
}))

import { wsRoutes } from '../../src/routes/ws.js'
import { agentEvents } from '../../src/services/agent.js'
import { provisioningEvents } from '../../src/services/provisioner-types.js'
import { VmAclStore } from '../../src/storage/vm-acl-store.js'
import type { DashboardConfig } from '../../src/config.js'
import type { NotificationEvent } from '../../src/models/notification.js'
import { TIERS, ROLES } from '../../src/constants/vocabularies.js'

/**
 * Auth stub: the token IS the user id, so each client's identity is set by its query param.
 * `verifyToken` THROWS on a bad token — that is the real contract `verifyWsToken` catches.
 */
function makeAuthService(roleFor: Record<string, string>) {
  return {
    verifyToken: vi.fn(async (token: string) => {
      const role = roleFor[token]
      if (!role) throw new Error('invalid token')
      return { sub: token, role, username: token, jti: `${token}-jti` }
    }),
  }
}

/** Captures the notification callback so a test can fire an event through the real code path. */
function makeNotificationService() {
  let handler: ((e: NotificationEvent) => void) | null = null
  return {
    onNotification: (fn: (e: NotificationEvent) => void) => { handler = fn },
    detectChanges: vi.fn(async () => {}),
    emit: (e: NotificationEvent) => handler?.(e),
  }
}

function connect(port: number, token: string): Promise<{ socket: WebSocket; messages: string[] }> {
  return new Promise((resolve, reject) => {
    const messages: string[] = []
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/status?token=${token}`)
    socket.on('message', (d) => messages.push(d.toString()))
    socket.on('open', () => resolve({ socket, messages }))
    socket.on('error', reject)
  })
}

const settle = () => new Promise((r) => setTimeout(r, 120))

describe('WebSocket fan-out respects the per-VM ACL', () => {
  let app: ReturnType<typeof Fastify>
  let dir: string
  let aclStore: VmAclStore
  let notifications: ReturnType<typeof makeNotificationService>
  let port: number

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'weaver-ws-acl-'))
    aclStore = new VmAclStore(join(dir, 'acl.json'))
    await aclStore.init()

    // alice may see web-app only. bob has no ACL entries. carol is admin.
    await aclStore.set('alice', ['web-app'])

    notifications = makeNotificationService()

    app = Fastify()
    await app.register(websocket)
    await app.register(wsRoutes, {
      authService: makeAuthService({
        alice: ROLES.OPERATOR,
        bob: ROLES.OPERATOR,
        carol: ROLES.ADMIN,
      }) as never,
      notificationService: notifications as never,
      aclStore,
      // ACLs are a Fabrick feature — at any lower tier the filter is correctly a no-op.
      config: { tier: TIERS.FABRICK, wsBroadcastIntervalMs: 60_000 } as DashboardConfig,
    })
    await app.listen({ port: 0, host: '127.0.0.1' })
    port = (app.server.address() as { port: number }).port
  })

  afterEach(async () => {
    await app.close()
    await rm(dir, { recursive: true, force: true })
  })

  it('does not send a notification about a workload the client may not see', async () => {
    const alice = await connect(port, 'alice')

    notifications.emit({
      id: 'n1',
      timestamp: new Date().toISOString(),
      event: 'vm:failed',
      vmName: 'svc-postgres',           // NOT in alice's ACL
      severity: 'error',
      message: 'svc-postgres entered a failed state',
    })
    await settle()

    expect(alice.messages.join('')).not.toContain('svc-postgres')
    alice.socket.close()
  })

  it('does send a notification about a workload the client may see', async () => {
    const alice = await connect(port, 'alice')

    notifications.emit({
      id: 'n2',
      timestamp: new Date().toISOString(),
      event: 'vm:started',
      vmName: 'web-app',                // IS in alice's ACL
      severity: 'info',
      message: 'web-app started',
    })
    await settle()

    expect(alice.messages.join('')).toContain('web-app')
    alice.socket.close()
  })

  it('does not leak agent output for another workload', async () => {
    const alice = await connect(port, 'alice')

    agentEvents.emit('agent-message', {
      vmName: 'svc-postgres',
      message: { type: 'agent-complete', operationId: 'op-1', fullText: 'JOURNAL ANALYSIS SECRET' },
    })
    await settle()

    const seen = alice.messages.join('')
    expect(seen).not.toContain('JOURNAL ANALYSIS SECRET')
    // The operation id matters on its own: it was the key to the operation-lookup route.
    expect(seen).not.toContain('op-1')
    alice.socket.close()
  })

  it('delivers agent output for a workload the client may see', async () => {
    const alice = await connect(port, 'alice')

    agentEvents.emit('agent-message', {
      vmName: 'web-app',
      message: { type: 'agent-complete', operationId: 'op-2', fullText: 'allowed analysis' },
    })
    await settle()

    expect(alice.messages.join('')).toContain('allowed analysis')
    alice.socket.close()
  })

  it('does not leak provisioning events for another workload', async () => {
    const alice = await connect(port, 'alice')

    provisioningEvents.emit('state-change', {
      name: 'svc-postgres',
      state: 'failed',
      error: 'disk image missing at /var/lib/microvms/svc-postgres',
    })
    await settle()

    expect(alice.messages.join('')).not.toContain('svc-postgres')
    alice.socket.close()
  })

  // The IGNORE half, and the half that keeps the guard from being switched off later.
  it('sends everything to an admin, and to a user with no ACL entries', async () => {
    const carol = await connect(port, 'carol')   // admin
    const bob = await connect(port, 'bob')       // no ACL entries — sees all, by design

    agentEvents.emit('agent-message', {
      vmName: 'svc-postgres',
      message: { type: 'agent-complete', operationId: 'op-3', fullText: 'broad analysis' },
    })
    await settle()

    expect(carol.messages.join('')).toContain('broad analysis')
    expect(bob.messages.join('')).toContain('broad analysis')

    carol.socket.close()
    bob.socket.close()
  })
})
