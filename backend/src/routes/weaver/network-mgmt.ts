// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import type { DashboardConfig } from '../../config.js'
import type { NetworkManager } from '../../services/weaver/network-manager.js'
import { requireTier } from '../../license.js'
import { requireRole } from '../../middleware/rbac.js'
import { TIERS, ROLES } from '../../constants/vocabularies.js'
import {
  createBridgeSchema,
  bridgeNameSchema,
  ipPoolSchema,
  firewallRuleSchema,
  firewallRuleIdSchema,
  vmNameSchema,
  vmNetworkConfigSchema,
} from '../../schemas/network.js'

interface NetworkMgmtRouteOptions {
  config: DashboardConfig
  networkManager: NetworkManager
}

export const networkMgmtRoutes: FastifyPluginAsync<NetworkMgmtRouteOptions> = async (fastify, opts) => {
  const { config, networkManager } = opts

  // Weaver gate decorator
  fastify.addHook('preHandler', async (_request, reply) => {
    try {
      requireTier(config, TIERS.SOLO)
    } catch (_err) {
      return reply.status(403).send({ error: 'Network management requires weaver tier or higher' })
    }
  })

  // --- Bridges ---

  fastify.get('/bridges', {
    preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR)],
  }, async () => {
    const bridges = await networkManager.listBridges()
    return { bridges }
  })

  fastify.post<{ Body: typeof createBridgeSchema._type }>('/bridges', {
    schema: { body: createBridgeSchema },
    preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR)],
  }, async (request) => {
    const { name, subnet, gateway } = request.body
    return networkManager.createBridge(name, subnet, gateway)
  })

  fastify.delete<{ Params: typeof bridgeNameSchema._type }>('/bridges/:name', {
    schema: { params: bridgeNameSchema },
    preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR)],
  }, async (request) => {
    return networkManager.deleteBridge(request.params.name)
  })

  // --- IP Pool ---

  fastify.get<{ Params: typeof bridgeNameSchema._type }>('/ip-pool/:name', {
    schema: { params: bridgeNameSchema },
    preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR)],
  }, async (request, reply) => {
    const pool = networkManager.getIpPool(request.params.name)
    if (!pool) {
      return reply.status(404).send({ error: `No IP pool configured for '${request.params.name}'` })
    }
    return pool
  })

  fastify.put<{ Params: typeof bridgeNameSchema._type; Body: typeof ipPoolSchema._type }>('/ip-pool/:name', {
    schema: { params: bridgeNameSchema, body: ipPoolSchema },
    preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR)],
  }, async (request) => {
    await networkManager.setIpPool(request.params.name, request.body)
    return { success: true, message: 'IP pool updated' }
  })

  // --- Firewall ---

  fastify.get('/firewall', {
    preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR)],
  }, async () => {
    return { rules: networkManager.getFirewallRules() }
  })

  fastify.post<{ Body: typeof firewallRuleSchema._type }>('/firewall', {
    schema: { body: firewallRuleSchema },
    preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR)],
  }, async (request) => {
    const rule = await networkManager.addFirewallRule(request.body)
    return { success: true, rule }
  })

  fastify.delete<{ Params: typeof firewallRuleIdSchema._type }>('/firewall/:id', {
    schema: { params: firewallRuleIdSchema },
    preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR)],
  }, async (request, reply) => {
    const removed = await networkManager.deleteFirewallRule(request.params.id)
    if (!removed) {
      return reply.status(404).send({ error: 'Firewall rule not found' })
    }
    return { success: true, message: 'Rule deleted' }
  })

  // --- VM Network Config ---

  fastify.get<{ Params: typeof vmNameSchema._type }>('/vm-config/:name', {
    schema: { params: vmNameSchema },
    preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR)],
  }, async (request) => {
    const config = networkManager.getVmNetworkConfig(request.params.name)
    return config ?? { ip: '', bridge: '', gateway: '', dns: '' }
  })

  fastify.put<{ Params: typeof vmNameSchema._type; Body: typeof vmNetworkConfigSchema._type }>('/vm-config/:name', {
    schema: { params: vmNameSchema, body: vmNetworkConfigSchema },
    preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR)],
  }, async (request) => {
    await networkManager.setVmNetworkConfig(request.params.name, request.body)
    return { success: true, message: `Network config for '${request.params.name}' saved. Restart the VM to apply.` }
  })
}
