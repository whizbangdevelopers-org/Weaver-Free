// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { requireRole } from '../middleware/rbac.js'
import { requireTier } from '../license.js'
import { TIERS, ROLES } from '../constants/vocabularies.js'
import type { DashboardConfig } from '../config.js'
import type { QuotaStore } from '../storage/quota-store.js'
import type { UserStore } from '../storage/user-store.js'
import type { AuditService } from '../services/audit.js'
import { getWorkloadDefinitions } from '../services/microvm.js'
import {
  quotaParamsSchema,
  quotaUpdateSchema,
  quotaResponseSchema,
  quotaUsageResponseSchema,
  quotaErrorResponseSchema,
} from '../schemas/quotas.js'

interface QuotaRouteOptions {
  config: DashboardConfig
  quotaStore: QuotaStore
  userStore: UserStore
  auditService?: AuditService
}

export const quotaRoutes: FastifyPluginAsync<QuotaRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { config, quotaStore, userStore, auditService } = opts

  // GET /api/users/:id/quotas — get user's quota (with current usage)
  app.get(
    '/:id/quotas',
    {
      schema: {
        params: quotaParamsSchema,
        response: {
          200: quotaUsageResponseSchema,
          403: quotaErrorResponseSchema,
          404: quotaErrorResponseSchema,
        },
      },
      preHandler: [requireRole(ROLES.ADMIN)],
    },
    async (request, reply) => {
      try {
        requireTier(config, TIERS.FABRICK)
      } catch {
        return reply.status(403).send({ error: 'Resource quotas require fabrick tier' })
      }

      const { id } = request.params
      const user = userStore.getById(id)
      if (!user) {
        return reply.status(404).send({ error: `User '${id}' not found` })
      }

      const quota = quotaStore.get(id)

      // Calculate current usage from VM definitions
      const allVms = await getWorkloadDefinitions()
      const vmList = Object.values(allVms)
      const currentVms = vmList.length
      const currentMemoryMB = vmList.reduce((sum, vm) => sum + vm.mem, 0)
      const currentVcpus = vmList.reduce((sum, vm) => sum + vm.vcpu, 0)

      return {
        ...quota,
        currentVms,
        currentMemoryMB,
        currentVcpus,
      }
    }
  )

  // PUT /api/users/:id/quotas — set user's quota (admin only)
  app.put(
    '/:id/quotas',
    {
      schema: {
        params: quotaParamsSchema,
        body: quotaUpdateSchema,
        response: {
          200: quotaResponseSchema,
          403: quotaErrorResponseSchema,
          404: quotaErrorResponseSchema,
        },
      },
      preHandler: [requireRole(ROLES.ADMIN)],
    },
    async (request, reply) => {
      try {
        requireTier(config, TIERS.FABRICK)
      } catch {
        return reply.status(403).send({ error: 'Resource quotas require fabrick tier' })
      }

      const { id } = request.params
      const user = userStore.getById(id)
      if (!user) {
        return reply.status(404).send({ error: `User '${id}' not found` })
      }

      const result = await quotaStore.set(id, request.body)

      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'quota.update',
        resource: id,
        details: {
          targetUser: user.username,
          maxVms: request.body.maxVms,
          maxMemoryMB: request.body.maxMemoryMB,
          maxVcpus: request.body.maxVcpus,
        },
        ip: request.ip,
        success: true,
      })

      return result
    }
  )
}
