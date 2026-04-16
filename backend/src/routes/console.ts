// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { createConnection, type Socket } from 'node:net'
import type { Provisioner } from '../services/provisioner-types.js'
import type { AuthService } from '../services/auth.js'
import { verifyWsToken } from '../middleware/auth.js'
import { requireTier } from '../license.js'
import type { DashboardConfig } from '../config.js'
import { TIERS, ROLES } from '../constants/vocabularies.js'

const VM_NAME_RE = /^[a-z][a-z0-9-]*$/

interface ConsoleRouteOptions {
  provisioner?: Provisioner | null
  authService?: AuthService | null
  config?: DashboardConfig | null
}

export const consoleRoutes: FastifyPluginAsync<ConsoleRouteOptions> = async (fastify, opts) => {
  const { provisioner, authService, config } = opts

  fastify.get('/ws/console/:vmName', { websocket: true }, async (socket, request) => {
    // Authenticate via query-param token (same pattern as /ws/status)
    if (authService) {
      const url = new URL(request.url, `http://${request.hostname}`)
      const token = url.searchParams.get('token') ?? undefined
      const auth = await verifyWsToken(authService, token)
      if (!auth) {
        socket.send(JSON.stringify({ error: 'Authentication required' }))
        socket.close(4401, 'Authentication required')
        return
      }
      // Console access requires operator or admin role
      if (auth.role === ROLES.VIEWER) {
        socket.send(JSON.stringify({ error: 'Console access requires operator or admin role' }))
        socket.close(4403, 'Insufficient permissions')
        return
      }
    }

    // Tier gate: real serial console requires weaver tier
    if (config) {
      try {
        requireTier(config, TIERS.SOLO)
      } catch {
        socket.send(JSON.stringify({ error: 'Serial console requires weaver tier' }))
        socket.close(4403, 'Insufficient permissions')
        return
      }
    }

    const { vmName } = request.params as { vmName: string }

    // Validate vmName to prevent path traversal or injection
    if (!VM_NAME_RE.test(vmName)) {
      socket.send(JSON.stringify({ error: 'Invalid VM name format' }))
      socket.close(4400, 'Invalid VM name')
      return
    }

    if (!provisioner) {
      socket.send(JSON.stringify({ error: 'Provisioning not enabled' }))
      socket.close()
      return
    }

    const port = await provisioner.getConsolePort(vmName)
    if (!port) {
      socket.send(JSON.stringify({ error: `VM '${vmName}' is not running or has no console port` }))
      socket.close()
      return
    }

    let tcp: Socket | null = null

    try {
      tcp = createConnection({ host: '127.0.0.1', port }, () => {
        fastify.log.info(`Console proxy connected to ${vmName} on port ${port}`)
      })
    } catch {
      socket.send(JSON.stringify({ error: `Failed to connect to VM console on port ${port}` }))
      socket.close()
      return
    }

    // TCP → WebSocket
    tcp.on('data', (data: Buffer) => {
      if (socket.readyState === 1) {
        socket.send(data)
      }
    })

    // WebSocket → TCP
    socket.on('message', (data: Buffer | string) => {
      if (tcp && !tcp.destroyed) {
        tcp.write(typeof data === 'string' ? data : data)
      }
    })

    // Cleanup on TCP close/error
    tcp.on('close', () => {
      if (socket.readyState === 1) {
        socket.close()
      }
    })

    tcp.on('error', (err) => {
      fastify.log.warn(`Console TCP error for ${vmName}: ${err.message}`)
      if (socket.readyState === 1) {
        socket.close()
      }
    })

    // Cleanup on WebSocket close/error
    socket.on('close', () => {
      if (tcp && !tcp.destroyed) {
        tcp.destroy()
      }
    })

    socket.on('error', () => {
      if (tcp && !tcp.destroyed) {
        tcp.destroy()
      }
    })
  })
}
