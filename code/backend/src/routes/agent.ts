// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { agentRequestSchema, agentVmParamsSchema, agentOperationParamsSchema } from '../schemas/agent.js'
import { runAgent, getOperation, hasActiveOperation, type AgentWsMessage } from '../services/agent.js'
import { requireTier } from '../license.js'
import type { DashboardConfig } from '../config.js'
import { TIERS } from '../constants/vocabularies.js'
import type { AuditService } from '../services/audit.js'
import type { VmAclStore } from '../storage/vm-acl-store.js'
import { createVmAclCheck } from '../middleware/vm-acl.js'
import { createRateLimit } from '../middleware/rate-limit.js'

/** Per-tier AI agent rate limits (requests per minute).
 *  Infrastructure protection (Decision #128): each request consumes resources —
 *  API tokens (cloud), GPU compute (self-hosted), or host CPU/RAM (local). */
const AI_RATE_LIMITS: Record<string, number> = {
  [TIERS.DEMO]: 5,
  [TIERS.FREE]: 5,
  [TIERS.WEAVER]: 10,
  [TIERS.FABRICK]: 30,
}

interface AgentRouteOptions {
  config?: DashboardConfig
  auditService?: AuditService
  aclStore?: VmAclStore
}

export const agentRoutes: FastifyPluginAsync<AgentRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { config, auditService, aclStore } = opts

  const tierRateLimit = AI_RATE_LIMITS[config?.tier ?? TIERS.DEMO] ?? 5

  // Per-VM ACL check middleware (fabrick only, admin bypass)
  const aclCheck = (aclStore && config) ? createVmAclCheck(aclStore, config) : undefined
  const aclPreHandler = aclCheck ? [aclCheck] : []

  // POST /api/workload/:name/agent — start an agent operation
  app.post(
    '/:name/agent',
    {
      schema: { params: agentVmParamsSchema, body: agentRequestSchema },
      preHandler: [...aclPreHandler],
      config: {
        rateLimit: createRateLimit(tierRateLimit),
      },
    },
    async (request, reply) => {
      const { name } = request.params
      const { action, apiKey, vendor } = request.body

      // Server-key gating: if no BYOK key provided and server has a key,
      // require premium+ tier (free/demo users must BYOK)
      if (!apiKey && config?.aiApiKey) {
        try {
          requireTier({ tier: config.tier }, TIERS.WEAVER)
        } catch (_err) {
          return reply.status(403).send({
            error: 'Server-provided AI key requires weaver tier or higher. Please provide your own API key (BYOK).',
          })
        }
      }

      // Rate limit: one active operation per VM
      if (hasActiveOperation(name)) {
        return reply.status(429).send({
          error: `An agent operation is already running for VM '${name}'`,
        })
      }

      // Broadcast to all connected WebSocket clients
      const broadcast = (msg: AgentWsMessage) => {
        if (!fastify.websocketServer) return
        for (const client of fastify.websocketServer.clients) {
          if (client.readyState === 1) {
            client.send(JSON.stringify(msg))
          }
        }
      }

      const operationId = await runAgent({
        vmName: name,
        action,
        broadcast,
        apiKey,
        vendor,
      })

      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'agent.run',
        resource: name,
        details: { agentAction: action, operationId, byok: !!apiKey, vendor: vendor ?? 'server-default' },
        ip: request.ip,
        success: true,
      })

      return reply.status(202).send({
        operationId,
        vmName: name,
        action,
        status: 'started' as const,
      })
    }
  )

  // GET /api/workload/:name/agent/:operationId — get operation status
  app.get(
    '/:name/agent/:operationId',
    { schema: { params: agentOperationParamsSchema }, preHandler: [...aclPreHandler] },
    async (request, reply) => {
      const { operationId } = request.params
      const op = getOperation(operationId)
      if (!op) {
        return reply.status(404).send({ error: 'Operation not found' })
      }
      return op
    }
  )
}
