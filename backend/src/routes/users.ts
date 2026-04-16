// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { requireRole } from '../middleware/rbac.js'
import { ROLES } from '../constants/vocabularies.js'
import { toSafeUser } from '../models/user.js'
import type { UserStore } from '../storage/user-store.js'
import type { SessionStore } from '../storage/session-store.js'
import type { AuditService } from '../services/audit.js'
import {
  userListResponseSchema,
  roleUpdateSchema,
  userIdParamsSchema,
  errorResponseSchema,
  userMutationResponseSchema,
  safeUserSchema,
} from '../schemas/users.js'

interface UsersRouteOptions {
  userStore: UserStore
  sessionStore: SessionStore
  auditService: AuditService
}

export const usersRoutes: FastifyPluginAsync<UsersRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { userStore, sessionStore, auditService } = opts

  // GET /api/users — list all users (admin only)
  app.get(
    '/',
    {
      schema: {
        response: {
          200: userListResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
      preHandler: [requireRole(ROLES.ADMIN)],
    },
    async () => {
      const users = userStore.getAll()
      return users.map(toSafeUser)
    }
  )

  // GET /api/users/:id — get single user (admin only)
  app.get(
    '/:id',
    {
      schema: {
        params: userIdParamsSchema,
        response: {
          200: safeUserSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [requireRole(ROLES.ADMIN)],
    },
    async (request, reply) => {
      const { id } = request.params
      const user = userStore.getById(id)
      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }
      return toSafeUser(user)
    }
  )

  // PUT /api/users/:id/role — change a user's role (admin only)
  app.put(
    '/:id/role',
    {
      schema: {
        params: userIdParamsSchema,
        body: roleUpdateSchema,
        response: {
          200: userMutationResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
      preHandler: [requireRole(ROLES.ADMIN)],
    },
    async (request, reply) => {
      const { id } = request.params
      const { role: newRole } = request.body

      const user = userStore.getById(id)
      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }

      // Prevent demoting the last admin
      if (user.role === ROLES.ADMIN && newRole !== ROLES.ADMIN) {
        const adminCount = userStore.getAll().filter(u => u.role === ROLES.ADMIN).length
        if (adminCount <= 1) {
          await auditService.log({
            userId: request.userId ?? null,
            username: request.username ?? 'unknown',
            action: 'user.role-change',
            resource: user.username,
            details: { fromRole: user.role, toRole: newRole, reason: 'last-admin-blocked' },
            ip: request.ip,
            success: false,
          })
          return reply.status(409).send({ error: 'Cannot demote the last admin. Promote another user to admin first.' })
        }
      }

      const oldRole = user.role
      await userStore.update(id, { role: newRole })

      // Invalidate all sessions for the affected user so role change takes effect immediately
      await sessionStore.deleteByUser(id)

      await auditService.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'user.role-change',
        resource: user.username,
        details: { fromRole: oldRole, toRole: newRole },
        ip: request.ip,
        success: true,
      })

      return { success: true, message: `Role updated from '${oldRole}' to '${newRole}'` }
    }
  )

  // DELETE /api/users/:id — delete a user (admin only)
  app.delete(
    '/:id',
    {
      schema: {
        params: userIdParamsSchema,
        response: {
          200: userMutationResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
      preHandler: [requireRole(ROLES.ADMIN)],
    },
    async (request, reply) => {
      const { id } = request.params

      // Prevent self-deletion
      if (id === request.userId) {
        await auditService.log({
          userId: request.userId ?? null,
          username: request.username ?? 'unknown',
          action: 'user.delete',
          resource: request.username ?? 'unknown',
          details: { reason: 'self-delete-blocked' },
          ip: request.ip,
          success: false,
        })
        return reply.status(409).send({ error: 'Cannot delete your own account' })
      }

      const user = userStore.getById(id)
      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }

      // Prevent deleting the last admin
      if (user.role === ROLES.ADMIN) {
        const adminCount = userStore.getAll().filter(u => u.role === ROLES.ADMIN).length
        if (adminCount <= 1) {
          await auditService.log({
            userId: request.userId ?? null,
            username: request.username ?? 'unknown',
            action: 'user.delete',
            resource: user.username,
            details: { reason: 'last-admin-blocked' },
            ip: request.ip,
            success: false,
          })
          return reply.status(409).send({ error: 'Cannot delete the last admin account' })
        }
      }

      // Invalidate all sessions for the deleted user
      await sessionStore.deleteByUser(id)

      await userStore.delete(id)

      await auditService.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'user.delete',
        resource: user.username,
        details: { deletedRole: user.role },
        ip: request.ip,
        success: true,
      })

      return { success: true, message: `User '${user.username}' deleted` }
    }
  )
}
