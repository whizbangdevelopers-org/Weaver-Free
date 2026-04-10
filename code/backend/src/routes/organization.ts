// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import type { OrganizationStore } from '../storage/organization-store.js'
import type { DashboardConfig } from '../config.js'
import { requireTier } from '../license.js'
import { requireRole } from '../middleware/rbac.js'
import { TIERS, ROLES } from '../constants/vocabularies.js'
import { organizationIdentitySchema } from '../schemas/organization.js'

interface OrganizationRouteOptions {
  organizationStore: OrganizationStore
  config: DashboardConfig
}

export const organizationRoutes: FastifyPluginAsync<OrganizationRouteOptions> = async (app, opts) => {
  const { organizationStore, config } = opts

  // GET /api/organization — public (all authenticated users see org identity)
  app.get('/', async () => {
    return organizationStore.getIdentity()
  })

  // PUT /api/organization — admin only, weaver+ tier
  app.put('/', {
    schema: { body: organizationIdentitySchema },
    preHandler: [requireRole(ROLES.ADMIN)],
  }, async (request, reply) => {
    try {
      requireTier(config, TIERS.WEAVER)
    } catch {
      return reply.status(403).send({ error: 'Organization identity requires Weaver tier or higher' })
    }

    const body = request.body as Record<string, unknown>
    await organizationStore.setIdentity(body)
    return organizationStore.getIdentity()
  })
}
