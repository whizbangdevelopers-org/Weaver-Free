// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireRole } from '../middleware/rbac.js'
import { requireTier } from '../license.js'
import { TIERS, ROLES } from '../constants/vocabularies.js'
import type { VmAclStore } from '../storage/vm-acl-store.js'
import type { DashboardConfig } from '../config.js'
import type { UserStore } from '../storage/user-store.js'
import type { AuditService } from '../services/audit.js'

const userIdParamsSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
})

const vmAclBodySchema = z.object({
  vmNames: z.array(
    z.string().regex(/^[a-z][a-z0-9-]*$/, 'Invalid VM name format')
  ).max(200),
})

const errorResponseSchema = z.object({ error: z.string() })

interface VmAclRouteOptions {
  aclStore: VmAclStore
  config: DashboardConfig
  userStore: UserStore
  auditService: AuditService
}

export const vmAclRoutes: FastifyPluginAsync<VmAclRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { aclStore, config, userStore, auditService } = opts

  // GET /api/users/:id/vms — list VM ACL for a user (admin only, fabrick only)
  app.get(
    '/:id/vms',
    {
      schema: {
        params: userIdParamsSchema,
        response: {
          200: z.object({ userId: z.string(), vmNames: z.array(z.string()) }),
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [requireRole(ROLES.ADMIN)],
    },
    async (request, reply) => {
      try { requireTier(config, TIERS.FABRICK) } catch {
        return reply.status(403).send({ error: 'Per-VM access control requires fabrick tier' })
      }

      const { id } = request.params
      if (!userStore.getById(id)) {
        return reply.status(404).send({ error: 'User not found' })
      }
      return { userId: id, vmNames: aclStore.get(id) }
    }
  )

  // PUT /api/users/:id/vms — set VM ACL for a user (admin only, fabrick only)
  app.put(
    '/:id/vms',
    {
      schema: {
        params: userIdParamsSchema,
        body: vmAclBodySchema,
        response: {
          200: z.object({ userId: z.string(), vmNames: z.array(z.string()) }),
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [requireRole(ROLES.ADMIN)],
    },
    async (request, reply) => {
      try { requireTier(config, TIERS.FABRICK) } catch {
        return reply.status(403).send({ error: 'Per-VM access control requires fabrick tier' })
      }

      const { id } = request.params
      const user = userStore.getById(id)
      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }

      const vmNames = await aclStore.set(id, request.body.vmNames)

      await auditService.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'user.acl-update',
        resource: user.username,
        details: { vmCount: vmNames.length, vmNames },
        ip: request.ip,
        success: true,
      })

      return { userId: id, vmNames }
    }
  )

  // DELETE /api/users/:id/vms — clear VM ACL for a user (admin only, fabrick only)
  app.delete(
    '/:id/vms',
    {
      schema: {
        params: userIdParamsSchema,
        response: {
          200: z.object({ success: z.boolean(), message: z.string() }),
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [requireRole(ROLES.ADMIN)],
    },
    async (request, reply) => {
      try { requireTier(config, TIERS.FABRICK) } catch {
        return reply.status(403).send({ error: 'Per-VM access control requires fabrick tier' })
      }

      const { id } = request.params
      const user = userStore.getById(id)
      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }

      await aclStore.clear(id)

      await auditService.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'user.acl-clear',
        resource: user.username,
        ip: request.ip,
        success: true,
      })

      return { success: true, message: `VM access restrictions cleared for '${user.username}'` }
    }
  )
}
