// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { WebSocket } from 'ws'
import { FastifyPluginAsync } from 'fastify'
import { listVms } from '../services/microvm.js'
import { provisioningEvents, type ProvisioningEvent } from '../services/provisioner-types.js'
import type { AuthService } from '../services/auth.js'
import { sessionEvents } from '../services/auth.js'
import type { NotificationService } from '../services/notification.js'
import type { NotificationEvent } from '../models/notification.js'
import { agentEvents, type AgentBroadcast } from '../services/agent.js'
import { verifyWsToken } from '../middleware/auth.js'
import { createRateLimit } from '../middleware/rate-limit.js'
import type { VmAclStore } from '../storage/vm-acl-store.js'
import type { DashboardConfig } from '../config.js'
import { TIERS, ROLES } from '../constants/vocabularies.js'
import { DEFAULT_WS_BROADCAST_INTERVAL_MS } from '../config.js'

interface WsClientInfo {
  userId?: string
  role?: string
}

interface WsRouteOptions {
  authService?: AuthService | null
  notificationService?: NotificationService | null
  aclStore?: VmAclStore | null
  config?: DashboardConfig | null
}

export const wsRoutes: FastifyPluginAsync<WsRouteOptions> = async (fastify, opts) => {
  const { authService, notificationService, aclStore, config } = opts

  // Shared state: one interval broadcasts to all connected clients
  // Map tracks per-client auth info for ACL filtering
  const clients = new Map<WebSocket, WsClientInfo>()
  let broadcastTimer: ReturnType<typeof setInterval> | null = null

  // Fabrick ACL: should this client's view be filtered?
  const isFabrickAcl = config?.tier === TIERS.FABRICK && aclStore

  /**
   * THE decision: may this client receive a message about `vmName`?
   *
   * Every outbound workload-scoped message goes through here. That is the whole point — the ACL
   * was enforced on request paths and on nothing that left, so four separate fan-outs each made
   * their own (absent) decision: the notification broadcast below, the provisioning relay, the
   * agent stream, and the VM-list loop. Only the last one was right.
   *
   * `undefined` vmName means the message is not about a workload (a session-revoked notice, a
   * licence event) and is not ACL-scoped.
   */
  function maySee(info: WsClientInfo, vmName?: string): boolean {
    if (!isFabrickAcl) return true          // ACLs are a Fabrick feature
    if (!vmName) return true                // not workload-scoped
    if (!info.userId) return true           // auth disabled — nothing to scope to
    if (info.role === ROLES.ADMIN) return true
    return aclStore!.isAllowed(info.userId, vmName)
  }

  // Broadcast notification events, ACL-scoped per client.
  //
  // This used to iterate `clients.keys()`, discarding the WsClientInfo the same Map carries and
  // that the VM-list loop below uses correctly. NotificationEvent carries `vmName` plus the whole
  // `security` category — auth-failure, unauthorized-access, permission-denied — so every
  // connected client received other users' security telemetry and the names of workloads they
  // are not permitted to see.
  function broadcastNotification(event: NotificationEvent) {
    const payload = JSON.stringify({
      type: 'notification',
      event,
      timestamp: new Date().toISOString(),
    })
    for (const [client, info] of clients) {
      if (client.readyState !== 1) continue
      if (!maySee(info, event.vmName)) continue
      client.send(payload)
    }
  }

  // Agent output, ACL-scoped per client. `routes/agent.ts` emits rather than broadcasting so this
  // is the only place agent messages reach a socket — see AgentBroadcast for why.
  function broadcastAgent({ vmName, message }: AgentBroadcast) {
    const payload = JSON.stringify(message)
    for (const [client, info] of clients) {
      if (client.readyState !== 1) continue
      if (!maySee(info, vmName)) continue
      client.send(payload)
    }
  }
  agentEvents.on('agent-message', broadcastAgent)

  // Register notification listener
  if (notificationService) {
    notificationService.onNotification(broadcastNotification)
  }

  function startBroadcastLoop() {
    if (broadcastTimer) return // already running
    broadcastTimer = setInterval(async () => {
      if (clients.size === 0) return
      try {
        // Single listVms() call shared across all clients
        const vms = await listVms()
        const timestamp = new Date().toISOString()

        // Pre-build the full payload for clients without ACL restrictions
        const fullPayload = JSON.stringify({ type: 'vm-status', data: vms, timestamp })

        // Cache serialized payloads per ACL user to avoid re-serializing for each client
        const aclPayloadCache = new Map<string, string>()

        for (const [client, info] of clients) {
          if (client.readyState !== 1) continue

          // Fabrick ACL filtering: non-admin users with ACL entries see only assigned VMs
          if (isFabrickAcl && info.userId && info.role !== ROLES.ADMIN && aclStore!.hasAcl(info.userId)) {
            let cached = aclPayloadCache.get(info.userId)
            if (!cached) {
              const filtered = aclStore!.filterVms(info.userId, vms)
              cached = JSON.stringify({ type: 'vm-status', data: filtered, timestamp })
              aclPayloadCache.set(info.userId, cached)
            }
            client.send(cached)
          } else {
            client.send(fullPayload)
          }
        }

        // Detect state changes and emit notifications
        if (notificationService) {
          await notificationService.detectChanges(vms)
        }
      } catch {
        // ignore broadcast errors
      }
      // Configurable per deployment: the loop calls listVms() once per tick regardless of how
      // many clients are attached, so its cost scales with WORKLOAD COUNT rather than users. A
      // host with hundreds of workloads pays that thirty times a minute at the 2s default.
      // Clamped in config.ts, so an operator's typo cannot busy-loop the event loop here.
    }, config?.wsBroadcastIntervalMs ?? DEFAULT_WS_BROADCAST_INTERVAL_MS)
  }

  function stopBroadcastLoop() {
    if (broadcastTimer && clients.size === 0) {
      clearInterval(broadcastTimer)
      broadcastTimer = null
    }
  }

  // Single-session enforcement: when a user logs in elsewhere, kick their existing WS connections
  const onSessionRevoked = (userId: string) => {
    for (const [client, info] of clients) {
      if (info.userId === userId && client.readyState === 1) {
        client.send(JSON.stringify({ type: 'error', error: 'Session ended — logged in from another location' }))
        client.close(4402, 'Session replaced')
      }
    }
  }
  sessionEvents.on('session-revoked', onSessionRevoked)

  // Clean up listeners when plugin is torn down
  fastify.addHook('onClose', () => {
    agentEvents.off('agent-message', broadcastAgent)
    sessionEvents.off('session-revoked', onSessionRevoked)
  })

  // Rate-limited at the ROUTE, not left to the global 120/min default. The handler performs
  // authorization (verifyWsToken below), which is what CodeQL's js/missing-rate-limiting flags —
  // and the rule cannot see a globally-registered plugin, only a route-level config.
  //
  // The global limit does in fact cover this route: @fastify/rate-limit's hook was verified to
  // fire on a websocket UPGRADE, not merely on plain requests. So this is a tightening, not a
  // repair — and it is preferred over dismissing the alert because a route-level limit keeps the
  // control local. A dismissal would go on outliving a refactor that drops the global one.
  //
  // 30/min rather than the 10 the auth routes use: the limiter keys on `userId ?? ip`, and the
  // upgrade authenticates INSIDE the handler, so there is no userId yet and every client behind
  // one NAT shares a budget. The frontend backs off 1s→30s capped (src/services/ws.ts), which is
  // ~6 attempts in a worst-case minute, so 30 leaves headroom for several colleagues reconnecting
  // together while staying 4× tighter than the default. createRateLimit() already neutralises
  // itself under test mode, so this needs no separate test-mode branch.
  fastify.get('/ws/status', {
    websocket: true,
    config: { rateLimit: createRateLimit(30) },
  }, async (socket, request) => {
    // Verify WebSocket auth token from query parameter or httpOnly cookie.
    // Browser clients use cookies (httpOnly means JS can't read them to put in query).
    // Non-browser clients (curl, tests) can use the ?token= query parameter.
    let clientInfo: WsClientInfo = {}
    if (authService) {
      const url = new URL(request.url, `http://${request.hostname}`)
      const queryToken = url.searchParams.get('token') ?? undefined
      const cookieToken = (request as { cookies?: Record<string, string> }).cookies?.weaver_token
      const token = queryToken ?? cookieToken
      const auth = await verifyWsToken(authService, token)
      if (!auth) {
        socket.send(JSON.stringify({ type: 'error', error: 'Authentication required' }))
        socket.close(4401, 'Authentication required')
        return
      }
      clientInfo = { userId: auth.userId, role: auth.role }
    }

    // Add this client to the shared broadcast map with auth info
    clients.set(socket, clientInfo)
    startBroadcastLoop()

    // Relay provisioning events to this client, ACL-scoped.
    //
    // ProvisioningEvent carries `name` (the workload), plus state, progress and error text, and
    // this relayed all of it to every socket. Same class as the notification and agent fan-outs.
    const onProvisioning = (event: ProvisioningEvent) => {
      if (socket.readyState !== 1) return
      if (!maySee(clientInfo, event.name)) return
      socket.send(JSON.stringify({
        type: 'vm-provisioning',
        data: event,
        timestamp: new Date().toISOString(),
      }))
    }
    provisioningEvents.on('state-change', onProvisioning)

    const cleanup = () => {
      clients.delete(socket)
      provisioningEvents.off('state-change', onProvisioning)
      stopBroadcastLoop()
    }

    socket.on('close', cleanup)
    socket.on('error', cleanup)
  })
}
