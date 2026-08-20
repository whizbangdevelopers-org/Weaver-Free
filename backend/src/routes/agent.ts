// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { agentRequestSchema, agentVmParamsSchema, agentOperationParamsSchema } from '../schemas/agent.js'
import { runAgent, getOperation, hasActiveOperation, agentEvents, type AgentWsMessage, type AgentBroadcast } from '../services/agent.js'
import { requireTier } from '../license.js'
import type { DashboardConfig } from '../config.js'
import { TIERS, ROLES } from '../constants/vocabularies.js'
import type { AuditService } from '../services/audit.js'
import type { VmAclStore } from '../storage/vm-acl-store.js'
import { createVmAclCheck } from '../middleware/vm-acl.js'
import { requireRole } from '../middleware/rbac.js'
import { createRateLimit } from '../middleware/rate-limit.js'

/** Per-tier AI agent rate limits (requests per minute).
 *  Infrastructure protection: each request consumes resources —
 *  API tokens (cloud), GPU compute (self-hosted), or host CPU/RAM (local). */
const AI_RATE_LIMITS: Record<string, number> = {
  [TIERS.DEMO]: 5,
  [TIERS.FREE]: 5,
  [TIERS.SOLO]: 10,
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
      // Starting an agent operation is an operator action, not a read. `viewer` is documented as
      // read-only and is cited as such in the NIST 800-171 §3.1.5 least-privilege mapping — and
      // a viewer could previously run `diagnose`, which returns an LLM reading of the workload's
      // journal and systemd status, and spends the server's AI key at Solo tier and above.
      // The status GET below stays open to viewers: reading a result is a read.
      preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR), ...aclPreHandler],
      config: {
        rateLimit: createRateLimit(tierRateLimit),
      },
    },
    async (request, reply) => {
      const { name } = request.params
      const { action, apiKey, vendor } = request.body

      // Server-key gating: if no BYOK key provided and server has a key,
      // require weaver+ tier (free/demo users must BYOK)
      if (!apiKey && config?.aiApiKey) {
        try {
          requireTier({ tier: config.tier }, TIERS.SOLO)
        } catch (_err) {
          return reply.status(403).send({
            error: 'Server-provided AI key requires solo tier or higher. Please provide your own API key (BYOK).',
          })
        }
      }

      // Rate limit: one active operation per VM
      if (hasActiveOperation(name)) {
        return reply.status(429).send({
          error: `An agent operation is already running for VM '${name}'`,
        })
      }

      // Hand each message to the WebSocket layer WITH the workload it concerns, and let that
      // layer decide who may see it.
      //
      // This used to iterate `fastify.websocketServer.clients` directly. That is the raw `ws`
      // client set, which carries no auth information at all — so every connected socket received
      // the model's analysis of this workload, whose context is `VmContext { vmDefinition,
      // systemctlStatus, journalLogs }`. On Fabrick that crossed a per-VM ACL boundary: the ACL
      // preHandler above correctly rejects a request for a workload you may not see, and the
      // result was then broadcast to you anyway.
      //
      // `routes/ws.ts` holds the only client map that knows who each socket belongs to. Emitting
      // is what routes this through it. Do not reintroduce a direct client loop here.
      const broadcast = (message: AgentWsMessage) => {
        agentEvents.emit('agent-message', { vmName: name, message } satisfies AgentBroadcast)
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
      const { name, operationId } = request.params
      const op = getOperation(operationId)
      if (!op) {
        return reply.status(404).send({ error: 'Operation not found' })
      }

      // The ACL preHandler authorised `:name`. The operation is fetched by `:operationId`, which
      // is a different key — so without this line the two params are never related, and a user
      // authorised for `vm-b` could read an operation belonging to `vm-a` by naming their own
      // workload in the path. The id is a randomUUID and so unguessable, but it was published to
      // every socket by the broadcast bug above, and operations live for 30 minutes.
      //
      // 404 rather than 403: the caller is authorised for the workload they named, and no
      // operation with that id belongs to it. Saying "forbidden" would confirm the id exists.
      if (op.vmName !== name) {
        return reply.status(404).send({ error: 'Operation not found' })
      }

      return op
    }
  )
}
