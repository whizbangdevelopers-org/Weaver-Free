// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { AuditAction, AuditService } from '../services/audit.js'
import { requireTier } from '../license.js'
import type { DashboardConfig } from '../config.js'
import { TIERS, ROLES } from '../constants/vocabularies.js'

const auditQuerySchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  success: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

interface AuditRouteOptions {
  auditService: AuditService
  config: DashboardConfig
}

export const auditRoutes: FastifyPluginAsync<AuditRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { auditService, config } = opts

  // GET /api/audit — query audit log (fabrick tier, admin and operator only)
  app.get(
    '/',
    { schema: { querystring: auditQuerySchema } },
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: 'Authentication required' })
      }

      try {
        requireTier(config, TIERS.FABRICK)
      } catch {
        return reply.status(403).send({ error: 'Audit log requires fabrick tier' })
      }

      if (request.userRole !== ROLES.ADMIN && request.userRole !== ROLES.OPERATOR && request.userRole !== ROLES.AUDITOR) {
        return reply.status(403).send({ error: 'Insufficient permissions. Admin, operator, or auditor role required.' })
      }

      const filters = request.query
      const result = auditService.query({
        userId: filters.userId,
        action: filters.action as AuditAction | undefined,
        resource: filters.resource,
        since: filters.since,
        until: filters.until,
        success: filters.success,
        limit: filters.limit,
        offset: filters.offset,
      })

      return result
    }
  )
}
