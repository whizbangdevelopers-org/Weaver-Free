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
import { verifyWsToken } from '../middleware/auth.js'
import type { VmAclStore } from '../storage/vm-acl-store.js'
import type { DashboardConfig } from '../config.js'
import { TIERS, ROLES } from '../constants/vocabularies.js'

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

  // Broadcast notification events to all connected clients
  function broadcastNotification(event: NotificationEvent) {
    const payload = JSON.stringify({
      type: 'notification',
      event,
      timestamp: new Date().toISOString(),
    })
    for (const client of clients.keys()) {
      if (client.readyState === 1) {
        client.send(payload)
      }
    }
  }

  // Register notification listener
  if (notificationService) {
    notificationService.onNotification(broadcastNotification)
  }

  // Fabrick ACL: should this client's VM list be filtered?
  const isFabrickAcl = config?.tier === TIERS.FABRICK && aclStore

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
    }, 2000)
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

  // Clean up listener when plugin is torn down
  fastify.addHook('onClose', () => {
    sessionEvents.off('session-revoked', onSessionRevoked)
  })

  fastify.get('/ws/status', { websocket: true }, async (socket, request) => {
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

    // Relay provisioning events to this client
    const onProvisioning = (event: ProvisioningEvent) => {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify({
          type: 'vm-provisioning',
          data: event,
          timestamp: new Date().toISOString(),
        }))
      }
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
