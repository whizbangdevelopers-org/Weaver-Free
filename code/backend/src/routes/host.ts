// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireRole } from '../middleware/rbac.js'
import { requireTier } from '../license.js'
import { TIERS, ROLES } from '../constants/vocabularies.js'
import { createRateLimit } from '../middleware/rate-limit.js'
import type { DashboardConfig } from '../config.js'
import type { HostInfoService } from '../services/host-info.js'
import { detailedHostInfoSchema } from '../schemas/host.js'

interface HostRouteOptions {
  config: DashboardConfig
  hostInfoService: HostInfoService
}

export const hostRoutes: FastifyPluginAsync<HostRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { config, hostInfoService } = opts

  app.get(
    '/',
    {
      config: { rateLimit: createRateLimit(30) },
      schema: {
        response: {
          200: detailedHostInfoSchema,
          401: z.object({ error: z.string() }),
          403: z.object({ error: z.string() }),
        },
      },
      preHandler: [requireRole(ROLES.ADMIN)],
    },
    async (_request, reply) => {
      requireTier(config, TIERS.WEAVER)
      const data = await hostInfoService.getDetailedInfo()
      return reply.send(data)
    },
  )
}
